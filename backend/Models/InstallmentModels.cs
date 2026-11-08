using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ERP.Warehouse.Api.Models;

public enum InstallmentContractStatus
{
    Active = 1,
    Completed = 2,
    Defaulted = 3,
    Cancelled = 4
}

public enum InstallmentScheduleStatus
{
    Pending = 1,
    PartiallyPaid = 2,
    Paid = 3,
    Overdue = 4
}

[Table("installment_contracts")]
public class InstallmentContract : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("contract_number")]
    public string ContractNumber { get; set; } = string.Empty;

    [Column("invoice_id")]
    public Guid InvoiceId { get; set; }
    public SalesInvoice? Invoice { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("invoice_number")]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Column("customer_id")]
    public Guid CustomerId { get; set; }

    [Required]
    [MaxLength(150)]
    [Column("customer_name")]
    public string CustomerName { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("customer_phone")]
    public string CustomerPhone { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    [Column("guarantor_name")]
    public string GuarantorName { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("guarantor_phone")]
    public string GuarantorPhone { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("guarantor_national_id")]
    public string? GuarantorNationalId { get; set; }

    [Column("total_cash_price")]
    public decimal TotalCashPrice { get; set; }

    [Column("total_installment_price")]
    public decimal TotalInstallmentPrice { get; set; }

    [Column("down_payment")]
    public decimal DownPayment { get; set; }

    [Column("remaining_amount")]
    public decimal RemainingAmount { get; set; }

    [Column("installment_count")]
    public int InstallmentCount { get; set; }

    [Column("monthly_amount")]
    public decimal MonthlyAmount { get; set; }

    [Column("start_date")]
    public DateTime StartDate { get; set; } = DateTime.UtcNow;

    [Column("status")]
    public InstallmentContractStatus Status { get; set; } = InstallmentContractStatus.Active;

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<InstallmentScheduleItem> Schedules { get; set; } = new List<InstallmentScheduleItem>();
}

[Table("installment_schedule_items")]
public class InstallmentScheduleItem : ITenantEntity
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("contract_id")]
    public Guid ContractId { get; set; }
    [JsonIgnore]
    public InstallmentContract? Contract { get; set; }

    [Column("installment_number")]
    public int InstallmentNumber { get; set; }

    [Column("due_date")]
    public DateTime DueDate { get; set; }

    [Column("amount")]
    public decimal Amount { get; set; }

    [Column("paid_amount")]
    public decimal PaidAmount { get; set; } = 0.00m;

    [Column("paid_date")]
    public DateTime? PaidDate { get; set; }

    [Column("status")]
    public InstallmentScheduleStatus Status { get; set; } = InstallmentScheduleStatus.Pending;

    [Column("cashier_shift_id")]
    public Guid? CashierShiftId { get; set; }

    [MaxLength(50)]
    [Column("payment_method")]
    public string? PaymentMethod { get; set; }

    [MaxLength(100)]
    [Column("receipt_voucher_number")]
    public string? ReceiptVoucherNumber { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Request and Response DTOs
public class CreateInstallmentContractDto
{
    public Guid InvoiceId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string GuarantorName { get; set; } = string.Empty;
    public string GuarantorPhone { get; set; } = string.Empty;
    public string? GuarantorNationalId { get; set; }
    public decimal TotalCashPrice { get; set; }
    public decimal TotalInstallmentPrice { get; set; }
    public decimal DownPayment { get; set; }
    public int InstallmentCount { get; set; }
    public DateTime? StartDate { get; set; }
    public Guid? CashierShiftId { get; set; }
    public string? Notes { get; set; }
}

public class PayInstallmentItemDto
{
    public Guid ScheduleItemId { get; set; }
    public decimal PaidAmount { get; set; }
    public Guid? CashierShiftId { get; set; }
    public string PaymentMethod { get; set; } = "CASH";
    public string? Notes { get; set; }
}

public class InstallmentKpiStatsDto
{
    public int ActiveContractsCount { get; set; }
    public decimal DueThisMonthAmount { get; set; }
    public int DueThisMonthCount { get; set; }
    public decimal OverdueAmount { get; set; }
    public int OverdueCount { get; set; }
    public decimal TotalCollectedAmount { get; set; }
    public decimal TotalRemainingAmount { get; set; }
}

