---
name: dotnet-backend
description: High-concurrency C# .NET Core backend, RedLock implementation, PostgreSQL transactional integrity, and outbox pattern.
---
# High-Concurrency Backend Specification

## 1. نموذج استجابة الأخطاء الموحد (No Hardcoded Strings)
كل نقطة نهاية تُرجع هذا النموذج دون أي استثناء:
```csharp
public sealed record ApiResponse<T>(
    bool Success,
    T? Data,
    string? ErrorCode,
    string? Domain,
    Dictionary<string, object>? Metadata,
    DateTimeOffset Timestamp
);
```

## 2. التحكم في التزامن العالي ومنع الـ Deadlock (Distributed Lock Handler)
```csharp
public async Task<ApiResponse<Guid>> Handle(CreateInvoiceCommand request, CancellationToken ct)
{
    // فرز معرفات المواد تصاعدياً لمنع حدوث Deadlock بين الجلسات
    var sortedItemIds = request.Items.Select(i => i.ItemId).OrderBy(id => id).ToList();
    var lockKeys = sortedItemIds.Select(id => $"erp:lock:stock:{request.WarehouseId}:{id}").ToArray();

    await using var distributedLock = await _lockManager.AcquireMultipleAsync(lockKeys, TimeSpan.FromSeconds(5), ct);
    if (!distributedLock.IsAcquired)
        return ApiResponse<Guid>.Fail("ERR.CONCURRENCY.LOCK_TIMEOUT", "INVENTORY");

    await using var transaction = await _dbContext.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
    try
    {
        // التحقق من الرصيد والخصم وتسجيل حركات الـ Ledger
        await _dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return ApiResponse<Guid>.Ok(invoice.Id);
    }
    catch
    {
        await transaction.RollbackAsync(ct);
        throw;
    }
}
```
