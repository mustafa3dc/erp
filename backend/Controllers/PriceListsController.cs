using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/price-lists")]
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
    // Price Lists Management
    // =========================================================================

    [HttpGet]
    [HasPermission(Permissions.Sales.PriceListsView)]
    public async Task<ActionResult<ApiResponse<List<PriceListDto>>>> GetPriceLists()
    {
        var list = await _priceListService.GetPriceListsAsync();
        return Ok(ApiResponse<List<PriceListDto>>.Ok(list));
    }

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.Sales.PriceListsView)]
    public async Task<ActionResult<ApiResponse<PriceListDetailDto>>> GetPriceListById(Guid id)
    {
        var pl = await _priceListService.GetPriceListByIdAsync(id);
        if (pl == null)
        {
            return NotFound(ApiResponse<PriceListDetailDto>.Fail("ERR_PRICE_LIST_NOT_FOUND", "PRICING"));
        }
        return Ok(ApiResponse<PriceListDetailDto>.Ok(pl));
    }

    [HttpPost]
    [HasPermission(Permissions.Sales.PriceListsManage)]
    public async Task<ActionResult<ApiResponse<PriceListDto>>> CreatePriceList([FromBody] CreatePriceListRequest request)
    {
        var result = await _priceListService.CreatePriceListAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return CreatedAtAction(nameof(GetPriceListById), new { id = result.Data!.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Sales.PriceListsManage)]
    public async Task<ActionResult<ApiResponse<PriceListDto>>> UpdatePriceList(Guid id, [FromBody] UpdatePriceListRequest request)
    {
        var result = await _priceListService.UpdatePriceListAsync(id, request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    [HasPermission(Permissions.Sales.PriceListsManage)]
    public async Task<ActionResult<ApiResponse<bool>>> DeletePriceList(Guid id)
    {
        var result = await _priceListService.DeletePriceListAsync(id);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    // =========================================================================
    // Price List Tier Items
    // =========================================================================

    [HttpPost("{id:guid}/items")]
    [HasPermission(Permissions.Sales.PriceListsManage)]
    public async Task<ActionResult<ApiResponse<PriceListItemDto>>> SaveItemTier(Guid id, [FromBody] SavePriceListItemInputDto input)
    {
        var result = await _priceListService.SavePriceListItemAsync(id, input);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    [HasPermission(Permissions.Sales.PriceListsManage)]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteItemTier(Guid id, Guid itemId)
    {
        var result = await _priceListService.DeletePriceListItemAsync(id, itemId);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    // =========================================================================
    // Customer Linking & Price Resolution
    // =========================================================================

    [HttpPost("assign-customer")]
    [HasPermission(Permissions.Sales.CustomersManage)]
    public async Task<ActionResult<ApiResponse<bool>>> AssignPriceListToCustomer([FromBody] AssignCustomerPriceListRequest request)
    {
        var result = await _priceListService.AssignPriceListToCustomerAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("resolve-price")]
    [HasPermission(Permissions.Sales.PriceListsView)]
    public async Task<ActionResult<ApiResponse<ResolvedPriceResultDto>>> ResolvePrice([FromBody] ResolveProductPriceRequest request)
    {
        try
        {
            var resolved = await _priceListService.ResolvePriceAsync(request);
            return Ok(ApiResponse<ResolvedPriceResultDto>.Ok(resolved));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<ResolvedPriceResultDto>.Fail("ERR_PRODUCT_NOT_FOUND", "PRICING"));
        }
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
        var result = await _priceListService.SaveBundleAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }
}
