using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/super-admin/tenants")]
[Route("api/v1/super-admin/tenants")]
public class SuperAdminTenantsController : ControllerBase
{
    private readonly ITenantFeatureService _featureService;
    private readonly ILogger<SuperAdminTenantsController> _logger;

    public SuperAdminTenantsController(
        ITenantFeatureService featureService,
        ILogger<SuperAdminTenantsController> logger)
    {
        _featureService = featureService;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/super-admin/tenants/{id}
    /// Retrieves tenant features, current preset, and operational flags.
    /// </summary>
    [HttpGet("{id}")]
    [HttpGet("{id}/features")]
    public async Task<ActionResult<ApiResponse<TenantFeaturesResponseDto>>> GetTenantFeatures([FromRoute] Guid id, CancellationToken ct)
    {
        var result = await _featureService.GetTenantFeaturesAsync(id, ct);
        if (result == null)
        {
            return NotFound(ApiResponse<TenantFeaturesResponseDto>.Fail("ERR_TENANT_NOT_FOUND", "TENANT"));
        }

        return Ok(ApiResponse<TenantFeaturesResponseDto>.Ok(result));
    }

    /// <summary>
    /// PUT /api/super-admin/tenants/{id}/preset
    /// Selects an industry business preset and applies its operational blueprint immediately.
    /// Updates database and Redis cache synchronously.
    /// </summary>
    [HttpPut("{id}/preset")]
    public async Task<ActionResult<ApiResponse<TenantFeaturesResponseDto>>> ApplyPreset(
        [FromRoute] Guid id,
        [FromBody] ApplyPresetRequestDto request,
        CancellationToken ct)
    {
        try
        {
            var result = await _featureService.ApplyPresetAsync(id, request.Preset, ct);

            // Also update in-memory AuthController SupportedTenants if present (demo resilience)
            AuthController.UpdateTenantFeaturesInMemory(id.ToString(), request.Preset, result.Features);

            return Ok(ApiResponse<TenantFeaturesResponseDto>.Ok(
                result, 
                new Dictionary<string, object>
                {
                    { "message", $"تم تطبيق باقة {BusinessPresetFactory.GetPresetArabicName(request.Preset)} بنجاح وتم تحديث الكاش الفوري." },
                    { "preset", request.Preset.ToString() }
                }
            ));
        }
        catch (KeyNotFoundException)
        {
            // If not found in DB, try in-memory demo tenant
            var inMemoryUpdated = AuthController.UpdateTenantFeaturesInMemory(id.ToString(), request.Preset, BusinessPresetFactory.CreateFeatures(request.Preset));
            if (inMemoryUpdated != null)
            {
                var dto = new TenantFeaturesResponseDto
                {
                    TenantId = id,
                    TenantName = inMemoryUpdated.Name,
                    TenantSlug = inMemoryUpdated.Slug,
                    BusinessPreset = inMemoryUpdated.BusinessPreset,
                    BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(inMemoryUpdated.BusinessPreset),
                    Features = inMemoryUpdated.Features,
                    UpdatedAt = DateTime.UtcNow
                };
                await _featureService.CacheFeaturesInRedisAsync(id, dto.Features, ct);
                return Ok(ApiResponse<TenantFeaturesResponseDto>.Ok(dto));
            }

            return NotFound(ApiResponse<TenantFeaturesResponseDto>.Fail("ERR_TENANT_NOT_FOUND", "TENANT"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed applying business preset for tenant {TenantId}", id);
            return StatusCode(500, ApiResponse<TenantFeaturesResponseDto>.Fail("ERR_SERVER_ERROR", "TENANT"));
        }
    }

    /// <summary>
    /// PUT /api/super-admin/tenants/{id}/features
    /// Customizes specific feature flags individually.
    /// Updates database and Redis cache immediately.
    /// </summary>
    [HttpPut("{id}/features")]
    public async Task<ActionResult<ApiResponse<TenantFeaturesResponseDto>>> UpdateFeatures(
        [FromRoute] Guid id,
        [FromBody] UpdateFeaturesRequestDto request,
        CancellationToken ct)
    {
        try
        {
            var result = await _featureService.UpdateFeaturesAsync(id, request, ct);

            // Also update in-memory AuthController SupportedTenants if present
            AuthController.UpdateTenantFeaturesInMemory(id.ToString(), BusinessPreset.Custom, result.Features);

            return Ok(ApiResponse<TenantFeaturesResponseDto>.Ok(
                result,
                new Dictionary<string, object>
                {
                    { "message", "تم تخصيص وحفظ مفاتيح الميزات التشغيلية للمنشأة وتحديث الكاش الفوري." }
                }
            ));
        }
        catch (KeyNotFoundException)
        {
            // Fallback for in-memory demo tenant
            var fallbackFeatures = BusinessPresetFactory.CreateFeatures(BusinessPreset.Custom);
            if (request.EnablePOS.HasValue) fallbackFeatures.EnablePOS = request.EnablePOS.Value;
            if (request.MultiWarehouse.HasValue) fallbackFeatures.MultiWarehouse = request.MultiWarehouse.Value;
            if (request.MaxWarehouses.HasValue) fallbackFeatures.MaxWarehouses = request.MaxWarehouses.Value;
            if (request.EnableInstallments.HasValue) fallbackFeatures.EnableInstallments = request.EnableInstallments.Value;
            if (request.EnableSerialNumbers.HasValue) fallbackFeatures.EnableSerialNumbers = request.EnableSerialNumbers.Value;
            if (request.EnableVariants.HasValue) fallbackFeatures.EnableVariants = request.EnableVariants.Value;
            if (request.EnableMultiCurrency.HasValue) fallbackFeatures.EnableMultiCurrency = request.EnableMultiCurrency.Value;
            if (request.EnableCreditLimits.HasValue) fallbackFeatures.EnableCreditLimits = request.EnableCreditLimits.Value;
            if (request.EnableBarcodeScales.HasValue) fallbackFeatures.EnableBarcodeScales = request.EnableBarcodeScales.Value;
            if (request.EnableExpiryDates.HasValue) fallbackFeatures.EnableExpiryDates = request.EnableExpiryDates.Value;

            var inMemoryUpdated = AuthController.UpdateTenantFeaturesInMemory(id.ToString(), BusinessPreset.Custom, fallbackFeatures);
            if (inMemoryUpdated != null)
            {
                var dto = new TenantFeaturesResponseDto
                {
                    TenantId = id,
                    TenantName = inMemoryUpdated.Name,
                    TenantSlug = inMemoryUpdated.Slug,
                    BusinessPreset = BusinessPreset.Custom,
                    BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(BusinessPreset.Custom),
                    Features = fallbackFeatures,
                    UpdatedAt = DateTime.UtcNow
                };
                await _featureService.CacheFeaturesInRedisAsync(id, dto.Features, ct);
                return Ok(ApiResponse<TenantFeaturesResponseDto>.Ok(dto));
            }

            return NotFound(ApiResponse<TenantFeaturesResponseDto>.Fail("ERR_TENANT_NOT_FOUND", "TENANT"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed updating tenant features for {TenantId}", id);
            return StatusCode(500, ApiResponse<TenantFeaturesResponseDto>.Fail("ERR_SERVER_ERROR", "TENANT"));
        }
    }

    /// <summary>
    /// GET /api/super-admin/presets
    /// Returns catalog of all available industry presets with default configurations.
    /// </summary>
    [HttpGet("/api/super-admin/presets")]
    [HttpGet("/api/v1/super-admin/presets")]
    public ActionResult<ApiResponse<List<object>>> GetPresetCatalog()
    {
        var presets = new List<object>
        {
            new
            {
                preset = BusinessPreset.Grocery.ToString(),
                nameAr = BusinessPresetFactory.GetPresetArabicName(BusinessPreset.Grocery),
                nameEn = BusinessPresetFactory.GetPresetEnglishName(BusinessPreset.Grocery),
                features = BusinessPresetFactory.CreateFeatures(BusinessPreset.Grocery)
            },
            new
            {
                preset = BusinessPreset.Electronics.ToString(),
                nameAr = BusinessPresetFactory.GetPresetArabicName(BusinessPreset.Electronics),
                nameEn = BusinessPresetFactory.GetPresetEnglishName(BusinessPreset.Electronics),
                features = BusinessPresetFactory.CreateFeatures(BusinessPreset.Electronics)
            },
            new
            {
                preset = BusinessPreset.Fashion.ToString(),
                nameAr = BusinessPresetFactory.GetPresetArabicName(BusinessPreset.Fashion),
                nameEn = BusinessPresetFactory.GetPresetEnglishName(BusinessPreset.Fashion),
                features = BusinessPresetFactory.CreateFeatures(BusinessPreset.Fashion)
            },
            new
            {
                preset = BusinessPreset.Hardware.ToString(),
                nameAr = BusinessPresetFactory.GetPresetArabicName(BusinessPreset.Hardware),
                nameEn = BusinessPresetFactory.GetPresetEnglishName(BusinessPreset.Hardware),
                features = BusinessPresetFactory.CreateFeatures(BusinessPreset.Hardware)
            },
            new
            {
                preset = BusinessPreset.Wholesale.ToString(),
                nameAr = BusinessPresetFactory.GetPresetArabicName(BusinessPreset.Wholesale),
                nameEn = BusinessPresetFactory.GetPresetEnglishName(BusinessPreset.Wholesale),
                features = BusinessPresetFactory.CreateFeatures(BusinessPreset.Wholesale)
            },
            new
            {
                preset = BusinessPreset.Custom.ToString(),
                nameAr = BusinessPresetFactory.GetPresetArabicName(BusinessPreset.Custom),
                nameEn = BusinessPresetFactory.GetPresetEnglishName(BusinessPreset.Custom),
                features = BusinessPresetFactory.CreateFeatures(BusinessPreset.Custom)
            }
        };

        return Ok(ApiResponse<List<object>>.Ok(presets));
    }
}

