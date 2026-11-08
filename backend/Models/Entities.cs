using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ERP.Warehouse.Api.Models;

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

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<WarehouseStock> WarehouseStocks { get; set; } = new List<WarehouseStock>();
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

    [Column("subtotal")]
    public decimal Subtotal { get; set; }

    [Column("tax_amount")]
    public decimal TaxAmount { get; set; }

    [Column("discount_amount")]
    public decimal DiscountAmount { get; set; }

    [Column("total_amount")]
    public decimal TotalAmount { get; set; }

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

    [Column("was_manager_override")]
    public bool WasManagerOverride { get; set; } = false;

    [Column("approved_by_manager_id")]
    public string? ApprovedByManagerId { get; set; }
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

    [Column("subtotal")]
    public decimal Subtotal { get; set; }

    [Column("discount_amount")]
    public decimal DiscountAmount { get; set; }

    [Column("shipping_cost")]
    public decimal ShippingCost { get; set; }

    [Column("net_total")]
    public decimal NetTotal { get; set; }

    [Column("paid_amount")]
    public decimal PaidAmount { get; set; }

    [Column("balance_due")]
    public decimal BalanceDue { get; set; }

    [MaxLength(100)]
    [Column("treasury_account_id")]
    public string? TreasuryAccountId { get; set; }

    [MaxLength(50)]
    [Column("bill_status")]
    public string BillStatus { get; set; } = "POSTED";

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
    Guid SupplierId,
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
    List<PurchaseBillItemInputDto> Items
);

public record PurchaseBillItemInputDto(
    Guid? ProductId,
    string Sku,
    string? Barcode,
    string Name,
    string? CategoryName,
    string UnitOfMeasure,
    int Quantity,
    decimal UnitCost,
    decimal SellingPrice,
    decimal LineTotal,
    bool IsNewProduct
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

    [Column("current_balance")]
    public decimal CurrentBalance { get; set; } = 0.0000m;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

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


