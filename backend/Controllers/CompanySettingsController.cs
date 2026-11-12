using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/company/settings")]
[Route("api/v1/company/settings")]
public class CompanySettingsController : ControllerBase
{
    private readonly ITenantFeatureService _featureService;
    private readonly ILogger<CompanySettingsController> _logger;

    public CompanySettingsController(
        ITenantFeatureService featureService,
        ILogger<CompanySettingsController> logger)
    {
        _featureService = featureService;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/company/settings
    /// Retrieves full tenant configuration, business industry preset, and all 10 feature flags.
    /// Used by Next.js frontend to apply dynamic UI gating.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<CompanySettingsResponseDto>>> GetSettings(CancellationToken ct)
    {
        var tenantIdStr = User.FindFirst("tenant_id")?.Value 
            ?? User.FindFirst("TenantId")?.Value 
            ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();

        var tenantSlug = User.FindFirst("tenant_slug")?.Value 
            ?? Request.Headers["X-Tenant-Slug"].FirstOrDefault();

        if (Guid.TryParse(tenantIdStr, out var tenantId))
        {
            var settings = await _featureService.GetCompanySettingsAsync(tenantId, ct);
            if (settings != null)
            {
                return Ok(ApiResponse<CompanySettingsResponseDto>.Ok(settings));
            }
        }

        // In-Memory Fallback if slug provided (demo accounts)
        var matched = AuthController.GetTenantRecordBySlug(tenantSlug ?? "m");
        if (matched != null)
        {
            var demoSettings = new CompanySettingsResponseDto
            {
                TenantId = Guid.TryParse(matched.Id, out var parsed) ? parsed : Guid.NewGuid(),
                TenantName = matched.Name,
                TenantSlug = matched.Slug,
                CountryCode = matched.CountryCode,
                Currency = matched.Currency,
                Plan = matched.Plan,
                BusinessPreset = matched.BusinessPreset,
                BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(matched.BusinessPreset),
                Features = matched.Features,
                MaxBranches = matched.MaxBranches,
                MaxUsers = matched.MaxUsers,
                IsActive = matched.IsActive
            };
            return Ok(ApiResponse<CompanySettingsResponseDto>.Ok(demoSettings));
        }

        return NotFound(ApiResponse<CompanySettingsResponseDto>.Fail("ERR_TENANT_NOT_FOUND", "TENANT"));
    }

    /// <summary>
    /// PUT /api/company/settings
    /// Updates tenant settings and feature flags (such as enableBarcodeScales).
    /// Saves to PostgreSQL and immediately invalidates/refreshes Redis cache (tenant:{tenantId}:features).
    /// </summary>
    [HttpPut]
    public async Task<ActionResult<ApiResponse<CompanySettingsResponseDto>>> UpdateSettings([FromBody] UpdateFeaturesRequestDto request, CancellationToken ct)
    {
        var tenantIdStr = User.FindFirst("tenant_id")?.Value 
            ?? User.FindFirst("TenantId")?.Value 
            ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();

        var tenantSlug = User.FindFirst("tenant_slug")?.Value 
            ?? Request.Headers["X-Tenant-Slug"].FirstOrDefault();

        if (Guid.TryParse(tenantIdStr, out var tenantId))
        {
            var updatedFeatures = await _featureService.UpdateFeaturesAsync(tenantId, request, ct);
            var freshSettings = await _featureService.GetCompanySettingsAsync(tenantId, ct);
            if (freshSettings != null)
            {
                if (!string.IsNullOrEmpty(tenantSlug))
                {
                    AuthController.UpdateTenantFeaturesInMemory(tenantSlug, updatedFeatures.BusinessPreset, updatedFeatures.Features);
                }
                return Ok(ApiResponse<CompanySettingsResponseDto>.Ok(freshSettings));
            }
        }

        // Demo / in-memory tenant update
        var matched = AuthController.GetTenantRecordBySlug(tenantSlug ?? "m");
        if (matched != null)
        {
            var features = matched.Features.Clone();
            if (request.EnableBarcodeScales.HasValue) features.EnableBarcodeScales = request.EnableBarcodeScales.Value;
            if (request.EnablePOS.HasValue) features.EnablePOS = request.EnablePOS.Value;
            if (request.MultiWarehouse.HasValue) features.MultiWarehouse = request.MultiWarehouse.Value;
            if (request.EnableInstallments.HasValue) features.EnableInstallments = request.EnableInstallments.Value;
            if (request.EnableSerialNumbers.HasValue) features.EnableSerialNumbers = request.EnableSerialNumbers.Value;
            if (request.EnableVariants.HasValue) features.EnableVariants = request.EnableVariants.Value;
            if (request.EnableMultiCurrency.HasValue) features.EnableMultiCurrency = request.EnableMultiCurrency.Value;
            if (request.EnableCreditLimits.HasValue) features.EnableCreditLimits = request.EnableCreditLimits.Value;
            if (request.EnableExpiryDates.HasValue) features.EnableExpiryDates = request.EnableExpiryDates.Value;

            matched.Features = features;
            AuthController.UpdateTenantFeaturesInMemory(matched.Slug, matched.BusinessPreset, features);

            var demoSettings = new CompanySettingsResponseDto
            {
                TenantId = Guid.TryParse(matched.Id, out var parsed) ? parsed : Guid.NewGuid(),
                TenantName = matched.Name,
                TenantSlug = matched.Slug,
                CountryCode = matched.CountryCode,
                Currency = matched.Currency,
                Plan = matched.Plan,
                BusinessPreset = matched.BusinessPreset,
                BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(matched.BusinessPreset),
                Features = matched.Features,
                MaxBranches = matched.MaxBranches,
                MaxUsers = matched.MaxUsers,
                IsActive = matched.IsActive
            };
            return Ok(ApiResponse<CompanySettingsResponseDto>.Ok(demoSettings));
        }

        return NotFound(ApiResponse<CompanySettingsResponseDto>.Fail("ERR_TENANT_NOT_FOUND", "TENANT"));
    }
}

