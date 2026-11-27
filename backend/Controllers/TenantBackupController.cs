using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[RequiresPlanFeature(PlanFeatureKeys.SelfServiceBackup)]
[ApiController]
[Route("api/tenant/backup")]
[Route("api/v1/tenant/backup")]
public class TenantBackupController : ControllerBase
{
    private readonly ITenantBackupService _backupService;
    private readonly ITenantProvider _tenantProvider;

    public TenantBackupController(
        ITenantBackupService backupService,
        ITenantProvider tenantProvider)
    {
        _backupService = backupService;
        _tenantProvider = tenantProvider;
    }

    private string CurrentActorName =>
        User.FindFirst("full_name")?.Value
        ?? User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("username")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "Admin";

    private bool IsOwnerOrAdmin()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (string.Equals(role, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, nameof(UserRole.PlatformSuperAdmin), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, nameof(UserRole.BranchManager), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Owner", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var perms = User.FindAll("permissions")
            .Select(c => c.Value)
            .Concat(User.FindAll("permission").Select(c => c.Value))
            .Concat(User.FindAll("Permission").Select(c => c.Value));

        return perms.Any(p =>
            string.Equals(p, Permissions.System.SettingsManage, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, Permissions.System.UsersManage, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, "*", StringComparison.OrdinalIgnoreCase));
    }

    [HttpGet("status")]
    public async Task<ActionResult<ApiResponse<TenantBackupStatusDto>>> GetStatus(CancellationToken ct)
    {
        if (!IsOwnerOrAdmin())
        {
            return StatusCode(403, ApiResponse<TenantBackupStatusDto>.Fail("ERR_FORBIDDEN_ACTION", "BACKUP"));
        }

        var tenantId = _tenantProvider.CurrentTenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            return BadRequest(ApiResponse<TenantBackupStatusDto>.Fail("ERR_TENANT_NOT_FOUND", "BACKUP"));
        }

        var res = await _backupService.GetStatusAsync(tenantId.Value, ct);
        return res.Success ? Ok(res) : NotFound(res);
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportBackup(CancellationToken ct)
    {
        if (!IsOwnerOrAdmin())
        {
            return StatusCode(403, ApiResponse<object>.Fail("ERR_FORBIDDEN_ACTION", "BACKUP"));
        }

        var tenantId = _tenantProvider.CurrentTenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            return BadRequest(ApiResponse<object>.Fail("ERR_TENANT_NOT_FOUND", "BACKUP"));
        }

        var (result, bytes, fileName) = await _backupService.ExportAsync(tenantId.Value, CurrentActorName, ct);
        if (!result.Success || bytes == null)
        {
            return NotFound(result);
        }

        return File(bytes, "application/json; charset=utf-8", fileName ?? "zilox_backup.json");
    }

    [HttpPost("restore")]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<TenantBackupRestoreResultDto>>> RestoreBackup(
        IFormFile? file,
        CancellationToken ct)
    {
        if (!IsOwnerOrAdmin())
        {
            return StatusCode(403, ApiResponse<TenantBackupRestoreResultDto>.Fail("ERR_FORBIDDEN_ACTION", "BACKUP"));
        }

        var tenantId = _tenantProvider.CurrentTenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            return BadRequest(ApiResponse<TenantBackupRestoreResultDto>.Fail("ERR_TENANT_NOT_FOUND", "BACKUP"));
        }

        string rawJson;
        if (file != null && file.Length > 0)
        {
            using var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            rawJson = await reader.ReadToEndAsync(ct);
        }
        else if (Request.ContentLength is > 0)
        {
            using var reader = new StreamReader(Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            rawJson = await reader.ReadToEndAsync(ct);
        }
        else
        {
            return BadRequest(ApiResponse<TenantBackupRestoreResultDto>.Fail("ERR_INVALID_BACKUP_FILE", "BACKUP"));
        }

        var res = await _backupService.RestoreAsync(tenantId.Value, rawJson, CurrentActorName, ct);
        if (!res.Success)
        {
            return BadRequest(res);
        }

        return Ok(res);
    }
}
