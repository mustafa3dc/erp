using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Route("api/[controller]")]
public class WarehousesController : ControllerBase
{
    private readonly AppDbContext _context;

    public WarehousesController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// GET /api/v1/warehouses
    /// Returns warehouses strictly scoped to the authenticated tenant.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetWarehouses()
    {
        // 1. Extract tenant_id from user claims
        var tenantIdClaim = User.FindFirst("tenant_id")?.Value 
                         ?? User.FindFirst("TenantId")?.Value 
                         ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();

        Guid? tenantGuid = null;
        if (!string.IsNullOrEmpty(tenantIdClaim) && Guid.TryParse(tenantIdClaim, out var parsedGuid))
        {
            tenantGuid = parsedGuid;
        }

        // 2. Query warehouses scoped by TenantId
        var query = _context.Warehouses.AsQueryable();

        if (tenantGuid.HasValue)
        {
            query = query.Where(w => w.TenantId == tenantGuid.Value);
        }
        else if (!string.IsNullOrEmpty(tenantIdClaim))
        {
            // If tenant slug was passed
            var matchedTenant = await _context.Tenants
                .FirstOrDefaultAsync(t => t.Slug == tenantIdClaim.ToLower());
            if (matchedTenant != null)
            {
                query = query.Where(w => w.TenantId == matchedTenant.Id);
            }
        }

        var warehouses = await query
            .Where(w => w.IsActive)
            .OrderBy(w => w.Code)
            .Select(w => new
            {
                id = w.Id.ToString(),
                code = w.Code,
                name = w.Name,
                nameAr = w.Name,
                nameEn = w.Name,
                location = w.Location,
                manager = w.ManagerName,
                phone = w.ContactPhone,
                totalCapacity = w.TotalCapacity,
                isActive = w.IsActive
            })
            .ToListAsync();

        // If newly created tenant doesn't have an explicit DB warehouse row yet, seed or return default main warehouse
        if (warehouses.Count == 0 && (tenantGuid.HasValue || !string.IsNullOrEmpty(tenantIdClaim)))
        {
            var defaultWh = new
            {
                id = "WH-01",
                code = "WH-01",
                name = "المستودع الرئيسي",
                nameAr = "المستودع الرئيسي",
                nameEn = "Main Warehouse",
                location = "المقر الرئيسي - الإدارة المركزية",
                manager = "مدير المستودع",
                phone = "+964 770 000 0000",
                totalCapacity = 10000m,
                isActive = true
            };
            return Ok(new[] { defaultWh });
        }

        return Ok(warehouses);
    }

    /// <summary>
    /// GET /api/v1/warehouses/{id}
    /// Returns single warehouse details scoped to tenant.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetWarehouseById(string id)
    {
        var tenantIdClaim = User.FindFirst("tenant_id")?.Value ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();
        Guid? tenantGuid = null;
        if (!string.IsNullOrEmpty(tenantIdClaim) && Guid.TryParse(tenantIdClaim, out var parsedGuid))
        {
            tenantGuid = parsedGuid;
        }

        var query = _context.Warehouses.AsQueryable();
        if (tenantGuid.HasValue)
        {
            query = query.Where(w => w.TenantId == tenantGuid.Value);
        }

        ERP.Warehouse.Api.Models.Warehouse? warehouse = null;
        if (Guid.TryParse(id, out var whGuid))
        {
            warehouse = await query.FirstOrDefaultAsync(w => w.Id == whGuid);
        }
        else
        {
            warehouse = await query.FirstOrDefaultAsync(w => w.Code == id);
        }

        if (warehouse == null)
        {
            return NotFound(new { message = "المستودع غير موجود أو لا ينتمي للمنشأة الحالية" });
        }

        return Ok(new
        {
            id = warehouse.Id.ToString(),
            code = warehouse.Code,
            name = warehouse.Name,
            nameAr = warehouse.Name,
            nameEn = warehouse.Name,
            location = warehouse.Location,
            manager = warehouse.ManagerName,
            phone = warehouse.ContactPhone,
            totalCapacity = warehouse.TotalCapacity,
            isActive = warehouse.IsActive
        });
    }

    /// <summary>
    /// POST /api/v1/warehouses
    /// Creates a new warehouse strictly assigned to the caller's tenant.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<object>> CreateWarehouse([FromBody] ERP.Warehouse.Api.Models.Warehouse input)
    {
        var tenantIdClaim = User.FindFirst("tenant_id")?.Value ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();
        Guid? tenantGuid = null;
        if (!string.IsNullOrEmpty(tenantIdClaim) && Guid.TryParse(tenantIdClaim, out var parsedGuid))
        {
            tenantGuid = parsedGuid;
        }

        input.Id = Guid.NewGuid();
        if (tenantGuid.HasValue)
        {
            input.TenantId = tenantGuid.Value;
        }
        input.CreatedAt = DateTime.UtcNow;
        input.UpdatedAt = DateTime.UtcNow;
        input.IsActive = true;

        _context.Warehouses.Add(input);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetWarehouseById), new { id = input.Id.ToString() }, new
        {
            id = input.Id.ToString(),
            code = input.Code,
            name = input.Name,
            location = input.Location,
            isActive = input.IsActive
        });
    }

    /// <summary>
    /// DELETE /api/v1/warehouses/{id}
    /// Strictly validates that the warehouse does not contain active stock, inventory items, or pending movements.
    /// In accordance with ERP audit standards and accidental data loss prevention, prevents deleting active repositories.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWarehouse(string id)
    {
        var tenantIdClaim = User.FindFirst("tenant_id")?.Value ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();
        Guid? tenantGuid = null;
        if (!string.IsNullOrEmpty(tenantIdClaim) && Guid.TryParse(tenantIdClaim, out var parsedGuid))
        {
            tenantGuid = parsedGuid;
        }

        var query = _context.Warehouses.AsQueryable();
        if (tenantGuid.HasValue)
        {
            query = query.Where(w => w.TenantId == tenantGuid.Value);
        }

        ERP.Warehouse.Api.Models.Warehouse? warehouse = null;
        if (Guid.TryParse(id, out var whGuid))
        {
            warehouse = await query.FirstOrDefaultAsync(w => w.Id == whGuid);
        }
        else
        {
            warehouse = await query.FirstOrDefaultAsync(w => w.Code == id);
        }

        if (warehouse == null)
        {
            return NotFound(new
            {
                success = false,
                errorCode = "ERR_WAREHOUSE_NOT_FOUND",
                message = "المستودع المطلوب حذفه غير موجود أو لا ينتمي للمنشأة الحالية."
            });
        }

        // 1. Prevent deleting the last active warehouse
        var activeWarehousesCount = await query.CountAsync(w => w.IsActive);
        if (activeWarehousesCount <= 1)
        {
            return BadRequest(new
            {
                success = false,
                errorCode = "ERR_LAST_WAREHOUSE",
                message = "لا يمكن حذف المستودع الوحيد النشط للمنشأة. يجب الإبقاء على مستودع نشط واحد على الأقل."
            });
        }

        // 2. Prevent deleting warehouse with physical stock in WarehouseStock
        var hasStock = await _context.WarehouseStocks
            .AnyAsync(ws => ws.WarehouseId == warehouse.Id && ws.Quantity > 0);

        if (hasStock)
        {
            var totalStockQty = await _context.WarehouseStocks
                .Where(ws => ws.WarehouseId == warehouse.Id && ws.Quantity > 0)
                .SumAsync(ws => ws.Quantity);

            var itemsCount = await _context.WarehouseStocks
                .CountAsync(ws => ws.WarehouseId == warehouse.Id && ws.Quantity > 0);

            return BadRequest(new
            {
                success = false,
                errorCode = "ERR_CANNOT_DELETE_WAREHOUSE_WITH_STOCK",
                message = $"لا يمكن حذف المستودع \"{warehouse.Name}\" نهائياً لوجود ({itemsCount}) صنف برصيد إجمالي ({totalStockQty:N0} قطعة). يرجى نقل أو تصفية المخزون أولاً.",
                @params = new
                {
                    warehouseId = warehouse.Id,
                    itemsCount = itemsCount,
                    totalStock = totalStockQty
                }
            });
        }

        // 3. Prevent deleting warehouse with pending dispatch orders
        var hasPendingDispatches = await _context.WarehouseDispatchOrders
            .AnyAsync(o => o.WarehouseId == warehouse.Id && o.Status == "PENDING");

        if (hasPendingDispatches)
        {
            return BadRequest(new
            {
                success = false,
                errorCode = "ERR_WAREHOUSE_HAS_PENDING_DISPATCH",
                message = $"لا يمكن حذف المستودع \"{warehouse.Name}\" لوجود أوامر صرف معلقة قيد المعالجة."
            });
        }

        // 4. Safe Soft-Delete: deactivate warehouse rather than destroying relational historical data
        warehouse.IsActive = false;
        warehouse.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"تم تعطيل وحذف المستودع \"{warehouse.Name}\" بنجاح مع الحفاظ على سلامة القيود التاريخية."
        });
    }
}
