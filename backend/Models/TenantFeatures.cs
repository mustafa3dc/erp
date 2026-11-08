using System.Text.Json.Serialization;

namespace ERP.Warehouse.Api.Models;

/// <summary>
/// Predefined business industry presets for tenants.
/// Automatically activates relevant ERP modules and capabilities.
/// </summary>
public enum BusinessPreset
{
    Custom = 0,
    Grocery = 1,
    Electronics = 2,
    Fashion = 3,
    Hardware = 4,
    Wholesale = 5
}

/// <summary>
/// Operational feature flags governing visible modules and business workflows per tenant.
/// </summary>
public class CompanyFeatures
{
    [JsonPropertyName("enablePOS")]
    public bool EnablePOS { get; set; } = true;

    [JsonPropertyName("multiWarehouse")]
    public bool MultiWarehouse { get; set; } = true;

    [JsonPropertyName("maxWarehouses")]
    public int MaxWarehouses { get; set; } = 5;

    [JsonPropertyName("enableInstallments")]
    public bool EnableInstallments { get; set; } = true;

    [JsonPropertyName("enableSerialNumbers")]
    public bool EnableSerialNumbers { get; set; } = false;

    [JsonPropertyName("enableVariants")]
    public bool EnableVariants { get; set; } = false;

    [JsonPropertyName("enableMultiCurrency")]
    public bool EnableMultiCurrency { get; set; } = true;

    [JsonPropertyName("enableCreditLimits")]
    public bool EnableCreditLimits { get; set; } = true;

    [JsonPropertyName("enableBarcodeScales")]
    public bool EnableBarcodeScales { get; set; } = false;

    [JsonPropertyName("enableExpiryDates")]
    public bool EnableExpiryDates { get; set; } = false;

    public CompanyFeatures Clone()
    {
        return new CompanyFeatures
        {
            EnablePOS = this.EnablePOS,
            MultiWarehouse = this.MultiWarehouse,
            MaxWarehouses = this.MaxWarehouses,
            EnableInstallments = this.EnableInstallments,
            EnableSerialNumbers = this.EnableSerialNumbers,
            EnableVariants = this.EnableVariants,
            EnableMultiCurrency = this.EnableMultiCurrency,
            EnableCreditLimits = this.EnableCreditLimits,
            EnableBarcodeScales = this.EnableBarcodeScales,
            EnableExpiryDates = this.EnableExpiryDates
        };
    }
}

public class ApplyPresetRequestDto
{
    public BusinessPreset Preset { get; set; } = BusinessPreset.Custom;
}

public class UpdateFeaturesRequestDto
{
    public bool? EnablePOS { get; set; }
    public bool? MultiWarehouse { get; set; }
    public int? MaxWarehouses { get; set; }
    public bool? EnableInstallments { get; set; }
    public bool? EnableSerialNumbers { get; set; }
    public bool? EnableVariants { get; set; }
    public bool? EnableMultiCurrency { get; set; }
    public bool? EnableCreditLimits { get; set; }
    public bool? EnableBarcodeScales { get; set; }
    public bool? EnableExpiryDates { get; set; }
}

public class TenantFeaturesResponseDto
{
    public Guid TenantId { get; set; }
    public string TenantSlug { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public BusinessPreset BusinessPreset { get; set; }
    public string BusinessPresetName { get; set; } = string.Empty;
    public CompanyFeatures Features { get; set; } = new();
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class CompanySettingsResponseDto
{
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string TenantSlug { get; set; } = string.Empty;
    public string CountryCode { get; set; } = "IQ";
    public string Currency { get; set; } = "IQD";
    public string Plan { get; set; } = "Pro";
    public BusinessPreset BusinessPreset { get; set; }
    public string BusinessPresetName { get; set; } = string.Empty;
    public CompanyFeatures Features { get; set; } = new();
    public int MaxBranches { get; set; } = 5;
    public int MaxUsers { get; set; } = 20;
    public bool IsActive { get; set; } = true;
}

