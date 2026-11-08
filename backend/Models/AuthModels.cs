global using Permissions = ERP.Warehouse.Api.Domain.Constants.Permissions;

namespace ERP.Warehouse.Api.Models;


public enum UserRole
{
    PlatformSuperAdmin,
    SuperAdmin,
    BranchManager,
    Accountant,
    Storekeeper,
    Cashier
}

public class UserProfileDto
{
    public string Id { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string RoleNameAr { get; set; } = string.Empty;
    public string RoleNameEn { get; set; } = string.Empty;
    public string? BranchId { get; set; } = null;
    public string? BranchName { get; set; } = null;
    public string? DefaultWarehouseId { get; set; } = null;
    public string TenantId { get; set; } = string.Empty;
    public string TenantSlug { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public List<string> AssignedBranches { get; set; } = new();
    public bool IsReadOnlyCatalog { get; set; }
    public List<string> PermissionsList { get; set; } = new();
    public string DefaultRoute { get; set; } = "/dashboard";
    public bool CanViewCostPrice { get; set; }
    public string? AvatarUrl { get; set; }
    public BusinessPreset BusinessPreset { get; set; } = BusinessPreset.Custom;
    public string BusinessPresetName { get; set; } = string.Empty;
    public CompanyFeatures Features { get; set; } = new();
}

public class NavigationPermissionItemDto
{
    public string Id { get; set; } = string.Empty;
    public string TitleAr { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string RequiredPermission { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string? Badge { get; set; }
    public bool IsAllowed { get; set; }
}

public class NavigationPermissionsResponseDto
{
    public UserProfileDto User { get; set; } = new();
    public List<NavigationPermissionItemDto> NavigationItems { get; set; } = new();
    public List<string> GrantedPermissions { get; set; } = new();
}

public class UserAccountDto
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string TenantSlug { get; set; } = "m";
    public string TenantName { get; set; } = "مؤسسة مصطفى للتجارة والحلول البرمجية";
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string RoleNameAr { get; set; } = string.Empty;
    public string? BranchId { get; set; } = null;
    public string? BranchName { get; set; } = null;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public string? Notes { get; set; }
    public string? AvatarUrl { get; set; }
}

public class CreateUserAccountRequestDto
{
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? TenantSlug { get; set; } = "m";
    public string Password { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Cashier;
    public string BranchId { get; set; } = "WH-01";
    public string? Notes { get; set; }
    public string? AvatarUrl { get; set; }
}

public class UpdateAvatarRequestDto
{
    public string AvatarUrl { get; set; } = string.Empty;
}

public class ResetPasswordRequestDto
{
    public string NewPassword { get; set; } = string.Empty;
}

public class LoginRequestDto
{
    public string? Identifier { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public UserRole? SimulatedRole { get; set; }
}

public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserProfileDto User { get; set; } = new();
    public List<NavigationPermissionItemDto> PermittedNavigation { get; set; } = new();
}

public class UpdateUserPermissionsRequestDto
{
    public List<string> Permissions { get; set; } = new();
}

public class UserPermissionsResponseDto
{
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public List<string> Permissions { get; set; } = new();
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class PermissionDefinitionDto
{
    public string Code { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string? DescriptionAr { get; set; }
    public string? DescriptionEn { get; set; }
}

public class PermissionMatrixGroupDto
{
    public string GroupName { get; set; } = string.Empty;
    public string TitleAr { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public List<PermissionDefinitionDto> Permissions { get; set; } = new();
}


