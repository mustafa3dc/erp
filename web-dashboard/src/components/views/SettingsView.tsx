import React, { useState } from 'react';
import { 
  Settings, 
  CheckCircle2, 
  Bell, 
  Database, 
  Languages, 
  Sun, 
  Moon, 
  Monitor, 
  Volume2, 
  VolumeX, 
  Building2, 
  DollarSign, 
  Loader2, 
  Download, 
  RotateCcw, 
  Trash2,
  Plus,
  AlertTriangle,
  X,
  Scale,
  Zap,
  Check,
  Cpu
} from 'lucide-react';
import { 
  useSettings, 
  SupportedLanguage, 
  SupportedTheme, 
  SupportedCurrency,
  CURRENCY_REGISTRY,
  SUPPORTED_LANGUAGES,
  SecondaryCurrencyConfig,
  ScaleSettings
} from '../../context/settings-context';
import { Warehouse } from '../../types/warehouse';
import { getStoredWarehouses, resetToCleanSlate, getStoredProducts, getStoredInvoices, getStoredTransactions } from '../../services/storageService';
import { useTenantFeatures } from '../../hooks/useAuth';
import { toast } from 'sonner';

interface SettingsViewProps {
  lang?: 'en' | 'ar';
  warehouses?: Warehouse[];
}

const WORLD_COUNTRIES = [
  { code: 'IQ', nameAr: 'العراق (IQ)', nameEn: 'Iraq (IQ)' },
  { code: 'SA', nameAr: 'المملكة العربية السعودية (SA)', nameEn: 'Saudi Arabia (SA)' },
  { code: 'AE', nameAr: 'الإمارات العربية المتحدة (AE)', nameEn: 'United Arab Emirates (AE)' },
  { code: 'KW', nameAr: 'الكويت (KW)', nameEn: 'Kuwait (KW)' },
  { code: 'QA', nameAr: 'قطر (QA)', nameEn: 'Qatar (QA)' },
  { code: 'BH', nameAr: 'البحرين (BH)', nameEn: 'Bahrain (BH)' },
  { code: 'OM', nameAr: 'سلطنة عُمان (OM)', nameEn: 'Oman (OM)' },
  { code: 'JO', nameAr: 'الأردن (JO)', nameEn: 'Jordan (JO)' },
  { code: 'EG', nameAr: 'مصر (EG)', nameEn: 'Egypt (EG)' },
  { code: 'TR', nameAr: 'تركيا (TR)', nameEn: 'Turkey (TR)' },
  { code: 'US', nameAr: 'الولايات المتحدة (US)', nameEn: 'United States (US)' },
  { code: 'GB', nameAr: 'المملكة المتحدة (GB)', nameEn: 'United Kingdom (GB)' },
  { code: 'EU', nameAr: 'الاتحاد الأوروبي (EU)', nameEn: 'European Union (EU)' },
  { code: 'IN', nameAr: 'الهند (IN)', nameEn: 'India (IN)' },
  { code: 'CN', nameAr: 'الصين (CN)', nameEn: 'China (CN)' },
  { code: 'GLOBAL', nameAr: 'دولي / أخرى (GLOBAL)', nameEn: 'Global / Other (GLOBAL)' }
];

export default function SettingsView({ warehouses: propWarehouses }: SettingsViewProps) {
  const { 
    settings, 
    effectiveLanguage, 
    isAr, 
    updateSetting, 
    isSaving
  } = useSettings();

  const warehouses = propWarehouses && propWarehouses.length > 0 
    ? propWarehouses 
    : getStoredWarehouses();

  const [newCurrencyCode, setNewCurrencyCode] = useState<string>('USD');
  const [newCurrencyRate, setNewCurrencyRate] = useState<number>(1);
  const [isDangerModalOpen, setIsDangerModalOpen] = useState(false);
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [testScaleBarcode, setTestScaleBarcode] = useState('2100105012503');
  const storedProducts = getStoredProducts();

  const { isFeatureEnabled } = useTenantFeatures();
  const isScaleAllowedBySuperAdmin = isFeatureEnabled('enableBarcodeScales');

  const currentScaleSettings: ScaleSettings = settings.scaleSettings || {
    enabled: true,
    prefix: '20,21,22,99',
    barcodeType: 'WEIGHT',
    itemCodeLength: 5,
    weightUnit: 'KG',
    directScaleBaudRate: 9600
  };

  const handleUpdateScaleSetting = (key: keyof ScaleSettings, val: any) => {
    if (!isScaleAllowedBySuperAdmin && key === 'enabled' && val === true) {
      toast.error(isAr ? 'ميزة الميزان غير مفعلة لهذه المنشأة في صلاحيات السوبر أدمن' : 'Scale feature is disabled for this tenant in Super Admin flags');
      return;
    }
    const updated = { ...currentScaleSettings, [key]: val };
    updateSetting('scaleSettings', updated);
    toast.success(isAr ? 'تم تحديث إعدادات الميزان' : 'Scale settings updated');
  };

  const handleLanguageChange = (newLang: string) => {
    updateSetting('language', newLang);
  };

  const handleThemeChange = (newTheme: SupportedTheme) => {
    updateSetting('theme', newTheme);
  };

  const handleCurrencyChange = (newCurr: SupportedCurrency) => {
    updateSetting('baseCurrency', newCurr);
  };

  const handleToggleMultiCurrency = async () => {
    const nextVal = !settings.multiCurrencyEnabled;
    await updateSetting('multiCurrencyEnabled', nextVal);

    // Synchronize tenant session & registry features
    try {
      const keys = ['logistock_erp_v3_auth_session', 'zilox_auth_session'];
      keys.forEach(k => {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed) {
            if (parsed.features) {
              parsed.features.enableMultiCurrency = nextVal;
            }
            localStorage.setItem(k, JSON.stringify(parsed));
          }
        }
      });
      const tenantsRaw = localStorage.getItem('zilox_saas_tenants_registry_v1');
      if (tenantsRaw) {
        const tenants = JSON.parse(tenantsRaw);
        if (Array.isArray(tenants)) {
          const updated = tenants.map((t: any) => {
            if (t.features) {
              return { ...t, features: { ...t.features, enableMultiCurrency: nextVal } };
            }
            return t;
          });
          localStorage.setItem('zilox_saas_tenants_registry_v1', JSON.stringify(updated));
        }
      }
    } catch {}

    toast.success(
      nextVal
        ? (isAr ? 'تم تفعيل نظام تعدد العملات وأسعار الصرف' : 'Multi-currency enabled')
        : (isAr ? 'تم إيقاف تعدد العملات واعتماد العملة الأساسية فقط' : 'Multi-currency disabled (Single Currency)')
    );
  };

  const handleAddSecondaryCurrency = () => {
    const registryMeta = CURRENCY_REGISTRY[newCurrencyCode];
    if (!registryMeta) return;

    const currentList = settings.secondaryCurrencies || [];
    if (currentList.some(c => c.code === newCurrencyCode)) {
      toast.error(isAr ? 'العملة مضافة بالفعل' : 'Currency already added');
      return;
    }

    const updatedList: SecondaryCurrencyConfig[] = [
      ...currentList,
      {
        code: registryMeta.code,
        nameAr: registryMeta.nameAr,
        nameEn: registryMeta.nameEn,
        symbol: isAr ? registryMeta.symbolAr : registryMeta.symbolEn,
        exchangeRateVsBase: Number(newCurrencyRate) || 1
      }
    ];

    updateSetting('secondaryCurrencies', updatedList);
    toast.success(isAr ? 'تم حفظ التغييرات' : 'Changes saved');
  };

  const handleRemoveSecondaryCurrency = (code: string) => {
    const currentList = settings.secondaryCurrencies || [];
    const updatedList = currentList.filter(c => c.code !== code);
    updateSetting('secondaryCurrencies', updatedList);
    toast.success(isAr ? 'تم حفظ التغييرات' : 'Changes saved');
  };

  const handleUpdateSecondaryRate = (code: string, newRate: number) => {
    const currentList = settings.secondaryCurrencies || [];
    const updatedList = currentList.map(c => {
      if (c.code === code) {
        return { ...c, exchangeRateVsBase: newRate };
      }
      return c;
    });
    updateSetting('secondaryCurrencies', updatedList);
  };

  const handleExecuteCleanSlate = () => {
    resetToCleanSlate();
    window.location.reload();
  };

  return (
    <div className="view-content-wrapper fade-in" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* 1. Header Bar with Quiet Real-time Status */}
      <div 
        className="view-header-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-card)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={18} />
            </div>
            <h2 className="view-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {isAr ? 'إعدادات المنظومة' : 'System Settings'}
            </h2>
          </div>
          <p className="view-subtitle" style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            {isAr 
              ? 'إدارة تفضيلات الواجهة، العمليات التشغيلية، والبيانات العامة' 
              : 'Manage system preferences, operations, and general configurations'}
          </p>
        </div>

        {/* Quiet Auto-save Indicator */}
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            background: isSaving ? 'rgba(37, 99, 235, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            color: isSaving ? 'var(--primary)' : '#059669',
            border: isSaving ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(16, 185, 129, 0.25)',
            transition: 'all 0.2s ease'
          }}
        >
          {isSaving ? (
            <>
              <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={14} color="#059669" />
              <span>{isAr ? 'تم حفظ التغييرات' : 'All changes saved'}</span>
            </>
          )}
        </div>
      </div>

      <div className="settings-cards-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
        
        {/* ==========================================================
            SECTION 1: المظهر واللغة (APPEARANCE & LANGUAGE)
            ========================================================== */}
        <div 
          className="settings-section-card" 
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <Languages size={18} style={{ color: 'var(--primary)' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {isAr ? 'المظهر واللغة' : 'Appearance & Language'}
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* 1.1 لغة الواجهة (Global I18n Combobox) */}
            <div style={{ maxWidth: '420px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                {isAr ? 'لغة الواجهة:' : 'Interface Language:'}
              </label>

              <select
                value={effectiveLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  padding: '0 12px',
                  fontSize: '13.5px',
                  color: 'var(--foreground)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {SUPPORTED_LANGUAGES.map(langItem => (
                  <option key={langItem.code} value={langItem.code}>
                    {langItem.nativeName} ({langItem.englishName})
                  </option>
                ))}
              </select>
            </div>

            {/* 1.2 المظهر وأصوات التنبيه */}
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border)'
              }}
            >
              {/* المظهر */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  {isAr ? 'المظهر:' : 'Theme:'}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleThemeChange('light')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: settings.theme === 'light' ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                      background: settings.theme === 'light' ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                      color: settings.theme === 'light' ? 'var(--primary)' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Sun size={15} />
                    <span>{isAr ? 'فاتح' : 'Light'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange('dark')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: settings.theme === 'dark' ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                      background: settings.theme === 'dark' ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                      color: settings.theme === 'dark' ? 'var(--primary)' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Moon size={15} />
                    <span>{isAr ? 'داكن' : 'Dark'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange('system')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: settings.theme === 'system' ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                      background: settings.theme === 'system' ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                      color: settings.theme === 'system' ? 'var(--primary)' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Monitor size={15} />
                    <span>{isAr ? 'تلقائي' : 'System'}</span>
                  </button>
                </div>
              </div>

              {/* أصوات التنبيه */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  {isAr ? 'أصوات التنبيه:' : 'Sound Alerts:'}
                </label>
                <div 
                  onClick={() => updateSetting('enableSoundAlerts', !settings.enableSoundAlerts)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: settings.enableSoundAlerts ? 'rgba(16, 185, 129, 0.05)' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {settings.enableSoundAlerts ? (
                      <Volume2 size={16} color="#059669" />
                    ) : (
                      <VolumeX size={16} color="#94a3b8" />
                    )}
                    <span style={{ fontSize: '12.5px', fontWeight: 500, color: settings.enableSoundAlerts ? '#065f46' : '#64748b' }}>
                      {settings.enableSoundAlerts 
                        ? (isAr ? 'مفعلة' : 'Enabled') 
                        : (isAr ? 'معطلة' : 'Disabled')}
                    </span>
                  </div>

                  <div 
                    style={{
                      width: '34px',
                      height: '20px',
                      borderRadius: '9999px',
                      background: settings.enableSoundAlerts ? '#10b981' : '#cbd5e1',
                      position: 'relative',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <div 
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: 'var(--card)',
                        position: 'absolute',
                        top: '2px',
                        left: settings.enableSoundAlerts ? (isAr ? '2px' : '16px') : (isAr ? '16px' : '2px'),
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                      }}
                    />
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* ==========================================================
            SECTION 2: بيانات المنشأة والفرع (ORGANIZATION & BRANCH)
            ========================================================== */}
        <div 
          className="settings-section-card"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <Building2 size={18} style={{ color: 'var(--primary)' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {isAr ? 'بيانات المنشأة والفرع' : 'Organization & Branch Information'}
            </h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* اسم المنشأة */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isAr ? 'اسم المنشأة أو المتجر:' : 'Organization Name:'}
              </label>
              <input 
                type="text"
                value={settings.organizationName || ''}
                onChange={(e) => updateSetting('organizationName', e.target.value)}
                placeholder={isAr ? 'اسم المنشأة...' : 'Organization name...'}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 12px', fontSize: '13px', color: 'var(--foreground)', fontWeight: 500 }}
              />
            </div>

            {/* دولة العمليات الأساسية */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isAr ? 'دولة العمليات الأساسية:' : 'Primary Operating Country:'}
              </label>
              <select 
                value={settings.tenantCountryCode || 'IQ'}
                onChange={(e) => updateSetting('tenantCountryCode', e.target.value)}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 12px', fontSize: '13px', color: 'var(--foreground)', fontWeight: 600 }}
              >
                {WORLD_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {isAr ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* المستودع الافتراضي */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isAr ? 'المستودع الافتراضي:' : 'Default Warehouse Hub:'}
              </label>
              <select
                value={settings.defaultWarehouseId}
                onChange={(e) => updateSetting('defaultWarehouseId', e.target.value)}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 12px', fontSize: '13px', color: 'var(--foreground)', fontWeight: 500 }}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {isAr ? w.nameAr : (w.nameEn || w.nameAr)} ({w.id})
                  </option>
                ))}
              </select>
            </div>

            {/* الرقم الضريبي / السجل التجاري */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isAr ? 'الرقم الضريبي أو السجل التجاري:' : 'Tax / Registration Number:'}
              </label>
              <input 
                type="text"
                value={settings.taxNumber || ''}
                onChange={(e) => updateSetting('taxNumber', e.target.value)}
                placeholder={isAr ? 'أدخل الرقم الضريبي أو السجل التجاري (اختياري)' : 'Enter Tax / Commercial Registration (Optional)'}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 12px', fontSize: '13px', color: 'var(--foreground)', fontWeight: 500 }}
              />
            </div>
          </div>
        </div>

        {/* ==========================================================
            SECTION 3: العملة والتهيئة المالية (CURRENCY & FINANCIAL)
            ========================================================== */}
        <div 
          className="settings-section-card"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <DollarSign size={18} style={{ color: 'var(--primary)' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {isAr ? 'العملة والتهيئة المالية' : 'Currency & Financial Configuration'}
            </h4>
          </div>

          {/* شبكة ثنائية متناسقة ونظيفة تماماً خالية من أي قوائم شبحية */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            {/* العملة الأساسية */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isAr ? 'العملة الأساسية للنظام:' : 'Base System Currency:'}
              </label>
              <select 
                value={settings.baseCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value as SupportedCurrency)}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 12px', fontSize: '13px', color: 'var(--foreground)', fontWeight: 600 }}
              >
                {Object.values(CURRENCY_REGISTRY).map(curr => (
                  <option key={curr.code} value={curr.code}>
                    {isAr ? `${curr.nameAr} (${curr.code})` : `${curr.code} - ${curr.nameEn}`}
                  </option>
                ))}
              </select>
            </div>

            {/* طريقة احتساب تكلفة المخزون */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isAr ? 'طريقة احتساب تكلفة المخزون:' : 'Cost Valuation Method:'}
              </label>
              <select 
                value={settings.costValuationMethod === 'WAVG' ? 'WEIGHTED_AVERAGE' : settings.costValuationMethod}
                onChange={(e) => updateSetting('costValuationMethod', e.target.value as any)}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 12px', fontSize: '13px', color: 'var(--foreground)', fontWeight: 500 }}
              >
                <option value="FIFO">{isAr ? 'الوارد أولاً يصرف أولاً (FIFO)' : 'First-In, First-Out (FIFO)'}</option>
                <option value="WEIGHTED_AVERAGE">{isAr ? 'المتوسط المرجح' : 'Weighted Average'}</option>
              </select>
            </div>
          </div>

          {/* حاوية ملمومة لتفعيل تعدد العملات */}
          <div 
            onClick={handleToggleMultiCurrency}
            role="button"
            tabIndex={0}
            id="multi-currency-toggle-row"
            data-testid="multi-currency-toggle"
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div>
              <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)', display: 'block' }}>
                {isAr ? 'تفعيل تعدد العملات' : 'Enable Multi-Currency'}
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                {isAr 
                  ? 'إتاحة تسجيل المعاملات وتحديد أسعار صرف عملات ثانوية مقابل العملة الأساسية'
                  : 'Allow managing secondary currencies with custom conversion rates against base currency'}
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={Boolean(settings.multiCurrencyEnabled)}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMultiCurrency();
              }}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '9999px',
                background: settings.multiCurrencyEnabled ? 'var(--primary, #0284c7)' : '#94a3b8',
                position: 'relative',
                transition: 'background 0.2s ease',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0
              }}
            >
              <div 
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: settings.multiCurrencyEnabled ? (isAr ? '3px' : '23px') : (isAr ? '23px' : '3px'),
                  transition: 'left 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.25)'
                }}
              />
            </button>
          </div>

          {/* جدول العملات الثانوية (يظهر فقط إذا كان السويتش مفعلاً) */}
          {settings.multiCurrencyEnabled && (
            <div 
              style={{
                marginTop: '12px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                  {isAr ? 'العملات الثانوية المعتمدة وأسعار الصرف:' : 'Secondary Currencies & Conversion Rates:'}
                </span>

                {/* شريط إضافة عملة ثانوية جديدة */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    value={newCurrencyCode}
                    onChange={(e) => setNewCurrencyCode(e.target.value)}
                    style={{ height: '34px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 8px', fontSize: '12px', color: 'var(--foreground)' }}
                  >
                    {Object.values(CURRENCY_REGISTRY)
                      .filter(c => c.code !== settings.baseCurrency)
                      .map(c => (
                        <option key={c.code} value={c.code}>
                          {isAr ? `${c.nameAr} (${c.code})` : `${c.code} - ${c.nameEn}`}
                        </option>
                      ))}
                  </select>

                  <input 
                    type="number"
                    step="0.0001"
                    min="0.000001"
                    value={newCurrencyRate}
                    onChange={(e) => setNewCurrencyRate(Number(e.target.value))}
                    placeholder={isAr ? 'سعر الصرف' : 'Rate'}
                    style={{ width: '100px', height: '34px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 8px', fontSize: '12px', color: 'var(--foreground)' }}
                  />

                  <button
                    type="button"
                    onClick={handleAddSecondaryCurrency}
                    style={{
                      height: '34px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} />
                    <span>{isAr ? 'إضافة عملة' : 'Add Currency'}</span>
                  </button>
                </div>
              </div>

              {/* جدول العملات */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', background: 'var(--card)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: isAr ? 'right' : 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>{isAr ? 'العملة' : 'Currency'}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>{isAr ? 'الرمز' : 'Symbol'}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>
                        {isAr ? (settings.baseCurrency === 'IQD' ? 'سعر الصرف (1 دولار = د.ع)' : `سعر الصرف (1 ${settings.baseCurrency} =)`) : `Rate (1 ${settings.baseCurrency} =)`}
                      </th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>{isAr ? 'الإجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(settings.secondaryCurrencies || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                          {isAr ? 'لا توجد عملات ثانوية مضافة حالياً' : 'No secondary currencies configured'}
                        </td>
                      </tr>
                    ) : (
                      (settings.secondaryCurrencies || []).map(curr => (
                        <tr key={curr.code} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--foreground)' }}>
                            {isAr ? curr.nameAr : curr.nameEn} ({curr.code})
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>
                            {curr.symbol}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <input 
                              type="number"
                              step="0.0001"
                              min="0.000001"
                              value={curr.exchangeRateVsBase}
                              onChange={(e) => handleUpdateSecondaryRate(curr.code, Number(e.target.value))}
                              style={{ width: '130px', height: '30px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 8px', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveSecondaryCurrency(curr.code)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#dc2626',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px'
                              }}
                              title={isAr ? 'حذف' : 'Delete'}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ==========================================================
            SECTION 4: قواعد التنبيهات ومعايير الباركود (ALERTS & BARCODE)
            ========================================================== */}
        <div 
          className="settings-section-card"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <Bell size={18} style={{ color: '#d97706' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {isAr ? 'قواعد التنبيهات ومعايير الباركود' : 'Alerts & Barcode Standards'}
            </h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isAr ? 'معيار طباعة الباركود:' : 'Default Barcode Format:'}
              </label>
              <select 
                value={
                  settings.barcodeFormat === 'CODE128' ? 'CODE_128' :
                  settings.barcodeFormat === 'EAN13' ? 'EAN_13' :
                  settings.barcodeFormat === 'QR' ? 'QR_CODE' :
                  settings.barcodeFormat
                }
                onChange={(e) => updateSetting('barcodeFormat', e.target.value as any)}
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 12px', fontSize: '12.5px', color: 'var(--foreground)', fontWeight: 500 }}
              >
                <option value="CODE_128">{isAr ? 'كود 128 (قياسي)' : 'Code 128'}</option>
                <option value="EAN_13">{isAr ? 'EAN-13 (دولي)' : 'EAN-13'}</option>
                <option value="QR_CODE">{isAr ? 'رمز الاستجابة السريعة (QR)' : 'QR Code'}</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isAr ? 'حد تنبيه نقص المخزون:' : 'Low Stock Alert Threshold:'}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="number" 
                  value={settings.lowStockThreshold}
                  onChange={(e) => updateSetting('lowStockThreshold', Number(e.target.value))}
                  min={1}
                  max={500}
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: isAr ? '0 90px 0 12px' : '0 12px 0 90px', fontSize: '12.5px', color: 'var(--foreground)', fontWeight: 600 }}
                />
                <span 
                  style={{ 
                    position: 'absolute', 
                    [isAr ? 'left' : 'right']: '12px', 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    fontWeight: 500,
                    pointerEvents: 'none'
                  }}
                >
                  {isAr ? 'قطعة / وحدة' : 'pcs / units'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================================
            SECTION 4.5: الموازين الإلكترونية وموازين الباركود (ELECTRONIC SCALES)
            ========================================================== */}
        <div 
          className="settings-section-card" 
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={18} style={{ color: '#d97706' }} />
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {isAr ? 'الموازين الإلكترونية وموازين الباركود (Barcode & POS Scales)' : 'Electronic Weighing Scales'}
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--muted-foreground)' }}>
                  {isAr 
                    ? 'دعم موازين طباعة الملصقات (CAS, Rongta, Dibal, Toledo) والموازين المباشرة عبر USB' 
                    : 'Configure EAN-13 scale barcodes and direct USB checkstand scales'}
                </p>
              </div>
            </div>

            {/* Enable Scale Feature Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isScaleAllowedBySuperAdmin && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                  {isAr ? 'غير مشمولة في باقة المنشأة 🔒' : 'Locked by Super Admin 🔒'}
                </span>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isScaleAllowedBySuperAdmin ? 'pointer' : 'not-allowed', opacity: isScaleAllowedBySuperAdmin ? 1 : 0.6 }}>
                <input 
                  type="checkbox"
                  disabled={!isScaleAllowedBySuperAdmin}
                  checked={isScaleAllowedBySuperAdmin && currentScaleSettings.enabled}
                  onChange={(e) => handleUpdateScaleSetting('enabled', e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: isScaleAllowedBySuperAdmin ? 'pointer' : 'not-allowed' }}
                />
                <span style={{ fontSize: '12px', fontWeight: 700, color: (isScaleAllowedBySuperAdmin && currentScaleSettings.enabled) ? '#059669' : '#64748b' }}>
                  {!isScaleAllowedBySuperAdmin
                    ? (isAr ? 'معطلة من الإدارة' : 'Disabled by Admin')
                    : currentScaleSettings.enabled 
                    ? (isAr ? 'الميزة مفعلة ✅' : 'Enabled ✅') 
                    : (isAr ? 'معطلة ❌' : 'Disabled ❌')}
                </span>
              </label>
            </div>
          </div>

          {isScaleAllowedBySuperAdmin && currentScaleSettings.enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {/* 1. Scale Prefixes */}
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {isAr ? 'بادئات باركود الميزان المعتمدة (مفصولة بفاصلة):' : 'Allowed Scale Prefixes (Comma-separated):'}
                  </label>
                  <input 
                    type="text" 
                    value={currentScaleSettings.prefix}
                    onChange={(e) => handleUpdateScaleSetting('prefix', e.target.value)}
                    placeholder="20, 21, 22, 99"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 12px', fontSize: '12.5px', color: 'var(--foreground)', fontWeight: 600, fontFamily: 'monospace' }}
                  />
                  <span style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    {isAr ? 'المعيار الدولي لباركود الموازين يبدأ عادة بـ 20 أو 21 أو 22 أو 99' : 'Standard GS1 prefixes: 20, 21, 22, 99'}
                  </span>
                </div>

                {/* 2. Barcode Type (Weight vs Price) */}
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {isAr ? 'نوع البيانات المشفرة في ملصق الميزان:' : 'Scale Label Data Encoding:'}
                  </label>
                  <select 
                    value={currentScaleSettings.barcodeType}
                    onChange={(e) => handleUpdateScaleSetting('barcodeType', e.target.value as any)}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 12px', fontSize: '12.5px', color: 'var(--foreground)', fontWeight: 500 }}
                  >
                    <option value="WEIGHT">{isAr ? 'وزني بالجرام (Weight in Grams) — النمط الشائع' : 'Weight-Based (Grams / 1000)'}</option>
                    <option value="PRICE">{isAr ? 'سعري بالقيمة الإجمالية (Total Price in Barcode)' : 'Price-Based (Total Amount)'}</option>
                  </select>
                  <span style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    {isAr ? 'إذا كان الميزان يطبع الوزن الصافي، اختر وزني. إذا كان يطبع السعر الإجمالي، اختر سعري.' : 'Choose whether the scale outputs net weight or calculated amount.'}
                  </span>
                </div>

                {/* 3. PLU Item Code Digits */}
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {isAr ? 'عدد خانات كود الصنف (PLU Digits):' : 'PLU Item Code Length:'}
                  </label>
                  <select 
                    value={currentScaleSettings.itemCodeLength}
                    onChange={(e) => handleUpdateScaleSetting('itemCodeLength', Number(e.target.value))}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 12px', fontSize: '12.5px', color: 'var(--foreground)', fontWeight: 500 }}
                  >
                    <option value={4}>{isAr ? '4 خانات (مثال: 0105)' : '4 Digits'}</option>
                    <option value={5}>{isAr ? '5 خانات (القياسي المعتمد: 00105)' : '5 Digits (Standard)'}</option>
                    <option value={6}>{isAr ? '6 خانات (مثال: 000105)' : '6 Digits'}</option>
                  </select>
                </div>
              </div>

              {/* 4. Live Scale Barcode Interactive Simulator / Tester */}
              <div style={{
                background: 'rgba(148, 163, 184, 0.08)',
                border: '1px dashed var(--border)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={15} style={{ color: '#d97706' }} />
                    <strong style={{ fontSize: '12px', color: 'var(--foreground)' }}>
                      {isAr ? 'مختبر فحص باركود الميزان الحي (Live Scale Barcode Diagnostic):' : 'Interactive Scale Barcode Tester:'}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestScaleBarcode('2100105012503')}
                    style={{
                      fontSize: '11px',
                      color: 'var(--primary)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      textDecoration: 'underline'
                    }}
                  >
                    {isAr ? 'تجربة باركود ميزان افتراضي (2100105012503)' : 'Load sample barcode'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text"
                    value={testScaleBarcode}
                    onChange={(e) => setTestScaleBarcode(e.target.value.trim())}
                    placeholder="2100105012503"
                    style={{
                      flex: 1,
                      height: '36px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--foreground)',
                      padding: '0 12px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '13px'
                    }}
                  />
                </div>

                {/* Real-time Diagnostics Output */}
                {(() => {
                  const prefixes = (currentScaleSettings.prefix || '20,21,22,99').split(',').map(p => p.trim()).filter(Boolean);
                  const matchedPrefix = prefixes.find(p => testScaleBarcode.startsWith(p));
                  const pluLen = currentScaleSettings.itemCodeLength || 5;
                  const plu = matchedPrefix ? testScaleBarcode.substring(matchedPrefix.length, matchedPrefix.length + pluLen) : '';
                  const valStr = matchedPrefix ? testScaleBarcode.substring(matchedPrefix.length + pluLen, testScaleBarcode.length - 1) : '';
                  const valNum = parseInt(valStr, 10);
                  const weightKg = !isNaN(valNum) ? valNum / 1000 : 0;
                  const matchedProd = storedProducts.find(p => 
                    (p.barcode && p.barcode.includes(plu)) || 
                    (p.sku && p.sku.includes(plu)) ||
                    (p.barcode && p.barcode.endsWith(parseInt(plu, 10).toString()))
                  );

                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '8px',
                      background: matchedPrefix ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${matchedPrefix ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '11.5px',
                      color: matchedPrefix ? '#065f46' : '#991b1b'
                    }}>
                      <div>
                        <span style={{ color: 'var(--muted-foreground)', display: 'block' }}>{isAr ? 'البادئة:' : 'Prefix:'}</span>
                        <strong style={{ fontFamily: 'monospace' }}>{matchedPrefix || (isAr ? 'غير معروفة' : 'Unknown')}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted-foreground)', display: 'block' }}>{isAr ? 'كود الـ PLU:' : 'PLU Code:'}</span>
                        <strong style={{ fontFamily: 'monospace' }}>{plu || '—'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted-foreground)', display: 'block' }}>{isAr ? 'الوزن المستخرج:' : 'Parsed Weight:'}</span>
                        <strong style={{ fontFamily: 'monospace' }}>{weightKg > 0 ? `${weightKg} كغم` : '—'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted-foreground)', display: 'block' }}>{isAr ? 'مطابقة المخزون:' : 'Inventory Match:'}</span>
                        <strong>{matchedProd ? `✅ ${matchedProd.nameAr}` : (isAr ? 'جاهز للاستخدام مع أي صنف مسجل' : 'Ready')}</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* ==========================================================
            SECTION 5: إدارة البيانات والنسخ الاحتياطي (DATA & BACKUP)
            ========================================================== */}
        <div 
          className="settings-section-card" 
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <Database size={18} style={{ color: 'var(--primary)' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {isAr ? 'إدارة البيانات والنسخ الاحتياطي' : 'Data & Backup Management'}
            </h4>
          </div>

          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '14px 16px',
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: '10px'
            }}
          >
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--foreground)', display: 'block' }}>
                {isAr ? 'تصدير واستعادة بيانات النظام' : 'Export & Restore System Data'}
              </strong>
              <small style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px', display: 'block' }}>
                {isAr 
                  ? 'إدارة النسخ الاحتياطية وتصدير السجلات أو استعادة البيانات التجريبية.'
                  : 'Manage data backups, export records, or restore default configurations.'}
              </small>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-add-primary"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  const data = {
                    settings,
                    products: getStoredProducts(),
                    invoices: getStoredInvoices(),
                    transactions: getStoredTransactions(),
                    exportedAt: new Date().toISOString()
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `zilox_backup_${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                }}
              >
                <Download size={14} />
                <span>{isAr ? 'تصدير نسخة احتياطية' : 'Export Backup'}</span>
              </button>

            </div>
          </div>
        </div>

        {/* ==========================================================
            SECTION 6: منطقة العمليات الحساسة (DANGER ZONE)
            ========================================================== */}
        <div 
          className="settings-section-card" 
          style={{
            background: 'rgba(254, 242, 242, 0.4)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid rgba(220, 38, 38, 0.15)'
            }}
          >
            <AlertTriangle size={18} style={{ color: '#dc2626' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#991b1b' }}>
              {isAr ? 'منطقة العمليات الحساسة' : 'Danger Zone'}
            </h4>
          </div>

          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <strong style={{ fontSize: '0.9rem', color: '#991b1b', display: 'block' }}>
                {isAr ? 'إعادة ضبط المنظومة وتصفير البيانات' : 'System Reset & Data Wipe'}
              </strong>
              <small style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '2px', display: 'block' }}>
                {isAr 
                  ? 'إجراء لا رجعة فيه يؤدي إلى حذف كافة الأصناف، الفواتير، الحركات، وسجلات الموردين والبدء من الصفر.'
                  : 'Irreversible action that wipes all products, invoices, transactions, and supplier ledgers.'}
              </small>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmKeyword('');
                setIsDangerModalOpen(true);
              }}
              style={{
                background: '#dc2626',
                border: '1px solid #b91c1c',
                color: '#ffffff',
                padding: '9px 16px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Trash2 size={15} />
              <span>{isAr ? 'إعادة ضبط المنظومة بالكامل' : 'Wipe & Reset System'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Confirmation Modal for Danger Zone */}
      {isDangerModalOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div 
            style={{
              background: 'var(--card)',
              borderRadius: '14px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #fee2e2'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#991b1b' }}>
                  {isAr ? 'تأكيد تصفير المنظومة بالكامل' : 'Confirm System Wipe'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsDangerModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, margin: '0 0 16px' }}>
              {isAr 
                ? 'تحذير أمني: هذا الإجراء سيقوم بحذف جميع الأصناف، الفواتير، الحركات المخزنية، ودفاتر الموردين فوراً ولا يمكن التراجع عنه بأي وسيلة.'
                : 'Security Warning: This action will permanently erase all inventory items, invoices, movements, and ledgers.'}
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isAr ? 'لتأكيد الحذف النهائي، اكتب كلمة "تأكيد" في الحقل أدناه:' : 'To confirm final deletion, type "CONFIRM" below:'}
              </label>
              <input 
                type="text"
                value={confirmKeyword}
                onChange={(e) => setConfirmKeyword(e.target.value)}
                placeholder={isAr ? 'اكتب "تأكيد"' : 'Type "CONFIRM"'}
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  padding: '0 12px',
                  fontSize: '13px',
                  color: 'var(--foreground)',
                  fontWeight: 600
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsDangerModalOpen(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={confirmKeyword.trim() !== (isAr ? 'تأكيد' : 'CONFIRM') && confirmKeyword.trim() !== 'تأكيد'}
                onClick={handleExecuteCleanSlate}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: (confirmKeyword.trim() === (isAr ? 'تأكيد' : 'CONFIRM') || confirmKeyword.trim() === 'تأكيد') ? '#dc2626' : '#fca5a5',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: (confirmKeyword.trim() === (isAr ? 'تأكيد' : 'CONFIRM') || confirmKeyword.trim() === 'تأكيد') ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease'
                }}
              >
                {isAr ? 'نعم، قم بتصفير المنظومة' : 'Yes, Wipe Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
