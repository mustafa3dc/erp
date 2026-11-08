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
}

