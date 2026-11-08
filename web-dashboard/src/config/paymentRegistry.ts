/**
 * Strict Architectural Registry: Absolute Regional Isolation for Payment Methods
 * Multi-Tenant Configuration: Local payment methods like ZAIN_CASH and QI_CARD
 * are strictly restricted to tenants with CountryCode === 'IQ'.
 */

export interface PaymentMethodDef {
  code: string;
  nameAr: string;
  nameEn: string;
  isRegionLocked: boolean;
  allowedCountry?: string; // e.g. 'IQ'
  badge?: string;
  color: string;
  bgColor: string;
}

export const GlobalPaymentMethods = ['CASH', 'CARD', 'BANK_TRANSFER', 'INSTALLMENT'] as const;

export const RegionLockedPaymentMethods: Record<string, string[]> = {
  IQ: ['ZAIN_CASH', 'QI_CARD']
};

export const PAYMENT_METHOD_CATALOG: Record<string, PaymentMethodDef> = {
  CASH: {
    code: 'CASH',
    nameAr: 'نقداً',
    nameEn: 'Cash',
    isRegionLocked: false,
    color: '#059669',
    bgColor: '#ecfdf5'
  },
  INSTALLMENT: {
    code: 'INSTALLMENT',
    nameAr: 'بيع بالتقسيط',
    nameEn: 'Installment Plan',
    isRegionLocked: false,
    color: '#2563eb',
    bgColor: '#eff6ff'
  },
  CARD: {
    code: 'CARD',
    nameAr: 'بطاقة إلكترونية (POS)',
    nameEn: 'Credit/Debit Card',
    isRegionLocked: false,
    color: '#0284c7',
    bgColor: '#f0f9ff'
  },
  BANK_TRANSFER: {
    code: 'BANK_TRANSFER',
    nameAr: 'تحويل مصرفي',
    nameEn: 'Bank Transfer',
    isRegionLocked: false,
    color: '#475569',
    bgColor: '#f8fafc'
  },
  ZAIN_CASH: {
    code: 'ZAIN_CASH',
    nameAr: 'محفظة زين كاش',
    nameEn: 'ZainCash Wallet',
    isRegionLocked: true,
    allowedCountry: 'IQ',
    color: '#db2777',
    bgColor: '#fdf2f8'
  },
  QI_CARD: {
    code: 'QI_CARD',
    nameAr: 'بطاقة كي كارد',
    nameEn: 'Qi Card',
    isRegionLocked: true,
    allowedCountry: 'IQ',
    color: '#d97706',
    bgColor: '#fffbeb'
  }
};

/**
 * Validates whether a payment method is permissible for the tenant's registered country.
 */
export function isPaymentMethodAllowedForCountry(method: string, countryCode: string): boolean {
  if (!method) return false;
  const upperMethod = method.trim().toUpperCase();
  const upperCountry = (countryCode || 'GLOBAL').trim().toUpperCase();

  // Global methods are accessible to all countries
  if ((GlobalPaymentMethods as readonly string[]).includes(upperMethod)) {
    return true;
  }

  // Check regional lock
  const allowed = RegionLockedPaymentMethods[upperCountry];
  if (allowed && allowed.includes(upperMethod)) {
    return true;
  }

  return false;
}

/**
 * Returns list of PaymentMethodDef allowed for the specified tenant country.
 */
export function getAllowedPaymentMethodsForCountry(countryCode: string): PaymentMethodDef[] {
  const upperCountry = (countryCode || 'GLOBAL').trim().toUpperCase();
  return Object.values(PAYMENT_METHOD_CATALOG).filter(def => {
    if (!def.isRegionLocked) return true;
    return def.allowedCountry === upperCountry;
  });
}
