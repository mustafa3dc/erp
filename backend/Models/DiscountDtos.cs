using System.Text.Json.Serialization;

namespace ERP.Warehouse.Api.Models;

/// <summary>
/// Strictly Masked Product DTO for POS and Cashiers.
/// Guaranteed ZERO leakage of CostPrice or Profit Margin metrics.
/// </summary>
public record PosQuantityTierDto(
    Guid Id,
    int MinQty,
    int? MaxQty,
    decimal UnitPrice
);

public class PosProductDto
{
    public Guid Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string Name { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    
    /// <summary>
    /// Retail / Selling price presented to cashier and customer.
    /// Under NO circumstances will CostPrice be added here.
    /// </summary>
    public decimal RetailPrice { get; set; }
    
    public string UnitOfMeasure { get; set; } = "قطعة (Piece)";
    public int AvailableStock { get; set; }
    
    /// <summary>
    /// Pre-configured allowable cashier discount ceiling (e.g. 5.0%).
    /// </summary>
    public decimal MaxCashierDiscountPercent { get; set; } = 5.0m;
    
    public bool IsActive { get; set; }
    public bool IsBundle { get; set; }
    public bool RequiresSerialNumber { get; set; }
    public bool RequiresSerialTracking => RequiresSerialNumber;
    public int WarrantyMonths { get; set; }
    public List<PosQuantityTierDto> QuantityTiers { get; set; } = new();
}

public class ValidateDiscountRequest
{
    public Guid ProductId { get; set; }
    public int Quantity { get; set; } = 1;
    
    /// <summary>
    /// "PERCENT" (%) or "FIXED" ($ / IQD)
    /// </summary>
    public string DiscountType { get; set; } = "PERCENT";
    
    public decimal DiscountValue { get; set; }
    public decimal? UnitPrice { get; set; }
    public string? PricingSource { get; set; }
    public string CashierId { get; set; } = string.Empty;
    
    /// <summary>
    /// Optional PIN if supervisor is overriding immediately at terminal
    /// </summary>
    public string? SupervisorPin { get; set; }
}

public class ValidateDiscountResponse
{
    public bool IsAllowed { get; set; }
    public bool RequiresManagerOverride { get; set; }
    public decimal OriginalPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal FinalPrice { get; set; }
    
    /// <summary>
    /// Standard error code, e.g., "ERR_DISCOUNT_EXCEEDED_LIMIT"
    /// </summary>
    public string? ErrorCode { get; set; }
    
    /// <summary>
    /// Customer-safe, non-leaking message:
    /// "الخصم المطلوب يتجاوز الصلاحية المسموحة لهذه المادة"
    /// </summary>
    public string? ErrorMessage { get; set; }
    
    public string? ApprovedByManagerId { get; set; }
    public string? ApprovedByManagerName { get; set; }
}

public class ManagerOverrideRequest
{
    public string ManagerPin { get; set; } = string.Empty;
    public string CashierId { get; set; } = string.Empty;
    public Guid ProductId { get; set; }
    public string DiscountType { get; set; } = "PERCENT";
    public decimal DiscountValue { get; set; }
    public string? Reason { get; set; }
}

public class ManagerOverrideResponse
{
    public bool Success { get; set; }
    public string? ApprovalToken { get; set; }
    public string? ManagerId { get; set; }
    public string? ManagerName { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
}

public class CreatePosInvoiceRequest
{
    public Guid WarehouseId { get; set; }
    public string DispenseMode { get; set; } = "IN_STORE"; // IN_STORE, WAREHOUSE_DISPATCH
    public Guid? TargetWarehouseId { get; set; }
    public Guid? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public string CashierId { get; set; } = string.Empty;
    public string CashierName { get; set; } = string.Empty;
    public string? ShiftId { get; set; }
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public InvoiceSource Source { get; set; } = InvoiceSource.POS;
    public Guid? TreasuryAccountId { get; set; }
    public string PaymentMethod { get; set; } = "CASH"; // CASH, CREDIT, INSTALLMENT, CARD
    public decimal InvoiceDiscountAmount { get; set; } = 0.0000m;
    public decimal RedeemPoints { get; set; } = 0.0000m;
    public PosInstallmentPlanRequest? InstallmentPlan { get; set; }
    public List<PosInvoiceItemRequest> Items { get; set; } = new();
}

public class PosInstallmentPlanRequest
{
    public int Months { get; set; } = 6;
    public decimal DownPayment { get; set; } = 0.0000m;
    public DateTime? FirstDueDate { get; set; }
    public string? GuarantorName { get; set; }
    public string? GuarantorPhone { get; set; }
    public Guid? TreasuryAccountId { get; set; }
}

public class PosInvoiceItemRequest
{
    public Guid ProductId { get; set; }
    public Guid? SourceWarehouseId { get; set; }
    public int Quantity { get; set; } = 1;
    public string DiscountType { get; set; } = "NONE"; // NONE, PERCENT, FIXED
    public decimal DiscountValue { get; set; } = 0.00m;
    public decimal? UnitPrice { get; set; }
    public string? PricingSource { get; set; } // 'retail' | 'volume_tier' | 'manual_override'
    public string? ManagerOverridePin { get; set; }
    public string? OverrideReason { get; set; }
    public string? SerialNumber { get; set; }
    public List<string>? SerialNumbers { get; set; }
}

public class PosInvoiceResponse
{
    public Guid InvoiceId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public string DispenseMode { get; set; } = "IN_STORE"; // IN_STORE, WAREHOUSE_DISPATCH
    public string FulfillmentStatus { get; set; } = "FULFILLED"; // FULFILLED, PENDING_DISPATCH
    public Guid? DispatchOrderId { get; set; }
    public string? ReceiptDispenseNotice { get; set; }
    public decimal Subtotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string PaymentMethod { get; set; } = "CASH";
    public string PaymentStatus { get; set; } = "PAID";
    public string? ShiftId { get; set; }
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public InvoiceSource Source { get; set; } = InvoiceSource.POS;
    public Guid? TreasuryAccountId { get; set; }
    public decimal LoyaltyPointsEarned { get; set; } = 0.0000m;
    public decimal LoyaltyPointsRedeemed { get; set; } = 0.0000m;
    public decimal LoyaltyDiscountAmount { get; set; } = 0.0000m;
    public decimal RealizedProfit { get; set; } = 0.0000m;
    public decimal CustomerLoyaltyPointsBalanceAfter { get; set; } = 0.0000m;
    public DateTime CreatedAt { get; set; }
    public int DiscounterItemsCount { get; set; }
    public int OverriddenItemsCount { get; set; }
    public List<PosInvoiceItemResponse> Items { get; set; } = new();
}

public class PosInvoiceItemResponse
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal OriginalPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public bool IsQuantityTierApplied { get; set; }
    public bool WasManagerOverride { get; set; }
    public string? ApprovedByManagerId { get; set; }
    public List<string> SerialNumbers { get; set; } = new();
}

public class DiscountAuditLogDto
{
    public Guid Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string ProductSku { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string DiscountType { get; set; } = "PERCENT";
    public decimal DiscountValue { get; set; }
    public decimal DiscountAmountMoney { get; set; }
    public decimal OriginalRetailPrice { get; set; }
    public decimal FinalSellingPrice { get; set; }
    public string CashierId { get; set; } = string.Empty;
    public string? CashierName { get; set; }
    public bool WasManagerOverride { get; set; }
    public string? ApprovedByManagerId { get; set; }
    public string? ApprovedByManagerName { get; set; }
    public string? OverrideReason { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PosCategoryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class WarehouseDispatchOrderDto
{
    public Guid Id { get; set; }
    public Guid InvoiceId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid WarehouseId { get; set; }
    public string WarehouseName { get; set; } = string.Empty;
    public string? CustomerName { get; set; }
    public string? CashierName { get; set; }
    public string ItemsSnapshot { get; set; } = "[]";
    public int TotalQuantity { get; set; }
    public string Status { get; set; } = "PENDING";
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? FulfilledAt { get; set; }
    public string? FulfilledBy { get; set; }
}

public class ApproveDispatchOrderRequest
{
    public string? FulfilledBy { get; set; }
    public string? Notes { get; set; }
}

public class ApproveDispatchOrderResponse
{
    public bool Success { get; set; }
    public Guid DispatchOrderId { get; set; }
    public Guid InvoiceId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

