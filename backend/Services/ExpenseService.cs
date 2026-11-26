using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface IExpenseService
{
    Task<List<ExpenseCategoryDto>> GetCategoriesAsync();
    Task<ApiResponse<ExpenseCategoryDto>> CreateCategoryAsync(CreateExpenseCategoryRequest request);
    Task<ApiResponse<ExpenseCategoryDto>> UpdateCategoryAsync(Guid id, UpdateExpenseCategoryRequest request);
    Task<ApiResponse<bool>> DeleteCategoryAsync(Guid id);

    Task<List<ExpenseVoucherDto>> GetVouchersAsync(DateTime? fromDate, DateTime? toDate, Guid? categoryId, string? status);
    Task<ExpenseVoucherDto?> GetVoucherByIdAsync(Guid id);
    Task<ApiResponse<ExpenseVoucherDto>> CreateVoucherAsync(CreateExpenseVoucherRequest request, string? createdBy);
    Task<ApiResponse<ExpenseVoucherDto>> UpdateVoucherAsync(Guid id, UpdateExpenseVoucherRequest request, string? updatedBy);
    Task<ApiResponse<ExpenseVoucherDto>> ApproveVoucherAsync(Guid id, ApproveExpenseVoucherRequest request, string? approvedBy);
    Task<ApiResponse<ExpenseVoucherDto>> RejectVoucherAsync(Guid id, string? rejectedBy, string? reason);
    Task<ExpensesSummaryDto> GetSummaryAsync(DateTime? startDate, DateTime? endDate);
}

public class ExpenseService : IExpenseService
{
    private readonly AppDbContext _context;
    private readonly ILogger<ExpenseService> _logger;

    public ExpenseService(AppDbContext context, ILogger<ExpenseService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<ExpenseCategoryDto>> GetCategoriesAsync()
    {
        return await _context.ExpenseCategories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new ExpenseCategoryDto(
                c.Id,
                c.Code,
                c.Name,
                c.Description,
                c.IsActive,
                c.CreatedAt,
                c.UpdatedAt
            ))
            .ToListAsync();
    }

    public async Task<ApiResponse<ExpenseCategoryDto>> CreateCategoryAsync(CreateExpenseCategoryRequest request)
    {
        var existing = await _context.ExpenseCategories
            .FirstOrDefaultAsync(c => c.Code.ToLower() == request.Code.Trim().ToLower());

        if (existing != null)
        {
            return ApiResponse<ExpenseCategoryDto>.Fail("ERR_CATEGORY_CODE_EXISTS", "EXPENSES");
        }

        var category = new ExpenseCategory
        {
            Code = request.Code.Trim().ToUpper(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.ExpenseCategories.Add(category);
        await _context.SaveChangesAsync();

        var dto = new ExpenseCategoryDto(
            category.Id,
            category.Code,
            category.Name,
            category.Description,
            category.IsActive,
            category.CreatedAt,
            category.UpdatedAt
        );

        return ApiResponse<ExpenseCategoryDto>.Ok(dto);
    }

    public async Task<ApiResponse<ExpenseCategoryDto>> UpdateCategoryAsync(Guid id, UpdateExpenseCategoryRequest request)
    {
        var category = await _context.ExpenseCategories.FindAsync(id);
        if (category == null)
        {
            return ApiResponse<ExpenseCategoryDto>.Fail("ERR_CATEGORY_NOT_FOUND", "EXPENSES");
        }

        category.Name = request.Name.Trim();
        category.Description = request.Description?.Trim();
        category.IsActive = request.IsActive;
        category.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var dto = new ExpenseCategoryDto(
            category.Id,
            category.Code,
            category.Name,
            category.Description,
            category.IsActive,
            category.CreatedAt,
            category.UpdatedAt
        );

        return ApiResponse<ExpenseCategoryDto>.Ok(dto);
    }

    public async Task<ApiResponse<bool>> DeleteCategoryAsync(Guid id)
    {
        var category = await _context.ExpenseCategories.FindAsync(id);
        if (category == null)
        {
            return ApiResponse<bool>.Fail("ERR_CATEGORY_NOT_FOUND", "EXPENSES");
        }

        var hasVouchers = await _context.ExpenseVouchers.AnyAsync(v => v.ExpenseCategoryId == id);
        if (hasVouchers)
        {
            category.IsActive = false;
            category.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return ApiResponse<bool>.Ok(true, new Dictionary<string, object> { ["deactivated"] = true });
        }

        _context.ExpenseCategories.Remove(category);
        await _context.SaveChangesAsync();
        return ApiResponse<bool>.Ok(true);
    }

    public async Task<List<ExpenseVoucherDto>> GetVouchersAsync(DateTime? fromDate, DateTime? toDate, Guid? categoryId, string? status)
    {
        var query = _context.ExpenseVouchers
            .Include(v => v.ExpenseCategory)
            .Include(v => v.CashBox)
            .AsNoTracking()
            .AsQueryable();

        if (fromDate.HasValue)
        {
            var f = fromDate.Value.ToUniversalTime();
            query = query.Where(v => v.VoucherDate >= f);
        }

        if (toDate.HasValue)
        {
            var t = toDate.Value.ToUniversalTime();
            query = query.Where(v => v.VoucherDate <= t);
        }

        if (categoryId.HasValue)
        {
            query = query.Where(v => v.ExpenseCategoryId == categoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToUpper();
            query = query.Where(v => v.Status == s);
        }

        return await query
            .OrderByDescending(v => v.VoucherDate)
            .Select(v => new ExpenseVoucherDto(
                v.Id,
                v.VoucherNumber,
                v.VoucherDate,
                v.ExpenseCategoryId,
                v.ExpenseCategory != null ? v.ExpenseCategory.Name : string.Empty,
                v.CashBoxId,
                v.CashBox != null ? v.CashBox.Name : null,
                v.Amount,
                v.Currency,
                v.ExchangeRate,
                v.BaseCurrencyAmount,
                v.PaymentMethod,
                v.BeneficiaryName,
                v.Status,
                v.ApprovedBy,
                v.ApprovedAt,
                v.Notes,
                v.ReceiptReference,
                v.CreatedBy,
                v.CreatedAt
            ))
            .ToListAsync();
    }

    public async Task<ExpenseVoucherDto?> GetVoucherByIdAsync(Guid id)
    {
        var v = await _context.ExpenseVouchers
            .Include(x => x.ExpenseCategory)
            .Include(x => x.CashBox)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (v == null) return null;

        return new ExpenseVoucherDto(
            v.Id,
            v.VoucherNumber,
            v.VoucherDate,
            v.ExpenseCategoryId,
            v.ExpenseCategory != null ? v.ExpenseCategory.Name : string.Empty,
            v.CashBoxId,
            v.CashBox != null ? v.CashBox.Name : null,
            v.Amount,
            v.Currency,
            v.ExchangeRate,
            v.BaseCurrencyAmount,
            v.PaymentMethod,
            v.BeneficiaryName,
            v.Status,
            v.ApprovedBy,
            v.ApprovedAt,
            v.Notes,
            v.ReceiptReference,
            v.CreatedBy,
            v.CreatedAt
        );
    }

    public async Task<ApiResponse<ExpenseVoucherDto>> CreateVoucherAsync(CreateExpenseVoucherRequest request, string? createdBy)
    {
        if (request.Amount <= 0)
        {
            return ApiResponse<ExpenseVoucherDto>.Fail("ERR_INVALID_EXPENSE_AMOUNT", "EXPENSES");
        }

        ExpenseCategory? category = null;
        if (request.ExpenseCategoryId.HasValue && request.ExpenseCategoryId.Value != Guid.Empty)
        {
            category = await _context.ExpenseCategories.FindAsync(request.ExpenseCategoryId.Value);
            if (category == null || !category.IsActive)
            {
                return ApiResponse<ExpenseVoucherDto>.Fail("ERR_EXPENSE_CATEGORY_INVALID", "EXPENSES");
            }
        }

        var exchangeRate = request.ExchangeRate > 0 ? request.ExchangeRate : 1.0000m;
        var baseAmount = request.Amount * exchangeRate;
        var voucherNumber = $"EXPV-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";

        var voucher = new ExpenseVoucher
        {
            VoucherNumber = voucherNumber,
            VoucherDate = DateTime.UtcNow,
            ExpenseCategoryId = category?.Id,
            CashBoxId = request.CashBoxId,
            Amount = request.Amount,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "IQD" : request.Currency.Trim().ToUpper(),
            ExchangeRate = exchangeRate,
            BaseCurrencyAmount = baseAmount,
            PaymentMethod = request.PaymentMethod?.ToUpper() ?? "CASH",
            BeneficiaryName = request.BeneficiaryName?.Trim(),
            Status = "DRAFT",
            Notes = request.Notes?.Trim(),
            ReceiptReference = request.ReceiptReference?.Trim(),
            CreatedBy = createdBy ?? "System",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.ExpenseVouchers.Add(voucher);
        await _context.SaveChangesAsync();

        if (request.AutoApprove)
        {
            return await ApproveVoucherAsync(voucher.Id, new ApproveExpenseVoucherRequest(request.CashBoxId, request.Notes), createdBy);
        }

        var dto = new ExpenseVoucherDto(
            voucher.Id,
            voucher.VoucherNumber,
            voucher.VoucherDate,
            voucher.ExpenseCategoryId,
            category?.Name ?? string.Empty,
            voucher.CashBoxId,
            null,
            voucher.Amount,
            voucher.Currency,
            voucher.ExchangeRate,
            voucher.BaseCurrencyAmount,
            voucher.PaymentMethod,
            voucher.BeneficiaryName,
            voucher.Status,
            voucher.ApprovedBy,
            voucher.ApprovedAt,
            voucher.Notes,
            voucher.ReceiptReference,
            voucher.CreatedBy,
            voucher.CreatedAt
        );

        return ApiResponse<ExpenseVoucherDto>.Ok(dto);
    }

    public async Task<ApiResponse<ExpenseVoucherDto>> UpdateVoucherAsync(Guid id, UpdateExpenseVoucherRequest request, string? updatedBy)
    {
        var voucher = await _context.ExpenseVouchers
            .Include(v => v.ExpenseCategory)
            .Include(v => v.CashBox)
            .FirstOrDefaultAsync(v => v.Id == id);

        if (voucher == null)
        {
            return ApiResponse<ExpenseVoucherDto>.Fail("ERR_VOUCHER_NOT_FOUND", "EXPENSES");
        }

        if (voucher.Status != "DRAFT")
        {
            return ApiResponse<ExpenseVoucherDto>.Fail("ERR_VOUCHER_NOT_IN_DRAFT", "EXPENSES");
        }

        ExpenseCategory? category = null;
        if (request.ExpenseCategoryId.HasValue && request.ExpenseCategoryId.Value != Guid.Empty)
        {
            category = await _context.ExpenseCategories.FindAsync(request.ExpenseCategoryId.Value);
            if (category == null || !category.IsActive)
            {
                return ApiResponse<ExpenseVoucherDto>.Fail("ERR_EXPENSE_CATEGORY_INVALID", "EXPENSES");
            }
        }

        var exchangeRate = request.ExchangeRate > 0 ? request.ExchangeRate : 1.0000m;
        voucher.ExpenseCategoryId = category?.Id;
        voucher.CashBoxId = request.CashBoxId;
        voucher.Amount = request.Amount;
        voucher.Currency = string.IsNullOrWhiteSpace(request.Currency) ? "IQD" : request.Currency.Trim().ToUpper();
        voucher.ExchangeRate = exchangeRate;
        voucher.BaseCurrencyAmount = request.Amount * exchangeRate;
        voucher.PaymentMethod = request.PaymentMethod?.ToUpper() ?? "CASH";
        voucher.BeneficiaryName = request.BeneficiaryName?.Trim();
        voucher.Notes = request.Notes?.Trim();
        voucher.ReceiptReference = request.ReceiptReference?.Trim();
        voucher.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var dto = new ExpenseVoucherDto(
            voucher.Id,
            voucher.VoucherNumber,
            voucher.VoucherDate,
            voucher.ExpenseCategoryId,
            category?.Name ?? string.Empty,
            voucher.CashBoxId,
            voucher.CashBox?.Name,
            voucher.Amount,
            voucher.Currency,
            voucher.ExchangeRate,
            voucher.BaseCurrencyAmount,
            voucher.PaymentMethod,
            voucher.BeneficiaryName,
            voucher.Status,
            voucher.ApprovedBy,
            voucher.ApprovedAt,
            voucher.Notes,
            voucher.ReceiptReference,
            voucher.CreatedBy,
            voucher.CreatedAt
        );

        return ApiResponse<ExpenseVoucherDto>.Ok(dto);
    }

    public async Task<ApiResponse<ExpenseVoucherDto>> ApproveVoucherAsync(Guid id, ApproveExpenseVoucherRequest request, string? approvedBy)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var voucher = await _context.ExpenseVouchers
                .Include(v => v.ExpenseCategory)
                .FirstOrDefaultAsync(v => v.Id == id);

            if (voucher == null)
            {
                return ApiResponse<ExpenseVoucherDto>.Fail("ERR_VOUCHER_NOT_FOUND", "EXPENSES");
            }

            if (voucher.Status == "APPROVED")
            {
                return ApiResponse<ExpenseVoucherDto>.Fail("ERR_VOUCHER_ALREADY_APPROVED", "EXPENSES");
            }

            if (voucher.Status != "DRAFT")
            {
                return ApiResponse<ExpenseVoucherDto>.Fail("ERR_VOUCHER_CANNOT_BE_APPROVED", "EXPENSES");
            }

            var cashBoxId = request.CashBoxId ?? voucher.CashBoxId;
            CashBox? cashBox = null;
            if (cashBoxId.HasValue && cashBoxId.Value != Guid.Empty)
            {
                cashBox = await _context.CashBoxes.FirstOrDefaultAsync(cb => cb.Id == cashBoxId.Value && cb.IsActive);
            }
            else
            {
                cashBox = await _context.CashBoxes.FirstOrDefaultAsync(cb => cb.IsActive);
            }

            if (cashBox == null)
            {
                return ApiResponse<ExpenseVoucherDto>.Fail("ERR_EXPENSE_ACCOUNT_NOT_FOUND", "EXPENSES");
            }

            // Deduct funds from CashBox
            var previousCashBoxBalance = cashBox.CurrentBalance;
            cashBox.CurrentBalance -= voucher.Amount;
            cashBox.UpdatedAt = DateTime.UtcNow;

            voucher.CashBoxId = cashBox.Id;
            voucher.Status = "APPROVED";
            voucher.ApprovedBy = approvedBy ?? "Manager";
            voucher.ApprovedAt = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(request.Notes))
            {
                voucher.Notes = $"{voucher.Notes} | {request.Notes}".Trim(' ', '|');
            }
            voucher.UpdatedAt = DateTime.UtcNow;

            // Audit Trail
            var auditLog = new AuditLog
            {
                UserId = approvedBy ?? "Manager",
                Username = approvedBy ?? "Manager",
                Action = "APPROVE",
                EntityName = "expense_vouchers",
                EntityId = voucher.Id.ToString(),
                OldValues = System.Text.Json.JsonSerializer.Serialize(new { Status = "DRAFT", CashBoxBalance = previousCashBoxBalance }),
                NewValues = System.Text.Json.JsonSerializer.Serialize(new { Status = "APPROVED", CashBoxBalance = cashBox.CurrentBalance, Deducted = voucher.Amount }),
                Timestamp = DateTimeOffset.UtcNow
            };
            _context.AuditLogs.Add(auditLog);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var dto = new ExpenseVoucherDto(
                voucher.Id,
                voucher.VoucherNumber,
                voucher.VoucherDate,
                voucher.ExpenseCategoryId,
                voucher.ExpenseCategory?.Name ?? "مصروفات",
                voucher.CashBoxId,
                cashBox.Name,
                voucher.Amount,
                voucher.Currency,
                voucher.ExchangeRate,
                voucher.BaseCurrencyAmount,
                voucher.PaymentMethod,
                voucher.BeneficiaryName,
                voucher.Status,
                voucher.ApprovedBy,
                voucher.ApprovedAt,
                voucher.Notes,
                voucher.ReceiptReference,
                voucher.CreatedBy,
                voucher.CreatedAt
            );

            return ApiResponse<ExpenseVoucherDto>.Ok(dto);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to approve expense voucher {VoucherId}", id);
            return ApiResponse<ExpenseVoucherDto>.Fail("ERR_EXPENSE_APPROVAL_FAILED", "EXPENSES");
        }
    }

    public async Task<ApiResponse<ExpenseVoucherDto>> RejectVoucherAsync(Guid id, string? rejectedBy, string? reason)
    {
        var voucher = await _context.ExpenseVouchers
            .Include(v => v.ExpenseCategory)
            .Include(v => v.CashBox)
            .FirstOrDefaultAsync(v => v.Id == id);

        if (voucher == null)
        {
            return ApiResponse<ExpenseVoucherDto>.Fail("ERR_VOUCHER_NOT_FOUND", "EXPENSES");
        }

        if (voucher.Status != "DRAFT")
        {
            return ApiResponse<ExpenseVoucherDto>.Fail("ERR_VOUCHER_NOT_IN_DRAFT", "EXPENSES");
        }

        voucher.Status = "REJECTED";
        voucher.ApprovedBy = rejectedBy ?? "Supervisor";
        voucher.ApprovedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(reason))
        {
            voucher.Notes = $"{voucher.Notes} | سبب الرفض: {reason}".Trim(' ', '|');
        }
        voucher.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var dto = new ExpenseVoucherDto(
            voucher.Id,
            voucher.VoucherNumber,
            voucher.VoucherDate,
            voucher.ExpenseCategoryId,
            voucher.ExpenseCategory?.Name ?? "",
            voucher.CashBoxId,
            voucher.CashBox?.Name,
            voucher.Amount,
            voucher.Currency,
            voucher.ExchangeRate,
            voucher.BaseCurrencyAmount,
            voucher.PaymentMethod,
            voucher.BeneficiaryName,
            voucher.Status,
            voucher.ApprovedBy,
            voucher.ApprovedAt,
            voucher.Notes,
            voucher.ReceiptReference,
            voucher.CreatedBy,
            voucher.CreatedAt
        );

        return ApiResponse<ExpenseVoucherDto>.Ok(dto);
    }

    public async Task<ExpensesSummaryDto> GetSummaryAsync(DateTime? startDate, DateTime? endDate)
    {
        var start = startDate?.ToUniversalTime() ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = endDate?.ToUniversalTime() ?? DateTime.UtcNow;

        var approvedVouchers = await _context.ExpenseVouchers
            .Include(v => v.ExpenseCategory)
            .Where(v => v.Status == "APPROVED" && v.VoucherDate >= start && v.VoucherDate <= end)
            .ToListAsync();

        var total = approvedVouchers.Sum(v => v.BaseCurrencyAmount);

        var byCat = approvedVouchers
            .GroupBy(v => new { Code = v.ExpenseCategory?.Code ?? "OTHER", Name = v.ExpenseCategory?.Name ?? "أخرى" })
            .Select(g => new CategoryExpenseSummaryDto(
                g.Key.Code,
                g.Key.Name,
                g.Sum(x => x.BaseCurrencyAmount),
                g.Count()
            ))
            .OrderByDescending(x => x.TotalAmount)
            .ToList();

        var pendingCount = await _context.ExpenseVouchers
            .CountAsync(v => v.Status == "DRAFT");

        return new ExpensesSummaryDto(
            TotalOperationalExpenses: total,
            ApprovedExpensesMonth: total,
            PendingExpensesCount: pendingCount,
            ByCategory: byCat
        );
    }
}
