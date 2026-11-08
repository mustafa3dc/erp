using System;
using System.Collections.Generic;

namespace ERP.Warehouse.Api.Models;

public record EmployeeStatementDto
{
    public Guid EmployeeId { get; init; }
    public string EmployeeName { get; init; } = string.Empty;
    public DateTime FromDate { get; init; }
    public DateTime ToDate { get; init; }
    public decimal OpeningBalance { get; init; }      // الرصيد ما قبل فترة الكشف
    public decimal TotalCredit { get; init; }          // إجمالي المستحقات (له)
    public decimal TotalDebit { get; init; }           // إجمالي المسحوبات (عليه)
    public decimal ClosingBalance { get; init; }         // صافي الرصيد الحالي
    public List<StatementLineItemDto> Items { get; init; } = new();
}

public record StatementLineItemDto
{
    public Guid TransactionId { get; init; }
    public DateTime TransactionDate { get; init; }
    public string ReferenceNumber { get; init; } = string.Empty; // رقم السند / الفاتورة
    public string TransactionType { get; init; } = string.Empty; // سلفة، عمولة، راتب، خصم
    public string Description { get; init; } = string.Empty;
    public decimal Debit { get; init; }                // مدين (عليه)
    public decimal Credit { get; init; }               // دائن (له)
    public decimal RunningBalance { get; init; }       // الرصيد التراكمي بعد الحركة
}

public record CreateEmployeeTransactionDto
{
    public Guid EmployeeId { get; init; }
    public DateTime TransactionDate { get; init; } = DateTime.UtcNow;
    public string ReferenceNumber { get; init; } = string.Empty;
    public string TransactionType { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal Debit { get; init; } = 0;
    public decimal Credit { get; init; } = 0;
    public string Currency { get; init; } = "IQD";
}

