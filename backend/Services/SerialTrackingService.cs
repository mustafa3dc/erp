using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface ISerialTrackingService
{
    Task<List<ProductSerialDto>> GetSerialsAsync(string? query, Guid? productId, Guid? warehouseId, string? status, int limit = 100);
    Task<SerialLookupResultDto> LookupSerialAsync(string serialNumber);
    Task<ApiResponse<List<ProductSerialDto>>> RegisterSerialsAsync(RegisterSerialsRequest request);
    Task<ApiResponse<ProductSerialDto>> BindSerialToSaleAsync(BindSerialToSaleRequest request);
    Task<ApiResponse<ProductSerialDto>> UpdateSerialWarrantyAsync(Guid id, UpdateSerialWarrantyRequest request);
}

public class SerialTrackingService : ISerialTrackingService
{
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
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim().ToLower();
            q = q.Where(s => s.SerialNumber.ToLower().Contains(search) 
                || (s.Product != null && (s.Product.Name.ToLower().Contains(search) || s.Product.Sku.ToLower().Contains(search)))
                || (s.CustomerName != null && s.CustomerName.ToLower().Contains(search)));
        }

        if (productId.HasValue)
        {
            q = q.Where(s => s.ProductId == productId.Value);
        }

        if (warehouseId.HasValue)
        {
            q = q.Where(s => s.WarehouseId == warehouseId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var st = status.Trim().ToLower();
            q = q.Where(s => s.Status.ToLower() == st);
        }

        var list = await q
            .OrderByDescending(s => s.CreatedAt)
            .Take(limit)
            .ToListAsync();

        return list.Select(s => new ProductSerialDto(
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
            s.WarrantyStartDate,
            s.WarrantyEndDate,
            s.IsWarrantyActive,
            s.Notes,
            s.CreatedAt
        )).ToList();
    }

    public async Task<SerialLookupResultDto> LookupSerialAsync(string serialNumber)
    {
        if (string.IsNullOrWhiteSpace(serialNumber))
        {
            return new SerialLookupResultDto(false, serialNumber, null, "ERR_EMPTY_SERIAL");
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

        int? remainingDays = null;
        if (s.WarrantyEndDate.HasValue)
        {
            remainingDays = (int)Math.Max(0, (s.WarrantyEndDate.Value.Date - DateTime.UtcNow.Date).TotalDays);
        }

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
            WarrantyStartDate: s.WarrantyStartDate,
            WarrantyEndDate: s.WarrantyEndDate,
            IsWarrantyActive: s.IsWarrantyActive,
            RemainingWarrantyDays: remainingDays,
            Notes: s.Notes
        );

        return new SerialLookupResultDto(true, s.SerialNumber, detail);
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

        // Check if any serial already exists for this tenant
        var existingList = await _context.ProductSerials
            .Where(ps => uniqueInput.Contains(ps.SerialNumber))
            .Select(ps => ps.SerialNumber)
            .ToListAsync();

        if (existingList.Count > 0)
        {
            return ApiResponse<List<ProductSerialDto>>.Fail("ERR_SERIAL_ALREADY_EXISTS", "INVENTORY",
                new Dictionary<string, object> { ["conflictingSerials"] = existingList });
        }

        var warrantyMonths = request.WarrantyMonths > 0 ? request.WarrantyMonths : (product.WarrantyMonths > 0 ? product.WarrantyMonths : 12);
        var createdEntities = new List<ProductSerial>();

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
                PurchaseDate = DateTime.UtcNow,
                UnitCost = request.UnitCost ?? product.CostPrice,
                WarrantyMonths = warrantyMonths,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            createdEntities.Add(serial);
        }

        _context.ProductSerials.AddRange(createdEntities);
        await _context.SaveChangesAsync();

        var result = createdEntities.Select(s => new ProductSerialDto(
            s.Id,
            s.SerialNumber,
            s.ProductId,
            product.Sku,
            product.Name,
            s.WarehouseId,
            warehouse.Name,
            s.Status,
            s.PurchaseBillId,
            s.SupplierName,
            s.PurchaseDate,
            s.UnitCost,
            null, null, null, null, null,
            s.WarrantyMonths,
            null, null, false,
            null,
            s.CreatedAt
        )).ToList();

        return ApiResponse<List<ProductSerialDto>>.Ok(result);
    }

    public async Task<ApiResponse<ProductSerialDto>> BindSerialToSaleAsync(BindSerialToSaleRequest request)
    {
        var cleanSn = request.SerialNumber.Trim();
        var serial = await _context.ProductSerials
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .FirstOrDefaultAsync(s => s.SerialNumber.ToLower() == cleanSn.ToLower());

        if (serial == null)
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_SERIAL_NOT_FOUND", "SALES");
        }

        if (serial.Status == "Sold")
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_SERIAL_ALREADY_SOLD", "SALES",
                new Dictionary<string, object>
                {
                    ["serialNumber"] = serial.SerialNumber,
                    ["soldDate"] = serial.SoldDate?.ToString("yyyy-MM-dd") ?? "",
                    ["salesInvoiceId"] = serial.SalesInvoiceId?.ToString() ?? ""
                });
        }

        if (serial.Status != "InStock")
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_SERIAL_NOT_AVAILABLE_FOR_SALE", "SALES",
                new Dictionary<string, object> { ["status"] = serial.Status });
        }

        var months = request.WarrantyMonthsOverride.HasValue && request.WarrantyMonthsOverride.Value > 0
            ? request.WarrantyMonthsOverride.Value
            : serial.WarrantyMonths;

        var soldDate = DateTime.UtcNow;
        var warrantyStart = soldDate;
        var warrantyEnd = soldDate.AddMonths(months);

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

        var dto = new ProductSerialDto(
            serial.Id,
            serial.SerialNumber,
            serial.ProductId,
            serial.Product?.Sku ?? "",
            serial.Product?.Name ?? "",
            serial.WarehouseId,
            serial.Warehouse?.Name ?? "",
            serial.Status,
            serial.PurchaseBillId,
            serial.SupplierName,
            serial.PurchaseDate,
            serial.UnitCost,
            serial.SalesInvoiceId,
            serial.CustomerName,
            serial.CustomerPhone,
            serial.SoldDate,
            serial.SellingPrice,
            serial.WarrantyMonths,
            serial.WarrantyStartDate,
            serial.WarrantyEndDate,
            serial.IsWarrantyActive,
            serial.Notes,
            serial.CreatedAt
        );

        return ApiResponse<ProductSerialDto>.Ok(dto);
    }

    public async Task<ApiResponse<ProductSerialDto>> UpdateSerialWarrantyAsync(Guid id, UpdateSerialWarrantyRequest request)
    {
        var serial = await _context.ProductSerials
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (serial == null)
        {
            return ApiResponse<ProductSerialDto>.Fail("ERR_SERIAL_NOT_FOUND", "INVENTORY");
        }

        if (request.WarrantyMonths > 0)
        {
            serial.WarrantyMonths = request.WarrantyMonths;
        }

        if (request.WarrantyStartDate.HasValue)
        {
            serial.WarrantyStartDate = request.WarrantyStartDate.Value.ToUniversalTime();
        }

        if (request.WarrantyEndDate.HasValue)
        {
            serial.WarrantyEndDate = request.WarrantyEndDate.Value.ToUniversalTime();
        }
        else if (serial.WarrantyStartDate.HasValue && serial.WarrantyMonths > 0)
        {
            serial.WarrantyEndDate = serial.WarrantyStartDate.Value.AddMonths(serial.WarrantyMonths);
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            serial.Status = request.Status.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            serial.Notes = request.Notes.Trim();
        }

        serial.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var dto = new ProductSerialDto(
            serial.Id,
            serial.SerialNumber,
            serial.ProductId,
            serial.Product?.Sku ?? "",
            serial.Product?.Name ?? "",
            serial.WarehouseId,
            serial.Warehouse?.Name ?? "",
            serial.Status,
            serial.PurchaseBillId,
            serial.SupplierName,
            serial.PurchaseDate,
            serial.UnitCost,
            serial.SalesInvoiceId,
            serial.CustomerName,
            serial.CustomerPhone,
            serial.SoldDate,
            serial.SellingPrice,
            serial.WarrantyMonths,
            serial.WarrantyStartDate,
            serial.WarrantyEndDate,
            serial.IsWarrantyActive,
            serial.Notes,
            serial.CreatedAt
        );

        return ApiResponse<ProductSerialDto>.Ok(dto);
    }
}
