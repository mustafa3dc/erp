using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Domain.Common;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace ERP.Warehouse.Api.Application.Auth.Commands;

public sealed record LoginCommand(
    string Identifier,
    string Password
);

public sealed class LoginCommandHandler
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;

    public LoginCommandHandler(AppDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public async Task<LoginResponseDto> Handle(LoginCommand request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Identifier))
        {
            throw new ValidationException("يرجى إدخال اسم المستخدم ورمز الشركة");
        }

        var input = request.Identifier.Trim();

        // 1. استثناء حساب مالك المنصة (Platform Super Admin)
        if (input.Equals("superadmin", StringComparison.OrdinalIgnoreCase) || 
            input.Equals("superadmin@platform", StringComparison.OrdinalIgnoreCase))
        {
            var platformUser = await _context.Users.FirstOrDefaultAsync(u => 
                u.TenantId == null && 
                u.Username.ToLower() == "superadmin", ct);

            // Fallback for initial setup if not yet seeded in database
            if (platformUser != null && !PasswordHasher.Verify(request.Password, platformUser.PasswordHash))
            {
                throw new AuthenticationException("كلمة مرور مسؤول المنصة غير صحيحة.");
            }
            else if (platformUser == null && request.Password != "123")
            {
                throw new AuthenticationException("بيانات حساب مسؤول المنصة غير صحيحة.");
            }

            var superAdminProfile = new UserProfileDto
            {
                Id = platformUser?.Id.ToString() ?? "00000000-0000-0000-0000-000000000001",
                Username = "superadmin",
                FullName = platformUser?.FullName ?? "المدير العام للمنصة (SaaS Platform Owner)",
                Email = platformUser?.Email ?? "owner@zilox.cloud",
                Role = UserRole.PlatformSuperAdmin,
                RoleNameAr = "مالك المنصة (SaaS Super Admin)",
                RoleNameEn = "Platform Super Admin",
                BranchId = "PLATFORM",
                BranchName = "SaaS Platform Control Plane",
                DefaultWarehouseId = "PLATFORM",
                TenantId = string.Empty,
                TenantSlug = string.Empty,
                TenantName = "ZiloX SaaS Control Plane",
                AssignedBranches = new List<string>(),
                PermissionsList = new List<string> { "Permissions.Platform.ControlPlane" },
                DefaultRoute = "/super-admin/tenants",
                CanViewCostPrice = false,
                IsReadOnlyCatalog = true,
                BusinessPreset = BusinessPreset.Custom,
                BusinessPresetName = "لوحة تحكم المنصة",
                Features = new CompanyFeatures
                {
                    EnablePOS = true,
                    MultiWarehouse = true,
                    MaxWarehouses = 99,
                    EnableInstallments = true,
                    EnableSerialNumbers = true,
                    EnableVariants = true,
                    EnableMultiCurrency = true,
                    EnableCreditLimits = true,
                    EnableBarcodeScales = true,
                    EnableExpiryDates = true
                }
            };

            var platformToken = GeneratePlatformJwtToken(platformUser?.Id.ToString() ?? "00000000-0000-0000-0000-000000000001");

            return new LoginResponseDto
            {
                Token = platformToken,
                ExpiresAt = DateTime.UtcNow.AddHours(12),
                User = superAdminProfile,
                PermittedNavigation = new List<NavigationPermissionItemDto>()
            };
        }

        // 2. حسابات موظفي المنشآت (Tenant-Scoped Identity: username@slug)
        string username;
        string tenantSlug;

        if (input.Contains('@'))
        {
            var parts = input.Split('@');
            username = parts[0].Trim().ToLower();
            tenantSlug = parts[1].Trim().ToLower();

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(tenantSlug))
            {
                throw new ValidationException("صيغة اسم المستخدم غير صحيحة. يجب كتابة: اسم_المستخدم@رمز_الشركة (مثال: mustafa@m)");
            }
        }
        else
        {
            throw new ValidationException("صيغة اسم المستخدم غير صحيحة. يجب كتابة: اسم_المستخدم@رمز_الشركة (مثال: mustafa@m)");
        }

        // جلب المنشأة عبر الـ Slug والتحقق من حالة الاشتراك
        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Slug.ToLower() == tenantSlug, ct);
        if (tenant == null)
        {
            throw new AuthenticationException("رمز المنشأة غير مسجل في النظام.");
        }

        if (!tenant.IsActive)
        {
            throw new AuthenticationException("تم تعليق اشتراك هذه المنشأة من قِبل إدارة المنصة. يرجى مراجعة الدعم الفني.");
        }

        if (tenant.ExpiresAt.HasValue && tenant.ExpiresAt.Value < DateTime.UtcNow)
        {
            throw new AuthenticationException("انتهت صلاحية اشتراك هذه المنشأة. يرجى تجديد الاشتراك للمتابعة.");
        }

        // جلب الموظف داخل نطاق المنشأة حصراً
        var user = await _context.Users.FirstOrDefaultAsync(u => 
            u.TenantId == tenant.Id && 
            u.Username.ToLower() == username, ct);

        if (user == null || !PasswordHasher.Verify(request.Password, user.PasswordHash))
        {
            throw new AuthenticationException("اسم المستخدم أو كلمة المرور غير صحيحة.");
        }

        if (!user.IsActive)
        {
            throw new AuthenticationException("هذا الحساب معطل من قِبل إدارة المنشأة.");
        }

        // Update Last Login timestamp
        user.LastLoginAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        // Fetch granular permissions assigned in database
        var dbPermissions = await _context.UserPermissions
            .Where(up => up.UserId == user.Id)
            .Select(up => up.PermissionCode)
            .ToListAsync(ct);

        var effectivePermissions = dbPermissions != null && dbPermissions.Count > 0
            ? dbPermissions
            : GetRolePermissions(user.Role);

        // إصدار توكن JWT يحمل TenantId و UserId والصلاحيات الدقيقة تلقائياً
        var userProfile = new UserProfileDto
        {
            Id = user.Id.ToString(),
            Username = $"{user.Username}@{tenant.Slug}",
            FullName = user.FullName,
            Email = user.Email ?? $"{user.Username}@{tenant.Slug}.zilox.com",
            Role = user.Role,
            RoleNameAr = GetRoleArabicName(user.Role),
            RoleNameEn = user.Role.ToString(),
            BranchId = user.BranchId,
            BranchName = user.BranchId == "ALL" ? "كافة الفروع والمستودعات" : $"فرع {user.BranchId}",
            DefaultWarehouseId = user.DefaultWarehouseId,
            TenantId = tenant.Id.ToString(),
            TenantSlug = tenant.Slug,
            TenantName = tenant.Name,
            AssignedBranches = user.BranchId == "ALL" ? new List<string> { "WH-01", "WH-02" } : new List<string> { user.BranchId },
            PermissionsList = effectivePermissions,
            DefaultRoute = GetDefaultRoute(user.Role),
            CanViewCostPrice = effectivePermissions.Contains(Permissions.Inventory.CostPriceView) || 
                               user.Role == UserRole.SuperAdmin || 
                               user.Role == UserRole.BranchManager || 
                               user.Role == UserRole.Accountant,
            IsReadOnlyCatalog = user.Role == UserRole.Cashier && !effectivePermissions.Contains(Permissions.Inventory.ItemsCreate),
            BusinessPreset = tenant.BusinessPreset,
            BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(tenant.BusinessPreset),
            Features = tenant.Features ?? BusinessPresetFactory.CreateFeatures(tenant.BusinessPreset)
        };

        var token = GenerateJwtToken(user, tenant, effectivePermissions);

        return new LoginResponseDto
        {
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddHours(8),
            User = userProfile,
            PermittedNavigation = new List<NavigationPermissionItemDto>()
        };
    }

    private string GeneratePlatformJwtToken(string userId)
    {
        var secretKey = _configuration["Jwt:Key"] ?? "ZiloxWarehouseSecureKey2026EnterpriseSuperSecretMustBe32Bytes!";
        var issuer = _configuration["Jwt:Issuer"] ?? "ZiloxWarehouseApi";
        var audience = _configuration["Jwt:Audience"] ?? "ZiloxWarehouseClient";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new("username", "superadmin"),
            new(ClaimTypes.Name, "المدير العام للمنصة"),
            new(ClaimTypes.Role, "PlatformSuperAdmin"),
            new("is_platform_admin", "true"),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // Platform SuperAdmin has wildcard and full system permissions
        foreach (var perm in Permissions.GetAll())
        {
            claims.Add(new Claim("permissions", perm));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string GenerateJwtToken(User user, Tenant tenant, List<string> permissions)
    {
        var secretKey = _configuration["Jwt:Key"] ?? "ZiloxWarehouseSecureKey2026EnterpriseSuperSecretMustBe32Bytes!";
        var issuer = _configuration["Jwt:Issuer"] ?? "ZiloxWarehouseApi";
        var audience = _configuration["Jwt:Audience"] ?? "ZiloxWarehouseClient";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("tenant_id", tenant.Id.ToString()),
            new("tenant_slug", tenant.Slug),
            new("tenant_name", tenant.Name),
            new("username", $"{user.Username}@{tenant.Slug}"),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("default_warehouse_id", user.DefaultWarehouseId),
            new("branch_id", user.BranchId),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // Inject Granular Permissions array into JWT claims
        foreach (var perm in permissions)
        {
            claims.Add(new Claim("permissions", perm));
            claims.Add(new Claim("permission", perm));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }


    private static string GetRoleArabicName(UserRole role) => role switch
    {
        UserRole.PlatformSuperAdmin => "مالك المنصة",
        UserRole.SuperAdmin => "المدير العام",
        UserRole.BranchManager => "مدير الفرع",
        UserRole.Accountant => "المحاسب المالي",
        UserRole.Storekeeper => "أمين المستودع",
        UserRole.Cashier => "الكاشير وموظف البيع",
        _ => "مستخدم النظام"
    };

    private static string GetDefaultRoute(UserRole role) => role switch
    {
        UserRole.PlatformSuperAdmin => "/super-admin/tenants",
        UserRole.Cashier => "Cloud POS",
        UserRole.Storekeeper => "Inventory & Items",
        UserRole.Accountant => "Finance & Treasury",
        UserRole.BranchManager => "Dashboard",
        UserRole.SuperAdmin => "Dashboard",
        _ => "Dashboard"
    };

    private static List<string> GetRolePermissions(UserRole role) => role switch
    {
        UserRole.PlatformSuperAdmin => Permissions.GetAll().ToList(),
        UserRole.SuperAdmin => Permissions.GetAll().ToList(),
        UserRole.BranchManager => Permissions.GetBranchManagerDefaults().ToList(),
        UserRole.Accountant => Permissions.GetAccountantDefaults().ToList(),
        UserRole.Storekeeper => Permissions.GetStorekeeperDefaults().ToList(),
        UserRole.Cashier => Permissions.GetCashierDefaults().ToList(),
        _ => new List<string> { Permissions.System.DashboardView }
    };
}

