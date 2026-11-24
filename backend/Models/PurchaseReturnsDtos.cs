using System.ComponentModel.DataAnnotations;

namespace ERP.Warehouse.Api.Models;

public record PurchaseReturnDto(
    Guid Id,
    string ReturnNumber,
    Guid OriginalBillId,
    string OriginalBillNumber,
    Guid SupplierId,
    string SupplierName,
    Guid WarehouseId,
    string WarehouseName,
    DateTime ReturnDate,
    string Status,
    decimal Subtotal,
    decimal TaxAmount,
    decimal TotalAmount,
    string Currency,
    decimal ExchangeRate,
    string RefundMethod,
    Guid? CashBoxId,
    string? CashBoxName,
    string? ReturnReason,
    string? ApprovedBy,
    DateTime? ApprovedAt,
    string? Notes,
    string? CreatedBy,
    DateTime CreatedAt,
    List<PurchaseReturnItemDto> Items
);

public record PurchaseReturnItemDto(
    Guid Id,
    Guid PurchaseBillItemId,
    Guid ProductId,
    string ProductSku,
    string ProductName,
    string UnitOfMeasure,
    decimal PurchasedQuantity,
    decimal PreviouslyReturnedQuantity,
    decimal ReturnQuantity,
    decimal UnitCost,
    decimal LineTotal,
    string? Reason,
    string? SerialNumber
);

public record CreatePurchaseReturnRequest(
    [Required] Guid OriginalBillId,
    [Required] Guid WarehouseId,
    DateTime? ReturnDate = null,
    string Currency = "IQD",
    decimal ExchangeRate = 1.0000m,
    string RefundMethod = "SUPPLIER_CREDIT", // SUPPLIER_CREDIT, CASH_REFUND, BANK_REFUND
    Guid? CashBoxId = null,
    string? ReturnReason = null,
    string? Notes = null,
    [Required] List<PurchaseReturnItemInputDto> Items = null!
);

public record PurchaseReturnItemInputDto(
    [Required] Guid PurchaseBillItemId,
    [Required] Guid ProductId,
    [Range(0.001, double.MaxValue)] decimal ReturnQuantity,
    string? Reason = null,
    string? SerialNumber = null
);

public record ReturnableBillItemDto(
    Guid PurchaseBillItemId,
    Guid ProductId,
    string ProductSku,
    string? ProductBarcode,
    string ProductName,
    string UnitOfMeasure,
    decimal PurchasedQuantity,
    decimal PreviouslyReturnedQuantity,
    decimal AvailableToReturnQuantity,
    decimal UnitCost,
    bool RequiresSerialNumber
);

public record ApprovePurchaseReturnRequest(
    string? Notes = null
);
