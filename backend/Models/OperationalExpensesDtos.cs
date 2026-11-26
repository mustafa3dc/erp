using System.ComponentModel.DataAnnotations;

namespace ERP.Warehouse.Api.Models;

public record ExpenseCategoryDto(
    Guid Id,
    string Code,
    string Name,
    decimal MonthlyBudgetCap,
    string? Description,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateExpenseCategoryRequest(
    [MaxLength(150)] string Name,
    decimal? MonthlyBudgetCap = null,
    string? Description = null
);

public record UpdateExpenseCategoryRequest(
    [MaxLength(150)] string Name,
    decimal? MonthlyBudgetCap = null,
    string? Description = null,
    bool IsActive = true
);

public record ExpenseVoucherDto(
    Guid Id,
    string VoucherNumber,
    DateTime VoucherDate,
    Guid? ExpenseCategoryId,
    string CategoryName,
    Guid? CashBoxId,
    string? CashBoxName,
    decimal Amount,
    string Currency,
    decimal ExchangeRate,
    decimal BaseCurrencyAmount,
    string PaymentMethod,
    string? BeneficiaryName,
    string Status,
    string? ApprovedBy,
    DateTime? ApprovedAt,
    string? Notes,
    string? ReceiptReference,
    string? CreatedBy,
    DateTime CreatedAt
);

public record CreateExpenseVoucherRequest(
    Guid? ExpenseCategoryId,
    Guid? CashBoxId,
    [Range(0.0001, double.MaxValue)] decimal Amount,
    string Currency = "IQD",
    decimal ExchangeRate = 1.0000m,
    string PaymentMethod = "CASH",
    string? BeneficiaryName = null,
    string? Notes = null,
    string? ReceiptReference = null,
    bool AutoApprove = false
);

public record UpdateExpenseVoucherRequest(
    Guid? ExpenseCategoryId,
    Guid? CashBoxId,
    [Range(0.0001, double.MaxValue)] decimal Amount,
    string Currency,
    decimal ExchangeRate,
    string PaymentMethod,
    string? BeneficiaryName,
    string? Notes,
    string? ReceiptReference
);

public record ApproveExpenseVoucherRequest(
    Guid? CashBoxId,
    string? Notes
);

public record ExpensesSummaryDto(
    decimal TotalOperationalExpenses,
    decimal ApprovedExpensesMonth,
    decimal PendingExpensesCount,
    List<CategoryExpenseSummaryDto> ByCategory
);

public record CategoryExpenseSummaryDto(
    string CategoryCode,
    string CategoryName,
    decimal TotalAmount,
    int VouchersCount
);
