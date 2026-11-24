using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface IPriceListService
{
    Task<List<PriceListDto>> GetPriceListsAsync();
    Task<PriceListDetailDto?> GetPriceListByIdAsync(Guid id);
    Task<ApiResponse<PriceListDto>> CreatePriceListAsync(CreatePriceListRequest request);
    Task<ApiResponse<PriceListDto>> UpdatePriceListAsync(Guid id, UpdatePriceListRequest request);
    Task<ApiResponse<bool>> DeletePriceListAsync(Guid id);

    Task<ApiResponse<PriceListItemDto>> SavePriceListItemAsync(Guid priceListId, SavePriceListItemInputDto input);
    Task<ApiResponse<bool>> DeletePriceListItemAsync(Guid priceListId, Guid itemId);

    Task<ApiResponse<bool>> AssignPriceListToCustomerAsync(AssignCustomerPriceListRequest request);
    Task<ResolvedPriceResultDto> ResolvePriceAsync(ResolveProductPriceRequest request);

    // Product Bundles / Kits
    Task<List<ProductBundleDto>> GetBundlesAsync();
    Task<ProductBundleDto?> GetBundleByProductIdAsync(Guid parentProductId);
    Task<ApiResponse<ProductBundleDto>> SaveBundleAsync(SaveProductBundleRequest request);
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

    public async Task<List<PriceListDto>> GetPriceListsAsync()
    {
        return await _context.PriceLists
            .Include(pl => pl.Items)
            .AsNoTracking()
            .OrderByDescending(pl => pl.IsDefault)
            .ThenBy(pl => pl.Name)
            .Select(pl => new PriceListDto(
                pl.Id,
                pl.Code,
                pl.Name,
                pl.Currency,
                pl.IsDefault,
                pl.IsActive,
                pl.StartDate,
                pl.EndDate,
                pl.Description,
                pl.Items.Count,
                pl.CreatedAt
            ))
            .ToListAsync();
    }

    public async Task<PriceListDetailDto?> GetPriceListByIdAsync(Guid id)
    {
        var pl = await _context.PriceLists
            .Include(x => x.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (pl == null) return null;

        return new PriceListDetailDto(
            pl.Id,
            pl.Code,
            pl.Name,
            pl.Currency,
            pl.IsDefault,
            pl.IsActive,
            pl.StartDate,
            pl.EndDate,
            pl.Description,
            pl.CreatedAt,
            pl.Items.Select(i => new PriceListItemDto(
                i.Id,
                i.ProductId,
                i.Product?.Sku ?? "",
                i.Product?.Name ?? "",
                i.Product?.SellingPrice ?? 0,
                i.MinQuantity,
                i.UnitPrice,
                i.DiscountPercent,
                i.UpdatedAt
            )).ToList()
        );
    }

    public async Task<ApiResponse<PriceListDto>> CreatePriceListAsync(CreatePriceListRequest request)
    {
        var existing = await _context.PriceLists
            .FirstOrDefaultAsync(pl => pl.Code.ToLower() == request.Code.Trim().ToLower());

        if (existing != null)
        {
            return ApiResponse<PriceListDto>.Fail("ERR_PRICE_LIST_CODE_EXISTS", "PRICING");
        }

        if (request.IsDefault)
        {
            var currentDefaults = await _context.PriceLists.Where(pl => pl.IsDefault).ToListAsync();
            foreach (var d in currentDefaults) d.IsDefault = false;
        }

        var priceList = new PriceList
        {
            Code = request.Code.Trim().ToUpper(),
            Name = request.Name.Trim(),
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "IQD" : request.Currency.Trim().ToUpper(),
            IsDefault = request.IsDefault,
            IsActive = true,
            StartDate = request.StartDate?.ToUniversalTime(),
            EndDate = request.EndDate?.ToUniversalTime(),
            Description = request.Description?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (request.Items != null && request.Items.Count > 0)
        {
            foreach (var it in request.Items)
            {
                priceList.Items.Add(new PriceListItem
                {
                    ProductId = it.ProductId,
                    MinQuantity = it.MinQuantity,
                    UnitPrice = it.UnitPrice,
                    DiscountPercent = it.DiscountPercent,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }

        _context.PriceLists.Add(priceList);
        await _context.SaveChangesAsync();

        var dto = new PriceListDto(
            priceList.Id,
            priceList.Code,
            priceList.Name,
            priceList.Currency,
            priceList.IsDefault,
            priceList.IsActive,
            priceList.StartDate,
            priceList.EndDate,
            priceList.Description,
            priceList.Items.Count,
            priceList.CreatedAt
        );

        return ApiResponse<PriceListDto>.Ok(dto);
    }

    public async Task<ApiResponse<PriceListDto>> UpdatePriceListAsync(Guid id, UpdatePriceListRequest request)
    {
        var pl = await _context.PriceLists
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (pl == null)
        {
            return ApiResponse<PriceListDto>.Fail("ERR_PRICE_LIST_NOT_FOUND", "PRICING");
        }

        if (request.IsDefault && !pl.IsDefault)
        {
            var currentDefaults = await _context.PriceLists.Where(x => x.IsDefault && x.Id != id).ToListAsync();
            foreach (var d in currentDefaults) d.IsDefault = false;
        }

        pl.Name = request.Name.Trim();
        pl.Currency = string.IsNullOrWhiteSpace(request.Currency) ? "IQD" : request.Currency.Trim().ToUpper();
        pl.IsDefault = request.IsDefault;
        pl.IsActive = request.IsActive;
        pl.StartDate = request.StartDate?.ToUniversalTime();
        pl.EndDate = request.EndDate?.ToUniversalTime();
        pl.Description = request.Description?.Trim();
        pl.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var dto = new PriceListDto(
            pl.Id,
            pl.Code,
            pl.Name,
            pl.Currency,
            pl.IsDefault,
            pl.IsActive,
            pl.StartDate,
            pl.EndDate,
            pl.Description,
            pl.Items.Count,
            pl.CreatedAt
        );

        return ApiResponse<PriceListDto>.Ok(dto);
    }

    public async Task<ApiResponse<bool>> DeletePriceListAsync(Guid id)
    {
        var pl = await _context.PriceLists.FindAsync(id);
        if (pl == null)
        {
            return ApiResponse<bool>.Fail("ERR_PRICE_LIST_NOT_FOUND", "PRICING");
        }

        if (pl.IsDefault)
        {
            return ApiResponse<bool>.Fail("ERR_CANNOT_DELETE_DEFAULT_PRICE_LIST", "PRICING");
        }

        _context.PriceLists.Remove(pl);
        await _context.SaveChangesAsync();
        return ApiResponse<bool>.Ok(true);
    }

    public async Task<ApiResponse<PriceListItemDto>> SavePriceListItemAsync(Guid priceListId, SavePriceListItemInputDto input)
    {
        var pl = await _context.PriceLists.FindAsync(priceListId);
        if (pl == null)
        {
            return ApiResponse<PriceListItemDto>.Fail("ERR_PRICE_LIST_NOT_FOUND", "PRICING");
        }

        var product = await _context.Products.FindAsync(input.ProductId);
        if (product == null)
        {
            return ApiResponse<PriceListItemDto>.Fail("ERR_PRODUCT_NOT_FOUND", "PRICING");
        }

        var item = await _context.PriceListItems
            .FirstOrDefaultAsync(i => i.PriceListId == priceListId && i.ProductId == input.ProductId && i.MinQuantity == input.MinQuantity);

        if (item == null)
        {
            item = new PriceListItem
            {
                PriceListId = priceListId,
                ProductId = input.ProductId,
                MinQuantity = input.MinQuantity,
                UnitPrice = input.UnitPrice,
                DiscountPercent = input.DiscountPercent,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.PriceListItems.Add(item);
        }
        else
        {
            item.UnitPrice = input.UnitPrice;
            item.DiscountPercent = input.DiscountPercent;
            item.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        var dto = new PriceListItemDto(
            item.Id,
            product.Id,
            product.Sku,
            product.Name,
            product.SellingPrice,
            item.MinQuantity,
            item.UnitPrice,
            item.DiscountPercent,
            item.UpdatedAt
        );

        return ApiResponse<PriceListItemDto>.Ok(dto);
    }

    public async Task<ApiResponse<bool>> DeletePriceListItemAsync(Guid priceListId, Guid itemId)
    {
        var item = await _context.PriceListItems
            .FirstOrDefaultAsync(i => i.Id == itemId && i.PriceListId == priceListId);

        if (item == null)
        {
            return ApiResponse<bool>.Fail("ERR_PRICE_LIST_ITEM_NOT_FOUND", "PRICING");
        }

        _context.PriceListItems.Remove(item);
        await _context.SaveChangesAsync();
        return ApiResponse<bool>.Ok(true);
    }

    public async Task<ApiResponse<bool>> AssignPriceListToCustomerAsync(AssignCustomerPriceListRequest request)
    {
        var customer = await _context.Customers.FindAsync(request.CustomerId);
        if (customer == null)
        {
            return ApiResponse<bool>.Fail("ERR_CUSTOMER_NOT_FOUND", "SALES");
        }

        if (request.PriceListId.HasValue && request.PriceListId.Value != Guid.Empty)
        {
            var pl = await _context.PriceLists.FindAsync(request.PriceListId.Value);
            if (pl == null || !pl.IsActive)
            {
                return ApiResponse<bool>.Fail("ERR_PRICE_LIST_NOT_FOUND", "PRICING");
            }
            customer.PriceListId = request.PriceListId.Value;
        }
        else
        {
            customer.PriceListId = null;
        }

        customer.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return ApiResponse<bool>.Ok(true);
    }

    public async Task<ResolvedPriceResultDto> ResolvePriceAsync(ResolveProductPriceRequest request)
    {
        var product = await _context.Products.FindAsync(request.ProductId);
        if (product == null)
        {
            throw new KeyNotFoundException("Product not found");
        }

        Guid? targetPriceListId = request.PriceListId;

        // If not specified, look up from Customer
        if (!targetPriceListId.HasValue && request.CustomerId.HasValue)
        {
            var customer = await _context.Customers.FindAsync(request.CustomerId.Value);
            if (customer?.PriceListId != null)
            {
                targetPriceListId = customer.PriceListId;
            }
        }

        // If still not specified, look up Default active PriceList
        if (!targetPriceListId.HasValue)
        {
            var defaultPl = await _context.PriceLists
                .FirstOrDefaultAsync(pl => pl.IsDefault && pl.IsActive);
            if (defaultPl != null)
            {
                targetPriceListId = defaultPl.Id;
            }
        }

        if (targetPriceListId.HasValue)
        {
            var priceList = await _context.PriceLists
                .Include(pl => pl.Items)
                .FirstOrDefaultAsync(pl => pl.Id == targetPriceListId.Value && pl.IsActive);

            if (priceList != null)
            {
                // Find matching quantity tier rule: best matching min_quantity <= request.Quantity
                var bestTier = priceList.Items
                    .Where(i => i.ProductId == product.Id && i.MinQuantity <= request.Quantity)
                    .OrderByDescending(i => i.MinQuantity)
                    .FirstOrDefault();

                if (bestTier != null)
                {
                    decimal resolvedPrice = bestTier.UnitPrice;
                    decimal appliedDiscount = bestTier.DiscountPercent;

                    if (resolvedPrice <= 0 && appliedDiscount > 0)
                    {
                        resolvedPrice = product.SellingPrice * (1.0m - (appliedDiscount / 100.0m));
                    }
                    else if (resolvedPrice > 0 && product.SellingPrice > 0 && appliedDiscount == 0)
                    {
                        appliedDiscount = Math.Round(((product.SellingPrice - resolvedPrice) / product.SellingPrice) * 100.0m, 2);
                    }

                    return new ResolvedPriceResultDto(
                        ProductId: product.Id,
                        ProductSku: product.Sku,
                        ProductName: product.Name,
                        StandardPrice: product.SellingPrice,
                        ResolvedUnitPrice: resolvedPrice > 0 ? resolvedPrice : product.SellingPrice,
                        PriceSource: "PRICE_LIST",
                        PriceListId: priceList.Id,
                        PriceListName: priceList.Name,
                        AppliedDiscountPercent: appliedDiscount
                    );
                }
            }
        }

        // Fallback to standard catalog price
        return new ResolvedPriceResultDto(
            ProductId: product.Id,
            ProductSku: product.Sku,
            ProductName: product.Name,
            StandardPrice: product.SellingPrice,
            ResolvedUnitPrice: product.SellingPrice,
            PriceSource: "STANDARD",
            PriceListId: null,
            PriceListName: null,
            AppliedDiscountPercent: 0
        );
    }

    // Product Bundles / Kits
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

    public async Task<ApiResponse<ProductBundleDto>> SaveBundleAsync(SaveProductBundleRequest request)
    {
        var parent = await _context.Products
            .Include(p => p.BundleComponents)
            .FirstOrDefaultAsync(p => p.Id == request.ParentProductId);

        if (parent == null)
        {
            return ApiResponse<ProductBundleDto>.Fail("ERR_PRODUCT_NOT_FOUND", "PRICING");
        }

        parent.IsBundle = true;
        parent.BundleComponents.Clear();

        foreach (var c in request.Components)
        {
            if (c.ComponentProductId == parent.Id)
            {
                return ApiResponse<ProductBundleDto>.Fail("ERR_CIRCULAR_BUNDLE_REFERENCE", "PRICING");
            }

            var comp = await _context.Products.FindAsync(c.ComponentProductId);
            if (comp == null)
            {
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

        await _context.SaveChangesAsync();

        var dto = await GetBundleByProductIdAsync(parent.Id);
        return ApiResponse<ProductBundleDto>.Ok(dto!);
    }
}
