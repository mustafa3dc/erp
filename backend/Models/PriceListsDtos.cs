using System.ComponentModel.DataAnnotations;

namespace ERP.Warehouse.Api.Models;

public record PriceListDto(
    Guid Id,
    string Code,
    string Name,
    string Currency,
    bool IsDefault,
    bool IsActive,
    DateTime? StartDate,
    DateTime? EndDate,
    string? Description,
    int ItemsCount,
    DateTime CreatedAt
);

public record PriceListDetailDto(
    Guid Id,
    string Code,
    string Name,
    string Currency,
    bool IsDefault,
    bool IsActive,
    DateTime? StartDate,
    DateTime? EndDate,
    string? Description,
    DateTime CreatedAt,
    List<PriceListItemDto> Items
);

public record PriceListItemDto(
    Guid Id,
    Guid ProductId,
    string ProductSku,
    string ProductName,
    decimal StandardRetailPrice,
    decimal MinQuantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    DateTime UpdatedAt
);

public record CreatePriceListRequest(
    [Required] [MaxLength(50)] string Code,
    [Required] [MaxLength(150)] string Name,
    string Currency = "IQD",
    bool IsDefault = false,
    DateTime? StartDate = null,
    DateTime? EndDate = null,
    string? Description = null,
    List<SavePriceListItemInputDto>? Items = null
);

public record UpdatePriceListRequest(
    [Required] [MaxLength(150)] string Name,
    string Currency = "IQD",
    bool IsDefault = false,
    bool IsActive = true,
    DateTime? StartDate = null,
    DateTime? EndDate = null,
    string? Description = null
);

public record SavePriceListItemInputDto(
    [Required] Guid ProductId,
    [Range(0.001, double.MaxValue)] decimal MinQuantity = 1.0m,
    [Range(0, double.MaxValue)] decimal UnitPrice = 0,
    [Range(0, 100)] decimal DiscountPercent = 0
);

public record AssignCustomerPriceListRequest(
    [Required] Guid CustomerId,
    Guid? PriceListId
);

public record ResolveProductPriceRequest(
    [Required] Guid ProductId,
    Guid? CustomerId,
    Guid? PriceListId,
    decimal Quantity = 1.0m
);

public record ResolvedPriceResultDto(
    Guid ProductId,
    string ProductSku,
    string ProductName,
    decimal StandardPrice,
    decimal ResolvedUnitPrice,
    string PriceSource, // "PRICE_LIST", "TIER_DISCOUNT", "STANDARD"
    Guid? PriceListId,
    string? PriceListName,
    decimal AppliedDiscountPercent
);

// Product Bundle / Kit DTOs
public record ProductBundleDto(
    Guid ParentProductId,
    string BundleSku,
    string BundleName,
    decimal BundleSellingPrice,
    int ComponentsCount,
    List<BundleComponentDto> Components
);

public record BundleComponentDto(
    Guid ComponentProductId,
    string ComponentSku,
    string ComponentName,
    string UnitOfMeasure,
    decimal Quantity,
    decimal ComponentCostPrice,
    decimal ComponentSellingPrice
);

public record SaveProductBundleRequest(
    [Required] Guid ParentProductId,
    [Required] List<BundleComponentInputDto> Components = null!
);

public record BundleComponentInputDto(
    [Required] Guid ComponentProductId,
    [Range(0.001, double.MaxValue)] decimal Quantity = 1.0m
);
