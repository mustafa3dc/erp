using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PurchaseBillsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<PurchaseBillsController> _logger;

    public PurchaseBillsController(AppDbContext context, ILogger<PurchaseBillsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get purchase bills list with supplier and items summary
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetPurchaseBills()
    {
        var bills = await _context.PurchaseBills
            .Include(b => b.Supplier)
            .Include(b => b.TargetWarehouse)
            .Include(b => b.Items)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                b.Id,
                b.BillNumber,
                b.SupplierRefNo,
                b.InvoiceDate,
                SupplierId = b.SupplierId,
                SupplierName = b.Supplier != null ? b.Supplier.CompanyName : "مورد عام",
                TargetWarehouseId = b.TargetWarehouseId,
                TargetWarehouseName = b.TargetWarehouse != null ? b.TargetWarehouse.Name : "",
                b.PaymentTerms,
                b.Subtotal,
                b.DiscountAmount,
                b.ShippingCost,
                b.NetTotal,
                b.PaidAmount,
                b.BalanceDue,
                b.BillStatus,
                ItemsCount = b.Items.Count,
                TotalQuantity = b.Items.Sum(i => i.Quantity),
                b.CreatedAt
            })
            .ToListAsync();

        return Ok(bills);
    }

    /// <summary>
    /// Atomic Inbound Purchase Bill Transaction:
    /// 1. Create Inline Products/SKUs if new
    /// 2. Post Purchase Bill and Line Items
    /// 3. Update Warehouse Stock & Record Inbound Stock Movement
    /// 4. Create FIFO Cost Batch for each line item
    /// 5. Post Supplier Ledger & Accounts Payable (or Treasury Cash Disbursement)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateAndPostPurchaseBill([FromBody] CreatePurchaseBillDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
        {
            return BadRequest(new { message = "يجب أن تحتوي القائمة على مادة واحدة على الأقل." });
        }

        if (string.IsNullOrWhiteSpace(dto.SupplierRefNo))
        {
            return BadRequest(new { message = "رقم وصل أو قائمة التاجر الورقية إلزامي للمطابقة." });
        }

        // Begin Atomic Database Transaction
        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            var supplier = await _context.Suppliers.FindAsync(dto.SupplierId);
            if (supplier == null)
            {
                return NotFound(new { message = "المورد المحدد غير موجود بالنظام." });
            }

            var warehouse = await _context.Warehouses
                .FirstOrDefaultAsync(w => w.Id == dto.TargetWarehouseId && w.IsActive);
            if (warehouse == null)
            {
                return BadRequest(new 
                { 
                    errorCode = "INVALID_WAREHOUSE", 
                    message = "المستودع المحدد غير موجود أو تم تعطيله. يرجى اختيار مستودع نشط." 
                });
            }

            var billNumber = $"BILL-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";
            var purchaseBill = new PurchaseBill
            {
                Id = Guid.NewGuid(),
                BillNumber = billNumber,
                SupplierId = dto.SupplierId,
                SupplierRefNo = dto.SupplierRefNo.Trim(),
                InvoiceDate = dto.InvoiceDate,
                TargetWarehouseId = dto.TargetWarehouseId,
                PaymentTerms = dto.PaymentTerms.ToUpper(),
                Subtotal = dto.Subtotal,
                DiscountAmount = dto.DiscountAmount,
                ShippingCost = dto.ShippingCost,
                NetTotal = dto.NetTotal,
                PaidAmount = dto.PaidAmount,
                BalanceDue = dto.BalanceDue,
                TreasuryAccountId = dto.TreasuryAccountId,
                BillStatus = "POSTED",
                Notes = dto.Notes,
                CreatedAt = DateTime.UtcNow
            };

            _context.PurchaseBills.Add(purchaseBill);

            var createdMovements = new List<StockMovement>();

            // Process Each Line Item
            foreach (var itemDto in dto.Items)
            {
                Product? targetProduct = null;

                // 1. Resolve or Create Product on the fly (Inline SKU Creation)
                if (itemDto.ProductId.HasValue && itemDto.ProductId.Value != Guid.Empty)
                {
                    targetProduct = await _context.Products.FindAsync(itemDto.ProductId.Value);
                }

                if (targetProduct == null)
                {
                    // Check by Barcode or SKU
                    if (!string.IsNullOrWhiteSpace(itemDto.Barcode))
                    {
                        targetProduct = await _context.Products.FirstOrDefaultAsync(p => p.Barcode == itemDto.Barcode.Trim());
                    }
                    if (targetProduct == null && !string.IsNullOrWhiteSpace(itemDto.Sku))
                    {
                        targetProduct = await _context.Products.FirstOrDefaultAsync(p => p.Sku == itemDto.Sku.Trim());
                    }
                }

                bool isNewlyCreated = false;
                if (targetProduct == null)
                {
                    // Find or create category
                    Guid? catId = null;
                    if (!string.IsNullOrWhiteSpace(itemDto.CategoryName))
                    {
                        var cat = await _context.Categories.FirstOrDefaultAsync(c => c.Name == itemDto.CategoryName.Trim());
                        if (cat == null)
                        {
                            cat = new Category
                            {
                                Id = Guid.NewGuid(),
                                Name = itemDto.CategoryName.Trim(),
                                Code = $"CAT-{new Random().Next(100, 999)}",
                                CreatedAt = DateTime.UtcNow
                            };
                            _context.Categories.Add(cat);
                        }
                        catId = cat.Id;
                    }

                    targetProduct = new Product
                    {
                        Id = Guid.NewGuid(),
                        Sku = string.IsNullOrWhiteSpace(itemDto.Sku) 
                            ? $"SKU-{DateTime.UtcNow.Ticks.ToString()[^5..]}" 
                            : itemDto.Sku.Trim(),
                        Barcode = string.IsNullOrWhiteSpace(itemDto.Barcode) 
                            ? $"{new Random().NextInt64(1000000000000, 9999999999999)}" 
                            : itemDto.Barcode.Trim(),
                        Name = itemDto.Name.Trim(),
                        CategoryId = catId,
                        UnitOfMeasure = itemDto.UnitOfMeasure,
                        CostPrice = itemDto.UnitCost,
                        SellingPrice = itemDto.SellingPrice > 0 ? itemDto.SellingPrice : itemDto.UnitCost * 1.25m,
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
                    // Update latest cost and proposed selling price
                    targetProduct.CostPrice = itemDto.UnitCost;
                    if (itemDto.SellingPrice > 0)
                    {
                        targetProduct.SellingPrice = itemDto.SellingPrice;
                    }
                }

                // 2. Line Item Record
                var billItem = new PurchaseBillItem
                {
                    Id = Guid.NewGuid(),
                    BillId = purchaseBill.Id,
                    ProductId = targetProduct.Id,
                    ItemSku = targetProduct.Sku,
                    ItemBarcode = targetProduct.Barcode,
                    ItemName = targetProduct.Name,
                    UnitOfMeasure = itemDto.UnitOfMeasure,
                    Quantity = itemDto.Quantity,
                    UnitCost = itemDto.UnitCost,
                    SellingPrice = itemDto.SellingPrice,
                    LineTotal = itemDto.Quantity * itemDto.UnitCost,
                    IsNewlyCreatedProduct = isNewlyCreated,
                    CreatedAt = DateTime.UtcNow
                };
                _context.PurchaseBillItems.Add(billItem);

                // 3. Stock Movement & Inventory Balance Update (Inbound_Purchase)
                var stock = await _context.WarehouseStocks
                    .FirstOrDefaultAsync(ws => ws.WarehouseId == dto.TargetWarehouseId && ws.ProductId == targetProduct.Id);

                if (stock == null)
                {
                    stock = new WarehouseStock
                    {
                        WarehouseId = dto.TargetWarehouseId,
                        ProductId = targetProduct.Id,
                        Quantity = itemDto.Quantity,
                        LastCountedAt = DateTime.UtcNow
                    };
                    _context.WarehouseStocks.Add(stock);
                }
                else
                {
                    stock.Quantity += itemDto.Quantity;
                    stock.LastCountedAt = DateTime.UtcNow;
                }

                var stockMovement = new StockMovement
                {
                    Id = Guid.NewGuid(),
                    MovementNumber = $"MOV-IN-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}",
                    MovementType = "Inbound_Purchase",
                    FromWarehouseId = null,
                    ToWarehouseId = dto.TargetWarehouseId,
                    ReferenceNumber = purchaseBill.BillNumber,
                    Notes = $"توريد بضاعة مشتريات - قائمة {dto.SupplierRefNo} من {supplier.CompanyName}",
                    CreatedBy = "المخازن والمشتريات",
                    MovementDate = DateTime.UtcNow
                };
                _context.StockMovements.Add(stockMovement);

                var movementItem = new StockMovementItem
                {
                    Id = Guid.NewGuid(),
                    MovementId = stockMovement.Id,
                    ProductId = targetProduct.Id,
                    Quantity = itemDto.Quantity,
                    UnitCost = itemDto.UnitCost
                };
                _context.StockMovementItems.Add(movementItem);

                // 4. FIFO Cost Batching
                var fifoBatch = new FifoCostBatch
                {
                    Id = Guid.NewGuid(),
                    ProductId = targetProduct.Id,
                    WarehouseId = dto.TargetWarehouseId,
                    PurchaseBillId = purchaseBill.Id,
                    BatchReference = purchaseBill.BillNumber,
                    BatchDate = dto.InvoiceDate,
                    InitialQuantity = itemDto.Quantity,
                    RemainingQuantity = itemDto.Quantity,
                    UnitCost = itemDto.UnitCost,
                    IsExhausted = false,
                    CreatedAt = DateTime.UtcNow
                };
                _context.FifoCostBatches.Add(fifoBatch);
            }

            // 5. Supplier Ledger Posting & Accounts Payable
            decimal previousSupplierBalance = supplier.CurrentBalance;
            decimal newSupplierBalance = previousSupplierBalance;

            if (dto.BalanceDue > 0)
            {
                newSupplierBalance += dto.BalanceDue;
                supplier.CurrentBalance = newSupplierBalance;

                var supplierCreditLedger = new SupplierLedger
                {
                    Id = Guid.NewGuid(),
                    SupplierId = supplier.Id,
                    TransactionType = "PURCHASE_BILL",
                    ReferenceId = purchaseBill.Id,
                    ReferenceNumber = purchaseBill.BillNumber,
                    Debit = 0.00m,
                    Credit = dto.BalanceDue,
                    RunningBalance = newSupplierBalance,
                    Notes = $"دين مستحق من قائمة مشتريات رقم {purchaseBill.BillNumber} (وصل مورد: {dto.SupplierRefNo})",
                    CreatedAt = DateTime.UtcNow
                };
                _context.SupplierLedgers.Add(supplierCreditLedger);
            }

            if (dto.PaidAmount > 0)
            {
                var paymentNotes = dto.PaymentTerms == "CASH" 
                    ? "سداد نقدي فوري بالكامل من الصندوق" 
                    : "سداد دفعة نقدية / عربون من الصندوق";

                var supplierPaymentLedger = new SupplierLedger
                {
                    Id = Guid.NewGuid(),
                    SupplierId = supplier.Id,
                    TransactionType = "PAYMENT_VOUCHER",
                    ReferenceId = purchaseBill.Id,
                    ReferenceNumber = purchaseBill.BillNumber,
                    Debit = dto.PaidAmount,
                    Credit = 0.00m,
                    RunningBalance = newSupplierBalance,
                    Notes = $"{paymentNotes} - خزينة: {dto.TreasuryAccountId ?? "الصندوق الرئيسي"}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.SupplierLedgers.Add(supplierPaymentLedger);
            }

            // Save all changes atomically
            await _context.SaveChangesAsync();

            // Commit transaction
            await transaction.CommitAsync();

            _logger.LogInformation("Successfully posted purchase bill {BillNumber} for supplier {SupplierName}", 
                purchaseBill.BillNumber, supplier.CompanyName);

            return Ok(new
            {
                success = true,
                message = "تم حفظ واعتماد قائمة المشتريات وتوريد الأصناف بنجاح داخل معاملة ذرية متكاملة.",
                billId = purchaseBill.Id,
                billNumber = purchaseBill.BillNumber,
                netTotal = purchaseBill.NetTotal,
                balanceDue = purchaseBill.BalanceDue,
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
                message = "حدث خطأ أثناء تنفيذ المعاملة الذرية لقائمة المشتريات.", 
                error = ex.Message 
            });
        }
    }
}
