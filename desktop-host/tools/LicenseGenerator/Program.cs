using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DesktopHost.Models;

namespace LicenseGenerator;

/// <summary>
/// ZiloX Enterprise License Key Issuer CLI.
/// Used by the system vendor to generate RSA-signed, hardware-locked license keys for clients.
/// </summary>
public static class Program
{
    public static void Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.WriteLine("==============================================================");
        Console.WriteLine("  ZiloX ERP & Cloud POS - Hardware-Lock License Generator    ");
        Console.WriteLine("==============================================================");
        Console.WriteLine();

        string keyPath = FindPrivateKeyPath();
        if (!File.Exists(keyPath))
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[ERROR] Private key file not found: {keyPath}");
            Console.ResetColor();
            return;
        }

        string machineId;
        if (args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]))
        {
            machineId = args[0].Trim().ToUpperInvariant();
        }
        else
        {
            Console.Write("Enter Client Machine ID (e.g., ZLX1-XXXX-XXXX-XXXX): ");
            machineId = Console.ReadLine()?.Trim().ToUpperInvariant() ?? string.Empty;
        }

        if (string.IsNullOrWhiteSpace(machineId))
        {
            Console.WriteLine("Machine ID cannot be empty!");
            return;
        }

        Console.Write("Enter Client / Store Name [e.g., أسواق النور]: ");
        string customerName = Console.ReadLine()?.Trim() ?? "عميل معتمد";
        if (string.IsNullOrWhiteSpace(customerName)) customerName = "عميل معتمد";

        Console.Write("License Type (1: LIFETIME, 2: ANNUAL) [Default: 1]: ");
        string typeChoice = Console.ReadLine()?.Trim() ?? "1";
        string licenseType = typeChoice == "2" ? "ANNUAL" : "LIFETIME";

        DateTime? expiryDate = null;
        if (licenseType == "ANNUAL")
        {
            Console.Write("Validity in days [Default: 365]: ");
            string daysStr = Console.ReadLine()?.Trim() ?? "365";
            int days = int.TryParse(daysStr, out int parsed) ? parsed : 365;
            expiryDate = DateTime.UtcNow.AddDays(days);
            Console.WriteLine($"License Expiry Date set to: {expiryDate:yyyy-MM-dd}");
        }

        Console.Write("Preset (1: SUPERMARKET, 2: MOBILE, 3: WHOLESALE, 4: GENERAL) [Default: 1]: ");
        string presetChoice = Console.ReadLine()?.Trim() ?? "1";
        string preset = presetChoice switch
        {
            "2" => "MOBILE",
            "3" => "WHOLESALE",
            "4" => "GENERAL",
            _ => "SUPERMARKET"
        };

        var payload = new LicensePayload
        {
            MachineId = machineId,
            CustomerName = customerName,
            LicenseType = licenseType,
            ExpiryDate = expiryDate,
            Preset = preset,
            MaxTerminals = 5,
            IssueDate = DateTime.UtcNow,
            Notes = $"Issued for {customerName} on {DateTime.UtcNow:yyyy-MM-dd}"
        };

        // Serialize Payload to clean JSON
        string payloadJson = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            WriteIndented = false
        });
        byte[] payloadBytes = Encoding.UTF8.GetBytes(payloadJson);

        // Sign with RSA Private Key
        using var rsa = RSA.Create();
        string privateKeyPem = File.ReadAllText(keyPath);
        rsa.ImportFromPem(privateKeyPem);

        byte[] signatureBytes = rsa.SignData(
            payloadBytes,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1
        );

        string base64Payload = Convert.ToBase64String(payloadBytes);
        string base64Signature = Convert.ToBase64String(signatureBytes);

        string licenseKey = $"ZLX-LIC.{base64Payload}.{base64Signature}";

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("==============================================================");
        Console.WriteLine("  GENERATED LICENSE KEY (مفتاح التفعيل المعتمد):");
        Console.WriteLine("==============================================================");
        Console.WriteLine(licenseKey);
        Console.WriteLine("==============================================================");
        Console.ResetColor();

        // Optionally write to .lic file
        string outputFileName = $"{machineId.Replace("-", "_")}_{customerName.Replace(" ", "_")}.lic";
        File.WriteAllText(outputFileName, licenseKey, Encoding.UTF8);
        Console.WriteLine($"\nLicense file exported to: {Path.GetFullPath(outputFileName)}");
        Console.WriteLine("Send this key or .lic file to the customer.");
    }

    private static string FindPrivateKeyPath()
    {
        string[] candidates = new[]
        {
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "keys", "zilox_private_key.pem"),
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "keys", "zilox_private_key.pem"),
            "desktop-host/tools/LicenseGenerator/keys/zilox_private_key.pem",
            "keys/zilox_private_key.pem"
        };

        foreach (var c in candidates)
        {
            if (File.Exists(c)) return Path.GetFullPath(c);
        }

        return "keys/zilox_private_key.pem";
    }
}

