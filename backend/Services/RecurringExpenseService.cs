using System.Collections.Concurrent;
using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface IRecurringExpenseService
{
    Task<List<RecurringExpenseDto>> GetAllAsync(CancellationToken ct = default);
    Task<List<RecurringExpenseDto>> GetDueForDashboardAsync(CancellationToken ct = default);
    Task<ApiResponse<RecurringExpenseDto>> CreateAsync(UpsertRecurringExpenseRequest request, CancellationToken ct = default);
    Task<ApiResponse<RecurringExpenseDto>> UpdateAsync(Guid id, UpsertRecurringExpenseRequest request, CancellationToken ct = default);
    Task<ApiResponse<RecurringExpenseDto>> ToggleAsync(Guid id, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<ApiResponse<ConfirmRecurringExpenseResponseDto>> ConfirmAsync(Guid id, ConfirmRecurringExpenseRequest request, string? confirmedBy, CancellationToken ct = default);
    Task ProcessDueAutoPostRulesAsync(Guid? tenantId = null, CancellationToken ct = default);
}

public class RecurringExpenseService : IRecurringExpenseService
{
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> InMemoryRuleLocks = new();
    private static readonly TimeSpan LockExpiry = TimeSpan.FromSeconds(10);
    private static readonly SemaphoreSlim SchemaInitLock = new(1, 1);
    private static volatile bool _schemaEnsured;

    private readonly AppDbContext _context;
    private readonly IConnectionMultiplexer? _redis;
    private readonly IAuditLogService? _auditLogService;
    private readonly ILogger<RecurringExpenseService> _logger;

    public RecurringExpenseService(
        AppDbContext context,
        IServiceProvider serviceProvider,
        ILogger<RecurringExpenseService> logger)
    {
        _context = context;
        _redis = serviceProvider.GetService<IConnectionMultiplexer>();
        _auditLogService = serviceProvider.GetService<IAuditLogService>();
        _logger = logger;
    }

    private async Task EnsureSchemaAsync(CancellationToken ct = default)
    {
        if (_schemaEnsured) return;

        await SchemaInitLock.WaitAsync(ct);
        try
        {
            if (_schemaEnsured) return;

            await _context.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS recurring_expenses (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NULL,
                    title VARCHAR(200) NOT NULL,
                    category VARCHAR(150) NOT NULL,
                    amount NUMERIC(18, 4) NOT NULL,
                    frequency VARCHAR(30) NOT NULL DEFAULT 'Monthly',
                    day_of_month INT NULL,
                    day_of_week INT NULL,
                    interval_days INT NULL,
                    next_due_date TIMESTAMPTZ NOT NULL,
                    last_executed_date TIMESTAMPTZ NULL,
                    execution_mode VARCHAR(30) NOT NULL DEFAULT 'RemindAndConfirm',
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    notes VARCHAR(1000) NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );", ct);

            _schemaEnsured = true;

            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    CREATE INDEX IF NOT EXISTS ix_recurring_expenses_tenant_due
                        ON recurring_expenses (tenant_id, is_active, is_deleted, next_due_date);
                    CREATE INDEX IF NOT EXISTS ix_recurring_expenses_due_date
                        ON recurring_expenses (next_due_date)
                        WHERE is_active = TRUE AND is_deleted = FALSE;
                    ALTER TABLE IF EXISTS expense_vouchers
                        ADD COLUMN IF NOT EXISTS recurring_expense_id UUID NULL;
                ", ct);
            }
            catch (Exception indexEx)
            {
                _logger.LogWarning(indexEx, "EnsureSchemaAsync index/alter warning (non-fatal).");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "EnsureSchemaAsync failed for recurring_expenses.");
        }
        finally
        {
            SchemaInitLock.Release();
        }
    }

    public async Task<List<RecurringExpenseDto>> GetAllAsync(CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        // Trigger on-demand catch-up for this tenant before returning list
        await ProcessDueAutoPostRulesAsync(_context.CurrentTenantId, ct);

        var todayUtc = DateTimeOffset.UtcNow.Date;
        var tenantId = _context.CurrentTenantId;
        var rules = await _context.RecurringExpenses
            .AsNoTracking()
            .Where(r => !r.IsDeleted && (!tenantId.HasValue || r.TenantId == tenantId.Value))
            .OrderByDescending(r => r.CreatedAt)
            .ThenBy(r => r.Id)
            .ToListAsync(ct);

        var caps = await LoadCategoryCapsAsync(ct);
        return rules.Select(r => MapDto(r, todayUtc, caps)).ToList();
    }

    public async Task<List<RecurringExpenseDto>> GetDueForDashboardAsync(CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        await ProcessDueAutoPostRulesAsync(_context.CurrentTenantId, ct);

        var todayEndUtc = new DateTimeOffset(DateTime.UtcNow.Date.AddDays(1).AddTicks(-1), TimeSpan.Zero);
        var todayUtc = DateTimeOffset.UtcNow.Date;

        var dueRules = await _context.RecurringExpenses
            .AsNoTracking()
            .Where(r => !r.IsDeleted && r.IsActive && r.NextDueDate <= todayEndUtc)
            .OrderBy(r => r.NextDueDate)
            .ThenBy(r => r.Title)
            .ToListAsync(ct);

        var caps = await LoadCategoryCapsAsync(ct);
        return dueRules.Select(r => MapDto(r, todayUtc, caps)).ToList();
    }

    public async Task<ApiResponse<RecurringExpenseDto>> CreateAsync(UpsertRecurringExpenseRequest request, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var validationError = ValidateRequest(request);
        if (validationError != null)
        {
            return ApiResponse<RecurringExpenseDto>.Fail(validationError, "RECURRING");
        }

        var now = DateTimeOffset.UtcNow;
        var frequency = NormalizeFrequency(request.Frequency);
        var mode = NormalizeExecutionMode(request.ExecutionMode);
        var nextDue = request.NextDueDate.HasValue
            ? NormalizeUtcDate(request.NextDueDate.Value)
            : ComputeInitialNextDueDate(frequency, request.DayOfMonth, request.DayOfWeek, request.IntervalDays, now);

        var entity = new RecurringExpense
        {
            Title = request.Title.Trim(),
            Category = (request.Category ?? string.Empty).Trim(),
            Amount = Math.Round(request.Amount, 4, MidpointRounding.AwayFromZero),
            Frequency = frequency,
            DayOfMonth = frequency == RecurringExpenseFrequency.Monthly || frequency == RecurringExpenseFrequency.Yearly
                ? Math.Clamp(request.DayOfMonth ?? now.Day, 1, 31)
                : null,
            DayOfWeek = frequency == RecurringExpenseFrequency.Weekly
                ? Math.Clamp(request.DayOfWeek ?? (int)now.DayOfWeek, 0, 6)
                : null,
            IntervalDays = frequency == RecurringExpenseFrequency.CustomDays
                ? Math.Max(1, request.IntervalDays ?? 30)
                : null,
            NextDueDate = nextDue,
            ExecutionMode = mode,
            IsActive = request.IsActive,
            IsDeleted = false,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.RecurringExpenses.Add(entity);
        await _context.SaveChangesAsync(ct);

        var caps = await LoadCategoryCapsAsync(ct);
        return ApiResponse<RecurringExpenseDto>.Ok(MapDto(entity, DateTimeOffset.UtcNow.Date, caps));
    }

    public async Task<ApiResponse<RecurringExpenseDto>> UpdateAsync(Guid id, UpsertRecurringExpenseRequest request, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var validationError = ValidateRequest(request);
        if (validationError != null)
        {
            return ApiResponse<RecurringExpenseDto>.Fail(validationError, "RECURRING");
        }

        var entity = await _context.RecurringExpenses.FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct);
        if (entity == null)
        {
            return ApiResponse<RecurringExpenseDto>.Fail("ERR_RECURRING_NOT_FOUND", "RECURRING");
        }

        var now = DateTimeOffset.UtcNow;
        var frequency = NormalizeFrequency(request.Frequency);
        var mode = NormalizeExecutionMode(request.ExecutionMode);

        entity.Title = request.Title.Trim();
        entity.Category = (request.Category ?? string.Empty).Trim();
        entity.Amount = Math.Round(request.Amount, 4, MidpointRounding.AwayFromZero);
        entity.Frequency = frequency;
        entity.DayOfMonth = frequency == RecurringExpenseFrequency.Monthly || frequency == RecurringExpenseFrequency.Yearly
            ? Math.Clamp(request.DayOfMonth ?? now.Day, 1, 31)
            : null;
        entity.DayOfWeek = frequency == RecurringExpenseFrequency.Weekly
            ? Math.Clamp(request.DayOfWeek ?? (int)now.DayOfWeek, 0, 6)
            : null;
        entity.IntervalDays = frequency == RecurringExpenseFrequency.CustomDays
            ? Math.Max(1, request.IntervalDays ?? 30)
            : null;
        entity.ExecutionMode = mode;
        entity.IsActive = request.IsActive;
        entity.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        entity.NextDueDate = request.NextDueDate.HasValue
            ? NormalizeUtcDate(request.NextDueDate.Value)
            : ComputeInitialNextDueDate(frequency, entity.DayOfMonth, entity.DayOfWeek, entity.IntervalDays, now);
        entity.UpdatedAt = now;

        await _context.SaveChangesAsync(ct);
        var caps = await LoadCategoryCapsAsync(ct);
        return ApiResponse<RecurringExpenseDto>.Ok(MapDto(entity, DateTimeOffset.UtcNow.Date, caps));
    }

    public async Task<ApiResponse<RecurringExpenseDto>> ToggleAsync(Guid id, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var tenantId = _context.CurrentTenantId;
        var entity = await _context.RecurringExpenses
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted && (!tenantId.HasValue || r.TenantId == tenantId.Value), ct);
        if (entity == null)
        {
            return ApiResponse<RecurringExpenseDto>.Fail("ERR_RECURRING_NOT_FOUND", "RECURRING");
        }

        entity.IsActive = !entity.IsActive;
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(ct);

        var caps = await LoadCategoryCapsAsync(ct);
        return ApiResponse<RecurringExpenseDto>.Ok(MapDto(entity, DateTimeOffset.UtcNow.Date, caps));
    }

    public async Task<ApiResponse<bool>> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var entity = await _context.RecurringExpenses.FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct);
        if (entity == null)
        {
            return ApiResponse<bool>.Fail("ERR_RECURRING_NOT_FOUND", "RECURRING");
        }

        entity.IsDeleted = true;
        entity.IsActive = false;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        _auditLogService?.QueueLog(
            action: "VOID",
            entityName: "recurring_expenses",
            entityId: entity.Id.ToString(),
            oldValues: new { Title = entity.Title, Amount = entity.Amount, IsDeleted = false },
            newValues: new { Title = entity.Title, Amount = entity.Amount, IsDeleted = true },
            tenantIdOverride: entity.TenantId);

        await _context.SaveChangesAsync(ct);

        return ApiResponse<bool>.Ok(true);
    }

    public async Task<ApiResponse<ConfirmRecurringExpenseResponseDto>> ConfirmAsync(
        Guid id,
        ConfirmRecurringExpenseRequest request,
        string? confirmedBy,
        CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var (acquired, releaseLock) = await AcquireRuleLockAsync(id, ct);
        if (!acquired)
        {
            return ApiResponse<ConfirmRecurringExpenseResponseDto>.Fail("ERR_CONCURRENCY_LOCK_TIMEOUT", "RECURRING");
        }

        try
        {
            await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
            var rule = await _context.RecurringExpenses.FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct);
            if (rule == null)
            {
                await tx.RollbackAsync(ct);
                return ApiResponse<ConfirmRecurringExpenseResponseDto>.Fail("ERR_RECURRING_NOT_FOUND", "RECURRING");
            }

            var finalAmount = request.ActualAmount ?? rule.Amount;
            if (finalAmount <= 0)
            {
                await tx.RollbackAsync(ct);
                return ApiResponse<ConfirmRecurringExpenseResponseDto>.Fail("ERR_INVALID_RECURRING_AMOUNT", "RECURRING");
            }

            var now = DateTimeOffset.UtcNow;
            var (voucherResult, postError) = await PostExpenseVoucherForCycleAsync(
                rule,
                rule.NextDueDate,
                finalAmount,
                request.Notes,
                request.CashBoxId,
                confirmedBy ?? "Owner",
                "CONFIRM_RECURRING",
                ct);

            if (postError != null || voucherResult == null)
            {
                await tx.RollbackAsync(ct);
                return ApiResponse<ConfirmRecurringExpenseResponseDto>.Fail(postError ?? "ERR_RECURRING_CONFIRM_FAILED", "RECURRING");
            }

            rule.LastExecutedDate = now;
            var nextCycle = AdvanceCycle(rule, rule.NextDueDate);
            while (nextCycle.Date < now.Date)
            {
                nextCycle = AdvanceCycle(rule, nextCycle);
            }
            rule.NextDueDate = nextCycle;
            rule.UpdatedAt = now;

            await _context.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            var caps = await LoadCategoryCapsAsync(ct);
            return ApiResponse<ConfirmRecurringExpenseResponseDto>.Ok(new ConfirmRecurringExpenseResponseDto
            {
                Rule = MapDto(rule, DateTimeOffset.UtcNow.Date, caps),
                ExpenseVoucher = voucherResult
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error confirming recurring expense {RuleId}", id);
            return ApiResponse<ConfirmRecurringExpenseResponseDto>.Fail("ERR_RECURRING_CONFIRM_FAILED", "RECURRING");
        }
        finally
        {
            await releaseLock();
        }
    }

    public async Task ProcessDueAutoPostRulesAsync(Guid? tenantId = null, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var todayEndUtc = new DateTimeOffset(DateTime.UtcNow.Date.AddDays(1).AddTicks(-1), TimeSpan.Zero);

        var query = _context.RecurringExpenses
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => !r.IsDeleted
                        && r.IsActive
                        && r.ExecutionMode == RecurringExpenseExecutionMode.AutoPost
                        && r.NextDueDate <= todayEndUtc);

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(r => r.TenantId == tenantId.Value);
        }

        var dueRuleIds = await query.Select(r => r.Id).ToListAsync(ct);
        foreach (var ruleId in dueRuleIds)
        {
            if (ct.IsCancellationRequested) break;
            await ProcessSingleAutoPostRuleAsync(ruleId, ct);
        }
    }

    private async Task ProcessSingleAutoPostRuleAsync(Guid ruleId, CancellationToken ct)
    {
        var (acquired, releaseLock) = await AcquireRuleLockAsync(ruleId, ct);
        if (!acquired) return;

        try
        {
            await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
            var rule = await _context.RecurringExpenses
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(r => r.Id == ruleId && !r.IsDeleted && r.IsActive, ct);

            if (rule == null || rule.ExecutionMode != RecurringExpenseExecutionMode.AutoPost)
            {
                await tx.RollbackAsync(ct);
                return;
            }

            var todayDate = DateTimeOffset.UtcNow.Date;
            var cyclesProcessed = 0;

            while (rule.NextDueDate.Date <= todayDate && cyclesProcessed < 36)
            {
                var cycleDate = rule.NextDueDate;
                var cycleStart = cycleDate.UtcDateTime.Date;
                var cycleEnd = cycleStart.AddDays(1);

                var alreadyPosted = await _context.ExpenseVouchers
                    .IgnoreQueryFilters()
                    .AnyAsync(v => v.RecurringExpenseId == rule.Id
                                   && v.VoucherDate >= cycleStart
                                   && v.VoucherDate < cycleEnd
                                   && v.Status == "APPROVED", ct);

                if (!alreadyPosted)
                {
                    var (_, postError) = await PostExpenseVoucherForCycleAsync(
                        rule,
                        cycleDate,
                        rule.Amount,
                        null,
                        null,
                        "AutoRecurringScheduler",
                        "AUTO_POST_RECURRING",
                        ct);

                    if (postError != null)
                    {
                        _logger.LogWarning("Auto-post skipped for recurring rule {RuleId} on cycle {CycleDate}: {ErrorCode}", rule.Id, cycleDate, postError);
                        break;
                    }
                }

                rule.LastExecutedDate = DateTimeOffset.UtcNow;
                rule.NextDueDate = AdvanceCycle(rule, cycleDate);
                rule.UpdatedAt = DateTimeOffset.UtcNow;
                cyclesProcessed++;
            }

            if (cyclesProcessed > 0)
            {
                await _context.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            }
            else
            {
                await tx.RollbackAsync(ct);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error auto-posting recurring expense {RuleId}", ruleId);
        }
        finally
        {
            await releaseLock();
        }
    }

    private async Task<(ExpenseVoucherDto? Voucher, string? ErrorCode)> PostExpenseVoucherForCycleAsync(
        RecurringExpense rule,
        DateTimeOffset cycleDate,
        decimal amount,
        string? customNotes,
        Guid? preferredCashBoxId,
        string actor,
        string auditAction,
        CancellationToken ct)
    {
        var tenantId = rule.TenantId;
        var normCategory = (rule.Category ?? string.Empty).Trim();

        ExpenseCategory? category = null;
        if (!string.IsNullOrWhiteSpace(normCategory))
        {
            category = await _context.ExpenseCategories
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.IsActive &&
                                          (c.Name.ToLower() == normCategory.ToLower() || c.Code.ToLower() == normCategory.ToLower()), ct);
        }

        CashBox? cashBox = null;
        if (preferredCashBoxId.HasValue && preferredCashBoxId.Value != Guid.Empty)
        {
            cashBox = await _context.CashBoxes
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(cb => cb.Id == preferredCashBoxId.Value && cb.TenantId == tenantId && cb.IsActive, ct);
        }
        else
        {
            cashBox = await _context.CashBoxes
                .IgnoreQueryFilters()
                .OrderBy(cb => cb.Code)
                .FirstOrDefaultAsync(cb => cb.TenantId == tenantId && cb.IsActive, ct);
        }

        if (cashBox == null)
        {
            return (null, "ERR_EXPENSE_ACCOUNT_NOT_FOUND");
        }

        var roundedAmount = Math.Round(amount, 4, MidpointRounding.AwayFromZero);
        if (cashBox.CurrentBalance < roundedAmount)
        {
            return (null, "ERR_INSUFFICIENT_TREASURY_BALANCE");
        }

        cashBox.CurrentBalance -= roundedAmount;
        cashBox.UpdatedAt = DateTime.UtcNow;

        var voucherNumber = $"RECV-{cycleDate:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var mergedNotes = string.IsNullOrWhiteSpace(customNotes)
            ? rule.Title + (string.IsNullOrWhiteSpace(rule.Notes) ? "" : $" — {rule.Notes}")
            : $"{rule.Title} — {customNotes.Trim()}";

        var nowUtc = DateTime.UtcNow;
        var voucher = new ExpenseVoucher
        {
            TenantId = tenantId,
            VoucherNumber = voucherNumber,
            VoucherDate = cycleDate.UtcDateTime,
            ExpenseCategoryId = category?.Id,
            CashBoxId = cashBox.Id,
            Amount = roundedAmount,
            Currency = "IQD",
            ExchangeRate = 1.0000m,
            BaseCurrencyAmount = roundedAmount,
            PaymentMethod = "CASH",
            BeneficiaryName = rule.Title,
            Status = "APPROVED",
            ApprovedBy = actor,
            ApprovedAt = nowUtc,
            RecurringExpenseId = rule.Id,
            Notes = mergedNotes.Length > 500 ? mergedNotes[..500] : mergedNotes,
            CreatedBy = actor,
            CreatedAt = nowUtc,
            UpdatedAt = nowUtc
        };

        _context.ExpenseVouchers.Add(voucher);

        _context.TreasuryTransactions.Add(new TreasuryTransaction
        {
            TenantId = tenantId,
            CashBoxId = cashBox.Id,
            ExpenseVoucherId = voucher.Id,
            TransactionType = "PAYMENT",
            Amount = roundedAmount,
            BalanceAfter = cashBox.CurrentBalance,
            ReferenceNumber = voucher.VoucherNumber,
            Notes = voucher.Notes,
            CreatedBy = actor,
            CreatedAt = DateTimeOffset.UtcNow
        });

        _context.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            UserId = actor,
            Username = actor,
            Action = auditAction,
            EntityName = "recurring_expenses",
            EntityId = rule.Id.ToString(),
            OldValues = null,
            NewValues = JsonSerializer.Serialize(new
            {
                VoucherId = voucher.Id,
                VoucherNumber = voucher.VoucherNumber,
                Amount = voucher.Amount,
                CashBoxId = cashBox.Id,
                CashBoxBalanceAfter = cashBox.CurrentBalance,
                CycleDate = cycleDate.Date
            }),
            Timestamp = DateTimeOffset.UtcNow
        });

        var dto = new ExpenseVoucherDto(
            voucher.Id,
            voucher.VoucherNumber,
            voucher.VoucherDate,
            voucher.ExpenseCategoryId,
            category?.Name ?? normCategory,
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
        return (dto, null);
    }

    private async Task<(bool Acquired, Func<Task> Release)> AcquireRuleLockAsync(Guid ruleId, CancellationToken ct)
    {
        if (_redis != null && _redis.IsConnected)
        {
            var db = _redis.GetDatabase();
            var lockKey = $"lock:recurring-expense:{ruleId:N}";
            var lockToken = Guid.NewGuid().ToString("N");
            var acquired = await db.LockTakeAsync(lockKey, lockToken, LockExpiry);
            if (!acquired)
            {
                return (false, () => Task.CompletedTask);
            }

            return (true, async () =>
            {
                try
                {
                    await db.LockReleaseAsync(lockKey, lockToken);
                }
                catch
                {
                    // Lock TTL expires automatically
                }
            });
        }

        var sem = InMemoryRuleLocks.GetOrAdd(ruleId, _ => new SemaphoreSlim(1, 1));
        var entered = await sem.WaitAsync(TimeSpan.FromSeconds(5), ct);
        if (!entered)
        {
            return (false, () => Task.CompletedTask);
        }

        return (true, () =>
        {
            try
            {
                sem.Release();
            }
            catch
            {
                // ignored
            }
            return Task.CompletedTask;
        });
    }

    private static string? ValidateRequest(UpsertRecurringExpenseRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return "ERR_RECURRING_TITLE_REQUIRED";
        }
        if (request.Amount <= 0)
        {
            return "ERR_INVALID_RECURRING_AMOUNT";
        }

        var freq = NormalizeFrequency(request.Frequency);
        if (freq is not (RecurringExpenseFrequency.Monthly or RecurringExpenseFrequency.Weekly or RecurringExpenseFrequency.Yearly or RecurringExpenseFrequency.CustomDays))
        {
            return "ERR_INVALID_RECURRING_SCHEDULE";
        }

        if (request.DayOfMonth.HasValue && (request.DayOfMonth < 1 || request.DayOfMonth > 31))
        {
            return "ERR_INVALID_RECURRING_SCHEDULE";
        }
        if (request.DayOfWeek.HasValue && (request.DayOfWeek < 0 || request.DayOfWeek > 6))
        {
            return "ERR_INVALID_RECURRING_SCHEDULE";
        }
        if (freq == RecurringExpenseFrequency.CustomDays && (request.IntervalDays ?? 0) < 1)
        {
            return "ERR_INVALID_RECURRING_SCHEDULE";
        }

        return null;
    }

    private static string NormalizeFrequency(string? raw)
    {
        return (raw ?? string.Empty).Trim() switch
        {
            var s when s.Equals(RecurringExpenseFrequency.Weekly, StringComparison.OrdinalIgnoreCase) => RecurringExpenseFrequency.Weekly,
            var s when s.Equals(RecurringExpenseFrequency.Yearly, StringComparison.OrdinalIgnoreCase) => RecurringExpenseFrequency.Yearly,
            var s when s.Equals(RecurringExpenseFrequency.CustomDays, StringComparison.OrdinalIgnoreCase) => RecurringExpenseFrequency.CustomDays,
            _ => RecurringExpenseFrequency.Monthly
        };
    }

    private static string NormalizeExecutionMode(string? raw)
    {
        return string.Equals(raw?.Trim(), RecurringExpenseExecutionMode.AutoPost, StringComparison.OrdinalIgnoreCase)
            ? RecurringExpenseExecutionMode.AutoPost
            : RecurringExpenseExecutionMode.RemindAndConfirm;
    }

    private static DateTimeOffset NormalizeUtcDate(DateTimeOffset input)
    {
        var utc = input.ToUniversalTime();
        return new DateTimeOffset(utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero);
    }

    public static DateTimeOffset ComputeInitialNextDueDate(
        string frequency,
        int? dayOfMonth,
        int? dayOfWeek,
        int? intervalDays,
        DateTimeOffset referenceNow)
    {
        var today = new DateTimeOffset(referenceNow.Year, referenceNow.Month, referenceNow.Day, 0, 0, 0, TimeSpan.Zero);

        switch (frequency)
        {
            case RecurringExpenseFrequency.Monthly:
            {
                var targetDay = Math.Clamp(dayOfMonth ?? today.Day, 1, 31);
                var daysInCurrentMonth = DateTime.DaysInMonth(today.Year, today.Month);
                var currentMonthDue = new DateTimeOffset(today.Year, today.Month, Math.Min(targetDay, daysInCurrentMonth), 0, 0, 0, TimeSpan.Zero);
                if (currentMonthDue >= today)
                {
                    return currentMonthDue;
                }
                var nextMonth = today.AddMonths(1);
                var daysInNext = DateTime.DaysInMonth(nextMonth.Year, nextMonth.Month);
                return new DateTimeOffset(nextMonth.Year, nextMonth.Month, Math.Min(targetDay, daysInNext), 0, 0, 0, TimeSpan.Zero);
            }
            case RecurringExpenseFrequency.Weekly:
            {
                var targetDow = (DayOfWeek)Math.Clamp(dayOfWeek ?? (int)today.DayOfWeek, 0, 6);
                var delta = ((int)targetDow - (int)today.DayOfWeek + 7) % 7;
                return today.AddDays(delta);
            }
            case RecurringExpenseFrequency.Yearly:
            {
                var targetDay = Math.Clamp(dayOfMonth ?? today.Day, 1, 31);
                var daysInMonth = DateTime.DaysInMonth(today.Year, today.Month);
                var thisYear = new DateTimeOffset(today.Year, today.Month, Math.Min(targetDay, daysInMonth), 0, 0, 0, TimeSpan.Zero);
                if (thisYear >= today) return thisYear;
                var nextYear = today.AddYears(1);
                var daysInNextYearMonth = DateTime.DaysInMonth(nextYear.Year, nextYear.Month);
                return new DateTimeOffset(nextYear.Year, nextYear.Month, Math.Min(targetDay, daysInNextYearMonth), 0, 0, 0, TimeSpan.Zero);
            }
            case RecurringExpenseFrequency.CustomDays:
            default:
            {
                var interval = Math.Max(1, intervalDays ?? 30);
                return today.AddDays(interval);
            }
        }
    }

    public static DateTimeOffset AdvanceCycle(RecurringExpense rule, DateTimeOffset currentDueDate)
    {
        var date = NormalizeUtcDate(currentDueDate);
        switch (rule.Frequency)
        {
            case RecurringExpenseFrequency.Monthly:
            {
                var nextMonth = date.AddMonths(1);
                var targetDay = Math.Clamp(rule.DayOfMonth ?? date.Day, 1, 31);
                var maxDays = DateTime.DaysInMonth(nextMonth.Year, nextMonth.Month);
                return new DateTimeOffset(nextMonth.Year, nextMonth.Month, Math.Min(targetDay, maxDays), 0, 0, 0, TimeSpan.Zero);
            }
            case RecurringExpenseFrequency.Weekly:
                return date.AddDays(7);
            case RecurringExpenseFrequency.Yearly:
            {
                var nextYear = date.AddYears(1);
                var targetDay = Math.Clamp(rule.DayOfMonth ?? date.Day, 1, 31);
                var maxDays = DateTime.DaysInMonth(nextYear.Year, nextYear.Month);
                return new DateTimeOffset(nextYear.Year, nextYear.Month, Math.Min(targetDay, maxDays), 0, 0, 0, TimeSpan.Zero);
            }
            case RecurringExpenseFrequency.CustomDays:
            default:
                return date.AddDays(Math.Max(1, rule.IntervalDays ?? 30));
        }
    }

    private async Task<Dictionary<string, decimal>> LoadCategoryCapsAsync(CancellationToken ct)
    {
        var cats = await _context.ExpenseCategories
            .AsNoTracking()
            .Where(c => c.IsActive && c.MonthlyBudgetCap > 0)
            .Select(c => new { c.Code, c.Name, c.MonthlyBudgetCap })
            .ToListAsync(ct);

        var dict = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in cats)
        {
            if (!string.IsNullOrWhiteSpace(c.Name)) dict[c.Name.Trim()] = c.MonthlyBudgetCap;
            if (!string.IsNullOrWhiteSpace(c.Code)) dict[c.Code.Trim()] = c.MonthlyBudgetCap;
        }
        return dict;
    }

    public static decimal ComputeProjectedMonthlyAmount(decimal amount, string frequency, int? intervalDays)
    {
        return frequency switch
        {
            RecurringExpenseFrequency.Weekly => Math.Round(amount * 4m, 4, MidpointRounding.AwayFromZero),
            RecurringExpenseFrequency.Yearly => Math.Round(amount / 12m, 4, MidpointRounding.AwayFromZero),
            RecurringExpenseFrequency.CustomDays => Math.Round(amount * (30m / Math.Max(1, intervalDays ?? 30)), 4, MidpointRounding.AwayFromZero),
            _ => Math.Round(amount, 4, MidpointRounding.AwayFromZero)
        };
    }

    private static RecurringExpenseDto MapDto(
        RecurringExpense entity,
        DateTime todayUtc,
        Dictionary<string, decimal>? categoryCaps = null)
    {
        var projected = ComputeProjectedMonthlyAmount(entity.Amount, entity.Frequency, entity.IntervalDays);
        decimal? cap = null;
        if (categoryCaps != null && !string.IsNullOrWhiteSpace(entity.Category) &&
            categoryCaps.TryGetValue(entity.Category.Trim(), out var foundCap) && foundCap > 0)
        {
            cap = foundCap;
        }

        return new RecurringExpenseDto
        {
            Id = entity.Id,
            Title = entity.Title,
            Category = entity.Category,
            Amount = entity.Amount,
            Frequency = entity.Frequency,
            DayOfMonth = entity.DayOfMonth,
            DayOfWeek = entity.DayOfWeek,
            IntervalDays = entity.IntervalDays,
            NextDueDate = entity.NextDueDate,
            LastExecutedDate = entity.LastExecutedDate,
            ExecutionMode = entity.ExecutionMode,
            IsActive = entity.IsActive,
            IsDue = entity.IsActive && !entity.IsDeleted && entity.NextDueDate.Date <= todayUtc,
            ProjectedMonthlyAmount = projected,
            CategoryMonthlyBudgetCap = cap,
            ExceedsMonthlyCap = cap.HasValue && cap.Value > 0 && projected > cap.Value,
            Notes = entity.Notes,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt
        };
    }
}

public class RecurringExpenseBackgroundWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RecurringExpenseBackgroundWorker> _logger;

    public RecurringExpenseBackgroundWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<RecurringExpenseBackgroundWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Initial delay so DB schema initialization completes first
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var processor = scope.ServiceProvider.GetRequiredService<IRecurringExpenseService>();
                await processor.ProcessDueAutoPostRulesAsync(null, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "RecurringExpenseBackgroundWorker cycle encountered an error.");
            }

            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
        }
    }
}
