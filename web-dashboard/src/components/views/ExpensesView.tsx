import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Tag, 
  TrendingUp, 
  Building2, 
  Wallet, 
  FileText, 
  Filter, 
  AlertTriangle,
  X,
  CalendarClock,
  RotateCcw,
  BellRing
} from 'lucide-react';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';
import { apiClient } from '../../lib/api-client';
import { 
  getStoredExpenseCategories, 
  saveStoredExpenseCategories, 
  getStoredExpenseVouchers, 
  saveStoredExpenseVouchers,
  getStoredTreasuryAccounts,
  getStoredAuthSession
} from '../../services/storageService';
import { checkUserHasPermission } from '../../config/navigationSchema';
import {
  voidExpenseVoucher,
  fetchRecurringExpenses,
  formatRecurringErrorMessage
} from '../../services/recurringExpensesService';
import { 
  ExpenseCategory, 
  ExpenseVoucher, 
  ExpenseStatus, 
  ExpensePaymentMethod,
  RecurringExpenseRule
} from '../../types/businessModules';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { ModalBackdropPortal } from '../ui/dialog';
import RecurringExpensesTab from '../RecurringExpensesTab';
import ConfirmRecurringExpenseModal from '../ConfirmRecurringExpenseModal';
import InlineCategorySelector from '../InlineCategorySelector';

interface ExpensesViewProps {
  lang: 'en' | 'ar';
  initialTab?: 'VOUCHERS' | 'RECURRING';
}

export default function ExpensesView({ lang, initialTab = 'VOUCHERS' }: ExpensesViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const [activeTab, setActiveTab] = useState<'VOUCHERS' | 'RECURRING'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [categories, setCategories] = useState<ExpenseCategory[]>(() => getStoredExpenseCategories());
  const [vouchers, setVouchers] = useState<ExpenseVoucher[]>(() => getStoredExpenseVouchers());
  const [dueRecurringRules, setDueRecurringRules] = useState<RecurringExpenseRule[]>([]);
  const [confirmRecurringTarget, setConfirmRecurringTarget] = useState<RecurringExpenseRule | null>(null);

  const loadDueRecurring = () => {
    fetchRecurringExpenses()
      .then(all => setDueRecurringRules(all.filter(r => r.isActive && r.isDue)))
      .catch(() => setDueRecurringRules([]));
  };

  useEffect(() => {
    const syncVouchers = () => {
      setVouchers(getStoredExpenseVouchers());
    };
    loadDueRecurring();
    if (typeof window !== 'undefined') {
      window.addEventListener('erp_expenses_updated', syncVouchers);
      window.addEventListener('erp_recurring_expenses_updated', loadDueRecurring);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('erp_expenses_updated', syncVouchers);
        window.removeEventListener('erp_recurring_expenses_updated', loadDueRecurring);
      }
    };
  }, []);
  const [treasuryAccounts] = useState(() => getStoredTreasuryAccounts());

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Draft' | 'Approved' | 'Rejected'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Modals state
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [voucherToApprove, setVoucherToApprove] = useState<ExpenseVoucher | null>(null);
  const [voucherToVoid, setVoucherToVoid] = useState<ExpenseVoucher | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const currentUser = getStoredAuthSession();
  const canVoidVoucher = Boolean(
    currentUser && (
      ['SuperAdmin', 'BranchManager', 'PlatformSuperAdmin', 'Accountant'].includes(currentUser.role) ||
      checkUserHasPermission(currentUser.permissions ?? [], 'expenses.manage') ||
      checkUserHasPermission(currentUser.permissions ?? [], 'finance.ledger')
    )
  );

  // Form state - Voucher
  const [vCategory, setVCategory] = useState('');
  const [vAccount, setVAccount] = useState('');
  const [vAmount, setVAmount] = useState<number | ''>('');
  const [vRecipient, setVRecipient] = useState('');
  const [vPaymentMethod, setVPaymentMethod] = useState<ExpensePaymentMethod>('Cash');
  const [vNotes, setVNotes] = useState('');
  const [vDate, setVDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Fetch real data from API with fallback
  useEffect(() => {
    const fetchData = async () => {
      try {
        const catRes = await apiClient.get('/api/expenses/categories');
        if (catRes && catRes.success && Array.isArray(catRes.data)) {
          setCategories(catRes.data);
          saveStoredExpenseCategories(catRes.data);
        }
      } catch {
        // use local storage fallback
      }

      try {
        const vouchRes = await apiClient.get('/api/expenses/vouchers');
        if (vouchRes && vouchRes.success && Array.isArray(vouchRes.data)) {
          setVouchers(vouchRes.data);
          saveStoredExpenseVouchers(vouchRes.data);
        }
      } catch {
        // use local storage fallback
      }
    };
    fetchData();
  }, []);

  // Set default account and category when modal opens
  useEffect(() => {
    if (isVoucherModalOpen) {
      if (categories.length > 0 && !vCategory) setVCategory(categories[0].id);
      if (treasuryAccounts.length > 0 && !vAccount) setVAccount(treasuryAccounts[0].id);
    }
  }, [isVoucherModalOpen, categories, treasuryAccounts, vCategory, vAccount]);

  // KPI Calculations
  const totalApproved = vouchers
    .filter(v => v.status === 'Approved')
    .reduce((sum, v) => sum + (v.amount || 0), 0);

  const pendingVouchers = vouchers.filter(v => v.status === 'Draft' || v.status === 'Pending');
  const pendingCount = pendingVouchers.length;
  const pendingAmount = pendingVouchers.reduce((sum, v) => sum + (v.amount || 0), 0);

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const monthlyApproved = vouchers
    .filter(v => v.status === 'Approved' && (v.createdAt || v.approvedAt || '').startsWith(currentMonthStr))
    .reduce((sum, v) => sum + (v.amount || 0), 0);

  // Filtered Vouchers
  const filteredVouchers = vouchers.filter(v => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      v.voucherNo.toLowerCase().includes(q) || 
      v.recipient.toLowerCase().includes(q) || 
      (v.notes && v.notes.toLowerCase().includes(q));

    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
      matchesStatus = v.status === statusFilter;
    }

    let matchesCat = true;
    if (categoryFilter !== 'ALL') {
      matchesCat = v.categoryId === categoryFilter;
    }

    return matchesSearch && matchesStatus && matchesCat;
  });

  // Handle Create Voucher
  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vAccount || !vAmount || Number(vAmount) <= 0 || !vRecipient.trim()) {
      return;
    }

    const selectedCat = vCategory ? categories.find(c => c.id === vCategory) : undefined;
    const selectedAcc = treasuryAccounts.find(a => a.id === vAccount);

    const payload = {
      categoryId: vCategory || null,
      treasuryAccountId: vAccount,
      amount: Number(vAmount),
      recipient: vRecipient.trim(),
      paymentMethod: vPaymentMethod,
      notes: vNotes.trim()
    };

    let newVoucher: ExpenseVoucher = {
      id: `EXP-VOUCH-${Date.now()}`,
      tenantId: 'default',
      voucherNo: `EV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      categoryId: vCategory || '',
      categoryName: selectedCat ? (isAr && selectedCat.nameAr ? selectedCat.nameAr : selectedCat.name) : '',
      treasuryAccountId: vAccount,
      treasuryAccountName: selectedAcc?.name || '',
      amount: Number(vAmount),
      currency: 'USD',
      exchangeRate: 1,
      recipient: vRecipient.trim(),
      paymentMethod: vPaymentMethod,
      notes: vNotes.trim(),
      status: 'Draft',
      createdAt: vDate || new Date().toISOString()
    };

    try {
      const res = await apiClient.post('/api/expenses/vouchers', payload);
      if (res && res.success && res.data) {
        newVoucher = {
          ...newVoucher,
          id: res.data.id || newVoucher.id,
          voucherNo: res.data.voucherNo || newVoucher.voucherNo
        };
      }
    } catch {
      // local fallback
    }

    const next = [newVoucher, ...vouchers];
    setVouchers(next);
    saveStoredExpenseVouchers(next);

    setIsVoucherModalOpen(false);
    setVAmount('');
    setVRecipient('');
    setVNotes('');
    showToast(getTranslation(lang, 'expenses.createSuccess'));
  };

  // Handle Approve Voucher
  const handleConfirmApprove = async () => {
    if (!voucherToApprove) return;

    try {
      await apiClient.post(`/api/expenses/vouchers/${voucherToApprove.id}/approve`, {});
    } catch {
      // local fallback
    }

    const updated = vouchers.map(v => {
      if (v.id === voucherToApprove.id) {
        return {
          ...v,
          status: 'Approved' as ExpenseStatus,
          approvedAt: new Date().toISOString(),
          approvedBy: 'Admin'
        };
      }
      return v;
    });

    setVouchers(updated);
    saveStoredExpenseVouchers(updated);
    setVoucherToApprove(null);
    showToast(getTranslation(lang, 'expenses.approveSuccess'));
  };

  // Handle Reject Voucher
  const handleRejectVoucher = async (v: ExpenseVoucher) => {
    try {
      await apiClient.post(`/api/expenses/vouchers/${v.id}/reject`, {});
    } catch {
      // local fallback
    }

    const updated = vouchers.map(item => {
      if (item.id === v.id) {
        return { ...item, status: 'Rejected' as ExpenseStatus };
      }
      return item;
    });

    setVouchers(updated);
    saveStoredExpenseVouchers(updated);
    showToast(getTranslation(lang, 'expenses.rejectSuccess'));
  };

  // Handle Void Voucher (Admin/Owner-only: marks Voided, excludes from Totals, refunds CashBox if deducted)
  const handleConfirmVoid = async () => {
    if (!voucherToVoid) return;
    setIsVoiding(true);
    try {
      await voidExpenseVoucher(voucherToVoid.id, voidReason.trim() || undefined);
      setVouchers(getStoredExpenseVouchers());
      setVoucherToVoid(null);
      setVoidReason('');
      showToast(getTranslation(lang, 'expenses.voidSuccess'));
    } catch (err: any) {
      showToast(formatRecurringErrorMessage(err, lang));
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {toastMsg && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: isAr ? 'auto' : '24px', right: isAr ? '24px' : 'auto', zIndex: 9999 }}>
          <CheckCircle2 size={16} className="green-text" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Module Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <DollarSign size={16} style={{ color: 'var(--primary)' }} />
            <span>{getTranslation(lang, 'expenses.subtitle')}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          <button 
            type="button" 
            className="btn-clean-primary"
            onClick={() => setIsVoucherModalOpen(true)}
          >
            <Plus size={15} />
            <span>{getTranslation(lang, 'expenses.newVoucher')}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'expenses.totalOperationalExpenses')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#ef4444' }}>
              {formatMoney(totalApproved)}
            </div>
          </div>
          <div className="module-kpi-icon rose">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'expenses.approvedExpensesMonth')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#f59e0b' }}>
              {formatMoney(monthlyApproved)}
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'expenses.pendingCount')}</span>
            <div className="module-kpi-value">
              {pendingCount} <span className="kpi-sub-unit">({formatMoney(pendingAmount)})</span>
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <Clock size={20} />
          </div>
        </div>

        <div
          className="module-kpi-card cursor-pointer"
          onClick={() => setActiveTab('RECURRING')}
        >
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'expenses.dueRecurringCardLabel')}</span>
            <div className="module-kpi-value tabular-nums">
              {dueRecurringRules.length} <span className="kpi-sub-unit">{getTranslation(lang, 'ui.recurringExpenses.dueBadge')}</span>
            </div>
          </div>
          <div className="module-kpi-icon purple">
            <CalendarClock size={20} />
          </div>
        </div>
      </div>

      {/* Tabs (Clean 2-Tab Navigation) */}
      <div className="module-filter-pills" style={{ marginBottom: '16px' }}>
        <button 
          type="button"
          className={`module-filter-pill ${activeTab === 'VOUCHERS' ? 'active' : ''}`}
          onClick={() => setActiveTab('VOUCHERS')}
        >
          <FileText size={14} />
          <span>{getTranslation(lang, 'expenses.tabVouchers')}</span>
        </button>
        <button 
          type="button"
          className={`module-filter-pill ${activeTab === 'RECURRING' ? 'active' : ''}`}
          onClick={() => setActiveTab('RECURRING')}
        >
          <CalendarClock size={14} />
          <span>{getTranslation(lang, 'expenses.tabRecurring')}</span>
        </button>
      </div>

      {/* Tab 1: VOUCHERS */}
      {activeTab === 'VOUCHERS' && (
        <>
          {/* Due Recurring Bills Top Banner (1-Click Payment Confirmation) */}
          {dueRecurringRules.length > 0 && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    <BellRing size={17} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      {getTranslation(lang, 'ui.recurringExpenses.dueBannerTitle').replace(
                        '{count}',
                        String(dueRecurringRules.length)
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {getTranslation(lang, 'ui.recurringExpenses.dueBannerSubtitle')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {dueRecurringRules.map(rule => (
                  <div
                    key={rule.id}
                    className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">{rule.title}</div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 tabular-nums" dir="ltr">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {formatMoney(rule.amount)}
                        </span>
                        <span>•</span>
                        <span>{new Date(rule.nextDueDate).toLocaleDateString(isAr ? 'ar-IQ' : 'en-US')}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmRecurringTarget(rule)}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition-all"
                    >
                      <CheckCircle2 size={13} />
                      <span>{getTranslation(lang, 'ui.recurringExpenses.confirmPaymentBtn')}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Toolbar */}
          <div className="module-toolbar">
            <div className="module-search-box">
              <Search size={16} />
              <input 
                type="text" 
                placeholder={getTranslation(lang, 'expenses.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="module-filter-pills">
              {[
                { id: 'ALL', label: getTranslation(lang, 'expenses.filterAll') },
                { id: 'Draft', label: getTranslation(lang, 'expenses.filterPending') },
                { id: 'Approved', label: getTranslation(lang, 'expenses.filterApproved') },
                { id: 'Rejected', label: getTranslation(lang, 'expenses.filterRejected') }
              ].map(pill => (
                <button
                  key={pill.id}
                  type="button"
                  className={`module-filter-pill ${statusFilter === pill.id ? 'active' : ''}`}
                  onClick={() => setStatusFilter(pill.id as any)}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {categories.length > 0 && (
              <select 
                className="select-clean"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '8px' }}
              >
                <option value="ALL">{getTranslation(lang, 'expenses.allCategories')}</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {isAr && c.nameAr ? c.nameAr : c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Vouchers Table */}
          <div className="panel-clean">
            <div className="table-responsive">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>{getTranslation(lang, 'expenses.voucherNumber')}</th>
                    <th>{getTranslation(lang, 'expenses.category')}</th>
                    <th>{getTranslation(lang, 'expenses.cashBox')}</th>
                    <th>{getTranslation(lang, 'expenses.beneficiary')}</th>
                    <th>{getTranslation(lang, 'expenses.amount')}</th>
                    <th>{getTranslation(lang, 'expenses.voucherDate')}</th>
                    <th>{getTranslation(lang, 'expenses.status')}</th>
                    <th style={{ textAlign: 'center' }}>{getTranslation(lang, 'expenses.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <EmptyState
                          lang={lang}
                          icon={<FileText size={22} />}
                          title={getTranslation(lang, 'expenses.noVouchersFound')}
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map(v => (
                      <tr key={v.id}>
                        <td className="font-mono font-bold text-primary" dir="ltr">
                          {v.voucherNo}
                        </td>
                        <td>
                          <span className="font-semibold text-foreground" dir="auto">
                            {v.categoryName || categories.find(c => c.id === v.categoryId)?.name || getTranslation(lang, 'expenses.uncategorized')}
                          </span>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Wallet size={13} />
                            <span dir="auto">{v.treasuryAccountName || treasuryAccounts.find(a => a.id === v.treasuryAccountId)?.name || v.treasuryAccountId}</span>
                          </span>
                        </td>
                        <td>
                          <span className="font-semibold text-foreground" dir="auto">{v.recipient}</span>
                          {v.notes && (
                            <span className="block text-[11px] text-muted-foreground" dir="auto">{v.notes}</span>
                          )}
                        </td>
                        <td className="font-bold text-destructive font-mono tabular-nums" dir="ltr">
                          {formatMoney(v.amount)}
                        </td>
                        <td className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                          {(v.createdAt || '').slice(0, 10)}
                        </td>
                        <td>
                          <StatusBadge
                            tone={
                              v.status === 'Approved'
                                ? 'emerald'
                                : v.status === 'Rejected' || v.status === 'Voided'
                                  ? 'rose'
                                  : 'amber'
                            }
                            dot
                            label={
                              v.status === 'Approved'
                                ? getTranslation(lang, 'expenses.approved')
                                : v.status === 'Voided'
                                  ? getTranslation(lang, 'expenses.voided')
                                  : v.status === 'Rejected'
                                    ? getTranslation(lang, 'expenses.rejected')
                                    : getTranslation(lang, 'expenses.draft')
                            }
                          />
                        </td>
                        <td className="text-center">
                          {v.status !== 'Approved' && v.status !== 'Rejected' && v.status !== 'Voided' ? (
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                className="btn-clean-primary py-1 px-2.5 text-[11px]"
                                onClick={() => setVoucherToApprove(v)}
                              >
                                <CheckCircle2 size={12} />
                                <span>{getTranslation(lang, 'expenses.approve')}</span>
                              </button>
                              <button
                                type="button"
                                className="btn-clean-secondary py-1 px-2.5 text-[11px] text-destructive"
                                onClick={() => handleRejectVoucher(v)}
                              >
                                <XCircle size={12} />
                                <span>{getTranslation(lang, 'expenses.reject')}</span>
                              </button>
                            </div>
                          ) : v.status === 'Approved' && canVoidVoucher ? (
                            <button
                              type="button"
                              onClick={() => {
                                setVoucherToVoid(v);
                                setVoidReason('');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors"
                            >
                              <RotateCcw size={12} />
                              <span>{getTranslation(lang, 'expenses.voidVoucher')}</span>
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tab 2: RECURRING */}
      {activeTab === 'RECURRING' && (
        <RecurringExpensesTab
          lang={lang}
          categories={categories}
          onExpensesUpdated={() => {
            setVouchers(getStoredExpenseVouchers());
            loadDueRecurring();
          }}
          onCategoriesChange={setCategories}
        />
      )}

      {/* Modal: New Expense Voucher */}
      {isVoucherModalOpen && (
        <ModalBackdropPortal onClose={() => setIsVoucherModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '580px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{getTranslation(lang, 'expenses.newVoucher')}</h3>
              </div>
              <button type="button" onClick={() => setIsVoucherModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <InlineCategorySelector
                    lang={lang}
                    categories={categories}
                    value={vCategory}
                    valueMode="id"
                    onChange={setVCategory}
                    onCategoriesChange={setCategories}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'expenses.cashBox')}
                  </label>
                  <select 
                    className="select-clean" 
                    value={vAccount} 
                    onChange={e => setVAccount(e.target.value)} 
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    {treasuryAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'expenses.amount')}
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    placeholder="0.00" 
                    value={vAmount} 
                    onChange={e => setVAmount(e.target.value ? Number(e.target.value) : '')} 
                    required
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'expenses.paymentMethod')}
                  </label>
                  <select 
                    className="select-clean" 
                    value={vPaymentMethod} 
                    onChange={e => setVPaymentMethod(e.target.value as any)} 
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    <option value="Cash">{getTranslation(lang, 'expenses.cash')}</option>
                    <option value="BankTransfer">{getTranslation(lang, 'expenses.bankTransfer')}</option>
                    <option value="Check">{getTranslation(lang, 'expenses.check')}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'expenses.beneficiary')}
                  </label>
                  <input 
                    type="text" 
                    value={vRecipient} 
                    onChange={e => setVRecipient(e.target.value)} 
                    required
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'expenses.voucherDate')}
                  </label>
                  <input 
                    type="date" 
                    value={vDate} 
                    onChange={e => setVDate(e.target.value)} 
                    required
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'expenses.notes')}
                </label>
                <textarea 
                  rows={2} 
                  value={vNotes} 
                  onChange={e => setVNotes(e.target.value)}
                  className="input-clean"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', resize: 'none' }}
                />
              </div>

              <p className="my-1 text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <span>{getTranslation(lang, 'expenses.deductNotice')}</span>
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn-clean-secondary"
                  onClick={() => setIsVoucherModalOpen(false)}
                >
                  {getTranslation(lang, 'expenses.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="btn-clean-primary"
                >
                  {getTranslation(lang, 'expenses.save')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Inline Confirm Modal for Due Recurring Bills Banner */}
      <ConfirmRecurringExpenseModal
        rule={confirmRecurringTarget}
        lang={lang}
        onClose={() => setConfirmRecurringTarget(null)}
        onConfirmed={() => {
          loadDueRecurring();
          setVouchers(getStoredExpenseVouchers());
        }}
      />

      {/* Confirmation Dialog: Approve & Deduct Voucher */}
      {voucherToApprove && (
        <ModalBackdropPortal onClose={() => setVoucherToApprove(null)} dir={isAr ? 'rtl' : 'ltr'}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '440px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="m-0 text-base font-bold text-foreground">{getTranslation(lang, 'expenses.confirmApprove')}</h3>
                <span className="text-xs font-mono text-muted-foreground" dir="ltr">{voucherToApprove.voucherNo}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed m-0 mb-4">
              {getTranslation(lang, 'expenses.confirmApproveMsg')}
            </p>

            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{getTranslation(lang, 'expenses.amount')}:</span>
                <span className="text-sm font-bold text-destructive font-mono tabular-nums" dir="ltr">
                  {formatMoney(voucherToApprove.amount)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{getTranslation(lang, 'expenses.cashBox')}:</span>
                <span className="font-semibold text-foreground">{voucherToApprove.treasuryAccountName || voucherToApprove.treasuryAccountId}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="btn-clean-secondary"
                onClick={() => setVoucherToApprove(null)}
              >
                {getTranslation(lang, 'expenses.cancel')}
              </button>
              <button 
                type="button" 
                className="btn-clean-primary"
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                onClick={handleConfirmApprove}
              >
                {getTranslation(lang, 'expenses.approve')}
              </button>
            </div>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Confirmation Dialog: Admin Void Voucher */}
      {voucherToVoid && (
        <ModalBackdropPortal onClose={() => setVoucherToVoid(null)} dir={isAr ? 'rtl' : 'ltr'}>
          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {getTranslation(lang, 'expenses.voidConfirmTitle')}
                  </h3>
                  <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                    {voucherToVoid.voucherNo}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoucherToVoid(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {getTranslation(lang, 'expenses.voidConfirmMsg')}
              </p>

              <div className="p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{getTranslation(lang, 'expenses.amount')}:</span>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono tabular-nums" dir="ltr">
                  {formatMoney(voucherToVoid.amount)}
                </span>
              </div>

              <textarea
                rows={2}
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder={getTranslation(lang, 'expenses.voidReasonPlaceholder')}
                className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setVoucherToVoid(null)}
                  className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors"
                >
                  {getTranslation(lang, 'expenses.cancel')}
                </button>
                <button
                  type="button"
                  disabled={isVoiding}
                  onClick={handleConfirmVoid}
                  className="px-5 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
                >
                  {getTranslation(lang, 'expenses.voidBtn')}
                </button>
              </div>
            </div>
          </div>
        </ModalBackdropPortal>
      )}
    </div>
  );
}
