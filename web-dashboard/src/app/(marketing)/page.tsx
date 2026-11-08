'use client';

import React, { useState } from 'react';
import {
  Boxes,
  ArrowLeft,
  ChevronDown,
  BrainCircuit,
  Lock,
  Sparkles,
  TrendingUp,
  BarChart3,
  Bot,
  Globe
} from 'lucide-react';
import FeaturesSection from '../../components/marketing/FeaturesSection';
import PricingSection from '../../components/marketing/PricingSection';
import Footer from '../../components/marketing/Footer';
import {
  RegionId,
  GEO_REGIONS,
  GEO_REGIONS_LIST,
  detectUserRegion
} from '../../lib/pricing-tiers';

export default function MarketingPage() {
  const [selectedRegion, setSelectedRegion] = useState<RegionId>(() => detectUserRegion());

  const handleRegionChange = (newRegion: RegionId) => {
    setSelectedRegion(newRegion);
    try {
      localStorage.setItem('zilox_selected_geo_region', newRegion);
    } catch {
      // Ignore
    }
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30" dir="rtl">
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

          {/* Centered Quick Nav: [ المميزات (#features) | خطط الأسعار (#pricing) | الذكاء الاصطناعي (#ai) ] */}
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
              onClick={(e) => { e.preventDefault(); scrollTo('features'); }}
              style={{ background: 'none', border: 'none', color: '#d4d4d8', cursor: 'pointer', fontSize: '0.92rem', textDecoration: 'none', transition: 'color 0.15s' }}
              className="hover:text-emerald-400"
            >
              المميزات
            </a>
            <a
              href="#pricing"
              onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}
              style={{ background: 'none', border: 'none', color: '#d4d4d8', cursor: 'pointer', fontSize: '0.92rem', textDecoration: 'none', transition: 'color 0.15s' }}
              className="hover:text-emerald-400"
            >
              خطط الأسعار
            </a>
            <a
              href="#ai"
              onClick={(e) => { e.preventDefault(); scrollTo('ai'); }}
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
                aria-label="اختر الدولة والعملة"
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

            <a
              href="/login"
              style={{
                padding: '0.55rem 1.1rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                borderRadius: '0.75rem',
                border: '1px solid rgba(63, 63, 70, 0.6)',
                backgroundColor: 'rgba(39, 39, 42, 0.5)',
                color: '#f4f4f5',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s'
              }}
            >
              <span>تسجيل الدخول</span>
              <ArrowLeft size={14} />
            </a>

            <a
              href="/register"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-emerald-950/40"
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.88rem',
                borderRadius: '0.75rem',
                border: 'none',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s'
              }}
            >
              <span>ابدأ التجربة المجانية</span>
              <Sparkles size={14} />
            </a>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section
        style={{
          position: 'relative',
          padding: '5rem 1.5rem 4rem',
          textAlign: 'center',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '350px',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(9, 9, 11, 0) 70%)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '920px', margin: '0 auto' }}>
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
            <a
              href={`/register?plan=Growth&cycle=yearly&currency=${GEO_REGIONS[selectedRegion]?.currencyCode || 'USD'}&country=${GEO_REGIONS[selectedRegion]?.countryCode || 'US'}`}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold shadow-xl shadow-emerald-950/50"
              style={{
                padding: '0.95rem 1.9rem',
                borderRadius: '0.85rem',
                border: 'none',
                fontSize: '1.05rem',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                transition: 'all 0.15s'
              }}
            >
              <span>ابدأ تجربتك المجانية 14 يوماً</span>
              <ArrowLeft size={18} />
            </a>

            <button
              type="button"
              onClick={() => scrollTo('pricing')}
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

        {/* Dashboard Mockup Frame */}
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
            {/* KPI Cards Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '1rem'
              }}
            >
              <div style={{ backgroundColor: '#18181b', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: '0.85rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.82rem' }}>
                  <span>إجمالي مبيعات اليوم</span>
                  <TrendingUp size={16} color="#10b981" />
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f4f4f5', marginTop: '0.5rem' }}>
                  4,850,000 <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>د.ع</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
                  ↑ +18.4% مقارنة بالأمس
                </div>
              </div>

              <div style={{ backgroundColor: '#18181b', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: '0.85rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.82rem' }}>
                  <span>صافي الربح المحقق (FIFO)</span>
                  <BarChart3 size={16} color="#38bdf8" />
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f4f4f5', marginTop: '0.5rem' }}>
                  1,240,000 <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>د.ع</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.25rem' }}>
                  هامش ربح إجمالي 25.6%
                </div>
              </div>

              <div style={{ backgroundColor: '#18181b', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: '0.85rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.82rem' }}>
                  <span>تنبؤات الذكاء الاصطناعي</span>
                  <Bot size={16} color="#c084fc" />
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f4f4f5', marginTop: '0.5rem' }}>
                  2 <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>أصناف حرجة</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#fb7185', marginTop: '0.25rem' }}>
                  تنبيـه بنفاد المخزون خلال 3 أيام
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Operational Features Grid Component */}
      <FeaturesSection />

      {/* 4. Commercial Multi-Region Pricing Matrix Component */}
      <PricingSection
        selectedRegion={selectedRegion}
        onRegionChange={handleRegionChange}
      />

      {/* 5. Footer Component */}
      <Footer />
    </div>
  );
}
