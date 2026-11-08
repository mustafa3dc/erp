using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

public class StockAdjustmentRequest
{
    public Guid ProductId { get; set; }
    public Guid WarehouseId { get; set; }
    public string AdjustmentType { get; set; } = "SURPLUS"; // SURPLUS, DEFICIT, DAMAGED
    public int Quantity { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly AppDbContext _context;

    public InventoryController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// POST /api/inventory/adjustments
    /// Executes a controlled stock adjustment (Surplus, Deficit, Damaged)
    /// Creates an immutable audit transaction and safely updates warehouse stock.
    /// </summary>
    [HttpPost("adjustments")]
    [HasPermission(Permissions.Inventory.ItemsEdit)]
    public async Task<ActionResult> CreateStockAdjustment([FromBody] StockAdjustmentRequest request)
    {
        if (request == null)
        {
            return BadRequest(new { success = false, errorCode = "ERR_INVALID_PAYLOAD", message = "بيانات الطلب غير صالحة" });
        }

        if (request.Quantity <= 0)
        {
            return BadRequest(new { success = false, errorCode = "ERR_INVALID_QUANTITY", message = "يجب أن تكون كمية التسوية رقماً موجباً أكبر من صفر" });
        }

        var normalizedType = (request.AdjustmentType ?? "SURPLUS").Trim().ToUpperInvariant();
        if (normalizedType != "SURPLUS" && normalizedType != "DEFICIT" && normalizedType != "DAMAGED")
        {
            return BadRequest(new { success = false, errorCode = "ERR_INVALID_TYPE", message = "نوع التسوية غير صالح. الخيارات المتاحة: SURPLUS أو DEFICIT أو DAMAGED" });
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { success = false, errorCode = "ERR_REASON_REQUIRED", message = "سبب التسوية المخزنية إجباري ومطلوب لأغراض التدقيق المحاسبي" });
        }

        // Verify Product & Warehouse exist
        var product = await _context.Products.FindAsync(request.ProductId);
        if (product == null)
        {
            return NotFound(new { success = false, errorCode = "ERR_PRODUCT_NOT_FOUND", message = "الصنف المحدد غير موجود في قاعدة البيانات" });
        }

        var warehouse = await _context.Warehouses
            .FirstOrDefaultAsync(w => w.Id == request.WarehouseId && w.IsActive);
        if (warehouse == null)
        {
            return BadRequest(new 
            { 
                success = false, 
                errorCode = "INVALID_WAREHOUSE", 
                message = "المستودع المحدد غير موجود أو تم تعطيله. يرجى اختيار مستودع نشط." 
            });
        }

        // Resolve Tenant and User
        var tenantIdClaim = User.FindFirst("tenant_id")?.Value 
                         ?? User.FindFirst("TenantId")?.Value 
                         ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();
        Guid? tenantGuid = null;
        if (!string.IsNullOrEmpty(tenantIdClaim) && Guid.TryParse(tenantIdClaim, out var parsedGuid))
        {
            tenantGuid = parsedGuid;
        }

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                  ?? User.FindFirst("sub")?.Value 
                  ?? User.Identity?.Name 
                  ?? "OPERATOR";

        // Check current warehouse stock
        var stock = await _context.WarehouseStocks
            .FirstOrDefaultAsync(ws => ws.WarehouseId == request.WarehouseId && ws.ProductId == request.ProductId);

        int previousStock = stock?.Quantity ?? 0;

        // If Deficit or Damaged, ensure stock is sufficient
        if (normalizedType == "DEFICIT" || normalizedType == "DAMAGED")
        {
            if (previousStock < request.Quantity)
            {
                return BadRequest(new 
                { 
                    success = false, 
                    errorCode = "ERR_INSUFFICIENT_STOCK", 
                    message = $"رصيد الصنف المتوفر حالياً ({previousStock}) غير كافٍ لتسجيل عجز أو تلف بمقدار ({request.Quantity}).",
                    currentStock = previousStock,
                    requestedAdjustment = request.Quantity
                });
            }
        }

        int quantityChange = normalizedType == "SURPLUS" ? request.Quantity : -request.Quantity;

        // Atomic Transaction for Database Mutation
        using var dbTransaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // 1. Update or initialize WarehouseStock
            if (stock == null)
            {
                stock = new WarehouseStock
                {
                    TenantId = tenantGuid,
                    WarehouseId = request.WarehouseId,
                    ProductId = request.ProductId,
                    Quantity = quantityChange,
                    LastCountedAt = DateTime.UtcNow
                };
                _context.WarehouseStocks.Add(stock);
            }
            else
            {
                stock.Quantity += quantityChange;
                stock.LastCountedAt = DateTime.UtcNow;
            }

            // 2. Insert into inventory_transactions (Audit Ledger)
            var invTx = new InventoryTransaction
            {
                TransactionId = Guid.NewGuid(),
                TenantId = tenantGuid,
                ProductId = request.ProductId,
                WarehouseId = request.WarehouseId,
                QuantityChange = quantityChange,
                TransactionType = "STOCK_ADJUSTMENT",
                Reason = request.Reason.Trim(),
                ReferenceUserId = userId,
                Notes = request.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow
            };
            _context.InventoryTransactions.Add(invTx);

            // 3. Insert into stock_movements for complete historical ledger compliance
            var stockMovement = new StockMovement
            {
                Id = Guid.NewGuid(),
                TenantId = tenantGuid,
                MovementNumber = $"ADJ-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}",
                MovementType = normalizedType == "SURPLUS" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
                FromWarehouseId = normalizedType != "SURPLUS" ? request.WarehouseId : null,
                ToWarehouseId = normalizedType == "SURPLUS" ? request.WarehouseId : null,
                ReferenceNumber = invTx.TransactionId.ToString(),
                Notes = $"[{normalizedType}] {request.Reason} {(string.IsNullOrWhiteSpace(request.Notes) ? "" : " - " + request.Notes)}",
                CreatedBy = userId,
                MovementDate = DateTime.UtcNow,
                Items = new List<StockMovementItem>
                {
                    new StockMovementItem
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantGuid,
                        ProductId = request.ProductId,
                        Quantity = Math.Abs(quantityChange),
                        UnitCost = product.CostPrice
                    }
                }
            };
            _context.StockMovements.Add(stockMovement);

            await _context.SaveChangesAsync();
            await dbTransaction.CommitAsync();

            return Ok(new
            {
                success = true,
                message = normalizedType == "SURPLUS"
                    ? $"تم تسجيل زيادة مخزنية بمقدار +{request.Quantity} بنجاح"
                    : $"تم تسجيل خصم/إتلاف مخزني بمقدار -{request.Quantity} بنجاح",
                transactionId = invTx.TransactionId,
                productId = request.ProductId,
                productName = product.Name,
                sku = product.Sku,
                warehouseId = request.WarehouseId,
                warehouseName = warehouse.Name,
                adjustmentType = normalizedType,
                quantityChange = quantityChange,
                previousStock = previousStock,
                newStock = stock.Quantity,
                reason = request.Reason,
                notes = request.Notes,
                operatorId = userId,
                createdAt = invTx.CreatedAt
            });
        }
        catch (Exception ex)
        {
            await dbTransaction.RollbackAsync();
            return StatusCode(500, new 
            { 
                success = false, 
                errorCode = "ERR_TRANSACTION_FAILED", 
                message = "حدث خطأ أثناء قيد التسوية المخزنية: " + ex.Message 
            });
        }
    }

    /// <summary>
    /// GET /api/inventory/adjustments
    /// Retrieves recent stock adjustments with full audit details
    /// </summary>
    [HttpGet("adjustments")]
    [HasPermission(Permissions.Inventory.ItemsView)]
    public async Task<ActionResult> GetAdjustments(
        [FromQuery] Guid? productId, 
        [FromQuery] Guid? warehouseId,
        [FromQuery] int limit = 50)
    {
        var query = _context.InventoryTransactions
            .Include(t => t.Product)
            .Include(t => t.Warehouse)
            .Where(t => t.TransactionType == "STOCK_ADJUSTMENT")
            .AsQueryable();

        if (productId.HasValue)
        {
            query = query.Where(t => t.ProductId == productId.Value);
        }

        if (warehouseId.HasValue)
        {
            query = query.Where(t => t.WarehouseId == warehouseId.Value);
        }

        var results = await query
            .OrderByDescending(t => t.CreatedAt)
            .Take(Math.Min(limit, 200))
            .Select(t => new
            {
                t.TransactionId,
                t.ProductId,
                ProductName = t.Product != null ? t.Product.Name : string.Empty,
                ProductSku = t.Product != null ? t.Product.Sku : string.Empty,
                t.WarehouseId,
                WarehouseName = t.Warehouse != null ? t.Warehouse.Name : string.Empty,
                t.QuantityChange,
                t.TransactionType,
                t.Reason,
                t.ReferenceUserId,
                t.Notes,
                t.CreatedAt
            })
            .ToListAsync();

        return Ok(results);
    }
}

