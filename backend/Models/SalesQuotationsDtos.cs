using System.ComponentModel.DataAnnotations;

namespace ERP.Warehouse.Api.Models;

public record SalesQuotationDto(
    Guid Id,
    string QuotationNumber,
    DateTime QuotationDate,
    DateTime ExpiryDate,
    Guid? CustomerId,
    string CustomerName,
    string? CustomerPhone,
    string? CustomerAddress,
    string? CustomerTaxNo,
    Guid WarehouseId,
    string WarehouseName,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal TaxAmount,
    decimal TotalAmount,
    string Currency,
    decimal ExchangeRate,
    string Status,
    Guid? ConvertedInvoiceId,
    string? ConvertedInvoiceNumber,
    DateTime? ConvertedAt,
    string? SalespersonName,
    string? TermsAndConditions,
    string? Notes,
    DateTime CreatedAt,
    List<SalesQuotationItemDto> Items
);

public record SalesQuotationItemDto(
    Guid Id,
    Guid ProductId,
    string ProductSku,
    string ProductName,
    string UnitOfMeasure,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal DiscountAmount,
    decimal TaxPercent,
    decimal TaxAmount,
    decimal LineTotal,
    string? Notes
);

public record CreateSalesQuotationRequest(
    DateTime? ExpiryDate,
    Guid? CustomerId,
    [Required] string CustomerName,
    string? CustomerPhone,
    string? CustomerAddress,
    string? CustomerTaxNo,
    [Required] Guid WarehouseId,
    string Currency = "IQD",
    decimal ExchangeRate = 1.0000m,
    string? TermsAndConditions = null,
    string? Notes = null,
    [Required] List<SalesQuotationItemInputDto> Items = null!
);

public record SalesQuotationItemInputDto(
    [Required] Guid ProductId,
    string? ProductSku,
    string? ProductName,
    string UnitOfMeasure = "قطعة",
    [Range(0.001, double.MaxValue)] decimal Quantity = 1,
    [Range(0, double.MaxValue)] decimal UnitPrice = 0,
    [Range(0, 100)] decimal DiscountPercent = 0,
    [Range(0, 100)] decimal TaxPercent = 0,
    string? Notes = null
);

public record ConvertQuotationToInvoiceRequest(
    [Required] Guid TargetWarehouseId,
    string DispenseMode = "IN_STORE", // IN_STORE, WAREHOUSE_DISPATCH
    string PaymentMethod = "CASH",
    string? Notes = null
);

public record ConvertQuotationResponseDto(
    Guid InvoiceId,
    string InvoiceNumber,
    decimal TotalAmount,
    string FulfillmentStatus,
    DateTime ConvertedAt
);
