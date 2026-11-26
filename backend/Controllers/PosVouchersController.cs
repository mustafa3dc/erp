using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/pos/vouchers")]
[Route("api/v1/pos/vouchers")]
public class PosVouchersController : ControllerBase
{
    private readonly ILoyaltyRewardsService _rewardsService;
    private readonly ILogger<PosVouchersController> _logger;

    public PosVouchersController(
        ILoyaltyRewardsService rewardsService,
        ILogger<PosVouchersController> logger)
    {
        _rewardsService = rewardsService;
        _logger = logger;
    }

    private string CurrentActorName =>
        User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("username")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "Cashier";

    [HttpGet("{code}")]
    public async Task<ActionResult<ApiResponse<PosVoucherLookupDto>>> LookupVoucher(
        [FromRoute] string code,
        CancellationToken ct)
    {
        try
        {
            var voucher = await _rewardsService.GetPosVoucherAsync(code, ct);
            return Ok(ApiResponse<PosVoucherLookupDto>.Ok(voucher));
        }
        catch (LoyaltyDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<PosVoucherLookupDto>.Fail(ex.ErrorCode, "LOYALTY", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error looking up POS voucher {Code}", code);
            return StatusCode(500, ApiResponse<PosVoucherLookupDto>.Fail("ERR_VOUCHER_LOOKUP_FAILED", "LOYALTY"));
        }
    }

    [HttpPost("{code}/claim")]
    public async Task<ActionResult<ApiResponse<PosVoucherLookupDto>>> ClaimVoucher(
        [FromRoute] string code,
        [FromBody] ClaimPosVoucherRequestDto? request,
        CancellationToken ct)
    {
        try
        {
            var claimed = await _rewardsService.ClaimPosVoucherAsync(
                code,
                request ?? new ClaimPosVoucherRequestDto(),
                CurrentActorName,
                ct);
            return Ok(ApiResponse<PosVoucherLookupDto>.Ok(claimed));
        }
        catch (LoyaltyDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<PosVoucherLookupDto>.Fail(ex.ErrorCode, "LOYALTY", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error claiming POS voucher {Code}", code);
            return StatusCode(500, ApiResponse<PosVoucherLookupDto>.Fail("ERR_VOUCHER_CLAIM_FAILED", "LOYALTY"));
        }
    }
}
