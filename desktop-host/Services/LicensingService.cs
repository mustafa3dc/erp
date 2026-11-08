using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DesktopHost.Models;
using Microsoft.Win32;

namespace DesktopHost.Services;

/// <summary>
/// Hardware-Locked Licensing Engine.
/// Cryptographically verifies RSA-2048 signatures to ensure licenses are authentic,
/// non-forgeable, and locked to the client machine's specific hardware fingerprint.
/// </summary>
public class LicensingService
{
    private static readonly Lazy<LicensingService> _instance = new(() => new LicensingService());
    public static LicensingService Instance => _instance.Value;

    // Official RSA-2048 Public Key for Signature Verification
    private const string RsaPublicKeyPem = @"-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuI4Iwx6wMEYr+GoF3YFU
Lfw+HBPHRk8HgvRdgLGmfdlx6kbi8JzXVBERgBrlsW6GVIGvk2DhFmXM8TZVGHZ9
flLihLZbHPdbFDsRw1kpJ+yxE6o8IBMJBrqZsCpqgAumHWq66uT98WyuISbZE3wZ
BhYZLUrnBYvAx4AXyk76EUzU5Hr3NX3EC2nfUlhAhMq8ond9Ie+sjCw1dQIsJ+Li
XQwpyX6zte/qRORwFmBOEDI9SPGi9BKs0GYna4+LDG7/KD0IhMO3CFx/mz3DlplG
eq5qYQL72Z8S56TfNFHaaS89AnuhByn232PmmtNDvZiqmOqIVkKIfpnFcCHJIMf/
pwIDAQAB
-----END PUBLIC KEY-----";

    private readonly string _licenseFilePath;
    private LicensePayload? _cachedPayload;

    public LicensingService()
    {
        string appDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "ZiloxERP"
        );
        Directory.CreateDirectory(appDataDir);
        _licenseFilePath = Path.Combine(appDataDir, "license.lic");
    }

    /// <summary>
    /// Checks if a valid, unexpired license exists for this machine.
    /// </summary>
    public ActivationResult CheckCurrentLicense()
    {
        if (_cachedPayload != null && !_cachedPayload.IsExpired)
        {
            if (_cachedPayload.MachineId == HardwareIdService.GetMachineId())
            {
                return ActivationResult.Success(_cachedPayload, "الترخيص نشط وصالح للاستخدام");
            }
        }

        string? rawKey = LoadStoredLicenseKey();
        if (string.IsNullOrWhiteSpace(rawKey))
        {
            return ActivationResult.Failure("لم يتم العثور على ترخيص مسجل. يتطلب هذا النظام التفعيل بربط العتاد.");
        }

        return ValidateLicenseKey(rawKey, persistIfValid: false);
    }

    /// <summary>
    /// Validates an entered license key and optionally saves it upon success.
    /// </summary>
    public ActivationResult ValidateLicenseKey(string rawLicenseKey, bool persistIfValid = true)
    {
        if (string.IsNullOrWhiteSpace(rawLicenseKey))
        {
            return ActivationResult.Failure("يرجى إدخال مفتاح التفعيل.");
        }

        try
        {
            // Normalize key string
            string cleanKey = rawLicenseKey.Trim();
            if (cleanKey.StartsWith("ZLX-LIC.", StringComparison.OrdinalIgnoreCase))
            {
                cleanKey = cleanKey.Substring("ZLX-LIC.".Length);
            }

            string[] parts = cleanKey.Split('.');
            if (parts.Length != 2)
            {
                return ActivationResult.Failure("صيغة مفتاح التفعيل غير صحيحة. تأكد من نسخ المفتاح كاملاً.");
            }

            byte[] payloadBytes = Convert.FromBase64String(parts[0]);
            byte[] signatureBytes = Convert.FromBase64String(parts[1]);

            // 1. Verify RSA Signature using Embedded Public Key
            using var rsa = RSA.Create();
            rsa.ImportFromPem(RsaPublicKeyPem);

            bool isSignatureValid = rsa.VerifyData(
                payloadBytes,
                signatureBytes,
                HashAlgorithmName.SHA256,
                RSASignaturePadding.Pkcs1
            );

            if (!isSignatureValid)
            {
                return ActivationResult.Failure("مفتاح التفعيل غير صالح أو تم التعديل على بياناته رقمياً.");
            }

            // 2. Deserialize JSON Payload
            string payloadJson = Encoding.UTF8.GetString(payloadBytes);
            var payload = JsonSerializer.Deserialize<LicensePayload>(payloadJson);

            if (payload == null || string.IsNullOrWhiteSpace(payload.MachineId))
            {
                return ActivationResult.Failure("فشل قراءة محتوى الترخيص.");
            }

            // 3. Hardware Lock Check (Strict HWID Matching)
            string currentMachineId = HardwareIdService.GetMachineId();
            if (!string.Equals(payload.MachineId, currentMachineId, StringComparison.OrdinalIgnoreCase))
            {
                return ActivationResult.Failure(
                    $"هذا الترخيص مخصص لجهاز آخر ({payload.MachineId}) ولا يتطابق مع معرف هذا الحاسوب ({currentMachineId})."
                );
            }

            // 4. Expiration Check
            if (payload.IsExpired)
            {
                return ActivationResult.Failure(
                    $"انتهت فترة صلاحية هذا الترخيص بتاريخ {payload.ExpiryDate:yyyy-MM-dd}. يرجى تجديد الاشتراك السنوي."
                );
            }

            // If all checks pass:
            _cachedPayload = payload;

            if (persistIfValid)
            {
                SaveStoredLicenseKey(rawLicenseKey);
            }

            string successMsg = payload.LicenseType == "LIFETIME" 
                ? $"تم التفعيل بنجاح! رخصة دائمة (مدى الحياة) مسجلة لـ: {payload.CustomerName}"
                : $"تم التفعيل بنجاح! رخصة سارية لـ: {payload.CustomerName} (متبقي {payload.DaysRemaining} يوم)";

            return ActivationResult.Success(payload, successMsg);
        }
        catch (FormatException)
        {
            return ActivationResult.Failure("ترميز مفتاح التفعيل تالف أو غير صالح.");
        }
        catch (Exception ex)
        {
            return ActivationResult.Failure($"خطأ أثناء فحص الترخيص: {ex.Message}");
        }
    }

    public LicensePayload? GetActivePayload() => _cachedPayload;

    private string? LoadStoredLicenseKey()
    {
        // 1. Check local file storage
        try
        {
            if (File.Exists(_licenseFilePath))
            {
                string key = File.ReadAllText(_licenseFilePath, Encoding.UTF8).Trim();
                if (!string.IsNullOrEmpty(key)) return key;
            }
        }
        catch { }

        // 2. Check Windows Registry fallback
        try
        {
            using var regKey = Registry.CurrentUser.OpenSubKey(@"Software\ZiloxERP");
            if (regKey != null)
            {
                object? val = regKey.GetValue("LicenseKey");
                if (val != null) return val.ToString()?.Trim();
            }
        }
        catch { }

        return null;
    }

    private void SaveStoredLicenseKey(string rawLicenseKey)
    {
        // Save to File
        try
        {
            File.WriteAllText(_licenseFilePath, rawLicenseKey.Trim(), Encoding.UTF8);
        }
        catch { }

        // Save to Registry
        try
        {
            using var regKey = Registry.CurrentUser.CreateSubKey(@"Software\ZiloxERP");
            regKey?.SetValue("LicenseKey", rawLicenseKey.Trim(), RegistryValueKind.String);
            regKey?.SetValue("MachineId", HardwareIdService.GetMachineId(), RegistryValueKind.String);
            regKey?.SetValue("ActivatedAt", DateTime.UtcNow.ToString("O"), RegistryValueKind.String);
        }
        catch { }
    }

    public void RemoveLicense()
    {
        _cachedPayload = null;
        try
        {
            if (File.Exists(_licenseFilePath))
            {
                File.Delete(_licenseFilePath);
            }
        }
        catch { }

        try
        {
            using var regKey = Registry.CurrentUser.OpenSubKey(@"Software\ZiloxERP", true);
            regKey?.DeleteValue("LicenseKey", false);
        }
        catch { }
    }
}

