using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Domain.Entities;
using ERP.Warehouse.Api.Services;
using Warehouse = ERP.Warehouse.Api.Models.Warehouse;

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
            .HasKey(ws => new { ws.WarehouseId, ws.ProductId });

        modelBuilder.Entity<WarehouseStock>()
            .HasOne(ws => ws.Warehouse)
            .WithMany(w => w.Stocks)
            .HasForeignKey(ws => ws.WarehouseId);

        modelBuilder.Entity<WarehouseStock>()
            .HasOne(ws => ws.Product)
            .WithMany(p => p.WarehouseStocks)
            .HasForeignKey(ws => ws.ProductId);

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
    }
}


