using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[Route("api/serial-tracking")]
public class SerialTrackingController : ControllerBase
{
    private readonly ISerialTrackingService _serialService;
    private readonly ILogger<SerialTrackingController> _logger;

    public SerialTrackingController(ISerialTrackingService serialService, ILogger<SerialTrackingController> logger)
    {
        _serialService = serialService;
        _logger = logger;
    }

    [HttpGet]
    [HasPermission(Permissions.Inventory.SerialsView)]
    public async Task<ActionResult<ApiResponse<List<ProductSerialDto>>>> GetSerials(
        [FromQuery] string? query,
        [FromQuery] Guid? productId,
        [FromQuery] Guid? warehouseId,
        [FromQuery] string? status,
        [FromQuery] int limit = 100)
    {
        var list = await _serialService.GetSerialsAsync(query, productId, warehouseId, status, limit);
        return Ok(ApiResponse<List<ProductSerialDto>>.Ok(list));
    }

    /// <summary>
    /// Fast Lookup UI endpoint (query or route param):
    /// Barcode / Serial Scanner hits this to immediately retrieve:
    /// Supplier, Purchase Date, Customer, Sales Invoice, and Lifecycle Warranty Status.
    /// </summary>
    [HttpGet("lookup")]
    [HasPermission(Permissions.Inventory.SerialsView)]
    public async Task<ActionResult<ApiResponse<SerialLookupResultDto>>> Lookup([FromQuery] string serialNumber)
    {
        var result = await _serialService.LookupSerialAsync(serialNumber);
        if (!result.Found)
        {
            return NotFound(ApiResponse<SerialLookupResultDto>.Fail(result.ErrorCode ?? "ERR_SERIAL_NOT_FOUND", "INVENTORY"));
        }
        return Ok(ApiResponse<SerialLookupResultDto>.Ok(result));
    }

    [HttpGet("lookup/{serialNumber}")]
    [HasPermission(Permissions.Inventory.SerialsView)]
    public async Task<ActionResult<ApiResponse<SerialLookupResultDto>>> LookupByPath([FromRoute] string serialNumber)
    {
        var result = await _serialService.LookupSerialAsync(serialNumber);
        if (!result.Found)
        {
            return NotFound(ApiResponse<SerialLookupResultDto>.Fail(result.ErrorCode ?? "ERR_SERIAL_NOT_FOUND", "INVENTORY"));
        }
        return Ok(ApiResponse<SerialLookupResultDto>.Ok(result));
    }

    [HttpGet("pos-scan")]
    [HasPermission(Permissions.POS.TerminalAccess)]
    public async Task<ActionResult<PosSerialScanResponseDto>> PosScan([FromQuery] string code)
    {
        var result = await _serialService.LookupForPosScanAsync(code);
        return Ok(result);
    }

    [HttpPost("register")]
    [HasPermission(Permissions.Inventory.SerialsManage)]
    public async Task<ActionResult<ApiResponse<List<ProductSerialDto>>>> RegisterSerials([FromBody] RegisterSerialsRequest request)
    {
        var result = await _serialService.RegisterSerialsAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("bind-sale")]
    [HasPermission(Permissions.Sales.InvoicesCreate)]
    public async Task<ActionResult<ApiResponse<ProductSerialDto>>> BindSerialToSale([FromBody] BindSerialToSaleRequest request)
    {
        var result = await _serialService.BindSerialToSaleAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPut("{id:guid}/warranty")]
    [HasPermission(Permissions.Inventory.SerialsManage)]
    public async Task<ActionResult<ApiResponse<ProductSerialDto>>> UpdateWarranty(Guid id, [FromBody] UpdateSerialWarrantyRequest request)
    {
        var result = await _serialService.UpdateSerialWarrantyAsync(id, request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPatch("{id:guid}/status")]
    [HttpPut("{id:guid}/status")]
    [HasPermission(Permissions.Inventory.SerialsManage)]
    public async Task<ActionResult<ApiResponse<ProductSerialDto>>> UpdateStatus(Guid id, [FromBody] UpdateSerialStatusRequest request)
    {
        var actor = User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("username")?.Value
            ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? "System";

        var result = await _serialService.UpdateSerialStatusAsync(id, request, actor);
        if (!result.Success)
        {
            if (result.ErrorCode == "ERR_SERIAL_NOT_FOUND") return NotFound(result);
            return BadRequest(result);
        }
        return Ok(result);
    }
}
