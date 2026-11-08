using System;
using System.IO;
using System.Management;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;

namespace DesktopHost.Services;

/// <summary>
/// Hardware Identifier (HWID) Service.
/// Extracts unique device fingerprint based on Motherboard, CPU, and System Disk Serial Numbers.
/// Produces a formatted 16-character Machine ID (e.g., ZLX1-A2B3-C4D5-E6F7).
/// </summary>
public static class HardwareIdService
{
    private static string? _cachedMachineId;

    /// <summary>
    /// Gets the unique 16-character Machine ID for this computer.
    /// </summary>
    public static string GetMachineId()
    {
        if (!string.IsNullOrEmpty(_cachedMachineId))
        {
            return _cachedMachineId;
        }

        string mbSerial = GetMotherboardSerial();
        string cpuId = GetProcessorId();
        string diskId = GetDiskSerial();
        string regGuid = GetRegistryMachineGuid();
        string macAddress = GetPrimaryMacAddress();

        // Combine all components into a deterministic raw string
        string rawSignature = $"MB:{mbSerial}|CPU:{cpuId}|DISK:{diskId}|REG:{regGuid}|MAC:{macAddress}";

        // Compute SHA-256 hash
        using var sha = SHA256.Create();
        byte[] hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(rawSignature));

        // Convert the first 8 bytes of hash into 16 uppercase alphanumeric characters
        var hexBuilder = new StringBuilder();
        for (int i = 0; i < 8; i++)
        {
            hexBuilder.Append(hashBytes[i].ToString("X2"));
        }

        string rawHex = hexBuilder.ToString().ToUpperInvariant();

        // Format into 4 segments of 4 characters: ZLX1-XXXX-XXXX-XXXX
        _cachedMachineId = $"ZLX1-{rawHex.Substring(4, 4)}-{rawHex.Substring(8, 4)}-{rawHex.Substring(12, 4)}";
        return _cachedMachineId;
    }

    private static string GetMotherboardSerial()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber, Product FROM Win32_BaseBoard");
            foreach (ManagementObject mo in searcher.Get())
            {
                string? serial = mo["SerialNumber"]?.ToString()?.Trim();
                if (IsValidHardwareString(serial))
                {
                    return serial!;
                }
            }
        }
        catch { }

        return "MB_DEFAULT_FALLBACK";
    }

    private static string GetProcessorId()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT ProcessorId, Name FROM Win32_Processor");
            foreach (ManagementObject mo in searcher.Get())
            {
                string? id = mo["ProcessorId"]?.ToString()?.Trim();
                if (IsValidHardwareString(id))
                {
                    return id!;
                }
            }
        }
        catch { }

        return "CPU_DEFAULT_FALLBACK";
    }

    private static string GetDiskSerial()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_DiskDrive WHERE Index = 0");
            foreach (ManagementObject mo in searcher.Get())
            {
                string? serial = mo["SerialNumber"]?.ToString()?.Trim();
                if (IsValidHardwareString(serial))
                {
                    return serial!;
                }
            }
        }
        catch { }

        // Fallback: Volume Serial Number of C:\ drive
        try
        {
            var drive = new DriveInfo("C");
            if (drive.IsReady)
            {
                return GetVolumeSerial("C:\\");
            }
        }
        catch { }

        return "DISK_DEFAULT_FALLBACK";
    }

    private static string GetRegistryMachineGuid()
    {
        try
        {
            using var key = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64)
                                       .OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
            if (key != null)
            {
                object? guid = key.GetValue("MachineGuid");
                if (guid != null && !string.IsNullOrWhiteSpace(guid.ToString()))
                {
                    return guid.ToString()!;
                }
            }
        }
        catch { }

        return "REG_NO_GUID";
    }

    private static string GetPrimaryMacAddress()
    {
        try
        {
            foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.OperationalStatus == OperationalStatus.Up &&
                    nic.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                    nic.NetworkInterfaceType != NetworkInterfaceType.Tunnel)
                {
                    string mac = nic.GetPhysicalAddress().ToString();
                    if (!string.IsNullOrEmpty(mac) && mac.Length >= 12)
                    {
                        return mac;
                    }
                }
            }
        }
        catch { }

        return "MAC_DEFAULT";
    }

    private static bool IsValidHardwareString(string? str)
    {
        if (string.IsNullOrWhiteSpace(str)) return false;
        string upper = str.ToUpperInvariant();
        if (upper == "NONE" || 
            upper == "TO BE FILLED BY O.E.M." || 
            upper == "DEFAULT STRING" || 
            upper.StartsWith("OEM") || 
            upper == "SYSTEM SERIAL NUMBER" ||
            upper == "00000000" ||
            upper.Length < 3)
        {
            return false;
        }
        return true;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool GetVolumeInformation(
        string rootPathName,
        StringBuilder? volumeNameBuffer,
        int volumeNameSize,
        out uint volumeSerialNumber,
        out uint maximumComponentLength,
        out uint fileSystemFlags,
        StringBuilder? fileSystemNameBuffer,
        int nFileSystemNameSize);

    private static string GetVolumeSerial(string rootPath)
    {
        try
        {
            if (GetVolumeInformation(rootPath, null, 0, out uint serial, out _, out _, null, 0))
            {
                return serial.ToString("X8");
            }
        }
        catch { }

        return "VOL_NO_SERIAL";
    }
}

