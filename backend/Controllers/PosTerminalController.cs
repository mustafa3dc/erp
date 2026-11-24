using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/pos")]
public class PosTerminalController : ControllerBase
{
    private readonly IDiscountEngineService _discountEngine;
    private readonly ILogger<PosTerminalController> _logger;

    public PosTerminalController(IDiscountEngineService discountEngine, ILogger<PosTerminalController> logger)
    {
        _discountEngine = discountEngine;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/pos/products
    /// Strictly Masked Product Catalog for Cashiers and POS Terminals.
    /// Excludes CostPrice, Profit Margins, and floor limits.
    /// </summary>
    [HttpGet("products")]
    public async Task<ActionResult<IEnumerable<PosProductDto>>> GetProducts(
        [FromQuery] string? search, [FromQuery] Guid? categoryId)
    {
        var products = await _discountEngine.GetPosProductsAsync(search, categoryId);
        return Ok(products);
    }

    /// <summary>
    /// GET /api/pos/categories
    /// Dynamic category list for POS product filtering.
    /// Strictly zero-mock: returns empty array if no categories are registered.
    /// </summary>
    [HttpGet("categories")]
    public async Task<ActionResult<IEnumerable<PosCategoryDto>>> GetCategories()
    {
        var categories = await _discountEngine.GetPosCategoriesAsync();
        return Ok(categories);
    }


    /// <summary>
    /// POST /api/pos/discounts/validate
    /// Silent Backend Discount Validation.
    /// Evaluates role limits and margin safety without revealing cost figures.
    /// </summary>
    [HttpPost("discounts/validate")]
    public async Task<ActionResult<ValidateDiscountResponse>> ValidateDiscount(
        [FromBody] ValidateDiscountRequest request)
    {
        var result = await _discountEngine.ValidateDiscountAsync(request);
        
        if (!result.IsAllowed && result.ErrorCode == "ERR_DISCOUNT_EXCEEDED_LIMIT")
        {
            // Return 422 Unprocessable Entity with standardized error code and safe message
            return UnprocessableEntity(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// POST /api/pos/discounts/manager-override
    /// Validates Supervisor or Admin PIN for instant on-screen discount override.
    /// </summary>
    [HttpPost("discounts/manager-override")]
    public async Task<ActionResult<ManagerOverrideResponse>> AuthorizeManagerOverride(
        [FromBody] ManagerOverrideRequest request)
    {
        var result = await _discountEngine.AuthorizeManagerOverrideAsync(request);
        
        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// GET /api/pos/payment-methods
    /// Returns allowed payment methods based on tenant country isolation rules.
    /// </summary>
    [HttpGet("payment-methods")]
    public ActionResult<IEnumerable<string>> GetPaymentMethods([FromHeader(Name = "X-Tenant-Country")] string? countryCode)
    {
        var tenantCountry = string.IsNullOrWhiteSpace(countryCode) ? "IQ" : countryCode;
        return Ok(Erp.Domain.Entities.PaymentMethodsRegistry.GetAllowedMethodsForCountry(tenantCountry));
    }

    /// <summary>
    /// POST /api/pos/invoices
    /// Creates POS invoice, updates warehouse inventory, and registers Discount Audit Trail.
    /// Strictly validates regional isolation for payment methods (e.g. ZAIN_CASH, QI_CARD only for IQ).
    /// </summary>
    [HttpPost("invoices")]
    public async Task<ActionResult<PosInvoiceResponse>> CreateInvoice(
        [FromBody] CreatePosInvoiceRequest request,
        [FromHeader(Name = "X-Tenant-Country")] string? countryCode)
    {
        var tenantCountry = string.IsNullOrWhiteSpace(countryCode) ? "IQ" : countryCode;
        if (!Erp.Domain.Entities.PaymentMethodsRegistry.IsMethodAllowedForCountry(request.PaymentMethod, tenantCountry))
        {
            return BadRequest(new
            {
                errorCode = "ERR_PAYMENT_METHOD_NOT_SUPPORTED_IN_REGION",
                message = $"وسيلة الدفع ({request.PaymentMethod}) غير مدعومة في النطاق الجغرافي للمتجر ({tenantCountry}).",
                allowedMethods = Erp.Domain.Entities.PaymentMethodsRegistry.GetAllowedMethodsForCountry(tenantCountry)
            });
        }

        try
        {
            var invoice = await _discountEngine.CreatePosInvoiceAsync(request);
            return CreatedAtAction(nameof(GetProducts), new { id = invoice.InvoiceId }, invoice);
        }
        catch (ApplicationException ex)
        {
            var isStockError = ex.Message.Contains("ERR_INSUFFICIENT_STOCK") || ex.Message.Contains("غير كافٍ") || ex.Message.Contains("الرصيد");
            var isWarehouseError = !isStockError && (ex.Message.Contains("INVALID_WAREHOUSE") || ex.Message.Contains("المستودع") || ex.Message.Contains("مستودع"));
            return BadRequest(new 
            { 
                errorCode = isStockError ? "ERR_INSUFFICIENT_STOCK" : (isWarehouseError ? "INVALID_WAREHOUSE" : "ERR_DISCOUNT_EXCEEDED_LIMIT"), 
                message = ex.Message 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "POS invoice creation failed");
            return StatusCode(500, new 
            { 
                errorCode = "ERR_INTERNAL_POS", 
                message = "حدث خطأ أثناء معالجة الفاتورة" 
            });
        }
    }

    /// <summary>
    /// GET /api/pos/discounts/audit-logs
    /// Retrieves full Discount Audit Trail (Who discounted, what item, who authorized).
    /// </summary>
    [HttpGet("discounts/audit-logs")]
    public async Task<ActionResult<IEnumerable<DiscountAuditLogDto>>> GetAuditLogs(
        [FromQuery] string? invoiceNumber,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var logs = await _discountEngine.GetDiscountAuditLogsAsync(invoiceNumber, fromDate, toDate);
        return Ok(logs);
    }

    private static readonly List<ShiftAuditRecordDto> _shiftAuditTrail = new();
    private static readonly object _shiftLock = new();

    /// <summary>
    /// POST /api/pos/shifts/open
    /// Opens and stamps a new POS cashier shift with high-precision timestamp.
    /// </summary>
    [HttpPost("shifts/open")]
    public ActionResult<ShiftAuditRecordDto> OpenShift([FromBody] OpenShiftApiRequest request)
    {
        var openedAt = request.OpenedAt ?? DateTime.UtcNow;
        var shift = new ShiftAuditRecordDto
        {
            Id = $"SH-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() % 10000:D4}",
            CashierName = request.CashierName,
            TerminalId = request.TerminalId,
            OpenedAt = openedAt,
            StartTime = openedAt.ToString("yyyy/MM/dd hh:mm:ss tt"),
            OpeningFloat = request.OpeningFloat,
            Status = "ACTIVE"
        };

        _logger.LogInformation("POS Shift opened for cashier {Cashier} on terminal {Terminal} at {Time}",
            shift.CashierName, shift.TerminalId, shift.StartTime);

        return Ok(shift);
    }

    /// <summary>
    /// POST /api/pos/shifts/close
    /// Closes a POS cashier shift, records exact closing timestamp, calculates duration and variances, and archives Z-Report.
    /// </summary>
    [HttpPost("shifts/close")]
    public ActionResult<ShiftAuditRecordDto> CloseShift([FromBody] CloseShiftApiRequest request)
    {
        var openedAt = request.OpenedAt ?? DateTime.UtcNow.AddHours(-8);
        var closedAt = request.ClosedAt ?? DateTime.UtcNow;
        var durationSpan = closedAt > openedAt ? closedAt - openedAt : TimeSpan.Zero;
        var durationText = $"{(int)durationSpan.TotalHours} ساعة و {durationSpan.Minutes} دقيقة";

        var expectedCash = request.OpeningFloat + request.CashSales;
        var difference = request.ActualCash - expectedCash;
        var zReportNumber = request.ZReportNumber ?? $"Z-{DateTime.UtcNow.Year}-{new Random().Next(1000, 9999)}";

        var closedRecord = new ShiftAuditRecordDto
        {
            Id = string.IsNullOrWhiteSpace(request.ShiftId) ? $"SH-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() % 10000:D4}" : request.ShiftId,
            ZReportNumber = zReportNumber,
            CashierName = request.CashierName,
            TerminalId = request.TerminalId,
            OpenedAt = openedAt,
            ClosedAt = closedAt,
            StartTime = openedAt.ToString("yyyy/MM/dd hh:mm:ss tt"),
            EndTime = closedAt.ToString("yyyy/MM/dd hh:mm:ss tt"),
            Duration = durationText,
            OpeningFloat = request.OpeningFloat,
            CashSales = request.CashSales,
            CardSales = request.CardSales,
            ZainCashSales = request.ZainCashSales ?? 0,
            QiCardSales = request.QiCardSales ?? 0,
            ExpectedCash = expectedCash,
            ActualCash = request.ActualCash,
            Difference = difference,
            Status = "CLOSED"
        };

        lock (_shiftLock)
        {
            _shiftAuditTrail.Insert(0, closedRecord);
        }

        _logger.LogInformation("POS Shift closed with Z-Report {ZReport} at {CloseTime}. Duration: {Duration}",
            closedRecord.ZReportNumber, closedRecord.EndTime, closedRecord.Duration);

        return Ok(closedRecord);
    }

    /// <summary>
    /// GET /api/pos/shifts/history
    /// Retrieves audited shift history with precise open/close timestamps and durations.
    /// </summary>
    [HttpGet("shifts/history")]
    public ActionResult<IEnumerable<ShiftAuditRecordDto>> GetShiftHistory()
    {
        lock (_shiftLock)
        {
            return Ok(_shiftAuditTrail.ToList());
        }
    }
}
