using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Erp.Domain.Common;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace Erp.Application.Sales.Commands;

public sealed record PayInstallmentCommand(
    Guid ScheduleItemId,
    decimal PaidAmount,
    Guid? CashierShiftId,
    string PaymentMethod = "CASH",
    string? Notes = null
) : Inventory.Commands.IRequest<Result<InstallmentScheduleItem>>;

public sealed class PayInstallmentCommandHandler
    : Inventory.Commands.IRequestHandler<PayInstallmentCommand, Result<InstallmentScheduleItem>>
{
    private readonly AppDbContext _context;

    public PayInstallmentCommandHandler(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Result<InstallmentScheduleItem>> Handle(PayInstallmentCommand cmd, CancellationToken ct)
    {
        if (cmd.PaidAmount <= 0)
        {
            return Result<InstallmentScheduleItem>.Failure("ERR_INVALID_PAYMENT_AMOUNT", "INSTALLMENT", new[]
            {
                new ErrorDetail("PaidAmount", "مبلغ السداد يجب أن يكون أكبر من الصفر")
            });
        }

        using var transaction = await _context.Database.BeginTransactionAsync(ct);
        try
        {
            var item = await _context.InstallmentScheduleItems
                .Include(s => s.Contract)
                .ThenInclude(c => c!.Schedules)
                .FirstOrDefaultAsync(s => s.Id == cmd.ScheduleItemId, ct);

            if (item == null)
            {
                return Result<InstallmentScheduleItem>.Failure("ERR_SCHEDULE_ITEM_NOT_FOUND", "INSTALLMENT", new[]
                {
                    new ErrorDetail("ScheduleItemId", "قسط الاستحقاق المطلوب غير موجود في النظام")
                });
            }

            if (item.Status == InstallmentScheduleStatus.Paid)
            {
                return Result<InstallmentScheduleItem>.Failure("ERR_ALREADY_PAID", "INSTALLMENT", new[]
                {
                    new ErrorDetail("Status", "هذا القسط مسدد بالفعل بالكامل مسبقاً")
                });
            }

            var outstandingOnItem = item.Amount - item.PaidAmount;
            if (cmd.PaidAmount > outstandingOnItem)
            {
                return Result<InstallmentScheduleItem>.Failure("ERR_EXCEEDS_REMAINING_ON_ITEM", "INSTALLMENT", new[]
                {
                    new ErrorDetail("PaidAmount", $"المبلغ المدفوع ({cmd.PaidAmount}) يتجاوز المتبقي على هذا القسط ({outstandingOnItem})")
                });
            }

            item.PaidAmount += cmd.PaidAmount;
            item.CashierShiftId = cmd.CashierShiftId;
            item.PaymentMethod = cmd.PaymentMethod;
            item.Notes = cmd.Notes;
            item.ReceiptVoucherNumber = $"REC-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";

            if (item.PaidAmount >= item.Amount)
            {
                item.Status = InstallmentScheduleStatus.Paid;
                item.PaidDate = DateTime.UtcNow;
            }
            else
            {
                item.Status = InstallmentScheduleStatus.PartiallyPaid;
            }

            // Update parent contract remaining balance
            if (item.Contract != null)
            {
                item.Contract.RemainingAmount = Math.Max(0, item.Contract.RemainingAmount - cmd.PaidAmount);
                item.Contract.UpdatedAt = DateTime.UtcNow;

                // Check if ALL schedules in contract are completely paid
                bool allPaid = item.Contract.Schedules.All(s => s.Status == InstallmentScheduleStatus.Paid);
                if (allPaid)
                {
                    item.Contract.Status = InstallmentContractStatus.Completed;
                }
            }

            // Register Cash Flow into Active Cash Box
            var activeCashBox = await _context.CashBoxes
                .FirstOrDefaultAsync(cb => cb.IsActive, ct);

            if (activeCashBox != null && cmd.PaymentMethod.ToUpperInvariant() == "CASH")
            {
                activeCashBox.CurrentBalance += cmd.PaidAmount;
                activeCashBox.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Result<InstallmentScheduleItem>.Success(item);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(ct);
            return Result<InstallmentScheduleItem>.Failure("ERR_PAY_INSTALLMENT_FAILED", "INSTALLMENT", new[]
            {
                new ErrorDetail("Execution", ex.Message)
            });
        }
    }
}

