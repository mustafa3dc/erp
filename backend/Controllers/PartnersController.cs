using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[HasPermission(Permissions.Treasury.PartnersManage)]
[ApiController]
[Route("api/partners")]
[Route("api/v1/partners")]
public class PartnersController : ControllerBase
{
    private readonly IPartnersService _partnersService;
    private readonly ILogger<PartnersController> _logger;

    public PartnersController(IPartnersService partnersService, ILogger<PartnersController> logger)
    {
        _partnersService = partnersService;
        _logger = logger;
    }

    private string CurrentActorIdentifier =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? User.FindFirst("sub")?.Value
        ?? User.FindFirst("user_id")?.Value
        ?? User.FindFirst(ClaimTypes.Name)?.Value
        ?? "System";

    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<PartnersSummaryResponseDto>>> GetSummary(
        [FromQuery] string? period = "month",
        CancellationToken ct = default)
    {
        try
        {
            var summary = await _partnersService.GetSummaryAsync(period, ct);
            return Ok(ApiResponse<PartnersSummaryResponseDto>.Ok(summary));
        }
        catch (PartnerDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<PartnersSummaryResponseDto>.Fail(ex.ErrorCode, "PARTNERS", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error computing partners profit summary");
            return StatusCode(500, ApiResponse<PartnersSummaryResponseDto>.Fail("ERR_PARTNERS_SUMMARY_FAILED", "PARTNERS"));
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<PartnerItemSummaryDto>>> CreatePartner(
        [FromBody] UpsertPartnerRequestDto request,
        CancellationToken ct)
    {
        try
        {
            var created = await _partnersService.CreatePartnerAsync(request, ct);
            return Ok(ApiResponse<PartnerItemSummaryDto>.Ok(created));
        }
        catch (PartnerDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<PartnerItemSummaryDto>.Fail(ex.ErrorCode, "PARTNERS", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating partner");
            return StatusCode(500, ApiResponse<PartnerItemSummaryDto>.Fail("ERR_PARTNER_CREATE_FAILED", "PARTNERS"));
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<PartnerItemSummaryDto>>> UpdatePartner(
        [FromRoute] Guid id,
        [FromBody] UpsertPartnerRequestDto request,
        CancellationToken ct)
    {
        try
        {
            var updated = await _partnersService.UpdatePartnerAsync(id, request, ct);
            return Ok(ApiResponse<PartnerItemSummaryDto>.Ok(updated));
        }
        catch (PartnerDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<PartnerItemSummaryDto>.Fail(ex.ErrorCode, "PARTNERS", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating partner {PartnerId}", id);
            return StatusCode(500, ApiResponse<PartnerItemSummaryDto>.Fail("ERR_PARTNER_UPDATE_FAILED", "PARTNERS"));
        }
    }

    [HttpPost("{id:guid}/transactions")]
    public async Task<ActionResult<ApiResponse<PartnerTransactionDto>>> RecordTransaction(
        [FromRoute] Guid id,
        [FromBody] RecordPartnerTransactionRequestDto request,
        CancellationToken ct)
    {
        try
        {
            var tx = await _partnersService.RecordTransactionAsync(id, request, CurrentActorIdentifier, ct);
            return Ok(ApiResponse<PartnerTransactionDto>.Ok(tx));
        }
        catch (PartnerDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<PartnerTransactionDto>.Fail(ex.ErrorCode, "PARTNERS", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recording partner transaction for {PartnerId}", id);
            return StatusCode(500, ApiResponse<PartnerTransactionDto>.Fail("ERR_PARTNER_TRANSACTION_FAILED", "PARTNERS"));
        }
    }

    [HttpGet("{id:guid}/transactions")]
    public async Task<ActionResult<ApiResponse<PaginatedPartnerTransactionsDto>>> GetTransactions(
        [FromRoute] Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        try
        {
            var result = await _partnersService.GetPartnerTransactionsAsync(id, page, pageSize, ct);
            return Ok(ApiResponse<PaginatedPartnerTransactionsDto>.Ok(result));
        }
        catch (PartnerDomainException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<PaginatedPartnerTransactionsDto>.Fail(ex.ErrorCode, "PARTNERS", ex.Metadata));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching transactions for partner {PartnerId}", id);
            return StatusCode(500, ApiResponse<PaginatedPartnerTransactionsDto>.Fail("ERR_PARTNER_TRANSACTIONS_LOAD_FAILED", "PARTNERS"));
        }
    }
}
