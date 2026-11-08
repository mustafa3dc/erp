using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/v1/public/tenants")]
public class PublicTenantsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PublicTenantsController> _logger;

    public PublicTenantsController(
        AppDbContext dbContext,
        IConfiguration configuration,
        ILogger<PublicTenantsController> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/v1/public/tenants/check-slug/{slug}
    /// Instant real-time verification of tenant slug availability.
    /// </summary>
    [HttpGet("check-slug/{slug}")]
    public async Task<ActionResult> CheckSlugAvailability(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            return BadRequest(new { isAvailable = false, message = "رمز المنشأة مطلوب" });
        }

        var cleanSlug = slug.Trim().ToLowerInvariant();
        if (!Regex.IsMatch(cleanSlug, @"^[a-z0-9_-]{2,30}$"))
        {
            return Ok(new
            {
                isAvailable = false,
                cleanSlug,
                message = "يجب أن يتكون المعرّف من 2-30 حرفاً إنجليزياً أو أرقاماً فقط."
            });
        }

        var isTaken = await _dbContext.Tenants.AnyAsync(t => t.Slug.ToLower() == cleanSlug);
        return Ok(new
        {
            isAvailable = !isTaken,
            cleanSlug,
            message = isTaken 
                ? $"الرمز (@{cleanSlug}) محجوز مسبقاً، يرجى اختيار رمز آخر."
                : $"الرمز (@{cleanSlug}) متاح للاستخدام!"
        });
    }

    /// <summary>
    /// POST /api/v1/public/tenants/register
    /// 100% Automated Self-Service Onboarding.
    /// Executes within a single atomic database transaction to provision tenant,
    /// default warehouse, cash box, and root administrator.
    /// </summary>
    [HttpPost("register")]
    public async Task<ActionResult> RegisterSelfServiceTenant([FromBody] SelfServiceRegisterRequestDto dto)
    {
        // 1. Validation
        if (string.IsNullOrWhiteSpace(dto.CompanyName))
        {
            return BadRequest(new { message = "اسم الشركة أو المتجر مطلوب." });
        }

        var cleanSlug = (dto.Slug ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(cleanSlug) || !Regex.IsMatch(cleanSlug, @"^[a-z0-9_-]{2,30}$"))
        {
            return BadRequest(new { message = "رمز المنشأة المختصر (المعرّف) غير صالح. يجب أن يحتوي على أحرف إنجليزية وأرقام فقط." });
        }

        if (string.IsNullOrWhiteSpace(dto.AdminFullName))
        {
            return BadRequest(new { message = "الاسم الكامل للمدير مطلوب." });
        }

        var cleanAdminUsername = (dto.AdminUsername ?? "admin").Trim().ToLowerInvariant().Replace(" ", "");
        if (cleanAdminUsername.Contains('@'))
        {
            cleanAdminUsername = cleanAdminUsername.Split('@')[0];
        }

        if (string.IsNullOrWhiteSpace(cleanAdminUsername))
        {
            cleanAdminUsername = "admin";
        }

        if (string.IsNullOrWhiteSpace(dto.AdminPassword) || dto.AdminPassword.Length < 4)
        {
            return BadRequest(new { message = "كلمة المرور يجب ألا تقل عن 4 خانات." });
        }

        // 2. Global Uniqueness Check
        var isSlugTaken = await _dbContext.Tenants.AnyAsync(t => t.Slug.ToLower() == cleanSlug);
        if (isSlugTaken)
        {
            return Conflict(new { message = $"رمز المنشأة المختصر (@{cleanSlug}) محجوز مسبقاً من قِبل منشأة أخرى. يرجى اختيار رمز بديل." });
        }

        // 3. Atomic Database Transaction Execution
        await using var transaction = await _dbContext.Database.BeginTransactionAsync();

        try
        {
            var trialEndsAt = DateTime.UtcNow.AddDays(14);
            var maxWarehouses = Math.Clamp(dto.MaxWarehouses, 1, 100);
            var maxUsers = Math.Clamp(dto.MaxUsers, 3, 500);

            // Plan tier classification
            string planTier = !string.IsNullOrWhiteSpace(dto.Plan) ? dto.Plan : "Pro";
            if (string.IsNullOrWhiteSpace(dto.Plan))
            {
                if (maxWarehouses > 5 || maxUsers > 20)
                {
                    planTier = "Enterprise";
                }
                else if (maxWarehouses > 1 || maxUsers > 5)
                {
                    planTier = "Pro";
                }
                else
                {
                    planTier = "Starter";
                }
            }

            var featuresJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                wms = dto.WmsEnabled,
                pos = dto.PosEnabled
            });

            // Create Tenant
            var tenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Name = dto.CompanyName.Trim(),
                Slug = cleanSlug,
                CountryCode = string.IsNullOrWhiteSpace(dto.CountryCode) ? "IQ" : dto.CountryCode.ToUpperInvariant(),
                Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "IQD" : dto.Currency.ToUpperInvariant(),
                Plan = planTier,
                MaxBranches = maxWarehouses,
                MaxUsers = maxUsers,
                FeaturesEnabled = featuresJson,
                BillingCycle = dto.BillingCycle ?? "yearly",
                ContactInfo = dto.ContactInfo?.Trim(),
                TrialEndsAt = trialEndsAt,
                ExpiresAt = trialEndsAt,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _dbContext.Tenants.AddAsync(tenant);

            // Create Default Main Warehouse
            var warehouse = new Warehouse
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Code = "WH-01",
                Name = "المستودع الرئيسي",
                LocationAddress = "الفرع الرئيسي - الإدارة المركزية",
                ManagerName = dto.AdminFullName.Trim(),
                ContactPhone = dto.ContactInfo ?? "+964 770 000 0000",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _dbContext.Warehouses.AddAsync(warehouse);

            // Create Default Cash Box
            var cashBox = new CashBox
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Code = "CB-01",
                Name = "صندوق الكاش الافتراضي (الخزينة الرئيسية)",
                WarehouseId = warehouse.Id,
                Currency = tenant.Currency,
                CurrentBalance = 0.0000m,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _dbContext.CashBoxes.AddAsync(cashBox);

            // Create Root Administrator User (TenantOwner)
            var fullUsername = $"{cleanAdminUsername}@{cleanSlug}";
            var isEmail = !string.IsNullOrWhiteSpace(dto.ContactInfo) && dto.ContactInfo.Contains('@');

            var user = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Username = cleanAdminUsername,
                PasswordHash = PasswordHasher.Hash(dto.AdminPassword),
                FullName = dto.AdminFullName.Trim(),
                Email = isEmail ? dto.ContactInfo!.Trim() : $"{cleanAdminUsername}@{cleanSlug}.zilox.com",
                Phone = !isEmail && !string.IsNullOrWhiteSpace(dto.ContactInfo) ? dto.ContactInfo.Trim() : "+964 770 000 0000",
                Role = UserRole.SuperAdmin,
                BranchId = "WH-01",
                DefaultWarehouseId = "WH-01",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                Notes = "حساب مالك المنشأة الأول المنشأ آلياً عبر بوابة التسجيل الذاتي"
            };

            await _dbContext.Users.AddAsync(user);

            // Save and Commit Transaction
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("Successfully provisioned tenant {TenantName} ({Slug}) with initial user {Username}",
                tenant.Name, tenant.Slug, fullUsername);

            // Generate JWT Token for Immediate Frictionless Login
            var token = GenerateOnboardingToken(user, tenant);

            return Created(string.Empty, new
            {
                success = true,
                message = $"تهانينا! تم إنشاء بيئة منشأة \"{tenant.Name}\" بنجاح وبدء فترتك التجريبية لمدة 14 يوماً.",
                tenant = new
                {
                    tenant.Id,
                    tenant.Name,
                    tenant.Slug,
                    tenant.CountryCode,
                    tenant.Currency,
                    tenant.Plan,
                    tenant.MaxBranches,
                    tenant.MaxUsers,
                    tenant.TrialEndsAt,
                    Features = new { dto.WmsEnabled, dto.PosEnabled }
                },
                user = new
                {
                    user.Id,
                    user.FullName,
                    Username = fullUsername,
                    user.Role,
                    DefaultWarehouseId = "WH-01"
                },
                token,
                redirectUrl = "/dashboard"
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to self-register tenant {Slug}", cleanSlug);
            return StatusCode(500, new
            {
                success = false,
                message = "حدث خطأ غير متوقع أثناء تهيئة المنشأة. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.",
                error = ex.Message
            });
        }
    }

    private string GenerateOnboardingToken(User user, Tenant tenant)
    {
        var jwtSecret = _configuration["Jwt:Secret"] ?? "ZiloxERPEnterpriseSecretKey2026WithHighEntropy!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, $"{user.Username}@{tenant.Slug}"),
            new Claim("tenant_id", tenant.Id.ToString()),
            new Claim("tenant_slug", tenant.Slug),
            new Claim(ClaimTypes.Role, "SuperAdmin"),
            new Claim("full_name", user.FullName),
            new Claim("branch_id", user.BranchId)
        };

        var tokenDescriptor = new JwtSecurityToken(
            issuer: "ZiloxERP",
            audience: "ZiloxERPWeb",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
    }
}

public class SelfServiceRegisterRequestDto
{
    public string CompanyName { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string CountryCode { get; set; } = "IQ";
    public string Currency { get; set; } = "IQD";
    public string? Plan { get; set; } = "Pro";
    public int MaxWarehouses { get; set; } = 1;
    public int MaxUsers { get; set; } = 3;
    public bool WmsEnabled { get; set; } = false;
    public bool PosEnabled { get; set; } = true;
    public string? BillingCycle { get; set; } = "yearly";
    
    // First Admin
    public string AdminFullName { get; set; } = string.Empty;
    public string AdminUsername { get; set; } = "admin";
    public string AdminPassword { get; set; } = string.Empty;
    public string? ContactInfo { get; set; }
}
