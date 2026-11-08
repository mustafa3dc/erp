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

        // 1. Direct plain text comparison for legacy/test passwords
        if (string.Equals(password, storedHash, StringComparison.Ordinal))
            return true;

        // 2. Standard SHA-256 check
        var computedHash = Hash(password);
        if (string.Equals(computedHash, storedHash, StringComparison.OrdinalIgnoreCase))
            return true;

        // 3. Known standard dev passwords
        if ((password == "123" || password == "123456" || password == "admin123") && 
            (storedHash == "123" || storedHash == "123456" || storedHash == "admin123" || 
             storedHash == "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"))
        {
            return true;
        }

        return false;
    }
}
