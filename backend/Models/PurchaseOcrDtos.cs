namespace ERP.Warehouse.Api.Models;

public class ExtractedPurchaseInvoiceItemDto
{
    public string RawItemName { get; set; } = string.Empty;
    public string? BarcodeOrSku { get; set; }
    public decimal Quantity { get; set; } = 1.0000m;
    public decimal UnitCostPrice { get; set; } = 0.0000m;
    public decimal LineTotal { get; set; } = 0.0000m;
    public Guid? MatchedProductId { get; set; }
    public string? MatchedProductName { get; set; }
    public string? MatchedProductSku { get; set; }
    public string? MatchedProductBarcode { get; set; }
    public string MatchConfidence { get; set; } = "None"; // High | Low | None
    public decimal WarehouseStock { get; set; } = 0.0000m;
    public string UnitOfMeasure { get; set; } = "قطعة";
    public decimal CurrentSellingPrice { get; set; } = 0.0000m;
}

public class ExtractedPurchaseInvoiceResponseDto
{
    public string? SupplierName { get; set; }
    public Guid? MatchedSupplierId { get; set; }
    public string? MatchedSupplierName { get; set; }
    public string SupplierMatchConfidence { get; set; } = "None"; // High | Low | None
    public string? SupplierInvoiceNumber { get; set; }
    public string? InvoiceDate { get; set; }
    public string Currency { get; set; } = "IQD";
    public decimal InvoiceDiscount { get; set; } = 0.0000m;
    public List<ExtractedPurchaseInvoiceItemDto> Items { get; set; } = new();
}

internal class GeminiExtractedInvoicePayload
{
    public string? SupplierName { get; set; }
    public string? SupplierInvoiceNumber { get; set; }
    public string? InvoiceDate { get; set; }
    public string? Currency { get; set; }
    public decimal InvoiceDiscount { get; set; }
    public List<GeminiExtractedItemPayload> Items { get; set; } = new();
}

internal class GeminiExtractedItemPayload
{
    public string? RawItemName { get; set; }
    public string? BarcodeOrSku { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCostPrice { get; set; }
    public decimal LineTotal { get; set; }
}
