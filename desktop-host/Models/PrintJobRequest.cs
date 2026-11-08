using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace DesktopHost.Models;

public class PrintJobRequest
{
    [JsonPropertyName("printerName")]
    public string? PrinterName { get; set; }

    [JsonPropertyName("companyName")]
    public string CompanyName { get; set; } = "ZiloX Store";

    [JsonPropertyName("companyPhone")]
    public string? CompanyPhone { get; set; }

    [JsonPropertyName("companyAddress")]
    public string? CompanyAddress { get; set; }

    [JsonPropertyName("invoiceNumber")]
    public string InvoiceNumber { get; set; } = string.Empty;

    [JsonPropertyName("invoiceDate")]
    public string InvoiceDate { get; set; } = string.Empty;

    [JsonPropertyName("cashierName")]
    public string CashierName { get; set; } = string.Empty;

    [JsonPropertyName("customerName")]
    public string? CustomerName { get; set; }

    [JsonPropertyName("items")]
    public List<PrintJobItem> Items { get; set; } = new();

    [JsonPropertyName("subtotal")]
    public decimal Subtotal { get; set; }

    [JsonPropertyName("discount")]
    public decimal Discount { get; set; }

    [JsonPropertyName("tax")]
    public decimal Tax { get; set; }

    [JsonPropertyName("grandTotal")]
    public decimal GrandTotal { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "د.ع";

    [JsonPropertyName("paymentMethod")]
    public string PaymentMethod { get; set; } = "CASH";

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    [JsonPropertyName("openDrawer")]
    public bool OpenDrawer { get; set; } = true;

    [JsonPropertyName("cutPaper")]
    public bool CutPaper { get; set; } = true;

    [JsonPropertyName("qrData")]
    public string? QrData { get; set; }
}

public class PrintJobItem
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("quantity")]
    public decimal Quantity { get; set; }

    [JsonPropertyName("unitPrice")]
    public decimal UnitPrice { get; set; }

    [JsonPropertyName("totalPrice")]
    public decimal TotalPrice { get; set; }

    [JsonPropertyName("unit")]
    public string? Unit { get; set; }
}

