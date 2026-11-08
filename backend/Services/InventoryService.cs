using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using System.Text.Json;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public interface IInventoryService
{
    Task<Product?> GetProductByBarcodeAsync(string barcode);
    Task<bool> AdjustStockAsync(Guid warehouseId, Guid productId, int quantityDelta, string reason);
    Task<bool> TransferStockAsync(Guid fromWarehouseId, Guid toWarehouseId, Guid productId, int quantity);
    Task<List<Product>> GetLowStockAlertsAsync();
    Task<decimal> GetTotalStockValuationAsync();
}

public class InventoryService : IInventoryService
{
    private readonly AppDbContext _context;
    private readonly IConnectionMultiplexer? _redis;
    private readonly IDatabase? _cache;

    public InventoryService(AppDbContext context, IConnectionMultiplexer? redis = null)
    {
        _context = context;
        _redis = redis;
        if (_redis != null)
        {
            _cache = _redis.GetDatabase();
        }
    }

    public async Task<Product?> GetProductByBarcodeAsync(string barcode)
    {
        // 1. Check Redis Cache
        if (_cache != null)
        {
            var cached = await _cache.StringGetAsync($"product:barcode:{barcode}");
            if (!cached.IsNullOrEmpty)
            {
                return JsonSerializer.Deserialize<Product>(cached!);
            }
        }

        // 2. Query PostgreSQL
        var product = await _context.Products
            .Include(p => p.Category)
            .Include(p => p.WarehouseStocks)
            .FirstOrDefaultAsync(p => p.Barcode == barcode);

        // 3. Cache Result in Redis (10 minutes TTL)
        if (product != null && _cache != null)
        {
            await _cache.StringSetAsync(
                $"product:barcode:{barcode}",
                JsonSerializer.Serialize(product),
                TimeSpan.FromMinutes(10)
            );
        }

        return product;
    }

    public async Task<bool> AdjustStockAsync(Guid warehouseId, Guid productId, int quantityDelta, string reason)
    {
        var warehouse = await _context.Warehouses
            .FirstOrDefaultAsync(w => w.Id == warehouseId && w.IsActive);
        if (warehouse == null) return false;

        var stock = await _context.WarehouseStocks
            .FirstOrDefaultAsync(ws => ws.WarehouseId == warehouseId && ws.ProductId == productId);

        if (stock == null)
        {
            if (quantityDelta < 0) return false;
            stock = new WarehouseStock
            {
                WarehouseId = warehouseId,
                ProductId = productId,
                Quantity = quantityDelta,
                LastCountedAt = DateTime.UtcNow
            };
            _context.WarehouseStocks.Add(stock);
        }
        else
        {
            if (stock.Quantity + quantityDelta < 0)
            {
                return false; // Insufficient inventory
            }
            stock.Quantity += quantityDelta;
            stock.LastCountedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> TransferStockAsync(Guid fromWarehouseId, Guid toWarehouseId, Guid productId, int quantity)
    {
        var fromWh = await _context.Warehouses
            .FirstOrDefaultAsync(w => w.Id == fromWarehouseId && w.IsActive);
        var toWh = await _context.Warehouses
            .FirstOrDefaultAsync(w => w.Id == toWarehouseId && w.IsActive);
        if (fromWh == null || toWh == null) return false;

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var fromStock = await _context.WarehouseStocks
                .FirstOrDefaultAsync(ws => ws.WarehouseId == fromWarehouseId && ws.ProductId == productId);

            if (fromStock == null || fromStock.Quantity < quantity)
            {
                return false;
            }

            fromStock.Quantity -= quantity;

            var toStock = await _context.WarehouseStocks
                .FirstOrDefaultAsync(ws => ws.WarehouseId == toWarehouseId && ws.ProductId == productId);

            if (toStock == null)
            {
                _context.WarehouseStocks.Add(new WarehouseStock
                {
                    WarehouseId = toWarehouseId,
                    ProductId = productId,
                    Quantity = quantity
                });
            }
            else
            {
                toStock.Quantity += quantity;
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            return false;
        }
    }

    public async Task<List<Product>> GetLowStockAlertsAsync()
    {
        return await _context.Products
            .Include(p => p.WarehouseStocks)
            .Where(p => p.WarehouseStocks.Sum(ws => ws.Quantity) <= p.MinStockLevel)
            .ToListAsync();
    }

    public async Task<decimal> GetTotalStockValuationAsync()
    {
        return await _context.WarehouseStocks
            .Include(ws => ws.Product)
            .SumAsync(ws => ws.Quantity * ws.Product!.CostPrice);
    }
}
