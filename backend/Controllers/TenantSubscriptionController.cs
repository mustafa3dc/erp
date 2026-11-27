using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
public class TenantSubscriptionController : ControllerBase
{
    private readonly ITenantPlanService _planService;
    private readonly ITenantProvider _tenantProvider;
    private readonly AppDbContext _dbContext;
    private readonly ILogger<TenantSubscriptionController> _logger;

    public TenantSubscriptionController(
        ITenantPlanService planService,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        ILogger<TenantSubscriptionController> logger)
    {
        _planService = planService;
        _tenantProvider = tenantProvider;
        _dbContext = dbContext;
        _logger = logger;
    }

    [Authorize]
    [HttpGet("/api/tenant/subscription")]
    [HttpGet("/api/v1/tenant/subscription")]
    public async Task<ActionResult<ApiResponse<TenantSubscriptionDto>>> GetCurrentSubscription(CancellationToken ct)
    {
        var tenantId = _tenantProvider.GetCurrentTenantId();
        var tenantSlug = User.FindFirst("tenant_slug")?.Value
            ?? Request.Headers["X-Tenant-Slug"].FirstOrDefault();

        if ((!tenantId.HasValue || tenantId.Value == Guid.Empty) && !string.IsNullOrWhiteSpace(tenantSlug))
        {
            var slugLower = tenantSlug.Trim().ToLowerInvariant();
            tenantId = await _dbContext.Tenants
                .AsNoTracking()
                .Where(t => t.Slug.ToLower() == slugLower)
                .Select(t => (Guid?)t.Id)
                .FirstOrDefaultAsync(ct);
        }

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            var dto = await _planService.GetSubscriptionAsync(tenantId.Value, ct);
            if (dto != null)
            {
                return Ok(ApiResponse<TenantSubscriptionDto>.Ok(dto));
            }
        }

        // Demo / PlatformSuperAdmin fallback without DB tenant row
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (string.Equals(role, nameof(UserRole.PlatformSuperAdmin), StringComparison.OrdinalIgnoreCase))
        {
            var quotas = _planService.GetPlanQuotas(SubscriptionPlan.Enterprise);
            return Ok(ApiResponse<TenantSubscriptionDto>.Ok(new TenantSubscriptionDto
            {
                TenantId = Guid.Empty,
                TenantName = "Platform",
                TenantSlug = "platform",
                Plan = nameof(SubscriptionPlan.Enterprise),
                PlanType = SubscriptionPlan.Enterprise,
                BillingCycle = nameof(ERP.Warehouse.Api.Models.BillingCycle.Lifetime),
                BillingCycleType = ERP.Warehouse.Api.Models.BillingCycle.Lifetime,
                ExpiresAt = null,
                IsExpired = false,
                Usage = new TenantSubscriptionUsageDto
                {
                    MonthlyAiRequests = quotas.MonthlyAiRequests
                },
                Features = _planService.BuildFeatureDictionary(SubscriptionPlan.Enterprise)
            }));
        }

        if (!string.IsNullOrWhiteSpace(tenantSlug))
        {
            var inMemoryTenant = AuthController.GetTenantRecordBySlug(tenantSlug);
            if (inMemoryTenant != null)
            {
                var plan = TenantPlanService.ParsePlan(inMemoryTenant.Plan, SubscriptionPlan.Pro);
                var quotas = _planService.GetPlanQuotas(plan);
                return Ok(ApiResponse<TenantSubscriptionDto>.Ok(new TenantSubscriptionDto
                {
                    TenantId = Guid.TryParse(inMemoryTenant.Id, out var parsed) ? parsed : Guid.Empty,
                    TenantName = inMemoryTenant.Name,
                    TenantSlug = inMemoryTenant.Slug,
                    Plan = plan.ToString(),
                    PlanType = plan,
                    BillingCycle = nameof(ERP.Warehouse.Api.Models.BillingCycle.Monthly),
                    BillingCycleType = ERP.Warehouse.Api.Models.BillingCycle.Monthly,
                    ExpiresAt = inMemoryTenant.ExpiresAt,
                    IsExpired = inMemoryTenant.ExpiresAt < DateTime.UtcNow,
                    Usage = new TenantSubscriptionUsageDto
                    {
                        UsersCount = 1,
                        MaxUsers = quotas.MaxUsers,
                        WarehousesCount = 1,
                        MaxWarehouses = quotas.MaxWarehouses,
                        BranchesCount = 1,
                        MaxBranches = quotas.MaxBranches,
                        AiRequestsThisMonth = 0,
                        MonthlyAiRequests = quotas.MonthlyAiRequests
                    },
                    Features = _planService.BuildFeatureDictionary(plan)
                }));
            }
        }

        return NotFound(ApiResponse<TenantSubscriptionDto>.Fail("ERR_TENANT_NOT_FOUND", "SUBSCRIPTION"));
    }

    [Authorize]
    [HttpPut("/api/admin/tenants/{tenantId:guid}/subscription")]
    [HttpPut("/api/v1/admin/tenants/{tenantId:guid}/subscription")]
    [HttpPut("/api/super-admin/tenants/{tenantId:guid}/subscription")]
    [HttpPut("/api/v1/super-admin/tenants/{tenantId:guid}/subscription")]
    public async Task<ActionResult<ApiResponse<TenantSubscriptionDto>>> UpdateTenantSubscription(
        [FromRoute] Guid tenantId,
        [FromBody] UpdateTenantSubscriptionRequestDto request,
        CancellationToken ct)
    {
        var isAuthorizedAdmin = _tenantProvider.IsPlatformSuperAdmin;

        if (!isAuthorizedAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<TenantSubscriptionDto>.Fail("ERR_FORBIDDEN_PERMISSION_DENIED", "SUBSCRIPTION"));
        }

        if (request == null)
        {
            return BadRequest(ApiResponse<TenantSubscriptionDto>.Fail("ERR_INVALID_PAYLOAD", "SUBSCRIPTION"));
        }

        var parsedPlan = TenantPlanService.ParsePlan(request.Plan, SubscriptionPlan.Pro);
        var parsedCycle = TenantPlanService.ParseBillingCycle(request.BillingCycle, BillingCycle.Monthly);

        try
        {
            var updated = await _planService.UpdateSubscriptionAsync(
                tenantId,
                parsedPlan,
                parsedCycle,
                request.ExpiresAt,
                ct);

            if (updated == null)
            {
                return NotFound(ApiResponse<TenantSubscriptionDto>.Fail("ERR_TENANT_NOT_FOUND", "SUBSCRIPTION"));
            }

            return Ok(ApiResponse<TenantSubscriptionDto>.Ok(updated));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating subscription for tenant {TenantId}", tenantId);
            return StatusCode(500, ApiResponse<TenantSubscriptionDto>.Fail("ERR_SUBSCRIPTION_UPDATE_FAILED", "SUBSCRIPTION"));
        }
    }
}
