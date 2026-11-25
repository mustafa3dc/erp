using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public record CheckoutLoyaltyResult(
    decimal PointsEarned,
    decimal PointsRedeemed,
    decimal LoyaltyDiscountAmount,
    decimal RealizedProfit,
    decimal CustomerBalanceAfter
);

public interface ILoyaltyService
{
    Task<LoyaltySettingsDto> GetSettingsAsync(CancellationToken ct = default);
    Task<LoyaltySettingsDto> UpdateSettingsAsync(UpdateLoyaltySettingsRequestDto request, string actorName, CancellationToken ct = default);
    Task<CustomerLoyaltySummaryDto?> GetCustomerLoyaltySummaryAsync(Guid customerId, CancellationToken ct = default);
    Task<List<LoyaltyTransactionDto>> GetTransactionsAsync(Guid? customerId = null, int limit = 100, CancellationToken ct = default);
    Task<LoyaltyTransactionDto> AdjustPointsManuallyAsync(LoyaltyManualAdjustmentDto request, string actorName, CancellationToken ct = default);

    Task<CheckoutLoyaltyResult> ApplyCheckoutLoyaltyInTransactionAsync(
        Customer customer,
        SalesInvoice invoice,
        decimal lineProfitsSum,
        decimal otherInvoiceDiscounts,
        decimal maxRedeemableCurrencyCap,
        decimal requestedRedeemPoints,
        string actorName,
        CancellationToken ct = default);

    Task<decimal> ReversePointsForReturnInTransactionAsync(
        SalesInvoice invoice,
        SalesInvoiceItem returnedItem,
        RmaReturnRequest rmaRecord,
        decimal returnedUnitCost,
        string actorName,
        CancellationToken ct = default);
}

public class LoyaltyService : ILoyaltyService
{
    private readonly AppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public LoyaltyService(AppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    public async Task<LoyaltySettingsDto> GetSettingsAsync(CancellationToken ct = default)
    {
        var entity = await GetEffectiveSettingsEntityAsync(ct);
        return MapSettingsToDto(entity);
    }

    public async Task<LoyaltySettingsDto> UpdateSettingsAsync(
        UpdateLoyaltySettingsRequestDto request,
        string actorName,
        CancellationToken ct = default)
    {
        if (request.ProfitUnitAmount <= 0m || request.PointsEarnedPerUnit < 0m ||
            request.PointsRedemptionUnit <= 0m || request.CurrencyValuePerUnit < 0m ||
            request.MinRedeemablePoints < 0m)
        {
            throw new ApplicationException("ERR_INVALID_LOYALTY_CONFIG");
        }

        var tenantId = _tenantProvider.CurrentTenantId;
        var existing = await _context.LoyaltySettings
            .FirstOrDefaultAsync(ls => ls.TenantId == tenantId, ct);

        var now = DateTime.UtcNow;
        if (existing == null)
        {
            existing = new LoyaltySettings
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                IsLoyaltyEnabled = request.IsLoyaltyEnabled,
                ProfitUnitAmount = request.ProfitUnitAmount,
                PointsEarnedPerUnit = request.PointsEarnedPerUnit,
                PointsRedemptionUnit = request.PointsRedemptionUnit,
                CurrencyValuePerUnit = request.CurrencyValuePerUnit,
                MinRedeemablePoints = request.MinRedeemablePoints,
                UpdatedBy = actorName,
                CreatedAt = now,
                UpdatedAt = now
            };
            _context.LoyaltySettings.Add(existing);
        }
        else
        {
            existing.IsLoyaltyEnabled = request.IsLoyaltyEnabled;
            existing.ProfitUnitAmount = request.ProfitUnitAmount;
            existing.PointsEarnedPerUnit = request.PointsEarnedPerUnit;
            existing.PointsRedemptionUnit = request.PointsRedemptionUnit;
            existing.CurrencyValuePerUnit = request.CurrencyValuePerUnit;
            existing.MinRedeemablePoints = request.MinRedeemablePoints;
            existing.UpdatedBy = actorName;
            existing.UpdatedAt = now;
        }

        await _context.SaveChangesAsync(ct);
        return MapSettingsToDto(existing);
    }

    public async Task<CustomerLoyaltySummaryDto?> GetCustomerLoyaltySummaryAsync(Guid customerId, CancellationToken ct = default)
    {
        var customer = await _context.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == customerId && c.IsActive, ct);

        if (customer == null) return null;

        var settings = await GetEffectiveSettingsEntityAsync(ct);
        var txs = await GetTransactionsAsync(customerId, 100, ct);
        var currencyEquivalent = settings.PointsRedemptionUnit > 0m
            ? Math.Round((customer.LoyaltyPointsBalance / settings.PointsRedemptionUnit) * settings.CurrencyValuePerUnit, 4)
            : 0m;

        return new CustomerLoyaltySummaryDto
        {
            CustomerId = customer.Id,
            CustomerName = customer.Name,
            IsDefaultCashCustomer = customer.IsDefaultCashCustomer,
            LoyaltyPointsBalance = customer.LoyaltyPointsBalance,
            MinRedeemablePoints = settings.MinRedeemablePoints,
            CurrencyEquivalent = Math.Max(0m, currencyEquivalent),
            IsLoyaltyEnabled = settings.IsLoyaltyEnabled,
            IsEligibleToRedeem = settings.IsLoyaltyEnabled
                && !customer.IsDefaultCashCustomer
                && customer.LoyaltyPointsBalance >= settings.MinRedeemablePoints,
            Transactions = txs
        };
    }

    public async Task<List<LoyaltyTransactionDto>> GetTransactionsAsync(Guid? customerId = null, int limit = 100, CancellationToken ct = default)
    {
        var query = _context.LoyaltyTransactions
            .Include(lt => lt.Customer)
            .Include(lt => lt.Invoice)
            .Include(lt => lt.ReturnRequest)
            .AsNoTracking()
            .OrderByDescending(lt => lt.CreatedAt)
            .AsQueryable();

        if (customerId.HasValue && customerId.Value != Guid.Empty)
        {
            query = query.Where(lt => lt.CustomerId == customerId.Value);
        }

        return await query
            .Take(Math.Clamp(limit, 1, 500))
            .Select(lt => new LoyaltyTransactionDto
            {
                Id = lt.Id,
                CustomerId = lt.CustomerId,
                CustomerName = lt.Customer != null ? lt.Customer.Name : null,
                InvoiceId = lt.InvoiceId,
                InvoiceNumber = lt.Invoice != null ? lt.Invoice.InvoiceNumber : null,
                ReturnId = lt.ReturnId,
                RmaNumber = lt.ReturnRequest != null ? lt.ReturnRequest.RmaNumber : null,
                Type = lt.Type,
                PointsChange = lt.PointsChange,
                ProfitBasis = lt.ProfitBasis,
                BalanceAfter = lt.BalanceAfter,
                Notes = lt.Notes,
                CreatedBy = lt.CreatedBy,
                CreatedAt = lt.CreatedAt
            })
            .ToListAsync(ct);
    }

    public async Task<LoyaltyTransactionDto> AdjustPointsManuallyAsync(
        LoyaltyManualAdjustmentDto request,
        string actorName,
        CancellationToken ct = default)
    {
        var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId && c.IsActive, ct);
        if (customer == null)
        {
            throw new ApplicationException("ERR_CUSTOMER_NOT_FOUND");
        }
        if (customer.IsDefaultCashCustomer || string.Equals(customer.Code, "WALK-IN-CASH", StringComparison.OrdinalIgnoreCase))
        {
            throw new ApplicationException("ERR_LOYALTY_WALKIN_NOT_ALLOWED");
        }

        var now = DateTime.UtcNow;
        customer.LoyaltyPointsBalance = Math.Round(customer.LoyaltyPointsBalance + request.PointsChange, 4);
        customer.UpdatedAt = now;

        var entry = new LoyaltyTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = customer.TenantId ?? _tenantProvider.CurrentTenantId,
            CustomerId = customer.Id,
            Type = LoyaltyTransactionTypes.ManualAdjustment,
            PointsChange = Math.Round(request.PointsChange, 4),
            ProfitBasis = 0.0000m,
            BalanceAfter = customer.LoyaltyPointsBalance,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? "Manual adjustment" : request.Notes.Trim(),
            CreatedBy = actorName,
            CreatedAt = now
        };

        _context.LoyaltyTransactions.Add(entry);
        await _context.SaveChangesAsync(ct);

        return new LoyaltyTransactionDto
        {
            Id = entry.Id,
            CustomerId = entry.CustomerId,
            CustomerName = customer.Name,
            Type = entry.Type,
            PointsChange = entry.PointsChange,
            ProfitBasis = entry.ProfitBasis,
            BalanceAfter = entry.BalanceAfter,
            Notes = entry.Notes,
            CreatedBy = entry.CreatedBy,
            CreatedAt = entry.CreatedAt
        };
    }

    public async Task<CheckoutLoyaltyResult> ApplyCheckoutLoyaltyInTransactionAsync(
        Customer customer,
        SalesInvoice invoice,
        decimal lineProfitsSum,
        decimal otherInvoiceDiscounts,
        decimal maxRedeemableCurrencyCap,
        decimal requestedRedeemPoints,
        string actorName,
        CancellationToken ct = default)
    {
        var settings = await GetEffectiveSettingsEntityAsync(ct);
        var now = DateTime.UtcNow;
        bool isWalkIn = customer.IsDefaultCashCustomer || string.Equals(customer.Code, "WALK-IN-CASH", StringComparison.OrdinalIgnoreCase);

        decimal redeemedPoints = 0.0000m;
        decimal loyaltyDiscount = 0.0000m;

        // 1. Points Redemption (Atomic validation & deduction)
        if (requestedRedeemPoints > 0m)
        {
            if (!settings.IsLoyaltyEnabled)
            {
                throw new ApplicationException("ERR_LOYALTY_DISABLED");
            }
            if (isWalkIn)
            {
                throw new ApplicationException("ERR_LOYALTY_WALKIN_NOT_ALLOWED");
            }
            if (customer.LoyaltyPointsBalance < settings.MinRedeemablePoints)
            {
                throw new ApplicationException("ERR_BELOW_MIN_REDEEM_POINTS");
            }
            if (requestedRedeemPoints > customer.LoyaltyPointsBalance)
            {
                throw new ApplicationException("ERR_INSUFFICIENT_LOYALTY_POINTS");
            }

            if (settings.PointsRedemptionUnit > 0m && settings.CurrencyValuePerUnit > 0m && maxRedeemableCurrencyCap > 0m)
            {
                var requestedDiscount = Math.Round((requestedRedeemPoints / settings.PointsRedemptionUnit) * settings.CurrencyValuePerUnit, 4);
                loyaltyDiscount = Math.Min(requestedDiscount, Math.Max(0m, maxRedeemableCurrencyCap));

                redeemedPoints = requestedDiscount > 0m && loyaltyDiscount < requestedDiscount
                    ? Math.Round((loyaltyDiscount / settings.CurrencyValuePerUnit) * settings.PointsRedemptionUnit, 4)
                    : Math.Round(requestedRedeemPoints, 4);

                redeemedPoints = Math.Min(redeemedPoints, customer.LoyaltyPointsBalance);

                if (redeemedPoints > 0m)
                {
                    customer.LoyaltyPointsBalance = Math.Round(customer.LoyaltyPointsBalance - redeemedPoints, 4);
                    customer.UpdatedAt = now;

                    _context.LoyaltyTransactions.Add(new LoyaltyTransaction
                    {
                        Id = Guid.NewGuid(),
                        TenantId = customer.TenantId ?? _tenantProvider.CurrentTenantId,
                        CustomerId = customer.Id,
                        InvoiceId = invoice.Id,
                        Type = LoyaltyTransactionTypes.Redeemed,
                        PointsChange = -redeemedPoints,
                        ProfitBasis = 0.0000m,
                        BalanceAfter = customer.LoyaltyPointsBalance,
                        Notes = $"Redeemed {redeemedPoints:0.##} pts for discount on {invoice.InvoiceNumber}",
                        CreatedBy = actorName,
                        CreatedAt = now
                    });
                }
            }
        }

        // 2. Profit-Based Points Earning (Strictly Actual Realized Profit, Registered Customers Only)
        decimal realizedProfit = Math.Round(Math.Max(0m, lineProfitsSum - otherInvoiceDiscounts - loyaltyDiscount), 4);
        decimal earnedPoints = 0.0000m;

        if (settings.IsLoyaltyEnabled && !isWalkIn && realizedProfit > 0m && settings.ProfitUnitAmount > 0m && settings.PointsEarnedPerUnit > 0m)
        {
            earnedPoints = Math.Floor((realizedProfit / settings.ProfitUnitAmount) * settings.PointsEarnedPerUnit);
            if (earnedPoints > 0m)
            {
                customer.LoyaltyPointsBalance = Math.Round(customer.LoyaltyPointsBalance + earnedPoints, 4);
                customer.UpdatedAt = now;

                _context.LoyaltyTransactions.Add(new LoyaltyTransaction
                {
                    Id = Guid.NewGuid(),
                    TenantId = customer.TenantId ?? _tenantProvider.CurrentTenantId,
                    CustomerId = customer.Id,
                    InvoiceId = invoice.Id,
                    Type = LoyaltyTransactionTypes.Earned,
                    PointsChange = earnedPoints,
                    ProfitBasis = realizedProfit,
                    BalanceAfter = customer.LoyaltyPointsBalance,
                    Notes = $"Earned from invoice {invoice.InvoiceNumber} realized profit",
                    CreatedBy = actorName,
                    CreatedAt = now.AddMilliseconds(1)
                });
            }
        }

        return new CheckoutLoyaltyResult(
            PointsEarned: earnedPoints,
            PointsRedeemed: redeemedPoints,
            LoyaltyDiscountAmount: loyaltyDiscount,
            RealizedProfit: realizedProfit,
            CustomerBalanceAfter: customer.LoyaltyPointsBalance
        );
    }

    public async Task<decimal> ReversePointsForReturnInTransactionAsync(
        SalesInvoice invoice,
        SalesInvoiceItem returnedItem,
        RmaReturnRequest rmaRecord,
        decimal returnedUnitCost,
        string actorName,
        CancellationToken ct = default)
    {
        if (!invoice.CustomerId.HasValue || invoice.CustomerId.Value == Guid.Empty || invoice.LoyaltyPointsEarned <= 0m)
        {
            return 0m;
        }

        // Idempotency check: never reverse the same RMA twice
        bool alreadyReversed = await _context.LoyaltyTransactions
            .AnyAsync(lt => lt.ReturnId == rmaRecord.Id && lt.Type == LoyaltyTransactionTypes.ReversedOnReturn, ct);
        if (alreadyReversed)
        {
            return 0m;
        }

        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == invoice.CustomerId.Value, ct);
        if (customer == null || customer.IsDefaultCashCustomer || string.Equals(customer.Code, "WALK-IN-CASH", StringComparison.OrdinalIgnoreCase))
        {
            return 0m;
        }

        var previouslyReversed = await _context.LoyaltyTransactions
            .Where(lt => lt.InvoiceId == invoice.Id && lt.Type == LoyaltyTransactionTypes.ReversedOnReturn)
            .SumAsync(lt => lt.PointsChange < 0 ? -lt.PointsChange : lt.PointsChange, ct);

        decimal remainingEarnedOnInvoice = Math.Max(0m, invoice.LoyaltyPointsEarned - previouslyReversed);
        if (remainingEarnedOnInvoice <= 0m)
        {
            return 0m;
        }

        var settings = await GetEffectiveSettingsEntityAsync(ct);

        decimal returnedLineProfit = Math.Round(Math.Max(0m, (returnedItem.UnitPrice - returnedUnitCost) * rmaRecord.ReturnQuantity), 4);
        decimal totalInvoiceLineProfit = invoice.Items.Sum(it =>
        {
            var cost = it.UnitCostPrice > 0m ? it.UnitCostPrice : (it.Id == returnedItem.Id ? returnedUnitCost : it.Product?.CostPrice ?? 0m);
            return Math.Max(0m, (it.UnitPrice - cost) * it.Quantity);
        });

        decimal proportionalProfitBasis = returnedLineProfit;
        if (totalInvoiceLineProfit > 0m && invoice.RealizedProfit > 0m && invoice.RealizedProfit < totalInvoiceLineProfit)
        {
            // Adjust proportionally if invoice-level discount / loyalty redemption reduced realized profit below gross line profit
            proportionalProfitBasis = Math.Round(returnedLineProfit * (invoice.RealizedProfit / totalInvoiceLineProfit), 4);
        }

        // Check if entire invoice is now returned so we eliminate rounding residue
        int totalSoldQty = invoice.Items.Sum(it => it.Quantity);
        int cumulativeReturnedQty = await _context.RmaReturnRequests
            .Where(r => (r.InvoiceId == invoice.Id || r.InvoiceNumber == invoice.InvoiceNumber)
                        && r.Decision != "REJECTED"
                        && (r.Decision == "APPROVED_RESTOCKED" || r.Id == rmaRecord.Id))
            .SumAsync(r => r.ReturnQuantity, ct);

        decimal pointsToReverse;
        if (totalSoldQty > 0 && cumulativeReturnedQty >= totalSoldQty)
        {
            pointsToReverse = remainingEarnedOnInvoice;
        }
        else if (totalInvoiceLineProfit > 0m)
        {
            pointsToReverse = Math.Floor((returnedLineProfit / totalInvoiceLineProfit) * invoice.LoyaltyPointsEarned);
            if (pointsToReverse <= 0m && settings.ProfitUnitAmount > 0m && settings.PointsEarnedPerUnit > 0m)
            {
                pointsToReverse = Math.Floor((proportionalProfitBasis / settings.ProfitUnitAmount) * settings.PointsEarnedPerUnit);
            }
            pointsToReverse = Math.Min(pointsToReverse, remainingEarnedOnInvoice);
        }
        else
        {
            pointsToReverse = 0m;
        }

        if (pointsToReverse <= 0m)
        {
            return 0m;
        }

        var now = DateTime.UtcNow;
        customer.LoyaltyPointsBalance = Math.Round(customer.LoyaltyPointsBalance - pointsToReverse, 4);
        customer.UpdatedAt = now;

        _context.LoyaltyTransactions.Add(new LoyaltyTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = customer.TenantId ?? invoice.TenantId ?? _tenantProvider.CurrentTenantId,
            CustomerId = customer.Id,
            InvoiceId = invoice.Id,
            ReturnId = rmaRecord.Id,
            Type = LoyaltyTransactionTypes.ReversedOnReturn,
            PointsChange = -pointsToReverse,
            ProfitBasis = proportionalProfitBasis,
            BalanceAfter = customer.LoyaltyPointsBalance,
            Notes = $"Reversed on return {rmaRecord.RmaNumber} for invoice {invoice.InvoiceNumber}",
            CreatedBy = actorName,
            CreatedAt = now
        });

        return pointsToReverse;
    }

    private async Task<LoyaltySettings> GetEffectiveSettingsEntityAsync(CancellationToken ct)
    {
        var tenantId = _tenantProvider.CurrentTenantId;
        var entity = await _context.LoyaltySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(ls => ls.TenantId == tenantId, ct);

        if (entity == null && tenantId.HasValue)
        {
            entity = await _context.LoyaltySettings
                .AsNoTracking()
                .FirstOrDefaultAsync(ls => ls.TenantId == null, ct);
        }

        return entity ?? new LoyaltySettings
        {
            TenantId = tenantId,
            IsLoyaltyEnabled = true,
            ProfitUnitAmount = 1000.0000m,
            PointsEarnedPerUnit = 10.0000m,
            PointsRedemptionUnit = 100.0000m,
            CurrencyValuePerUnit = 1000.0000m,
            MinRedeemablePoints = 500.0000m
        };
    }

    private static LoyaltySettingsDto MapSettingsToDto(LoyaltySettings entity) => new()
    {
        IsLoyaltyEnabled = entity.IsLoyaltyEnabled,
        ProfitUnitAmount = entity.ProfitUnitAmount,
        PointsEarnedPerUnit = entity.PointsEarnedPerUnit,
        PointsRedemptionUnit = entity.PointsRedemptionUnit,
        CurrencyValuePerUnit = entity.CurrencyValuePerUnit,
        MinRedeemablePoints = entity.MinRedeemablePoints,
        UpdatedAt = entity.UpdatedAt
    };
}
