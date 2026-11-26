using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/suppliers")]
[Route("api/v1/suppliers")]
public class SuppliersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<SuppliersController> _logger;

    public SuppliersController(AppDbContext context, ILogger<SuppliersController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private string CurrentActorName =>
        User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("username")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "System";

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetSuppliers([FromQuery] string? search = null)
    {
        var tenantId = _context.CurrentTenantId;
        var query = _context.Suppliers
            .AsNoTracking()
            .Where(s => s.IsActive && (!tenantId.HasValue || s.TenantId == tenantId.Value));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s =>
                s.CompanyName.ToLower().Contains(term) ||
                s.Code.ToLower().Contains(term) ||
                (s.Phone != null && s.Phone.ToLower().Contains(term)));
        }

        var suppliers = await query
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new
            {
                s.Id,
                s.Code,
                s.CompanyName,
                s.ContactPerson,
                s.Phone,
                s.Email,
                s.CurrentBalance,
                s.IsActive,
                s.CreatedAt
            })
            .ToListAsync();

        return Ok(suppliers);
    }

    [HttpPost]
    public async Task<IActionResult> CreateSupplier([FromBody] CreateSupplierDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.CompanyName))
        {
            return BadRequest(new { errorCode = "ERR_SUPPLIER_NAME_REQUIRED" });
        }

        var tenantId = _context.CurrentTenantId;
        var now = DateTime.UtcNow;
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = $"SUP-{now:yyMMdd}-{Random.Shared.Next(100, 999)}",
            CompanyName = dto.CompanyName.Trim(),
            ContactPerson = string.IsNullOrWhiteSpace(dto.ContactPerson) ? dto.CompanyName.Trim() : dto.ContactPerson.Trim(),
            Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
            Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim(),
            CurrentBalance = 0.0000m,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Suppliers.Add(supplier);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            supplier.Id,
            supplier.Code,
            supplier.CompanyName,
            supplier.ContactPerson,
            supplier.Phone,
            supplier.Email,
            supplier.CurrentBalance,
            supplier.IsActive,
            supplier.CreatedAt
        });
    }

    [HttpGet("{id:guid}/ledger")]
    public async Task<IActionResult> GetSupplierLedger(Guid id)
    {
        var tenantId = _context.CurrentTenantId;
        var exists = await _context.Suppliers
            .AsNoTracking()
            .AnyAsync(s => s.Id == id && s.IsActive && (!tenantId.HasValue || s.TenantId == tenantId.Value));

        if (!exists)
        {
            return NotFound(new { errorCode = "ERR_SUPPLIER_NOT_FOUND" });
        }

        var entries = await _context.SupplierLedgers
            .AsNoTracking()
            .Where(l => l.SupplierId == id && (!tenantId.HasValue || l.TenantId == tenantId.Value))
            .OrderByDescending(l => l.CreatedAt)
            .Take(200)
            .Select(l => new
            {
                l.Id,
                l.SupplierId,
                l.TransactionType,
                l.ReferenceId,
                l.ReferenceNumber,
                l.Debit,
                l.Credit,
                l.RunningBalance,
                l.Notes,
                l.CreatedAt
            })
            .ToListAsync();

        return Ok(entries);
    }

    /// <summary>
    /// Supplier Debt Settlement (سند دفع لمورد):
    /// Atomically verifies CashBox balance >= Amount, deducts from CashBox,
    /// records TreasuryTransaction outflow, reduces Supplier.CurrentBalance,
    /// and logs SupplierLedger PAYMENT_VOUCHER.
    /// </summary>
    [HttpPost("{id:guid}/payments")]
    public async Task<IActionResult> SettleSupplierDebt(Guid id, [FromBody] SupplierPaymentRequestDto dto)
    {
        var roundedAmount = Math.Round(dto.Amount, 4, MidpointRounding.AwayFromZero);
        if (roundedAmount <= 0m)
        {
            return BadRequest(new { errorCode = "ERR_INVALID_PAYMENT_AMOUNT" });
        }

        if (dto.CashAccountId == Guid.Empty)
        {
            return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_REQUIRED" });
        }

        var tenantId = _context.CurrentTenantId;
        var actorName = CurrentActorName;

        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            var supplier = await _context.Suppliers
                .FirstOrDefaultAsync(s => s.Id == id && s.IsActive && (!tenantId.HasValue || s.TenantId == tenantId.Value));

            if (supplier == null)
            {
                await transaction.RollbackAsync();
                return NotFound(new { errorCode = "ERR_SUPPLIER_NOT_FOUND" });
            }

            if (roundedAmount > supplier.CurrentBalance)
            {
                await transaction.RollbackAsync();
                return BadRequest(new
                {
                    errorCode = "ERR_PAYMENT_EXCEEDS_SUPPLIER_BALANCE",
                    currentBalance = supplier.CurrentBalance,
                    requestedAmount = roundedAmount
                });
            }

            var cashBox = await _context.CashBoxes
                .FirstOrDefaultAsync(cb => cb.Id == dto.CashAccountId && cb.IsActive && (!tenantId.HasValue || cb.TenantId == tenantId.Value));

            if (cashBox == null)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_NOT_FOUND" });
            }

            if (cashBox.CurrentBalance < roundedAmount)
            {
                await transaction.RollbackAsync();
                return BadRequest(new
                {
                    errorCode = "ERR_INSUFFICIENT_TREASURY_BALANCE",
                    availableBalance = cashBox.CurrentBalance,
                    requiredAmount = roundedAmount
                });
            }

            var previousCashBoxBalance = cashBox.CurrentBalance;
            var previousSupplierBalance = supplier.CurrentBalance;

            cashBox.CurrentBalance = Math.Round(cashBox.CurrentBalance - roundedAmount, 4, MidpointRounding.AwayFromZero);
            cashBox.UpdatedAt = DateTime.UtcNow;

            supplier.CurrentBalance = Math.Round(supplier.CurrentBalance - roundedAmount, 4, MidpointRounding.AwayFromZero);
            supplier.UpdatedAt = DateTime.UtcNow;

            var voucherNo = !string.IsNullOrWhiteSpace(dto.ReferenceNumber)
                ? dto.ReferenceNumber.Trim()
                : $"SUP-PAY-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";

            var notes = string.IsNullOrWhiteSpace(dto.Notes)
                ? $"{voucherNo} - {supplier.CompanyName}"
                : $"{voucherNo} - {supplier.CompanyName} | {dto.Notes.Trim()}";

            _context.SupplierLedgers.Add(new SupplierLedger
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SupplierId = supplier.Id,
                TransactionType = "PAYMENT_VOUCHER",
                ReferenceId = null,
                ReferenceNumber = voucherNo,
                Debit = roundedAmount,
                Credit = 0.0000m,
                RunningBalance = supplier.CurrentBalance,
                Notes = notes,
                CreatedAt = DateTime.UtcNow
            });

            _context.TreasuryTransactions.Add(new TreasuryTransaction
            {
                TenantId = tenantId,
                CashBoxId = cashBox.Id,
                SupplierId = supplier.Id,
                TransactionType = "PAYMENT",
                Amount = roundedAmount,
                BalanceAfter = cashBox.CurrentBalance,
                ReferenceNumber = voucherNo,
                Notes = notes.Length > 500 ? notes[..500] : notes,
                CreatedBy = actorName,
                CreatedAt = DateTimeOffset.UtcNow
            });

            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId,
                UserId = actorName,
                Username = actorName,
                Action = "SUPPLIER_PAYMENT",
                EntityName = "suppliers",
                EntityId = supplier.Id.ToString(),
                OldValues = JsonSerializer.Serialize(new
                {
                    SupplierBalance = previousSupplierBalance,
                    CashBoxBalance = previousCashBoxBalance
                }),
                NewValues = JsonSerializer.Serialize(new
                {
                    VoucherNumber = voucherNo,
                    PaidAmount = roundedAmount,
                    CashBoxId = cashBox.Id,
                    CashBoxBalance = cashBox.CurrentBalance,
                    SupplierBalance = supplier.CurrentBalance
                }),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                success = true,
                voucherNumber = voucherNo,
                supplierId = supplier.Id,
                supplierName = supplier.CompanyName,
                paidAmount = roundedAmount,
                supplierNewBalance = supplier.CurrentBalance,
                cashAccountId = cashBox.Id,
                cashAccountName = cashBox.Name,
                cashAccountNewBalance = cashBox.CurrentBalance
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to record supplier payment for supplier {SupplierId}", id);
            return StatusCode(500, new
            {
                success = false,
                errorCode = "ERR_SUPPLIER_PAYMENT_FAILED"
            });
        }
    }
}
