namespace Erp.Domain.Entities;

public sealed class WarehouseStock : BaseEntity
{
    public Guid WarehouseId { get; private set; }
    public Guid ItemId { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal ReservedQuantity { get; private set; }

    private WarehouseStock() { } // For EF Core

    public WarehouseStock(Guid warehouseId, Guid itemId, decimal initialQuantity)
    {
        WarehouseId = warehouseId;
        ItemId = itemId;
        Quantity = initialQuantity >= 0 ? initialQuantity : throw new ArgumentException("ERR.INVENTORY.INVALID_INITIAL_STOCK");
        ReservedQuantity = 0;
    }

    public bool HasSufficientStock(decimal requestedQuantity)
        => (Quantity - ReservedQuantity) >= requestedQuantity;

    public void DeductStock(decimal quantity)
    {
        if (quantity <= 0)
            throw new InvalidOperationException("ERR.INVENTORY.INVALID_DISPATCH_QUANTITY");
            
        if (!HasSufficientStock(quantity))
            throw new InvalidOperationException("ERR.INVENTORY.INSUFFICIENT_STOCK");

        Quantity -= quantity;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void ReserveStock(decimal quantity)
    {
        if (quantity <= 0)
            throw new InvalidOperationException("ERR.INVENTORY.INVALID_RESERVATION_QUANTITY");
        if (!HasSufficientStock(quantity))
            throw new InvalidOperationException("ERR.INVENTORY.INSUFFICIENT_STOCK");

        ReservedQuantity += quantity;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void FulfillReservedStock(decimal quantity)
    {
        if (quantity <= 0)
            throw new InvalidOperationException("ERR.INVENTORY.INVALID_FULFILL_QUANTITY");
        if (ReservedQuantity < quantity)
            throw new InvalidOperationException("ERR.INVENTORY.INSUFFICIENT_RESERVED_STOCK");

        ReservedQuantity -= quantity;
        Quantity -= quantity;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void CancelReservation(decimal quantity)
    {
        if (quantity <= 0)
            throw new InvalidOperationException("ERR.INVENTORY.INVALID_CANCEL_QUANTITY");

        ReservedQuantity = Math.Max(0, ReservedQuantity - quantity);
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void AddStock(decimal quantity)
    {
        if (quantity <= 0)
            throw new InvalidOperationException("ERR.INVENTORY.INVALID_INCOMING_QUANTITY");

        Quantity += quantity;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
