/**
 * Global Western/Latin numeral (0-9) and locale-safe display formatters.
 * Ensures all typed, scanned, pasted, and displayed numbers use standard ASCII 0-9.
 */

const EASTERN_ARABIC_START = 0x0660; // ٠
const EXTENDED_ARABIC_START = 0x06f0; // ۰

export const LATIN_DIGIT_REGEX = /[\u0660-\u0669\u06F0-\u06F9\u066B]/g;

/**
 * Converts Eastern Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Extended Arabic-Indic /
 * Persian / Kurdish digits (۰۱۲۳۴۵۶۷۸۹) to ASCII 0-9 (and ٫ to .).
 */
export function toLatinDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!str) return '';

  return str.replace(LATIN_DIGIT_REGEX, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= EASTERN_ARABIC_START && code <= EASTERN_ARABIC_START + 9) {
      return String.fromCharCode(48 + (code - EASTERN_ARABIC_START));
    }
    if (code >= EXTENDED_ARABIC_START && code <= EXTENDED_ARABIC_START + 9) {
      return String.fromCharCode(48 + (code - EXTENDED_ARABIC_START));
    }
    if (code === 0x066b) {
      return '.';
    }
    return ch;
  });
}

function toSafeNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const normalized = toLatinDigits(value).replace(/,/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toSafeDate(value: Date | string | number): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const normalized = typeof value === 'string' ? toLatinDigits(value) : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a number using Latin digits (numberingSystem: 'latn').
 */
export function formatLatinNumber(
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  const num = toSafeNumber(value);
  return toLatinDigits(
    new Intl.NumberFormat('en-US', {
      numberingSystem: 'latn',
      ...options,
    }).format(num)
  );
}

/**
 * Formats a percentage using Latin digits (numberingSystem: 'latn').
 */
export function formatLatinPercent(
  value: number | string | null | undefined,
  decimals: number = 1
): string {
  const num = toSafeNumber(value);
  return `${formatLatinNumber(num, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })}%`;
}

/**
 * Formats a date using Latin digits (numberingSystem: 'latn').
 */
export function formatLatinDate(
  value: Date | string | number,
  locale: string = 'ar',
  options?: Intl.DateTimeFormatOptions
): string {
  const date = toSafeDate(value);
  if (!date) return '';
  const targetLocale = locale.toLowerCase().startsWith('ar') ? 'ar-IQ' : 'en-US';
  return toLatinDigits(
    new Intl.DateTimeFormat(targetLocale, {
      numberingSystem: 'latn',
      ...options,
    }).format(date)
  );
}

/**
 * Formats a date and time using Latin digits (numberingSystem: 'latn').
 */
export function formatLatinDateTime(
  value: Date | string | number,
  locale: string = 'ar',
  options?: Intl.DateTimeFormatOptions
): string {
  const date = toSafeDate(value);
  if (!date) return '';
  const targetLocale = locale.toLowerCase().startsWith('ar') ? 'ar-IQ' : 'en-US';
  return toLatinDigits(
    new Intl.DateTimeFormat(targetLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      numberingSystem: 'latn',
      ...options,
    }).format(date)
  );
}

/**
 * Formats a time using Latin digits (numberingSystem: 'latn').
 */
export function formatLatinTime(
  value: Date | string | number,
  locale: string = 'ar',
  options?: Intl.DateTimeFormatOptions
): string {
  const date = toSafeDate(value);
  if (!date) return '';
  const targetLocale = locale.toLowerCase().startsWith('ar') ? 'ar-IQ' : 'en-US';
  return toLatinDigits(
    new Intl.DateTimeFormat(targetLocale, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      numberingSystem: 'latn',
      ...options,
    }).format(date)
  );
}
