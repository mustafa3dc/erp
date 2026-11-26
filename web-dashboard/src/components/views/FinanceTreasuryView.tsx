import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Plus,
  CheckCircle2,
  CreditCard,
  Landmark,
  ArrowRightLeft,
  Pencil,
  EyeOff,
  Eye,
  X,
  AlertCircle
} from 'lucide-react';
import {
  fetchTreasuryAccountsList,
  fetchTreasuryVouchers,
  createReceiptVoucher,
  createPaymentVoucher,
  transferTreasuryFunds,
  createTreasuryAccount,
  updateTreasuryAccount,
  toggleTreasuryAccountActive,
  formatTreasuryErrorMessage,
  TreasuryAccountRecord,
  TreasuryAccountType,
  TreasuryVoucherRecord
} from '../../services/treasuryService';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';
import { ModalBackdropPortal } from '../ui/dialog';

interface FinanceTreasuryViewProps {
  lang: 'en' | 'ar';
  initialTab?: 'ACCOUNTS' | 'VOUCHERS';
}

export default function FinanceTreasuryView({ lang, initialTab = 'ACCOUNTS' }: FinanceTreasuryViewProps) {
  const isAr = lang === 'ar';
  const { financialSettings, settings, formatMoney } = useSettings();
  const isIqdBase = financialSettings.baseCurrency.code === 'IQD' || settings?.baseCurrency === 'IQD';

  const [accounts, setAccounts] = useState<TreasuryAccountRecord[]>([]);
  const [vouchers, setVouchers] = useState<TreasuryVoucherRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'ACCOUNTS' | 'VOUCHERS'>(initialTab);
  const [showHiddenAccounts, setShowHiddenAccounts] = useState(false);
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<'ALL' | 'RECEIPT' | 'PAYMENT' | 'TRANSFER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Receipt / Payment Voucher Modal State
  const [voucherModalMode, setVoucherModalMode] = useState<'RECEIPT' | 'PAYMENT' | null>(null);
  const [voucherAccountId, setVoucherAccountId] = useState('');
  const [voucherAmount, setVoucherAmount] = useState<number>(0);
  const [voucherPartyName, setVoucherPartyName] = useState('');
  const [voucherReference, setVoucherReference] = useState('');
  const [voucherNotes, setVoucherNotes] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [voucherError, setVoucherError] = useState('');
  const [isSubmittingVoucher, setIsSubmittingVoucher] = useState(false);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferReference, setTransferReference] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferError, setTransferError] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Add / Edit Account Modal State
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TreasuryAccountRecord | null>(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<TreasuryAccountType>('Cashbox');
  const [accCurrency, setAccCurrency] = useState(financialSettings.baseCurrency.code || 'IQD');
  const [accInitialBalance, setAccInitialBalance] = useState<number>(0);
  const [accError, setAccError] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const loadTreasuryData = useCallback(async () => {
    const [accList, voucherRes] = await Promise.all([
      fetchTreasuryAccountsList(true),
      fetchTreasuryVouchers({ page: 1, pageSize: 100 })
    ]);
    setAccounts(accList);
    setVouchers(voucherRes.items);
  }, []);

  useEffect(() => {
    loadTreasuryData();
    const handler = () => {
      loadTreasuryData();
    };
    window.addEventListener('erp_treasury_updated', handler);
    window.addEventListener('erp_purchases_updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('erp_treasury_updated', handler);
      window.removeEventListener('erp_purchases_updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [loadTreasuryData]);

  const activeAccounts = accounts.filter(a => a.isActive);
  const hiddenCount = accounts.filter(a => !a.isActive).length;
  const displayedAccounts = showHiddenAccounts ? accounts : activeAccounts;

  const getAccountDisplayName = (acc: TreasuryAccountRecord) => {
    if (isAr) return acc.nameAr || acc.name;
    return acc.nameEn || acc.name;
  };

  const getAccountTypeLabel = (type: TreasuryAccountType) => {
    if (type === 'BankAccount') return getTranslation(lang, 'finance.accountTypeBank');
    if (type === 'DigitalWallet') return getTranslation(lang, 'finance.accountTypeWallet');
    return getTranslation(lang, 'finance.accountTypeCashbox');
  };

  // Liquidity totals from ACTIVE accounts only
  const totalLiquidityPrimary = activeAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
  const cashVaultsPrimary = activeAccounts
    .filter(a => a.accountType === 'Cashbox')
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const bankBalancesPrimary = activeAccounts
    .filter(a => a.accountType === 'BankAccount')
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const walletBalancesPrimary = activeAccounts
    .filter(a => a.accountType === 'DigitalWallet')
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const convertSecondary = (val: number) => (isIqdBase ? val / 1520 : val * 1520);

  const openVoucherModal = (mode: 'RECEIPT' | 'PAYMENT') => {
    setVoucherModalMode(mode);
    setVoucherAccountId(activeAccounts[0]?.id || '');
    setVoucherAmount(0);
    setVoucherPartyName('');
    setVoucherReference('');
    setVoucherNotes('');
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setVoucherError('');
  };

  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherModalMode || isSubmittingVoucher) return;
    setVoucherError('');

    if (!voucherAccountId) {
      setVoucherError(formatTreasuryErrorMessage({ errorCode: 'ERR_TREASURY_ACCOUNT_REQUIRED' }, lang));
      return;
    }
    if (voucherAmount <= 0) {
      setVoucherError(formatTreasuryErrorMessage({ errorCode: 'ERR_INVALID_AMOUNT' }, lang));
      return;
    }

    const chosenAcc = activeAccounts.find(a => a.id === voucherAccountId);
    if (voucherModalMode === 'PAYMENT' && chosenAcc && chosenAcc.currentBalance < voucherAmount) {
      setVoucherError(formatTreasuryErrorMessage({ errorCode: 'ERR_INSUFFICIENT_TREASURY_BALANCE' }, lang));
      return;
    }

    setIsSubmittingVoucher(true);
    try {
      const payload = {
        accountId: voucherAccountId,
        amount: voucherAmount,
        partyName: voucherPartyName.trim() || undefined,
        reference: voucherReference.trim() || undefined,
        notes: voucherNotes.trim() || undefined,
        voucherDate
      };

      const created =
        voucherModalMode === 'RECEIPT'
          ? await createReceiptVoucher(payload)
          : await createPaymentVoucher(payload);

      await loadTreasuryData();
      setVoucherModalMode(null);
      showToast(
        getTranslation(
          lang,
          voucherModalMode === 'RECEIPT' ? 'finance.receiptCreatedToast' : 'finance.paymentCreatedToast'
        )
          .replace('{voucher}', created.referenceNumber)
          .replace('{amount}', formatMoney(created.amount))
      );
    } catch (err: any) {
      setVoucherError(formatTreasuryErrorMessage(err, lang));
    } finally {
      setIsSubmittingVoucher(false);
    }
  };

  const openTransferModal = () => {
    setTransferFromId(activeAccounts[0]?.id || '');
    setTransferToId(activeAccounts[1]?.id || activeAccounts[0]?.id || '');
    setTransferAmount(0);
    setTransferReference('');
    setTransferNotes('');
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferError('');
    setIsTransferModalOpen(true);
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingTransfer) return;
    setTransferError('');

    if (!transferFromId || !transferToId) {
      setTransferError(formatTreasuryErrorMessage({ errorCode: 'ERR_TREASURY_ACCOUNT_REQUIRED' }, lang));
      return;
    }
    if (transferFromId === transferToId) {
      setTransferError(formatTreasuryErrorMessage({ errorCode: 'ERR_SAME_TREASURY_ACCOUNT' }, lang));
      return;
    }
    if (transferAmount <= 0) {
      setTransferError(formatTreasuryErrorMessage({ errorCode: 'ERR_INVALID_AMOUNT' }, lang));
      return;
    }
    const sourceAcc = activeAccounts.find(a => a.id === transferFromId);
    if (sourceAcc && sourceAcc.currentBalance < transferAmount) {
      setTransferError(formatTreasuryErrorMessage({ errorCode: 'ERR_INSUFFICIENT_TREASURY_BALANCE' }, lang));
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      const res = await transferTreasuryFunds({
        fromAccountId: transferFromId,
        toAccountId: transferToId,
        amount: transferAmount,
        reference: transferReference.trim() || undefined,
        notes: transferNotes.trim() || undefined,
        voucherDate: transferDate
      });
      await loadTreasuryData();
      setIsTransferModalOpen(false);
      showToast(
        getTranslation(lang, 'finance.transferCreatedToast')
          .replace('{ref}', res.transferRef)
          .replace('{amount}', formatMoney(transferAmount))
      );
    } catch (err: any) {
      setTransferError(formatTreasuryErrorMessage(err, lang));
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const openCreateAccountModal = () => {
    setEditingAccount(null);
    setAccName('');
    setAccType('DigitalWallet');
    setAccCurrency(financialSettings.baseCurrency.code || 'IQD');
    setAccInitialBalance(0);
    setAccError('');
    setAccountModalOpen(true);
  };

  const openEditAccountModal = (acc: TreasuryAccountRecord) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.accountType);
    setAccCurrency(acc.currency || financialSettings.baseCurrency.code || 'IQD');
    setAccInitialBalance(acc.currentBalance);
    setAccError('');
    setAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingAccount) return;
    setAccError('');

    if (!accName.trim()) {
      setAccError(formatTreasuryErrorMessage({ errorCode: 'ERR_TREASURY_ACCOUNT_NAME_REQUIRED' }, lang));
      return;
    }

    setIsSavingAccount(true);
    try {
      if (editingAccount) {
        await updateTreasuryAccount(editingAccount.id, {
          name: accName.trim(),
          accountType: accType,
          currency: accCurrency
        });
        showToast(getTranslation(lang, 'finance.accountUpdatedToast'));
      } else {
        await createTreasuryAccount({
          name: accName.trim(),
          accountType: accType,
          currency: accCurrency,
          initialBalance: accInitialBalance
        });
        showToast(getTranslation(lang, 'finance.accountCreatedToast'));
      }
      await loadTreasuryData();
      setAccountModalOpen(false);
    } catch (err: any) {
      setAccError(formatTreasuryErrorMessage(err, lang));
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleToggleAccountVisibility = async (acc: TreasuryAccountRecord) => {
    try {
      await toggleTreasuryAccountActive(acc.id);
      await loadTreasuryData();
      showToast(
        getTranslation(lang, acc.isActive ? 'finance.accountHiddenToast' : 'finance.accountRestoredToast')
      );
    } catch (err: any) {
      showToast(formatTreasuryErrorMessage(err, lang));
    }
  };

  const filteredVouchers = vouchers.filter(v => {
    const matchesType =
      voucherTypeFilter === 'ALL' ||
      (voucherTypeFilter === 'TRANSFER'
        ? v.transactionType === 'TRANSFER_OUT' || v.transactionType === 'TRANSFER_IN'
        : v.transactionType === voucherTypeFilter);
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      v.referenceNumber.toLowerCase().includes(q) ||
      v.partyName.toLowerCase().includes(q) ||
      v.cashBoxName.toLowerCase().includes(q) ||
      v.notes.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const getVoucherBadge = (txType: string) => {
    switch (txType) {
      case 'RECEIPT':
        return {
          label: getTranslation(lang, 'finance.receiptVoucher'),
          isInflow: true,
          cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
        };
      case 'REFUND':
        return {
          label: getTranslation(lang, 'finance.refundVoucher'),
          isInflow: true,
          cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25'
        };
      case 'TRANSFER_IN':
        return {
          label: getTranslation(lang, 'finance.transferInVoucher'),
          isInflow: true,
          cls: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25'
        };
      case 'TRANSFER_OUT':
        return {
          label: getTranslation(lang, 'finance.transferOutVoucher'),
          isInflow: false,
          cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25'
        };
      case 'PAYMENT':
      default:
        return {
          label: getTranslation(lang, 'finance.paymentVoucher'),
          isInflow: false,
          cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25'
        };
    }
  };

  const selectedVoucherAccount = activeAccounts.find(a => a.id === voucherAccountId) || null;
  const selectedTransferSource = activeAccounts.find(a => a.id === transferFromId) || null;

  return (
    <div className="view-content-wrapper fade-in">
      {toastMsg && (
        <div className="fixed bottom-6 start-6 z-50 flex items-center gap-2 px-4 py-3 bg-card text-foreground border border-border rounded-xl shadow-2xl text-xs font-bold">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Module Context Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <Wallet size={15} style={{ color: 'var(--primary)' }} />
            <span>{getTranslation(lang, 'finance.moduleSubtitle')}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          <button
            type="button"
            className="btn-clean-primary"
            onClick={() => openVoucherModal('RECEIPT')}
          >
            <ArrowDownLeft size={15} />
            <span>{getTranslation(lang, 'finance.receiptVoucher')}</span>
          </button>
          <button
            type="button"
            className="btn-clean-secondary"
            onClick={() => openVoucherModal('PAYMENT')}
          >
            <ArrowUpRight size={15} />
            <span>{getTranslation(lang, 'finance.paymentVoucher')}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'finance.totalLiquidityLabel')}</span>
            <div className="module-kpi-value font-mono tabular-nums" style={{ color: '#34d399' }}>
              {formatMoney(totalLiquidityPrimary)}
            </div>
            {financialSettings.isMultiCurrencyEnabled && financialSettings.secondaryCurrency && (
              <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                ≈ {convertSecondary(totalLiquidityPrimary).toLocaleString(undefined, {
                  minimumFractionDigits: financialSettings.secondaryCurrency.decimals,
                  maximumFractionDigits: financialSettings.secondaryCurrency.decimals
                })} {financialSettings.secondaryCurrency.symbol}
              </div>
            )}
          </div>
          <div className="module-kpi-icon emerald">
            {isIqdBase ? (
              <span style={{ fontWeight: 800, fontSize: '13px', color: '#059669' }}>د.ع</span>
            ) : (
              <DollarSign size={20} />
            )}
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'finance.vaultCashLabel')}</span>
            <div className="module-kpi-value font-mono tabular-nums">
              {formatMoney(cashVaultsPrimary)}
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Wallet size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'finance.bankBalancesLabel')}</span>
            <div className="module-kpi-value font-mono tabular-nums" style={{ color: 'var(--primary)' }}>
              {formatMoney(bankBalancesPrimary)}
            </div>
          </div>
          <div className="module-kpi-icon cyan">
            <Landmark size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'finance.walletBalancesLabel')}</span>
            <div className="module-kpi-value font-mono tabular-nums">
              {formatMoney(walletBalancesPrimary)}
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <CreditCard size={20} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="module-toolbar flex-wrap gap-3">
        <div className="module-filter-pills">
          <button
            type="button"
            className={`filter-pill ${activeTab === 'ACCOUNTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('ACCOUNTS')}
          >
            {getTranslation(lang, 'finance.tabAccounts')}
          </button>
          <button
            type="button"
            className={`filter-pill ${activeTab === 'VOUCHERS' ? 'active' : ''}`}
            onClick={() => setActiveTab('VOUCHERS')}
          >
            {getTranslation(lang, 'finance.tabVouchers')}
          </button>
        </div>

        {activeTab === 'ACCOUNTS' && (
          <div className="flex flex-wrap items-center gap-2 ms-auto">
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowHiddenAccounts(prev => !prev)}
                className="h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {showHiddenAccounts ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>
                  {getTranslation(lang, showHiddenAccounts ? 'finance.hideInactiveBtn' : 'finance.showHiddenBtn').replace('{count}', String(hiddenCount))}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={openTransferModal}
              disabled={activeAccounts.length < 2}
              className="h-9 px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer transition-colors"
            >
              <ArrowRightLeft size={14} className="text-primary" />
              <span>{getTranslation(lang, 'finance.transferFundsBtn')}</span>
            </button>
            <button
              type="button"
              onClick={openCreateAccountModal}
              className="h-9 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              <Plus size={14} />
              <span>{getTranslation(lang, 'finance.addAccountBtn')}</span>
            </button>
          </div>
        )}

        {activeTab === 'VOUCHERS' && (
          <div className="flex flex-wrap items-center gap-2 ms-auto">
            <select
              value={voucherTypeFilter}
              onChange={e => setVoucherTypeFilter(e.target.value as any)}
              className="h-9 px-3 rounded-xl border border-border bg-card text-foreground text-xs font-semibold outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">{getTranslation(lang, 'finance.filterAllTypes')}</option>
              <option value="RECEIPT">{getTranslation(lang, 'finance.receiptVoucher')}</option>
              <option value="PAYMENT">{getTranslation(lang, 'finance.paymentVoucher')}</option>
              <option value="TRANSFER">{getTranslation(lang, 'finance.filterTransfers')}</option>
            </select>
            <div className="module-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder={getTranslation(lang, 'finance.searchVouchersPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tab 1: Treasury Accounts Cards */}
      {activeTab === 'ACCOUNTS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px' }}>
          {displayedAccounts.map(acc => (
            <div
              key={acc.id}
              className={`module-kpi-card transition-opacity ${!acc.isActive ? 'opacity-60' : ''}`}
              style={{ flexDirection: 'column', alignItems: 'stretch', padding: '18px', gap: '12px' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {getAccountTypeLabel(acc.accountType)}
                </span>

                <div className="flex items-center gap-1.5">
                  {!acc.isActive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                      {getTranslation(lang, 'finance.hiddenAccountBadge')}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    {acc.currency}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="m-0 text-sm font-extrabold text-foreground">
                  {getAccountDisplayName(acc)}
                </h3>
                {acc.code && (
                  <span className="text-[11px] font-mono text-primary font-semibold">{acc.code}</span>
                )}
              </div>

              <div className="border-t border-border pt-2.5 mt-1 flex items-end justify-between gap-2">
                <div>
                  <div className="text-xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMoney(acc.currentBalance)}
                  </div>
                  {financialSettings.isMultiCurrencyEnabled && financialSettings.secondaryCurrency && (
                    <div className="text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                      ≈ {convertSecondary(acc.currentBalance).toLocaleString(undefined, {
                        minimumFractionDigits: financialSettings.secondaryCurrency.decimals,
                        maximumFractionDigits: financialSettings.secondaryCurrency.decimals
                      })} {financialSettings.secondaryCurrency.symbol}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditAccountModal(acc)}
                    title={getTranslation(lang, 'finance.editAccountTooltip')}
                    className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAccountVisibility(acc)}
                    title={getTranslation(lang, acc.isActive ? 'finance.hideAccountTooltip' : 'finance.restoreAccountTooltip')}
                    className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {acc.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Vouchers Table */}
      {activeTab === 'VOUCHERS' && (
        <div className="transactions-table-card">
          <div className="table-responsive">
            <table className="custom-data-table">
              <thead>
                <tr>
                  <th>{getTranslation(lang, 'finance.colVoucherNo')}</th>
                  <th>{getTranslation(lang, 'finance.colType')}</th>
                  <th>{getTranslation(lang, 'finance.colParty')}</th>
                  <th>{getTranslation(lang, 'finance.colAccount')}</th>
                  <th>{getTranslation(lang, 'finance.colAmount')}</th>
                  <th>{getTranslation(lang, 'finance.colBalanceAfter')}</th>
                  <th>{getTranslation(lang, 'finance.colTimestamp')}</th>
                  <th>{getTranslation(lang, 'finance.colNotes')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                      {getTranslation(lang, 'finance.emptyVouchers')}
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map(v => {
                    const badge = getVoucherBadge(v.transactionType);
                    return (
                      <tr key={v.id}>
                        <td className="font-mono font-bold text-primary">{v.referenceNumber}</td>
                        <td>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="font-semibold text-foreground text-xs">
                          <bdi dir="auto">{v.partyName || '—'}</bdi>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          <bdi dir="auto">{v.cashBoxName || '—'}</bdi>
                        </td>
                        <td>
                          <strong className={`font-mono tabular-nums text-xs font-extrabold ${badge.isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {badge.isInflow ? '+' : '-'}{formatMoney(v.amount)}
                          </strong>
                        </td>
                        <td className="font-mono tabular-nums text-xs text-muted-foreground">
                          {v.balanceAfter ? formatMoney(v.balanceAfter) : '—'}
                        </td>
                        <td className="text-xs text-muted-foreground font-mono">
                          {new Date(v.voucherDate || v.createdAt).toLocaleString()}
                        </td>
                        <td className="text-xs text-muted-foreground max-w-[220px] truncate" title={v.notes}>
                          {v.notes || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receipt / Payment Voucher Modal */}
      {voucherModalMode && (
        <ModalBackdropPortal onClose={() => !isSubmittingVoucher && setVoucherModalMode(null)} dir={isAr ? 'rtl' : 'ltr'}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 text-foreground" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  voucherModalMode === 'RECEIPT'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                }`}>
                  {voucherModalMode === 'RECEIPT' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm m-0">
                    {getTranslation(lang, voucherModalMode === 'RECEIPT' ? 'finance.receiptModalTitle' : 'finance.paymentModalTitle')}
                  </h3>
                  <p className="text-[11px] text-muted-foreground m-0 mt-0.5">
                    {getTranslation(lang, voucherModalMode === 'RECEIPT' ? 'finance.receiptModalSubtitle' : 'finance.paymentModalSubtitle')}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => !isSubmittingVoucher && setVoucherModalMode(null)} className="p-1 hover:bg-muted rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitVoucher} className="space-y-3">
              {voucherError && (
                <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{voucherError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'finance.targetAccountLabel')} <span className="text-destructive">*</span>
                </label>
                <select
                  value={voucherAccountId}
                  onChange={e => setVoucherAccountId(e.target.value)}
                  required
                  className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold outline-none focus:border-primary cursor-pointer"
                >
                  {activeAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {getAccountDisplayName(acc)} ({formatMoney(acc.currentBalance)})
                    </option>
                  ))}
                </select>
                {selectedVoucherAccount && (
                  <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
                    {getTranslation(lang, 'purchasesModule.availableBalanceShort')}: {formatMoney(selectedVoucherAccount.currentBalance)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'finance.amountLabel')} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={voucherAmount || ''}
                    onChange={e => setVoucherAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground font-mono tabular-nums font-bold text-xs outline-none focus:border-primary"
                  />
                  {voucherAmount > 0 && (
                    <div className="text-[11px] font-mono tabular-nums text-primary font-semibold" dir="ltr">
                      {voucherAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} {financialSettings.baseCurrency.symbol}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'finance.voucherDateLabel')}
                  </label>
                  <input
                    type="date"
                    value={voucherDate}
                    onChange={e => setVoucherDate(e.target.value)}
                    className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  {getTranslation(lang, voucherModalMode === 'RECEIPT' ? 'finance.payerLabel' : 'finance.payeeLabel')}
                </label>
                <input
                  type="text"
                  value={voucherPartyName}
                  onChange={e => setVoucherPartyName(e.target.value)}
                  placeholder={getTranslation(lang, 'finance.partyPlaceholder')}
                  className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'finance.referenceLabel')}
                </label>
                <input
                  type="text"
                  value={voucherReference}
                  onChange={e => setVoucherReference(e.target.value)}
                  placeholder={getTranslation(lang, 'finance.referencePlaceholder')}
                  className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-mono outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'finance.notesLabel')}
                </label>
                <textarea
                  rows={2}
                  value={voucherNotes}
                  onChange={e => setVoucherNotes(e.target.value)}
                  placeholder={getTranslation(lang, 'finance.notesPlaceholder')}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isSubmittingVoucher}
                  onClick={() => setVoucherModalMode(null)}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold"
                >
                  {getTranslation(lang, 'actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVoucher}
                  className={`px-4 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-50 ${
                    voucherModalMode === 'RECEIPT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary/90'
                  }`}
                >
                  {getTranslation(lang, voucherModalMode === 'RECEIPT' ? 'finance.confirmReceiptBtn' : 'finance.confirmPaymentBtn')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Internal Transfer Modal */}
      {isTransferModalOpen && (
        <ModalBackdropPortal onClose={() => !isSubmittingTransfer && setIsTransferModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 text-foreground" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm m-0">{getTranslation(lang, 'finance.transferModalTitle')}</h3>
                  <p className="text-[11px] text-muted-foreground m-0 mt-0.5">{getTranslation(lang, 'finance.transferModalSubtitle')}</p>
                </div>
              </div>
              <button type="button" onClick={() => !isSubmittingTransfer && setIsTransferModalOpen(false)} className="p-1 hover:bg-muted rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitTransfer} className="space-y-3">
              {transferError && (
                <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{transferError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'finance.fromAccountLabel')} <span className="text-destructive">*</span>
                </label>
                <select
                  value={transferFromId}
                  onChange={e => setTransferFromId(e.target.value)}
                  className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold outline-none focus:border-primary cursor-pointer"
                >
                  {activeAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {getAccountDisplayName(acc)} ({formatMoney(acc.currentBalance)})
                    </option>
                  ))}
                </select>
                {selectedTransferSource && (
                  <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
                    {getTranslation(lang, 'purchasesModule.availableBalanceShort')}: {formatMoney(selectedTransferSource.currentBalance)}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'finance.toAccountLabel')} <span className="text-destructive">*</span>
                </label>
                <select
                  value={transferToId}
                  onChange={e => setTransferToId(e.target.value)}
                  className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold outline-none focus:border-primary cursor-pointer"
                >
                  {activeAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {getAccountDisplayName(acc)} ({formatMoney(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'finance.amountLabel')} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={transferAmount || ''}
                    onChange={e => setTransferAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground font-mono tabular-nums font-bold text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'finance.voucherDateLabel')}
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={e => setTransferDate(e.target.value)}
                    className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'finance.notesLabel')}
                </label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  placeholder={getTranslation(lang, 'finance.notesPlaceholder')}
                  className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isSubmittingTransfer}
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold"
                >
                  {getTranslation(lang, 'actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold disabled:opacity-50"
                >
                  {getTranslation(lang, 'finance.confirmTransferBtn')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Add / Edit Account Modal */}
      {accountModalOpen && (
        <ModalBackdropPortal onClose={() => !isSavingAccount && setAccountModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 text-foreground" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-extrabold text-sm m-0">
                {getTranslation(lang, editingAccount ? 'finance.editAccountModalTitle' : 'finance.addAccountModalTitle')}
              </h3>
              <button type="button" onClick={() => !isSavingAccount && setAccountModalOpen(false)} className="p-1 hover:bg-muted rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3">
              {accError && (
                <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{accError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'finance.accountNameLabel')} <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={e => setAccName(e.target.value)}
                  placeholder={getTranslation(lang, 'finance.accountNamePlaceholder')}
                  className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'finance.accountTypeLabel')}
                  </label>
                  <select
                    value={accType}
                    onChange={e => setAccType(e.target.value as TreasuryAccountType)}
                    className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Cashbox">{getTranslation(lang, 'finance.accountTypeCashbox')}</option>
                    <option value="BankAccount">{getTranslation(lang, 'finance.accountTypeBank')}</option>
                    <option value="DigitalWallet">{getTranslation(lang, 'finance.accountTypeWallet')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'finance.accountCurrencyLabel')}
                  </label>
                  <select
                    value={accCurrency}
                    onChange={e => setAccCurrency(e.target.value)}
                    className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-semibold outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="IQD">IQD</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              {!editingAccount && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'finance.openingBalanceLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={accInitialBalance || ''}
                    onChange={e => setAccInitialBalance(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground font-mono tabular-nums font-bold text-xs outline-none focus:border-primary"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isSavingAccount}
                  onClick={() => setAccountModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold"
                >
                  {getTranslation(lang, 'actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold disabled:opacity-50"
                >
                  {getTranslation(lang, 'actions.save')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}
    </div>
  );
}
