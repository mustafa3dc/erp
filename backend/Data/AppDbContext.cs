using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Domain.Entities;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Data;

public class AppDbContext : DbContext
{
    public ITenantProvider? TenantProvider { get; }
    public Guid? CurrentTenantId => TenantProvider?.CurrentTenantId;
    public bool IsPlatformSuperAdmin => TenantProvider?.IsPlatformSuperAdmin ?? false;

    public AppDbContext(
        DbContextOptions<AppDbContext> options,
        ITenantProvider? tenantProvider = null) : base(options)
    {
        TenantProvider = tenantProvider;
    }

    public DbSet<ERP.Warehouse.Api.Models.Warehouse> Warehouses => Set<ERP.Warehouse.Api.Models.Warehouse>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<WarehouseStock> WarehouseStocks => Set<WarehouseStock>();
    public DbSet<WarehouseShelf> WarehouseShelves => Set<WarehouseShelf>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<StockMovementItem> StockMovementItems => Set<StockMovementItem>();
    public DbSet<SalesInvoice> SalesInvoices => Set<SalesInvoice>();
    public DbSet<SalesInvoiceItem> SalesInvoiceItems => Set<SalesInvoiceItem>();
    public DbSet<StaffUser> StaffUsers => Set<StaffUser>();
    public DbSet<DiscountAuditLog> DiscountAuditLogs => Set<DiscountAuditLog>();
    public DbSet<PurchaseBill> PurchaseBills => Set<PurchaseBill>();
    public DbSet<PurchaseBillItem> PurchaseBillItems => Set<PurchaseBillItem>();
    public DbSet<FifoCostBatch> FifoCostBatches => Set<FifoCostBatch>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<SupplierLedger> SupplierLedgers => Set<SupplierLedger>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<CashBox> CashBoxes => Set<CashBox>();
    public DbSet<CashExpense> CashExpenses => Set<CashExpense>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    public DbSet<WarehouseDispatchOrder> WarehouseDispatchOrders => Set<WarehouseDispatchOrder>();
    public DbSet<RmaReturnRequest> RmaReturnRequests => Set<RmaReturnRequest>();
    public DbSet<EmployeeFinancialTransaction> EmployeeFinancialTransactions => Set<EmployeeFinancialTransaction>();
    public DbSet<InstallmentContract> InstallmentContracts => Set<InstallmentContract>();
    public DbSet<InstallmentScheduleItem> InstallmentScheduleItems => Set<InstallmentScheduleItem>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<ExpenseVoucher> ExpenseVouchers => Set<ExpenseVoucher>();
    public DbSet<SalesQuotation> SalesQuotations => Set<SalesQuotation>();
    public DbSet<SalesQuotationItem> SalesQuotationItems => Set<SalesQuotationItem>();
    public DbSet<PriceList> PriceLists => Set<PriceList>();
    public DbSet<PriceListItem> PriceListItems => Set<PriceListItem>();
    public DbSet<ProductQuantityTier> ProductQuantityTiers => Set<ProductQuantityTier>();
    public DbSet<ProductBundleItem> ProductBundleItems => Set<ProductBundleItem>();
    public DbSet<PurchaseReturn> PurchaseReturns => Set<PurchaseReturn>();
    public DbSet<PurchaseReturnItem> PurchaseReturnItems => Set<PurchaseReturnItem>();
    public DbSet<ProductSerial> ProductSerials => Set<ProductSerial>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<LoyaltySettings> LoyaltySettings => Set<LoyaltySettings>();
    public DbSet<LoyaltyTransaction> LoyaltyTransactions => Set<LoyaltyTransaction>();
    public DbSet<LoyaltyReward> LoyaltyRewards => Set<LoyaltyReward>();
    public DbSet<LoyaltyRedemptionVoucher> LoyaltyRedemptionVouchers => Set<LoyaltyRedemptionVoucher>();
    public DbSet<Partner> Partners => Set<Partner>();
    public DbSet<PartnerTransaction> PartnerTransactions => Set<PartnerTransaction>();
    public DbSet<RecurringExpense> RecurringExpenses => Set<RecurringExpense>();
    public DbSet<TreasuryTransaction> TreasuryTransactions => Set<TreasuryTransaction>();


    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var tenantId = CurrentTenantId;
        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            foreach (var entry in ChangeTracker.Entries<ITenantEntity>())
            {
                if (entry.State == EntityState.Added)
                {
                    if (!entry.Entity.TenantId.HasValue || entry.Entity.TenantId == Guid.Empty)
                    {
                        entry.Entity.TenantId = tenantId.Value;
                    }
                }
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Strict Multi-Tenancy: Automatic Global Query Filter on all ITenantEntity tables
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(ITenantEntity).IsAssignableFrom(entityType.ClrType))
            {
                var method = typeof(DbContextExtensions)
                    .GetMethod(nameof(DbContextExtensions.ApplyTenantFilter))
                    ?.MakeGenericMethod(entityType.ClrType);
                method?.Invoke(null, new object[] { modelBuilder, this });
            }
        }

        // Composite key for WarehouseStock
        modelBuilder.Entity<WarehouseStock>()
            .ToTable("warehouse_stock")
            .HasKey(ws => new { ws.WarehouseId, ws.ProductId });

        modelBuilder.Entity<WarehouseStock>()
            .Property(ws => ws.ShelfId)
            .HasColumnName("shelf_id");

        modelBuilder.Entity<WarehouseStock>()
            .HasOne(ws => ws.Warehouse)
            .WithMany(w => w.Stocks)
            .HasForeignKey(ws => ws.WarehouseId);

        modelBuilder.Entity<WarehouseStock>()
            .HasOne(ws => ws.Product)
            .WithMany(p => p.WarehouseStocks)
            .HasForeignKey(ws => ws.ProductId);

        modelBuilder.Entity<WarehouseStock>()
            .HasOne(ws => ws.Shelf)
            .WithMany()
            .HasForeignKey(ws => ws.ShelfId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<WarehouseShelf>(entity =>
        {
            entity.ToTable("warehouse_shelves");
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Id).HasColumnName("id");
            entity.Property(s => s.TenantId).HasColumnName("tenant_id");
            entity.Property(s => s.WarehouseId).HasColumnName("warehouse_id");
            entity.Property(s => s.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.Property(s => s.Code).HasColumnName("code").HasMaxLength(50);
            entity.Property(s => s.Notes).HasColumnName("notes");
            entity.Property(s => s.MaxCapacity).HasColumnName("max_capacity");
            entity.Property(s => s.IsActive).HasColumnName("is_active");
            entity.Property(s => s.CreatedAt).HasColumnName("created_at");
            entity.Property(s => s.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(s => s.Warehouse)
                .WithMany()
                .HasForeignKey(s => s.WarehouseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Movement items relation
        modelBuilder.Entity<StockMovementItem>()
            .HasOne(smi => smi.Movement)
            .WithMany(m => m.Items)
            .HasForeignKey(smi => smi.MovementId);

        // Sales invoice items relation
        modelBuilder.Entity<SalesInvoiceItem>()
            .HasOne<Product>(sii => sii.Product)
            .WithMany()
            .HasForeignKey(sii => sii.ProductId);

        // Discount audit log relation
        modelBuilder.Entity<DiscountAuditLog>()
            .HasOne(dal => dal.Product)
            .WithMany()
            .HasForeignKey(dal => dal.ProductId);

        // Indexes for performance
        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Barcode);

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Sku);

        modelBuilder.Entity<DiscountAuditLog>()
            .HasIndex(dal => dal.InvoiceNumber);

        modelBuilder.Entity<DiscountAuditLog>()
            .HasIndex(dal => dal.CreatedAt);

        modelBuilder.Entity<StaffUser>()
            .HasIndex(u => u.StaffCode)
            .IsUnique();

        // Multi-Tenant Identity Model Configuration
        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasIndex(t => t.Slug).IsUnique();

            entity.Property(t => t.BusinessPreset)
                .HasConversion<string>()
                .HasMaxLength(50);

            entity.Property(t => t.Features)
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => string.IsNullOrWhiteSpace(v) 
                        ? new CompanyFeatures() 
                        : System.Text.Json.JsonSerializer.Deserialize<CompanyFeatures>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new CompanyFeatures()
                )
                .HasColumnType("jsonb");
        });

        modelBuilder.Entity<User>()
            .HasOne(u => u.Tenant)
            .WithMany(t => t.Users)
            .HasForeignKey(u => u.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        // Composite Unique Constraint: UNIQUE (tenant_id, LOWER(username))
        modelBuilder.Entity<User>()
            .HasIndex(u => new { u.TenantId, u.Username })
            .IsUnique();

        // Granular Permissions Configuration
        modelBuilder.Entity<Permission>()
            .HasIndex(p => p.Code)
            .IsUnique();

        modelBuilder.Entity<UserPermission>()
            .HasKey(up => new { up.UserId, up.PermissionCode });

        modelBuilder.Entity<UserPermission>()
            .HasOne(up => up.User)
            .WithMany()
            .HasForeignKey(up => up.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserPermission>()
            .HasOne(up => up.Permission)
            .WithMany(p => p.UserPermissions)
            .HasPrincipalKey(p => p.Code)
            .HasForeignKey(up => up.PermissionCode)
            .OnDelete(DeleteBehavior.Cascade);

        // Installment System Model Configuration
        modelBuilder.Entity<InstallmentContract>()
            .HasMany(c => c.Schedules)
            .WithOne(s => s.Contract)
            .HasForeignKey(s => s.ContractId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<InstallmentContract>()
            .HasIndex(c => c.ContractNumber)
            .IsUnique();

        modelBuilder.Entity<InstallmentContract>()
            .HasIndex(c => c.InvoiceId);

        modelBuilder.Entity<InstallmentContract>()
            .HasIndex(c => c.CustomerId);

        modelBuilder.Entity<InstallmentScheduleItem>()
            .HasIndex(s => s.DueDate);

        modelBuilder.Entity<InstallmentScheduleItem>()
            .HasIndex(s => s.Status);

        // =====================================================================
        // New Enterprise Modules Configurations
        // =====================================================================

        // Customer Configurations
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasIndex(c => new { c.TenantId, c.Code });
            entity.HasIndex(c => c.LoyaltyMemberCode)
                .IsUnique()
                .HasFilter("loyalty_member_code IS NOT NULL");
            entity.HasIndex(c => c.LoyaltyCardToken)
                .IsUnique()
                .HasFilter("loyalty_card_token IS NOT NULL");
            entity.HasIndex(c => c.NormalizedPhone)
                .HasFilter("normalized_phone IS NOT NULL");
            entity.Property(c => c.CreditLimit).HasColumnType("numeric(18, 4)");
            entity.Property(c => c.CurrentBalance).HasColumnType("numeric(18, 4)");
            entity.Property(c => c.LoyaltyPointsBalance).HasColumnType("numeric(18, 4)");

            entity.HasOne(c => c.PriceList)
                .WithMany()
                .HasForeignKey(c => c.PriceListId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // 1. Operational Expenses Configurations
        modelBuilder.Entity<ExpenseCategory>(entity =>
        {
            entity.HasIndex(ec => new { ec.TenantId, ec.Code });
            entity.Property(ec => ec.MonthlyBudgetCap).HasColumnType("numeric(18, 4)");
            entity.HasMany(ec => ec.Vouchers)
                .WithOne(v => v.ExpenseCategory)
                .HasForeignKey(v => v.ExpenseCategoryId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ExpenseVoucher>(entity =>
        {
            entity.HasIndex(ev => new { ev.TenantId, ev.VoucherNumber });
            entity.Property(ev => ev.Amount).HasColumnType("numeric(18, 4)");
            entity.Property(ev => ev.ExchangeRate).HasColumnType("numeric(18, 4)");
            entity.Property(ev => ev.BaseCurrencyAmount).HasColumnType("numeric(18, 4)");

            entity.HasOne(ev => ev.CashBox)
                .WithMany()
                .HasForeignKey(ev => ev.CashBoxId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(ev => ev.RecurringExpenseId);
            entity.HasOne(ev => ev.RecurringExpense)
                .WithMany()
                .HasForeignKey(ev => ev.RecurringExpenseId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // 2. Sales Quotations Configurations
        modelBuilder.Entity<SalesQuotation>(entity =>
        {
            entity.HasIndex(sq => new { sq.TenantId, sq.QuotationNumber });
            entity.Property(sq => sq.Subtotal).HasColumnType("numeric(18, 4)");
            entity.Property(sq => sq.DiscountAmount).HasColumnType("numeric(18, 4)");
            entity.Property(sq => sq.TaxAmount).HasColumnType("numeric(18, 4)");
            entity.Property(sq => sq.TotalAmount).HasColumnType("numeric(18, 4)");
            entity.Property(sq => sq.ExchangeRate).HasColumnType("numeric(18, 4)");

            entity.HasOne(sq => sq.Customer)
                .WithMany()
                .HasForeignKey(sq => sq.CustomerId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(sq => sq.Warehouse)
                .WithMany()
                .HasForeignKey(sq => sq.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(sq => sq.ConvertedInvoice)
                .WithMany()
                .HasForeignKey(sq => sq.ConvertedInvoiceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasMany(sq => sq.Items)
                .WithOne(item => item.Quotation)
                .HasForeignKey(item => item.QuotationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SalesQuotationItem>(entity =>
        {
            entity.Property(sqi => sqi.Quantity).HasColumnType("numeric(12, 3)");
            entity.Property(sqi => sqi.UnitPrice).HasColumnType("numeric(18, 4)");
            entity.Property(sqi => sqi.DiscountPercent).HasColumnType("numeric(5, 2)");
            entity.Property(sqi => sqi.DiscountAmount).HasColumnType("numeric(18, 4)");
            entity.Property(sqi => sqi.TaxPercent).HasColumnType("numeric(5, 2)");
            entity.Property(sqi => sqi.TaxAmount).HasColumnType("numeric(18, 4)");
            entity.Property(sqi => sqi.LineTotal).HasColumnType("numeric(18, 4)");

            entity.HasOne(sqi => sqi.Product)
                .WithMany()
                .HasForeignKey(sqi => sqi.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 3. Price Lists & Bundles Configurations
        modelBuilder.Entity<PriceList>(entity =>
        {
            entity.HasIndex(pl => new { pl.TenantId, pl.Code });
            entity.HasMany(pl => pl.Items)
                .WithOne(item => item.PriceList)
                .HasForeignKey(item => item.PriceListId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PriceListItem>(entity =>
        {
            entity.HasIndex(pli => new { pli.PriceListId, pli.ProductId, pli.MinQuantity });
            entity.Property(pli => pli.MinQuantity).HasColumnType("numeric(12, 3)");
            entity.Property(pli => pli.UnitPrice).HasColumnType("numeric(18, 4)");
            entity.Property(pli => pli.DiscountPercent).HasColumnType("numeric(5, 2)");

            entity.HasOne(pli => pli.Product)
                .WithMany()
                .HasForeignKey(pli => pli.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProductBundleItem>(entity =>
        {
            entity.HasIndex(bi => new { bi.ParentProductId, bi.ComponentProductId });
            entity.Property(bi => bi.Quantity).HasColumnType("numeric(12, 3)");

            entity.HasOne(bi => bi.ParentProduct)
                .WithMany(p => p.BundleComponents)
                .HasForeignKey(bi => bi.ParentProductId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(bi => bi.ComponentProduct)
                .WithMany()
                .HasForeignKey(bi => bi.ComponentProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProductQuantityTier>(entity =>
        {
            entity.HasIndex(qt => new { qt.TenantId, qt.ProductId, qt.MinQty });
            entity.Property(qt => qt.UnitPrice).HasColumnType("numeric(18, 4)");

            entity.HasOne(qt => qt.Product)
                .WithMany(p => p.QuantityTiers)
                .HasForeignKey(qt => qt.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // 4. Purchase Returns Configurations
        modelBuilder.Entity<PurchaseReturn>(entity =>
        {
            entity.HasIndex(pr => new { pr.TenantId, pr.ReturnNumber });
            entity.Property(pr => pr.Subtotal).HasColumnType("numeric(18, 4)");
            entity.Property(pr => pr.TaxAmount).HasColumnType("numeric(18, 4)");
            entity.Property(pr => pr.TotalAmount).HasColumnType("numeric(18, 4)");
            entity.Property(pr => pr.ExchangeRate).HasColumnType("numeric(18, 4)");

            entity.HasOne(pr => pr.OriginalBill)
                .WithMany()
                .HasForeignKey(pr => pr.OriginalBillId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(pr => pr.Supplier)
                .WithMany()
                .HasForeignKey(pr => pr.SupplierId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(pr => pr.Warehouse)
                .WithMany()
                .HasForeignKey(pr => pr.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(pr => pr.CashBox)
                .WithMany()
                .HasForeignKey(pr => pr.CashBoxId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(pr => pr.Items)
                .WithOne(item => item.Return)
                .HasForeignKey(item => item.ReturnId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PurchaseReturnItem>(entity =>
        {
            entity.Property(pri => pri.PurchasedQuantity).HasColumnType("numeric(12, 3)");
            entity.Property(pri => pri.PreviouslyReturnedQuantity).HasColumnType("numeric(12, 3)");
            entity.Property(pri => pri.ReturnQuantity).HasColumnType("numeric(12, 3)");
            entity.Property(pri => pri.UnitCost).HasColumnType("numeric(18, 4)");
            entity.Property(pri => pri.LineTotal).HasColumnType("numeric(18, 4)");

            entity.HasOne(pri => pri.PurchaseBillItem)
                .WithMany()
                .HasForeignKey(pri => pri.PurchaseBillItemId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(pri => pri.Product)
                .WithMany()
                .HasForeignKey(pri => pri.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 5. Serial / IMEI & Warranty Tracking Configurations
        modelBuilder.Entity<ProductSerial>(entity =>
        {
            entity.HasIndex(ps => new { ps.TenantId, ps.SerialNumber });
            entity.HasIndex(ps => new { ps.ProductId, ps.SerialNumber });
            entity.HasIndex(ps => ps.Status);
            entity.Property(ps => ps.UnitCost).HasColumnType("numeric(18, 4)");
            entity.Property(ps => ps.SellingPrice).HasColumnType("numeric(18, 4)");

            entity.HasOne(ps => ps.Product)
                .WithMany()
                .HasForeignKey(ps => ps.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(ps => ps.Warehouse)
                .WithMany()
                .HasForeignKey(ps => ps.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(ps => ps.PurchaseBill)
                .WithMany()
                .HasForeignKey(ps => ps.PurchaseBillId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(ps => ps.SalesInvoice)
                .WithMany()
                .HasForeignKey(ps => ps.SalesInvoiceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(ps => ps.Customer)
                .WithMany()
                .HasForeignKey(ps => ps.CustomerId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(ps => ps.Supplier)
                .WithMany()
                .HasForeignKey(ps => ps.SupplierId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Immutable Audit Logs Configuration
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasIndex(al => new { al.TenantId, al.EntityName, al.EntityId });
            entity.HasIndex(al => al.Timestamp);
        });

        // Profit-Based Customer Loyalty Configurations
        modelBuilder.Entity<LoyaltySettings>(entity =>
        {
            entity.HasIndex(ls => ls.TenantId).IsUnique();
            entity.Property(ls => ls.ProfitUnitAmount).HasColumnType("numeric(18, 4)");
            entity.Property(ls => ls.PointsEarnedPerUnit).HasColumnType("numeric(18, 4)");
            entity.Property(ls => ls.PointsRedemptionUnit).HasColumnType("numeric(18, 4)");
            entity.Property(ls => ls.CurrencyValuePerUnit).HasColumnType("numeric(18, 4)");
            entity.Property(ls => ls.MinRedeemablePoints).HasColumnType("numeric(18, 4)");
        });

        modelBuilder.Entity<LoyaltyTransaction>(entity =>
        {
            entity.HasIndex(lt => new { lt.TenantId, lt.CustomerId, lt.CreatedAt });
            entity.HasIndex(lt => lt.InvoiceId);
            entity.HasIndex(lt => lt.ReturnId);
            entity.Property(lt => lt.PointsChange).HasColumnType("numeric(18, 4)");
            entity.Property(lt => lt.ProfitBasis).HasColumnType("numeric(18, 4)");
            entity.Property(lt => lt.BalanceAfter).HasColumnType("numeric(18, 4)");

            entity.HasOne(lt => lt.Customer)
                .WithMany()
                .HasForeignKey(lt => lt.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(lt => lt.Invoice)
                .WithMany()
                .HasForeignKey(lt => lt.InvoiceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(lt => lt.ReturnRequest)
                .WithMany()
                .HasForeignKey(lt => lt.ReturnId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<LoyaltyReward>(entity =>
        {
            entity.HasIndex(r => new { r.TenantId, r.IsActive, r.IsDeleted, r.DisplayOrder });
            entity.HasIndex(r => r.ProductId);
            entity.Property(r => r.PointsCost).HasColumnType("numeric(18, 4)");

            entity.HasOne(r => r.Product)
                .WithMany()
                .HasForeignKey(r => r.ProductId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<LoyaltyRedemptionVoucher>(entity =>
        {
            entity.HasIndex(v => v.VoucherCode).IsUnique();
            entity.HasIndex(v => new { v.TenantId, v.CustomerId, v.Status, v.CreatedAt });
            entity.Property(v => v.PointsSpent).HasColumnType("numeric(18, 4)");

            entity.HasOne(v => v.Customer)
                .WithMany()
                .HasForeignKey(v => v.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(v => v.Reward)
                .WithMany()
                .HasForeignKey(v => v.RewardId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Partner>(entity =>
        {
            entity.HasIndex(p => new { p.TenantId, p.IsActive });
            entity.Property(p => p.CapitalAmount).HasColumnType("numeric(18, 4)");
            entity.Property(p => p.ProfitSharePercent).HasColumnType("numeric(5, 2)");
        });

        modelBuilder.Entity<PartnerTransaction>(entity =>
        {
            entity.HasIndex(pt => new { pt.TenantId, pt.PartnerId, pt.CreatedAt });
            entity.Property(pt => pt.Amount).HasColumnType("numeric(18, 4)");

            entity.HasOne(pt => pt.Partner)
                .WithMany()
                .HasForeignKey(pt => pt.PartnerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RecurringExpense>(entity =>
        {
            entity.HasIndex(re => new { re.TenantId, re.IsActive, re.IsDeleted, re.NextDueDate });
            entity.Property(re => re.Amount).HasColumnType("numeric(18, 4)");
        });

        modelBuilder.Entity<PurchaseBill>(entity =>
        {
            entity.HasIndex(pb => new { pb.TenantId, pb.CashAccountId, pb.BillStatus });
            entity.Property(pb => pb.Subtotal).HasColumnType("numeric(18, 4)");
            entity.Property(pb => pb.DiscountAmount).HasColumnType("numeric(18, 4)");
            entity.Property(pb => pb.ShippingCost).HasColumnType("numeric(18, 4)");
            entity.Property(pb => pb.NetTotal).HasColumnType("numeric(18, 4)");
            entity.Property(pb => pb.PaidAmount).HasColumnType("numeric(18, 4)");
            entity.Property(pb => pb.BalanceDue).HasColumnType("numeric(18, 4)");
            entity.Property(pb => pb.RemainingAmount).HasColumnType("numeric(18, 4)");

            entity.HasOne(pb => pb.CashAccount)
                .WithMany()
                .HasForeignKey(pb => pb.CashAccountId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CashBox>(entity =>
        {
            entity.HasIndex(cb => new { cb.TenantId, cb.IsActive, cb.Code });
            entity.Property(cb => cb.CurrentBalance).HasColumnType("numeric(18, 4)");
        });

        modelBuilder.Entity<TreasuryTransaction>(entity =>
        {
            entity.HasIndex(tt => new { tt.TenantId, tt.CashBoxId, tt.CreatedAt });
            entity.HasIndex(tt => tt.ExpenseVoucherId);
            entity.HasIndex(tt => tt.PurchaseBillId);
            entity.HasIndex(tt => tt.SupplierId);
            entity.HasIndex(tt => tt.TransferGroupId);
            entity.Property(tt => tt.Amount).HasColumnType("numeric(18, 4)");
            entity.Property(tt => tt.BalanceAfter).HasColumnType("numeric(18, 4)");

            entity.HasOne(tt => tt.CashBox)
                .WithMany()
                .HasForeignKey(tt => tt.CashBoxId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(tt => tt.ExpenseVoucher)
                .WithMany()
                .HasForeignKey(tt => tt.ExpenseVoucherId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(tt => tt.PurchaseBill)
                .WithMany()
                .HasForeignKey(tt => tt.PurchaseBillId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(tt => tt.Supplier)
                .WithMany()
                .HasForeignKey(tt => tt.SupplierId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}


