using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Authorization;

/// <summary>
/// Custom Authorization Filter that enforces Granular Permission-Based Access Control (PBAC).
/// Checks token claims for the required permission and returns structured 403 Forbidden on failure.
/// </summary>
public class PermissionAuthorizationFilter : IAsyncAuthorizationFilter
{
    private readonly string _requiredPermission;

    public PermissionAuthorizationFilter(string requiredPermission)
    {
        _requiredPermission = requiredPermission;
    }

    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        // 1. Check if user is authenticated
        if (user?.Identity == null || !user.Identity.IsAuthenticated)
        {
            context.Result = new ObjectResult(new
            {
                success = false,
                errorCode = "ERR_UNAUTHORIZED",
                message = "Authentication required to access this endpoint.",
                domain = "SECURITY",
                timestamp = DateTime.UtcNow
            })
            {
                StatusCode = StatusCodes.Status401Unauthorized
            };
            return Task.CompletedTask;
        }

        // 2. PlatformSuperAdmin and SuperAdmin bypass all granular permission restrictions
        var userRole = user.FindFirst(ClaimTypes.Role)?.Value 
            ?? user.FindFirst("role")?.Value;

        if (string.Equals(userRole, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(userRole, nameof(UserRole.PlatformSuperAdmin), StringComparison.OrdinalIgnoreCase))
        {
            return Task.CompletedTask;
        }

        // 3. Inspect user claims for the required permission
        // Permissions are injected as multiple "permissions" claims or a single combined claim
        var userPermissions = user.FindAll("permissions")
            .Select(c => c.Value)
            .Concat(user.FindAll("permission").Select(c => c.Value))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Check exact match, wildcard, or common aliases
        var hasAccess = userPermissions.Contains(_requiredPermission) ||
                        userPermissions.Contains("*") ||
                        userPermissions.Contains("all");

        // Supporting legacy alias cross-checks
        if (!hasAccess)
        {
            hasAccess = CheckPermissionAliases(_requiredPermission, userPermissions);
        }

        if (!hasAccess)
        {
            context.Result = new ObjectResult(new
            {
                success = false,
                errorCode = "ERR_FORBIDDEN_PERMISSION_DENIED",
                message = "Access denied. Missing required permission.",
                domain = "SECURITY",
                @params = new Dictionary<string, object>
                {
                    ["requiredPermission"] = _requiredPermission,
                    ["userRole"] = userRole ?? "Unknown"
                },
                timestamp = DateTime.UtcNow
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        return Task.CompletedTask;
    }

    private static bool CheckPermissionAliases(string required, HashSet<string> userPerms)
    {
        // Support cross-version legacy and simplified keys
        return required switch
        {
            "pos.terminal.access" => userPerms.Contains("Permissions.Pos.Terminal.Access") || userPerms.Contains("pos.terminal"),
            "inventory.items.view" => userPerms.Contains("inventory.view") || userPerms.Contains("Permissions.Inventory.View"),
            "inventory.items.create" or "inventory.items.edit" => userPerms.Contains("inventory.manage") || userPerms.Contains("Permissions.Inventory.Manage"),
            "inventory.items.delete" => userPerms.Contains("inventory.manage") || userPerms.Contains("Permissions.Inventory.Manage"),
            "inventory.cost_price.view" => userPerms.Contains("Permissions.Inventory.CostPrice.View"),
            "inventory.transfers.manage" => userPerms.Contains("transfers.manage") || userPerms.Contains("Permissions.Transfers.Manage"),
            "inventory.stock_counts.manage" => userPerms.Contains("stock_counts.manage") || userPerms.Contains("Permissions.StockCounts.Manage"),
            "sales.invoices.view" or "sales.invoices.create" => userPerms.Contains("invoices.manage") || userPerms.Contains("Permissions.Invoices.Manage"),
            "sales.returns.manage" => userPerms.Contains("returns.manage") || userPerms.Contains("Permissions.Returns.Manage"),
            "purchases.bills.view" or "purchases.bills.create" => userPerms.Contains("purchases.manage") || userPerms.Contains("Permissions.Purchases.Manage"),
            "treasury.accounts.view" => userPerms.Contains("finance.ledger") || userPerms.Contains("Permissions.Finance.Ledger"),
            "system.dashboard.view" => userPerms.Contains("dashboard.view") || userPerms.Contains("Permissions.Dashboard.View"),
            "system.audit.view" => userPerms.Contains("settings.audit") || userPerms.Contains("Permissions.Settings.Audit"),
            _ => false
        };
    }
}
