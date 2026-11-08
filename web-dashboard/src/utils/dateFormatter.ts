/**
 * Date Formatter Helper for Stock Movements & Warehouse Transactions
 * Strict Date & Time formatting: YYYY/MM/DD HH:mm
 * Completely eliminates "اليوم" / "Today" relative words per explicit user directive.
 */

import { convertArabicToEnglishNumerals } from './arabicNumeralConverter';

/**
 * Safely parses any date representation, including ISO dates, UTC timestamps,
 * unix epoch milliseconds, and legacy representations like "اليوم 10:30 ص", "Today 10:30 AM", or "14:30".
 */
export function parseDateSafely(rawDate: string | Date | null | undefined): Date | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date) {
    return isNaN(rawDate.getTime()) ? null : rawDate;
  }

  // Strip Bidi control characters, zero-width chars, and normalize spaces
  let str = String(rawDate)
    .replace(/[\u200B-\u200F\u061C\uFEFF]/g, '')
    .replace(/[\u00A0\u202F\u2000-\u200A]/g, ' ')
    .trim();

  str = convertArabicToEnglishNumerals(str);
  if (!str || str === '—' || str === '-') return null;

  // Numeric epoch milliseconds or seconds
  if (/^\d{10,13}$/.test(str)) {
    const num = parseInt(str, 10);
    const d = new Date(str.length === 10 ? num * 1000 : num);
    if (!isNaN(d.getTime())) return d;
  }

  // 1. Try standard Date constructor (handles ISO-8601, RFC2822, etc.)
  const directDate = new Date(str);
  if (!isNaN(directDate.getTime())) {
    return directDate;
  }

  // 2. Check for "YYYY-MM-DD" or "YYYY/MM/DD" with optional time
  const fullDateMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (fullDateMatch) {
    const y = parseInt(fullDateMatch[1], 10);
    const m = parseInt(fullDateMatch[2], 10) - 1;
    const d = parseInt(fullDateMatch[3], 10);
    const h = fullDateMatch[4] ? parseInt(fullDateMatch[4], 10) : 0;
    const min = fullDateMatch[5] ? parseInt(fullDateMatch[5], 10) : 0;
    const s = fullDateMatch[6] ? parseInt(fullDateMatch[6], 10) : 0;
    const parsed = new Date(y, m, d, h, min, s);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 3. Check for "DD/MM/YYYY" or "DD-MM-YYYY"
  const dmyMatch = str.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const h = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const s = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const parsed = new Date(y, m, d, h, min, s);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 4. Handle Arabic or English relative strings like "اليوم 10:30 ص" or "Today 10:30 AM" or "10:30 ص" or "14:30"
  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(ص|م|AM|PM|am|pm)?/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const min = parseInt(timeMatch[2], 10);
    const sec = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const meridian = timeMatch[4];

    if (meridian) {
      const isPm = meridian === 'م' || meridian.toUpperCase() === 'PM';
      const isAm = meridian === 'ص' || meridian.toUpperCase() === 'AM';
      if (isPm && h < 12) h += 12;
      else if (isAm && h === 12) h = 0;
    }

    const now = new Date();
    const parsed = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, sec);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 5. If string simply says "اليوم" or "today" without specific time, resolve to now
  if (/اليوم|today/i.test(str)) {
    return new Date();
  }

  return null;
}

/**
 * Formats a stock movement date.
 * Strictly returns numeric Date & Time: "YYYY/MM/DD HH:mm".
 * NEVER returns "اليوم" or "Today".
 * If rawDate is missing or completely unparseable, returns '—'.
 */
export function formatMovementDate(rawDate?: string | Date | null, _lang: 'ar' | 'en' = 'ar'): string {
  if (!rawDate) return '—';

  const date = parseDateSafely(rawDate);
  if (!date || isNaN(date.getTime())) return '—';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * Safely extracts the transaction or movement date property from a payload object.
 * Priority order:
 * 1. movementDate (from Backend StockMovement Entity)
 * 2. createdAt (from Backend Domain StockMovement & InventoryTransaction)
 * 3. date (standard/legacy frontend date)
 * 4. timestamp (legacy formatted string or ISO timestamp)
 */
export function extractMovementDate(
  item?: {
    movementDate?: string | Date | null;
    createdAt?: string | Date | null;
    date?: string | Date | null;
    timestamp?: string | Date | null;
  } | null
): string | Date | undefined {
  if (!item) return undefined;
  return item.movementDate || item.createdAt || item.date || item.timestamp || undefined;
}
