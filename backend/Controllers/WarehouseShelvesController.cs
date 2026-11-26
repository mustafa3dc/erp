using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

[ApiController]
[Route("api/warehouses/{warehouseId}/shelves")]
[Route("api/v1/warehouses/{warehouseId}/shelves")]
public class WarehouseShelvesController : ControllerBase
{
    private readonly AppDbContext _context;
    private static volatile bool _schemaEnsured = false;

    public WarehouseShelvesController(AppDbContext context)
    {
        _context = context;
    }

    private async Task EnsureShelvesSchemaAsync()
    {
        if (_schemaEnsured) return;
        try
        {
            await _context.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS warehouse_shelves (
                    id UUID PRIMARY KEY,
                    tenant_id UUID NULL,
                    warehouse_id UUID NOT NULL,
                    name VARCHAR(150) NOT NULL,
                    code VARCHAR(50) NULL,
                    notes VARCHAR(500) NULL,
                    max_capacity INT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NULL
                );");
            try
            {
                await _context.Database.ExecuteSqlRawAsync(
                    "CREATE INDEX IF NOT EXISTS ix_warehouse_shelves_tenant_wh ON warehouse_shelves (tenant_id, warehouse_id);");
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
        catch
        {
            // Will retry on next call if transient
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
    public async Task<ActionResult> GetShelves(string warehouseId)
    {
        await EnsureShelvesSchemaAsync();
        var tenantId = await ResolveTenantIdAsync();
        var warehouse = await ResolveWarehouseAsync(warehouseId, tenantId);

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
    public async Task<ActionResult> CreateShelf(string warehouseId, [FromBody] UpsertWarehouseShelfRequest? request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { errorCode = "ERR_SHELF_NAME_REQUIRED" });
        }

        await EnsureShelvesSchemaAsync();
        var tenantId = await ResolveTenantIdAsync();
        var warehouse = await ResolveWarehouseAsync(warehouseId, tenantId);

        if (warehouse == null)
        {
            return NotFound(new { errorCode = "ERR_WAREHOUSE_NOT_FOUND" });
        }

        try
        {
            var shelf = new WarehouseShelf
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId ?? warehouse.TenantId,
                WarehouseId = warehouse.Id,
                Name = request.Name.Trim(),
                Code = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim(),
                Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
                MaxCapacity = request.MaxCapacity,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
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
        catch (Exception)
        {
            return StatusCode(500, new { errorCode = "ERR_SHELF_SAVE_FAILED" });
        }
    }

    [HttpPut("{shelfId:guid}")]
    public async Task<ActionResult> UpdateShelf(string warehouseId, Guid shelfId, [FromBody] UpsertWarehouseShelfRequest? request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { errorCode = "ERR_SHELF_NAME_REQUIRED" });
        }

        await EnsureShelvesSchemaAsync();
        var tenantId = await ResolveTenantIdAsync();
        var warehouse = await ResolveWarehouseAsync(warehouseId, tenantId);
        if (warehouse == null)
        {
            return NotFound(new { errorCode = "ERR_WAREHOUSE_NOT_FOUND" });
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

        try
        {
            shelf.Name = request.Name.Trim();
            shelf.Code = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim();
            shelf.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
            shelf.MaxCapacity = request.MaxCapacity;
            shelf.UpdatedAt = DateTime.UtcNow;

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
        catch (Exception)
        {
            return StatusCode(500, new { errorCode = "ERR_SHELF_SAVE_FAILED" });
        }
    }

    [HttpPost("{shelfId:guid}/assign-items")]
    public async Task<ActionResult> AssignItemsToShelf(string warehouseId, Guid shelfId, [FromBody] AssignShelfItemsRequest? request)
    {
        var distinctProductIds = (request?.ProductIds ?? new List<Guid>())
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        if (distinctProductIds.Count == 0)
        {
            return BadRequest(new { errorCode = "ERR_INVALID_PAYLOAD" });
        }

        await EnsureShelvesSchemaAsync();
        var tenantId = await ResolveTenantIdAsync();
        var warehouse = await ResolveWarehouseAsync(warehouseId, tenantId);
        if (warehouse == null)
        {
            return NotFound(new { errorCode = "ERR_WAREHOUSE_NOT_FOUND" });
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
