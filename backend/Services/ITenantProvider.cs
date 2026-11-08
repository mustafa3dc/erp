namespace ERP.Warehouse.Api.Services;

public interface ITenantProvider
{
    Guid? CurrentTenantId { get; }
    string? CurrentTenantSlug { get; }
    bool IsPlatformSuperAdmin { get; }
    void SetCurrentTenant(Guid tenantId, string? tenantSlug = null);
}
