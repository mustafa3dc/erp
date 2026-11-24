using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IInventoryService _inventoryService;

    public ProductsController(AppDbContext context, IInventoryService inventoryService)
    {
        _context = context;
        _inventoryService = inventoryService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetProducts(
        [FromQuery] string? search, 
        [FromQuery] Guid? categoryId,
        [FromQuery] bool includeCost = false,
        [FromQuery] bool includeBundles = true)
    {
        var query = _context.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.WarehouseStocks)
            .Include(p => p.QuantityTiers)
            .Include(p => p.BundleComponents)
                .ThenInclude(bc => bc.ComponentProduct)
                .ThenInclude(cp => cp!.WarehouseStocks)
            .Where(p => !p.IsBundle || p.IsActive)
            .AsQueryable();

        if (!includeBundles)
        {
            query = query.Where(p => !p.IsBundle);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(p => p.Name.Contains(search) || p.Sku.Contains(search) || (p.Barcode != null && p.Barcode.Contains(search)));
        }

        if (categoryId.HasValue)
        {
            query = query.Where(p => p.CategoryId == categoryId.Value);
        }

        var products = await query.ToListAsync();

        var results = products.Select(p =>
        {
            var effectiveTotalQty = p.IsBundle
                ? (p.BundleComponents.Count == 0
                    ? 0
                    : p.BundleComponents.Min(bc =>
                    {
                        var compAvail = bc.ComponentProduct?.WarehouseStocks.Sum(ws => Math.Max(0, ws.Quantity - ws.ReservedQuantity)) ?? 0;
                        return bc.Quantity > 0 ? (int)Math.Floor((decimal)compAvail / bc.Quantity) : 0;
                    }))
                : p.WarehouseStocks.Sum(ws => ws.Quantity);

            var effectiveCost = p.IsBundle && p.BundleComponents.Count > 0
                ? p.BundleComponents.Sum(bc => (bc.ComponentProduct?.CostPrice ?? 0m) * bc.Quantity)
                : p.CostPrice;

            return new
            {
                p.Id,
                p.Sku,
                p.Barcode,
                p.Name,
                CategoryName = p.Category != null ? p.Category.Name : (p.IsBundle ? "حزم المنتجات" : "عام"),
                // Strict Cost Masking: Only return cost price if specifically privileged
                CostPrice = includeCost ? (decimal?)effectiveCost : null,
                RetailPrice = p.SellingPrice,
                p.SellingPrice,
                UnitOfMeasure = p.IsBundle ? "حزمة" : p.UnitOfMeasure,
                p.MinStockLevel,
                p.MaxCashierDiscountPercent,
                TotalQuantity = Math.Max(0, effectiveTotalQty),
                p.IsActive,
                p.IsBundle,
                QuantityTiers = p.QuantityTiers
                    .OrderBy(t => t.MinQty)
                    .Select(t => new
                    {
                        t.Id,
                        t.ProductId,
                        t.MinQty,
                        t.MaxQty,
                        t.UnitPrice,
                        t.UpdatedAt
                    }).ToList()
            };
        }).ToList();

        return Ok(results);
    }

    [HttpGet("barcode/{barcode}")]
    public async Task<ActionResult<Product>> GetByBarcode(string barcode)
    {
        var product = await _inventoryService.GetProductByBarcodeAsync(barcode);
        if (product == null) return NotFound(new { message = "المنتج غير موجود" });
        return Ok(product);
    }

    [HttpPost]
    [HasPermission(Permissions.Inventory.ItemsCreate)]
    public async Task<ActionResult<Product>> CreateProduct(Product product)
    {
        _context.Products.Add(product);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetProducts), new { id = product.Id }, product);
    }

    /// <summary>
    /// Updates general product metadata (name, barcode, pricing, classification).
    /// STRICT AUDIT POLICY: Direct overwriting of stock quantity is prohibited here.
    /// Stock quantity is strictly governed by ledger transactions via POST /api/inventory/adjustments.
    /// </summary>
    [HttpPut("{id}")]
    [HasPermission(Permissions.Inventory.ItemsEdit)]
    public async Task<ActionResult<Product>> UpdateProduct(Guid id, Product updatedProduct)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
        {
            return NotFound(new { success = false, errorCode = "ERR_PRODUCT_NOT_FOUND", message = "الصنف غير موجود" });
        }

        product.Name = updatedProduct.Name;
        product.Sku = updatedProduct.Sku;
        product.Barcode = updatedProduct.Barcode;
        product.SellingPrice = updatedProduct.SellingPrice;
        product.MinSellingPrice = updatedProduct.MinSellingPrice;
        product.UnitOfMeasure = updatedProduct.UnitOfMeasure;
        product.MinStockLevel = updatedProduct.MinStockLevel;
        product.MaxStockLevel = updatedProduct.MaxStockLevel;
        product.MaxCashierDiscountPercent = updatedProduct.MaxCashierDiscountPercent;
        product.IsActive = updatedProduct.IsActive;
        product.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(product);
    }

    [HttpDelete("{id}")]
    [HasPermission(Permissions.Inventory.ItemsDelete)]
    public async Task<ActionResult> DeleteProduct(Guid id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
        {
            return NotFound(new { success = false, errorCode = "ERR_PRODUCT_NOT_FOUND", message = "الصنف غير موجود" });
        }

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();
        return Ok(new { success = true, message = "تم حذف الصنف بنجاح" });
    }

    [HttpGet("low-stock")]
    public async Task<ActionResult> GetLowStock()
    {
        var alerts = await _inventoryService.GetLowStockAlertsAsync();
        return Ok(alerts);
    }
}

