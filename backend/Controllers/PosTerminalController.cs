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
            var isWarehouseError = ex.Message.Contains("المستودع") || ex.Message.Contains("مستودع") || ex.Message.Contains("INVALID_WAREHOUSE");
            var isStockError = ex.Message.Contains("غير كافٍ") || ex.Message.Contains("الرصيد");
            return BadRequest(new 
            { 
                errorCode = isWarehouseError ? "INVALID_WAREHOUSE" : (isStockError ? "ERR_INSUFFICIENT_STOCK" : "ERR_DISCOUNT_EXCEEDED_LIMIT"), 
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
}
