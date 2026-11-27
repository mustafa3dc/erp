import { getTranslation } from '../lib/i18n';
import { toLatinDigits } from '../lib/formatters';

/**
 * Normalizes local/Iraqi and international phone numbers for WhatsApp `wa.me` links.
 * Examples:
 *  - `0770 123 4567` -> `9647701234567`
 *  - `+964 770 123 4567` -> `9647701234567`
 *  - `009647701234567` -> `9647701234567`
 *  - `7701234567` -> `9647701234567`
 */
export function normalizePhoneForWhatsApp(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  let digits = toLatinDigits(rawPhone).replace(/[^\d+]/g, '');
  if (!digits) return '';

  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Iraqi mobile numbers: 07xxxxxxxxx (11 digits) or 7xxxxxxxxx (10 digits)
  if (/^07\d{9}$/.test(digits)) {
    return `964${digits.slice(1)}`;
  }
  if (/^7\d{9}$/.test(digits)) {
    return `964${digits}`;
  }

  // Generic local 0-prefix fallback (if 10+ digits starting with 0)
  if (digits.startsWith('0') && digits.length >= 10 && !digits.startsWith('00')) {
    return `964${digits.slice(1)}`;
  }

  return digits;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const normalized = normalizePhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  return normalized
    ? `https://wa.me/${normalized}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function openWhatsAppShare(phone: string | null | undefined, message: string): void {
  const url = buildWhatsAppUrl(phone, message);
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function formatInvoiceWhatsAppMessage(params: {
  lang: 'ar' | 'en';
  storeName: string;
  invoiceNo: string;
  customerName?: string;
  itemsSummary?: string;
  itemsCount?: number;
  totalAmountFormatted: string;
  paidAmountFormatted: string;
  remainingAmountFormatted: string;
}): string {
  const t = (k: string) => getTranslation(params.lang, `whatsapp.${k}`);
  const lines = [
    `*${t('invoiceHeader')} — ${params.storeName}*`,
    `${t('invoiceNumber')}: ${params.invoiceNo}`,
    params.customerName ? `${t('invoiceCustomer')}: ${params.customerName}` : '',
    params.itemsSummary
      ? `${t('invoiceItems')}: ${params.itemsSummary}`
      : params.itemsCount != null
      ? `${t('invoiceItemsCount')}: ${params.itemsCount}`
      : '',
    `${t('invoiceTotal')}: ${params.totalAmountFormatted}`,
    `${t('invoicePaid')}: ${params.paidAmountFormatted}`,
    `${t('invoiceRemaining')}: ${params.remainingAmountFormatted}`,
    '',
    t('invoiceFooter'),
  ].filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''));

  return toLatinDigits(lines.join('\n'));
}

export function formatReceiptVoucherWhatsAppMessage(params: {
  lang: 'ar' | 'en';
  storeName: string;
  voucherNo: string;
  partyName?: string;
  amountFormatted: string;
  dateText: string;
  accountName?: string;
}): string {
  const t = (k: string) => getTranslation(params.lang, `whatsapp.${k}`);
  const lines = [
    `*${t('receiptHeader')} — ${params.storeName}*`,
    `${t('receiptNumber')}: ${params.voucherNo}`,
    params.partyName ? `${t('receiptParty')}: ${params.partyName}` : '',
    `${t('receiptAmount')}: ${params.amountFormatted}`,
    params.accountName ? `${t('receiptAccount')}: ${params.accountName}` : '',
    `${t('receiptDate')}: ${params.dateText}`,
    '',
    t('invoiceFooter'),
  ].filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''));

  return toLatinDigits(lines.join('\n'));
}

export function formatInstallmentReminderWhatsAppMessage(params: {
  lang: 'ar' | 'en';
  storeName: string;
  customerName: string;
  contractNumber: string;
  installmentNumber: number;
  dueDate: string;
  amountDueFormatted: string;
  remainingContractFormatted: string;
  isOverdue: boolean;
}): string {
  const t = (k: string) => getTranslation(params.lang, `whatsapp.${k}`);
  const lines = [
    `*${t('installmentHeader')} — ${params.storeName}*`,
    params.isOverdue ? `⚠️ ${t('installmentOverdueNotice')}` : '',
    `${t('invoiceCustomer')}: ${params.customerName}`,
    `${t('installmentContract')}: ${params.contractNumber}`,
    `${t('installmentNumber')}: #${params.installmentNumber}`,
    `${t('installmentDueDate')}: ${params.dueDate}`,
    `${t('installmentAmountDue')}: ${params.amountDueFormatted}`,
    `${t('installmentRemainingContract')}: ${params.remainingContractFormatted}`,
    '',
    t('installmentFooter'),
  ].filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''));

  return toLatinDigits(lines.join('\n'));
}
