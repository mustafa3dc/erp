namespace ERP.Warehouse.Api.Models;

public enum SubscriptionPlan
{
    Starter = 1,
    Pro = 2,
    Enterprise = 3
}

public enum BillingCycle
{
    Monthly = 1,
    Annual = 2,
    Lifetime = 3
}

public static class PlanFeatureKeys
{
    // Starter Plan Features (Enabled for Starter, Pro, Enterprise)
    public const string Pos = "Pos";
    public const string Shifts = "Shifts";
    public const string CashAndCreditSales = "CashAndCreditSales";
    public const string Returns = "Returns";
    public const string Purchases = "Purchases";
    public const string Suppliers = "Suppliers";
    public const string BasicInventoryAndFifo = "BasicInventoryAndFifo";
    public const string SingleCashbox = "SingleCashbox";
    public const string Expenses = "Expenses";
    public const string Vouchers = "Vouchers";
    public const string SecurityAndCostMasking = "SecurityAndCostMasking";
    public const string BasicReports = "BasicReports";
    public const string CashRounding250 = "CashRounding250";

    // Pro Plan Features (Locked in Starter; Enabled for Pro, Enterprise)
    public const string Installments = "Installments";
    public const string VolumePricingAndBundles = "VolumePricingAndBundles";
    public const string Quotations = "Quotations";
    public const string PartnersAndProfitShare = "PartnersAndProfitShare";
    public const string LoyaltyPoints = "LoyaltyPoints";
    public const string MultiCurrency = "MultiCurrency";
    public const string MultipleBanksAndCashboxes = "MultipleBanksAndCashboxes";
    public const string ShelvesOrganizer = "ShelvesOrganizer";
    public const string SerialTracking = "SerialTracking";
    public const string AiExecutiveAdvisor = "AiExecutiveAdvisor";
    public const string WarehouseTransfers = "WarehouseTransfers";

    // Enterprise Plan Features (Locked in Starter & Pro; Enabled ONLY for Enterprise)
    public const string MultiBranch = "MultiBranch";
    public const string PurchaseOrders = "PurchaseOrders";
    public const string DispatchOrders = "DispatchOrders";
    public const string OfficialExportReports = "OfficialExportReports";

    public static readonly string[] AllKeys =
    {
        Pos,
        Shifts,
        CashAndCreditSales,
        Returns,
        Purchases,
        Suppliers,
        BasicInventoryAndFifo,
        SingleCashbox,
        Expenses,
        Vouchers,
        SecurityAndCostMasking,
        BasicReports,
        CashRounding250,
        Installments,
        VolumePricingAndBundles,
        Quotations,
        PartnersAndProfitShare,
        LoyaltyPoints,
        MultiCurrency,
        MultipleBanksAndCashboxes,
        ShelvesOrganizer,
        SerialTracking,
        AiExecutiveAdvisor,
        WarehouseTransfers,
        MultiBranch,
        PurchaseOrders,
        DispatchOrders,
        OfficialExportReports
    };
}

public sealed record PlanQuotasDto(
    int? MaxBranches,
    int? MaxWarehouses,
    int? MaxUsers,
    int MonthlyAiRequests
);

public class TenantSubscriptionUsageDto
{
    public int UsersCount { get; set; }
    public int? MaxUsers { get; set; }
    public int WarehousesCount { get; set; }
    public int? MaxWarehouses { get; set; }
    public int BranchesCount { get; set; }
    public int? MaxBranches { get; set; }
    public int AiRequestsThisMonth { get; set; }
    public int MonthlyAiRequests { get; set; }
}

public class TenantSubscriptionDto
{
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string TenantSlug { get; set; } = string.Empty;
    public string Plan { get; set; } = nameof(SubscriptionPlan.Pro);
    public SubscriptionPlan PlanType { get; set; } = SubscriptionPlan.Pro;
    public string BillingCycle { get; set; } = nameof(ERP.Warehouse.Api.Models.BillingCycle.Monthly);
    public BillingCycle BillingCycleType { get; set; } = ERP.Warehouse.Api.Models.BillingCycle.Monthly;
    public DateTime? ExpiresAt { get; set; }
    public bool IsExpired { get; set; }
    public TenantSubscriptionUsageDto Usage { get; set; } = new();
    public Dictionary<string, bool> Features { get; set; } = new();
}

public class UpdateTenantSubscriptionRequestDto
{
    public object? Plan { get; set; }
    public object? BillingCycle { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public sealed record QuotaCheckResult(
    bool IsAllowed,
    string? ErrorCode,
    int CurrentCount,
    int? MaxAllowed,
    string? RequiredPlan
);

public sealed record FeatureCheckResult(
    bool IsAllowed,
    string FeatureKey,
    string CurrentPlan,
    string RequiredPlan
);
