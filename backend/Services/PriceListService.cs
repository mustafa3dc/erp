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
    Task<List<ProductBundleDto>> GetBundlesAsync();
    Task<ProductBundleDto?> GetBundleByProductIdAsync(Guid parentProductId);
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
    // Product Bundles / Kits
    // =========================================================================

    public async Task<List<ProductBundleDto>> GetBundlesAsync()
    {
        var bundles = await _context.Products
            .Where(p => p.IsBundle)
            .Include(p => p.BundleComponents)
            .ThenInclude(bc => bc.ComponentProduct)
            .AsNoTracking()
            .ToListAsync();

        return bundles.Select(b => new ProductBundleDto(
            ParentProductId: b.Id,
            BundleSku: b.Sku,
            BundleName: b.Name,
            BundleSellingPrice: b.SellingPrice,
            ComponentsCount: b.BundleComponents.Count,
            Components: b.BundleComponents.Select(c => new BundleComponentDto(
                ComponentProductId: c.ComponentProductId,
                ComponentSku: c.ComponentProduct?.Sku ?? "",
                ComponentName: c.ComponentProduct?.Name ?? "",
                UnitOfMeasure: c.ComponentProduct?.UnitOfMeasure ?? "قطعة",
                Quantity: c.Quantity,
                ComponentCostPrice: c.ComponentProduct?.CostPrice ?? 0,
                ComponentSellingPrice: c.ComponentProduct?.SellingPrice ?? 0
            )).ToList()
        )).ToList();
    }

    public async Task<ProductBundleDto?> GetBundleByProductIdAsync(Guid parentProductId)
    {
        var b = await _context.Products
            .Include(p => p.BundleComponents)
            .ThenInclude(bc => bc.ComponentProduct)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == parentProductId && p.IsBundle);

        if (b == null) return null;

        return new ProductBundleDto(
            ParentProductId: b.Id,
            BundleSku: b.Sku,
            BundleName: b.Name,
            BundleSellingPrice: b.SellingPrice,
            ComponentsCount: b.BundleComponents.Count,
            Components: b.BundleComponents.Select(c => new BundleComponentDto(
                ComponentProductId: c.ComponentProductId,
                ComponentSku: c.ComponentProduct?.Sku ?? "",
                ComponentName: c.ComponentProduct?.Name ?? "",
                UnitOfMeasure: c.ComponentProduct?.UnitOfMeasure ?? "قطعة",
                Quantity: c.Quantity,
                ComponentCostPrice: c.ComponentProduct?.CostPrice ?? 0,
                ComponentSellingPrice: c.ComponentProduct?.SellingPrice ?? 0
            )).ToList()
        );
    }

    public async Task<ApiResponse<ProductBundleDto>> SaveBundleAsync(
        SaveProductBundleRequest request,
        string? performedBy = null)
    {
        var parent = await _context.Products
            .Include(p => p.BundleComponents)
            .FirstOrDefaultAsync(p => p.Id == request.ParentProductId);

        if (parent == null)
        {
            return ApiResponse<ProductBundleDto>.Fail("ERR_PRODUCT_NOT_FOUND", "PRICING");
        }

        if (request.Components == null || request.Components.Count == 0)
        {
            return ApiResponse<ProductBundleDto>.Fail("ERR_BUNDLE_COMPONENTS_REQUIRED", "PRICING");
        }

        using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var oldSnapshot = parent.BundleComponents
                .Select(c => new { c.ComponentProductId, c.Quantity })
                .ToList();

            parent.IsBundle = true;
            parent.BundleComponents.Clear();

            foreach (var c in request.Components)
            {
                if (c.ComponentProductId == parent.Id)
                {
                    await tx.RollbackAsync();
                    return ApiResponse<ProductBundleDto>.Fail("ERR_CIRCULAR_BUNDLE_REFERENCE", "PRICING");
                }

                var comp = await _context.Products.FindAsync(c.ComponentProductId);
                if (comp == null)
                {
                    await tx.RollbackAsync();
                    return ApiResponse<ProductBundleDto>.Fail("ERR_BUNDLE_COMPONENT_NOT_FOUND", "PRICING");
                }

                parent.BundleComponents.Add(new ProductBundleItem
                {
                    ParentProductId = parent.Id,
                    ComponentProductId = comp.Id,
                    Quantity = c.Quantity > 0 ? c.Quantity : 1.0m,
                    CreatedAt = DateTime.UtcNow
                });
            }

            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = parent.TenantId,
                UserId = performedBy ?? "System",
                Username = performedBy ?? "System",
                Action = "UPDATE",
                EntityName = "product_bundles",
                EntityId = parent.Id.ToString(),
                OldValues = JsonSerializer.Serialize(oldSnapshot),
                NewValues = JsonSerializer.Serialize(request.Components.Select(c => new { c.ComponentProductId, c.Quantity })),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            var dto = await GetBundleByProductIdAsync(parent.Id);
            return ApiResponse<ProductBundleDto>.Ok(dto!);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Failed to save product bundle {ParentProductId}", request.ParentProductId);
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

            parent.IsBundle = false;
            _context.ProductBundleItems.RemoveRange(parent.BundleComponents);

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
