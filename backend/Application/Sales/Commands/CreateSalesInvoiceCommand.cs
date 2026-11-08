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
    string? OverrideReason = null
);

public sealed record CreateSalesInvoiceCommand(
    Guid WarehouseId,
    string DispenseMode, // "IN_STORE" or "WAREHOUSE_DISPATCH"
    Guid? TargetWarehouseId,
    string? CustomerName,
    string CashierId,
    string CashierName,
    string PaymentMethod,
    List<SalesItemRequestDto> Items
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
                CustomerName = cmd.CustomerName,
                CashierId = cmd.CashierId,
                CashierName = cmd.CashierName,
                PaymentMethod = cmd.PaymentMethod,
                Items = cmd.Items.ConvertAll(i => new PosInvoiceItemRequest
                {
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    DiscountType = i.DiscountType,
                    DiscountValue = i.DiscountValue,
                    OverrideReason = i.OverrideReason
                })
            };

            var invoiceResponse = await _discountEngine.CreatePosInvoiceAsync(req);
            return Result<PosInvoiceResponse>.Success(invoiceResponse);
        }
        catch (ApplicationException ex)
        {
            var isWarehouseError = ex.Message.Contains("المستودع") || ex.Message.Contains("مستودع") || ex.Message.Contains("INVALID_WAREHOUSE");
            return Result<PosInvoiceResponse>.Failure(
                isWarehouseError ? "INVALID_WAREHOUSE" : "ERR_SALES_COMMAND_FAILED",
                "SALES",
                new[] { new ErrorDetail(isWarehouseError ? "WarehouseId" : "DispenseMode", ex.Message, cmd.WarehouseId) }
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

