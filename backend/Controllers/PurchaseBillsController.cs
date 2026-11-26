using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Route("api/purchases")]
[Route("api/v1/purchases")]
public class PurchaseBillsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IInvoiceOcrService _invoiceOcrService;
    private readonly ILogger<PurchaseBillsController> _logger;

    public PurchaseBillsController(
        AppDbContext context,
        IInvoiceOcrService invoiceOcrService,
        ILogger<PurchaseBillsController> logger)
    {
        _context = context;
        _invoiceOcrService = invoiceOcrService;
        _logger = logger;
    }

    private string CurrentActorName =>
        User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("username")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "System";

    /// <summary>
    /// POST /api/purchases/extract-from-image
    /// Extracts purchase invoice data via Vision AI (Gemini) and performs strictly read-only supplier/catalog matching.
    /// NEVER mutates inventory or supplier balances.
    /// </summary>
    [HttpPost("extract-from-image")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> ExtractFromImage(
        IFormFile? file,
        [FromForm] Guid? warehouseId = null,
        CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { errorCode = "ERR_INVALID_FILE_FORMAT" });
        }

        if (file.Length > 10 * 1024 * 1024)
        {
            return BadRequest(new { errorCode = "ERR_FILE_TOO_LARGE" });
        }

        try
        {
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            var extracted = await _invoiceOcrService.ExtractAndMatchAsync(
                ms.ToArray(),
                file.ContentType,
                file.FileName,
                warehouseId,
                ct);

            return Ok(extracted);
        }
        catch (OcrExtractionException ex)
        {
            return StatusCode(ex.StatusCode, new { errorCode = ex.ErrorCode });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected failure during purchase invoice AI OCR extraction");
            return StatusCode(500, new { errorCode = "ERR_OCR_EXTRACTION_FAILED" });
        }
    }

    /// <summary>
    /// Get purchase bills list with supplier, warehouse, treasury cashbox, and items summary.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetPurchaseBills()
    {
        var tenantId = _context.CurrentTenantId;
        var bills = await _context.PurchaseBills
            .AsNoTracking()
            .Where(b => !tenantId.HasValue || b.TenantId == tenantId.Value)
            .Include(b => b.Supplier)
            .Include(b => b.TargetWarehouse)
            .Include(b => b.CashAccount)
            .Include(b => b.Items)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                b.Id,
                b.BillNumber,
                b.SupplierRefNo,
                b.InvoiceDate,
                SupplierId = b.SupplierId,
                SupplierName = b.Supplier != null ? b.Supplier.CompanyName : string.Empty,
                TargetWarehouseId = b.TargetWarehouseId,
                TargetWarehouseName = b.TargetWarehouse != null ? b.TargetWarehouse.Name : string.Empty,
                b.PaymentType,
                b.PaymentTerms,
                b.Subtotal,
                b.DiscountAmount,
                b.ShippingCost,
                b.NetTotal,
                b.PaidAmount,
                b.RemainingAmount,
                b.BalanceDue,
                b.CashAccountId,
                CashAccountName = b.CashAccount != null ? b.CashAccount.Name : null,
                CashAccountCode = b.CashAccount != null ? b.CashAccount.Code : null,
                b.TreasuryAccountId,
                b.BillStatus,
                b.CancelledAt,
                b.CancelReason,
                b.Notes,
                ItemsCount = b.Items.Count,
                TotalQuantity = b.Items.Sum(i => i.Quantity),
                Items = b.Items.Select(i => new
                {
                    i.Id,
                    i.ProductId,
                    i.ItemSku,
                    i.ItemBarcode,
                    i.ItemName,
                    i.UnitOfMeasure,
                    i.Quantity,
                    i.UnitCost,
                    i.SellingPrice,
                    i.LineTotal,
                    i.IsNewlyCreatedProduct
                }),
                b.CreatedAt
            })
            .ToListAsync();

        return Ok(bills);
    }

    /// <summary>
    /// Atomic Inbound Purchase Bill Transaction:
    /// 1. Validate payment terms (Cash / Credit / Partial) & treasury cashbox coverage
    /// 2. Create Inline Products/SKUs if new
    /// 3. Post Purchase Bill and Line Items
    /// 4. Update Warehouse Stock, Stock Movement & FIFO Cost Batches
    /// 5. Deduct PaidAmount from CashBox & log TreasuryTransaction outflow
    /// 6. Post Supplier Ledger & Accounts Payable for RemainingAmount
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateAndPostPurchaseBill([FromBody] CreatePurchaseBillDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
        {
            return BadRequest(new { errorCode = "ERR_PURCHASE_ITEMS_REQUIRED" });
        }

        if (string.IsNullOrWhiteSpace(dto.SupplierRefNo))
        {
            return BadRequest(new { errorCode = "ERR_SUPPLIER_REF_REQUIRED" });
        }

        foreach (var itemDto in dto.Items)
        {
            if (itemDto.IsNewProduct && (!itemDto.SellingPrice.HasValue || itemDto.SellingPrice.Value <= 0m))
            {
                return BadRequest(new { errorCode = "ERR_SELLING_PRICE_REQUIRED" });
            }
        }

        var rawPaymentType = !string.IsNullOrWhiteSpace(dto.PaymentType)
            ? dto.PaymentType.Trim()
            : (!string.IsNullOrWhiteSpace(dto.PaymentTerms) ? dto.PaymentTerms.Trim() : "Cash");

        string normalizedPaymentType = rawPaymentType.ToUpperInvariant() switch
        {
            "CASH" => "Cash",
            "CREDIT" => "Credit",
            "PARTIAL" => "Partial",
            _ => string.Empty
        };

        if (string.IsNullOrEmpty(normalizedPaymentType))
        {
            return BadRequest(new { errorCode = "ERR_INVALID_PAYMENT_TYPE" });
        }

        var netTotal = Math.Round(dto.NetTotal, 4, MidpointRounding.AwayFromZero);
        if (netTotal <= 0m)
        {
            return BadRequest(new { errorCode = "ERR_INVALID_PAYMENT_AMOUNT" });
        }

        Guid? requestedCashAccountId = dto.CashAccountId.HasValue && dto.CashAccountId.Value != Guid.Empty
            ? dto.CashAccountId.Value
            : (Guid.TryParse(dto.TreasuryAccountId, out var parsedCashGuid) && parsedCashGuid != Guid.Empty
                ? parsedCashGuid
                : null);

        var hasCashAccountHint = requestedCashAccountId.HasValue || !string.IsNullOrWhiteSpace(dto.TreasuryAccountId);
        decimal paidAmount;
        decimal remainingAmount;

        switch (normalizedPaymentType)
        {
            case "Cash":
                if (!hasCashAccountHint)
                {
                    return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_REQUIRED" });
                }
                paidAmount = Math.Round(dto.PaidAmount, 4, MidpointRounding.AwayFromZero);
                if (Math.Abs(paidAmount - netTotal) > 0.0001m)
                {
                    return BadRequest(new { errorCode = "ERR_INVALID_PAYMENT_AMOUNT" });
                }
                paidAmount = netTotal;
                remainingAmount = 0.0000m;
                break;

            case "Credit":
                paidAmount = Math.Round(dto.PaidAmount, 4, MidpointRounding.AwayFromZero);
                if (paidAmount != 0m)
                {
                    return BadRequest(new { errorCode = "ERR_INVALID_PAYMENT_AMOUNT" });
                }
                paidAmount = 0.0000m;
                remainingAmount = netTotal;
                requestedCashAccountId = null;
                break;

            case "Partial":
                if (!hasCashAccountHint)
                {
                    return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_REQUIRED" });
                }
                paidAmount = Math.Round(dto.PaidAmount, 4, MidpointRounding.AwayFromZero);
                if (paidAmount <= 0m || paidAmount >= netTotal)
                {
                    return BadRequest(new { errorCode = "ERR_INVALID_PARTIAL_PAYMENT_AMOUNT" });
                }
                remainingAmount = Math.Round(netTotal - paidAmount, 4, MidpointRounding.AwayFromZero);
                if (dto.RemainingAmount.HasValue &&
                    Math.Abs(Math.Round(dto.RemainingAmount.Value, 4, MidpointRounding.AwayFromZero) - remainingAmount) > 0.0001m)
                {
                    return BadRequest(new { errorCode = "ERR_INVALID_PAYMENT_AMOUNT" });
                }
                break;

            default:
                return BadRequest(new { errorCode = "ERR_INVALID_PAYMENT_TYPE" });
        }

        var tenantId = _context.CurrentTenantId;
        var actorName = CurrentActorName;

        // Begin Atomic Database Transaction
        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            Supplier? supplier = null;
            if (dto.SupplierId.HasValue && dto.SupplierId.Value != Guid.Empty)
            {
                supplier = await _context.Suppliers
                    .FirstOrDefaultAsync(s => s.Id == dto.SupplierId.Value && (!tenantId.HasValue || s.TenantId == tenantId.Value));
            }

            if (supplier == null && !string.IsNullOrWhiteSpace(dto.NewSupplierName))
            {
                var trimmedSup = dto.NewSupplierName.Trim();
                supplier = await _context.Suppliers
                    .FirstOrDefaultAsync(s =>
                        s.CompanyName.ToLower() == trimmedSup.ToLower() &&
                        s.IsActive &&
                        (!tenantId.HasValue || s.TenantId == tenantId.Value));

                if (supplier == null)
                {
                    supplier = new Supplier
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Code = $"SUP-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(100, 999)}",
                        CompanyName = trimmedSup,
                        ContactPerson = trimmedSup,
                        Phone = dto.NewSupplierPhone?.Trim(),
                        CurrentBalance = 0.0000m,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.Suppliers.Add(supplier);
                }
            }

            if (supplier == null)
            {
                await transaction.RollbackAsync();
                return NotFound(new { errorCode = "ERR_SUPPLIER_NOT_FOUND" });
            }

            var warehouse = await _context.Warehouses
                .FirstOrDefaultAsync(w =>
                    w.Id == dto.TargetWarehouseId &&
                    w.IsActive &&
                    (!tenantId.HasValue || w.TenantId == tenantId.Value));
            if (warehouse == null)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { errorCode = "INVALID_WAREHOUSE" });
            }

            // Validate & Lock Treasury CashBox BEFORE mutating stock or ledgers when PaidAmount > 0
            CashBox? selectedCashBox = null;
            decimal previousCashBoxBalance = 0.0000m;
            if (paidAmount > 0m)
            {
                if (requestedCashAccountId.HasValue)
                {
                    selectedCashBox = await _context.CashBoxes
                        .FirstOrDefaultAsync(cb =>
                            cb.Id == requestedCashAccountId.Value &&
                            cb.IsActive &&
                            (!tenantId.HasValue || cb.TenantId == tenantId.Value));
                }
                else if (!string.IsNullOrWhiteSpace(dto.TreasuryAccountId))
                {
                    var code = dto.TreasuryAccountId.Trim().ToUpperInvariant();
                    selectedCashBox = await _context.CashBoxes
                        .OrderBy(cb => cb.Code)
                        .FirstOrDefaultAsync(cb =>
                            cb.IsActive &&
                            (!tenantId.HasValue || cb.TenantId == tenantId.Value) &&
                            (cb.Code.ToUpper() == code || (code == "ACC-01" && cb.Code.ToUpper() == "CB-01")));
                }

                if (selectedCashBox == null)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { errorCode = "ERR_TREASURY_ACCOUNT_NOT_FOUND" });
                }

                if (selectedCashBox.CurrentBalance < paidAmount)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new
                    {
                        errorCode = "ERR_INSUFFICIENT_TREASURY_BALANCE",
                        availableBalance = selectedCashBox.CurrentBalance,
                        requiredAmount = paidAmount
                    });
                }

                previousCashBoxBalance = selectedCashBox.CurrentBalance;
                selectedCashBox.CurrentBalance = Math.Round(selectedCashBox.CurrentBalance - paidAmount, 4, MidpointRounding.AwayFromZero);
                selectedCashBox.UpdatedAt = DateTime.UtcNow;
            }

            var billNumber = $"PUR-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
            var purchaseBill = new PurchaseBill
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BillNumber = billNumber,
                SupplierId = supplier.Id,
                SupplierRefNo = dto.SupplierRefNo.Trim(),
                InvoiceDate = dto.InvoiceDate.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(dto.InvoiceDate, DateTimeKind.Utc)
                    : dto.InvoiceDate.ToUniversalTime(),
                TargetWarehouseId = dto.TargetWarehouseId,
                PaymentType = normalizedPaymentType,
                PaymentTerms = normalizedPaymentType.ToUpperInvariant(),
                Subtotal = Math.Round(dto.Subtotal, 4, MidpointRounding.AwayFromZero),
                DiscountAmount = Math.Round(dto.DiscountAmount, 4, MidpointRounding.AwayFromZero),
                ShippingCost = Math.Round(dto.ShippingCost, 4, MidpointRounding.AwayFromZero),
                NetTotal = netTotal,
                PaidAmount = paidAmount,
                RemainingAmount = remainingAmount,
                BalanceDue = remainingAmount,
                CashAccountId = selectedCashBox?.Id,
                TreasuryAccountId = selectedCashBox?.Id.ToString(),
                BillStatus = "POSTED",
                Notes = dto.Notes,
                CreatedAt = DateTime.UtcNow
            };

            _context.PurchaseBills.Add(purchaseBill);

            // Process Each Line Item
            foreach (var itemDto in dto.Items)
            {
                Product? targetProduct = null;

                if (!itemDto.IsNewProduct && itemDto.ProductId.HasValue && itemDto.ProductId.Value != Guid.Empty)
                {
                    targetProduct = await _context.Products
                        .FirstOrDefaultAsync(p => p.Id == itemDto.ProductId.Value && (!tenantId.HasValue || p.TenantId == tenantId.Value));
                }

                if (targetProduct == null && !itemDto.IsNewProduct)
                {
                    if (!string.IsNullOrWhiteSpace(itemDto.Barcode))
                    {
                        var bc = itemDto.Barcode.Trim();
                        targetProduct = await _context.Products
                            .FirstOrDefaultAsync(p => p.Barcode == bc && (!tenantId.HasValue || p.TenantId == tenantId.Value));
                    }
                    if (targetProduct == null && !string.IsNullOrWhiteSpace(itemDto.Sku))
                    {
                        var sku = itemDto.Sku.Trim();
                        targetProduct = await _context.Products
                            .FirstOrDefaultAsync(p => p.Sku == sku && (!tenantId.HasValue || p.TenantId == tenantId.Value));
                    }
                }

                int effectiveQty = Math.Max(1, (int)Math.Round(itemDto.Quantity, MidpointRounding.AwayFromZero));
                bool isNewlyCreated = false;
                decimal resolvedSellingPrice;
                decimal roundedUnitCost = Math.Round(itemDto.UnitCost, 4, MidpointRounding.AwayFromZero);

                if (targetProduct == null)
                {
                    if (!itemDto.SellingPrice.HasValue || itemDto.SellingPrice.Value <= 0m)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { errorCode = "ERR_SELLING_PRICE_REQUIRED" });
                    }

                    resolvedSellingPrice = Math.Round(itemDto.SellingPrice.Value, 4, MidpointRounding.AwayFromZero);

                    Guid? catId = null;
                    if (!string.IsNullOrWhiteSpace(itemDto.CategoryName))
                    {
                        var catName = itemDto.CategoryName.Trim();
                        var cat = await _context.Categories
                            .FirstOrDefaultAsync(c => c.Name == catName && (!tenantId.HasValue || c.TenantId == tenantId.Value));
                        if (cat == null)
                        {
                            cat = new Category
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                Name = catName,
                                Code = $"CAT-{Random.Shared.Next(100, 999)}",
                                CreatedAt = DateTime.UtcNow
                            };
                            _context.Categories.Add(cat);
                        }
                        catId = cat.Id;
                    }

                    targetProduct = new Product
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Sku = string.IsNullOrWhiteSpace(itemDto.Sku)
                            ? $"SKU-{DateTime.UtcNow.Ticks.ToString()[^5..]}"
                            : itemDto.Sku.Trim(),
                        Barcode = string.IsNullOrWhiteSpace(itemDto.Barcode)
                            ? $"{Random.Shared.NextInt64(1000000000000, 9999999999999)}"
                            : itemDto.Barcode.Trim(),
                        Name = itemDto.Name.Trim(),
                        CategoryId = catId,
                        UnitOfMeasure = itemDto.UnitOfMeasure,
                        CostPrice = roundedUnitCost,
                        SellingPrice = resolvedSellingPrice,
                        RequiresSerialNumber = itemDto.RequiresSerialTracking ?? itemDto.RequiresSerialNumber ?? false,
                        WarrantyMonths = Math.Max(0, itemDto.WarrantyMonths ?? 0),
                        MinStockLevel = 5,
                        MaxStockLevel = 1000,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Products.Add(targetProduct);
                    isNewlyCreated = true;
                }
                else
                {
                    targetProduct.CostPrice = roundedUnitCost;
                    if (itemDto.RequiresSerialTracking.HasValue)
                    {
                        targetProduct.RequiresSerialNumber = itemDto.RequiresSerialTracking.Value;
                    }
                    else if (itemDto.RequiresSerialNumber.HasValue)
                    {
                        targetProduct.RequiresSerialNumber = itemDto.RequiresSerialNumber.Value;
                    }
                    if (itemDto.WarrantyMonths.HasValue && itemDto.WarrantyMonths.Value >= 0)
                    {
                        targetProduct.WarrantyMonths = itemDto.WarrantyMonths.Value;
                    }
                    if (itemDto.SellingPrice.HasValue && itemDto.SellingPrice.Value > 0m)
                    {
                        var manualSelling = Math.Round(itemDto.SellingPrice.Value, 4, MidpointRounding.AwayFromZero);
                        if (targetProduct.SellingPrice != manualSelling)
                        {
                            targetProduct.SellingPrice = manualSelling;
                            targetProduct.UpdatedAt = DateTime.UtcNow;
                        }
                        resolvedSellingPrice = manualSelling;
                    }
                    else
                    {
                        resolvedSellingPrice = targetProduct.SellingPrice;
                    }
                }

                // Line Item Record
                var billItem = new PurchaseBillItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BillId = purchaseBill.Id,
                    ProductId = targetProduct.Id,
                    ItemSku = targetProduct.Sku,
                    ItemBarcode = targetProduct.Barcode,
                    ItemName = targetProduct.Name,
                    UnitOfMeasure = itemDto.UnitOfMeasure,
                    Quantity = effectiveQty,
                    UnitCost = roundedUnitCost,
                    SellingPrice = resolvedSellingPrice,
                    LineTotal = Math.Round(itemDto.Quantity * roundedUnitCost, 4, MidpointRounding.AwayFromZero),
                    IsNewlyCreatedProduct = isNewlyCreated,
                    CreatedAt = DateTime.UtcNow
                };
                _context.PurchaseBillItems.Add(billItem);

                // Stock Movement & Inventory Balance Update (Inbound_Purchase)
                var stock = await _context.WarehouseStocks
                    .FirstOrDefaultAsync(ws => ws.WarehouseId == dto.TargetWarehouseId && ws.ProductId == targetProduct.Id);

                if (stock == null)
                {
                    stock = new WarehouseStock
                    {
                        TenantId = tenantId,
                        WarehouseId = dto.TargetWarehouseId,
                        ProductId = targetProduct.Id,
                        Quantity = effectiveQty,
                        LastCountedAt = DateTime.UtcNow
                    };
                    _context.WarehouseStocks.Add(stock);
                }
                else
                {
                    stock.Quantity += effectiveQty;
                    stock.LastCountedAt = DateTime.UtcNow;
                }

                var stockMovement = new StockMovement
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    MovementNumber = $"MOV-IN-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}",
                    MovementType = "Inbound_Purchase",
                    FromWarehouseId = null,
                    ToWarehouseId = dto.TargetWarehouseId,
                    ReferenceNumber = purchaseBill.BillNumber,
                    Notes = $"{purchaseBill.BillNumber} | {dto.SupplierRefNo.Trim()} | {supplier.CompanyName}",
                    CreatedBy = actorName,
                    MovementDate = DateTime.UtcNow
                };
                _context.StockMovements.Add(stockMovement);

                var movementItem = new StockMovementItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    MovementId = stockMovement.Id,
                    ProductId = targetProduct.Id,
                    Quantity = effectiveQty,
                    UnitCost = roundedUnitCost
                };
                _context.StockMovementItems.Add(movementItem);

                // FIFO Cost Batching
                var fifoBatch = new FifoCostBatch
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    ProductId = targetProduct.Id,
                    WarehouseId = dto.TargetWarehouseId,
                    PurchaseBillId = purchaseBill.Id,
                    BatchReference = purchaseBill.BillNumber,
                    BatchDate = purchaseBill.InvoiceDate,
                    InitialQuantity = effectiveQty,
                    RemainingQuantity = effectiveQty,
                    UnitCost = roundedUnitCost,
                    IsExhausted = false,
                    CreatedAt = DateTime.UtcNow
                };
                _context.FifoCostBatches.Add(fifoBatch);

                // Serial / IMEI Lifecycle Registration for Serialized Products
                var rawSerials = (itemDto.SerialNumbers ?? new List<string>())
                    .Where(sn => !string.IsNullOrWhiteSpace(sn))
                    .Select(sn => sn.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (rawSerials.Count > 0)
                {
                    if (rawSerials.Count != effectiveQty)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new
                        {
                            errorCode = "ERR_SERIAL_COUNT_MISMATCH",
                            expected = effectiveQty,
                            provided = rawSerials.Count
                        });
                    }

                    var lowerSerials = rawSerials.Select(s => s.ToLowerInvariant()).ToList();
                    var duplicates = await _context.ProductSerials
                        .Where(ps => lowerSerials.Contains(ps.SerialNumber.ToLower()) && (!tenantId.HasValue || ps.TenantId == tenantId.Value))
                        .Select(ps => ps.SerialNumber)
                        .ToListAsync();

                    if (duplicates.Count > 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new
                        {
                            errorCode = "ERR_SERIAL_ALREADY_EXISTS",
                            conflictingSerials = duplicates
                        });
                    }

                    var effectiveWarrantyMonths = Math.Max(0, itemDto.WarrantyMonths ?? targetProduct.WarrantyMonths);
                    foreach (var sn in rawSerials)
                    {
                        _context.ProductSerials.Add(new ProductSerial
                        {
                            TenantId = tenantId,
                            SerialNumber = sn,
                            ProductId = targetProduct.Id,
                            WarehouseId = dto.TargetWarehouseId,
                            Status = "InStock",
                            PurchaseBillId = purchaseBill.Id,
                            PurchaseBillItemId = billItem.Id,
                            SupplierId = supplier.Id,
                            SupplierName = supplier.CompanyName,
                            PurchaseDate = purchaseBill.InvoiceDate,
                            UnitCost = roundedUnitCost,
                            WarrantyMonths = effectiveWarrantyMonths,
                            WarrantyStartDate = null,
                            WarrantyEndDate = null,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });
                    }
                }
            }

            // Record Treasury Outflow Ledger Entry when PaidAmount > 0
            if (paidAmount > 0m && selectedCashBox != null)
            {
                _context.TreasuryTransactions.Add(new TreasuryTransaction
                {
                    TenantId = tenantId,
                    CashBoxId = selectedCashBox.Id,
                    PurchaseBillId = purchaseBill.Id,
                    SupplierId = supplier.Id,
                    TransactionType = "PAYMENT",
                    Amount = paidAmount,
                    BalanceAfter = selectedCashBox.CurrentBalance,
                    ReferenceNumber = purchaseBill.BillNumber,
                    Notes = $"{purchaseBill.BillNumber} - {supplier.CompanyName}",
                    CreatedBy = actorName,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }

            // Supplier Ledger Posting & Accounts Payable Balance Update
            decimal previousSupplierBalance = supplier.CurrentBalance;
            decimal runningBalance = Math.Round(previousSupplierBalance + netTotal, 4, MidpointRounding.AwayFromZero);

            _context.SupplierLedgers.Add(new SupplierLedger
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SupplierId = supplier.Id,
                TransactionType = "PURCHASE_BILL",
                ReferenceId = purchaseBill.Id,
                ReferenceNumber = purchaseBill.BillNumber,
                Debit = 0.0000m,
                Credit = netTotal,
                RunningBalance = runningBalance,
                Notes = $"{purchaseBill.BillNumber} ({dto.SupplierRefNo.Trim()})",
                CreatedAt = DateTime.UtcNow
            });

            if (paidAmount > 0m)
            {
                runningBalance = Math.Round(runningBalance - paidAmount, 4, MidpointRounding.AwayFromZero);
                _context.SupplierLedgers.Add(new SupplierLedger
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SupplierId = supplier.Id,
                    TransactionType = "PAYMENT_VOUCHER",
                    ReferenceId = purchaseBill.Id,
                    ReferenceNumber = purchaseBill.BillNumber,
                    Debit = paidAmount,
                    Credit = 0.0000m,
                    RunningBalance = runningBalance,
                    Notes = selectedCashBox != null
                        ? $"{purchaseBill.BillNumber} - {selectedCashBox.Name}"
                        : purchaseBill.BillNumber,
                    CreatedAt = DateTime.UtcNow
                });
            }

            supplier.CurrentBalance = Math.Round(previousSupplierBalance + remainingAmount, 4, MidpointRounding.AwayFromZero);
            supplier.UpdatedAt = DateTime.UtcNow;

            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId,
                UserId = actorName,
                Username = actorName,
                Action = "CREATE_PURCHASE_BILL",
                EntityName = "purchase_bills",
                EntityId = purchaseBill.Id.ToString(),
                OldValues = JsonSerializer.Serialize(new
                {
                    SupplierBalance = previousSupplierBalance,
                    CashBoxBalance = previousCashBoxBalance
                }),
                NewValues = JsonSerializer.Serialize(new
                {
                    BillNumber = purchaseBill.BillNumber,
                    PaymentType = purchaseBill.PaymentType,
                    NetTotal = purchaseBill.NetTotal,
                    PaidAmount = purchaseBill.PaidAmount,
                    RemainingAmount = purchaseBill.RemainingAmount,
                    CashBoxId = selectedCashBox?.Id,
                    CashBoxBalance = selectedCashBox?.CurrentBalance,
                    SupplierBalance = supplier.CurrentBalance
                }),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation(
                "Posted purchase bill {BillNumber} ({PaymentType}) for supplier {SupplierName}: Net={NetTotal}, Paid={PaidAmount}, Remaining={RemainingAmount}",
                purchaseBill.BillNumber, purchaseBill.PaymentType, supplier.CompanyName, netTotal, paidAmount, remainingAmount);

            return Ok(new
            {
                success = true,
                billId = purchaseBill.Id,
                billNumber = purchaseBill.BillNumber,
                paymentType = purchaseBill.PaymentType,
                netTotal = purchaseBill.NetTotal,
                paidAmount = purchaseBill.PaidAmount,
                remainingAmount = purchaseBill.RemainingAmount,
                balanceDue = purchaseBill.BalanceDue,
                cashAccountId = purchaseBill.CashAccountId,
                cashAccountName = selectedCashBox?.Name,
                cashAccountNewBalance = selectedCashBox?.CurrentBalance,
                supplierId = supplier.Id,
                supplierNewBalance = supplier.CurrentBalance,
                itemsCount = dto.Items.Count
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to commit atomic purchase bill transaction");
            return StatusCode(500, new
            {
                success = false,
                errorCode = "ERR_PURCHASE_POST_FAILED"
            });
        }
    }

    /// <summary>
    /// Cancels / Voids a confirmed Purchase Bill atomically:
    /// 1. Reverses stock quantities, FIFO batches, and available serials
    /// 2. Reduces Supplier balance by RemainingAmount with SupplierLedger reversal
    /// 3. Refunds PaidAmount back to the linked CashBox with a TreasuryTransaction REFUND entry
    /// </summary>
    [HttpPost("{id:guid}/cancel")]
    [HttpPost("{id:guid}/void")]
    public async Task<IActionResult> CancelPurchaseBill(Guid id, [FromBody] CancelPurchaseBillDto? request)
    {
        var tenantId = _context.CurrentTenantId;
        var actorName = CurrentActorName;
        var reason = string.IsNullOrWhiteSpace(request?.Reason) ? null : request.Reason.Trim();

        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            var bill = await _context.PurchaseBills
                .Include(b => b.Items)
                .Include(b => b.Supplier)
                .FirstOrDefaultAsync(b => b.Id == id && (!tenantId.HasValue || b.TenantId == tenantId.Value));

            if (bill == null)
            {
                await transaction.RollbackAsync();
                return NotFound(new { errorCode = "ERR_PURCHASE_BILL_NOT_FOUND" });
            }

            if (string.Equals(bill.BillStatus, "CANCELLED", StringComparison.OrdinalIgnoreCase))
            {
                await transaction.RollbackAsync();
                return BadRequest(new { errorCode = "ERR_PURCHASE_ALREADY_CANCELLED" });
            }

            // Ensure no serials from this purchase bill have already been sold
            var billSerials = await _context.ProductSerials
                .Where(ps => ps.PurchaseBillId == bill.Id && (!tenantId.HasValue || ps.TenantId == tenantId.Value))
                .ToListAsync();

            if (billSerials.Any(ps => string.Equals(ps.Status, "Sold", StringComparison.OrdinalIgnoreCase)))
            {
                await transaction.RollbackAsync();
                return BadRequest(new { errorCode = "ERR_SERIAL_ALREADY_SOLD" });
            }

            // 1. Reverse Inventory Quantities, Stock Movements & FIFO Batches
            var reversalMovement = new StockMovement
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                MovementNumber = $"MOV-VOID-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}",
                MovementType = "Purchase_Cancellation",
                FromWarehouseId = bill.TargetWarehouseId,
                ToWarehouseId = null,
                ReferenceNumber = bill.BillNumber,
                Notes = reason ?? bill.BillNumber,
                CreatedBy = actorName,
                MovementDate = DateTime.UtcNow
            };
            _context.StockMovements.Add(reversalMovement);

            foreach (var item in bill.Items)
            {
                var stock = await _context.WarehouseStocks
                    .FirstOrDefaultAsync(ws => ws.WarehouseId == bill.TargetWarehouseId && ws.ProductId == item.ProductId);

                if (stock == null || stock.Quantity < item.Quantity)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { errorCode = "ERR_INSUFFICIENT_STOCK_FOR_VOID" });
                }

                stock.Quantity -= item.Quantity;
                stock.LastCountedAt = DateTime.UtcNow;

                _context.StockMovementItems.Add(new StockMovementItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    MovementId = reversalMovement.Id,
                    ProductId = item.ProductId,
                    Quantity = item.Quantity,
                    UnitCost = item.UnitCost
                });

                var fifoBatches = await _context.FifoCostBatches
                    .Where(fb => fb.PurchaseBillId == bill.Id && fb.ProductId == item.ProductId)
                    .ToListAsync();

                var remainingToDeduct = item.Quantity;
                foreach (var batch in fifoBatches)
                {
                    if (remainingToDeduct <= 0) break;
                    var deduct = Math.Min(batch.RemainingQuantity, remainingToDeduct);
                    batch.RemainingQuantity -= deduct;
                    if (batch.RemainingQuantity <= 0)
                    {
                        batch.RemainingQuantity = 0;
                        batch.IsExhausted = true;
                    }
                    remainingToDeduct -= deduct;
                }
            }

            foreach (var serial in billSerials)
            {
                serial.Status = "Returned";
                serial.UpdatedAt = DateTime.UtcNow;
            }

            // 2. Reduce Supplier Balance by RemainingAmount
            var supplier = bill.Supplier;
            decimal previousSupplierBalance = supplier?.CurrentBalance ?? 0m;
            var remainingToReverse = bill.RemainingAmount > 0m ? bill.RemainingAmount : bill.BalanceDue;

            if (supplier != null && remainingToReverse > 0m)
            {
                supplier.CurrentBalance = Math.Max(0m, Math.Round(supplier.CurrentBalance - remainingToReverse, 4, MidpointRounding.AwayFromZero));
                supplier.UpdatedAt = DateTime.UtcNow;

                _context.SupplierLedgers.Add(new SupplierLedger
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SupplierId = supplier.Id,
                    TransactionType = "PURCHASE_CANCEL",
                    ReferenceId = bill.Id,
                    ReferenceNumber = bill.BillNumber,
                    Debit = remainingToReverse,
                    Credit = 0.0000m,
                    RunningBalance = supplier.CurrentBalance,
                    Notes = reason ?? bill.BillNumber,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // 3. Refund PaidAmount back to CashAccount with a Treasury REFUND entry
            CashBox? refundedCashBox = null;
            decimal previousCashBoxBalance = 0m;
            if (bill.PaidAmount > 0m)
            {
                Guid? cashBoxGuid = bill.CashAccountId.HasValue && bill.CashAccountId.Value != Guid.Empty
                    ? bill.CashAccountId.Value
                    : (Guid.TryParse(bill.TreasuryAccountId, out var parsed) ? parsed : null);

                if (cashBoxGuid.HasValue)
                {
                    refundedCashBox = await _context.CashBoxes
                        .FirstOrDefaultAsync(cb => cb.Id == cashBoxGuid.Value && (!tenantId.HasValue || cb.TenantId == tenantId.Value));
                }

                if (refundedCashBox != null)
                {
                    previousCashBoxBalance = refundedCashBox.CurrentBalance;
                    refundedCashBox.CurrentBalance = Math.Round(refundedCashBox.CurrentBalance + bill.PaidAmount, 4, MidpointRounding.AwayFromZero);
                    refundedCashBox.UpdatedAt = DateTime.UtcNow;

                    _context.TreasuryTransactions.Add(new TreasuryTransaction
                    {
                        TenantId = tenantId,
                        CashBoxId = refundedCashBox.Id,
                        PurchaseBillId = bill.Id,
                        SupplierId = bill.SupplierId,
                        TransactionType = "REFUND",
                        Amount = bill.PaidAmount,
                        BalanceAfter = refundedCashBox.CurrentBalance,
                        ReferenceNumber = bill.BillNumber,
                        Notes = reason ?? $"{bill.BillNumber} - {supplier?.CompanyName}",
                        CreatedBy = actorName,
                        CreatedAt = DateTimeOffset.UtcNow
                    });
                }
            }

            bill.BillStatus = "CANCELLED";
            bill.CancelledAt = DateTimeOffset.UtcNow;
            bill.CancelledBy = actorName;
            bill.CancelReason = reason;

            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId,
                UserId = actorName,
                Username = actorName,
                Action = "CANCEL_PURCHASE_BILL",
                EntityName = "purchase_bills",
                EntityId = bill.Id.ToString(),
                OldValues = JsonSerializer.Serialize(new
                {
                    BillStatus = "POSTED",
                    SupplierBalance = previousSupplierBalance,
                    CashBoxBalance = previousCashBoxBalance
                }),
                NewValues = JsonSerializer.Serialize(new
                {
                    BillStatus = "CANCELLED",
                    CancelReason = reason,
                    RefundedPaidAmount = bill.PaidAmount,
                    ReversedSupplierDebt = remainingToReverse,
                    SupplierBalance = supplier?.CurrentBalance,
                    CashBoxBalance = refundedCashBox?.CurrentBalance
                }),
                Timestamp = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                success = true,
                billId = bill.Id,
                billNumber = bill.BillNumber,
                billStatus = bill.BillStatus,
                refundedAmount = bill.PaidAmount,
                reversedSupplierBalance = remainingToReverse,
                cashAccountId = refundedCashBox?.Id,
                cashAccountNewBalance = refundedCashBox?.CurrentBalance,
                supplierNewBalance = supplier?.CurrentBalance
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to cancel purchase bill {BillId}", id);
            return StatusCode(500, new
            {
                success = false,
                errorCode = "ERR_PURCHASE_CANCEL_FAILED"
            });
        }
    }
}
