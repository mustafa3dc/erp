namespace DesktopHost.Models;

public class ActivationResult
{
    public bool IsValid { get; set; }
    public string StatusMessage { get; set; } = string.Empty;
    public LicensePayload? Payload { get; set; }
    public int? DaysRemaining => Payload?.DaysRemaining;

    public static ActivationResult Success(LicensePayload payload, string message = "تم تفعيل الترخيص بنجاح")
    {
        return new ActivationResult
        {
            IsValid = true,
            StatusMessage = message,
            Payload = payload
        };
    }

    public static ActivationResult Failure(string errorMessage)
    {
        return new ActivationResult
        {
            IsValid = false,
            StatusMessage = errorMessage,
            Payload = null
        };
    }
}

