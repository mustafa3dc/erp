using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[RequiresPlanFeature(PlanFeatureKeys.Quotations)]
[ApiController]
[Route("api/[controller]")]
public class QuotationsController : ControllerBase
{
    private readonly IQuotationService _quotationService;
    private readonly ILogger<QuotationsController> _logger;

    public QuotationsController(IQuotationService quotationService, ILogger<QuotationsController> logger)
    {
        _quotationService = quotationService;
        _logger = logger;
    }

    private string CurrentUserName =>
        User.FindFirst(ClaimTypes.Name)?.Value 
        ?? User.FindFirst("username")?.Value 
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
        ?? "System";

    private string CurrentUserId =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
        ?? User.FindFirst("sub")?.Value 
        ?? "System";

    [HttpGet]
    [HasPermission(Permissions.Sales.QuotationsView)]
    public async Task<ActionResult<ApiResponse<List<SalesQuotationDto>>>> GetQuotations(
        [FromQuery] Guid? customerId,
        [FromQuery] string? status,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var quotations = await _quotationService.GetQuotationsAsync(customerId, status, fromDate, toDate);
        return Ok(ApiResponse<List<SalesQuotationDto>>.Ok(quotations));
    }

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.Sales.QuotationsView)]
    public async Task<ActionResult<ApiResponse<SalesQuotationDto>>> GetQuotationById(Guid id)
    {
        var quotation = await _quotationService.GetQuotationByIdAsync(id);
        if (quotation == null)
        {
            return NotFound(ApiResponse<SalesQuotationDto>.Fail("ERR_QUOTATION_NOT_FOUND", "SALES"));
        }
        return Ok(ApiResponse<SalesQuotationDto>.Ok(quotation));
    }

    [HttpPost]
    [HasPermission(Permissions.Sales.QuotationsCreate)]
    public async Task<ActionResult<ApiResponse<SalesQuotationDto>>> CreateQuotation([FromBody] CreateSalesQuotationRequest request)
    {
        var result = await _quotationService.CreateQuotationAsync(request, CurrentUserName);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return CreatedAtAction(nameof(GetQuotationById), new { id = result.Data!.Id }, result);
    }

    [HttpPost("{id:guid}/status")]
    [HasPermission(Permissions.Sales.QuotationsEdit)]
    public async Task<ActionResult<ApiResponse<SalesQuotationDto>>> UpdateStatus(Guid id, [FromQuery] string status)
    {
        var result = await _quotationService.UpdateQuotationStatusAsync(id, status, CurrentUserName);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("{id:guid}/convert")]
    [HasPermission(Permissions.Sales.QuotationsConvert)]
    public async Task<ActionResult<ApiResponse<ConvertQuotationResponseDto>>> ConvertToInvoice(
        Guid id, 
        [FromBody] ConvertQuotationToInvoiceRequest request)
    {
        var result = await _quotationService.ConvertToInvoiceAsync(id, request, CurrentUserId, CurrentUserName);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }
}
