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

        if (product.IsBundle)
        {
            return BadRequest(new
            {
                success = false,
                errorCode = "ERR_BUNDLE_NO_PHYSICAL_STOCK",
                message = "لا يمكن إجراء تسوية مخزنية مباشرة لحزمة منتجات مركبة؛ يتم احتساب رصيدها تلقائياً من مكوناتها."
            });
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

    /// <summary>
    /// GET /api/inventory/movements
    /// Queries genuine persisted StockMovements sorted strictly newest-first (ORDER BY MovementDate DESC).
    /// Stamps UTC DateTimeKind so clients accurately convert timestamps to local timezone.
    /// </summary>
    [HttpGet("movements")]
    [HasPermission(Permissions.Inventory.ItemsView)]
    public async Task<ActionResult> GetStockMovements(
        [FromQuery] Guid? warehouseId,
        [FromQuery] int limit = 100)
    {
        var cappedLimit = Math.Clamp(limit, 1, 500);

        var query = _context.StockMovements
            .Include(m => m.Items)
                .ThenInclude(i => i.Product)
            .AsNoTracking()
            .AsQueryable();

        if (warehouseId.HasValue)
        {
            query = query.Where(m => m.FromWarehouseId == warehouseId.Value || m.ToWarehouseId == warehouseId.Value);
        }

        var movements = await query
            .OrderByDescending(m => m.MovementDate)
            .Take(cappedLimit)
            .ToListAsync();

        var warehouseNames = await _context.Warehouses
            .AsNoTracking()
            .ToDictionaryAsync(w => w.Id, w => w.Name);

        var rows = new List<object>();

        foreach (var m in movements)
        {
            var utcDate = DateTime.SpecifyKind(m.MovementDate, DateTimeKind.Utc);
            var fromName = m.FromWarehouseId.HasValue && warehouseNames.TryGetValue(m.FromWarehouseId.Value, out var fName)
                ? fName
                : null;
            var toName = m.ToWarehouseId.HasValue && warehouseNames.TryGetValue(m.ToWarehouseId.Value, out var tName)
                ? tName
                : null;

            var normalizedType = NormalizeDashboardMovementType(m.MovementType);

            if (m.Items.Count == 0)
            {
                rows.Add(new
                {
                    id = string.IsNullOrWhiteSpace(m.MovementNumber) ? m.Id.ToString() : m.MovementNumber,
                    movementId = m.Id,
                    movementNumber = m.MovementNumber,
                    sku = m.ReferenceNumber ?? string.Empty,
                    productName = m.Notes ?? m.MovementType,
                    type = normalizedType,
                    rawType = m.MovementType,
                    qty = 0,
                    unit = "قطعة",
                    unitCost = 0m,
                    location = toName ?? fromName ?? string.Empty,
                    fromLocation = fromName ?? (normalizedType == "Inbound" ? "مورد / إرجاع" : string.Empty),
                    toLocation = toName ?? (normalizedType == "Outbound" ? "عميل / صرف" : string.Empty),
                    status = normalizedType == "Outbound" ? "Dispatched" : "Received",
                    movementDate = utcDate,
                    createdAt = utcDate,
                    timestamp = utcDate,
                    operatorName = m.CreatedBy ?? "System",
                    referenceNo = m.ReferenceNumber,
                    notes = m.Notes
                });
                continue;
            }

            foreach (var item in m.Items)
            {
                var signedQty = normalizedType == "Outbound" ? -Math.Abs(item.Quantity) : Math.Abs(item.Quantity);
                rows.Add(new
                {
                    id = m.Items.Count > 1
                        ? $"{(string.IsNullOrWhiteSpace(m.MovementNumber) ? m.Id.ToString("N")[..8] : m.MovementNumber)}-{item.Id.ToString("N")[..4]}"
                        : (string.IsNullOrWhiteSpace(m.MovementNumber) ? m.Id.ToString() : m.MovementNumber),
                    movementId = m.Id,
                    movementNumber = m.MovementNumber,
                    sku = item.Product?.Sku ?? m.ReferenceNumber ?? string.Empty,
                    productName = item.Product?.Name ?? m.Notes ?? string.Empty,
                    type = normalizedType,
                    rawType = m.MovementType,
                    qty = signedQty,
                    unit = item.Product?.UnitOfMeasure ?? "قطعة",
                    unitCost = item.UnitCost,
                    location = toName ?? fromName ?? string.Empty,
                    fromLocation = fromName ?? (normalizedType == "Inbound" ? "مورد / إرجاع" : string.Empty),
                    toLocation = toName ?? (normalizedType == "Outbound" ? "عميل / صرف" : string.Empty),
                    status = normalizedType == "Outbound" ? "Dispatched" : "Received",
                    movementDate = utcDate,
                    createdAt = utcDate,
                    timestamp = utcDate,
                    operatorName = m.CreatedBy ?? "System",
                    referenceNo = m.ReferenceNumber,
                    notes = m.Notes
                });
            }
        }

        return Ok(rows);
    }

    /// <summary>
    /// GET /api/inventory/movements/weekly-summary
    /// Groups genuine persisted StockMovements into the 7 rolling local days using client UTC offset (e.g. tzOffsetMinutes=180 for UTC+3).
    /// </summary>
    [HttpGet("movements/weekly-summary")]
    [HasPermission(Permissions.Inventory.ItemsView)]
    public async Task<ActionResult> GetWeeklyMovementsSummary([FromQuery] int tzOffsetMinutes = 180)
    {
        var offset = TimeSpan.FromMinutes(Math.Clamp(tzOffsetMinutes, -720, 840));
        var localToday = DateTime.UtcNow.Add(offset).Date;
        var localWindowStart = localToday.AddDays(-6);
        var utcWindowStart = localWindowStart.Subtract(offset);
        var utcWindowEnd = localToday.AddDays(1).Subtract(offset);

        var movements = await _context.StockMovements
            .Include(m => m.Items)
            .AsNoTracking()
            .Where(m => m.MovementDate >= utcWindowStart && m.MovementDate < utcWindowEnd)
            .OrderByDescending(m => m.MovementDate)
            .ToListAsync();

        var dailyBuckets = Enumerable.Range(0, 7)
            .Select(i => localWindowStart.AddDays(i))
            .ToDictionary(d => d, _ => (Inbound: 0, Outbound: 0));

        foreach (var m in movements)
        {
            var utcStamp = DateTime.SpecifyKind(m.MovementDate, DateTimeKind.Utc);
            var localDate = utcStamp.Add(offset).Date;
            if (!dailyBuckets.ContainsKey(localDate)) continue;

            var qty = m.Items.Sum(i => Math.Abs(i.Quantity));
            if (qty <= 0) continue;

            var normType = NormalizeDashboardMovementType(m.MovementType);
            var current = dailyBuckets[localDate];
            if (normType == "Inbound")
            {
                dailyBuckets[localDate] = (current.Inbound + qty, current.Outbound);
            }
            else if (normType == "Outbound")
            {
                dailyBuckets[localDate] = (current.Inbound, current.Outbound + qty);
            }
        }

        var result = dailyBuckets
            .OrderBy(kvp => kvp.Key)
            .Select(kvp => new
            {
                date = kvp.Key.ToString("yyyy-MM-dd"),
                inbound = kvp.Value.Inbound,
                outbound = kvp.Value.Outbound
            })
            .ToList();

        return Ok(result);
    }

    private static string NormalizeDashboardMovementType(string? rawType)
    {
        var t = (rawType ?? string.Empty).Trim().ToUpperInvariant();
        if (t is "INBOUND" or "IN" or "RECEIPT" or "INBOUND_PURCHASE" or "SALESRETURN" or "SALES_RETURN" or "ADJUSTMENT_IN")
            return "Inbound";
        if (t is "OUTBOUND" or "OUT" or "POS SALE" or "DISPATCH" or "SALE" or "ADJUSTMENT_OUT")
            return "Outbound";
        if (t is "TRANSFER")
            return "Transfer";
        return rawType ?? "Adjustment";
    }
}

