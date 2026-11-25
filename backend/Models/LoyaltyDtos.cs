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
