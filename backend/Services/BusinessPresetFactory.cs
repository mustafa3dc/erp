using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

/// <summary>
/// Domain factory creating and applying predefined operational feature blueprints per business industry.
/// </summary>
public static class BusinessPresetFactory
{
    /// <summary>
    /// Generates feature flags according to the specified business industry preset.
    /// </summary>
    public static CompanyFeatures CreateFeatures(BusinessPreset preset)
    {
        return preset switch
        {
            BusinessPreset.Grocery => new CompanyFeatures
            {
                EnablePOS = true,
                MultiWarehouse = false,
                MaxWarehouses = 1,
                EnableInstallments = false,
                EnableSerialNumbers = false,
                EnableVariants = false,
                EnableMultiCurrency = false,
                EnableCreditLimits = false,
                EnableBarcodeScales = true,
                EnableExpiryDates = true
            },
            BusinessPreset.Electronics => new CompanyFeatures
            {
                EnablePOS = true,
                MultiWarehouse = true,
                MaxWarehouses = 5,
                EnableInstallments = true,
                EnableSerialNumbers = true,
                EnableVariants = false,
                EnableMultiCurrency = true,
                EnableCreditLimits = true,
                EnableBarcodeScales = true,
                EnableExpiryDates = false
            },
            BusinessPreset.Fashion => new CompanyFeatures
            {
                EnablePOS = true,
                MultiWarehouse = false,
                MaxWarehouses = 1,
                EnableInstallments = false,
                EnableSerialNumbers = false,
                EnableVariants = true,
                EnableMultiCurrency = false,
                EnableCreditLimits = false,
                EnableBarcodeScales = true,
                EnableExpiryDates = false
            },
            BusinessPreset.Hardware => new CompanyFeatures
            {
                EnablePOS = false,
                MultiWarehouse = true,
                MaxWarehouses = 10,
                EnableInstallments = false,
                EnableSerialNumbers = false,
                EnableVariants = false,
                EnableMultiCurrency = true,
                EnableCreditLimits = true,
                EnableBarcodeScales = true,
                EnableExpiryDates = false
            },
            BusinessPreset.Wholesale => new CompanyFeatures
            {
                EnablePOS = false,
                MultiWarehouse = true,
                MaxWarehouses = 10,
                EnableInstallments = false,
                EnableSerialNumbers = false,
                EnableVariants = true,
                EnableMultiCurrency = true,
                EnableCreditLimits = true,
                EnableBarcodeScales = true,
                EnableExpiryDates = false
            },
            _ => new CompanyFeatures
            {
                EnablePOS = true,
                MultiWarehouse = true,
                MaxWarehouses = 5,
                EnableInstallments = true,
                EnableSerialNumbers = false,
                EnableVariants = false,
                EnableMultiCurrency = true,
                EnableCreditLimits = true,
                EnableBarcodeScales = true,
                EnableExpiryDates = false
            }
        };
    }

    /// <summary>
    /// Applies a business preset directly to a tenant entity.
    /// </summary>
    public static void ApplyPreset(Tenant tenant, BusinessPreset preset)
    {
        tenant.BusinessPreset = preset;
        if (preset != BusinessPreset.Custom)
        {
            tenant.Features = CreateFeatures(preset);
        }
        tenant.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Returns localized Arabic name for the business preset.
    /// </summary>
    public static string GetPresetArabicName(BusinessPreset preset) => preset switch
    {
        BusinessPreset.Grocery => "سوبرماركت وبقالة غذائية",
        BusinessPreset.Electronics => "إلكترونيات وأجهزة ذكية",
        BusinessPreset.Fashion => "أزياء وملابس ومقاسات",
        BusinessPreset.Hardware => "مواد بناء وتجهيزات إنشائية",
        BusinessPreset.Wholesale => "تجارة جملة وتوزيع",
        _ => "مخصص (تكوين حر)"
    };

    /// <summary>
    /// Returns localized English name for the business preset.
    /// </summary>
    public static string GetPresetEnglishName(BusinessPreset preset) => preset switch
    {
        BusinessPreset.Grocery => "Grocery & Supermarket",
        BusinessPreset.Electronics => "Electronics & Mobile",
        BusinessPreset.Fashion => "Fashion & Apparel",
        BusinessPreset.Hardware => "Hardware & Construction",
        BusinessPreset.Wholesale => "Wholesale & Distribution",
        _ => "Custom Configuration"
    };
}

