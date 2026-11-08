using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/v1/wms")]
public class WmsController : ControllerBase
{
    private readonly AppDbContext _context;

    public WmsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// GET /api/v1/wms/warehouses/{warehouseId}/racks
    /// Returns racks and occupancy dynamically computed from real warehouse stock.
    /// Strictly returns empty list if no racks or inventory exist.
    /// </summary>
    [HttpGet("warehouses/{warehouseId}/racks")]
    public async Task<ActionResult<IEnumerable<object>>> GetWarehouseRacks(string warehouseId)
    {
        var tenantIdClaim = User.FindFirst("tenant_id")?.Value 
                         ?? User.FindFirst("TenantId")?.Value 
                         ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();

        Guid? tenantGuid = null;
        if (!string.IsNullOrEmpty(tenantIdClaim) && Guid.TryParse(tenantIdClaim, out var parsedGuid))
        {
            tenantGuid = parsedGuid;
        }

        // Query stocks for this warehouse
        var stockQuery = _context.WarehouseStocks
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .AsQueryable();

        if (tenantGuid.HasValue)
        {
            stockQuery = stockQuery.Where(s => s.TenantId == tenantGuid.Value);
        }

        if (Guid.TryParse(warehouseId, out var whGuid))
        {
            stockQuery = stockQuery.Where(s => s.WarehouseId == whGuid);
        }
        else
        {
            stockQuery = stockQuery.Where(s => s.Warehouse != null && s.Warehouse.Code == warehouseId);
        }

        var stocks = await stockQuery.ToListAsync();

        // If no stock with shelf locations exists, return empty array
        var stockedShelves = stocks
            .Where(s => !string.IsNullOrWhiteSpace(s.ShelfLocation))
            .GroupBy(s => s.ShelfLocation!.Trim())
            .ToList();

        if (!stockedShelves.Any())
        {
            return Ok(Array.Empty<object>());
        }

        var racks = stockedShelves.Select(g =>
        {
            var shelfCode = g.Key;
            var bayCode = shelfCode.StartsWith("BAY-", StringComparison.OrdinalIgnoreCase) 
                ? shelfCode 
                : $"BAY-{shelfCode}";

            var totalItems = g.Sum(s => s.Quantity);
            // Dynamic capacity: default rack capacity is 32 pallets
            var totalCapacity = 32;
            var usedCapacity = Math.Min(totalCapacity, totalItems);
            var occupancy = totalCapacity > 0 ? Math.Round(((decimal)usedCapacity / totalCapacity) * 100, 1) : 0m;

            return new
            {
                id = $"rack-{bayCode.ToLower()}",
                bayCode = bayCode,
                label = $"الرف قاطع {shelfCode}",
                labelEn = $"Rack Bay {shelfCode}",
                totalCapacity = totalCapacity,
                usedCapacity = usedCapacity,
                occupancy = occupancy,
                items = g.Select(s => new
                {
                    id = s.Product?.Id.ToString() ?? s.ProductId.ToString(),
                    sku = s.Product?.Sku ?? string.Empty,
                    nameAr = s.Product?.Name ?? string.Empty,
                    nameEn = s.Product?.Name ?? string.Empty,
                    barcode = s.Product?.Barcode ?? string.Empty,
                    currentStock = s.Quantity,
                    shelf = s.ShelfLocation
                }).ToList()
            };
        }).OrderBy(r => r.bayCode).ToList();

        return Ok(racks);
    }
}
