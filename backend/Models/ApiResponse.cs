namespace ERP.Warehouse.Api.Models;

/// <summary>
/// Standard unified API response contract conforming to enterprise zero hardcoded strings and strict serialization.
/// </summary>
public sealed record ApiResponse<T>(
    bool Success,
    T? Data,
    string? ErrorCode,
    string? Domain,
    Dictionary<string, object>? Metadata,
    DateTimeOffset Timestamp
)
{
    public static ApiResponse<T> Ok(T data, Dictionary<string, object>? metadata = null) =>
        new(true, data, null, null, metadata, DateTimeOffset.UtcNow);

    public static ApiResponse<T> Fail(string errorCode, string domain, Dictionary<string, object>? metadata = null) =>
        new(false, default, errorCode, domain, metadata, DateTimeOffset.UtcNow);
}

