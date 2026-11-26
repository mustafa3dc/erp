using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/dashboard")]
[Route("api/v1/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPartnersService _partnersService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        AppDbContext context,
        IPartnersService partnersService,
        ILogger<DashboardController> logger)
    {
        _context = context;
        _partnersService = partnersService;
        _logger = logger;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<DashboardSummaryDto>>> GetSummary(
        [FromQuery] string? period = "today",
        CancellationToken ct = default)
    {
        try
        {
            var canViewProfitsOrPartners = HasProfitOrPartnerPermission();
            PartnersSummaryResponseDto? partnersSummary = null;

            decimal totalRevenue;
            decimal totalExpenses;
            decimal netProfit;

            var normPeriod = (period ?? "today").Trim().ToLowerInvariant();
            DateTime? start = normPeriod switch
            {
                "today" => DateTime.UtcNow.Date,
                "week" => DateTime.UtcNow.Date.AddDays(-6),
                "all" => null,
                _ => new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc)
            };

            var invQuery = _context.SalesInvoices
                .AsNoTracking()
                .Where(i => i.PaymentStatus == "PAID");
            if (start.HasValue)
            {
                invQuery = invQuery.Where(i => i.CreatedAt >= start.Value);
            }
            var invoicesCount = await invQuery.CountAsync(ct);

            if (canViewProfitsOrPartners)
            {
                partnersSummary = await _partnersService.GetSummaryAsync(normPeriod, ct);
                totalRevenue = partnersSummary.TotalRevenue;
                totalExpenses = partnersSummary.TotalExpenses;
                netProfit = partnersSummary.TotalNetProfit;
            }
            else
            {
                // Standard cashiers receive non-sensitive counts/totals only; profit & partnersSummary are strictly null
                totalRevenue = await invQuery.SumAsync(i => (decimal?)i.TotalAmount, ct) ?? 0m;
                totalExpenses = 0m;
                netProfit = 0m;
                partnersSummary = null;
            }

            return Ok(ApiResponse<DashboardSummaryDto>.Ok(new DashboardSummaryDto
            {
                Period = normPeriod,
                TotalRevenue = totalRevenue,
                TotalExpenses = totalExpenses,
                NetProfit = netProfit,
                InvoicesCount = invoicesCount,
                PartnersSummary = partnersSummary
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error computing dashboard summary");
            return StatusCode(500, ApiResponse<DashboardSummaryDto>.Fail("ERR_DASHBOARD_SUMMARY_FAILED", "DASHBOARD"));
        }
    }

    private bool HasProfitOrPartnerPermission()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "PlatformSuperAdmin", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (string.Equals(role, "Cashier", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Storekeeper", StringComparison.OrdinalIgnoreCase))
        {
            // Unless explicitly granted ManagePartners / ViewProfits claims
        }

        var perms = User.FindAll("permissions")
            .Select(c => c.Value)
            .Concat(User.FindAll("permission").Select(c => c.Value))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return perms.Contains(Permissions.Treasury.PartnersManage)
               || perms.Contains("finance.partners.manage")
               || perms.Contains("ViewProfits")
               || perms.Contains("ManagePartners")
               || perms.Contains(Permissions.Reports.FinancialReports)
               || perms.Contains(Permissions.Reports.ExecutiveView)
               || perms.Contains(Permissions.Inventory.CostPriceView)
               || perms.Contains("*")
               || perms.Contains("all");
    }
}
