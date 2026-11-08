import React from 'react';
import {
  Building2,
  Layers,
  CircleDollarSign,
  Activity,
  LogOut,
  ShieldCheck,
  Globe,
  Sun,
  Moon,
  Server,
  Database,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { UserProfile } from '../types/rbac';

export type SaasAdminTab = 
  | 'tenants' 
  | 'plans' 
  | 'billing' 
  | 'health';

interface SaasAdminLayoutProps {
  activeTab: SaasAdminTab;
  onTabChange: (tab: SaasAdminTab) => void;
  currentUser: UserProfile;
  onLogout: () => void;
  lang: 'ar' | 'en';
  onToggleLang: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  children: React.ReactNode;
}

export default function SaasAdminLayout({
  activeTab,
  onTabChange,
  currentUser,
  onLogout,
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  children
}: SaasAdminLayoutProps) {
  const isAr = lang === 'ar';

  const navItems = [
    {
      id: 'tenants' as SaasAdminTab,
      labelAr: 'المنشآت والشركات المشتركة',
      labelEn: 'Tenant Organizations',
      icon: Building2,
      badge: 'Core'
    },
    {
      id: 'plans' as SaasAdminTab,
      labelAr: 'الباقات وتراخيص الاستخدام',
      labelEn: 'Plans & Subscriptions',
      icon: Layers
    },
    {
      id: 'billing' as SaasAdminTab,
      labelAr: 'إيرادات المنصة والتحصيل',
      labelEn: 'Platform Revenue & Billing',
      icon: CircleDollarSign
    },
    {
      id: 'health' as SaasAdminTab,
      labelAr: 'صحة الخوادم وقواعد البيانات',
      labelEn: 'Server & Database Health',
      icon: Activity,
      badge: '99.9%'
    }
  ];

  return (
    <div 
      className="min-h-screen flex bg-zinc-950 text-zinc-100"
      style={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: 'var(--background, #09090b)',
        color: 'var(--foreground, #f4f4f5)',
        direction: isAr ? 'rtl' : 'ltr',
        fontFamily: 'Cairo, Inter, system-ui, sans-serif'
      }}
    >
      {/* SaaS Control Plane Sidebar */}
      <aside 
        style={{
          width: '280px',
          flexShrink: 0,
          borderInlineEnd: '1px solid rgba(63, 63, 70, 0.4)',
          backgroundColor: '#0c0c0e',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 30
        }}
      >
        {/* Brand Header */}
        <div 
          style={{
            padding: '1.5rem 1.25rem',
            borderBottom: '1px solid rgba(63, 63, 70, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem'
          }}
        >
          <div 
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#18181b',
              border: '1px solid rgba(82, 82, 91, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f4f4f5' }}>
                ZiloX Platform
              </span>
            </div>
            <div 
              style={{
                fontSize: '0.72rem',
                color: '#34d399',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                padding: '2px 8px',
                borderRadius: '4px',
                display: 'inline-block',
                marginTop: '3px',
                fontWeight: 600,
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}
            >
              {isAr ? 'لوحة مالك المنصة' : 'SaaS Control Plane'}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '0.75rem 0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isAr ? 'إدارة المنصة المركزية' : 'Platform Operations'}
          </div>

          {navItems.map(item => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '10px',
                  border: isSelected ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                  backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  color: isSelected ? '#34d399' : '#a1a1aa',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.6)';
                    e.currentTarget.style.color = '#f4f4f5';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#a1a1aa';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Icon size={18} style={{ color: isSelected ? '#34d399' : '#71717a' }} />
                  <span>{isAr ? item.labelAr : item.labelEn}</span>
                </div>
                {item.badge && (
                  <span 
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(39, 39, 42, 0.8)',
                      color: isSelected ? '#34d399' : '#71717a',
                      fontWeight: 700
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* SuperAdmin User Footer */}
        <div 
          style={{
            padding: '1rem',
            borderTop: '1px solid rgba(63, 63, 70, 0.35)',
            backgroundColor: '#09090b',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div 
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#27272a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: '#f4f4f5',
                  fontSize: '0.9rem'
                }}
              >
                <ShieldCheck size={16} className="text-amber-400" />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f4f4f5', lineHeight: 1.2 }}>
                  {currentUser.fullName.replace(/\s*\(.*Owner.*\)\s*/i, '').trim()}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '2px', fontWeight: 600 }}>
                  {isAr ? 'المدير العام للمنصة' : 'Platform Super Admin'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              title={isAr ? 'تسجيل الخروج' : 'Sign Out'}
              style={{
                background: 'none',
                border: '1px solid rgba(63, 63, 70, 0.5)',
                borderRadius: '8px',
                padding: '0.5rem',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header 
          style={{
            height: '64px',
            borderBottom: '1px solid rgba(63, 63, 70, 0.4)',
            backgroundColor: 'rgba(12, 12, 14, 0.75)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.75rem',
            position: 'sticky',
            top: 0,
            zIndex: 20
          }}
        >
          {/* Breadcrumb / Active Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f4f4f5' }}>
              {activeTab === 'tenants' && (isAr ? 'المنشآت والشركات المشتركة' : 'Tenant Organizations')}
              {activeTab === 'plans' && (isAr ? 'الباقات والتراخيص' : 'Plans & Quotas')}
              {activeTab === 'billing' && (isAr ? 'إيرادات المنصة والتحصيل' : 'Revenue & Billing')}
              {activeTab === 'health' && (isAr ? 'صحة الخوادم والبيانات' : 'Infrastructure Health')}
            </span>

            <span 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '3px 8px',
                borderRadius: '999px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.74rem',
                color: '#34d399',
                fontWeight: 600
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              {isAr ? 'الخوادم متصلة ومستقرة' : 'Cluster Healthy'}
            </span>
          </div>

          {/* Controls: Lang, Theme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onToggleLang}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(63, 63, 70, 0.5)',
                backgroundColor: 'rgba(24, 24, 27, 0.6)',
                color: '#d4d4d8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Globe size={14} />
              <span>{isAr ? 'English' : 'عربي'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              style={{
                padding: '0.45rem',
                borderRadius: '8px',
                border: '1px solid rgba(63, 63, 70, 0.5)',
                backgroundColor: 'rgba(24, 24, 27, 0.6)',
                color: '#d4d4d8',
                cursor: 'pointer'
              }}
              title={isAr ? 'تبديل المظهر' : 'Toggle Theme'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ flex: 1, padding: '1.75rem', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
