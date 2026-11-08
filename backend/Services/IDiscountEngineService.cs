using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface IDiscountEngineService
{
    /// <summary>
    /// Retrieves product list strictly masked for POS terminal and cashier screens.
    /// Excludes cost_price, min_profit_margin, and profit data.
    /// </summary>
    Task<IEnumerable<PosProductDto>> GetPosProductsAsync(string? search, Guid? categoryId);

    /// <summary>
    /// Performs silent backend validation of requested discount without disclosing cost.
    /// Returns ERR_DISCOUNT_EXCEEDED_LIMIT if limits or margins are breached.
    /// </summary>
    Task<ValidateDiscountResponse> ValidateDiscountAsync(ValidateDiscountRequest request);

    /// <summary>
    /// Authorizes a discount override via Supervisor or Admin PIN.
    /// </summary>
    Task<ManagerOverrideResponse> AuthorizeManagerOverrideAsync(ManagerOverrideRequest request);

    /// <summary>
    /// Finalizes POS checkout with transactional stock deduction and automated Discount Audit Trail.
    /// </summary>
    Task<PosInvoiceResponse> CreatePosInvoiceAsync(CreatePosInvoiceRequest request);

    /// <summary>
    /// Returns historical audit logs for manager and auditor inspection.
    /// </summary>
    Task<IEnumerable<DiscountAuditLogDto>> GetDiscountAuditLogsAsync(string? invoiceNumber, DateTime? fromDate, DateTime? toDate);

    /// <summary>
    /// Returns dynamic list of tenant categories for POS terminal filter bar.
    /// </summary>
    Task<IEnumerable<PosCategoryDto>> GetPosCategoriesAsync();

    /// <summary>
    /// Retrieves pending dispatch orders queue for warehouse keepers.
    /// </summary>
    Task<IEnumerable<WarehouseDispatchOrderDto>> GetPendingDispatchOrdersAsync(Guid? warehouseId);

    /// <summary>
    /// Approves dispatch order, converts reserved quantity to actual deduction, and fulfills invoice.
    /// </summary>
    Task<ApproveDispatchOrderResponse> ApproveDispatchOrderAsync(Guid dispatchOrderId, ApproveDispatchOrderRequest request);
}
