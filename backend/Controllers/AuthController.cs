using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;

    public AuthController(AppDbContext context)
    {
        _context = context;
    }
    private static readonly List<NavigationPermissionItemDto> FullNavigationSchema = new()
    {
        // Main Dashboard
        new() { Id = "Dashboard", TitleAr = "لوحة القيادة والمؤشرات", TitleEn = "Dashboard & Live KPIs", Path = "/dashboard", RequiredPermission = Permissions.DashboardView, Group = "main" },

        // Warehouses & Stock
        new() { Id = "Inventory & Items", TitleAr = "دليل الأصناف والباركود", TitleEn = "Item Catalog & SKU", Path = "/inventory", RequiredPermission = Permissions.InventoryView, Group = "warehouse" },
        new() { Id = "Transfers & In-Transit", TitleAr = "التحويلات وتتبع الطريق", TitleEn = "Transfers & In-Transit", Path = "/transfers", RequiredPermission = Permissions.TransfersManage, Group = "warehouse", Badge = "1" },
        new() { Id = "Stock Counts", TitleAr = "الجرد المخزني والتسويات", TitleEn = "Stock Auditing", Path = "/stock-counts", RequiredPermission = Permissions.StockCountsManage, Group = "warehouse" },

        // Retail POS & Sales
        new() { Id = "Cloud POS", TitleAr = "نقطة البيع السريعة", TitleEn = "Cloud POS Terminal", Path = "/pos", RequiredPermission = Permissions.PosTerminalAccess, Group = "sales", Badge = "POS" },
        new() { Id = "Shifts & Cash Drawer", TitleAr = "الورديات وإغلاق الصندوق", TitleEn = "Shifts & Z-Reports", Path = "/shifts", RequiredPermission = Permissions.ShiftsManage, Group = "sales", Badge = "Z" },
        new() { Id = "Invoices & Billing", TitleAr = "المبيعات وعروض الأسعار", TitleEn = "Sales Orders & Invoices", Path = "/invoices", RequiredPermission = Permissions.InvoicesManage, Group = "sales" },
        new() { Id = "Returns & Warranty", TitleAr = "المرتجعات وإدارة الضمان", TitleEn = "Returns & Warranty RMA", Path = "/returns", RequiredPermission = Permissions.ReturnsManage, Group = "sales" },

        // Logistics & Supply
        new() { Id = "Delivery & Logistics", TitleAr = "الشحن والمندوبين (COD)", TitleEn = "Delivery & Logistics", Path = "/delivery", RequiredPermission = Permissions.LogisticsDispatch, Group = "logistics", Badge = "COD" },
        new() { Id = "Purchases & POs", TitleAr = "المشتريات وأوامر الشراء", TitleEn = "Purchases & POs", Path = "/purchases", RequiredPermission = Permissions.PurchasesManage, Group = "logistics" },

        // Finance & Customers
        new() { Id = "Customers & Loyalty", TitleAr = "العملاء وبرنامج الولاء", TitleEn = "Customers & Loyalty", Path = "/customers", RequiredPermission = Permissions.CustomersManage, Group = "finance" },
        new() { Id = "Finance & Treasury", TitleAr = "الخزائن وسجل الديون", TitleEn = "Finance, Treasury & Debts", Path = "/finance", RequiredPermission = Permissions.FinanceLedger, Group = "finance" },

        // Reports & System
        new() { Id = "Reports", TitleAr = "التقارير التنفيذية", TitleEn = "Executive Reports", Path = "/reports", RequiredPermission = Permissions.ReportsExecutive, Group = "system" },
        new() { Id = "Settings", TitleAr = "الإعدادات وسجل الرقابة", TitleEn = "Settings & Audit", Path = "/settings", RequiredPermission = Permissions.SettingsAudit, Group = "system" }
    };

    [HttpGet("profile")]
    [HttpGet("me")]
    public async Task<ActionResult<UserProfileDto>> GetCurrentUserProfile()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst("sub")?.Value 
            ?? Request.Headers["X-User-Id"].FirstOrDefault();
            
        var currentTenantId = User.FindFirst("tenant_id")?.Value 
            ?? User.FindFirst("TenantId")?.Value 
            ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();
            
        var currentTenantSlug = User.FindFirst("tenant_slug")?.Value 
            ?? Request.Headers["X-Tenant-Slug"].FirstOrDefault();

        // 1. Strict Query in EF Core scoped to UserId and TenantId
        if (_context != null && !string.IsNullOrWhiteSpace(currentUserId) && Guid.TryParse(currentUserId, out var parsedUserId))
        {
            var query = _context.Users.AsNoTracking().Include(u => u.Tenant).Where(u => u.Id == parsedUserId);
            
            if (!string.IsNullOrWhiteSpace(currentTenantId) && Guid.TryParse(currentTenantId, out var parsedTenantId))
            {
                query = query.Where(u => u.TenantId == parsedTenantId);
            }

            var dbUser = await query.FirstOrDefaultAsync();
            if (dbUser != null)
            {
                var role = dbUser.Role;
                var profile = BuildUserProfile(role);
                profile.Id = dbUser.Id.ToString();
                profile.Username = dbUser.Username.Contains('@') ? dbUser.Username : $"{dbUser.Username}@{dbUser.Tenant?.Slug ?? currentTenantSlug ?? ""}";
                profile.FullName = dbUser.FullName;
                profile.Email = dbUser.Email ?? $"{dbUser.Username}@zilox.com";
                profile.Role = dbUser.Role;
                profile.BranchId = dbUser.BranchId;
                profile.BranchName = dbUser.BranchId == "ALL" ? "كافة الفروع والمستودعات" : (string.IsNullOrWhiteSpace(dbUser.BranchId) ? null : $"فرع {dbUser.BranchId}");
                profile.TenantId = dbUser.TenantId?.ToString() ?? currentTenantId ?? string.Empty;
                profile.TenantSlug = dbUser.Tenant?.Slug ?? currentTenantSlug ?? string.Empty;
                profile.TenantName = dbUser.Tenant?.Name ?? (profile.TenantSlug == "m" ? "مؤسسة مصطفى للتجارة والحلول البرمجية" : "المنشأة المسجلة");
                profile.DefaultWarehouseId = dbUser.DefaultWarehouseId;
                if (dbUser.Tenant != null)
                {
                    profile.BusinessPreset = dbUser.Tenant.BusinessPreset;
                    profile.BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(dbUser.Tenant.BusinessPreset);
                    profile.Features = dbUser.Tenant.Features ?? BusinessPresetFactory.CreateFeatures(dbUser.Tenant.BusinessPreset);
                }
                return Ok(profile);
            }
        }

        // 2. In-Memory Tenant-Scoped Accounts
        if (!string.IsNullOrWhiteSpace(currentTenantSlug))
        {
            var matched = EmployeeAccounts.FirstOrDefault(u => 
                u.TenantSlug.Equals(currentTenantSlug, StringComparison.OrdinalIgnoreCase) && 
                (u.Id == currentUserId || u.Username.Equals(currentUserId, StringComparison.OrdinalIgnoreCase) || u.Username.StartsWith(currentUserId ?? "")));
            
            if (matched != null)
            {
                var tenant = SupportedTenants.FirstOrDefault(t => t.Slug.Equals(currentTenantSlug, StringComparison.OrdinalIgnoreCase));
                var profile = BuildUserProfile(matched.Role, matched);
                profile.TenantName = tenant?.Name ?? (matched.TenantSlug == "m" ? "مؤسسة مصطفى للتجارة والحلول البرمجية" : $"منشأة {matched.TenantSlug}");
                profile.TenantSlug = matched.TenantSlug;
                if (tenant != null)
                {
                    profile.BusinessPreset = tenant.BusinessPreset;
                    profile.BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(tenant.BusinessPreset);
                    profile.Features = tenant.Features ?? BusinessPresetFactory.CreateFeatures(tenant.BusinessPreset);
                }
                return Ok(profile);
            }
        }

        // 3. Fallback from JWT Claims
        var claimRoleStr = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (Enum.TryParse<UserRole>(claimRoleStr, true, out var claimRole))
        {
            var profile = BuildUserProfile(claimRole);
            var claimName = User.FindFirst(ClaimTypes.Name)?.Value;
            var claimFullName = User.FindFirst("full_name")?.Value ?? User.FindFirst("name")?.Value;
            var claimTenantName = User.FindFirst("tenant_name")?.Value;
            if (!string.IsNullOrWhiteSpace(claimName)) profile.Username = claimName;
            if (!string.IsNullOrWhiteSpace(claimFullName)) profile.FullName = claimFullName;
            if (!string.IsNullOrWhiteSpace(currentUserId)) profile.Id = currentUserId;
            if (!string.IsNullOrWhiteSpace(currentTenantId)) profile.TenantId = currentTenantId;
            if (!string.IsNullOrWhiteSpace(currentTenantSlug)) profile.TenantSlug = currentTenantSlug;
            if (!string.IsNullOrWhiteSpace(claimTenantName)) profile.TenantName = claimTenantName;
            return Ok(profile);
        }

        return Unauthorized(new { message = "غير مصرح - لم يتم العثور على جلسة مستخدم صالحة للمنشأة الحالية" });
    }

    [HttpGet("me/navigation-permissions")]
    public async Task<ActionResult<NavigationPermissionsResponseDto>> GetNavigationPermissions([FromQuery] UserRole? role = null)
    {
        UserProfileDto userProfile;
        var profileResult = await GetCurrentUserProfile();
        if (profileResult.Result is OkObjectResult okResult && okResult.Value is UserProfileDto profileFromToken)
        {
            userProfile = profileFromToken;
        }
        else
        {
            var targetRole = role ?? UserRole.SuperAdmin;
            userProfile = BuildUserProfile(targetRole);
        }

        var permissions = userProfile.PermissionsList;

        var navItems = FullNavigationSchema.Select(item => new NavigationPermissionItemDto
        {
            Id = item.Id,
            TitleAr = item.TitleAr,
            TitleEn = item.TitleEn,
            Path = item.Path,
            RequiredPermission = item.RequiredPermission,
            Group = item.Group,
            Badge = item.Badge,
            IsAllowed = permissions.Contains(item.RequiredPermission)
        }).ToList();

        return Ok(new NavigationPermissionsResponseDto
        {
            User = userProfile,
            NavigationItems = navItems,
            GrantedPermissions = permissions
        });
    }

    // Multi-Tenant Company Registry
    public class TenantRecord
    {
        public string Id { get; set; } = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
        public string Name { get; set; } = "مؤسسة مصطفى للتجارة والحلول البرمجية";
        public string Slug { get; set; } = "m";
        public string CountryCode { get; set; } = "IQ";
        public string Currency { get; set; } = "IQD";
        public string Plan { get; set; } = "Enterprise";
        public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(90);
        public int MaxBranches { get; set; } = 10;
        public int MaxUsers { get; set; } = 30;
        public bool IsActive { get; set; } = true;
        public BusinessPreset BusinessPreset { get; set; } = BusinessPreset.Electronics;
        public CompanyFeatures Features { get; set; } = BusinessPresetFactory.CreateFeatures(BusinessPreset.Electronics);
    }

    public static TenantRecord? GetTenantRecordBySlug(string slug)
    {
        return SupportedTenants.FirstOrDefault(t => t.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
    }

    public static TenantRecord? UpdateTenantFeaturesInMemory(string idOrSlug, BusinessPreset preset, CompanyFeatures features)
    {
        var tenant = SupportedTenants.FirstOrDefault(t => 
            t.Id.Equals(idOrSlug, StringComparison.OrdinalIgnoreCase) || 
            t.Slug.Equals(idOrSlug, StringComparison.OrdinalIgnoreCase));
        if (tenant != null)
        {
            tenant.BusinessPreset = preset;
            tenant.Features = features.Clone();
        }
        return tenant;
    }

    private static readonly List<TenantRecord> SupportedTenants = new()
    {
        new() 
        { 
            Id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890", 
            Name = "مؤسسة مصطفى للتجارة والحلول البرمجية", 
            Slug = "m", 
            CountryCode = "IQ",
            Currency = "IQD",
            Plan = "Enterprise",
            ExpiresAt = DateTime.UtcNow.AddDays(120),
            MaxBranches = 10,
            MaxUsers = 30,
            IsActive = true,
            BusinessPreset = BusinessPreset.Electronics,
            Features = BusinessPresetFactory.CreateFeatures(BusinessPreset.Electronics)
        },
        new() 
        { 
            Id = "b2c3d4e5-f6a7-8901-bcde-f12345678901", 
            Name = "شركة بغداد للتجارة والتوكيلات", 
            Slug = "baghdad", 
            CountryCode = "IQ",
            Currency = "IQD",
            Plan = "Enterprise",
            ExpiresAt = DateTime.UtcNow.AddDays(180),
            MaxBranches = 10,
            MaxUsers = 50,
            IsActive = true,
            BusinessPreset = BusinessPreset.Wholesale,
            Features = BusinessPresetFactory.CreateFeatures(BusinessPreset.Wholesale)
        },
        new() 
        { 
            Id = "c3d4e5f6-a7b8-9012-cdef-123456789012", 
            Name = "مجموعة أربيل للتوريدات العامة", 
            Slug = "erbil", 
            CountryCode = "IQ",
            Currency = "USD",
            Plan = "Pro",
            ExpiresAt = DateTime.UtcNow.AddDays(5), // Expiring in 5 days
            MaxBranches = 3,
            MaxUsers = 15,
            IsActive = true,
            BusinessPreset = BusinessPreset.Grocery,
            Features = BusinessPresetFactory.CreateFeatures(BusinessPreset.Grocery)
        },
        new() 
        { 
            Id = "d4e5f6a7-b8c9-0123-def1-234567890123", 
            Name = "شركة البصرة للخدمات اللوجستية (معلقة)", 
            Slug = "basra", 
            CountryCode = "IQ",
            Currency = "IQD",
            Plan = "Starter",
            ExpiresAt = DateTime.UtcNow.AddDays(-2),
            MaxBranches = 1,
            MaxUsers = 5,
            IsActive = false, // Kill Switch suspended
            BusinessPreset = BusinessPreset.Hardware,
            Features = BusinessPresetFactory.CreateFeatures(BusinessPreset.Hardware)
        }
    };

    // Multi-tenant Scoped Employee Accounts Store
    private static readonly List<UserAccountRecord> EmployeeAccounts = new()
    {
        new()
        {
            Id = "USR-MUSTAFA-01",
            FullName = "مصطفى قاسم (المدير العام)",
            Username = "mustafa@m",
            TenantSlug = "m",
            TenantName = "مؤسسة مصطفى للتجارة والحلول البرمجية",
            DefaultWarehouseId = "WH-01",
            PasswordHash = "123",
            Email = "mustafa@m.zilox.com",
            Phone = "+964 770 123 4567",
            Role = UserRole.SuperAdmin,
            BranchId = "ALL",
            BranchName = "كافة الفروع والمستودعات",
            IsActive = true,
            CreatedAt = new DateTime(2026, 1, 1),
            Notes = "مالك النظام والمخول الرئيسي بكافة الصلاحيات"
        },
        new()
        {
            Id = "USR-ADMIN-01",
            FullName = "المدير العام للمنظومة",
            Username = "admin@m",
            TenantSlug = "m",
            TenantName = "مؤسسة مصطفى للتجارة والحلول البرمجية",
            DefaultWarehouseId = "WH-01",
            PasswordHash = "admin123",
            Email = "admin@m.zilox.com",
            Phone = "+964 770 123 4567",
            Role = UserRole.SuperAdmin,
            BranchId = "ALL",
            BranchName = "كافة الفروع والمستودعات",
            IsActive = true,
            CreatedAt = new DateTime(2026, 1, 1),
            Notes = "حساب الإدارة العامة المركزي"
        },
        new()
        {
            Id = "USR-MGR-01",
            FullName = "مدير الفرع",
            Username = "manager@m",
            TenantSlug = "m",
            TenantName = "مؤسسة مصطفى للتجارة والحلول البرمجية",
            DefaultWarehouseId = null,
            PasswordHash = "mgr123",
            Email = "manager@m.zilox.com",
            Phone = "+964 771 234 5678",
            Role = UserRole.BranchManager,
            BranchId = null,
            BranchName = null,
            IsActive = true,
            CreatedAt = new DateTime(2026, 1, 10),
            Notes = "إدارة عمليات الفرع وصالة المبيعات"
        },
        new()
        {
            Id = "USR-ACC-01",
            FullName = "ضرغام خليل (المحاسب المالي)",
            Username = "accountant@m",
            TenantSlug = "m",
            TenantName = "مؤسسة مصطفى للتجارة والحلول البرمجية",
            DefaultWarehouseId = null,
            PasswordHash = "acc123",
            Email = "finance@m.zilox.com",
            Phone = "+964 780 345 6789",
            Role = UserRole.Accountant,
            BranchId = null,
            BranchName = "الإدارة المالية المركزية",
            IsActive = true,
            CreatedAt = new DateTime(2026, 2, 1),
            Notes = "إدارة الحسابات، الخزائن، والتقارير الختامية"
        },
        new()
        {
            Id = "USR-STORE-01",
            FullName = "عمار جاسم (أمين المستودع)",
            Username = "storekeeper@m",
            TenantSlug = "m",
            TenantName = "مؤسسة مصطفى للتجارة والحلول البرمجية",
            DefaultWarehouseId = null,
            PasswordHash = "store123",
            Email = "warehouse@m.zilox.com",
            Phone = "+964 772 456 7890",
            Role = UserRole.Storekeeper,
            BranchId = null,
            BranchName = null,
            IsActive = true,
            CreatedAt = new DateTime(2026, 2, 15),
            Notes = "مسؤول الاستلام والشحن والتحويلات المخزنية"
        },
        new()
        {
            Id = "USR-CASH-01",
            FullName = "حسين ميثم (كاشير الفرع)",
            Username = "cashier@m",
            TenantSlug = "m",
            TenantName = "مؤسسة مصطفى للتجارة والحلول البرمجية",
            DefaultWarehouseId = null,
            PasswordHash = "cash123",
            Email = "cashier@m.zilox.com",
            Phone = "+964 750 567 8901",
            Role = UserRole.Cashier,
            BranchId = null,
            BranchName = null,
            IsActive = true,
            CreatedAt = new DateTime(2026, 3, 1),
            Notes = "كاشير نقطة البيع السريعة والورديات"
        }
    };

    private class UserAccountRecord
    {
        public string Id { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string TenantId { get; set; } = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
        public string TenantSlug { get; set; } = "m";
        public string TenantName { get; set; } = "مؤسسة مصطفى للتجارة والحلول البرمجية";
        public string? DefaultWarehouseId { get; set; } = null;
        public string PasswordHash { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public UserRole Role { get; set; }
        public string? BranchId { get; set; } = null;
        public string? BranchName { get; set; } = null;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastLoginAt { get; set; }
        public string? Notes { get; set; }
    }

    [HttpPost("login")]
    public ActionResult<LoginResponseDto> Login([FromBody] LoginRequestDto request)
    {
        var rawInput = (!string.IsNullOrWhiteSpace(request.Identifier) ? request.Identifier : request.Username)?.Trim();

        if (string.IsNullOrWhiteSpace(rawInput))
        {
            return BadRequest(new { message = "يرجى إدخال اسم المستخدم ورمز الشركة" });
        }

        string username;
        string tenantSlug;

        if (rawInput.Contains('@'))
        {
            var parts = rawInput.Split('@');
            username = parts[0].Trim().ToLowerInvariant();
            tenantSlug = parts[1].Trim().ToLowerInvariant();

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(tenantSlug))
            {
                return BadRequest(new { message = "صيغة اسم المستخدم غير صحيحة. يجب كتابة: اسم_المستخدم@رمز_الشركة (مثال: mustafa@m)" });
            }
        }
        else
        {
            return BadRequest(new { message = "صيغة اسم المستخدم غير صحيحة. يجب كتابة: اسم_المستخدم@رمز_الشركة (مثال: mustafa@m)" });
        }

        // 1. Fetch Tenant via Slug
        var tenant = SupportedTenants.FirstOrDefault(t => t.Slug.ToLowerInvariant() == tenantSlug && t.IsActive);
        if (tenant == null)
        {
            return Unauthorized(new { message = "رمز المنشأة غير صحيح أو الحساب معطل." });
        }

        // 2. Fetch User strictly scoped to Tenant
        var matchedAccount = EmployeeAccounts.FirstOrDefault(u => 
            u.TenantSlug.ToLowerInvariant() == tenantSlug && 
            (u.Username.ToLowerInvariant() == $"{username}@{tenantSlug}" || 
             u.Username.ToLowerInvariant() == username ||
             u.Username.Split('@')[0].ToLowerInvariant() == username));

        if (matchedAccount == null || (!string.IsNullOrEmpty(request.Password) && !PasswordHasher.Verify(request.Password, matchedAccount.PasswordHash)))
        {
            return Unauthorized(new { message = "اسم المستخدم أو كلمة المرور غير صحيحة." });
        }

        if (!matchedAccount.IsActive)
        {
            return StatusCode(403, new { message = "هذا الحساب معطل من قِبل إدارة الفرع - يرجى مراجعة المدير" });
        }

        matchedAccount.LastLoginAt = DateTime.UtcNow;

        var targetRole = matchedAccount.Role;
        var userProfile = BuildUserProfile(targetRole, matchedAccount);
        userProfile.TenantId = tenant.Id;
        userProfile.TenantSlug = tenant.Slug;
        userProfile.TenantName = tenant.Name;
        userProfile.DefaultWarehouseId = matchedAccount.DefaultWarehouseId;
        userProfile.Username = $"{username}@{tenant.Slug}";
        userProfile.BusinessPreset = tenant.BusinessPreset;
        userProfile.BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(tenant.BusinessPreset);
        userProfile.Features = tenant.Features ?? BusinessPresetFactory.CreateFeatures(tenant.BusinessPreset);

        var token = GenerateJwtToken(userProfile);

        var permittedNav = FullNavigationSchema
            .Where(item => userProfile.PermissionsList.Contains(item.RequiredPermission))
            .Select(item => new NavigationPermissionItemDto
            {
                Id = item.Id,
                TitleAr = item.TitleAr,
                TitleEn = item.TitleEn,
                Path = item.Path,
                RequiredPermission = item.RequiredPermission,
                Group = item.Group,
                Badge = item.Badge,
                IsAllowed = true
            })
            .ToList();

        return Ok(new LoginResponseDto
        {
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddHours(8),
            User = userProfile,
            PermittedNavigation = permittedNav
        });
    }

    [HttpGet("users")]
    public ActionResult<IEnumerable<UserAccountDto>> GetAllUsers()
    {
        var users = EmployeeAccounts.Select(u => new UserAccountDto
        {
            Id = u.Id,
            FullName = u.FullName,
            Username = u.Username.Contains('@') ? u.Username : $"{u.Username}@{u.TenantSlug}",
            TenantSlug = u.TenantSlug,
            TenantName = u.TenantName,
            Email = u.Email,
            Phone = u.Phone,
            Role = u.Role,
            RoleNameAr = GetRoleArabicName(u.Role),
            BranchId = u.BranchId,
            BranchName = u.BranchName,
            IsActive = u.IsActive,
            CreatedAt = u.CreatedAt,
            LastLoginAt = u.LastLoginAt,
            Notes = u.Notes
        }).ToList();

        return Ok(users);
    }

    [HttpPost("users")]
    public ActionResult<UserAccountDto> CreateUserAccount([FromBody] CreateUserAccountRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.FullName))
        {
            return BadRequest(new { message = "اسم المستخدم والاسم الكامل مطلوبان" });
        }

        if (dto.Role == UserRole.SuperAdmin)
        {
            return BadRequest(new { message = "لا يمكن إنشاء حساب مدير عام آخر. مالك المنظومة واحد فقط وغير قابل للتكرار." });
        }

        var rawUsername = dto.Username.Split('@')[0].Trim().ToLowerInvariant();
        var targetTenantSlug = (!string.IsNullOrWhiteSpace(dto.TenantSlug) ? dto.TenantSlug.Trim().ToLowerInvariant() : "m");
        var fullUsername = $"{rawUsername}@{targetTenantSlug}";

        // Multi-tenant composite uniqueness check: UNIQUE(tenant_id, LOWER(username))
        if (EmployeeAccounts.Any(u => 
            u.TenantSlug.ToLowerInvariant() == targetTenantSlug && 
            u.Username.Split('@')[0].Trim().ToLowerInvariant() == rawUsername))
        {
            return Conflict(new { message = $"اسم المستخدم ({fullUsername}) مسجل مسبقاً في هذه الشركة، يرجى اختيار اسم مستخدم آخر." });
        }

        var newRecord = new UserAccountRecord
        {
            Id = $"USR-{DateTime.UtcNow.Ticks % 100000:D5}",
            FullName = dto.FullName.Trim(),
            Username = fullUsername,
            TenantSlug = targetTenantSlug,
            TenantName = "مؤسسة مصطفى للتجارة والحلول البرمجية",
            DefaultWarehouseId = dto.BranchId,
            PasswordHash = string.IsNullOrWhiteSpace(dto.Password) ? "123456" : dto.Password,
            Email = dto.Email ?? $"{rawUsername}@{targetTenantSlug}.zilox.com",
            Phone = dto.Phone ?? string.Empty,
            Role = dto.Role,
            BranchId = dto.BranchId,
            BranchName = GetBranchName(dto.BranchId),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            Notes = dto.Notes
        };

        EmployeeAccounts.Add(newRecord);

        return CreatedAtAction(nameof(GetAllUsers), new UserAccountDto
        {
            Id = newRecord.Id,
            FullName = newRecord.FullName,
            Username = newRecord.Username,
            TenantSlug = newRecord.TenantSlug,
            TenantName = newRecord.TenantName,
            Email = newRecord.Email,
            Phone = newRecord.Phone,
            Role = newRecord.Role,
            RoleNameAr = GetRoleArabicName(newRecord.Role),
            BranchId = newRecord.BranchId,
            BranchName = newRecord.BranchName,
            IsActive = newRecord.IsActive,
            CreatedAt = newRecord.CreatedAt,
            Notes = newRecord.Notes
        });
    }

    [HttpPut("users/{id}/toggle-status")]
    public ActionResult ToggleUserStatus(string id)
    {
        var user = EmployeeAccounts.FirstOrDefault(u => u.Id == id);
        if (user == null) return NotFound(new { message = "المستخدم غير موجود" });

        if (user.Role == UserRole.SuperAdmin || user.Id == "USR-ADMIN-01")
        {
            return BadRequest(new { message = "حساب المدير العام / مالك المنظومة محمي ولا يمكن تعطيله نهائياً." });
        }

        user.IsActive = !user.IsActive;
        return Ok(new { message = user.IsActive ? "تم تفعيل الحساب بنجاح" : "تم تعطيل الحساب بنجاح", isActive = user.IsActive });
    }

    [HttpPut("users/{id}/reset-password")]
    public ActionResult ResetUserPassword(string id, [FromBody] ResetPasswordRequestDto dto)
    {
        var user = EmployeeAccounts.FirstOrDefault(u => u.Id == id);
        if (user == null) return NotFound(new { message = "المستخدم غير موجود" });

        if (user.Role == UserRole.SuperAdmin || user.Id == "USR-ADMIN-01")
        {
            return BadRequest(new { message = "لا يمكن إعادة تعيين كلمة مرور المالك الرئيسي إلا من خلال حسابه الشخصي." });
        }

        if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 4)
        {
            return BadRequest(new { message = "يجب أن تكون كلمة المرور 4 خانات على الأقل" });
        }

        user.PasswordHash = dto.NewPassword;
        return Ok(new { message = "تم إعادة تعيين كلمة المرور بنجاح" });
    }

    [HttpDelete("users/{id}")]
    public ActionResult DeleteUser(string id)
    {
        var user = EmployeeAccounts.FirstOrDefault(u => u.Id == id);
        if (user == null) return NotFound(new { message = "المستخدم غير موجود" });

        if (user.Role == UserRole.SuperAdmin || user.Id == "USR-ADMIN-01")
        {
            return BadRequest(new { message = "حساب المدير العام ومالك المنظومة محمي ولا يمكن حذفه إطلاقاً." });
        }

        EmployeeAccounts.Remove(user);
        return Ok(new { message = "تم حذف حساب المستخدم بنجاح" });
    }


    [HttpGet("roles")]
    public ActionResult<IEnumerable<object>> GetRoles()
    {
        var roles = new[]
        {
            new { Role = UserRole.SuperAdmin, NameAr = "المدير العام / صاحب العمل", NameEn = "Super Admin (Owner)", DefaultRoute = "/dashboard" },
            new { Role = UserRole.BranchManager, NameAr = "مدير الفرع / المشرف", NameEn = "Branch Manager", DefaultRoute = "/dashboard" },
            new { Role = UserRole.Accountant, NameAr = "المحاسب المالي", NameEn = "Accountant", DefaultRoute = "/finance" },
            new { Role = UserRole.Storekeeper, NameAr = "أمين المخزن", NameEn = "Storekeeper", DefaultRoute = "/inventory" },
            new { Role = UserRole.Cashier, NameAr = "الكاشير وموظف البيع", NameEn = "Cashier & Sales Rep", DefaultRoute = "/pos" }
        };

        return Ok(roles);
    }

    private static string GetRoleArabicName(UserRole role) => role switch
    {
        UserRole.SuperAdmin => "المدير العام / صاحب العمل",
        UserRole.BranchManager => "مدير الفرع / المشرف",
        UserRole.Accountant => "المحاسب المالي",
        UserRole.Storekeeper => "أمين المخزن",
        UserRole.Cashier => "الكاشير وموظف البيع",
        _ => role.ToString()
    };

    private static string? GetBranchName(string? branchId) => branchId switch
    {
        "ALL" => "كافة الفروع والمستودعات",
        _ => null
    };

    private static UserProfileDto BuildUserProfile(UserRole role, UserAccountRecord? matchedAccount = null)
    {
        var profile = role switch
        {
            UserRole.Cashier => new UserProfileDto
            {
                Id = matchedAccount?.Id ?? "USR-CASH-01",
                Username = matchedAccount?.Username ?? "cashier",
                FullName = matchedAccount?.FullName ?? "حسين ميثم (كاشير الفرع)",
                Email = matchedAccount?.Email ?? "cashier@zilox-suite.com",
                Role = UserRole.Cashier,
                RoleNameAr = "كاشير وموظف مبيعات",
                RoleNameEn = "Cashier & Sales Rep",
                BranchId = matchedAccount?.BranchId,
                BranchName = matchedAccount?.BranchName,
                DefaultWarehouseId = matchedAccount?.DefaultWarehouseId,
                DefaultRoute = "Cloud POS",
                CanViewCostPrice = false,
                PermissionsList = new List<string>
                {
                    Permissions.PosTerminalAccess,
                    Permissions.ShiftsManage,
                    Permissions.ReturnsManage,
                    Permissions.InventoryView // Read-only without cost price
                }
            },


            UserRole.Storekeeper => new UserProfileDto
            {
                Id = matchedAccount?.Id ?? "USR-STORE-01",
                Username = matchedAccount?.Username ?? "storekeeper",
                FullName = matchedAccount?.FullName ?? "عمار جاسم (أمين المستودع)",
                Email = matchedAccount?.Email ?? "store@zilox-suite.com",
                Role = UserRole.Storekeeper,
                RoleNameAr = "أمين المخزن والمستودع",
                RoleNameEn = "Warehouse Storekeeper",
                BranchId = matchedAccount?.BranchId,
                BranchName = matchedAccount?.BranchName,
                DefaultWarehouseId = matchedAccount?.DefaultWarehouseId,
                DefaultRoute = "Inventory & Items",
                CanViewCostPrice = false,
                PermissionsList = new List<string>
                {
                    Permissions.InventoryView,
                    Permissions.InventoryManage,
                    Permissions.TransfersManage,
                    Permissions.StockCountsManage,
                    Permissions.LogisticsDispatch,
                    Permissions.PurchasesManage
                }
            },

            UserRole.Accountant => new UserProfileDto
            {
                Id = matchedAccount?.Id ?? "USR-ACC-01",
                Username = matchedAccount?.Username ?? "accountant",
                FullName = matchedAccount?.FullName ?? "ضرغام خليل (المحاسب المالي)",
                Email = matchedAccount?.Email ?? "finance@zilox-suite.com",
                Role = UserRole.Accountant,
                RoleNameAr = "المحاسب المالي",
                RoleNameEn = "Chief Accountant",
                BranchId = matchedAccount?.BranchId,
                BranchName = matchedAccount?.BranchName,
                DefaultWarehouseId = matchedAccount?.DefaultWarehouseId,
                DefaultRoute = "Finance & Treasury",
                CanViewCostPrice = true,
                PermissionsList = new List<string>
                {
                    Permissions.FinanceLedger,
                    Permissions.CustomersManage,
                    Permissions.ReportsExecutive,
                    Permissions.InvoicesManage,
                    Permissions.ShiftsManage,
                    Permissions.InventoryCostPriceView
                }
            },

            UserRole.BranchManager => new UserProfileDto
            {
                Id = matchedAccount?.Id ?? "USR-MGR-01",
                Username = matchedAccount?.Username ?? "manager",
                FullName = matchedAccount?.FullName ?? "مدير الفرع",
                Email = matchedAccount?.Email ?? "manager@zilox-suite.com",
                Role = UserRole.BranchManager,
                RoleNameAr = "مدير الفرع / المشرف",
                RoleNameEn = "Branch Manager",
                BranchId = matchedAccount?.BranchId,
                BranchName = matchedAccount?.BranchName,
                DefaultWarehouseId = matchedAccount?.DefaultWarehouseId,
                DefaultRoute = "Dashboard",
                CanViewCostPrice = true,
                PermissionsList = new List<string>
                {
                    Permissions.DashboardView,
                    Permissions.PosTerminalAccess,
                    Permissions.ShiftsManage,
                    Permissions.InvoicesManage,
                    Permissions.ReturnsManage,
                    Permissions.InventoryView,
                    Permissions.InventoryManage,
                    Permissions.TransfersManage,
                    Permissions.ReportsExecutive,
                    Permissions.InventoryCostPriceView
                }
            },

            _ => new UserProfileDto // SuperAdmin
            {
                Id = matchedAccount?.Id ?? "USR-ADMIN-01",
                Username = matchedAccount?.Username ?? "admin",
                FullName = matchedAccount?.FullName ?? (matchedAccount?.TenantSlug == "m" ? "مصطفى قاسم" : "المدير العام"),
                Email = matchedAccount?.Email ?? "admin@zilox-suite.com",
                Role = UserRole.SuperAdmin,
                RoleNameAr = "المدير العام",
                RoleNameEn = "Super Admin (Owner)",
                BranchId = matchedAccount?.BranchId ?? "ALL",
                BranchName = matchedAccount?.BranchName ?? "كافة الفروع والمستودعات",
                DefaultWarehouseId = matchedAccount?.DefaultWarehouseId,
                DefaultRoute = "Dashboard",
                CanViewCostPrice = true,
                PermissionsList = new List<string>
                {
                    Permissions.DashboardView,
                    Permissions.InventoryView,
                    Permissions.InventoryManage,
                    Permissions.InventoryCostPriceView,
                    Permissions.TransfersManage,
                    Permissions.StockCountsManage,
                    Permissions.LogisticsDispatch,
                    Permissions.PurchasesManage,
                    Permissions.PosTerminalAccess,
                    Permissions.ShiftsManage,
                    Permissions.InvoicesManage,
                    Permissions.ReturnsManage,
                    Permissions.FinanceLedger,
                    Permissions.CustomersManage,
                    Permissions.ReportsExecutive,
                    Permissions.SettingsAudit
                }
            }
        };

        profile.TenantId = matchedAccount?.TenantId ?? (matchedAccount?.TenantSlug == "m" ? "a1b2c3d4-e5f6-7890-abcd-ef1234567890" : string.Empty);
        profile.TenantSlug = matchedAccount?.TenantSlug ?? (matchedAccount == null ? "m" : string.Empty);
        profile.TenantName = matchedAccount?.TenantName ?? (matchedAccount?.TenantSlug == "m" ? "مؤسسة مصطفى للتجارة والحلول البرمجية" : "المنشأة المسجلة");
        profile.DefaultWarehouseId = matchedAccount?.DefaultWarehouseId ?? (profile.BranchId == "ALL" ? "WH-01" : profile.BranchId);
        if (matchedAccount != null)
        {
            profile.Username = matchedAccount.Username;
        }

        return profile;
    }


    private static string GenerateJwtToken(UserProfileDto user)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes("ZiloxEnterpriseSecretSigningKey2026_SecureKeyForJwtTokenAuth!!");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("BranchId", user.BranchId),
            new("branch_id", user.BranchId),
            new("tenant_id", user.TenantId),
            new("tenant_slug", user.TenantSlug),
            new("tenant_name", user.TenantName),
            new("default_warehouse_id", user.DefaultWarehouseId),
            new("CanViewCostPrice", user.CanViewCostPrice.ToString().ToLower())
        };

        // Add each permission claim
        foreach (var perm in user.PermissionsList)
        {
            claims.Add(new Claim("Permission", perm));
        }

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(8),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    // =========================================================================
    // SaaS Control Plane (SuperAdmin Endpoints)
    // =========================================================================

    [HttpGet("superadmin/tenants")]
    public ActionResult GetSuperAdminTenants()
    {
        var total = SupportedTenants.Count;
        var active = SupportedTenants.Count(t => t.IsActive);
        var suspended = total - active;
        var expiringSoon = SupportedTenants.Count(t => t.IsActive && t.ExpiresAt <= DateTime.UtcNow.AddDays(7));

        var tenantsWithMetrics = SupportedTenants.Select(t => new
        {
            t.Id,
            t.Name,
            t.Slug,
            t.CountryCode,
            t.Currency,
            t.Plan,
            t.ExpiresAt,
            t.MaxBranches,
            t.MaxUsers,
            t.IsActive,
            BusinessPreset = t.BusinessPreset.ToString(),
            BusinessPresetName = BusinessPresetFactory.GetPresetArabicName(t.BusinessPreset),
            Features = t.Features,
            ActiveBranchesCount = t.Slug == "m" ? 3 : 1,
            ActiveUsersCount = EmployeeAccounts.Count(a => a.TenantSlug == t.Slug)
        }).ToList();

        return Ok(new
        {
            Metrics = new
            {
                TotalTenants = total,
                ActiveTenants = active,
                SuspendedTenants = suspended,
                ExpiringSoonTenants = expiringSoon
            },
            Tenants = tenantsWithMetrics
        });
    }

    public record CreateTenantRequest(
        string Name,
        string Slug,
        string CountryCode,
        string Currency,
        string Plan,
        string AdminFullName,
        string AdminUsername,
        string AdminPassword,
        int MaxBranches = 5,
        int MaxUsers = 20
    );

    [HttpPost("superadmin/tenants")]
    public ActionResult CreateTenant([FromBody] CreateTenantRequest req)
    {
        var cleanSlug = req.Slug.Trim().ToLower();
        if (SupportedTenants.Any(t => t.Slug.ToLower() == cleanSlug))
        {
            return BadRequest(new { Message = "رمز المنشأة (Slug) مستخدم مسبقاً، يرجى اختيار رمز آخر." });
        }

        var newTenant = new TenantRecord
        {
            Id = Guid.NewGuid().ToString(),
            Name = req.Name.Trim(),
            Slug = cleanSlug,
            CountryCode = string.IsNullOrWhiteSpace(req.CountryCode) ? "IQ" : req.CountryCode.ToUpper(),
            Currency = string.IsNullOrWhiteSpace(req.Currency) ? "IQD" : req.Currency.ToUpper(),
            Plan = string.IsNullOrWhiteSpace(req.Plan) ? "Pro" : req.Plan,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            MaxBranches = req.MaxBranches > 0 ? req.MaxBranches : 5,
            MaxUsers = req.MaxUsers > 0 ? req.MaxUsers : 20,
            IsActive = true
        };

        SupportedTenants.Add(newTenant);

        // Seed First Admin User
        var firstAdmin = new UserAccountRecord
        {
            Id = $"USR-{Guid.NewGuid().ToString()[..8].ToUpper()}",
            FullName = req.AdminFullName.Trim(),
            Username = $"{req.AdminUsername.Trim().ToLower()}@{cleanSlug}",
            TenantSlug = cleanSlug,
            TenantName = newTenant.Name,
            DefaultWarehouseId = "WH-01",
            PasswordHash = req.AdminPassword,
            Email = $"{req.AdminUsername.Trim().ToLower()}@{cleanSlug}.zilox.com",
            Phone = "+964 770 000 0000",
            Role = UserRole.SuperAdmin,
            BranchId = "ALL",
            BranchName = "كافة الفروع والمستودعات",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            Notes = "المدير الأول المنشأ آلياً مع تأسيس الشركة"
        };

        EmployeeAccounts.Add(firstAdmin);

        return Ok(new
        {
            Message = "تم إنشاء المنشأة وحساب مديرها والمستودع الافتراضي بنجاح.",
            Tenant = newTenant,
            AdminUser = firstAdmin
        });
    }

    [HttpPatch("superadmin/tenants/{id}/toggle-status")]
    public ActionResult ToggleTenantStatus(string id)
    {
        var tenant = SupportedTenants.FirstOrDefault(t => t.Id == id);
        if (tenant == null)
        {
            return NotFound(new { Message = "المنشأة غير موجودة." });
        }

        tenant.IsActive = !tenant.IsActive;

        return Ok(new
        {
            Message = tenant.IsActive ? "تم تفعيل المنشأة بنجاح." : "تم تعليق المنشأة فورياً (Kill Switch).",
            IsActive = tenant.IsActive
        });
    }

    public record UpdateQuotasRequest(int MaxBranches, int MaxUsers);

    [HttpPatch("superadmin/tenants/{id}/quotas")]
    public ActionResult UpdateQuotas(string id, [FromBody] UpdateQuotasRequest req)
    {
        var tenant = SupportedTenants.FirstOrDefault(t => t.Id == id);
        if (tenant == null)
        {
            return NotFound(new { Message = "المنشأة غير موجودة." });
        }

        if (req.MaxBranches > 0) tenant.MaxBranches = req.MaxBranches;
        if (req.MaxUsers > 0) tenant.MaxUsers = req.MaxUsers;

        return Ok(new
        {
            Message = "تم تحديث حصص المنشأة بنجاح.",
            tenant.MaxBranches,
            tenant.MaxUsers
        });
    }

    [HttpPost("superadmin/tenants/{id}/impersonate")]
    public ActionResult ImpersonateTenant(string id)
    {
        var tenant = SupportedTenants.FirstOrDefault(t => t.Id == id);
        if (tenant == null)
        {
            return NotFound(new { Message = "المنشأة غير موجودة." });
        }

        var adminUser = EmployeeAccounts.FirstOrDefault(a => a.TenantSlug == tenant.Slug && a.Role == UserRole.SuperAdmin)
            ?? EmployeeAccounts.FirstOrDefault(a => a.TenantSlug == tenant.Slug);

        if (adminUser == null)
        {
            return BadRequest(new { Message = "لا يوجد حساب مدير مسجل لهذه المنشأة." });
        }

        var profile = BuildUserProfile(adminUser.Role, adminUser);
        var token = GenerateJwtToken(profile);

        return Ok(new
        {
            Message = $"تم تسجيل الدخول كعميل (Impersonation) لحساب {adminUser.FullName} بشركة {tenant.Name}",
            Token = token,
            User = profile
        });
    }
}
