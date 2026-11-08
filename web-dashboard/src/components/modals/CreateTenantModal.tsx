import React, { useState } from 'react';
import {
  Building2,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Sparkles,
  Globe,
  Coins,
  Calendar,
  Layers,
  Phone,
  Mail,
  User,
  Lock,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';
import { CreateTenantInput, createNewTenant, Tenant } from '../../services/tenantService';

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTenant: Tenant, message: string) => void;
  lang?: 'ar' | 'en';
}

export default function CreateTenantModal({
  isOpen,
  onClose,
  onSuccess,
  lang = 'ar'
}: CreateTenantModalProps) {
  const isAr = lang === 'ar';

  const [form, setForm] = useState<CreateTenantInput>({
    name: '',
    slug: '',
    countryCode: 'IQ',
    currency: 'IQD',
    plan: 'Pro',
    subscriptionTerm: 'annual_12',
    contactInfo: '',
    maxBranches: 3,
    maxUsers: 10,
    adminFullName: '',
    adminUsername: 'admin',
    adminPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [copiedPass, setCopiedPass] = useState(false);

  if (!isOpen) return null;

  // Handle plan change and automatically update quotas
  const handlePlanChange = (newPlan: 'Starter' | 'Pro' | 'Enterprise') => {
    let branches = 3;
    let users = 10;
    if (newPlan === 'Starter') {
      branches = 1;
      users = 3;
    } else if (newPlan === 'Enterprise') {
      branches = 10;
      users = 50;
    }

    setForm(prev => ({
      ...prev,
      plan: newPlan,
      maxBranches: branches,
      maxUsers: users
    }));
  };

  // Handle country change with suggested default currency
  const handleCountryChange = (countryCode: string) => {
    let suggestedCurrency = form.currency;
    if (countryCode === 'IQ') suggestedCurrency = 'IQD';
    else if (countryCode === 'SA') suggestedCurrency = 'SAR';
    else if (countryCode === 'AE') suggestedCurrency = 'AED';
    else if (countryCode === 'GLOBAL') suggestedCurrency = 'USD';

    setForm(prev => ({
      ...prev,
      countryCode,
      currency: suggestedCurrency
    }));
  };

  // Generate strong 10-character password
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm(prev => ({ ...prev, adminPassword: result }));
    setShowPassword(true);
  };

  const copyPasswordToClipboard = () => {
    if (!form.adminPassword) return;
    navigator.clipboard.writeText(form.adminPassword);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError(isAr ? 'يرجى إدخال اسم المنشأة أو الشركة' : 'Please provide organization name');
      return;
    }

    const cleanSlug = form.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanSlug) {
      setError(isAr ? 'يرجى إدخال رمز المنشأة المختصر (المعرّف)' : 'Please provide tenant slug identifier');
      return;
    }

    if (!form.adminFullName.trim() || !form.adminUsername.trim()) {
      setError(isAr ? 'يرجى إدخال بيانات حساب المدير كاملاً' : 'Please fill admin name and username');
      return;
    }

    if (!form.adminPassword) {
      setError(isAr ? 'يرجى تعيين كلمة مرور للمدير أو الضغط على [ توليد تلقائي ]' : 'Please set a password or generate one');
      return;
    }

    const res = createNewTenant({
      ...form,
      slug: cleanSlug,
      adminUsername: form.adminUsername.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '')
    });

    if (!res.success) {
      setError(res.message);
      return;
    }

    if (res.tenant) {
      onSuccess(res.tenant, res.message);
      onClose();
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        direction: isAr ? 'rtl' : 'ltr'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#18181b',
          border: '1px solid rgba(63, 63, 70, 0.8)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95)',
          color: '#f4f4f5',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(63, 63, 70, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#141417'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399'
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f4f4f5' }}>
                {isAr ? 'إضافة شركة / منشأة جديدة للنظام' : 'Provision New Tenant Organization'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px' }}>
                {isAr ? 'تأسيس بيئة المنشأة وتوليد بيانات المشرف الأول' : 'Setup tenant workspace & initial administrator'}
              </div>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#71717a',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#f4f4f5'}
            onMouseLeave={e => e.currentTarget.style.color = '#71717a'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div 
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                fontSize: '0.84rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form id="create-tenant-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Section 1: Basic Company Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Org Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '5px' }}>
                  {isAr ? 'اسم المنشأة أو الشركة *' : 'Company / Organization Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder={isAr ? 'مثال: شركة النور للمواد الكهربائية' : 'e.g. Al-Noor Trading Co.'}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#09090b',
                    border: '1px solid rgba(63, 63, 70, 0.6)',
                    borderRadius: '8px',
                    color: '#f4f4f5',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Slug + Contact Info in 2 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr', gap: '0.85rem' }}>
                {/* Clean LTR Slug with Left-Anchored @ */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '5px' }}>
                    {isAr ? 'رمز المنشأة المختصر (المعرّف) *' : 'Tenant Identifier (Slug) *'}
                  </label>
                  <div style={{ position: 'relative' }} dir="ltr">
                    <span 
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#34d399',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        userSelect: 'none'
                      }}
                    >
                      @
                    </span>
                    <input
                      dir="ltr"
                      type="text"
                      required
                      value={form.slug}
                      onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                      placeholder="alnoor"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '0.65rem 0.85rem 0.65rem 2rem',
                        backgroundColor: '#09090b',
                        border: '1px solid rgba(63, 63, 70, 0.6)',
                        borderRadius: '8px',
                        color: '#34d399',
                        fontSize: '0.88rem',
                        fontFamily: 'monospace',
                        textAlign: 'left',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '3px' }}>
                    {isAr ? 'حروف إنجليزية وأرقام فقط' : 'Lowercase letters & numbers'}
                  </div>
                </div>

                {/* Contact Email or Phone */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '5px' }}>
                    {isAr ? 'رقم هاتف المالك أو البريد الإلكتروني' : 'Owner Phone or Email'}
                  </label>
                  <input
                    type="text"
                    value={form.contactInfo || ''}
                    onChange={e => setForm({ ...form, contactInfo: e.target.value })}
                    placeholder={isAr ? 'info@company.com أو رقم الهاتف الدولي...' : 'info@domain.com or +1 (555) 000-0000'}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#09090b',
                      border: '1px solid rgba(63, 63, 70, 0.6)',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '0.88rem',
                      outline: 'none'
                    }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '3px' }}>
                    {isAr ? 'للتواصل وإرسال بيانات الحساب' : 'For dispatching credentials'}
                  </div>
                </div>
              </div>

              {/* Country, Currency, Subscription Term in 3 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.3fr', gap: '0.85rem' }}>
                {/* Country */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '5px' }}>
                    {isAr ? 'الدولة *' : 'Country *'}
                  </label>
                  <select
                    value={form.countryCode}
                    onChange={e => handleCountryChange(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#09090b',
                      border: '1px solid rgba(63, 63, 70, 0.6)',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '0.86rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="IQ">{isAr ? 'العراق (IQ)' : 'Iraq (IQ)'}</option>
                    <option value="SA">{isAr ? 'السعودية (SA)' : 'Saudi Arabia (SA)'}</option>
                    <option value="AE">{isAr ? 'الإمارات (AE)' : 'UAE (AE)'}</option>
                    <option value="GLOBAL">{isAr ? 'عالمي (Global)' : 'Global'}</option>
                  </select>
                </div>

                {/* Currency */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '5px' }}>
                    {isAr ? 'العملة الأساسية' : 'Currency'}
                  </label>
                  <select
                    value={form.currency}
                    onChange={e => setForm({ ...form, currency: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#09090b',
                      border: '1px solid rgba(63, 63, 70, 0.6)',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '0.86rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="IQD">دينار عراقي (IQD)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                  </select>
                </div>

                {/* Subscription Term */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '5px' }}>
                    {isAr ? 'مدة التعاقد والاشتراك *' : 'Subscription Term *'}
                  </label>
                  <select
                    value={form.subscriptionTerm || 'annual_12'}
                    onChange={e => setForm({ ...form, subscriptionTerm: e.target.value as any })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#09090b',
                      border: '1px solid rgba(63, 63, 70, 0.6)',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '0.86rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="annual_12">{isAr ? 'اشتراك سنوي (12 شهر)' : 'Annual (12 Months)'}</option>
                    <option value="monthly_1">{isAr ? 'اشتراك شهري (1 شهر)' : 'Monthly (1 Month)'}</option>
                    <option value="trial_14">{isAr ? 'تجريبي (14 يوم)' : 'Free Trial (14 Days)'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Plan & Dynamic Quotas */}
            <div 
              style={{
                padding: '1rem',
                backgroundColor: 'rgba(24, 24, 27, 0.5)',
                border: '1px solid rgba(63, 63, 70, 0.45)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#34d399' }}>
                  {isAr ? 'باقة الاشتراك والحصص التشغيلية' : 'Subscription Plan & Quotas'}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
                  {isAr ? 'تتغير الحصص تلقائياً حسب الباقة' : 'Quotas auto-adjust by tier'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '0.85rem' }}>
                {/* Plan Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '4px' }}>
                    {isAr ? 'باقة الاشتراك' : 'Plan Tier'}
                  </label>
                  <select
                    value={form.plan}
                    onChange={e => handlePlanChange(e.target.value as any)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#09090b',
                      border: '1px solid rgba(63, 63, 70, 0.6)',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '0.86rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Starter">{isAr ? 'أساسية (Starter)' : 'Starter'}</option>
                    <option value="Pro">{isAr ? 'احترافية (Pro)' : 'Pro'}</option>
                    <option value="Enterprise">{isAr ? 'مؤسسات (Enterprise)' : 'Enterprise'}</option>
                  </select>
                </div>

                {/* Max Branches */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '4px' }}>
                    {isAr ? 'الحد الأقصى للفروع' : 'Max Branches'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.maxBranches}
                    onChange={e => setForm({ ...form, maxBranches: parseInt(e.target.value) || 1 })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#09090b',
                      border: '1px solid rgba(63, 63, 70, 0.6)',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '0.88rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Max Users */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '4px' }}>
                    {isAr ? 'الحد الأقصى للمستخدمين' : 'Max Users'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={form.maxUsers}
                    onChange={e => setForm({ ...form, maxUsers: parseInt(e.target.value) || 1 })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#09090b',
                      border: '1px solid rgba(63, 63, 70, 0.6)',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '0.88rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: First Admin User Credentials */}
            <div 
              style={{
                padding: '1rem',
                backgroundColor: 'rgba(9, 9, 11, 0.75)',
                border: '1px solid rgba(63, 63, 70, 0.6)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#34d399' }}>
                  {isAr ? 'بيانات حساب المدير الأول للمنظومة' : 'First Administrator Credentials'}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
                  {isAr ? 'يتمتع بكافة الصلاحيات الإدارية' : 'Full Tenant Root Privileges'}
                </span>
              </div>

              {/* Admin Name & Username in 2 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#d4d4d8', marginBottom: '4px' }}>
                    {isAr ? 'الاسم الكامل للمدير *' : 'Admin Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.adminFullName}
                    onChange={e => setForm({ ...form, adminFullName: e.target.value })}
                    placeholder={isAr ? 'أحمد علي' : 'Ahmed Ali'}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.6rem 0.8rem',
                      backgroundColor: '#18181b',
                      border: '1px solid rgba(63, 63, 70, 0.6)',
                      borderRadius: '6px',
                      color: '#f4f4f5',
                      fontSize: '0.86rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#d4d4d8', marginBottom: '4px' }}>
                    {isAr ? 'اسم المستخدم *' : 'Username *'}
                  </label>
                  <input
                    dir="ltr"
                    type="text"
                    required
                    value={form.adminUsername}
                    onChange={e => setForm({ ...form, adminUsername: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') })}
                    placeholder="admin"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.6rem 0.8rem',
                      backgroundColor: '#18181b',
                      border: '1px solid rgba(63, 63, 70, 0.6)',
                      borderRadius: '6px',
                      color: '#f4f4f5',
                      fontSize: '0.86rem',
                      fontFamily: 'monospace',
                      textAlign: 'left',
                      outline: 'none'
                    }}
                  />
                  {/* Realtime Scoped Username Preview */}
                  <div style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '4px', fontFamily: 'monospace' }}>
                    {isAr ? 'حساب الدخول سيكون:' : 'Full Login Identity:'}{' '}
                    <span style={{ color: '#34d399', fontWeight: 700 }} dir="ltr">
                      {form.adminUsername || 'admin'}@{form.slug || 'company'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Password with Eye Toggle and Auto Generate Button */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#d4d4d8' }}>
                    {isAr ? 'كلمة المرور الأولية *' : 'Initial Password *'}
                  </label>
                  
                  {/* Auto Generate Button */}
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: 'none',
                      border: 'none',
                      color: '#34d399',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    title={isAr ? 'توليد كلمة مرور عشوائية قوية من 10 خانات' : 'Generate random 10-char password'}
                  >
                    <Sparkles size={13} />
                    <span>{isAr ? 'توليد تلقائي' : 'Auto Generate'}</span>
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.adminPassword}
                    onChange={e => setForm({ ...form, adminPassword: e.target.value })}
                    placeholder="••••••••••"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: isAr ? '0.6rem 4.5rem 0.6rem 0.8rem' : '0.6rem 0.8rem 0.6rem 4.5rem',
                      backgroundColor: '#18181b',
                      border: '1px solid rgba(63, 63, 70, 0.6)',
                      borderRadius: '6px',
                      color: '#f4f4f5',
                      fontSize: '0.86rem',
                      fontFamily: showPassword ? 'monospace' : 'inherit',
                      outline: 'none'
                    }}
                  />

                  {/* Eye Toggle & Copy Button inside input */}
                  <div 
                    style={{
                      position: 'absolute',
                      [isAr ? 'left' : 'right']: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {form.adminPassword && (
                      <button
                        type="button"
                        onClick={copyPasswordToClipboard}
                        title={copiedPass ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ كلمة المرور' : 'Copy password')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedPass ? '#34d399' : '#a1a1aa',
                          cursor: 'pointer',
                          padding: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '4px'
                        }}
                      >
                        {copiedPass ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide') : (isAr ? 'إظهار كلمة المرور' : 'Show')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                        padding: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '4px'
                      }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div 
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(63, 63, 70, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            backgroundColor: '#141417'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.65rem 1.15rem',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(63, 63, 70, 0.6)',
              color: '#d4d4d8',
              cursor: 'pointer',
              fontSize: '0.86rem',
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(63, 63, 70, 0.3)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="submit"
            form="create-tenant-form"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-emerald-950/40"
            style={{
              padding: '0.65rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.88rem',
              transition: 'all 0.15s ease'
            }}
          >
            {isAr ? 'تأكيد وحفظ المنشأة' : 'Save & Provision Tenant'}
          </button>
        </div>
      </div>
    </div>
  );
}
