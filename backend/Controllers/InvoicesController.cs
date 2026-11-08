using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/invoices")]
[Route("api/v1/invoices")]
public class InvoicesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<InvoicesController> _logger;

    public InvoicesController(AppDbContext context, ILogger<InvoicesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/invoices
    /// Returns sales invoices for search and linking.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<InvoiceSummaryDto>>> GetInvoices(
        [FromQuery] string? search,
        [FromQuery] int limit = 50)
    {
        try
        {
            var query = _context.SalesInvoices
                .Include(i => i.Items)
                .AsNoTracking()
                .OrderByDescending(i => i.CreatedAt)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(i => 
                    i.InvoiceNumber.ToLower().Contains(s) ||
                    (i.CashierName != null && i.CashierName.ToLower().Contains(s)));
            }

            var invoices = await query.Take(limit).ToListAsync();

            var result = invoices.Select(i => new InvoiceSummaryDto
            {
                Id = i.Id,
                InvoiceNumber = i.InvoiceNumber,
                CashierName = i.CashierName ?? "الكاشير",
                TotalAmount = i.TotalAmount,
                DispenseMode = i.DispenseMode,
                FulfillmentStatus = i.FulfillmentStatus,
                CreatedAt = i.CreatedAt,
                ItemsCount = i.Items.Count
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch invoices");
            return StatusCode(500, new { errorCode = "ERR_FETCH_INVOICES", message = "حدث خطأ أثناء تحميل الفواتير" });
        }
    }

    /// <summary>
    /// GET /api/invoices/{invoiceId}/returnable-items
    /// Returns strictly the items sold in this specific invoice with return eligibility and warranty analysis.
    /// </summary>
    [HttpGet("{invoiceId}/returnable-items")]
    public async Task<ActionResult<IEnumerable<ReturnableInvoiceItemDto>>> GetReturnableItems([FromRoute] string invoiceId)
    {
        try
        {
            // Support lookup by Guid or Invoice Number (e.g. INV-12345)
            SalesInvoice? invoice = null;
            if (Guid.TryParse(invoiceId, out var idGuid))
            {
                invoice = await _context.SalesInvoices
                    .Include(i => i.Items)
                    .ThenInclude(it => it.Product)
                    .FirstOrDefaultAsync(i => i.Id == idGuid);
            }
            
            if (invoice == null)
            {
                invoice = await _context.SalesInvoices
                    .Include(i => i.Items)
                    .ThenInclude(it => it.Product)
                    .FirstOrDefaultAsync(i => i.InvoiceNumber == invoiceId);
            }

            if (invoice == null)
            {
                return NotFound(new 
                { 
                    errorCode = "ERR_INVOICE_NOT_FOUND", 
                    message = $"الفاتورة ({invoiceId}) غير موجودة في سجلات النظام." 
                });
            }

            // Fetch already processed returns for this invoice
            var existingReturns = await _context.RmaReturnRequests
                .Where(r => (r.InvoiceId == invoice.Id || r.InvoiceNumber == invoice.InvoiceNumber) && r.Decision != "REJECTED")
                .AsNoTracking()
                .ToListAsync();

            var now = DateTime.UtcNow;
            var warrantyMonths = 12; // Standard statutory warranty duration
            var warrantyExpiresAt = invoice.CreatedAt.AddMonths(warrantyMonths);
            var isUnderWarranty = now <= warrantyExpiresAt;

            var returnableItems = new List<ReturnableInvoiceItemDto>();

            foreach (var item in invoice.Items)
            {
                var returnedQty = existingReturns
                    .Where(r => r.ProductId == item.ProductId || (r.Sku == item.Product?.Sku))
                    .Sum(r => r.ReturnQuantity);

                var remainingQty = Math.Max(0, item.Quantity - returnedQty);

                returnableItems.Add(new ReturnableInvoiceItemDto
                {
                    ItemId = item.Id,
                    ProductId = item.ProductId,
                    ProductName = item.Product?.Name ?? "صنف مبيعات",
                    Sku = item.Product?.Sku ?? "SKU-GEN",
                    SerialNumber = item.Product?.Barcode ?? string.Empty,
                    SoldQty = item.Quantity,
                    AlreadyReturnedQty = returnedQty,
                    RemainingReturnableQty = remainingQty,
                    UnitPrice = item.UnitPrice,
                    Currency = "IQD",
                    WarrantyExpiresAt = warrantyExpiresAt,
                    IsUnderWarranty = isUnderWarranty
                });
            }

            return Ok(returnableItems);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to calculate returnable items for invoice {InvoiceId}", invoiceId);
            return StatusCode(500, new 
            { 
                errorCode = "ERR_CALCULATE_RETURNABLE_ITEMS", 
                message = "حدث خطأ أثناء احتساب المواد القابلة للإرجاع للفاتورة" 
            });
        }
    }

    /// <summary>
    /// POST /api/invoices/{invoiceId}/returns
    /// Validates and records an RMA return request strictly bound to the invoice line items.
    /// </summary>
    [HttpPost("{invoiceId}/returns")]
    public async Task<ActionResult<RmaReturnResponseDto>> CreateInvoiceReturn(
        [FromRoute] string invoiceId,
        [FromBody] CreateInvoiceReturnRequestDto request)
    {
        try
        {
            SalesInvoice? invoice = null;
            if (Guid.TryParse(invoiceId, out var idGuid))
            {
                invoice = await _context.SalesInvoices
                    .Include(i => i.Items)
                    .ThenInclude(it => it.Product)
                    .FirstOrDefaultAsync(i => i.Id == idGuid);
            }

            if (invoice == null)
            {
                invoice = await _context.SalesInvoices
                    .Include(i => i.Items)
                    .ThenInclude(it => it.Product)
                    .FirstOrDefaultAsync(i => i.InvoiceNumber == invoiceId);
            }

            if (invoice == null)
            {
                return NotFound(new 
                { 
                    errorCode = "ERR_INVOICE_NOT_FOUND", 
                    message = $"الفاتورة ({invoiceId}) غير موجودة." 
                });
            }

            // 1. Mandatory Validation Rule: Product must exist in invoice line items
            var invoiceItem = invoice.Items.FirstOrDefault(it => 
                it.ProductId == request.ProductId || 
                (!string.IsNullOrEmpty(request.Sku) && it.Product?.Sku == request.Sku));

            if (invoiceItem == null)
            {
                return BadRequest(new 
                { 
                    errorCode = "ERR_PRODUCT_NOT_IN_INVOICE", 
                    message = "مرفوض رقابياً: الصنف المحدد غير موجود ضمن بنود هذه الفاتورة الأصلية." 
                });
            }

            // 2. Mandatory Validation Rule: Quantity cannot exceed remaining returnable quantity
            var alreadyReturnedQty = await _context.RmaReturnRequests
                .Where(r => (r.InvoiceId == invoice.Id || r.InvoiceNumber == invoice.InvoiceNumber) 
                            && (r.ProductId == invoiceItem.ProductId || r.Sku == invoiceItem.Product?.Sku)
                            && r.Decision != "REJECTED")
                .SumAsync(r => r.ReturnQuantity);

            var remainingReturnable = Math.Max(0, invoiceItem.Quantity - alreadyReturnedQty);

            if (request.ReturnQuantity <= 0)
            {
                return BadRequest(new 
                { 
                    errorCode = "ERR_INVALID_RETURN_QUANTITY", 
                    message = "يجب تحديد كمية إرجاع صحيحة (أكبر من صفر)." 
                });
            }

            if (request.ReturnQuantity > remainingReturnable)
            {
                return BadRequest(new 
                { 
                    errorCode = "ERR_RETURN_QTY_EXCEEDED", 
                    message = $"الكمية المراد إرجاعها ({request.ReturnQuantity}) تتجاوز الكمية المتبقية القابلة للإرجاع ({remainingReturnable} قطعة)." 
                });
            }

            // 3. Compute Refund & Warranty Analysis
            var unitPrice = invoiceItem.UnitPrice;
            var totalRefund = request.ReturnQuantity * unitPrice;
            var warrantyExpiresAt = invoice.CreatedAt.AddMonths(12);
            var isUnderWarranty = DateTime.UtcNow <= warrantyExpiresAt;
            var calculatedWarrantyStatus = isUnderWarranty ? "VALID_UNDER_WARRANTY" : "EXPIRED";

            var rmaNumber = string.IsNullOrWhiteSpace(request.RmaNumber) 
                ? $"RMA-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}" 
                : request.RmaNumber.Trim();

            var rmaRecord = new RmaReturnRequest
            {
                RmaNumber = rmaNumber,
                InvoiceId = invoice.Id,
                InvoiceNumber = invoice.InvoiceNumber,
                ProductId = invoiceItem.ProductId,
                Sku = invoiceItem.Product?.Sku ?? request.Sku,
                ProductName = invoiceItem.Product?.Name ?? "صنف مرتجع",
                SerialNumber = request.SerialNumber?.Trim() ?? string.Empty,
                CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? (invoice.CashierName ?? "عميل الفاتورة") : request.CustomerName.Trim(),
                CustomerPhone = request.CustomerPhone?.Trim() ?? "—",
                ReturnQuantity = request.ReturnQuantity,
                RefundAmount = totalRefund,
                Currency = request.Currency ?? "IQD",
                WarrantyStatus = string.IsNullOrWhiteSpace(request.WarrantyStatus) ? calculatedWarrantyStatus : request.WarrantyStatus,
                Decision = string.IsNullOrWhiteSpace(request.Decision) ? "PENDING_INSPECTION" : request.Decision,
                ReturnReason = request.ReturnReason?.Trim() ?? string.Empty,
                CreatedAt = DateTime.UtcNow
            };

            _context.RmaReturnRequests.Add(rmaRecord);
            await _context.SaveChangesAsync();

            return Ok(new RmaReturnResponseDto
            {
                RmaId = rmaRecord.Id,
                RmaNumber = rmaRecord.RmaNumber,
                InvoiceNumber = rmaRecord.InvoiceNumber,
                ProductName = rmaRecord.ProductName,
                Sku = rmaRecord.Sku,
                ReturnQuantity = rmaRecord.ReturnQuantity,
                RefundAmount = rmaRecord.RefundAmount,
                Currency = rmaRecord.Currency,
                WarrantyStatus = rmaRecord.WarrantyStatus,
                Decision = rmaRecord.Decision,
                RemainingReturnableQty = remainingReturnable - request.ReturnQuantity,
                CreatedAt = rmaRecord.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create return for invoice {InvoiceId}", invoiceId);
            return StatusCode(500, new 
            { 
                errorCode = "ERR_CREATE_RMA_FAILED", 
                message = "حدث خطأ أثناء تسجيل طلب الإرجاع." 
            });
        }
    }
}

public class InvoiceSummaryDto
{
    public Guid Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string CashierName { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string DispenseMode { get; set; } = "IN_STORE";
    public string FulfillmentStatus { get; set; } = "FULFILLED";
    public DateTime CreatedAt { get; set; }
    public int ItemsCount { get; set; }
}

public class ReturnableInvoiceItemDto
{
    public Guid ItemId { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public int SoldQty { get; set; }
    public int AlreadyReturnedQty { get; set; }
    public int RemainingReturnableQty { get; set; }
    public decimal UnitPrice { get; set; }
    public string Currency { get; set; } = "IQD";
    public DateTime WarrantyExpiresAt { get; set; }
    public bool IsUnderWarranty { get; set; }
}

public class CreateInvoiceReturnRequestDto
{
    public string? RmaNumber { get; set; }
    public Guid ProductId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string? SerialNumber { get; set; }
    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public int ReturnQuantity { get; set; } = 1;
    public string? ReturnReason { get; set; }
    public string? WarrantyStatus { get; set; }
    public string? Decision { get; set; }
    public string? Currency { get; set; }
}

public class RmaReturnResponseDto
{
    public Guid RmaId { get; set; }
    public string RmaNumber { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public int ReturnQuantity { get; set; }
    public decimal RefundAmount { get; set; }
    public string Currency { get; set; } = "IQD";
    public string WarrantyStatus { get; set; } = "VALID_UNDER_WARRANTY";
    public string Decision { get; set; } = "PENDING_INSPECTION";
    public int RemainingReturnableQty { get; set; }
    public DateTime CreatedAt { get; set; }
}

