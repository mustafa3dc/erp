using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Domain.Constants;
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
[Route("api/warehouses/{warehouseId:guid}/shelves")]
[Route("api/v1/warehouses/{warehouseId:guid}/shelves")]
public class WarehouseShelvesController : ControllerBase
{
    private readonly AppDbContext _context;

    public WarehouseShelvesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [HasPermission(Permissions.Inventory.ItemsView)]
    public async Task<ActionResult> GetShelves(Guid warehouseId)
    {
        var tenantId = _context.CurrentTenantId;
        var warehouse = await _context.Warehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == warehouseId && (!tenantId.HasValue || w.TenantId == tenantId.Value));

        if (warehouse == null)
        {
            return NotFound(new { errorCode = "ERR_WAREHOUSE_NOT_FOUND" });
        }

        var shelves = await _context.WarehouseShelves
            .AsNoTracking()
            .Where(s => s.WarehouseId == warehouseId && s.IsActive && (!tenantId.HasValue || s.TenantId == tenantId.Value))
            .OrderBy(s => s.Name)
            .ThenBy(s => s.Id)
            .ToListAsync();

        var stocks = await _context.WarehouseStocks
            .AsNoTracking()
            .Include(ws => ws.Product)
            .Where(ws => ws.WarehouseId == warehouseId && (!tenantId.HasValue || ws.TenantId == tenantId.Value))
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
    [HasPermission(Permissions.Inventory.WarehousesManage)]
    public async Task<ActionResult> CreateShelf(Guid warehouseId, [FromBody] UpsertWarehouseShelfRequest? request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { errorCode = "ERR_SHELF_NAME_REQUIRED" });
        }

        var tenantId = _context.CurrentTenantId;
        var warehouse = await _context.Warehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == warehouseId && (!tenantId.HasValue || w.TenantId == tenantId.Value));

        if (warehouse == null)
        {
            return NotFound(new { errorCode = "ERR_WAREHOUSE_NOT_FOUND" });
        }

        var shelf = new WarehouseShelf
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId ?? warehouse.TenantId,
            WarehouseId = warehouseId,
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

    [HttpPut("{shelfId:guid}")]
    [HasPermission(Permissions.Inventory.WarehousesManage)]
    public async Task<ActionResult> UpdateShelf(Guid warehouseId, Guid shelfId, [FromBody] UpsertWarehouseShelfRequest? request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { errorCode = "ERR_SHELF_NAME_REQUIRED" });
        }

        var tenantId = _context.CurrentTenantId;
        var shelf = await _context.WarehouseShelves
            .FirstOrDefaultAsync(s =>
                s.Id == shelfId &&
                s.WarehouseId == warehouseId &&
                s.IsActive &&
                (!tenantId.HasValue || s.TenantId == tenantId.Value));

        if (shelf == null)
        {
            return NotFound(new { errorCode = "ERR_SHELF_NOT_FOUND" });
        }

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

    [HttpPost("{shelfId:guid}/assign-items")]
    [HasPermission(Permissions.Inventory.WarehousesManage)]
    public async Task<ActionResult> AssignItemsToShelf(Guid warehouseId, Guid shelfId, [FromBody] AssignShelfItemsRequest? request)
    {
        var distinctProductIds = (request?.ProductIds ?? new List<Guid>())
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        if (distinctProductIds.Count == 0)
        {
            return BadRequest(new { errorCode = "ERR_INVALID_PAYLOAD" });
        }

        var tenantId = _context.CurrentTenantId;
        var shelf = await _context.WarehouseShelves
            .FirstOrDefaultAsync(s =>
                s.Id == shelfId &&
                s.WarehouseId == warehouseId &&
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
                    ws.WarehouseId == warehouseId &&
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
                        WarehouseId = warehouseId,
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
