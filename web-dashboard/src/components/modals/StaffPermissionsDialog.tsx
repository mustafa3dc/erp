import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Zap,
  ShoppingCart,
  ShoppingBag,
  Package,
  Wallet,
  FileText,
  Search,
  Sparkles,
  RotateCcw,
  Building2,
  Lock,
  Save,
  CheckCheck,
  Award,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import RoleBadge from '../ui/RoleBadge';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { UserAccount, UserProfile, UserRole } from '../../types/rbac';
import {
  PERMISSIONS_MATRIX_GROUPS,
  CASHIER_DEFAULT_PERMISSIONS,
  STOREKEEPER_DEFAULT_PERMISSIONS,
  ACCOUNTANT_DEFAULT_PERMISSIONS,
  BRANCH_MANAGER_DEFAULT_PERMISSIONS,
  ALL_SYSTEM_PERMISSIONS,
  PermissionGroupSection
} from '../../types/auth';
import { updateUserAccount, getStoredUsers } from '../../services/storageService';

export interface StaffPermissionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserAccount | null;
  currentUser: UserProfile;
  lang?: 'ar' | 'en';
  showToast: (message: string) => void;
  onSaveSuccess?: (updatedUser: UserAccount) => void;
  onOpenPromoteModal?: (user: UserAccount) => void;
}

export const StaffPermissionsDialog: React.FC<StaffPermissionsDialogProps> = ({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  lang = 'ar',
  showToast,
  onSaveSuccess,
  onOpenPromoteModal
}) => {
  const isAr = lang === 'ar';

  // Always resolve latest fresh record from persistent storage to eliminate stale cache desync
  const effectiveUser = useMemo(() => {
    if (!targetUser) return null;
    const all = getStoredUsers();
    const fresh = all.find(u => u.id === targetUser.id);
    return fresh || targetUser;
  }, [targetUser, isOpen]);

  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>('all');

  // Role default permissions resolution helper
  const getRoleDefaultPermissions = (role: UserRole): string[] => {
    switch (role) {
      case 'SuperAdmin':
      case 'PlatformSuperAdmin':
        return ALL_SYSTEM_PERMISSIONS;
      case 'BranchManager':
        return BRANCH_MANAGER_DEFAULT_PERMISSIONS;
      case 'Accountant':
        return ACCOUNTANT_DEFAULT_PERMISSIONS;
      case 'Storekeeper':
        return STOREKEEPER_DEFAULT_PERMISSIONS;
      case 'Cashier':
      default:
        return CASHIER_DEFAULT_PERMISSIONS;
    }
  };

  // Synchronize state immediately when effectiveUser or its role/permissions change
  useEffect(() => {
    if (!effectiveUser) return;

    if (effectiveUser.permissions && effectiveUser.permissions.length > 0) {
      setSelectedPermissions(new Set(effectiveUser.permissions));
    } else {
      setSelectedPermissions(new Set(getRoleDefaultPermissions(effectiveUser.role)));
    }
    setSearchTerm('');
  }, [effectiveUser?.id, effectiveUser?.role, effectiveUser?.permissions, isOpen]);

  // Check if target is Root Owner
  const isTargetRootOwner = useMemo(() => {
    if (!effectiveUser) return false;
    return (
      effectiveUser.role === 'SuperAdmin' ||
      effectiveUser.id === 'USR-ADMIN-01' ||
      effectiveUser.username.toLowerCase() === 'admin' ||
      effectiveUser.username.toLowerCase().startsWith('admin@') ||
      effectiveUser.username.toLowerCase() === 'mustafa'
    );
  }, [effectiveUser]);

  // Permissions check for current user modifying target
  const { canEdit, protectionReason } = useMemo(() => {
    if (!effectiveUser) return { canEdit: false, protectionReason: '' };
    
    const isCallerOwner =
      currentUser.role === 'SuperAdmin' ||
      currentUser.role === 'PlatformSuperAdmin' ||
      (currentUser.role as string) === 'Owner' ||
      currentUser.id === 'USR-ADMIN-01' ||
      currentUser.username.toLowerCase() === 'admin' ||
      currentUser.username.toLowerCase() === 'mustafa';

    const isTargetOwner =
      effectiveUser.role === 'SuperAdmin' ||
      effectiveUser.role === 'PlatformSuperAdmin' ||
      (effectiveUser.role as string) === 'Owner' ||
      effectiveUser.id === 'USR-ADMIN-01' ||
      effectiveUser.username.toLowerCase() === 'admin' ||
      effectiveUser.username.toLowerCase().startsWith('admin@') ||
      effectiveUser.username.toLowerCase() === 'mustafa';

    const isSelf = currentUser.id === effectiveUser.id;

    if (isTargetOwner) {
      return { 
        canEdit: false, 
        protectionReason: isAr ? 'حساب المالك محصن بالكامل: يمتلك كافة صلاحيات النظام بشكل دائم ولا يمكن تعديل أو تقييد صلاحياته' : 'Owner account is strictly protected with permanent system-wide permissions' 
      };
    }

    if (isSelf) {
      return { 
        canEdit: false, 
        protectionReason: isAr ? 'قفل التعديل الذاتي: لا يمكنك تعديل صلاحيات حسابك بنفسك' : 'Self-edit lock: You cannot modify your own permissions' 
      };
    }

    if (!isCallerOwner) {
      return { 
        canEdit: false, 
        protectionReason: isAr ? 'تعديل الصلاحيات مقتصر حصراً على المالك والمدير العام' : 'Staff permission modification is strictly restricted to the Owner' 
      };
    }

    return { canEdit: true, protectionReason: '' };
  }, [effectiveUser, currentUser, isAr]);

  // Arabic Role Badge Formatting
  const getRoleBadgeDetails = (role: UserRole) => {
    switch (role) {
      case 'SuperAdmin':
      case 'PlatformSuperAdmin':
        return {
          label: isAr ? 'المدير العام' : 'Super Admin',
          classes: 'bg-slate-900 text-slate-100 dark:bg-slate-800 dark:text-slate-200 border-slate-700'
        };
      case 'BranchManager':
        return {
          label: isAr ? 'مدير الفرع' : 'Branch Manager',
          classes: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20'
        };
      case 'Accountant':
        return {
          label: isAr ? 'المحاسب المالي' : 'Accountant',
          classes: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
        };
      case 'Storekeeper':
        return {
          label: isAr ? 'أمين المخزن' : 'Storekeeper',
          classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
        };
      case 'Cashier':
      default:
        return {
          label: isAr ? 'كاشير مبيعات' : 'Cashier',
          classes: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20'
        };
    }
  };

  // Filter groups and permissions by search term and active group filter
  const filteredGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return PERMISSIONS_MATRIX_GROUPS.map(group => {
      if (activeGroupFilter !== 'all' && group.key !== activeGroupFilter) {
        return { ...group, permissions: [] };
      }

      const matchingPermissions = group.permissions.filter(p => {
        if (!term) return true;
        return (
          p.code.toLowerCase().includes(term) ||
          p.nameAr.toLowerCase().includes(term) ||
          p.nameEn.toLowerCase().includes(term) ||
          p.descriptionAr.toLowerCase().includes(term) ||
          p.descriptionEn.toLowerCase().includes(term)
        );
      });

      return {
        ...group,
        permissions: matchingPermissions
      };
    }).filter(group => group.permissions.length > 0);
  }, [searchTerm, activeGroupFilter]);

  // Toggle single permission
  const handleTogglePermission = (code: string) => {
    if (!canEdit) return;
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  // Toggle all permissions in a section
  const handleToggleGroup = (group: PermissionGroupSection) => {
    if (!canEdit) return;
    const groupCodes = group.permissions.map(p => p.code);
    const allSelected = groupCodes.every(code => selectedPermissions.has(code));

    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (allSelected) {
        groupCodes.forEach(code => next.delete(code));
      } else {
        groupCodes.forEach(code => next.add(code));
      }
      return next;
    });
  };

  // Quick Preset Handlers reading current updated role
  const handleApplyRoleDefaults = () => {
    if (!effectiveUser || !canEdit) return;
    const defaults = getRoleDefaultPermissions(effectiveUser.role);
    setSelectedPermissions(new Set(defaults));
    const roleBadge = getRoleBadgeDetails(effectiveUser.role);
    showToast(
      isAr 
        ? `تم تطبيق الصلاحيات الافتراضية لرتبة (${roleBadge.label}) بنجاح (${defaults.length} صلاحية)` 
        : `Applied default permissions for ${roleBadge.label} (${defaults.length} items)`
    );
  };

  const handleGrantAdminAccess = () => {
    if (!canEdit) return;
    setSelectedPermissions(new Set(ALL_SYSTEM_PERMISSIONS));
    showToast(isAr ? 'تم تفعيل كافة الصلاحيات (Admin Access) بنجاح' : 'All administrative permissions granted');
  };

  const handleClearAll = () => {
    if (!canEdit) return;
    setSelectedPermissions(new Set());
    showToast(isAr ? 'تم إلغاء تحديد كافة الصلاحيات' : 'All permissions cleared');
  };

  // Save Permissions to Persistent Storage & API
  const handleSave = async () => {
    if (!effectiveUser || !canEdit) return;

    setIsSaving(true);
    const permissionsArray = Array.from(selectedPermissions);

    try {
      // 1. Call Backend API endpoint
      const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
      try {
        await fetch(`/api/v1/users/${effectiveUser.id}/permissions`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            permissions: permissionsArray
          })
        });
      } catch {
        // Fallback gracefully for offline/mock environments
      }

      // 2. Persist locally to storage
      const updatedUser: UserAccount = {
        ...effectiveUser,
        permissions: permissionsArray
      };
      updateUserAccount(updatedUser);

      // 3. Update active session profile if updating current user
      if (currentUser.id === effectiveUser.id) {
        try {
          const rawSession = localStorage.getItem('zilox_auth_session');
          if (rawSession) {
            const parsedSession = JSON.parse(rawSession);
            parsedSession.permissions = permissionsArray;
            parsedSession.canViewCostPrice = permissionsArray.includes('inventory.cost_price.view') || effectiveUser.role === 'SuperAdmin';
            localStorage.setItem('zilox_auth_session', JSON.stringify(parsedSession));
          }
        } catch {
          // Ignore parse errors
        }
      }

      showToast(
        isAr
          ? `تم حفظ مصفوفة الصلاحيات للموظف (${effectiveUser.fullName}) بنجاح (${permissionsArray.length} صلاحية)`
          : `Saved ${permissionsArray.length} permissions for ${effectiveUser.fullName}`
      );

      if (onSaveSuccess) {
        onSaveSuccess(updatedUser);
      }

      onClose();
    } catch {
      showToast(isAr ? 'حدث خطأ أثناء حفظ الصلاحيات' : 'Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !effectiveUser) return null;

  const totalPermissionsCount = ALL_SYSTEM_PERMISSIONS.length;
  const activeCount = selectedPermissions.size;
  const roleBadge = getRoleBadgeDetails(effectiveUser.role);
  const cleanUsername = effectiveUser.username.includes('@') 
    ? effectiveUser.username.split('@')[0] 
    : effectiveUser.username;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <DialogContent
          className="w-full max-w-4xl bg-card text-card-foreground border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{
            maxWidth: '920px',
            width: 'min(920px, 95vw)',
            height: 'min(860px, 92vh)',
            maxHeight: '92vh',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            margin: 'auto',
            backgroundColor: 'var(--card, #ffffff)',
            color: 'var(--card-foreground, #0f172a)',
            border: '1px solid var(--border, #e2e8f0)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          }}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {/* Dialog Header */}
          <DialogHeader
            className="p-5 pb-4 border-b border-border bg-muted/30 shrink-0 text-start m-0"
            style={{
              padding: '1.25rem 1.5rem 1rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--muted, #f8fafc)',
              margin: 0,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-xs"
                >
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle
                    className="text-lg font-bold flex items-center gap-2 m-0"
                  >
                    <span>{isAr ? 'مصفوفة الصلاحيات والحماية' : 'Permissions Matrix (PBAC)'}</span>
                    <span
                      dir="ltr"
                      className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full inline-block bg-primary/10 text-primary border border-primary/20"
                    >
                      ({activeCount} / {totalPermissionsCount})
                    </span>
                  </DialogTitle>
                  <DialogDescription
                    className="text-xs text-muted-foreground mt-1"
                  >
                    {isAr
                      ? 'التحكم الدقيق بصلاحيات الموظف على مستوى الوظائف والأزرار والعمليات الحساسة'
                      : 'Fine-tune granular feature switches and access boundaries per staff member'}
                  </DialogDescription>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border transition-colors cursor-pointer"
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Target User Banner with Translated Role & Sanitized Username */}
            <div className="mt-3.5 p-3 rounded-xl bg-background border border-border flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center border border-primary/20 text-sm">
                  {effectiveUser.fullName.trim().slice(0, 1)}
                </div>
                <div>
                  <div className="font-bold text-foreground text-sm flex items-center gap-2" dir="auto">
                    <span>{effectiveUser.fullName}</span>
                    {isTargetRootOwner && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-bold">
                        {isAr ? 'المالك المحمي' : 'Root Owner'}
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                    <code className="text-primary font-mono text-xs font-semibold px-1.5 py-0.2 rounded bg-primary/10 border border-primary/20">
                      {cleanUsername}
                    </code>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Building2 size={12} className="text-muted-foreground" />
                      <span dir="auto">{effectiveUser.branchName || effectiveUser.branchId}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Standardized Unified Role Badge */}
                <RoleBadge role={effectiveUser.role} isAr={isAr} />

                {!isTargetRootOwner && canEdit && onOpenPromoteModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPromoteModal(effectiveUser);
                    }}
                    className="px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors cursor-pointer shadow-xs"
                    title={isAr ? 'ترقية وتعديل رتبة الموظف' : 'Promote Staff Role'}
                  >
                    <Award size={13} />
                    <span>{isAr ? 'ترقية الرتبة' : 'Promote'}</span>
                  </button>
                )}

                {!canEdit && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1">
                    <Lock size={12} />
                    <span>{isAr ? 'محمي / غير قابل للتعديل' : 'Protected'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Protection Security Notice Banner */}
            {!canEdit && protectionReason && (
              <div className="mt-2.5 p-2.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-semibold">
                <Lock size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{protectionReason}</span>
              </div>
            )}
          </DialogHeader>

          {/* Preset Buttons & Quick Filter Toolbar */}
          <div className="p-4 pb-3 border-b border-border bg-card/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Dynamic Presets reading current updated role */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyRoleDefaults}
                disabled={!canEdit}
                className="h-8 text-xs gap-1.5 border-border bg-background hover:bg-muted text-foreground font-semibold shadow-xs"
              >
                <Zap size={13} className="text-amber-500" />
                <span>
                  {isAr 
                    ? `تطبيق صلاحيات (${roleBadge.label}) الافتراضية` 
                    : `Apply Default ${roleBadge.label} Permissions`}
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGrantAdminAccess}
                disabled={!canEdit}
                className="h-8 text-xs gap-1.5 border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-semibold shadow-xs"
              >
                <Sparkles size={13} />
                <span>{isAr ? 'منح كافة الصلاحيات (Admin Access)' : 'Grant Full Admin Access'}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={!canEdit || activeCount === 0}
                className="h-8 text-xs gap-1 border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={12} />
                <span>{isAr ? 'إلغاء التحديد' : 'Clear All'}</span>
              </Button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <Input
                type="text"
                placeholder={isAr ? 'بحث بالاسم أو الكود...' : 'Search permission or code...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 ps-8 pe-3 text-xs bg-background border-border"
              />
            </div>
          </div>

          {/* Section Category Tabs with Horizontal Scrolling */}
          <div 
            className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none shrink-0 text-xs select-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              type="button"
              onClick={() => setActiveGroupFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeGroupFilter === 'all'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {isAr ? 'كافة الأقسام (7)' : 'All Sections (7)'}
            </button>
            {PERMISSIONS_MATRIX_GROUPS.map(group => {
              const groupCodes = group.permissions.map(p => p.code);
              const activeInGroup = groupCodes.filter(c => selectedPermissions.has(c)).length;
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setActiveGroupFilter(group.key)}
                  className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeGroupFilter === group.key
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <span>{isAr ? group.titleAr : group.titleEn}</span>
                  <span
                    dir="ltr"
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold inline-block ${
                      activeGroupFilter === group.key
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    ({activeInGroup} / {groupCodes.length})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Permissions Matrix Cards List with Guaranteed Scroll Bottom Padding */}
          <div
            className="flex-1 overflow-y-auto px-6 py-4 pb-24 space-y-6"
            style={{
              paddingBottom: '6.5rem',
              backgroundColor: 'var(--background, #ffffff)',
            }}
          >
            {filteredGroups.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                {isAr ? 'لم يتم العثور على أي صلاحيات تطابق البحث' : 'No permissions match your search term'}
              </div>
            ) : (
              filteredGroups.map(group => {
                const groupCodes = group.permissions.map(p => p.code);
                const allSelected = groupCodes.length > 0 && groupCodes.every(c => selectedPermissions.has(c));
                const selectedInGroup = group.permissions.filter(p => selectedPermissions.has(p.code)).length;

                return (
                  <div
                    key={group.key}
                    className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden transition-all duration-150"
                  >
                    {/* Card Section Header with Isolated LTR Fraction */}
                    <div
                      className="p-3.5 px-4 bg-muted/40 border-b border-border flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold"
                        >
                          {group.key === 'pos' && <Zap size={14} />}
                          {group.key === 'sales' && <ShoppingCart size={14} />}
                          {group.key === 'purchases' && <ShoppingBag size={14} />}
                          {group.key === 'inventory' && <Package size={14} />}
                          {group.key === 'treasury' && <Wallet size={14} />}
                          {group.key === 'reports' && <FileText size={14} />}
                          {group.key === 'system' && <ShieldCheck size={14} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground m-0 flex items-center gap-2">
                            <span>{isAr ? group.titleAr : group.titleEn}</span>
                            <span
                              dir="ltr"
                              className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full inline-block font-mono border border-border/50"
                            >
                              ({selectedInGroup} / {group.permissions.length})
                            </span>
                          </h4>
                        </div>
                      </div>

                      {/* Quick Select Section All */}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleToggleGroup(group)}
                          className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer bg-transparent border-none"
                        >
                          <CheckCheck size={14} />
                          <span>
                            {allSelected
                              ? (isAr ? 'إلغاء تحديد القسم' : 'Deselect Section')
                              : (isAr ? 'تحديد كافة القسم' : 'Select All in Section')}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Permission Switches List */}
                    <div className="divide-y divide-border/60">
                      {group.permissions.map(perm => {
                        const isChecked = selectedPermissions.has(perm.code);
                        return (
                          <div
                            key={perm.code}
                            onClick={() => handleTogglePermission(perm.code)}
                            className={`p-3.5 px-4 flex items-center justify-between gap-4 transition-colors cursor-pointer select-none ${
                              isChecked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-foreground" dir="auto">
                                  {isAr ? perm.nameAr : perm.nameEn}
                                </span>
                                <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                                  {perm.code}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" dir="auto">
                                {isAr ? perm.descriptionAr : perm.descriptionEn}
                              </p>
                            </div>

                            {/* shadcn Switch */}
                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Switch
                                id={`perm-switch-${perm.code}`}
                                checked={isChecked}
                                onCheckedChange={() => handleTogglePermission(perm.code)}
                                disabled={!canEdit}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Dialog Sticky Footer */}
          <DialogFooter
            className="p-4 px-5 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0 m-0 z-10 shadow-lg"
          >
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <span>{isAr ? 'الصلاحيات الممنوحة للموظف:' : 'Active permissions:'}</span>
              <span dir="ltr" className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded-full inline-block">
                ({activeCount} / {totalPermissionsCount})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
                className="h-9 px-4 text-xs font-medium border-border text-foreground hover:bg-muted"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>

              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !canEdit}
                className="h-9 px-5 text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>{isSaving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ الصلاحيات' : 'Save Changes')}</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export default StaffPermissionsDialog;
