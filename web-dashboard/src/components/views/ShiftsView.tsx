import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  DollarSign, 
  Lock, 
  Unlock,
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  Receipt, 
  CreditCard, 
  Banknote, 
  UserCheck, 
  Plus,
  X,
  Smartphone,
  Check,
  User,
  Calculator,
  Coins,
  RotateCcw
} from 'lucide-react';
import { useSettings } from '../../context/settings-context';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { 
  ActiveShift, 
  getStoredActiveShift, 
  saveStoredActiveShift, 
  getStoredPastShifts, 
  saveStoredPastShifts 
} from '../../services/storageService';
import { formatMovementDate } from '../../utils/dateFormatter';

import { UserProfile } from '../../types/rbac';
import OpenShiftModal from '../modals/OpenShiftModal';
import { getCurrencyDecimals } from '../../lib/currencyUtils';

export const IQD_DENOMINATIONS = [
  { value: 50000, labelAr: '50,000 د.ع', labelEn: '50,000 IQD', nameAr: 'خمسون ألف دينار', color: '#16a34a' },
  { value: 25000, labelAr: '25,000 د.ع', labelEn: '25,000 IQD', nameAr: 'خمسة وعشرون ألف دينار', color: '#dc2626' },
  { value: 10000, labelAr: '10,000 د.ع', labelEn: '10,000 IQD', nameAr: 'عشرة آلاف دينار', color: '#2563eb' },
  { value: 5000,  labelAr: '5,000 د.ع',  labelEn: '5,000 IQD',  nameAr: 'خمسة آلاف دينار', color: '#9333ea' },
  { value: 1000,  labelAr: '1,000 د.ع',  labelEn: '1,000 IQD',  nameAr: 'ألف دينار', color: '#d97706' },
  { value: 500,   labelAr: '500 د.ع',    labelEn: '500 IQD',    nameAr: 'خمسمائة دينار', color: '#0891b2' },
  { value: 250,   labelAr: '250 د.ع',    labelEn: '250 IQD',    nameAr: 'مائتان وخمسون دينار', color: '#4b5563' },
];

export interface ShiftRecord {
  id: string;
  zReportNumber: string;
  cashierName: string;
  terminalId: string;
  startTime: string;
  endTime: string;
  openingFloat: number;
  cashSales: number;
  cardSales: number;
  zainCashSales?: number;
  qiCardSales?: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  status: 'CLOSED' | 'ACTIVE';
}

interface ShiftsViewProps {
  lang: 'en' | 'ar';
  currentUser?: UserProfile | null;
}

export default function ShiftsView({ lang, currentUser }: ShiftsViewProps) {
  const isAr = lang === 'ar';
  const { settings, formatMoney, currencySymbol } = useSettings();
  const isIraqTenant = (settings.tenantCountryCode === 'IQ');
  const baseCurrencyCode = settings?.baseCurrency || (isIraqTenant ? 'IQD' : 'USD');
  const isIqd = (baseCurrencyCode === 'IQD');
  const decimals = getCurrencyDecimals(baseCurrencyCode);
  const effectiveCurrencySymbol = currencySymbol || (isIqd ? (isAr ? 'د.ع' : 'IQD') : '$');

  const formatShiftMoney = (val: number) => {
    return formatMoney(val);
  };

  // Permission & Role Check
  const hasShiftPermission = currentUser ? (
    currentUser.role === 'SuperAdmin' || 
    currentUser.role === 'BranchManager' || 
    currentUser.role === 'Cashier' ||
    (currentUser.permissions && currentUser.permissions.includes('shifts.manage')) || 
    (currentUser.permissions && currentUser.permissions.includes('pos.terminal.access'))
  ) : true;

  const isManagerOrAdmin = currentUser ? (
    currentUser.role === 'SuperAdmin' || currentUser.role === 'BranchManager'
  ) : false;

  const [activeShift, setActiveShift] = useState<ActiveShift | null>(() => getStoredActiveShift());
  const [pastShifts, setPastShifts] = useState<ShiftRecord[]>(() => {
    const stored = getStoredPastShifts();
    const clean = stored.filter(s => s.id !== 'SH-8901' && s.cashierName !== 'أحمد حيدر الموسوي');
    if (clean.length !== stored.length) {
      saveStoredPastShifts(clean);
    }
    return clean;
  });

  // Strictly bind cashier identity to authenticated session (never dummy "a" or "admin@a")
  const effectiveCashierName = useMemo(() => {
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
    return isAr ? 'المدير العام' : 'General Manager';
  }, [currentUser, isAr]);

  // Open Shift Modal State (Starts from 0 and binds to logged-in user)
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [newTerminalId, setNewTerminalId] = useState(isAr ? 'كاشير 1' : 'POS-01');
  const [newOpeningFloat, setNewOpeningFloat] = useState<number>(0);

  // Close Shift Verification State
  const [countedCash, setCountedCash] = useState<string>('0');
  const [showCloseShiftModal, setShowCloseShiftModal] = useState<boolean>(false);
  const [showZReportModal, setShowZReportModal] = useState<boolean>(false);
  const [currentZReport, setCurrentZReport] = useState<ShiftRecord | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // Iraqi Denominations Banknote Counter State
  const [showDenomCalculator, setShowDenomCalculator] = useState<boolean>(false);
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({
    50000: 0,
    25000: 0,
    10000: 0,
    5000: 0,
    1000: 0,
    500: 0,
    250: 0
  });

  // Re-sync with active shift from localStorage if changed
  useEffect(() => {
    const handleStorageChange = () => {
      setActiveShift(getStoredActiveShift());
    };
    window.addEventListener('erp_active_shift_updated', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('erp_active_shift_updated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const rawExpectedCash = activeShift 
    ? activeShift.openingFloat + activeShift.cashSales - (activeShift.refunds || 0) - (activeShift.expenses || 0)
    : 0;
  // Strictly enforce 250 IQD cash rounding rule: in physical Iraqi Dinars, no single-dinar notes exist
  const expectedCash = isIqd ? Math.round(rawExpectedCash / 250) * 250 : rawExpectedCash;
  const countedNum = parseFloat(countedCash) || 0;
  const discrepancy = countedNum - expectedCash;

  const handleDenomChange = (val: number, count: number) => {
    const safeCount = Math.max(0, Math.floor(count) || 0);
    const updated = { ...denomCounts, [val]: safeCount };
    setDenomCounts(updated);
    const total = Object.entries(updated).reduce((sum, [dVal, cnt]) => sum + (Number(dVal) * cnt), 0);
    setCountedCash(total.toString());
  };

  const handleResetDenomCounts = () => {
    setDenomCounts({
      50000: 0,
      25000: 0,
      10000: 0,
      5000: 0,
      1000: 0,
      500: 0,
      250: 0
    });
    setCountedCash('0');
  };

  const handleMatchExpected = () => {
    if (isIqd) {
      let remaining = expectedCash;
      const newCounts: Record<number, number> = {
        50000: 0, 25000: 0, 10000: 0, 5000: 0, 1000: 0, 500: 0, 250: 0
      };
      for (const item of IQD_DENOMINATIONS) {
        if (remaining >= item.value) {
          const count = Math.floor(remaining / item.value);
          newCounts[item.value] = count;
          remaining = remaining % item.value;
        }
      }
      setDenomCounts(newCounts);
      setCountedCash(Math.round(expectedCash).toString());
    } else {
      setCountedCash(decimals === 0 ? Math.round(expectedCash).toString() : expectedCash.toFixed(decimals));
    }
  };

  // Handle Open New Shift
  const handleStartShift = (e: React.FormEvent) => {
    e.preventDefault();
    const finalFloat = isIqd && newOpeningFloat >= 250 
      ? Math.round(newOpeningFloat / 250) * 250 
      : Math.max(0, newOpeningFloat);

    const newShift: ActiveShift = {
      id: `SH-${Date.now().toString().slice(-4)}`,
      cashierName: effectiveCashierName,
      terminalId: newTerminalId.trim() || 'POS-01',
      startTime: formatMovementDate(new Date()),
      openingFloat: finalFloat,
      cashSales: 0.00,
      cardSales: 0.00,
      zainCashSales: 0.00,
      qiCardSales: 0.00,
      refunds: 0.00,
      status: 'ACTIVE'
    };

    saveStoredActiveShift(newShift);
    setActiveShift(newShift);
    setIsOpenShiftModalOpen(false);
    showToast(isAr ? 'تم فتح الوردية بنجاح وتفعيل عمليات نقطة البيع!' : 'Shift opened & POS checkout activated!');
  };

  // Handle Confirm Close Shift and Generate Z-Report
  const handleConfirmCloseShift = () => {
    if (!activeShift) return;

    const zReport: ShiftRecord = {
      id: activeShift.id,
      zReportNumber: `Z-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      cashierName: activeShift.cashierName,
      terminalId: activeShift.terminalId,
      startTime: activeShift.startTime,
      endTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      openingFloat: activeShift.openingFloat,
      cashSales: isIqd ? Math.round(activeShift.cashSales / 250) * 250 : activeShift.cashSales,
      cardSales: activeShift.cardSales,
      zainCashSales: activeShift.zainCashSales,
      qiCardSales: activeShift.qiCardSales,
      expectedCash: expectedCash,
      actualCash: countedNum,
      difference: discrepancy,
      status: 'CLOSED'
    };

    // Close and clear active shift
    saveStoredActiveShift(null);
    setActiveShift(null);

    // Save to historical archive
    const updatedPast = [zReport, ...pastShifts];
    setPastShifts(updatedPast);
    saveStoredPastShifts(updatedPast);

    setCurrentZReport(zReport);
    setShowCloseShiftModal(false);
    setShowZReportModal(true);

    showToast(isAr ? 'تم إغلاق الوردية، وقفل عمليات البيع، وتوليد تقرير Z-Report بنجاح!' : 'Shift closed, sales locked & Z-Report generated!');
  };

  return (
    <div className="view-content-wrapper fade-in" style={{ paddingBottom: '3rem' }}>
      {toastMsg && (
        <div 
          className="toast-banner glass-panel" 
          style={{ 
            position: 'fixed', 
            bottom: '24px', 
            left: '24px', 
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            borderRadius: '12px',
            backgroundColor: '#064e3b',
            color: '#ecfdf5',
            fontWeight: 700
          }}
        >
          <CheckCircle2 size={16} color="#34d399" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Module Context Header */}
      <div className="module-header-clean" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="module-context-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} style={{ color: 'var(--primary)' }} />
            <h2 className="view-title" style={{ margin: 0 }}>
              {isAr ? 'إدارة الورديات وإغلاق الصناديق (Z-Report)' : 'Shift Management & Cash Drawer'}
            </h2>
          </div>
          <p className="view-subtitle" style={{ margin: '4px 0 0' }}>
            {isAr 
              ? 'تسجيل العهد النقدية الافتتاحية، مطابقة مبيعات الكاش والبطاقات، وإصدار تقارير الإغلاق المالي اليومي' 
              : 'Cash drawer floats, tender reconciliations, and fiscal Z-Report closures'}
          </p>
        </div>

        <div className="module-actions-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeShift ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
              <span>{isAr ? 'الوردية الحالية: نشطة ومفتوحة' : 'Current Shift: Active'}</span>
            </span>
          ) : (
            <button
              type="button"
              id="open-shift-top-btn"
              onClick={() => setIsOpenShiftModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'var(--primary, #0284c7)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Unlock size={16} />
              <span>{isAr ? 'فتح وردية كاشير جديدة' : 'Open New Shift'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ACTIVE SHIFT SECTION */}
      {activeShift ? (
        <div style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '24px', background: 'var(--card, #ffffff)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <UserCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--foreground)' }}>{activeShift.cashierName}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {activeShift.terminalId} • {isAr ? 'بدأت في:' : 'Started at:'} {activeShift.startTime}
                </span>
              </div>
            </div>

            <button 
              type="button"
              id="open-close-shift-dialog-btn"
              onClick={() => {
                setCountedCash(decimals === 0 ? Math.round(expectedCash).toString() : expectedCash.toFixed(decimals));
                setShowCloseShiftModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
              }}
            >
              <Lock size={16} />
              <span>{isAr ? 'إغلاق الوردية وتوليد Z-Report' : 'Close Shift & Z-Report'}</span>
            </button>
          </div>

          {/* Live Shift Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--muted, #f8fafc)', border: '1px solid var(--border)', padding: '14px', borderRadius: '10px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'العهدة الافتتاحية (Float):' : 'Opening Float:'}</span>
              <h4 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'monospace' }}>
                {formatShiftMoney(activeShift.openingFloat)}
              </h4>
            </div>

            <div style={{ background: 'var(--muted, #f8fafc)', border: '1px solid var(--border)', padding: '14px', borderRadius: '10px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'المبيعات النقدية (Cash):' : 'Cash Sales:'}</span>
              <h4 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                +{formatShiftMoney(activeShift.cashSales)}
              </h4>
            </div>

            <div style={{ background: 'var(--muted, #f8fafc)', border: '1px solid var(--border)', padding: '14px', borderRadius: '10px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'مبيعات البطاقات (Card):' : 'Card Payments:'}</span>
              <h4 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                +{formatShiftMoney(activeShift.cardSales)}
              </h4>
            </div>

            {/* Regional Iraqi Tenders */}
            {isIraqTenant && (
              <div style={{ background: 'rgba(219, 39, 119, 0.08)', border: '1px solid rgba(219, 39, 119, 0.25)', padding: '14px', borderRadius: '10px' }}>
                <span style={{ fontSize: '12px', color: '#be185d', fontWeight: 700 }}>{isAr ? 'محفظة زين كاش:' : 'ZainCash:'}</span>
                <h4 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 800, color: '#9d174d', fontFamily: 'monospace' }}>
                  +{formatShiftMoney(activeShift.zainCashSales || 0)}
                </h4>
              </div>
            )}

            {isIraqTenant && (
              <div style={{ background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.25)', padding: '14px', borderRadius: '10px' }}>
                <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 700 }}>{isAr ? 'مدفوعات كي كارد:' : 'Qi Card:'}</span>
                <h4 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 800, color: '#92400e', fontFamily: 'monospace' }}>
                  +{formatShiftMoney(activeShift.qiCardSales || 0)}
                </h4>
              </div>
            )}

            {Boolean(activeShift.expenses && activeShift.expenses > 0) && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '14px', borderRadius: '10px' }}>
                <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>{isAr ? 'مصروفات نثرية مسجلة:' : 'Petty Expenses:'}</span>
                <h4 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                  -{formatShiftMoney(activeShift.expenses || 0)}
                </h4>
              </div>
            )}

            <div style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)', padding: '14px', borderRadius: '10px' }}>
              <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: 700 }}>{isAr ? 'النقد الدفتري المتوقع بالدرج:' : 'Expected in Drawer:'}</span>
              <h4 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                {formatShiftMoney(expectedCash)}
              </h4>
            </div>
          </div>
        </div>
      ) : (
        /* NO ACTIVE SHIFT PROMPT CARD */
        <div 
          style={{ 
            padding: '36px 24px', 
            borderRadius: '16px', 
            border: '2px dashed var(--border)', 
            marginBottom: '24px', 
            background: 'var(--card, #ffffff)', 
            textAlign: 'center' 
          }}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Lock size={28} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800, color: 'var(--foreground)' }}>
            {isAr ? 'لا توجد وردية كاشير مفتوحة حالياً' : 'No Active Cashier Shift Currently Running'}
          </h3>
          <p style={{ margin: '0 auto 18px', fontSize: '13px', color: '#64748b', maxWidth: '520px' }}>
            {isAr 
              ? 'عمليات البيع وإصدار الفواتير بنقاط البيع مغلقة تلقائياً حتى يقوم الكاشير بتسجيل الرصيد النقدي الافتتاحي (الفكة) وبدء الوردية.' 
              : 'POS terminal sales are locked until a cashier logs the opening cash float and starts a new fiscal shift.'}
          </p>
          <button
            type="button"
            id="start-shift-btn"
            onClick={() => setIsOpenShiftModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '10px',
              background: 'var(--primary, #0284c7)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
            }}
          >
            <Unlock size={18} />
            <span>{isAr ? 'فتح وردية جديدة وبدء العهدة' : 'Open Shift & Float'}</span>
          </button>
        </div>
      )}

      {/* Past Shifts Z-Reports Table */}
      <div className="transactions-table-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--foreground)' }}>
            {isAr ? 'أرشيف تقارير الإغلاق السابقة (Z-Reports History)' : 'Previous Z-Reports Archive'}
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {pastShifts.length} {isAr ? 'تقارير معتمدة' : 'closed reports'}
          </span>
        </div>

        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="custom-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
            <thead>
              <tr style={{ background: 'var(--muted, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{isAr ? 'رقم التقرير' : 'Z-Report #'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{isAr ? 'الكاشير' : 'Cashier'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{isAr ? 'نقطة البيع' : 'Terminal'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{isAr ? 'تاريخ ووقت الإغلاق' : 'Close Timestamp'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{isAr ? 'مبيعات الكاش' : 'Cash Sales'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{isAr ? 'مبيعات البطاقات' : 'Card Sales'}</th>
                {isIraqTenant && <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{isAr ? 'زين كاش / كي كارد' : 'ZainCash / Qi'}</th>}
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{isAr ? 'الفارق (عجز/فائض)' : 'Variance'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {pastShifts.length === 0 ? (
                <tr>
                  <td colSpan={isIraqTenant ? 9 : 8} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Clock size={28} style={{ color: '#94a3b8', strokeWidth: 1.5 }} />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>
                        {isAr ? 'لا توجد تقارير ورديات سابقة مغلقة' : 'No closed shift reports recorded'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pastShifts.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{s.zReportNumber}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--foreground)', fontWeight: 600 }}>{s.cashierName}</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#64748b' }}>{s.terminalId}</td>
                  <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>{s.endTime}</td>
                  <td style={{ padding: '12px 14px', color: '#059669', fontWeight: 700, fontFamily: 'monospace' }}>+{formatShiftMoney(s.cashSales)}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--primary)', fontWeight: 700, fontFamily: 'monospace' }}>+{formatShiftMoney(s.cardSales)}</td>
                  {isIraqTenant && (
                    <td style={{ padding: '12px 14px', fontSize: '12px', fontFamily: 'monospace' }}>
                      <span style={{ color: '#be185d', fontWeight: 700 }}>{formatShiftMoney(s.zainCashSales || 0)}</span> / <span style={{ color: '#b45309', fontWeight: 700 }}>{formatShiftMoney(s.qiCardSales || 0)}</span>
                    </td>
                  )}
                  <td style={{ padding: '12px 14px', fontWeight: 800, color: s.difference === 0 ? '#059669' : '#dc2626', fontFamily: 'monospace' }}>
                    {s.difference === 0 ? formatShiftMoney(0) : (s.difference > 0 ? `+${formatShiftMoney(s.difference)}` : `-${formatShiftMoney(Math.abs(s.difference))}`)}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                      {isAr ? 'مغلقة ومعتمدة' : 'Audited'}
                    </span>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. MODAL: OPEN NEW SHIFT VIA DIALOGPORTAL */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        currentUser={currentUser}
        lang={lang}
        onConfirm={({ cashierName, terminalId, openingFloat }) => {
          const newShift: ActiveShift = {
            id: `SH-${Date.now().toString().slice(-4)}`,
            cashierName,
            terminalId,
            startTime: formatMovementDate(new Date()),
            openingFloat,
            cashSales: 0,
            cardSales: 0,
            zainCashSales: 0,
            qiCardSales: 0,
            refunds: 0,
            status: 'ACTIVE'
          };
          saveStoredActiveShift(newShift);
          setActiveShift(newShift);
          setIsOpenShiftModalOpen(false);
        }}
      />

      {/* 2. MODAL: CLOSE SHIFT CASH COUNT VERIFICATION */}
      {showCloseShiftModal && activeShift && (
        <DialogPortal>
          <DialogOverlay onClick={() => setShowCloseShiftModal(false)} />
          <DialogContent
            className="w-full max-w-3xl bg-card text-card-foreground border border-border shadow-2xl rounded-2xl p-0 overflow-hidden my-auto"
            style={{ maxWidth: '760px', width: '94%', maxHeight: '90vh', padding: 0 }}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {/* Modern Modal Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-muted/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20 shrink-0">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground m-0 leading-tight">
                    {isAr ? 'إغلاق الوردية ومطابقة النقد الفعلي' : 'Close Shift & Physical Cash Count'}
                  </h3>
                  <p className="text-xs text-muted-foreground m-0 mt-0.5 leading-normal">
                    {isAr ? `${activeShift.terminalId} • الكاشير: ${activeShift.cashierName}` : `${activeShift.terminalId} • Cashier: ${activeShift.cashierName}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCloseShiftModal(false)}
                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
                title={isAr ? 'إغلاق' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: 2 Columns taking advantage of width, zero scroll */}
            <div className="p-5 max-h-[calc(90vh-125px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Column 1: Reconciliation Breakdown Card */}
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Banknote size={15} className="text-primary" />
                      <span>{isAr ? 'الرصيد الافتتاحي (الفكة بالدرج):' : 'Opening Float:'}</span>
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {formatShiftMoney(activeShift.openingFloat)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <DollarSign size={15} className="text-emerald-500" />
                      <span>{isAr ? 'المبيعات النقدية المسجلة (Cash):' : 'Recorded Cash Sales:'}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatShiftMoney(activeShift.cashSales)}
                    </span>
                  </div>

                  {isIraqTenant && (activeShift.zainCashSales || 0) > 0 && (
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                      <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Smartphone size={15} className="text-primary" />
                        <span>{isAr ? 'مبيعات محفظة زين كاش:' : 'ZainCash Sales:'}</span>
                      </span>
                      <span className="font-mono font-bold text-primary">
                        +{formatShiftMoney(activeShift.zainCashSales || 0)}
                      </span>
                    </div>
                  )}

                  {isIraqTenant && (activeShift.qiCardSales || 0) > 0 && (
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                      <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                        <CreditCard size={15} className="text-amber-500" />
                        <span>{isAr ? 'مدفوعات كي كارد الإلكترونية:' : 'Qi Card Sales:'}</span>
                      </span>
                      <span className="font-mono font-bold text-amber-500">
                        +{formatShiftMoney(activeShift.qiCardSales || 0)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm pt-1">
                    <span className="font-bold text-foreground">
                      {isAr ? 'النقد الدفتري المطلوب بالدرج:' : 'Expected Cash in Drawer:'}
                    </span>
                    <span className="font-mono font-extrabold text-primary text-base">
                      {formatShiftMoney(expectedCash)}
                    </span>
                  </div>
                </div>

                {/* Column 2: Physical Cash Count + Live Difference Card */}
                <div className="space-y-3">
                  {/* Physical Cash Count Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="counted-cash-input" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>{isAr ? 'النقد الفعلي بالدرج:' : 'Actual Counted Cash:'}</span>
                        <span className="text-destructive">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleMatchExpected}
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20"
                      >
                        <CheckCircle2 size={12} />
                        <span>{isAr ? 'مطابقة الرصيد' : 'Match Expected'}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        step={isIqd ? "250" : (decimals === 0 ? "1" : (decimals === 3 ? "0.001" : "0.01"))}
                        min="0"
                        id="counted-cash-input"
                        data-testid="counted-cash-input"
                        value={countedCash}
                        onChange={(e) => setCountedCash(e.target.value)}
                        className={`w-full h-11 ps-3.5 pe-14 rounded-xl border-2 bg-background text-foreground text-base font-bold font-mono outline-none shadow-xs transition-all ${
                          discrepancy === 0
                            ? 'border-emerald-500/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                            : discrepancy > 0
                            ? 'border-blue-500/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                            : 'border-destructive/80 focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                        }`}
                      />
                      <div className="absolute end-3 top-3 text-xs font-bold text-muted-foreground pointer-events-none font-mono">
                        {effectiveCurrencySymbol}
                      </div>
                    </div>

                    {countedNum > 0 && (
                      <p className="text-[10px] text-muted-foreground font-mono ps-1">
                        {isAr ? `المبلغ المسجل: ${formatShiftMoney(countedNum)}` : `Entered: ${formatShiftMoney(countedNum)}`}
                      </p>
                    )}
                  </div>

                  {/* Iraqi Denominations Banknote Counter / Calculator */}
                  {isIqd && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5">
                      <button
                        type="button"
                        onClick={() => setShowDenomCalculator(!showDenomCalculator)}
                        className="w-full flex items-center justify-between text-xs font-bold text-primary cursor-pointer border-0 bg-transparent p-0"
                      >
                        <span className="flex items-center gap-1.5">
                          <Calculator size={15} />
                          <span>{isAr ? 'عدّاد فئات النقد العراقي (250 - 50,000 د.ع)' : 'IQD Banknotes Counter (250 - 50,000)'}</span>
                        </span>
                        <span className="text-[11px] underline">
                          {showDenomCalculator ? (isAr ? 'إخفاء ▲' : 'Hide ▲') : (isAr ? 'فتح العدّاد ▼' : 'Open ▼')}
                        </span>
                      </button>

                      {showDenomCalculator && (
                        <div className="mt-2.5 pt-2 border-t border-primary/20 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-muted-foreground flex items-center gap-1">
                              <Coins size={13} className="text-amber-500" />
                              <span>{isAr ? 'عدّ الأوراق النقدية بالدرج:' : 'Count Banknotes:'}</span>
                            </span>
                            <button
                              type="button"
                              onClick={handleResetDenomCounts}
                              className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 cursor-pointer transition-colors bg-transparent border-0"
                              title={isAr ? 'تصفير العدّاد' : 'Reset'}
                            >
                              <RotateCcw size={11} />
                              <span>{isAr ? 'تصفير' : 'Reset'}</span>
                            </button>
                          </div>

                          <div className="space-y-1 max-h-44 overflow-y-auto pe-1">
                            {IQD_DENOMINATIONS.map((denom) => {
                              const count = denomCounts[denom.value] || 0;
                              const lineTotal = count * denom.value;
                              return (
                                <div
                                  key={denom.value}
                                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-card/80 border border-border/50 hover:border-primary/40 transition-colors"
                                >
                                  <div className="flex items-center gap-1.5 min-w-[95px]">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: denom.color }}
                                    />
                                    <span className="font-bold font-mono text-[11px] text-foreground">
                                      {isAr ? denom.labelAr : denom.labelEn}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDenomChange(denom.value, Math.max(0, count - 1))}
                                      className="w-5 h-5 rounded flex items-center justify-center bg-muted border border-border text-foreground hover:bg-border text-xs font-bold cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={count === 0 ? '' : count}
                                      onChange={(e) => handleDenomChange(denom.value, parseInt(e.target.value) || 0)}
                                      placeholder="0"
                                      className="w-12 h-6 text-center text-xs font-mono font-bold rounded border border-border bg-background text-foreground outline-none focus:border-primary"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDenomChange(denom.value, count + 1)}
                                      className="w-5 h-5 rounded flex items-center justify-center bg-muted border border-border text-foreground hover:bg-border text-xs font-bold cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>

                                  <span className="font-mono font-bold text-[11px] text-muted-foreground w-20 text-end">
                                    {lineTotal > 0 ? formatShiftMoney(lineTotal) : '-'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="pt-1.5 border-t border-primary/20 flex items-center justify-between text-xs">
                            <span className="font-semibold text-muted-foreground">
                              {isAr ? 'مجموع فئات النقد:' : 'Total Notes Value:'}
                            </span>
                            <span className="font-mono font-bold text-primary text-xs">
                              {formatShiftMoney(countedNum)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Reconciliation Difference Card */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                      discrepancy === 0
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                        : discrepancy > 0
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400'
                        : 'bg-destructive/10 border-destructive/30 text-destructive'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {discrepancy === 0 ? (
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="text-destructive shrink-0" />
                      )}
                      <div>
                        <span className="font-bold block">
                          {discrepancy === 0
                            ? (isAr ? 'الرصيد مطابق تماماً' : 'Perfect Match (Balanced)')
                            : discrepancy > 0
                            ? (isAr ? 'فائض نقدي بالدرج (زيادة)' : 'Cash Surplus in Drawer')
                            : (isAr ? 'عجز نقدي في الدرج (نقص)' : 'Cash Deficit in Drawer')}
                        </span>
                        <span className="text-[10px] opacity-80">
                          {discrepancy === 0
                            ? (isAr ? 'جاهز لترحيل الوردية وطباعة تقرير Z' : 'Ready to close & print Z-Report')
                            : (isAr ? 'سيتم توثيق الفارق في تقرير Z-Report' : 'Variance logged in Z-Report')}
                        </span>
                      </div>
                    </div>

                    <span className="font-mono font-extrabold text-sm">
                      {discrepancy === 0
                        ? (isAr ? 'مطابق (0.00)' : 'Balanced (0.00)')
                        : discrepancy > 0
                        ? `+${formatShiftMoney(discrepancy)}`
                        : `-${formatShiftMoney(Math.abs(discrepancy))}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={() => setShowCloseShiftModal(false)}
                className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                id="confirm-close-shift-btn"
                onClick={handleConfirmCloseShift}
                className="px-5 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Check size={16} />
                <span>{isAr ? 'اعتماد الإغلاق وطباعة Z-Report' : 'Confirm Close & Print Z-Report'}</span>
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      )}

      {/* 3. MODAL: FISCAL Z-REPORT PRINT PREVIEW */}
      {showZReportModal && currentZReport && (
        <DialogPortal>
          <DialogOverlay onClick={() => setShowZReportModal(false)} />
          <DialogContent
            className="w-full max-w-md bg-card text-card-foreground border border-border shadow-2xl rounded-2xl p-6 my-auto"
            style={{ maxWidth: '440px', width: '92%' }}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="text-center border-b border-dashed border-border pb-3.5 mb-4">
              <Receipt size={32} className="text-primary mx-auto mb-2" />
              <h3 className="m-0 text-lg font-extrabold text-foreground">
                Z-REPORT (إغلاق الوردية)
              </h3>
              <p className="mt-1 mb-0 text-xs text-muted-foreground">ZiloX Business Suite • POS Fiscal Close</p>
              <span className="text-xs text-primary font-mono font-bold">
                {currentZReport.zReportNumber}
              </span>
            </div>

            <div className="text-xs space-y-2 mb-4 leading-relaxed">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{isAr ? 'الكاشير:' : 'Cashier:'}</span>
                <strong className="text-foreground">{currentZReport.cashierName}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{isAr ? 'نقطة البيع:' : 'Terminal:'}</span>
                <span className="font-mono text-foreground font-semibold">{currentZReport.terminalId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{isAr ? 'وقت الإغلاق:' : 'Close Time:'}</span>
                <span className="text-foreground font-mono">{currentZReport.endTime}</span>
              </div>
              <div className="border-t border-dashed border-border my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{isAr ? 'الرصيد الافتتاحي:' : 'Opening Float:'}</span>
                <span className="text-foreground font-semibold font-mono">{formatShiftMoney(currentZReport.openingFloat)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{isAr ? 'المبيعات النقدية:' : 'Cash Sales:'}</span>
                <span className="text-emerald-500 font-bold font-mono">+{formatShiftMoney(currentZReport.cashSales)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{isAr ? 'مبيعات البطاقات:' : 'Card Sales:'}</span>
                <span className="text-primary font-bold font-mono">+{formatShiftMoney(currentZReport.cardSales)}</span>
              </div>
              {isIraqTenant && (
                <>
                  <div className="flex justify-between items-center text-primary font-semibold">
                    <span>{isAr ? 'محفظة زين كاش:' : 'ZainCash:'}</span>
                    <span className="font-mono">+{formatShiftMoney(currentZReport.zainCashSales || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-500 font-semibold">
                    <span>{isAr ? 'مدفوعات كي كارد:' : 'Qi Card:'}</span>
                    <span className="font-mono">+{formatShiftMoney(currentZReport.qiCardSales || 0)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center font-bold border-t border-border pt-2 text-foreground">
                <span>{isAr ? 'النقد المتوقع:' : 'Expected Cash:'}</span>
                <span className="font-mono">{formatShiftMoney(currentZReport.expectedCash)}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-foreground">
                <span>{isAr ? 'النقد الفعلي المعدود:' : 'Actual Cash:'}</span>
                <span className="font-mono">{formatShiftMoney(currentZReport.actualCash)}</span>
              </div>
              <div className={`flex justify-between items-center font-extrabold ${currentZReport.difference === 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                <span>{isAr ? 'الفارق (العجز/الزيادة):' : 'Difference:'}</span>
                <span className="font-mono">
                  {currentZReport.difference === 0 ? formatShiftMoney(0) : (currentZReport.difference > 0 ? `+${formatShiftMoney(currentZReport.difference)}` : `-${formatShiftMoney(Math.abs(currentZReport.difference))}`)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4 pt-3.5 border-t border-border">
              <button 
                type="button"
                onClick={() => setShowZReportModal(false)}
                className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button 
                type="button"
                onClick={() => {
                  window.print();
                  setShowZReportModal(false);
                }}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Printer size={16} />
                <span>{isAr ? 'طباعة تقرير Z' : 'Print Z-Report'}</span>
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      )}
    </div>
  );
}
