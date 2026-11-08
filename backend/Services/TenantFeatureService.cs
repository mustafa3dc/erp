using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface ITenantFeatureService
{
    Task<TenantFeaturesResponseDto?> GetTenantFeaturesAsync(Guid tenantId, CancellationToken ct = default);
    Task<TenantFeaturesResponseDto> ApplyPresetAsync(Guid tenantId, BusinessPreset preset, CancellationToken ct = default);
    Task<TenantFeaturesResponseDto> UpdateFeaturesAsync(Guid tenantId, UpdateFeaturesRequestDto request, CancellationToken ct = default);
    Task<CompanySettingsResponseDto?> GetCompanySettingsAsync(Guid tenantId, CancellationToken ct = default);
    Task CacheFeaturesInRedisAsync(Guid tenantId, CompanyFeatures features, CancellationToken ct = default);
}

public class TenantFeatureService : ITenantFeatureService
{
    private readonly AppDbContext _context;
    private readonly IConnectionMultiplexer? _redis;
    private readonly IDatabase? _cache;
    private readonly ILogger<TenantFeatureService> _logger;

    public TenantFeatureService(
        AppDbContext context,
        ILogger<TenantFeatureService> logger,
        IConnectionMultiplexer? redis = null)
    {
        _context = context;
        _logger = logger;
        _redis = redis;
        if (_redis != null)
        {
            try
            {
                _cache = _redis.GetDatabase();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to connect to Redis cache database. Continuing with database fallback.");
            }
        }
    }

    public async Task<TenantFeaturesResponseDto?> GetTenantFeaturesAsync(Guid tenantId, CancellationToken ct = default)
    {
        // 1. Try Redis cache first
        var cacheKey = $"tenant:{tenantId}:features";
        if (_cache != null)
        {
            try
            {
                var cachedJson = await _cache.StringGetAsync(cacheKey);
                if (!cachedJson.IsNullOrEmpty)
                {
                    var cachedFeatures = JsonSerializer.Deserialize<CompanyFeatures>((string)cachedJson!);
                    if (cachedFeatures != null)
                    {
                        var tenantInfo = await _context.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
                        return new TenantFeaturesResponseDto
                        {
                            TenantId = tenantId,
                            TenantSlug = tenantInfo?.Slug ?? string.Empty,
                            TenantName = tenantInfo?.Name ?? string.Empty,
                            BusinessPreset = tenantInfo?.BusinessPreset ?? BusinessPreset.Custom,
                            BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(tenantInfo?.BusinessPreset ?? BusinessPreset.Custom),
                            Features = cachedFeatures,
                            UpdatedAt = tenantInfo?.UpdatedAt ?? DateTime.UtcNow
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error reading tenant features from Redis cache for {TenantId}", tenantId);
            }
        }

        // 2. Fetch from PostgreSQL
        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null)
        {
            return null;
        }

        var features = tenant.Features ?? BusinessPresetFactory.CreateFeatures(tenant.BusinessPreset);

        // 3. Populate Redis Cache
        await CacheFeaturesInRedisAsync(tenantId, features, ct);

        return new TenantFeaturesResponseDto
        {
            TenantId = tenant.Id,
            TenantSlug = tenant.Slug,
            TenantName = tenant.Name,
            BusinessPreset = tenant.BusinessPreset,
            BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(tenant.BusinessPreset),
            Features = features,
            UpdatedAt = tenant.UpdatedAt
        };
    }

    public async Task<TenantFeaturesResponseDto> ApplyPresetAsync(Guid tenantId, BusinessPreset preset, CancellationToken ct = default)
    {
        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null)
        {
            throw new KeyNotFoundException($"ERR_TENANT_NOT_FOUND: المنشأة رقم {tenantId} غير موجودة في قاعدة البيانات.");
        }

        // Apply Preset blueprint
        BusinessPresetFactory.ApplyPreset(tenant, preset);
        tenant.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        // Update Redis cache immediately
        await CacheFeaturesInRedisAsync(tenantId, tenant.Features, ct);

        return new TenantFeaturesResponseDto
        {
            TenantId = tenant.Id,
            TenantSlug = tenant.Slug,
            TenantName = tenant.Name,
            BusinessPreset = tenant.BusinessPreset,
            BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(tenant.BusinessPreset),
            Features = tenant.Features,
            UpdatedAt = tenant.UpdatedAt
        };
    }

    public async Task<TenantFeaturesResponseDto> UpdateFeaturesAsync(Guid tenantId, UpdateFeaturesRequestDto request, CancellationToken ct = default)
    {
        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null)
        {
            throw new KeyNotFoundException($"ERR_TENANT_NOT_FOUND: المنشأة رقم {tenantId} غير موجودة في قاعدة البيانات.");
        }

        var currentFeatures = tenant.Features ?? BusinessPresetFactory.CreateFeatures(tenant.BusinessPreset);

        // Apply customized feature flags
        if (request.EnablePOS.HasValue) currentFeatures.EnablePOS = request.EnablePOS.Value;
        if (request.MultiWarehouse.HasValue) currentFeatures.MultiWarehouse = request.MultiWarehouse.Value;
        if (request.MaxWarehouses.HasValue) currentFeatures.MaxWarehouses = Math.Max(1, request.MaxWarehouses.Value);
        if (request.EnableInstallments.HasValue) currentFeatures.EnableInstallments = request.EnableInstallments.Value;
        if (request.EnableSerialNumbers.HasValue) currentFeatures.EnableSerialNumbers = request.EnableSerialNumbers.Value;
        if (request.EnableVariants.HasValue) currentFeatures.EnableVariants = request.EnableVariants.Value;
        if (request.EnableMultiCurrency.HasValue) currentFeatures.EnableMultiCurrency = request.EnableMultiCurrency.Value;
        if (request.EnableCreditLimits.HasValue) currentFeatures.EnableCreditLimits = request.EnableCreditLimits.Value;
        if (request.EnableBarcodeScales.HasValue) currentFeatures.EnableBarcodeScales = request.EnableBarcodeScales.Value;
        if (request.EnableExpiryDates.HasValue) currentFeatures.EnableExpiryDates = request.EnableExpiryDates.Value;

        tenant.BusinessPreset = BusinessPreset.Custom;
        tenant.Features = currentFeatures;
        tenant.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        // Update Redis cache immediately
        await CacheFeaturesInRedisAsync(tenantId, currentFeatures, ct);

        return new TenantFeaturesResponseDto
        {
            TenantId = tenant.Id,
            TenantSlug = tenant.Slug,
            TenantName = tenant.Name,
            BusinessPreset = tenant.BusinessPreset,
            BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(tenant.BusinessPreset),
            Features = tenant.Features,
            UpdatedAt = tenant.UpdatedAt
        };
    }

    public async Task<CompanySettingsResponseDto?> GetCompanySettingsAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _context.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null)
        {
            return null;
        }

        var features = tenant.Features ?? BusinessPresetFactory.CreateFeatures(tenant.BusinessPreset);

        return new CompanySettingsResponseDto
        {
            TenantId = tenant.Id,
            TenantName = tenant.Name,
            TenantSlug = tenant.Slug,
            CountryCode = tenant.CountryCode,
            Currency = tenant.Currency,
            Plan = tenant.Plan,
            BusinessPreset = tenant.BusinessPreset,
            BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(tenant.BusinessPreset),
            Features = features,
            MaxBranches = tenant.MaxBranches,
            MaxUsers = tenant.MaxUsers,
            IsActive = tenant.IsActive
        };
    }

    public async Task CacheFeaturesInRedisAsync(Guid tenantId, CompanyFeatures features, CancellationToken ct = default)
    {
        if (_cache == null) return;

        try
        {
            var cacheKey = $"tenant:{tenantId}:features";
            var serialized = JsonSerializer.Serialize(features);
            await _cache.StringSetAsync(cacheKey, serialized, TimeSpan.FromDays(7));
            _logger.LogInformation("Successfully updated Redis cache for {CacheKey}", cacheKey);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to set Redis cache for tenant {TenantId}", tenantId);
        }
    }
}

