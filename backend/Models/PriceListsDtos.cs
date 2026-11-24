using System.ComponentModel.DataAnnotations;

namespace ERP.Warehouse.Api.Models;

// ============================================================================
// Direct Product Quantity Tiered Pricing DTOs
// ============================================================================

public record ProductQuantityTierDto(
    Guid Id,
    Guid ProductId,
    string ProductSku,
    string ProductName,
    decimal BaseSellingPrice,
    int MinQty,
    int? MaxQty,
    decimal UnitPrice,
    DateTime UpdatedAt
);

public record QuantityTierInputDto(
    [Range(2, int.MaxValue)] int MinQty,
    int? MaxQty,
    [Range(0, double.MaxValue)] decimal UnitPrice
);

public record SaveProductQuantityTiersRequest(
    [Required] Guid ProductId,
    [Required] List<QuantityTierInputDto> Tiers = null!
);

public record ResolvedQuantityPriceDto(
    Guid ProductId,
    int Quantity,
    decimal BasePrice,
    decimal AppliedUnitPrice,
    bool IsTierApplied,
    Guid? MatchedTierId,
    int? MinQty,
    int? MaxQty
);

// ============================================================================
// Product Bundle / Kit DTOs
// ============================================================================

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
