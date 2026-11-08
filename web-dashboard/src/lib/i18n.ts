import arMessages from '../locales/ar.json';
import enMessages from '../locales/en.json';
import arCommon from '../locales/ar/common.json';
import enCommon from '../locales/en/common.json';
import arInventory from '../locales/ar/inventory.json';
import enInventory from '../locales/en/inventory.json';
import arErrors from '../locales/ar/errors.json';
import enErrors from '../locales/en/errors.json';

export type Locale = 'ar' | 'en' | string;

export const MESSAGES: Record<string, Record<string, any>> = {
  ar: {
    ...arMessages,
    common: arCommon,
    inventory: arInventory,
    errors: arErrors
  },
  en: {
    ...enMessages,
    common: enCommon,
    inventory: enInventory,
    errors: enErrors
  }
};

export function getTranslation(locale: string, key: string, fallback?: string): string {
  const normLocale = locale === 'ar' ? 'ar' : 'en';
  const dict = MESSAGES[normLocale] || MESSAGES.ar;

  // Split key by dot e.g. "actions.save" or "common.dashboard"
  const parts = key.split('.');
  let current: any = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return fallback || key;
    }
  }

  return typeof current === 'string' ? current : (fallback || key);
}

export function setLocaleCookie(locale: string) {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {
    console.error('Error writing NEXT_LOCALE cookie:', e);
  }
}
