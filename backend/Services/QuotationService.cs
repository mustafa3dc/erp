using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface IQuotationService
{
    Task<List<SalesQuotationDto>> GetQuotationsAsync(Guid? customerId, string? status, DateTime? fromDate, DateTime? toDate);
    Task<SalesQuotationDto?> GetQuotationByIdAsync(Guid id);
    Task<ApiResponse<SalesQuotationDto>> CreateQuotationAsync(CreateSalesQuotationRequest request, string? salespersonName);
    Task<ApiResponse<SalesQuotationDto>> UpdateQuotationStatusAsync(Guid id, string status, string? updatedBy);
    Task<ApiResponse<ConvertQuotationResponseDto>> ConvertToInvoiceAsync(Guid id, ConvertQuotationToInvoiceRequest request, string? cashierId, string? cashierName);
}

public class QuotationService : IQuotationService
{
    private readonly AppDbContext _context;
    private readonly ILogger<QuotationService> _logger;

    public QuotationService(AppDbContext context, ILogger<QuotationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<SalesQuotationDto>> GetQuotationsAsync(Guid? customerId, string? status, DateTime? fromDate, DateTime? toDate)
    {
        var query = _context.SalesQuotations
            .Include(q => q.Customer)
            .Include(q => q.Warehouse)
            .Include(q => q.ConvertedInvoice)
            .Include(q => q.Items)
            .AsNoTracking()
            .AsQueryable();

        if (customerId.HasValue)
        {
            query = query.Where(q => q.CustomerId == customerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim();
            query = query.Where(q => q.Status.ToLower() == s.ToLower());
        }

        if (fromDate.HasValue)
        {
            var f = fromDate.Value.ToUniversalTime();
            query = query.Where(q => q.QuotationDate >= f);
        }

        if (toDate.HasValue)
        {
            var t = toDate.Value.ToUniversalTime();
            query = query.Where(q => q.QuotationDate <= t);
        }

        var list = await query
            .OrderByDescending(q => q.QuotationDate)
            .ToListAsync();

        return list.Select(MapToDto).ToList();
    }

    public async Task<SalesQuotationDto?> GetQuotationByIdAsync(Guid id)
    {
        var q = await _context.SalesQuotations
            .Include(x => x.Customer)
            .Include(x => x.Warehouse)
            .Include(x => x.ConvertedInvoice)
            .Include(x => x.Items)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        return q == null ? null : MapToDto(q);
    }

    public async Task<ApiResponse<SalesQuotationDto>> CreateQuotationAsync(CreateSalesQuotationRequest request, string? salespersonName)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            return ApiResponse<SalesQuotationDto>.Fail("ERR_QUOTATION_EMPTY_ITEMS", "SALES");
        }

        var warehouse = await _context.Warehouses
            .FirstOrDefaultAsync(w => w.Id == request.WarehouseId && w.IsActive);
        if (warehouse == null)
        {
            return ApiResponse<SalesQuotationDto>.Fail("ERR_WAREHOUSE_NOT_FOUND", "INVENTORY");
        }

        var quotationNumber = $"QTN-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";
        var expiryDate = request.ExpiryDate?.ToUniversalTime() ?? DateTime.UtcNow.AddDays(15);

        decimal subtotal = 0;
        decimal totalDiscount = 0;
        decimal totalTax = 0;

        var items = new List<SalesQuotationItem>();

        foreach (var itemInput in request.Items)
        {
            var product = await _context.Products.FindAsync(itemInput.ProductId);
            if (product == null || !product.IsActive)
            {
                return ApiResponse<SalesQuotationDto>.Fail("ERR_PRODUCT_NOT_FOUND", "SALES", 
                    new Dictionary<string, object> { ["productId"] = itemInput.ProductId });
            }

            var unitPrice = itemInput.UnitPrice > 0 ? itemInput.UnitPrice : product.SellingPrice;
            var rawLine = unitPrice * itemInput.Quantity;
            var lineDiscount = rawLine * (itemInput.DiscountPercent / 100.0m);
            var afterDiscount = rawLine - lineDiscount;
            var lineTax = afterDiscount * (itemInput.TaxPercent / 100.0m);
            var lineTotal = afterDiscount + lineTax;

            subtotal += rawLine;
            totalDiscount += lineDiscount;
            totalTax += lineTax;

            items.Add(new SalesQuotationItem
            {
                ProductId = product.Id,
                ProductSku = product.Sku,
                ProductName = product.Name,
                UnitOfMeasure = itemInput.UnitOfMeasure ?? product.UnitOfMeasure,
                Quantity = itemInput.Quantity,
                UnitPrice = unitPrice,
                DiscountPercent = itemInput.DiscountPercent,
                DiscountAmount = lineDiscount,
                TaxPercent = itemInput.TaxPercent,
                TaxAmount = lineTax,
                LineTotal = lineTotal,
                Notes = itemInput.Notes
            });
        }

        var totalAmount = (subtotal - totalDiscount) + totalTax;
        var exchangeRate = request.ExchangeRate > 0 ? request.ExchangeRate : 1.0000m;

        var quotation = new SalesQuotation
        {
            QuotationNumber = quotationNumber,
            QuotationDate = DateTime.UtcNow,
            ExpiryDate = expiryDate,
            CustomerId = request.CustomerId,
            CustomerName = request.CustomerName.Trim(),
            CustomerPhone = request.CustomerPhone?.Trim(),
            CustomerAddress = request.CustomerAddress?.Trim(),
            CustomerTaxNo = request.CustomerTaxNo?.Trim(),
            WarehouseId = request.WarehouseId,
            Subtotal = subtotal,
            DiscountAmount = totalDiscount,
            TaxAmount = totalTax,
            TotalAmount = totalAmount,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "IQD" : request.Currency.Trim().ToUpper(),
            ExchangeRate = exchangeRate,
            Status = "Draft",
            SalespersonName = salespersonName ?? "Sales Agent",
            TermsAndConditions = request.TermsAndConditions?.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = items
        };

        _context.SalesQuotations.Add(quotation);
        await _context.SaveChangesAsync();

        var created = await GetQuotationByIdAsync(quotation.Id);
        return ApiResponse<SalesQuotationDto>.Ok(created!);
    }

    public async Task<ApiResponse<SalesQuotationDto>> UpdateQuotationStatusAsync(Guid id, string status, string? updatedBy)
    {
        var quotation = await _context.SalesQuotations.FindAsync(id);
        if (quotation == null)
        {
            return ApiResponse<SalesQuotationDto>.Fail("ERR_QUOTATION_NOT_FOUND", "SALES");
        }

        if (quotation.Status == "Converted")
        {
            return ApiResponse<SalesQuotationDto>.Fail("ERR_QUOTATION_ALREADY_CONVERTED", "SALES");
        }

        var validStatuses = new[] { "Draft", "Sent", "Accepted", "Expired", "Cancelled" };
        var normalized = validStatuses.FirstOrDefault(s => s.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase));
        if (normalized == null)
        {
            return ApiResponse<SalesQuotationDto>.Fail("ERR_INVALID_QUOTATION_STATUS", "SALES");
        }

        quotation.Status = normalized;
        quotation.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var updated = await GetQuotationByIdAsync(id);
        return ApiResponse<SalesQuotationDto>.Ok(updated!);
    }

    public async Task<ApiResponse<ConvertQuotationResponseDto>> ConvertToInvoiceAsync(
        Guid id, 
        ConvertQuotationToInvoiceRequest request, 
        string? cashierId, 
        string? cashierName)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var quotation = await _context.SalesQuotations
                .Include(q => q.Items)
                .ThenInclude(i => i.Product)
                .FirstOrDefaultAsync(q => q.Id == id);

            if (quotation == null)
            {
                return ApiResponse<ConvertQuotationResponseDto>.Fail("ERR_QUOTATION_NOT_FOUND", "SALES");
            }

            if (quotation.Status == "Converted")
            {
                return ApiResponse<ConvertQuotationResponseDto>.Fail("ERR_QUOTATION_ALREADY_CONVERTED", "SALES");
            }

            if (quotation.ExpiryDate < DateTime.UtcNow)
            {
                return ApiResponse<ConvertQuotationResponseDto>.Fail("ERR_QUOTATION_EXPIRED", "SALES");
            }

            var targetWarehouseId = request.TargetWarehouseId != Guid.Empty ? request.TargetWarehouseId : quotation.WarehouseId;
            var targetWarehouse = await _context.Warehouses
                .FirstOrDefaultAsync(w => w.Id == targetWarehouseId && w.IsActive);
            if (targetWarehouse == null)
            {
                return ApiResponse<ConvertQuotationResponseDto>.Fail("ERR_WAREHOUSE_NOT_FOUND", "INVENTORY");
            }

            // 1. Stock ATP Verification
            foreach (var item in quotation.Items)
            {
                var stock = await _context.WarehouseStocks
                    .FirstOrDefaultAsync(ws => ws.WarehouseId == targetWarehouseId && ws.ProductId == item.ProductId);

                var availableStock = stock?.AvailableToPromise ?? 0;
                var requestedQty = (int)Math.Ceiling(item.Quantity);

                if (availableStock < requestedQty)
                {
                    await transaction.RollbackAsync();
                    return ApiResponse<ConvertQuotationResponseDto>.Fail("ERR_INSUFFICIENT_STOCK", "INVENTORY",
                        new Dictionary<string, object>
                        {
                            ["sku"] = item.ProductSku,
                            ["productName"] = item.ProductName,
                            ["requestedQty"] = requestedQty,
                            ["availableQty"] = availableStock
                        });
                }
            }

            // 2. Create Sales Invoice
            var invoiceNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";
            var dispenseMode = string.IsNullOrWhiteSpace(request.DispenseMode) ? "IN_STORE" : request.DispenseMode.ToUpper();
            var isWarehouseDispatch = dispenseMode == "WAREHOUSE_DISPATCH";

            var invoice = new SalesInvoice
            {
                InvoiceNumber = invoiceNumber,
                WarehouseId = targetWarehouseId,
                DispenseMode = dispenseMode,
                FulfillmentStatus = isWarehouseDispatch ? "PENDING_DISPATCH" : "FULFILLED",
                CashierId = cashierId ?? "System",
                CashierName = cashierName ?? quotation.SalespersonName ?? "Cashier",
                Subtotal = quotation.Subtotal,
                TaxAmount = quotation.TaxAmount,
                DiscountAmount = quotation.DiscountAmount,
                TotalAmount = quotation.TotalAmount,
                PaymentStatus = "PAID",
                PaymentMethod = request.PaymentMethod?.ToUpper() ?? "CASH",
                CreatedAt = DateTime.UtcNow
            };

            _context.SalesInvoices.Add(invoice);
            await _context.SaveChangesAsync(); // Commit invoice ID

            // 3. Process Stock & Line Items
            var invoiceItems = new List<SalesInvoiceItem>();
            foreach (var qItem in quotation.Items)
            {
                var line = new SalesInvoiceItem
                {
                    InvoiceId = invoice.Id,
                    SourceWarehouseId = targetWarehouseId,
                    ProductId = qItem.ProductId,
                    Quantity = (int)Math.Ceiling(qItem.Quantity),
                    OriginalPrice = qItem.UnitPrice,
                    DiscountType = qItem.DiscountPercent > 0 ? "PERCENT" : "NONE",
                    DiscountValue = qItem.DiscountPercent,
                    DiscountAmount = qItem.DiscountAmount,
                    UnitPrice = qItem.UnitPrice,
                    TotalPrice = qItem.LineTotal
                };
                invoiceItems.Add(line);

                var stock = await _context.WarehouseStocks
                    .FirstAsync(ws => ws.WarehouseId == targetWarehouseId && ws.ProductId == qItem.ProductId);

                if (isWarehouseDispatch)
                {
                    stock.ReservedQuantity += line.Quantity;
                }
                else
                {
                    stock.Quantity -= line.Quantity;
                    stock.LastCountedAt = DateTime.UtcNow;

                    _context.InventoryTransactions.Add(new InventoryTransaction
                    {
                        ProductId = qItem.ProductId,
                        WarehouseId = targetWarehouseId,
                        QuantityChange = -line.Quantity,
                        TransactionType = "SALE",
                        Reason = $"تحويل عرض سعر {quotation.QuotationNumber} إلى فاتورة {invoiceNumber}",
                        ReferenceUserId = cashierId ?? "System",
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            _context.SalesInvoiceItems.AddRange(invoiceItems);

            // 4. If Warehouse Dispatch, Stage in Warehouse Queue
            if (isWarehouseDispatch)
            {
                var dispatchOrder = new WarehouseDispatchOrder
                {
                    InvoiceId = invoice.Id,
                    InvoiceNumber = invoice.InvoiceNumber,
                    WarehouseId = targetWarehouseId,
                    CustomerName = quotation.CustomerName,
                    CashierName = invoice.CashierName,
                    ItemsSnapshot = System.Text.Json.JsonSerializer.Serialize(quotation.Items.Select(i => new
                    {
                        i.ProductId,
                        i.ProductSku,
                        i.ProductName,
                        Quantity = (int)Math.Ceiling(i.Quantity),
                        i.UnitPrice,
                        i.LineTotal
                    })),
                    TotalQuantity = (int)quotation.Items.Sum(i => i.Quantity),
                    Status = "PENDING",
                    Notes = $"من عرض السعر {quotation.QuotationNumber}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.WarehouseDispatchOrders.Add(dispatchOrder);
            }

            // 5. Update Quotation Status
            quotation.Status = "Converted";
            quotation.ConvertedInvoiceId = invoice.Id;
            quotation.ConvertedAt = DateTime.UtcNow;
            quotation.UpdatedAt = DateTime.UtcNow;

            // Audit Trail
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = cashierId ?? "System",
                Username = cashierName ?? "System",
                Action = "CONVERT",
                EntityName = "sales_quotations",
                EntityId = quotation.Id.ToString(),
                NewValues = System.Text.Json.JsonSerializer.Serialize(new
                {
                    ConvertedInvoiceId = invoice.Id,
                    InvoiceNumber = invoice.InvoiceNumber,
                    TotalAmount = invoice.TotalAmount
                }),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var response = new ConvertQuotationResponseDto(
                InvoiceId: invoice.Id,
                InvoiceNumber: invoice.InvoiceNumber,
                TotalAmount: invoice.TotalAmount,
                FulfillmentStatus: invoice.FulfillmentStatus,
                ConvertedAt: quotation.ConvertedAt.Value
            );

            return ApiResponse<ConvertQuotationResponseDto>.Ok(response);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to convert quotation {QuotationId} to sales invoice", id);
            return ApiResponse<ConvertQuotationResponseDto>.Fail("ERR_CONVERT_QUOTATION_FAILED", "SALES");
        }
    }

    private static SalesQuotationDto MapToDto(SalesQuotation q)
    {
        return new SalesQuotationDto(
            q.Id,
            q.QuotationNumber,
            q.QuotationDate,
            q.ExpiryDate,
            q.CustomerId,
            q.CustomerName,
            q.CustomerPhone,
            q.CustomerAddress,
            q.CustomerTaxNo,
            q.WarehouseId,
            q.Warehouse?.Name ?? "",
            q.Subtotal,
            q.DiscountAmount,
            q.TaxAmount,
            q.TotalAmount,
            q.Currency,
            q.ExchangeRate,
            q.Status,
            q.ConvertedInvoiceId,
            q.ConvertedInvoice?.InvoiceNumber,
            q.ConvertedAt,
            q.SalespersonName,
            q.TermsAndConditions,
            q.Notes,
            q.CreatedAt,
            q.Items.Select(i => new SalesQuotationItemDto(
                i.Id,
                i.ProductId,
                i.ProductSku,
                i.ProductName,
                i.UnitOfMeasure,
                i.Quantity,
                i.UnitPrice,
                i.DiscountPercent,
                i.DiscountAmount,
                i.TaxPercent,
                i.TaxAmount,
                i.LineTotal,
                i.Notes
            )).ToList()
        );
    }
}
