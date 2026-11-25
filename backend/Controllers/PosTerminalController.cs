using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/pos")]
public class PosTerminalController : ControllerBase
{
    private readonly IDiscountEngineService _discountEngine;
    private readonly AppDbContext _context;
    private readonly ILogger<PosTerminalController> _logger;

    public PosTerminalController(
        IDiscountEngineService discountEngine,
        AppDbContext context,
        ILogger<PosTerminalController> logger)
    {
        _discountEngine = discountEngine;
        _context = context;
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
            var errorCode = ex.Message.Contains("ERR_CREDIT_SALE_REQUIRES_CUSTOMER")
                ? "ERR_CREDIT_SALE_REQUIRES_CUSTOMER"
                : ex.Message.Contains("ERR_CUSTOMER_NOT_FOUND")
                ? "ERR_CUSTOMER_NOT_FOUND"
                : ex.Message.Contains("ERR_CREDIT_LIMIT_EXCEEDED")
                ? "ERR_CREDIT_LIMIT_EXCEEDED"
                : (ex.Message.Contains("ERR_INSUFFICIENT_STOCK") || ex.Message.Contains("غير كافٍ") || ex.Message.Contains("الرصيد"))
                ? "ERR_INSUFFICIENT_STOCK"
                : (ex.Message.Contains("INVALID_WAREHOUSE") || ex.Message.Contains("المستودع") || ex.Message.Contains("مستودع"))
                ? "INVALID_WAREHOUSE"
                : "ERR_DISCOUNT_EXCEEDED_LIMIT";

            return BadRequest(new
            {
                errorCode,
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
    /// GET /api/pos/shifts/{shiftId}/summary
    /// Strictly computes active shift drawer totals and breakdown strictly from POS invoices &amp; cash expenses
    /// where ShiftId == shiftId (excludes other shifts and non-POS back-office invoices).
    /// </summary>
    [HttpGet("shifts/{shiftId}/summary")]
    public async Task<ActionResult<ShiftBreakdownSummaryDto>> GetShiftSummary(string shiftId)
    {
        if (string.IsNullOrWhiteSpace(shiftId))
        {
            return BadRequest(new { errorCode = "ERR_INVALID_SHIFT_ID", message = "Shift ID is required." });
        }

        var normalizedShiftId = shiftId.Trim();

        var shiftInvoices = await _context.SalesInvoices
            .AsNoTracking()
            .Include(i => i.Items)
            .Where(i => i.ShiftId == normalizedShiftId && i.PaymentStatus == "PAID")
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

        var shiftExpenses = await _context.CashExpenses
            .AsNoTracking()
            .Where(e => e.ShiftId == normalizedShiftId)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();

        decimal cashSales = 0m;
        decimal cardSales = 0m;
        decimal zainCashSales = 0m;
        decimal qiCardSales = 0m;

        foreach (var inv in shiftInvoices)
        {
            var method = (inv.PaymentMethod ?? "CASH").Trim().ToUpperInvariant();
            switch (method)
            {
                case "CASH":
                    cashSales += inv.TotalAmount;
                    break;
                case "CARD":
                case "CREDIT_CARD":
                    cardSales += inv.TotalAmount;
                    break;
                case "ZAIN_CASH":
                    zainCashSales += inv.TotalAmount;
                    break;
                case "QI_CARD":
                    qiCardSales += inv.TotalAmount;
                    break;
            }
        }

        var pettyExpenses = shiftExpenses.Sum(e => e.Amount);

        var summary = new ShiftBreakdownSummaryDto
        {
            ShiftId = normalizedShiftId,
            CashSales = cashSales,
            CardSales = cardSales,
            ZainCashSales = zainCashSales,
            QiCardSales = qiCardSales,
            PettyExpenses = pettyExpenses,
            InvoicesCount = shiftInvoices.Count,
            ExpensesCount = shiftExpenses.Count,
            Invoices = shiftInvoices.Select(i => new ShiftInvoiceMovementDto
            {
                Id = i.Id,
                InvoiceNumber = i.InvoiceNumber,
                CreatedAt = i.CreatedAt,
                PaymentMethod = i.PaymentMethod,
                PaymentStatus = i.PaymentStatus,
                DispenseMode = i.DispenseMode,
                TotalAmount = i.TotalAmount,
                CashierName = i.CashierName ?? i.CashierId,
                ItemsCount = i.Items.Sum(it => it.Quantity)
            }).ToList(),
            Expenses = shiftExpenses.Select(e => new ShiftCashExpenseMovementDto
            {
                Id = e.Id,
                CreatedAt = e.CreatedAt,
                CategoryName = e.CategoryName,
                Amount = e.Amount,
                Currency = e.Currency,
                Notes = e.Notes,
                CreatedBy = e.CreatedBy
            }).ToList()
        };

        return Ok(summary);
    }

    /// <summary>
    /// POST /api/pos/shifts/close
    /// Closes a POS cashier shift, verifies drawer cash against ShiftId-filtered POS sales and expenses, and archives Z-Report.
    /// </summary>
    [HttpPost("shifts/close")]
    public async Task<ActionResult<ShiftAuditRecordDto>> CloseShift([FromBody] CloseShiftApiRequest request)
    {
        var openedAt = request.OpenedAt ?? DateTime.UtcNow.AddHours(-8);
        var closedAt = request.ClosedAt ?? DateTime.UtcNow;
        var durationSpan = closedAt > openedAt ? closedAt - openedAt : TimeSpan.Zero;
        var durationText = $"{(int)durationSpan.TotalHours} ساعة و {durationSpan.Minutes} دقيقة";
        var shiftId = string.IsNullOrWhiteSpace(request.ShiftId)
            ? $"SH-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() % 10000:D4}"
            : request.ShiftId.Trim();

        // Strictly query POS sales and petty expenses tagged with ShiftId == shiftId
        var shiftInvoices = await _context.SalesInvoices
            .AsNoTracking()
            .Where(i => i.ShiftId == shiftId && i.PaymentStatus == "PAID")
            .ToListAsync();

        var dbExpenseSum = await _context.CashExpenses
            .AsNoTracking()
            .Where(e => e.ShiftId == shiftId)
            .SumAsync(e => (decimal?)e.Amount) ?? 0m;

        var cashSales = request.CashSales;
        var cardSales = request.CardSales;
        var zainCashSales = request.ZainCashSales ?? 0m;
        var qiCardSales = request.QiCardSales ?? 0m;

        if (shiftInvoices.Count > 0)
        {
            cashSales = shiftInvoices
                .Where(i => string.Equals(i.PaymentMethod, "CASH", StringComparison.OrdinalIgnoreCase))
                .Sum(i => i.TotalAmount);
            cardSales = shiftInvoices
                .Where(i => string.Equals(i.PaymentMethod, "CARD", StringComparison.OrdinalIgnoreCase)
                         || string.Equals(i.PaymentMethod, "CREDIT_CARD", StringComparison.OrdinalIgnoreCase))
                .Sum(i => i.TotalAmount);
            zainCashSales = shiftInvoices
                .Where(i => string.Equals(i.PaymentMethod, "ZAIN_CASH", StringComparison.OrdinalIgnoreCase))
                .Sum(i => i.TotalAmount);
            qiCardSales = shiftInvoices
                .Where(i => string.Equals(i.PaymentMethod, "QI_CARD", StringComparison.OrdinalIgnoreCase))
                .Sum(i => i.TotalAmount);
        }

        var pettyExpenses = dbExpenseSum > 0m ? dbExpenseSum : (request.PettyExpenses ?? 0m);
        var expectedCash = request.OpeningFloat + cashSales - pettyExpenses;
        var difference = request.ActualCash - expectedCash;
        var zReportNumber = request.ZReportNumber ?? $"Z-{DateTime.UtcNow.Year}-{Random.Shared.Next(1000, 9999)}";

        var closedRecord = new ShiftAuditRecordDto
        {
            Id = shiftId,
            ZReportNumber = zReportNumber,
            CashierName = request.CashierName,
            TerminalId = request.TerminalId,
            OpenedAt = openedAt,
            ClosedAt = closedAt,
            StartTime = openedAt.ToString("yyyy/MM/dd hh:mm:ss tt"),
            EndTime = closedAt.ToString("yyyy/MM/dd hh:mm:ss tt"),
            Duration = durationText,
            OpeningFloat = request.OpeningFloat,
            CashSales = cashSales,
            CardSales = cardSales,
            ZainCashSales = zainCashSales,
            QiCardSales = qiCardSales,
            PettyExpenses = pettyExpenses,
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
