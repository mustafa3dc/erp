namespace Erp.Domain.Common;

public sealed record ErrorDetail(string Field, string Code, object? AttemptedValue = null);

public sealed class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? ErrorCode { get; }
    public string? Domain { get; }
    public IReadOnlyCollection<ErrorDetail> Details { get; }

    private Result(T value)
    {
        IsSuccess = true;
        Value = value;
        ErrorCode = null;
        Domain = null;
        Details = Array.Empty<ErrorDetail>();
    }

    private Result(string errorCode, string domain, IEnumerable<ErrorDetail>? details = null)
    {
        IsSuccess = false;
        Value = default;
        ErrorCode = errorCode;
        Domain = domain;
        Details = details?.ToArray() ?? Array.Empty<ErrorDetail>();
    }

    public static Result<T> Success(T value) => new(value);
    public static Result<T> Failure(string errorCode, string domain, IEnumerable<ErrorDetail>? details = null) 
        => new(errorCode, domain, details);
}
