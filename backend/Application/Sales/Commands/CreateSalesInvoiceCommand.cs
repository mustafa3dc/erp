using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Erp.Domain.Common;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace Erp.Application.Sales.Commands;

public sealed record SalesItemRequestDto(
    Guid ProductId,
    int Quantity,
    string DiscountType = "NONE",
    decimal DiscountValue = 0.00m,
    string? OverrideReason = null,
    List<string>? SerialNumbers = null
);

public sealed record CreateSalesInvoiceCommand(
    Guid WarehouseId,
    string DispenseMode, // "IN_STORE" or "WAREHOUSE_DISPATCH"
    Guid? TargetWarehouseId,
    Guid? CustomerId,
    string? CustomerName,
    string CashierId,
    string CashierName,
    string PaymentMethod,
    List<SalesItemRequestDto> Items,
    string? ShiftId = null,
    Guid? TreasuryAccountId = null,
    InvoiceSource Source = InvoiceSource.StandardInvoice,
    decimal RedeemPoints = 0.0000m,
    decimal InvoiceDiscountAmount = 0.0000m
) : Inventory.Commands.IRequest<Result<PosInvoiceResponse>>;

public sealed class CreateSalesInvoiceCommandHandler 
    : Inventory.Commands.IRequestHandler<CreateSalesInvoiceCommand, Result<PosInvoiceResponse>>
{
    private readonly IDiscountEngineService _discountEngine;

    public CreateSalesInvoiceCommandHandler(IDiscountEngineService discountEngine)
    {
        _discountEngine = discountEngine;
    }

    public async Task<Result<PosInvoiceResponse>> Handle(CreateSalesInvoiceCommand cmd, CancellationToken ct)
    {
        try
        {
            var req = new CreatePosInvoiceRequest
            {
                WarehouseId = cmd.WarehouseId,
                DispenseMode = cmd.DispenseMode,
                TargetWarehouseId = cmd.TargetWarehouseId,
                CustomerId = cmd.CustomerId,
                CustomerName = cmd.CustomerName,
                CashierId = cmd.CashierId,
                CashierName = cmd.CashierName,
                ShiftId = cmd.ShiftId,
                Source = cmd.Source,
                TreasuryAccountId = cmd.TreasuryAccountId,
                PaymentMethod = cmd.PaymentMethod,
                InvoiceDiscountAmount = cmd.InvoiceDiscountAmount,
                RedeemPoints = cmd.RedeemPoints,
                Items = cmd.Items.ConvertAll(i => new PosInvoiceItemRequest
                {
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    DiscountType = i.DiscountType,
                    DiscountValue = i.DiscountValue,
                    OverrideReason = i.OverrideReason,
                    SerialNumbers = i.SerialNumbers
                })
            };

            var invoiceResponse = await _discountEngine.CreatePosInvoiceAsync(req);
            return Result<PosInvoiceResponse>.Success(invoiceResponse);
        }
        catch (ApplicationException ex)
        {
            var errorCode = ex.Message.Contains("ERR_NO_ACTIVE_SHIFT")
                ? "ERR_NO_ACTIVE_SHIFT"
                : ex.Message.Contains("ERR_INSUFFICIENT_LOYALTY_POINTS")
                ? "ERR_INSUFFICIENT_LOYALTY_POINTS"
                : ex.Message.Contains("ERR_BELOW_MIN_REDEEM_POINTS")
                ? "ERR_BELOW_MIN_REDEEM_POINTS"
                : ex.Message.Contains("ERR_LOYALTY_DISABLED")
                ? "ERR_LOYALTY_DISABLED"
                : ex.Message.Contains("ERR_LOYALTY_WALKIN_NOT_ALLOWED")
                ? "ERR_LOYALTY_WALKIN_NOT_ALLOWED"
                : ex.Message.Contains("ERR_CUSTOMER_REQUIRED_FOR_CREDIT")
                ? "ERR_CUSTOMER_REQUIRED_FOR_CREDIT"
                : ex.Message.Contains("ERR_CUSTOMER_REQUIRED_FOR_INSTALLMENT")
                ? "ERR_CUSTOMER_REQUIRED_FOR_INSTALLMENT"
                : ex.Message.Contains("ERR_INVALID_INSTALLMENT_TERMS")
                ? "ERR_INVALID_INSTALLMENT_TERMS"
                : ex.Message.Contains("ERR_CREDIT_SALE_REQUIRES_CUSTOMER")
                ? "ERR_CREDIT_SALE_REQUIRES_CUSTOMER"
                : ex.Message.Contains("ERR_CUSTOMER_NOT_FOUND")
                ? "ERR_CUSTOMER_NOT_FOUND"
                : ex.Message.Contains("ERR_CREDIT_LIMIT_EXCEEDED")
                ? "ERR_CREDIT_LIMIT_EXCEEDED"
                : ex.Message.Contains("ERR_SERIAL_ALREADY_SOLD")
                ? "ERR_SERIAL_ALREADY_SOLD"
                : ex.Message.Contains("ERR_SERIAL_NOT_AVAILABLE_FOR_SALE")
                ? "ERR_SERIAL_NOT_AVAILABLE_FOR_SALE"
                : ex.Message.Contains("ERR_SERIAL_NOT_FOUND")
                ? "ERR_SERIAL_NOT_FOUND"
                : (ex.Message.Contains("ERR_INSUFFICIENT_STOCK") || ex.Message.Contains("غير كافٍ") || ex.Message.Contains("الرصيد"))
                ? "ERR_INSUFFICIENT_STOCK"
                : (ex.Message.Contains("INVALID_WAREHOUSE") || ex.Message.Contains("المستودع") || ex.Message.Contains("مستودع"))
                ? "INVALID_WAREHOUSE"
                : "ERR_SALES_COMMAND_FAILED";

            var targetField = errorCode.Contains("CUSTOMER") || errorCode.Contains("CREDIT")
                ? "CustomerId"
                : (errorCode == "INVALID_WAREHOUSE" ? "WarehouseId" : (errorCode == "ERR_INSUFFICIENT_STOCK" ? "Items" : "DispenseMode"));

            return Result<PosInvoiceResponse>.Failure(
                errorCode,
                "SALES",
                new[] { new ErrorDetail(targetField, ex.Message, cmd.WarehouseId) }
            );
        }
        catch (Exception ex)
        {
            return Result<PosInvoiceResponse>.Failure("ERR_INTERNAL_SALES_PROCESSING", "SALES", new[]
            {
                new ErrorDetail("Execution", ex.Message)
            });
        }
    }
}

