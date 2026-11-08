import React, { useState } from 'react';
import { getStoredCustomers, saveStoredCustomers } from '../../services/storageService';
import NewCustomerModal, { CustomerData } from '../modals/NewCustomerModal';
import { useSettings } from '../../context/settings-context';
import { 
  Users, 
  Award, 
  CreditCard, 
  DollarSign, 
  Phone, 
  Search, 
  Plus, 
  Gift, 
  CheckCircle2, 
  AlertTriangle,
  Star,
  MapPin,
  TrendingUp
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
}

interface CustomersLoyaltyViewProps {
  lang: 'en' | 'ar';
}

export default function CustomersLoyaltyView({ lang }: CustomersLoyaltyViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const formatCustomerMoney = (val: number) => {
    return formatMoney(val);
  };

  const [customers, setCustomers] = useState<CustomerRecord[]>(() => {
    return getStoredCustomers();
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState('');
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleRedeemPoints = (id: string) => {
    const updated = customers.map(c => {
      if (c.id === id && c.loyaltyPoints >= 100) {
        return { ...c, loyaltyPoints: c.loyaltyPoints - 100 };
      }
      return c;
    });
    setCustomers(updated);
    saveStoredCustomers(updated);
    showToast(isAr ? `تم استبدال 100 نقطة ولاء بخصم نقدي مباشر بقيمة ${formatMoney(10)}!` : `Redeemed 100 points for a ${formatMoney(10)} discount coupon!`);
  };

  const filtered = customers.filter(c => {
    const matchesTier = tierFilter === 'ALL' || c.loyaltyTier === tierFilter;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesSearch;
  });

  const totalDebt = customers.reduce((acc, c) => acc + c.currentBalance, 0);
  const totalPoints = customers.reduce((acc, c) => acc + c.loyaltyPoints, 0);
  const vipCount = customers.filter(c => c.loyaltyTier === 'GOLD' || c.loyaltyTier === 'PLATINUM').length;

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
            <span>{isAr ? 'العملاء والمالية / دليل العملاء وسقوف الائتمان وبرنامج الولاء' : 'Commercial / Customer Accounts, Credit Limits & Loyalty Rewards'}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
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
            <div className="module-kpi-value font-mono" style={{ color: '#ef4444' }}>
              {formatCustomerMoney(totalDebt)}
            </div>
          </div>
          <div className="module-kpi-icon rose">
            <CreditCard size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'حسابات العملاء النشطة' : 'Active Accounts'}</span>
            <div className="module-kpi-value">
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
            <div className="module-kpi-value" style={{ color: '#fbbf24' }}>
              {totalPoints.toLocaleString()} <span className="kpi-sub-unit">{isAr ? 'نقطة' : 'pts'}</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Award size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'عملاء الفئة المميزة VIP' : 'VIP Tier Accounts'}</span>
            <div className="module-kpi-value">
              {vipCount} <span className="kpi-sub-unit">{isAr ? 'عملاء' : 'clients'}</span>
            </div>
          </div>
          <div className="module-kpi-icon purple">
            <Star size={20} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="module-toolbar">
        <div className="module-search-box">
          <Search size={16} />
          <input 
            type="text" 
            placeholder={isAr ? 'بحث بالاسم، رقم الهاتف، أو كود العميل...' : 'Search customer name, phone, code...'} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

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
              className={`filter-pill ${tierFilter === f.id ? 'active' : ''}`}
              onClick={() => setTierFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="transactions-table-card">
        <div className="table-responsive">
          <table className="custom-data-table">
            <thead>
              <tr>
                <th>{isAr ? 'كود العميل' : 'Customer Code'}</th>
                <th>{isAr ? 'اسم العميل' : 'Customer Name'}</th>
                <th>{isAr ? 'الهاتف والمدينة' : 'Phone & Location'}</th>
                <th>{isAr ? 'فئة الولاء' : 'Loyalty Tier'}</th>
                <th>{isAr ? 'نقاط الولاء' : 'Reward Points'}</th>
                <th>{isAr ? 'الحد الائتماني' : 'Credit Limit'}</th>
                <th>{isAr ? 'الرصيد المستحق (الدين)' : 'Outstanding Debt'}</th>
                <th>{isAr ? 'المكافأة' : 'Rewards'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    {isAr ? 'سجل العملاء فارغ حالياً - النظام صافٍ وجاهز لتسجيل العملاء الجدد' : 'Customer registry is clean. Ready to enroll new clients.'}
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{c.code}</td>
                  <td style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}><span dir="auto">{c.name}</span></td>
                  <td>
                    <span style={{ display: 'block', fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>{c.phone}</span>
                    <span dir="auto" style={{ fontSize: '12px', color: '#64748b' }}>{c.city}</span>
                  </td>
                  <td>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: c.loyaltyTier === 'PLATINUM' ? 'var(--primary-light)' :
                                  c.loyaltyTier === 'GOLD' ? '#fffbeb' :
                                  c.loyaltyTier === 'SILVER' ? '#f1f5f9' : '#fff7ed',
                      color: c.loyaltyTier === 'PLATINUM' ? 'var(--primary)' :
                             c.loyaltyTier === 'GOLD' ? '#b45309' :
                             c.loyaltyTier === 'SILVER' ? '#475569' : '#c2410c',
                      border: `1px solid ${c.loyaltyTier === 'PLATINUM' ? 'var(--primary-border)' :
                                           c.loyaltyTier === 'GOLD' ? '#fde68a' :
                                           c.loyaltyTier === 'SILVER' ? '#e2e8f0' : '#ffedd5'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Star size={12} />
                      <span>{c.loyaltyTier}</span>
                    </span>
                  </td>
                  <td style={{ fontWeight: 800, color: '#b45309' }}>
                    {c.loyaltyPoints.toLocaleString()} {isAr ? 'نقطة' : 'pts'}
                  </td>
                  <td style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>
                    {formatCustomerMoney(c.creditLimit)}
                  </td>
                  <td>
                    <strong style={{ fontSize: '14px', color: c.currentBalance > 0 ? '#ef4444' : '#34d399' }}>
                      {formatCustomerMoney(c.currentBalance)}
                    </strong>
                  </td>
                  <td>
                    <button 
                      type="button"
                      className="btn-clean-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => handleRedeemPoints(c.id)}
                      disabled={c.loyaltyPoints < 100}
                    >
                      <Gift size={13} style={{ color: '#fbbf24' }} />
                      <span>{isAr ? 'استبدال 100 نقطة' : 'Redeem 100 pts'}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Customer Registration Modal */}
      <NewCustomerModal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        lang={lang}
        onSubmit={(newCustomer) => {
          const next = [newCustomer, ...customers];
          setCustomers(next);
          saveStoredCustomers(next);
          setIsNewCustomerModalOpen(false);
          showToast(
            isAr
              ? `تم تسجيل العميل (${newCustomer.name}) بنجاح!`
              : `Customer (${newCustomer.name}) registered successfully!`
          );
        }}
      />
    </div>
  );
}
