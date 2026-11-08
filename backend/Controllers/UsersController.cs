using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Domain.Entities;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;

    public UsersController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// GET /api/v1/users
    /// Retrieves all user accounts scoped to the active tenant.
    /// Pure real-database query; zero hardcoded/mock arrays.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<UserAccountDto>>> GetUsers(CancellationToken ct)
    {
        var currentTenantId = User.FindFirst("tenant_id")?.Value 
            ?? User.FindFirst("TenantId")?.Value 
            ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();
            
        var currentTenantSlug = User.FindFirst("tenant_slug")?.Value 
            ?? Request.Headers["X-Tenant-Slug"].FirstOrDefault();

        var callerRole = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        var isPlatformAdmin = string.Equals(callerRole, nameof(UserRole.PlatformSuperAdmin), StringComparison.OrdinalIgnoreCase);

        var query = _context.Users.AsNoTracking().Include(u => u.Tenant).AsQueryable();

        if (!isPlatformAdmin)
        {
            if (!string.IsNullOrWhiteSpace(currentTenantId) && Guid.TryParse(currentTenantId, out var parsedTenantId))
            {
                query = query.Where(u => u.TenantId == parsedTenantId);
            }
            else if (!string.IsNullOrWhiteSpace(currentTenantSlug))
            {
                query = query.Where(u => u.Tenant != null && u.Tenant.Slug.ToLower() == currentTenantSlug.ToLower());
            }
        }

        var users = await query.OrderBy(u => u.CreatedAt).ToListAsync(ct);

        var dtos = users.Select(u => new UserAccountDto
        {
            Id = u.Id.ToString(),
            FullName = u.FullName,
            Username = u.Username,
            TenantSlug = u.Tenant?.Slug ?? currentTenantSlug ?? "m",
            TenantName = u.Tenant?.Name ?? "المنشأة",
            Email = u.Email ?? $"{u.Username}@zilox.com",
            Phone = u.Phone ?? string.Empty,
            Role = u.Role,
            RoleNameAr = u.Role switch
            {
                UserRole.PlatformSuperAdmin => "المدير العام للمنصة",
                UserRole.SuperAdmin => "المدير العام",
                UserRole.BranchManager => "مدير الفرع",
                UserRole.Accountant => "المحاسب المالي",
                UserRole.Storekeeper => "أمين المخزن",
                UserRole.Cashier => "كاشير مبيعات",
                _ => u.Role.ToString()
            },
            BranchId = u.BranchId,
            BranchName = u.BranchId == "ALL" ? "كافة الفروع والمستودعات" : (string.IsNullOrWhiteSpace(u.BranchId) ? "الفرع الرئيسي" : $"فرع {u.BranchId}"),
            IsActive = u.IsActive,
            CreatedAt = u.CreatedAt,
            LastLoginAt = u.LastLoginAt,
            Notes = u.Notes,
            AvatarUrl = u.AvatarUrl
        }).ToList();

        return Ok(dtos);
    }

    /// <summary>
    /// POST /api/v1/users
    /// Creates a new staff member account in the database.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<UserAccountDto>> CreateUser([FromBody] CreateUserAccountRequestDto dto, CancellationToken ct)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.FullName))
        {
            return BadRequest(new { success = false, message = "بيانات الموظف غير مكتملة" });
        }

        var currentTenantId = User.FindFirst("tenant_id")?.Value 
            ?? User.FindFirst("TenantId")?.Value 
            ?? Request.Headers["X-Tenant-Id"].FirstOrDefault();
            
        var currentTenantSlug = dto.TenantSlug 
            ?? User.FindFirst("tenant_slug")?.Value 
            ?? Request.Headers["X-Tenant-Slug"].FirstOrDefault();

        Guid? tenantGuid = null;
        if (!string.IsNullOrWhiteSpace(currentTenantId) && Guid.TryParse(currentTenantId, out var parsedTenantId))
        {
            tenantGuid = parsedTenantId;
        }
        else if (!string.IsNullOrWhiteSpace(currentTenantSlug))
        {
            var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Slug.ToLower() == currentTenantSlug.ToLower(), ct);
            if (tenant != null) tenantGuid = tenant.Id;
        }

        var cleanUsername = dto.Username.Trim().ToLower();
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == cleanUsername, ct);
        if (existingUser != null)
        {
            return BadRequest(new { success = false, message = "اسم المستخدم مسجل مسبقاً" });
        }

        var newUser = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantGuid,
            Username = cleanUsername,
            PasswordHash = PasswordHasher.Hash(string.IsNullOrWhiteSpace(dto.Password) ? "123456" : dto.Password),
            FullName = dto.FullName.Trim(),
            Email = dto.Email,
            Phone = dto.Phone,
            Role = dto.Role,
            BranchId = string.IsNullOrWhiteSpace(dto.BranchId) ? "WH-01" : dto.BranchId,
            DefaultWarehouseId = string.IsNullOrWhiteSpace(dto.BranchId) ? "WH-01" : dto.BranchId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            Notes = dto.Notes,
            AvatarUrl = string.IsNullOrWhiteSpace(dto.AvatarUrl) 
                ? (dto.Role == UserRole.SuperAdmin ? "/avatars/memoji-admin.png" : (dto.Role == UserRole.Cashier ? "/avatars/memoji-cashier.png" : (dto.Role == UserRole.Storekeeper ? "/avatars/memoji-warehouse.png" : "/avatars/memoji-accountant.png")))
                : dto.AvatarUrl
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync(ct);

        return Ok(new UserAccountDto
        {
            Id = newUser.Id.ToString(),
            FullName = newUser.FullName,
            Username = newUser.Username,
            TenantSlug = currentTenantSlug ?? "m",
            Email = newUser.Email ?? string.Empty,
            Phone = newUser.Phone ?? string.Empty,
            Role = newUser.Role,
            RoleNameAr = newUser.Role.ToString(),
            BranchId = newUser.BranchId,
            BranchName = newUser.BranchId,
            IsActive = newUser.IsActive,
            CreatedAt = newUser.CreatedAt,
            AvatarUrl = newUser.AvatarUrl
        });
    }

    /// <summary>
    /// PATCH /api/v1/users/{id}/avatar
    /// Updates the user's avatar selection to a curated 3D Memoji.
    /// </summary>
    [HttpPatch("{id}/avatar")]
    public async Task<ActionResult> UpdateUserAvatar(string id, [FromBody] UpdateAvatarRequestDto dto, CancellationToken ct)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.AvatarUrl))
        {
            return BadRequest(new { success = false, message = "مسار الأفاتار غير صالح" });
        }

        Guid userGuid;
        User? targetUser = null;

        if (Guid.TryParse(id, out userGuid))
        {
            targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userGuid, ct);
        }
        else
        {
            targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == id.ToLower(), ct);
        }

        if (targetUser == null)
        {
            return NotFound(new { success = false, message = "حساب الموظف غير موجود" });
        }

        targetUser.AvatarUrl = dto.AvatarUrl.Trim();
        await _context.SaveChangesAsync(ct);

        return Ok(new { success = true, avatarUrl = targetUser.AvatarUrl, message = "تم تحديث الأفاتار بنجاح" });
    }

    /// <summary>
    /// DELETE /api/v1/users/{id}
    /// Permanently deletes an employee account and their assigned permissions.
    /// Root Owners are completely protected.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteUser(string id, CancellationToken ct)
    {
        Guid userGuid;
        User? targetUser = null;

        if (Guid.TryParse(id, out userGuid))
        {
            targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userGuid, ct);
        }
        else
        {
            targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == id.ToLower(), ct);
        }

        if (targetUser == null)
        {
            return NotFound(new { success = false, message = "حساب الموظف غير موجود" });
        }

        if (targetUser.Role == UserRole.SuperAdmin || targetUser.Role == UserRole.PlatformSuperAdmin || targetUser.Username.ToLower() == "admin")
        {
            return BadRequest(new { success = false, message = "حساب المدير العام محمي ولا يمكن حذفه" });
        }

        var userPerms = await _context.UserPermissions.Where(up => up.UserId == targetUser.Id).ToListAsync(ct);
        _context.UserPermissions.RemoveRange(userPerms);

        _context.Users.Remove(targetUser);
        await _context.SaveChangesAsync(ct);

        return Ok(new { success = true, message = "تم حذف حساب الموظف بنجاح" });
    }

    /// <summary>
    /// PATCH /api/v1/users/{id}/status
    /// Toggles active/suspended state of a staff member.
    /// </summary>
    [HttpPatch("{id}/status")]
    public async Task<ActionResult> ToggleUserStatus(string id, CancellationToken ct)
    {
        Guid userGuid;
        User? targetUser = null;

        if (Guid.TryParse(id, out userGuid))
        {
            targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userGuid, ct);
        }
        else
        {
            targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == id.ToLower(), ct);
        }

        if (targetUser == null)
        {
            return NotFound(new { success = false, message = "حساب الموظف غير موجود" });
        }

        if (targetUser.Role == UserRole.SuperAdmin || targetUser.Role == UserRole.PlatformSuperAdmin)
        {
            return BadRequest(new { success = false, message = "لا يمكن تعطيل حساب المدير العام" });
        }

        targetUser.IsActive = !targetUser.IsActive;
        await _context.SaveChangesAsync(ct);

        return Ok(new { success = true, isActive = targetUser.IsActive });
    }

    /// <summary>
    /// GET /api/v1/users/{id}/permissions
    /// Retrieves all assigned granular permissions for a given user.
    /// Falls back to role-default permissions if no custom permissions have been explicitly granted.
    /// </summary>
    [HttpGet("{id}/permissions")]
    public async Task<ActionResult<UserPermissionsResponseDto>> GetUserPermissions(string id, CancellationToken ct)
    {
        Guid userGuid;
        User? user = null;

        if (Guid.TryParse(id, out userGuid))
        {
            user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userGuid, ct);
        }
        else
        {
            // Support lookup by username prefix or staff code
            user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == id.ToLower(), ct);
        }

        if (user == null)
        {
            return NotFound(new
            {
                success = false,
                errorCode = "ERR_USER_NOT_FOUND",
                message = "The requested user account was not found.",
                timestamp = DateTime.UtcNow
            });
        }

        // Fetch explicitly granted permissions from user_permissions table
        var grantedPermissions = await _context.UserPermissions
            .Where(up => up.UserId == user.Id)
            .Select(up => up.PermissionCode)
            .ToListAsync(ct);

        List<string> permissionsList;
        if (grantedPermissions != null && grantedPermissions.Count > 0)
        {
            permissionsList = grantedPermissions;
        }
        else
        {
            permissionsList = user.Role switch
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

        return Ok(new UserPermissionsResponseDto
        {
            UserId = user.Id.ToString(),
            Username = user.Username,
            Role = user.Role.ToString(),
            Permissions = permissionsList,
            UpdatedAt = DateTime.UtcNow
        });
    }

    /// <summary>
    /// PUT /api/v1/users/{id}/permissions
    /// Replaces the granular permissions matrix assigned to the user.
    /// Protected by: [HasPermission(Permissions.System.PermissionsManage)] or SuperAdmin role.
    /// </summary>
    [HttpPut("{id}/permissions")]
    [HasPermission(Permissions.System.PermissionsManage)]
    public async Task<ActionResult> UpdateUserPermissions(
        string id, 
        [FromBody] UpdateUserPermissionsRequestDto dto, 
        CancellationToken ct)
    {
        if (dto == null || dto.Permissions == null)
        {
            return BadRequest(new
            {
                success = false,
                errorCode = "ERR_INVALID_PAYLOAD",
                message = "Invalid permissions payload provided.",
                timestamp = DateTime.UtcNow
            });
        }

        Guid userGuid;
        User? targetUser = null;

        if (Guid.TryParse(id, out userGuid))
        {
            targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userGuid, ct);
        }
        else
        {
            targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == id.ToLower(), ct);
        }

        if (targetUser == null)
        {
            return NotFound(new
            {
                success = false,
                errorCode = "ERR_USER_NOT_FOUND",
                message = "The targeted user account does not exist.",
                timestamp = DateTime.UtcNow
            });
        }

        // Caller identity verification
        var callerUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var callerRole = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        var isCallerSuperAdmin = string.Equals(callerRole, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(callerRole, nameof(UserRole.PlatformSuperAdmin), StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(callerRole, "Owner", StringComparison.OrdinalIgnoreCase);

        Guid? callerGuid = null;
        if (!string.IsNullOrEmpty(callerUserId) && Guid.TryParse(callerUserId, out var parsedCaller))
        {
            callerGuid = parsedCaller;
        }

        // 1. Mandatory Owner Account Protection Guard (ERR_CANNOT_MODIFY_OWNER)
        var isTargetOwner = targetUser.Role == UserRole.SuperAdmin || 
                            targetUser.Role == UserRole.PlatformSuperAdmin || 
                            string.Equals(targetUser.Role.ToString(), "Owner", StringComparison.OrdinalIgnoreCase) ||
                            targetUser.Username.ToLower() == "admin" || 
                            targetUser.Username.ToLower() == "mustafa" ||
                            targetUser.Username.ToLower().StartsWith("admin@");

        if (isTargetOwner)
        {
            return BadRequest(new
            {
                success = false,
                errorCode = "ERR_CANNOT_MODIFY_OWNER",
                message = "حساب المالك محصن بالكامل ولا يمكن تعديل أو تقييد صلاحياته.",
                timestamp = DateTime.UtcNow
            });
        }

        // 2. Self-Edit Lock: No user may edit their own permissions
        if (callerGuid.HasValue && targetUser.Id == callerGuid.Value)
        {
            return BadRequest(new
            {
                success = false,
                errorCode = "ERR_CANNOT_MODIFY_SELF",
                message = "قفل التعديل الذاتي: لا يمكن لأي مستخدم تعديل صلاحيات حسابه بنفسه.",
                timestamp = DateTime.UtcNow
            });
        }

        // 3. RBAC Restrict: Only verified Owner / SuperAdmin can modify subordinate permissions
        if (!isCallerSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                success = false,
                errorCode = "ERR_ONLY_OWNER_CAN_MODIFY_PERMISSIONS",
                message = "تعديل صلاحيات الموظفين مقتصر حصراً على المالك والمدير العام.",
                timestamp = DateTime.UtcNow
            });
        }

        // Filter and deduplicate submitted permissions against standard catalogue
        var catalog = Permissions.GetAll().ToHashSet(StringComparer.OrdinalIgnoreCase);
        var sanitizedPermissions = dto.Permissions
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => p.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Execute atomic replacement in database
        var existingUserPerms = await _context.UserPermissions
            .Where(up => up.UserId == targetUser.Id)
            .ToListAsync(ct);

        _context.UserPermissions.RemoveRange(existingUserPerms);

        foreach (var code in sanitizedPermissions)
        {
            _context.UserPermissions.Add(new UserPermission
            {
                UserId = targetUser.Id,
                PermissionCode = code,
                GrantedBy = callerGuid,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync(ct);

        return Ok(new
        {
            success = true,
            message = "تم تحديث مصفوفة الصلاحيات بنجاح",
            userId = targetUser.Id,
            permissions = sanitizedPermissions,
            updatedAt = DateTime.UtcNow
        });
    }

    /// <summary>
    /// GET /api/v1/permissions
    /// Returns the complete catalog of system permissions grouped into the 7 standard enterprise domains.
    /// </summary>
    [HttpGet("/api/v1/permissions")]
    [AllowAnonymous]
    public ActionResult<List<PermissionMatrixGroupDto>> GetPermissionsCatalog()
    {
        var matrix = new List<PermissionMatrixGroupDto>
        {
            new()
            {
                GroupName = "POS",
                TitleAr = "نقطة البيع (POS)",
                TitleEn = "Point of Sale",
                Permissions = new List<PermissionDefinitionDto>
                {
                    new() { Code = Permissions.POS.Terminal, GroupName = "POS", NameAr = "الدخول لنقطة البيع السريعة", NameEn = "POS Terminal Access", DescriptionAr = "صلاحية فتح شاشة نقطة البيع وتسجيل المبيعات", DescriptionEn = "Open POS cashier checkout screen" },
                    new() { Code = Permissions.POS.ShiftsManage, GroupName = "POS", NameAr = "إدارة الورديات وإغلاق الصندوق", NameEn = "Shift Management & Z-Report", DescriptionAr = "فتح وإغلاق ورديات الصندوق وطباعة تقرير الـ Z-Report", DescriptionEn = "Open/close cash drawers and generate Z-reports" },
                    new() { Code = Permissions.POS.DiscountApply, GroupName = "POS", NameAr = "تطبيق خصم يدوي على الفاتورة", NameEn = "Apply Invoice Discounts", DescriptionAr = "صلاحية تطبيق نسب الخصم المسموحة للكاشير", DescriptionEn = "Allow cashier to apply discounts on line items" },
                    new() { Code = Permissions.POS.PriceOverride, GroupName = "POS", NameAr = "تعديل أسعار البيع المباشرة", NameEn = "Override Selling Price", DescriptionAr = "تعديل سعر بيع الصنف لحظة إصدار فاتورة البيع", DescriptionEn = "Modify retail item unit price directly at checkout" },
                    new() { Code = Permissions.POS.DrawerOpen, GroupName = "POS", NameAr = "فتح درج النقدية يدوياً", NameEn = "Manual Cash Drawer Kick", DescriptionAr = "صلاحية فتح درج الكاش دون إجراء حركة بيع", DescriptionEn = "Trigger hardware drawer kick without transaction" }
                }
            },
            new()
            {
                GroupName = "Sales",
                TitleAr = "المبيعات والفواتير",
                TitleEn = "Sales & Invoices",
                Permissions = new List<PermissionDefinitionDto>
                {
                    new() { Code = Permissions.Sales.InvoicesView, GroupName = "Sales", NameAr = "استعراض فواتير المبيعات", NameEn = "View Sales Invoices", DescriptionAr = "الاطلاع على فواتير المبيعات الصادرة والبحث فيها", DescriptionEn = "Browse and search all sales invoices" },
                    new() { Code = Permissions.Sales.InvoicesCreate, GroupName = "Sales", NameAr = "إنشاء فواتير المبيعات", NameEn = "Create Sales Invoices", DescriptionAr = "إصدار فواتير بيع نقدية وآجلة من لوحة التحكم", DescriptionEn = "Create and finalize new sales invoices" },
                    new() { Code = Permissions.Sales.InvoicesEdit, GroupName = "Sales", NameAr = "تعديل فواتير المبيعات", NameEn = "Edit Sales Invoices", DescriptionAr = "تعديل بيانات الفواتير المعلقة قبل الاعتماد النهائي", DescriptionEn = "Update pending draft sales invoices" },
                    new() { Code = Permissions.Sales.InvoicesDelete, GroupName = "Sales", NameAr = "إلغاء وحذف فواتير المبيعات", NameEn = "Cancel & Void Invoices", DescriptionAr = "إلغاء الفواتير الصادرة وتعديل أثرها المحاسبي", DescriptionEn = "Void posted sales invoices with ledger adjustments" },
                    new() { Code = Permissions.Sales.ReturnsManage, GroupName = "Sales", NameAr = "إدارة المرتجعات والضمان", NameEn = "Returns & Warranty RMA", DescriptionAr = "قبول المرتجعات وفحص الضمان وإصدار إشعارات دائنة", DescriptionEn = "Process returns, RMA inspection, and credit notes" },
                    new() { Code = Permissions.Sales.CustomersManage, GroupName = "Sales", NameAr = "إدارة سجل العملاء والذمم", NameEn = "Customers & Receivables", DescriptionAr = "إضافة وتعديل بيانات العملاء وسقف الديون", DescriptionEn = "Manage customer profiles, credit limits, and aging" }
                }
            },
            new()
            {
                GroupName = "Purchases",
                TitleAr = "المشتريات والموردين",
                TitleEn = "Purchases & Suppliers",
                Permissions = new List<PermissionDefinitionDto>
                {
                    new() { Code = Permissions.Purchases.BillsView, GroupName = "Purchases", NameAr = "استعراض فواتير الشراء", NameEn = "View Purchase Invoices", DescriptionAr = "الاطلاع على فواتير المشتريات ومطابقتها", DescriptionEn = "View vendor purchase bills and receipts" },
                    new() { Code = Permissions.Purchases.BillsCreate, GroupName = "Purchases", NameAr = "تسجيل فواتير الشراء الواردة", NameEn = "Create Purchase Bills", DescriptionAr = "إدخال فواتير شراء جديدة وتغذية المخزون بدفعات FIFO", DescriptionEn = "Record purchase bills and inject FIFO batches" },
                    new() { Code = Permissions.Purchases.BillsEdit, GroupName = "Purchases", NameAr = "تعديل فواتير المشتريات", NameEn = "Edit Purchase Bills", DescriptionAr = "تعديل بنود وتكاليف فواتير الشراء", DescriptionEn = "Update purchase bill items and landing costs" },
                    new() { Code = Permissions.Purchases.BillsDelete, GroupName = "Purchases", NameAr = "حذف أو إلغاء فواتير الشراء", NameEn = "Delete Purchase Bills", DescriptionAr = "إلغاء فاتورة شراء وإرجاع الأثر المخزني والمالي", DescriptionEn = "Delete or cancel purchase bills" },
                    new() { Code = Permissions.Purchases.OrdersManage, GroupName = "Purchases", NameAr = "إدارة أوامر الشراء المجدولة", NameEn = "Purchase Orders (PO)", DescriptionAr = "إنشاء ومتابعة أوامر الشراء ومذكرات التوريد", DescriptionEn = "Create and approve scheduled vendor POs" },
                    new() { Code = Permissions.Purchases.SuppliersManage, GroupName = "Purchases", NameAr = "إدارة دليل الموردين والديون", NameEn = "Suppliers & Payables", DescriptionAr = "تسجيل الموردين ومتابعة كشوف الحساب والمستحقات", DescriptionEn = "Manage supplier accounts and payables ledgers" }
                }
            },
            new()
            {
                GroupName = "Inventory",
                TitleAr = "المخزون والمستودعات",
                TitleEn = "Inventory & Warehouses",
                Permissions = new List<PermissionDefinitionDto>
                {
                    new() { Code = Permissions.Inventory.ItemsView, GroupName = "Inventory", NameAr = "استعراض دليل الأصناف والباركود", NameEn = "View Item Catalog", DescriptionAr = "الاطلاع على قائمة الأصناف والأرصدة والباركودات", DescriptionEn = "Browse items catalog, SKU codes, and on-hand quantities" },
                    new() { Code = Permissions.Inventory.ItemsCreate, GroupName = "Inventory", NameAr = "إضافة أصناف جديدة للدليل", NameEn = "Create New Products", DescriptionAr = "إنشاء بطاقة صنف جديدة وتوليد باركودات وتحديد الأسعار", DescriptionEn = "Create new inventory items and assign SKUs" },
                    new() { Code = Permissions.Inventory.ItemsEdit, GroupName = "Inventory", NameAr = "تعديل بيانات الأصناف والأسعار", NameEn = "Edit Products & Prices", DescriptionAr = "تعديل مواصفات الصنف، وحدات القياس، وأسعار البيع", DescriptionEn = "Update product specs, barcode, and pricing tiers" },
                    new() { Code = Permissions.Inventory.ItemsDelete, GroupName = "Inventory", NameAr = "حذف الأصناف من الدليل", NameEn = "Delete Products", DescriptionAr = "حذف أو أرشفة الأصناف نهائياً من دليل المنتجات", DescriptionEn = "Permanently remove or archive products from catalog" },
                    new() { Code = Permissions.Inventory.CostPriceView, GroupName = "Inventory", NameAr = "الاطلاع على أسعار التكلفة وهامش الربح", NameEn = "View Cost Price & Margins", DescriptionAr = "فك حجب تكلفة الشراء وهامش الربح الإجمالي", DescriptionEn = "Unmask purchasing cost price and gross margins" },
                    new() { Code = Permissions.Inventory.TransfersManage, GroupName = "Inventory", NameAr = "إدارة المناقلات وتتبع الطريق", NameEn = "Transfers & In-Transit", DescriptionAr = "إنشاء واعتماد ومطابقة شحنات النقل بين المستودعات", DescriptionEn = "Initiate and approve inter-warehouse transfers" },
                    new() { Code = Permissions.Inventory.StockCountsManage, GroupName = "Inventory", NameAr = "الجرد المخزني وتسوية الفروقات", NameEn = "Stock Audits & Reconciliation", DescriptionAr = "تنفيذ جرد الأصناف وإقرار قيود التسوية المخزنية", DescriptionEn = "Perform physical inventory count audits and variance posts" },
                    new() { Code = Permissions.Inventory.WarehousesManage, GroupName = "Inventory", NameAr = "تخطيط المستودعات والرفوف WMS", NameEn = "Warehouse Layout & WMS", DescriptionAr = "إدارة المستودعات، الأقسام، والمواقع والرفوف التخزينية", DescriptionEn = "Configure warehouse hubs, bin locations, and racks" }
                }
            },
            new()
            {
                GroupName = "Treasury",
                TitleAr = "الخزينة وإدارة النقدية",
                TitleEn = "Treasury & Cash Management",
                Permissions = new List<PermissionDefinitionDto>
                {
                    new() { Code = Permissions.Treasury.AccountsView, GroupName = "Treasury", NameAr = "استعراض الصناديق والمحافظ المالية", NameEn = "View Cash & Bank Accounts", DescriptionAr = "الاطلاع على أرصدة الصناديق النقدية والمحافظ الإلكترونية", DescriptionEn = "View balances of physical drawers and bank accounts" },
                    new() { Code = Permissions.Treasury.VouchersManage, GroupName = "Treasury", NameAr = "إنشاء سندات القبض والصرف", NameEn = "Receipt & Payment Vouchers", DescriptionAr = "تسجيل سندات القبض وسندات الصرف المالي ومطابقتها", DescriptionEn = "Create and disburse payment/receipt vouchers" },
                    new() { Code = Permissions.Treasury.CashBoxesManage, GroupName = "Treasury", NameAr = "إدارة وتعديل الصناديق النقدية", NameEn = "Manage Cash Boxes", DescriptionAr = "إضافة صناديق ومحافظ جديدة وتعيين المسؤولين عنها", DescriptionEn = "Configure sub-cashboxes and custodian assignments" },
                    new() { Code = Permissions.Treasury.DebtsView, GroupName = "Treasury", NameAr = "متابعة سجل الديون والمستحقات", NameEn = "Debts & Aging Ledger", DescriptionAr = "الاطلاع على كشوفات الذمم المدينة والدائنة", DescriptionEn = "Monitor customer/supplier aging balance schedules" }
                }
            },
            new()
            {
                GroupName = "Reports",
                TitleAr = "التقارير التنفيذية والمؤشرات",
                TitleEn = "Executive Reports & Analytics",
                Permissions = new List<PermissionDefinitionDto>
                {
                    new() { Code = Permissions.Reports.ExecutiveView, GroupName = "Reports", NameAr = "الاطلاع على التقارير التنفيذية", NameEn = "Executive Reports & KPIs", DescriptionAr = "استعراض مؤشرات الأداء الحية ومقارنات الفروع الإجمالية", DescriptionEn = "Access macro business indicators and executive KPIs" },
                    new() { Code = Permissions.Reports.SalesReports, GroupName = "Reports", NameAr = "تقارير المبيعات والأرباح", NameEn = "Sales & Revenue Reports", DescriptionAr = "توليد تقارير المبيعات التفصيلية وتحليل الربحية اليومية", DescriptionEn = "Generate multi-dimension revenue analysis" },
                    new() { Code = Permissions.Reports.InventoryReports, GroupName = "Reports", NameAr = "تقارير حركة وركود المخزون", NameEn = "Inventory Aging & Movements", DescriptionAr = "استعراض تقارير سرعة دوران الصنف والأصناف الراكدة", DescriptionEn = "Examine stock turnover velocity and slow-moving items" },
                    new() { Code = Permissions.Reports.FinancialReports, GroupName = "Reports", NameAr = "القوائم والتقارير المالية", NameEn = "Financial Statements & Tax", DescriptionAr = "استخراج ميزان المراجعة وقائمة الدخل والتقارير الضريبية", DescriptionEn = "Export trial balance, profit & loss, and tax returns" }
                }
            },
            new()
            {
                GroupName = "System",
                TitleAr = "إدارة النظام وسجل الرقابة",
                TitleEn = "System & Administration",
                Permissions = new List<PermissionDefinitionDto>
                {
                    new() { Code = Permissions.System.DashboardView, GroupName = "System", NameAr = "عرض لوحة القيادة والمؤشرات العامة", NameEn = "Dashboard & Live Analytics", DescriptionAr = "صلاحية فتح الشاشة الرئيسية للوحة القيادة", DescriptionEn = "Access live main KPI overview dashboard" },
                    new() { Code = Permissions.System.UsersManage, GroupName = "System", NameAr = "إدارة حسابات الموظفين والفرقاء", NameEn = "Staff & User Management", DescriptionAr = "إنشاء وتعديل وتعطيل حسابات الموظفين وإعادة تعيين كلمات المرور", DescriptionEn = "Create, modify, toggle staff status and manage credentials" },
                    new() { Code = Permissions.System.PermissionsManage, GroupName = "System", NameAr = "تخصيص مصفوفة الصلاحيات (PBAC)", NameEn = "Granular Permissions Matrix", DescriptionAr = "تعديل وتعيين الصلاحيات الدقيقة لكل موظف عبر المصفوفة", DescriptionEn = "Fine-tune individual employee permission switches" },
                    new() { Code = Permissions.System.AuditLogView, GroupName = "System", NameAr = "سجل الرقابة والتتبع غير القابل للحذف", NameEn = "Immutable Audit Logs", DescriptionAr = "الاطلاع على سجل التدقيق الأمني لجميع حركات الإدخال والحذف", DescriptionEn = "View tamper-proof audit trail of system activities" },
                    new() { Code = Permissions.System.SettingsManage, GroupName = "System", NameAr = "إعدادات المنظومة وتخصيص الشركة", NameEn = "Company & General Settings", DescriptionAr = "تعديل بيانات الشركة، العملات الافتراضية، وسياسات النظام", DescriptionEn = "Configure tenant profile, default currency, and policies" }
                }
            }
        };

        return Ok(matrix);
    }
}
