'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { PaymentMethodDef, isPaymentMethodAllowedForCountry, getAllowedPaymentMethodsForCountry } from '../config/paymentRegistry';
import { getTranslation, setLocaleCookie } from '../lib/i18n';
import { getStoredLang, saveStoredLang } from '../services/storageService';
import { 
  CurrencyConfig, 
  CompanyFinancialSettings, 
  resolveCompanyFinancialSettings,
  getCurrencyDecimals,
  getDefaultCurrencyForCountry
} from '../lib/currencyUtils';

export type { CurrencyConfig, CompanyFinancialSettings };

export type SupportedLanguage = 'ar' | 'en' | 'tr' | 'fr' | 'de' | 'es' | 'hi' | 'zh' | 'ku' | 'auto' | string;
export type SupportedTheme = 'light' | 'dark' | 'system';
export type SupportedCurrency = 'IQD' | 'USD' | 'SAR' | 'AED' | 'EUR' | 'KWD' | 'QAR' | 'BHD' | 'OMR' | 'JOD' | 'EGP' | 'GBP' | 'TRY' | 'INR' | 'CNY' | string;
export type CostMethod = 'FIFO' | 'WEIGHTED_AVERAGE' | 'WAVG';
export type BarcodeFormat = 'CODE_128' | 'EAN_13' | 'QR_CODE' | 'CODE128' | 'EAN13' | 'QR';

export interface LanguageOption {
  code: string;
  nativeName: string;
  englishName: string;
  dir: 'rtl' | 'ltr';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr' },
  { code: 'zh', nativeName: '简体中文', englishName: 'Chinese', dir: 'ltr' },
  { code: 'ku', nativeName: 'کوردی', englishName: 'Kurdish', dir: 'rtl' }
];

export interface SecondaryCurrencyConfig {
  code: string;
  nameAr: string;
  nameEn: string;
  symbol: string;
  exchangeRateVsBase: number;
}

export interface ScaleSettings {
  enabled: boolean;
  prefix: string; // e.g. "20,21,22,99"
  barcodeType: 'WEIGHT' | 'PRICE'; // Default 'WEIGHT'
  itemCodeLength: number; // 4, 5, or 6 (default 5 digits)
  weightUnit: 'KG' | 'G'; // default 'KG' (grams / 1000)
  directScaleBaudRate?: number; // 9600 for serial scale
}

export interface UserSettings {
  language: SupportedLanguage;
  theme: SupportedTheme;
  defaultWarehouseId: string;
  enableSoundAlerts: boolean;
  baseCurrency: SupportedCurrency;
  exchangeRateUsdToIqd: number;
  costValuationMethod: CostMethod;
  barcodeFormat: BarcodeFormat;
  lowStockThreshold: number;
  tenantCountryCode: string; // 'IQ', 'SA', 'AE', 'IN', etc.
  organizationName?: string;
  taxNumber?: string;
  taxRate?: number;
  isTaxEnabled?: boolean;
  multiCurrencyEnabled?: boolean;
  secondaryCurrencies?: SecondaryCurrencyConfig[];
  scaleSettings?: ScaleSettings;
  // Tab 1: Company Identity & Receipt
  phone?: string;
  address?: string;
  commercialRegister?: string;
  logoUrl?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  // Tab 2: Financial & Currency
  autoRoundCash?: boolean; // Iraqi cash auto-rounding (nearest 250 IQD)
  // Tab 3: POS & Hardware
  paperWidth?: '80mm' | '58mm';
  autoPrintReceipt?: boolean;
  openCashDrawerOnCashSale?: boolean;
}

export const CURRENCY_REGISTRY: Record<string, { code: string; nameAr: string; nameEn: string; symbolAr: string; symbolEn: string; defaultRateVsUsd: number }> = {
  IQD: { code: 'IQD', nameAr: 'دينار عراقي', nameEn: 'Iraqi Dinar', symbolAr: 'د.ع', symbolEn: 'IQD', defaultRateVsUsd: 1520 },
  USD: { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbolAr: '$', symbolEn: '$', defaultRateVsUsd: 1 },
  SAR: { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbolAr: 'ر.س', symbolEn: 'SAR', defaultRateVsUsd: 3.75 },
  AED: { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbolAr: 'د.إ', symbolEn: 'AED', defaultRateVsUsd: 3.67 },
  KWD: { code: 'KWD', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar', symbolAr: 'د.ك', symbolEn: 'KWD', defaultRateVsUsd: 0.31 },
  QAR: { code: 'QAR', nameAr: 'ريال قطري', nameEn: 'Qatari Riyal', symbolAr: 'ر.ق', symbolEn: 'QAR', defaultRateVsUsd: 3.64 },
  BHD: { code: 'BHD', nameAr: 'دينار بحريني', nameEn: 'Bahraini Dinar', symbolAr: 'د.ب', symbolEn: 'BHD', defaultRateVsUsd: 0.38 },
  OMR: { code: 'OMR', nameAr: 'ريال عماني', nameEn: 'Omani Rial', symbolAr: 'ر.ع', symbolEn: 'OMR', defaultRateVsUsd: 0.38 },
  JOD: { code: 'JOD', nameAr: 'دينار أردني', nameEn: 'Jordanian Dinar', symbolAr: 'د.أ', symbolEn: 'JOD', defaultRateVsUsd: 0.71 },
  EGP: { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbolAr: 'ج.م', symbolEn: 'EGP', defaultRateVsUsd: 48.5 },
  EUR: { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbolAr: '€', symbolEn: '€', defaultRateVsUsd: 0.92 },
  GBP: { code: 'GBP', nameAr: 'جنيه إسترليني', nameEn: 'British Pound', symbolAr: '£', symbolEn: '£', defaultRateVsUsd: 0.77 },
  TRY: { code: 'TRY', nameAr: 'ليرة تركية', nameEn: 'Turkish Lira', symbolAr: '₺', symbolEn: 'TRY', defaultRateVsUsd: 34.2 },
  INR: { code: 'INR', nameAr: 'روبية هندية', nameEn: 'Indian Rupee', symbolAr: '₹', symbolEn: 'INR', defaultRateVsUsd: 84.1 },
  CNY: { code: 'CNY', nameAr: 'يوان صيني', nameEn: 'Chinese Yuan', symbolAr: '¥', symbolEn: 'CNY', defaultRateVsUsd: 7.12 }
};

export interface SettingsContextType {
  settings: UserSettings;
  effectiveLanguage: string;
  effectiveTheme: 'light' | 'dark';
  isAr: boolean;
  isRtl: boolean;
  financialSettings: CompanyFinancialSettings;
  currencySymbol: string;
  currencyLabel: string;
  exchangeRate: number;
  formatMoney: (amountUsd: number, compact?: boolean) => string;
  convertFromUsd: (amountUsd: number) => number;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  isSaving: boolean;
  lastSyncedAt: Date | null;
  tenantCountryCode: string;
  isMethodAllowed: (method: string) => boolean;
  allowedPaymentMethods: PaymentMethodDef[];
  t: (key: string, fallback?: string) => string;
  setLocale: (newLocale: string) => Promise<void>;
  setTheme: (newTheme: SupportedTheme) => Promise<void>;
}

const STORAGE_KEY = 'zilox_user_preferences';
const COOKIE_LOCALE_KEY = 'NEXT_LOCALE';
const COOKIE_PREFS_KEY = 'zilox_user_preferences';

const DEFAULT_SETTINGS: UserSettings = {
  language: 'ar',
  theme: 'dark',
  defaultWarehouseId: 'WH-01',
  enableSoundAlerts: true,
  baseCurrency: 'IQD',
  exchangeRateUsdToIqd: 1520,
  costValuationMethod: 'FIFO',
  barcodeFormat: 'CODE_128',
  lowStockThreshold: 15,
  tenantCountryCode: 'IQ',
  organizationName: 'ZiloX Business Suite',
  taxNumber: '',
  multiCurrencyEnabled: true,
  secondaryCurrencies: [
    { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', exchangeRateVsBase: 1520 }
  ],
  scaleSettings: {
    enabled: true,
    prefix: '20,21,22,99',
    barcodeType: 'WEIGHT',
    itemCodeLength: 5,
    weightUnit: 'KG',
    directScaleBaudRate: 9600
  },
  phone: '',
  address: '',
  commercialRegister: '',
  logoUrl: '',
  receiptHeader: 'أهلاً وسهلاً بكم - نشكر زيارتكم',
  receiptFooter: 'البضاعة المباعة ترد وتستبدل خلال 3 أيام بموجب الوصل',
  autoRoundCash: true,
  paperWidth: '80mm',
  autoPrintReceipt: true,
  openCashDrawerOnCashSale: true
};

// Cookie Helpers
function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
  } catch (err) {
    console.error('Error writing cookie:', err);
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch (err) {
    return null;
  }
}

// Initial Loader with Dual-Layer resolution (Cookies + LocalStorage)
function loadInitialSettings(): UserSettings {
  let loaded: Partial<UserSettings> = {};

  if (typeof window !== 'undefined') {
    // 1. Try LocalStorage for company / system preferences
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        loaded = { ...parsed, ...loaded };
      }
    } catch (e) {
      console.warn('Could not read settings from localStorage', e);
    }

    // 2. Strict Per-User & Local Language Isolation (Independent of global system settings)
    const userLanguage = getStoredLang();
    loaded.language = userLanguage || 'ar';

    try {
      setCookie(COOKIE_LOCALE_KEY, loaded.language || 'ar');
      setLocaleCookie(loaded.language || 'ar');
    } catch {
      // ignore
    }
  }

  // Normalize legacy values
  if (loaded.costValuationMethod === 'WAVG') {
    loaded.costValuationMethod = 'WEIGHTED_AVERAGE';
  }
  if (loaded.barcodeFormat === 'CODE128') {
    loaded.barcodeFormat = 'CODE_128';
  } else if (loaded.barcodeFormat === 'EAN13') {
    loaded.barcodeFormat = 'EAN_13';
  } else if (loaded.barcodeFormat === 'QR') {
    loaded.barcodeFormat = 'QR_CODE';
  }

  if (!loaded.exchangeRateUsdToIqd || loaded.exchangeRateUsdToIqd <= 0) {
    loaded.exchangeRateUsdToIqd = 1520;
  }

  // Auto-heal baseCurrency if missing or defaulted to USD for an Iraqi tenant
  if (!loaded.baseCurrency || (loaded.baseCurrency === 'USD' && (loaded.tenantCountryCode === 'IQ' || !loaded.tenantCountryCode) && !loaded.multiCurrencyEnabled)) {
    loaded.baseCurrency = getDefaultCurrencyForCountry(loaded.tenantCountryCode || 'IQ');
  }

  return {
    ...DEFAULT_SETTINGS,
    ...loaded,
    language: loaded.language || 'ar'
  };
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(loadInitialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => new Date());

  // Determine effective language: Arabic by default
  const effectiveLanguage = useMemo<string>(() => {
    if (!settings.language || settings.language === 'auto') {
      return 'ar';
    }
    return settings.language;
  }, [settings.language]);

  // Determine effective theme
  const effectiveTheme = useMemo<'light' | 'dark'>(() => {
    if (settings.theme === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    }
    return settings.theme;
  }, [settings.theme]);

  const isRtl = useMemo(() => {
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === effectiveLanguage);
    return langObj ? langObj.dir === 'rtl' : ['ar', 'ku'].includes(effectiveLanguage);
  }, [effectiveLanguage]);

  const isAr = effectiveLanguage === 'ar';

  // Apply DOM modifications immediately
  const applyDomUpdates = useCallback((lang: string, theme: 'light' | 'dark') => {
    if (typeof document === 'undefined') return;

    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    const rtl = langObj ? langObj.dir === 'rtl' : ['ar', 'ku'].includes(lang);

    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-theme', theme);

    // Critical Tailwind & shadcn/ui dark class toggling
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }

    if (rtl) {
      document.body.classList.add('rtl-layout');
      document.body.classList.remove('ltr-layout');
    } else {
      document.body.classList.add('ltr-layout');
      document.body.classList.remove('rtl-layout');
    }
  }, []);

  // Sync on initial mount
  useEffect(() => {
    applyDomUpdates(effectiveLanguage, effectiveTheme);
  }, [effectiveLanguage, effectiveTheme, applyDomUpdates]);

  // Server Background Sync
  const syncWithServer = async (updated: UserSettings, lang: string) => {
    setIsSaving(true);
    try {
      const payload = {
        locale: lang,
        theme: updated.theme,
        defaultWarehouseId: updated.defaultWarehouseId,
        enableSoundAlerts: updated.enableSoundAlerts,
        baseCurrency: updated.baseCurrency,
        exchangeRateUsdToIqd: updated.exchangeRateUsdToIqd || 1520,
        costValuationMethod: updated.costValuationMethod,
        barcodeFormat: updated.barcodeFormat,
        lowStockThreshold: updated.lowStockThreshold
      };

      // Real network call to API
      try {
        await fetch('/api/v1/users/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        // Mock fallback for client environment
        console.info('[ZiloX Engine] Background API sync dispatched:', payload);
      }

      // Smooth state transition indicator
      await new Promise(res => setTimeout(res, 200));
      setLastSyncedAt(new Date());

      toast.success(
        lang === 'ar' ? 'تم حفظ التغييرات' : 'Changes saved',
        { duration: 1500 }
      );
    } catch (err) {
      toast.error(
        lang === 'ar' ? 'فشل مزامنة الإعدادات مع السيرفر' : 'Failed to sync settings with server'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Main atomic update function
  const updateSetting = useCallback(async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    // 1. Language Isolation Branch: Scoped exclusively to the current user / browser session
    if (key === 'language') {
      const newEffectiveLang: 'ar' | 'en' = (value === 'auto'
        ? (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en')
        : (value === 'en' ? 'en' : 'ar')) as 'ar' | 'en';

      saveStoredLang(newEffectiveLang);
      setCookie(COOKIE_LOCALE_KEY, newEffectiveLang);
      setLocaleCookie(newEffectiveLang);
      applyDomUpdates(newEffectiveLang, effectiveTheme);

      setSettings(prev => ({ ...prev, language: newEffectiveLang }));

      // Personal user profile sync only (Zero mutation of company/tenant settings)
      try {
        fetch('/api/v1/users/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: newEffectiveLang }),
        }).catch(() => {});
      } catch {}

      toast.success(
        newEffectiveLang === 'ar' ? 'تم تحديث لغة العرض بنجاح' : 'Display language updated successfully',
        { duration: 1500 }
      );
      return;
    }

    const updated: UserSettings = {
      ...settings,
      [key]: value
    };

    setSettings(updated);

    // Compute new effective values
    let newEffectiveLang: string = effectiveLanguage;
    let newEffectiveTheme: 'light' | 'dark' = effectiveTheme;
    if (key === 'theme') {
      if (value === 'system') {
        newEffectiveTheme = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        newEffectiveTheme = value as 'light' | 'dark';
      }
    }

    // 1. Instant Client-Side & Cookies Persistence (Layer 1)
    applyDomUpdates(newEffectiveLang, newEffectiveTheme);
    setCookie(COOKIE_PREFS_KEY, JSON.stringify(updated));

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }

    // 2. Background Server-Side Database Sync (Layer 2)
    await syncWithServer(updated, newEffectiveLang);
  }, [settings, effectiveLanguage, effectiveTheme, applyDomUpdates]);

  const updateSettings = useCallback(async (partial: Partial<UserSettings>) => {
    const updated: UserSettings = {
      ...settings,
      ...partial
    };

    setSettings(updated);

    const newEffectiveLang: string = updated.language === 'auto'
      ? (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en')
      : String(updated.language);

    const newEffectiveTheme: 'light' | 'dark' = updated.theme === 'system'
      ? (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : updated.theme;

    applyDomUpdates(newEffectiveLang, newEffectiveTheme);
    setCookie(COOKIE_LOCALE_KEY, newEffectiveLang);
    setCookie(COOKIE_PREFS_KEY, JSON.stringify(updated));

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      localStorage.setItem('logistock_erp_v1_lang', newEffectiveLang);
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }

    await syncWithServer(updated, newEffectiveLang);
  }, [settings, applyDomUpdates]);

  const exchangeRate = useMemo(() => {
    return Number(settings.exchangeRateUsdToIqd) || 1520;
  }, [settings.exchangeRateUsdToIqd]);

  const financialSettings = useMemo<CompanyFinancialSettings>(() => {
    return resolveCompanyFinancialSettings(settings, isAr);
  }, [settings, isAr]);

  const currentCurrencyMeta = useMemo(() => {
    return CURRENCY_REGISTRY[settings.baseCurrency] || {
      code: settings.baseCurrency,
      nameAr: settings.baseCurrency,
      nameEn: settings.baseCurrency,
      symbolAr: settings.baseCurrency,
      symbolEn: settings.baseCurrency,
      defaultRateVsUsd: 1
    };
  }, [settings.baseCurrency]);

  const currencySymbol = useMemo(() => {
    return isAr ? currentCurrencyMeta.symbolAr : currentCurrencyMeta.symbolEn;
  }, [currentCurrencyMeta, isAr]);

  const currencyLabel = useMemo(() => {
    return isAr 
      ? `${currentCurrencyMeta.nameAr} (${currentCurrencyMeta.code})` 
      : `${currentCurrencyMeta.nameEn} (${currentCurrencyMeta.code})`;
  }, [currentCurrencyMeta, isAr]);

  const convertFromUsd = useCallback((amountUsd: number): number => {
    const num = Number(amountUsd) || 0;
    if (settings.baseCurrency === 'USD') return Number(num.toFixed(2));
    if (settings.baseCurrency === 'IQD') return Math.round(num * exchangeRate);
    const rate = currentCurrencyMeta.defaultRateVsUsd || 1;
    const decimals = getCurrencyDecimals(settings.baseCurrency);
    return Number((num * rate).toFixed(decimals));
  }, [settings.baseCurrency, exchangeRate, currentCurrencyMeta]);

  const formatMoney = useCallback((amount: number, compact: boolean = false): string => {
    const num = Number(amount) || 0;
    const sym = isAr ? currentCurrencyMeta.symbolAr : currentCurrencyMeta.symbolEn;
    const decimals = getCurrencyDecimals(settings.baseCurrency);

    if (compact) {
      if (Math.abs(num) >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(decimals === 0 ? 1 : 2)}M ${sym}`;
      }
      if (Math.abs(num) >= 1_000) {
        return `${(num / 1_000).toFixed(decimals === 0 ? 0 : 1)}k ${sym}`;
      }
    }

    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return isAr ? `${formatted} ${sym}` : `${sym} ${formatted}`;
  }, [settings.baseCurrency, isAr, currentCurrencyMeta]);

  const isMethodAllowed = useCallback((method: string) => {
    return isPaymentMethodAllowedForCountry(method, settings.tenantCountryCode || 'US');
  }, [settings.tenantCountryCode]);

  const allowedPaymentMethods = useMemo(() => {
    return getAllowedPaymentMethodsForCountry(settings.tenantCountryCode || 'US');
  }, [settings.tenantCountryCode]);

  const setLocale = useCallback(async (newLocale: string) => {
    setLocaleCookie(newLocale);
    await updateSetting('language', newLocale);
  }, [updateSetting]);

  const setTheme = useCallback(async (newTheme: SupportedTheme) => {
    await updateSetting('theme', newTheme);
  }, [updateSetting]);

  const t = useCallback((key: string, fallback?: string): string => {
    return getTranslation(effectiveLanguage, key, fallback);
  }, [effectiveLanguage]);

  const contextValue = useMemo<SettingsContextType>(() => ({
    settings,
    effectiveLanguage,
    effectiveTheme,
    isAr,
    isRtl,
    financialSettings,
    currencySymbol,
    currencyLabel,
    exchangeRate,
    formatMoney,
    convertFromUsd,
    updateSetting,
    updateSettings,
    isSaving,
    lastSyncedAt,
    tenantCountryCode: settings.tenantCountryCode || 'US',
    isMethodAllowed,
    allowedPaymentMethods,
    t,
    setLocale,
    setTheme
  }), [
    settings,
    effectiveLanguage,
    effectiveTheme,
    isAr,
    isRtl,
    financialSettings,
    currencySymbol,
    currencyLabel,
    exchangeRate,
    formatMoney,
    convertFromUsd,
    updateSetting,
    updateSettings,
    isSaving,
    lastSyncedAt,
    isMethodAllowed,
    allowedPaymentMethods,
    t,
    setLocale,
    setTheme
  ]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

const defaultFinancialSettings = resolveCompanyFinancialSettings(DEFAULT_SETTINGS, true);

const fallbackContextValue: SettingsContextType = {
  settings: DEFAULT_SETTINGS,
  effectiveLanguage: 'ar',
  effectiveTheme: 'light',
  isAr: true,
  isRtl: true,
  financialSettings: defaultFinancialSettings,
  currencySymbol: defaultFinancialSettings.baseCurrency.symbol,
  currencyLabel: `${defaultFinancialSettings.baseCurrency.code} (${defaultFinancialSettings.baseCurrency.symbol})`,
  exchangeRate: DEFAULT_SETTINGS.exchangeRateUsdToIqd || 1520,
  formatMoney: (val: number, compact: boolean = false) => {
    const num = Number(val) || 0;
    const sym = defaultFinancialSettings.baseCurrency.symbol;
    if (compact) {
      if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M ${sym}`;
      if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}k ${sym}`;
    }
    const decimals = defaultFinancialSettings.baseCurrency.decimals;
    return `${num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${sym}`;
  },
  convertFromUsd: (val: number) => val,
  updateSetting: async () => {},
  updateSettings: async () => {},
  isSaving: false,
  lastSyncedAt: null,
  tenantCountryCode: DEFAULT_SETTINGS.tenantCountryCode || 'US',
  isMethodAllowed: () => true,
  allowedPaymentMethods: [],
  t: (key: string, fallback?: string) => fallback || key,
  setLocale: async () => {},
  setTheme: async () => {}
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    return fallbackContextValue;
  }
  return context;
};

export const useCompanyFinancialSettings = (): CompanyFinancialSettings => {
  const { financialSettings } = useSettings();
  return financialSettings;
};
