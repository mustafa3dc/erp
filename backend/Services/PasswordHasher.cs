using System.Security.Cryptography;
using System.Text;

namespace ERP.Warehouse.Api.Services;

public static class PasswordHasher
{
    public static string Hash(string password)
    {
        if (string.IsNullOrEmpty(password)) return string.Empty;
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToHexString(hash).ToLower();
    }

    public static bool Verify(string password, string storedHash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(storedHash))
            return false;

        // 1. Direct plain text comparison for legacy/in-memory seed accounts (exact match, never trimmed)
        if (string.Equals(password, storedHash, StringComparison.Ordinal))
            return true;

        // 2. Standard SHA-256 check
        var computedHash = Hash(password);
        if (string.Equals(computedHash, storedHash, StringComparison.OrdinalIgnoreCase))
            return true;

        // 3. ASP.NET Core Identity PBKDF2 v2/v3 verification (AQAAAA...)
        if (storedHash.StartsWith("AQAAAA", StringComparison.Ordinal) && VerifyAspNetIdentityPbkdf2(password, storedHash))
            return true;

        return false;
    }

    private static bool VerifyAspNetIdentityPbkdf2(string password, string storedHash)
    {
        try
        {
            var decoded = Convert.FromBase64String(storedHash);
            if (decoded.Length == 0) return false;

            // Format v3: 0x01 | prf (4B) | iterCount (4B) | saltLength (4B) | salt | subkey
            if (decoded[0] == 0x01 && decoded.Length >= 13)
            {
                uint prf = ReadNetworkByteOrder(decoded, 1);
                int iterCount = (int)ReadNetworkByteOrder(decoded, 5);
                int saltLength = (int)ReadNetworkByteOrder(decoded, 9);

                if (saltLength < 16 || iterCount <= 0 || 13 + saltLength > decoded.Length)
                    return false;

                int subkeyLength = decoded.Length - 13 - saltLength;
                if (subkeyLength < 16)
                    return false;

                var hashAlg = prf switch
                {
                    0 => HashAlgorithmName.SHA1,
                    1 => HashAlgorithmName.SHA256,
                    2 => HashAlgorithmName.SHA512,
                    _ => default
                };
                if (hashAlg == default) return false;

                var salt = decoded.AsSpan(13, saltLength);
                var expectedSubkey = decoded.AsSpan(13 + saltLength, subkeyLength);
                var actualSubkey = Rfc2898DeriveBytes.Pbkdf2(
                    Encoding.UTF8.GetBytes(password),
                    salt,
                    iterCount,
                    hashAlg,
                    subkeyLength);

                return CryptographicOperations.FixedTimeEquals(actualSubkey, expectedSubkey);
            }

            // Format v2: 0x00 | salt (16B) | subkey (32B), 1000 iterations HMAC-SHA1
            if (decoded[0] == 0x00 && decoded.Length == 49)
            {
                var salt = decoded.AsSpan(1, 16);
                var expectedSubkey = decoded.AsSpan(17, 32);
                var actualSubkey = Rfc2898DeriveBytes.Pbkdf2(
                    Encoding.UTF8.GetBytes(password),
                    salt,
                    1000,
                    HashAlgorithmName.SHA1,
                    32);

                return CryptographicOperations.FixedTimeEquals(actualSubkey, expectedSubkey);
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    private static uint ReadNetworkByteOrder(byte[] buffer, int offset)
    {
        return ((uint)buffer[offset] << 24)
             | ((uint)buffer[offset + 1] << 16)
             | ((uint)buffer[offset + 2] << 8)
             | buffer[offset + 3];
    }
}
