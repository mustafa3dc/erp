namespace ERP.Warehouse.Api.Models;

public class UpsertPartnerRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public decimal CapitalAmount { get; set; } = 0m;
    public decimal ProfitSharePercent { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
}

public class RecordPartnerTransactionRequestDto
{
    public string TransactionType { get; set; } = PartnerTransactionTypes.Withdrawal;
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
    public string? ShiftId { get; set; }
    public bool DeductFromTreasury { get; set; } = true;
}

public class PartnerItemSummaryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public decimal CapitalAmount { get; set; }
    public decimal ProfitSharePercent { get; set; }
    public bool IsActive { get; set; }
    public string? Notes { get; set; }
    public decimal EarnedProfit { get; set; }
    public decimal TotalWithdrawals { get; set; }
    public decimal NetPayableBalance { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class PartnersSummaryResponseDto
{
    public string Period { get; set; } = "month";
    public DateTime? PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalCogs { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal TotalNetProfit { get; set; }
    public decimal AllocatedSharePercent { get; set; }
    public decimal UnallocatedSharePercent { get; set; }
    public List<PartnerItemSummaryDto> Partners { get; set; } = new();
}

public class PartnerTransactionDto
{
    public Guid Id { get; set; }
    public Guid PartnerId { get; set; }
    public string PartnerName { get; set; } = string.Empty;
    public string TransactionType { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
    public Guid? ShiftId { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class PaginatedPartnerTransactionsDto
{
    public List<PartnerTransactionDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class DashboardSummaryDto
{
    public string Period { get; set; } = "today";
    public decimal TotalRevenue { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal NetProfit { get; set; }
    public int InvoicesCount { get; set; }
    public PartnersSummaryResponseDto? PartnersSummary { get; set; }
    public int DueRecurringExpensesCount { get; set; }
    public List<RecurringExpenseDto> DueRecurringExpenses { get; set; } = new();
}
