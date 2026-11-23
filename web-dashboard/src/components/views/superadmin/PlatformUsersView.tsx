import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  Building2,
  CheckCircle2,
  LogIn,
  MoreHorizontal,
  Power,
  KeyRound,
  Mail,
  Phone,
  UserCheck,
  UserX
} from 'lucide-react';
import { UserAccount, UserRole } from '../../../types/rbac';
import { Tenant, getStoredTenants } from '../../../services/tenantService';
import { getAllStoredUsersMaster, saveStoredUsers, toggleUserStatus } from '../../../services/storageService';
import { resolveUserAvatar } from '../../../services/avatarService';
import RoleBadge from '../../ui/RoleBadge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../../ui/dropdown-menu';

interface PlatformUsersViewProps {
  lang: 'ar' | 'en';
  onImpersonateTenant: (tenant: Tenant) => void;
}

export default function PlatformUsersView({ lang, onImpersonateTenant }: PlatformUsersViewProps) {
  const isAr = lang === 'ar';

  const tenants = useMemo(() => getStoredTenants(), []);
  const [users, setUsers] = useState<UserAccount[]>(() => getAllStoredUsersMaster());
  const [searchTerm, setSearchTerm] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [notice, setNotice] = useState<string | null>(null);

  const refreshUsers = () => {
    setUsers(getAllStoredUsersMaster());
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleToggleStatus = (id: string, name: string) => {
    const nextStatus = toggleUserStatus(id);
    refreshUsers();
    showNotice(
      isAr 
        ? `تم ${nextStatus ? 'تفعيل' : 'تعطيل'} حساب "${name}" بنجاح` 
        : `Account "${name}" ${nextStatus ? 'activated' : 'deactivated'}`
    );
  };

  const handleResetPassword = (id: string, name: string) => {
    const all = getAllStoredUsersMaster();
    const updated = all.map(u => u.id === id ? { ...u, password: '123' } : u);
    saveStoredUsers(updated);
    refreshUsers();
    showNotice(
      isAr 
        ? `تمت إعادة تعيين كلمة مرور "${name}" إلى: 123` 
        : `Password for "${name}" reset to: 123`
    );
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.tenantSlug || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchTenant = tenantFilter === 'all' || (u.tenantSlug || '').toLowerCase() === tenantFilter.toLowerCase();
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.isActive) ||
        (statusFilter === 'inactive' && !u.isActive);

      return matchSearch && matchTenant && matchRole && matchStatus;
    });
  }, [users, searchTerm, tenantFilter, roleFilter, statusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'SuperAdmin' || u.role === 'PlatformSuperAdmin').length;
    const cashiers = users.filter(u => u.role === 'Cashier').length;
    const staff = total - admins - cashiers;
    return { total, admins, cashiers, staff };
  }, [users]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Notice Banner */}
      {notice && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#34d399',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#f4f4f5' }}>
          {isAr ? 'كافة المستخدمين وحسابات الموظفين (Platform Users & Accounts)' : 'Platform Users & Staff Accounts'}
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
          {isAr 
            ? 'سجل مركزي موحد يعرض كافة الحسابات والمدراء والموظفين المسجلين عبر جميع المنشآت والشركات' 
            : 'Central platform-wide directory of all users and staff across all tenants'}
        </p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{
          backgroundColor: '#121215',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 600 }}>
              {isAr ? 'إجمالي الحسابات' : 'Total Accounts'}
            </span>
            <h3 style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#f4f4f5', fontFamily: 'monospace' }}>
              {metrics.total}
            </h3>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(79, 70, 229, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
        </div>

        <div style={{
          backgroundColor: '#121215',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 600 }}>
              {isAr ? 'مدراء وسوبر أدمن' : 'Admins & Owners'}
            </span>
            <h3 style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
              {metrics.admins}
            </h3>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} />
          </div>
        </div>

        <div style={{
          backgroundColor: '#121215',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 600 }}>
              {isAr ? 'كاشير ونقاط بيع' : 'POS Cashiers'}
            </span>
            <h3 style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
              {metrics.cashiers}
            </h3>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={20} />
          </div>
        </div>

        <div style={{
          backgroundColor: '#121215',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 600 }}>
              {isAr ? 'أمناء مخازن ومحاسبين' : 'Warehouse & Finance'}
            </span>
            <h3 style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>
              {metrics.staff}
            </h3>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={20} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        backgroundColor: '#121215',
        border: '1px solid rgba(63, 63, 70, 0.5)',
        borderRadius: '14px',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isAr ? 'right' : 'left']: '12px', color: '#71717a' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم، اسم المستخدم، البريد...' : 'Search by name, username, email...'}
            style={{
              width: '100%',
              height: '38px',
              paddingLeft: isAr ? '12px' : '36px',
              paddingRight: isAr ? '36px' : '12px',
              backgroundColor: '#18181b',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '8px',
              color: '#f4f4f5',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Tenant Filter */}
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            style={{
              height: '38px',
              padding: '0 0.75rem',
              backgroundColor: '#18181b',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '8px',
              color: '#f4f4f5',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          >
            <option value="all">{isAr ? 'كافة المنشآت والشركات' : 'All Tenants'}</option>
            {tenants.map(t => (
              <option key={t.slug} value={t.slug}>{t.name} (@{t.slug})</option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              height: '38px',
              padding: '0 0.75rem',
              backgroundColor: '#18181b',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '8px',
              color: '#f4f4f5',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          >
            <option value="all">{isAr ? 'كافة الأدوار والوظائف' : 'All Roles'}</option>
            <option value="SuperAdmin">{isAr ? 'سوبر أدمن / مدير منشأة' : 'Super Admin'}</option>
            <option value="BranchManager">{isAr ? 'مدير فرع' : 'Branch Manager'}</option>
            <option value="Cashier">{isAr ? 'كاشير' : 'Cashier'}</option>
            <option value="Storekeeper">{isAr ? 'أمين مخزن' : 'Storekeeper'}</option>
            <option value="Accountant">{isAr ? 'محاسب' : 'Accountant'}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              height: '38px',
              padding: '0 0.75rem',
              backgroundColor: '#18181b',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '8px',
              color: '#f4f4f5',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          >
            <option value="all">{isAr ? 'كافة الحالات' : 'All Status'}</option>
            <option value="active">{isAr ? 'نشط' : 'Active'}</option>
            <option value="inactive">{isAr ? 'معطل' : 'Inactive'}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div style={{
        backgroundColor: '#121215',
        border: '1px solid rgba(63, 63, 70, 0.5)',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#18181b', borderBottom: '1px solid rgba(63, 63, 70, 0.5)' }}>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 700 }}>
                  {isAr ? 'المستخدم والحساب' : 'User & Identity'}
                </th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 700 }}>
                  {isAr ? 'المنشأة التابع لها' : 'Tenant Company'}
                </th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 700 }}>
                  {isAr ? 'الدور والصلاحية' : 'Role'}
                </th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 700 }}>
                  {isAr ? 'البريد والهاتف' : 'Contact'}
                </th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 700 }}>
                  {isAr ? 'الحالة' : 'Status'}
                </th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 700, textAlign: 'center' }}>
                  {isAr ? 'الإجراءات' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#71717a' }}>
                    <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>
                      {isAr ? 'لم يتم العثور على أي حسابات مستخدمين مطابقة' : 'No matching users found'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const associatedTenant = tenants.find(t => t.slug.toLowerCase() === (user.tenantSlug || '').toLowerCase());
                  const formattedUsername = user.username.includes('@') 
                    ? user.username 
                    : (user.tenantSlug ? `${user.username}@${user.tenantSlug}` : user.username);

                  return (
                    <tr 
                      key={user.id} 
                      style={{ 
                        borderBottom: '1px solid rgba(63, 63, 70, 0.3)',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      {/* User & Identity */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={resolveUserAvatar(user)}
                            alt=""
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(63, 63, 70, 0.6)' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f4f4f5' }}>
                              {user.fullName}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#818cf8', direction: 'ltr', display: 'inline-block' }}>
                              {formattedUsername}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tenant Company */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {associatedTenant ? (
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f4f4f5' }}>
                              {associatedTenant.name}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#34d399', fontFamily: 'monospace' }}>
                              @{associatedTenant.slug}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
                            {user.role === 'PlatformSuperAdmin' ? (isAr ? 'المنصة العامة (Control Plane)' : 'Platform Control Plane') : (user.tenantSlug ? `@${user.tenantSlug}` : '—')}
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <RoleBadge role={user.role} isAr={isAr} />
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontSize: '0.78rem', color: '#d4d4d8' }}>
                          {user.email && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Mail size={12} style={{ color: '#71717a' }} />
                              <span>{user.email}</span>
                            </div>
                          )}
                          {user.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', color: '#a1a1aa' }}>
                              <Phone size={12} style={{ color: '#71717a' }} />
                              <span>{user.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          backgroundColor: user.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: user.isActive ? '#34d399' : '#f87171',
                          border: `1px solid ${user.isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: user.isActive ? '#10b981' : '#ef4444' }} />
                          {user.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          {associatedTenant && (
                            <button
                              type="button"
                              onClick={() => onImpersonateTenant(associatedTenant)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                color: '#34d399',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                              title={isAr ? `الدخول كمدير لمنشأة "${associatedTenant.name}"` : `Impersonate ${associatedTenant.name}`}
                            >
                              <LogIn size={13} />
                              <span>{isAr ? 'دخول للمنشأة' : 'Enter'}</span>
                            </button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  backgroundColor: '#18181b',
                                  border: '1px solid rgba(63, 63, 70, 0.5)',
                                  color: '#a1a1aa',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800 text-zinc-100">
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(user.id, user.fullName)}
                                className="cursor-pointer text-xs"
                              >
                                <Power size={13} className="me-2 text-amber-400" />
                                {user.isActive ? (isAr ? 'تعطيل الحساب' : 'Deactivate') : (isAr ? 'تفعيل الحساب' : 'Activate')}
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => handleResetPassword(user.id, user.fullName)}
                                className="cursor-pointer text-xs"
                              >
                                <KeyRound size={13} className="me-2 text-indigo-400" />
                                {isAr ? 'إعادة ضبط كلمة المرور (123)' : 'Reset Password (123)'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
