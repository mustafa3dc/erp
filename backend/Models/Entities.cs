using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ERP.Warehouse.Api.Models;

public static class WarehouseStorageTypes
{
    public const string Standard = "Standard";
    public const string ColdStorage = "ColdStorage";

    public static string Normalize(string? value) =>
        string.Equals(value?.Trim(), ColdStorage, StringComparison.OrdinalIgnoreCase)
            ? ColdStorage
            : Standard;
}

[Table("warehouses")]
public class Warehouse : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(255)]
    [Column("location")]
    public string? Location { get; set; }

    [NotMapped]
    public string? LocationAddress
    {
        get => Location;
        set => Location = value;
    }

    [MaxLength(150)]
    [Column("manager_name")]
    public string? ManagerName { get; set; }

    [MaxLength(50)]
    [Column("contact_phone")]
    public string? ContactPhone { get; set; }

    [MaxLength(20)]
    [Column("type")]
    public string Type { get; set; } = "STORE"; // STORE, WAREHOUSE

    [MaxLength(30)]
    [Column("storage_type")]
    public string StorageType { get; set; } = WarehouseStorageTypes.Standard; // Standard | ColdStorage

    [Column("total_capacity")]
    public decimal TotalCapacity { get; set; } = 10000;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<WarehouseStock> Stocks { get; set; } = new List<WarehouseStock>();
}

[Table("categories")]
public class Category : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(150)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}

[Table("products")]
public class Product : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("sku")]
    public string Sku { get; set; } = string.Empty;

    [MaxLength(100)]
    [Column("barcode")]
    public string? Barcode { get; set; }

    [Required]
    [MaxLength(255)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("category_id")]
    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }

    [Column("cost_price")]
    public decimal CostPrice { get; set; }

    [Column("selling_price")]
    public decimal SellingPrice { get; set; }

    [Column("min_selling_price")]
    public decimal MinSellingPrice { get; set; } = 0.00m;

    [Column("min_profit_margin")]
    public decimal MinProfitMargin { get; set; } = 0.00m;

    [Column("max_cashier_discount_percent")]
    public decimal MaxCashierDiscountPercent { get; set; } = 5.0m;

    [Column("unit_of_measure")]
    public string UnitOfMeasure { get; set; } = "قطعة (Piece)";

    [Column("min_stock_level")]
    public int MinStockLevel { get; set; } = 10;

    [Column("max_stock_level")]
    public int MaxStockLevel { get; set; } = 500;

    [Column("requires_serial_number")]
    public bool RequiresSerialNumber { get; set; } = false;

    [NotMapped]
    public bool RequiresSerialTracking
    {
        get => RequiresSerialNumber;
        set => RequiresSerialNumber = value;
    }

    [Column("warranty_months")]
    public int WarrantyMonths { get; set; } = 0;

    [Column("is_bundle")]
    public bool IsBundle { get; set; } = false;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<WarehouseStock> WarehouseStocks { get; set; } = new List<WarehouseStock>();
    public ICollection<ProductBundleItem> BundleComponents { get; set; } = new List<ProductBundleItem>();
    public ICollection<ProductQuantityTier> QuantityTiers { get; set; } = new List<ProductQuantityTier>();
}

[Table("warehouse_stock")]
public class WarehouseStock : ITenantEntity
{
    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("warehouse_id")]
    public Guid WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Column("quantity")]
    public int Quantity { get; set; }

    [Column("reserved_quantity")]
    public int ReservedQuantity { get; set; } = 0;

    [NotMapped]
    public int AvailableToPromise => Math.Max(0, Quantity - ReservedQuantity);

    [Column("shelf_location")]
    public string? ShelfLocation { get; set; }

    [Column("last_counted_at")]
    public DateTime LastCountedAt { get; set; } = DateTime.UtcNow;
}

[Table("inventory_transactions")]
public class InventoryTransaction : ITenantEntity
{
    [Key]
    [Column("transaction_id")]
    public Guid TransactionId { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Required]
    [Column("warehouse_id")]
    public Guid WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    [Required]
    [Column("quantity_change")]
    public int QuantityChange { get; set; }

    [Required]
    [Column("transaction_type")]
    public string TransactionType { get; set; } = "STOCK_ADJUSTMENT";

    [Required]
    [Column("reason")]
    public string Reason { get; set; } = string.Empty;

    [Column("reference_user_id")]
    public string? ReferenceUserId { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("stock_movements")]
public class StockMovement : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [Column("movement_number")]
    public string MovementNumber { get; set; } = string.Empty;

    [Required]
    [Column("movement_type")]
    public string MovementType { get; set; } = "IN"; // IN, OUT, TRANSFER, ADJUSTMENT

    [Column("from_warehouse_id")]
    public Guid? FromWarehouseId { get; set; }

    [Column("to_warehouse_id")]
    public Guid? ToWarehouseId { get; set; }

    [Column("reference_number")]
    public string? ReferenceNumber { get; set; }

    [MaxLength(60)]
    [Column("reference_type")]
    public string? ReferenceType { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_by")]
    public string? CreatedBy { get; set; }

    [Column("movement_date")]
    public DateTime MovementDate { get; set; } = DateTime.UtcNow;

    public ICollection<StockMovementItem> Items { get; set; } = new List<StockMovementItem>();
}

[Table("stock_movement_items")]
public class StockMovementItem : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("movement_id")]
    public Guid MovementId { get; set; }
    public StockMovement? Movement { get; set; }

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Column("quantity")]
    public int Quantity { get; set; }

    [Column("unit_cost")]
    public decimal UnitCost { get; set; }
}

public enum InvoiceSource
{
    POS = 0,
    StandardInvoice = 1
}

[Table("sales_invoices")]
public class SalesInvoice : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [Column("invoice_number")]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Column("warehouse_id")]
    public Guid WarehouseId { get; set; }

    [MaxLength(20)]
    [Column("dispense_mode")]
    public string DispenseMode { get; set; } = "IN_STORE"; // IN_STORE, WAREHOUSE_DISPATCH

    [MaxLength(20)]
    [Column("fulfillment_status")]
    public string FulfillmentStatus { get; set; } = "FULFILLED"; // FULFILLED, PENDING_DISPATCH

    [Column("cashier_id")]
    public string CashierId { get; set; } = string.Empty;

    [Column("cashier_name")]
    public string? CashierName { get; set; }

    [Column("customer_id")]
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    [MaxLength(255)]
    [Column("customer_name")]
    public string? CustomerName { get; set; }

    [MaxLength(100)]
    [Column("shift_id")]
    public string? ShiftId { get; set; }

    [MaxLength(30)]
    [Column("source")]
    public string Source { get; set; } = nameof(InvoiceSource.POS);

    [Column("treasury_account_id")]
    public Guid? TreasuryAccountId { get; set; }
    public CashBox? TreasuryAccount { get; set; }

    [Column("subtotal")]
    public decimal Subtotal { get; set; }

    [Column("tax_amount")]
    public decimal TaxAmount { get; set; }

    [Column("discount_amount")]
    public decimal DiscountAmount { get; set; }

    [Column("total_amount")]
    public decimal TotalAmount { get; set; }

    [Column("loyalty_points_earned", TypeName = "numeric(18, 4)")]
    public decimal LoyaltyPointsEarned { get; set; } = 0.0000m;

    [Column("loyalty_points_redeemed", TypeName = "numeric(18, 4)")]
    public decimal LoyaltyPointsRedeemed { get; set; } = 0.0000m;

    [Column("loyalty_discount_amount", TypeName = "numeric(18, 4)")]
    public decimal LoyaltyDiscountAmount { get; set; } = 0.0000m;

    [Column("realized_profit", TypeName = "numeric(18, 4)")]
    public decimal RealizedProfit { get; set; } = 0.0000m;

    [Column("payment_status")]
    public string PaymentStatus { get; set; } = "PAID";

    [Column("payment_method")]
    public string PaymentMethod { get; set; } = "CASH";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SalesInvoiceItem> Items { get; set; } = new List<SalesInvoiceItem>();
}

[Table("sales_invoice_items")]
public class SalesInvoiceItem : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("invoice_id")]
    public Guid InvoiceId { get; set; }

    [Column("source_warehouse_id")]
    public Guid? SourceWarehouseId { get; set; }

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Column("quantity")]
    public int Quantity { get; set; }

    [Column("original_price")]
    public decimal OriginalPrice { get; set; }

    [Column("discount_type")]
    public string DiscountType { get; set; } = "NONE"; // NONE, PERCENT, FIXED

    [Column("discount_value")]
    public decimal DiscountValue { get; set; } = 0.00m;

    [Column("discount_amount")]
    public decimal DiscountAmount { get; set; } = 0.00m;

    [Column("unit_price")]
    public decimal UnitPrice { get; set; }

    [Column("total_price")]
    public decimal TotalPrice { get; set; }

    [Column("unit_cost_price", TypeName = "numeric(18, 4)")]
    public decimal UnitCostPrice { get; set; } = 0.0000m;

    [Column("was_manager_override")]
    public bool WasManagerOverride { get; set; } = false;

    [Column("approved_by_manager_id")]
    public string? ApprovedByManagerId { get; set; }

    [Column("serial_numbers", TypeName = "jsonb")]
    public string SerialNumbersJson { get; set; } = "[]";
}

public enum StaffRole
{
    Cashier,
    Supervisor,
    Admin
}

[Table("staff_users")]
public class StaffUser : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("staff_code")]
    public string StaffCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    [Column("full_name")]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [Column("role")]
    public StaffRole Role { get; set; } = StaffRole.Cashier;

    [Column("pin_hash")]
    public string PinHash { get; set; } = string.Empty;

    [Column("max_discount_percent")]
    public decimal MaxDiscountPercent { get; set; } = 5.0m;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("discount_audit_logs")]
public class DiscountAuditLog : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [Column("invoice_number")]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Column("product_sku")]
    public string ProductSku { get; set; } = string.Empty;

    [Column("product_name")]
    public string ProductName { get; set; } = string.Empty;

    [Required]
    [Column("discount_type")]
    public string DiscountType { get; set; } = "PERCENT"; // PERCENT, FIXED

    [Column("discount_value")]
    public decimal DiscountValue { get; set; }

    [Column("discount_amount_money")]
    public decimal DiscountAmountMoney { get; set; }

    [Column("original_retail_price")]
    public decimal OriginalRetailPrice { get; set; }

    [Column("final_selling_price")]
    public decimal FinalSellingPrice { get; set; }

    [Required]
    [Column("cashier_id")]
    public string CashierId { get; set; } = string.Empty;

    [Column("cashier_name")]
    public string? CashierName { get; set; }

    [Column("customer_id")]
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    [MaxLength(255)]
    [Column("customer_name")]
    public string? CustomerName { get; set; }

    [MaxLength(100)]
    [Column("shift_id")]
    public string? ShiftId { get; set; }

    [MaxLength(30)]
    [Column("source")]
    public string Source { get; set; } = nameof(InvoiceSource.POS);

    [Column("treasury_account_id")]
    public Guid? TreasuryAccountId { get; set; }
    public CashBox? TreasuryAccount { get; set; }

    [Column("was_manager_override")]
    public bool WasManagerOverride { get; set; }

    [Column("approved_by_manager_id")]
    public string? ApprovedByManagerId { get; set; }

    [Column("approved_by_manager_name")]
    public string? ApprovedByManagerName { get; set; }

    [Column("override_reason")]
    public string? OverrideReason { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("suppliers")]
public class Supplier : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [Column("company_name")]
    public string CompanyName { get; set; } = string.Empty;

    [MaxLength(150)]
    [Column("contact_person")]
    public string? ContactPerson { get; set; }

    [MaxLength(50)]
    [Column("phone")]
    public string? Phone { get; set; }

    [MaxLength(150)]
    [Column("email")]
    public string? Email { get; set; }

    [Column("current_balance")]
    public decimal CurrentBalance { get; set; } = 0.0000m;

    [NotMapped]
    public decimal Balance
    {
        get => CurrentBalance;
        set => CurrentBalance = value;
    }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("purchase_bills")]
public class PurchaseBill : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("bill_number")]
    public string BillNumber { get; set; } = string.Empty;

    [Column("supplier_id")]
    public Guid SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("supplier_ref_no")]
    public string SupplierRefNo { get; set; } = string.Empty;

    [Column("invoice_date")]
    public DateTime InvoiceDate { get; set; } = DateTime.UtcNow;

    [Column("target_warehouse_id")]
    public Guid TargetWarehouseId { get; set; }
    public Warehouse? TargetWarehouse { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("payment_terms")]
    public string PaymentTerms { get; set; } = "CASH"; // CASH, CREDIT, PARTIAL

    [Required]
    [MaxLength(20)]
    [Column("payment_type")]
    public string PaymentType { get; set; } = "Cash"; // Cash, Credit, Partial

    [Column("subtotal", TypeName = "numeric(18, 4)")]
    public decimal Subtotal { get; set; }

    [Column("discount_amount", TypeName = "numeric(18, 4)")]
    public decimal DiscountAmount { get; set; }

    [Column("shipping_cost", TypeName = "numeric(18, 4)")]
    public decimal ShippingCost { get; set; }

    [Column("net_total", TypeName = "numeric(18, 4)")]
    public decimal NetTotal { get; set; }

    [Column("paid_amount", TypeName = "numeric(18, 4)")]
    public decimal PaidAmount { get; set; }

    [Column("balance_due", TypeName = "numeric(18, 4)")]
    public decimal BalanceDue { get; set; }

    [Column("remaining_amount", TypeName = "numeric(18, 4)")]
    public decimal RemainingAmount { get; set; }

    [Column("cash_account_id")]
    public Guid? CashAccountId { get; set; }
    public CashBox? CashAccount { get; set; }

    [MaxLength(100)]
    [Column("treasury_account_id")]
    public string? TreasuryAccountId { get; set; }

    [MaxLength(50)]
    [Column("bill_status")]
    public string BillStatus { get; set; } = "POSTED";

    [Column("cancelled_at")]
    public DateTimeOffset? CancelledAt { get; set; }

    [MaxLength(150)]
    [Column("cancelled_by")]
    public string? CancelledBy { get; set; }

    [MaxLength(500)]
    [Column("cancel_reason")]
    public string? CancelReason { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<PurchaseBillItem> Items { get; set; } = new List<PurchaseBillItem>();
}

[Table("purchase_bill_items")]
public class PurchaseBillItem : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("bill_id")]
    public Guid BillId { get; set; }
    public PurchaseBill? Bill { get; set; }

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("item_sku")]
    public string ItemSku { get; set; } = string.Empty;

    [MaxLength(100)]
    [Column("item_barcode")]
    public string? ItemBarcode { get; set; }

    [Required]
    [MaxLength(255)]
    [Column("item_name")]
    public string ItemName { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("unit_of_measure")]
    public string UnitOfMeasure { get; set; } = "قطعة";

    [Column("quantity")]
    public int Quantity { get; set; }

    [Column("unit_cost")]
    public decimal UnitCost { get; set; }

    [Column("selling_price")]
    public decimal SellingPrice { get; set; }

    [Column("line_total")]
    public decimal LineTotal { get; set; }

    [Column("is_newly_created_product")]
    public bool IsNewlyCreatedProduct { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("fifo_cost_batches")]
public class FifoCostBatch : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Column("warehouse_id")]
    public Guid WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    [Column("purchase_bill_id")]
    public Guid? PurchaseBillId { get; set; }
    public PurchaseBill? PurchaseBill { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("batch_reference")]
    public string BatchReference { get; set; } = string.Empty;

    [Column("batch_date")]
    public DateTime BatchDate { get; set; } = DateTime.UtcNow;

    [Column("initial_quantity")]
    public int InitialQuantity { get; set; }

    [Column("remaining_quantity")]
    public int RemainingQuantity { get; set; }

    [Column("unit_cost")]
    public decimal UnitCost { get; set; }

    [Column("is_exhausted")]
    public bool IsExhausted { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("supplier_ledgers")]
public class SupplierLedger : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("supplier_id")]
    public Guid SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("transaction_type")]
    public string TransactionType { get; set; } = "PURCHASE_BILL"; // PURCHASE_BILL, PAYMENT_VOUCHER

    [Column("reference_id")]
    public Guid? ReferenceId { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("reference_number")]
    public string ReferenceNumber { get; set; } = string.Empty;

    [Column("debit")]
    public decimal Debit { get; set; } = 0.00m;

    [Column("credit")]
    public decimal Credit { get; set; } = 0.00m;

    [Column("running_balance")]
    public decimal RunningBalance { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// DTOs for Inbound Purchase Bill Processing
public record CreatePurchaseBillDto(
    Guid? SupplierId,
    string SupplierRefNo,
    DateTime InvoiceDate,
    Guid TargetWarehouseId,
    string PaymentTerms,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal ShippingCost,
    decimal NetTotal,
    decimal PaidAmount,
    decimal BalanceDue,
    string? TreasuryAccountId,
    string? Notes,
    List<PurchaseBillItemInputDto> Items,
    string? NewSupplierName = null,
    string? NewSupplierPhone = null,
    string? Currency = null,
    string? PaymentType = null,
    decimal? RemainingAmount = null,
    Guid? CashAccountId = null
);

public record CancelPurchaseBillDto(
    string? Reason = null
);

public record CreateSupplierDto(
    string CompanyName,
    string? ContactPerson = null,
    string? Phone = null,
    string? Email = null
);

public record SupplierPaymentRequestDto(
    decimal Amount,
    Guid CashAccountId,
    DateTime? PaymentDate = null,
    string? ReferenceNumber = null,
    string? Notes = null
);

public record PurchaseBillItemInputDto(
    Guid? ProductId,
    string Sku,
    string? Barcode,
    string Name,
    string? CategoryName,
    string UnitOfMeasure,
    decimal Quantity,
    decimal UnitCost,
    decimal? SellingPrice,
    decimal LineTotal,
    bool IsNewProduct,
    List<string>? SerialNumbers = null,
    bool? RequiresSerialNumber = null,
    bool? RequiresSerialTracking = null,
    int? WarrantyMonths = null
);

// ============================================================================
// Multi-Tenant Identity Entities
// Standard ERP Format: [username]@[company_slug] (e.g. mustafa@m, admin@m)
// ============================================================================

[Table("tenants")]
public class Tenant
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(150)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("slug")]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(10)]
    [Column("country_code")]
    public string CountryCode { get; set; } = "IQ";

    [MaxLength(10)]
    [Column("currency")]
    public string Currency { get; set; } = "IQD";

    [MaxLength(50)]
    [Column("plan")]
    public string Plan { get; set; } = "Pro";

    [Column("trial_ends_at")]
    public DateTime? TrialEndsAt { get; set; } = DateTime.UtcNow.AddDays(14);

    [Column("expires_at")]
    public DateTime? ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(14);

    [Column("max_branches")]
    public int MaxBranches { get; set; } = 5;

    [Column("max_users")]
    public int MaxUsers { get; set; } = 20;

    [Column("business_preset")]
    public BusinessPreset BusinessPreset { get; set; } = BusinessPreset.Custom;

    [Column("features", TypeName = "jsonb")]
    public CompanyFeatures Features { get; set; } = new();

    [Column("features_enabled")]
    public string FeaturesEnabled { get; set; } = "{\"wms\": false, \"pos\": true}";

    [MaxLength(20)]
    [Column("billing_cycle")]
    public string BillingCycle { get; set; } = "yearly";

    [MaxLength(150)]
    [Column("contact_info")]
    public string? ContactInfo { get; set; }

    [MaxLength(1000)]
    [Column("logo_url")]
    public string? LogoUrl { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<User> Users { get; set; } = new List<User>();
}

[Table("cash_boxes")]
public class CashBox : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("code")]
    public string Code { get; set; } = "CB-01";

    [Required]
    [MaxLength(150)]
    [Column("name")]
    public string Name { get; set; } = "صندوق الكاش الافتراضي";

    [Column("warehouse_id")]
    public Guid? WarehouseId { get; set; }

    [MaxLength(10)]
    [Column("currency")]
    public string Currency { get; set; } = "IQD";

    [Required]
    [MaxLength(30)]
    [Column("account_type")]
    public string AccountType { get; set; } = "Cashbox"; // Cashbox, BankAccount, DigitalWallet

    [Column("current_balance")]
    public decimal CurrentBalance { get; set; } = 0.0000m;

    [NotMapped]
    public decimal Balance
    {
        get => CurrentBalance;
        set => CurrentBalance = value;
    }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("treasury_transactions")]
public class TreasuryTransaction : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("cash_box_id")]
    public Guid CashBoxId { get; set; }
    public CashBox? CashBox { get; set; }

    [Column("expense_voucher_id")]
    public Guid? ExpenseVoucherId { get; set; }
    public ExpenseVoucher? ExpenseVoucher { get; set; }

    [Column("purchase_bill_id")]
    public Guid? PurchaseBillId { get; set; }
    public PurchaseBill? PurchaseBill { get; set; }

    [Column("supplier_id")]
    public Guid? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    [Required]
    [MaxLength(30)]
    [Column("transaction_type")]
    public string TransactionType { get; set; } = "PAYMENT"; // PAYMENT, RECEIPT, REFUND

    [Column("amount", TypeName = "numeric(18, 4)")]
    public decimal Amount { get; set; }

    [Column("balance_after", TypeName = "numeric(18, 4)")]
    public decimal BalanceAfter { get; set; }

    [MaxLength(100)]
    [Column("reference_number")]
    public string? ReferenceNumber { get; set; }

    [MaxLength(200)]
    [Column("party_name")]
    public string? PartyName { get; set; }

    [Column("voucher_date")]
    public DateTimeOffset VoucherDate { get; set; } = DateTimeOffset.UtcNow;

    [Column("transfer_group_id")]
    public Guid? TransferGroupId { get; set; }

    [MaxLength(500)]
    [Column("notes")]
    public string? Notes { get; set; }

    [MaxLength(150)]
    [Column("created_by")]
    public string? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public record TreasuryVoucherRequestDto(
    Guid AccountId,
    decimal Amount,
    string? PartyName = null,
    string? Reference = null,
    string? Notes = null,
    DateTimeOffset? VoucherDate = null
);

public record TreasuryTransferRequestDto(
    Guid FromAccountId,
    Guid ToAccountId,
    decimal Amount,
    string? Reference = null,
    string? Notes = null,
    DateTimeOffset? VoucherDate = null
);

public record CreateTreasuryAccountDto(
    string Name,
    string AccountType = "Cashbox",
    string? Currency = "IQD",
    decimal InitialBalance = 0m,
    string? Code = null
);

public record UpdateTreasuryAccountDto(
    string Name,
    string AccountType = "Cashbox",
    string? Currency = "IQD",
    bool? IsActive = null
);

[Table("cash_expenses")]
public class CashExpense : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("amount")]
    public decimal Amount { get; set; }

    [MaxLength(10)]
    [Column("currency")]
    public string Currency { get; set; } = "IQD";

    [Required]
    [MaxLength(100)]
    [Column("expense_category_id")]
    public string ExpenseCategoryId { get; set; } = string.Empty;

    [MaxLength(150)]
    [Column("category_name")]
    public string CategoryName { get; set; } = string.Empty;

    [MaxLength(100)]
    [Column("shift_id")]
    public string? ShiftId { get; set; }

    [MaxLength(30)]
    [Column("source")]
    public string Source { get; set; } = nameof(InvoiceSource.POS);

    [Column("treasury_account_id")]
    public Guid? TreasuryAccountId { get; set; }
    public CashBox? TreasuryAccount { get; set; }

    [Column("cash_box_id")]
    public Guid? CashBoxId { get; set; }

    [MaxLength(500)]
    [Column("notes")]
    public string? Notes { get; set; }

    [MaxLength(100)]
    [Column("created_by")]
    public string? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("users")]
public class User : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("username")]
    public string Username { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [Column("password_hash")]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    [Column("full_name")]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(150)]
    [Column("email")]
    public string? Email { get; set; }

    [MaxLength(50)]
    [Column("phone")]
    public string? Phone { get; set; }

    [Required]
    [Column("role")]
    public UserRole Role { get; set; } = UserRole.Cashier;

    [MaxLength(50)]
    [Column("branch_id")]
    public string BranchId { get; set; } = "WH-01";

    [MaxLength(50)]
    [Column("default_warehouse_id")]
    public string DefaultWarehouseId { get; set; } = "WH-01";

    [MaxLength(255)]
    [Column("avatar_url")]
    public string? AvatarUrl { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("last_login_at")]
    public DateTime? LastLoginAt { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }
}

[Table("warehouse_dispatch_orders")]
public class WarehouseDispatchOrder : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("invoice_id")]
    public Guid InvoiceId { get; set; }
    public SalesInvoice? Invoice { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("invoice_number")]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Column("warehouse_id")]
    public Guid WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    [MaxLength(150)]
    [Column("customer_name")]
    public string? CustomerName { get; set; }

    [MaxLength(150)]
    [Column("cashier_name")]
    public string? CashierName { get; set; }

    [Required]
    [Column("items_snapshot")]
    public string ItemsSnapshot { get; set; } = "[]";

    [Column("total_quantity")]
    public int TotalQuantity { get; set; } = 1;

    [MaxLength(20)]
    [Column("status")]
    public string Status { get; set; } = "PENDING"; // PENDING, FULFILLED, CANCELLED

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("fulfilled_at")]
    public DateTime? FulfilledAt { get; set; }

    [MaxLength(150)]
    [Column("fulfilled_by")]
    public string? FulfilledBy { get; set; }
}

[Table("rma_return_requests")]
public class RmaReturnRequest : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("rma_number")]
    public string RmaNumber { get; set; } = string.Empty;

    [Column("invoice_id")]
    public Guid InvoiceId { get; set; }
    public SalesInvoice? Invoice { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("invoice_number")]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [MaxLength(100)]
    [Column("sku")]
    public string Sku { get; set; } = string.Empty;

    [MaxLength(200)]
    [Column("product_name")]
    public string ProductName { get; set; } = string.Empty;

    [MaxLength(100)]
    [Column("serial_number")]
    public string SerialNumber { get; set; } = string.Empty;

    [MaxLength(150)]
    [Column("customer_name")]
    public string CustomerName { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("customer_phone")]
    public string CustomerPhone { get; set; } = string.Empty;

    [Column("return_quantity")]
    public int ReturnQuantity { get; set; } = 1;

    [Column("refund_amount")]
    public decimal RefundAmount { get; set; }

    [MaxLength(10)]
    [Column("currency")]
    public string Currency { get; set; } = "IQD";

    [MaxLength(50)]
    [Column("warranty_status")]
    public string WarrantyStatus { get; set; } = "VALID_UNDER_WARRANTY";

    [MaxLength(50)]
    [Column("decision")]
    public string Decision { get; set; } = "PENDING_INSPECTION";

    [Column("warehouse_id")]
    public Guid? WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    [Column("restocked_at")]
    public DateTime? RestockedAt { get; set; }

    [MaxLength(150)]
    [Column("restocked_by")]
    public string? RestockedBy { get; set; }

    [Column("return_reason")]
    public string ReturnReason { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("employee_financial_transactions")]
public class EmployeeFinancialTransaction : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [Column("employee_id")]
    public Guid EmployeeId { get; set; }

    [MaxLength(150)]
    [Column("employee_name")]
    public string EmployeeName { get; set; } = string.Empty;

    [Required]
    [Column("transaction_date")]
    public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

    [Required]
    [MaxLength(50)]
    [Column("reference_number")]
    public string ReferenceNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("transaction_type")]
    public string TransactionType { get; set; } = string.Empty; // سلفة نقدية، راتب شهري، عمولة مبيعات، خصم، عجز وردية

    [MaxLength(500)]
    [Column("description")]
    public string Description { get; set; } = string.Empty;

    [Column("debit", TypeName = "decimal(18,2)")]
    public decimal Debit { get; set; } = 0; // مدين (عليه)

    [Column("credit", TypeName = "decimal(18,2)")]
    public decimal Credit { get; set; } = 0; // دائن (له)

    [MaxLength(10)]
    [Column("currency")]
    public string Currency { get; set; } = "IQD";

    [MaxLength(100)]
    [Column("created_by")]
    public string CreatedBy { get; set; } = "System";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// ============================================================================
// Customers & Price Tier Linking
// ============================================================================

[Table("customers")]
public class Customer : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("phone")]
    public string? Phone { get; set; }

    [MaxLength(150)]
    [Column("email")]
    public string? Email { get; set; }

    [MaxLength(100)]
    [Column("tax_number")]
    public string? TaxNumber { get; set; }

    [Column("credit_limit")]
    public decimal CreditLimit { get; set; } = 0.0000m;

    [Column("current_balance")]
    public decimal CurrentBalance { get; set; } = 0.0000m;

    [Column("loyalty_points_balance", TypeName = "numeric(18, 4)")]
    public decimal LoyaltyPointsBalance { get; set; } = 0.0000m;

    [MaxLength(40)]
    [Column("loyalty_member_code")]
    public string? LoyaltyMemberCode { get; set; }

    [MaxLength(128)]
    [Column("loyalty_card_token")]
    public string? LoyaltyCardToken { get; set; }

    [MaxLength(40)]
    [Column("normalized_phone")]
    public string? NormalizedPhone { get; set; }

    [Column("price_list_id")]
    public Guid? PriceListId { get; set; }
    public PriceList? PriceList { get; set; }

    [Column("is_default_cash_customer")]
    public bool IsDefaultCashCustomer { get; set; } = false;

    [MaxLength(150)]
    [Column("created_by")]
    public string? CreatedBy { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// ============================================================================
// 1. Operational Expenses (Expense Categories & Vouchers)
// ============================================================================

[Table("expense_categories")]
public class ExpenseCategory : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("monthly_budget_cap", TypeName = "numeric(18, 4)")]
    public decimal MonthlyBudgetCap { get; set; } = 0.0000m;

    [Column("description")]
    public string? Description { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ExpenseVoucher> Vouchers { get; set; } = new List<ExpenseVoucher>();
}

[Table("expense_vouchers")]
public class ExpenseVoucher : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("voucher_number")]
    public string VoucherNumber { get; set; } = string.Empty;

    [Column("voucher_date")]
    public DateTime VoucherDate { get; set; } = DateTime.UtcNow;

    [Column("expense_category_id")]
    public Guid? ExpenseCategoryId { get; set; }
    public ExpenseCategory? ExpenseCategory { get; set; }

    [Column("cash_box_id")]
    public Guid? CashBoxId { get; set; }
    public CashBox? CashBox { get; set; }

    [Column("amount")]
    public decimal Amount { get; set; }

    [MaxLength(10)]
    [Column("currency")]
    public string Currency { get; set; } = "IQD";

    [Column("exchange_rate")]
    public decimal ExchangeRate { get; set; } = 1.0000m;

    [Column("base_currency_amount")]
    public decimal BaseCurrencyAmount { get; set; }

    [MaxLength(50)]
    [Column("payment_method")]
    public string PaymentMethod { get; set; } = "CASH"; // CASH, BANK_TRANSFER, CHECK

    [MaxLength(150)]
    [Column("beneficiary_name")]
    public string? BeneficiaryName { get; set; }

    [MaxLength(20)]
    [Column("status")]
    public string Status { get; set; } = "DRAFT"; // DRAFT, APPROVED, REJECTED, CANCELLED

    [MaxLength(150)]
    [Column("approved_by")]
    public string? ApprovedBy { get; set; }

    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }

    [Column("voided_at")]
    public DateTime? VoidedAt { get; set; }

    [MaxLength(150)]
    [Column("voided_by_user_id")]
    public string? VoidedByUserId { get; set; }

    [MaxLength(500)]
    [Column("void_reason")]
    public string? VoidReason { get; set; }

    [Column("recurring_expense_id")]
    public Guid? RecurringExpenseId { get; set; }
    public RecurringExpense? RecurringExpense { get; set; }

    [MaxLength(500)]
    [Column("notes")]
    public string? Notes { get; set; }

    [MaxLength(100)]
    [Column("receipt_reference")]
    public string? ReceiptReference { get; set; }

    [MaxLength(100)]
    [Column("created_by")]
    public string? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// ============================================================================
// 2. Sales Quotations & Line Items
// ============================================================================

[Table("sales_quotations")]
public class SalesQuotation : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("quotation_number")]
    public string QuotationNumber { get; set; } = string.Empty;

    [Column("quotation_date")]
    public DateTime QuotationDate { get; set; } = DateTime.UtcNow;

    [Column("expiry_date")]
    public DateTime ExpiryDate { get; set; } = DateTime.UtcNow.AddDays(15);

    [Column("customer_id")]
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    [MaxLength(150)]
    [Column("customer_name")]
    public string CustomerName { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("customer_phone")]
    public string? CustomerPhone { get; set; }

    [MaxLength(255)]
    [Column("customer_address")]
    public string? CustomerAddress { get; set; }

    [MaxLength(100)]
    [Column("customer_tax_no")]
    public string? CustomerTaxNo { get; set; }

    [Column("warehouse_id")]
    public Guid WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    [Column("subtotal")]
    public decimal Subtotal { get; set; }

    [Column("discount_amount")]
    public decimal DiscountAmount { get; set; }

    [Column("tax_amount")]
    public decimal TaxAmount { get; set; }

    [Column("total_amount")]
    public decimal TotalAmount { get; set; }

    [MaxLength(10)]
    [Column("currency")]
    public string Currency { get; set; } = "IQD";

    [Column("exchange_rate")]
    public decimal ExchangeRate { get; set; } = 1.0000m;

    [MaxLength(20)]
    [Column("status")]
    public string Status { get; set; } = "Draft"; // Draft, Sent, Accepted, Expired, Converted, Cancelled

    [Column("converted_invoice_id")]
    public Guid? ConvertedInvoiceId { get; set; }
    public SalesInvoice? ConvertedInvoice { get; set; }

    [Column("converted_at")]
    public DateTime? ConvertedAt { get; set; }

    [MaxLength(100)]
    [Column("salesperson_id")]
    public string? SalespersonId { get; set; }

    [MaxLength(150)]
    [Column("salesperson_name")]
    public string? SalespersonName { get; set; }

    [Column("terms_and_conditions")]
    public string? TermsAndConditions { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SalesQuotationItem> Items { get; set; } = new List<SalesQuotationItem>();
}

[Table("sales_quotation_items")]
public class SalesQuotationItem : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("quotation_id")]
    public Guid QuotationId { get; set; }
    public SalesQuotation? Quotation { get; set; }

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("product_sku")]
    public string ProductSku { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [Column("product_name")]
    public string ProductName { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("unit_of_measure")]
    public string UnitOfMeasure { get; set; } = "قطعة";

    [Column("quantity")]
    public decimal Quantity { get; set; }

    [Column("unit_price")]
    public decimal UnitPrice { get; set; }

    [Column("discount_percent")]
    public decimal DiscountPercent { get; set; }

    [Column("discount_amount")]
    public decimal DiscountAmount { get; set; }

    [Column("tax_percent")]
    public decimal TaxPercent { get; set; }

    [Column("tax_amount")]
    public decimal TaxAmount { get; set; }

    [Column("line_total")]
    public decimal LineTotal { get; set; }

    [MaxLength(255)]
    [Column("notes")]
    public string? Notes { get; set; }
}

// ============================================================================
// 3. Price Lists, Tiers & Product Bundles
// ============================================================================

[Table("price_lists")]
public class PriceList : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(10)]
    [Column("currency")]
    public string Currency { get; set; } = "IQD";

    [Column("is_default")]
    public bool IsDefault { get; set; } = false;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("start_date")]
    public DateTime? StartDate { get; set; }

    [Column("end_date")]
    public DateTime? EndDate { get; set; }

    [Column("description")]
    public string? Description { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<PriceListItem> Items { get; set; } = new List<PriceListItem>();
}

[Table("price_list_items")]
public class PriceListItem : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("price_list_id")]
    public Guid PriceListId { get; set; }
    public PriceList? PriceList { get; set; }

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Column("min_quantity")]
    public decimal MinQuantity { get; set; } = 1.0m;

    [Column("unit_price")]
    public decimal UnitPrice { get; set; }

    [Column("discount_percent")]
    public decimal DiscountPercent { get; set; } = 0.0m;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("product_bundle_items")]
public class ProductBundleItem : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("parent_product_id")]
    public Guid ParentProductId { get; set; }
    public Product? ParentProduct { get; set; }

    [Column("component_product_id")]
    public Guid ComponentProductId { get; set; }
    public Product? ComponentProduct { get; set; }

    [Column("quantity")]
    public decimal Quantity { get; set; } = 1.0m;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("product_quantity_tiers")]
public class ProductQuantityTier : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Column("min_qty")]
    public int MinQty { get; set; } = 2;

    [Column("max_qty")]
    public int? MaxQty { get; set; }

    [Column("unit_price")]
    public decimal UnitPrice { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// ============================================================================
// 4. Purchase Returns & Return Line Items
// ============================================================================

[Table("purchase_returns")]
public class PurchaseReturn : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("return_number")]
    public string ReturnNumber { get; set; } = string.Empty;

    [Column("original_bill_id")]
    public Guid OriginalBillId { get; set; }
    public PurchaseBill? OriginalBill { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("original_bill_number")]
    public string OriginalBillNumber { get; set; } = string.Empty;

    [Column("supplier_id")]
    public Guid SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    [Column("warehouse_id")]
    public Guid WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    [Column("return_date")]
    public DateTime ReturnDate { get; set; } = DateTime.UtcNow;

    [MaxLength(20)]
    [Column("status")]
    public string Status { get; set; } = "DRAFT"; // DRAFT, APPROVED, COMPLETED, CANCELLED

    [Column("subtotal")]
    public decimal Subtotal { get; set; }

    [Column("tax_amount")]
    public decimal TaxAmount { get; set; }

    [Column("total_amount")]
    public decimal TotalAmount { get; set; }

    [MaxLength(10)]
    [Column("currency")]
    public string Currency { get; set; } = "IQD";

    [Column("exchange_rate")]
    public decimal ExchangeRate { get; set; } = 1.0000m;

    [MaxLength(50)]
    [Column("refund_method")]
    public string RefundMethod { get; set; } = "SUPPLIER_CREDIT"; // SUPPLIER_CREDIT, CASH_REFUND, BANK_REFUND

    [Column("cash_box_id")]
    public Guid? CashBoxId { get; set; }
    public CashBox? CashBox { get; set; }

    [Column("return_reason")]
    public string? ReturnReason { get; set; }

    [MaxLength(150)]
    [Column("approved_by")]
    public string? ApprovedBy { get; set; }

    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [MaxLength(100)]
    [Column("created_by")]
    public string? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<PurchaseReturnItem> Items { get; set; } = new List<PurchaseReturnItem>();
}

[Table("purchase_return_items")]
public class PurchaseReturnItem : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("return_id")]
    public Guid ReturnId { get; set; }
    public PurchaseReturn? Return { get; set; }

    [Column("purchase_bill_item_id")]
    public Guid PurchaseBillItemId { get; set; }
    public PurchaseBillItem? PurchaseBillItem { get; set; }

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("product_sku")]
    public string ProductSku { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [Column("product_name")]
    public string ProductName { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("unit_of_measure")]
    public string UnitOfMeasure { get; set; } = "قطعة";

    [Column("purchased_quantity")]
    public decimal PurchasedQuantity { get; set; }

    [Column("previously_returned_quantity")]
    public decimal PreviouslyReturnedQuantity { get; set; } = 0.0m;

    [Column("return_quantity")]
    public decimal ReturnQuantity { get; set; }

    [Column("unit_cost")]
    public decimal UnitCost { get; set; }

    [Column("line_total")]
    public decimal LineTotal { get; set; }

    [MaxLength(255)]
    [Column("reason")]
    public string? Reason { get; set; }

    [MaxLength(100)]
    [Column("serial_number")]
    public string? SerialNumber { get; set; }
}

// ============================================================================
// 5. Serial / IMEI & Warranty Tracking
// ============================================================================

[Table("product_serials")]
public class ProductSerial : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("serial_number")]
    public string SerialNumber { get; set; } = string.Empty;

    [Column("product_id")]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Column("warehouse_id")]
    public Guid WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    [Required]
    [MaxLength(20)]
    [Column("status")]
    public string Status { get; set; } = "InStock"; // InStock, Sold, Returned, Defective, Transferred

    // Inbound Purchase Attribution
    [Column("purchase_bill_id")]
    public Guid? PurchaseBillId { get; set; }
    public PurchaseBill? PurchaseBill { get; set; }

    [Column("purchase_bill_item_id")]
    public Guid? PurchaseBillItemId { get; set; }

    [Column("supplier_id")]
    public Guid? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    [MaxLength(150)]
    [Column("supplier_name")]
    public string? SupplierName { get; set; }

    [Column("purchase_date")]
    public DateTime? PurchaseDate { get; set; }

    [Column("unit_cost")]
    public decimal? UnitCost { get; set; }

    // Outbound Sales Attribution
    [Column("sales_invoice_id")]
    public Guid? SalesInvoiceId { get; set; }
    public SalesInvoice? SalesInvoice { get; set; }

    [Column("sales_invoice_item_id")]
    public Guid? SalesInvoiceItemId { get; set; }

    [Column("customer_id")]
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    [MaxLength(150)]
    [Column("customer_name")]
    public string? CustomerName { get; set; }

    [MaxLength(50)]
    [Column("customer_phone")]
    public string? CustomerPhone { get; set; }

    [Column("sold_date")]
    public DateTime? SoldDate { get; set; }

    [Column("selling_price")]
    public decimal? SellingPrice { get; set; }

    // Warranty Lifecycle
    [Column("warranty_months")]
    public int WarrantyMonths { get; set; } = 12;

    [Column("warranty_start_date")]
    public DateTime? WarrantyStartDate { get; set; }

    [Column("warranty_end_date")]
    public DateTime? WarrantyEndDate { get; set; }

    [NotMapped]
    public bool IsWarrantyActive =>
        Status == "Sold"
        && WarrantyMonths > 0
        && WarrantyEndDate.HasValue
        && WarrantyEndDate.Value >= DateTime.UtcNow;

    [NotMapped]
    public string WarrantyStatus
    {
        get
        {
            if (Status != "Sold") return "NotStarted";
            if (WarrantyMonths <= 0 || !WarrantyEndDate.HasValue) return "NoWarranty";
            return WarrantyEndDate.Value >= DateTime.UtcNow ? "Active" : "Expired";
        }
    }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// ============================================================================
// Immutable Audit Log Ledger
// ============================================================================

[Table("audit_logs")]
public class AuditLog : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [MaxLength(100)]
    [Column("user_id")]
    public string UserId { get; set; } = string.Empty;

    [MaxLength(150)]
    [Column("username")]
    public string? Username { get; set; }

    [Required]
    [MaxLength(20)]
    [Column("action")]
    public string Action { get; set; } = string.Empty; // INSERT, UPDATE, DELETE, APPROVE, REJECT, CONVERT

    [Required]
    [MaxLength(100)]
    [Column("entity_name")]
    public string EntityName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    [Column("entity_id")]
    public string EntityId { get; set; } = string.Empty;

    [Column("old_values", TypeName = "jsonb")]
    public string? OldValues { get; set; }

    [Column("new_values", TypeName = "jsonb")]
    public string? NewValues { get; set; }

    [MaxLength(45)]
    [Column("ip_address")]
    public string? IpAddress { get; set; }

    [Column("timestamp")]
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}

// ============================================================================
// Profit-Based Customer Loyalty & Points System
// ============================================================================

public static class LoyaltyTransactionTypes
{
    public const string Earned = "Earned";
    public const string Redeemed = "Redeemed";
    public const string ReversedOnReturn = "ReversedOnReturn";
    public const string ManualAdjustment = "ManualAdjustment";
    public const string Refunded = "Refunded";
}

public static class LoyaltyRedemptionStatuses
{
    public const string PendingPickup = "PendingPickup";
    public const string Claimed = "Claimed";
    public const string Cancelled = "Cancelled";
}

[Table("loyalty_settings")]
public class LoyaltySettings : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("is_loyalty_enabled")]
    public bool IsLoyaltyEnabled { get; set; } = true;

    [Column("profit_unit_amount", TypeName = "numeric(18, 4)")]
    public decimal ProfitUnitAmount { get; set; } = 1000.0000m;

    [Column("points_earned_per_unit", TypeName = "numeric(18, 4)")]
    public decimal PointsEarnedPerUnit { get; set; } = 10.0000m;

    [Column("points_redemption_unit", TypeName = "numeric(18, 4)")]
    public decimal PointsRedemptionUnit { get; set; } = 100.0000m;

    [Column("currency_value_per_unit", TypeName = "numeric(18, 4)")]
    public decimal CurrencyValuePerUnit { get; set; } = 1000.0000m;

    [Column("min_redeemable_points", TypeName = "numeric(18, 4)")]
    public decimal MinRedeemablePoints { get; set; } = 500.0000m;

    [MaxLength(150)]
    [Column("updated_by")]
    public string? UpdatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("loyalty_transactions")]
public class LoyaltyTransaction : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("customer_id")]
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }

    [Column("invoice_id")]
    public Guid? InvoiceId { get; set; }
    public SalesInvoice? Invoice { get; set; }

    [Column("return_id")]
    public Guid? ReturnId { get; set; }
    public RmaReturnRequest? ReturnRequest { get; set; }

    [Required]
    [MaxLength(40)]
    [Column("type")]
    public string Type { get; set; } = LoyaltyTransactionTypes.Earned;

    [Column("points_change", TypeName = "numeric(18, 4)")]
    public decimal PointsChange { get; set; }

    [Column("profit_basis", TypeName = "numeric(18, 4)")]
    public decimal ProfitBasis { get; set; } = 0.0000m;

    [Column("balance_after", TypeName = "numeric(18, 4)")]
    public decimal BalanceAfter { get; set; }

    [MaxLength(500)]
    [Column("notes")]
    public string? Notes { get; set; }

    [Required]
    [MaxLength(150)]
    [Column("created_by")]
    public string CreatedBy { get; set; } = "System";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}



[Table("loyalty_rewards")]
public class LoyaltyReward : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(200)]
    [Column("title")]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    [Column("description")]
    public string? Description { get; set; }

    [Column("image_url")]
    public string? ImageUrl { get; set; }

    [Column("points_cost", TypeName = "numeric(18, 4)")]
    public decimal PointsCost { get; set; }

    [Column("product_id")]
    public Guid? ProductId { get; set; }
    public Product? Product { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("display_order")]
    public int DisplayOrder { get; set; } = 0;

    [Column("is_deleted")]
    public bool IsDeleted { get; set; } = false;

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("loyalty_redemption_vouchers")]
public class LoyaltyRedemptionVoucher : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("customer_id")]
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }

    [Column("reward_id")]
    public Guid RewardId { get; set; }
    public LoyaltyReward? Reward { get; set; }

    [Required]
    [MaxLength(40)]
    [Column("voucher_code")]
    public string VoucherCode { get; set; } = string.Empty;

    [Column("points_spent", TypeName = "numeric(18, 4)")]
    public decimal PointsSpent { get; set; }

    [Required]
    [MaxLength(30)]
    [Column("status")]
    public string Status { get; set; } = LoyaltyRedemptionStatuses.PendingPickup;

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [Column("claimed_at")]
    public DateTimeOffset? ClaimedAt { get; set; }

    [Column("claimed_by_shift_id")]
    public Guid? ClaimedByShiftId { get; set; }
}

// ============================================================================
// Multi-Tenant Partners, Equity Shares & Live Profit Distribution
// ============================================================================

public static class PartnerTransactionTypes
{
    public const string Withdrawal = "Withdrawal";
    public const string ProfitPayout = "ProfitPayout";
    public const string CapitalInjection = "CapitalInjection";
}

[Table("partners")]
public class Partner : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(200)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("phone")]
    public string? Phone { get; set; }

    [Column("capital_amount", TypeName = "numeric(18, 4)")]
    public decimal CapitalAmount { get; set; } = 0.0000m;

    [Column("profit_share_percent", TypeName = "numeric(5, 2)")]
    public decimal ProfitSharePercent { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [MaxLength(1000)]
    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("partner_transactions")]
public class PartnerTransaction : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("partner_id")]
    public Guid PartnerId { get; set; }
    public Partner? Partner { get; set; }

    [Required]
    [MaxLength(40)]
    [Column("transaction_type")]
    public string TransactionType { get; set; } = PartnerTransactionTypes.Withdrawal;

    [Column("amount", TypeName = "numeric(18, 4)")]
    public decimal Amount { get; set; }

    [MaxLength(1000)]
    [Column("notes")]
    public string? Notes { get; set; }

    [Column("shift_id")]
    public Guid? ShiftId { get; set; }

    [Column("created_by")]
    public Guid CreatedBy { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public static class RecurringExpenseFrequency
{
    public const string Monthly = "Monthly";
    public const string Weekly = "Weekly";
    public const string Yearly = "Yearly";
    public const string CustomDays = "CustomDays";
}

public static class RecurringExpenseExecutionMode
{
    public const string AutoPost = "AutoPost";
    public const string RemindAndConfirm = "RemindAndConfirm";
}

[Table("recurring_expenses")]
public class RecurringExpense : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(200)]
    [Column("title")]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    [Column("category")]
    public string Category { get; set; } = string.Empty;

    [Column("amount", TypeName = "numeric(18, 4)")]
    public decimal Amount { get; set; }

    [Required]
    [MaxLength(30)]
    [Column("frequency")]
    public string Frequency { get; set; } = RecurringExpenseFrequency.Monthly;

    [Column("day_of_month")]
    public int? DayOfMonth { get; set; }

    [Column("day_of_week")]
    public int? DayOfWeek { get; set; }

    [Column("interval_days")]
    public int? IntervalDays { get; set; }

    [Column("next_due_date")]
    public DateTimeOffset NextDueDate { get; set; } = DateTimeOffset.UtcNow;

    [Column("last_executed_date")]
    public DateTimeOffset? LastExecutedDate { get; set; }

    [Required]
    [MaxLength(30)]
    [Column("execution_mode")]
    public string ExecutionMode { get; set; } = RecurringExpenseExecutionMode.RemindAndConfirm;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("is_deleted")]
    public bool IsDeleted { get; set; } = false;

    [MaxLength(1000)]
    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
