import React from 'react';
import { 
  Layers, 
  CircleDollarSign, 
  Activity, 
  CheckCircle2, 
  Server, 
  Database, 
  Cpu, 
  HardDrive, 
  Zap, 
  ShieldCheck, 
  ArrowUpRight 
} from 'lucide-react';

export function PlansView({ lang }: { lang: 'ar' | 'en' }) {
  const isAr = lang === 'ar';

  const plans = [
    {
      name: 'Starter',
      nameAr: 'الباقة المبتدئة (Starter)',
      price: '$49/mo',
      branches: '1 فرع',
      users: 'حتى 5 موظفين',
      features: ['نقاط البيع السريعة POS', 'إدارة المخزن الأساسية', 'فواتير المبيعات والمشتريات', 'دعم فني عبر البريد'],
      color: '#a1a1aa'
    },
    {
      name: 'Pro',
      nameAr: 'الباقة المتقدمة (Pro)',
      price: '$129/mo',
      branches: '3 فروع',
      users: 'حتى 15 موظف',
      features: ['كافة ميزات Starter', 'التحويل بين المستودعات وتتبع الشحنات', 'الورديات وإغلاق الصناديق Z', 'تقارير الأرباح المتقدمة', 'دعم فني ذو أولوية'],
      popular: true,
      color: '#10b981'
    },
    {
      name: 'Enterprise',
      nameAr: 'باقة الشركات الكبرى (Enterprise)',
      price: '$299/mo',
      branches: '10 فروع (قابلة للزيادة)',
      users: 'حتى 50 موظف',
      features: ['كافة ميزات Pro', 'عزل قواعد البيانات وTenant-Scoped Identity', 'إدارة سلاسل التوريد واللوجستيات', 'ذكاء اصطناعي وتحليلات تنبؤية Gemini', 'مفتاح إيقاف وتحكم مخصص (SLA 99.9%)'],
      color: '#c084fc'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
          {isAr ? 'الباقات وتراخيص الاستخدام (Plans & Quotas)' : 'Plans & Quotas'}
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
          {isAr ? 'تحديد قيود الفروع والمستخدمين والميزات المخصصة لكل منشأة مشتركة' : 'Manage subscription tiers and tenant limits'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {plans.map(p => (
          <div 
            key={p.name}
            style={{
              backgroundColor: '#121215',
              border: `1px solid ${p.popular ? 'rgba(16, 185, 129, 0.5)' : 'rgba(63, 63, 70, 0.5)'}`,
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: p.popular ? '0 10px 25px -5px rgba(16, 185, 129, 0.15)' : 'none'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: p.color }}>
                  {isAr ? p.nameAr : p.name}
                </span>
                {p.popular && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                    {isAr ? 'الأكثر طلباً' : 'Popular'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f4f4f5', marginBottom: '1rem' }}>
                {p.price}
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#18181b', borderRadius: '8px', fontSize: '0.8rem', color: '#d4d4d8', marginBottom: '1rem' }}>
                <div>{p.branches}</div>
                <div style={{ marginTop: '4px' }}>{p.users}</div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', color: '#a1a1aa' }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BillingView({ lang }: { lang: 'ar' | 'en' }) {
  const isAr = lang === 'ar';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
          {isAr ? 'إيرادات المنصة والتحصيل (Revenue & Billing)' : 'Platform Revenue & Billing'}
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
          {isAr ? 'الاشتراكات الشهرية والسنوية المحصلة من المنشآت المشتركة' : 'Track recurring SaaS subscription income'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#121215', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: '14px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>MRR (الدخل الشهري المتكرر)</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#34d399', marginTop: '0.4rem' }}>$4,760</div>
          <div style={{ fontSize: '0.74rem', color: '#10b981', marginTop: '4px' }}>+12.5% عن الشهر السابق</div>
        </div>

        <div style={{ backgroundColor: '#121215', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: '14px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>ARR (الدخل السنوي المتوقع)</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#34d399', marginTop: '0.4rem' }}>$57,120</div>
          <div style={{ fontSize: '0.74rem', color: '#71717a', marginTop: '4px' }}>استقرار معدل التجديد 98%</div>
        </div>

        <div style={{ backgroundColor: '#121215', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: '14px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>فواتير قيد التحصيل</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.4rem' }}>$650</div>
          <div style={{ fontSize: '0.74rem', color: '#f59e0b', marginTop: '4px' }}>2 منشآت مستحقة خلال هذا الأسبوع</div>
        </div>
      </div>
    </div>
  );
}

export function ServerHealthView({ lang }: { lang: 'ar' | 'en' }) {
  const isAr = lang === 'ar';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
          {isAr ? 'صحة الخوادم وقواعد البيانات (Server & Database Health)' : 'Server & Database Health'}
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
          {isAr ? 'مراقبة العقد اللوجستية، واستهلاك الذاكرة، واتصالات PostgreSQL' : 'Cluster performance and multi-tenant isolation status'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#121215', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: '14px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>PostgreSQL Primary DB</span>
            <Database size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginTop: '0.5rem' }}>
            Online (12ms)
          </div>
          <div style={{ fontSize: '0.74rem', color: '#71717a', marginTop: '4px' }}>
            Composite Unique Index: Active
          </div>
        </div>

        <div style={{ backgroundColor: '#121215', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: '14px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>.NET Core API Control Plane</span>
            <Server size={16} style={{ color: '#a855f7' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginTop: '0.5rem' }}>
            99.98% Uptime
          </div>
          <div style={{ fontSize: '0.74rem', color: '#71717a', marginTop: '4px' }}>
            Auth Middleware: Zero-Leakage Mode
          </div>
        </div>

        <div style={{ backgroundColor: '#121215', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: '14px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>Memory & CPU Utilization</span>
            <Cpu size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f4f4f5', marginTop: '0.5rem' }}>
            28% CPU / 42% RAM
          </div>
          <div style={{ fontSize: '0.74rem', color: '#10b981', marginTop: '4px' }}>
            Optimal load across 4 tenant pools
          </div>
        </div>
      </div>
    </div>
  );
}
