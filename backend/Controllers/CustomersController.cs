using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/customers")]
[Route("api/v1/customers")]
public class CustomersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILoyaltyService _loyaltyService;

    public CustomersController(AppDbContext context, ILoyaltyService loyaltyService)
    {
        _context = context;
        _loyaltyService = loyaltyService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetCustomers([FromQuery] string? search)
    {
        var query = _context.Customers
            .AsNoTracking()
            .Where(c => c.IsActive)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(s) ||
                c.Code.ToLower().Contains(s) ||
                (c.Phone != null && c.Phone.ToLower().Contains(s)));
        }

        var items = await query
            .OrderByDescending(c => c.IsDefaultCashCustomer)
            .ThenByDescending(c => c.CreatedAt)
            .Take(200)
            .Select(c => new
            {
                c.Id,
                c.Code,
                c.Name,
                c.Phone,
                c.Email,
                c.CreditLimit,
                c.CurrentBalance,
                c.LoyaltyPointsBalance,
                c.LoyaltyMemberCode,
                c.LoyaltyCardToken,
                c.NormalizedPhone,
                c.IsDefaultCashCustomer,
                c.CreatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("by-member-code/{code}")]
    public async Task<ActionResult<ApiResponse<PosCustomerLookupDto>>> GetByMemberCode(
        [FromRoute] string code,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return NotFound(ApiResponse<PosCustomerLookupDto>.Fail("ERR_CUSTOMER_NOT_FOUND", "LOYALTY"));
        }

        var normCode = code.Trim().ToUpperInvariant();
        var customer = await _context.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(c =>
                c.IsActive &&
                !c.IsDefaultCashCustomer &&
                c.LoyaltyMemberCode != null &&
                c.LoyaltyMemberCode.ToUpper() == normCode, ct);

        if (customer == null)
        {
            return NotFound(ApiResponse<PosCustomerLookupDto>.Fail("ERR_CUSTOMER_NOT_FOUND", "LOYALTY"));
        }

        return Ok(ApiResponse<PosCustomerLookupDto>.Ok(new PosCustomerLookupDto
        {
            Id = customer.Id,
            Code = customer.Code,
            Name = customer.Name,
            Phone = customer.Phone,
            LoyaltyMemberCode = customer.LoyaltyMemberCode,
            LoyaltyCardToken = customer.LoyaltyCardToken,
            LoyaltyPointsBalance = customer.LoyaltyPointsBalance,
            CreditLimit = customer.CreditLimit,
            CurrentBalance = customer.CurrentBalance,
            IsDefaultCashCustomer = customer.IsDefaultCashCustomer
        }));
    }

    [HttpGet("{customerId:guid}/loyalty")]
    public async Task<ActionResult<CustomerLoyaltySummaryDto>> GetCustomerLoyalty(
        [FromRoute] Guid customerId,
        CancellationToken ct)
    {
        var summary = await _loyaltyService.GetCustomerLoyaltySummaryAsync(customerId, ct);
        if (summary == null)
        {
            return NotFound(new { errorCode = "ERR_CUSTOMER_NOT_FOUND" });
        }
        return Ok(summary);
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateCustomer([FromBody] QuickCreateCustomerDto dto)
    {
        var trimmedName = dto.Name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            return BadRequest(new { errorCode = "ERR_CUSTOMER_NAME_REQUIRED" });
        }

        var now = DateTime.UtcNow;
        var trimmedPhone = dto.Phone?.Trim();
        var memberCode = !string.IsNullOrWhiteSpace(dto.LoyaltyMemberCode)
            ? dto.LoyaltyMemberCode.Trim().ToUpperInvariant()
            : LoyaltyTokenHelper.GenerateMemberCode();
        var cardToken = !string.IsNullOrWhiteSpace(dto.LoyaltyCardToken)
            ? dto.LoyaltyCardToken.Trim()
            : LoyaltyTokenHelper.GenerateUrlSafeCardToken();

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Code = string.IsNullOrWhiteSpace(dto.Code) ? $"CUST-{now:yyMMdd}-{Random.Shared.Next(1000, 9999)}" : dto.Code.Trim(),
            Name = trimmedName,
            Phone = trimmedPhone,
            NormalizedPhone = LoyaltyTokenHelper.NormalizePhone(trimmedPhone),
            Email = dto.Email?.Trim(),
            CreditLimit = dto.CreditLimit ?? 0m,
            LoyaltyPointsBalance = dto.LoyaltyPointsBalance ?? 0.0000m,
            LoyaltyMemberCode = memberCode,
            LoyaltyCardToken = cardToken,
            IsDefaultCashCustomer = false,
            IsActive = true,
            CreatedBy = User.Identity?.Name ?? "System",
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            customer.Id,
            customer.Code,
            customer.Name,
            customer.Phone,
            customer.CreditLimit,
            customer.CurrentBalance,
            customer.LoyaltyPointsBalance,
            customer.LoyaltyMemberCode,
            customer.LoyaltyCardToken,
            customer.NormalizedPhone,
            customer.IsDefaultCashCustomer,
            customer.CreatedAt
        });
    }

    [HttpPost("sync-loyalty-cards")]
    public async Task<ActionResult<ApiResponse<List<PosCustomerLookupDto>>>> SyncLoyaltyCards(
        [FromBody] List<QuickCreateCustomerDto> items,
        CancellationToken ct)
    {
        if (items == null || items.Count == 0)
        {
            return Ok(ApiResponse<List<PosCustomerLookupDto>>.Ok(new List<PosCustomerLookupDto>()));
        }

        var existing = await _context.Customers
            .Where(c => c.IsActive && !c.IsDefaultCashCustomer)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var results = new List<PosCustomerLookupDto>();

        foreach (var item in items.Take(200))
        {
            var trimmedName = item.Name?.Trim();
            if (string.IsNullOrWhiteSpace(trimmedName)) continue;
            var trimmedPhone = item.Phone?.Trim();
            var normPhone = LoyaltyTokenHelper.NormalizePhone(trimmedPhone);

            var matched = existing.FirstOrDefault(c =>
                (item.Id.HasValue && c.Id == item.Id.Value) ||
                (!string.IsNullOrWhiteSpace(item.LoyaltyCardToken) && c.LoyaltyCardToken == item.LoyaltyCardToken.Trim()) ||
                (!string.IsNullOrWhiteSpace(item.LoyaltyMemberCode) && string.Equals(c.LoyaltyMemberCode, item.LoyaltyMemberCode.Trim(), StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrWhiteSpace(normPhone) && c.NormalizedPhone == normPhone && string.Equals(c.Name.Trim(), trimmedName, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrWhiteSpace(item.Code) && string.Equals(c.Code, item.Code.Trim(), StringComparison.OrdinalIgnoreCase)));

            if (matched != null)
            {
                if (string.IsNullOrWhiteSpace(matched.LoyaltyMemberCode))
                {
                    matched.LoyaltyMemberCode = !string.IsNullOrWhiteSpace(item.LoyaltyMemberCode)
                        ? item.LoyaltyMemberCode.Trim().ToUpperInvariant()
                        : LoyaltyTokenHelper.GenerateMemberCode();
                }
                if (string.IsNullOrWhiteSpace(matched.LoyaltyCardToken))
                {
                    matched.LoyaltyCardToken = !string.IsNullOrWhiteSpace(item.LoyaltyCardToken)
                        ? item.LoyaltyCardToken.Trim()
                        : LoyaltyTokenHelper.GenerateUrlSafeCardToken();
                }
                if (!string.IsNullOrWhiteSpace(normPhone) && string.IsNullOrWhiteSpace(matched.NormalizedPhone))
                {
                    matched.NormalizedPhone = normPhone;
                }
            }
            else
            {
                matched = new Customer
                {
                    Id = item.Id.HasValue && item.Id.Value != Guid.Empty ? item.Id.Value : Guid.NewGuid(),
                    Code = !string.IsNullOrWhiteSpace(item.Code) ? item.Code.Trim() : $"CUST-{now:yyMMdd}-{Random.Shared.Next(1000, 9999)}",
                    Name = trimmedName,
                    Phone = trimmedPhone,
                    NormalizedPhone = normPhone,
                    Email = item.Email?.Trim(),
                    CreditLimit = item.CreditLimit ?? 0m,
                    LoyaltyPointsBalance = item.LoyaltyPointsBalance ?? 0.0000m,
                    LoyaltyMemberCode = !string.IsNullOrWhiteSpace(item.LoyaltyMemberCode)
                        ? item.LoyaltyMemberCode.Trim().ToUpperInvariant()
                        : LoyaltyTokenHelper.GenerateMemberCode(),
                    LoyaltyCardToken = !string.IsNullOrWhiteSpace(item.LoyaltyCardToken)
                        ? item.LoyaltyCardToken.Trim()
                        : LoyaltyTokenHelper.GenerateUrlSafeCardToken(),
                    IsDefaultCashCustomer = false,
                    IsActive = true,
                    CreatedBy = User.Identity?.Name ?? "Sync",
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _context.Customers.Add(matched);
                existing.Add(matched);
            }

            results.Add(new PosCustomerLookupDto
            {
                Id = matched.Id,
                Code = matched.Code,
                Name = matched.Name,
                Phone = matched.Phone,
                LoyaltyMemberCode = matched.LoyaltyMemberCode,
                LoyaltyCardToken = matched.LoyaltyCardToken,
                LoyaltyPointsBalance = matched.LoyaltyPointsBalance,
                CreditLimit = matched.CreditLimit,
                CurrentBalance = matched.CurrentBalance,
                IsDefaultCashCustomer = matched.IsDefaultCashCustomer
            });
        }

        await _context.SaveChangesAsync(ct);
        return Ok(ApiResponse<List<PosCustomerLookupDto>>.Ok(results));
    }
}

public class QuickCreateCustomerDto
{
    public Guid? Id { get; set; }
    public string? Code { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public decimal? CreditLimit { get; set; }
    public decimal? LoyaltyPointsBalance { get; set; }
    public string? LoyaltyMemberCode { get; set; }
    public string? LoyaltyCardToken { get; set; }
}
