import {
  KEYS,
  getStoredExpenseCategories,
  getStoredExpenseVouchers,
  saveStoredExpenseVouchers,
  getStoredAuthSession,
  recordTreasuryOutflow,
  safeGet,
  safeSet
} from './storageService';
import {
  ExpenseVoucher,
  RecurringFrequency,
  RecurringExecutionMode,
  RecurringExpenseRule,
  UpsertRecurringExpensePayload,
  ConfirmRecurringExpensePayload
} from '../types/businessModules';
import { getTranslation, MESSAGES } from '../lib/i18n';
import { checkUserHasPermission } from '../config/navigationSchema';

interface LocalStoredRecurringRule {
  id: string;
  title: string;
  category: string;
  amount: number;
  frequency: RecurringFrequency;
  dayOfMonth?: number | null;
  dayOfWeek?: number | null;
  intervalDays?: number | null;
  nextDueDate: string;
  lastExecutedDate?: string | null;
  executionMode: RecurringExecutionMode;
  isActive: boolean;
  isDeleted?: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('zilox_auth_token') || localStorage.getItem('logistock_erp_jwt_token');
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function isUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));
}

function createApiError(code: string): Error {
  return new Error(code);
}

export function formatRecurringErrorMessage(err: any, lang: string): string {
  const code = String(err?.message || 'ERR_UNKNOWN').trim();
  const translated = getTranslation(lang, `errors.ERR.RECURRING.${code}`, '');
  return translated || code;
}

function daysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
}

function toUtcDateStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

export function computeInitialNextDueDate(
  frequency: RecurringFrequency,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
  intervalDays?: number | null
): string {
  const today = toUtcDateStart(new Date());
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();

  if (frequency === 'Monthly') {
    const targetDay = Math.min(31, Math.max(1, dayOfMonth ?? d));
    const currentMonthMax = daysInMonth(y, m);
    const currentCandidate = new Date(Date.UTC(y, m, Math.min(targetDay, currentMonthMax)));
    if (currentCandidate.getTime() >= today.getTime()) {
      return currentCandidate.toISOString();
    }
    const nextMonth = m + 1;
    const nextY = y + Math.floor(nextMonth / 12);
    const nextM = nextMonth % 12;
    const nextMax = daysInMonth(nextY, nextM);
    return new Date(Date.UTC(nextY, nextM, Math.min(targetDay, nextMax))).toISOString();
  }

  if (frequency === 'Weekly') {
    const targetDow = Math.min(6, Math.max(0, dayOfWeek ?? today.getUTCDay()));
    const delta = (targetDow - today.getUTCDay() + 7) % 7;
    return new Date(today.getTime() + delta * 86400000).toISOString();
  }

  if (frequency === 'Yearly') {
    const targetDay = Math.min(31, Math.max(1, dayOfMonth ?? d));
    const thisYearMax = daysInMonth(y, m);
    const thisYear = new Date(Date.UTC(y, m, Math.min(targetDay, thisYearMax)));
    if (thisYear.getTime() >= today.getTime()) return thisYear.toISOString();
    const nextMax = daysInMonth(y + 1, m);
    return new Date(Date.UTC(y + 1, m, Math.min(targetDay, nextMax))).toISOString();
  }

  const interval = Math.max(1, intervalDays ?? 30);
  return new Date(today.getTime() + interval * 86400000).toISOString();
}

function advanceCycleDate(rule: LocalStoredRecurringRule, currentIso: string): string {
  const cur = toUtcDateStart(new Date(currentIso));
  const y = cur.getUTCFullYear();
  const m = cur.getUTCMonth();
  const d = cur.getUTCDate();

  if (rule.frequency === 'Monthly') {
    const totalMonths = y * 12 + m + 1;
    const nextY = Math.floor(totalMonths / 12);
    const nextM = totalMonths % 12;
    const targetDay = Math.min(31, Math.max(1, rule.dayOfMonth ?? d));
    const maxD = daysInMonth(nextY, nextM);
    return new Date(Date.UTC(nextY, nextM, Math.min(targetDay, maxD))).toISOString();
  }

  if (rule.frequency === 'Weekly') {
    return new Date(cur.getTime() + 7 * 86400000).toISOString();
  }

  if (rule.frequency === 'Yearly') {
    const targetDay = Math.min(31, Math.max(1, rule.dayOfMonth ?? d));
    const maxD = daysInMonth(y + 1, m);
    return new Date(Date.UTC(y + 1, m, Math.min(targetDay, maxD))).toISOString();
  }

  return new Date(cur.getTime() + Math.max(1, rule.intervalDays ?? 30) * 86400000).toISOString();
}

function isRuleDue(rule: LocalStoredRecurringRule): boolean {
  if (!rule.isActive || rule.isDeleted) return false;
  const due = toUtcDateStart(new Date(rule.nextDueDate)).getTime();
  const today = toUtcDateStart(new Date()).getTime();
  return due <= today;
}

function mapLocalDto(rule: LocalStoredRecurringRule): RecurringExpenseRule {
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    amount: rule.amount,
    frequency: rule.frequency,
    dayOfMonth: rule.dayOfMonth ?? null,
    dayOfWeek: rule.dayOfWeek ?? null,
    intervalDays: rule.intervalDays ?? null,
    nextDueDate: rule.nextDueDate,
    lastExecutedDate: rule.lastExecutedDate ?? null,
    executionMode: rule.executionMode,
    isActive: rule.isActive,
    isDue: isRuleDue(rule),
    notes: rule.notes ?? null,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt
  };
}

function postLocalExpenseVoucher(
  rule: LocalStoredRecurringRule,
  cycleDateIso: string,
  amount: number,
  customNotes?: string | null
): ExpenseVoucher {
  const categories = getStoredExpenseCategories();
  const matchedCat = categories.find(
    c => c.name.toLowerCase() === rule.category.toLowerCase() || (c.nameAr && c.nameAr === rule.category)
  );
  const existingVouchers = getStoredExpenseVouchers();
  const auth = getStoredAuthSession();
  const actor = auth?.fullName || auth?.username || 'AutoScheduler';

  const voucher: ExpenseVoucher = {
    id: `VCH-REC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    tenantId: auth?.tenantSlug || 'default',
    voucherNo: `RECV-${cycleDateIso.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
    categoryId: matchedCat?.id || 'CAT-RECURRING',
    categoryName: rule.category,
    treasuryAccountId: 'ACC-01',
    treasuryAccountName: 'ACC-01',
    amount: Math.round(amount * 10000) / 10000,
    currency: 'IQD',
    exchangeRate: 1,
    recipient: rule.title,
    paymentMethod: 'Cash',
    notes: customNotes?.trim() ? `${rule.title} — ${customNotes.trim()}` : (rule.notes ? `${rule.title} — ${rule.notes}` : rule.title),
    status: 'Approved',
    approvedBy: actor,
    approvedAt: new Date().toISOString(),
    recurringExpenseId: rule.id,
    createdAt: cycleDateIso,
    createdBy: actor
  };

  saveStoredExpenseVouchers([voucher, ...existingVouchers]);
  recordTreasuryOutflow('CASH', voucher.amount, 'ACC-01');
  return voucher;
}

function processLocalAutoPostCatchUp(): void {
  const rules = safeGet<LocalStoredRecurringRule[]>(KEYS.RECURRING_EXPENSES, []);
  if (rules.length === 0) return;

  const todayMs = toUtcDateStart(new Date()).getTime();
  let modified = false;

  const updated = rules.map(rule => {
    if (rule.isDeleted || !rule.isActive || rule.executionMode !== 'AutoPost') {
      return rule;
    }

    let cur = { ...rule };
    let cycles = 0;
    while (toUtcDateStart(new Date(cur.nextDueDate)).getTime() <= todayMs && cycles < 36) {
      const cycleDateIso = cur.nextDueDate;
      const cycleDay = cycleDateIso.slice(0, 10);
      const existing = getStoredExpenseVouchers().some(
        v => v.recurringExpenseId === cur.id && (v.createdAt || '').slice(0, 10) === cycleDay && v.status === 'Approved'
      );
      if (!existing) {
        postLocalExpenseVoucher(cur, cycleDateIso, cur.amount, null);
      }
      cur.lastExecutedDate = new Date().toISOString();
      cur.nextDueDate = advanceCycleDate(cur, cycleDateIso);
      cur.updatedAt = new Date().toISOString();
      cycles++;
      modified = true;
    }
    return cur;
  });

  if (modified) {
    safeSet(KEYS.RECURRING_EXPENSES, updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp_recurring_expenses_updated'));
    }
  }
}

export function formatRecurringScheduleLabel(rule: RecurringExpenseRule, lang: string): string {
  const normLocale = lang === 'ar' ? 'ar' : 'en';
  if (rule.frequency === 'Monthly') {
    return getTranslation(lang, 'ui.recurringExpenses.freqMonthlyDay').replace('{day}', String(rule.dayOfMonth ?? 1));
  }
  if (rule.frequency === 'Weekly') {
    const weekdays = (MESSAGES[normLocale]?.ui?.recurringExpenses?.weekdays as string[] | undefined) || [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
    ];
    const idx = Math.min(6, Math.max(0, rule.dayOfWeek ?? 0));
    return getTranslation(lang, 'ui.recurringExpenses.freqWeeklyDay').replace('{weekday}', weekdays[idx] || '');
  }
  if (rule.frequency === 'Yearly') {
    return getTranslation(lang, 'ui.recurringExpenses.freqYearlyDay').replace('{day}', String(rule.dayOfMonth ?? 1));
  }
  return getTranslation(lang, 'ui.recurringExpenses.freqCustomDays').replace('{days}', String(rule.intervalDays ?? 30));
}

export async function fetchRecurringExpenses(): Promise<RecurringExpenseRule[]> {
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/expenses/recurring', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch {
      // Fallback to local
    }
  }

  processLocalAutoPostCatchUp();
  const rules = safeGet<LocalStoredRecurringRule[]>(KEYS.RECURRING_EXPENSES, [])
    .filter(r => !r.isDeleted)
    .sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());

  return rules.map(mapLocalDto);
}

export async function fetchDueRecurringExpenses(): Promise<RecurringExpenseRule[]> {
  const session = getStoredAuthSession();
  const canManageExpenses = checkUserHasPermission(session?.permissions ?? [], 'expenses.manage')
    || checkUserHasPermission(session?.permissions ?? [], 'finance.ledger');
  if (!canManageExpenses) {
    return [];
  }

  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/dashboard/summary?period=today', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && Array.isArray(json.data?.dueRecurringExpenses)) {
          return json.data.dueRecurringExpenses;
        }
      }
    } catch {
      // Fallback
    }
  }

  const all = await fetchRecurringExpenses();
  return all.filter(r => r.isActive && r.isDue);
}

export async function createRecurringExpense(payload: UpsertRecurringExpensePayload): Promise<RecurringExpenseRule> {
  if (!payload.title.trim()) throw createApiError('ERR_RECURRING_TITLE_REQUIRED');
  if (payload.amount <= 0) throw createApiError('ERR_INVALID_RECURRING_AMOUNT');

  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/expenses/recurring', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) return json.data;
      if (res.status >= 400 && res.status < 500 && json?.errorCode) throw createApiError(json.errorCode);
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const now = new Date().toISOString();
  const nextDueDate = payload.nextDueDate || computeInitialNextDueDate(
    payload.frequency,
    payload.dayOfMonth,
    payload.dayOfWeek,
    payload.intervalDays
  );

  const created: LocalStoredRecurringRule = {
    id: `REC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    title: payload.title.trim(),
    category: payload.category.trim(),
    amount: Math.round(payload.amount * 10000) / 10000,
    frequency: payload.frequency,
    dayOfMonth: payload.frequency === 'Monthly' || payload.frequency === 'Yearly' ? (payload.dayOfMonth ?? 1) : null,
    dayOfWeek: payload.frequency === 'Weekly' ? (payload.dayOfWeek ?? 0) : null,
    intervalDays: payload.frequency === 'CustomDays' ? Math.max(1, payload.intervalDays ?? 30) : null,
    nextDueDate,
    lastExecutedDate: null,
    executionMode: payload.executionMode,
    isActive: payload.isActive,
    isDeleted: false,
    notes: payload.notes?.trim() || null,
    createdAt: now,
    updatedAt: now
  };

  const existing = safeGet<LocalStoredRecurringRule[]>(KEYS.RECURRING_EXPENSES, []);
  safeSet(KEYS.RECURRING_EXPENSES, [created, ...existing]);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp_recurring_expenses_updated'));
  return mapLocalDto(created);
}

export async function updateRecurringExpense(id: string, payload: UpsertRecurringExpensePayload): Promise<RecurringExpenseRule> {
  if (!payload.title.trim()) throw createApiError('ERR_RECURRING_TITLE_REQUIRED');
  if (payload.amount <= 0) throw createApiError('ERR_INVALID_RECURRING_AMOUNT');

  const token = getAuthToken();
  if (token && isUuid(id)) {
    try {
      const res = await fetch(`/api/expenses/recurring/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) return json.data;
      if (res.status >= 400 && res.status < 500 && json?.errorCode) throw createApiError(json.errorCode);
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const existing = safeGet<LocalStoredRecurringRule[]>(KEYS.RECURRING_EXPENSES, []);
  const idx = existing.findIndex(r => r.id === id && !r.isDeleted);
  if (idx < 0) throw createApiError('ERR_RECURRING_NOT_FOUND');

  const nextDueDate = payload.nextDueDate || computeInitialNextDueDate(
    payload.frequency,
    payload.dayOfMonth,
    payload.dayOfWeek,
    payload.intervalDays
  );

  const updated: LocalStoredRecurringRule = {
    ...existing[idx],
    title: payload.title.trim(),
    category: payload.category.trim(),
    amount: Math.round(payload.amount * 10000) / 10000,
    frequency: payload.frequency,
    dayOfMonth: payload.frequency === 'Monthly' || payload.frequency === 'Yearly' ? (payload.dayOfMonth ?? 1) : null,
    dayOfWeek: payload.frequency === 'Weekly' ? (payload.dayOfWeek ?? 0) : null,
    intervalDays: payload.frequency === 'CustomDays' ? Math.max(1, payload.intervalDays ?? 30) : null,
    nextDueDate,
    executionMode: payload.executionMode,
    isActive: payload.isActive,
    notes: payload.notes?.trim() || null,
    updatedAt: new Date().toISOString()
  };

  const nextList = [...existing];
  nextList[idx] = updated;
  safeSet(KEYS.RECURRING_EXPENSES, nextList);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp_recurring_expenses_updated'));
  return mapLocalDto(updated);
}

export async function toggleRecurringExpense(id: string): Promise<RecurringExpenseRule> {
  const token = getAuthToken();
  if (token && isUuid(id)) {
    try {
      const res = await fetch(`/api/expenses/recurring/${encodeURIComponent(id)}/toggle`, {
        method: 'PATCH',
        headers: authHeaders()
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) return json.data;
    } catch {
      // Fallback
    }
  }

  const existing = safeGet<LocalStoredRecurringRule[]>(KEYS.RECURRING_EXPENSES, []);
  const idx = existing.findIndex(r => r.id === id && !r.isDeleted);
  if (idx < 0) throw createApiError('ERR_RECURRING_NOT_FOUND');

  const updated = { ...existing[idx], isActive: !existing[idx].isActive, updatedAt: new Date().toISOString() };
  const nextList = [...existing];
  nextList[idx] = updated;
  safeSet(KEYS.RECURRING_EXPENSES, nextList);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp_recurring_expenses_updated'));
  return mapLocalDto(updated);
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  const token = getAuthToken();
  if (token && isUuid(id)) {
    try {
      const res = await fetch(`/api/expenses/recurring/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) return;
    } catch {
      // Fallback
    }
  }

  const existing = safeGet<LocalStoredRecurringRule[]>(KEYS.RECURRING_EXPENSES, []);
  const nextList = existing.map(r => r.id === id ? { ...r, isDeleted: true, isActive: false, updatedAt: new Date().toISOString() } : r);
  safeSet(KEYS.RECURRING_EXPENSES, nextList);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp_recurring_expenses_updated'));
}

export async function confirmRecurringExpense(
  id: string,
  payload: ConfirmRecurringExpensePayload
): Promise<RecurringExpenseRule> {
  if (payload.actualAmount !== undefined && payload.actualAmount <= 0) {
    throw createApiError('ERR_INVALID_RECURRING_AMOUNT');
  }

  const token = getAuthToken();
  if (token && isUuid(id)) {
    try {
      const res = await fetch(`/api/expenses/recurring/${encodeURIComponent(id)}/confirm`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data?.rule) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('erp_recurring_expenses_updated'));
          window.dispatchEvent(new CustomEvent('erp_expenses_updated'));
        }
        return json.data.rule;
      }
      if (res.status >= 400 && res.status < 500 && json?.errorCode) throw createApiError(json.errorCode);
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const existing = safeGet<LocalStoredRecurringRule[]>(KEYS.RECURRING_EXPENSES, []);
  const idx = existing.findIndex(r => r.id === id && !r.isDeleted);
  if (idx < 0) throw createApiError('ERR_RECURRING_NOT_FOUND');

  const rule = existing[idx];
  const amount = payload.actualAmount ?? rule.amount;
  if (amount <= 0) throw createApiError('ERR_INVALID_RECURRING_AMOUNT');

  postLocalExpenseVoucher(rule, new Date().toISOString(), amount, payload.notes);

  const todayMs = toUtcDateStart(new Date()).getTime();
  let nextDue = advanceCycleDate(rule, rule.nextDueDate);
  while (toUtcDateStart(new Date(nextDue)).getTime() < todayMs) {
    nextDue = advanceCycleDate(rule, nextDue);
  }

  const updated: LocalStoredRecurringRule = {
    ...rule,
    lastExecutedDate: new Date().toISOString(),
    nextDueDate: nextDue,
    updatedAt: new Date().toISOString()
  };

  const nextList = [...existing];
  nextList[idx] = updated;
  safeSet(KEYS.RECURRING_EXPENSES, nextList);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp_recurring_expenses_updated'));
  return mapLocalDto(updated);
}
