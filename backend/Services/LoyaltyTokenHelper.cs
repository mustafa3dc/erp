using System.Security.Cryptography;
using System.Text;

namespace ERP.Warehouse.Api.Services;

public static class LoyaltyTokenHelper
{
    private static readonly char[] ArabicDigits = { '٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩' };
    private static readonly char[] PersianDigits = { '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹' };

    public static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;

        var sb = new StringBuilder(phone.Length);
        foreach (var ch in phone.Trim())
        {
            var arIdx = Array.IndexOf(ArabicDigits, ch);
            if (arIdx >= 0) { sb.Append((char)('0' + arIdx)); continue; }
            var faIdx = Array.IndexOf(PersianDigits, ch);
            if (faIdx >= 0) { sb.Append((char)('0' + faIdx)); continue; }
            if (char.IsDigit(ch)) sb.Append(ch);
        }

        var digits = sb.ToString();
        if (string.IsNullOrEmpty(digits)) return null;

        if (digits.StartsWith("00964", StringComparison.Ordinal))
            digits = digits[5..];
        else if (digits.StartsWith("964", StringComparison.Ordinal) && digits.Length > 9)
            digits = digits[3..];
        else if (digits.StartsWith('0') && digits.Length >= 10)
            digits = digits[1..];

        return string.IsNullOrWhiteSpace(digits) ? null : digits;
    }

    private const string AlphanumericChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    public static string GenerateUrlSafeCardToken()
    {
        Span<char> chars = stackalloc char[32];
        for (int i = 0; i < chars.Length; i++)
        {
            chars[i] = AlphanumericChars[RandomNumberGenerator.GetInt32(AlphanumericChars.Length)];
        }
        return new string(chars);
    }

    public static string ExtractLookupToken(string? rawInput)
    {
        if (string.IsNullOrWhiteSpace(rawInput)) return string.Empty;
        string decoded;
        try
        {
            decoded = Uri.UnescapeDataString(rawInput.Trim());
        }
        catch
        {
            decoded = rawInput.Trim();
        }

        decoded = decoded.Trim().Trim('/');
        if (decoded.Contains("/card/", StringComparison.OrdinalIgnoreCase))
        {
            var idx = decoded.LastIndexOf("/card/", StringComparison.OrdinalIgnoreCase);
            decoded = decoded[(idx + 6)..].Split('?', '#')[0].Trim().Trim('/');
        }
        return decoded;
    }

    public static string GenerateMemberCode()
    {
        var suffix = RandomNumberGenerator.GetInt32(10000, 99999);
        return $"LOY-{suffix}";
    }

    public static string GenerateVoucherCode()
    {
        var suffix = RandomNumberGenerator.GetInt32(10000, 99999);
        return $"RDM-{suffix}";
    }

    public static Guid? ResolveShiftGuid(string? shiftId)
    {
        if (string.IsNullOrWhiteSpace(shiftId)) return null;
        var trimmed = shiftId.Trim();
        if (Guid.TryParse(trimmed, out var parsed))
        {
            return parsed;
        }

        // Deterministically map string shift codes (e.g. "SH-1234") into UUID format for PostgreSQL storage
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"zilox-shift:{trimmed}"));
        Span<byte> guidBytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(guidBytes);
        return new Guid(guidBytes);
    }
}
