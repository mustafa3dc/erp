namespace ERP.Warehouse.Api.Models;

public class LoyaltySettingsDto
{
    public bool IsLoyaltyEnabled { get; set; } = true;
    public decimal ProfitUnitAmount { get; set; } = 1000.0000m;
    public decimal PointsEarnedPerUnit { get; set; } = 10.0000m;
    public decimal PointsRedemptionUnit { get; set; } = 100.0000m;
    public decimal CurrencyValuePerUnit { get; set; } = 1000.0000m;
    public decimal MinRedeemablePoints { get; set; } = 500.0000m;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class UpdateLoyaltySettingsRequestDto
{
    public bool IsLoyaltyEnabled { get; set; } = true;
    public decimal ProfitUnitAmount { get; set; }
    public decimal PointsEarnedPerUnit { get; set; }
    public decimal PointsRedemptionUnit { get; set; }
    public decimal CurrencyValuePerUnit { get; set; }
    public decimal MinRedeemablePoints { get; set; }
}

public class LoyaltyTransactionDto
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public Guid? InvoiceId { get; set; }
    public string? InvoiceNumber { get; set; }
    public Guid? ReturnId { get; set; }
    public string? RmaNumber { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal PointsChange { get; set; }
    public decimal ProfitBasis { get; set; }
    public decimal BalanceAfter { get; set; }
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CustomerLoyaltySummaryDto
{
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public bool IsDefaultCashCustomer { get; set; }
    public decimal LoyaltyPointsBalance { get; set; }
    public decimal MinRedeemablePoints { get; set; }
    public decimal CurrencyEquivalent { get; set; }
    public bool IsLoyaltyEnabled { get; set; }
    public bool IsEligibleToRedeem { get; set; }
    public List<LoyaltyTransactionDto> Transactions { get; set; } = new();
}

public class LoyaltyManualAdjustmentDto
{
    public Guid CustomerId { get; set; }
    public decimal PointsChange { get; set; }
    public string? Notes { get; set; }
}

public class LoyaltyRewardDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal PointsCost { get; set; }
    public Guid? ProductId { get; set; }
    public string? ProductName { get; set; }
    public int LiveStockQuantity { get; set; }
    public bool InStock { get; set; }
    public bool IsActive { get; set; }
    public int DisplayOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class UpsertLoyaltyRewardRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal PointsCost { get; set; }
    public Guid? ProductId { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; } = 0;
}

public class StoreCardSummaryDto
{
    public string StoreName { get; set; } = string.Empty;
    public string? StoreLogo { get; set; }
    public string CardToken { get; set; } = string.Empty;
}

public class PublicLoyaltyTransactionDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal PointsChange { get; set; }
    public decimal BalanceAfter { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PublicLoyaltyVoucherDto
{
    public Guid Id { get; set; }
    public Guid RewardId { get; set; }
    public string VoucherCode { get; set; } = string.Empty;
    public string RewardTitle { get; set; } = string.Empty;
    public string? RewardImageUrl { get; set; }
    public decimal PointsSpent { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

public class PublicLoyaltyRewardItemDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal PointsCost { get; set; }
    public bool InStock { get; set; }
    public int DisplayOrder { get; set; }
}

public class PublicLoyaltyCardDto
{
    public string StoreName { get; set; } = string.Empty;
    public string? StoreLogo { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string LoyaltyMemberCode { get; set; } = string.Empty;
    public string LoyaltyCardToken { get; set; } = string.Empty;
    public decimal LoyaltyPointsBalance { get; set; }
    public bool IsLoyaltyEnabled { get; set; }
    public List<PublicLoyaltyTransactionDto> RecentTransactions { get; set; } = new();
    public List<PublicLoyaltyVoucherDto> ActiveVouchers { get; set; } = new();
    public List<PublicLoyaltyRewardItemDto> Rewards { get; set; } = new();
    public List<StoreCardSummaryDto> StoreCards { get; set; } = new();
}

public class PosCustomerLookupDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? LoyaltyMemberCode { get; set; }
    public string? LoyaltyCardToken { get; set; }
    public decimal LoyaltyPointsBalance { get; set; }
    public decimal CreditLimit { get; set; }
    public decimal CurrentBalance { get; set; }
    public bool IsDefaultCashCustomer { get; set; }
}

public class PosVoucherLookupDto
{
    public Guid Id { get; set; }
    public string VoucherCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal PointsSpent { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ClaimedAt { get; set; }
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public string? LoyaltyMemberCode { get; set; }
    public Guid RewardId { get; set; }
    public string RewardTitle { get; set; } = string.Empty;
    public string? RewardDescription { get; set; }
    public string? RewardImageUrl { get; set; }
    public Guid? ProductId { get; set; }
    public string? ProductName { get; set; }
    public bool InStock { get; set; }
}

public class ClaimPosVoucherRequestDto
{
    public string? ShiftId { get; set; }
    public Guid? WarehouseId { get; set; }
    public string? ActorName { get; set; }
}
