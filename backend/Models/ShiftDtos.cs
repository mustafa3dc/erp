namespace ERP.Warehouse.Api.Models;

public class OpenShiftApiRequest
{
    public string CashierName { get; set; } = string.Empty;
    public string TerminalId { get; set; } = string.Empty;
    public decimal OpeningFloat { get; set; }
    public string? CurrencyCode { get; set; }
    public DateTime? OpenedAt { get; set; }
}

public class CloseShiftApiRequest
{
    public string ShiftId { get; set; } = string.Empty;
    public string CashierName { get; set; } = string.Empty;
    public string TerminalId { get; set; } = string.Empty;
    public decimal OpeningFloat { get; set; }
    public decimal CashSales { get; set; }
    public decimal CardSales { get; set; }
    public decimal? ZainCashSales { get; set; }
    public decimal? QiCardSales { get; set; }
    public decimal? PettyExpenses { get; set; }
    public decimal ActualCash { get; set; }
    public string? ZReportNumber { get; set; }
    public DateTime? OpenedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
}

public class ShiftInvoiceMovementDto
{
    public Guid Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string PaymentMethod { get; set; } = "CASH";
    public string PaymentStatus { get; set; } = "PAID";
    public string DispenseMode { get; set; } = "IN_STORE";
    public decimal TotalAmount { get; set; }
    public string CashierName { get; set; } = string.Empty;
    public int ItemsCount { get; set; }
}

public class ShiftCashExpenseMovementDto
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "IQD";
    public string? Notes { get; set; }
    public string? CreatedBy { get; set; }
}

public class ShiftBreakdownSummaryDto
{
    public string ShiftId { get; set; } = string.Empty;
    public decimal CashSales { get; set; }
    public decimal CardSales { get; set; }
    public decimal ZainCashSales { get; set; }
    public decimal QiCardSales { get; set; }
    public decimal PettyExpenses { get; set; }
    public int InvoicesCount { get; set; }
    public int ExpensesCount { get; set; }
    public List<ShiftInvoiceMovementDto> Invoices { get; set; } = new();
    public List<ShiftCashExpenseMovementDto> Expenses { get; set; } = new();
}

public class ShiftAuditRecordDto
{
    public string Id { get; set; } = string.Empty;
    public string ZReportNumber { get; set; } = string.Empty;
    public string CashierName { get; set; } = string.Empty;
    public string TerminalId { get; set; } = string.Empty;
    public DateTime OpenedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public decimal OpeningFloat { get; set; }
    public decimal CashSales { get; set; }
    public decimal CardSales { get; set; }
    public decimal ZainCashSales { get; set; }
    public decimal QiCardSales { get; set; }
    public decimal PettyExpenses { get; set; }
    public decimal ExpectedCash { get; set; }
    public decimal ActualCash { get; set; }
    public decimal Difference { get; set; }
    public string Status { get; set; } = "CLOSED";
}
