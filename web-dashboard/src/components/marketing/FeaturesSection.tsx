import React from 'react';
import { Receipt, TrendingUp, Layers, ShieldCheck } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: Receipt,
      iconColor: '#34d399',
      iconBg: 'rgba(16, 185, 129, 0.15)',
      title: 'نقاط البيع السريعة وإدارة الورديات',
      description: 'كاشير لمسي فائق السرعة، دعم الباركود المباشر، تسوية الصناديق النقدية (Z-Report)، ودعم زين كاش وكي كارد برقم الحوالة.'
    },
    {
      icon: TrendingUp,
      iconColor: '#38bdf8',
      iconBg: 'rgba(56, 189, 248, 0.15)',
      title: 'نظام المناقلات وتتبع الشحن',
      description: 'ترحيل الأصناف بين المستودعات والفروع بسجل رقمي صارم، مع وضع البضاعة (في الطريق) لحين استلامها وتأكيد مطابقتها.'
    },
    {
      icon: Layers,
      iconColor: '#818cf8',
      iconBg: 'rgba(99, 102, 241, 0.15)',
      title: 'نظام الرفوف والخانات (WMS)',
      description: 'تسكين البضائع في ممرات وخانات محددة برمز باركود، لمعرفة موقع كل كرتون وتسهيل تحضير الشحنات دون عناء البحث.'
    },
    {
      icon: ShieldCheck,
      iconColor: '#facc15',
      iconBg: 'rgba(234, 179, 8, 0.15)',
      title: 'رادار منع التلاعب والرقابة',
      description: 'سجل تدقيق رقابي محكم يمنع تعديل الفواتير المطبوعة أو التلاعب بالأسعار، مع حجب تكاليف الشراء عن موظفي الفروع.'
    }
  ];

  return (
    <section
      id="features"
      className="py-20 px-6 max-w-7xl mx-auto border-t border-zinc-800/60"
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
        {features.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <div
              key={idx}
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
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: feat.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: feat.iconColor
                }}
              >
                <Icon size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>
                {feat.title}
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>
                {feat.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
