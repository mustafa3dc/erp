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
  CalendarClock
} from 'lucide-react';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';
import { apiClient } from '../../lib/api-client';
import { 
  getStoredExpenseCategories, 
  saveStoredExpenseCategories, 
  getStoredExpenseVouchers, 
  saveStoredExpenseVouchers,
  getStoredTreasuryAccounts
} from '../../services/storageService';
import { 
  ExpenseCategory, 
  ExpenseVoucher, 
  ExpenseStatus, 
  ExpensePaymentMethod 
} from '../../types/businessModules';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { ModalBackdropPortal } from '../ui/dialog';
import RecurringExpensesTab from '../RecurringExpensesTab';

interface ExpensesViewProps {
  lang: 'en' | 'ar';
  initialTab?: 'VOUCHERS' | 'RECURRING' | 'CATEGORIES';
}

export default function ExpensesView({ lang, initialTab = 'VOUCHERS' }: ExpensesViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const [activeTab, setActiveTab] = useState<'VOUCHERS' | 'RECURRING' | 'CATEGORIES'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [categories, setCategories] = useState<ExpenseCategory[]>(() => getStoredExpenseCategories());
  const [vouchers, setVouchers] = useState<ExpenseVoucher[]>(() => getStoredExpenseVouchers());

  useEffect(() => {
    const syncVouchers = () => {
      setVouchers(getStoredExpenseVouchers());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('erp_expenses_updated', syncVouchers);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('erp_expenses_updated', syncVouchers);
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
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [voucherToApprove, setVoucherToApprove] = useState<ExpenseVoucher | null>(null);

  // Form state - Voucher
  const [vCategory, setVCategory] = useState('');
  const [vAccount, setVAccount] = useState('');
  const [vAmount, setVAmount] = useState<number | ''>('');
  const [vRecipient, setVRecipient] = useState('');
  const [vPaymentMethod, setVPaymentMethod] = useState<ExpensePaymentMethod>('Cash');
  const [vNotes, setVNotes] = useState('');
  const [vDate, setVDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Form state - Category
  const [cCode, setCCode] = useState('');
  const [cName, setCName] = useState('');
  const [cNameAr, setCNameAr] = useState('');
  const [cBudget, setCBudget] = useState<number | ''>('');
  const [cDesc, setCDesc] = useState('');

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
    if (!vCategory || !vAccount || !vAmount || Number(vAmount) <= 0 || !vRecipient.trim()) {
      return;
    }

    const selectedCat = categories.find(c => c.id === vCategory);
    const selectedAcc = treasuryAccounts.find(a => a.id === vAccount);

    const payload = {
      categoryId: vCategory,
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
      categoryId: vCategory,
      categoryName: isAr && selectedCat?.nameAr ? selectedCat.nameAr : selectedCat?.name || '',
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

  // Handle Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cCode.trim() || !cName.trim()) return;

    const payload = {
      code: cCode.trim().toUpperCase(),
      name: cName.trim(),
      nameAr: cNameAr.trim() || undefined,
      budgetLimit: cBudget ? Number(cBudget) : undefined,
      description: cDesc.trim() || undefined
    };

    let newCat: ExpenseCategory = {
      id: `CAT-${Date.now()}`,
      tenantId: 'default',
      code: payload.code,
      name: payload.name,
      nameAr: payload.nameAr,
      budgetLimit: payload.budgetLimit,
      totalSpent: 0,
      description: payload.description,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    try {
      const res = await apiClient.post('/api/expenses/categories', payload);
      if (res && res.success && res.data) {
        newCat = { ...newCat, id: res.data.id || newCat.id };
      }
    } catch {
      // local fallback
    }

    const next = [...categories, newCat];
    setCategories(next);
    saveStoredExpenseCategories(next);

    setIsCategoryModalOpen(false);
    setCCode('');
    setCName('');
    setCNameAr('');
    setCBudget('');
    setCDesc('');
    showToast(getTranslation(lang, 'expenses.categoryCreated'));
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
            className="btn-clean-secondary"
            onClick={() => setIsCategoryModalOpen(true)}
          >
            <Tag size={15} />
            <span>{getTranslation(lang, 'expenses.newCategory')}</span>
          </button>
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

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'expenses.tabCategories')}</span>
            <div className="module-kpi-value">
              {categories.length} <span className="kpi-sub-unit">{getTranslation(lang, 'expenses.active')}</span>
            </div>
          </div>
          <div className="module-kpi-icon purple">
            <Tag size={20} />
          </div>
        </div>
      </div>

      {/* Tabs */}
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
        <button 
          type="button"
          className={`module-filter-pill ${activeTab === 'CATEGORIES' ? 'active' : ''}`}
          onClick={() => setActiveTab('CATEGORIES')}
        >
          <Tag size={14} />
          <span>{getTranslation(lang, 'expenses.tabCategories')}</span>
        </button>
      </div>

      {/* Tab 1: VOUCHERS */}
      {activeTab === 'VOUCHERS' && (
        <>
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
                            {v.categoryName || categories.find(c => c.id === v.categoryId)?.name || v.categoryId}
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
                            tone={v.status === 'Approved' ? 'emerald' : v.status === 'Rejected' ? 'rose' : 'amber'}
                            dot
                            label={
                              v.status === 'Approved'
                                ? getTranslation(lang, 'expenses.approved')
                                : v.status === 'Rejected'
                                  ? getTranslation(lang, 'expenses.rejected')
                                  : getTranslation(lang, 'expenses.draft')
                            }
                          />
                        </td>
                        <td className="text-center">
                          {v.status !== 'Approved' && v.status !== 'Rejected' ? (
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
          onExpensesUpdated={() => setVouchers(getStoredExpenseVouchers())}
        />
      )}

      {/* Tab 3: CATEGORIES */}
      {activeTab === 'CATEGORIES' && (
        <div className="panel-clean">
          <div className="table-responsive">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>{getTranslation(lang, 'expenses.categoryCode')}</th>
                  <th>{getTranslation(lang, 'expenses.categoryName')}</th>
                  <th>{getTranslation(lang, 'expenses.categoryNameAr')}</th>
                  <th>{getTranslation(lang, 'expenses.budgetLimit')}</th>
                  <th>{getTranslation(lang, 'expenses.notes')}</th>
                  <th>{getTranslation(lang, 'expenses.status')}</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState
                        lang={lang}
                        icon={<Tag size={22} />}
                        title={getTranslation(lang, 'expenses.noCategoriesFound')}
                      />
                    </td>
                  </tr>
                ) : (
                  categories.map(c => (
                    <tr key={c.id}>
                      <td className="font-mono font-bold text-primary" dir="ltr">
                        {c.code}
                      </td>
                      <td className="font-semibold text-foreground">{c.name}</td>
                      <td className="font-semibold text-foreground">{c.nameAr || '—'}</td>
                      <td className="font-mono font-bold tabular-nums text-foreground" dir="ltr">
                        {c.budgetLimit ? formatMoney(c.budgetLimit) : '—'}
                      </td>
                      <td className="text-xs text-muted-foreground">{c.description || '—'}</td>
                      <td>
                        <StatusBadge
                          tone={c.isActive ? 'emerald' : 'slate'}
                          dot
                          label={c.isActive ? getTranslation(lang, 'expenses.active') : getTranslation(lang, 'expenses.inactive')}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'expenses.category')}
                  </label>
                  <select 
                    className="select-clean" 
                    value={vCategory} 
                    onChange={e => setVCategory(e.target.value)} 
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {isAr && c.nameAr ? c.nameAr : c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
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

      {/* Modal: New Expense Category */}
      {isCategoryModalOpen && (
        <ModalBackdropPortal onClose={() => setIsCategoryModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '520px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Tag size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{getTranslation(lang, 'expenses.newCategory')}</h3>
              </div>
              <button type="button" onClick={() => setIsCategoryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'expenses.categoryCode')}
                  </label>
                  <input 
                    type="text" 
                    value={cCode} 
                    onChange={e => setCCode(e.target.value)} 
                    placeholder="E.g. ADVERTISING"
                    required
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'expenses.budgetLimit')}
                  </label>
                  <input 
                    type="number" 
                    step="1"
                    min="0"
                    placeholder="0"
                    value={cBudget} 
                    onChange={e => setCBudget(e.target.value ? Number(e.target.value) : '')} 
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'expenses.categoryName')}
                </label>
                <input 
                  type="text" 
                  value={cName} 
                  onChange={e => setCName(e.target.value)} 
                  required
                  className="input-clean"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'expenses.categoryNameAr')}
                </label>
                <input 
                  type="text" 
                  value={cNameAr} 
                  onChange={e => setCNameAr(e.target.value)} 
                  className="input-clean"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'expenses.notes')}
                </label>
                <textarea 
                  rows={2} 
                  value={cDesc} 
                  onChange={e => setCDesc(e.target.value)} 
                  className="input-clean"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn-clean-secondary"
                  onClick={() => setIsCategoryModalOpen(false)}
                >
                  {getTranslation(lang, 'expenses.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="btn-clean-primary"
                >
                  {getTranslation(lang, 'expenses.saveCategory')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

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
    </div>
  );
}
