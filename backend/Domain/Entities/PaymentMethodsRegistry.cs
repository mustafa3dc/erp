namespace Erp.Domain.Entities;

public static class PaymentMethodsRegistry
{
    // الطرق العالمية المتاحة لكل دول العالم
    public static readonly string[] GlobalMethods = { "CASH", "CARD", "BANK_TRANSFER", "INSTALLMENT" };

    // الطرق المقفولة حصرياً على العراق
    public static readonly Dictionary<string, string[]> RegionLockedMethods = new()
    {
        { "IQ", new[] { "ZAIN_CASH", "QI_CARD" } }
    };

    public static bool IsMethodAllowedForCountry(string method, string countryCode)
    {
        if (string.IsNullOrWhiteSpace(method)) return false;
        var upperMethod = method.Trim().ToUpperInvariant();
        var upperCountry = (countryCode ?? string.Empty).Trim().ToUpperInvariant();

        if (GlobalMethods.Contains(upperMethod)) return true;

        if (RegionLockedMethods.TryGetValue(upperCountry, out var allowedMethods))
        {
            return allowedMethods.Contains(upperMethod);
        }

        return false;
    }

    public static string[] GetAllowedMethodsForCountry(string countryCode)
    {
        var upperCountry = (countryCode ?? string.Empty).Trim().ToUpperInvariant();
        if (RegionLockedMethods.TryGetValue(upperCountry, out var regional))
        {
            return GlobalMethods.Concat(regional).ToArray();
        }
        return GlobalMethods;
    }
}
