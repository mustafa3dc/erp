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
[Route("api/expenses/recurring")]
[Route("api/v1/expenses/recurring")]
public class RecurringExpensesController : ControllerBase
{
    private readonly IRecurringExpenseService _recurringService;

    public RecurringExpensesController(IRecurringExpenseService recurringService)
    {
        _recurringService = recurringService;
    }

    private string CurrentUserName =>
        User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("username")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "System";

    [HttpGet]
    [HasPermission(Permissions.Treasury.ExpensesView)]
    public async Task<ActionResult<ApiResponse<List<RecurringExpenseDto>>>> GetAll(CancellationToken ct)
    {
        var items = await _recurringService.GetAllAsync(ct);
        return Ok(ApiResponse<List<RecurringExpenseDto>>.Ok(items));
    }

    [HttpPost]
    [HasPermission(Permissions.Treasury.ExpensesCreate)]
    public async Task<ActionResult<ApiResponse<RecurringExpenseDto>>> Create(
        [FromBody] UpsertRecurringExpenseRequest request,
        CancellationToken ct)
    {
        var result = await _recurringService.CreateAsync(request, ct);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Treasury.ExpensesEdit)]
    public async Task<ActionResult<ApiResponse<RecurringExpenseDto>>> Update(
        Guid id,
        [FromBody] UpsertRecurringExpenseRequest request,
        CancellationToken ct)
    {
        var result = await _recurringService.UpdateAsync(id, request, ct);
        if (!result.Success && result.ErrorCode == "ERR_RECURRING_NOT_FOUND")
        {
            return NotFound(result);
        }
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPatch("{id:guid}/toggle")]
    [HasPermission(Permissions.Treasury.ExpensesEdit)]
    public async Task<ActionResult<ApiResponse<RecurringExpenseDto>>> Toggle(Guid id, CancellationToken ct)
    {
        var result = await _recurringService.ToggleAsync(id, ct);
        if (!result.Success && result.ErrorCode == "ERR_RECURRING_NOT_FOUND")
        {
            return NotFound(result);
        }
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpDelete("{id:guid}")]
    [HasPermission(Permissions.Treasury.ExpensesDelete)]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        var result = await _recurringService.DeleteAsync(id, ct);
        if (!result.Success && result.ErrorCode == "ERR_RECURRING_NOT_FOUND")
        {
            return NotFound(result);
        }
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("{id:guid}/confirm")]
    [HasPermission(Permissions.Treasury.ExpensesCreate)]
    public async Task<ActionResult<ApiResponse<ConfirmRecurringExpenseResponseDto>>> Confirm(
        Guid id,
        [FromBody] ConfirmRecurringExpenseRequest? request,
        CancellationToken ct)
    {
        var result = await _recurringService.ConfirmAsync(id, request ?? new ConfirmRecurringExpenseRequest(), CurrentUserName, ct);
        if (!result.Success && result.ErrorCode == "ERR_RECURRING_NOT_FOUND")
        {
            return NotFound(result);
        }
        return result.Success ? Ok(result) : BadRequest(result);
    }
}
