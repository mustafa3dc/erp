using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/treasury")]
[Route("api/v1/treasury")]
public class TreasuryController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<TreasuryController> _logger;

    private static readonly HashSet<string> ValidAccountTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Cashbox",
        "BankAccount",
        "DigitalWallet"
    };

    public TreasuryController(AppDbContext context, ILogger<TreasuryController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private string CurrentActorName =>
        User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("username")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "System";

    private static string NormalizeAccountType(string? rawType)
    {
        var trimmed = (rawType ?? "Cashbox").Trim();
        if (string.Equals(trimmed, "CASH", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(trimmed, "Cashbox", StringComparison.OrdinalIgnoreCase))
            return "Cashbox";
        if (string.Equals(trimmed, "BANK", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(trimmed, "BankAccount", StringComparison.OrdinalIgnoreCase))
            return "BankAccount";
        if (string.Equals(trimmed, "WALLET", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(trimmed, "DigitalWallet", StringComparison.OrdinalIgnoreCase))
            return "DigitalWallet";
        return string.Empty;
    }

    // =========================================================================
    // 1. Vouchers (Receipt / Payment / Transfers / Ledger)
    // =========================================================================

    [HttpGet("vouchers")]
    public async Task<IActionResult> GetVouchers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? type = null,
        [FromQuery] Guid? accountId = null,
        [FromQuery] string? search = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var tenantId = _context.CurrentTenantId;
        var query = _context.TreasuryTransactions
            .AsNoTracking()
            .Where(tt => !tenantId.HasValue || tt.TenantId == tenantId.Value)
            .Include(tt => tt.CashBox)
            .Include(tt => tt.Supplier)
            .AsQueryable();

        if (accountId.HasValue && accountId.Value != Guid.Empty)
        {
            query = query.Where(tt => tt.CashBoxId == accountId.Value);
        }

        if (!string.IsNullOrWhiteSpace(type) && !string.Equals(type, "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var normType = type.Trim().ToUpperInvariant();
            if (normType == "TRANSFER")
            {
                query = query.Where(tt => tt.TransactionType == "TRANSFER_OUT" || tt.TransactionType == "TRANSFER_IN");
            }
            else
            {
                query = query.Where(tt => tt.TransactionType.ToUpper() == normType);
            }
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(tt =>
                (tt.ReferenceNumber != null && tt.ReferenceNumber.ToLower().Contains(term)) ||
                (tt.PartyName != null && tt.PartyName.ToLower().Contains(term)) ||
                (tt.Notes != null && tt.Notes.ToLower().Contains(term)) ||
                (tt.CashBox != null && tt.CashBox.Name.ToLower().Contains(term)) ||
                (tt.Supplier != null && tt.Supplier.CompanyName.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(tt => tt.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(tt => new
            {
                tt.Id,
                tt.CashBoxId,
                CashBoxName = tt.CashBox != null ? tt.CashBox.Name : string.Empty,
                CashBoxCode = tt.CashBox != null ? tt.CashBox.Code : string.Empty,
                AccountType = tt.CashBox != null ? tt.CashBox.AccountType : "Cashbox",
                Currency = tt.CashBox != null ? tt.CashBox.Currency : "IQD",
                tt.TransactionType,
                tt.Amount,
                tt.BalanceAfter,
                tt.ReferenceNumber,
                PartyName = tt.PartyName ?? (tt.Supplier != null ? tt.Supplier.CompanyName : null),
                tt.ExpenseVoucherId,
                tt.PurchaseBillId,
                tt.SupplierId,
                tt.TransferGroupId,
                tt.VoucherDate,
                tt.Notes,
                tt.CreatedBy,
                tt.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize
        });
    }

    [HttpPost("vouchers/receipt")]
    public async Task<IActionResult> CreateReceiptVoucher([FromBody] TreasuryVoucherRequestDto dto)
    {
        var roundedAmount = Math.Round(dto.Amount, 4, MidpointRounding.AwayFromZero);
        if (roundedAmount <= 0m)
        {
            return BadRequest(new { errorCode = "ERR_INVALID_AMOUNT" });
        }

        if (dto.AccountId == Guid.Empty)
        {
            return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_REQUIRED" });
        }

        var tenantId = _context.CurrentTenantId;
        var actor = CurrentActorName;

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var cashBox = await _context.CashBoxes
                .FirstOrDefaultAsync(cb =>
                    cb.Id == dto.AccountId &&
                    cb.IsActive &&
                    (!tenantId.HasValue || cb.TenantId == tenantId.Value));

            if (cashBox == null)
            {
                await transaction.RollbackAsync();
                return NotFound(new { errorCode = "ERR_TREASURY_ACCOUNT_NOT_FOUND" });
            }

            var previousBalance = cashBox.CurrentBalance;
            cashBox.CurrentBalance = Math.Round(cashBox.CurrentBalance + roundedAmount, 4, MidpointRounding.AwayFromZero);
            cashBox.UpdatedAt = DateTime.UtcNow;

            var voucherNo = $"RV-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
            var voucherDate = dto.VoucherDate?.ToUniversalTime() ?? DateTimeOffset.UtcNow;
            var partyName = string.IsNullOrWhiteSpace(dto.PartyName) ? null : dto.PartyName.Trim();
            var combinedNotes = BuildVoucherNotes(dto.Reference, dto.Notes);

            var entry = new TreasuryTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CashBoxId = cashBox.Id,
                TransactionType = "RECEIPT",
                Amount = roundedAmount,
                BalanceAfter = cashBox.CurrentBalance,
                ReferenceNumber = voucherNo,
                PartyName = partyName,
                VoucherDate = voucherDate,
                Notes = combinedNotes,
                CreatedBy = actor,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _context.TreasuryTransactions.Add(entry);
            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId,
                UserId = actor,
                Username = actor,
                Action = "TREASURY_RECEIPT",
                EntityName = "treasury_transactions",
                EntityId = entry.Id.ToString(),
                OldValues = JsonSerializer.Serialize(new { CashBoxBalance = previousBalance }),
                NewValues = JsonSerializer.Serialize(new
                {
                    VoucherNo = voucherNo,
                    AccountId = cashBox.Id,
                    Amount = roundedAmount,
                    CashBoxBalance = cashBox.CurrentBalance
                }),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                success = true,
                voucher = new
                {
                    entry.Id,
                    entry.CashBoxId,
                    CashBoxName = cashBox.Name,
                    CashBoxCode = cashBox.Code,
                    cashBox.AccountType,
                    cashBox.Currency,
                    entry.TransactionType,
                    entry.Amount,
                    entry.BalanceAfter,
                    entry.ReferenceNumber,
                    entry.PartyName,
                    entry.VoucherDate,
                    entry.Notes,
                    entry.CreatedBy,
                    entry.CreatedAt
                },
                accountNewBalance = cashBox.CurrentBalance
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to post receipt voucher");
            return StatusCode(500, new { errorCode = "ERR_TREASURY_VOUCHER_FAILED" });
        }
    }

    [HttpPost("vouchers/payment")]
    public async Task<IActionResult> CreatePaymentVoucher([FromBody] TreasuryVoucherRequestDto dto)
    {
        var roundedAmount = Math.Round(dto.Amount, 4, MidpointRounding.AwayFromZero);
        if (roundedAmount <= 0m)
        {
            return BadRequest(new { errorCode = "ERR_INVALID_AMOUNT" });
        }

        if (dto.AccountId == Guid.Empty)
        {
            return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_REQUIRED" });
        }

        var tenantId = _context.CurrentTenantId;
        var actor = CurrentActorName;

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var cashBox = await _context.CashBoxes
                .FirstOrDefaultAsync(cb =>
                    cb.Id == dto.AccountId &&
                    cb.IsActive &&
                    (!tenantId.HasValue || cb.TenantId == tenantId.Value));

            if (cashBox == null)
            {
                await transaction.RollbackAsync();
                return NotFound(new { errorCode = "ERR_TREASURY_ACCOUNT_NOT_FOUND" });
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

            var previousBalance = cashBox.CurrentBalance;
            cashBox.CurrentBalance = Math.Round(cashBox.CurrentBalance - roundedAmount, 4, MidpointRounding.AwayFromZero);
            cashBox.UpdatedAt = DateTime.UtcNow;

            var voucherNo = $"PV-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
            var voucherDate = dto.VoucherDate?.ToUniversalTime() ?? DateTimeOffset.UtcNow;
            var partyName = string.IsNullOrWhiteSpace(dto.PartyName) ? null : dto.PartyName.Trim();
            var combinedNotes = BuildVoucherNotes(dto.Reference, dto.Notes);

            var entry = new TreasuryTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CashBoxId = cashBox.Id,
                TransactionType = "PAYMENT",
                Amount = roundedAmount,
                BalanceAfter = cashBox.CurrentBalance,
                ReferenceNumber = voucherNo,
                PartyName = partyName,
                VoucherDate = voucherDate,
                Notes = combinedNotes,
                CreatedBy = actor,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _context.TreasuryTransactions.Add(entry);
            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId,
                UserId = actor,
                Username = actor,
                Action = "TREASURY_PAYMENT",
                EntityName = "treasury_transactions",
                EntityId = entry.Id.ToString(),
                OldValues = JsonSerializer.Serialize(new { CashBoxBalance = previousBalance }),
                NewValues = JsonSerializer.Serialize(new
                {
                    VoucherNo = voucherNo,
                    AccountId = cashBox.Id,
                    Amount = roundedAmount,
                    CashBoxBalance = cashBox.CurrentBalance
                }),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                success = true,
                voucher = new
                {
                    entry.Id,
                    entry.CashBoxId,
                    CashBoxName = cashBox.Name,
                    CashBoxCode = cashBox.Code,
                    cashBox.AccountType,
                    cashBox.Currency,
                    entry.TransactionType,
                    entry.Amount,
                    entry.BalanceAfter,
                    entry.ReferenceNumber,
                    entry.PartyName,
                    entry.VoucherDate,
                    entry.Notes,
                    entry.CreatedBy,
                    entry.CreatedAt
                },
                accountNewBalance = cashBox.CurrentBalance
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to post payment voucher");
            return StatusCode(500, new { errorCode = "ERR_TREASURY_VOUCHER_FAILED" });
        }
    }

    [HttpPost("transfers")]
    public async Task<IActionResult> TransferFunds([FromBody] TreasuryTransferRequestDto dto)
    {
        var roundedAmount = Math.Round(dto.Amount, 4, MidpointRounding.AwayFromZero);
        if (roundedAmount <= 0m)
        {
            return BadRequest(new { errorCode = "ERR_INVALID_AMOUNT" });
        }

        if (dto.FromAccountId == Guid.Empty || dto.ToAccountId == Guid.Empty)
        {
            return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_REQUIRED" });
        }

        if (dto.FromAccountId == dto.ToAccountId)
        {
            return BadRequest(new { errorCode = "ERR_SAME_TREASURY_ACCOUNT" });
        }

        var tenantId = _context.CurrentTenantId;
        var actor = CurrentActorName;

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var source = await _context.CashBoxes
                .FirstOrDefaultAsync(cb =>
                    cb.Id == dto.FromAccountId &&
                    cb.IsActive &&
                    (!tenantId.HasValue || cb.TenantId == tenantId.Value));

            var dest = await _context.CashBoxes
                .FirstOrDefaultAsync(cb =>
                    cb.Id == dto.ToAccountId &&
                    cb.IsActive &&
                    (!tenantId.HasValue || cb.TenantId == tenantId.Value));

            if (source == null || dest == null)
            {
                await transaction.RollbackAsync();
                return NotFound(new { errorCode = "ERR_TREASURY_ACCOUNT_NOT_FOUND" });
            }

            if (source.CurrentBalance < roundedAmount)
            {
                await transaction.RollbackAsync();
                return BadRequest(new
                {
                    errorCode = "ERR_INSUFFICIENT_TREASURY_BALANCE",
                    availableBalance = source.CurrentBalance,
                    requiredAmount = roundedAmount
                });
            }

            var prevSourceBal = source.CurrentBalance;
            var prevDestBal = dest.CurrentBalance;

            source.CurrentBalance = Math.Round(source.CurrentBalance - roundedAmount, 4, MidpointRounding.AwayFromZero);
            source.UpdatedAt = DateTime.UtcNow;

            dest.CurrentBalance = Math.Round(dest.CurrentBalance + roundedAmount, 4, MidpointRounding.AwayFromZero);
            dest.UpdatedAt = DateTime.UtcNow;

            var transferGroupId = Guid.NewGuid();
            var transferRef = $"TR-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
            var voucherDate = dto.VoucherDate?.ToUniversalTime() ?? DateTimeOffset.UtcNow;
            var combinedNotes = BuildVoucherNotes(dto.Reference, dto.Notes);

            _context.TreasuryTransactions.Add(new TreasuryTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CashBoxId = source.Id,
                TransactionType = "TRANSFER_OUT",
                Amount = roundedAmount,
                BalanceAfter = source.CurrentBalance,
                ReferenceNumber = transferRef,
                PartyName = dest.Name,
                TransferGroupId = transferGroupId,
                VoucherDate = voucherDate,
                Notes = combinedNotes,
                CreatedBy = actor,
                CreatedAt = DateTimeOffset.UtcNow
            });

            _context.TreasuryTransactions.Add(new TreasuryTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CashBoxId = dest.Id,
                TransactionType = "TRANSFER_IN",
                Amount = roundedAmount,
                BalanceAfter = dest.CurrentBalance,
                ReferenceNumber = transferRef,
                PartyName = source.Name,
                TransferGroupId = transferGroupId,
                VoucherDate = voucherDate,
                Notes = combinedNotes,
                CreatedBy = actor,
                CreatedAt = DateTimeOffset.UtcNow
            });

            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId,
                UserId = actor,
                Username = actor,
                Action = "TREASURY_TRANSFER",
                EntityName = "cash_boxes",
                EntityId = transferGroupId.ToString(),
                OldValues = JsonSerializer.Serialize(new { SourceBalance = prevSourceBal, DestBalance = prevDestBal }),
                NewValues = JsonSerializer.Serialize(new
                {
                    ReferenceNumber = transferRef,
                    FromAccountId = source.Id,
                    ToAccountId = dest.Id,
                    Amount = roundedAmount,
                    SourceBalance = source.CurrentBalance,
                    DestBalance = dest.CurrentBalance
                }),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                success = true,
                transferRef,
                fromAccountId = source.Id,
                fromNewBalance = source.CurrentBalance,
                toAccountId = dest.Id,
                toNewBalance = dest.CurrentBalance
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to transfer treasury funds");
            return StatusCode(500, new { errorCode = "ERR_TREASURY_TRANSFER_FAILED" });
        }
    }

    // =========================================================================
    // 2. Flexible Treasury Accounts CRUD (/api/treasury/accounts)
    // =========================================================================

    [HttpGet("accounts")]
    public async Task<IActionResult> GetAccounts([FromQuery] bool includeInactive = false)
    {
        var tenantId = _context.CurrentTenantId;
        var query = _context.CashBoxes
            .AsNoTracking()
            .Where(cb => !tenantId.HasValue || cb.TenantId == tenantId.Value);

        if (!includeInactive)
        {
            query = query.Where(cb => cb.IsActive);
        }

        var accounts = await query
            .OrderByDescending(cb => cb.IsActive)
            .ThenBy(cb => cb.Code)
            .Select(cb => new
            {
                cb.Id,
                cb.Code,
                cb.Name,
                cb.AccountType,
                cb.Currency,
                cb.CurrentBalance,
                cb.IsActive,
                cb.CreatedAt,
                cb.UpdatedAt
            })
            .ToListAsync();

        return Ok(accounts);
    }

    [HttpPost("accounts")]
    public async Task<IActionResult> CreateAccount([FromBody] CreateTreasuryAccountDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_NAME_REQUIRED" });
        }

        var normalizedType = NormalizeAccountType(dto.AccountType);
        if (string.IsNullOrEmpty(normalizedType) || !ValidAccountTypes.Contains(normalizedType))
        {
            return BadRequest(new { errorCode = "ERR_INVALID_ACCOUNT_TYPE" });
        }

        var initialBalance = Math.Round(dto.InitialBalance, 4, MidpointRounding.AwayFromZero);
        if (initialBalance < 0m)
        {
            return BadRequest(new { errorCode = "ERR_INVALID_AMOUNT" });
        }

        var tenantId = _context.CurrentTenantId;
        var actor = CurrentActorName;
        var currency = string.IsNullOrWhiteSpace(dto.Currency) ? "IQD" : dto.Currency.Trim().ToUpperInvariant();

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            string code;
            if (!string.IsNullOrWhiteSpace(dto.Code))
            {
                code = dto.Code.Trim().ToUpperInvariant();
                var exists = await _context.CashBoxes
                    .AnyAsync(cb => (!tenantId.HasValue || cb.TenantId == tenantId.Value) && cb.Code.ToUpper() == code);
                if (exists)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_CODE_EXISTS" });
                }
            }
            else
            {
                var prefix = normalizedType switch
                {
                    "BankAccount" => "BNK",
                    "DigitalWallet" => "WAL",
                    _ => "CB"
                };
                var count = await _context.CashBoxes
                    .CountAsync(cb => !tenantId.HasValue || cb.TenantId == tenantId.Value);
                var seq = count + 1;
                do
                {
                    code = $"{prefix}-{seq:D2}";
                    seq++;
                } while (await _context.CashBoxes.AnyAsync(cb => (!tenantId.HasValue || cb.TenantId == tenantId.Value) && cb.Code.ToUpper() == code));
            }

            var now = DateTime.UtcNow;
            var cashBox = new CashBox
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = code,
                Name = dto.Name.Trim(),
                AccountType = normalizedType,
                Currency = currency,
                CurrentBalance = initialBalance,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };

            _context.CashBoxes.Add(cashBox);

            if (initialBalance > 0m)
            {
                var openingRef = $"RV-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
                _context.TreasuryTransactions.Add(new TreasuryTransaction
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CashBoxId = cashBox.Id,
                    TransactionType = "RECEIPT",
                    Amount = initialBalance,
                    BalanceAfter = initialBalance,
                    ReferenceNumber = openingRef,
                    PartyName = cashBox.Name,
                    VoucherDate = DateTimeOffset.UtcNow,
                    Notes = openingRef,
                    CreatedBy = actor,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }

            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId,
                UserId = actor,
                Username = actor,
                Action = "CREATE_TREASURY_ACC",
                EntityName = "cash_boxes",
                EntityId = cashBox.Id.ToString(),
                NewValues = JsonSerializer.Serialize(new { cashBox.Code, cashBox.Name, cashBox.AccountType, cashBox.Currency, cashBox.CurrentBalance }),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                cashBox.Id,
                cashBox.Code,
                cashBox.Name,
                cashBox.AccountType,
                cashBox.Currency,
                cashBox.CurrentBalance,
                cashBox.IsActive,
                cashBox.CreatedAt
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to create treasury account");
            return StatusCode(500, new { errorCode = "ERR_TREASURY_ACCOUNT_SAVE_FAILED" });
        }
    }

    [HttpPut("accounts/{id:guid}")]
    public async Task<IActionResult> UpdateAccount(Guid id, [FromBody] UpdateTreasuryAccountDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_NAME_REQUIRED" });
        }

        var normalizedType = NormalizeAccountType(dto.AccountType);
        if (string.IsNullOrEmpty(normalizedType) || !ValidAccountTypes.Contains(normalizedType))
        {
            return BadRequest(new { errorCode = "ERR_INVALID_ACCOUNT_TYPE" });
        }

        var tenantId = _context.CurrentTenantId;
        var cashBox = await _context.CashBoxes
            .FirstOrDefaultAsync(cb => cb.Id == id && (!tenantId.HasValue || cb.TenantId == tenantId.Value));

        if (cashBox == null)
        {
            return NotFound(new { errorCode = "ERR_TREASURY_ACCOUNT_NOT_FOUND" });
        }

        if (dto.IsActive.HasValue && !dto.IsActive.Value && cashBox.IsActive)
        {
            var otherActiveCount = await _context.CashBoxes
                .CountAsync(cb => cb.Id != id && cb.IsActive && (!tenantId.HasValue || cb.TenantId == tenantId.Value));
            if (otherActiveCount == 0)
            {
                return BadRequest(new { errorCode = "ERR_LAST_ACTIVE_TREASURY_ACCOUNT" });
            }
        }

        cashBox.Name = dto.Name.Trim();
        cashBox.AccountType = normalizedType;
        if (!string.IsNullOrWhiteSpace(dto.Currency))
        {
            cashBox.Currency = dto.Currency.Trim().ToUpperInvariant();
        }
        if (dto.IsActive.HasValue)
        {
            cashBox.IsActive = dto.IsActive.Value;
        }
        cashBox.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            cashBox.Id,
            cashBox.Code,
            cashBox.Name,
            cashBox.AccountType,
            cashBox.Currency,
            cashBox.CurrentBalance,
            cashBox.IsActive,
            cashBox.UpdatedAt
        });
    }

    [HttpPatch("accounts/{id:guid}/toggle")]
    public async Task<IActionResult> ToggleAccountActive(Guid id)
    {
        var tenantId = _context.CurrentTenantId;
        var cashBox = await _context.CashBoxes
            .FirstOrDefaultAsync(cb => cb.Id == id && (!tenantId.HasValue || cb.TenantId == tenantId.Value));

        if (cashBox == null)
        {
            return NotFound(new { errorCode = "ERR_TREASURY_ACCOUNT_NOT_FOUND" });
        }

        if (cashBox.IsActive)
        {
            var otherActiveCount = await _context.CashBoxes
                .CountAsync(cb => cb.Id != id && cb.IsActive && (!tenantId.HasValue || cb.TenantId == tenantId.Value));
            if (otherActiveCount == 0)
            {
                return BadRequest(new { errorCode = "ERR_LAST_ACTIVE_TREASURY_ACCOUNT" });
            }
        }

        cashBox.IsActive = !cashBox.IsActive;
        cashBox.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            cashBox.Id,
            cashBox.Code,
            cashBox.Name,
            cashBox.AccountType,
            cashBox.Currency,
            cashBox.CurrentBalance,
            cashBox.IsActive,
            cashBox.UpdatedAt
        });
    }

    [HttpDelete("accounts/{id:guid}")]
    public async Task<IActionResult> DeactivateAccount(Guid id)
    {
        var tenantId = _context.CurrentTenantId;
        var cashBox = await _context.CashBoxes
            .FirstOrDefaultAsync(cb => cb.Id == id && (!tenantId.HasValue || cb.TenantId == tenantId.Value));

        if (cashBox == null)
        {
            return NotFound(new { errorCode = "ERR_TREASURY_ACCOUNT_NOT_FOUND" });
        }

        var otherActiveCount = await _context.CashBoxes
            .CountAsync(cb => cb.Id != id && cb.IsActive && (!tenantId.HasValue || cb.TenantId == tenantId.Value));
        if (otherActiveCount == 0)
        {
            return BadRequest(new { errorCode = "ERR_LAST_ACTIVE_TREASURY_ACCOUNT" });
        }

        cashBox.IsActive = false;
        cashBox.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, id = cashBox.Id, isActive = cashBox.IsActive });
    }

    private static string? BuildVoucherNotes(string? reference, string? notes)
    {
        var cleanRef = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        var cleanNotes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        string? combined = (cleanRef, cleanNotes) switch
        {
            (not null, not null) => $"{cleanRef} — {cleanNotes}",
            (not null, null) => cleanRef,
            (null, not null) => cleanNotes,
            _ => null
        };
        if (combined != null && combined.Length > 500)
        {
            return combined[..500];
        }
        return combined;
    }
}
