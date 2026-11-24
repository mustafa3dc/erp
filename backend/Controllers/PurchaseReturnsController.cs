using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/purchases/returns")]
public class PurchaseReturnsController : ControllerBase
{
    private readonly IPurchaseReturnService _returnService;
    private readonly ILogger<PurchaseReturnsController> _logger;

    public PurchaseReturnsController(IPurchaseReturnService returnService, ILogger<PurchaseReturnsController> logger)
    {
        _returnService = returnService;
        _logger = logger;
    }

    private string CurrentUserName =>
        User.FindFirst(ClaimTypes.Name)?.Value 
        ?? User.FindFirst("username")?.Value 
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
        ?? "System";

    [HttpGet]
    [HasPermission(Permissions.Purchases.ReturnsView)]
    public async Task<ActionResult<ApiResponse<List<PurchaseReturnDto>>>> GetReturns(
        [FromQuery] Guid? supplierId,
        [FromQuery] string? status,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var returns = await _returnService.GetReturnsAsync(supplierId, status, fromDate, toDate);
        return Ok(ApiResponse<List<PurchaseReturnDto>>.Ok(returns));
    }

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.Purchases.ReturnsView)]
    public async Task<ActionResult<ApiResponse<PurchaseReturnDto>>> GetReturnById(Guid id)
    {
        var r = await _returnService.GetReturnByIdAsync(id);
        if (r == null)
        {
            return NotFound(ApiResponse<PurchaseReturnDto>.Fail("ERR_PURCHASE_RETURN_NOT_FOUND", "PURCHASES"));
        }
        return Ok(ApiResponse<PurchaseReturnDto>.Ok(r));
    }

    [HttpGet("/api/purchases/bills/{billId:guid}/returnable-items")]
    [HasPermission(Permissions.Purchases.ReturnsView)]
    public async Task<ActionResult<ApiResponse<List<ReturnableBillItemDto>>>> GetReturnableItems(Guid billId)
    {
        var items = await _returnService.GetReturnableItemsAsync(billId);
        return Ok(ApiResponse<List<ReturnableBillItemDto>>.Ok(items));
    }

    [HttpPost]
    [HasPermission(Permissions.Purchases.ReturnsCreate)]
    public async Task<ActionResult<ApiResponse<PurchaseReturnDto>>> CreateReturn([FromBody] CreatePurchaseReturnRequest request)
    {
        var result = await _returnService.CreateReturnAsync(request, CurrentUserName);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return CreatedAtAction(nameof(GetReturnById), new { id = result.Data!.Id }, result);
    }

    [HttpPost("{id:guid}/approve")]
    [HasPermission(Permissions.Purchases.ReturnsApprove)]
    public async Task<ActionResult<ApiResponse<PurchaseReturnDto>>> ApproveReturn(
        Guid id, 
        [FromBody] ApprovePurchaseReturnRequest request)
    {
        var result = await _returnService.ApproveReturnAsync(id, request, CurrentUserName);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }
}
