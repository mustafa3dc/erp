using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;
using Erp.Application.Sales.Commands;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/installments")]
[Route("api/v1/installments")]
public class InstallmentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<InstallmentsController> _logger;

    public InstallmentsController(AppDbContext context, ILogger<InstallmentsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/installments/stats
    /// Real-time KPI statistics for installments dashboard.
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<InstallmentKpiStatsDto>> GetStats()
    {
        try
        {
            var now = DateTime.UtcNow;
            var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var endOfMonth = startOfMonth.AddMonths(1).AddTicks(-1);

            var contracts = await _context.InstallmentContracts
                .Include(c => c.Schedules)
                .AsNoTracking()
                .ToListAsync();

            var allSchedules = contracts.SelectMany(c => c.Schedules).ToList();

            var dueThisMonth = allSchedules
                .Where(s => s.DueDate >= startOfMonth && s.DueDate <= endOfMonth && s.Status != InstallmentScheduleStatus.Paid)
                .ToList();

            var overdue = allSchedules
                .Where(s => s.DueDate < now && s.Status != InstallmentScheduleStatus.Paid)
                .ToList();

            var totalCollected = allSchedules.Sum(s => s.PaidAmount) + contracts.Sum(c => c.DownPayment);
            var totalRemaining = contracts.Where(c => c.Status == InstallmentContractStatus.Active).Sum(c => c.RemainingAmount);

            var stats = new InstallmentKpiStatsDto
            {
                ActiveContractsCount = contracts.Count(c => c.Status == InstallmentContractStatus.Active),
                DueThisMonthAmount = dueThisMonth.Sum(s => s.Amount - s.PaidAmount),
                DueThisMonthCount = dueThisMonth.Count,
                OverdueAmount = overdue.Sum(s => s.Amount - s.PaidAmount),
                OverdueCount = overdue.Count,
                TotalCollectedAmount = totalCollected,
                TotalRemainingAmount = totalRemaining
            };

            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve installment stats");
            return StatusCode(500, new { errorCode = "ERR_FETCH_INSTALLMENT_STATS", message = "فشل جلب إحصائيات الأقساط" });
        }
    }

    /// <summary>
    /// GET /api/installments/contracts
    /// Lists installment contracts with optional status filter and search.
    /// Also updates overdue status for past-due pending items.
    /// </summary>
    [HttpGet("contracts")]
    public async Task<ActionResult<IEnumerable<InstallmentContract>>> GetContracts(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int limit = 100)
    {
        try
        {
            var query = _context.InstallmentContracts
                .Include(c => c.Schedules)
                .OrderByDescending(c => c.CreatedAt)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(c => 
                    c.ContractNumber.ToLower().Contains(s) ||
                    c.InvoiceNumber.ToLower().Contains(s) ||
                    c.CustomerName.ToLower().Contains(s) ||
                    c.CustomerPhone.Contains(s) ||
                    c.GuarantorName.ToLower().Contains(s) ||
                    c.GuarantorPhone.Contains(s));
            }

            var contracts = await query.Take(limit).ToListAsync();
            var now = DateTime.UtcNow;

            // Mark overdue items in memory and persist if needed
            bool hasStatusChanges = false;
            foreach (var contract in contracts)
            {
                bool hasOverdueSchedule = false;
                foreach (var schedule in contract.Schedules)
                {
                    if (schedule.DueDate < now && schedule.Status == InstallmentScheduleStatus.Pending)
                    {
                        schedule.Status = InstallmentScheduleStatus.Overdue;
                        hasStatusChanges = true;
                    }
                    if (schedule.Status == InstallmentScheduleStatus.Overdue)
                    {
                        hasOverdueSchedule = true;
                    }
                }

                if (hasOverdueSchedule && contract.Status == InstallmentContractStatus.Active)
                {
                    // Optional defaulted / overdue flag
                }
            }

            if (hasStatusChanges)
            {
                await _context.SaveChangesAsync();
            }

            // Apply status filter
            if (!string.IsNullOrWhiteSpace(status) && status.ToUpperInvariant() != "ALL")
            {
                var upperStatus = status.ToUpperInvariant();
                if (upperStatus == "ACTIVE")
                {
                    contracts = contracts.Where(c => c.Status == InstallmentContractStatus.Active).ToList();
                }
                else if (upperStatus == "COMPLETED")
                {
                    contracts = contracts.Where(c => c.Status == InstallmentContractStatus.Completed).ToList();
                }
                else if (upperStatus == "OVERDUE")
                {
                    contracts = contracts.Where(c => c.Schedules.Any(s => s.Status == InstallmentScheduleStatus.Overdue)).ToList();
                }
            }

            return Ok(contracts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve installment contracts");
            return StatusCode(500, new { errorCode = "ERR_FETCH_CONTRACTS", message = "فشل تحميل عقود الأقساط" });
        }
    }

    /// <summary>
    /// GET /api/installments/contracts/{id}
    /// Returns single contract with its full ordered installment schedule.
    /// </summary>
    [HttpGet("contracts/{id:guid}")]
    public async Task<ActionResult<InstallmentContract>> GetContractById([FromRoute] Guid id)
    {
        try
        {
            var contract = await _context.InstallmentContracts
                .Include(c => c.Schedules.OrderBy(s => s.InstallmentNumber))
                .FirstOrDefaultAsync(c => c.Id == id);

            if (contract == null)
            {
                return NotFound(new { errorCode = "ERR_CONTRACT_NOT_FOUND", message = "عقد التقسيط المطلوب غير موجود" });
            }

            return Ok(contract);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve contract by id {Id}", id);
            return StatusCode(500, new { errorCode = "ERR_FETCH_CONTRACT", message = "فشل تحميل بيانات العقد" });
        }
    }

    /// <summary>
    /// POST /api/installments/contracts
    /// Creates a new installment contract with auto-calculated schedules.
    /// </summary>
    [HttpPost("contracts")]
    public async Task<ActionResult<InstallmentContract>> CreateContract(
        [FromBody] CreateInstallmentContractDto dto)
    {
        try
        {
            var handler = new CreateInstallmentContractCommandHandler(_context);
            var cmd = new CreateInstallmentContractCommand(
                dto.InvoiceId,
                dto.InvoiceNumber,
                dto.CustomerId,
                dto.CustomerName,
                dto.CustomerPhone,
                dto.GuarantorName,
                dto.GuarantorPhone,
                dto.GuarantorNationalId,
                dto.TotalCashPrice,
                dto.TotalInstallmentPrice,
                dto.DownPayment,
                dto.InstallmentCount,
                dto.StartDate,
                dto.CashierShiftId,
                dto.Notes
            );

            var result = await handler.Handle(cmd, HttpContext.RequestAborted);
            if (!result.IsSuccess)
            {
                return BadRequest(new
                {
                    errorCode = result.ErrorCode,
                    message = result.Errors?.FirstOrDefault()?.ErrorMessage ?? "فشل إنشاء عقد التقسيط"
                });
            }

            return CreatedAtAction(nameof(GetContractById), new { id = result.Value!.Id }, result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create installment contract");
            return StatusCode(500, new { errorCode = "ERR_CREATE_CONTRACT", message = "حدث خطأ غير متوقع أثناء إنشاء عقد التقسيط" });
        }
    }

    /// <summary>
    /// POST /api/installments/pay
    /// Processes payment for an installment schedule item and generates a receipt voucher.
    /// </summary>
    [HttpPost("pay")]
    public async Task<ActionResult<InstallmentScheduleItem>> PayInstallment(
        [FromBody] PayInstallmentItemDto dto)
    {
        try
        {
            var handler = new PayInstallmentCommandHandler(_context);
            var cmd = new PayInstallmentCommand(
                dto.ScheduleItemId,
                dto.PaidAmount,
                dto.CashierShiftId,
                dto.PaymentMethod,
                dto.Notes
            );

            var result = await handler.Handle(cmd, HttpContext.RequestAborted);
            if (!result.IsSuccess)
            {
                return BadRequest(new
                {
                    errorCode = result.ErrorCode,
                    message = result.Errors?.FirstOrDefault()?.ErrorMessage ?? "فشل سداد القسط"
                });
            }

            return Ok(result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to pay installment schedule item");
            return StatusCode(500, new { errorCode = "ERR_PAY_INSTALLMENT", message = "حدث خطأ غير متوقع أثناء معالجة سداد القسط" });
        }
    }
}

