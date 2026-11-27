using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Authorization;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequiresPlanFeatureAttribute : TypeFilterAttribute
{
    public string FeatureKey { get; }

    public RequiresPlanFeatureAttribute(string featureKey)
        : base(typeof(PlanFeatureGateFilter))
    {
        FeatureKey = featureKey;
        Arguments = new object[] { featureKey };
    }
}

public sealed class PlanFeatureGateFilter : IAsyncActionFilter
{
    private readonly string _featureKey;
    private readonly ITenantPlanService _planService;
    private readonly ITenantProvider _tenantProvider;
    private readonly AppDbContext _dbContext;

    public PlanFeatureGateFilter(
        string featureKey,
        ITenantPlanService planService,
        ITenantProvider tenantProvider,
        AppDbContext dbContext)
    {
        _featureKey = featureKey;
        _planService = planService;
        _tenantProvider = tenantProvider;
        _dbContext = dbContext;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;
        var role = user.FindFirst(ClaimTypes.Role)?.Value ?? user.FindFirst("role")?.Value;

        if (string.Equals(role, nameof(UserRole.PlatformSuperAdmin), StringComparison.OrdinalIgnoreCase))
        {
            await next();
            return;
        }

        var tenantId = _tenantProvider.CurrentTenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            var tenantSlug = _tenantProvider.CurrentTenantSlug
                ?? user.FindFirst("tenant_slug")?.Value
                ?? context.HttpContext.Request.Headers["X-Tenant-Slug"].FirstOrDefault();

            if (!string.IsNullOrWhiteSpace(tenantSlug))
            {
                var slugLower = tenantSlug!.Trim().ToLowerInvariant();
                var dbTenantId = await _dbContext.Tenants
                    .AsNoTracking()
                    .Where(t => t.Slug.ToLower() == slugLower)
                    .Select(t => (Guid?)t.Id)
                    .FirstOrDefaultAsync(context.HttpContext.RequestAborted);
                if (dbTenantId.HasValue && dbTenantId.Value != Guid.Empty)
                {
                    tenantId = dbTenantId;
                }
            }
        }

        var check = await _planService.CheckFeatureAccessAsync(tenantId, _featureKey, context.HttpContext.RequestAborted);
        if (!check.IsAllowed)
        {
            context.Result = new ObjectResult(new
            {
                success = false,
                errorCode = "ERR_PLAN_FEATURE_LOCKED",
                details = new
                {
                    featureKey = check.FeatureKey,
                    currentPlan = check.CurrentPlan,
                    requiredPlan = check.RequiredPlan
                }
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            return;
        }

        await next();
    }
}
