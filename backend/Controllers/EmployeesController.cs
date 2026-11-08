using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Domain.Entities;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/v1/employees")]
public class EmployeesController : ControllerBase
{
    private readonly AppDbContext _context;

    public EmployeesController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// GET /api/v1/employees/{employeeId}/statement
    /// Calculates employee statement of account with opening balance, running balance, and period filters.
    /// </summary>
    [HttpGet("{employeeId}/statement")]
    public async Task<ActionResult<EmployeeStatementDto>> GetStatement(
        [FromRoute] Guid employeeId,
        [FromQuery] string? filterType,
        [FromQuery] string? date,
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        CancellationToken ct)
    {
        // 1. Resolve employee name
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == employeeId, ct);
        var staff = await _context.StaffUsers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == employeeId, ct);
        var employeeName = user?.FullName ?? staff?.FullName ?? "موظف معتمد";

        // 2. Parse Date Range based on filterType
        DateTime parsedFrom;
        DateTime parsedTo;

        var now = DateTime.UtcNow;

        var type = (filterType ?? "monthly").ToLowerInvariant();
        switch (type)
        {
            case "daily":
                if (DateTime.TryParse(date, out var specificDate))
                {
                    parsedFrom = specificDate.Date;
                }
                else
                {
                    parsedFrom = DateTime.UtcNow.Date;
                }
                parsedTo = parsedFrom.AddDays(1).AddTicks(-1);
                break;

            case "custom":
                if (DateTime.TryParse(fromDate, out var customFrom))
                {
                    parsedFrom = customFrom.Date;
                }
                else
                {
                    parsedFrom = new DateTime(now.Year, now.Month, 1);
                }

                if (DateTime.TryParse(toDate, out var customTo))
                {
                    parsedTo = customTo.Date.AddDays(1).AddTicks(-1);
                }
                else
                {
                    parsedTo = parsedFrom.AddMonths(1).AddTicks(-1);
                }
                break;

            case "monthly":
            default:
                var y = year ?? now.Year;
                var m = month ?? now.Month;
                if (m < 1 || m > 12) m = now.Month;
                if (y < 2000 || y > 2100) y = now.Year;
                parsedFrom = new DateTime(y, m, 1, 0, 0, 0, DateTimeKind.Utc);
                parsedTo = parsedFrom.AddMonths(1).AddTicks(-1);
                break;
        }

        // 3. احتساب الرصيد الافتتاحي:
        // SELECT SUM(Credit - Debit) FROM EmployeeFinancialTransactions WHERE EmployeeId = @EmployeeId AND TransactionDate < @FromDate
        var openingBalance = await _context.EmployeeFinancialTransactions
            .Where(t => t.EmployeeId == employeeId && t.TransactionDate < parsedFrom)
            .SumAsync(t => (decimal?)(t.Credit - t.Debit), ct) ?? 0m;

        // 4. جلب الحركات ضمن الفترة المحددة مرتبة تصاعدياً:
        // ORDER BY TransactionDate ASC, CreatedAt ASC
        var transactions = await _context.EmployeeFinancialTransactions
            .Where(t => t.EmployeeId == employeeId && t.TransactionDate >= parsedFrom && t.TransactionDate <= parsedTo)
            .OrderBy(t => t.TransactionDate)
            .ThenBy(t => t.CreatedAt)
            .ToListAsync(ct);

        // 5. تطبيق خوارزمية الرصيد المتحرك (Running Balance) دورياً داخل اللوب:
        var runningBalance = openingBalance;
        var items = new List<StatementLineItemDto>();

        foreach (var item in transactions)
        {
            runningBalance += (item.Credit - item.Debit);
            items.Add(new StatementLineItemDto
            {
                TransactionId = item.Id,
                TransactionDate = item.TransactionDate,
                ReferenceNumber = item.ReferenceNumber,
                TransactionType = item.TransactionType,
                Description = item.Description,
                Debit = item.Debit,
                Credit = item.Credit,
                RunningBalance = runningBalance
            });
        }

        var totalCredit = transactions.Sum(t => t.Credit);
        var totalDebit = transactions.Sum(t => t.Debit);
        var closingBalance = runningBalance;

        return Ok(new EmployeeStatementDto
        {
            EmployeeId = employeeId,
            EmployeeName = employeeName,
            FromDate = parsedFrom,
            ToDate = parsedTo,
            OpeningBalance = openingBalance,
            TotalCredit = totalCredit,
            TotalDebit = totalDebit,
            ClosingBalance = closingBalance,
            Items = items
        });
    }

    /// <summary>
    /// POST /api/v1/employees/{employeeId}/transactions
    /// Records a new financial transaction (Debit or Credit) on an employee ledger.
    /// </summary>
    [HttpPost("{employeeId}/transactions")]
    public async Task<ActionResult<EmployeeFinancialTransaction>> CreateTransaction(
        [FromRoute] Guid employeeId,
        [FromBody] CreateEmployeeTransactionDto dto,
        CancellationToken ct)
    {
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == employeeId, ct);
        var staff = await _context.StaffUsers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == employeeId, ct);
        var employeeName = user?.FullName ?? staff?.FullName ?? "موظف معتمد";

        var currentTenantId = User.FindFirst("tenant_id")?.Value;
        Guid? tenantId = Guid.TryParse(currentTenantId, out var parsedTid) ? parsedTid : user?.TenantId ?? staff?.TenantId;

        var entity = new EmployeeFinancialTransaction
        {
            TenantId = tenantId,
            EmployeeId = employeeId,
            EmployeeName = employeeName,
            TransactionDate = dto.TransactionDate == default ? DateTime.UtcNow : dto.TransactionDate,
            ReferenceNumber = string.IsNullOrWhiteSpace(dto.ReferenceNumber) ? $"TX-{DateTime.UtcNow:yyyyMMddHHmmss}" : dto.ReferenceNumber.Trim(),
            TransactionType = dto.TransactionType,
            Description = dto.Description,
            Debit = dto.Debit,
            Credit = dto.Credit,
            Currency = dto.Currency ?? "IQD",
            CreatedBy = User.Identity?.Name ?? "Admin"
        };

        _context.EmployeeFinancialTransactions.Add(entity);
        await _context.SaveChangesAsync(ct);

        return Ok(entity);
    }
}

