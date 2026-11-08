using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Erp.Domain.Common;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace Erp.Application.Sales.Commands;

public sealed record CreateInstallmentContractCommand(
    Guid InvoiceId,
    string InvoiceNumber,
    Guid CustomerId,
    string CustomerName,
    string CustomerPhone,
    string GuarantorName,
    string GuarantorPhone,
    string? GuarantorNationalId,
    decimal TotalCashPrice,
    decimal TotalInstallmentPrice,
    decimal DownPayment,
    int InstallmentCount,
    DateTime? StartDate,
    Guid? CashierShiftId,
    string? Notes
) : Inventory.Commands.IRequest<Result<InstallmentContract>>;

public sealed class CreateInstallmentContractCommandHandler
    : Inventory.Commands.IRequestHandler<CreateInstallmentContractCommand, Result<InstallmentContract>>
{
    private readonly AppDbContext _context;

    public CreateInstallmentContractCommandHandler(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Result<InstallmentContract>> Handle(CreateInstallmentContractCommand cmd, CancellationToken ct)
    {
        if (cmd.InstallmentCount <= 0)
        {
            return Result<InstallmentContract>.Failure("ERR_INVALID_INSTALLMENT_COUNT", "INSTALLMENT", new[]
            {
                new ErrorDetail("InstallmentCount", "عدد الأقساط يجب أن يكون أكبر من الصفر")
            });
        }

        if (string.IsNullOrWhiteSpace(cmd.GuarantorName) || string.IsNullOrWhiteSpace(cmd.GuarantorPhone))
        {
            return Result<InstallmentContract>.Failure("ERR_GUARANTOR_REQUIRED", "INSTALLMENT", new[]
            {
                new ErrorDetail("Guarantor", "اسم الكفيل ورقم هاتفه مطلوبان إلزامياً لإتمام عقد البيع بالتقسيط")
            });
        }

        if (cmd.TotalInstallmentPrice <= 0)
        {
            return Result<InstallmentContract>.Failure("ERR_INVALID_TOTAL_PRICE", "INSTALLMENT", new[]
            {
                new ErrorDetail("TotalInstallmentPrice", "المبلغ الإجمالي للتقسيط غير صالح")
            });
        }

        if (cmd.DownPayment >= cmd.TotalInstallmentPrice)
        {
            return Result<InstallmentContract>.Failure("ERR_DOWN_PAYMENT_EXCEEDS_TOTAL", "INSTALLMENT", new[]
            {
                new ErrorDetail("DownPayment", "الدفعة المقدمة لا يمكن أن تساوي أو تتجاوز كامل مبلغ التقسيط")
            });
        }

        using var transaction = await _context.Database.BeginTransactionAsync(ct);
        try
        {
            var remainingAmount = cmd.TotalInstallmentPrice - cmd.DownPayment;
            var monthlyAmount = Math.Round(remainingAmount / cmd.InstallmentCount, 2);
            var contractNumber = $"INS-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
            var startDate = cmd.StartDate ?? DateTime.UtcNow;

            var contract = new InstallmentContract
            {
                ContractNumber = contractNumber,
                InvoiceId = cmd.InvoiceId,
                InvoiceNumber = cmd.InvoiceNumber,
                CustomerId = cmd.CustomerId,
                CustomerName = cmd.CustomerName,
                CustomerPhone = cmd.CustomerPhone,
                GuarantorName = cmd.GuarantorName,
                GuarantorPhone = cmd.GuarantorPhone,
                GuarantorNationalId = cmd.GuarantorNationalId,
                TotalCashPrice = cmd.TotalCashPrice,
                TotalInstallmentPrice = cmd.TotalInstallmentPrice,
                DownPayment = cmd.DownPayment,
                RemainingAmount = remainingAmount,
                InstallmentCount = cmd.InstallmentCount,
                MonthlyAmount = monthlyAmount,
                StartDate = startDate,
                Status = InstallmentContractStatus.Active,
                Notes = cmd.Notes,
                CreatedAt = DateTime.UtcNow,
                Schedules = new List<InstallmentScheduleItem>()
            };

            // Build schedule items (consecutive months)
            decimal runningSum = 0;
            for (int i = 1; i <= cmd.InstallmentCount; i++)
            {
                // Ensure precision balance on the last installment
                decimal currentItemAmount = (i == cmd.InstallmentCount)
                    ? (remainingAmount - runningSum)
                    : monthlyAmount;

                runningSum += currentItemAmount;

                var scheduleItem = new InstallmentScheduleItem
                {
                    ContractId = contract.Id,
                    InstallmentNumber = i,
                    DueDate = startDate.AddMonths(i),
                    Amount = currentItemAmount,
                    PaidAmount = 0.00m,
                    Status = InstallmentScheduleStatus.Pending,
                    CreatedAt = DateTime.UtcNow
                };

                contract.Schedules.Add(scheduleItem);
            }

            _context.InstallmentContracts.Add(contract);

            // If Down Payment > 0, log immediate down payment in Cash Box / Treasury if applicable
            if (cmd.DownPayment > 0)
            {
                var receiptVoucher = $"REC-DP-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
                // Register in cash transactions / cash box if available
                var activeCashBox = await _context.CashBoxes
                    .FirstOrDefaultAsync(cb => cb.IsActive, ct);

                if (activeCashBox != null)
                {
                    activeCashBox.Balance += cmd.DownPayment;
                    activeCashBox.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Result<InstallmentContract>.Success(contract);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(ct);
            return Result<InstallmentContract>.Failure("ERR_CREATE_CONTRACT_FAILED", "INSTALLMENT", new[]
            {
                new ErrorDetail("Execution", ex.Message)
            });
        }
    }
}

