using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface ITenantPlanService
{
    Task<TenantSubscriptionDto?> GetSubscriptionAsync(Guid tenantId, CancellationToken ct = default);
    Task<FeatureCheckResult> CheckFeatureAccessAsync(Guid? tenantId, string featureKey, CancellationToken ct = default);
    Task<QuotaCheckResult> CheckUserQuotaAsync(Guid tenantId, CancellationToken ct = default);
    Task<QuotaCheckResult> CheckWarehouseQuotaAsync(Guid tenantId, CancellationToken ct = default);
    Task<QuotaCheckResult> CheckBranchQuotaAsync(Guid tenantId, CancellationToken ct = default);
    Task<TenantSubscriptionDto?> UpdateSubscriptionAsync(
        Guid tenantId,
        SubscriptionPlan plan,
        BillingCycle billingCycle,
        DateTime? expiresAt,
        CancellationToken ct = default);
    Dictionary<string, bool> BuildFeatureDictionary(SubscriptionPlan plan);
    PlanQuotasDto GetPlanQuotas(SubscriptionPlan plan);
    SubscriptionPlan GetRequiredPlanForFeature(string featureKey);
    SubscriptionPlan ResolveEffectivePlan(Tenant? tenant);
    BillingCycle ResolveEffectiveBillingCycle(Tenant? tenant);
}

public class TenantPlanService : ITenantPlanService
{
    private static readonly HashSet<string> StarterFeatures = new(StringComparer.OrdinalIgnoreCase)
    {
        PlanFeatureKeys.Pos,
        PlanFeatureKeys.Shifts,
        PlanFeatureKeys.CashAndCreditSales,
        PlanFeatureKeys.Returns,
        PlanFeatureKeys.Purchases,
        PlanFeatureKeys.Suppliers,
        PlanFeatureKeys.BasicInventoryAndFifo,
        PlanFeatureKeys.SingleCashbox,
        PlanFeatureKeys.Expenses,
        PlanFeatureKeys.Vouchers,
        PlanFeatureKeys.SecurityAndCostMasking,
        PlanFeatureKeys.BasicReports,
        PlanFeatureKeys.CashRounding250
    };

    private static readonly HashSet<string> ProOnlyFeatures = new(StringComparer.OrdinalIgnoreCase)
    {
        PlanFeatureKeys.Installments,
        PlanFeatureKeys.VolumePricingAndBundles,
        PlanFeatureKeys.Quotations,
        PlanFeatureKeys.PartnersAndProfitShare,
        PlanFeatureKeys.LoyaltyPoints,
        PlanFeatureKeys.MultiCurrency,
        PlanFeatureKeys.MultipleBanksAndCashboxes,
        PlanFeatureKeys.ShelvesOrganizer,
        PlanFeatureKeys.SerialTracking,
        PlanFeatureKeys.AiExecutiveAdvisor,
        PlanFeatureKeys.WarehouseTransfers,
        PlanFeatureKeys.SelfServiceBackup,
        PlanFeatureKeys.AuditLog
    };

    private static readonly HashSet<string> EnterpriseOnlyFeatures = new(StringComparer.OrdinalIgnoreCase)
    {
        PlanFeatureKeys.MultiBranch,
        PlanFeatureKeys.PurchaseOrders,
        PlanFeatureKeys.DispatchOrders,
        PlanFeatureKeys.OfficialExportReports
    };

    private readonly AppDbContext _context;
    private readonly IConnectionMultiplexer? _redis;
    private readonly ILogger<TenantPlanService> _logger;

    public TenantPlanService(
        AppDbContext context,
        ILogger<TenantPlanService> logger,
        IConnectionMultiplexer? redis = null)
    {
        _context = context;
        _logger = logger;
        _redis = redis;
    }

    public PlanQuotasDto GetPlanQuotas(SubscriptionPlan plan) => plan switch
    {
        SubscriptionPlan.Starter => new PlanQuotasDto(MaxBranches: 1, MaxWarehouses: 1, MaxUsers: 2, MonthlyAiRequests: 0),
        SubscriptionPlan.Pro => new PlanQuotasDto(MaxBranches: 1, MaxWarehouses: 3, MaxUsers: 6, MonthlyAiRequests: 150),
        SubscriptionPlan.Enterprise => new PlanQuotasDto(MaxBranches: null, MaxWarehouses: null, MaxUsers: null, MonthlyAiRequests: 1000),
        _ => new PlanQuotasDto(MaxBranches: 1, MaxWarehouses: 3, MaxUsers: 6, MonthlyAiRequests: 150)
    };

    public SubscriptionPlan GetRequiredPlanForFeature(string featureKey)
    {
        if (StarterFeatures.Contains(featureKey))
        {
            return SubscriptionPlan.Starter;
        }
        if (EnterpriseOnlyFeatures.Contains(featureKey))
        {
            return SubscriptionPlan.Enterprise;
        }
        if (ProOnlyFeatures.Contains(featureKey))
        {
            return SubscriptionPlan.Pro;
        }
        return SubscriptionPlan.Starter;
    }

    public Dictionary<string, bool> BuildFeatureDictionary(SubscriptionPlan plan)
    {
        var dict = new Dictionary<string, bool>(StringComparer.Ordinal);
        foreach (var key in PlanFeatureKeys.AllKeys)
        {
            var required = GetRequiredPlanForFeature(key);
            dict[key] = (int)plan >= (int)required;
        }
        return dict;
    }

    public SubscriptionPlan ResolveEffectivePlan(Tenant? tenant)
    {
        if (tenant == null) return SubscriptionPlan.Pro;

        if (Enum.IsDefined(typeof(SubscriptionPlan), tenant.PlanType) && (int)tenant.PlanType is >= 1 and <= 3)
        {
            // Keep string Plan & numeric PlanType aligned when legacy records only had Plan string mutated
            if (tenant.PlanType == SubscriptionPlan.Pro && !string.IsNullOrWhiteSpace(tenant.Plan))
            {
                if (string.Equals(tenant.Plan.Trim(), nameof(SubscriptionPlan.Starter), StringComparison.OrdinalIgnoreCase))
                    return SubscriptionPlan.Starter;
                if (string.Equals(tenant.Plan.Trim(), nameof(SubscriptionPlan.Enterprise), StringComparison.OrdinalIgnoreCase))
                    return SubscriptionPlan.Enterprise;
            }
            return tenant.PlanType;
        }

        return ParsePlan(tenant.Plan, SubscriptionPlan.Pro);
    }

    public BillingCycle ResolveEffectiveBillingCycle(Tenant? tenant)
    {
        if (tenant == null) return BillingCycle.Monthly;

        if (Enum.IsDefined(typeof(BillingCycle), tenant.BillingCycleType) && (int)tenant.BillingCycleType is >= 1 and <= 3)
        {
            if (tenant.BillingCycleType == BillingCycle.Monthly && !string.IsNullOrWhiteSpace(tenant.BillingCycle))
            {
                var raw = tenant.BillingCycle.Trim();
                if (raw.Equals("yearly", StringComparison.OrdinalIgnoreCase) || raw.Equals("annual", StringComparison.OrdinalIgnoreCase))
                    return BillingCycle.Annual;
                if (raw.Equals("lifetime", StringComparison.OrdinalIgnoreCase))
                    return BillingCycle.Lifetime;
            }
            return tenant.BillingCycleType;
        }

        return ParseBillingCycle(tenant.BillingCycle, BillingCycle.Monthly);
    }

    public static SubscriptionPlan ParsePlan(object? rawPlan, SubscriptionPlan fallback = SubscriptionPlan.Pro)
    {
        if (rawPlan == null) return fallback;

        if (rawPlan is JsonElement elem)
        {
            if (elem.ValueKind == JsonValueKind.Number && elem.TryGetInt32(out var num) && Enum.IsDefined(typeof(SubscriptionPlan), num))
            {
                return (SubscriptionPlan)num;
            }
            if (elem.ValueKind == JsonValueKind.String)
            {
                rawPlan = elem.GetString();
            }
        }

        var text = rawPlan?.ToString()?.Trim();
        if (string.IsNullOrWhiteSpace(text)) return fallback;

        if (int.TryParse(text, out var parsedInt) && Enum.IsDefined(typeof(SubscriptionPlan), parsedInt))
        {
            return (SubscriptionPlan)parsedInt;
        }

        if (Enum.TryParse<SubscriptionPlan>(text, ignoreCase: true, out var parsedEnum) &&
            Enum.IsDefined(typeof(SubscriptionPlan), parsedEnum))
        {
            return parsedEnum;
        }

        return fallback;
    }

    public static BillingCycle ParseBillingCycle(object? rawCycle, BillingCycle fallback = BillingCycle.Monthly)
    {
        if (rawCycle == null) return fallback;

        if (rawCycle is JsonElement elem)
        {
            if (elem.ValueKind == JsonValueKind.Number && elem.TryGetInt32(out var num) && Enum.IsDefined(typeof(BillingCycle), num))
            {
                return (BillingCycle)num;
            }
            if (elem.ValueKind == JsonValueKind.String)
            {
                rawCycle = elem.GetString();
            }
        }

        var text = rawCycle?.ToString()?.Trim();
        if (string.IsNullOrWhiteSpace(text)) return fallback;

        if (text.Equals("yearly", StringComparison.OrdinalIgnoreCase))
            return BillingCycle.Annual;

        if (int.TryParse(text, out var parsedInt) && Enum.IsDefined(typeof(BillingCycle), parsedInt))
        {
            return (BillingCycle)parsedInt;
        }

        if (Enum.TryParse<BillingCycle>(text, ignoreCase: true, out var parsedEnum) &&
            Enum.IsDefined(typeof(BillingCycle), parsedEnum))
        {
            return parsedEnum;
        }

        return fallback;
    }

    public async Task<TenantSubscriptionDto?> GetSubscriptionAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        if (tenant == null)
        {
            return null;
        }

        var plan = ResolveEffectivePlan(tenant);
        var cycle = ResolveEffectiveBillingCycle(tenant);
        var quotas = GetPlanQuotas(plan);
        var expiresAt = tenant.SubscriptionExpiresAt ?? tenant.ExpiresAt;
        var isExpired = cycle != BillingCycle.Lifetime && expiresAt.HasValue && expiresAt.Value < DateTime.UtcNow;

        var usersCount = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(u => u.TenantId == tenantId && u.IsActive, ct);

        var warehousesCount = await _context.Warehouses
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(w => w.TenantId == tenantId && w.IsActive, ct);

        var branchesCount = await _context.Warehouses
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(w => w.TenantId == tenantId && w.IsActive && w.Type == "STORE", ct);

        if (branchesCount == 0 && warehousesCount > 0)
        {
            branchesCount = 1;
        }

        return new TenantSubscriptionDto
        {
            TenantId = tenant.Id,
            TenantName = tenant.Name,
            TenantSlug = tenant.Slug,
            Plan = plan.ToString(),
            PlanType = plan,
            BillingCycle = cycle.ToString(),
            BillingCycleType = cycle,
            ExpiresAt = cycle == BillingCycle.Lifetime ? null : expiresAt,
            IsExpired = isExpired,
            Usage = new TenantSubscriptionUsageDto
            {
                UsersCount = usersCount,
                MaxUsers = quotas.MaxUsers,
                WarehousesCount = warehousesCount,
                MaxWarehouses = quotas.MaxWarehouses,
                BranchesCount = branchesCount,
                MaxBranches = quotas.MaxBranches,
                AiRequestsThisMonth = 0,
                MonthlyAiRequests = quotas.MonthlyAiRequests
            },
            Features = BuildFeatureDictionary(plan)
        };
    }

    public async Task<FeatureCheckResult> CheckFeatureAccessAsync(Guid? tenantId, string featureKey, CancellationToken ct = default)
    {
        var requiredPlan = GetRequiredPlanForFeature(featureKey);

        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            return new FeatureCheckResult(
                IsAllowed: true,
                FeatureKey: featureKey,
                CurrentPlan: nameof(SubscriptionPlan.Enterprise),
                RequiredPlan: requiredPlan.ToString());
        }

        var tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId.Value, ct);

        var currentPlan = ResolveEffectivePlan(tenant);
        var isAllowed = (int)currentPlan >= (int)requiredPlan;

        return new FeatureCheckResult(
            IsAllowed: isAllowed,
            FeatureKey: featureKey,
            CurrentPlan: currentPlan.ToString(),
            RequiredPlan: requiredPlan.ToString());
    }

    public async Task<QuotaCheckResult> CheckUserQuotaAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        var plan = ResolveEffectivePlan(tenant);
        var quotas = GetPlanQuotas(plan);
        var activeUsersCount = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(u => u.TenantId == tenantId && u.IsActive, ct);

        if (quotas.MaxUsers.HasValue && activeUsersCount >= quotas.MaxUsers.Value)
        {
            var nextPlan = plan == SubscriptionPlan.Starter
                ? nameof(SubscriptionPlan.Pro)
                : nameof(SubscriptionPlan.Enterprise);

            return new QuotaCheckResult(
                IsAllowed: false,
                ErrorCode: "ERR_PLAN_USER_LIMIT_REACHED",
                CurrentCount: activeUsersCount,
                MaxAllowed: quotas.MaxUsers.Value,
                RequiredPlan: nextPlan);
        }

        return new QuotaCheckResult(true, null, activeUsersCount, quotas.MaxUsers, null);
    }

    public async Task<QuotaCheckResult> CheckWarehouseQuotaAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        var plan = ResolveEffectivePlan(tenant);
        var quotas = GetPlanQuotas(plan);
        var activeWarehousesCount = await _context.Warehouses
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(w => w.TenantId == tenantId && w.IsActive, ct);

        if (quotas.MaxWarehouses.HasValue && activeWarehousesCount >= quotas.MaxWarehouses.Value)
        {
            var nextPlan = plan == SubscriptionPlan.Starter
                ? nameof(SubscriptionPlan.Pro)
                : nameof(SubscriptionPlan.Enterprise);

            return new QuotaCheckResult(
                IsAllowed: false,
                ErrorCode: "ERR_PLAN_WAREHOUSE_LIMIT_REACHED",
                CurrentCount: activeWarehousesCount,
                MaxAllowed: quotas.MaxWarehouses.Value,
                RequiredPlan: nextPlan);
        }

        return new QuotaCheckResult(true, null, activeWarehousesCount, quotas.MaxWarehouses, null);
    }

    public async Task<QuotaCheckResult> CheckBranchQuotaAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        var plan = ResolveEffectivePlan(tenant);
        var quotas = GetPlanQuotas(plan);
        var activeBranchesCount = await _context.Warehouses
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(w => w.TenantId == tenantId && w.IsActive && w.Type == "STORE", ct);

        if (quotas.MaxBranches.HasValue && activeBranchesCount >= quotas.MaxBranches.Value)
        {
            var nextPlan = plan == SubscriptionPlan.Starter
                ? nameof(SubscriptionPlan.Pro)
                : nameof(SubscriptionPlan.Enterprise);

            return new QuotaCheckResult(
                IsAllowed: false,
                ErrorCode: "ERR_PLAN_BRANCH_LIMIT_REACHED",
                CurrentCount: activeBranchesCount,
                MaxAllowed: quotas.MaxBranches.Value,
                RequiredPlan: nextPlan);
        }

        return new QuotaCheckResult(true, null, activeBranchesCount, quotas.MaxBranches, null);
    }

    public async Task<TenantSubscriptionDto?> UpdateSubscriptionAsync(
        Guid tenantId,
        SubscriptionPlan plan,
        BillingCycle billingCycle,
        DateTime? expiresAt,
        CancellationToken ct = default)
    {
        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null)
        {
            return null;
        }

        var quotas = GetPlanQuotas(plan);
        DateTime? normalizedExpiry = billingCycle == BillingCycle.Lifetime
            ? null
            : expiresAt ?? tenant.SubscriptionExpiresAt ?? tenant.ExpiresAt ?? (billingCycle == BillingCycle.Annual
                ? DateTime.UtcNow.AddYears(1)
                : DateTime.UtcNow.AddMonths(1));

        if (normalizedExpiry.HasValue && normalizedExpiry.Value.Kind != DateTimeKind.Utc)
        {
            normalizedExpiry = DateTime.SpecifyKind(normalizedExpiry.Value, DateTimeKind.Utc);
        }

        tenant.PlanType = plan;
        tenant.Plan = plan.ToString();
        tenant.BillingCycleType = billingCycle;
        tenant.BillingCycle = billingCycle switch
        {
            BillingCycle.Annual => "yearly",
            BillingCycle.Lifetime => "lifetime",
            _ => "monthly"
        };
        tenant.SubscriptionExpiresAt = normalizedExpiry;
        if (normalizedExpiry.HasValue)
        {
            tenant.ExpiresAt = normalizedExpiry;
        }

        tenant.MaxBranches = quotas.MaxBranches ?? 9999;
        tenant.MaxUsers = quotas.MaxUsers ?? 9999;

        var features = tenant.Features ?? BusinessPresetFactory.CreateFeatures(tenant.BusinessPreset);
        features.MaxWarehouses = quotas.MaxWarehouses ?? 9999;
        features.MultiWarehouse = plan != SubscriptionPlan.Starter;
        features.EnableInstallments = plan != SubscriptionPlan.Starter;
        features.EnableQuotations = plan != SubscriptionPlan.Starter;
        features.EnablePriceLists = plan != SubscriptionPlan.Starter;
        features.EnableMultiCurrency = plan != SubscriptionPlan.Starter;
        tenant.Features = features;
        tenant.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        if (_redis != null)
        {
            try
            {
                var db = _redis.GetDatabase();
                await db.StringSetAsync($"tenant:{tenantId}:features", JsonSerializer.Serialize(features), TimeSpan.FromMinutes(30));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis cache sync warning during subscription update for {TenantId}", tenantId);
            }
        }

        return await GetSubscriptionAsync(tenantId, ct);
    }
}
