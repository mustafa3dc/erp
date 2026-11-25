using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/invoices")]
[Route("api/v1/invoices")]
public class InvoicesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ISalesReturnService _salesReturnService;
    private readonly IDiscountEngineService _discountEngine;
    private readonly ILogger<InvoicesController> _logger;

    public InvoicesController(
        AppDbContext context,
        ISalesReturnService salesReturnService,
        IDiscountEngineService discountEngine,
        ILogger<InvoicesController> logger)
    {
        _context = context;
        _salesReturnService = salesReturnService;
        _discountEngine = discountEngine;
        _logger = logger;
    }

    private string CurrentActorName =>
        User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("username")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "System";

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
    /// POST /api/invoices
    /// Creates a Standard Sales Invoice strictly requiring an active open ShiftId (ERR_NO_ACTIVE_SHIFT if missing).
    /// Binds SalesInvoice.ShiftId to the active shift for unified drawer &amp; Z-Report tracking.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<PosInvoiceResponse>> CreateStandardInvoice([FromBody] CreatePosInvoiceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ShiftId))
        {
            return BadRequest(new { errorCode = "ERR_NO_ACTIVE_SHIFT" });
        }

        request.Source = InvoiceSource.StandardInvoice;

        try
        {
            var created = await _discountEngine.CreatePosInvoiceAsync(request);
            return CreatedAtAction(nameof(GetInvoices), new { id = created.InvoiceId }, created);
        }
        catch (ApplicationException ex)
        {
            var errorCode = ex.Message.Contains("ERR_NO_ACTIVE_SHIFT")
                ? "ERR_NO_ACTIVE_SHIFT"
                : ex.Message.Contains("ERR_INSUFFICIENT_LOYALTY_POINTS")
                ? "ERR_INSUFFICIENT_LOYALTY_POINTS"
                : ex.Message.Contains("ERR_BELOW_MIN_REDEEM_POINTS")
                ? "ERR_BELOW_MIN_REDEEM_POINTS"
                : ex.Message.Contains("ERR_LOYALTY_DISABLED")
                ? "ERR_LOYALTY_DISABLED"
                : ex.Message.Contains("ERR_LOYALTY_WALKIN_NOT_ALLOWED")
                ? "ERR_LOYALTY_WALKIN_NOT_ALLOWED"
                : ex.Message.Contains("ERR_CREDIT_SALE_REQUIRES_CUSTOMER")
                ? "ERR_CREDIT_SALE_REQUIRES_CUSTOMER"
                : ex.Message.Contains("ERR_CUSTOMER_NOT_FOUND")
                ? "ERR_CUSTOMER_NOT_FOUND"
                : ex.Message.Contains("ERR_CREDIT_LIMIT_EXCEEDED")
                ? "ERR_CREDIT_LIMIT_EXCEEDED"
                : (ex.Message.Contains("ERR_INSUFFICIENT_STOCK") || ex.Message.Contains("غير كافٍ") || ex.Message.Contains("الرصيد"))
                ? "ERR_INSUFFICIENT_STOCK"
                : (ex.Message.Contains("INVALID_WAREHOUSE") || ex.Message.Contains("المستودع") || ex.Message.Contains("مستودع"))
                ? "INVALID_WAREHOUSE"
                : "ERR_CREATE_STANDARD_INVOICE_FAILED";

            return BadRequest(new { errorCode, message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create standard sales invoice");
            return StatusCode(500, new { errorCode = "ERR_INTERNAL_INVOICE", message = "حدث خطأ أثناء إنشاء فاتورة المبيعات" });
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
            var warehousesMap = await _context.Warehouses.AsNoTracking().ToDictionaryAsync(w => w.Id, w => w.Name);

            foreach (var item in invoice.Items)
            {
                var returnedQty = existingReturns
                    .Where(r => r.ProductId == item.ProductId || (r.Sku == item.Product?.Sku))
                    .Sum(r => r.ReturnQuantity);

                var remainingQty = Math.Max(0, item.Quantity - returnedQty);
                var itemWarehouseId = item.SourceWarehouseId ?? invoice.WarehouseId;
                warehousesMap.TryGetValue(itemWarehouseId, out var itemWarehouseName);

                returnableItems.Add(new ReturnableInvoiceItemDto
                {
                    ItemId = item.Id,
                    ProductId = item.ProductId,
                    ProductName = item.Product?.Name ?? "صنف مبيعات",
                    Sku = item.Product?.Sku ?? "SKU-GEN",
                    SerialNumber = item.Product?.Barcode ?? string.Empty,
                    WarehouseId = itemWarehouseId,
                    WarehouseName = itemWarehouseName ?? string.Empty,
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
    /// GET /api/invoices/returns
    /// Lists all recorded Sales Return (RMA) requests with warehouse and restock audit details.
    /// </summary>
    [HttpGet("returns")]
    public async Task<ActionResult<IEnumerable<RmaReturnResponseDto>>> GetReturns([FromQuery] string? decision)
    {
        var items = await _salesReturnService.GetReturnsAsync(decision);
        return Ok(items);
    }

    /// <summary>
    /// POST /api/invoices/{invoiceId}/returns
    /// Validates and records an RMA return request strictly bound to the invoice line items.
    /// Atomically increments warehouse inventory &amp; serial status inside ACID transaction when Decision is APPROVED_RESTOCKED.
    /// </summary>
    [HttpPost("{invoiceId}/returns")]
    public async Task<ActionResult<RmaReturnResponseDto>> CreateInvoiceReturn(
        [FromRoute] string invoiceId,
        [FromBody] CreateInvoiceReturnRequestDto request)
    {
        var result = await _salesReturnService.CreateInvoiceReturnAsync(invoiceId, request, CurrentActorName);
        if (!result.Success)
        {
            return StatusCode(result.StatusCode, new
            {
                errorCode = result.ErrorCode ?? "ERR_CREATE_RMA_FAILED",
                message = result.Message ?? "حدث خطأ أثناء تسجيل طلب الإرجاع."
            });
        }

        return Ok(result.Data);
    }

    /// <summary>
    /// POST /api/invoices/returns/{rmaId}/approve
    /// Approves a pending RMA request and atomically restores returned inventory stock (including bundles &amp; serials).
    /// </summary>
    [HttpPost("returns/{rmaId:guid}/approve")]
    public async Task<ActionResult<RmaReturnResponseDto>> ApproveInvoiceReturn(
        [FromRoute] Guid rmaId,
        [FromBody] ApproveSalesReturnRequestDto? request = null)
    {
        var result = await _salesReturnService.ApproveAndRestockReturnAsync(rmaId, request, CurrentActorName);
        if (!result.Success)
        {
            return StatusCode(result.StatusCode, new
            {
                errorCode = result.ErrorCode ?? "ERR_APPROVE_RMA_FAILED",
                message = result.Message ?? "حدث خطأ أثناء اعتماد المرتجع وإرجاع البضاعة للمستودع."
            });
        }

        return Ok(result.Data);
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
    public Guid WarehouseId { get; set; }
    public string WarehouseName { get; set; } = string.Empty;
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
    public Guid? WarehouseId { get; set; }
    public string? ReturnReason { get; set; }
    public string? WarrantyStatus { get; set; }
    public string? Decision { get; set; }
    public string? Currency { get; set; }
}

public class ApproveSalesReturnRequestDto
{
    public Guid? WarehouseId { get; set; }
    public string? Notes { get; set; }
}

public class RmaReturnResponseDto
{
    public Guid RmaId { get; set; }
    public string RmaNumber { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public int ReturnQuantity { get; set; }
    public decimal RefundAmount { get; set; }
    public string Currency { get; set; } = "IQD";
    public string WarrantyStatus { get; set; } = "VALID_UNDER_WARRANTY";
    public string Decision { get; set; } = "PENDING_INSPECTION";
    public Guid? WarehouseId { get; set; }
    public string? WarehouseName { get; set; }
    public bool IsRestocked { get; set; }
    public DateTime? RestockedAt { get; set; }
    public string? RestockedBy { get; set; }
    public string ReturnReason { get; set; } = string.Empty;
    public int RemainingReturnableQty { get; set; }
    public decimal LoyaltyPointsReversed { get; set; }
    public DateTime CreatedAt { get; set; }
}

