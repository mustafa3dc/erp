using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public class TenantBackupSettingsDto
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string CountryCode { get; set; } = "IQ";
    public string Currency { get; set; } = "IQD";
    public BusinessPreset BusinessPreset { get; set; } = BusinessPreset.Custom;
    public CompanyFeatures Features { get; set; } = new();
    public string? ContactInfo { get; set; }
    public string? LogoUrl { get; set; }
}

public class TenantBackupDataDto
{
    public TenantBackupSettingsDto Settings { get; set; } = new();
    public List<ERP.Warehouse.Api.Models.Warehouse> Warehouses { get; set; } = new();
    public List<WarehouseShelf> Shelves { get; set; } = new();
    public List<Category> Categories { get; set; } = new();
    public List<Product> Products { get; set; } = new();
    public List<WarehouseStock> WarehouseStocks { get; set; } = new();
    public List<Customer> Customers { get; set; } = new();
    public List<Supplier> Suppliers { get; set; } = new();
    public List<SupplierLedger> SupplierLedgers { get; set; } = new();
    public List<SalesInvoice> Sales { get; set; } = new();
    public List<SalesInvoiceItem> SaleItems { get; set; } = new();
    public List<PurchaseBill> Purchases { get; set; } = new();
    public List<PurchaseBillItem> PurchaseItems { get; set; } = new();
    public List<FifoCostBatch> FifoCostBatches { get; set; } = new();
    public List<InstallmentContract> Installments { get; set; } = new();
    public List<InstallmentScheduleItem> InstallmentSchedules { get; set; } = new();
    public List<CashBox> TreasuryAccounts { get; set; } = new();
    public List<TreasuryTransaction> Vouchers { get; set; } = new();
    public List<ExpenseCategory> ExpenseCategories { get; set; } = new();
    public List<ExpenseVoucher> Expenses { get; set; } = new();
    public List<CashExpense> CashExpenses { get; set; } = new();
    public List<RecurringExpense> RecurringExpenses { get; set; } = new();
}

public class TenantBackupArchiveDto
{
    public string SchemaVersion { get; set; } = "1.0";
    public Guid TenantId { get; set; }
    public string TenantSlug { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public DateTimeOffset ExportedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public string ChecksumSha256 { get; set; } = string.Empty;
    public TenantBackupDataDto Data { get; set; } = new();
}

public sealed record TenantBackupStatusDto(
    Guid TenantId,
    string TenantSlug,
    string TenantName,
    DateTimeOffset? LastBackupAt
);

public sealed record TenantBackupRestoreResultDto(
    Guid TenantId,
    DateTimeOffset RestoredAtUtc,
    int WarehousesRestored,
    int ProductsRestored,
    int CustomersRestored,
    int SuppliersRestored,
    int SalesRestored,
    int PurchasesRestored,
    int InstallmentsRestored,
    int TreasuryAccountsRestored,
    int VouchersRestored,
    int ExpensesRestored
);

public interface ITenantBackupService
{
    Task<ApiResponse<TenantBackupStatusDto>> GetStatusAsync(Guid tenantId, CancellationToken ct = default);
    Task<(ApiResponse<TenantBackupArchiveDto> Result, byte[]? FileBytes, string? FileName)> ExportAsync(Guid tenantId, string actor, CancellationToken ct = default);
    Task<ApiResponse<TenantBackupRestoreResultDto>> RestoreAsync(Guid tenantId, string rawJson, string actor, CancellationToken ct = default);
}

public class TenantBackupService : ITenantBackupService
{
    private const string SupportedSchemaVersion = "1.0";

    private static readonly JsonSerializerOptions ArchiveJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
        WriteIndented = true
    };

    private static readonly JsonSerializerOptions CanonicalChecksumOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
        WriteIndented = false
    };

    private readonly AppDbContext _context;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<TenantBackupService> _logger;

    public TenantBackupService(
        AppDbContext context,
        IAuditLogService auditLogService,
        ILogger<TenantBackupService> logger)
    {
        _context = context;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task<ApiResponse<TenantBackupStatusDto>> GetStatusAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        if (tenant == null)
        {
            return ApiResponse<TenantBackupStatusDto>.Fail("ERR_TENANT_NOT_FOUND", "BACKUP");
        }

        return ApiResponse<TenantBackupStatusDto>.Ok(new TenantBackupStatusDto(
            tenant.Id,
            tenant.Slug,
            tenant.Name,
            tenant.LastBackupAt));
    }

    public async Task<(ApiResponse<TenantBackupArchiveDto> Result, byte[]? FileBytes, string? FileName)> ExportAsync(
        Guid tenantId,
        string actor,
        CancellationToken ct = default)
    {
        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null)
        {
            return (ApiResponse<TenantBackupArchiveDto>.Fail("ERR_TENANT_NOT_FOUND", "BACKUP"), null, null);
        }

        var data = new TenantBackupDataDto
        {
            Settings = new TenantBackupSettingsDto
            {
                Name = tenant.Name,
                Slug = tenant.Slug,
                CountryCode = tenant.CountryCode,
                Currency = tenant.Currency,
                BusinessPreset = tenant.BusinessPreset,
                Features = tenant.Features?.Clone() ?? new CompanyFeatures(),
                ContactInfo = tenant.ContactInfo,
                LogoUrl = tenant.LogoUrl
            },
            Warehouses = await _context.Warehouses.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            Shelves = await _context.WarehouseShelves.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            Categories = await _context.Categories.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            Products = await _context.Products.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            WarehouseStocks = await _context.WarehouseStocks.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            Customers = await _context.Customers.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            Suppliers = await _context.Suppliers.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            SupplierLedgers = await _context.SupplierLedgers.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            Sales = await _context.SalesInvoices.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            SaleItems = await _context.SalesInvoiceItems.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            Purchases = await _context.PurchaseBills.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            PurchaseItems = await _context.PurchaseBillItems.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            FifoCostBatches = await _context.FifoCostBatches.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            Installments = await _context.InstallmentContracts.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            InstallmentSchedules = await _context.InstallmentScheduleItems.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            TreasuryAccounts = await _context.CashBoxes.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            Vouchers = await _context.TreasuryTransactions.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            ExpenseCategories = await _context.ExpenseCategories.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            Expenses = await _context.ExpenseVouchers.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            CashExpenses = await _context.CashExpenses.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct),
            RecurringExpenses = await _context.RecurringExpenses.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).ToListAsync(ct)
        };

        var now = DateTimeOffset.UtcNow;
        var checksum = ComputeChecksum(data);

        var archive = new TenantBackupArchiveDto
        {
            SchemaVersion = SupportedSchemaVersion,
            TenantId = tenant.Id,
            TenantSlug = tenant.Slug,
            TenantName = tenant.Name,
            ExportedAtUtc = now,
            ChecksumSha256 = checksum,
            Data = data
        };

        tenant.LastBackupAt = now;
        tenant.UpdatedAt = now.UtcDateTime;

        _auditLogService.QueueLog(
            action: "BACKUP_EXPORT",
            entityName: "tenants",
            entityId: tenant.Id.ToString(),
            oldValues: null,
            newValues: new
            {
                SchemaVersion = archive.SchemaVersion,
                ChecksumSha256 = checksum,
                ProductsCount = data.Products.Count,
                SalesCount = data.Sales.Count,
                PurchasesCount = data.Purchases.Count,
                CustomersCount = data.Customers.Count,
                VouchersCount = data.Vouchers.Count
            },
            tenantIdOverride: tenantId,
            usernameOverride: actor);

        await _context.SaveChangesAsync(ct);

        var jsonBytes = JsonSerializer.SerializeToUtf8Bytes(archive, ArchiveJsonOptions);
        var safeSlug = string.IsNullOrWhiteSpace(tenant.Slug) ? "tenant" : tenant.Slug.Trim().ToLowerInvariant();
        var fileName = $"zilox_backup_{safeSlug}_{now:yyyyMMdd_HHmmss}.json";

        return (ApiResponse<TenantBackupArchiveDto>.Ok(archive), jsonBytes, fileName);
    }

    public async Task<ApiResponse<TenantBackupRestoreResultDto>> RestoreAsync(
        Guid tenantId,
        string rawJson,
        string actor,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return ApiResponse<TenantBackupRestoreResultDto>.Fail("ERR_INVALID_BACKUP_FILE", "BACKUP");
        }

        TenantBackupArchiveDto? archive;
        try
        {
            archive = JsonSerializer.Deserialize<TenantBackupArchiveDto>(rawJson, ArchiveJsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Invalid backup archive JSON");
            return ApiResponse<TenantBackupRestoreResultDto>.Fail("ERR_INVALID_BACKUP_FILE", "BACKUP");
        }

        if (archive == null ||
            archive.Data == null ||
            !string.Equals(archive.SchemaVersion?.Trim(), SupportedSchemaVersion, StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(archive.ChecksumSha256))
        {
            return ApiResponse<TenantBackupRestoreResultDto>.Fail("ERR_INVALID_BACKUP_FILE", "BACKUP");
        }

        if (archive.TenantId == Guid.Empty || archive.TenantId != tenantId)
        {
            return ApiResponse<TenantBackupRestoreResultDto>.Fail("ERR_BACKUP_TENANT_MISMATCH", "BACKUP");
        }

        var expectedChecksum = ComputeChecksum(archive.Data);
        if (!string.Equals(expectedChecksum, archive.ChecksumSha256.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return ApiResponse<TenantBackupRestoreResultDto>.Fail("ERR_INVALID_BACKUP_FILE", "BACKUP");
        }

        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null)
        {
            return ApiResponse<TenantBackupRestoreResultDto>.Fail("ERR_TENANT_NOT_FOUND", "BACKUP");
        }

        var data = archive.Data;

        await using var transaction = await _context.Database.BeginTransactionAsync(ct);
        try
        {
            // 1. Settings
            if (data.Settings != null)
            {
                if (!string.IsNullOrWhiteSpace(data.Settings.Name))
                    tenant.Name = data.Settings.Name;
                if (!string.IsNullOrWhiteSpace(data.Settings.CountryCode))
                    tenant.CountryCode = data.Settings.CountryCode;
                if (!string.IsNullOrWhiteSpace(data.Settings.Currency))
                    tenant.Currency = data.Settings.Currency;
                tenant.BusinessPreset = data.Settings.BusinessPreset;
                if (data.Settings.Features != null)
                    tenant.Features = data.Settings.Features.Clone();
                tenant.ContactInfo = data.Settings.ContactInfo;
                tenant.LogoUrl = data.Settings.LogoUrl;
                tenant.UpdatedAt = DateTime.UtcNow;
            }

            // 2. Core Reference Entities (Upsert scoped strictly to tenantId)
            await UpsertByIdAsync(_context.Warehouses, data.Warehouses, tenantId, w => w.Id, w =>
            {
                w.TenantId = tenantId;
                w.Stocks = new List<WarehouseStock>();
            }, ct);

            await UpsertByIdAsync(_context.WarehouseShelves, data.Shelves, tenantId, s => s.Id, s =>
            {
                s.TenantId = tenantId;
                s.Warehouse = null;
            }, ct);

            await UpsertByIdAsync(_context.Categories, data.Categories, tenantId, c => c.Id, c =>
            {
                c.TenantId = tenantId;
                c.Products = new List<Product>();
            }, ct);

            await UpsertByIdAsync(_context.Products, data.Products, tenantId, p => p.Id, p =>
            {
                p.TenantId = tenantId;
                p.Category = null;
                p.WarehouseStocks = new List<WarehouseStock>();
                p.BundleComponents = new List<ProductBundleItem>();
                p.QuantityTiers = new List<ProductQuantityTier>();
            }, ct);

            // Composite-key WarehouseStock upsert
            var existingStocks = await _context.WarehouseStocks
                .IgnoreQueryFilters()
                .Where(ws => ws.TenantId == tenantId)
                .ToListAsync(ct);
            var stockMap = existingStocks.ToDictionary(ws => (ws.WarehouseId, ws.ProductId));

            foreach (var ws in data.WarehouseStocks)
            {
                ws.TenantId = tenantId;
                ws.Warehouse = null;
                ws.Product = null;
                ws.Shelf = null;

                if (stockMap.TryGetValue((ws.WarehouseId, ws.ProductId), out var current))
                {
                    current.Quantity = ws.Quantity;
                    current.ReservedQuantity = ws.ReservedQuantity;
                    current.ShelfId = ws.ShelfId;
                    current.ShelfLocation = ws.ShelfLocation;
                    current.LastCountedAt = EnsureUtc(ws.LastCountedAt);
                }
                else
                {
                    ws.LastCountedAt = EnsureUtc(ws.LastCountedAt);
                    _context.WarehouseStocks.Add(ws);
                }
            }

            await UpsertByIdAsync(_context.Customers, data.Customers, tenantId, c => c.Id, c =>
            {
                c.TenantId = tenantId;
                c.PriceList = null;
            }, ct);

            await UpsertByIdAsync(_context.Suppliers, data.Suppliers, tenantId, s => s.Id, s =>
            {
                s.TenantId = tenantId;
            }, ct);

            await UpsertByIdAsync(_context.CashBoxes, data.TreasuryAccounts, tenantId, cb => cb.Id, cb =>
            {
                cb.TenantId = tenantId;
            }, ct);

            // 3. Sales, Purchases, Installments, Expenses, Treasury Vouchers
            await UpsertByIdAsync(_context.SalesInvoices, data.Sales, tenantId, s => s.Id, s =>
            {
                s.TenantId = tenantId;
                s.Customer = null;
                s.TreasuryAccount = null;
                s.Items = new List<SalesInvoiceItem>();
            }, ct);

            await UpsertByIdAsync(_context.SalesInvoiceItems, data.SaleItems, tenantId, si => si.Id, si =>
            {
                si.TenantId = tenantId;
                si.Product = null;
            }, ct);

            await UpsertByIdAsync(_context.PurchaseBills, data.Purchases, tenantId, pb => pb.Id, pb =>
            {
                pb.TenantId = tenantId;
                pb.Supplier = null;
                pb.TargetWarehouse = null;
                pb.CashAccount = null;
                pb.Items = new List<PurchaseBillItem>();
            }, ct);

            await UpsertByIdAsync(_context.PurchaseBillItems, data.PurchaseItems, tenantId, pbi => pbi.Id, pbi =>
            {
                pbi.TenantId = tenantId;
                pbi.Bill = null;
                pbi.Product = null;
            }, ct);

            await UpsertByIdAsync(_context.FifoCostBatches, data.FifoCostBatches, tenantId, fb => fb.Id, fb =>
            {
                fb.TenantId = tenantId;
                fb.Product = null;
                fb.Warehouse = null;
                fb.PurchaseBill = null;
            }, ct);

            await UpsertByIdAsync(_context.SupplierLedgers, data.SupplierLedgers, tenantId, sl => sl.Id, sl =>
            {
                sl.TenantId = tenantId;
                sl.Supplier = null;
            }, ct);

            await UpsertByIdAsync(_context.InstallmentContracts, data.Installments, tenantId, ic => ic.Id, ic =>
            {
                ic.TenantId = tenantId;
                ic.Invoice = null;
                ic.Schedules = new List<InstallmentScheduleItem>();
            }, ct);

            await UpsertByIdAsync(_context.InstallmentScheduleItems, data.InstallmentSchedules, tenantId, isc => isc.Id, isc =>
            {
                isc.TenantId = tenantId;
                isc.Contract = null;
            }, ct);

            await UpsertByIdAsync(_context.ExpenseCategories, data.ExpenseCategories, tenantId, ec => ec.Id, ec =>
            {
                ec.TenantId = tenantId;
                ec.Vouchers = new List<ExpenseVoucher>();
            }, ct);

            await UpsertByIdAsync(_context.RecurringExpenses, data.RecurringExpenses, tenantId, re => re.Id, re =>
            {
                re.TenantId = tenantId;
            }, ct);

            await UpsertByIdAsync(_context.ExpenseVouchers, data.Expenses, tenantId, ev => ev.Id, ev =>
            {
                ev.TenantId = tenantId;
                ev.ExpenseCategory = null;
                ev.CashBox = null;
                ev.RecurringExpense = null;
            }, ct);

            await UpsertByIdAsync(_context.CashExpenses, data.CashExpenses, tenantId, ce => ce.Id, ce =>
            {
                ce.TenantId = tenantId;
                ce.TreasuryAccount = null;
            }, ct);

            await UpsertByIdAsync(_context.TreasuryTransactions, data.Vouchers, tenantId, tt => tt.Id, tt =>
            {
                tt.TenantId = tenantId;
                tt.CashBox = null;
                tt.ExpenseVoucher = null;
                tt.PurchaseBill = null;
                tt.Supplier = null;
            }, ct);

            var restoredAt = DateTimeOffset.UtcNow;

            _auditLogService.QueueLog(
                action: "BACKUP_RESTORE",
                entityName: "tenants",
                entityId: tenantId.ToString(),
                oldValues: null,
                newValues: new
                {
                    ArchiveExportedAtUtc = archive.ExportedAtUtc,
                    ChecksumSha256 = archive.ChecksumSha256,
                    WarehousesRestored = data.Warehouses.Count,
                    ProductsRestored = data.Products.Count,
                    CustomersRestored = data.Customers.Count,
                    SalesRestored = data.Sales.Count,
                    VouchersRestored = data.Vouchers.Count
                },
                tenantIdOverride: tenantId,
                usernameOverride: actor);

            await _context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return ApiResponse<TenantBackupRestoreResultDto>.Ok(new TenantBackupRestoreResultDto(
                TenantId: tenantId,
                RestoredAtUtc: restoredAt,
                WarehousesRestored: data.Warehouses.Count,
                ProductsRestored: data.Products.Count,
                CustomersRestored: data.Customers.Count,
                SuppliersRestored: data.Suppliers.Count,
                SalesRestored: data.Sales.Count,
                PurchasesRestored: data.Purchases.Count,
                InstallmentsRestored: data.Installments.Count,
                TreasuryAccountsRestored: data.TreasuryAccounts.Count,
                VouchersRestored: data.Vouchers.Count,
                ExpensesRestored: data.Expenses.Count + data.CashExpenses.Count
            ));
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(ct);
            _logger.LogError(ex, "Backup restore failed for tenant {TenantId}", tenantId);
            return ApiResponse<TenantBackupRestoreResultDto>.Fail("ERR_BACKUP_RESTORE_FAILED", "BACKUP");
        }
    }

    private async Task UpsertByIdAsync<TEntity>(
        DbSet<TEntity> dbSet,
        List<TEntity>? incoming,
        Guid tenantId,
        Func<TEntity, Guid> getId,
        Action<TEntity> sanitize,
        CancellationToken ct)
        where TEntity : class, ITenantEntity
    {
        if (incoming == null || incoming.Count == 0) return;

        var existingById = await dbSet
            .IgnoreQueryFilters()
            .Where(e => e.TenantId == tenantId)
            .ToDictionaryAsync(getId, ct);

        foreach (var item in incoming)
        {
            sanitize(item);
            NormalizeDateTimesToUtc(item);
            var id = getId(item);
            if (existingById.TryGetValue(id, out var existing))
            {
                _context.Entry(existing).CurrentValues.SetValues(item);
            }
            else
            {
                dbSet.Add(item);
            }
        }
    }

    private static void NormalizeDateTimesToUtc(object entity)
    {
        var props = entity.GetType().GetProperties();
        foreach (var prop in props)
        {
            if (!prop.CanRead || !prop.CanWrite) continue;
            if (prop.PropertyType == typeof(DateTime))
            {
                var dt = (DateTime)prop.GetValue(entity)!;
                prop.SetValue(entity, EnsureUtc(dt));
            }
            else if (prop.PropertyType == typeof(DateTime?))
            {
                var dt = (DateTime?)prop.GetValue(entity);
                if (dt.HasValue)
                {
                    prop.SetValue(entity, EnsureUtc(dt.Value));
                }
            }
            else if (prop.PropertyType == typeof(DateTimeOffset))
            {
                var dto = (DateTimeOffset)prop.GetValue(entity)!;
                prop.SetValue(entity, dto.ToUniversalTime());
            }
            else if (prop.PropertyType == typeof(DateTimeOffset?))
            {
                var dto = (DateTimeOffset?)prop.GetValue(entity);
                if (dto.HasValue)
                {
                    prop.SetValue(entity, dto.Value.ToUniversalTime());
                }
            }
        }
    }

    private static DateTime EnsureUtc(DateTime dt) =>
        dt.Kind == DateTimeKind.Utc ? dt : DateTime.SpecifyKind(dt, DateTimeKind.Utc);

    private static string ComputeChecksum(TenantBackupDataDto data)
    {
        var json = JsonSerializer.Serialize(data, CanonicalChecksumOptions);
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
