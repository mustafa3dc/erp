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

    /// <summary>
    /// GET /api/finance/treasury-accounts
    /// Lists active Treasury Safes and Bank Accounts for direct routing on Standard Sales Invoices.
    /// </summary>
    [HttpGet("treasury-accounts")]
    public async Task<ActionResult<IEnumerable<object>>> GetTreasuryAccounts()
    {
        var boxes = await _context.CashBoxes
            .AsNoTracking()
            .Where(cb => cb.IsActive)
            .OrderBy(cb => cb.Code)
            .Select(cb => new
            {
                cb.Id,
                cb.Code,
                cb.Name,
                cb.Currency,
                cb.CurrentBalance
            })
            .ToListAsync();

        return Ok(boxes);
    }

    /// <summary>
    /// GET /api/finance/kpis
    /// Computes true financial KPIs factoring Operational Expenses into Net Profit.
    /// Net Profit = Gross Profit (Total Sales Revenue - COGS) - Operational Expenses.
    /// </summary>
    [HttpGet("kpis")]
    public async Task<ActionResult<ApiResponse<object>>> GetFinancialKpis([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
    {
        var start = fromDate?.ToUniversalTime() ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = toDate?.ToUniversalTime() ?? DateTime.UtcNow;

        // 1. Sales Revenue
        var invoices = await _context.SalesInvoices
            .Include(i => i.Items)
                .ThenInclude(it => it.Product)
                .ThenInclude(p => p!.BundleComponents)
                .ThenInclude(bc => bc.ComponentProduct)
            .Where(i => i.CreatedAt >= start && i.CreatedAt <= end && i.PaymentStatus == "PAID")
            .ToListAsync();

        var totalRevenue = invoices.Sum(i => i.TotalAmount);
        
        // 2. Cost of Goods Sold (COGS) - bundles sum their component costs dynamically
        decimal totalCogs = 0;
        foreach (var inv in invoices)
        {
            foreach (var item in inv.Items)
            {
                decimal unitCost;
                if (item.Product != null && item.Product.IsBundle && item.Product.BundleComponents.Count > 0)
                {
                    unitCost = item.Product.BundleComponents.Sum(bc => (bc.ComponentProduct?.CostPrice ?? 0m) * bc.Quantity);
                }
                else
                {
                    unitCost = item.Product?.CostPrice ?? 0m;
                }
                totalCogs += unitCost * item.Quantity;
            }
        }

        // 3. Gross Profit
        var grossProfit = totalRevenue - totalCogs;

        // 4. Operational Expenses (Vouchers Approved + Quick Cash Expenses)
        var approvedVouchersAmount = await _context.ExpenseVouchers
            .Where(ev => ev.Status == "APPROVED" && ev.VoucherDate >= start && ev.VoucherDate <= end)
            .SumAsync(ev => ev.BaseCurrencyAmount);

        var quickExpensesAmount = await _context.CashExpenses
            .Where(ce => ce.CreatedAt >= start && ce.CreatedAt <= end)
            .SumAsync(ce => ce.Amount);

        var totalOperationalExpenses = approvedVouchersAmount + quickExpensesAmount;

        // 5. True Net Profit
        var netProfit = grossProfit - totalOperationalExpenses;
        var profitMargin = totalRevenue > 0 ? Math.Round((netProfit / totalRevenue) * 100.0m, 2) : 0.0m;

        // 6. Treasury Safes & Bank Balances
        var totalTreasuryLiquidity = await _context.CashBoxes
            .Where(cb => cb.IsActive)
            .SumAsync(cb => cb.CurrentBalance);

        var kpiResult = new
        {
            totalRevenue,
            totalCogs,
            grossProfit,
            totalOperationalExpenses,
            approvedVouchersAmount,
            quickExpensesAmount,
            netProfit,
            profitMargin,
            totalTreasuryLiquidity,
            periodStart = start,
            periodEnd = end
        };

        return Ok(ApiResponse<object>.Ok(kpiResult));
    }
}

