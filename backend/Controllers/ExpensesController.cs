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
[Route("api/[controller]")]
public class ExpensesController : ControllerBase
{
    private readonly IExpenseService _expenseService;
    private readonly ILogger<ExpensesController> _logger;

    public ExpensesController(IExpenseService expenseService, ILogger<ExpensesController> logger)
    {
        _expenseService = expenseService;
        _logger = logger;
    }

    private string CurrentUserName =>
        User.FindFirst(ClaimTypes.Name)?.Value 
        ?? User.FindFirst("username")?.Value 
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
        ?? "System";

    // =========================================================================
    // Expense Categories
    // =========================================================================

    [HttpGet("categories")]
    [HasPermission(Permissions.Treasury.ExpensesView)]
    public async Task<ActionResult<ApiResponse<List<ExpenseCategoryDto>>>> GetCategories()
    {
        var categories = await _expenseService.GetCategoriesAsync();
        return Ok(ApiResponse<List<ExpenseCategoryDto>>.Ok(categories));
    }

    [HttpPost("categories")]
    [HasPermission(Permissions.Treasury.ExpensesCreate)]
    public async Task<ActionResult<ApiResponse<ExpenseCategoryDto>>> CreateCategory([FromBody] CreateExpenseCategoryRequest request)
    {
        var result = await _expenseService.CreateCategoryAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPut("categories/{id:guid}")]
    [HasPermission(Permissions.Treasury.ExpensesEdit)]
    public async Task<ActionResult<ApiResponse<ExpenseCategoryDto>>> UpdateCategory(Guid id, [FromBody] UpdateExpenseCategoryRequest request)
    {
        var result = await _expenseService.UpdateCategoryAsync(id, request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpDelete("categories/{id:guid}")]
    [HasPermission(Permissions.Treasury.ExpensesDelete)]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteCategory(Guid id)
    {
        var result = await _expenseService.DeleteCategoryAsync(id);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    // =========================================================================
    // Expense Vouchers
    // =========================================================================

    [HttpGet("vouchers")]
    [HasPermission(Permissions.Treasury.ExpensesView)]
    public async Task<ActionResult<ApiResponse<List<ExpenseVoucherDto>>>> GetVouchers(
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] Guid? categoryId,
        [FromQuery] string? status)
    {
        var vouchers = await _expenseService.GetVouchersAsync(fromDate, toDate, categoryId, status);
        return Ok(ApiResponse<List<ExpenseVoucherDto>>.Ok(vouchers));
    }

    [HttpGet("vouchers/{id:guid}")]
    [HasPermission(Permissions.Treasury.ExpensesView)]
    public async Task<ActionResult<ApiResponse<ExpenseVoucherDto>>> GetVoucherById(Guid id)
    {
        var voucher = await _expenseService.GetVoucherByIdAsync(id);
        if (voucher == null)
        {
            return NotFound(ApiResponse<ExpenseVoucherDto>.Fail("ERR_VOUCHER_NOT_FOUND", "EXPENSES"));
        }
        return Ok(ApiResponse<ExpenseVoucherDto>.Ok(voucher));
    }

    [HttpPost("vouchers")]
    [HasPermission(Permissions.Treasury.ExpensesCreate)]
    public async Task<ActionResult<ApiResponse<ExpenseVoucherDto>>> CreateVoucher([FromBody] CreateExpenseVoucherRequest request)
    {
        var result = await _expenseService.CreateVoucherAsync(request, CurrentUserName);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return CreatedAtAction(nameof(GetVoucherById), new { id = result.Data!.Id }, result);
    }

    [HttpPut("vouchers/{id:guid}")]
    [HasPermission(Permissions.Treasury.ExpensesEdit)]
    public async Task<ActionResult<ApiResponse<ExpenseVoucherDto>>> UpdateVoucher(Guid id, [FromBody] UpdateExpenseVoucherRequest request)
    {
        var result = await _expenseService.UpdateVoucherAsync(id, request, CurrentUserName);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("vouchers/{id:guid}/approve")]
    [HasPermission(Permissions.Treasury.ExpensesApprove)]
    public async Task<ActionResult<ApiResponse<ExpenseVoucherDto>>> ApproveVoucher(Guid id, [FromBody] ApproveExpenseVoucherRequest request)
    {
        var result = await _expenseService.ApproveVoucherAsync(id, request, CurrentUserName);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("vouchers/{id:guid}/reject")]
    [HasPermission(Permissions.Treasury.ExpensesApprove)]
    public async Task<ActionResult<ApiResponse<ExpenseVoucherDto>>> RejectVoucher(Guid id, [FromQuery] string? reason)
    {
        var result = await _expenseService.RejectVoucherAsync(id, CurrentUserName, reason);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("/api/expenses/{id:guid}/void")]
    [HttpPost("vouchers/{id:guid}/void")]
    public async Task<ActionResult<ApiResponse<ExpenseVoucherDto>>> VoidVoucher(
        Guid id,
        [FromBody] VoidExpenseVoucherRequest? request,
        [FromQuery] string? reason)
    {
        if (!IsOwnerOrAdmin())
        {
            return StatusCode(403, ApiResponse<ExpenseVoucherDto>.Fail("ERR_FORBIDDEN_ACTION", "EXPENSES"));
        }

        var actorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? CurrentUserName;
        var resolvedReason = !string.IsNullOrWhiteSpace(request?.Reason) ? request.Reason : reason;

        var result = await _expenseService.VoidVoucherAsync(id, actorId, resolvedReason);
        if (!result.Success && result.ErrorCode == "ERR_VOUCHER_NOT_FOUND")
        {
            return NotFound(result);
        }
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    private bool IsOwnerOrAdmin()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "PlatformSuperAdmin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "BranchManager", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Owner", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var perms = User.FindAll("Permission").Select(c => c.Value)
            .Concat(User.FindAll("permission").Select(c => c.Value))
            .Concat(User.FindAll("permissions").Select(c => c.Value));

        return perms.Any(p =>
            string.Equals(p, Permissions.System.UsersManage, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, "*", StringComparison.OrdinalIgnoreCase));
    }

    [HttpGet("summary")]
    [HasPermission(Permissions.Treasury.ExpensesView)]
    public async Task<ActionResult<ApiResponse<ExpensesSummaryDto>>> GetSummary(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var summary = await _expenseService.GetSummaryAsync(startDate, endDate);
        return Ok(ApiResponse<ExpensesSummaryDto>.Ok(summary));
    }
}
