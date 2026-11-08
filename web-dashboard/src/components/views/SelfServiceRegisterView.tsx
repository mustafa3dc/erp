import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight,
  ShieldCheck, 
  Boxes, 
  Globe2, 
  Phone, 
  Mail, 
  Layers, 
  Receipt, 
  ChevronRight,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { checkSlugAvailabilityApi, registerSelfServiceTenant, SelfServiceRegisterInput } from '../../services/tenantService';
import { UserProfile, UserAccount } from '../../types/rbac';
import { PRICING_TIERS, PlanTierId } from '../../lib/pricing-tiers';

interface SelfServiceRegisterViewProps {
  initialConfig?: {
    plan?: PlanTierId;
    warehouses?: number;
    users?: number;
    wms?: boolean;
    pos?: boolean;
    cycle?: 'monthly' | 'yearly';
    currency?: string;
  };
  onNavigateToPricing: () => void;
  onNavigateToLogin: () => void;
  onNavigateToHome?: () => void;
  onRegisterSuccess: (profile: UserProfile, account: UserAccount) => void;
}

const COUNTRIES = [
  { code: 'IQ', nameAr: 'العراق (IQ)', defaultCurrency: 'IQD', flag: '🇮🇶' },
  { code: 'SA', nameAr: 'المملكة العربية السعودية (SA)', defaultCurrency: 'SAR', flag: '🇸🇦' },
  { code: 'AE', nameAr: 'الإمارات العربية المتحدة (AE)', defaultCurrency: 'AED', flag: '🇦🇪' },
  { code: 'Global', nameAr: 'عالمي / دول أخرى (Global)', defaultCurrency: 'USD', flag: '' }
];

const CURRENCIES = [
  { code: 'IQD', nameAr: 'دينار عراقي (IQD)', symbol: 'د.ع' },
  { code: 'USD', nameAr: 'دولار أمريكي (USD)', symbol: '$' },
  { code: 'SAR', nameAr: 'ريال سعودي (SAR)', symbol: 'ر.س' },
  { code: 'AED', nameAr: 'درهم إماراتي (AED)', symbol: 'د.إ' }
];

// Helper to transliterate/clean Arabic names into an English slug
function suggestSlugFromCompanyName(name: string): string {
  if (!name.trim()) return '';
  
  // Clean prefixes like شركة، مؤسسة، متجر
  let cleaned = name
    .replace(/^(شركة|مؤسسة|متجر|مجموعة|معرض|محلات|مكتب)\s+/gi, '')
    .trim();

  // Arabic to Latin transliteration dictionary for common words/characters
  const arabicToLatinMap: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a',
    'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
    'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th',
    'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
    'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
    'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
    'ة': 'a', 'ء': '', 'ئ': 'e', 'ؤ': 'o'
  };

  let transliterated = '';
  for (const char of cleaned) {
    if (arabicToLatinMap[char]) {
      transliterated += arabicToLatinMap[char];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      transliterated += char.toLowerCase();
    } else if (char === ' ' || char === '-') {
      transliterated += '-';
    }
  }

  // Sanitize
  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
}

export default function SelfServiceRegisterView({
  initialConfig,
  onNavigateToPricing,
  onNavigateToLogin,
  onNavigateToHome,
  onRegisterSuccess
}: SelfServiceRegisterViewProps) {
  // Quotas & Plan Configuration from Query or Props
  const [selectedPlan, setSelectedPlan] = useState<PlanTierId>(initialConfig?.plan || 'Pro');
  const planTier = PRICING_TIERS[selectedPlan] || PRICING_TIERS.Pro;
  const [warehouses, setWarehouses] = useState<number>(initialConfig?.warehouses || planTier.quotas.warehouses);
  const [users, setUsers] = useState<number>(initialConfig?.users || planTier.quotas.users);
  const [wmsEnabled, setWmsEnabled] = useState<boolean>(initialConfig?.wms ?? (selectedPlan === 'Enterprise'));
  const [posEnabled, setPosEnabled] = useState<boolean>(initialConfig?.pos ?? true);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>(initialConfig?.cycle || 'yearly');
  
  // Section 1: Business Details
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{ isChecking: boolean; isAvailable: boolean | null; message: string }>({
    isChecking: false,
    isAvailable: null,
    message: ''
  });
  const [countryCode, setCountryCode] = useState('IQ');
  const [currency, setCurrency] = useState(initialConfig?.currency || 'IQD');

  // Section 2: Owner & First Admin
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [contactInfo, setContactInfo] = useState('');

  // UI Flow State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Auto-suggest slug when company name changes unless manually edited
  useEffect(() => {
    if (!isSlugManuallyEdited && companyName.trim()) {
      const suggested = suggestSlugFromCompanyName(companyName);
      if (suggested) {
        setSlug(suggested);
      }
    }
  }, [companyName, isSlugManuallyEdited]);

  // Real-time Slug Availability Verification Debounce
  useEffect(() => {
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug || cleanSlug.length < 2) {
      setSlugStatus({ isChecking: false, isAvailable: null, message: '' });
      return;
    }

    setSlugStatus(prev => ({ ...prev, isChecking: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await checkSlugAvailabilityApi(cleanSlug);
        setSlugStatus({
          isChecking: false,
          isAvailable: res.isAvailable,
          message: res.message
        });
      } catch {
        setSlugStatus({ isChecking: false, isAvailable: true, message: 'متاح' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug]);

  // Sync Currency with Country when Country changes
  const handleCountryChange = (newCountryCode: string) => {
    setCountryCode(newCountryCode);
    const countryObj = COUNTRIES.find(c => c.code === newCountryCode);
    if (countryObj) {
      setCurrency(countryObj.defaultCurrency);
    }
  };

  // Auto-generate secure password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAdminPassword(res);
    setShowPassword(true);
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validations
    if (!companyName.trim()) {
      setFormError('يرجى إدخال اسم الشركة أو المتجر.');
      return;
    }

    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug || cleanSlug.length < 2) {
      setFormError('يرجى تحديد رمز مختصر للمنشأة لا يقل عن حرفين (أحرف إنجليزية وأرقام فقط).');
      return;
    }

    if (!adminFullName.trim()) {
      setFormError('يرجى إدخال الاسم الكامل للمدير أو مالك المنشأة.');
      return;
    }

    const cleanAdmin = adminUsername.trim().toLowerCase().replace(/@.+$/, '');
    if (!cleanAdmin) {
      setFormError('يرجى تحديد اسم المستخدم المفضل.');
      return;
    }

    if (!adminPassword || adminPassword.length < 4) {
      setFormError('كلمة المرور يجب ألا تقل عن 4 خانات.');
      return;
    }

    setIsSubmitting(true);

    try {
      const input: SelfServiceRegisterInput = {
        companyName: companyName.trim(),
        slug: cleanSlug,
        countryCode,
        currency,
        plan: selectedPlan,
        maxWarehouses: warehouses,
        maxUsers: users,
        wmsEnabled,
        posEnabled,
        billingCycle: cycle,
        adminFullName: adminFullName.trim(),
        adminUsername: cleanAdmin,
        adminPassword,
        contactInfo: contactInfo.trim()
      };

      const result = await registerSelfServiceTenant(input);

      if (result.success && result.userProfile && result.userAccount) {
        // Successfully registered! Directly hand off to active dashboard session
        onRegisterSuccess(result.userProfile, result.userAccount);
      } else {
        setIsSubmitting(false);
        setFormError(result.message || 'حدث خطأ أثناء إتمام عملية التسجيل.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err?.message || 'حدث خطأ في الاتصال بالخادم. يرجى المحاولة مجدداً.');
    }
  };

  return (
    <div 
      className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30"
      style={{
        direction: 'rtl',
        fontFamily: 'Cairo, Inter, system-ui, sans-serif',
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#f4f4f5',
        padding: '2rem 1.5rem 4rem'
      }}
    >
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        {/* Top Navigation / Brand */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '2rem'
          }}
        >
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
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981'
              }}
            >
              <Boxes size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f4f4f5' }}>
                ZiloX Business Suite
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>
                بوابة تهيئة وتسجيل المنشأة الذاتية
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToLogin}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              borderRadius: '0.75rem',
              border: '1px solid rgba(63, 63, 70, 0.6)',
              backgroundColor: 'rgba(39, 39, 42, 0.5)',
              color: '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <span>لديك حساب بالفعل؟</span>
            <ArrowLeft size={14} />
          </button>
        </div>

        {/* Selected Package Summary Pill Banner */}
        <div 
          style={{
            backgroundColor: 'rgba(24, 24, 27, 0.8)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '1rem',
            padding: '1rem 1.25rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                fontSize: '0.82rem',
                fontWeight: 800
              }}
            >
              تجربة مجانية 14 يوماً
            </div>
            <div style={{ fontSize: '0.88rem', color: '#e4e4e7' }}>
              <strong>الباقة المختارة:</strong> {planTier.nameAr} ({selectedPlan}) — {planTier.pricing.monthlyUsd}$ / شهر (~{planTier.pricing.monthlyIqd.toLocaleString()} د.ع) • {warehouses} {warehouses === 1 ? 'مستودع' : 'مستودعات'} • {users} مستخدمين • ({cycle === 'yearly' ? 'فوترة سنوية - شهرين مجاناً' : 'فوترة شهرية'})
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToPricing}
            style={{
              background: 'none',
              border: 'none',
              color: '#34d399',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              textDecoration: 'underline'
            }}
          >
            <span>تعديل الباقة بالحاسبة</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Error Banner */}
        {formError && (
          <div 
            style={{
              backgroundColor: 'rgba(69, 10, 10, 0.4)',
              border: '1px solid rgba(153, 27, 27, 0.6)',
              borderRadius: '0.75rem',
              padding: '0.85rem 1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#fca5a5',
              fontSize: '0.88rem'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, color: '#f87171' }} />
            <span>{formError}</span>
          </div>
        )}

        {/* The Two-Section Registration Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* SECTION 1: Business & Organization Details */}
          <div 
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '1.25rem',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(63, 63, 70, 0.4)', paddingBottom: '0.75rem' }}>
              <Building2 size={20} color="#10b981" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>
                القسم الأول: بيانات المنشأة والتجارة
              </h2>
            </div>

            {/* Field 1: Company Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8', marginBottom: '0.4rem' }}>
                اسم الشركة أو المتجر <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="مثال: شركة المدار للإلكترونيات والتجارة العامة"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.8rem 1rem',
                  backgroundColor: 'rgba(9, 9, 11, 0.65)',
                  border: '1px solid rgba(63, 63, 70, 0.6)',
                  borderRadius: '0.75rem',
                  color: '#f4f4f5',
                  fontSize: '0.92rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Field 2: Organization Slug (Identifier) with LTR and Left @ Badge */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8', marginBottom: '0.4rem' }}>
                رمز المنشأة المختصر (المعرّف) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                {/* Fixed @ Badge on the Left */}
                <span 
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#10b981',
                    fontWeight: 800,
                    fontSize: '1rem',
                    pointerEvents: 'none',
                    zIndex: 2
                  }}
                >
                  @
                </span>

                <input
                  type="text"
                  required
                  dir="ltr"
                  value={slug}
                  onChange={e => {
                    setIsSlugManuallyEdited(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                  }}
                  placeholder="almadar"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.8rem 2.5rem 0.8rem 2.4rem',
                    textAlign: 'left',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    backgroundColor: 'rgba(9, 9, 11, 0.65)',
                    border: slugStatus.isAvailable === false 
                      ? '1px solid #ef4444' 
                      : slugStatus.isAvailable === true 
                        ? '1px solid #10b981' 
                        : '1px solid rgba(63, 63, 70, 0.6)',
                    borderRadius: '0.75rem',
                    color: '#f4f4f5',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                />

                {/* Right Indicator (Checking or Status) */}
                <div 
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {slugStatus.isChecking ? (
                    <Loader2 size={16} className="animate-spin text-zinc-400" />
                  ) : slugStatus.isAvailable === true ? (
                    <CheckCircle2 size={18} color="#10b981" />
                  ) : slugStatus.isAvailable === false ? (
                    <AlertCircle size={18} color="#ef4444" />
                  ) : null}
                </div>
              </div>

              {/* Sub-label feedback */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem' }}>
                <span style={{ color: slugStatus.isAvailable === false ? '#f87171' : slugStatus.isAvailable === true ? '#34d399' : '#a1a1aa' }}>
                  {slugStatus.message || 'يُستخدم هذا المعرف في روابط الفروع ودخول موظفيك (أحرف إنجليزية وأرقام فقط)'}
                </span>
                {companyName && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSlugManuallyEdited(false);
                      setSlug(suggestSlugFromCompanyName(companyName));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a1a1aa',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    <RefreshCw size={11} />
                    <span>إعادة اقتراح تلقائي</span>
                  </button>
                )}
              </div>
            </div>

            {/* Field 3 & 4: Country and Currency Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {/* Country Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8', marginBottom: '0.4rem' }}>
                  دولة العمليات الأساسية <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={countryCode}
                  onChange={e => handleCountryChange(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.8rem 1rem',
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(63, 63, 70, 0.6)',
                    borderRadius: '0.75rem',
                    color: '#f4f4f5',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code} style={{ backgroundColor: '#18181b' }}>
                      {c.flag} {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Currency Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8', marginBottom: '0.4rem' }}>
                  العملة الأساسية للحسابات <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.8rem 1rem',
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(63, 63, 70, 0.6)',
                    borderRadius: '0.75rem',
                    color: '#f4f4f5',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code} style={{ backgroundColor: '#18181b' }}>
                      {c.nameAr} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Owner & First Administrator Account */}
          <div 
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              border: '1px solid rgba(63, 63, 70, 0.5)',
              borderRadius: '1.25rem',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(63, 63, 70, 0.4)', paddingBottom: '0.75rem' }}>
              <User size={20} color="#10b981" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>
                القسم الثاني: بيانات حساب المالك والمدير الأول
              </h2>
            </div>

            {/* Field 1: Admin Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8', marginBottom: '0.4rem' }}>
                الاسم الكامل للمدير / صاحب الحساب <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={adminFullName}
                onChange={e => setAdminFullName(e.target.value)}
                placeholder="مثال: المهندس أحمد سالم"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.8rem 1rem',
                  backgroundColor: 'rgba(9, 9, 11, 0.65)',
                  border: '1px solid rgba(63, 63, 70, 0.6)',
                  borderRadius: '0.75rem',
                  color: '#f4f4f5',
                  fontSize: '0.92rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Field 2: Preferred Username + Live Preview */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8', marginBottom: '0.4rem' }}>
                اسم المستخدم المفضل <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                dir="ltr"
                value={adminUsername}
                onChange={e => setAdminUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="admin"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.8rem 1rem',
                  textAlign: 'left',
                  fontFamily: 'monospace',
                  backgroundColor: 'rgba(9, 9, 11, 0.65)',
                  border: '1px solid rgba(63, 63, 70, 0.6)',
                  borderRadius: '0.75rem',
                  color: '#f4f4f5',
                  fontSize: '0.92rem',
                  outline: 'none'
                }}
              />

              {/* Instant Live Identity Preview */}
              <div 
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  fontSize: '0.82rem',
                  color: '#6ee7b7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <span>معاينة الدخول:</span>
                <strong dir="ltr" style={{ fontFamily: 'monospace', color: '#34d399' }}>
                  {adminUsername || 'admin'}@{slug || 'your_slug'}
                </strong>
              </div>
            </div>

            {/* Field 3: Password with Eye Toggle + Auto Generator Button */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8', margin: 0 }}>
                  كلمة المرور الخاصة به <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#34d399',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <KeyRound size={13} />
                  <span>توليد تلقائي لكلمة المرور</span>
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.8rem 2.8rem 0.8rem 1rem',
                    textAlign: 'left',
                    fontFamily: showPassword ? 'monospace' : 'inherit',
                    backgroundColor: 'rgba(9, 9, 11, 0.65)',
                    border: '1px solid rgba(63, 63, 70, 0.6)',
                    borderRadius: '0.75rem',
                    color: '#f4f4f5',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
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
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Field 4: Contact Email or Phone */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8', marginBottom: '0.4rem' }}>
                رقم الهاتف أو البريد الإلكتروني للتواصل والإشعارات
              </label>
              <input
                type="text"
                value={contactInfo}
                onChange={e => setContactInfo(e.target.value)}
                placeholder="e.g. info@company.com or +1 (555) 000-0000"
                dir="ltr"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.8rem 1rem',
                  textAlign: 'left',
                  backgroundColor: 'rgba(9, 9, 11, 0.65)',
                  border: '1px solid rgba(63, 63, 70, 0.6)',
                  borderRadius: '0.75rem',
                  color: '#f4f4f5',
                  fontSize: '0.92rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Submit Action Card */}
          <div 
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '1.25rem',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 800 }}>
              <ShieldCheck size={20} />
              <span>جاهز للانطلاق — سيتم إنشاء المستودع الرئيسي وصندوق الكاش وحسابك آلياً</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || slugStatus.isAvailable === false}
              style={{
                width: '100%',
                maxWidth: '440px',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: 'none',
                backgroundColor: isSubmitting || slugStatus.isAvailable === false ? '#064e3b' : '#10b981',
                color: '#022c22',
                fontSize: '1.05rem',
                fontWeight: 800,
                cursor: isSubmitting || slugStatus.isAvailable === false ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.15s'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin text-zinc-950" />
                  <span>جاري تهيئة قاعدة البيانات وإنشاء المنشأة...</span>
                </>
              ) : (
                <>
                  <span>إطلاق المنشأة وبدء التجربة المجانية 14 يوماً</span>
                  <ArrowLeft size={20} />
                </>
              )}
            </button>

            <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
              بالنقر على زر الإطلاق، يتم قبول شروط الخدمة وسياسة الخصوصية لمنظومة ZiloX Enterprise.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
