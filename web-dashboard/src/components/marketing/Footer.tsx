import React from 'react';
import { Boxes } from 'lucide-react';

interface FooterProps {
  onNavigateToLogin?: () => void;
  onNavigateToRegister?: () => void;
}

export default function Footer({ onNavigateToLogin, onNavigateToRegister }: FooterProps) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer
      style={{
        borderTop: '1px solid rgba(63, 63, 70, 0.4)',
        backgroundColor: '#09090b',
        padding: '4rem 1.5rem 2rem'
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '3rem', marginBottom: '3rem' }}>
          {/* Brand Info */}
          <div style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981'
                }}
              >
                <Boxes size={20} />
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
                <span style={{ cursor: 'pointer' }} onClick={() => scrollTo('features')}>المميزات</span>
                <span style={{ cursor: 'pointer' }} onClick={() => scrollTo('pricing')}>خطط الأسعار العراقية</span>
                <span style={{ cursor: 'pointer' }} onClick={() => scrollTo('ai')}>الذكاء الاصطناعي</span>
                <span style={{ cursor: 'pointer' }} onClick={() => scrollTo('faq')}>الأسئلة الشائعة</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f4f4f5', marginBottom: '0.75rem' }}>
                البوابات
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', color: '#a1a1aa' }}>
                <a
                  href="/login"
                  onClick={(e) => {
                    if (onNavigateToLogin) {
                      e.preventDefault();
                      onNavigateToLogin();
                    }
                  }}
                  style={{ color: '#10b981', textDecoration: 'none', cursor: 'pointer' }}
                >
                  بوابة دخول الموظفين
                </a>
                <a
                  href="/register"
                  onClick={(e) => {
                    if (onNavigateToRegister) {
                      e.preventDefault();
                      onNavigateToRegister();
                    }
                  }}
                  style={{ color: '#a1a1aa', textDecoration: 'none', cursor: 'pointer' }}
                >
                  التسجيل الذاتي للمنشآت
                </a>
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
  );
}
