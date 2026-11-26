using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using ERP.Warehouse.Api.Controllers;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface ISalesReturnService
{
    Task<List<RmaReturnResponseDto>> GetReturnsAsync(string? decision = null);
    Task<SalesReturnOperationResult> CreateInvoiceReturnAsync(string invoiceId, CreateInvoiceReturnRequestDto request, string? actorName);
    Task<SalesReturnOperationResult> ApproveAndRestockReturnAsync(Guid rmaId, ApproveSalesReturnRequestDto? request, string? actorName);
}

public class SalesReturnOperationResult
{
    public bool Success { get; init; }
    public int StatusCode { get; init; } = 200;
    public string? ErrorCode { get; init; }
    public string? Message { get; init; }
    public RmaReturnResponseDto? Data { get; init; }
}

public class SalesReturnService : ISalesReturnService
{
    private readonly AppDbContext _context;
    private readonly IConnectionMultiplexer? _redis;
    private readonly IDatabase? _redisDb;
    private readonly ILogger<SalesReturnService> _logger;
    private readonly ILoyaltyService? _loyaltyService;

    public SalesReturnService(
        AppDbContext context,
        ILogger<SalesReturnService> logger,
        IConnectionMultiplexer? redis = null,
        ILoyaltyService? loyaltyService = null)
    {
        _context = context;
        _logger = logger;
        _redis = redis;
        _redisDb = _redis?.GetDatabase();
        _loyaltyService = loyaltyService;
    }

    public async Task<List<RmaReturnResponseDto>> GetReturnsAsync(string? decision = null)
    {
        var query = _context.RmaReturnRequests
            .Include(r => r.Warehouse)
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(decision) && !string.Equals(decision.Trim(), "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = decision.Trim().ToUpperInvariant();
            query = query.Where(r => r.Decision == normalized);
        }

        var rows = await query.Take(200).ToListAsync();
        return rows.Select(r => MapToDto(r, 0, r.Warehouse?.Name)).ToList();
    }

    public async Task<SalesReturnOperationResult> CreateInvoiceReturnAsync(
        string invoiceId,
        CreateInvoiceReturnRequestDto request,
        string? actorName)
    {
        if (request.ReturnQuantity <= 0)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 400,
                ErrorCode = "ERR_INVALID_RETURN_QUANTITY",
                Message = "يجب تحديد كمية إرجاع صحيحة (أكبر من صفر)."
            };
        }

        SalesInvoice? invoice = await FindInvoiceAsync(invoiceId);
        if (invoice == null)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 404,
                ErrorCode = "ERR_INVOICE_NOT_FOUND",
                Message = $"الفاتورة ({invoiceId}) غير موجودة."
            };
        }

        // Validate product line item belongs to this invoice
        var invoiceItem = invoice.Items.FirstOrDefault(it =>
            it.ProductId == request.ProductId ||
            (!string.IsNullOrWhiteSpace(request.Sku) && it.Product?.Sku == request.Sku));

        if (invoiceItem == null)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 400,
                ErrorCode = "ERR_PRODUCT_NOT_IN_INVOICE",
                Message = "مرفوض رقابياً: الصنف المحدد غير موجود ضمن بنود هذه الفاتورة الأصلية."
            };
        }

        var targetWarehouse = await ResolveTargetWarehouseAsync(request.WarehouseId, invoiceItem.SourceWarehouseId ?? invoice.WarehouseId);
        if (targetWarehouse == null)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 400,
                ErrorCode = "ERR_WAREHOUSE_NOT_FOUND",
                Message = "المستودع المستهدف لإرجاع البضاعة غير موجود أو غير نشط."
            };
        }

        var normalizedDecision = string.IsNullOrWhiteSpace(request.Decision)
            ? "PENDING_INSPECTION"
            : request.Decision.Trim().ToUpperInvariant();
        bool shouldRestockNow = normalizedDecision == "APPROVED_RESTOCKED";

        // Load product with bundle components to determine physical items requiring Redis locks
        var returnedProduct = await _context.Products
            .Include(p => p.BundleComponents)
                .ThenInclude(bc => bc.ComponentProduct)
            .FirstOrDefaultAsync(p => p.Id == invoiceItem.ProductId);

        if (returnedProduct == null)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 404,
                ErrorCode = "ERR_PRODUCT_NOT_FOUND",
                Message = "الصنف المرتجع غير موجود في دليل المواد."
            };
        }

        var physicalRestockPlan = BuildPhysicalRestockPlan(returnedProduct, request.ReturnQuantity);
        var acquiredLocks = await AcquireItemLocksAsync(physicalRestockPlan.Select(p => p.Product.Id));
        if (acquiredLocks == null)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 409,
                ErrorCode = "ERR_LOCK_CONFLICT",
                Message = "تعذر قفل مخزون الصنف مؤقتاً بسبب عملية متزامنة، يرجى إعادة المحاولة."
            };
        }

        try
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            var productSku = returnedProduct.Sku;
            var alreadyReturnedQty = await _context.RmaReturnRequests
                .Where(r => (r.InvoiceId == invoice.Id || r.InvoiceNumber == invoice.InvoiceNumber)
                            && (r.ProductId == invoiceItem.ProductId || (!string.IsNullOrEmpty(productSku) && r.Sku == productSku))
                            && r.Decision != "REJECTED")
                .SumAsync(r => r.ReturnQuantity);

            var remainingReturnable = Math.Max(0, invoiceItem.Quantity - alreadyReturnedQty);
            if (request.ReturnQuantity > remainingReturnable)
            {
                await transaction.RollbackAsync();
                return new SalesReturnOperationResult
                {
                    Success = false,
                    StatusCode = 400,
                    ErrorCode = "ERR_RETURN_QTY_EXCEEDS_SOLD",
                    Message = $"الكمية المراد إرجاعها ({request.ReturnQuantity}) تتجاوز الكمية المباعة المتبقية القابلة للإرجاع ({remainingReturnable} قطعة)."
                };
            }

            // Strict Serial / IMEI Return Validation for Serialized Products
            ProductSerial? matchedSoldSerial = null;
            var requestedSerial = (request.SerialNumber ?? string.Empty).Trim();
            if (returnedProduct.RequiresSerialNumber)
            {
                if (string.IsNullOrWhiteSpace(requestedSerial) || string.Equals(requestedSerial, "N/A", StringComparison.OrdinalIgnoreCase))
                {
                    await transaction.RollbackAsync();
                    return new SalesReturnOperationResult
                    {
                        Success = false,
                        StatusCode = 400,
                        ErrorCode = "ERR_SERIAL_NOT_FOUND_FOR_RETURN",
                        Message = "ERR_SERIAL_NOT_FOUND_FOR_RETURN"
                    };
                }

                var lowerSerial = requestedSerial.ToLowerInvariant();
                matchedSoldSerial = await _context.ProductSerials.FirstOrDefaultAsync(ps =>
                    ps.SerialNumber.ToLower() == lowerSerial &&
                    ps.ProductId == returnedProduct.Id &&
                    ps.SalesInvoiceId == invoice.Id &&
                    ps.Status == "Sold");

                if (matchedSoldSerial == null)
                {
                    await transaction.RollbackAsync();
                    return new SalesReturnOperationResult
                    {
                        Success = false,
                        StatusCode = 400,
                        ErrorCode = "ERR_SERIAL_NOT_FOUND_FOR_RETURN",
                        Message = "ERR_SERIAL_NOT_FOUND_FOR_RETURN"
                    };
                }
            }
            else if (!string.IsNullOrWhiteSpace(requestedSerial) && !string.Equals(requestedSerial, "N/A", StringComparison.OrdinalIgnoreCase))
            {
                var lowerSerial = requestedSerial.ToLowerInvariant();
                var anyExistingSerial = await _context.ProductSerials.FirstOrDefaultAsync(ps => ps.SerialNumber.ToLower() == lowerSerial);
                if (anyExistingSerial != null)
                {
                    if (anyExistingSerial.SalesInvoiceId != invoice.Id || anyExistingSerial.ProductId != returnedProduct.Id || anyExistingSerial.Status != "Sold")
                    {
                        await transaction.RollbackAsync();
                        return new SalesReturnOperationResult
                        {
                            Success = false,
                            StatusCode = 400,
                            ErrorCode = "ERR_SERIAL_NOT_FOUND_FOR_RETURN",
                            Message = "ERR_SERIAL_NOT_FOUND_FOR_RETURN"
                        };
                    }
                    matchedSoldSerial = anyExistingSerial;
                }
            }

            var unitPrice = invoiceItem.UnitPrice;
            var totalRefund = request.ReturnQuantity * unitPrice;
            var warrantyMonths = matchedSoldSerial?.WarrantyMonths ?? returnedProduct.WarrantyMonths;
            var warrantyExpiresAt = matchedSoldSerial?.WarrantyEndDate
                ?? (warrantyMonths > 0 ? invoice.CreatedAt.AddMonths(warrantyMonths) : invoice.CreatedAt);
            var calculatedWarrantyStatus = (warrantyMonths > 0 && DateTime.UtcNow <= warrantyExpiresAt)
                ? "VALID_UNDER_WARRANTY"
                : "EXPIRED";
            var effectiveActor = !string.IsNullOrWhiteSpace(actorName) ? actorName.Trim() : (invoice.CashierName ?? "System");

            var rmaNumber = string.IsNullOrWhiteSpace(request.RmaNumber)
                ? $"RMA-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}"
                : request.RmaNumber.Trim();

            var rmaRecord = new RmaReturnRequest
            {
                RmaNumber = rmaNumber,
                InvoiceId = invoice.Id,
                InvoiceNumber = invoice.InvoiceNumber,
                ProductId = invoiceItem.ProductId,
                Sku = returnedProduct.Sku,
                ProductName = returnedProduct.Name,
                SerialNumber = request.SerialNumber?.Trim() ?? string.Empty,
                CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? (invoice.CashierName ?? "عميل الفاتورة") : request.CustomerName.Trim(),
                CustomerPhone = request.CustomerPhone?.Trim() ?? "—",
                ReturnQuantity = request.ReturnQuantity,
                RefundAmount = totalRefund,
                Currency = string.IsNullOrWhiteSpace(request.Currency) ? "IQD" : request.Currency.Trim().ToUpperInvariant(),
                WarrantyStatus = string.IsNullOrWhiteSpace(request.WarrantyStatus) ? calculatedWarrantyStatus : request.WarrantyStatus.Trim(),
                Decision = normalizedDecision,
                WarehouseId = targetWarehouse.Id,
                ReturnReason = request.ReturnReason?.Trim() ?? string.Empty,
                CreatedAt = DateTime.UtcNow
            };

            _context.RmaReturnRequests.Add(rmaRecord);

            decimal reversedPoints = 0m;
            if (shouldRestockNow)
            {
                await ApplyAtomicRestockAsync(rmaRecord, targetWarehouse, physicalRestockPlan, effectiveActor);
                if (_loyaltyService != null)
                {
                    var returnedUnitCost = CalculateReturnedUnitCost(returnedProduct, invoiceItem);
                    reversedPoints = await _loyaltyService.ReversePointsForReturnInTransactionAsync(
                        invoice, invoiceItem, rmaRecord, returnedUnitCost, effectiveActor);
                }
            }
            else if (matchedSoldSerial != null)
            {
                matchedSoldSerial.Status = normalizedDecision == "SENT_TO_MAINTENANCE" ? "Defective" : "Returned";
                matchedSoldSerial.WarehouseId = targetWarehouse.Id;
                matchedSoldSerial.WarrantyStartDate = null;
                matchedSoldSerial.WarrantyEndDate = null;
                matchedSoldSerial.UpdatedAt = DateTime.UtcNow;
                matchedSoldSerial.Notes = string.IsNullOrWhiteSpace(matchedSoldSerial.Notes)
                    ? $"RMA {rmaRecord.RmaNumber} ({normalizedDecision})"
                    : $"{matchedSoldSerial.Notes} | RMA {rmaRecord.RmaNumber} ({normalizedDecision})";
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            if (shouldRestockNow)
            {
                await InvalidateRedisStockCacheAsync(targetWarehouse.Id, physicalRestockPlan.Select(x => x.Product).Append(returnedProduct));
            }

            return new SalesReturnOperationResult
            {
                Success = true,
                StatusCode = 200,
                Data = MapToDto(rmaRecord, remainingReturnable - request.ReturnQuantity, targetWarehouse.Name, reversedPoints)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process sales return for invoice {InvoiceId}", invoiceId);
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 500,
                ErrorCode = "ERR_CREATE_RMA_FAILED",
                Message = "حدث خطأ أثناء تسجيل طلب الإرجاع وتحديث المخزون."
            };
        }
        finally
        {
            await ReleaseItemLocksAsync(acquiredLocks);
        }
    }

    public async Task<SalesReturnOperationResult> ApproveAndRestockReturnAsync(
        Guid rmaId,
        ApproveSalesReturnRequestDto? request,
        string? actorName)
    {
        var rmaRecord = await _context.RmaReturnRequests
            .Include(r => r.Invoice)
                .ThenInclude(i => i!.Items)
                    .ThenInclude(it => it.Product)
            .FirstOrDefaultAsync(r => r.Id == rmaId);

        if (rmaRecord == null)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 404,
                ErrorCode = "ERR_RMA_NOT_FOUND",
                Message = "طلب الإرجاع المطلوب غير موجود."
            };
        }

        if (rmaRecord.Decision == "APPROVED_RESTOCKED" || rmaRecord.RestockedAt.HasValue)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 400,
                ErrorCode = "ERR_RETURN_ALREADY_RESTOCKED",
                Message = "تم اعتماد هذا المرتجع وإعادته للمخزون مسبقاً."
            };
        }

        var returnedProduct = await _context.Products
            .Include(p => p.BundleComponents)
                .ThenInclude(bc => bc.ComponentProduct)
            .FirstOrDefaultAsync(p => p.Id == rmaRecord.ProductId);

        if (returnedProduct == null)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 404,
                ErrorCode = "ERR_PRODUCT_NOT_FOUND",
                Message = "الصنف المرتجع غير موجود في دليل المواد."
            };
        }

        var preferredWarehouseId = request?.WarehouseId ?? rmaRecord.WarehouseId ?? rmaRecord.Invoice?.WarehouseId;
        var targetWarehouse = await ResolveTargetWarehouseAsync(preferredWarehouseId, rmaRecord.Invoice?.WarehouseId);
        if (targetWarehouse == null)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 400,
                ErrorCode = "ERR_WAREHOUSE_NOT_FOUND",
                Message = "المستودع المستهدف لإرجاع البضاعة غير موجود أو غير نشط."
            };
        }

        var physicalRestockPlan = BuildPhysicalRestockPlan(returnedProduct, rmaRecord.ReturnQuantity);
        var acquiredLocks = await AcquireItemLocksAsync(physicalRestockPlan.Select(p => p.Product.Id));
        if (acquiredLocks == null)
        {
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 409,
                ErrorCode = "ERR_LOCK_CONFLICT",
                Message = "تعذر قفل مخزون الصنف مؤقتاً بسبب عملية متزامنة، يرجى إعادة المحاولة."
            };
        }

        try
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            // Re-validate sold quantity cap against sibling returns
            var invoiceItem = rmaRecord.Invoice?.Items.FirstOrDefault(it => it.ProductId == rmaRecord.ProductId);
            if (invoiceItem != null)
            {
                var otherReturnedQty = await _context.RmaReturnRequests
                    .Where(r => r.Id != rmaRecord.Id
                                && (r.InvoiceId == rmaRecord.InvoiceId || r.InvoiceNumber == rmaRecord.InvoiceNumber)
                                && r.ProductId == rmaRecord.ProductId
                                && r.Decision != "REJECTED")
                    .SumAsync(r => r.ReturnQuantity);

                if (otherReturnedQty + rmaRecord.ReturnQuantity > invoiceItem.Quantity)
                {
                    await transaction.RollbackAsync();
                    return new SalesReturnOperationResult
                    {
                        Success = false,
                        StatusCode = 400,
                        ErrorCode = "ERR_RETURN_QTY_EXCEEDS_SOLD",
                        Message = $"الكمية المرتجعة ({rmaRecord.ReturnQuantity}) تتجاوز المتبقي من الفاتورة الأصلية ({Math.Max(0, invoiceItem.Quantity - otherReturnedQty)})."
                    };
                }
            }

            var effectiveActor = !string.IsNullOrWhiteSpace(actorName) ? actorName.Trim() : "System";
            rmaRecord.Decision = "APPROVED_RESTOCKED";
            rmaRecord.WarehouseId = targetWarehouse.Id;

            await ApplyAtomicRestockAsync(rmaRecord, targetWarehouse, physicalRestockPlan, effectiveActor);

            decimal reversedPoints = 0m;
            if (_loyaltyService != null && rmaRecord.Invoice != null && invoiceItem != null)
            {
                var returnedUnitCost = CalculateReturnedUnitCost(returnedProduct, invoiceItem);
                reversedPoints = await _loyaltyService.ReversePointsForReturnInTransactionAsync(
                    rmaRecord.Invoice, invoiceItem, rmaRecord, returnedUnitCost, effectiveActor);
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            await InvalidateRedisStockCacheAsync(targetWarehouse.Id, physicalRestockPlan.Select(x => x.Product).Append(returnedProduct));

            return new SalesReturnOperationResult
            {
                Success = true,
                StatusCode = 200,
                Data = MapToDto(rmaRecord, 0, targetWarehouse.Name, reversedPoints)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to approve and restock RMA {RmaId}", rmaId);
            return new SalesReturnOperationResult
            {
                Success = false,
                StatusCode = 500,
                ErrorCode = "ERR_APPROVE_RMA_FAILED",
                Message = "حدث خطأ أثناء اعتماد المرتجع وتحديث رصيد المستودع."
            };
        }
        finally
        {
            await ReleaseItemLocksAsync(acquiredLocks);
        }
    }

    private async Task ApplyAtomicRestockAsync(
        RmaReturnRequest rmaRecord,
        Models.Warehouse targetWarehouse,
        List<(Product Product, int Quantity, bool FromBundle)> physicalRestockPlan,
        string actorName)
    {
        var now = DateTime.UtcNow;

        var stockMovement = new StockMovement
        {
            MovementNumber = $"MOV-RMA-{now:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}",
            MovementType = "SalesReturn",
            FromWarehouseId = null,
            ToWarehouseId = targetWarehouse.Id,
            ReferenceNumber = rmaRecord.RmaNumber,
            Notes = $"إرجاع مبيعات للمستودع ({targetWarehouse.Name}) | ReturnId: {rmaRecord.Id} | Invoice: {rmaRecord.InvoiceNumber}",
            CreatedBy = actorName,
            MovementDate = now,
            Items = new List<StockMovementItem>()
        };

        foreach (var (physProduct, qty, fromBundle) in physicalRestockPlan)
        {
            var warehouseStock = await _context.WarehouseStocks
                .FirstOrDefaultAsync(ws => ws.WarehouseId == targetWarehouse.Id && ws.ProductId == physProduct.Id);

            if (warehouseStock == null)
            {
                warehouseStock = new WarehouseStock
                {
                    WarehouseId = targetWarehouse.Id,
                    ProductId = physProduct.Id,
                    Quantity = qty,
                    ReservedQuantity = 0,
                    ShelfLocation = "A-01",
                    LastCountedAt = now
                };
                _context.WarehouseStocks.Add(warehouseStock);
            }
            else
            {
                warehouseStock.Quantity += qty;
                warehouseStock.LastCountedAt = now;
            }

            stockMovement.Items.Add(new StockMovementItem
            {
                ProductId = physProduct.Id,
                Quantity = qty,
                UnitCost = physProduct.CostPrice
            });

            _context.InventoryTransactions.Add(new InventoryTransaction
            {
                ProductId = physProduct.Id,
                WarehouseId = targetWarehouse.Id,
                QuantityChange = qty,
                TransactionType = "SalesReturn",
                Reason = fromBundle
                    ? $"إرجاع مكون حزمة ({rmaRecord.ProductName}) — RMA {rmaRecord.RmaNumber} (ReturnId: {rmaRecord.Id})"
                    : $"إرجاع مبيعات فاتورة {rmaRecord.InvoiceNumber} — RMA {rmaRecord.RmaNumber} (ReturnId: {rmaRecord.Id})",
                ReferenceUserId = actorName,
                Notes = rmaRecord.ReturnReason,
                CreatedAt = now
            });
        }

        _context.StockMovements.Add(stockMovement);

        // Restore Serial / IMEI status back from Sold to InStock when present
        if (!string.IsNullOrWhiteSpace(rmaRecord.SerialNumber))
        {
            var normalizedSerial = rmaRecord.SerialNumber.Trim().ToLowerInvariant();
            var serialRecord = await _context.ProductSerials
                .FirstOrDefaultAsync(ps =>
                    ps.SerialNumber.ToLower() == normalizedSerial &&
                    (ps.ProductId == rmaRecord.ProductId || physicalRestockPlan.Select(x => x.Product.Id).Contains(ps.ProductId)));

            if (serialRecord != null)
            {
                serialRecord.Status = "Returned";
                serialRecord.WarehouseId = targetWarehouse.Id;
                serialRecord.WarrantyStartDate = null;
                serialRecord.WarrantyEndDate = null;
                serialRecord.UpdatedAt = now;
                serialRecord.Notes = string.IsNullOrWhiteSpace(serialRecord.Notes)
                    ? $"RMA {rmaRecord.RmaNumber}"
                    : $"{serialRecord.Notes} | RMA {rmaRecord.RmaNumber}";
            }
        }

        rmaRecord.RestockedAt = now;
        rmaRecord.RestockedBy = actorName;
    }

    private static List<(Product Product, int Quantity, bool FromBundle)> BuildPhysicalRestockPlan(
        Product product,
        int returnQuantity)
    {
        var result = new List<(Product Product, int Quantity, bool FromBundle)>();

        if (product.IsBundle && product.BundleComponents.Count > 0)
        {
            foreach (var comp in product.BundleComponents)
            {
                if (comp.ComponentProduct == null) continue;
                var compQty = (int)Math.Ceiling(comp.Quantity * returnQuantity);
                if (compQty > 0)
                {
                    result.Add((comp.ComponentProduct, compQty, true));
                }
            }
        }

        if (result.Count == 0)
        {
            result.Add((product, returnQuantity, false));
        }

        return result
            .GroupBy(x => x.Product.Id)
            .Select(g => (g.First().Product, g.Sum(x => x.Quantity), g.Any(x => x.FromBundle)))
            .ToList();
    }

    private async Task<SalesInvoice?> FindInvoiceAsync(string invoiceId)
    {
        if (Guid.TryParse(invoiceId, out var idGuid))
        {
            var byGuid = await _context.SalesInvoices
                .Include(i => i.Items)
                    .ThenInclude(it => it.Product)
                .FirstOrDefaultAsync(i => i.Id == idGuid);
            if (byGuid != null) return byGuid;
        }

        return await _context.SalesInvoices
            .Include(i => i.Items)
                .ThenInclude(it => it.Product)
            .FirstOrDefaultAsync(i => i.InvoiceNumber == invoiceId);
    }

    private async Task<Models.Warehouse?> ResolveTargetWarehouseAsync(Guid? requestedWarehouseId, Guid? fallbackWarehouseId)
    {
        if (requestedWarehouseId.HasValue && requestedWarehouseId.Value != Guid.Empty)
        {
            var explicitWh = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == requestedWarehouseId.Value && w.IsActive);
            if (explicitWh != null) return explicitWh;
        }

        if (fallbackWarehouseId.HasValue && fallbackWarehouseId.Value != Guid.Empty)
        {
            var invoiceWh = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == fallbackWarehouseId.Value && w.IsActive);
            if (invoiceWh != null) return invoiceWh;
        }

        return await _context.Warehouses.FirstOrDefaultAsync(w => w.IsActive);
    }

    private async Task<List<(string Key, string Token)>?> AcquireItemLocksAsync(IEnumerable<Guid> productIds)
    {
        var acquired = new List<(string Key, string Token)>();
        if (_redisDb == null) return acquired;

        foreach (var itemId in productIds.Distinct().OrderBy(id => id))
        {
            var lockKey = $"lock:item:{itemId}";
            var token = Guid.NewGuid().ToString("N");
            bool taken = false;

            for (int attempt = 0; attempt < 10; attempt++)
            {
                if (await _redisDb.LockTakeAsync(lockKey, token, TimeSpan.FromSeconds(15)))
                {
                    taken = true;
                    acquired.Add((lockKey, token));
                    break;
                }
                await Task.Delay(50);
            }

            if (!taken)
            {
                await ReleaseItemLocksAsync(acquired);
                return null;
            }
        }

        return acquired;
    }

    private async Task ReleaseItemLocksAsync(IEnumerable<(string Key, string Token)>? locks)
    {
        if (_redisDb == null || locks == null) return;
        foreach (var (key, token) in locks)
        {
            try
            {
                await _redisDb.LockReleaseAsync(key, token);
            }
            catch
            {
                // Ignore lock expiration cleanup failures
            }
        }
    }

    private async Task InvalidateRedisStockCacheAsync(Guid warehouseId, IEnumerable<Product> touchedProducts)
    {
        if (_redisDb == null) return;

        try
        {
            var keysToDelete = new List<RedisKey>
            {
                $"warehouse:stock:{warehouseId}",
                "pos:products",
                "pos:products:all",
                "inventory:products"
            };

            foreach (var prod in touchedProducts.DistinctBy(p => p.Id))
            {
                keysToDelete.Add($"product:id:{prod.Id}");
                keysToDelete.Add($"warehouse:stock:{warehouseId}:{prod.Id}");
                if (!string.IsNullOrWhiteSpace(prod.Barcode))
                {
                    keysToDelete.Add($"product:barcode:{prod.Barcode}");
                }
                if (!string.IsNullOrWhiteSpace(prod.Sku))
                {
                    keysToDelete.Add($"product:sku:{prod.Sku}");
                }
            }

            await _redisDb.KeyDeleteAsync(keysToDelete.ToArray());
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Non-fatal Redis cache invalidation failure after RMA restock");
        }
    }

    private static decimal CalculateReturnedUnitCost(Product returnedProduct, SalesInvoiceItem invoiceItem)
    {
        if (returnedProduct.IsBundle && returnedProduct.BundleComponents.Count > 0)
        {
            return returnedProduct.BundleComponents.Sum(bc => (bc.ComponentProduct?.CostPrice ?? 0m) * bc.Quantity);
        }
        return invoiceItem.UnitCostPrice > 0m ? invoiceItem.UnitCostPrice : returnedProduct.CostPrice;
    }

    private static RmaReturnResponseDto MapToDto(RmaReturnRequest r, int remainingQty, string? warehouseName, decimal reversedPoints = 0m)
    {
        return new RmaReturnResponseDto
        {
            RmaId = r.Id,
            RmaNumber = r.RmaNumber,
            InvoiceNumber = r.InvoiceNumber,
            ProductId = r.ProductId,
            ProductName = r.ProductName,
            Sku = r.Sku,
            SerialNumber = r.SerialNumber,
            CustomerName = r.CustomerName,
            CustomerPhone = r.CustomerPhone,
            ReturnQuantity = r.ReturnQuantity,
            RefundAmount = r.RefundAmount,
            Currency = r.Currency,
            WarrantyStatus = r.WarrantyStatus,
            Decision = r.Decision,
            WarehouseId = r.WarehouseId,
            WarehouseName = warehouseName ?? r.Warehouse?.Name,
            IsRestocked = r.Decision == "APPROVED_RESTOCKED" && r.RestockedAt.HasValue,
            RestockedAt = r.RestockedAt,
            RestockedBy = r.RestockedBy,
            ReturnReason = r.ReturnReason,
            RemainingReturnableQty = Math.Max(0, remainingQty),
            LoyaltyPointsReversed = reversedPoints,
            CreatedAt = r.CreatedAt
        };
    }
}
