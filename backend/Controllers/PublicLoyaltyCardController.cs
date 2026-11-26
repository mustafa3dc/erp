using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/public/loyalty-card")]
[Route("api/v1/public/loyalty-card")]
public class PublicLoyaltyCardController : ControllerBase
{
    private readonly ILoyaltyRewardsService _rewardsService;
    private readonly ILogger<PublicLoyaltyCardController> _logger;

    public PublicLoyaltyCardController(
        ILoyaltyRewardsService rewardsService,
        ILogger<PublicLoyaltyCardController> logger)
    {
        _rewardsService = rewardsService;
        _logger = logger;
    }

    [HttpGet("{token}")]
    public async Task<ActionResult<ApiResponse<PublicLoyaltyCardDto>>> GetCard(
        [FromRoute] string token,
        CancellationToken ct)
    {
        try
        {
            var card = await _rewardsService.GetPublicCardAsync(token, ct);
            return Ok(ApiResponse<PublicLoyaltyCardDto>.Ok(card));
        }
        catch (LoyaltyDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<PublicLoyaltyCardDto>.Fail(ex.ErrorCode, "LOYALTY", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching public loyalty card");
            return StatusCode(500, ApiResponse<PublicLoyaltyCardDto>.Fail("ERR_PUBLIC_CARD_LOAD_FAILED", "LOYALTY"));
        }
    }

    [HttpPost("{token}/redeem/{rewardId:guid}")]
    public async Task<ActionResult<ApiResponse<PublicLoyaltyVoucherDto>>> RedeemReward(
        [FromRoute] string token,
        [FromRoute] Guid rewardId,
        CancellationToken ct)
    {
        try
        {
            var voucher = await _rewardsService.RedeemPublicRewardAsync(token, rewardId, ct);
            return Ok(ApiResponse<PublicLoyaltyVoucherDto>.Ok(voucher));
        }
        catch (LoyaltyDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<PublicLoyaltyVoucherDto>.Fail(ex.ErrorCode, "LOYALTY", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error redeeming loyalty reward {RewardId}", rewardId);
            return StatusCode(500, ApiResponse<PublicLoyaltyVoucherDto>.Fail("ERR_REWARD_REDEEM_FAILED", "LOYALTY"));
        }
    }

    [HttpPost("{token}/vouchers/{voucherId:guid}/cancel")]
    public async Task<ActionResult<ApiResponse<PublicLoyaltyCardDto>>> CancelVoucher(
        [FromRoute] string token,
        [FromRoute] Guid voucherId,
        CancellationToken ct)
    {
        try
        {
            var updatedCard = await _rewardsService.CancelPublicVoucherAsync(token, voucherId, ct);
            return Ok(ApiResponse<PublicLoyaltyCardDto>.Ok(updatedCard));
        }
        catch (LoyaltyDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<PublicLoyaltyCardDto>.Fail(ex.ErrorCode, "LOYALTY", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling voucher {VoucherId}", voucherId);
            return StatusCode(500, ApiResponse<PublicLoyaltyCardDto>.Fail("ERR_VOUCHER_CANCEL_FAILED", "LOYALTY"));
        }
    }
}
