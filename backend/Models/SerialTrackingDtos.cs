using System.ComponentModel.DataAnnotations;

namespace ERP.Warehouse.Api.Models;

public record ProductSerialDto(
    Guid Id,
    string SerialNumber,
    Guid ProductId,
    string ProductSku,
    string ProductName,
    Guid WarehouseId,
    string WarehouseName,
    string Status,
    Guid? PurchaseBillId,
    string? SupplierName,
    DateTime? PurchaseDate,
    decimal? UnitCost,
    Guid? SalesInvoiceId,
    string? CustomerName,
    string? CustomerPhone,
    DateTime? SoldDate,
    decimal? SellingPrice,
    int WarrantyMonths,
    DateTime? WarrantyStartDate,
    DateTime? WarrantyEndDate,
    bool IsWarrantyActive,
    string? Notes,
    DateTime CreatedAt,
    string WarrantyStatus = "NotStarted",
    int? RemainingWarrantyDays = null,
    string? PurchaseBillNumber = null,
    string? SalesInvoiceNumber = null
);

public record SerialLookupResultDto(
    bool Found,
    string SerialNumber,
    ProductSerialDetailDto? Detail,
    string? ErrorCode = null
);

public record ProductSerialDetailDto(
    Guid Id,
    string SerialNumber,
    Guid ProductId,
    string ProductSku,
    string ProductName,
    string? Barcode,
    Guid WarehouseId,
    string WarehouseName,
    string Status, // InStock, Sold, Returned, Defective, Transferred

    // Purchase Inbound Details
    Guid? PurchaseBillId,
    string? PurchaseBillNumber,
    Guid? SupplierId,
    string? SupplierName,
    DateTime? PurchaseDate,
    decimal? UnitCost,

    // Sales Outbound Details
    Guid? SalesInvoiceId,
    string? SalesInvoiceNumber,
    Guid? CustomerId,
    string? CustomerName,
    string? CustomerPhone,
    DateTime? SoldDate,
    decimal? SellingPrice,

    // Warranty Details
    int WarrantyMonths,
    DateTime? WarrantyStartDate,
    DateTime? WarrantyEndDate,
    bool IsWarrantyActive,
    int? RemainingWarrantyDays,
    string? Notes,
    string WarrantyStatus = "NotStarted"
);

public record RegisterSerialsRequest(
    [Required] Guid ProductId,
    [Required] Guid WarehouseId,
    Guid? PurchaseBillId,
    Guid? PurchaseBillItemId,
    Guid? SupplierId,
    string? SupplierName,
    decimal? UnitCost,
    int? WarrantyMonths = null,
    [Required] List<string> SerialNumbers = null!,
    string? Notes = null
);

public record BindSerialToSaleRequest(
    [Required] string SerialNumber,
    [Required] Guid SalesInvoiceId,
    Guid? SalesInvoiceItemId,
    Guid? CustomerId,
    string? CustomerName,
    string? CustomerPhone,
    decimal? SellingPrice,
    int? WarrantyMonthsOverride = null
);

public record UpdateSerialWarrantyRequest(
    int WarrantyMonths,
    DateTime? WarrantyStartDate,
    DateTime? WarrantyEndDate,
    string? Status,
    string? Notes
);

public record UpdateSerialStatusRequest(
    [Required] string Status,
    string? Notes = null
);

public record PosSerialScanResponseDto(
    bool Found,
    bool Available,
    string SerialNumber,
    string? ErrorCode,
    ProductSerialDto? Serial,
    PosProductDto? Product
);
