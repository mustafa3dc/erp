using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/customers")]
[Route("api/v1/customers")]
public class CustomersController : ControllerBase
{
    private readonly AppDbContext _context;

    public CustomersController(AppDbContext context)
    {
        _context = context;
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
                c.IsDefaultCashCustomer,
                c.CreatedAt
            })
            .ToListAsync();

        return Ok(items);
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
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Code = $"CUST-{now:yyMMdd}-{Random.Shared.Next(1000, 9999)}",
            Name = trimmedName,
            Phone = dto.Phone?.Trim(),
            Email = dto.Email?.Trim(),
            CreditLimit = dto.CreditLimit ?? 0m,
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
            customer.IsDefaultCashCustomer,
            customer.CreatedAt
        });
    }
}

public class QuickCreateCustomerDto
{
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public decimal? CreditLimit { get; set; }
}
