import React from 'react';
import { ShieldAlert, ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { UserProfile } from '../../types/rbac';
import { getCleanUsername, getRoleDefaultNav } from '../../auth/login-handler';

interface ForbiddenViewProps {
  requestedNav: string;
  user: UserProfile;
  onNavigateHome: () => void;
  lang?: 'en' | 'ar';
}

export default function ForbiddenView({
  requestedNav,
  user,
  onNavigateHome,
  lang = 'ar'
}: ForbiddenViewProps) {
  const isAr = lang === 'ar';

  // Strictly sanitize username and full name - purge '@a' or '@tenant' leak
  const cleanUsername = getCleanUsername(user.username);
  const cleanFullName = user.fullName?.includes('@')
    ? getCleanUsername(user.fullName)
    : user.fullName;
  const displayName = cleanFullName && cleanFullName !== cleanUsername
    ? `${cleanFullName} (${cleanUsername})`
    : (cleanFullName || cleanUsername || 'المستخدم');

  // Dynamic role-based safe target view (Never return Cashier to Dashboard)
  const safeDefaultView = getRoleDefaultNav(user.role);

  const handleReturn = () => {
    onNavigateHome();
  };

  return (
    <div className="view-content-wrapper fade-in" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '68vh',
      padding: '40px 20px'
    }}>
      <div 
        className="glass-panel"
        style={{
          maxWidth: '620px',
          width: '100%',
          background: 'radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.95) 75%)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '20px',
          padding: '36px',
          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.15)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Glow Accent Top */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #ef4444, transparent)'
        }} />

        {/* Security Icon */}
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '20px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          color: '#ef4444',
          boxShadow: '0 0 25px rgba(239, 68, 68, 0.25)'
        }}>
          <ShieldAlert size={38} />
        </div>

        {/* Status Code & Title */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 800,
          color: '#f87171',
          letterSpacing: '0.05em',
          marginBottom: '14px'
        }}>
          <Lock size={12} />
          <span>{isAr ? 'رمز الخطأ 403 • وصول مقيد بالصلاحيات' : 'HTTP 403 • ACCESS RESTRICTED'}</span>
        </div>

        <h2 style={{
          margin: '0 0 10px 0',
          fontSize: '22px',
          fontWeight: 900,
          color: '#f8fafc'
        }}>
          {isAr ? 'تم حظر الوصول — صلاحيات غير كافية' : 'Access Denied — Insufficient Role Permissions'}
        </h2>

        <p style={{
          fontSize: '13px',
          color: '#94a3b8',
          lineHeight: '1.7',
          margin: '0 0 24px 0'
        }}>
          {isAr
            ? `عذراً، دورك الوظيفي الحالي (${user.roleNameAr}) لا يمتلك تصريح الوصول الأمني إلى شاشة [${requestedNav}]. يتم حظر الوصول وتصفية البيانات برمجياً لحماية سرية العمليات والسياسات المالية.`
            : `Sorry, your active role (${user.roleNameEn}) does not possess authorization to access [${requestedNav}]. Routes are guarded under enterprise security policies.`}
        </p>

        {/* Context Details Card - Purged of '@a' Leak */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: isAr ? 'right' : 'left',
          fontSize: '12px',
          lineHeight: '1.8',
          marginBottom: '26px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
            <span style={{ color: '#94a3b8' }}>{isAr ? 'المستخدم النشط:' : 'Active User:'}</span>
            <strong style={{ color: '#fff' }}>
              {displayName}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '8px 0' }}>
            <span style={{ color: '#94a3b8' }}>{isAr ? 'الرتبة والدور:' : 'Assigned Role:'}</span>
            <span style={{ 
              color: 'var(--primary)', 
              fontWeight: 700, 
              background: 'rgba(56, 189, 248, 0.1)', 
              padding: '2px 8px', 
              borderRadius: '6px' 
            }}>
              {isAr ? user.roleNameAr : user.roleNameEn}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '8px 0' }}>
            <span style={{ color: '#94a3b8' }}>{isAr ? 'الشاشة المحظورة:' : 'Guarded Route:'}</span>
            <span style={{ color: '#f87171', fontFamily: 'monospace', fontWeight: 700 }}>{requestedNav}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px' }}>
            <span style={{ color: '#94a3b8' }}>{isAr ? 'الفرع المصرح به:' : 'Authorized Scope:'}</span>
            <span style={{ color: '#e2e8f0' }}>{user.branchName}</span>
          </div>
        </div>

        {/* Action Button - Directly returns Cashier to Cloud POS without hitting 403 again */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handleReturn}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px var(--primary-glow)'
            }}
          >
            {isAr ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
            <span>
              {isAr
                ? `العودة إلى شاشتك المعتمدة (${safeDefaultView})`
                : `Return to Default View (${safeDefaultView})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
