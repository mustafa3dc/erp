import React, { useState, useEffect, useMemo } from 'react';
import {
  getStoredCustomers,
  saveStoredCustomers,
  getStoredLoyaltySettings,
  getStoredLoyaltyTransactions,
  calculateLoyaltyCurrencyEquivalent,
  adjustCustomerLoyaltyPointsLocally,
  LoyaltyTransactionRecord,
  LoyaltySettingsConfig
} from '../../services/storageService';
import NewCustomerModal from '../modals/NewCustomerModal';
import DigitalLoyaltyCardModal, { DigitalLoyaltyCustomerInfo } from '../modals/DigitalLoyaltyCardModal';
import RewardsStorePanel from './RewardsStorePanel';
import { syncCustomersToBackend } from '../../services/loyaltyRewardsService';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';
import { ModalBackdropPortal } from '../ui/dialog';
import {
  Users,
  Award,
  CreditCard,
  Search,
  Plus,
  CheckCircle2,
  Star,
  History,
  SlidersHorizontal,
  X,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Gift,
  QrCode
} from 'lucide-react';

interface CustomerRecord {
  id: string;
  code: string;
  name: string;
  phone: string;
  city: string;
  creditLimit: number;
  currentBalance: number;
  loyaltyTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  loyaltyPoints: number;
  loyaltyPointsBalance?: number;
  loyaltyMemberCode?: string;
  loyaltyCardToken?: string;
  normalizedPhone?: string;
  isDefaultCashCustomer?: boolean;
}

interface CustomersLoyaltyViewProps {
  lang: 'en' | 'ar';
}

export default function CustomersLoyaltyView({ lang }: CustomersLoyaltyViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney, settings } = useSettings();
  const lTr = (key: string, fallback?: string) => getTranslation(lang, `ui.loyalty.${key}`, fallback);

  const [activeTab, setActiveTab] = useState<'directory' | 'history' | 'rewards'>('directory');
  const [customers, setCustomers] = useState<CustomerRecord[]>(() => getStoredCustomers());
  const [digitalCardTarget, setDigitalCardTarget] = useState<DigitalLoyaltyCustomerInfo | null>(null);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransactionRecord[]>(() =>
    getStoredLoyaltyTransactions()
  );
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettingsConfig>(() =>
    settings.loyaltySettings || getStoredLoyaltySettings()
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [historyCustomerFilter, setHistoryCustomerFilter] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState('');
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);

  // Manual Adjustment Modal
  const [adjustTarget, setAdjustTarget] = useState<CustomerRecord | null>(null);
  const [adjustPointsInput, setAdjustPointsInput] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  useEffect(() => {
    setLoyaltySettings(settings.loyaltySettings || getStoredLoyaltySettings());
  }, [settings.loyaltySettings]);

  // Sync live backend customers & immutable loyalty ledger when online
  useEffect(() => {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('zilox_auth_token') || localStorage.getItem('logistock_erp_jwt_token'))
      : null;
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    syncCustomersToBackend().catch(() => {});

    fetch('/api/customers', { headers })
      .then(res => (res.ok ? res.json() : null))
      .then((remote) => {
        if (Array.isArray(remote) && remote.length > 0) {
          setCustomers(prev => {
            const byId = new Map(prev.map(c => [c.id, c]));
            for (const rc of remote) {
              const ex = byId.get(String(rc.id));
              const pts = Number(rc.loyaltyPointsBalance ?? ex?.loyaltyPointsBalance ?? ex?.loyaltyPoints ?? 0) || 0;
              byId.set(String(rc.id), {
                id: String(rc.id),
                code: rc.code || ex?.code || '',
                name: rc.name || ex?.name || '',
                phone: rc.phone || ex?.phone || '—',
                city: ex?.city || '—',
                creditLimit: Number(rc.creditLimit ?? ex?.creditLimit ?? 0),
                currentBalance: Number(rc.currentBalance ?? ex?.currentBalance ?? 0),
                loyaltyTier: ex?.loyaltyTier || (pts >= 5000 ? 'PLATINUM' : pts >= 2000 ? 'GOLD' : pts >= 500 ? 'SILVER' : 'BRONZE'),
                loyaltyPoints: pts,
                loyaltyPointsBalance: pts,
                loyaltyMemberCode: rc.loyaltyMemberCode || ex?.loyaltyMemberCode,
                loyaltyCardToken: rc.loyaltyCardToken || ex?.loyaltyCardToken,
                normalizedPhone: rc.normalizedPhone || ex?.normalizedPhone,
                isDefaultCashCustomer: Boolean(rc.isDefaultCashCustomer)
              });
            }
            const next = Array.from(byId.values());
            saveStoredCustomers(next);
            return next;
          });
        }
      })
      .catch(() => {});

    fetch('/api/loyalty/transactions?limit=200', { headers })
      .then(res => (res.ok ? res.json() : null))
      .then((remoteTxs) => {
        if (Array.isArray(remoteTxs) && remoteTxs.length > 0) {
          setLoyaltyTransactions(prev => {
            const byId = new Map<string, LoyaltyTransactionRecord>(prev.map(t => [t.id, t]));
            for (const rt of remoteTxs) {
              byId.set(String(rt.id), {
                id: String(rt.id),
                customerId: String(rt.customerId),
                customerName: rt.customerName || '—',
                invoiceId: rt.invoiceId ? String(rt.invoiceId) : undefined,
                invoiceNumber: rt.invoiceNumber || undefined,
                returnId: rt.returnId ? String(rt.returnId) : undefined,
                rmaNumber: rt.rmaNumber || undefined,
                type: rt.type,
                pointsChange: Number(rt.pointsChange) || 0,
                profitBasis: Number(rt.profitBasis) || 0,
                balanceAfter: Number(rt.balanceAfter) || 0,
                notes: rt.notes || undefined,
                createdBy: rt.createdBy || 'System',
                createdAt: rt.createdAt
              });
            }
            return Array.from(byId.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const getCustomerPoints = (c: CustomerRecord) =>
    Number(c.loyaltyPointsBalance ?? c.loyaltyPoints ?? 0) || 0;

  const filtered = customers.filter(c => {
    const matchesTier = tierFilter === 'ALL' || c.loyaltyTier === tierFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.code || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesSearch;
  });

  const filteredHistory = useMemo(() => {
    return loyaltyTransactions.filter(tx => {
      if (historyCustomerFilter !== 'ALL' && tx.customerId !== historyCustomerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          (tx.customerName || '').toLowerCase().includes(q) ||
          (tx.invoiceNumber || '').toLowerCase().includes(q) ||
          (tx.rmaNumber || '').toLowerCase().includes(q) ||
          (tx.notes || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [loyaltyTransactions, historyCustomerFilter, searchQuery]);

  const totalDebt = customers.reduce((acc, c) => acc + (Number(c.currentBalance) || 0), 0);
  const totalPoints = customers.reduce((acc, c) => acc + getCustomerPoints(c), 0);
  const vipCount = customers.filter(c => c.loyaltyTier === 'GOLD' || c.loyaltyTier === 'PLATINUM').length;

  const handleOpenCustomerHistory = (customerId: string) => {
    setHistoryCustomerFilter(customerId);
    setActiveTab('history');
  };

  const handleConfirmAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    const delta = parseFloat(adjustPointsInput);
    if (isNaN(delta) || delta === 0) return;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('zilox_auth_token') || localStorage.getItem('logistock_erp_jwt_token'))
      : null;

    if (token && uuidRegex.test(adjustTarget.id)) {
      await fetch('/api/loyalty/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: adjustTarget.id,
          pointsChange: delta,
          notes: adjustNotes.trim() || undefined
        })
      }).catch(() => {});
    }

    adjustCustomerLoyaltyPointsLocally({
      customerId: adjustTarget.id,
      pointsChange: delta,
      notes: adjustNotes.trim() || undefined,
      operator: 'Admin'
    });

    setCustomers(getStoredCustomers());
    setLoyaltyTransactions(getStoredLoyaltyTransactions());
    setAdjustTarget(null);
    setAdjustPointsInput('');
    setAdjustNotes('');
    showToast(lTr('saveSuccessToast'));
  };

  const getTxTypeMeta = (type: string) => {
    switch (type) {
      case 'Earned':
        return { label: lTr('typeEarned'), cls: 'emerald', icon: <ArrowUpRight size={12} /> };
      case 'Redeemed':
        return { label: lTr('typeRedeemed'), cls: 'amber', icon: <ArrowDownRight size={12} /> };
      case 'ReversedOnReturn':
        return { label: lTr('typeReversedOnReturn'), cls: 'rose', icon: <RotateCcw size={12} /> };
      default:
        return { label: lTr('typeManualAdjustment'), cls: 'indigo', icon: <SlidersHorizontal size={12} /> };
    }
  };

  return (
    <div className="view-content-wrapper fade-in">
      {toastMsg && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9999 }}>
          <CheckCircle2 size={16} className="green-text" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Module Context Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <Users size={15} style={{ color: 'var(--primary)' }} />
            <span>{isAr ? 'العملاء والمالية / دليل العملاء وسقوف الائتمان وبرنامج الولاء' : 'Commercial / Customer Accounts, Credit Limits & Profit-Based Loyalty'}</span>
          </p>
        </div>

        <div className="module-actions-wrap" style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-clean-secondary"
            onClick={() => setActiveTab(activeTab === 'directory' ? 'history' : 'directory')}
          >
            {activeTab === 'directory' ? <History size={15} /> : <Users size={15} />}
            <span>{activeTab === 'directory' ? lTr('customersTabHistory') : lTr('customersTabDirectory')}</span>
          </button>

          <button
            type="button"
            className="btn-clean-primary"
            onClick={() => setIsNewCustomerModalOpen(true)}
          >
            <Plus size={15} />
            <span>{isAr ? 'إضافة عميل جديد' : 'New Customer'}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'إجمالي الديون المستحقة' : 'Outstanding Receivables'}</span>
            <div className="module-kpi-value font-mono tabular-nums" style={{ color: '#ef4444' }}>
              {formatMoney(totalDebt)}
            </div>
          </div>
          <div className="module-kpi-icon rose">
            <CreditCard size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'حسابات العملاء النشطة' : 'Active Accounts'}</span>
            <div className="module-kpi-value tabular-nums">
              {customers.length} <span className="kpi-sub-unit">{isAr ? 'حساب' : 'accounts'}</span>
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <Users size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'نقاط الولاء الصادرة' : 'Issued Reward Points'}</span>
            <div className="module-kpi-value tabular-nums" style={{ color: '#fbbf24' }}>
              {totalPoints.toLocaleString('en-US')} <span className="kpi-sub-unit">{lTr('pointsUnit')}</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Award size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'عملاء الفئة المميزة VIP' : 'VIP Tier Accounts'}</span>
            <div className="module-kpi-value tabular-nums">
              {vipCount} <span className="kpi-sub-unit">{isAr ? 'عملاء' : 'clients'}</span>
            </div>
          </div>
          <div className="module-kpi-icon purple">
            <Star size={20} />
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex gap-1 border-b border-border mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === 'directory' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users size={15} />
          <span>{lTr('customersTabDirectory')}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History size={15} />
          <span>{lTr('customersTabHistory')}</span>
          {loyaltyTransactions.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums bg-primary/10 text-primary">
              {loyaltyTransactions.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rewards')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === 'rewards' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Gift size={15} />
          <span>{getTranslation(lang, 'ui.rewardsStore.tabTitle')}</span>
        </button>
      </div>

      {/* Toolbar */}
      {activeTab !== 'rewards' && (
      <div className="module-toolbar">
        <div className="module-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder={isAr ? 'بحث بالاسم، رقم الهاتف، الفاتورة أو الكود...' : 'Search customer, invoice, phone, code...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {activeTab === 'directory' ? (
          <div className="module-filter-pills">
            {[
              { id: 'ALL', label: isAr ? 'جميع الفئات' : 'All Tiers' },
              { id: 'PLATINUM', label: isAr ? 'بلاتيني' : 'Platinum' },
              { id: 'GOLD', label: isAr ? 'ذهبي' : 'Gold' },
              { id: 'SILVER', label: isAr ? 'فضي' : 'Silver' },
              { id: 'BRONZE', label: isAr ? 'برونزي' : 'Bronze' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                className={`filter-pill ${tierFilter === f.id ? 'active' : ''}`}
                onClick={() => setTierFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={historyCustomerFilter}
              onChange={(e) => setHistoryCustomerFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-foreground"
            >
              <option value="ALL">{lTr('allCustomersFilter')}</option>
              {customers
                .filter(c => !c.isDefaultCashCustomer)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>
        )}
      </div>
      )}

      {activeTab === 'rewards' ? (
        <RewardsStorePanel lang={lang} onToast={showToast} />
      ) : activeTab === 'directory' ? (
        <div className="transactions-table-card">
          <div className="table-responsive">
            <table className="custom-data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'كود العميل' : 'Customer Code'}</th>
                  <th>{isAr ? 'اسم العميل' : 'Customer Name'}</th>
                  <th>{isAr ? 'الهاتف والمدينة' : 'Phone & Location'}</th>
                  <th>{isAr ? 'فئة الولاء' : 'Loyalty Tier'}</th>
                  <th>{lTr('pointsBalanceCol')}</th>
                  <th>{lTr('currencyEquivalentCol')}</th>
                  <th>{isAr ? 'الحد الائتماني' : 'Credit Limit'}</th>
                  <th>{isAr ? 'الرصيد المستحق (الدين)' : 'Outstanding Debt'}</th>
                  <th>{getTranslation(lang, 'ui.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-muted-foreground" style={{ textAlign: 'center', padding: '40px 20px' }}>
                      {isAr ? 'سجل العملاء فارغ حالياً - النظام صافٍ وجاهز لتسجيل العملاء الجدد' : 'Customer registry is clean. Ready to enroll new clients.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => {
                    const pts = getCustomerPoints(c);
                    const eqVal = calculateLoyaltyCurrencyEquivalent(pts, loyaltySettings);
                    return (
                      <tr key={c.id}>
                        <td className="font-mono font-bold text-primary" dir="ltr">
                          <div>{c.code}</div>
                          {!c.isDefaultCashCustomer && c.loyaltyMemberCode && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                              {c.loyaltyMemberCode}
                            </span>
                          )}
                        </td>
                        <td className="font-bold text-foreground text-sm"><span dir="auto">{c.name}</span></td>
                        <td>
                          <span className="block text-xs text-foreground font-semibold font-mono tabular-nums" dir="ltr">{c.phone}</span>
                          <span dir="auto" className="text-xs text-muted-foreground">{c.city}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${
                            c.loyaltyTier === 'PLATINUM' ? 'indigo' :
                            c.loyaltyTier === 'GOLD' ? 'amber' :
                            c.loyaltyTier === 'SILVER' ? 'slate' : 'purple'
                          }`}>
                            <Star size={11} />
                            <span>{c.loyaltyTier}</span>
                          </span>
                        </td>
                        <td className="font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums" dir="ltr">
                          {pts.toLocaleString('en-US')} {lTr('pointsUnit')}
                        </td>
                        <td className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums" dir="ltr">
                          {formatMoney(eqVal)}
                        </td>
                        <td className="text-xs text-muted-foreground font-semibold font-mono tabular-nums" dir="ltr">
                          {formatMoney(c.creditLimit)}
                        </td>
                        <td>
                          <strong className={`text-sm font-mono tabular-nums ${c.currentBalance > 0 ? 'text-destructive' : 'text-emerald-500'}`} dir="ltr">
                            {formatMoney(c.currentBalance)}
                          </strong>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="btn-clean-secondary"
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                              onClick={() => handleOpenCustomerHistory(c.id)}
                            >
                              <History size={13} />
                              <span>{lTr('viewHistoryBtn')}</span>
                            </button>
                            {!c.isDefaultCashCustomer && c.loyaltyCardToken && (
                              <button
                                type="button"
                                className="btn-clean-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                title={getTranslation(lang, 'ui.digitalWallet.cardModalBtn')}
                                onClick={() => setDigitalCardTarget(c)}
                              >
                                <QrCode size={13} />
                              </button>
                            )}
                            {!c.isDefaultCashCustomer && (
                              <button
                                type="button"
                                className="btn-clean-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                title={lTr('adjustPointsBtn')}
                                onClick={() => {
                                  setAdjustTarget(c);
                                  setAdjustPointsInput('');
                                  setAdjustNotes('');
                                }}
                              >
                                <SlidersHorizontal size={13} />
                              </button>
                            )}
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
      ) : (
        <div className="transactions-table-card">
          <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground m-0 flex items-center gap-2">
                <Award size={16} className="text-amber-500" />
                <span>{lTr('historyTitle')}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 m-0">{lTr('historySubtitle')}</p>
            </div>
          </div>
          <div className="table-responsive">
            <table className="custom-data-table">
              <thead>
                <tr>
                  <th>{lTr('colDate')}</th>
                  <th>{lTr('colCustomer')}</th>
                  <th>{lTr('colType')}</th>
                  <th>{lTr('colInvoiceReturn')}</th>
                  <th>{lTr('colProfitBasis')}</th>
                  <th>{lTr('colPointsChange')}</th>
                  <th>{lTr('colBalanceAfter')}</th>
                  <th>{lTr('colBy')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-muted-foreground" style={{ textAlign: 'center', padding: '44px 20px' }}>
                      <div className="font-bold text-foreground text-sm mb-1">{lTr('noHistoryTitle')}</div>
                      <div className="text-xs text-muted-foreground">{lTr('noHistoryDesc')}</div>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map(tx => {
                    const meta = getTxTypeMeta(tx.type);
                    const isPositive = tx.pointsChange >= 0;
                    return (
                      <tr key={tx.id}>
                        <td className="text-xs font-mono tabular-nums text-muted-foreground" dir="ltr">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="font-bold text-foreground text-sm">
                          <span dir="auto">{tx.customerName}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${meta.cls}`}>
                            {meta.icon}
                            <span>{meta.label}</span>
                          </span>
                        </td>
                        <td className="font-mono text-xs font-semibold text-primary" dir="ltr">
                          {tx.rmaNumber ? `${tx.rmaNumber} (${tx.invoiceNumber || '—'})` : (tx.invoiceNumber || tx.notes || '—')}
                        </td>
                        <td className="font-mono text-xs tabular-nums text-muted-foreground" dir="ltr">
                          {tx.profitBasis > 0 ? formatMoney(tx.profitBasis) : '—'}
                        </td>
                        <td className={`font-mono text-xs font-extrabold tabular-nums ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                          {isPositive ? `+${tx.pointsChange.toLocaleString('en-US')}` : tx.pointsChange.toLocaleString('en-US')}
                        </td>
                        <td className="font-mono text-xs font-bold tabular-nums text-foreground" dir="ltr">
                          {tx.balanceAfter.toLocaleString('en-US')} {lTr('pointsUnit')}
                        </td>
                        <td className="text-xs text-muted-foreground">{tx.createdBy}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Points Adjustment Modal */}
      {adjustTarget && (
        <ModalBackdropPortal onClose={() => setAdjustTarget(null)} dir={isAr ? 'rtl' : 'ltr'}>
          <div
            className="bg-card border border-border rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground m-0">
                {lTr('adjustPointsBtn')} — {adjustTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleConfirmAdjustPoints} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {lTr('colPointsChange')} (+ / -)
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={adjustPointsInput}
                  onChange={(e) => setAdjustPointsInput(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-mono tabular-nums text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {isAr ? 'السبب / الملاحظات' : 'Reason / Notes'}
                </label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="btn-clean-secondary"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="btn-clean-primary">
                  {isAr ? 'تأكيد التعديل' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

      {/* New Customer Registration Modal */}
      <NewCustomerModal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        lang={lang}
        onSubmit={(newCustomer) => {
          const next = [newCustomer, ...customers];
          setCustomers(next);
          saveStoredCustomers(next);
          syncCustomersToBackend([newCustomer]).then(() => {
            setCustomers(getStoredCustomers());
          }).catch(() => {});
          setIsNewCustomerModalOpen(false);
          showToast(
            isAr
              ? `تم تسجيل العميل (${newCustomer.name}) بنجاح!`
              : `Customer (${newCustomer.name}) registered successfully!`
          );
        }}
      />

      {/* Digital Loyalty Card Share Modal */}
      <DigitalLoyaltyCardModal
        isOpen={Boolean(digitalCardTarget)}
        onClose={() => setDigitalCardTarget(null)}
        customer={digitalCardTarget}
        lang={lang}
      />
    </div>
  );
}
