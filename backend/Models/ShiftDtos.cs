namespace ERP.Warehouse.Api.Models;

public class OpenShiftApiRequest
{
    public string CashierName { get; set; } = string.Empty;
    public string TerminalId { get; set; } = string.Empty;
    public decimal OpeningFloat { get; set; }
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
    public decimal ActualCash { get; set; }
    public string? ZReportNumber { get; set; }
    public DateTime? OpenedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
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
    public decimal ExpectedCash { get; set; }
    public decimal ActualCash { get; set; }
    public decimal Difference { get; set; }
    public string Status { get; set; } = "CLOSED";
}
