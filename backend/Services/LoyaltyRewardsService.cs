using System.Data;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public sealed class LoyaltyDomainException : Exception
{
    public string ErrorCode { get; }
    public int StatusCode { get; }
    public Dictionary<string, object>? Metadata { get; }

    public LoyaltyDomainException(
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

public interface ILoyaltyRewardsService
{
    Task BackfillCustomerLoyaltyIdentifiersAsync(CancellationToken ct = default);
    Task<List<LoyaltyRewardDto>> GetTenantRewardsAsync(CancellationToken ct = default);
    Task<LoyaltyRewardDto> CreateRewardAsync(UpsertLoyaltyRewardRequestDto request, CancellationToken ct = default);
    Task<LoyaltyRewardDto> UpdateRewardAsync(Guid id, UpsertLoyaltyRewardRequestDto request, CancellationToken ct = default);
    Task<LoyaltyRewardDto> ToggleRewardAsync(Guid id, CancellationToken ct = default);
    Task DeleteRewardAsync(Guid id, CancellationToken ct = default);

    Task<PublicLoyaltyCardDto> GetPublicCardAsync(string token, CancellationToken ct = default);
    Task<PublicLoyaltyCardDto> LookupPublicCardAsync(string? token, string? code, string? phone, CancellationToken ct = default);
    Task<PublicLoyaltyVoucherDto> RedeemPublicRewardAsync(string token, Guid rewardId, CancellationToken ct = default);
    Task<PublicLoyaltyCardDto> CancelPublicVoucherAsync(string token, Guid voucherId, CancellationToken ct = default);

    Task<PosVoucherLookupDto> GetPosVoucherAsync(string code, CancellationToken ct = default);
    Task<List<PosVoucherLookupDto>> GetPendingPosVouchersAsync(Guid? customerId, string? phone, CancellationToken ct = default);
    Task<PosVoucherLookupDto> ClaimPosVoucherAsync(string code, ClaimPosVoucherRequestDto request, string actorName, CancellationToken ct = default);
}

public class LoyaltyRewardsService : ILoyaltyRewardsService
{
    private readonly AppDbContext _context;
    private readonly ITenantProvider _tenantProvider;
    private readonly IConnectionMultiplexer? _redis;

    public LoyaltyRewardsService(
        AppDbContext context,
        ITenantProvider tenantProvider,
        IConnectionMultiplexer? redis = null)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _redis = redis;
    }

    public async Task BackfillCustomerLoyaltyIdentifiersAsync(CancellationToken ct = default)
    {
        var registeredMissing = await _context.Customers
            .IgnoreQueryFilters()
            .Where(c => !c.IsDefaultCashCustomer
                        && c.Code != "WALK-IN-CASH"
                        && (string.IsNullOrEmpty(c.LoyaltyMemberCode)
                            || string.IsNullOrEmpty(c.LoyaltyCardToken)
                            || (c.Phone != null && c.Phone != "" && string.IsNullOrEmpty(c.NormalizedPhone))))
            .ToListAsync(ct);

        if (registeredMissing.Count == 0) return;

        var usedCodes = new HashSet<string>(
            await _context.Customers
                .IgnoreQueryFilters()
                .Where(c => c.LoyaltyMemberCode != null)
                .Select(c => c.LoyaltyMemberCode!)
                .ToListAsync(ct),
            StringComparer.OrdinalIgnoreCase);

        foreach (var cust in registeredMissing)
        {
            if (string.IsNullOrWhiteSpace(cust.LoyaltyMemberCode))
            {
                string candidate;
                do
                {
                    candidate = LoyaltyTokenHelper.GenerateMemberCode();
                } while (!usedCodes.Add(candidate));
                cust.LoyaltyMemberCode = candidate;
            }

            if (string.IsNullOrWhiteSpace(cust.LoyaltyCardToken))
            {
                cust.LoyaltyCardToken = LoyaltyTokenHelper.GenerateUrlSafeCardToken();
            }

            if (!string.IsNullOrWhiteSpace(cust.Phone) && string.IsNullOrWhiteSpace(cust.NormalizedPhone))
            {
                cust.NormalizedPhone = LoyaltyTokenHelper.NormalizePhone(cust.Phone);
            }
        }

        await _context.SaveChangesAsync(ct);
    }

    public async Task<List<LoyaltyRewardDto>> GetTenantRewardsAsync(CancellationToken ct = default)
    {
        var rewards = await _context.LoyaltyRewards
            .Include(r => r.Product)
            .AsNoTracking()
            .Where(r => !r.IsDeleted)
            .OrderBy(r => r.DisplayOrder)
            .ThenByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        var productIds = rewards
            .Where(r => r.ProductId.HasValue)
            .Select(r => r.ProductId!.Value)
            .Distinct()
            .ToList();

        var stockByProduct = await LoadAvailableStockByProductAsync(productIds, _tenantProvider.CurrentTenantId, ct);

        return rewards.Select(r => MapRewardDto(r, stockByProduct)).ToList();
    }

    public async Task<LoyaltyRewardDto> CreateRewardAsync(UpsertLoyaltyRewardRequestDto request, CancellationToken ct = default)
    {
        var tenantId = _tenantProvider.CurrentTenantId
            ?? throw new LoyaltyDomainException("ERR_TENANT_CONTEXT_REQUIRED", 400);

        if (string.IsNullOrWhiteSpace(request.Title) || request.PointsCost <= 0m)
        {
            throw new LoyaltyDomainException("ERR_INVALID_REWARD_CONFIG", 400);
        }

        Product? linkedProduct = null;
        if (request.ProductId.HasValue)
        {
            linkedProduct = await _context.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.ProductId.Value && p.TenantId == tenantId, ct)
                ?? throw new LoyaltyDomainException("ERR_PRODUCT_NOT_FOUND", 404);
        }

        var now = DateTimeOffset.UtcNow;
        var reward = new LoyaltyReward
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
            PointsCost = Math.Round(request.PointsCost, 4),
            ProductId = linkedProduct?.Id,
            IsActive = request.IsActive,
            DisplayOrder = request.DisplayOrder,
            IsDeleted = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.LoyaltyRewards.Add(reward);
        await _context.SaveChangesAsync(ct);

        reward.Product = linkedProduct;
        var stockByProduct = linkedProduct != null
            ? await LoadAvailableStockByProductAsync(new List<Guid> { linkedProduct.Id }, tenantId, ct)
            : new Dictionary<Guid, int>();

        return MapRewardDto(reward, stockByProduct);
    }

    public async Task<LoyaltyRewardDto> UpdateRewardAsync(Guid id, UpsertLoyaltyRewardRequestDto request, CancellationToken ct = default)
    {
        var tenantId = _tenantProvider.CurrentTenantId
            ?? throw new LoyaltyDomainException("ERR_TENANT_CONTEXT_REQUIRED", 400);

        if (string.IsNullOrWhiteSpace(request.Title) || request.PointsCost <= 0m)
        {
            throw new LoyaltyDomainException("ERR_INVALID_REWARD_CONFIG", 400);
        }

        var reward = await _context.LoyaltyRewards
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct)
            ?? throw new LoyaltyDomainException("ERR_REWARD_NOT_FOUND", 404);

        Product? linkedProduct = null;
        if (request.ProductId.HasValue)
        {
            linkedProduct = await _context.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.ProductId.Value && p.TenantId == tenantId, ct)
                ?? throw new LoyaltyDomainException("ERR_PRODUCT_NOT_FOUND", 404);
        }

        reward.Title = request.Title.Trim();
        reward.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        reward.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
        reward.PointsCost = Math.Round(request.PointsCost, 4);
        reward.ProductId = linkedProduct?.Id;
        reward.IsActive = request.IsActive;
        reward.DisplayOrder = request.DisplayOrder;
        reward.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(ct);

        reward.Product = linkedProduct;
        var stockByProduct = linkedProduct != null
            ? await LoadAvailableStockByProductAsync(new List<Guid> { linkedProduct.Id }, tenantId, ct)
            : new Dictionary<Guid, int>();

        return MapRewardDto(reward, stockByProduct);
    }

    public async Task<LoyaltyRewardDto> ToggleRewardAsync(Guid id, CancellationToken ct = default)
    {
        var reward = await _context.LoyaltyRewards
            .Include(r => r.Product)
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct)
            ?? throw new LoyaltyDomainException("ERR_REWARD_NOT_FOUND", 404);

        reward.IsActive = !reward.IsActive;
        reward.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(ct);

        var stockByProduct = reward.ProductId.HasValue
            ? await LoadAvailableStockByProductAsync(new List<Guid> { reward.ProductId.Value }, reward.TenantId, ct)
            : new Dictionary<Guid, int>();

        return MapRewardDto(reward, stockByProduct);
    }

    public async Task DeleteRewardAsync(Guid id, CancellationToken ct = default)
    {
        var reward = await _context.LoyaltyRewards
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct)
            ?? throw new LoyaltyDomainException("ERR_REWARD_NOT_FOUND", 404);

        reward.IsDeleted = true;
        reward.IsActive = false;
        reward.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(ct);
    }

    private async Task<Customer?> ResolvePublicCustomerEntityAsync(string rawTokenOrCode, bool asNoTracking, CancellationToken ct)
    {
        var lookup = LoyaltyTokenHelper.ExtractLookupToken(rawTokenOrCode);
        if (string.IsNullOrWhiteSpace(lookup)) return null;

        var lookupUpper = lookup.ToUpperInvariant();
        IQueryable<Customer> query = _context.Customers.IgnoreQueryFilters();
        if (asNoTracking) query = query.AsNoTracking();

        return await query.FirstOrDefaultAsync(c =>
            c.IsActive &&
            !c.IsDefaultCashCustomer &&
            c.Code != "WALK-IN-CASH" &&
            (c.LoyaltyCardToken == lookup ||
             (c.LoyaltyMemberCode != null && c.LoyaltyMemberCode.ToUpper() == lookupUpper)), ct);
    }

    public async Task<PublicLoyaltyCardDto> LookupPublicCardAsync(string? token, string? code, string? phone, CancellationToken ct = default)
    {
        var candidate = !string.IsNullOrWhiteSpace(token) ? token : code;
        if (!string.IsNullOrWhiteSpace(candidate))
        {
            return await GetPublicCardAsync(candidate, ct);
        }

        if (!string.IsNullOrWhiteSpace(phone))
        {
            var rawPhone = phone.Trim();
            var normPhone = LoyaltyTokenHelper.NormalizePhone(rawPhone);
            var customer = await _context.Customers
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(c =>
                    c.IsActive &&
                    !c.IsDefaultCashCustomer &&
                    c.Code != "WALK-IN-CASH" &&
                    ((!string.IsNullOrEmpty(normPhone) && c.NormalizedPhone == normPhone) ||
                     (c.Phone != null && c.Phone == rawPhone)), ct)
                ?? throw new LoyaltyDomainException("ERR_LOYALTY_CARD_NOT_FOUND", 404);

            var resolvedKey = !string.IsNullOrWhiteSpace(customer.LoyaltyCardToken)
                ? customer.LoyaltyCardToken
                : customer.LoyaltyMemberCode ?? string.Empty;

            return await GetPublicCardAsync(resolvedKey, ct);
        }

        throw new LoyaltyDomainException("ERR_LOYALTY_CARD_NOT_FOUND", 404);
    }

    public async Task<PublicLoyaltyCardDto> GetPublicCardAsync(string token, CancellationToken ct = default)
    {
        var customer = await ResolvePublicCustomerEntityAsync(token, asNoTracking: true, ct)
            ?? throw new LoyaltyDomainException("ERR_LOYALTY_CARD_NOT_FOUND", 404);

        var resolvedToken = string.IsNullOrWhiteSpace(customer.LoyaltyCardToken)
            ? (customer.LoyaltyMemberCode ?? LoyaltyTokenHelper.ExtractLookupToken(token))
            : customer.LoyaltyCardToken;

        Tenant? tenant = null;
        if (customer.TenantId.HasValue && customer.TenantId.Value != Guid.Empty)
        {
            tenant = await _context.Tenants
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == customer.TenantId.Value && t.IsActive, ct);
        }
        if (tenant == null)
        {
            tenant = await _context.Tenants
                .AsNoTracking()
                .Where(t => t.IsActive)
                .OrderBy(t => t.CreatedAt)
                .FirstOrDefaultAsync(ct)
                ?? throw new LoyaltyDomainException("ERR_TENANT_NOT_FOUND", 404);
        }

        var tenantId = tenant.Id;

        var settings = await _context.LoyaltySettings
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(ls => ls.TenantId == tenantId, ct);

        bool isLoyaltyEnabled = settings?.IsLoyaltyEnabled ?? true;

        var transactions = await _context.LoyaltyTransactions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(lt => lt.TenantId == tenantId && lt.CustomerId == customer.Id)
            .OrderByDescending(lt => lt.CreatedAt)
            .Take(10)
            .Select(lt => new PublicLoyaltyTransactionDto
            {
                Id = lt.Id,
                Type = lt.Type,
                PointsChange = lt.PointsChange,
                BalanceAfter = lt.BalanceAfter,
                Notes = lt.Notes,
                CreatedAt = lt.CreatedAt
            })
            .ToListAsync(ct);

        var activeVouchers = await _context.LoyaltyRedemptionVouchers
            .IgnoreQueryFilters()
            .Include(v => v.Reward)
            .AsNoTracking()
            .Where(v => v.TenantId == tenantId &&
                        v.CustomerId == customer.Id &&
                        v.Status == LoyaltyRedemptionStatuses.PendingPickup)
            .OrderByDescending(v => v.CreatedAt)
            .Select(v => new PublicLoyaltyVoucherDto
            {
                Id = v.Id,
                RewardId = v.RewardId,
                VoucherCode = v.VoucherCode,
                RewardTitle = v.Reward != null ? v.Reward.Title : string.Empty,
                RewardImageUrl = v.Reward != null ? v.Reward.ImageUrl : null,
                PointsSpent = v.PointsSpent,
                Status = v.Status,
                CreatedAt = v.CreatedAt
            })
            .ToListAsync(ct);

        var rewards = await _context.LoyaltyRewards
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.IsActive && !r.IsDeleted)
            .OrderBy(r => r.DisplayOrder)
            .ThenBy(r => r.PointsCost)
            .ToListAsync(ct);

        var productIds = rewards
            .Where(r => r.ProductId.HasValue)
            .Select(r => r.ProductId!.Value)
            .Distinct()
            .ToList();

        var stockByProduct = await LoadAvailableStockByProductAsync(productIds, tenantId, ct);

        var publicRewards = rewards.Select(r =>
        {
            bool inStock = !r.ProductId.HasValue ||
                           (stockByProduct.TryGetValue(r.ProductId.Value, out var avail) && avail >= 1);
            return new PublicLoyaltyRewardItemDto
            {
                Id = r.Id,
                Title = r.Title,
                Description = r.Description,
                ImageUrl = r.ImageUrl,
                PointsCost = r.PointsCost,
                InStock = inStock,
                DisplayOrder = r.DisplayOrder
            };
        }).ToList();

        // Cross-store switcher: strictly return ONLY StoreName, StoreLogo, and CardToken for active matching phone
        var storeCards = new List<StoreCardSummaryDto>();
        if (!string.IsNullOrWhiteSpace(customer.NormalizedPhone))
        {
            storeCards = await (
                from c in _context.Customers.IgnoreQueryFilters().AsNoTracking()
                join t in _context.Tenants.AsNoTracking() on c.TenantId equals t.Id
                where c.NormalizedPhone == customer.NormalizedPhone
                      && c.IsActive
                      && !c.IsDefaultCashCustomer
                      && c.Code != "WALK-IN-CASH"
                      && c.LoyaltyCardToken != null
                      && t.IsActive
                orderby (c.Id == customer.Id ? 0 : 1), t.Name
                select new StoreCardSummaryDto
                {
                    StoreName = t.Name,
                    StoreLogo = t.LogoUrl,
                    CardToken = c.LoyaltyCardToken!
                }
            ).ToListAsync(ct);
        }

        if (storeCards.Count == 0)
        {
            storeCards.Add(new StoreCardSummaryDto
            {
                StoreName = tenant.Name,
                StoreLogo = tenant.LogoUrl,
                CardToken = resolvedToken
            });
        }

        return new PublicLoyaltyCardDto
        {
            StoreName = tenant.Name,
            StoreLogo = tenant.LogoUrl,
            CustomerName = customer.Name,
            LoyaltyMemberCode = customer.LoyaltyMemberCode ?? string.Empty,
            LoyaltyCardToken = resolvedToken,
            LoyaltyPointsBalance = customer.LoyaltyPointsBalance,
            IsLoyaltyEnabled = isLoyaltyEnabled,
            RecentTransactions = transactions,
            ActiveVouchers = activeVouchers,
            Rewards = publicRewards,
            StoreCards = storeCards
        };
    }

    public async Task<PublicLoyaltyVoucherDto> RedeemPublicRewardAsync(string token, Guid rewardId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new LoyaltyDomainException("ERR_LOYALTY_CARD_NOT_FOUND", 404);
        }

        await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        try
        {
            var customer = await ResolvePublicCustomerEntityAsync(token, asNoTracking: false, ct)
                ?? throw new LoyaltyDomainException("ERR_LOYALTY_CARD_NOT_FOUND", 404);

            var tenantId = customer.TenantId
                ?? (await _context.Tenants.AsNoTracking().Where(t => t.IsActive).OrderBy(t => t.CreatedAt).Select(t => (Guid?)t.Id).FirstOrDefaultAsync(ct))
                ?? throw new LoyaltyDomainException("ERR_TENANT_NOT_FOUND", 404);

            var settings = await _context.LoyaltySettings
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(ls => ls.TenantId == tenantId, ct);

            if (settings != null && !settings.IsLoyaltyEnabled)
            {
                throw new LoyaltyDomainException("ERR_LOYALTY_DISABLED", 400);
            }

            var reward = await _context.LoyaltyRewards
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(r =>
                    r.Id == rewardId &&
                    r.TenantId == tenantId &&
                    r.IsActive &&
                    !r.IsDeleted, ct)
                ?? throw new LoyaltyDomainException("ERR_REWARD_NOT_FOUND", 404);

            if (reward.ProductId.HasValue)
            {
                var stockByProduct = await LoadAvailableStockByProductAsync(new List<Guid> { reward.ProductId.Value }, tenantId, ct);
                if (!stockByProduct.TryGetValue(reward.ProductId.Value, out var available) || available < 1)
                {
                    throw new LoyaltyDomainException("ERR_REWARD_OUT_OF_STOCK", 400);
                }
            }

            if (customer.LoyaltyPointsBalance < reward.PointsCost)
            {
                throw new LoyaltyDomainException(
                    "ERR_INSUFFICIENT_LOYALTY_POINTS",
                    400,
                    new Dictionary<string, object>
                    {
                        { "available", customer.LoyaltyPointsBalance },
                        { "required", reward.PointsCost }
                    });
            }

            var nowUtc = DateTime.UtcNow;
            var nowOffset = DateTimeOffset.UtcNow;

            customer.LoyaltyPointsBalance = Math.Round(customer.LoyaltyPointsBalance - reward.PointsCost, 4);
            customer.UpdatedAt = nowUtc;

            string voucherCode;
            do
            {
                voucherCode = LoyaltyTokenHelper.GenerateVoucherCode();
            } while (await _context.LoyaltyRedemptionVouchers
                .IgnoreQueryFilters()
                .AnyAsync(v => v.VoucherCode == voucherCode, ct));

            var voucher = new LoyaltyRedemptionVoucher
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CustomerId = customer.Id,
                RewardId = reward.Id,
                VoucherCode = voucherCode,
                PointsSpent = reward.PointsCost,
                Status = LoyaltyRedemptionStatuses.PendingPickup,
                CreatedAt = nowOffset
            };

            _context.LoyaltyRedemptionVouchers.Add(voucher);

            _context.LoyaltyTransactions.Add(new LoyaltyTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CustomerId = customer.Id,
                Type = LoyaltyTransactionTypes.Redeemed,
                PointsChange = -reward.PointsCost,
                ProfitBasis = 0.0000m,
                BalanceAfter = customer.LoyaltyPointsBalance,
                Notes = $"{voucherCode}: {reward.Title}",
                CreatedBy = "CustomerWallet",
                CreatedAt = nowUtc
            });

            await _context.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return new PublicLoyaltyVoucherDto
            {
                Id = voucher.Id,
                RewardId = reward.Id,
                VoucherCode = voucher.VoucherCode,
                RewardTitle = reward.Title,
                RewardImageUrl = reward.ImageUrl,
                PointsSpent = voucher.PointsSpent,
                Status = voucher.Status,
                CreatedAt = voucher.CreatedAt
            };
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<PublicLoyaltyCardDto> CancelPublicVoucherAsync(string token, Guid voucherId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new LoyaltyDomainException("ERR_LOYALTY_CARD_NOT_FOUND", 404);
        }

        string returnLookupKey = LoyaltyTokenHelper.ExtractLookupToken(token);
        await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        try
        {
            var customer = await ResolvePublicCustomerEntityAsync(token, asNoTracking: false, ct)
                ?? throw new LoyaltyDomainException("ERR_LOYALTY_CARD_NOT_FOUND", 404);

            returnLookupKey = string.IsNullOrWhiteSpace(customer.LoyaltyCardToken)
                ? (customer.LoyaltyMemberCode ?? returnLookupKey)
                : customer.LoyaltyCardToken;

            var tenantId = customer.TenantId
                ?? (await _context.Tenants.AsNoTracking().Where(t => t.IsActive).OrderBy(t => t.CreatedAt).Select(t => (Guid?)t.Id).FirstOrDefaultAsync(ct))
                ?? throw new LoyaltyDomainException("ERR_TENANT_NOT_FOUND", 404);

            var voucher = await _context.LoyaltyRedemptionVouchers
                .IgnoreQueryFilters()
                .Include(v => v.Reward)
                .FirstOrDefaultAsync(v =>
                    v.Id == voucherId &&
                    v.TenantId == tenantId &&
                    v.CustomerId == customer.Id, ct)
                ?? throw new LoyaltyDomainException("ERR_VOUCHER_NOT_FOUND", 404);

            if (!string.Equals(voucher.Status, LoyaltyRedemptionStatuses.PendingPickup, StringComparison.Ordinal))
            {
                throw new LoyaltyDomainException("ERR_VOUCHER_INVALID_OR_CLAIMED", 400);
            }

            var nowUtc = DateTime.UtcNow;
            voucher.Status = LoyaltyRedemptionStatuses.Cancelled;
            customer.LoyaltyPointsBalance = Math.Round(customer.LoyaltyPointsBalance + voucher.PointsSpent, 4);
            customer.UpdatedAt = nowUtc;

            _context.LoyaltyTransactions.Add(new LoyaltyTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CustomerId = customer.Id,
                Type = LoyaltyTransactionTypes.Refunded,
                PointsChange = voucher.PointsSpent,
                ProfitBasis = 0.0000m,
                BalanceAfter = customer.LoyaltyPointsBalance,
                Notes = $"{voucher.VoucherCode}: {voucher.Reward?.Title ?? string.Empty}",
                CreatedBy = "CustomerWallet",
                CreatedAt = nowUtc
            });

            await _context.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }

        return await GetPublicCardAsync(returnLookupKey, ct);
    }

    public async Task<PosVoucherLookupDto> GetPosVoucherAsync(string code, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new LoyaltyDomainException("ERR_VOUCHER_NOT_FOUND", 404);
        }

        var normCode = code.Trim().ToUpperInvariant();
        var voucher = await _context.LoyaltyRedemptionVouchers
            .Include(v => v.Customer)
            .Include(v => v.Reward)
            .ThenInclude(r => r!.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.VoucherCode.ToUpper() == normCode, ct)
            ?? throw new LoyaltyDomainException("ERR_VOUCHER_NOT_FOUND", 404);

        bool inStock = true;
        if (voucher.Reward?.ProductId.HasValue == true)
        {
            var stockByProduct = await LoadAvailableStockByProductAsync(
                new List<Guid> { voucher.Reward.ProductId.Value },
                voucher.TenantId,
                ct);
            inStock = stockByProduct.TryGetValue(voucher.Reward.ProductId.Value, out var avail) && avail >= 1;
        }

        return MapPosVoucherDto(voucher, inStock);
    }

    public async Task<List<PosVoucherLookupDto>> GetPendingPosVouchersAsync(
        Guid? customerId,
        string? phone,
        CancellationToken ct = default)
    {
        if (!customerId.HasValue && string.IsNullOrWhiteSpace(phone))
        {
            return new List<PosVoucherLookupDto>();
        }

        var query = _context.LoyaltyRedemptionVouchers
            .Include(v => v.Customer)
            .Include(v => v.Reward)
            .ThenInclude(r => r!.Product)
            .AsNoTracking()
            .Where(v => v.Status == LoyaltyRedemptionStatuses.PendingPickup);

        if (customerId.HasValue && customerId.Value != Guid.Empty)
        {
            query = query.Where(v => v.CustomerId == customerId.Value);
        }
        else if (!string.IsNullOrWhiteSpace(phone))
        {
            var rawPhone = phone.Trim();
            var normPhone = LoyaltyTokenHelper.NormalizePhone(rawPhone);
            query = query.Where(v =>
                v.Customer != null &&
                ((!string.IsNullOrEmpty(normPhone) && v.Customer.NormalizedPhone == normPhone) ||
                 (v.Customer.Phone != null && v.Customer.Phone.Contains(rawPhone))));
        }

        var vouchers = await query
            .OrderByDescending(v => v.CreatedAt)
            .Take(25)
            .ToListAsync(ct);

        if (vouchers.Count == 0) return new List<PosVoucherLookupDto>();

        var productIds = vouchers
            .Where(v => v.Reward?.ProductId.HasValue == true)
            .Select(v => v.Reward!.ProductId!.Value)
            .Distinct()
            .ToList();

        var stockByProduct = await LoadAvailableStockByProductAsync(productIds, _tenantProvider.CurrentTenantId, ct);

        return vouchers.Select(v =>
        {
            bool inStock = true;
            if (v.Reward?.ProductId.HasValue == true)
            {
                inStock = stockByProduct.TryGetValue(v.Reward.ProductId.Value, out var avail) && avail >= 1;
            }
            return MapPosVoucherDto(v, inStock);
        }).ToList();
    }

    public async Task<PosVoucherLookupDto> ClaimPosVoucherAsync(
        string code,
        ClaimPosVoucherRequestDto request,
        string actorName,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ShiftId))
        {
            throw new LoyaltyDomainException("ERR_NO_ACTIVE_SHIFT", 400);
        }

        var tenantId = _tenantProvider.CurrentTenantId
            ?? throw new LoyaltyDomainException("ERR_TENANT_CONTEXT_REQUIRED", 400);

        if (string.IsNullOrWhiteSpace(code))
        {
            throw new LoyaltyDomainException("ERR_VOUCHER_NOT_FOUND", 404);
        }

        var normCode = code.Trim().ToUpperInvariant();

        // Preload voucher to check if Redis lock on productId is needed
        var voucherPreview = await _context.LoyaltyRedemptionVouchers
            .Include(v => v.Reward)
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.VoucherCode.ToUpper() == normCode, ct)
            ?? throw new LoyaltyDomainException("ERR_VOUCHER_NOT_FOUND", 404);

        if (!string.Equals(voucherPreview.Status, LoyaltyRedemptionStatuses.PendingPickup, StringComparison.Ordinal))
        {
            throw new LoyaltyDomainException("ERR_VOUCHER_INVALID_OR_CLAIMED", 400);
        }

        Guid? lockedProductId = voucherPreview.Reward?.ProductId;
        IDatabase? redisDb = _redis?.GetDatabase();
        string? lockKey = lockedProductId.HasValue ? $"lock:item:{lockedProductId.Value}" : null;
        string lockToken = Guid.NewGuid().ToString("N");
        bool lockAcquired = false;

        if (redisDb != null && lockKey != null)
        {
            lockAcquired = await redisDb.LockTakeAsync(lockKey, lockToken, TimeSpan.FromSeconds(5));
            if (!lockAcquired)
            {
                throw new LoyaltyDomainException("ERR_CONCURRENCY_LOCK_TIMEOUT", 409);
            }
        }

        try
        {
            await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
            try
            {
                var voucher = await _context.LoyaltyRedemptionVouchers
                    .Include(v => v.Customer)
                    .Include(v => v.Reward)
                    .ThenInclude(r => r!.Product)
                    .FirstOrDefaultAsync(v => v.VoucherCode.ToUpper() == normCode, ct)
                    ?? throw new LoyaltyDomainException("ERR_VOUCHER_NOT_FOUND", 404);

                if (!string.Equals(voucher.Status, LoyaltyRedemptionStatuses.PendingPickup, StringComparison.Ordinal))
                {
                    throw new LoyaltyDomainException("ERR_VOUCHER_INVALID_OR_CLAIMED", 400);
                }

                if (voucher.Reward?.ProductId.HasValue == true)
                {
                    var productId = voucher.Reward.ProductId.Value;

                    IQueryable<WarehouseStock> stockQuery = _context.WarehouseStocks
                        .Include(ws => ws.Warehouse)
                        .Where(ws =>
                            ws.ProductId == productId &&
                            ws.Warehouse != null &&
                            ws.Warehouse.IsActive &&
                            (ws.Quantity - ws.ReservedQuantity) >= 1);

                    if (request.WarehouseId.HasValue && request.WarehouseId.Value != Guid.Empty)
                    {
                        stockQuery = stockQuery.OrderByDescending(ws => ws.WarehouseId == request.WarehouseId.Value ? 1 : 0)
                            .ThenByDescending(ws => ws.Quantity - ws.ReservedQuantity);
                    }
                    else
                    {
                        stockQuery = stockQuery.OrderByDescending(ws => ws.Quantity - ws.ReservedQuantity);
                    }

                    var targetStock = await stockQuery.FirstOrDefaultAsync(ct);
                    if (targetStock == null)
                    {
                        throw new LoyaltyDomainException("ERR_REWARD_OUT_OF_STOCK", 400);
                    }

                    targetStock.Quantity -= 1;
                    targetStock.LastCountedAt = DateTime.UtcNow;

                    var movement = new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        MovementNumber = $"MOV-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}",
                        MovementType = "OUT",
                        FromWarehouseId = targetStock.WarehouseId,
                        ToWarehouseId = null,
                        ReferenceNumber = voucher.VoucherCode,
                        ReferenceType = "LoyaltyRewardRedemption",
                        Notes = $"{voucher.VoucherCode}: {voucher.Reward.Title}",
                        CreatedBy = string.IsNullOrWhiteSpace(request.ActorName) ? actorName : request.ActorName.Trim(),
                        MovementDate = DateTime.UtcNow,
                        Items = new List<StockMovementItem>
                        {
                            new StockMovementItem
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                ProductId = productId,
                                Quantity = 1,
                                UnitCost = voucher.Reward.Product?.CostPrice ?? 0m
                            }
                        }
                    };

                    _context.StockMovements.Add(movement);
                }

                voucher.Status = LoyaltyRedemptionStatuses.Claimed;
                voucher.ClaimedAt = DateTimeOffset.UtcNow;
                voucher.ClaimedByShiftId = LoyaltyTokenHelper.ResolveShiftGuid(request.ShiftId);

                await _context.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);

                bool remainingInStock = true;
                if (voucher.Reward?.ProductId.HasValue == true)
                {
                    var stockByProduct = await LoadAvailableStockByProductAsync(
                        new List<Guid> { voucher.Reward.ProductId.Value },
                        voucher.TenantId,
                        ct);
                    remainingInStock = stockByProduct.TryGetValue(voucher.Reward.ProductId.Value, out var avail) && avail >= 1;
                }

                return MapPosVoucherDto(voucher, remainingInStock);
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }
        finally
        {
            if (redisDb != null && lockKey != null && lockAcquired)
            {
                try
                {
                    await redisDb.LockReleaseAsync(lockKey, lockToken);
                }
                catch
                {
                    // Safe lock release guard
                }
            }
        }
    }

    private async Task<Dictionary<Guid, int>> LoadAvailableStockByProductAsync(
        List<Guid> productIds,
        Guid? tenantId,
        CancellationToken ct)
    {
        if (productIds.Count == 0) return new Dictionary<Guid, int>();

        var rows = await _context.WarehouseStocks
            .IgnoreQueryFilters()
            .Include(ws => ws.Warehouse)
            .AsNoTracking()
            .Where(ws =>
                productIds.Contains(ws.ProductId) &&
                ws.Warehouse != null &&
                ws.Warehouse.IsActive &&
                (!tenantId.HasValue || ws.Warehouse.TenantId == tenantId))
            .GroupBy(ws => ws.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                Available = g.Sum(x => x.Quantity - x.ReservedQuantity)
            })
            .ToListAsync(ct);

        return rows.ToDictionary(r => r.ProductId, r => Math.Max(0, r.Available));
    }

    private static LoyaltyRewardDto MapRewardDto(LoyaltyReward r, Dictionary<Guid, int> stockByProduct)
    {
        int stockQty = r.ProductId.HasValue && stockByProduct.TryGetValue(r.ProductId.Value, out var avail)
            ? avail
            : 0;
        bool inStock = !r.ProductId.HasValue || stockQty >= 1;

        return new LoyaltyRewardDto
        {
            Id = r.Id,
            Title = r.Title,
            Description = r.Description,
            ImageUrl = r.ImageUrl,
            PointsCost = r.PointsCost,
            ProductId = r.ProductId,
            ProductName = r.Product?.Name,
            LiveStockQuantity = stockQty,
            InStock = inStock,
            IsActive = r.IsActive,
            DisplayOrder = r.DisplayOrder,
            CreatedAt = r.CreatedAt
        };
    }

    private static PosVoucherLookupDto MapPosVoucherDto(LoyaltyRedemptionVoucher v, bool inStock) => new()
    {
        Id = v.Id,
        VoucherCode = v.VoucherCode,
        Status = v.Status,
        PointsSpent = v.PointsSpent,
        CreatedAt = v.CreatedAt,
        ClaimedAt = v.ClaimedAt,
        CustomerId = v.CustomerId,
        CustomerName = v.Customer?.Name ?? string.Empty,
        CustomerPhone = v.Customer?.Phone,
        LoyaltyMemberCode = v.Customer?.LoyaltyMemberCode,
        RewardId = v.RewardId,
        RewardTitle = v.Reward?.Title ?? string.Empty,
        RewardDescription = v.Reward?.Description,
        RewardImageUrl = v.Reward?.ImageUrl,
        ProductId = v.Reward?.ProductId,
        ProductName = v.Reward?.Product?.Name,
        InStock = inStock
    };
}
