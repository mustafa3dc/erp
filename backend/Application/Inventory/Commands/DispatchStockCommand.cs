using System.Data;
using Erp.Domain.Common;
using Erp.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace Erp.Application.Inventory.Commands;

// MediatR interfaces (if MediatR package is present or custom interfaces)
public interface IRequest<out TResponse> { }
public interface IRequestHandler<in TRequest, TResponse> where TRequest : IRequest<TResponse>
{
    Task<TResponse> Handle(TRequest request, CancellationToken cancellationToken);
}

public interface IErpDbContext
{
    DbSet<WarehouseStock> WarehouseStocks { get; }
    DbSet<StockMovement> StockMovements { get; }
    DbSet<ERP.Warehouse.Api.Models.Warehouse> Warehouses { get; }
    Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken ct);
    Task<int> SaveChangesAsync(CancellationToken ct);
}

public sealed record DispatchStockCommand(
    Guid WarehouseId,
    Guid ItemId,
    decimal Quantity,
    decimal UnitPrice,
    Guid InvoiceId,
    string InvoiceNumber,
    Guid UserId
) : IRequest<Result<Guid>>;

public sealed class DispatchStockCommandHandler : IRequestHandler<DispatchStockCommand, Result<Guid>>
{
    private readonly IErpDbContext _dbContext;
    private readonly IConnectionMultiplexer _redis;
    private static readonly TimeSpan LockExpiry = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan LockWait = TimeSpan.FromSeconds(2);

    public DispatchStockCommandHandler(IErpDbContext dbContext, IConnectionMultiplexer redis)
    {
        _dbContext = dbContext;
        _redis = redis;
    }

    public async Task<Result<Guid>> Handle(DispatchStockCommand cmd, CancellationToken ct)
    {
        var db = _redis.GetDatabase();
        var lockKey = $"lock:stock:{cmd.WarehouseId:N}:{cmd.ItemId:N}";
        var lockToken = Guid.NewGuid().ToString("N");

        // 1. اكتساب القفل الموزع لمنع التنافس اللحظي
        var acquired = await db.LockTakeAsync(lockKey, lockToken, LockExpiry);
        if (!acquired)
        {
            return Result<Guid>.Failure(
                "ERR.CONCURRENCY.RESOURCE_BUSY",
                "INVENTORY",
                new[] { new ErrorDetail("ItemId", "ERR.RESOURCE_LOCKED", cmd.ItemId) }
            );
        }

        try
        {
            // 2. فتح المعاملة الذرية في PostgreSQL
            await using var tx = await _dbContext.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
            try
            {
                // التحقق من وجود المستودع وأنه نشط (Backend Guard)
                var warehouse = await _dbContext.Warehouses
                    .FirstOrDefaultAsync(w => w.Id == cmd.WarehouseId && w.IsActive, ct);

                if (warehouse == null)
                {
                    await tx.RollbackAsync(ct);
                    return Result<Guid>.Failure(
                        "INVALID_WAREHOUSE",
                        "INVENTORY",
                        new[] { new ErrorDetail("WarehouseId", "المستودع المحدد غير موجود أو تم تعطيله. يرجى اختيار مستودع نشط.", cmd.WarehouseId) }
                    );
                }

                var stock = await _dbContext.WarehouseStocks
                    .FirstOrDefaultAsync(s => s.WarehouseId == cmd.WarehouseId && s.ItemId == cmd.ItemId, ct);

                if (stock == null || !stock.HasSufficientStock(cmd.Quantity))
                {
                    await tx.RollbackAsync(ct);
                    return Result<Guid>.Failure(
                        "ERR.INVENTORY.INSUFFICIENT_STOCK",
                        "INVENTORY",
                        new[] {
                            new ErrorDetail("Quantity", "ERR.VALUE_EXCEEDS_AVAILABLE", new {
                                Available = stock != null ? stock.Quantity - stock.ReservedQuantity : 0,
                                Requested = cmd.Quantity
                            })
                        }
                    );
                }

                // تسجيل حركة المخزن أولاً (Ledger Entry)
                var movement = new StockMovement(
                    StockMovementType.SaleDispatch,
                    cmd.ItemId,
                    cmd.WarehouseId,
                    null,
                    cmd.Quantity,
                    cmd.UnitPrice,
                    cmd.InvoiceId,
                    cmd.InvoiceNumber,
                    cmd.UserId
                );
                _dbContext.StockMovements.Add(movement);

                // خصم الكمية من الرصيد
                stock.DeductStock(cmd.Quantity);

                await _dbContext.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);

                return Result<Guid>.Success(movement.Id);
            }
            catch (DbUpdateConcurrencyException)
            {
                await tx.RollbackAsync(ct);
                return Result<Guid>.Failure("ERR.CONCURRENCY.VERSION_CONFLICT", "DATABASE");
            }
            catch (Exception)
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }
        finally
        {
            await db.LockReleaseAsync(lockKey, lockToken);
        }
    }
}
