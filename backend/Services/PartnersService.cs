using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public sealed class PartnerDomainException : Exception
{
    public string ErrorCode { get; }
    public int StatusCode { get; }
    public Dictionary<string, object>? Metadata { get; }

    public PartnerDomainException(
        string errorCode,
        int statusCode = 400,
        Dictionary<string, object>? metadata = null)
        : base(errorCode)
    {
        ErrorCode = errorCode;
        StatusCode = statusCode;
        Metadata = metadata;
    }
}

public interface IPartnersService
{
    Task<PartnersSummaryResponseDto> GetSummaryAsync(string? period = "month", CancellationToken ct = default, Guid? warehouseId = null);
    Task<PartnerItemSummaryDto> CreatePartnerAsync(UpsertPartnerRequestDto request, CancellationToken ct = default);
    Task<PartnerItemSummaryDto> UpdatePartnerAsync(Guid id, UpsertPartnerRequestDto request, CancellationToken ct = default);
    Task<PartnerTransactionDto> RecordTransactionAsync(Guid partnerId, RecordPartnerTransactionRequestDto request, string actorIdentifier, CancellationToken ct = default);
    Task<PaginatedPartnerTransactionsDto> GetPartnerTransactionsAsync(Guid partnerId, int page = 1, int pageSize = 20, CancellationToken ct = default);
}

public class PartnersService : IPartnersService
{
    private readonly AppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public PartnersService(AppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    public async Task<PartnersSummaryResponseDto> GetSummaryAsync(string? period = "month", CancellationToken ct = default, Guid? warehouseId = null)
    {
        var (normalizedPeriod, periodStart, periodEnd) = ResolvePeriodBounds(period);

        var partners = await _context.Partners
            .AsNoTracking()
            .OrderByDescending(p => p.IsActive)
            .ThenByDescending(p => p.ProfitSharePercent)
            .ThenBy(p => p.CreatedAt)
            .ToListAsync(ct);

        var invoiceQuery = _context.SalesInvoices
            .Include(i => i.Items)
                .ThenInclude(it => it.Product)
                    .ThenInclude(p => p!.BundleComponents)
                        .ThenInclude(bc => bc.ComponentProduct)
            .AsNoTracking()
            .Where(i => i.PaymentStatus == "PAID" && i.CreatedAt <= periodEnd);

        if (warehouseId.HasValue && warehouseId.Value != Guid.Empty)
        {
            invoiceQuery = invoiceQuery.Where(i => i.WarehouseId == warehouseId.Value);
        }

        if (periodStart.HasValue)
        {
            invoiceQuery = invoiceQuery.Where(i => i.CreatedAt >= periodStart.Value);
        }

        var invoices = await invoiceQuery.ToListAsync(ct);
        var totalRevenue = invoices.Sum(i => i.TotalAmount);

        decimal totalCogs = 0m;
        foreach (var inv in invoices)
        {
            foreach (var item in inv.Items)
            {
                decimal unitCost;
                if (item.UnitCostPrice > 0m)
                {
                    unitCost = item.UnitCostPrice;
                }
                else if (item.Product != null && item.Product.IsBundle && item.Product.BundleComponents.Count > 0)
                {
                    unitCost = item.Product.BundleComponents.Sum(bc => (bc.ComponentProduct?.CostPrice ?? 0m) * bc.Quantity);
                }
                else
                {
                    unitCost = item.Product?.CostPrice ?? 0m;
                }
                totalCogs += unitCost * item.Quantity;
            }
        }

        // Subtract approved RMA refunds' profit effect / revenue if any
        var vouchersQuery = _context.ExpenseVouchers
            .AsNoTracking()
            .Where(ev => ev.Status == "APPROVED" && ev.VoucherDate <= periodEnd);
        var quickExpensesQuery = _context.CashExpenses
            .AsNoTracking()
            .Where(ce => ce.CreatedAt <= periodEnd);

        if (periodStart.HasValue)
        {
            vouchersQuery = vouchersQuery.Where(ev => ev.VoucherDate >= periodStart.Value);
            quickExpensesQuery = quickExpensesQuery.Where(ce => ce.CreatedAt >= periodStart.Value);
        }

        // Operating Expenses strictly exclude partner_transactions so partner drawings NEVER inflate store expenses
        var approvedExpenses = await vouchersQuery.SumAsync(ev => (decimal?)ev.BaseCurrencyAmount, ct) ?? 0m;
        var quickExpenses = await quickExpensesQuery.SumAsync(ce => (decimal?)ce.Amount, ct) ?? 0m;
        var totalExpenses = Math.Round(approvedExpenses + quickExpenses, 4);

        var totalNetProfit = Math.Round(totalRevenue - totalCogs - totalExpenses, 4);
        var distributableNetProfit = Math.Max(0.0000m, totalNetProfit);

        var txQuery = _context.PartnerTransactions
            .AsNoTracking()
            .Where(pt =>
                (pt.TransactionType == PartnerTransactionTypes.Withdrawal ||
                 pt.TransactionType == PartnerTransactionTypes.ProfitPayout) &&
                pt.CreatedAt <= new DateTimeOffset(periodEnd, TimeSpan.Zero));

        if (periodStart.HasValue)
        {
            var startOffset = new DateTimeOffset(periodStart.Value, TimeSpan.Zero);
            txQuery = txQuery.Where(pt => pt.CreatedAt >= startOffset);
        }

        var withdrawalsByPartner = await txQuery
            .GroupBy(pt => pt.PartnerId)
            .Select(g => new { PartnerId = g.Key, Total = g.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.PartnerId, x => x.Total, ct);

        decimal allocatedShare = Math.Round(
            partners.Where(p => p.IsActive).Sum(p => p.ProfitSharePercent),
            2);
        decimal unallocatedShare = Math.Round(Math.Max(0m, 100.00m - allocatedShare), 2);

        var partnerItems = partners.Select(p =>
        {
            var earnedProfit = p.IsActive
                ? Math.Round(distributableNetProfit * (p.ProfitSharePercent / 100.0m), 4)
                : 0.0000m;
            var totalWithdrawals = withdrawalsByPartner.TryGetValue(p.Id, out var wd)
                ? Math.Round(wd, 4)
                : 0.0000m;
            var netPayable = Math.Round(earnedProfit - totalWithdrawals, 4);

            return new PartnerItemSummaryDto
            {
                Id = p.Id,
                Name = p.Name,
                Phone = p.Phone,
                CapitalAmount = p.CapitalAmount,
                ProfitSharePercent = p.ProfitSharePercent,
                IsActive = p.IsActive,
                Notes = p.Notes,
                EarnedProfit = earnedProfit,
                TotalWithdrawals = totalWithdrawals,
                NetPayableBalance = netPayable,
                CreatedAt = p.CreatedAt
            };
        }).ToList();

        return new PartnersSummaryResponseDto
        {
            Period = normalizedPeriod,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            TotalRevenue = Math.Round(totalRevenue, 4),
            TotalCogs = Math.Round(totalCogs, 4),
            TotalExpenses = totalExpenses,
            TotalNetProfit = totalNetProfit,
            AllocatedSharePercent = allocatedShare,
            UnallocatedSharePercent = unallocatedShare,
            Partners = partnerItems
        };
    }

    public async Task<PartnerItemSummaryDto> CreatePartnerAsync(UpsertPartnerRequestDto request, CancellationToken ct = default)
    {
        var tenantId = _tenantProvider.CurrentTenantId
            ?? throw new PartnerDomainException("ERR_TENANT_CONTEXT_REQUIRED", 400);

        ValidatePartnerInput(request);

        if (request.IsActive)
        {
            await EnsureShareAllocationWithinLimitAsync(tenantId, null, request.ProfitSharePercent, ct);
        }

        var now = DateTimeOffset.UtcNow;
        var partner = new Partner
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            CapitalAmount = Math.Round(Math.Max(0m, request.CapitalAmount), 4),
            ProfitSharePercent = Math.Round(request.ProfitSharePercent, 2),
            IsActive = request.IsActive,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Partners.Add(partner);
        await _context.SaveChangesAsync(ct);

        var summary = await GetSummaryAsync("month", ct);
        return summary.Partners.First(p => p.Id == partner.Id);
    }

    public async Task<PartnerItemSummaryDto> UpdatePartnerAsync(Guid id, UpsertPartnerRequestDto request, CancellationToken ct = default)
    {
        var tenantId = _tenantProvider.CurrentTenantId
            ?? throw new PartnerDomainException("ERR_TENANT_CONTEXT_REQUIRED", 400);

        ValidatePartnerInput(request);

        var partner = await _context.Partners.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new PartnerDomainException("ERR_PARTNER_NOT_FOUND", 404);

        if (request.IsActive)
        {
            await EnsureShareAllocationWithinLimitAsync(tenantId, id, request.ProfitSharePercent, ct);
        }

        partner.Name = request.Name.Trim();
        partner.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        partner.CapitalAmount = Math.Round(Math.Max(0m, request.CapitalAmount), 4);
        partner.ProfitSharePercent = Math.Round(request.ProfitSharePercent, 2);
        partner.IsActive = request.IsActive;
        partner.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        partner.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(ct);

        var summary = await GetSummaryAsync("month", ct);
        return summary.Partners.First(p => p.Id == partner.Id);
    }

    public async Task<PartnerTransactionDto> RecordTransactionAsync(
        Guid partnerId,
        RecordPartnerTransactionRequestDto request,
        string actorIdentifier,
        CancellationToken ct = default)
    {
        var tenantId = _tenantProvider.CurrentTenantId
            ?? throw new PartnerDomainException("ERR_TENANT_CONTEXT_REQUIRED", 400);

        var txType = (request.TransactionType ?? string.Empty).Trim();
        if (txType != PartnerTransactionTypes.Withdrawal &&
            txType != PartnerTransactionTypes.ProfitPayout &&
            txType != PartnerTransactionTypes.CapitalInjection)
        {
            throw new PartnerDomainException("ERR_INVALID_PARTNER_TRANSACTION_TYPE", 400);
        }

        if (request.Amount <= 0m)
        {
            throw new PartnerDomainException("ERR_INVALID_TRANSACTION_AMOUNT", 400);
        }

        await using var dbTx = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        try
        {
            var partner = await _context.Partners.FirstOrDefaultAsync(p => p.Id == partnerId, ct)
                ?? throw new PartnerDomainException("ERR_PARTNER_NOT_FOUND", 404);

            var roundedAmount = Math.Round(request.Amount, 4);
            var now = DateTimeOffset.UtcNow;

            if (txType == PartnerTransactionTypes.CapitalInjection)
            {
                partner.CapitalAmount = Math.Round(partner.CapitalAmount + roundedAmount, 4);
                partner.UpdatedAt = now;
            }

            // Update Treasury CashBox if cash moves between register/safe & partner,
            // strictly WITHOUT inserting into ExpenseVouchers or CashExpenses.
            if (request.DeductFromTreasury)
            {
                var mainCashBox = await _context.CashBoxes.FirstOrDefaultAsync(cb => cb.IsActive, ct);
                if (mainCashBox != null)
                {
                    if (txType == PartnerTransactionTypes.CapitalInjection)
                    {
                        mainCashBox.CurrentBalance = Math.Round(mainCashBox.CurrentBalance + roundedAmount, 4);
                    }
                    else
                    {
                        mainCashBox.CurrentBalance = Math.Round(mainCashBox.CurrentBalance - roundedAmount, 4);
                    }
                    mainCashBox.UpdatedAt = DateTime.UtcNow;
                }
            }

            var entry = new PartnerTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PartnerId = partner.Id,
                TransactionType = txType,
                Amount = roundedAmount,
                Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
                ShiftId = LoyaltyTokenHelper.ResolveShiftGuid(request.ShiftId),
                CreatedBy = ResolveActorGuid(actorIdentifier),
                CreatedAt = now
            };

            _context.PartnerTransactions.Add(entry);
            await _context.SaveChangesAsync(ct);
            await dbTx.CommitAsync(ct);

            return new PartnerTransactionDto
            {
                Id = entry.Id,
                PartnerId = entry.PartnerId,
                PartnerName = partner.Name,
                TransactionType = entry.TransactionType,
                Amount = entry.Amount,
                Notes = entry.Notes,
                ShiftId = entry.ShiftId,
                CreatedBy = entry.CreatedBy,
                CreatedAt = entry.CreatedAt
            };
        }
        catch
        {
            await dbTx.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<PaginatedPartnerTransactionsDto> GetPartnerTransactionsAsync(
        Guid partnerId,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var partner = await _context.Partners
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == partnerId, ct)
            ?? throw new PartnerDomainException("ERR_PARTNER_NOT_FOUND", 404);

        var clampedPage = Math.Max(1, page);
        var clampedSize = Math.Clamp(pageSize, 1, 100);

        var query = _context.PartnerTransactions
            .AsNoTracking()
            .Where(pt => pt.PartnerId == partnerId)
            .OrderByDescending(pt => pt.CreatedAt);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((clampedPage - 1) * clampedSize)
            .Take(clampedSize)
            .Select(pt => new PartnerTransactionDto
            {
                Id = pt.Id,
                PartnerId = pt.PartnerId,
                PartnerName = partner.Name,
                TransactionType = pt.TransactionType,
                Amount = pt.Amount,
                Notes = pt.Notes,
                ShiftId = pt.ShiftId,
                CreatedBy = pt.CreatedBy,
                CreatedAt = pt.CreatedAt
            })
            .ToListAsync(ct);

        return new PaginatedPartnerTransactionsDto
        {
            Items = items,
            TotalCount = totalCount,
            Page = clampedPage,
            PageSize = clampedSize
        };
    }

    private async Task EnsureShareAllocationWithinLimitAsync(
        Guid tenantId,
        Guid? excludingPartnerId,
        decimal requestedSharePercent,
        CancellationToken ct)
    {
        var otherAllocated = await _context.Partners
            .AsNoTracking()
            .Where(p =>
                p.TenantId == tenantId &&
                p.IsActive &&
                (!excludingPartnerId.HasValue || p.Id != excludingPartnerId.Value))
            .SumAsync(p => (decimal?)p.ProfitSharePercent, ct) ?? 0.00m;

        otherAllocated = Math.Round(otherAllocated, 2);
        var roundedRequested = Math.Round(requestedSharePercent, 2);

        if (otherAllocated + roundedRequested > 100.00m)
        {
            throw new PartnerDomainException(
                "ERR_PARTNER_SHARE_EXCEEDS_100",
                400,
                new Dictionary<string, object>
                {
                    ["currentAllocated"] = otherAllocated,
                    ["remainingAvailable"] = Math.Max(0.00m, Math.Round(100.00m - otherAllocated, 2))
                });
        }
    }

    private static void ValidatePartnerInput(UpsertPartnerRequestDto request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Name))
        {
            throw new PartnerDomainException("ERR_PARTNER_NAME_REQUIRED", 400);
        }

        if (request.CapitalAmount < 0m)
        {
            throw new PartnerDomainException("ERR_INVALID_CAPITAL_AMOUNT", 400);
        }

        if (request.ProfitSharePercent <= 0m || request.ProfitSharePercent > 100.00m)
        {
            throw new PartnerDomainException("ERR_INVALID_PARTNER_SHARE", 400);
        }
    }

    private static (string Period, DateTime? Start, DateTime End) ResolvePeriodBounds(string? period)
    {
        var now = DateTime.UtcNow;
        var norm = (period ?? "month").Trim().ToLowerInvariant();
        return norm switch
        {
            "today" => ("today", now.Date, now),
            "week" => ("week", now.Date.AddDays(-6), now),
            "all" => ("all", null, now),
            _ => ("month", new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc), now)
        };
    }

    private static Guid ResolveActorGuid(string actorIdentifier)
    {
        if (Guid.TryParse(actorIdentifier, out var parsed)) return parsed;
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"zilox-actor:{actorIdentifier}"));
        Span<byte> bytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(bytes);
        return new Guid(bytes);
    }
}
