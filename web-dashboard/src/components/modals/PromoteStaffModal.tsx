import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  Zap,
  Package,
  Calculator,
  Building2,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Sparkles,
  ArrowRight
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
import { UserAccount, UserProfile, UserRole } from '../../types/rbac';
import {
  CASHIER_DEFAULT_PERMISSIONS,
  STOREKEEPER_DEFAULT_PERMISSIONS,
  ACCOUNTANT_DEFAULT_PERMISSIONS,
  BRANCH_MANAGER_DEFAULT_PERMISSIONS
} from '../../types/auth';
import { updateUserAccount } from '../../services/storageService';

export interface PromoteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserAccount | null;
  currentUser: UserProfile;
  lang?: 'ar' | 'en';
  showToast: (msg: string) => void;
  onPromotionSuccess: (updatedUser: UserAccount) => void;
}

interface RoleOption {
  role: UserRole;
  titleAr: string;
  titleEn: string;
  badgeAr: string;
  badgeEn: string;
  descAr: string;
  descEn: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  bgGradient: string;
  borderColor: string;
  glowColor: string;
  defaultPermissions: string[];
}

const AVAILABLE_ROLES: RoleOption[] = [
  {
    role: 'Cashier',
    titleAr: 'كاشير مبيعات ونقطة البيع',
    titleEn: 'POS Cashier Specialist',
    badgeAr: 'كاشير مبيعات',
    badgeEn: 'Cashier POS',
    descAr: 'الوصول الحصري لشاشة الكاشير السحابية، فتح وإغلاق ورديات البيع، وإصدار الفواتير وتحصيل المدفوعات النقدية والبنكية.',
    descEn: 'Cloud POS terminal access, register shifts opening/closing, invoice issuance, and payment collection.',
    icon: Zap,
    accentColor: '#2563eb',
    bgGradient: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(59, 130, 246, 0.18))',
    borderColor: 'rgba(37, 99, 235, 0.35)',
    glowColor: 'rgba(37, 99, 235, 0.2)',
    defaultPermissions: CASHIER_DEFAULT_PERMISSIONS
  },
  {
    role: 'Storekeeper',
    titleAr: 'أمين المخزن والمستودعات',
    titleEn: 'Warehouse Custodian & Inventory Specialist',
    badgeAr: 'أمين المخزن',
    badgeEn: 'Storekeeper',
    descAr: 'إدارة مخزون الأصناف، تتبع الكميات والأرفف، أذونات الجرد المخزني، تحويلات البضائع بين الفروع، وتسجيل فواتير المشتريات.',
    descEn: 'Item catalog custody, bin allocation, stock-taking counts, inter-branch transfers, and vendor bill reception.',
    icon: Package,
    accentColor: '#d97706',
    bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(217, 119, 6, 0.2))',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    glowColor: 'rgba(245, 158, 11, 0.2)',
    defaultPermissions: STOREKEEPER_DEFAULT_PERMISSIONS
  },
  {
    role: 'Accountant',
    titleAr: 'المحاسب المالي والخزينة',
    titleEn: 'Financial Accountant & Ledger Auditor',
    badgeAr: 'المحاسب المالي',
    badgeEn: 'Accountant',
    descAr: 'إدارة القيود اليومية والأستاذ العام، كشف أسعار التكلفة والأرباح، حركة الخزائن والحسابات البنكية، واعتماد فواتير الآجل والذمم.',
    descEn: 'Journal entries, general ledger inspection, cost price visibility, treasury cash flow, and credit approvals.',
    icon: Calculator,
    accentColor: '#059669',
    bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(5, 150, 105, 0.2))',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    glowColor: 'rgba(16, 185, 129, 0.2)',
    defaultPermissions: ACCOUNTANT_DEFAULT_PERMISSIONS
  },
  {
    role: 'BranchManager',
    titleAr: 'مدير الفرع والإشراف العام',
    titleEn: 'Branch Operations General Manager',
    badgeAr: 'مدير الفرع',
    badgeEn: 'Branch Manager',
    descAr: 'الإشراف الإداري والتشغيلي الشامل على موظفي الفرع، اعتماد الخصومات وتجاوز الأسعار، متابعة تقارير المبيعات والأداء المباشر.',
    descEn: 'Comprehensive branch operational management, cashier supervision, discount override approval, and executive reporting.',
    icon: Building2,
    accentColor: '#0284c7',
    bgGradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.14), rgba(14, 165, 233, 0.2))',
    borderColor: 'rgba(14, 165, 233, 0.4)',
    glowColor: 'rgba(14, 165, 233, 0.2)',
    defaultPermissions: BRANCH_MANAGER_DEFAULT_PERMISSIONS
  }
];

export const PromoteStaffModal: React.FC<PromoteStaffModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  lang = 'ar',
  showToast,
  onPromotionSuccess
}) => {
  const isAr = lang === 'ar';
  const [selectedRole, setSelectedRole] = useState<UserRole>(targetUser?.role || 'Cashier');
  const [autoApplyPermissions, setAutoApplyPermissions] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync selected role when target user changes
  React.useEffect(() => {
    if (targetUser) {
      setSelectedRole(targetUser.role);
    }
  }, [targetUser, isOpen]);

  if (!isOpen || !targetUser) return null;

  const isRootOwner =
    targetUser.role === 'SuperAdmin' ||
    targetUser.id === 'USR-ADMIN-01' ||
    targetUser.username.toLowerCase() === 'admin';

  const isCallerSuperAdmin =
    currentUser.role === 'SuperAdmin' ||
    currentUser.role === 'PlatformSuperAdmin' ||
    currentUser.id === 'USR-ADMIN-01';

  // Subordinates cannot promote anyone higher than themselves
  const canPromote = isCallerSuperAdmin || currentUser.role === 'BranchManager';

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !canPromote) return;

    if (isRootOwner) {
      showToast(isAr ? 'حساب المالك الرئيسي محمي كلياً ولا يمكن تعديل رتبته' : 'Root Owner role cannot be modified');
      return;
    }

    if (selectedRole === targetUser.role) {
      showToast(isAr ? 'الموظف يشغل هذه الرتبة بالفعل، يرجى اختيار رتبة مختلفة' : 'Staff member already holds this role');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Determine new permissions
      let nextPermissions = targetUser.permissions || [];
      const roleConfig = AVAILABLE_ROLES.find(r => r.role === selectedRole);

      if (autoApplyPermissions && roleConfig) {
        nextPermissions = roleConfig.defaultPermissions;
      }

      const updatedUser: UserAccount = {
        ...targetUser,
        role: selectedRole,
        permissions: nextPermissions
      };

      // 2. Persist locally to storage
      updateUserAccount(updatedUser);

      // 3. Call backend API if authenticated
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
        if (token) {
          await fetch(`/api/v1/users/${targetUser.id}/permissions`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ permissions: nextPermissions })
          });
        }
      } catch {
        // Backend failure fallback
      }

      // 4. Update session profile if promoting current user
      if (currentUser.id === targetUser.id) {
        try {
          const rawSession = localStorage.getItem('zilox_auth_session');
          if (rawSession) {
            const parsed = JSON.parse(rawSession);
            parsed.role = selectedRole;
            parsed.permissions = nextPermissions;
            parsed.canViewCostPrice = nextPermissions.includes('inventory.cost_price.view') || selectedRole === 'SuperAdmin';
            localStorage.setItem('zilox_auth_session', JSON.stringify(parsed));
          }
        } catch {
          // Ignore parse errors
        }
      }

      const promotedRoleLabel = isAr
        ? roleConfig?.titleAr || selectedRole
        : roleConfig?.titleEn || selectedRole;

      showToast(
        isAr
          ? `تمت ترقية الموظف (${targetUser.fullName}) إلى [${promotedRoleLabel}] بنجاح!`
          : `Successfully promoted ${targetUser.fullName} to [${promotedRoleLabel}]!`
      );

      onPromotionSuccess(updatedUser);
      onClose();
    } catch {
      showToast(isAr ? 'حدث خطأ أثناء حفظ الترقية' : 'Failed to update staff role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRoleConfig = AVAILABLE_ROLES.find(r => r.role === targetUser.role);
  const cleanUsername = targetUser.username.includes('@') ? targetUser.username.split('@')[0] : targetUser.username;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
          onClick={onClose}
        />
        <DialogContent
          className="w-full max-w-2xl bg-card text-card-foreground border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{
            maxWidth: '680px',
            width: 'min(680px, 95vw)',
            maxHeight: '88vh',
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
          {/* Header */}
          <DialogHeader
            className="p-5 pb-4 border-b border-border bg-muted/30 shrink-0 text-start m-0"
            style={{
              padding: '1.25rem 1.5rem 1rem 1.5rem',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              backgroundColor: 'var(--muted, #f8fafc)',
              margin: 0,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                  style={{
                    backgroundColor: 'rgba(124, 58, 237, 0.12)',
                    color: '#7c3aed',
                    border: '1px solid rgba(124, 58, 237, 0.25)',
                  }}
                >
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle
                    className="text-lg font-bold flex items-center gap-2 m-0"
                    style={{
                      color: 'var(--foreground, #0f172a)',
                      fontSize: '1.15rem',
                      fontWeight: 800,
                    }}
                  >
                    <span>{isAr ? 'ترقية وتعديل رتبة الموظف' : 'Promote Staff & Role Assignment'}</span>
                  </DialogTitle>
                  <DialogDescription
                    className="text-xs text-muted-foreground mt-1"
                    style={{
                      color: 'var(--muted-foreground, #64748b)',
                      fontSize: '0.8rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    {isAr
                      ? 'ترقية الموظف إلى صنف أو رتبة أعلى وتحديث مسؤوليته وحزمة صلاحياته المعتمدة'
                      : 'Elevate staff member responsibilities, assigned role, and associated permissions package'}
                  </DialogDescription>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border transition-colors cursor-pointer"
                style={{
                  background: 'transparent',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  borderRadius: '0.5rem',
                }}
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Target User Info Banner */}
            <div
              className="mt-3.5 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs"
              style={{
                backgroundColor: 'var(--background, #ffffff)',
                borderColor: 'var(--border, #e2e8f0)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl font-bold flex items-center justify-center text-sm shadow-xs"
                  style={{
                    background: currentRoleConfig?.bgGradient || 'rgba(59,130,246,0.15)',
                    color: currentRoleConfig?.accentColor || '#2563eb',
                    border: `1px solid ${currentRoleConfig?.borderColor || 'rgba(59,130,246,0.3)'}`,
                  }}
                >
                  {targetUser.fullName.slice(0, 1)}
                </div>
                <div>
                  <div className="font-bold text-foreground text-sm flex items-center gap-2" dir="auto">
                    {targetUser.fullName}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 mt-0.5 font-mono text-[11px]">
                    <span style={{ color: 'var(--primary, #0284c7)', fontWeight: 600 }}>{cleanUsername}</span>
                    <span>•</span>
                    <span dir="auto">{targetUser.branchName || targetUser.branchId}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{isAr ? 'الرتبة الحالية:' : 'Current Role:'}</span>
                <span
                  className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  style={{
                    background: currentRoleConfig?.bgGradient || 'rgba(59,130,246,0.12)',
                    color: currentRoleConfig?.accentColor || '#2563eb',
                    border: `1px solid ${currentRoleConfig?.borderColor || 'rgba(59,130,246,0.3)'}`,
                  }}
                >
                  {currentRoleConfig?.icon && <currentRoleConfig.icon size={13} />}
                  <span>{isAr ? currentRoleConfig?.badgeAr : currentRoleConfig?.badgeEn}</span>
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* Body: Select New Role */}
          <form onSubmit={handlePromoteSubmit} className="flex-1 flex flex-col overflow-hidden m-0">
            <div
              className="flex-1 overflow-y-auto p-5 space-y-3"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem 1.5rem',
                backgroundColor: 'var(--background, #ffffff)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider m-0">
                  {isAr ? 'اختر الرتبة الجديدة للترقية:' : 'Select New Staff Role / Rank:'}
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {isAr ? 'انقر على البطاقة لتحديد الدور الجديد' : 'Click a card to select the new role'}
                </span>
              </div>

              {/* Roles Cards Grid */}
              <div className="grid grid-cols-1 gap-2.5">
                {AVAILABLE_ROLES.map((roleOpt) => {
                  const isSelected = selectedRole === roleOpt.role;
                  const isCurrent = targetUser.role === roleOpt.role;
                  const IconComp = roleOpt.icon;

                  return (
                    <div
                      key={roleOpt.role}
                      onClick={() => setSelectedRole(roleOpt.role)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'shadow-sm ring-2 ring-primary/40'
                          : 'hover:border-foreground/20 hover:bg-muted/20'
                      }`}
                      style={{
                        backgroundColor: isSelected ? 'var(--card, #ffffff)' : 'var(--background, #ffffff)',
                        borderColor: isSelected ? roleOpt.accentColor : 'var(--border, #e2e8f0)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out',
                      }}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Role Icon */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-transform"
                          style={{
                            background: roleOpt.bgGradient,
                            color: roleOpt.accentColor,
                            border: `1px solid ${roleOpt.borderColor}`,
                            boxShadow: isSelected ? `0 4px 12px ${roleOpt.glowColor}` : 'none',
                          }}
                        >
                          <IconComp size={20} />
                        </div>

                        {/* Role Information */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground" dir="auto">
                                {isAr ? roleOpt.titleAr : roleOpt.titleEn}
                              </span>
                              {isCurrent && (
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                  style={{
                                    backgroundColor: 'rgba(100, 116, 139, 0.12)',
                                    color: '#64748b',
                                    border: '1px solid rgba(100, 116, 139, 0.25)',
                                  }}
                                >
                                  {isAr ? 'الرتبة الحالية' : 'Current Role'}
                                </span>
                              )}
                            </div>

                            {/* Selection Radio Circle */}
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all"
                              style={{
                                border: `2px solid ${isSelected ? roleOpt.accentColor : 'var(--border, #cbd5e1)'}`,
                                backgroundColor: isSelected ? roleOpt.accentColor : 'transparent',
                              }}
                            >
                              {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed" dir="auto">
                            {isAr ? roleOpt.descAr : roleOpt.descEn}
                          </p>

                          {/* Default Permissions Preview Pill */}
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Sparkles size={12} style={{ color: roleOpt.accentColor }} />
                            <span>
                              {isAr
                                ? `حزمة الصلاحيات القياسية: ${roleOpt.defaultPermissions.length} صلاحية معتمدة`
                                : `Standard Package: ${roleOpt.defaultPermissions.length} preset permissions`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Automatic Permissions Update Checkbox Card */}
              <div
                className="mt-4 p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer select-none transition-colors"
                style={{
                  backgroundColor: autoApplyPermissions ? 'rgba(59, 130, 246, 0.04)' : 'var(--muted, #f8fafc)',
                  borderColor: autoApplyPermissions ? 'rgba(59, 130, 246, 0.3)' : 'var(--border, #e2e8f0)',
                }}
                onClick={() => setAutoApplyPermissions(!autoApplyPermissions)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all cursor-pointer"
                    style={{
                      backgroundColor: autoApplyPermissions ? 'var(--primary, #0284c7)' : 'transparent',
                      border: `1.5px solid ${autoApplyPermissions ? 'var(--primary, #0284c7)' : 'var(--border, #94a3b8)'}`,
                    }}
                  >
                    {autoApplyPermissions && <Check size={13} color="#ffffff" strokeWidth={3} />}
                  </div>
                  <div>
                    <strong className="text-xs font-bold text-foreground block">
                      {isAr
                        ? 'تحديث مصفوفة الصلاحيات تلقائياً لتناسب الرتبة الجديدة (مستحسن)'
                        : 'Auto-apply default permissions for the new role (Recommended)'}
                    </strong>
                    <small className="text-[11px] text-muted-foreground block mt-0.5">
                      {isAr
                        ? 'تطبيق صلاحيات الرتبة الجديدة فوراً وإلغاء القيود القديمة، مع إمكانية التخصيص اليدوي في أي وقت.'
                        : 'Instantly grants standard role permissions and updates access limits.'}
                    </small>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter
              className="p-4 px-5 border-t border-border bg-muted/40 flex items-center justify-between gap-3 shrink-0 m-0"
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border, #e2e8f0)',
                backgroundColor: 'var(--muted, #f8fafc)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div className="text-xs text-muted-foreground font-medium">
                {selectedRole !== targetUser.role ? (
                  <span className="flex items-center gap-1.5 text-foreground font-semibold">
                    <span>{targetUser.role}</span>
                    <ArrowRight size={13} className="rtl:rotate-180 text-primary" />
                    <span style={{ color: 'var(--primary, #0284c7)' }}>{selectedRole}</span>
                  </span>
                ) : (
                  <span>{isAr ? 'لم يتم تغيير الرتبة بعد' : 'No role change selected'}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="h-9 px-4 text-xs font-medium border-border text-foreground hover:bg-muted"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting || selectedRole === targetUser.role}
                  className="h-9 px-5 text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 flex items-center gap-1.5"
                >
                  <Award size={14} />
                  <span>
                    {isSubmitting
                      ? (isAr ? 'جارٍ الترقية...' : 'Promoting...')
                      : (isAr ? 'تأكيد الترقية وتعديل الرتبة' : 'Confirm Promotion')}
                  </span>
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export default PromoteStaffModal;
