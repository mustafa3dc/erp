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
import { 
  getStoredWarehouses, 
  resetToCleanSlate, 
  getStoredProducts, 
  getStoredInvoices, 
  getStoredTransactions,
  getStoredAuthSession,
  saveStoredAuthSession,
  safeSet,
  KEYS
} from '../../services/storageService';
import { updateTenantFeatures } from '../../services/tenantService';
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

    // Immediate multi-layer state & cache synchronization
    if (key === 'enabled') {
      const boolVal = Boolean(val);
      const currentSession = getStoredAuthSession();
      if (currentSession) {
        if (!currentSession.features) {
          currentSession.features = {
            enablePOS: true,
            multiWarehouse: true,
            maxWarehouses: 5,
            enableInstallments: true,
            enableSerialNumbers: false,
            enableVariants: false,
            enableMultiCurrency: true,
            enableCreditLimits: true,
            enableBarcodeScales: boolVal,
            enableExpiryDates: false,
          };
        } else {
          currentSession.features.enableBarcodeScales = boolVal;
        }
        saveStoredAuthSession(currentSession);
        safeSet(KEYS.AUTH_SESSION, currentSession);

        if (currentSession.tenantId) {
          updateTenantFeatures(currentSession.tenantId, { enableBarcodeScales: boolVal }).catch(() => {});
        }
      }

      // Sync backend API
      const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('zilox_token')) : null;
      if (token) {
        fetch('/api/company/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ enableBarcodeScales: boolVal })
        }).catch(() => {});
      }

      // Invalidate and sync all tabs and global state instantly
      window.dispatchEvent(new CustomEvent('zilox_features_updated', { detail: { enableBarcodeScales: boolVal } }));
      window.dispatchEvent(new CustomEvent('zilox_query_invalidate', { detail: { queryKey: ['currentUser', 'auth', 'companySettings', 'tenantFeatures'] } }));
      window.dispatchEvent(new StorageEvent('storage', { key: KEYS.AUTH_SESSION }));
    }

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
        <div className="rounded-xl border border-slate-200 dark:border-border/80 bg-white dark:bg-card p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-4">
            {/* Start (Right in RTL): Soft Icon Box + Title & Description */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h4 className="m-0 text-sm font-bold text-foreground leading-snug">
                  {isAr ? 'الموازين الإلكترونية وموازين الباركود' : 'Electronic Weighing Scales'}
                </h4>
                <p className="m-0 mt-0.5 text-xs text-muted-foreground leading-normal">
                  {isAr 
                    ? 'دعم موازين طباعة الملصقات الباركودية والموازين المباشرة لنقاط البيع' 
                    : 'Configure EAN-13 scale barcodes and direct USB checkstand scales'}
                </p>
              </div>
            </div>

            {/* End (Left in RTL): Clean Status Badge + Modern Pill Switch */}
            <div className="flex items-center gap-2.5 shrink-0">
              {!isScaleAllowedBySuperAdmin ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {isAr ? 'غير مشمولة في الباقة' : 'Locked by Plan'}
                </span>
              ) : currentScaleSettings.enabled ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                  {isAr ? 'مفعلة' : 'Enabled'}
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {isAr ? 'معطلة' : 'Disabled'}
                </span>
              )}

              <button
                type="button"
                role="switch"
                aria-checked={currentScaleSettings.enabled}
                disabled={!isScaleAllowedBySuperAdmin}
                onClick={() => handleUpdateScaleSetting('enabled', !currentScaleSettings.enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  currentScaleSettings.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                } ${!isScaleAllowedBySuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!isScaleAllowedBySuperAdmin ? (isAr ? 'غير مفعلة من الإدارة' : 'Disabled by Admin') : (currentScaleSettings.enabled ? (isAr ? 'تعطيل الميزان' : 'Disable Scale') : (isAr ? 'تفعيل الميزان' : 'Enable Scale'))}
              >
                <span
                  style={{
                    transform: currentScaleSettings.enabled
                      ? (isAr ? 'translateX(-20px)' : 'translateX(20px)')
                      : 'translateX(0)'
                  }}
                  className="inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out pointer-events-none"
                />
              </button>
            </div>
          </div>

          {/* Sub-settings: Only visible when enabled */}
          {isScaleAllowedBySuperAdmin && currentScaleSettings.enabled && (
            <div className="pt-4 border-t border-border/60 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Scale Prefixes */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    {isAr ? 'بادئات باركود الميزان المعتمدة (مفصولة بفاصلة):' : 'Allowed Scale Prefixes (Comma-separated):'}
                  </label>
                  <input 
                    type="text" 
                    value={currentScaleSettings.prefix}
                    onChange={(e) => handleUpdateScaleSetting('prefix', e.target.value)}
                    placeholder="20, 21, 22, 99"
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono font-semibold text-foreground"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    {isAr ? 'المعيار الدولي لباركود الموازين يبدأ عادة بـ 20 أو 21 أو 22 أو 99' : 'Standard GS1 prefixes: 20, 21, 22, 99'}
                  </span>
                </div>

                {/* 2. Barcode Type (Weight vs Price) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    {isAr ? 'نوع البيانات المشفرة في ملصق الميزان:' : 'Scale Label Data Encoding:'}
                  </label>
                  <select 
                    value={currentScaleSettings.barcodeType}
                    onChange={(e) => handleUpdateScaleSetting('barcodeType', e.target.value as any)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground"
                  >
                    <option value="WEIGHT">{isAr ? 'وزني بالجرام (Weight in Grams) — النمط الشائع' : 'Weight-Based (Grams / 1000)'}</option>
                    <option value="PRICE">{isAr ? 'سعري بالقيمة الإجمالية (Total Price in Barcode)' : 'Price-Based (Total Amount)'}</option>
                  </select>
                  <span className="text-[11px] text-muted-foreground block">
                    {isAr ? 'إذا كان الميزان يطبع الوزن الصافي، اختر وزني. إذا كان يطبع السعر الإجمالي، اختر سعري.' : 'Choose whether the scale outputs net weight or calculated amount.'}
                  </span>
                </div>

                {/* 3. PLU Item Code Digits */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    {isAr ? 'عدد خانات كود الصنف (PLU):' : 'PLU Item Code Length:'}
                  </label>
                  <select 
                    value={currentScaleSettings.itemCodeLength}
                    onChange={(e) => handleUpdateScaleSetting('itemCodeLength', Number(e.target.value))}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground"
                  >
                    <option value={4}>{isAr ? '4 خانات (مثال: 0105)' : '4 Digits'}</option>
                    <option value={5}>{isAr ? '5 خانات (القياسي المعتمد: 00105)' : '5 Digits (Standard)'}</option>
                    <option value={6}>{isAr ? '6 خانات (مثال: 000105)' : '6 Digits'}</option>
                  </select>
                </div>
              </div>

              {/* 4. Live Scale Barcode Simulator */}
              <div className="p-3.5 rounded-lg border border-dashed border-border bg-muted/20 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <strong className="text-xs font-bold text-foreground">
                      {isAr ? 'مختبر فحص باركود الميزان الحي:' : 'Interactive Scale Barcode Tester:'}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestScaleBarcode('2100105012503')}
                    className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                  >
                    {isAr ? 'تجربة باركود ميزان افتراضي (2100105012503)' : 'Load sample barcode'}
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testScaleBarcode}
                    onChange={(e) => setTestScaleBarcode(e.target.value.trim())}
                    placeholder="2100105012503"
                    className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono font-bold text-foreground"
                  />
                </div>

                {/* Diagnostics without raw emojis */}
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div className="p-2 rounded bg-card border border-border/60">
                        <span className="text-muted-foreground block text-[10px]">{isAr ? 'البادئة:' : 'Prefix:'}</span>
                        <strong className="font-mono text-foreground">{matchedPrefix || (isAr ? 'غير معروفة' : 'Unknown')}</strong>
                      </div>
                      <div className="p-2 rounded bg-card border border-border/60">
                        <span className="text-muted-foreground block text-[10px]">{isAr ? 'كود الـ PLU:' : 'PLU Code:'}</span>
                        <strong className="font-mono text-foreground">{plu || '—'}</strong>
                      </div>
                      <div className="p-2 rounded bg-card border border-border/60">
                        <span className="text-muted-foreground block text-[10px]">{isAr ? 'الوزن المستخرج:' : 'Parsed Weight:'}</span>
                        <strong className="font-mono text-primary">{weightKg > 0 ? `${weightKg} ${isAr ? 'كغم' : 'kg'}` : '—'}</strong>
                      </div>
                      <div className="p-2 rounded bg-card border border-border/60">
                        <span className="text-muted-foreground block text-[10px]">{isAr ? 'مطابقة المخزون:' : 'Inventory Match:'}</span>
                        <strong className="text-foreground truncate block">{matchedProd ? matchedProd.nameAr : (isAr ? 'جاهز للاستخدام مع أي صنف مسجل' : 'Ready')}</strong>
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
