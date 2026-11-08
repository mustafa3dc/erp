import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Users, 
  Layers, 
  Receipt, 
  CheckCircle2, 
  Sparkles, 
  ArrowLeft, 
  ArrowRight,
  ShieldCheck, 
  Zap, 
  Boxes, 
  Globe2,
  ChevronRight,
  Info,
  Check,
  TrendingDown,
  HelpCircle,
  Clock,
  CreditCard,
  Crown
} from 'lucide-react';

export interface PricingSelection {
  warehouses: number;
  users: number;
  wms: boolean;
  pos: boolean;
  cycle: 'monthly' | 'yearly';
  currency: 'USD' | 'IQD' | 'SAR' | 'AED';
}

interface PricingCalculatorViewProps {
  onNavigateToRegister: (params: {
    warehouses: number;
    users: number;
    wms: boolean;
    pos: boolean;
    cycle: 'monthly' | 'yearly';
    currency: string;
  }) => void;
  onNavigateToLogin: () => void;
  onNavigateToHome?: () => void;
  initialParams?: Partial<PricingSelection>;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', nameAr: 'دولار أمريكي', rateFromUsd: 1, suffix: 'USD' },
  { code: 'IQD', symbol: 'د.ع', nameAr: 'دينار عراقي', rateFromUsd: 1320, suffix: 'IQD' },
  { code: 'SAR', symbol: 'ر.س', nameAr: 'ريال سعودي', rateFromUsd: 3.75, suffix: 'SAR' },
  { code: 'AED', symbol: 'د.إ', nameAr: 'درهم إماراتي', rateFromUsd: 3.67, suffix: 'AED' }
] as const;

export default function PricingCalculatorView({
  onNavigateToRegister,
  onNavigateToLogin,
  onNavigateToHome,
  initialParams
}: PricingCalculatorViewProps) {
  // State
  const [warehouses, setWarehouses] = useState<number>(initialParams?.warehouses || 1);
  const [users, setUsers] = useState<number>(initialParams?.users || 3);
  const [wmsEnabled, setWmsEnabled] = useState<boolean>(initialParams?.wms ?? false);
  const [posEnabled, setPosEnabled] = useState<boolean>(initialParams?.pos ?? true);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>(initialParams?.cycle || 'yearly');
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'IQD' | 'SAR' | 'AED'>(
    initialParams?.currency || 'USD'
  );

  const curr = CURRENCIES.find(c => c.code === selectedCurrency) || CURRENCIES[0];

  // Pricing Unit Constants in USD (Monthly baseline)
  const BASE_PRICE_USD = 49;        // Includes 1 warehouse + 3 users + core ERP
  const EXTRA_WAREHOUSE_USD = 20;   // Each warehouse > 1
  const EXTRA_USER_USD = 8;         // Each user > 3
  const WMS_MODULE_USD = 30;        // Smart bin & rack management
  const POS_MODULE_USD = 25;        // High-speed POS & cash shifts

  // Calculations
  const calculation = useMemo(() => {
    const extraWhCount = Math.max(0, warehouses - 1);
    const extraUsersCount = Math.max(0, users - 3);

    const baseCost = BASE_PRICE_USD;
    const extraWhCost = extraWhCount * EXTRA_WAREHOUSE_USD;
    const extraUsersCost = extraUsersCount * EXTRA_USER_USD;
    const wmsCost = wmsEnabled ? WMS_MODULE_USD : 0;
    const posCost = posEnabled ? POS_MODULE_USD : 0;

    const monthlySubtotalUsd = baseCost + extraWhCost + extraUsersCost + wmsCost + posCost;

    // Apply 20% discount if yearly
    const discountRate = cycle === 'yearly' ? 0.20 : 0;
    const discountedMonthlyUsd = monthlySubtotalUsd * (1 - discountRate);
    const annualTotalUsd = discountedMonthlyUsd * 12;

    const rate = curr.rateFromUsd;
    const format = (usd: number) => {
      const converted = usd * rate;
      if (curr.code === 'IQD') {
        return Math.round(converted / 1000) * 1000;
      }
      return Math.round(converted);
    };

    return {
      monthlySubtotalUsd,
      discountedMonthlyUsd,
      annualTotalUsd,
      monthlySubtotalDisplay: format(monthlySubtotalUsd),
      effectiveMonthlyDisplay: format(discountedMonthlyUsd),
      annualTotalDisplay: format(annualTotalUsd),
      savingsDisplay: format((monthlySubtotalUsd * 12) - annualTotalUsd),
      extraWhCount,
      extraUsersCount,
      extraWhDisplay: format(extraWhCost),
      extraUsersDisplay: format(extraUsersCost),
      baseDisplay: format(baseCost),
      wmsDisplay: format(wmsCost),
      posDisplay: format(posCost)
    };
  }, [warehouses, users, wmsEnabled, posEnabled, cycle, curr]);

  // Fast pre-set tier applicator
  const applyPreset = (preset: 'starter' | 'pro' | 'enterprise') => {
    if (preset === 'starter') {
      setWarehouses(1);
      setUsers(3);
      setWmsEnabled(false);
      setPosEnabled(true);
    } else if (preset === 'pro') {
      setWarehouses(3);
      setUsers(10);
      setWmsEnabled(true);
      setPosEnabled(true);
    } else if (preset === 'enterprise') {
      setWarehouses(8);
      setUsers(25);
      setWmsEnabled(true);
      setPosEnabled(true);
    }
  };

  const handleStartTrial = () => {
    onNavigateToRegister({
      warehouses,
      users,
      wms: wmsEnabled,
      pos: posEnabled,
      cycle,
      currency: selectedCurrency
    });
  };

  return (
    <div 
      className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30"
      style={{
        direction: 'rtl',
        fontFamily: 'Cairo, Inter, system-ui, sans-serif',
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#f4f4f5'
      }}
    >
      {/* Top Navbar */}
      <header 
        style={{
          borderBottom: '1px solid rgba(63, 63, 70, 0.4)',
          backgroundColor: 'rgba(24, 24, 27, 0.75)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}
      >
        <div 
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          {/* Brand */}
          <div 
            onClick={onNavigateToHome}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem',
              cursor: onNavigateToHome ? 'pointer' : 'default'
            }}
          >
            <div 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981'
              }}
            >
              <Boxes size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#f4f4f5', letterSpacing: '-0.02em' }}>
                ZiloX Cloud POS & ERP
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                منظومة إدارة المخازن والمبيعات السحابية
              </div>
            </div>
          </div>

          {/* Action Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Currency Picker */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                backgroundColor: 'rgba(39, 39, 42, 0.7)',
                padding: '4px',
                borderRadius: '10px',
                border: '1px solid rgba(63, 63, 70, 0.5)'
              }}
            >
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setSelectedCurrency(c.code as any)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: selectedCurrency === c.code ? '#10b981' : 'transparent',
                    color: selectedCurrency === c.code ? '#022c22' : '#a1a1aa',
                    transition: 'all 0.15s'
                  }}
                >
                  {c.code}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onNavigateToLogin}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '0.75rem',
                border: '1px solid rgba(63, 63, 70, 0.7)',
                backgroundColor: 'rgba(39, 39, 42, 0.5)',
                color: '#e4e4e7',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>تسجيل الدخول</span>
              <ArrowLeft size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
        {/* Header Hero */}
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 2.5rem' }}>
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.9rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '1rem'
            }}
          >
            <Sparkles size={16} />
            <span>تسجيل ذاتي فوري 100% — تجربة مجانية بالكامل لمدة 14 يوماً</span>
          </div>

          <h1 
            style={{
              fontSize: '2.4rem',
              fontWeight: 900,
              color: '#f4f4f5',
              margin: '0 0 1rem 0',
              lineHeight: 1.2
            }}
          >
            صمّم باقتك حسب حجم تجارتك وادفع فقط لما تحتاجه
          </h1>
          <p 
            style={{
              fontSize: '1.05rem',
              color: '#a1a1aa',
              margin: 0,
              lineHeight: 1.6
            }}
          >
            حاسبة أسعار تفاعلية شفافة تماماً بدون رسوم خفية. حدد عدد الفروع، الموظفين، والميزات الإضافية وانطلق فوراً دون انتظار تفعيل يدوي.
          </p>

          {/* Quick Presets Pills */}
          <div 
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.75rem',
              marginTop: '1.5rem',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={() => applyPreset('starter')}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                borderRadius: '9999px',
                border: '1px solid rgba(63, 63, 70, 0.6)',
                backgroundColor: 'rgba(39, 39, 42, 0.6)',
                color: '#d4d4d8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>الباقة المبتدئة (مستودع + 3 موظفين)</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('pro')}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                borderRadius: '9999px',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#6ee7b7',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 700
              }}
            >
              <Zap size={14} />
              <span>الأكثر طلباً: الباقة الاحترافية (3 فروع + WMS + POS)</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('enterprise')}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                borderRadius: '9999px',
                border: '1px solid rgba(63, 63, 70, 0.6)',
                backgroundColor: 'rgba(39, 39, 42, 0.6)',
                color: '#d4d4d8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Crown size={14} />
              <span>باقة الشركات الكبرى (8 فروع + 25 موظفاً)</span>
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Layout: Controls on Right, Sticky Summary Card on Left */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '2rem',
            alignItems: 'start'
          }}
        >
          {/* Controls Column (Sliders & Toggles) */}
          <div 
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '1.25rem',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem'
            }}
          >
            {/* Billing Cycle Switcher */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#f4f4f5', marginBottom: '0.75rem' }}>
                دورة الفوترة والدفع
              </label>
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(9, 9, 11, 0.7)',
                  padding: '6px',
                  borderRadius: '1rem',
                  border: '1px solid rgba(63, 63, 70, 0.5)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setCycle('monthly')}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: cycle === 'monthly' ? '#27272a' : 'transparent',
                    color: cycle === 'monthly' ? '#f4f4f5' : '#a1a1aa'
                  }}
                >
                  الدفع الشهري
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('yearly')}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    backgroundColor: cycle === 'yearly' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                    color: cycle === 'yearly' ? '#34d399' : '#a1a1aa',
                    borderWidth: cycle === 'yearly' ? '1px' : '0px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(16, 185, 129, 0.4)'
                  }}
                >
                  <span>الدفع السنوي</span>
                  <span 
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      backgroundColor: '#10b981',
                      color: '#022c22',
                      fontWeight: 800
                    }}
                  >
                    وفر 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Control 1: Warehouses Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={18} color="#10b981" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f4f4f5' }}>
                    عدد الفروع والمستودعات
                  </span>
                </div>
                <div 
                  style={{
                    padding: '4px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    fontWeight: 800,
                    fontSize: '1rem'
                  }}
                >
                  {warehouses} {warehouses === 1 ? 'مستودع' : warehouses === 2 ? 'مستودعان' : 'مستودعات'}
                </div>
              </div>

              {/* Slider Input */}
              <input
                type="range"
                min={1}
                max={20}
                value={warehouses}
                onChange={e => setWarehouses(parseInt(e.target.value) || 1)}
                style={{
                  width: '100%',
                  accentColor: '#10b981',
                  cursor: 'pointer',
                  height: '6px',
                  backgroundColor: '#27272a',
                  borderRadius: '3px'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#71717a' }}>
                <span>مستودع واحد (مشمول بالأساس)</span>
                <span>10 مستودعات</span>
                <span>20 مستودعاً</span>
              </div>
            </div>

            {/* Control 2: Users & Staff Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="#34d399" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f4f4f5' }}>
                    عدد حسابات الموظفين والكاشير
                  </span>
                </div>
                <div 
                  style={{
                    padding: '4px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    fontWeight: 800,
                    fontSize: '1rem'
                  }}
                >
                  {users} {users <= 10 ? 'موظفين' : 'موظفاً'}
                </div>
              </div>

              {/* Slider Input */}
              <input
                type="range"
                min={3}
                max={50}
                value={users}
                onChange={e => setUsers(parseInt(e.target.value) || 3)}
                style={{
                  width: '100%',
                  accentColor: '#10b981',
                  cursor: 'pointer',
                  height: '6px',
                  backgroundColor: '#27272a',
                  borderRadius: '3px'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#71717a' }}>
                <span>3 حسابات (مشمولة بالأساس)</span>
                <span>25 موظفاً</span>
                <span>50+ موظفاً</span>
              </div>
            </div>

            {/* Control 3: Optional Module Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid rgba(63, 63, 70, 0.4)', paddingTop: '1.25rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f4f4f5' }}>
                الموديولات التشغيلية الإضافية
              </span>

              {/* Toggle A: WMS */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '1rem',
                  backgroundColor: wmsEnabled ? 'rgba(99, 102, 241, 0.1)' : 'rgba(9, 9, 11, 0.5)',
                  border: wmsEnabled ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(63, 63, 70, 0.4)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div 
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#818cf8',
                      flexShrink: 0
                    }}
                  >
                    <Layers size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f4f4f5' }}>
                      نظام إدارة الخانات والرفوف الذكي (WMS)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#a1a1aa', marginTop: '2px' }}>
                      تتبع الحركات الدقيقة بالباركود، السعة الحجمية للرفوف، وطرق التخزين ثلاثية الأبعاد.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setWmsEnabled(!wmsEnabled)}
                  style={{
                    width: '52px',
                    height: '28px',
                    borderRadius: '9999px',
                    backgroundColor: wmsEnabled ? '#6366f1' : '#3f3f46',
                    position: 'relative',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  title={wmsEnabled ? 'تعطيل WMS' : 'تفعيل WMS'}
                >
                  <div 
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: wmsEnabled ? '26px' : '3px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  />
                </button>
              </div>

              {/* Toggle B: POS & Shifts */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '1rem',
                  backgroundColor: posEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(9, 9, 11, 0.5)',
                  border: posEnabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(63, 63, 70, 0.4)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div 
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#34d399',
                      flexShrink: 0
                    }}
                  >
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f4f4f5' }}>
                      نقاط البيع السريعة وإدارة الورديات (POS & Z-Report)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#a1a1aa', marginTop: '2px' }}>
                      واجهة كاشير لمسية سريعة، إغلاق الصناديق اليومية، دعم قارئ الباركود وطابعات الإيصالات.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPosEnabled(!posEnabled)}
                  style={{
                    width: '52px',
                    height: '28px',
                    borderRadius: '9999px',
                    backgroundColor: posEnabled ? '#10b981' : '#3f3f46',
                    position: 'relative',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  title={posEnabled ? 'تعطيل POS' : 'تفعيل POS'}
                >
                  <div 
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: posEnabled ? '26px' : '3px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Live Calculation Card Column */}
          <div 
            style={{
              position: 'sticky',
              top: '90px',
              backgroundColor: 'rgba(24, 24, 27, 0.95)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '1.25rem',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}
          >
            {/* Header / Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span 
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                ملخص التكلفة المخصصة
              </span>
              <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
                {cycle === 'yearly' ? 'فوترة سنوية' : 'فوترة شهرية'}
              </span>
            </div>

            {/* Price Display */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '3rem', fontWeight: 900, color: '#f4f4f5', letterSpacing: '-0.03em' }}>
                  {calculation.effectiveMonthlyDisplay.toLocaleString()}
                </span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399' }}>
                  {curr.symbol}
                </span>
                <span style={{ fontSize: '0.9rem', color: '#a1a1aa' }}>
                  / شهرياً
                </span>
              </div>

              {cycle === 'yearly' ? (
                <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginTop: '0.35rem' }}>
                  تدفع سنوياً بمجموع: <strong style={{ color: '#f4f4f5' }}>{calculation.annualTotalDisplay.toLocaleString()} {curr.symbol}</strong> (تم توفير {calculation.savingsDisplay.toLocaleString()} {curr.symbol})
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginTop: '0.35rem' }}>
                  يتم التجديد شهرياً بدون التزام زمني طويل.
                </div>
              )}
            </div>

            {/* Itemized Feature Breakdown */}
            <div 
              style={{
                backgroundColor: 'rgba(9, 9, 11, 0.6)',
                border: '1px solid rgba(63, 63, 70, 0.5)',
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
                fontSize: '0.85rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d4d4d8' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={14} color="#10b981" />
                  <span>الفروع والمستودعات</span>
                </span>
                <span style={{ fontWeight: 700 }}>{warehouses} مستودع</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d4d4d8' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={14} color="#10b981" />
                  <span>حسابات الموظفين والكاشير</span>
                </span>
                <span style={{ fontWeight: 700 }}>{users} مستخدم</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d4d4d8' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={14} color={wmsEnabled ? '#10b981' : '#71717a'} />
                  <span>نظام الخانات والرفوف الذكي WMS</span>
                </span>
                <span style={{ fontWeight: 700, color: wmsEnabled ? '#34d399' : '#71717a' }}>
                  {wmsEnabled ? 'مفعّل' : 'معطل'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d4d4d8' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={14} color={posEnabled ? '#10b981' : '#71717a'} />
                  <span>نقاط البيع وإدارة الورديات POS</span>
                </span>
                <span style={{ fontWeight: 700, color: posEnabled ? '#34d399' : '#71717a' }}>
                  {posEnabled ? 'مفعّل' : 'معطل'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d4d4d8', borderTop: '1px dashed rgba(63, 63, 70, 0.6)', paddingTop: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={14} color="#10b981" />
                  <span>سيرفرات سحابية وقاعدة بيانات خاصة</span>
                </span>
                <span style={{ fontWeight: 700, color: '#34d399' }}>مشمول</span>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handleStartTrial}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: 'none',
                backgroundColor: '#10b981',
                color: '#022c22',
                fontSize: '1.05rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#34d399'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              <span>ابدأ تجربة مجانية لمدة 14 يوماً</span>
              <ArrowLeft size={20} />
            </button>

            {/* Trial Guarantees */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'center', fontSize: '0.78rem', color: '#a1a1aa' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <CreditCard size={14} color="#10b981" />
                <span>لا تتطلب إدخال أي بطاقة بنكية للتسجيل</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Clock size={14} color="#10b981" />
                <span>تهيئة برمجية فورية لمنشأتك وحسابك في ثوانٍ</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
