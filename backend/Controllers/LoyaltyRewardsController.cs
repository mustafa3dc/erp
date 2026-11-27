using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[RequiresPlanFeature(PlanFeatureKeys.LoyaltyPoints)]
[ApiController]
[Route("api/loyalty/rewards")]
[Route("api/v1/loyalty/rewards")]
public class LoyaltyRewardsController : ControllerBase
{
    private readonly ILoyaltyRewardsService _rewardsService;
    private readonly ILogger<LoyaltyRewardsController> _logger;

    public LoyaltyRewardsController(
        ILoyaltyRewardsService rewardsService,
        ILogger<LoyaltyRewardsController> logger)
    {
        _rewardsService = rewardsService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<LoyaltyRewardDto>>>> GetRewards(CancellationToken ct)
    {
        var rewards = await _rewardsService.GetTenantRewardsAsync(ct);
        return Ok(ApiResponse<List<LoyaltyRewardDto>>.Ok(rewards));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<LoyaltyRewardDto>>> CreateReward(
        [FromBody] UpsertLoyaltyRewardRequestDto request,
        CancellationToken ct)
    {
        try
        {
            var created = await _rewardsService.CreateRewardAsync(request, ct);
            return Ok(ApiResponse<LoyaltyRewardDto>.Ok(created));
        }
        catch (LoyaltyDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<LoyaltyRewardDto>.Fail(ex.ErrorCode, "LOYALTY", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating loyalty reward");
            return StatusCode(500, ApiResponse<LoyaltyRewardDto>.Fail("ERR_LOYALTY_REWARD_CREATE_FAILED", "LOYALTY"));
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<LoyaltyRewardDto>>> UpdateReward(
        [FromRoute] Guid id,
        [FromBody] UpsertLoyaltyRewardRequestDto request,
        CancellationToken ct)
    {
        try
        {
            var updated = await _rewardsService.UpdateRewardAsync(id, request, ct);
            return Ok(ApiResponse<LoyaltyRewardDto>.Ok(updated));
        }
        catch (LoyaltyDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<LoyaltyRewardDto>.Fail(ex.ErrorCode, "LOYALTY", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating loyalty reward {RewardId}", id);
            return StatusCode(500, ApiResponse<LoyaltyRewardDto>.Fail("ERR_LOYALTY_REWARD_UPDATE_FAILED", "LOYALTY"));
        }
    }

    [HttpPatch("{id:guid}/toggle")]
    public async Task<ActionResult<ApiResponse<LoyaltyRewardDto>>> ToggleReward(
        [FromRoute] Guid id,
        CancellationToken ct)
    {
        try
        {
            var toggled = await _rewardsService.ToggleRewardAsync(id, ct);
            return Ok(ApiResponse<LoyaltyRewardDto>.Ok(toggled));
        }
        catch (LoyaltyDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<LoyaltyRewardDto>.Fail(ex.ErrorCode, "LOYALTY", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling loyalty reward {RewardId}", id);
            return StatusCode(500, ApiResponse<LoyaltyRewardDto>.Fail("ERR_LOYALTY_REWARD_TOGGLE_FAILED", "LOYALTY"));
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteReward(
        [FromRoute] Guid id,
        CancellationToken ct)
    {
        try
        {
            await _rewardsService.DeleteRewardAsync(id, ct);
            return Ok(ApiResponse<object>.Ok(new { id, deleted = true }));
        }
        catch (LoyaltyDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<object>.Fail(ex.ErrorCode, "LOYALTY", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting loyalty reward {RewardId}", id);
            return StatusCode(500, ApiResponse<object>.Fail("ERR_LOYALTY_REWARD_DELETE_FAILED", "LOYALTY"));
        }
    }
}
