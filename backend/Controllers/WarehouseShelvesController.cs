using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

public class UpsertWarehouseShelfRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Notes { get; set; }
    public int? MaxCapacity { get; set; }
}

public class AssignShelfItemsRequest
{
    public List<Guid> ProductIds { get; set; } = new();
}

public record ApiErrorResponse(bool Success, string ErrorCode, object? Details = null);

[ApiController]
[Route("api/warehouses/{warehouseIdOrCode}/shelves")]
[Route("api/v1/warehouses/{warehouseIdOrCode}/shelves")]
public class WarehouseShelvesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<WarehouseShelvesController> _logger;
    private static volatile bool _schemaEnsured = false;

    public WarehouseShelvesController(AppDbContext context, ILogger<WarehouseShelvesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private async Task EnsureShelvesSchemaAsync()
    {
        if (_schemaEnsured) return;
        try
        {
            // Step 1: Create table (no FK to avoid ordering issues)
            await _context.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS warehouse_shelves (
                    id UUID PRIMARY KEY,
                    tenant_id UUID NULL,
                    warehouse_id UUID NOT NULL,
                    name VARCHAR(150) NOT NULL,
                    code VARCHAR(50) NULL,
                    notes TEXT NULL,
                    max_capacity INT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NULL
                );");
            // Mark as ensured immediately after table creation succeeds
            _schemaEnsured = true;
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    ALTER TABLE IF EXISTS warehouse_shelves
                        ADD COLUMN IF NOT EXISTS tenant_id UUID NULL,
                        ADD COLUMN IF NOT EXISTS warehouse_id UUID NULL,
                        ADD COLUMN IF NOT EXISTS name VARCHAR(150) NULL,
                        ADD COLUMN IF NOT EXISTS code VARCHAR(50) NULL,
                        ADD COLUMN IF NOT EXISTS notes TEXT NULL,
                        ADD COLUMN IF NOT EXISTS max_capacity INT NULL,
                        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL,
                        ADD COLUMN IF NOT EXISTS created_by VARCHAR(150) NULL;");
            }
            catch { }
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    DO $$
                    DECLARE
                        col_name TEXT;
                    BEGIN
                        FOREACH col_name IN ARRAY ARRAY['code', 'notes', 'max_capacity', 'zone', 'aisle', 'rack', 'level', 'bin_code', 'shelf_type', 'status', 'updated_at', 'created_by']
                        LOOP
                            IF EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_name = 'warehouse_shelves'
                                  AND column_name = col_name
                                  AND is_nullable = 'NO'
                            ) THEN
                                EXECUTE format('ALTER TABLE warehouse_shelves ALTER COLUMN %I DROP NOT NULL', col_name);
                            END IF;
                        END LOOP;
                    END $$;");
            }
            catch { }
            try
            {
                await _context.Database.ExecuteSqlRawAsync(
                    "CREATE INDEX IF NOT EXISTS ix_warehouse_shelves_tenant_wh ON warehouse_shelves (tenant_id, warehouse_id);");
                await _context.Database.ExecuteSqlRawAsync("DROP INDEX IF EXISTS ux_warehouse_shelves_tenant_wh_code;");
                await _context.Database.ExecuteSqlRawAsync(@"
                    CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_shelves_tenant_wh_code_partial
                        ON warehouse_shelves (tenant_id, warehouse_id, LOWER(code))
                        WHERE code IS NOT NULL AND code <> '' AND is_active = TRUE;");
            }
            catch { }
            try
            {
                await _context.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE IF EXISTS warehouse_stock ADD COLUMN IF NOT EXISTS shelf_id UUID NULL;");
            }
            catch { }
            _schemaEnsured = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EnsureShelvesSchemaAsync failed");
        }
    }

    private async Task<Guid?> ResolveTenantIdAsync()
    {
        if (_context.CurrentTenantId.HasValue && _context.CurrentTenantId.Value != Guid.Empty)
        {
            return _context.CurrentTenantId.Value;
        }

        var tenantIdClaim = User.FindFirst("tenant_id")?.Value
                         ?? User.FindFirst("TenantId")?.Value
                         ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();

        if (!string.IsNullOrWhiteSpace(tenantIdClaim))
        {
            if (Guid.TryParse(tenantIdClaim, out var parsed))
            {
                return parsed;
            }
            var matched = await _context.Tenants
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Slug == tenantIdClaim.Trim().ToLower());
            if (matched != null)
            {
                return matched.Id;
            }
        }

        return null;
    }

    private async Task<ERP.Warehouse.Api.Models.Warehouse?> ResolveWarehouseAsync(string warehouseId, Guid? tenantId)
    {
        var query = _context.Warehouses.AsNoTracking().AsQueryable();
        if (tenantId.HasValue)
        {
            query = query.Where(w => w.TenantId == tenantId.Value);
        }

        if (Guid.TryParse(warehouseId, out var whGuid))
        {
            return await query.FirstOrDefaultAsync(w => w.Id == whGuid);
        }

        return await query.FirstOrDefaultAsync(w => w.Code == warehouseId);
    }

    [HttpGet]
    public async Task<ActionResult> GetShelves(string warehouseIdOrCode)
    {
        await EnsureShelvesSchemaAsync();
        var tenantId = await ResolveTenantIdAsync();
        var warehouse = await ResolveWarehouseAsync(warehouseIdOrCode, tenantId);

        if (warehouse == null)
        {
            return NotFound(new { errorCode = "ERR_WAREHOUSE_NOT_FOUND" });
        }

        var shelves = await _context.WarehouseShelves
            .AsNoTracking()
            .Where(s => s.WarehouseId == warehouse.Id && s.IsActive && (!tenantId.HasValue || s.TenantId == tenantId.Value))
            .OrderBy(s => s.Name)
            .ThenBy(s => s.Id)
            .ToListAsync();

        var stocks = await _context.WarehouseStocks
            .AsNoTracking()
            .Include(ws => ws.Product)
            .Where(ws => ws.WarehouseId == warehouse.Id && (!tenantId.HasValue || ws.TenantId == tenantId.Value))
            .ToListAsync();

        var result = shelves.Select(shelf =>
        {
            var matchedStocks = stocks.Where(ws =>
                ws.ShelfId == shelf.Id ||
                (!ws.ShelfId.HasValue && !string.IsNullOrWhiteSpace(ws.ShelfLocation) &&
                 ((!string.IsNullOrWhiteSpace(shelf.Code) && string.Equals(ws.ShelfLocation.Trim(), shelf.Code.Trim(), StringComparison.OrdinalIgnoreCase)) ||
                  string.Equals(ws.ShelfLocation.Trim(), shelf.Name.Trim(), StringComparison.OrdinalIgnoreCase))))
                .ToList();

            var items = matchedStocks
                .Where(ws => ws.Product != null)
                .Select(ws => new
                {
                    productId = ws.ProductId,
                    sku = ws.Product!.Sku,
                    name = ws.Product!.Name,
                    barcode = ws.Product!.Barcode ?? string.Empty,
                    quantity = ws.Quantity,
                    sellingPrice = ws.Product!.SellingPrice,
                    shelfId = shelf.Id
                })
                .OrderBy(i => i.name)
                .ToList();

            return new
            {
                id = shelf.Id,
                warehouseId = shelf.WarehouseId,
                name = shelf.Name,
                code = shelf.Code,
                notes = shelf.Notes,
                maxCapacity = shelf.MaxCapacity,
                isActive = shelf.IsActive,
                itemCount = items.Count,
                totalQuantity = items.Sum(i => Math.Max(0, i.quantity)),
                topItems = items.Take(3).Select(i => i.name).ToList(),
                items
            };
        }).ToList();

        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult> CreateShelf(string warehouseIdOrCode, [FromBody] UpsertWarehouseShelfRequest? request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new ApiErrorResponse(false, "ERR_SHELF_NAME_REQUIRED"));
        }

        try
        {
            await EnsureShelvesSchemaAsync();
            var tenantId = await ResolveTenantIdAsync();
            var warehouse = await ResolveWarehouseAsync(warehouseIdOrCode, tenantId);

            if (warehouse == null)
            {
                return NotFound(new ApiErrorResponse(false, "ERR_WAREHOUSE_NOT_FOUND"));
            }

            var normalizedCode = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim();
            var normalizedNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

            if (normalizedCode != null)
            {
                var codeLower = normalizedCode.ToLowerInvariant();
                var duplicateExists = await _context.WarehouseShelves
                    .AsNoTracking()
                    .AnyAsync(s =>
                        s.WarehouseId == warehouse.Id &&
                        s.IsActive &&
                        (!tenantId.HasValue || s.TenantId == tenantId.Value) &&
                        s.Code != null &&
                        s.Code.ToLower() == codeLower);

                if (duplicateExists)
                {
                    return Conflict(new ApiErrorResponse(false, "ERR_SHELF_CODE_ALREADY_EXISTS"));
                }
            }

            var nowUtc = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
            var shelf = new WarehouseShelf
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId ?? warehouse.TenantId,
                WarehouseId = warehouse.Id,
                Name = request.Name.Trim(),
                Code = normalizedCode,
                Notes = normalizedNotes,
                MaxCapacity = request.MaxCapacity,
                IsActive = true,
                CreatedAt = nowUtc,
                UpdatedAt = nowUtc
            };

            _context.WarehouseShelves.Add(shelf);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                id = shelf.Id,
                warehouseId = shelf.WarehouseId,
                name = shelf.Name,
                code = shelf.Code,
                notes = shelf.Notes,
                maxCapacity = shelf.MaxCapacity,
                isActive = shelf.IsActive,
                itemCount = 0,
                totalQuantity = 0,
                topItems = Array.Empty<string>(),
                items = Array.Empty<object>()
            });
        }
        catch (DbUpdateException dbEx)
        {
            var baseEx = dbEx.GetBaseException();
            var pgEx = baseEx as PostgresException ?? dbEx.InnerException as PostgresException;
            _logger.LogError(dbEx,
                "CreateShelf DbUpdateException for warehouse {WarehouseIdOrCode} (SqlState={SqlState}, Column={ColumnName}, Constraint={ConstraintName})",
                warehouseIdOrCode, pgEx?.SqlState, pgEx?.ColumnName, pgEx?.ConstraintName);

            if (pgEx?.SqlState == "23505")
            {
                return Conflict(new ApiErrorResponse(false, "ERR_SHELF_CODE_ALREADY_EXISTS", new
                {
                    ExceptionType = baseEx.GetType().Name,
                    SqlState = pgEx.SqlState,
                    ColumnName = pgEx.ColumnName,
                    ConstraintName = pgEx.ConstraintName
                }));
            }

            return StatusCode(500, new ApiErrorResponse(false, "ERR_SHELF_SAVE_FAILED", new
            {
                ExceptionType = baseEx.GetType().Name,
                SqlState = pgEx?.SqlState,
                ColumnName = pgEx?.ColumnName,
                ConstraintName = pgEx?.ConstraintName
            }));
        }
        catch (Exception ex)
        {
            var baseEx = ex.GetBaseException();
            var pgEx = baseEx as PostgresException ?? ex.InnerException as PostgresException;
            _logger.LogError(ex, "CreateShelf failed for warehouse {WarehouseIdOrCode}", warehouseIdOrCode);
            return StatusCode(500, new ApiErrorResponse(false, "ERR_SHELF_SAVE_FAILED", new
            {
                ExceptionType = baseEx.GetType().Name,
                SqlState = pgEx?.SqlState,
                ColumnName = pgEx?.ColumnName,
                ConstraintName = pgEx?.ConstraintName
            }));
        }
    }

    [HttpPut("{shelfId:guid}")]
    public async Task<ActionResult> UpdateShelf(string warehouseIdOrCode, Guid shelfId, [FromBody] UpsertWarehouseShelfRequest? request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new ApiErrorResponse(false, "ERR_SHELF_NAME_REQUIRED"));
        }

        try
        {
            await EnsureShelvesSchemaAsync();
            var tenantId = await ResolveTenantIdAsync();
            var warehouse = await ResolveWarehouseAsync(warehouseIdOrCode, tenantId);
            if (warehouse == null)
            {
                return NotFound(new ApiErrorResponse(false, "ERR_WAREHOUSE_NOT_FOUND"));
            }

            var shelf = await _context.WarehouseShelves
                .FirstOrDefaultAsync(s =>
                    s.Id == shelfId &&
                    s.WarehouseId == warehouse.Id &&
                    s.IsActive &&
                    (!tenantId.HasValue || s.TenantId == tenantId.Value));

            if (shelf == null)
            {
                return NotFound(new ApiErrorResponse(false, "ERR_SHELF_NOT_FOUND"));
            }

            var normalizedCode = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim();
            var normalizedNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

            if (normalizedCode != null)
            {
                var codeLower = normalizedCode.ToLowerInvariant();
                var duplicateExists = await _context.WarehouseShelves
                    .AsNoTracking()
                    .AnyAsync(s =>
                        s.Id != shelf.Id &&
                        s.WarehouseId == warehouse.Id &&
                        s.IsActive &&
                        (!tenantId.HasValue || s.TenantId == tenantId.Value) &&
                        s.Code != null &&
                        s.Code.ToLower() == codeLower);

                if (duplicateExists)
                {
                    return Conflict(new ApiErrorResponse(false, "ERR_SHELF_CODE_ALREADY_EXISTS"));
                }
            }

            shelf.Name = request.Name.Trim();
            shelf.Code = normalizedCode;
            shelf.Notes = normalizedNotes;
            shelf.MaxCapacity = request.MaxCapacity;
            shelf.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                id = shelf.Id,
                warehouseId = shelf.WarehouseId,
                name = shelf.Name,
                code = shelf.Code,
                notes = shelf.Notes,
                maxCapacity = shelf.MaxCapacity,
                isActive = shelf.IsActive
            });
        }
        catch (DbUpdateException dbEx)
        {
            var baseEx = dbEx.GetBaseException();
            var pgEx = baseEx as PostgresException ?? dbEx.InnerException as PostgresException;
            _logger.LogError(dbEx,
                "UpdateShelf DbUpdateException for warehouse {WarehouseIdOrCode} (SqlState={SqlState}, Column={ColumnName}, Constraint={ConstraintName})",
                warehouseIdOrCode, pgEx?.SqlState, pgEx?.ColumnName, pgEx?.ConstraintName);

            if (pgEx?.SqlState == "23505")
            {
                return Conflict(new ApiErrorResponse(false, "ERR_SHELF_CODE_ALREADY_EXISTS", new
                {
                    ExceptionType = baseEx.GetType().Name,
                    SqlState = pgEx.SqlState,
                    ColumnName = pgEx.ColumnName,
                    ConstraintName = pgEx.ConstraintName
                }));
            }

            return StatusCode(500, new ApiErrorResponse(false, "ERR_SHELF_SAVE_FAILED", new
            {
                ExceptionType = baseEx.GetType().Name,
                SqlState = pgEx?.SqlState,
                ColumnName = pgEx?.ColumnName,
                ConstraintName = pgEx?.ConstraintName
            }));
        }
        catch (Exception ex)
        {
            var baseEx = ex.GetBaseException();
            var pgEx = baseEx as PostgresException ?? ex.InnerException as PostgresException;
            _logger.LogError(ex, "UpdateShelf failed for warehouse {WarehouseIdOrCode}", warehouseIdOrCode);
            return StatusCode(500, new ApiErrorResponse(false, "ERR_SHELF_SAVE_FAILED", new
            {
                ExceptionType = baseEx.GetType().Name,
                SqlState = pgEx?.SqlState,
                ColumnName = pgEx?.ColumnName,
                ConstraintName = pgEx?.ConstraintName
            }));
        }
    }

    [HttpPost("{shelfId:guid}/assign-items")]
    public async Task<ActionResult> AssignItemsToShelf(string warehouseIdOrCode, Guid shelfId, [FromBody] AssignShelfItemsRequest? request)
    {
        var distinctProductIds = (request?.ProductIds ?? new List<Guid>())
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        if (distinctProductIds.Count == 0)
        {
            return BadRequest(new { success = false, errorCode = "ERR_INVALID_PAYLOAD" });
        }

        await EnsureShelvesSchemaAsync();
        var tenantId = await ResolveTenantIdAsync();
        var warehouse = await ResolveWarehouseAsync(warehouseIdOrCode, tenantId);
        if (warehouse == null)
        {
            return NotFound(new { success = false, errorCode = "ERR_WAREHOUSE_NOT_FOUND" });
        }

        var shelf = await _context.WarehouseShelves
            .FirstOrDefaultAsync(s =>
                s.Id == shelfId &&
                s.WarehouseId == warehouse.Id &&
                s.IsActive &&
                (!tenantId.HasValue || s.TenantId == tenantId.Value));

        if (shelf == null)
        {
            return NotFound(new { errorCode = "ERR_SHELF_NOT_FOUND" });
        }

        var shelfLabel = string.IsNullOrWhiteSpace(shelf.Code) ? shelf.Name : shelf.Code;

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var existingStocks = await _context.WarehouseStocks
                .Where(ws =>
                    ws.WarehouseId == warehouse.Id &&
                    distinctProductIds.Contains(ws.ProductId) &&
                    (!tenantId.HasValue || ws.TenantId == tenantId.Value))
                .ToListAsync();

            var existingProductIds = existingStocks.Select(ws => ws.ProductId).ToHashSet();
            foreach (var stock in existingStocks)
            {
                stock.ShelfId = shelf.Id;
                stock.ShelfLocation = shelfLabel;
                stock.LastCountedAt = DateTime.UtcNow;
            }

            var missingIds = distinctProductIds.Where(id => !existingProductIds.Contains(id)).ToList();
            if (missingIds.Count > 0)
            {
                var validProducts = await _context.Products
                    .AsNoTracking()
                    .Where(p => missingIds.Contains(p.Id) && (!tenantId.HasValue || p.TenantId == tenantId.Value))
                    .Select(p => p.Id)
                    .ToListAsync();

                foreach (var productId in validProducts)
                {
                    _context.WarehouseStocks.Add(new WarehouseStock
                    {
                        TenantId = tenantId ?? shelf.TenantId,
                        WarehouseId = warehouse.Id,
                        ProductId = productId,
                        Quantity = 0,
                        ReservedQuantity = 0,
                        ShelfId = shelf.Id,
                        ShelfLocation = shelfLabel,
                        LastCountedAt = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(new
            {
                success = true,
                shelfId = shelf.Id,
                shelfName = shelf.Name,
                assignedCount = distinctProductIds.Count
            });
        }
        catch (Exception)
        {
            await tx.RollbackAsync();
            return StatusCode(500, new { errorCode = "ERR_SHELF_ASSIGN_FAILED" });
        }
    }
}
