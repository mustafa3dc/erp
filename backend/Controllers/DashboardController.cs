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
    private readonly IRecurringExpenseService _recurringExpenseService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        AppDbContext context,
        IPartnersService partnersService,
        IRecurringExpenseService recurringExpenseService,
        ILogger<DashboardController> logger)
    {
        _context = context;
        _partnersService = partnersService;
        _recurringExpenseService = recurringExpenseService;
        _logger = logger;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<DashboardSummaryDto>>> GetSummary(
        [FromQuery] string? period = "today",
        [FromQuery] Guid? warehouseId = null,
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
            if (warehouseId.HasValue && warehouseId.Value != Guid.Empty)
            {
                invQuery = invQuery.Where(i => i.WarehouseId == warehouseId.Value);
            }
            if (start.HasValue)
            {
                invQuery = invQuery.Where(i => i.CreatedAt >= start.Value);
            }
            var invoicesCount = await invQuery.CountAsync(ct);

            if (canViewProfitsOrPartners)
            {
                partnersSummary = await _partnersService.GetSummaryAsync(normPeriod, ct, warehouseId);
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

            // Live Treasury Liquidity (Cashboxes vs Bank/Digital accounts)
            decimal treasuryCashBalance = 0m;
            decimal treasuryBankBalance = 0m;
            try
            {
                var activeBoxes = await _context.CashBoxes
                    .AsNoTracking()
                    .Where(cb => cb.IsActive)
                    .Select(cb => new { cb.AccountType, cb.CurrentBalance })
                    .ToListAsync(ct);

                foreach (var cb in activeBoxes)
                {
                    var type = (cb.AccountType ?? "Cashbox").Trim();
                    if (string.Equals(type, "BankAccount", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(type, "DigitalWallet", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(type, "BANK", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(type, "WALLET", StringComparison.OrdinalIgnoreCase))
                    {
                        treasuryBankBalance += cb.CurrentBalance;
                    }
                    else
                    {
                        treasuryCashBalance += cb.CurrentBalance;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Dashboard summary treasury query warning.");
            }

            // Inventory Valuation & Low Stock Alert Count
            decimal inventoryValuation = 0m;
            int lowStockCount = 0;
            try
            {
                var physicalProducts = await _context.Products
                    .AsNoTracking()
                    .Include(p => p.WarehouseStocks)
                    .Where(p => p.IsActive && !p.IsBundle)
                    .ToListAsync(ct);

                foreach (var p in physicalProducts)
                {
                    var qty = warehouseId.HasValue && warehouseId.Value != Guid.Empty
                        ? p.WarehouseStocks.Where(ws => ws.WarehouseId == warehouseId.Value).Sum(ws => Math.Max(0, ws.Quantity))
                        : p.WarehouseStocks.Sum(ws => Math.Max(0, ws.Quantity));

                    if (qty <= p.MinStockLevel)
                    {
                        lowStockCount++;
                    }
                    if (canViewProfitsOrPartners)
                    {
                        inventoryValuation += p.CostPrice * qty;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Dashboard summary inventory query warning.");
            }

            // Customer Receivables & Overdue Installments Summary
            decimal receivablesTotalBalance = 0m;
            int receivablesCustomersCount = 0;
            int overdueInstallmentsCount = 0;
            decimal overdueInstallmentsAmount = 0m;
            decimal totalInstallmentsRemaining = 0m;
            try
            {
                var creditCustomers = await _context.Customers
                    .AsNoTracking()
                    .Where(c => !c.IsDefaultCashCustomer && c.CurrentBalance > 0m)
                    .Select(c => c.CurrentBalance)
                    .ToListAsync(ct);

                receivablesCustomersCount = creditCustomers.Count;
                receivablesTotalBalance = creditCustomers.Sum();

                var nowUtc = DateTime.UtcNow;
                var overdueSchedules = await _context.InstallmentScheduleItems
                    .AsNoTracking()
                    .Where(s => s.DueDate < nowUtc && s.Status != InstallmentScheduleStatus.Paid)
                    .Select(s => new { s.Amount, s.PaidAmount })
                    .ToListAsync(ct);

                overdueInstallmentsCount = overdueSchedules.Count;
                overdueInstallmentsAmount = overdueSchedules.Sum(s => Math.Max(0m, s.Amount - s.PaidAmount));

                totalInstallmentsRemaining = await _context.InstallmentContracts
                    .AsNoTracking()
                    .Where(c => c.Status == InstallmentContractStatus.Active)
                    .SumAsync(c => (decimal?)c.RemainingAmount, ct) ?? 0m;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Dashboard summary receivables/installments query warning.");
            }

            var dueRecurringExpenses = canViewProfitsOrPartners
                ? await _recurringExpenseService.GetDueForDashboardAsync(ct)
                : new List<RecurringExpenseDto>();

            return Ok(ApiResponse<DashboardSummaryDto>.Ok(new DashboardSummaryDto
            {
                Period = normPeriod,
                CanViewProfits = canViewProfitsOrPartners,
                TotalRevenue = Math.Round(totalRevenue, 4),
                TotalExpenses = Math.Round(totalExpenses, 4),
                NetProfit = Math.Round(netProfit, 4),
                InvoicesCount = invoicesCount,
                TreasuryCashBalance = Math.Round(treasuryCashBalance, 4),
                TreasuryBankBalance = Math.Round(treasuryBankBalance, 4),
                TreasuryTotalBalance = Math.Round(treasuryCashBalance + treasuryBankBalance, 4),
                InventoryValuation = Math.Round(inventoryValuation, 4),
                LowStockCount = lowStockCount,
                ReceivablesTotalBalance = Math.Round(receivablesTotalBalance, 4),
                ReceivablesCustomersCount = receivablesCustomersCount,
                OverdueInstallmentsCount = overdueInstallmentsCount,
                OverdueInstallmentsAmount = Math.Round(overdueInstallmentsAmount, 4),
                TotalInstallmentsRemaining = Math.Round(totalInstallmentsRemaining, 4),
                PartnersSummary = partnersSummary,
                DueRecurringExpensesCount = dueRecurringExpenses.Count,
                DueRecurringExpenses = dueRecurringExpenses
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
