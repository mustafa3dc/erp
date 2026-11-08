namespace ERP.Warehouse.Api.Services;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;

public class TenantProvider : ITenantProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private Guid? _manualTenantId;
    private string? _manualTenantSlug;

    // Seeded/Well-known tenant slug to ID mapping for instant resolution when headers are used
    private static readonly Dictionary<string, Guid> KnownTenantSlugMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { "m", Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890") },
        { "baghdad", Guid.Parse("b2c3d4e5-f6a7-8901-bcde-f12345678901") },
        { "erbil", Guid.Parse("c3d4e5f6-a7b8-9012-cdef-123456789012") },
        { "basra", Guid.Parse("d4e5f6a7-b8c9-0123-def1-234567890123") }
    };

    public TenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid? CurrentTenantId
    {
        get
        {
            if (_manualTenantId.HasValue) return _manualTenantId.Value;

            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null) return null;

            // 1. Try JWT User Claims
            var claimTenantId = httpContext.User.FindFirst("tenant_id")?.Value 
                ?? httpContext.User.FindFirst("TenantId")?.Value;
            
            if (!string.IsNullOrWhiteSpace(claimTenantId) && Guid.TryParse(claimTenantId, out var parsedClaimId))
            {
                return parsedClaimId;
            }

            // 2. Try Request Headers (X-Tenant-Id)
            if (httpContext.Request.Headers.TryGetValue("X-Tenant-Id", out var headerTenantId))
            {
                if (Guid.TryParse(headerTenantId.ToString(), out var parsedHeaderId))
                {
                    return parsedHeaderId;
                }
            }

            // 3. Try Request Headers (X-Tenant-Slug)
            var slug = CurrentTenantSlug;
            if (!string.IsNullOrWhiteSpace(slug) && KnownTenantSlugMap.TryGetValue(slug, out var mappedId))
            {
                return mappedId;
            }

            return null;
        }
    }

    public string? CurrentTenantSlug
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(_manualTenantSlug)) return _manualTenantSlug;

            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null) return null;

            var claimSlug = httpContext.User.FindFirst("tenant_slug")?.Value
                ?? httpContext.User.FindFirst("TenantSlug")?.Value;
            
            if (!string.IsNullOrWhiteSpace(claimSlug)) return claimSlug.ToLowerInvariant();

            if (httpContext.Request.Headers.TryGetValue("X-Tenant-Slug", out var headerSlug))
            {
                var s = headerSlug.ToString().Trim().ToLowerInvariant();
                if (!string.IsNullOrEmpty(s)) return s;
            }

            return null;
        }
    }

    public bool IsPlatformSuperAdmin
    {
        get
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null) return false;

            return httpContext.User.IsInRole("PlatformSuperAdmin") 
                || httpContext.User.HasClaim(ClaimTypes.Role, "PlatformSuperAdmin")
                || httpContext.User.HasClaim("role", "PlatformSuperAdmin")
                || httpContext.Request.Headers["X-Platform-SuperAdmin"] == "true";
        }
    }

    public void SetCurrentTenant(Guid tenantId, string? tenantSlug = null)
    {
        _manualTenantId = tenantId;
        _manualTenantSlug = tenantSlug;
    }

    public static void RegisterTenantSlugMapping(string slug, Guid tenantId)
    {
        if (!string.IsNullOrWhiteSpace(slug))
        {
            KnownTenantSlugMap[slug.ToLowerInvariant()] = tenantId;
        }
    }
}
