using System;
using System.Text.Json.Serialization;

namespace DesktopHost.Models;

/// <summary>
/// Hardware-locked cryptographic license payload signed with RSA-2048 private key.
/// </summary>
public class LicensePayload
{
    [JsonPropertyName("machineId")]
    public string MachineId { get; set; } = string.Empty;

    [JsonPropertyName("customerName")]
    public string CustomerName { get; set; } = string.Empty;

    [JsonPropertyName("licenseType")]
    public string LicenseType { get; set; } = "LIFETIME"; // LIFETIME, ANNUAL, TRIAL

    [JsonPropertyName("expiryDate")]
    public DateTime? ExpiryDate { get; set; }

    [JsonPropertyName("preset")]
    public string Preset { get; set; } = "SUPERMARKET"; // SUPERMARKET, MOBILE, WHOLESALE, GENERAL

    [JsonPropertyName("maxTerminals")]
    public int MaxTerminals { get; set; } = 1;

    [JsonPropertyName("issueDate")]
    public DateTime IssueDate { get; set; } = DateTime.UtcNow;

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    /// <summary>
    /// Checks if this license has expired based on current local time.
    /// </summary>
    [JsonIgnore]
    public bool IsExpired => ExpiryDate.HasValue && ExpiryDate.Value.Date < DateTime.UtcNow.Date;

    /// <summary>
    /// Computes days remaining before license expiration (null if lifetime).
    /// </summary>
    [JsonIgnore]
    public int? DaysRemaining => ExpiryDate.HasValue 
        ? Math.Max(0, (int)(ExpiryDate.Value.Date - DateTime.UtcNow.Date).TotalDays) 
        : null;
}

