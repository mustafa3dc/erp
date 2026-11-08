using System;

namespace ERP.Warehouse.Api.Domain.Common;

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public class AuthenticationException : Exception
{
    public AuthenticationException(string message) : base(message) { }
}
