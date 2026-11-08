import React, { useState } from 'react';
import {
  Boxes,
  Building2,
  Users,
  Layers,
  Receipt,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  BarChart3,
  Lock,
  ChevronDown,
  TrendingUp,
  BrainCircuit,
  ScanLine,
  LineChart,
  Bot,
  Crown,
  Check,
  CreditCard,
  CloudUpload,
  ArrowRight,
  Globe
} from 'lucide-react';
import {
  PRICING_TIERS_LIST,
  PlanTierId,
  BillingCycle,
  PricingPlanTier,
  RegionId,
  GEO_REGIONS,
  GEO_REGIONS_LIST,
  detectUserRegion
} from '../../lib/pricing-tiers';
import PricingSection from '../marketing/PricingSection';

interface LandingPageViewProps {
  onNavigateToLogin: () => void;
  onNavigateToRegister: (params?: {
    plan?: PlanTierId;
    cycle?: BillingCycle;
    warehouses?: number;
    users?: number;
    wms?: boolean;
    pos?: boolean;
    currency?: string;
  }) => void;
  onNavigateToPricing?: () => void;
}

const FAQS = [
  {
    q: 'هل يتطلب بدء التجربة المجانية إدخال بطاقة ائتمانية؟',
    a: 'لا نهائياً! يمكنك تسجيل منشأتك فوراً والحصول على فترة تجريبية مجانية لمدة 14 يوماً بكامل الميزات وبدون الحاجة لإدخال أي بيانات بنكية أو بطاقات دفع.'
  },
  {
    q: 'هل النسخ الاحتياطي السحابي مشمول في كافة الباقات؟',
    a: 'نعم، النسخ الاحتياطي اللحظي والفوري متواصل على مدار الساعة لكافة الخطط والمنشآت دون استثناء لضمان أمان بياناتك ضد أي طارئ.'
  },
  {
    q: 'كيف تعمل ميزة مسح الفواتير بالذكاء الاصطناعي (Smart OCR)؟',
    a: 'تقوم ببساطة بتصوير أو رفع فاتورة الشراء الورقية المستلمة من المورد، وسيقوم محرك الرؤية الحاسوبية بقراءة أسماء المواد، الكميات، وتكاليف الشراء ومطابقتها مع أصناف مخزنك آلياً في ثوانٍ.'
  },
  {
    q: 'هل تدعم نقاط البيع (POS) العمل في حال انقطاع الإنترنت؟',
    a: 'نعم، يدعم نظام نقاط البيع وضع العمل دون اتصال (Offline-First Sync Engine). يمكنك إتمام المبيعات وطباعة الفواتير، وفور عودة الإنترنت تتم مزامنة الحركات آلياً مع الخادم المركزي.'
  },
  {
    q: 'هل يمكنني الترقية أو تغيير الباقة لاحقاً مع نمو تجارتي؟',
    a: 'بكل تأكيد. يمكنك في أي وقت الانتقال من باقة إلى أخرى أو إضافة فروع ومستخدمين جدد بضغطة زر مباشرة من لوحة التحكم.'
  }
];

export default function LandingPageView({
  onNavigateToLogin,
  onNavigateToRegister
}: LandingPageViewProps) {
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const [selectedRegion, setSelectedRegion] = useState<RegionId>(() => detectUserRegion());
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const handleRegionChange = (newRegion: RegionId) => {
    setSelectedRegion(newRegion);
    try {
      localStorage.setItem('zilox_selected_geo_region', newRegion);
    } catch {
      // Ignore
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectTier = (tier: PricingPlanTier, c: BillingCycle = cycle, r: RegionId = selectedRegion) => {
    const regConfig = GEO_REGIONS[r] || GEO_REGIONS.GLOBAL;
    onNavigateToRegister({
      plan: tier.id,
      cycle: c,
      warehouses: tier.quotas.warehouses,
      users: tier.quotas.users,
      wms: tier.id === 'Enterprise',
      pos: true,
      currency: regConfig.currencyCode
    });
  };

  return (
    <div
      className="min-h-screen w-full overflow-y-auto bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30"
      style={{
        direction: 'rtl',
        fontFamily: 'Cairo, Inter, system-ui, sans-serif',
        minHeight: '100vh',
        width: '100%',
        overflowY: 'auto',
        backgroundColor: '#09090b',
        color: '#f4f4f5'
      }}
    >
      {/* 1. Public Navbar */}
      <header
        style={{
          borderBottom: '1px solid rgba(63, 63, 70, 0.4)',
          backgroundColor: 'rgba(9, 9, 11, 0.85)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 50
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
            gap: '1.5rem'
          }}
        >
          {/* Brand Logo - Clean with zero deformed badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.2)'
              }}
            >
              <Boxes size={22} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#f4f4f5', letterSpacing: '-0.02em' }}>
                ZiloX <span style={{ color: '#10b981' }}>Suite</span>
              </span>
            </div>
          </div>

          {/* Navigation Links - Centered Quick Nav: [ المميزات (#features) | خطط الأسعار (#pricing) | الذكاء الاصطناعي (#ai) ] */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2rem',
              fontSize: '0.92rem',
              fontWeight: 700,
              color: '#d4d4d8'
            }}
            className="flex items-center gap-6"
          >
            <a
              href="#features"
              onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}
              style={{ background: 'none', border: 'none', color: '#d4d4d8', cursor: 'pointer', fontSize: '0.92rem', textDecoration: 'none', transition: 'color 0.15s' }}
              className="hover:text-emerald-400"
            >
              المميزات
            </a>
            <a
              href="#pricing"
              onClick={(e) => { e.preventDefault(); scrollToSection('pricing'); }}
              style={{ background: 'none', border: 'none', color: '#d4d4d8', cursor: 'pointer', fontSize: '0.92rem', textDecoration: 'none', transition: 'color 0.15s' }}
              className="hover:text-emerald-400"
            >
              خطط الأسعار
            </a>
            <a
              href="#ai"
              onClick={(e) => { e.preventDefault(); scrollToSection('ai'); }}
              style={{ background: 'none', border: 'none', color: '#d4d4d8', cursor: 'pointer', fontSize: '0.92rem', textDecoration: 'none', transition: 'color 0.15s' }}
              className="hover:text-emerald-400"
            >
              الذكاء الاصطناعي
            </a>
          </nav>

          {/* CTA Actions & Country Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Country & Currency Switcher in Navbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'rgba(39, 39, 42, 0.6)',
                border: '1px solid rgba(63, 63, 70, 0.6)',
                borderRadius: '0.75rem',
                padding: '2px 8px'
              }}
            >
              <Globe size={14} style={{ color: '#34d399' }} />
              <select
                value={selectedRegion}
                onChange={(e) => handleRegionChange(e.target.value as RegionId)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#f4f4f5',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: '6px 4px'
                }}
              >
                {GEO_REGIONS_LIST.map((reg) => (
                  <option key={reg.id} value={reg.id} style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>
                    {reg.flag} {reg.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onNavigateToLogin}
              style={{
                padding: '0.55rem 1.1rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                borderRadius: '0.75rem',
                border: '1px solid rgba(63, 63, 70, 0.6)',
                backgroundColor: 'rgba(39, 39, 42, 0.5)',
                color: '#f4f4f5',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s'
              }}
            >
              <span>تسجيل الدخول</span>
              <ArrowLeft size={14} />
            </button>

            <button
              type="button"
              onClick={() => onNavigateToRegister({ plan: 'Pro', cycle: 'yearly', currency: GEO_REGIONS[selectedRegion]?.currencyCode || 'USD' })}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-emerald-950/40"
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.88rem',
                borderRadius: '0.75rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s'
              }}
            >
              <Sparkles size={15} />
              <span>ابدأ التجربة المجانية</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section
        style={{
          position: 'relative',
          padding: '5rem 1.5rem 4rem',
          maxWidth: '1280px',
          margin: '0 auto',
          textAlign: 'center',
          overflow: 'hidden'
        }}
      >
        {/* Glow ambient background */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '650px',
            height: '380px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.16) 0%, rgba(9, 9, 11, 0) 70%)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '920px', margin: '0 auto' }}>
          {/* Upper Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 1.1rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.88rem',
              fontWeight: 700,
              marginBottom: '1.5rem'
            }}
          >
            <BrainCircuit size={17} />
            <span>الجيل الجديد لإدارة المستودعات ونقاط البيع السحابية المدعومة بالذكاء الاصطناعي</span>
          </div>

          {/* Main Title */}
          <h1
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.7rem)',
              fontWeight: 900,
              color: '#f4f4f5',
              margin: '0 0 1.25rem 0',
              lineHeight: 1.25,
              letterSpacing: '-0.03em'
            }}
          >
            منظومة ERP سحابية تدير تجارتك، مخازنك، ومبيعاتك بدقة وقرارات ذكية
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: '#a1a1aa',
              margin: '0 auto 2.5rem',
              lineHeight: 1.7,
              maxWidth: '750px'
            }}
          >
            اربط كافة فروعك ومستودعاتك بنظام واحد متكامل. استمتع بنقاط بيع فورية (POS)، جرد ذكي (WMS)، وتوليد تلقائي للفواتير بالرؤية الحاسوبية، وتنبؤات نفاد المخزون لمنع تجميد رأس المال.
          </p>

          {/* CTA Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '3.5rem'
            }}
          >
            <button
              type="button"
              onClick={() => onNavigateToRegister({ plan: 'Pro', cycle: 'yearly', currency: GEO_REGIONS[selectedRegion]?.currencyCode || 'USD' })}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold shadow-xl shadow-emerald-950/50"
              style={{
                padding: '0.95rem 1.9rem',
                borderRadius: '0.85rem',
                border: 'none',
                fontSize: '1.05rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                transition: 'all 0.15s'
              }}
            >
              <span>ابدأ تجربتك المجانية 14 يوماً</span>
              <ArrowLeft size={18} />
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              style={{
                padding: '0.95rem 1.7rem',
                borderRadius: '0.85rem',
                border: '1px solid rgba(63, 63, 70, 0.7)',
                backgroundColor: 'rgba(39, 39, 42, 0.6)',
                color: '#f4f4f5',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.15s'
              }}
            >
              <span>استكشف خطط الأسعار ↓</span>
            </button>
          </div>
        </div>

        {/* Realistic Dashboard Mockup */}
        <div
          id="preview"
          style={{
            position: 'relative',
            maxWidth: '1100px',
            margin: '0 auto',
            borderRadius: '1.25rem',
            border: '1px solid rgba(63, 63, 70, 0.6)',
            backgroundColor: '#121215',
            padding: '8px',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8), 0 0 50px rgba(16, 185, 129, 0.15)',
            overflow: 'hidden'
          }}
        >
          {/* Mockup Top Bar - Strict LTR container for window buttons & URL capsule */}
          <div
            dir="ltr"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 1rem',
              backgroundColor: '#18181b',
              borderTopLeftRadius: '0.9rem',
              borderTopRightRadius: '0.9rem',
              borderBottom: '1px solid rgba(63, 63, 70, 0.5)'
            }}
          >
            {/* 1. Left: 3 macOS window buttons strictly LTR in the far-left */}
            <div dir="ltr" className="flex flex-row items-center gap-1.5 ltr" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#eab308' }} />
              <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            </div>

            {/* 2. Center: Dedicated Browser URL Capsule */}
            <div
              dir="ltr"
              className="font-mono text-xs text-muted-foreground bg-muted/60 px-3 py-1 rounded-md"
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#a1a1aa',
                backgroundColor: 'rgba(24, 24, 27, 0.8)',
                border: '1px solid rgba(63, 63, 70, 0.5)',
                padding: '3px 14px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Lock size={12} style={{ color: '#10b981' }} />
              <span>https://app.zilox.cloud/dashboard</span>
            </div>

            {/* 3. Right: Isolated Arabic Context Tag outside URL capsule */}
            <div dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, backgroundColor: 'rgba(39, 39, 42, 0.7)', padding: '2px 8px', borderRadius: '4px' }}>
                المستودع الرئيسي (WH-01)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                <span>مباشر ومزامن سحابياً</span>
              </div>
            </div>
          </div>

          {/* Mockup Inside Visual Dashboard */}
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: '#0c0c0e',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              textAlign: 'right'
            }}
          >
            {/* KPI Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div
                style={{
                  backgroundColor: 'rgba(24, 24, 27, 0.8)',
                  border: '1px solid rgba(63, 63, 70, 0.5)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>إجمالي تقييم المخزون الحي</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f4f4f5', marginTop: '2px' }}>
                    184,250,000 <span style={{ fontSize: '0.8rem', color: '#10b981' }}>د.ع</span>
                  </div>
                </div>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <TrendingUp size={18} />
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(24, 24, 27, 0.8)',
                  border: '1px solid rgba(63, 63, 70, 0.5)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>مبيعات الكاشير اليومية (POS)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f4f4f5', marginTop: '2px' }}>
                    6,420,000 <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>د.ع</span>
                  </div>
                </div>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <Receipt size={18} />
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(24, 24, 27, 0.8)',
                  border: '1px solid rgba(63, 63, 70, 0.5)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>تنبيه الذكاء الاصطناعي</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#facc15', marginTop: '2px' }}>
                    صنفان يوشكان على النفاد
                  </div>
                </div>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(234, 179, 8, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15' }}>
                  <BrainCircuit size={18} />
                </div>
              </div>
            </div>

            {/* Mockup Mini Activity Row */}
            <div
              style={{
                backgroundColor: 'rgba(24, 24, 27, 0.6)',
                border: '1px solid rgba(63, 63, 70, 0.4)',
                borderRadius: '0.75rem',
                padding: '1rem',
                fontSize: '0.82rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, color: '#f4f4f5' }}>آخر حركات المنظومة الذاتية</span>
                <span style={{ color: '#10b981', fontSize: '0.75rem' }}>مزامنة فورية • 0 ثوانٍ</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'rgba(9, 9, 11, 0.5)', borderRadius: '6px' }}>
                  <span>مسح فاتورة مورد بالـ OCR #BILL-7721 — تم توليد 14 صنفاً ومطابقة الحساب</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>تم الاعتماد</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'rgba(9, 9, 11, 0.5)', borderRadius: '6px' }}>
                  <span>تحويل مخزني داخلي #TRF-102 — من المستودع الرئيسي إلى فرع التوزيع الإقليمي</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>120 قطعة (في الطريق)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Operational Features Grid */}
      <section
        id="features"
        style={{
          padding: '5rem 1.5rem',
          maxWidth: '1280px',
          margin: '0 auto',
          borderTop: '1px solid rgba(63, 63, 70, 0.3)'
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 3.5rem' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f4f4f5', margin: '0 0 1rem 0' }}>
            أدوات تجارية صُممت للسرعة والرقابة المطلقة
          </h2>
          <p style={{ fontSize: '1rem', color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>
            بنية تحتية موحدة تقضي على الفوضى المخزنية وتحمي إيراداتك من التسريب.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}
        >
          {/* Card 1: Retail POS */}
          <div
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.75)',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '1.25rem',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <Receipt size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>
              نقاط البيع السريعة وإدارة الورديات
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>
              كاشير لمسي فائق السرعة، دعم الباركود المباشر، تسوية الصناديق النقدية (Z-Report)، ودعم زين كاش وكي كارد برقم الحوالة.
            </p>
          </div>

          {/* Card 2: Inter-warehouse transfers */}
          <div
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.75)',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '1.25rem',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <TrendingUp size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>
              نظام المناقلات وتتبع الشحن
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>
              ترحيل الأصناف بين المستودعات والفروع بسجل رقمي صارم، مع وضع البضاعة (في الطريق) لحين استلامها وتأكيد مطابقتها.
            </p>
          </div>

          {/* Card 3: WMS */}
          <div
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.75)',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '1.25rem',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
              <Layers size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>
              نظام الرفوف والخانات (WMS)
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>
              تسكين البضائع في ممرات وخانات محددة برمز باركود، لمعرفة موقع كل كرتون وتسهيل تحضير الشحنات دون عناء البحث.
            </p>
          </div>

          {/* Card 4: Anti-tamper Radar */}
          <div
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.75)',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '1.25rem',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: 'rgba(234, 179, 8, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15' }}>
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>
              رادار منع التلاعب والرقابة
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>
              سجل تدقيق رقابي محكم يمنع تعديل الفواتير المطبوعة أو التلاعب بالأسعار، مع حجب تكاليف الشراء عن موظفي الفروع.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Tiered AI Engine Section */}
      <section
        id="ai"
        style={{
          padding: '5rem 1.5rem',
          maxWidth: '1280px',
          margin: '0 auto',
          borderTop: '1px solid rgba(63, 63, 70, 0.3)'
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 3.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.9rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818cf8',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '0.75rem'
            }}
          >
            <BrainCircuit size={15} />
            <span>محرك الذكاء الاصطناعي التشغيلي المتدرج</span>
          </div>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#f4f4f5', margin: '0 0 1rem 0' }}>
            ذكاء اصطناعي حقيقي يخدم دقة الحسابات، لا مجرد شعارات
          </h2>
          <p style={{ fontSize: '1rem', color: '#a1a1aa', margin: 0 }}>
            نماذج معالجة متقدمة مدمجة داخل دورة العمل المحاسبية والمخزنية ومقيدة بحدود باقتك.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem'
          }}
        >
          {/* AI 1: Vision OCR */}
          <div
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.75)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '1.25rem',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <ScanLine size={24} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                متاح بالباقة الأساسية فما فوق
              </span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>
              مسح فواتير الشراء بالرؤية الحاسوبية (Smart OCR)
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>
              ارفع صورة أو ملف PDF لفاتورة المورد، وسيقوم المحرك باستخراج بنود الأصناف، الكميات، الأسعار، ومطابقتها رياضياً لمنع أخطاء الإدخال البشري تماماً.
            </p>
          </div>

          {/* AI 2: Forecasting */}
          <div
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '1.25rem',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                <LineChart size={24} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                متاح بالباقة المتوسطة فما فوق
              </span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>
              التنبؤ بنفاد المخزون ورادار الرواكد
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>
              تحليل سرعة سحب كل صنف لآخر 30 يوماً لحساب الأيام المتبقية قبل النفاد، مع تنبيهات فورية للأصناف الراكدة التي تجمد رأس مال تجارتك.
            </p>
          </div>

          {/* AI 3: Executive Copilot */}
          <div
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.75)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '1.25rem',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
                <Bot size={24} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                حصري للباقة الفائقة (Enterprise)
              </span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>
              المستشار الإداري الذكي (Executive Copilot)
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>
              اسأل بلغتك الطبيعية: *"كم بلغ صافي أرباح الفرع التجاري هذا الأسبوع؟"* ليقوم بتحليل قيودك المالية وإرجاع جداول ورسوم بيانية تنفيذية في ثوانٍ.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Enterprise Multi-Region Geo-Pricing Section */}
      <PricingSection
        selectedRegion={selectedRegion}
        onRegionChange={handleRegionChange}
        onSelectTier={(tier, c, r) => handleSelectTier(tier, c, r)}
      />

      {/* 6. FAQ Section */}
      <section
        id="faq"
        style={{
          padding: '5rem 1.5rem',
          maxWidth: '860px',
          margin: '0 auto',
          borderTop: '1px solid rgba(63, 63, 70, 0.3)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f4f4f5', margin: '0 0 0.75rem 0' }}>
            الأسئلة الشائعة
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#a1a1aa', margin: 0 }}>
            إجابات واضحة ومباشرة حول كيفية عمل المنظومة والاشتراكات
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {FAQS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                style={{
                  backgroundColor: 'rgba(24, 24, 27, 0.75)',
                  border: '1px solid rgba(63, 63, 70, 0.5)',
                  borderRadius: '1rem',
                  overflow: 'hidden',
                  transition: 'all 0.2s'
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  style={{
                    width: '100%',
                    padding: '1.25rem',
                    textAlign: 'right',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#f4f4f5',
                    fontSize: '1rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={18}
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                      color: isOpen ? '#10b981' : '#a1a1aa'
                    }}
                  />
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: '0 1.25rem 1.25rem',
                      fontSize: '0.92rem',
                      color: '#a1a1aa',
                      lineHeight: 1.7,
                      borderTop: '1px solid rgba(63, 63, 70, 0.3)',
                      paddingTop: '1rem'
                    }}
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Public Footer */}
      <footer
        style={{
          borderTop: '1px solid rgba(63, 63, 70, 0.4)',
          backgroundColor: '#0c0c0e',
          padding: '3.5rem 1.5rem 2.5rem'
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2.5rem'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '2rem'
            }}
          >
            {/* Brand Info */}
            <div style={{ maxWidth: '340px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <Boxes size={18} />
                </div>
                <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#f4f4f5' }}>
                  ZiloX Business Suite
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>
                منظومة سحابية متقدمة لإدارة المستودعات، المخزون، نقاط البيع السريعة، والرقابة المحاسبية للشركات والمؤسسات التجارية في العراق والشرق الأوسط.
              </p>
            </div>

            {/* Quick Links */}
            <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f4f4f5', marginBottom: '0.75rem' }}>
                  المنصة
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', color: '#a1a1aa' }}>
                  <span style={{ cursor: 'pointer' }} onClick={() => scrollToSection('features')}>المميزات</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => scrollToSection('pricing')}>خطط الأسعار العراقية</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => scrollToSection('ai')}>الذكاء الاصطناعي</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => scrollToSection('faq')}>الأسئلة الشائعة</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f4f4f5', marginBottom: '0.75rem' }}>
                  البوابات
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', color: '#a1a1aa' }}>
                  <span style={{ cursor: 'pointer', color: '#10b981' }} onClick={onNavigateToLogin}>بوابة دخول الموظفين</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => onNavigateToRegister({ plan: 'Pro', cycle: 'yearly', currency: 'IQD' })}>التسجيل الذاتي للمنشآت</span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(63, 63, 70, 0.3)',
              paddingTop: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.78rem',
              color: '#71717a',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div>
              © 2026 ZiloX Cloud Technologies. جميع الحقوق محفوظة.
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <span>سياسة الخصوصية</span>
              <span>شروط الخدمة</span>
              <span>مركز الدعم والمساعدة</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
