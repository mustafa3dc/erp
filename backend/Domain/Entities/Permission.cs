using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Domain.Entities;

[Table("permissions")]
public class Permission
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(100)]
    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("group_name")]
    public string GroupName { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [Column("name_ar")]
    public string NameAr { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [Column("name_en")]
    public string NameEn { get; set; } = string.Empty;

    [Column("description_ar")]
    public string? DescriptionAr { get; set; }

    [Column("description_en")]
    public string? DescriptionEn { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserPermission> UserPermissions { get; set; } = new List<UserPermission>();
}

[Table("user_permissions")]
public class UserPermission
{
    [Required]
    [Column("user_id")]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("permission_code")]
    public string PermissionCode { get; set; } = string.Empty;

    [ForeignKey(nameof(PermissionCode))]
    public Permission? Permission { get; set; }

    [Column("granted_by")]
    public Guid? GrantedBy { get; set; }

    [ForeignKey(nameof(GrantedBy))]
    public User? Granter { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
