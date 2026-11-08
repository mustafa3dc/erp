namespace Erp.Domain.Entities;

public enum StockMovementType
{
    PurchaseReceipt = 1,
    SaleDispatch = 2,
    TransferIn = 3,
    TransferOut = 4,
    InventoryAdjustment = 5
}

public sealed class StockMovement
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public StockMovementType MovementType { get; private set; }
    public Guid ItemId { get; private set; }
    public Guid? SourceWarehouseId { get; private set; }
    public Guid? TargetWarehouseId { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal CostPerUnit { get; private set; }
    public decimal TotalCost { get; private set; }
    public Guid? ReferenceId { get; private set; }
    public string? ReferenceCode { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; } = DateTimeOffset.UtcNow;

    private StockMovement() { }

    public StockMovement(
        StockMovementType movementType,
        Guid itemId,
        Guid? sourceWarehouseId,
        Guid? targetWarehouseId,
        decimal quantity,
        decimal costPerUnit,
        Guid? referenceId,
        string? referenceCode,
        Guid createdBy)
    {
        MovementType = movementType;
        ItemId = itemId;
        SourceWarehouseId = sourceWarehouseId;
        TargetWarehouseId = targetWarehouseId;
        Quantity = quantity;
        CostPerUnit = costPerUnit;
        TotalCost = quantity * costPerUnit;
        ReferenceId = referenceId;
        ReferenceCode = referenceCode;
        CreatedBy = createdBy;
    }
}
