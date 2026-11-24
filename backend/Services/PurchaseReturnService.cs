using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface IPurchaseReturnService
{
    Task<List<PurchaseReturnDto>> GetReturnsAsync(Guid? supplierId, string? status, DateTime? fromDate, DateTime? toDate);
    Task<PurchaseReturnDto?> GetReturnByIdAsync(Guid id);
    Task<List<ReturnableBillItemDto>> GetReturnableItemsAsync(Guid purchaseBillId);
    Task<ApiResponse<PurchaseReturnDto>> CreateReturnAsync(CreatePurchaseReturnRequest request, string? createdBy);
    Task<ApiResponse<PurchaseReturnDto>> ApproveReturnAsync(Guid id, ApprovePurchaseReturnRequest request, string? approvedBy);
}

public class PurchaseReturnService : IPurchaseReturnService
{
    private readonly AppDbContext _context;
    private readonly ILogger<PurchaseReturnService> _logger;

    public PurchaseReturnService(AppDbContext context, ILogger<PurchaseReturnService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<PurchaseReturnDto>> GetReturnsAsync(Guid? supplierId, string? status, DateTime? fromDate, DateTime? toDate)
    {
        var query = _context.PurchaseReturns
            .Include(r => r.Supplier)
            .Include(r => r.Warehouse)
            .Include(r => r.CashBox)
            .Include(r => r.Items)
            .AsNoTracking()
            .AsQueryable();

        if (supplierId.HasValue)
        {
            query = query.Where(r => r.SupplierId == supplierId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToUpper();
            query = query.Where(r => r.Status == s);
        }

        if (fromDate.HasValue)
        {
            var f = fromDate.Value.ToUniversalTime();
            query = query.Where(r => r.ReturnDate >= f);
        }

        if (toDate.HasValue)
        {
            var t = toDate.Value.ToUniversalTime();
            query = query.Where(r => r.ReturnDate <= t);
        }

        var list = await query
            .OrderByDescending(r => r.ReturnDate)
            .ToListAsync();

        return list.Select(MapToDto).ToList();
    }

    public async Task<PurchaseReturnDto?> GetReturnByIdAsync(Guid id)
    {
        var r = await _context.PurchaseReturns
            .Include(x => x.Supplier)
            .Include(x => x.Warehouse)
            .Include(x => x.CashBox)
            .Include(x => x.Items)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        return r == null ? null : MapToDto(r);
    }

    public async Task<List<ReturnableBillItemDto>> GetReturnableItemsAsync(Guid purchaseBillId)
    {
        var bill = await _context.PurchaseBills
            .Include(b => b.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == purchaseBillId);

        if (bill == null) return new List<ReturnableBillItemDto>();

        // Query historical returned items for this bill
        var returnedAggregates = await _context.PurchaseReturnItems
            .Where(pri => pri.Return != null && pri.Return.OriginalBillId == purchaseBillId && pri.Return.Status != "CANCELLED")
            .GroupBy(pri => pri.PurchaseBillItemId)
            .Select(g => new { BillItemId = g.Key, TotalReturned = g.Sum(x => x.ReturnQuantity) })
            .ToDictionaryAsync(x => x.BillItemId, x => x.TotalReturned);

        return bill.Items.Select(item =>
        {
            returnedAggregates.TryGetValue(item.Id, out var previouslyReturned);
            var purchasedQty = (decimal)item.Quantity;
            var availableToReturn = Math.Max(0, purchasedQty - previouslyReturned);

            return new ReturnableBillItemDto(
                PurchaseBillItemId: item.Id,
                ProductId: item.ProductId,
                ProductSku: item.ItemSku,
                ProductBarcode: item.ItemBarcode,
                ProductName: item.ItemName,
                UnitOfMeasure: item.UnitOfMeasure,
                PurchasedQuantity: purchasedQty,
                PreviouslyReturnedQuantity: previouslyReturned,
                AvailableToReturnQuantity: availableToReturn,
                UnitCost: item.UnitCost,
                RequiresSerialNumber: item.Product?.RequiresSerialNumber ?? false
            );
        }).ToList();
    }

    public async Task<ApiResponse<PurchaseReturnDto>> CreateReturnAsync(CreatePurchaseReturnRequest request, string? createdBy)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            return ApiResponse<PurchaseReturnDto>.Fail("ERR_RETURN_EMPTY_ITEMS", "PURCHASES");
        }

        var bill = await _context.PurchaseBills
            .Include(b => b.Items)
            .Include(b => b.Supplier)
            .FirstOrDefaultAsync(b => b.Id == request.OriginalBillId);

        if (bill == null)
        {
            return ApiResponse<PurchaseReturnDto>.Fail("ERR_PURCHASE_BILL_NOT_FOUND", "PURCHASES");
        }

        var warehouse = await _context.Warehouses
            .FirstOrDefaultAsync(w => w.Id == request.WarehouseId && w.IsActive);
        if (warehouse == null)
        {
            return ApiResponse<PurchaseReturnDto>.Fail("ERR_WAREHOUSE_NOT_FOUND", "INVENTORY");
        }

        var returnableItems = (await GetReturnableItemsAsync(bill.Id)).ToDictionary(i => i.PurchaseBillItemId);

        decimal subtotal = 0;
        var returnItems = new List<PurchaseReturnItem>();

        foreach (var reqItem in request.Items)
        {
            if (!returnableItems.TryGetValue(reqItem.PurchaseBillItemId, out var eligibleItem))
            {
                return ApiResponse<PurchaseReturnDto>.Fail("ERR_BILL_ITEM_NOT_FOUND", "PURCHASES",
                    new Dictionary<string, object> { ["purchaseBillItemId"] = reqItem.PurchaseBillItemId });
            }

            if (reqItem.ReturnQuantity <= 0)
            {
                return ApiResponse<PurchaseReturnDto>.Fail("ERR_INVALID_RETURN_QTY", "PURCHASES");
            }

            if (reqItem.ReturnQuantity > eligibleItem.AvailableToReturnQuantity)
            {
                return ApiResponse<PurchaseReturnDto>.Fail("ERR_RETURN_QTY_EXCEEDS_PURCHASED", "PURCHASES",
                    new Dictionary<string, object>
                    {
                        ["sku"] = eligibleItem.ProductSku,
                        ["productName"] = eligibleItem.ProductName,
                        ["requestedReturnQty"] = reqItem.ReturnQuantity,
                        ["availableToReturn"] = eligibleItem.AvailableToReturnQuantity
                    });
            }

            var lineTotal = reqItem.ReturnQuantity * eligibleItem.UnitCost;
            subtotal += lineTotal;

            returnItems.Add(new PurchaseReturnItem
            {
                PurchaseBillItemId = eligibleItem.PurchaseBillItemId,
                ProductId = eligibleItem.ProductId,
                ProductSku = eligibleItem.ProductSku,
                ProductName = eligibleItem.ProductName,
                UnitOfMeasure = eligibleItem.UnitOfMeasure,
                PurchasedQuantity = eligibleItem.PurchasedQuantity,
                PreviouslyReturnedQuantity = eligibleItem.PreviouslyReturnedQuantity,
                ReturnQuantity = reqItem.ReturnQuantity,
                UnitCost = eligibleItem.UnitCost,
                LineTotal = lineTotal,
                Reason = reqItem.Reason?.Trim(),
                SerialNumber = reqItem.SerialNumber?.Trim()
            });
        }

        var returnNumber = $"PRTN-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";
        var exchangeRate = request.ExchangeRate > 0 ? request.ExchangeRate : 1.0000m;

        var purchaseReturn = new PurchaseReturn
        {
            ReturnNumber = returnNumber,
            OriginalBillId = bill.Id,
            OriginalBillNumber = bill.BillNumber,
            SupplierId = bill.SupplierId,
            WarehouseId = request.WarehouseId,
            ReturnDate = request.ReturnDate?.ToUniversalTime() ?? DateTime.UtcNow,
            Status = "DRAFT",
            Subtotal = subtotal,
            TaxAmount = 0.0000m,
            TotalAmount = subtotal,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "IQD" : request.Currency.Trim().ToUpper(),
            ExchangeRate = exchangeRate,
            RefundMethod = request.RefundMethod?.ToUpper() ?? "SUPPLIER_CREDIT",
            CashBoxId = request.CashBoxId,
            ReturnReason = request.ReturnReason?.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedBy = createdBy ?? "System",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = returnItems
        };

        _context.PurchaseReturns.Add(purchaseReturn);
        await _context.SaveChangesAsync();

        var created = await GetReturnByIdAsync(purchaseReturn.Id);
        return ApiResponse<PurchaseReturnDto>.Ok(created!);
    }

    public async Task<ApiResponse<PurchaseReturnDto>> ApproveReturnAsync(Guid id, ApprovePurchaseReturnRequest request, string? approvedBy)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var pReturn = await _context.PurchaseReturns
                .Include(r => r.Items)
                .Include(r => r.Supplier)
                .Include(r => r.Warehouse)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (pReturn == null)
            {
                return ApiResponse<PurchaseReturnDto>.Fail("ERR_PURCHASE_RETURN_NOT_FOUND", "PURCHASES");
            }

            if (pReturn.Status == "APPROVED" || pReturn.Status == "COMPLETED")
            {
                return ApiResponse<PurchaseReturnDto>.Fail("ERR_RETURN_ALREADY_APPROVED", "PURCHASES");
            }

            if (pReturn.Status != "DRAFT")
            {
                return ApiResponse<PurchaseReturnDto>.Fail("ERR_RETURN_NOT_IN_DRAFT", "PURCHASES");
            }

            // 1. Warehouse Stock Verification & Deduction
            foreach (var item in pReturn.Items)
            {
                var stock = await _context.WarehouseStocks
                    .FirstOrDefaultAsync(ws => ws.WarehouseId == pReturn.WarehouseId && ws.ProductId == item.ProductId);

                var requiredQty = (int)Math.Ceiling(item.ReturnQuantity);
                if (stock == null || stock.AvailableToPromise < requiredQty)
                {
                    await transaction.RollbackAsync();
                    return ApiResponse<PurchaseReturnDto>.Fail("ERR_INSUFFICIENT_STOCK_FOR_RETURN", "INVENTORY",
                        new Dictionary<string, object>
                        {
                            ["sku"] = item.ProductSku,
                            ["productName"] = item.ProductName,
                            ["requestedReturnQty"] = requiredQty,
                            ["availableStock"] = stock?.AvailableToPromise ?? 0
                        });
                }

                stock.Quantity -= requiredQty;
                stock.LastCountedAt = DateTime.UtcNow;

                _context.InventoryTransactions.Add(new InventoryTransaction
                {
                    ProductId = item.ProductId,
                    WarehouseId = pReturn.WarehouseId,
                    QuantityChange = -requiredQty,
                    TransactionType = "PURCHASE_RETURN",
                    Reason = $"إرجاع بضاعة للمورد بموجب سند {pReturn.ReturnNumber}",
                    ReferenceUserId = approvedBy ?? "System",
                    CreatedAt = DateTime.UtcNow
                });

                // Update serialized units if present
                if (!string.IsNullOrWhiteSpace(item.SerialNumber))
                {
                    var serial = await _context.ProductSerials
                        .FirstOrDefaultAsync(ps => ps.ProductId == item.ProductId && ps.SerialNumber == item.SerialNumber.Trim());
                    if (serial != null)
                    {
                        serial.Status = "Returned";
                        serial.Notes = $"{serial.Notes} | تم إرجاعه للمورد بسند {pReturn.ReturnNumber}".Trim(' ', '|');
                        serial.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }

            // 2. Adjust Supplier Ledger & Current Balance
            var supplier = await _context.Suppliers.FindAsync(pReturn.SupplierId);
            if (supplier != null)
            {
                var previousBalance = supplier.CurrentBalance;
                supplier.CurrentBalance -= pReturn.TotalAmount; // Reduce payable or add credit
                supplier.UpdatedAt = DateTime.UtcNow;

                _context.SupplierLedgers.Add(new SupplierLedger
                {
                    SupplierId = supplier.Id,
                    TransactionType = "PURCHASE_RETURN",
                    ReferenceId = pReturn.Id,
                    ReferenceNumber = pReturn.ReturnNumber,
                    Debit = pReturn.TotalAmount, // المدين يقلل من رصيد المورد الدائن
                    Credit = 0.00m,
                    RunningBalance = supplier.CurrentBalance,
                    Notes = $"مردودات مشتريات عن الفاتورة {pReturn.OriginalBillNumber}",
                    CreatedAt = DateTime.UtcNow
                });
            }

            // 3. Cash Drawer Deposit if CASH_REFUND
            if (pReturn.RefundMethod == "CASH_REFUND")
            {
                CashBox? cashBox = null;
                if (pReturn.CashBoxId.HasValue)
                {
                    cashBox = await _context.CashBoxes.FindAsync(pReturn.CashBoxId.Value);
                }
                else
                {
                    cashBox = await _context.CashBoxes.FirstOrDefaultAsync(cb => cb.IsActive);
                }

                if (cashBox != null)
                {
                    cashBox.CurrentBalance += pReturn.TotalAmount;
                    cashBox.UpdatedAt = DateTime.UtcNow;
                    pReturn.CashBoxId = cashBox.Id;
                }
            }

            // 4. Update Return Status
            pReturn.Status = "COMPLETED";
            pReturn.ApprovedBy = approvedBy ?? "Manager";
            pReturn.ApprovedAt = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(request.Notes))
            {
                pReturn.Notes = $"{pReturn.Notes} | {request.Notes}".Trim(' ', '|');
            }
            pReturn.UpdatedAt = DateTime.UtcNow;

            // 5. Audit Trail
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = approvedBy ?? "Manager",
                Username = approvedBy ?? "Manager",
                Action = "APPROVE",
                EntityName = "purchase_returns",
                EntityId = pReturn.Id.ToString(),
                NewValues = System.Text.Json.JsonSerializer.Serialize(new
                {
                    Status = "COMPLETED",
                    TotalAmount = pReturn.TotalAmount,
                    Supplier = supplier?.CompanyName,
                    Warehouse = pReturn.Warehouse?.Name
                }),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var completed = await GetReturnByIdAsync(id);
            return ApiResponse<PurchaseReturnDto>.Ok(completed!);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to approve purchase return {ReturnId}", id);
            return ApiResponse<PurchaseReturnDto>.Fail("ERR_APPROVE_RETURN_FAILED", "PURCHASES");
        }
    }

    private static PurchaseReturnDto MapToDto(PurchaseReturn r)
    {
        return new PurchaseReturnDto(
            r.Id,
            r.ReturnNumber,
            r.OriginalBillId,
            r.OriginalBillNumber,
            r.SupplierId,
            r.Supplier?.CompanyName ?? "",
            r.WarehouseId,
            r.Warehouse?.Name ?? "",
            r.ReturnDate,
            r.Status,
            r.Subtotal,
            r.TaxAmount,
            r.TotalAmount,
            r.Currency,
            r.ExchangeRate,
            r.RefundMethod,
            r.CashBoxId,
            r.CashBox?.Name,
            r.ReturnReason,
            r.ApprovedBy,
            r.ApprovedAt,
            r.Notes,
            r.CreatedBy,
            r.CreatedAt,
            r.Items.Select(i => new PurchaseReturnItemDto(
                i.Id,
                i.PurchaseBillItemId,
                i.ProductId,
                i.ProductSku,
                i.ProductName,
                i.UnitOfMeasure,
                i.PurchasedQuantity,
                i.PreviouslyReturnedQuantity,
                i.ReturnQuantity,
                i.UnitCost,
                i.LineTotal,
                i.Reason,
                i.SerialNumber
            )).ToList()
        );
    }
}
