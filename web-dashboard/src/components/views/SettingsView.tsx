import React, { useState, useRef } from 'react';
import {
  Settings,
  Building2,
  DollarSign,
  Printer,
  Puzzle,
  Receipt,
  Coins,
  Calculator,
  ArrowLeftRight,
  Bell,
  Warehouse,
  Banknote,
  Scale,
  ShoppingCart,
  CalendarDays,
  Hash,
  Layers,
  CreditCard,
  CalendarClock,
  AlertCircle,
  AlertTriangle,
  Lock,
  Sun,
  Moon,
  Monitor,
  Upload,
  Plus,
  Trash2,
  Download,
  X,
  Zap,
  Save,
  RotateCcw,
  Loader2,
  Languages,
  CheckCircle2,
} from 'lucide-react';
import {
  useSettings,
  SupportedLanguage,
  SupportedTheme,
  SupportedCurrency,
  CURRENCY_REGISTRY,
  SUPPORTED_LANGUAGES,
  SecondaryCurrencyConfig,
  ScaleSettings,
} from '../../context/settings-context';
import { Warehouse as WarehouseType } from '../../types/warehouse';
import {
  getStoredWarehouses,
  resetToCleanSlate,
  getStoredProducts,
  getStoredInvoices,
  getStoredTransactions,
  getStoredAuthSession,
  saveStoredAuthSession,
  safeSet,
  KEYS,
} from '../../services/storageService';
import { updateTenantFeatures } from '../../services/tenantService';
import { useTenantFeatures } from '../../hooks/useAuth';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

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
  { code: 'GLOBAL', nameAr: 'دولي / أخرى (GLOBAL)', nameEn: 'Global / Other (GLOBAL)' },
];

const INPUT_CLS =
  'w-full h-10 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-background ps-3 pe-3 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

// ─── Reusable Sub-Components ──────────────────────────────────────────────────

function PillSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const { isRtl } = useSettings();
  const effectiveIsRtl =
    isRtl ||
    (typeof document !== 'undefined' &&
      (document.dir === 'rtl' || document.documentElement.dir === 'rtl'));

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        checked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        style={{
          transform: checked
            ? effectiveIsRtl
              ? 'translateX(-20px)'
              : 'translateX(20px)'
            : 'translateX(0)',
          transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="inline-block h-5 w-5 rounded-full bg-white shadow-md pointer-events-none"
      />
    </button>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-slate-200/80 dark:border-border p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2.5 pb-3.5 border-b border-slate-100 dark:border-border/60">
        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h4 className="text-sm font-bold text-foreground m-0">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}

function SwitchRow({
  title,
  description,
  checked,
  onToggle,
  isAr,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
  isAr: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200/80 dark:border-border bg-slate-50/50 dark:bg-muted/20">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2.5 shrink-0 ms-4">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
            checked
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40'
              : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
          }`}
        >
          {checked ? (isAr ? 'مفعلة' : 'Enabled') : (isAr ? 'معطلة' : 'Disabled')}
        </span>
        <PillSwitch checked={checked} onChange={onToggle} />
      </div>
    </div>
  );
}

function StatusBadge({
  enabled,
  locked,
  isAr,
}: {
  enabled: boolean;
  locked: boolean;
  isAr: boolean;
}) {
  if (locked) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
        <Lock className="w-3 h-3" />
        {isAr ? 'غير مشمولة' : 'Locked'}
      </span>
    );
  }
  if (enabled) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
        {isAr ? 'مفعلة' : 'Enabled'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
      {isAr ? 'معطلة' : 'Disabled'}
    </span>
  );
}

// ─── Tab IDs ──────────────────────────────────────────────────────────────────

type TabId = 'company_identity' | 'financial_currency' | 'pos_hardware' | 'active_modules';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettingsViewProps {
  lang?: 'en' | 'ar';
  warehouses?: WarehouseType[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsView({ warehouses: propWarehouses }: SettingsViewProps) {
  const { settings, effectiveLanguage, isAr, updateSetting, isSaving } = useSettings();

  const warehouses =
    propWarehouses && propWarehouses.length > 0 ? propWarehouses : getStoredWarehouses();

  // ── Local (isDirty) state ──────────────────────────────────────────────────
  const [localSettings, setLocalSettings] = useState({ ...settings });
  const isDirty = JSON.stringify(localSettings) !== JSON.stringify(settings);

  const setLocal = (key: string, value: unknown) =>
    setLocalSettings((prev) => ({ ...prev, [key]: value }));

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('company_identity');

  // ── Secondary currency UI state ────────────────────────────────────────────
  const [newCurrencyCode, setNewCurrencyCode] = useState<string>('USD');
  const [newCurrencyRate, setNewCurrencyRate] = useState<number>(1);

  // ── Danger zone state ─────────────────────────────────────────────────────
  const [isDangerModalOpen, setIsDangerModalOpen] = useState(false);
  const [confirmKeyword, setConfirmKeyword] = useState('');

  // ── Scale test state ──────────────────────────────────────────────────────
  const [testScaleBarcode, setTestScaleBarcode] = useState('2100105012503');
  const storedProducts = getStoredProducts();

  // ── Logo file ref ─────────────────────────────────────────────────────────
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Feature flags ─────────────────────────────────────────────────────────
  const { isFeatureEnabled } = useTenantFeatures();
  // Barcode scales are enabled/available across all subscription plans and presets
  const isScaleAllowedBySuperAdmin = true;

  // Auto-heal / ensure barcode scales are unlocked in active session
  React.useEffect(() => {
    try {
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
            enableBarcodeScales: true,
            enableExpiryDates: false,
          };
        } else {
          currentSession.features.enableBarcodeScales = true;
        }
        saveStoredAuthSession(currentSession);
        safeSet(KEYS.AUTH_SESSION, currentSession);
        window.dispatchEvent(
          new CustomEvent('zilox_features_updated', {
            detail: { enableBarcodeScales: true },
          })
        );
      }
    } catch {}
  }, []);

  const currentScaleSettings: ScaleSettings = settings.scaleSettings || {
    enabled: true,
    prefix: '20,21,22,99',
    barcodeType: 'WEIGHT',
    itemCodeLength: 5,
    weightUnit: 'KG',
    directScaleBaudRate: 9600,
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveAll = async () => {
    // Persist all localSettings fields that differ from saved settings
    for (const key of Object.keys(localSettings) as (keyof typeof localSettings)[]) {
      if (JSON.stringify(localSettings[key]) !== JSON.stringify(settings[key])) {
        await updateSetting(key as any, localSettings[key]);
      }
    }
    window.dispatchEvent(
      new CustomEvent('zilox_query_invalidate', {
        detail: { queryKey: ['currentUser', 'companySettings'] },
      })
    );
    toast.success(
      isAr
        ? 'تم حفظ الإعدادات وتحديث المنظومة بنجاح'
        : 'Settings saved and synchronized successfully'
    );
  };

  const handleDiscard = () => setLocalSettings({ ...settings });

  const handleUpdateScaleSetting = (key: keyof ScaleSettings, val: unknown) => {
    const updated = { ...currentScaleSettings, [key]: val };
    updateSetting('scaleSettings', updated);

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
          updateTenantFeatures(currentSession.tenantId, {
            enableBarcodeScales: boolVal,
          }).catch(() => {});
        }
      }

      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('zilox_token')
          : null;
      if (token) {
        fetch('/api/company/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ enableBarcodeScales: boolVal }),
        }).catch(() => {});
      }

      window.dispatchEvent(
        new CustomEvent('zilox_features_updated', { detail: { enableBarcodeScales: boolVal } })
      );
      window.dispatchEvent(
        new CustomEvent('zilox_query_invalidate', {
          detail: { queryKey: ['currentUser', 'auth', 'companySettings', 'tenantFeatures'] },
        })
      );
      window.dispatchEvent(new StorageEvent('storage', { key: KEYS.AUTH_SESSION }));
    }

    toast.success(isAr ? 'تم تحديث إعدادات الميزان' : 'Scale settings updated');
  };

  const handleLanguageChange = (newLang: string) => updateSetting('language', newLang);
  const handleThemeChange = (newTheme: SupportedTheme) => updateSetting('theme', newTheme);

  const handleToggleMultiCurrency = async () => {
    const nextVal = !settings.multiCurrencyEnabled;
    await updateSetting('multiCurrencyEnabled', nextVal);
    setLocal('multiCurrencyEnabled', nextVal);

    try {
      const keys = ['logistock_erp_v3_auth_session', 'zilox_auth_session'];
      keys.forEach((k) => {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed) {
            if (parsed.features) parsed.features.enableMultiCurrency = nextVal;
            localStorage.setItem(k, JSON.stringify(parsed));
          }
        }
      });
      const tenantsRaw = localStorage.getItem('zilox_saas_tenants_registry_v1');
      if (tenantsRaw) {
        const tenants = JSON.parse(tenantsRaw);
        if (Array.isArray(tenants)) {
          const updated = tenants.map((t: any) =>
            t.features ? { ...t, features: { ...t.features, enableMultiCurrency: nextVal } } : t
          );
          localStorage.setItem('zilox_saas_tenants_registry_v1', JSON.stringify(updated));
        }
      }
    } catch {}

    toast.success(
      nextVal
        ? isAr
          ? 'تم تفعيل نظام تعدد العملات وأسعار الصرف'
          : 'Multi-currency enabled'
        : isAr
        ? 'تم إيقاف تعدد العملات واعتماد العملة الأساسية فقط'
        : 'Multi-currency disabled (Single Currency)'
    );
  };

  const handleAddSecondaryCurrency = () => {
    const registryMeta = CURRENCY_REGISTRY[newCurrencyCode];
    if (!registryMeta) return;
    const currentList = settings.secondaryCurrencies || [];
    if (currentList.some((c) => c.code === newCurrencyCode)) {
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
        exchangeRateVsBase: Number(newCurrencyRate) || 1,
      },
    ];
    updateSetting('secondaryCurrencies', updatedList);
    toast.success(isAr ? 'تم حفظ التغييرات' : 'Changes saved');
  };

  const handleRemoveSecondaryCurrency = (code: string) => {
    const updatedList = (settings.secondaryCurrencies || []).filter((c) => c.code !== code);
    updateSetting('secondaryCurrencies', updatedList);
    toast.success(isAr ? 'تم حفظ التغييرات' : 'Changes saved');
  };

  const handleUpdateSecondaryRate = (code: string, newRate: number) => {
    const updatedList = (settings.secondaryCurrencies || []).map((c) =>
      c.code === code ? { ...c, exchangeRateVsBase: newRate } : c
    );
    updateSetting('secondaryCurrencies', updatedList);
  };

  const handleExecuteCleanSlate = () => {
    resetToCleanSlate();
    window.location.reload();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLocal('logoUrl', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // ── Tab definitions ────────────────────────────────────────────────────────

  const tabs: { id: TabId; icon: React.ReactNode; labelAr: string; labelEn: string }[] = [
    {
      id: 'company_identity',
      icon: <Building2 className="w-4 h-4" />,
      labelAr: 'هوية المنشأة والفواتير',
      labelEn: 'Identity & Invoices',
    },
    {
      id: 'financial_currency',
      icon: <DollarSign className="w-4 h-4" />,
      labelAr: 'المالية والعملات',
      labelEn: 'Finance & Currencies',
    },
    {
      id: 'pos_hardware',
      icon: <Printer className="w-4 h-4" />,
      labelAr: 'نقاط البيع والأجهزة',
      labelEn: 'POS & Hardware',
    },
    {
      id: 'active_modules',
      icon: <Puzzle className="w-4 h-4" />,
      labelAr: 'الميزات المفعلة',
      labelEn: 'Active Modules',
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto w-full pb-24">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-200 dark:border-border mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground m-0 leading-tight">
              {isAr ? 'إعدادات المنظومة' : 'System Settings'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr
                ? 'إدارة تفضيلات الواجهة، العمليات التشغيلية، والبيانات العامة'
                : 'Manage system preferences, operations, and general configurations'}
            </p>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            isSaving
              ? 'bg-primary/8 text-primary border-primary/20'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isAr ? 'تم حفظ التغييرات' : 'All changes saved'}</span>
            </>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-border mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px focus:outline-none ${
              activeTab === tab.id
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span>{isAr ? tab.labelAr : tab.labelEn}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: Company Identity ───────────────────────────────────────── */}
      {activeTab === 'company_identity' && (
        <div className="space-y-5">
          {/* Card A — Basic Info */}
          <SectionCard
            icon={<Building2 className="w-4 h-4" />}
            title={isAr ? 'المعلومات الأساسية' : 'Basic Information'}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label={isAr ? 'اسم الشركة' : 'Organization Name'}>
                <input
                  type="text"
                  className={INPUT_CLS}
                  value={localSettings.organizationName || ''}
                  onChange={(e) => setLocal('organizationName', e.target.value)}
                  placeholder={isAr ? 'اسم المنشأة...' : 'Organization name...'}
                />
              </FieldRow>
              <FieldRow label={isAr ? 'رقم الهاتف' : 'Phone Number'}>
                <input
                  type="text"
                  className={INPUT_CLS}
                  value={localSettings.phone || ''}
                  onChange={(e) => setLocal('phone', e.target.value)}
                  placeholder={isAr ? 'رقم الهاتف...' : 'Phone number...'}
                />
              </FieldRow>
              <FieldRow label={isAr ? 'العنوان' : 'Address'}>
                <input
                  type="text"
                  className={INPUT_CLS}
                  value={localSettings.address || ''}
                  onChange={(e) => setLocal('address', e.target.value)}
                  placeholder={isAr ? 'عنوان المنشأة...' : 'Business address...'}
                />
              </FieldRow>
              <FieldRow label={isAr ? 'الرقم الضريبي / السجل التجاري' : 'Tax / Registration Number'}>
                <input
                  type="text"
                  className={INPUT_CLS}
                  value={localSettings.taxNumber || ''}
                  onChange={(e) => setLocal('taxNumber', e.target.value)}
                  placeholder={isAr ? 'الرقم الضريبي (اختياري)' : 'Tax number (optional)'}
                />
              </FieldRow>
              <FieldRow label={isAr ? 'دولة العمليات' : 'Operating Country'}>
                <select
                  className={INPUT_CLS}
                  value={localSettings.tenantCountryCode || 'IQ'}
                  onChange={(e) => setLocal('tenantCountryCode', e.target.value)}
                >
                  {WORLD_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {isAr ? c.nameAr : c.nameEn}
                    </option>
                  ))}
                </select>
              </FieldRow>
            </div>
          </SectionCard>

          {/* Card B — Logo & Receipt Design */}
          <SectionCard
            icon={<Receipt className="w-4 h-4" />}
            title={isAr ? 'الشعار وتصميم الوصل' : 'Logo & Receipt Design'}
          >
            {/* Logo Upload */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {isAr ? 'شعار المنشأة' : 'Organization Logo'}
              </label>
              <div
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/20 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => logoInputRef.current?.click()}
              >
                {localSettings.logoUrl ? (
                  <img
                    src={localSettings.logoUrl}
                    alt="logo"
                    className="max-h-20 object-contain rounded"
                  />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {isAr ? 'انقر لرفع الشعار (PNG, JPG)' : 'Click to upload logo (PNG, JPG)'}
                    </p>
                  </>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              {localSettings.logoUrl && (
                <button
                  type="button"
                  onClick={() => setLocal('logoUrl', '')}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  {isAr ? 'إزالة الشعار' : 'Remove logo'}
                </button>
              )}
            </div>

            {/* Receipt Header / Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label={isAr ? 'ترويسة الوصل' : 'Receipt Header'}>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-background ps-3 pe-3 pt-2 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                  value={localSettings.receiptHeader || ''}
                  onChange={(e) => setLocal('receiptHeader', e.target.value)}
                  placeholder={isAr ? 'نص الترويسة على الوصل...' : 'Receipt header text...'}
                />
              </FieldRow>
              <FieldRow label={isAr ? 'تذييل الوصل' : 'Receipt Footer'}>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-background ps-3 pe-3 pt-2 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                  value={localSettings.receiptFooter || ''}
                  onChange={(e) => setLocal('receiptFooter', e.target.value)}
                  placeholder={isAr ? 'نص التذييل على الوصل...' : 'Receipt footer text...'}
                />
              </FieldRow>
            </div>

            {/* Language & Theme (instant sync, not isDirty) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-border/60">
              <FieldRow label={isAr ? 'لغة الواجهة' : 'Interface Language'}>
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-muted-foreground shrink-0" />
                  <select
                    className={INPUT_CLS}
                    value={effectiveLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                  >
                    {SUPPORTED_LANGUAGES.map((langItem) => (
                      <option key={langItem.code} value={langItem.code}>
                        {langItem.nativeName} ({langItem.englishName})
                      </option>
                    ))}
                  </select>
                </div>
              </FieldRow>
              <FieldRow label={isAr ? 'المظهر' : 'Theme'}>
                <div className="flex gap-2">
                  {(
                    [
                      { val: 'light', icon: <Sun className="w-3.5 h-3.5" />, ar: 'فاتح', en: 'Light' },
                      { val: 'dark', icon: <Moon className="w-3.5 h-3.5" />, ar: 'داكن', en: 'Dark' },
                      { val: 'system', icon: <Monitor className="w-3.5 h-3.5" />, ar: 'تلقائي', en: 'Auto' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => handleThemeChange(t.val as SupportedTheme)}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg text-xs font-semibold border transition-all ${
                        settings.theme === t.val
                          ? 'border-primary bg-primary/8 text-primary'
                          : 'border-slate-200 dark:border-border bg-white dark:bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t.icon}
                      <span>{isAr ? t.ar : t.en}</span>
                    </button>
                  ))}
                </div>
              </FieldRow>
            </div>
          </SectionCard>

          {/* Data & Backup */}
          <SectionCard
            icon={<Download className="w-4 h-4" />}
            title={isAr ? 'إدارة البيانات والنسخ الاحتياطي' : 'Data & Backup Management'}
          >
            <div className="flex items-center justify-between flex-wrap gap-3 p-3.5 rounded-lg border border-slate-200/80 dark:border-border bg-slate-50/50 dark:bg-muted/20">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isAr ? 'تصدير واستعادة بيانات النظام' : 'Export & Restore System Data'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAr
                    ? 'تصدير السجلات أو استعادة البيانات التجريبية'
                    : 'Export records or restore default configurations'}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card text-sm font-semibold text-foreground hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors"
                onClick={() => {
                  const data = {
                    settings,
                    products: getStoredProducts(),
                    invoices: getStoredInvoices(),
                    transactions: getStoredTransactions(),
                    exportedAt: new Date().toISOString(),
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `zilox_backup_${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                }}
              >
                <Download className="w-4 h-4" />
                <span>{isAr ? 'تصدير نسخة احتياطية' : 'Export Backup'}</span>
              </button>
            </div>
          </SectionCard>

          {/* Danger Zone */}
          <div className="bg-red-50/40 dark:bg-red-950/10 rounded-xl border border-red-200/60 dark:border-red-800/30 p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3.5 border-b border-red-200/40 dark:border-red-800/20">
              <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-red-800 dark:text-red-400 m-0">
                {isAr ? 'منطقة العمليات الحساسة' : 'Danger Zone'}
              </h4>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-400">
                  {isAr ? 'إعادة ضبط المنظومة وتصفير البيانات' : 'System Reset & Data Wipe'}
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-500/80 mt-0.5">
                  {isAr
                    ? 'إجراء لا رجعة فيه يؤدي إلى حذف كافة الأصناف، الفواتير، والحركات.'
                    : 'Irreversible action that wipes all products, invoices, and transactions.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setConfirmKeyword(''); setIsDangerModalOpen(true); }}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isAr ? 'إعادة ضبط المنظومة بالكامل' : 'Wipe & Reset System'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Financial & Currency ───────────────────────────────────── */}
      {activeTab === 'financial_currency' && (
        <div className="space-y-5">
          {/* Card A — Base Currency */}
          <SectionCard
            icon={<Coins className="w-4 h-4" />}
            title={isAr ? 'العملة الأساسية' : 'Base Currency'}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label={isAr ? 'العملة الأساسية للنظام' : 'Base System Currency'}>
                <select
                  className={INPUT_CLS}
                  value={localSettings.baseCurrency}
                  onChange={(e) => setLocal('baseCurrency', e.target.value as SupportedCurrency)}
                >
                  {Object.values(CURRENCY_REGISTRY).map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {isAr ? `${curr.nameAr} (${curr.code})` : `${curr.code} - ${curr.nameEn}`}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label={isAr ? 'سعر صرف الدولار (USD)' : 'USD Exchange Rate'}>
                <input
                  type="number"
                  step="1"
                  min="1"
                  className={INPUT_CLS}
                  value={localSettings.exchangeRateUsdToIqd || 1520}
                  onChange={(e) => setLocal('exchangeRateUsdToIqd', Number(e.target.value))}
                />
              </FieldRow>
              <FieldRow label={isAr ? 'طريقة احتساب تكلفة المخزون' : 'Cost Valuation Method'}>
                <select
                  className={INPUT_CLS}
                  value={
                    localSettings.costValuationMethod === 'WAVG'
                      ? 'WEIGHTED_AVERAGE'
                      : localSettings.costValuationMethod
                  }
                  onChange={(e) => setLocal('costValuationMethod', e.target.value)}
                >
                  <option value="FIFO">
                    {isAr ? 'الوارد أولاً يصرف أولاً (FIFO)' : 'First-In, First-Out (FIFO)'}
                  </option>
                  <option value="WEIGHTED_AVERAGE">
                    {isAr ? 'المتوسط المرجح' : 'Weighted Average'}
                  </option>
                </select>
              </FieldRow>
              <FieldRow label={isAr ? 'معيار طباعة الباركود' : 'Default Barcode Format'}>
                <select
                  className={INPUT_CLS}
                  value={
                    localSettings.barcodeFormat === 'CODE128'
                      ? 'CODE_128'
                      : localSettings.barcodeFormat === 'EAN13'
                      ? 'EAN_13'
                      : localSettings.barcodeFormat === 'QR'
                      ? 'QR_CODE'
                      : localSettings.barcodeFormat
                  }
                  onChange={(e) => setLocal('barcodeFormat', e.target.value)}
                >
                  <option value="CODE_128">{isAr ? 'كود 128 (قياسي)' : 'Code 128'}</option>
                  <option value="EAN_13">{isAr ? 'EAN-13 (دولي)' : 'EAN-13'}</option>
                  <option value="QR_CODE">
                    {isAr ? 'رمز الاستجابة السريعة (QR)' : 'QR Code'}
                  </option>
                </select>
              </FieldRow>
            </div>
          </SectionCard>

          {/* Card B — Auto Rounding */}
          <SectionCard
            icon={<Calculator className="w-4 h-4" />}
            title={isAr ? 'التقريب التلقائي' : 'Auto Rounding'}
          >
            <SwitchRow
              title={isAr ? 'التقريب التلقائي لأقرب 250 د.ع' : 'Auto-round to nearest 250 IQD'}
              description={
                isAr
                  ? 'يُقرِّب المبلغ الكلي تلقائياً عند الدفع النقدي للتخلص من الكسور الصغيرة'
                  : 'Automatically round cash payments to nearest 250 IQD fraction'
              }
              checked={Boolean(localSettings.autoRoundCash)}
              onToggle={() => setLocal('autoRoundCash', !localSettings.autoRoundCash)}
              isAr={isAr}
            />
          </SectionCard>

          {/* Card C — Multi-Currency */}
          <SectionCard
            icon={<ArrowLeftRight className="w-4 h-4" />}
            title={isAr ? 'تعدد العملات' : 'Multi-Currency'}
          >
            <SwitchRow
              title={isAr ? 'تفعيل تعدد العملات' : 'Enable Multi-Currency'}
              description={
                isAr
                  ? 'إتاحة تسجيل المعاملات وتحديد أسعار صرف عملات ثانوية مقابل العملة الأساسية'
                  : 'Allow managing secondary currencies with custom conversion rates against base currency'
              }
              checked={Boolean(settings.multiCurrencyEnabled)}
              onToggle={handleToggleMultiCurrency}
              isAr={isAr}
            />

            {settings.multiCurrencyEnabled && (
              <div className="mt-2 rounded-lg border border-slate-200 dark:border-border p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isAr
                      ? 'العملات الثانوية المعتمدة وأسعار الصرف:'
                      : 'Secondary Currencies & Conversion Rates:'}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={newCurrencyCode}
                      onChange={(e) => setNewCurrencyCode(e.target.value)}
                      className="h-8 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {Object.values(CURRENCY_REGISTRY)
                        .filter((c) => c.code !== settings.baseCurrency)
                        .map((c) => (
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
                      className="w-24 h-8 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={handleAddSecondaryCurrency}
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAr ? 'إضافة عملة' : 'Add Currency'}</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs rounded-lg overflow-hidden border border-slate-200 dark:border-border">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-muted/30 text-start">
                        <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-start">
                          {isAr ? 'العملة' : 'Currency'}
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-start">
                          {isAr ? 'الرمز' : 'Symbol'}
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-start">
                          {isAr
                            ? settings.baseCurrency === 'IQD'
                              ? 'سعر الصرف (1 دولار = د.ع)'
                              : `سعر الصرف (1 ${settings.baseCurrency} =)`
                            : `Rate (1 ${settings.baseCurrency} =)`}
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-center">
                          {isAr ? 'الإجراء' : 'Action'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(settings.secondaryCurrencies || []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-muted-foreground"
                          >
                            {isAr
                              ? 'لا توجد عملات ثانوية مضافة حالياً'
                              : 'No secondary currencies configured'}
                          </td>
                        </tr>
                      ) : (
                        (settings.secondaryCurrencies || []).map((curr) => (
                          <tr
                            key={curr.code}
                            className="border-t border-slate-200 dark:border-border"
                          >
                            <td className="px-3 py-2.5 font-semibold text-foreground">
                              {isAr ? curr.nameAr : curr.nameEn} ({curr.code})
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">{curr.symbol}</td>
                            <td className="px-3 py-2.5">
                              <input
                                type="number"
                                step="0.0001"
                                min="0.000001"
                                value={curr.exchangeRateVsBase}
                                onChange={(e) =>
                                  handleUpdateSecondaryRate(curr.code, Number(e.target.value))
                                }
                                className="w-32 h-7 rounded border border-slate-200 dark:border-border bg-white dark:bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSecondaryCurrency(curr.code)}
                                className="text-red-500 hover:text-red-700 transition-colors p-1 rounded"
                                title={isAr ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          </SectionCard>

          {/* Card D — Inventory & Alerts */}
          <SectionCard
            icon={<Bell className="w-4 h-4" />}
            title={isAr ? 'المخزون والتنبيهات' : 'Inventory & Alerts'}
          >
            <div className="space-y-3">
              <FieldRow label={isAr ? 'حد تنبيه نقص المخزون (قطعة)' : 'Low Stock Alert Threshold (pcs)'}>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className={INPUT_CLS}
                  value={localSettings.lowStockThreshold}
                  onChange={(e) => setLocal('lowStockThreshold', Number(e.target.value))}
                />
              </FieldRow>
              <SwitchRow
                title={isAr ? 'أصوات التنبيه' : 'Sound Alerts'}
                description={
                  isAr
                    ? 'تشغيل صوت تنبيه عند حدوث أحداث مهمة في المنظومة'
                    : 'Play alert sounds when important system events occur'
                }
                checked={Boolean(localSettings.enableSoundAlerts)}
                onToggle={() => setLocal('enableSoundAlerts', !localSettings.enableSoundAlerts)}
                isAr={isAr}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── TAB 3: POS & Hardware ─────────────────────────────────────────── */}
      {activeTab === 'pos_hardware' && (
        <div className="space-y-5">
          {/* Card A — Default Warehouse (only if >1) */}
          {warehouses.length > 1 && (
            <SectionCard
              icon={<Warehouse className="w-4 h-4" />}
              title={isAr ? 'المستودع والإعدادات الأساسية' : 'Warehouse & Core Settings'}
            >
              <FieldRow label={isAr ? 'المستودع الافتراضي' : 'Default Warehouse'}>
                <select
                  className={INPUT_CLS}
                  value={localSettings.defaultWarehouseId}
                  onChange={(e) => setLocal('defaultWarehouseId', e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isAr ? w.nameAr : w.nameEn || w.nameAr} ({w.id})
                    </option>
                  ))}
                </select>
              </FieldRow>
            </SectionCard>
          )}

          {/* Card B — Printer Settings */}
          <SectionCard
            icon={<Printer className="w-4 h-4" />}
            title={isAr ? 'إعدادات الطابعة' : 'Printer Settings'}
          >
            <div className="space-y-3">
              <FieldRow label={isAr ? 'عرض ورق الطباعة' : 'Paper Width'}>
                <div className="flex gap-2">
                  {(['80mm', '58mm'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setLocal('paperWidth', w)}
                      className={`flex-1 h-10 rounded-lg border text-sm font-semibold transition-all ${
                        localSettings.paperWidth === w
                          ? 'border-primary bg-primary/8 text-primary'
                          : 'border-slate-200 dark:border-border bg-white dark:bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </FieldRow>
              <SwitchRow
                title={isAr ? 'الطباعة التلقائية للوصل' : 'Auto-Print Receipt'}
                description={
                  isAr
                    ? 'طباعة الوصل تلقائياً عند إتمام كل عملية بيع'
                    : 'Automatically print receipt upon completing each sale'
                }
                checked={Boolean(localSettings.autoPrintReceipt)}
                onToggle={() => setLocal('autoPrintReceipt', !localSettings.autoPrintReceipt)}
                isAr={isAr}
              />
            </div>
          </SectionCard>

          {/* Card C — Cash Drawer */}
          <SectionCard
            icon={<Banknote className="w-4 h-4" />}
            title={isAr ? 'درج النقدية' : 'Cash Drawer'}
          >
            <SwitchRow
              title={isAr ? 'فتح درج النقدية عند البيع النقدي' : 'Open Cash Drawer on Cash Sale'}
              description={
                isAr
                  ? 'يفتح درج النقدية تلقائياً عند إتمام كل عملية بيع نقدية'
                  : 'Automatically open cash drawer when a cash sale is completed'
              }
              checked={Boolean(localSettings.openCashDrawerOnCashSale)}
              onToggle={() =>
                setLocal('openCashDrawerOnCashSale', !localSettings.openCashDrawerOnCashSale)
              }
              isAr={isAr}
            />
          </SectionCard>

          {/* Card D — Electronic Scales */}
          <SectionCard
            icon={<Scale className="w-4 h-4" />}
            title={isAr ? 'الموازين الإلكترونية وموازين الباركود' : 'Electronic Weighing Scales'}
          >
            {/* Scale Enable Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200/80 dark:border-border bg-slate-50/50 dark:bg-muted/20">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isAr ? 'تفعيل دعم الموازين الإلكترونية' : 'Enable Electronic Scale Support'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAr
                    ? 'دعم موازين طباعة الملصقات الباركودية والموازين المباشرة لنقاط البيع'
                    : 'Configure EAN-13 scale barcodes and direct USB checkstand scales'}
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 ms-4">
                {currentScaleSettings.enabled ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                    {isAr ? 'مفعلة' : 'Enabled'}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                    {isAr ? 'معطلة' : 'Disabled'}
                  </span>
                )}
                <PillSwitch
                  checked={currentScaleSettings.enabled}
                  onChange={() =>
                    handleUpdateScaleSetting('enabled', !currentScaleSettings.enabled)
                  }
                />
              </div>
            </div>

            {/* Sub-settings: visible when enabled */}
            {currentScaleSettings.enabled && (
              <div className="pt-4 border-t border-border/60 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                      {isAr
                        ? 'بادئات باركود الميزان المعتمدة (مفصولة بفاصلة):'
                        : 'Allowed Scale Prefixes (Comma-separated):'}
                    </label>
                    <input
                      type="text"
                      value={currentScaleSettings.prefix}
                      onChange={(e) => handleUpdateScaleSetting('prefix', e.target.value)}
                      placeholder="20, 21, 22, 99"
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="text-[11px] text-muted-foreground block">
                      {isAr
                        ? 'المعيار الدولي لباركود الموازين يبدأ عادة بـ 20 أو 21 أو 22 أو 99'
                        : 'Standard GS1 prefixes: 20, 21, 22, 99'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                      {isAr
                        ? 'نوع البيانات المشفرة في ملصق الميزان:'
                        : 'Scale Label Data Encoding:'}
                    </label>
                    <select
                      value={currentScaleSettings.barcodeType}
                      onChange={(e) =>
                        handleUpdateScaleSetting('barcodeType', e.target.value as any)
                      }
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="WEIGHT">
                        {isAr
                          ? 'وزني بالجرام (Weight in Grams) — النمط الشائع'
                          : 'Weight-Based (Grams / 1000)'}
                      </option>
                      <option value="PRICE">
                        {isAr
                          ? 'سعري بالقيمة الإجمالية (Total Price in Barcode)'
                          : 'Price-Based (Total Amount)'}
                      </option>
                    </select>
                    <span className="text-[11px] text-muted-foreground block">
                      {isAr
                        ? 'إذا كان الميزان يطبع الوزن الصافي، اختر وزني. إذا كان يطبع السعر الإجمالي، اختر سعري.'
                        : 'Choose whether the scale outputs net weight or calculated amount.'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                      {isAr ? 'عدد خانات كود الصنف (PLU):' : 'PLU Item Code Length:'}
                    </label>
                    <select
                      value={currentScaleSettings.itemCodeLength}
                      onChange={(e) =>
                        handleUpdateScaleSetting('itemCodeLength', Number(e.target.value))
                      }
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value={4}>{isAr ? '4 خانات (مثال: 0105)' : '4 Digits'}</option>
                      <option value={5}>
                        {isAr ? '5 خانات (القياسي المعتمد: 00105)' : '5 Digits (Standard)'}
                      </option>
                      <option value={6}>{isAr ? '6 خانات (مثال: 000105)' : '6 Digits'}</option>
                    </select>
                  </div>
                </div>

                {/* Live Scale Barcode Tester */}
                <div className="p-3.5 rounded-lg border border-dashed border-border bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <strong className="text-xs font-bold text-foreground">
                        {isAr
                          ? 'مختبر فحص باركود الميزان الحي:'
                          : 'Interactive Scale Barcode Tester:'}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTestScaleBarcode('2100105012503')}
                      className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                    >
                      {isAr
                        ? 'تجربة باركود ميزان افتراضي (2100105012503)'
                        : 'Load sample barcode'}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testScaleBarcode}
                      onChange={(e) => setTestScaleBarcode(e.target.value.trim())}
                      placeholder="2100105012503"
                      className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {(() => {
                    const prefixes = (currentScaleSettings.prefix || '20,21,22,99')
                      .split(',')
                      .map((p) => p.trim())
                      .filter(Boolean);
                    const matchedPrefix = prefixes.find((p) => testScaleBarcode.startsWith(p));
                    const pluLen = currentScaleSettings.itemCodeLength || 5;
                    const plu = matchedPrefix
                      ? testScaleBarcode.substring(
                          matchedPrefix.length,
                          matchedPrefix.length + pluLen
                        )
                      : '';
                    const valStr = matchedPrefix
                      ? testScaleBarcode.substring(
                          matchedPrefix.length + pluLen,
                          testScaleBarcode.length - 1
                        )
                      : '';
                    const valNum = parseInt(valStr, 10);
                    const weightKg = !isNaN(valNum) ? valNum / 1000 : 0;
                    const matchedProd = storedProducts.find(
                      (p) =>
                        (p.barcode && p.barcode.includes(plu)) ||
                        (p.sku && p.sku.includes(plu)) ||
                        (p.barcode &&
                          p.barcode.endsWith(parseInt(plu, 10).toString()))
                    );

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div className="p-2 rounded bg-card border border-border/60">
                          <span className="text-muted-foreground block text-[10px]">
                            {isAr ? 'البادئة:' : 'Prefix:'}
                          </span>
                          <strong className="font-mono text-foreground">
                            {matchedPrefix || (isAr ? 'غير معروفة' : 'Unknown')}
                          </strong>
                        </div>
                        <div className="p-2 rounded bg-card border border-border/60">
                          <span className="text-muted-foreground block text-[10px]">
                            {isAr ? 'كود الـ PLU:' : 'PLU Code:'}
                          </span>
                          <strong className="font-mono text-foreground">{plu || '—'}</strong>
                        </div>
                        <div className="p-2 rounded bg-card border border-border/60">
                          <span className="text-muted-foreground block text-[10px]">
                            {isAr ? 'الوزن المستخرج:' : 'Parsed Weight:'}
                          </span>
                          <strong className="font-mono text-primary">
                            {weightKg > 0 ? `${weightKg} ${isAr ? 'كغم' : 'kg'}` : '—'}
                          </strong>
                        </div>
                        <div className="p-2 rounded bg-card border border-border/60">
                          <span className="text-muted-foreground block text-[10px]">
                            {isAr ? 'مطابقة المخزون:' : 'Inventory Match:'}
                          </span>
                          <strong className="text-foreground truncate block">
                            {matchedProd
                              ? matchedProd.nameAr
                              : isAr
                              ? 'جاهز للاستخدام مع أي صنف مسجل'
                              : 'Ready'}
                          </strong>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── TAB 4: Active Modules ─────────────────────────────────────────── */}
      {activeTab === 'active_modules' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'الوحدات والميزات المفعلة لهذه المنشأة وفق خطة الاشتراك.'
              : 'Modules and features enabled for this tenant based on the subscription plan.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                {
                  key: 'enablePOS',
                  icon: <ShoppingCart className="w-4 h-4" />,
                  ar: 'نقطة البيع السريعة',
                  en: 'Point of Sale (POS)',
                  descAr: 'واجهة البيع السريع للكاشير وإدارة الطلبات',
                  descEn: 'Fast cashier POS interface and order management',
                },
                {
                  key: 'multiWarehouse',
                  icon: <Warehouse className="w-4 h-4" />,
                  ar: 'تعدد المستودعات والفروع',
                  en: 'Multi-Warehouse & Branches',
                  descAr: 'إدارة مستودعات وفروع متعددة ضمن نفس المنظومة',
                  descEn: 'Manage multiple warehouses and branches in one system',
                },
                {
                  key: 'enableInstallments',
                  icon: <CalendarDays className="w-4 h-4" />,
                  ar: 'الأقساط والتسهيلات',
                  en: 'Installments & Financing',
                  descAr: 'قبول الدفع بالتقسيط وإدارة خطط التسهيلات',
                  descEn: 'Accept installment payments and manage financing plans',
                },
                {
                  key: 'enableSerialNumbers',
                  icon: <Hash className="w-4 h-4" />,
                  ar: 'تتبع الأرقام التسلسلية',
                  en: 'Serial Number Tracking',
                  descAr: 'تتبع الأرقام التسلسلية لكل وحدة مخزنية',
                  descEn: 'Track serial numbers for each individual inventory unit',
                },
                {
                  key: 'enableVariants',
                  icon: <Layers className="w-4 h-4" />,
                  ar: 'متغيرات ومقاسات الأصناف',
                  en: 'Item Variants & Sizes',
                  descAr: 'دعم المقاسات والألوان وكل متغيرات الأصناف',
                  descEn: 'Support sizes, colors, and all item variant attributes',
                },
                {
                  key: 'enableMultiCurrency',
                  icon: <Coins className="w-4 h-4" />,
                  ar: 'تعدد العملات وأسعار الصرف',
                  en: 'Multi-Currency & Exchange Rates',
                  descAr: 'تسجيل المعاملات بعملات متعددة مع أسعار صرف مخصصة',
                  descEn: 'Record transactions in multiple currencies with custom rates',
                },
                {
                  key: 'enableCreditLimits',
                  icon: <CreditCard className="w-4 h-4" />,
                  ar: 'حدود الائتمان والديون',
                  en: 'Credit Limits & Debt Management',
                  descAr: 'ضبط حدود الائتمان وإدارة ديون العملاء',
                  descEn: 'Set credit limits and manage customer debt tracking',
                },
                {
                  key: 'enableBarcodeScales',
                  icon: <Scale className="w-4 h-4" />,
                  ar: 'الموازين الإلكترونية والباركود',
                  en: 'Electronic Scales & Barcode',
                  descAr: 'دعم موازين الوزن والملصقات الباركودية التلقائية',
                  descEn: 'Support weighing scales with automatic barcode label printing',
                },
                {
                  key: 'enableExpiryDates',
                  icon: <CalendarClock className="w-4 h-4" />,
                  ar: 'تتبع تواريخ الانتهاء',
                  en: 'Expiry Date Tracking',
                  descAr: 'تتبع تواريخ انتهاء صلاحية المنتجات وتنبيهات الانتهاء',
                  descEn: 'Track product expiry dates with automatic expiry alerts',
                },
              ] as const
            ).map((module) => {
              const isEnabled = isFeatureEnabled(module.key as any);
              const isLocked = !isEnabled;
              return (
                <div
                  key={module.key}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {module.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        {isAr ? module.ar : module.en}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isAr ? module.descAr : module.descEn}
                      </p>
                    </div>
                  </div>
                  <div className="ms-3 shrink-0">
                    <StatusBadge enabled={isEnabled} locked={isLocked} isAr={isAr} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── isDirty Sticky Action Bar ─────────────────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-0 start-0 end-0 z-50 border-t border-slate-200 dark:border-border bg-white/95 dark:bg-card/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {isAr ? 'توجد تعديلات غير محفوظة' : 'Unsaved changes pending'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card text-sm font-semibold text-foreground hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isAr ? 'تراجع' : 'Discard'}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>
                {isSaving
                  ? isAr
                    ? 'جاري الحفظ...'
                    : 'Saving...'
                  : isAr
                  ? 'حفظ التغييرات'
                  : 'Save Changes'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── Danger Zone Confirmation Modal ───────────────────────────────── */}
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
            padding: '16px',
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
              border: '1px solid #fee2e2',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={20} />
                </div>
                <h3
                  style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#991b1b' }}
                >
                  {isAr ? 'تأكيد تصفير المنظومة بالكامل' : 'Confirm System Wipe'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDangerModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p
              style={{
                fontSize: '0.85rem',
                color: '#475569',
                lineHeight: 1.5,
                margin: '0 0 16px',
              }}
            >
              {isAr
                ? 'تحذير أمني: هذا الإجراء سيقوم بحذف جميع الأصناف، الفواتير، الحركات المخزنية، ودفاتر الموردين فوراً ولا يمكن التراجع عنه بأي وسيلة.'
                : 'Security Warning: This action will permanently erase all inventory items, invoices, movements, and ledgers.'}
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                {isAr
                  ? 'لتأكيد الحذف النهائي، اكتب كلمة "تأكيد" في الحقل أدناه:'
                  : 'To confirm final deletion, type "CONFIRM" below:'}
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
                  fontWeight: 600,
                  boxSizing: 'border-box',
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
                  cursor: 'pointer',
                }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={
                  confirmKeyword.trim() !== (isAr ? 'تأكيد' : 'CONFIRM') &&
                  confirmKeyword.trim() !== 'تأكيد'
                }
                onClick={handleExecuteCleanSlate}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background:
                    confirmKeyword.trim() === (isAr ? 'تأكيد' : 'CONFIRM') ||
                    confirmKeyword.trim() === 'تأكيد'
                      ? '#dc2626'
                      : '#fca5a5',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor:
                    confirmKeyword.trim() === (isAr ? 'تأكيد' : 'CONFIRM') ||
                    confirmKeyword.trim() === 'تأكيد'
                      ? 'pointer'
                      : 'not-allowed',
                  transition: 'all 0.15s ease',
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
