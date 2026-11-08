using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

namespace ERP.Warehouse.Api.Controllers;

[ApiController]
[Route("api/warehouse/dispatches")]
[Route("api/v1/warehouse/dispatches")]
public class WarehouseDispatchController : ControllerBase
{
    private readonly IDiscountEngineService _discountEngine;
    private readonly ILogger<WarehouseDispatchController> _logger;

    public WarehouseDispatchController(
        IDiscountEngineService discountEngine,
        ILogger<WarehouseDispatchController> logger)
    {
        _discountEngine = discountEngine;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/warehouse/dispatches/queue
    /// Retrieves pending dispatch orders awaiting warehouse keeper approval.
    /// </summary>
    [HttpGet]
    [HttpGet("queue")]
    public async Task<ActionResult<IEnumerable<WarehouseDispatchOrderDto>>> GetDispatchQueue([FromQuery] Guid? warehouseId)
    {
        try
        {
            var queue = await _discountEngine.GetPendingDispatchOrdersAsync(warehouseId);
            return Ok(queue);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch warehouse dispatch queue");
            return StatusCode(500, new
            {
                errorCode = "ERR_INTERNAL_DISPATCH_QUEUE",
                message = "حدث خطأ أثناء تحميل طابور أوامر التجهيز بالمستودع"
            });
        }
    }

    /// <summary>
    /// POST /api/warehouse/dispatches/{id}/approve
    /// Confirms and releases warehouse dispatch order, deducting reserved stock and marking invoice fulfilled.
    /// </summary>
    [HttpPost("{id}/approve")]
    [HttpPost("approve/{id}")]
    public async Task<ActionResult<ApproveDispatchOrderResponse>> ApproveDispatchOrder(
        [FromRoute] Guid id,
        [FromBody] ApproveDispatchOrderRequest? request)
    {
        try
        {
            var req = request ?? new ApproveDispatchOrderRequest();
            var response = await _discountEngine.ApproveDispatchOrderAsync(id, req);
            return Ok(response);
        }
        catch (ApplicationException ex)
        {
            return BadRequest(new
            {
                errorCode = "ERR_DISPATCH_APPROVAL_FAILED",
                message = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to approve warehouse dispatch order {OrderId}", id);
            return StatusCode(500, new
            {
                errorCode = "ERR_INTERNAL_DISPATCH_APPROVAL",
                message = "حدث خطأ أثناء اعتماد وتجهيز أمر الصرف المستودعي"
            });
        }
    }
}

