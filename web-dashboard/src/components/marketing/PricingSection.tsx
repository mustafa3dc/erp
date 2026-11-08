import React, { useState, useEffect } from 'react';
import { Check, Sparkles, CloudUpload, ArrowRight, Globe, ChevronDown } from 'lucide-react';
import {
  PRICING_TIERS_LIST,
  BillingCycle,
  PricingPlanTier,
  RegionId,
  GEO_REGIONS,
  GEO_REGIONS_LIST,
  detectUserRegion,
  getTierGeoPricing
} from '../../lib/pricing-tiers';

interface PricingSectionProps {
  onSelectTier?: (tier: PricingPlanTier, cycle: BillingCycle, region: RegionId) => void;
  selectedRegion?: RegionId;
  onRegionChange?: (region: RegionId) => void;
}

export default function PricingSection({
  onSelectTier,
  selectedRegion: controlledRegion,
  onRegionChange
}: PricingSectionProps) {
  const [internalRegion, setInternalRegion] = useState<RegionId>(() => detectUserRegion());
  const region = controlledRegion || internalRegion;

  const [cycle, setCycle] = useState<BillingCycle>('yearly');

  const handleRegionSelect = (newRegion: RegionId) => {
    setInternalRegion(newRegion);
    try {
      localStorage.setItem('zilox_selected_geo_region', newRegion);
    } catch {
      // Ignore
    }
    if (onRegionChange) {
      onRegionChange(newRegion);
    }
  };

  const handleSelect = (tier: PricingPlanTier) => {
    if (onSelectTier) {
      onSelectTier(tier, cycle, region);
    } else {
      const activeRegion = GEO_REGIONS[region];
      window.location.href = `/register?plan=${tier.id}&cycle=${cycle}&currency=${activeRegion.currencyCode}&country=${activeRegion.countryCode}`;
    }
  };

  const currentRegionConfig = GEO_REGIONS[region] || GEO_REGIONS.GLOBAL;

  return (
    <section
      id="pricing"
      style={{
        padding: '5rem 1.5rem',
        maxWidth: '1280px',
        margin: '0 auto',
        borderTop: '1px solid rgba(63, 63, 70, 0.3)'
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 3.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}
        >
          <Sparkles size={16} />
          <span>خطط أسعار سحابية واضحة ومصممة لنمو تجارتك</span>
        </div>

        <h2 style={{ fontSize: '2.4rem', fontWeight: 900, color: '#f4f4f5', margin: '0 0 1rem 0' }}>
          اختر الباقة المناسبة لحجم تجارتك وفروعك
        </h2>
        <p style={{ fontSize: '1.05rem', color: '#a1a1aa', margin: '0 0 2rem 0', lineHeight: 1.6 }}>
          {currentRegionConfig.subtitleAr} • نسخ احتياطي سحابي متواصل لكافة الخطط بدون أي رسوم خفية.
        </p>

        {/* Controls Container: Country/Currency Dropdown & Billing Cycle Switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          
          {/* Country & Currency Switcher Dropdown */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#18181b',
              border: '1px solid rgba(63, 63, 70, 0.7)',
              borderRadius: '0.85rem',
              padding: '4px 12px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
            }}
          >
            <Globe size={16} style={{ color: '#34d399' }} />
            <select
              value={region}
              onChange={(e) => handleRegionSelect(e.target.value as RegionId)}
              style={{
                backgroundColor: 'transparent',
                color: '#f4f4f5',
                border: 'none',
                outline: 'none',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: '0.5rem 0.25rem'
              }}
            >
              {GEO_REGIONS_LIST.map((reg) => (
                <option key={reg.id} value={reg.id} style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>
                  {reg.flag} {reg.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* Monthly / Yearly Switcher */}
          <div
            style={{
              display: 'inline-flex',
              padding: '4px',
              borderRadius: '0.85rem',
              backgroundColor: '#18181b',
              border: '1px solid rgba(63, 63, 70, 0.7)'
            }}
          >
            <button
              type="button"
              onClick={() => setCycle('monthly')}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: cycle === 'monthly' ? '#27272a' : 'transparent',
                color: cycle === 'monthly' ? '#f4f4f5' : '#a1a1aa',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              فوترة شهرية
            </button>
            <button
              type="button"
              onClick={() => setCycle('yearly')}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: cycle === 'yearly' ? '#10b981' : 'transparent',
                color: cycle === 'yearly' ? '#022c22' : '#a1a1aa',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>فوترة سنوية</span>
              <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(255,255,255,0.3)', padding: '1px 6px', borderRadius: '4px' }}>
                شهرين مجاناً
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
          gap: '2rem',
          alignItems: 'stretch'
        }}
      >
        {PRICING_TIERS_LIST.map((tier) => {
          const isPro = tier.id === 'Pro';
          const isEnterprise = tier.id === 'Enterprise';
          const pricingInfo = getTierGeoPricing(tier.id, region, cycle);

          return (
            <div
              key={tier.id}
              style={{
                backgroundColor: isPro ? '#18181b' : 'rgba(24, 24, 27, 0.6)',
                border: isPro
                  ? '2px solid #10b981'
                  : isEnterprise
                  ? '1px solid rgba(168, 85, 247, 0.5)'
                  : '1px solid rgba(63, 63, 70, 0.5)',
                borderRadius: '1.5rem',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: isPro
                  ? '0 20px 50px rgba(16, 185, 129, 0.15)'
                  : '0 10px 30px rgba(0, 0, 0, 0.4)'
              }}
            >
              {/* Popular Badge */}
              {isPro && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-14px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#10b981',
                    color: '#022c22',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    padding: '3px 14px',
                    borderRadius: '9999px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  الأكثر طلباً وتوفيراً
                </div>
              )}

              {/* Tier Header */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f4f4f5', margin: 0 }}>
                    {tier.nameAr}
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 600 }}>
                    {tier.nameEn}
                  </span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#a1a1aa', margin: 0, minHeight: '38px', lineHeight: 1.5 }}>
                  {tier.badgeAr}
                </p>
              </div>

              {/* Price Display */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '1rem',
                  backgroundColor: 'rgba(9, 9, 11, 0.6)',
                  border: '1px solid rgba(63, 63, 70, 0.4)',
                  marginBottom: '1.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f4f4f5' }}>
                    {pricingInfo.formattedAmount}
                  </span>
                  <span style={{ fontSize: '1rem', color: '#34d399', fontWeight: 800 }}>
                    {pricingInfo.currencySymbol}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#71717a', marginRight: '4px' }}>
                    / {cycle === 'yearly' ? 'سنوياً' : 'شهرياً'}
                  </span>
                </div>

                {pricingInfo.secondaryAmount && (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px', fontWeight: 600 }}>
                    يعادل: ~{pricingInfo.secondarySymbol}{pricingInfo.secondaryAmount} {cycle === 'yearly' ? 'سنوياً' : 'شهرياً'}
                  </div>
                )}

                {cycle === 'yearly' && (
                  <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 700, marginTop: '6px' }}>
                    وفرت شهرين كاملين (دفع سنوي)
                  </div>
                )}
              </div>

              {/* Quotas */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                  textAlign: 'center',
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(39, 39, 42, 0.4)',
                  border: '1px solid rgba(63, 63, 70, 0.3)',
                  marginBottom: '1.75rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f4f4f5' }}>{tier.quotas.branches}</div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>فروع</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f4f4f5' }}>{tier.quotas.warehouses}</div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>مستودعات</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f4f4f5' }}>{tier.quotas.users}</div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>موظفين</div>
                </div>
              </div>

              {/* Feature List */}
              <div style={{ flex: 1, marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#e4e4e7', marginBottom: '0.75rem' }}>
                  الميزات التشغيلية والمالية:
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {tier.operationalFeatures.map((feat: string, i: number) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.85rem', color: '#d4d4d8', lineHeight: 1.5 }}>
                      <Check size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* AI Feature Box */}
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.85rem',
                    borderRadius: '0.75rem',
                    backgroundColor: isEnterprise
                      ? 'rgba(168, 85, 247, 0.12)'
                      : isPro
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(16, 185, 129, 0.08)',
                    border: isEnterprise
                      ? '1px solid rgba(168, 85, 247, 0.3)'
                      : isPro
                      ? '1px solid rgba(16, 185, 129, 0.35)'
                      : '1px solid rgba(16, 185, 129, 0.2)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 800, color: isEnterprise ? '#c084fc' : '#34d399', marginBottom: '4px' }}>
                    <Sparkles size={14} />
                    <span>ميزة الذكاء الاصطناعي:</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#f4f4f5', fontWeight: 700 }}>
                    {tier.aiFeatureTitle}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '2px', lineHeight: 1.4 }}>
                    {tier.aiFeatureDescription}
                  </div>
                </div>

                {/* Instant Cloud Backup Standard */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#34d399', fontWeight: 700, marginTop: '1rem' }}>
                  <CloudUpload size={14} />
                  <span>نسخ احتياطي سحابي متواصل ولحظي مشمول مجاناً</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleSelect(tier)}
                className={isPro ? "bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-emerald-950/40" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold"}
                style={{
                  width: '100%',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '0.85rem',
                  border: isPro ? 'none' : '1px solid rgba(63, 63, 70, 0.7)',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s'
                }}
              >
                <span>ابدأ التجربة الآن</span>
                <ArrowRight size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
