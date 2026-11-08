import React, { useState, useMemo, useEffect } from 'react';
import { Unlock, Lock, X, AlertTriangle, User } from 'lucide-react';
import { UserProfile } from '../../types/rbac';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { useSettings } from '../../context/settings-context';

export interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (shiftData: { cashierName: string; terminalId: string; openingFloat: number }) => void;
  currentUser?: UserProfile | null;
  lang?: 'en' | 'ar';
}

export default function OpenShiftModal({
  isOpen,
  onClose,
  onConfirm,
  currentUser,
  lang = 'ar'
}: OpenShiftModalProps) {
  const isAr = lang === 'ar';
  const { financialSettings } = useSettings();
  const baseCurrency = financialSettings.baseCurrency;
  const isIqd = baseCurrency.code === 'IQD' || baseCurrency.symbol === 'د.ع';

  const hasShiftPermission = currentUser ? (
    currentUser.role === 'SuperAdmin' || 
    currentUser.role === 'BranchManager' || 
    currentUser.role === 'Cashier' ||
    (currentUser.permissions && currentUser.permissions.includes('shifts.manage')) || 
    (currentUser.permissions && currentUser.permissions.includes('pos.terminal.access'))
  ) : true;

  // Strictly bind cashier identity in the active language - Zero language mixing
  const effectiveCashierName = useMemo(() => {
    if (isAr) {
      const raw = currentUser?.fullName?.trim() || '';
      const userRaw = currentUser?.username?.trim() || '';

      if (raw && raw !== 'a' && !raw.includes('@') && raw.toLowerCase() !== 'admin') {
        return raw;
      }
      if (userRaw && userRaw !== 'a' && !userRaw.includes('@') && userRaw.toLowerCase() !== 'admin') {
        return userRaw;
      }
      if (currentUser?.roleNameAr && currentUser.roleNameAr.trim()) {
        return currentUser.roleNameAr;
      }
      return 'المدير العام';
    } else {
      // English Mode - zero Arabic text allowed
      if (currentUser?.roleNameEn && currentUser.roleNameEn.trim()) {
        return currentUser.roleNameEn;
      }
      if (currentUser?.role && currentUser.role !== 'SuperAdmin') {
        return currentUser.role;
      }
      const raw = currentUser?.fullName?.trim() || '';
      if (raw && !/[\u0600-\u06FF]/.test(raw) && raw !== 'a' && !raw.includes('@') && raw.toLowerCase() !== 'admin') {
        return raw;
      }
      return 'General Manager';
    }
  }, [currentUser, isAr]);

  // Strictly bind branch name in the active language - Zero language mixing
  const effectiveBranchName = useMemo(() => {
    if (isAr) {
      return currentUser?.branchName || 'كافة الفروع والمستودعات';
    } else {
      // English Mode - zero Arabic text allowed
      if (!currentUser?.branchId || currentUser.branchId === 'ALL') {
        return 'All Branches & Warehouses';
      }
      if (currentUser.branchId === 'WH-01') {
        return 'Main Branch & Warehouse';
      }
      return (currentUser as any)?.branchNameEn || 'Main Branch';
    }
  }, [currentUser, isAr]);

  const [terminalId, setTerminalId] = useState(isAr ? 'كاشير 1' : 'POS-01');
  const [openingFloat, setOpeningFloat] = useState<number>(0);

  useEffect(() => {
    setTerminalId(prev => {
      if (prev === 'كاشير 1' && !isAr) return 'POS-01';
      if (prev === 'POS-01' && isAr) return 'كاشير 1';
      return prev;
    });
  }, [isAr]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasShiftPermission) return;
    const finalFloat = isIqd && openingFloat >= 250 
      ? Math.round(openingFloat / 250) * 250 
      : Math.max(0, openingFloat);
    onConfirm({
      cashierName: effectiveCashierName,
      terminalId: terminalId.trim() || (isAr ? 'كاشير 1' : 'POS-01'),
      openingFloat: finalFloat
    });
  };

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent dir={isAr ? 'rtl' : 'ltr'}>
        {/* Header Bar */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div 
              style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '0.5rem',
                backgroundColor: 'var(--secondary)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)',
              }}
            >
              <Unlock size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                {isAr ? 'فتح وردية كاشير جديدة' : 'Open New Cashier Shift'}
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                {isAr ? 'تسجيل الرصيد النقدي وتفعيل نقطة البيع' : 'Record opening cash float & activate POS'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Logged in Employee Status Card */}
        <div 
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--secondary)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>
              {isAr ? 'الموظف المسجل حالياً:' : 'Logged-in Employee:'}
            </span>
            <span 
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.15rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
              {isAr ? 'متصل الآن' : 'Online Now'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div 
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '9999px',
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              <User size={15} />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)' }}>
                {effectiveCashierName}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                {effectiveBranchName}
              </div>
            </div>
          </div>

          {!hasShiftPermission && (
            <div 
              style={{
                marginTop: '0.2rem',
                fontSize: '0.7rem',
                color: 'var(--destructive)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <AlertTriangle size={13} />
              <span>
                {isAr 
                  ? 'تنبيه: هذا الموظف لا يمتلك صلاحية إدارة الورديات أو فتح الصندوق النقدي.' 
                  : 'Alert: This employee lacks cashier shift management permissions.'}
              </span>
            </div>
          )}
        </div>

        {/* Shift Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: 0 }}>
          {/* Field 1: Terminal ID */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
              {isAr ? 'رقم نقطة البيع / الكاشير:' : 'Terminal ID / Counter:'}
            </label>
            <input 
              type="text" 
              required
              value={terminalId}
              onChange={(e) => setTerminalId(e.target.value)}
              placeholder={isAr ? 'كاشير 1' : 'POS-01'}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--card)',
                color: 'var(--foreground)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
                textAlign: isAr ? 'right' : 'left',
              }}
            />
          </div>

          {/* Field 2: Opening Cash Float */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
              {isAr ? 'الرصيد النقدي الافتتاحي في الصندوق (الفكة):' : 'Opening Cash Float:'}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type="number" 
                step={isIqd ? '250' : (baseCurrency.decimals === 0 ? '1' : 'any')}
                min="0"
                placeholder={isIqd ? '0' : (baseCurrency.decimals === 0 ? '0' : '0.00')}
                value={openingFloat === 0 ? '' : openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value === '' ? 0 : Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                style={{
                  width: '100%',
                  paddingTop: '0.6rem',
                  paddingBottom: '0.6rem',
                  paddingInlineStart: '0.75rem',
                  paddingInlineEnd: '3.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--card)',
                  color: 'var(--foreground)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                  textAlign: isAr ? 'right' : 'left',
                }}
              />
              <span 
                style={{
                  position: 'absolute',
                  insetInlineEnd: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--muted-foreground)',
                  backgroundColor: 'var(--secondary)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--border)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {baseCurrency.symbol}
              </span>
            </div>
            <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
              {isAr 
                ? (isIqd ? 'يبدأ رصيد الوردية من 0 أو مضاعفات فئات النقد العراقي (أقل فئة 250 د.ع)' : 'يبدأ رصيد الوردية من الصفر (0) أو الرصيد النقدي المسلم للدرج')
                : 'Shift starts from 0 or cash float given to drawer'}
            </span>
          </div>

          {/* Action Footer Buttons - Guaranteed 100% visible inside modal */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.625rem',
              marginTop: '0.5rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.55rem 1.15rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--secondary)',
                color: 'var(--secondary-foreground)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              id="submit-open-shift-btn"
              disabled={!hasShiftPermission}
              style={{
                padding: '0.55rem 1.35rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: hasShiftPermission ? 'pointer' : 'not-allowed',
                opacity: hasShiftPermission ? 1 : 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
              }}
            >
              <Lock className={`w-4 h-4 ${isAr ? 'ml-2' : 'mr-2'}`} size={16} />
              <span>{isAr ? 'تأكيد فتح الوردية' : 'Confirm & Open Shift'}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  );
}
