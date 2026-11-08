export const SUPPORTED_LOCALES = ['ar', 'en', 'tr', 'fr', 'de', 'es', 'hi', 'zh', 'ur', 'ku'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: SupportedLocale = 'ar';
