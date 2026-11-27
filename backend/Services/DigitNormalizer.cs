using System.Collections.Concurrent;
using System.Reflection;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ERP.Warehouse.Api.Services;

/// <summary>
/// Global string-normalization helper ensuring all incoming Phone, Barcode, SKU, Code,
/// and numeric string fields are stored using standard Western/Latin ASCII digits (0-9).
/// </summary>
public static class DigitNormalizer
{
    private const char EasternArabicZero = '\u0660';  // ٠
    private const char EasternArabicNine = '\u0669';  // ٩
    private const char ExtendedArabicZero = '\u06F0'; // ۰
    private const char ExtendedArabicNine = '\u06F9'; // ۹
    private const char ArabicDecimalSeparator = '\u066B'; // ٫

    private static readonly ConcurrentDictionary<Type, PropertyInfo[]> TargetPropertyCache = new();

    private static readonly string[] TargetQueryParameterKeys =
    {
        "phone",
        "customerPhone",
        "guarantorPhone",
        "barcode",
        "sku",
        "code",
        "serial",
        "serialNumber",
        "voucherCode",
        "memberCode",
        "search",
        "q"
    };

    /// <summary>
    /// Converts Eastern Arabic-Indic (٠-٩) and Extended Arabic-Indic / Persian / Kurdish (۰-۹)
    /// numerals into standard ASCII digits (0-9), and Arabic decimal separator (٫) into '.'.
    /// </summary>
    public static string ToLatinDigits(string? input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return input ?? string.Empty;
        }

        bool needsNormalization = false;
        foreach (char c in input)
        {
            if (IsNonLatinDigitOrDecimal(c))
            {
                needsNormalization = true;
                break;
            }
        }

        if (!needsNormalization)
        {
            return input;
        }

        return string.Create(input.Length, input, static (span, src) =>
        {
            for (int i = 0; i < src.Length; i++)
            {
                char c = src[i];
                if (c >= EasternArabicZero && c <= EasternArabicNine)
                {
                    span[i] = (char)('0' + (c - EasternArabicZero));
                }
                else if (c >= ExtendedArabicZero && c <= ExtendedArabicNine)
                {
                    span[i] = (char)('0' + (c - ExtendedArabicZero));
                }
                else if (c == ArabicDecimalSeparator)
                {
                    span[i] = '.';
                }
                else
                {
                    span[i] = c;
                }
            }
        });
    }

    public static string? ToLatinDigitsOrNull(string? input)
    {
        return input == null ? null : ToLatinDigits(input);
    }

    /// <summary>
    /// Normalizes Phone, Barcode, SKU, Code, SerialNumber, and related identifier string properties
    /// on any mutable class object (DTO or EF Core entity). Safe to call repeatedly.
    /// </summary>
    public static void NormalizeTargetProperties(object? instance)
    {
        if (instance == null)
        {
            return;
        }

        var type = instance.GetType();
        if (type == typeof(string) || type.IsPrimitive || type.IsEnum)
        {
            return;
        }

        var props = TargetPropertyCache.GetOrAdd(type, static t =>
            t.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(p => p.CanRead && p.CanWrite && p.PropertyType == typeof(string) && IsTargetFieldName(p.Name))
                .ToArray());

        foreach (var prop in props)
        {
            var raw = prop.GetValue(instance) as string;
            if (!string.IsNullOrEmpty(raw))
            {
                var normalized = ToLatinDigits(raw);
                if (!ReferenceEquals(normalized, raw) && !string.Equals(normalized, raw, StringComparison.Ordinal))
                {
                    prop.SetValue(instance, normalized);
                }
            }
        }
    }

    public static bool IsTargetFieldName(string propertyName)
    {
        return propertyName.Contains("Phone", StringComparison.OrdinalIgnoreCase)
            || propertyName.Contains("Barcode", StringComparison.OrdinalIgnoreCase)
            || propertyName.Equals("Sku", StringComparison.OrdinalIgnoreCase)
            || propertyName.EndsWith("Sku", StringComparison.OrdinalIgnoreCase)
            || propertyName.Equals("Code", StringComparison.OrdinalIgnoreCase)
            || propertyName.EndsWith("Code", StringComparison.OrdinalIgnoreCase)
            || propertyName.Contains("Serial", StringComparison.OrdinalIgnoreCase);
    }

    internal static bool ShouldNormalizeParameterName(string name)
    {
        foreach (var key in TargetQueryParameterKeys)
        {
            if (name.Contains(key, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    private static bool IsNonLatinDigitOrDecimal(char c)
    {
        return (c >= EasternArabicZero && c <= EasternArabicNine)
            || (c >= ExtendedArabicZero && c <= ExtendedArabicNine)
            || c == ArabicDecimalSeparator;
    }
}

/// <summary>
/// Global MVC ActionFilter normalizing incoming string route/query arguments and mutable DTO
/// identifier fields (Phone, Barcode, SKU, Code) before controller execution.
/// </summary>
public sealed class NormalizeDigitsActionFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        foreach (var key in context.ActionArguments.Keys.ToList())
        {
            var value = context.ActionArguments[key];
            if (value == null)
            {
                continue;
            }

            if (value is string strVal)
            {
                if (DigitNormalizer.ShouldNormalizeParameterName(key))
                {
                    context.ActionArguments[key] = DigitNormalizer.ToLatinDigits(strVal);
                }
                continue;
            }

            if (value is System.Collections.IEnumerable enumerable && value.GetType() != typeof(string))
            {
                foreach (var item in enumerable)
                {
                    DigitNormalizer.NormalizeTargetProperties(item);
                }
                continue;
            }

            DigitNormalizer.NormalizeTargetProperties(value);
        }
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }
}
