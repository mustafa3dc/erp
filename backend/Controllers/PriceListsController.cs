using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/quantity-tiers")]
public class PriceListsController : ControllerBase
{
    private readonly IPriceListService _priceListService;
    private readonly ILogger<PriceListsController> _logger;

    public PriceListsController(IPriceListService priceListService, ILogger<PriceListsController> logger)
    {
        _priceListService = priceListService;
        _logger = logger;
    }

    // =========================================================================
    // Direct Product Quantity Tiered Pricing
    // =========================================================================

    [HttpGet]
    [HasPermission(Permissions.Sales.PriceListsView)]
    public async Task<ActionResult<ApiResponse<List<ProductQuantityTierDto>>>> GetAllQuantityTiers()
    {
        var tiers = await _priceListService.GetAllQuantityTiersAsync();
        return Ok(ApiResponse<List<ProductQuantityTierDto>>.Ok(tiers));
    }

    [HttpGet("product/{productId:guid}")]
    [HasPermission(Permissions.Sales.PriceListsView)]
    public async Task<ActionResult<ApiResponse<List<ProductQuantityTierDto>>>> GetProductQuantityTiers(Guid productId)
    {
        var tiers = await _priceListService.GetProductQuantityTiersAsync(productId);
        return Ok(ApiResponse<List<ProductQuantityTierDto>>.Ok(tiers));
    }

    [HttpPut]
    [HttpPost]
    [HasPermission(Permissions.Sales.PriceListsManage)]
    public async Task<ActionResult<ApiResponse<List<ProductQuantityTierDto>>>> SaveProductQuantityTiers(
        [FromBody] SaveProductQuantityTiersRequest request)
    {
        var performedBy = User?.Identity?.Name;
        var result = await _priceListService.SaveProductQuantityTiersAsync(request, performedBy);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpDelete("{tierId:guid}")]
    [HasPermission(Permissions.Sales.PriceListsManage)]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteQuantityTier(Guid tierId)
    {
        var performedBy = User?.Identity?.Name;
        var result = await _priceListService.DeleteQuantityTierAsync(tierId, performedBy);
        if (!result.Success)
        {
            return NotFound(result);
        }
        return Ok(result);
    }

    [HttpGet("resolve")]
    [HasPermission(Permissions.Sales.PriceListsView)]
    public async Task<ActionResult<ApiResponse<ResolvedQuantityPriceDto>>> ResolveQuantityPrice(
        [FromQuery] Guid productId,
        [FromQuery] int quantity = 1)
    {
        var resolved = await _priceListService.ResolveQuantityPriceAsync(productId, quantity);
        if (resolved == null)
        {
            return NotFound(ApiResponse<ResolvedQuantityPriceDto>.Fail("ERR_PRODUCT_NOT_FOUND", "PRICING"));
        }
        return Ok(ApiResponse<ResolvedQuantityPriceDto>.Ok(resolved));
    }

    // =========================================================================
    // Product Bundles / Kits
    // =========================================================================

    [HttpGet("/api/bundles")]
    [HasPermission(Permissions.Inventory.ItemsView)]
    public async Task<ActionResult<ApiResponse<List<ProductBundleDto>>>> GetBundles()
    {
        var bundles = await _priceListService.GetBundlesAsync();
        return Ok(ApiResponse<List<ProductBundleDto>>.Ok(bundles));
    }

    [HttpGet("/api/bundles/{productId:guid}")]
    [HasPermission(Permissions.Inventory.ItemsView)]
    public async Task<ActionResult<ApiResponse<ProductBundleDto>>> GetBundleByProductId(Guid productId)
    {
        var bundle = await _priceListService.GetBundleByProductIdAsync(productId);
        if (bundle == null)
        {
            return NotFound(ApiResponse<ProductBundleDto>.Fail("ERR_BUNDLE_NOT_FOUND", "PRICING"));
        }
        return Ok(ApiResponse<ProductBundleDto>.Ok(bundle));
    }

    [HttpPost("/api/bundles")]
    [HasPermission(Permissions.Inventory.ItemsCreate)]
    public async Task<ActionResult<ApiResponse<ProductBundleDto>>> SaveBundle([FromBody] SaveProductBundleRequest request)
    {
        var performedBy = User?.Identity?.Name;
        var result = await _priceListService.SaveBundleAsync(request, performedBy);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpDelete("/api/bundles/{productId:guid}")]
    [HasPermission(Permissions.Inventory.ItemsDelete)]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteBundle(Guid productId)
    {
        var performedBy = User?.Identity?.Name;
        var result = await _priceListService.DeleteBundleAsync(parentProductId: productId, performedBy: performedBy);
        if (!result.Success)
        {
            return NotFound(result);
        }
        return Ok(result);
    }
}
