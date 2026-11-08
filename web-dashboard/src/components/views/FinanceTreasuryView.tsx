import React, { useState, useEffect } from 'react';
import { 
  getStoredTreasuryAccounts, 
  saveStoredTreasuryAccounts, 
  getStoredTreasuryVouchers, 
  saveStoredTreasuryVouchers 
} from '../../services/storageService';
import { 
  Wallet, 
  DollarSign, 
  Building2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Search, 
  Plus, 
  CheckCircle2, 
  CreditCard,
  Landmark,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { useSettings } from '../../context/settings-context';

interface TreasuryAccount {
  id: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  type: 'CASH' | 'BANK' | 'WALLET';
  balanceUsd: number;
  balanceIqd: number;
  currency: string;
  accountNumber?: string;
}

interface Voucher {
  id: string;
  voucherNo: string;
  type: 'RECEIPT' | 'PAYMENT';
  partyName: string;
  amount: number;
  currency: 'USD' | 'IQD';
  accountName: string;
  date: string;
  notes: string;
}

interface FinanceTreasuryViewProps {
  lang: 'en' | 'ar';
  initialTab?: 'ACCOUNTS' | 'VOUCHERS';
}



export default function FinanceTreasuryView({ lang, initialTab = 'ACCOUNTS' }: FinanceTreasuryViewProps) {
  const isAr = lang === 'ar';
  const { financialSettings, settings, tenantCountryCode, formatMoney } = useSettings();
  const isIraqTenant = (tenantCountryCode === 'IQ' || settings?.tenantCountryCode === 'IQ');
  const isIqdBase = financialSettings.baseCurrency.code === 'IQD' || settings?.baseCurrency === 'IQD';

  const [accounts, setAccounts] = useState<TreasuryAccount[]>(() => {
    return getStoredTreasuryAccounts();
  });
  const [vouchers, setVouchers] = useState<Voucher[]>(() => {
    return getStoredTreasuryVouchers();
  });
  const [activeTab, setActiveTab] = useState<'ACCOUNTS' | 'VOUCHERS'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const handleTreasuryUpdate = () => {
      setAccounts(getStoredTreasuryAccounts());
    };
    window.addEventListener('erp_treasury_updated', handleTreasuryUpdate);
    window.addEventListener('storage', handleTreasuryUpdate);
    return () => {
      window.removeEventListener('erp_treasury_updated', handleTreasuryUpdate);
      window.removeEventListener('storage', handleTreasuryUpdate);
    };
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const getAccountDisplayName = (acc: TreasuryAccount) => {
    if (isAr) {
      if (acc.nameAr) return acc.nameAr;
      if (acc.name.includes('صندوق') || acc.name.includes('Cash Safe') || acc.id === 'ACC-01') {
        return 'صندوق الكاش الرئيسي';
      }
      if (acc.name.includes('مصرف') || acc.name.includes('Bank') || acc.id === 'ACC-02') {
        return 'حساب العمليات المصرفي التجاري';
      }
      if (acc.name.includes('تحويل') || acc.name.includes('Wire') || acc.id === 'ACC-03') {
        return 'حساب التحويلات والخزينة الثانوي';
      }
      if (acc.name.includes('زين كاش') || acc.name.includes('ZainCash') || acc.id === 'ACC-04') {
        return 'محفظة زين كاش التجارية';
      }
      return acc.name.replace(/\(.*?\)/g, '').trim();
    } else {
      if (acc.nameEn && !/[\u0600-\u06FF]/.test(acc.nameEn)) return acc.nameEn;
      if (acc.name.includes('صندوق') || acc.name.includes('Cash') || acc.id === 'ACC-01') {
        return 'Main Cash Safe';
      }
      if (acc.name.includes('مصرف') || acc.name.includes('Bank') || acc.id === 'ACC-02') {
        return 'Primary Commercial Bank Account';
      }
      if (acc.name.includes('تحويل') || acc.name.includes('Wire') || acc.id === 'ACC-03') {
        return 'Corporate Treasury & Wire Account';
      }
      if (acc.name.includes('زين كاش') || acc.name.includes('ZainCash') || acc.id === 'ACC-04') {
        return 'ZainCash Merchant Wallet';
      }
      const enMatch = acc.name.match(/\(([A-Za-z\s]+)\)/);
      if (enMatch && enMatch[1]) return enMatch[1];
      const stripped = acc.name.replace(/[\u0600-\u06FF()]/g, '').trim();
      return stripped || 'Main Cash Safe';
    }
  };

  // Strictly filter accounts based on regional lock:
  // ZainCash and QiCard accounts are exclusively visible when tenant is registered in Iraq (IQ)
  const visibleAccounts = accounts.filter(acc => {
    const isLocalIq = acc.name.toLowerCase().includes('zaincash') ||
                      acc.name.includes('زين كاش') ||
                      acc.name.includes('كي كارد') ||
                      acc.name.toLowerCase().includes('qi card') ||
                      acc.id === 'ACC-04';
    if (isLocalIq) {
      return isIraqTenant;
    }
    return true;
  });

  const totalLiquidityPrimary = visibleAccounts.reduce((sum, acc) => sum + (isIqdBase ? (acc.balanceIqd || 0) : (acc.balanceUsd || 0)), 0);
  const totalLiquiditySecondary = visibleAccounts.reduce((sum, acc) => sum + (isIqdBase ? (acc.balanceUsd || 0) : (acc.balanceIqd || 0)), 0);

  const cashVaultsPrimary = visibleAccounts.filter(a => a.type === 'CASH').reduce((sum, a) => sum + (isIqdBase ? (a.balanceIqd || 0) : (a.balanceUsd || 0)), 0);
  const cashVaultsSecondary = visibleAccounts.filter(a => a.type === 'CASH').reduce((sum, a) => sum + (isIqdBase ? (a.balanceUsd || 0) : (a.balanceIqd || 0)), 0);

  const bankBalancesPrimary = visibleAccounts.filter(a => a.type === 'BANK').reduce((sum, a) => sum + (isIqdBase ? (a.balanceIqd || 0) : (a.balanceUsd || 0)), 0);
  const bankBalancesSecondary = visibleAccounts.filter(a => a.type === 'BANK').reduce((sum, a) => sum + (isIqdBase ? (a.balanceUsd || 0) : (a.balanceIqd || 0)), 0);

  const walletBalancesPrimary = visibleAccounts.filter(a => a.type === 'WALLET').reduce((sum, a) => sum + (isIqdBase ? (a.balanceIqd || 0) : (a.balanceUsd || 0)), 0);
  const walletBalancesSecondary = visibleAccounts.filter(a => a.type === 'WALLET').reduce((sum, a) => sum + (isIqdBase ? (a.balanceUsd || 0) : (a.balanceIqd || 0)), 0);

  const filteredVouchers = vouchers.filter(v => 
    v.voucherNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.partyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <Wallet size={15} style={{ color: 'var(--primary)' }} />
            <span>{isAr ? 'المالية / الخزائن النقدية، الحسابات البنكية وسندات القبض والصرف' : 'Finance / Cash Vaults, Bank Accounts & Payment Vouchers'}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          <button 
            type="button"
            className="btn-clean-primary"
            onClick={() => showToast(isAr ? 'نموذج إصدار سند قبض جديد' : 'New Receipt Voucher Form')}
          >
            <ArrowDownLeft size={15} />
            <span>{isAr ? 'سند قبض (+ Receipt)' : 'Receipt Voucher'}</span>
          </button>
          <button 
            type="button"
            className="btn-clean-secondary"
            onClick={() => showToast(isAr ? 'نموذج إصدار سند صرف جديد' : 'New Payment Voucher Form')}
          >
            <ArrowUpRight size={15} />
            <span>{isAr ? 'سند صرف (- Payment)' : 'Payment Voucher'}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'إجمالي السيولة المالية' : 'Total Net Liquidity'}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#34d399' }}>
              {formatMoney(totalLiquidityPrimary)}
            </div>
            {financialSettings.isMultiCurrencyEnabled && financialSettings.secondaryCurrency && (
              <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                ≈ {totalLiquiditySecondary.toLocaleString(undefined, {
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
            <span className="module-kpi-label">{isAr ? 'الأرصدة البنكية المودعة' : 'Bank Balances'}</span>
            <div className="module-kpi-value font-mono" style={{ color: 'var(--primary)' }}>
              {formatMoney(bankBalancesPrimary)}
            </div>
            {financialSettings.isMultiCurrencyEnabled && financialSettings.secondaryCurrency && bankBalancesPrimary > 0 && (
              <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                ≈ {bankBalancesSecondary.toLocaleString(undefined, {
                  minimumFractionDigits: financialSettings.secondaryCurrency.decimals,
                  maximumFractionDigits: financialSettings.secondaryCurrency.decimals
                })} {financialSettings.secondaryCurrency.symbol}
              </div>
            )}
          </div>
          <div className="module-kpi-icon cyan">
            <Landmark size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'النقدية في القاصات المركزية' : 'Vault Cash'}</span>
            <div className="module-kpi-value font-mono">
              {formatMoney(cashVaultsPrimary)}
            </div>
            {financialSettings.isMultiCurrencyEnabled && financialSettings.secondaryCurrency && (
              <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                ≈ {cashVaultsSecondary.toLocaleString(undefined, {
                  minimumFractionDigits: financialSettings.secondaryCurrency.decimals,
                  maximumFractionDigits: financialSettings.secondaryCurrency.decimals
                })} {financialSettings.secondaryCurrency.symbol}
              </div>
            )}
          </div>
          <div className="module-kpi-icon amber">
            <Wallet size={20} />
          </div>
        </div>

        {isIraqTenant && (
          <div className="module-kpi-card">
            <div className="module-kpi-info">
              <span className="module-kpi-label">{isAr ? 'المحافظ الرقمية (زين كاش)' : 'Digital Wallets'}</span>
              <div className="module-kpi-value font-mono">
                {formatMoney(walletBalancesPrimary)}
              </div>
              {financialSettings.isMultiCurrencyEnabled && financialSettings.secondaryCurrency && walletBalancesPrimary > 0 && (
                <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                  ≈ {walletBalancesSecondary.toLocaleString(undefined, {
                    minimumFractionDigits: financialSettings.secondaryCurrency.decimals,
                    maximumFractionDigits: financialSettings.secondaryCurrency.decimals
                  })} {financialSettings.secondaryCurrency.symbol}
                </div>
              )}
            </div>
            <div className="module-kpi-icon indigo">
              <CreditCard size={20} />
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="module-toolbar">
        <div className="module-filter-pills">
          <button
            className={`filter-pill ${activeTab === 'ACCOUNTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('ACCOUNTS')}
          >
            {isAr ? ' الخزائن والحسابات البنكية' : 'Bank & Vault Accounts'}
          </button>
          <button
            className={`filter-pill ${activeTab === 'VOUCHERS' ? 'active' : ''}`}
            onClick={() => setActiveTab('VOUCHERS')}
          >
            {isAr ? ' سجل سندات القبض والصرف' : 'Voucher Ledger'}
          </button>
        </div>

        {activeTab === 'VOUCHERS' && (
          <div className="module-search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder={isAr ? 'بحث برقم السند أو اسم العميل / المورد...' : 'Search voucher #, party name...'} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Tab 1: Treasury Accounts Cards */}
      {activeTab === 'ACCOUNTS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {visibleAccounts.map(acc => (
            <div key={acc.id} className="module-kpi-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '18px', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                  {acc.type === 'CASH' ? (isAr ? 'قاصة نقدية' : 'Cash Safe') :
                   acc.type === 'BANK' ? (isAr ? 'حساب بنكي' : 'Bank Account') :
                   (isAr ? 'محفظة رقمية' : 'Digital Wallet')}
                </span>
                {financialSettings.isMultiCurrencyEnabled && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#047857',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    {acc.currency || financialSettings.baseCurrency.code}
                  </span>
                )}
              </div>

              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
                {getAccountDisplayName(acc)}
              </h3>
              {acc.accountNumber && (
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{acc.accountNumber}</span>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px' }}>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#047857' }}>
                  {(isIqdBase ? (acc.balanceIqd ?? 0) : (acc.balanceUsd ?? 0)).toLocaleString(undefined, { 
                    minimumFractionDigits: financialSettings.baseCurrency.decimals,
                    maximumFractionDigits: financialSettings.baseCurrency.decimals
                  })} {financialSettings.baseCurrency.symbol}
                </div>
                {financialSettings.isMultiCurrencyEnabled && financialSettings.secondaryCurrency && (
                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                    ≈ {(isIqdBase ? (acc.balanceUsd ?? 0) : (acc.balanceIqd ?? 0)).toLocaleString(undefined, {
                      minimumFractionDigits: financialSettings.secondaryCurrency.decimals,
                      maximumFractionDigits: financialSettings.secondaryCurrency.decimals
                    })} {financialSettings.secondaryCurrency.symbol}
                  </div>
                )}
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
                  <th>{isAr ? 'رقم السند' : 'Voucher #'}</th>
                  <th>{isAr ? 'النوع' : 'Type'}</th>
                  <th>{isAr ? 'الطرف / المستفيد' : 'Party / Recipient'}</th>
                  <th>{isAr ? 'الحساب المالي' : 'Account'}</th>
                  <th>{isAr ? `المبلغ (${financialSettings.baseCurrency.symbol})` : `Amount (${financialSettings.baseCurrency.code})`}</th>
                  <th>{isAr ? 'التاريخ والوقت' : 'Timestamp'}</th>
                  <th>{isAr ? 'البيان والملاحظات' : 'Notes'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                      {isAr ? 'سجل السندات فارغ حالياً - لم يتم إصدار أي سند قبض أو صرف بعد' : 'No payment or receipt vouchers recorded. Registry is clean.'}
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{v.voucherNo}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: v.type === 'RECEIPT' ? '#ecfdf5' : '#fef2f2',
                          color: v.type === 'RECEIPT' ? '#047857' : '#dc2626',
                          border: `1px solid ${v.type === 'RECEIPT' ? '#a7f3d0' : '#fecaca'}`
                        }}>
                          {v.type === 'RECEIPT' ? (isAr ? 'سند قبض (+)' : 'Receipt (+)') : (isAr ? 'سند صرف (-)' : 'Payment (-)')}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: '13px', fontWeight: 700 }}>{v.partyName}</strong>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                        {v.accountName.includes('صندوق') && !isAr ? 'Main Cash Safe' : (v.accountName.includes('مصرف') && !isAr ? 'Primary Bank Account' : v.accountName)}
                      </td>
                      <td>
                        <strong style={{ fontSize: '14px', fontWeight: 800, color: v.type === 'RECEIPT' ? '#047857' : '#dc2626' }}>
                          {v.type === 'RECEIPT' ? '+' : '-'}{v.amount.toLocaleString(undefined, {
                            minimumFractionDigits: financialSettings.baseCurrency.decimals,
                            maximumFractionDigits: financialSettings.baseCurrency.decimals
                          })} {financialSettings.baseCurrency.symbol}
                        </strong>
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{v.date}</td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{v.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
