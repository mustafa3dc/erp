using System.Security.Claims;
using System.Text.Json;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface IAuditLogService
{
    void QueueLog(
        string action,
        string entityName,
        string entityId,
        object? oldValues = null,
        object? newValues = null,
        Guid? tenantIdOverride = null,
        string? userIdOverride = null,
        string? usernameOverride = null);

    Task LogAndSaveAsync(
        string action,
        string entityName,
        string entityId,
        object? oldValues = null,
        object? newValues = null,
        Guid? tenantIdOverride = null,
        string? userIdOverride = null,
        string? usernameOverride = null,
        CancellationToken ct = default);
}

public class AuditLogService : IAuditLogService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly AppDbContext _context;
    private readonly ITenantProvider _tenantProvider;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuditLogService(
        AppDbContext context,
        ITenantProvider tenantProvider,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _httpContextAccessor = httpContextAccessor;
    }

    public void QueueLog(
        string action,
        string entityName,
        string entityId,
        object? oldValues = null,
        object? newValues = null,
        Guid? tenantIdOverride = null,
        string? userIdOverride = null,
        string? usernameOverride = null)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var user = httpContext?.User;

        var claimTenant = Guid.TryParse(user?.FindFirst("tenant_id")?.Value, out var parsedTenant)
            ? parsedTenant
            : (Guid?)null;
        var resolvedTenantId = tenantIdOverride ?? _tenantProvider.CurrentTenantId ?? _context.CurrentTenantId ?? claimTenant;
        var resolvedUserId = !string.IsNullOrWhiteSpace(userIdOverride)
            ? userIdOverride.Trim()
            : user?.FindFirst(ClaimTypes.NameIdentifier)?.Value
              ?? user?.FindFirst("sub")?.Value
              ?? user?.FindFirst("user_id")?.Value
              ?? user?.FindFirst(ClaimTypes.Name)?.Value
              ?? user?.FindFirst("username")?.Value
              ?? "System";

        var resolvedUsername = !string.IsNullOrWhiteSpace(usernameOverride)
            ? usernameOverride.Trim()
            : user?.FindFirst("full_name")?.Value
              ?? user?.FindFirst(ClaimTypes.Name)?.Value
              ?? user?.FindFirst("username")?.Value
              ?? resolvedUserId;

        var ipAddress = httpContext?.Connection?.RemoteIpAddress?.ToString();
        if (httpContext?.Request.Headers.TryGetValue("X-Forwarded-For", out var forwarded) == true &&
            !string.IsNullOrWhiteSpace(forwarded.ToString()))
        {
            ipAddress = forwarded.ToString().Split(',')[0].Trim();
        }
        if (ipAddress != null && ipAddress.Length > 45)
        {
            ipAddress = ipAddress[..45];
        }

        var normalizedAction = (action ?? "UPDATE").Trim().ToUpperInvariant();

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = resolvedTenantId,
            UserId = resolvedUserId.Length > 100 ? resolvedUserId[..100] : resolvedUserId,
            Username = resolvedUsername.Length > 200 ? resolvedUsername[..200] : resolvedUsername,
            Action = normalizedAction.Length > 100 ? normalizedAction[..100] : normalizedAction,
            EntityName = (entityName ?? "system").Trim(),
            EntityId = string.IsNullOrWhiteSpace(entityId) ? "-" : (entityId.Length > 100 ? entityId[..100] : entityId),
            OldValues = SerializePayload(oldValues),
            NewValues = SerializePayload(newValues),
            IpAddress = ipAddress,
            Timestamp = DateTimeOffset.UtcNow
        });
    }

    public async Task LogAndSaveAsync(
        string action,
        string entityName,
        string entityId,
        object? oldValues = null,
        object? newValues = null,
        Guid? tenantIdOverride = null,
        string? userIdOverride = null,
        string? usernameOverride = null,
        CancellationToken ct = default)
    {
        QueueLog(action, entityName, entityId, oldValues, newValues, tenantIdOverride, userIdOverride, usernameOverride);
        await _context.SaveChangesAsync(ct);
    }

    private static string? SerializePayload(object? payload)
    {
        if (payload == null) return null;
        if (payload is string s)
        {
            var trimmed = s.Trim();
            if (string.IsNullOrEmpty(trimmed)) return null;
            if ((trimmed.StartsWith('{') && trimmed.EndsWith('}')) ||
                (trimmed.StartsWith('[') && trimmed.EndsWith(']')))
            {
                return trimmed;
            }
            return JsonSerializer.Serialize(new { value = trimmed }, JsonOptions);
        }
        return JsonSerializer.Serialize(payload, JsonOptions);
    }
}
