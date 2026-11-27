using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[RequiresPlanFeature(PlanFeatureKeys.LoyaltyPoints)]
[ApiController]
[Route("api/loyalty")]
[Route("api/v1/loyalty")]
public class LoyaltyController : ControllerBase
{
    private readonly ILoyaltyService _loyaltyService;
    private readonly ILogger<LoyaltyController> _logger;

    public LoyaltyController(ILoyaltyService loyaltyService, ILogger<LoyaltyController> logger)
    {
        _loyaltyService = loyaltyService;
        _logger = logger;
    }

    private string CurrentActorName =>
        User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("username")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "System";

    [HttpGet("settings")]
    public async Task<ActionResult<LoyaltySettingsDto>> GetSettings(CancellationToken ct)
    {
        var settings = await _loyaltyService.GetSettingsAsync(ct);
        return Ok(settings);
    }

    [HttpPut("settings")]
    public async Task<ActionResult<LoyaltySettingsDto>> UpdateSettings(
        [FromBody] UpdateLoyaltySettingsRequestDto request,
        CancellationToken ct)
    {
        try
        {
            var updated = await _loyaltyService.UpdateSettingsAsync(request, CurrentActorName, ct);
            return Ok(updated);
        }
        catch (ApplicationException ex) when (ex.Message.Contains("ERR_INVALID_LOYALTY_CONFIG"))
        {
            return BadRequest(new { errorCode = "ERR_INVALID_LOYALTY_CONFIG" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update loyalty settings");
            return StatusCode(500, new { errorCode = "ERR_LOYALTY_SETTINGS_UPDATE_FAILED" });
        }
    }

    [HttpGet("transactions")]
    public async Task<ActionResult<IEnumerable<LoyaltyTransactionDto>>> GetTransactions(
        [FromQuery] Guid? customerId,
        [FromQuery] int limit = 100,
        CancellationToken ct = default)
    {
        var items = await _loyaltyService.GetTransactionsAsync(customerId, limit, ct);
        return Ok(items);
    }

    [HttpGet("customers/{customerId:guid}")]
    public async Task<ActionResult<CustomerLoyaltySummaryDto>> GetCustomerSummary(
        [FromRoute] Guid customerId,
        CancellationToken ct)
    {
        var summary = await _loyaltyService.GetCustomerLoyaltySummaryAsync(customerId, ct);
        if (summary == null)
        {
            return NotFound(new { errorCode = "ERR_CUSTOMER_NOT_FOUND" });
        }
        return Ok(summary);
    }

    [HttpPost("adjust")]
    public async Task<ActionResult<LoyaltyTransactionDto>> AdjustPoints(
        [FromBody] LoyaltyManualAdjustmentDto request,
        CancellationToken ct)
    {
        try
        {
            var tx = await _loyaltyService.AdjustPointsManuallyAsync(request, CurrentActorName, ct);
            return Ok(tx);
        }
        catch (ApplicationException ex)
        {
            var errorCode = ex.Message.Contains("ERR_LOYALTY_WALKIN_NOT_ALLOWED")
                ? "ERR_LOYALTY_WALKIN_NOT_ALLOWED"
                : ex.Message.Contains("ERR_CUSTOMER_NOT_FOUND")
                ? "ERR_CUSTOMER_NOT_FOUND"
                : "ERR_LOYALTY_ADJUSTMENT_FAILED";
            return BadRequest(new { errorCode });
        }
    }
}
