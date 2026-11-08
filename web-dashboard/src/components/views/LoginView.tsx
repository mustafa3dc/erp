import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  ArrowLeft, 
  LogIn, 
  AlertCircle, 
  Eye, 
  EyeOff,
  ShieldCheck,
  HelpCircle,
  X,
  Calculator,
  Sparkles
} from 'lucide-react';
import { UserAccount, UserProfile, buildUserProfileFromAccount } from '../../types/rbac';
import { getStoredUsers, getAllStoredUsersMaster } from '../../services/storageService';
import { getStoredTenants, createDefaultFeaturesForPreset } from '../../services/tenantService';
import { getRoleDefaultNav } from '../../auth/login-handler';

interface LoginViewProps {
  onLoginSuccess: (profile: UserProfile, account: UserAccount) => void;
  lang: 'ar' | 'en';
  onNavigateToHome?: () => void;
}

export default function LoginView({ 
  onLoginSuccess, 
  lang,
  onNavigateToHome
}: LoginViewProps) {
  const isAr = lang === 'ar';
  const users = getStoredUsers();
  const tenants = getStoredTenants();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    setTimeout(() => {
      const currentUsers = getAllStoredUsersMaster();
      const currentTenants = getStoredTenants();
      const cleanUser = username.trim().toLowerCase();

      if (!cleanUser) {
        setIsLoading(false);
        setErrorMessage(isAr ? 'يرجى إدخال اسم المستخدم ورمز المنشأة.' : 'Please enter your username and company slug.');
        return;
      }

      if (!password) {
        setIsLoading(false);
        setErrorMessage(isAr ? 'يرجى إدخال كلمة المرور.' : 'Please enter your password.');
        return;
      }

      // Case A: Platform Super Admin Exemption
      if (cleanUser === 'superadmin' || cleanUser === 'superadmin@platform') {
        const superAdminAccount = currentUsers.find(u => 
          u.role === 'PlatformSuperAdmin' || 
          u.username.toLowerCase() === 'superadmin'
        ) || {
          id: 'USR-PLATFORM-01',
          fullName: 'المدير العام للمنصة (SaaS Platform Owner)',
          username: 'superadmin',
          password: '123',
          email: 'owner@zilox.cloud',
          phone: '+1 (555) 000-0000',
          role: 'PlatformSuperAdmin' as const,
          branchId: 'PLATFORM',
          branchName: 'SaaS Platform Control Plane',
          defaultWarehouseId: 'PLATFORM',
          assignedBranches: [],
          isActive: true,
          createdAt: '2026-01-01',
          notes: 'مالك المنصة',
          tenantSlug: ''
        };

        if (superAdminAccount.password && superAdminAccount.password !== password) {
          setIsLoading(false);
          setErrorMessage(isAr ? 'كلمة المرور غير صحيحة.' : 'Incorrect password.');
          return;
        }

        setIsLoading(false);
        const profile = buildUserProfileFromAccount(superAdminAccount);
        profile.businessPreset = 'Custom';
        profile.businessPresetName = 'لوحة تحكم المنصة';
        profile.features = {
          enablePOS: true,
          multiWarehouse: true,
          maxWarehouses: 99,
          enableInstallments: true,
          enableSerialNumbers: true,
          enableVariants: true,
          enableMultiCurrency: true,
          enableCreditLimits: true,
          enableBarcodeScales: true,
          enableExpiryDates: true,
        };
        onLoginSuccess(profile, superAdminAccount);
        return;
      }

      // Case B: Tenant-Scoped Identity (username@company_slug)
      if (cleanUser.includes('@')) {
        const parts = cleanUser.split('@');
        const userPrefix = parts[0].trim();
        const tenantSlug = parts[1].trim();

        if (!userPrefix || !tenantSlug) {
          setIsLoading(false);
          setErrorMessage(isAr 
            ? 'صيغة اسم المستخدم غير صحيحة. يجب كتابة: اسم_المستخدم@رمز_الشركة (مثال: mustafa@m)' 
            : 'Invalid format. Required: username@company_slug (e.g. mustafa@m)');
          return;
        }

        // 1. Check Tenant Registry
        const tenant = currentTenants.find(t => t.slug.toLowerCase() === tenantSlug);
        if (!tenant) {
          setIsLoading(false);
          setErrorMessage(isAr 
            ? `رمز المنشأة (@${tenantSlug}) غير مسجل في النظام.` 
            : `Tenant organization (@${tenantSlug}) not registered.`);
          return;
        }

        // 2. Suspension Check
        if (!tenant.isActive) {
          setIsLoading(false);
          setErrorMessage(isAr 
            ? `تم تعليق اشتراك هذه المنشأة (${tenant.name}) مؤقتاً. يرجى التواصل مع إدارة المنصة والدعم الفني.` 
            : `This organization account (${tenant.name}) has been temporarily suspended. Please contact platform support.`);
          return;
        }

        // 3. Match User under Tenant strictly
        const matched = currentUsers.find(u => 
          (u.tenantSlug?.toLowerCase() === tenantSlug && (u.username.toLowerCase() === cleanUser || u.username.toLowerCase().split('@')[0] === userPrefix)) ||
          (cleanUser === `${userPrefix}@${tenantSlug}` && u.tenantSlug?.toLowerCase() === tenantSlug) ||
          (tenantSlug === 'm' && (u.username.toLowerCase() === userPrefix || u.email?.toLowerCase().startsWith(userPrefix)))
        );

        if (!matched) {
          setIsLoading(false);
          setErrorMessage(isAr 
            ? 'اسم المستخدم أو كلمة المرور غير صحيحة داخل هذه المنشأة.' 
            : 'Invalid username or password for this tenant.');
          return;
        }

        if (!matched.isActive) {
          setIsLoading(false);
          setErrorMessage(isAr 
            ? 'تم إيقاف هذا الحساب من قبل إدارة المنشأة.' 
            : 'This staff account has been deactivated by the company manager.');
          return;
        }

        if (matched.password && matched.password !== password) {
          setIsLoading(false);
          setErrorMessage(isAr 
            ? 'كلمة المرور غير صحيحة. يرجى التحقق والمحاولة مجدداً.' 
            : 'Incorrect password. Please try again.');
          return;
        }

        setIsLoading(false);
        const profile = buildUserProfileFromAccount(matched);
        const cleanUserPrefix = cleanUser.includes('@') ? cleanUser.split('@')[0].trim() : cleanUser.trim();
        profile.tenantId = tenant.id;
        profile.tenantSlug = tenant.slug;
        profile.tenantName = tenant.name;
        profile.fullName = matched.fullName || (tenant.adminUsername?.toLowerCase() === cleanUser ? tenant.adminFullName : 'مدير المنشأة');
        profile.username = cleanUserPrefix;
        matched.username = cleanUserPrefix;
        profile.businessPreset = tenant.businessPreset;
        profile.businessPresetName = tenant.businessPresetName;
        profile.features = tenant.features || createDefaultFeaturesForPreset(tenant.businessPreset || 'Custom');
        profile.defaultRoute = getRoleDefaultNav(profile.role);
        onLoginSuccess(profile, matched);
        return;
      }

      // Case C: Missing @slug Suffix
      setIsLoading(false);
      setErrorMessage(isAr 
        ? 'صيغة اسم المستخدم غير صحيحة. يجب كتابة: اسم_المستخدم@رمز_الشركة (مثال: mustafa@m أو admin@m). لحساب المالك اكتب: superadmin' 
        : 'Invalid username format. Must be username@company_slug (e.g. mustafa@m). For platform owner, use superadmin.');
    }, 350);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-zinc-100"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#09090b',
        padding: '1.5rem',
        direction: isAr ? 'rtl' : 'ltr',
        fontFamily: 'Cairo, Inter, system-ui, sans-serif'
      }}
    >
      <div 
        className="w-full max-w-[440px] flex flex-col items-center"
        style={{ width: '100%', maxWidth: '440px' }}
      >
        {/* Main Card */}
        <div 
          className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-900/85 backdrop-blur-md p-8 shadow-2xl space-y-6"
          style={{
            width: '100%',
            backgroundColor: 'rgba(24, 24, 27, 0.85)',
            border: '1px solid rgba(63, 63, 70, 0.5)',
            borderRadius: '1.25rem',
            padding: '2.25rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(16px)'
          }}
        >
          {/* Header */}
          <div className="text-center space-y-2 mb-6" style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div 
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 shadow-inner mb-3"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: 'rgba(39, 39, 42, 0.8)',
                border: '1px solid rgba(82, 82, 91, 0.5)',
                marginBottom: '1rem'
              }}
            >
              <ShieldCheck size={32} className="text-zinc-200" style={{ color: '#e4e4e7' }} />
            </div>
            
            <h1 
              className="text-2xl font-bold tracking-tight text-zinc-100"
              style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}
            >
              Bontu Enterprise Suite
            </h1>
            
            <p 
              className="text-sm text-zinc-400 mt-1"
              style={{ color: '#a1a1aa', fontSize: '0.9rem', marginTop: '0.4rem', margin: 0 }}
            >
              {isAr ? 'أدخل بيانات حسابك للوصول إلى المنظومة' : 'Enter your credentials to access the system'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div 
              className="rounded-xl border border-red-900/60 bg-red-950/40 p-3.5 text-sm text-red-300 flex items-center gap-3"
              style={{
                backgroundColor: 'rgba(69, 10, 10, 0.4)',
                border: '1px solid rgba(153, 27, 27, 0.5)',
                borderRadius: '0.75rem',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: '#fca5a5',
                fontSize: '0.85rem'
              }}
            >
              <AlertCircle size={18} className="shrink-0 text-red-400" style={{ flexShrink: 0, color: '#f87171' }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Field 1: Username or Email */}
            <div className="space-y-1.5">
              <label 
                className="block text-xs font-semibold text-zinc-300"
                style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '0.4rem' }}
              >
                {isAr ? 'اسم المستخدم' : 'Username'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={isAr ? 'username@company أو superadmin' : 'username@company or superadmin'}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: isAr ? '0.78rem 2.85rem 0.78rem 1rem' : '0.78rem 1rem 0.78rem 2.85rem',
                    textAlign: isAr ? 'right' : 'left',
                    backgroundColor: 'rgba(9, 9, 11, 0.65)',
                    border: '1px solid rgba(63, 63, 70, 0.6)',
                    borderRadius: '0.75rem',
                    color: '#f4f4f5',
                    fontSize: '0.92rem',
                    outline: 'none',
                    transition: 'all 0.15s'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#a1a1aa'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(63, 63, 70, 0.6)'}
                />
                <User 
                  size={18} 
                  style={{
                    position: 'absolute',
                    [isAr ? 'right' : 'left']: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#71717a',
                    pointerEvents: 'none'
                  }} 
                />
              </div>
            </div>

            {/* Field 2: Password */}
            <div className="space-y-1.5">
              <div 
                className="flex items-center justify-between"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  marginBottom: '0.4rem' 
                }}
              >
                <label 
                  className="block text-xs font-semibold text-zinc-300"
                  style={{ fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', margin: 0 }}
                >
                  {isAr ? 'كلمة المرور' : 'Password'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '0.78rem',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    textDecoration: 'none'
                  }}
                >
                  {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: isAr ? '0.78rem 2.85rem 0.78rem 2.85rem' : '0.78rem 2.85rem 0.78rem 2.85rem',
                    textAlign: isAr ? 'right' : 'left',
                    backgroundColor: 'rgba(9, 9, 11, 0.65)',
                    border: '1px solid rgba(63, 63, 70, 0.6)',
                    borderRadius: '0.75rem',
                    color: '#f4f4f5',
                    fontSize: '0.92rem',
                    outline: 'none',
                    transition: 'all 0.15s'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#a1a1aa'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(63, 63, 70, 0.6)'}
                />
                <Lock 
                  size={18} 
                  style={{
                    position: 'absolute',
                    [isAr ? 'right' : 'left']: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#71717a',
                    pointerEvents: 'none'
                  }} 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    [isAr ? 'left' : 'right']: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#71717a',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Field 3: Submit Button with RTL Left-directed Arrow */}
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 shadow-lg shadow-emerald-950/40 transition duration-150 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{
                width: '100%',
                marginTop: '0.75rem',
                padding: '0.85rem 1rem',
                borderRadius: '0.75rem',
                border: 'none',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {isAr ? (
                <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
              ) : (
                <LogIn size={18} className="transition-transform group-hover:translate-x-1" />
              )}
              <span>
                {isLoading 
                  ? (isAr ? 'جاري التحقق من الحساب...' : 'Authenticating...') 
                  : (isAr ? 'تسجيل الدخول' : 'Sign In')}
              </span>
            </button>
          </form>

          {/* Clean Return Link (Optional) */}
          {onNavigateToHome && (
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onNavigateToHome}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#71717a',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{isAr ? 'العودة إلى الموقع التعريفي' : 'Return to main site'}</span>
              </button>
            </div>
          )}

          {/* Footer Assistance Link */}
          <div 
            className="pt-4 border-t border-zinc-800/80 text-center"
            style={{ 
              marginTop: '1.75rem', 
              paddingTop: '1.25rem', 
              borderTop: '1px solid rgba(63, 63, 70, 0.4)', 
              textAlign: 'center' 
            }}
          >
            <button
              type="button"
              onClick={() => setShowSupportModal(true)}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1.5"
              style={{
                background: 'none',
                border: 'none',
                color: '#a1a1aa',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px'
              }}
            >
              <HelpCircle size={15} style={{ color: '#71717a' }} />
              <span>
                {isAr 
                  ? 'تواجه صعوبة في تسجيل الدخول؟ تواصل مع مسؤول النظام' 
                  : 'Having trouble signing in? Contact system administrator'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Support / Help Dialog */}
      {(showSupportModal || showForgotModal) && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            direction: isAr ? 'rtl' : 'ltr'
          }}
          onClick={() => {
            setShowSupportModal(false);
            setShowForgotModal(false);
          }}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#18181b',
              border: '1px solid rgba(63, 63, 70, 0.7)',
              borderRadius: '1rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
              color: '#f4f4f5'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem' }}>
                <ShieldCheck size={20} color="#a1a1aa" />
                <span>
                  {showForgotModal 
                    ? (isAr ? 'استعادة أو إعادة تعيين كلمة المرور' : 'Password Recovery') 
                    : (isAr ? 'الدعم الفني ومسؤول النظام' : 'System Administration & Support')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSupportModal(false);
                  setShowForgotModal(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#d4d4d8', fontSize: '0.88rem', lineHeight: '1.6', margin: '0 0 1rem 0' }}>
              {showForgotModal
                ? (isAr 
                    ? 'وفق السياسات الأمنية المعتمدة للمنظومة، يتم تعيين كلمات المرور وإعادة ضبطها مركزياً عبر مسؤول النظام أو إدارة تقنية المعلومات.'
                    : 'Per enterprise security policy, account passwords must be reset centrally by your system administrator.')
                : (isAr 
                    ? 'في حال مواجهة أي صعوبة في الوصول أو نسيت بيانات الدخول الخاصة بك، يرجى التواصل مع المسؤول المباشر أو قسم تقنية المعلومات.'
                    : 'If you have trouble signing in or forgot your credentials, please contact your system administrator.')}
            </p>

            <div style={{ 
              backgroundColor: 'rgba(9, 9, 11, 0.6)', 
              border: '1px solid rgba(63, 63, 70, 0.5)', 
              borderRadius: '0.75rem', 
              padding: '0.85rem', 
              fontSize: '0.82rem', 
              color: '#a1a1aa',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div><strong>{isAr ? 'البريد التقني المعتمد:' : 'Support Email:'}</strong> support@zilox-suite.com</div>
              <div><strong>{isAr ? 'الجهة المسؤولة:' : 'Department:'}</strong> {isAr ? 'إدارة تقنية المعلومات والمستودعات المركزية' : 'IT & Central Warehouses Management'}</div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowSupportModal(false);
                setShowForgotModal(false);
              }}
              style={{
                width: '100%',
                marginTop: '1.25rem',
                padding: '0.65rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(63, 63, 70, 0.7)',
                backgroundColor: 'rgba(39, 39, 42, 0.8)',
                color: '#f4f4f5',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
