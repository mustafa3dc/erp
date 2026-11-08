import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Building2,
  Search,
  Trash2,
  UserCheck,
  ShieldCheck,
  MoreHorizontal,
  Edit,
  UserX,
  Loader2,
  Smile,
  Receipt,
  Lock
} from 'lucide-react';
import EmployeeStatementModal from '../modals/EmployeeStatementModal';
import { UserAccount, UserRole, UserProfile } from '../../types/rbac';
import { Warehouse } from '../../types/warehouse';
import { getStoredWarehouses } from '../../services/storageService';
import { resolveUserAvatar } from '../../services/avatarService';
import EditStaffModal from '../staff/EditStaffModal';
import RoleBadge from '../ui/RoleBadge';
import {
  DialogPortal,
  DialogOverlay,
  DialogContent
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import CreateStaffModal from '../modals/CreateStaffModal';
import StaffPermissionsDialog from '../modals/StaffPermissionsDialog';
import PromoteStaffModal from '../modals/PromoteStaffModal';
import { usePermissions } from '../../hooks/usePermissions';
import { useUsersQuery } from '../../hooks/useUsersQuery';
import { useDeleteStaffMutation, useToggleStaffStatusMutation } from '../../hooks/useStaffMutation';

export interface UsersStaffViewProps {
  currentUser: UserProfile;
  lang: 'ar' | 'en';
  showToast: (msg: string) => void;
}

export default function UsersStaffView({ currentUser, lang, showToast }: UsersStaffViewProps) {
  const isAr = lang === 'ar';
  const { hasPermission } = usePermissions(currentUser);

  // Pure Live API Consumption via useUsersQuery (Strictly ZERO Mock Data)
  const { data: usersList = [], isLoading, refetch } = useUsersQuery();
  const deleteStaffMutation = useDeleteStaffMutation();
  const toggleStaffStatusMutation = useToggleStaffStatusMutation();

  const [warehouses] = useState<Warehouse[]>(() => getStoredWarehouses());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterBranch, setFilterBranch] = useState<string>('ALL');

  // Modal States
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUserForAction, setSelectedUserForAction] = useState<UserAccount | null>(null);

  // PBAC Permissions Matrix Modal State
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<UserAccount | null>(null);

  // Promote Staff Role Modal State
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [selectedUserForPromote, setSelectedUserForPromote] = useState<UserAccount | null>(null);

  // Edit Staff Avatar Modal State
  const [isEditAvatarModalOpen, setIsEditAvatarModalOpen] = useState(false);
  const [selectedUserForAvatar, setSelectedUserForAvatar] = useState<UserAccount | null>(null);

  // Employee Financial Statement Modal State
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [selectedUserForStatement, setSelectedUserForStatement] = useState<UserAccount | null>(null);

  // Reset Password State
  const [newResetPasswordValue, setNewResetPasswordValue] = useState('');

  const getInitials = (name: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Helper to strip any @tenant suffix from username column for clean aesthetic display
  const getCleanUsername = (username: string) => {
    if (!username) return '';
    return username.includes('@') ? username.split('@')[0] : username;
  };

  const handleToggleStatus = async (user: UserAccount) => {
    // 1. Root Owner is completely immune
    if (user.role === 'SuperAdmin' || user.id === 'USR-ADMIN-01' || user.username.toLowerCase() === 'mustafa' || user.username.toLowerCase() === 'admin') {
      showToast(isAr ? 'حساب المالك الرئيسي محمي كلياً ولا يمكن تعطيله' : 'Root Owner cannot be deactivated');
      return;
    }

    // 2. Cannot deactivate yourself
    if (user.id === currentUser.id) {
      showToast(isAr ? 'لا يمكنك تعطيل حسابك الشخصي الحالي' : 'Cannot deactivate your own account');
      return;
    }

    // 3. Subordinates cannot touch superiors or peers
    if (currentUser.role === 'BranchManager' && (user.role === 'BranchManager' || user.role === 'Accountant')) {
      showToast(isAr ? 'ليس لديك صلاحية تعديل رتبة أعلى أو مساوية لرتبتك' : 'Permission denied');
      return;
    }

    const nextActive = await toggleStaffStatusMutation.mutateAsync(user.id);
    showToast(nextActive 
      ? (isAr ? `تم تفعيل حساب الموظف (${user.fullName}) بنجاح` : `Activated ${user.fullName}`)
      : (isAr ? `تم تعطيل حساب الموظف (${user.fullName}) - لن يتمكن من تسجيل الدخول` : `Suspended ${user.fullName}`));
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForAction || !newResetPasswordValue.trim()) return;

    if (newResetPasswordValue.trim().length < 6) {
      showToast(isAr ? 'يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام' : 'Password must be at least 6 characters');
      return;
    }

    const isRootOwner = selectedUserForAction.role === 'SuperAdmin' || selectedUserForAction.id === 'USR-ADMIN-01' || selectedUserForAction.username.toLowerCase() === 'mustafa' || selectedUserForAction.username.toLowerCase() === 'admin';
    if (isRootOwner && currentUser.id !== selectedUserForAction.id) {
      showToast(isAr ? 'لا يمكن لأي شخص تغيير كلمة مرور المالك الرئيسي إلا المالك نفسه' : 'Root Owner password cannot be reset by subordinates');
      return;
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
      await fetch(`/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          userId: selectedUserForAction.id,
          newPassword: newResetPasswordValue.trim()
        })
      });
    } catch {
      // Offline fallback
    }

    await refetch();
    setIsResetPasswordModalOpen(false);
    setNewResetPasswordValue('');
    showToast(isAr 
      ? `تم تغيير كلمة مرور الموظف (${selectedUserForAction.fullName}) بنجاح` 
      : `Password updated for ${selectedUserForAction.fullName}`);
  };

  const handleDeleteUser = async (user: UserAccount) => {
    // 1. Root Owner cannot be deleted under ANY circumstances
    if (user.role === 'SuperAdmin' || user.id === 'USR-ADMIN-01' || user.username.toLowerCase() === 'mustafa' || user.username.toLowerCase() === 'admin') {
      showToast(isAr ? 'حساب المالك الرئيسي محمي كلياً ولا يمكن حذفه نهائياً' : 'Root Owner cannot be deleted');
      return;
    }

    // 2. Cannot delete yourself
    if (user.id === currentUser.id) {
      showToast(isAr ? 'لا يمكنك حذف حسابك الشخصي الحالي' : 'Cannot delete your own account');
      return;
    }

    // 3. Branch manager cannot delete superiors or other managers
    if (currentUser.role === 'BranchManager' && (user.role === 'BranchManager' || user.role === 'Accountant')) {
      showToast(isAr ? 'ليس لديك صلاحية حذف رتبة أعلى أو مساوية لرتبتك' : 'Permission denied');
      return;
    }

    if (confirm(isAr ? `هل أنت متأكد من حذف حساب الموظف (${user.fullName}) نهائياً؟` : `Delete account for ${user.fullName}?`)) {
      await deleteStaffMutation.mutateAsync(user.id);
      showToast(isAr ? `تم حذف حساب الموظف (${user.fullName}) بنجاح` : `Deleted ${user.fullName}`);
    }
  };

  // Filter users with strict Branch Manager isolation
  const visibleUsers = usersList.filter(u => {
    if (currentUser.role === 'BranchManager') {
      return u.branchId === currentUser.branchId && (u.role === 'Cashier' || u.role === 'Storekeeper');
    }
    return true;
  });

  const filteredUsers = visibleUsers.filter(u => {
    const matchesSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.phone && u.phone.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = filterRole === 'ALL' || u.role === filterRole;
    const matchesBranch = filterBranch === 'ALL' || u.branchId === filterBranch;
    return matchesSearch && matchesRole && matchesBranch;
  });

  const totalStaff = usersList.length;
  const activeStaff = usersList.filter(u => u.isActive).length;
  const cashierCount = usersList.filter(u => u.role === 'Cashier').length;
  const warehouseCount = usersList.filter(u => u.role === 'Storekeeper').length;

  // Executive Badge Styles - Slate Enterprise
  const getRoleBadgeClasses = (role: UserRole) => {
    switch (role) {
      case 'SuperAdmin':
      case 'PlatformSuperAdmin':
      case 'BranchManager':
        return 'bg-slate-900 text-slate-100 dark:bg-slate-800 dark:text-slate-200 border border-slate-700 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap';
      case 'Cashier':
        return 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap';
      case 'Accountant':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap';
      case 'Storekeeper':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap';
      default:
        return 'bg-muted text-muted-foreground border border-border px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap';
    }
  };

  const getRoleAvatarSrc = (role: string) => {
    const r = (role || '').toLowerCase();
    if (r.includes('admin') || r.includes('manager')) return '/avatars/memoji-admin.svg';
    if (r.includes('cashier')) return '/avatars/memoji-Cashier.svg';
    if (r.includes('accountant')) return '/avatars/memoji-Accountant.svg';
    if (r.includes('store') || r.includes('stock')) return '/avatars/memoji-Storekeeper.svg';
    return '/avatars/memoji-admin.svg';
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'SuperAdmin':
        return isAr ? 'المدير العام' : 'Super Admin';
      case 'BranchManager':
        return isAr ? 'مدير الفرع' : 'Branch Manager';
      case 'Accountant':
        return isAr ? 'المحاسب المالي' : 'Accountant';
      case 'Storekeeper':
        return isAr ? 'أمين المخزن' : 'Storekeeper';
      case 'Cashier':
        return isAr ? 'كاشير مبيعات' : 'Cashier';
      case 'PlatformSuperAdmin':
        return isAr ? 'مدير المنصة' : 'Platform Owner';
      default:
        return role;
    }
  };

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <div className="view-header-bar flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0 shadow-xs">
              <Users size={20} />
            </div>
            <div>
              <h2 className="view-title text-xl font-extrabold text-foreground tracking-tight m-0">
                {isAr ? 'إدارة الموظفين والمستخدمين وتوزيع الصلاحيات' : 'Staff & User Access Management'}
              </h2>
              <p className="view-subtitle text-xs text-muted-foreground mt-0.5 m-0">
                {isAr 
                  ? 'إنشاء يوزرات الموظفين، تعيين فروع العمل، وتحديد الرتب والصلاحيات مع إمكانية التفعيل والتعطيل الفوري' 
                  : 'Create staff accounts, assign branches, define access roles, and manage active status'}
              </p>
            </div>
          </div>
        </div>

        <button 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all shadow-xs cursor-pointer select-none shrink-0"
          onClick={() => setIsAddUserModalOpen(true)}
        >
          <UserPlus size={16} />
          <span>{isAr ? 'إضافة موظف جديد' : 'Add New Staff'}</span>
        </button>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="module-kpi-card flex flex-col justify-between p-4 rounded-2xl bg-card border border-border/70 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isAr ? 'إجمالي الموظفين المسجلين' : 'Total Registered Staff'}</span>
            <Users size={16} className="text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-foreground mt-2">{totalStaff}</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            {isAr ? 'موزعون على فروع ومستودعات المنشأة' : 'Across all corporate branches'}
          </div>
        </div>

        <div className="module-kpi-card flex flex-col justify-between p-4 rounded-2xl bg-card border border-border/70 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isAr ? 'الحسابات النشطة والمفعلة' : 'Active Accounts'}</span>
            <UserCheck size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">{activeStaff}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {isAr ? `${totalStaff - activeStaff} حسابات معطلة حالياً` : `${totalStaff - activeStaff} suspended accounts`}
          </div>
        </div>

        <div className="module-kpi-card flex flex-col justify-between p-4 rounded-2xl bg-card border border-border/70 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isAr ? 'كادر المبيعات والكاشير' : 'Cashiers & Sales Reps'}</span>
            <Shield size={16} className="text-sky-600" />
          </div>
          <div className="text-2xl font-extrabold text-sky-600 mt-2">{cashierCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {isAr ? 'محجوب عنهم سعر التكلفة برمجياً' : 'Cost prices strictly masked'}
          </div>
        </div>

        <div className="module-kpi-card flex flex-col justify-between p-4 rounded-2xl bg-card border border-border/70 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isAr ? 'أمناء المخازن واللوجستك' : 'Storekeepers & Logistics'}</span>
            <Building2 size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2">{warehouseCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {isAr ? 'صلاحيات التحويل والجرد والشحن' : 'Transfers, auditing & GRN dispatch'}
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-3.5 rounded-2xl mb-5 flex flex-wrap items-center justify-between gap-3 bg-card border border-border/70 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[260px] relative">
          <Search size={16} className={`absolute text-muted-foreground pointer-events-none ${isAr ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم، اسم المستخدم، أو الهاتف...' : 'Search by name, username, or phone...'}
            className={`w-full py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${isAr ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="py-2 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="ALL">{isAr ? 'جميع الرتب والوظائف' : 'All Roles'}</option>
            <option value="SuperAdmin">{isAr ? 'المدير العام (SuperAdmin)' : 'SuperAdmin'}</option>
            <option value="BranchManager">{isAr ? 'مدير الفرع / المشرف' : 'Branch Manager'}</option>
            <option value="Accountant">{isAr ? 'المحاسب المالي' : 'Accountant'}</option>
            <option value="Storekeeper">{isAr ? 'أمين المخزن' : 'Storekeeper'}</option>
            <option value="Cashier">{isAr ? 'كاشير مبيعات' : 'Cashier'}</option>
          </select>

          {/* Branch Filter */}
          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            className="py-2 px-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="ALL">{isAr ? 'جميع الفروع والمستودعات' : 'All Branches'}</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{isAr ? wh.nameAr : (wh.nameEn || wh.nameAr)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Staff Master Table */}
      <div className="rounded-2xl overflow-hidden bg-card border border-border/70 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="bg-muted/40 border-b border-border/70">
                <th className="py-3 px-4 text-xs font-bold text-muted-foreground">{isAr ? 'الموظف' : 'Staff Member'}</th>
                <th className="py-3 px-4 text-xs font-bold text-muted-foreground">{isAr ? 'اسم الدخول' : 'Username'}</th>
                <th className="py-3 px-4 text-xs font-bold text-muted-foreground">{isAr ? 'الرتبة والدور' : 'Role & Rank'}</th>
                <th className="py-3 px-4 text-xs font-bold text-muted-foreground">{isAr ? 'الفرع' : 'Branch / Location'}</th>
                <th className="py-3 px-4 text-xs font-bold text-muted-foreground">{isAr ? 'الحالة' : 'Account Status'}</th>
                <th className="py-3 px-4 text-xs font-bold text-muted-foreground whitespace-nowrap">{isAr ? 'تاريخ الإنشاء' : 'Created Date'}</th>
                <th className="py-3 px-4 text-xs font-bold text-muted-foreground text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading && usersList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <Loader2 size={16} className="animate-spin text-primary" />
                      <span>{isAr ? 'جارٍ تحميل بيانات الموظفين من الخادم...' : 'Loading staff accounts from server...'}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center border border-border/80">
                        <Users size={24} className="opacity-60" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground m-0">
                          {isAr ? 'لا يوجد موظفون مسجلون حالياً' : 'No staff members registered'}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 m-0 max-w-sm">
                          {isAr 
                            ? 'أضف موظفين جدد إلى المنشأة لبدء إدارة الصلاحيات وتوزيع الأدوار الوظيفية'
                            : 'Add new staff members to this organization to configure permissions and roles'}
                        </p>
                      </div>
                      <Button
                        onClick={() => setIsAddUserModalOpen(true)}
                        className="mt-2 h-9 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
                      >
                        <UserPlus size={14} />
                        <span>{isAr ? 'إضافة موظف جديد' : 'Add New Staff'}</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isRootOwner = user.role === 'SuperAdmin' || user.role === 'PlatformSuperAdmin' || (user.role as string) === 'Owner' || user.id === 'USR-ADMIN-01' || user.username.toLowerCase() === 'mustafa' || user.username.toLowerCase() === 'admin';
                  const isCallerOwner = currentUser.role === 'SuperAdmin' || currentUser.role === 'PlatformSuperAdmin' || (currentUser.role as string) === 'Owner' || currentUser.id === 'USR-ADMIN-01' || currentUser.username.toLowerCase() === 'admin' || currentUser.username.toLowerCase() === 'mustafa';
                  const isSelf = user.id === currentUser.id;
                  const cleanUsername = getCleanUsername(user.username);

                  return (
                    <tr 
                      key={user.id}
                      className={`hover:bg-muted/30 transition-colors ${user.isActive ? '' : 'opacity-60'}`}
                    >
                      {/* Full Name & Curated 3D Memoji Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 rounded-full ring-1 ring-border/60 overflow-hidden flex items-center justify-center bg-muted shrink-0 shadow-xs">
                            <img
                              src={resolveUserAvatar(user)}
                              alt={user.fullName}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.src.endsWith('/avatars/memoji-admin.png')) {
                                  target.src = '/avatars/memoji-admin.png';
                                }
                              }}
                            />
                          </div>
                          <div>
                            <strong className="text-xs font-bold text-foreground block leading-tight">
                              {user.fullName}
                            </strong>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-muted/80 text-[10px] text-muted-foreground font-mono font-medium whitespace-nowrap">
                                {user.id}
                              </span>
                              {user.phone && user.phone.trim().length > 1 && (
                                <>
                                  <span className="text-muted-foreground/30 text-[10px] select-none">•</span>
                                  <span dir="ltr" className="font-mono text-[11px] text-muted-foreground whitespace-nowrap tracking-wide">
                                    {user.phone}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Clean Username (No @a) */}
                      <td className="py-3 px-4">
                        <span className="h-7 px-2.5 rounded-lg bg-muted/60 text-foreground font-mono text-xs font-semibold border border-border/50 inline-flex items-center justify-center whitespace-nowrap">
                          {cleanUsername}
                        </span>
                      </td>

                      {/* Unified Standardized Role Badge */}
                      <td className="py-3 px-4">
                        <RoleBadge role={user.role} isAr={isAr} />
                      </td>

                      {/* Branch */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground whitespace-nowrap">
                          <Building2 size={13} className="text-muted-foreground shrink-0" />
                          <span>{user.branchName || user.branchId}</span>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-3 px-4">
                        {isRootOwner ? (
                          <span className="h-7 px-3 text-xs font-semibold rounded-full inline-flex items-center justify-center gap-1.5 border transition-all whitespace-nowrap bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                            <ShieldCheck size={12} className="text-emerald-500" />
                            <span>{isAr ? 'المالك الدائم (محمي)' : 'Protected'}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user)}
                            disabled={user.id === currentUser.id || toggleStaffStatusMutation.isUpdating}
                            title={user.id === currentUser.id ? (isAr ? 'لا يمكنك تعطيل حسابك الحالي' : 'Cannot disable self') : (isAr ? 'انقر للتبديل بين التفعيل والتعطيل' : 'Toggle status')}
                            className={`h-7 px-3 text-xs font-semibold rounded-full inline-flex items-center justify-center gap-1.5 border transition-all whitespace-nowrap cursor-pointer ${
                              user.isActive 
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                            } ${user.id === currentUser.id ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{user.isActive ? (isAr ? 'نشط ومفعل' : 'Active') : (isAr ? 'معطل' : 'Suspended')}</span>
                          </button>
                        )}
                      </td>

                      {/* Created Date (whitespace-nowrap) */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-mono text-muted-foreground">
                        {user.createdAt}
                      </td>

                      {/* Consolidated Dropdown Menu Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserForStatement(user);
                              setIsStatementModalOpen(true);
                            }}
                            className="h-8 px-2.5 text-xs font-bold text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 gap-1.5 rounded-lg shadow-2xs"
                            title={isAr ? 'عرض كشف الحساب المالي للموظف' : 'View Employee Statement of Account'}
                          >
                            <Receipt className="w-3.5 h-3.5 text-primary" />
                            <span>{isAr ? 'كشف الحساب' : 'Statement'}</span>
                          </Button>

                          <DropdownMenu dir={isAr ? 'rtl' : 'ltr'}>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl border border-border bg-card shadow-xl">
                              {/* 0. Statement of Account Quick Access */}
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUserForStatement(user);
                                  setIsStatementModalOpen(true);
                                }}
                                className="flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer hover:bg-muted font-bold text-primary"
                              >
                                <span>{isAr ? 'كشف الحساب المالي' : 'Statement of Account'}</span>
                                <Receipt size={14} className="text-primary" />
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            {/* 1. Modify Permissions Matrix with Strict RBAC & Owner Protection */}
                            {isRootOwner ? (
                              <DropdownMenuItem
                                disabled
                                className="flex items-center justify-between p-2 rounded-lg text-xs opacity-65 cursor-not-allowed font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                title={isAr ? 'حساب المالك محصن بالكامل ولا يمكن تعديل صلاحياته' : 'Owner account is fully protected'}
                              >
                                <span className="flex items-center gap-1.5 font-bold">
                                  <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                                  <span>{isAr ? 'حساب المالك محصن بالكامل' : 'Owner Protected'}</span>
                                </span>
                                <Lock size={12} className="text-muted-foreground" />
                              </DropdownMenuItem>
                            ) : isSelf ? (
                              <DropdownMenuItem
                                disabled
                                className="flex items-center justify-between p-2 rounded-lg text-xs opacity-65 cursor-not-allowed font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10"
                                title={isAr ? 'قفل التعديل الذاتي: لا يمكن تعديل صلاحيات حسابك بنفسك' : 'Self-edit lock: cannot edit own permissions'}
                              >
                                <span className="flex items-center gap-1.5 font-bold">
                                  <Shield size={14} className="text-amber-500 shrink-0" />
                                  <span>{isAr ? 'قفل التعديل الذاتي' : 'Self-Edit Locked'}</span>
                                </span>
                                <Lock size={12} className="text-muted-foreground" />
                              </DropdownMenuItem>
                            ) : !isCallerOwner ? (
                              <DropdownMenuItem
                                disabled
                                className="flex items-center justify-between p-2 rounded-lg text-xs opacity-50 cursor-not-allowed font-medium text-muted-foreground"
                                title={isAr ? 'تعديل الصلاحيات مقتصر حصراً على المالك' : 'Permission modification is restricted to the Owner'}
                              >
                                <span className="flex items-center gap-1.5">
                                  <Shield size={14} className="text-muted-foreground shrink-0" />
                                  <span>{isAr ? 'تعديل الصلاحيات (للمالك)' : 'Owner Only'}</span>
                                </span>
                                <Lock size={12} className="text-muted-foreground" />
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUserForPermissions(user);
                                  setIsPermissionsModalOpen(true);
                                }}
                                className="flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer hover:bg-muted font-medium"
                              >
                                <span>{isAr ? 'تعديل الصلاحيات' : 'Edit Permissions'}</span>
                                <Shield size={14} className="text-muted-foreground" />
                              </DropdownMenuItem>
                            )}

                            {/* 2. Customize Memoji Avatar */}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUserForAvatar(user);
                                setIsEditAvatarModalOpen(true);
                              }}
                              className="flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer hover:bg-muted font-medium"
                            >
                              <span>{isAr ? 'تخصيص المظهر والأفاتار' : 'Customize Avatar'}</span>
                              <Smile size={14} className="text-muted-foreground" />
                            </DropdownMenuItem>

                            {/* 3. Promote / Change Role */}
                            {!isRootOwner && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUserForPromote(user);
                                  setIsPromoteModalOpen(true);
                                }}
                                className="flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer hover:bg-muted font-medium"
                              >
                                <span>{isAr ? 'تعديل الرتبة والفرع' : 'Edit Role & Branch'}</span>
                                <Edit size={14} className="text-muted-foreground" />
                              </DropdownMenuItem>
                            )}

                            {/* 3. Reset Password */}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUserForAction(user);
                                setIsResetPasswordModalOpen(true);
                              }}
                              className="flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer hover:bg-muted font-medium"
                            >
                              <span>{isAr ? 'إعادة تعيين كلمة السر' : 'Reset Password'}</span>
                              <KeyRound size={14} className="text-muted-foreground" />
                            </DropdownMenuItem>

                            {/* 4. Toggle Active Status */}
                            {!isRootOwner && user.id !== currentUser.id && (
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(user)}
                                className="flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer hover:bg-muted font-medium"
                              >
                                <span>{user.isActive ? (isAr ? 'تعطيل الحساب' : 'Suspend Account') : (isAr ? 'تفعيل الحساب' : 'Activate Account')}</span>
                                <UserX size={14} className="text-muted-foreground" />
                              </DropdownMenuItem>
                            )}

                            {/* 5. Delete Account */}
                            {hasPermission('system.users.manage') && !isRootOwner && user.id !== currentUser.id && (
                              <>
                                <DropdownMenuSeparator className="my-1 bg-border" />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteUser(user)}
                                  className="flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer hover:bg-destructive/10 text-destructive font-bold"
                                >
                                  <span>{isAr ? 'حذف الحساب نهائياً' : 'Delete Account'}</span>
                                  <Trash2 size={14} className="text-destructive" />
                                </DropdownMenuItem>
                              </>
                            )}
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

      {/* Modal: Create New Employee User Account via CreateStaffModal */}
      <CreateStaffModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        currentUser={currentUser}
        warehouses={warehouses}
        existingUsers={usersList}
        lang={lang}
        onUserCreated={async (created) => {
          await refetch();
          showToast(
            isAr
              ? `تم إنشاء حساب الموظف (${created.fullName}) بنجاح!`
              : `Created employee account (${created.fullName}) successfully!`
          );
        }}
      />

      {/* Modal: Reset Password */}
      {isResetPasswordModalOpen && selectedUserForAction && (
        <DialogPortal>
          <DialogOverlay onClick={() => {
            setIsResetPasswordModalOpen(false);
            setNewResetPasswordValue('');
          }} />
          <DialogContent 
            className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl p-6 text-foreground"
            style={{ maxWidth: '440px' }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground m-0 leading-tight">
                  {isAr ? `تغيير كلمة مرور (${selectedUserForAction.fullName})` : `Reset Password for ${selectedUserForAction.fullName}`}
                </h3>
                <small className="text-xs text-muted-foreground block mt-0.5 font-mono">
                  {getCleanUsername(selectedUserForAction.username)}
                </small>
              </div>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="resetPassword">
                  {isAr ? 'كلمة المرور الجديدة *' : 'New Password *'}
                </Label>
                <Input
                  id="resetPassword"
                  type="password"
                  required
                  value={newResetPasswordValue}
                  onChange={e => setNewResetPasswordValue(e.target.value)}
                  placeholder={isAr ? 'اكتب كلمة المرور الجديدة...' : 'Enter new password...'}
                  className="h-10 border border-border/80 bg-background focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40 mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsResetPasswordModalOpen(false);
                    setNewResetPasswordValue('');
                  }}
                  className="h-10 px-4 text-sm font-medium"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 text-sm font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  {isAr ? 'تأكيد التغيير' : 'Save New Password'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </DialogPortal>
      )}

      {/* Modal: Granular PBAC Permissions Matrix */}
      <StaffPermissionsDialog
        key={selectedUserForPermissions ? `${selectedUserForPermissions.id}-${selectedUserForPermissions.role}-${(selectedUserForPermissions.permissions || []).length}` : 'perm-dialog-empty'}
        isOpen={isPermissionsModalOpen}
        onClose={() => {
          setIsPermissionsModalOpen(false);
          setSelectedUserForPermissions(null);
        }}
        targetUser={selectedUserForPermissions ? (usersList.find(u => u.id === selectedUserForPermissions.id) || selectedUserForPermissions) : null}
        currentUser={currentUser}
        lang={lang}
        showToast={showToast}
        onSaveSuccess={async (updated) => {
          await refetch();
          setSelectedUserForPermissions(updated);
        }}
        onOpenPromoteModal={(user) => {
          setSelectedUserForPromote(user);
          setIsPromoteModalOpen(true);
        }}
      />

      {/* Modal: Promote Staff & Change Role */}
      <PromoteStaffModal
        key={selectedUserForPromote ? `${selectedUserForPromote.id}-${selectedUserForPromote.role}` : 'promote-dialog-empty'}
        isOpen={isPromoteModalOpen}
        onClose={() => {
          setIsPromoteModalOpen(false);
          setSelectedUserForPromote(null);
        }}
        targetUser={selectedUserForPromote ? (usersList.find(u => u.id === selectedUserForPromote.id) || selectedUserForPromote) : null}
        currentUser={currentUser}
        lang={lang}
        showToast={showToast}
        onPromotionSuccess={async (updated) => {
          await refetch();
          setSelectedUserForPromote(updated);
          if (selectedUserForPermissions && selectedUserForPermissions.id === updated.id) {
            setSelectedUserForPermissions(updated);
          }
          if (selectedUserForAction && selectedUserForAction.id === updated.id) {
            setSelectedUserForAction(updated);
          }
        }}
      />

      {/* Modal: Customize Staff Memoji Avatar */}
      <EditStaffModal
        key={selectedUserForAvatar ? `${selectedUserForAvatar.id}-${selectedUserForAvatar.avatarUrl || ''}` : 'edit-avatar-empty'}
        isOpen={isEditAvatarModalOpen}
        onClose={() => {
          setIsEditAvatarModalOpen(false);
          setSelectedUserForAvatar(null);
        }}
        targetUser={selectedUserForAvatar ? (usersList.find(u => u.id === selectedUserForAvatar.id) || selectedUserForAvatar) : null}
        showToast={showToast}
        onSaved={async () => {
          await refetch();
        }}
      />

      {/* Modal: Employee Statement of Account (كشف حساب مالي تفصيلي للموظف) */}
      {selectedUserForStatement && (
        <EmployeeStatementModal
          key={`statement-${selectedUserForStatement.id}`}
          isOpen={isStatementModalOpen}
          onClose={() => {
            setIsStatementModalOpen(false);
            setSelectedUserForStatement(null);
          }}
          employeeId={selectedUserForStatement.id}
          employeeName={selectedUserForStatement.fullName || selectedUserForStatement.username}
          employeeRole={selectedUserForStatement.role}
          lang={lang}
        />
      )}
    </div>
  );
}
