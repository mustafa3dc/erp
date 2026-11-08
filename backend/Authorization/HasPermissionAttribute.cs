using Microsoft.AspNetCore.Mvc;

namespace ERP.Warehouse.Api.Authorization;

/// <summary>
/// Attribute to decorate Controller classes or Action methods to enforce granular permissions.
/// Usage: [HasPermission(Permissions.Inventory.ItemsDelete)]
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true, Inherited = true)]
public class HasPermissionAttribute : TypeFilterAttribute
{
    public string Permission { get; }

    public HasPermissionAttribute(string permission) : base(typeof(PermissionAuthorizationFilter))
    {
        Permission = permission;
        Arguments = new object[] { permission };
    }
}
