using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

public sealed record AuditLogItemDto(
    Guid Id,
    Guid? TenantId,
    string UserId,
    string UserName,
    string ActionType,
    string EntityName,
    string EntityId,
    string? OldValuesJson,
    string? NewValuesJson,
    string? IpAddress,
    DateTimeOffset CreatedAt
);

public sealed record AuditLogPageDto(
    List<AuditLogItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages,
    List<string> AvailableUsers,
    List<string> AvailableActionTypes
);

[Authorize]
[RequiresPlanFeature(PlanFeatureKeys.AuditLog)]
[ApiController]
[Route("api/audit-logs")]
[Route("api/v1/audit-logs")]
public class AuditLogsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public AuditLogsController(AppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    private bool IsOwnerOrAdmin()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (string.Equals(role, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, nameof(UserRole.PlatformSuperAdmin), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, nameof(UserRole.BranchManager), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Owner", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var perms = User.FindAll("permissions")
            .Select(c => c.Value)
            .Concat(User.FindAll("permission").Select(c => c.Value))
            .Concat(User.FindAll("Permission").Select(c => c.Value));

        return perms.Any(p =>
            string.Equals(p, Permissions.System.AuditLogView, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, "settings.audit", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, "*", StringComparison.OrdinalIgnoreCase));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<AuditLogPageDto>>> GetAuditLogs(
        [FromQuery] string? userId = null,
        [FromQuery] string? actionType = null,
        [FromQuery] string? entityName = null,
        [FromQuery] string? search = null,
        [FromQuery] DateTimeOffset? dateFrom = null,
        [FromQuery] DateTimeOffset? dateTo = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        if (!IsOwnerOrAdmin())
        {
            return StatusCode(403, ApiResponse<AuditLogPageDto>.Fail("ERR_FORBIDDEN_ACTION", "AUDIT"));
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var tenantId = _tenantProvider.CurrentTenantId ?? _context.CurrentTenantId;
        var baseQuery = _context.AuditLogs
            .AsNoTracking()
            .Where(al => !tenantId.HasValue || al.TenantId == tenantId.Value);

        var availableUsers = await baseQuery
            .Select(al => al.Username ?? al.UserId)
            .Where(u => u != null && u != "")
            .Distinct()
            .OrderBy(u => u)
            .Take(100)
            .ToListAsync(ct);

        var availableActionTypes = await baseQuery
            .Select(al => al.Action)
            .Where(a => a != null && a != "")
            .Distinct()
            .OrderBy(a => a)
            .ToListAsync(ct);

        var query = baseQuery;

        if (!string.IsNullOrWhiteSpace(userId))
        {
            var uTerm = userId.Trim().ToLower();
            query = query.Where(al =>
                al.UserId.ToLower().Contains(uTerm) ||
                (al.Username != null && al.Username.ToLower().Contains(uTerm)));
        }

        if (!string.IsNullOrWhiteSpace(actionType) && !string.Equals(actionType, "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var act = actionType.Trim().ToUpperInvariant();
            query = query.Where(al => al.Action.ToUpper() == act);
        }

        if (!string.IsNullOrWhiteSpace(entityName) && !string.Equals(entityName, "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var ent = entityName.Trim().ToLower();
            query = query.Where(al => al.EntityName.ToLower() == ent);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(al =>
                al.EntityId.ToLower().Contains(s) ||
                al.EntityName.ToLower().Contains(s) ||
                al.Action.ToLower().Contains(s) ||
                al.UserId.ToLower().Contains(s) ||
                (al.Username != null && al.Username.ToLower().Contains(s)) ||
                (al.OldValues != null && al.OldValues.ToLower().Contains(s)) ||
                (al.NewValues != null && al.NewValues.ToLower().Contains(s)));
        }

        if (dateFrom.HasValue)
        {
            var utcFrom = dateFrom.Value.ToUniversalTime();
            query = query.Where(al => al.Timestamp >= utcFrom);
        }

        if (dateTo.HasValue)
        {
            var utcTo = dateTo.Value.ToUniversalTime();
            query = query.Where(al => al.Timestamp <= utcTo);
        }

        var totalCount = await query.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling((double)totalCount / pageSize));

        var items = await query
            .OrderByDescending(al => al.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(al => new AuditLogItemDto(
                al.Id,
                al.TenantId,
                al.UserId,
                al.Username ?? al.UserId,
                al.Action,
                al.EntityName,
                al.EntityId,
                al.OldValues,
                al.NewValues,
                al.IpAddress,
                al.Timestamp))
            .ToListAsync(ct);

        var pageDto = new AuditLogPageDto(
            Items: items,
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages,
            AvailableUsers: availableUsers!,
            AvailableActionTypes: availableActionTypes);

        return Ok(ApiResponse<AuditLogPageDto>.Ok(pageDto));
    }
}
