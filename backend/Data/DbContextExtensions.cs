namespace ERP.Warehouse.Api.Data;

using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Models;

public static class DbContextExtensions
{
    public static void ApplyTenantFilter<TEntity>(ModelBuilder modelBuilder, AppDbContext context)
        where TEntity : class, ITenantEntity
    {
        modelBuilder.Entity<TEntity>().HasQueryFilter(e => 
            context.IsPlatformSuperAdmin || 
            (context.CurrentTenantId.HasValue && e.TenantId == context.CurrentTenantId));
    }
}
