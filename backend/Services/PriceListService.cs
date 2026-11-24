using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface IPriceListService
{
    // Direct Product Quantity Tiers
    Task<List<ProductQuantityTierDto>> GetAllQuantityTiersAsync();
    Task<List<ProductQuantityTierDto>> GetProductQuantityTiersAsync(Guid productId);
    Task<ApiResponse<List<ProductQuantityTierDto>>> SaveProductQuantityTiersAsync(SaveProductQuantityTiersRequest request, string? performedBy = null);
    Task<ApiResponse<bool>> DeleteQuantityTierAsync(Guid tierId, string? performedBy = null);
    Task<ResolvedQuantityPriceDto?> ResolveQuantityPriceAsync(Guid productId, int quantity);

    // Product Bundles / Kits
    Task<List<ProductBundleDto>> GetBundlesAsync(Guid? warehouseId = null);
    Task<ProductBundleDto?> GetBundleByProductIdAsync(Guid parentProductId, Guid? warehouseId = null);
    Task<ApiResponse<ProductBundleDto>> SaveBundleAsync(SaveProductBundleRequest request, string? performedBy = null);
    Task<ApiResponse<bool>> DeleteBundleAsync(Guid parentProductId, string? performedBy = null);
}

public class PriceListService : IPriceListService
{
    private readonly AppDbContext _context;
    private readonly ILogger<PriceListService> _logger;

    public PriceListService(AppDbContext context, ILogger<PriceListService> logger)
    {
        _context = context;
        _logger = logger;
    }

    // =========================================================================
    // Direct Product Quantity Tiers
    // =========================================================================

    public async Task<List<ProductQuantityTierDto>> GetAllQuantityTiersAsync()
    {
        return await _context.ProductQuantityTiers
            .Include(t => t.Product)
            .AsNoTracking()
            .OrderBy(t => t.Product != null ? t.Product.Name : "")
            .ThenBy(t => t.MinQty)
            .Select(t => new ProductQuantityTierDto(
                t.Id,
                t.ProductId,
                t.Product != null ? t.Product.Sku : "",
                t.Product != null ? t.Product.Name : "",
                t.Product != null ? t.Product.SellingPrice : 0m,
                t.MinQty,
                t.MaxQty,
                t.UnitPrice,
                t.UpdatedAt
            ))
            .ToListAsync();
    }

    public async Task<List<ProductQuantityTierDto>> GetProductQuantityTiersAsync(Guid productId)
    {
        return await _context.ProductQuantityTiers
            .Where(t => t.ProductId == productId)
            .Include(t => t.Product)
            .AsNoTracking()
            .OrderBy(t => t.MinQty)
            .Select(t => new ProductQuantityTierDto(
                t.Id,
                t.ProductId,
                t.Product != null ? t.Product.Sku : "",
                t.Product != null ? t.Product.Name : "",
                t.Product != null ? t.Product.SellingPrice : 0m,
                t.MinQty,
                t.MaxQty,
                t.UnitPrice,
                t.UpdatedAt
            ))
            .ToListAsync();
    }

    public async Task<ApiResponse<List<ProductQuantityTierDto>>> SaveProductQuantityTiersAsync(
        SaveProductQuantityTiersRequest request,
        string? performedBy = null)
    {
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == request.ProductId);
        if (product == null)
        {
            return ApiResponse<List<ProductQuantityTierDto>>.Fail("ERR_PRODUCT_NOT_FOUND", "PRICING");
        }

        var rawTiers = request.Tiers ?? new List<QuantityTierInputDto>();

        // 1. Range bounds validation
        foreach (var tier in rawTiers)
        {
            if (tier.MinQty < 2 || (tier.MaxQty.HasValue && tier.MaxQty.Value < tier.MinQty) || tier.UnitPrice < 0)
            {
                return ApiResponse<List<ProductQuantityTierDto>>.Fail("ERR_INVALID_QTY_RANGE", "PRICING");
            }
        }

        // 2. Overlap validation
        var sorted = rawTiers.OrderBy(t => t.MinQty).ToList();
        for (int i = 0; i < sorted.Count - 1; i++)
        {
            var current = sorted[i];
            var next = sorted[i + 1];

            if (!current.MaxQty.HasValue || current.MaxQty.Value >= next.MinQty)
            {
                return ApiResponse<List<ProductQuantityTierDto>>.Fail("ERR_OVERLAPPING_QTY_TIER", "PRICING");
            }
        }

        using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var existingTiers = await _context.ProductQuantityTiers
                .Where(t => t.ProductId == product.Id)
                .ToListAsync();

            var oldSnapshot = existingTiers
                .OrderBy(t => t.MinQty)
                .Select(t => new { t.MinQty, t.MaxQty, t.UnitPrice })
                .ToList();

            if (existingTiers.Count > 0)
            {
                _context.ProductQuantityTiers.RemoveRange(existingTiers);
            }

            var now = DateTime.UtcNow;
            var newEntities = sorted.Select(t => new ProductQuantityTier
            {
                TenantId = product.TenantId,
                ProductId = product.Id,
                MinQty = t.MinQty,
                MaxQty = t.MaxQty,
                UnitPrice = t.UnitPrice,
                CreatedAt = now,
                UpdatedAt = now
            }).ToList();

            if (newEntities.Count > 0)
            {
                _context.ProductQuantityTiers.AddRange(newEntities);
            }

            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = product.TenantId,
                UserId = performedBy ?? "System",
                Username = performedBy ?? "System",
                Action = "UPDATE",
                EntityName = "product_quantity_tiers",
                EntityId = product.Id.ToString(),
                OldValues = JsonSerializer.Serialize(oldSnapshot),
                NewValues = JsonSerializer.Serialize(sorted.Select(t => new { t.MinQty, t.MaxQty, t.UnitPrice })),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            var savedDtos = await GetProductQuantityTiersAsync(product.Id);
            return ApiResponse<List<ProductQuantityTierDto>>.Ok(savedDtos);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Failed to save quantity tiers for product {ProductId}", request.ProductId);
            return ApiResponse<List<ProductQuantityTierDto>>.Fail("ERR_SAVE_QTY_TIERS_FAILED", "PRICING");
        }
    }

    public async Task<ApiResponse<bool>> DeleteQuantityTierAsync(Guid tierId, string? performedBy = null)
    {
        using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var tier = await _context.ProductQuantityTiers.FirstOrDefaultAsync(t => t.Id == tierId);
            if (tier == null)
            {
                return ApiResponse<bool>.Fail("ERR_QTY_TIER_NOT_FOUND", "PRICING");
            }

            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = tier.TenantId,
                UserId = performedBy ?? "System",
                Username = performedBy ?? "System",
                Action = "DELETE",
                EntityName = "product_quantity_tiers",
                EntityId = tier.Id.ToString(),
                OldValues = JsonSerializer.Serialize(new { tier.ProductId, tier.MinQty, tier.MaxQty, tier.UnitPrice }),
                Timestamp = DateTimeOffset.UtcNow
            });

            _context.ProductQuantityTiers.Remove(tier);
            await _context.SaveChangesAsync();
            await tx.CommitAsync();
            return ApiResponse<bool>.Ok(true);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Failed to delete quantity tier {TierId}", tierId);
            return ApiResponse<bool>.Fail("ERR_DELETE_QTY_TIER_FAILED", "PRICING");
        }
    }

    public async Task<ResolvedQuantityPriceDto?> ResolveQuantityPriceAsync(Guid productId, int quantity)
    {
        var product = await _context.Products
            .Include(p => p.QuantityTiers)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId);

        if (product == null)
        {
            return null;
        }

        var safeQty = quantity < 1 ? 1 : quantity;
        var matchedTier = product.QuantityTiers
            .Where(t => safeQty >= t.MinQty && (!t.MaxQty.HasValue || safeQty <= t.MaxQty.Value))
            .OrderByDescending(t => t.MinQty)
            .FirstOrDefault();

        return new ResolvedQuantityPriceDto(
            ProductId: product.Id,
            Quantity: safeQty,
            BasePrice: product.SellingPrice,
            AppliedUnitPrice: matchedTier != null ? matchedTier.UnitPrice : product.SellingPrice,
            IsTierApplied: matchedTier != null,
            MatchedTierId: matchedTier?.Id,
            MinQty: matchedTier?.MinQty,
            MaxQty: matchedTier?.MaxQty
        );
    }

    // =========================================================================
    // Product Bundles / Kits (Decoupled Virtual Bundle Products)
    // =========================================================================

    private static int GetComponentAvailableStock(Product? comp, Guid? warehouseId)
    {
        if (comp == null || comp.WarehouseStocks == null) return 0;
        var stocks = warehouseId.HasValue && warehouseId.Value != Guid.Empty
            ? comp.WarehouseStocks.Where(ws => ws.WarehouseId == warehouseId.Value)
            : comp.WarehouseStocks;
        return stocks.Sum(ws => Math.Max(0, ws.Quantity - ws.ReservedQuantity));
    }

    private static ProductBundleDto MapBundleToDto(Product b, Guid? warehouseId = null)
    {
        var components = b.BundleComponents.Select(c =>
        {
            var avail = GetComponentAvailableStock(c.ComponentProduct, warehouseId);
            return new BundleComponentDto(
                ComponentProductId: c.ComponentProductId,
                ComponentSku: c.ComponentProduct?.Sku ?? "",
                ComponentName: c.ComponentProduct?.Name ?? "",
                UnitOfMeasure: c.ComponentProduct?.UnitOfMeasure ?? "قطعة",
                Quantity: c.Quantity,
                ComponentCostPrice: c.ComponentProduct?.CostPrice ?? 0m,
                ComponentSellingPrice: c.ComponentProduct?.SellingPrice ?? 0m,
                AvailableStock: avail
            );
        }).ToList();

        var totalCost = components.Sum(c => c.ComponentCostPrice * c.Quantity);
        var totalRetail = components.Sum(c => c.ComponentSellingPrice * c.Quantity);
        var availableQty = components.Count == 0
            ? 0
            : components.Min(c => c.Quantity > 0
                ? (int)Math.Floor((decimal)c.AvailableStock / c.Quantity)
                : 0);

        return new ProductBundleDto(
            ParentProductId: b.Id,
            BundleSku: b.Sku,
            Barcode: b.Barcode,
            BundleName: b.Name,
            BundleSellingPrice: b.SellingPrice,
            TotalComponentsCost: totalCost,
            TotalComponentsRetailPrice: totalRetail,
            AvailableQuantity: Math.Max(0, availableQty),
            ComponentsCount: components.Count,
            Components: components
        );
    }

    public async Task<List<ProductBundleDto>> GetBundlesAsync(Guid? warehouseId = null)
    {
        var bundles = await _context.Products
            .Where(p => p.IsBundle && p.IsActive)
            .Include(p => p.BundleComponents)
                .ThenInclude(bc => bc.ComponentProduct)
                .ThenInclude(cp => cp!.WarehouseStocks)
            .AsNoTracking()
            .OrderByDescending(p => p.UpdatedAt ?? p.CreatedAt)
            .ToListAsync();

        return bundles.Select(b => MapBundleToDto(b, warehouseId)).ToList();
    }

    public async Task<ProductBundleDto?> GetBundleByProductIdAsync(Guid parentProductId, Guid? warehouseId = null)
    {
        var b = await _context.Products
            .Include(p => p.BundleComponents)
                .ThenInclude(bc => bc.ComponentProduct)
                .ThenInclude(cp => cp!.WarehouseStocks)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == parentProductId && p.IsBundle && p.IsActive);

        return b == null ? null : MapBundleToDto(b, warehouseId);
    }

    public async Task<ApiResponse<ProductBundleDto>> SaveBundleAsync(
        SaveProductBundleRequest request,
        string? performedBy = null)
    {
        if (string.IsNullOrWhiteSpace(request.BundleName))
        {
            return ApiResponse<ProductBundleDto>.Fail("ERR_BUNDLE_NAME_REQUIRED", "PRICING");
        }

        if (request.BundleSellingPrice < 0)
        {
            return ApiResponse<ProductBundleDto>.Fail("ERR_INVALID_PRICE", "PRICING");
        }

        if (request.Components == null || request.Components.Count == 0)
        {
            return ApiResponse<ProductBundleDto>.Fail("ERR_BUNDLE_COMPONENTS_REQUIRED", "PRICING");
        }

        // Normalize and merge duplicate component IDs safely
        var mergedComponents = request.Components
            .Where(c => c.ComponentProductId != Guid.Empty && c.Quantity > 0)
            .GroupBy(c => c.ComponentProductId)
            .Select(g => new { ComponentProductId = g.Key, Quantity = g.Sum(x => x.Quantity) })
            .ToList();

        if (mergedComponents.Count == 0)
        {
            return ApiResponse<ProductBundleDto>.Fail("ERR_BUNDLE_COMPONENTS_REQUIRED", "PRICING");
        }

        var isUpdate = request.BundleId.HasValue && request.BundleId.Value != Guid.Empty;

        using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            Product bundleProduct;
            string auditAction;
            object? oldSnapshot = null;

            if (isUpdate)
            {
                var existing = await _context.Products
                    .Include(p => p.BundleComponents)
                    .FirstOrDefaultAsync(p => p.Id == request.BundleId!.Value);

                if (existing == null)
                {
                    await tx.RollbackAsync();
                    return ApiResponse<ProductBundleDto>.Fail("ERR_BUNDLE_NOT_FOUND", "PRICING");
                }

                // STRICT DOMAIN GUARD: Never hijack a standalone physical product
                if (!existing.IsBundle)
                {
                    await tx.RollbackAsync();
                    return ApiResponse<ProductBundleDto>.Fail("ERR_CANNOT_CONVERT_PHYSICAL_PRODUCT_TO_BUNDLE", "PRICING");
                }

                oldSnapshot = new
                {
                    existing.Name,
                    existing.Sku,
                    existing.Barcode,
                    existing.SellingPrice,
                    Components = existing.BundleComponents.Select(c => new { c.ComponentProductId, c.Quantity }).ToList()
                };

                var requestedSku = string.IsNullOrWhiteSpace(request.BundleSku) ? existing.Sku : request.BundleSku.Trim();
                if (!string.Equals(requestedSku, existing.Sku, StringComparison.OrdinalIgnoreCase))
                {
                    var skuExists = await _context.Products.AnyAsync(p => p.Sku == requestedSku && p.Id != existing.Id);
                    if (skuExists)
                    {
                        await tx.RollbackAsync();
                        return ApiResponse<ProductBundleDto>.Fail("ERR_DUPLICATE_SKU", "PRICING");
                    }
                    existing.Sku = requestedSku;
                }

                var requestedBarcode = string.IsNullOrWhiteSpace(request.Barcode) ? existing.Barcode : request.Barcode.Trim();
                if (!string.IsNullOrWhiteSpace(requestedBarcode) && !string.Equals(requestedBarcode, existing.Barcode, StringComparison.OrdinalIgnoreCase))
                {
                    var barcodeExists = await _context.Products.AnyAsync(p => p.Barcode == requestedBarcode && p.Id != existing.Id);
                    if (barcodeExists)
                    {
                        await tx.RollbackAsync();
                        return ApiResponse<ProductBundleDto>.Fail("ERR_DUPLICATE_BARCODE", "PRICING");
                    }
                    existing.Barcode = requestedBarcode;
                }

                existing.Name = request.BundleName.Trim();
                existing.SellingPrice = request.BundleSellingPrice;
                existing.IsActive = true;
                existing.UpdatedAt = DateTime.UtcNow;

                // Remove old component rows explicitly before inserting new ones
                if (existing.BundleComponents.Count > 0)
                {
                    _context.ProductBundleItems.RemoveRange(existing.BundleComponents);
                    await _context.SaveChangesAsync();
                }

                bundleProduct = existing;
                auditAction = "UPDATE";
            }
            else
            {
                // Auto-generate unique BND-XXXX SKU if omitted
                string targetSku;
                if (!string.IsNullOrWhiteSpace(request.BundleSku))
                {
                    targetSku = request.BundleSku.Trim();
                    var skuExists = await _context.Products.AnyAsync(p => p.Sku == targetSku);
                    if (skuExists)
                    {
                        await tx.RollbackAsync();
                        return ApiResponse<ProductBundleDto>.Fail("ERR_DUPLICATE_SKU", "PRICING");
                    }
                }
                else
                {
                    var existingSkus = await _context.Products
                        .IgnoreQueryFilters()
                        .Where(p => p.Sku.StartsWith("BND-"))
                        .Select(p => p.Sku)
                        .ToListAsync();

                    int nextNum = 1001;
                    foreach (var s in existingSkus)
                    {
                        if (int.TryParse(s.Substring(4), out var parsed) && parsed >= nextNum)
                        {
                            nextNum = parsed + 1;
                        }
                    }
                    targetSku = $"BND-{nextNum}";
                }

                // Auto-generate or validate barcode
                string targetBarcode;
                if (!string.IsNullOrWhiteSpace(request.Barcode))
                {
                    targetBarcode = request.Barcode.Trim();
                    var barcodeExists = await _context.Products.AnyAsync(p => p.Barcode == targetBarcode);
                    if (barcodeExists)
                    {
                        await tx.RollbackAsync();
                        return ApiResponse<ProductBundleDto>.Fail("ERR_DUPLICATE_BARCODE", "PRICING");
                    }
                }
                else
                {
                    do
                    {
                        targetBarcode = $"299{Random.Shared.Next(100000000, 999999999)}{Random.Shared.Next(0, 9)}";
                    } while (await _context.Products.IgnoreQueryFilters().AnyAsync(p => p.Barcode == targetBarcode));
                }

                bundleProduct = new Product
                {
                    Id = Guid.NewGuid(),
                    Sku = targetSku,
                    Barcode = targetBarcode,
                    Name = request.BundleName.Trim(),
                    CostPrice = 0m,
                    SellingPrice = request.BundleSellingPrice,
                    MinSellingPrice = 0m,
                    MinProfitMargin = 0m,
                    MaxCashierDiscountPercent = 5.0m,
                    UnitOfMeasure = "حزمة",
                    MinStockLevel = 0,
                    MaxStockLevel = 0,
                    IsBundle = true,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Products.Add(bundleProduct);
                auditAction = "CREATE";
            }

            // Validate and attach components (strictly physical non-bundle products only)
            decimal totalComponentsCost = 0m;
            var newBundleItems = new List<ProductBundleItem>();

            foreach (var c in mergedComponents)
            {
                if (c.ComponentProductId == bundleProduct.Id)
                {
                    await tx.RollbackAsync();
                    return ApiResponse<ProductBundleDto>.Fail("ERR_CIRCULAR_BUNDLE_REFERENCE", "PRICING");
                }

                var comp = await _context.Products.FindAsync(c.ComponentProductId);
                if (comp == null || !comp.IsActive)
                {
                    await tx.RollbackAsync();
                    return ApiResponse<ProductBundleDto>.Fail("ERR_BUNDLE_COMPONENT_NOT_FOUND", "PRICING");
                }

                if (comp.IsBundle)
                {
                    await tx.RollbackAsync();
                    return ApiResponse<ProductBundleDto>.Fail("ERR_CIRCULAR_BUNDLE_REFERENCE", "PRICING");
                }

                totalComponentsCost += comp.CostPrice * c.Quantity;

                newBundleItems.Add(new ProductBundleItem
                {
                    TenantId = bundleProduct.TenantId,
                    ParentProductId = bundleProduct.Id,
                    ComponentProductId = comp.Id,
                    Quantity = c.Quantity,
                    CreatedAt = DateTime.UtcNow
                });
            }

            bundleProduct.CostPrice = totalComponentsCost;
            bundleProduct.MinSellingPrice = 0m;

            _context.ProductBundleItems.AddRange(newBundleItems);

            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = bundleProduct.TenantId,
                UserId = performedBy ?? "System",
                Username = performedBy ?? "System",
                Action = auditAction,
                EntityName = "product_bundles",
                EntityId = bundleProduct.Id.ToString(),
                OldValues = oldSnapshot != null ? JsonSerializer.Serialize(oldSnapshot) : null,
                NewValues = JsonSerializer.Serialize(new
                {
                    bundleProduct.Name,
                    bundleProduct.Sku,
                    bundleProduct.Barcode,
                    bundleProduct.SellingPrice,
                    TotalComponentsCost = totalComponentsCost,
                    Components = mergedComponents
                }),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            var dto = await GetBundleByProductIdAsync(bundleProduct.Id);
            return ApiResponse<ProductBundleDto>.Ok(dto!);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Failed to save product bundle {BundleName}", request.BundleName);
            return ApiResponse<ProductBundleDto>.Fail("ERR_SAVE_BUNDLE_FAILED", "PRICING");
        }
    }

    public async Task<ApiResponse<bool>> DeleteBundleAsync(Guid parentProductId, string? performedBy = null)
    {
        using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var parent = await _context.Products
                .Include(p => p.BundleComponents)
                .FirstOrDefaultAsync(p => p.Id == parentProductId);

            if (parent == null || !parent.IsBundle)
            {
                return ApiResponse<bool>.Fail("ERR_BUNDLE_NOT_FOUND", "PRICING");
            }

            var oldSnapshot = parent.BundleComponents
                .Select(c => new { c.ComponentProductId, c.Quantity })
                .ToList();

            if (parent.BundleComponents.Count > 0)
            {
                _context.ProductBundleItems.RemoveRange(parent.BundleComponents);
            }

            // Preserve historical invoice / movement / quotation foreign-key integrity
            var hasHistory = await _context.SalesInvoiceItems.AnyAsync(i => i.ProductId == parent.Id)
                || await _context.StockMovementItems.AnyAsync(i => i.ProductId == parent.Id)
                || await _context.SalesQuotationItems.AnyAsync(i => i.ProductId == parent.Id);

            if (hasHistory)
            {
                parent.IsActive = false;
                parent.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                _context.Products.Remove(parent);
            }

            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = parent.TenantId,
                UserId = performedBy ?? "System",
                Username = performedBy ?? "System",
                Action = "DELETE",
                EntityName = "product_bundles",
                EntityId = parent.Id.ToString(),
                OldValues = JsonSerializer.Serialize(oldSnapshot),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
            return ApiResponse<bool>.Ok(true);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Failed to delete product bundle {ParentProductId}", parentProductId);
            return ApiResponse<bool>.Fail("ERR_DELETE_BUNDLE_FAILED", "PRICING");
        }
    }
}
