using System.ComponentModel.DataAnnotations;

namespace ERP.Warehouse.Api.Models;

public class RecurringExpenseDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Frequency { get; set; } = RecurringExpenseFrequency.Monthly;
    public int? DayOfMonth { get; set; }
    public int? DayOfWeek { get; set; }
    public int? IntervalDays { get; set; }
    public DateTimeOffset NextDueDate { get; set; }
    public DateTimeOffset? LastExecutedDate { get; set; }
    public string ExecutionMode { get; set; } = RecurringExpenseExecutionMode.RemindAndConfirm;
    public bool IsActive { get; set; }
    public bool IsDue { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class UpsertRecurringExpenseRequest
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(150)]
    public string Category { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    [Required]
    [MaxLength(30)]
    public string Frequency { get; set; } = RecurringExpenseFrequency.Monthly;

    public int? DayOfMonth { get; set; }
    public int? DayOfWeek { get; set; }
    public int? IntervalDays { get; set; }
    public DateTimeOffset? NextDueDate { get; set; }

    [Required]
    [MaxLength(30)]
    public string ExecutionMode { get; set; } = RecurringExpenseExecutionMode.RemindAndConfirm;

    public bool IsActive { get; set; } = true;

    [MaxLength(1000)]
    public string? Notes { get; set; }
}

public class ConfirmRecurringExpenseRequest
{
    public decimal? ActualAmount { get; set; }
    public Guid? CashBoxId { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
}

public class ConfirmRecurringExpenseResponseDto
{
    public RecurringExpenseDto Rule { get; set; } = new();
    public ExpenseVoucherDto ExpenseVoucher { get; set; } = null!;
}
