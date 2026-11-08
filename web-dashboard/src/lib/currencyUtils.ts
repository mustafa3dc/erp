export interface CurrencyConfig {
  code: string;       // e.g. "IQD", "USD", "SAR", "AED", "EUR"
  symbol: string;     // e.g. "د.ع", "$", "ر.س", "€"
  decimals: number;   // 0 للعملات بدون كسور (مثل IQD)، 2 للعملات ذات الكسور (مثل USD)
}

export interface CompanyFinancialSettings {
  baseCurrency: CurrencyConfig;               // العملة الأساسية (إجبارية)
  secondaryCurrency?: CurrencyConfig | null;  // العملة الثانوية (اختيارية)
  isMultiCurrencyEnabled: boolean;            // تفعيل التداول المزدوج
}

export const ZERO_DECIMAL_CURRENCIES = new Set([
  'IQD', 'JPY', 'KRW', 'VND', 'CLP', 'HUF', 'IDR', 'PYG', 'RWF', 'UGX'
]);

export const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'KWD', 'OMR', 'JOD', 'TND', 'LYD'
]);

/**
 * Returns standard decimal precision based on ISO currency code
 */
export function getCurrencyDecimals(code: string): number {
  const upper = (code || '').toUpperCase().trim();
  if (ZERO_DECIMAL_CURRENCIES.has(upper)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(upper)) return 3;
  return 2;
}

/**
 * Returns localized currency symbol (Arabic or English) without hardcoding in JSX
 */
export function getCurrencySymbol(code: string, isAr: boolean = true): string {
  const upper = (code || '').toUpperCase().trim();
  switch (upper) {
    case 'IQD': return isAr ? 'د.ع' : 'IQD';
    case 'USD': return '$';
    case 'SAR': return isAr ? 'ر.س' : 'SAR';
    case 'AED': return isAr ? 'د.إ' : 'AED';
    case 'KWD': return isAr ? 'د.ك' : 'KWD';
    case 'QAR': return isAr ? 'ر.ق' : 'QAR';
    case 'BHD': return isAr ? 'د.ب' : 'BHD';
    case 'OMR': return isAr ? 'ر.ع' : 'OMR';
    case 'JOD': return isAr ? 'د.أ' : 'JOD';
    case 'EGP': return isAr ? 'ج.م' : 'EGP';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'TRY': return '₺';
    case 'INR': return '₹';
    case 'CNY': return '¥';
    default: return upper;
  }
}

/**
 * Returns standard default ISO currency code for a country
 */
export function getDefaultCurrencyForCountry(countryCode?: string): string {
  const code = (countryCode || 'IQ').toUpperCase().trim();
  switch (code) {
    case 'IQ': return 'IQD';
    case 'SA': return 'SAR';
    case 'AE': return 'AED';
    case 'KW': return 'KWD';
    case 'QA': return 'QAR';
    case 'BH': return 'BHD';
    case 'OM': return 'OMR';
    case 'JO': return 'JOD';
    case 'EG': return 'EGP';
    case 'TR': return 'TRY';
    case 'US': return 'USD';
    case 'GB': return 'GBP';
    case 'EU': return 'EUR';
    default: return 'IQD';
  }
}

/**
 * Builds a complete CurrencyConfig object dynamically
 */
export function buildCurrencyConfig(
  code: string, 
  isAr: boolean = true, 
  customSymbol?: string
): CurrencyConfig {
  const cleanCode = (code || 'IQD').toUpperCase().trim();
  return {
    code: cleanCode,
    symbol: customSymbol || getCurrencySymbol(cleanCode, isAr),
    decimals: getCurrencyDecimals(cleanCode)
  };
}

/**
 * Resolves CompanyFinancialSettings from settings object with safe defaults
 */
export function resolveCompanyFinancialSettings(
  settings: any,
  isAr: boolean = true
): CompanyFinancialSettings {
  const defaultCode = getDefaultCurrencyForCountry(settings?.tenantCountryCode);
  const baseCode = (settings?.baseCurrency || defaultCode).toUpperCase().trim();
  const baseCurrency = buildCurrencyConfig(baseCode, isAr);

  const isMultiCurrencyEnabled = Boolean(settings?.multiCurrencyEnabled);

  let secondaryCurrency: CurrencyConfig | null = null;
  if (isMultiCurrencyEnabled && Array.isArray(settings?.secondaryCurrencies) && settings.secondaryCurrencies.length > 0) {
    const sec = settings.secondaryCurrencies[0];
    if (sec && sec.code && sec.code.toUpperCase().trim() !== baseCurrency.code) {
      secondaryCurrency = buildCurrencyConfig(sec.code, isAr, sec.symbol);
    }
  }

  return {
    baseCurrency,
    secondaryCurrency,
    isMultiCurrencyEnabled: isMultiCurrencyEnabled && secondaryCurrency !== null
  };
}

/**
 * Returns standard dynamic placeholder for monetary inputs according to decimals
 */
export function getCurrencyPlaceholder(currency: CurrencyConfig, isAr: boolean = true): string {
  if (isAr) {
    return currency.decimals === 0
      ? `مثال: 15,000 ${currency.symbol}`
      : `مثال: 15.00 ${currency.symbol}`;
  } else {
    return currency.decimals === 0
      ? `e.g. 15,000 ${currency.symbol}`
      : `e.g. 15.00 ${currency.symbol}`;
  }
}

/**
 * Formats monetary amounts dynamically with appropriate decimal places
 */
export function formatCurrencyAmount(
  amount: number, 
  currency: CurrencyConfig, 
  locale: string = 'en-US'
): string {
  const val = Number(amount) || 0;
  return val.toLocaleString(locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals
  });
}

