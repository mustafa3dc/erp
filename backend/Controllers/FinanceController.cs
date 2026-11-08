using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

public class QuickExpenseRequest
{
    [Required(ErrorMessage = "المبلغ مطلوب")]
    [Range(0.01, double.MaxValue, ErrorMessage = "يجب أن يكون مبلغ المصروف أكبر من الصفر")]
    public decimal Amount { get; set; }

    public string Currency { get; set; } = "IQD";

    public string? CurrencyCode { get; set; }

    [Required(ErrorMessage = "تصنيف المصروف مطلوب")]
    public string ExpenseCategoryId { get; set; } = string.Empty;

    public string? ShiftId { get; set; }

    public string? Notes { get; set; }
}

public class QuickExpenseResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public Guid ExpenseId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "IQD";
    public string ExpenseCategoryId { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string? ShiftId { get; set; }
    public DateTime CreatedAt { get; set; }
}

[ApiController]
[Route("api/finance")]
public class FinanceController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<FinanceController> _logger;

    public FinanceController(AppDbContext context, ILogger<FinanceController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/finance/expenses/quick
    /// Registers an immediate petty/operational cash expense and deducts it from the expected cash drawer.
    /// </summary>
    [HttpPost("expenses/quick")]
    public async Task<ActionResult<QuickExpenseResponse>> QuickExpense([FromBody] QuickExpenseRequest request)
    {
        if (request.Amount <= 0)
        {
            return BadRequest(new 
            { 
                errorCode = "ERR_INVALID_EXPENSE_AMOUNT", 
                message = "يجب أن يكون مبلغ المصروف أكبر من الصفر." 
            });
        }

        var categoryName = request.ExpenseCategoryId switch
        {
            "HOSPITALITY" => "نثريات وضيافة",
            "TRANSPORT" => "أجور نقل وتوصيل",
            "MAINTENANCE" => "صيانة ولوازم تشغيلية",
            "ADVANCES" => "سلف ومسحوبات",
            _ => "أخرى"
        };

        var resolvedCurrency = !string.IsNullOrWhiteSpace(request.CurrencyCode)
            ? request.CurrencyCode.Trim().ToUpper()
            : (!string.IsNullOrWhiteSpace(request.Currency) ? request.Currency.Trim().ToUpper() : "IQD");

        var expense = new CashExpense
        {
            Amount = request.Amount,
            Currency = resolvedCurrency,
            ExpenseCategoryId = request.ExpenseCategoryId,
            CategoryName = categoryName,
            ShiftId = request.ShiftId,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow
        };

        // Deduct from primary CashBox if configured
        var cashBox = await _context.CashBoxes.FirstOrDefaultAsync(cb => cb.IsActive);
        if (cashBox != null)
        {
            cashBox.CurrentBalance -= request.Amount;
            cashBox.UpdatedAt = DateTime.UtcNow;
            expense.CashBoxId = cashBox.Id;
        }

        _context.CashExpenses.Add(expense);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Quick expense registered: {Amount} {Currency} ({Category}) for Shift: {ShiftId}", 
            request.Amount, request.Currency, categoryName, request.ShiftId);

        return Ok(new QuickExpenseResponse
        {
            Success = true,
            Message = "تم تأكيد وقيد المصروف وخصمه من نقدية الدرج بنجاح.",
            ExpenseId = expense.Id,
            Amount = expense.Amount,
            Currency = expense.Currency,
            ExpenseCategoryId = expense.ExpenseCategoryId,
            CategoryName = categoryName,
            ShiftId = expense.ShiftId,
            CreatedAt = expense.CreatedAt
        });
    }

    /// <summary>
    /// GET /api/finance/expenses/categories
    /// Standard expense categories.
    /// </summary>
    [HttpGet("expenses/categories")]
    public ActionResult GetExpenseCategories()
    {
        var categories = new[]
        {
            new { id = "HOSPITALITY", nameAr = "نثريات وضيافة", nameEn = "Hospitality & Incidentals" },
            new { id = "TRANSPORT", nameAr = "أجور نقل وتوصيل", nameEn = "Transport & Delivery" },
            new { id = "MAINTENANCE", nameAr = "صيانة ولوازم تشغيلية", nameEn = "Maintenance & Supplies" },
            new { id = "ADVANCES", nameAr = "سلف ومسحوبات", nameEn = "Advances & Withdrawals" },
            new { id = "OTHER", nameAr = "أخرى", nameEn = "Other" }
        };

        return Ok(categories);
    }
}

