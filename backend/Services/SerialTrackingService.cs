using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface ISerialTrackingService
{
    Task<List<ProductSerialDto>> GetSerialsAsync(string? query, Guid? productId, Guid? warehouseId, string? status, int limit = 100);
    Task<SerialLookupResultDto> LookupSerialAsync(string serialNumber);
    Task<PosSerialScanResponseDto> LookupForPosScanAsync(string serialNumber);
    Task<ApiResponse<List<ProductSerialDto>>> RegisterSerialsAsync(RegisterSerialsRequest request);
    Task<ApiResponse<ProductSerialDto>> BindSerialToSaleAsync(BindSerialToSaleRequest request);
    Task<ApiResponse<ProductSerialDto>> UpdateSerialWarrantyAsync(Guid id, UpdateSerialWarrantyRequest request);
    Task<ApiResponse<ProductSerialDto>> UpdateSerialStatusAsync(Guid id, UpdateSerialStatusRequest request, string? actorName);
}

public class SerialTrackingService : ISerialTrackingService
{
    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "InStock", "Sold", "Returned", "Defective", "Transferred"
    };

    private readonly AppDbContext _context;
    private readonly ILogger<SerialTrackingService> _logger;

    public SerialTrackingService(AppDbContext context, ILogger<SerialTrackingService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<ProductSerialDto>> GetSerialsAsync(string? query, Guid? productId, Guid? warehouseId, string? status, int limit = 100)
    {
        var q = _context.ProductSerials
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .Include(s => s.PurchaseBill)
            .Include(s => s.SalesInvoice)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim().ToLower();
            q = q.Where(s => s.SerialNumber.ToLower().Contains(search)
                || (s.Product != null && (s.Product.Name.ToLower().Contains(search) || s.Product.Sku.ToLower().Contains(search)))
                || (s.CustomerName != null && s.CustomerName.ToLower().Contains(search))
                || (s.SalesInvoice != null && s.SalesInvoice.InvoiceNumber.ToLower().Contains(search)));
        }

        if (productId.HasValue)
        {
            q = q.Where(s => s.ProductId == productId.Value);
        }

        if (warehouseId.HasValue)
        {
            q = q.Where(s => s.WarehouseId == warehouseId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status.Trim(), "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var st = status.Trim().ToLower();
            q = q.Where(s => s.Status.ToLower() == st);
        }

        var list = await q
            .OrderByDescending(s => s.CreatedAt)
            .Take(Math.Clamp(limit, 1, 500))
            .ToListAsync();

        return list.Select(MapToDto).ToList();
    }

    public async Task<SerialLookupResultDto> LookupSerialAsync(string serialNumber)
    {
        if (string.IsNullOrWhiteSpace(serialNumber))
        {
            return new SerialLookupResultDto(false, serialNumber ?? string.Empty, null, "ERR_EMPTY_SERIAL");
        }

        var normalized = serialNumber.Trim();
        var s = await _context.ProductSerials
            .Include(x => x.Product)
            .Include(x => x.Warehouse)
            .Include(x => x.PurchaseBill)
            .Include(x => x.SalesInvoice)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.SerialNumber.ToLower() == normalized.ToLower());

        if (s == null)
        {
            return new SerialLookupResultDto(false, normalized, null, "ERR_SERIAL_NOT_FOUND");
        }

        var warrantyStatus = ComputeWarrantyStatus(s);
        var remainingDays = ComputeRemainingDays(s);

        var detail = new ProductSerialDetailDto(
            Id: s.Id,
            SerialNumber: s.SerialNumber,
            ProductId: s.ProductId,
            ProductSku: s.Product?.Sku ?? "",
            ProductName: s.Product?.Name ?? "",
            Barcode: s.Product?.Barcode,
            WarehouseId: s.WarehouseId,
            WarehouseName: s.Warehouse?.Name ?? "",
            Status: s.Status,
            PurchaseBillId: s.PurchaseBillId,
            PurchaseBillNumber: s.PurchaseBill?.BillNumber,
            SupplierId: s.SupplierId,
            SupplierName: s.SupplierName,
            PurchaseDate: s.PurchaseDate,
            UnitCost: s.UnitCost,
            SalesInvoiceId: s.SalesInvoiceId,
            SalesInvoiceNumber: s.SalesInvoice?.InvoiceNumber,
            CustomerId: s.CustomerId,
            CustomerName: s.CustomerName,
            CustomerPhone: s.CustomerPhone,
            SoldDate: s.SoldDate,
            SellingPrice: s.SellingPrice,
            WarrantyMonths: s.WarrantyMonths,
            WarrantyStartDate: s.Status == "Sold" ? s.WarrantyStartDate : null,
            WarrantyEndDate: s.Status == "Sold" ? s.WarrantyEndDate : null,
            IsWarrantyActive: warrantyStatus == "Active",
            RemainingWarrantyDays: remainingDays,
            Notes: s.Notes,
            WarrantyStatus: warrantyStatus
        );

        return new SerialLookupResultDto(true, s.SerialNumber, detail);
    }

    public async Task<PosSerialScanResponseDto> LookupForPosScanAsync(string serialNumber)
    {
        if (string.IsNullOrWhiteSpace(serialNumber))
        {
            return new PosSerialScanResponseDto(false, false, string.Empty, "ERR_EMPTY_SERIAL", null, null);
        }

        var normalized = serialNumber.Trim();
        var s = await _context.ProductSerials
            .Include(x => x.Product)
                .ThenInclude(p => p!.Category)
            .Include(x => x.Product)
                .ThenInclude(p => p!.WarehouseStocks)
            .Include(x => x.Product)
                .ThenInclude(p => p!.QuantityTiers)
            .Include(x => x.Warehouse)
            .Include(x => x.PurchaseBill)
            .Include(x => x.SalesInvoice)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.SerialNumber.ToLower() == normalized.ToLower());

        if (s == null || s.Product == null || !s.Product.IsActive)
        {
            return new PosSerialScanResponseDto(false, false, normalized, "ERR_SERIAL_NOT_FOUND", null, null);
        }

        var serialDto = MapToDto(s);
        if (string.Equals(s.Status, "Sold", StringComparison.OrdinalIgnoreCase))
        {
            return new PosSerialScanResponseDto(true, false, s.SerialNumber, "ERR_SERIAL_ALREADY_SOLD", serialDto, null);
        }

        if (!string.Equals(s.Status, "InStock", StringComparison.OrdinalIgnoreCase))
        {
            return new PosSerialScanResponseDto(true, false, s.SerialNumber, "ERR_SERIAL_NOT_AVAILABLE_FOR_SALE", serialDto, null);
        }

        var availableStock = s.Product.WarehouseStocks.Sum(ws => Math.Max(0, ws.Quantity - ws.ReservedQuantity));
        var posProd = new PosProductDto
        {
            Id = s.Product.Id,
            Sku = s.Product.Sku,
            Barcode = s.Product.Barcode,
            Name = s.Product.Name,
            CategoryName = s.Product.Category?.Name ?? "عام",
            RetailPrice = s.Product.SellingPrice,
            UnitOfMeasure = s.Product.UnitOfMeasure,
            AvailableStock = Math.Max(1, availableStock),
            MaxCashierDiscountPercent = s.Product.MaxCashierDiscountPercent > 0 ? s.Product.MaxCashierDiscountPercent : 5.0m,
            IsActive = s.Product.IsActive,
            IsBundle = s.Product.IsBundle,
            RequiresSerialNumber = s.Product.RequiresSerialNumber,
            WarrantyMonths = s.Product.WarrantyMonths,
            QuantityTiers = s.Product.QuantityTiers
                .OrderBy(t => t.MinQty)
                .Select(t => new PosQuantityTierDto(t.Id, t.MinQty, t.MaxQty, t.UnitPrice))
                .ToList()
        };

        return new PosSerialScanResponseDto(true, true, s.SerialNumber, null, serialDto, posProd);
    }

    public async Task<ApiResponse<List<ProductSerialDto>>> RegisterSerialsAsync(RegisterSerialsRequest request)
    {
        if (request.SerialNumbers == null || request.SerialNumbers.Count == 0)
        {
            return ApiResponse<List<ProductSerialDto>>.Fail("ERR_EMPTY_SERIAL_LIST", "INVENTORY");
        }

        var product = await _context.Products.FindAsync(request.ProductId);
        if (product == null)
        {
            return ApiResponse<List<ProductSerialDto>>.Fail("ERR_PRODUCT_NOT_FOUND", "INVENTORY");
        }

        var warehouse = await _context.Warehouses
            .FirstOrDefaultAsync(w => w.Id == request.WarehouseId && w.IsActive);
        if (warehouse == null)
        {
            return ApiResponse<List<ProductSerialDto>>.Fail("ERR_WAREHOUSE_NOT_FOUND", "INVENTORY");
        }

        // Clean & Deduplicate input serials
        var uniqueInput = request.SerialNumbers
            .Where(sn => !string.IsNullOrWhiteSpace(sn))
            .Select(sn => sn.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (uniqueInput.Count == 0)
        {
            return ApiResponse<List<ProductSerialDto>>.Fail("ERR_EMPTY_SERIAL_LIST", "INVENTORY");
        }

        var lowerInput = uniqueInput.Select(s => s.ToLowerInvariant()).ToList();

        // Check if any serial already exists for this tenant (case-insensitive)
        var existingList = await _context.ProductSerials
            .Where(ps => lowerInput.Contains(ps.SerialNumber.ToLower()))
            .Select(ps => ps.SerialNumber)
            .ToListAsync();

        if (existingList.Count > 0)
        {
            return ApiResponse<List<ProductSerialDto>>.Fail("ERR_SERIAL_ALREADY_EXISTS", "INVENTORY",
                new Dictionary<string, object> { ["conflictingSerials"] = existingList });
        }

        var warrantyMonths = request.WarrantyMonths.HasValue
            ? Math.Max(0, request.WarrantyMonths.Value)
            : Math.Max(0, product.WarrantyMonths);

        var createdEntities = new List<ProductSerial>();
        var now = DateTime.UtcNow;

        foreach (var sn in uniqueInput)
        {
            var serial = new ProductSerial
            {
                SerialNumber = sn,
                ProductId = product.Id,
                WarehouseId = warehouse.Id,
                Status = "InStock",
                PurchaseBillId = request.PurchaseBillId,
                PurchaseBillItemId = request.PurchaseBillItemId,
                SupplierId = request.SupplierId,
                SupplierName = request.SupplierName?.Trim(),
                PurchaseDate = now,
                UnitCost = request.UnitCost ?? product.CostPrice,
                WarrantyMonths = warrantyMonths,
                // Strict rule: Warranty clock NEVER starts while InStock
                WarrantyStartDate = null,
                WarrantyEndDate = null,
                Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
                CreatedAt = now,
                UpdatedAt = now
            };
            createdEntities.Add(serial);
        }

        _context.ProductSerials.AddRange(createdEntities);
        await _context.SaveChangesAsync();

        var result = createdEntities.Select(s =>
        {
            s.Product = product;
            s.Warehouse = warehouse;
            return MapToDto(s);
        }).ToList();

        return ApiResponse<List<ProductSerialDto>>.Ok(result);
    }

    public async Task<ApiResponse<ProductSerialDto>> BindSerialToSaleAsync(BindSerialToSaleRequest request)
    {
        var cleanSn = (request.SerialNumber ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(cleanSn))
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_EMPTY_SERIAL", "SALES");
        }

        var serial = await _context.ProductSerials
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .Include(s => s.PurchaseBill)
            .FirstOrDefaultAsync(s => s.SerialNumber.ToLower() == cleanSn.ToLower());

        if (serial == null)
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_SERIAL_NOT_FOUND", "SALES");
        }

        if (string.Equals(serial.Status, "Sold", StringComparison.OrdinalIgnoreCase))
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_SERIAL_ALREADY_SOLD", "SALES",
                new Dictionary<string, object>
                {
                    ["serialNumber"] = serial.SerialNumber,
                    ["soldDate"] = serial.SoldDate?.ToString("yyyy-MM-dd") ?? "",
                    ["salesInvoiceId"] = serial.SalesInvoiceId?.ToString() ?? ""
                });
        }

        if (!string.Equals(serial.Status, "InStock", StringComparison.OrdinalIgnoreCase))
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_SERIAL_NOT_AVAILABLE_FOR_SALE", "SALES",
                new Dictionary<string, object> { ["status"] = serial.Status });
        }

        var months = request.WarrantyMonthsOverride.HasValue
            ? Math.Max(0, request.WarrantyMonthsOverride.Value)
            : Math.Max(0, serial.WarrantyMonths > 0 ? serial.WarrantyMonths : (serial.Product?.WarrantyMonths ?? 0));

        var soldDate = DateTime.UtcNow;
        DateTime? warrantyStart = months > 0 ? soldDate : null;
        DateTime? warrantyEnd = months > 0 ? soldDate.AddMonths(months) : null;

        serial.Status = "Sold";
        serial.SalesInvoiceId = request.SalesInvoiceId;
        serial.SalesInvoiceItemId = request.SalesInvoiceItemId;
        serial.CustomerId = request.CustomerId;
        serial.CustomerName = request.CustomerName?.Trim();
        serial.CustomerPhone = request.CustomerPhone?.Trim();
        serial.SoldDate = soldDate;
        serial.SellingPrice = request.SellingPrice ?? serial.Product?.SellingPrice;
        serial.WarrantyMonths = months;
        serial.WarrantyStartDate = warrantyStart;
        serial.WarrantyEndDate = warrantyEnd;
        serial.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await _context.Entry(serial).Reference(s => s.SalesInvoice).LoadAsync();

        return ApiResponse<ProductSerialDto>.Ok(MapToDto(serial));
    }

    public async Task<ApiResponse<ProductSerialDto>> UpdateSerialWarrantyAsync(Guid id, UpdateSerialWarrantyRequest request)
    {
        var serial = await _context.ProductSerials
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .Include(s => s.PurchaseBill)
            .Include(s => s.SalesInvoice)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (serial == null)
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_SERIAL_NOT_FOUND", "INVENTORY");
        }

        if (request.WarrantyMonths >= 0)
        {
            serial.WarrantyMonths = request.WarrantyMonths;
        }

        if (!string.IsNullOrWhiteSpace(request.Status) && AllowedStatuses.Contains(request.Status.Trim()))
        {
            serial.Status = NormalizeStatus(request.Status.Trim());
        }

        if (serial.Status != "Sold")
        {
            // Warranty clock only runs when Sold
            serial.WarrantyStartDate = null;
            serial.WarrantyEndDate = null;
        }
        else
        {
            if (request.WarrantyStartDate.HasValue)
            {
                serial.WarrantyStartDate = request.WarrantyStartDate.Value.ToUniversalTime();
            }

            if (request.WarrantyEndDate.HasValue)
            {
                serial.WarrantyEndDate = request.WarrantyEndDate.Value.ToUniversalTime();
            }
            else if (serial.WarrantyMonths == 0)
            {
                serial.WarrantyStartDate = null;
                serial.WarrantyEndDate = null;
            }
            else if (serial.WarrantyStartDate.HasValue && serial.WarrantyMonths > 0)
            {
                serial.WarrantyEndDate = serial.WarrantyStartDate.Value.AddMonths(serial.WarrantyMonths);
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            serial.Notes = request.Notes.Trim();
        }

        serial.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return ApiResponse<ProductSerialDto>.Ok(MapToDto(serial));
    }

    public async Task<ApiResponse<ProductSerialDto>> UpdateSerialStatusAsync(Guid id, UpdateSerialStatusRequest request, string? actorName)
    {
        if (string.IsNullOrWhiteSpace(request.Status) || !AllowedStatuses.Contains(request.Status.Trim()))
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_INVALID_SERIAL_STATUS", "INVENTORY");
        }

        var serial = await _context.ProductSerials
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .Include(s => s.PurchaseBill)
            .Include(s => s.SalesInvoice)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (serial == null)
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_SERIAL_NOT_FOUND", "INVENTORY");
        }

        var previousStatus = serial.Status;
        var nextStatus = NormalizeStatus(request.Status.Trim());
        serial.Status = nextStatus;

        if (nextStatus != "Sold")
        {
            serial.WarrantyStartDate = null;
            serial.WarrantyEndDate = null;
        }

        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            serial.Notes = string.IsNullOrWhiteSpace(serial.Notes)
                ? request.Notes.Trim()
                : $"{serial.Notes} | {request.Notes.Trim()}";
        }

        serial.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            TenantId = serial.TenantId,
            UserId = actorName ?? "System",
            Username = actorName ?? "System",
            Action = "SERIAL_STATUS_UPDATE",
            EntityName = "product_serials",
            EntityId = serial.Id.ToString(),
            OldValues = System.Text.Json.JsonSerializer.Serialize(new { Status = previousStatus }),
            NewValues = System.Text.Json.JsonSerializer.Serialize(new { Status = nextStatus, Notes = request.Notes }),
            Timestamp = DateTimeOffset.UtcNow
        });

        await _context.SaveChangesAsync();
        return ApiResponse<ProductSerialDto>.Ok(MapToDto(serial));
    }

    private static string NormalizeStatus(string raw)
    {
        return raw.Trim().ToLowerInvariant() switch
        {
            "instock" or "in_stock" => "InStock",
            "sold" => "Sold",
            "returned" => "Returned",
            "defective" => "Defective",
            "transferred" => "Transferred",
            _ => raw.Trim()
        };
    }

    private static string ComputeWarrantyStatus(ProductSerial s)
    {
        if (!string.Equals(s.Status, "Sold", StringComparison.OrdinalIgnoreCase))
        {
            return "NotStarted";
        }

        if (s.WarrantyMonths <= 0 || !s.WarrantyEndDate.HasValue)
        {
            return "NoWarranty";
        }

        return s.WarrantyEndDate.Value >= DateTime.UtcNow ? "Active" : "Expired";
    }

    private static int? ComputeRemainingDays(ProductSerial s)
    {
        if (!string.Equals(s.Status, "Sold", StringComparison.OrdinalIgnoreCase)
            || s.WarrantyMonths <= 0
            || !s.WarrantyEndDate.HasValue)
        {
            return null;
        }

        return (int)Math.Max(0, Math.Ceiling((s.WarrantyEndDate.Value.Date - DateTime.UtcNow.Date).TotalDays));
    }

    private static ProductSerialDto MapToDto(ProductSerial s)
    {
        var warrantyStatus = ComputeWarrantyStatus(s);
        var remainingDays = ComputeRemainingDays(s);
        var isSold = string.Equals(s.Status, "Sold", StringComparison.OrdinalIgnoreCase);

        return new ProductSerialDto(
            s.Id,
            s.SerialNumber,
            s.ProductId,
            s.Product?.Sku ?? "",
            s.Product?.Name ?? "",
            s.WarehouseId,
            s.Warehouse?.Name ?? "",
            s.Status,
            s.PurchaseBillId,
            s.SupplierName,
            s.PurchaseDate,
            s.UnitCost,
            s.SalesInvoiceId,
            s.CustomerName,
            s.CustomerPhone,
            s.SoldDate,
            s.SellingPrice,
            s.WarrantyMonths,
            isSold ? s.WarrantyStartDate : null,
            isSold ? s.WarrantyEndDate : null,
            warrantyStatus == "Active",
            s.Notes,
            s.CreatedAt,
            warrantyStatus,
            remainingDays,
            s.PurchaseBill?.BillNumber,
            s.SalesInvoice?.InvoiceNumber
        );
    }
}
