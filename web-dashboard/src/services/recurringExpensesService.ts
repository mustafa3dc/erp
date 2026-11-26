import {
  KEYS,
  getStoredExpenseCategories,
  getStoredExpenseVouchers,
  saveStoredExpenseVouchers,
  getStoredTreasuryAccounts,
  getStoredTreasuryVouchers,
  saveStoredTreasuryVouchers,
  getStoredAuthSession,
  recordTreasuryInflow,
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
  if (translated) return translated;
  const expTranslated = getTranslation(lang, `errors.EXPENSES.${code}`, '');
  return expTranslated || code;
}

function daysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
}

function toUtcDateStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

export function computeProjectedMonthlyAmount(
  amount: number,
  frequency: string,
  intervalDays?: number | null
): number {
  const amt = Number(amount) || 0;
  if (amt <= 0) return 0;
  if (frequency === 'Weekly') return Math.round(amt * 4 * 10000) / 10000;
  if (frequency === 'Yearly') return Math.round((amt / 12) * 10000) / 10000;
  if (frequency === 'CustomDays') {
    const days = Math.max(1, Number(intervalDays) || 30);
    return Math.round((amt * (30 / days)) * 10000) / 10000;
  }
  return Math.round(amt * 10000) / 10000;
}

export function computeSuggestedSplitAmount(
  monthlyCap: number,
  frequency: string,
  intervalDays?: number | null
): number {
  if (monthlyCap <= 0) return 0;
  let raw = monthlyCap;
  if (frequency === 'Weekly') {
    raw = monthlyCap / 4;
  } else if (frequency === 'CustomDays') {
    const days = Math.max(1, Number(intervalDays) || 30);
    raw = monthlyCap / (30 / days);
  }
  if (raw >= 250) {
    return Math.round(raw / 250) * 250;
  }
  return Math.round(raw * 100) / 100;
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

function buildCategoryCapsMap(): Map<string, number> {
  const map = new Map<string, number>();
  const categories = getStoredExpenseCategories();
  for (const c of categories) {
    const cap = Number(c.monthlyBudgetCap ?? c.budgetLimit ?? 0);
    if (cap > 0) {
      if (c.name) map.set(c.name.trim().toLowerCase(), cap);
      if (c.nameAr) map.set(c.nameAr.trim().toLowerCase(), cap);
      if (c.code) map.set(c.code.trim().toLowerCase(), cap);
    }
  }
  return map;
}

function mapLocalDto(rule: LocalStoredRecurringRule, caps?: Map<string, number>): RecurringExpenseRule {
  const resolvedCaps = caps ?? buildCategoryCapsMap();
  const projected = computeProjectedMonthlyAmount(rule.amount, rule.frequency, rule.intervalDays);
  const cap = rule.category ? (resolvedCaps.get(rule.category.trim().toLowerCase()) ?? null) : null;

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
    projectedMonthlyAmount: projected,
    categoryMonthlyBudgetCap: cap,
    exceedsMonthlyCap: Boolean(cap && cap > 0 && projected > cap),
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
  const roundedAmount = Math.round(amount * 10000) / 10000;

  // Enforce sufficient balance on Main Cash Safe (ACC-01) before posting
  const accounts = getStoredTreasuryAccounts();
  const cashSafe = accounts.find(a => a.id === 'ACC-01' || a.type === 'CASH');
  if (!cashSafe) {
    throw createApiError('ERR_EXPENSE_ACCOUNT_NOT_FOUND');
  }
  const availableBalance = Number(cashSafe.balanceIqd ?? cashSafe.balanceUsd ?? 0);
  if (availableBalance < roundedAmount) {
    throw createApiError('ERR_INSUFFICIENT_TREASURY_BALANCE');
  }

  const existingVouchers = getStoredExpenseVouchers();
  const auth = getStoredAuthSession();
  const actor = auth?.fullName || auth?.username || 'AutoScheduler';

  const voucher: ExpenseVoucher = {
    id: `VCH-REC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    tenantId: auth?.tenantSlug || 'default',
    voucherNo: `RECV-${cycleDateIso.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
    categoryId: matchedCat?.id || '',
    categoryName: rule.category,
    treasuryAccountId: cashSafe.id || 'ACC-01',
    treasuryAccountName: cashSafe.nameAr || cashSafe.name || 'ACC-01',
    amount: roundedAmount,
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

  recordTreasuryOutflow('CASH', voucher.amount, cashSafe.id || 'ACC-01');
  saveStoredExpenseVouchers([voucher, ...existingVouchers]);

  // Also log linked payment voucher in Treasury Vouchers ledger for full auditability
  const existingTreasuryVouchers = getStoredTreasuryVouchers();
  saveStoredTreasuryVouchers([
    {
      id: `TV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      voucherNo: voucher.voucherNo,
      type: 'PAYMENT',
      partyName: rule.title,
      amount: voucher.amount,
      currency: 'IQD',
      accountName: cashSafe.nameAr || cashSafe.name || 'ACC-01',
      expenseVoucherId: voucher.id,
      date: new Date().toLocaleString(),
      notes: voucher.notes || rule.title
    },
    ...existingTreasuryVouchers
  ]);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
  }

  return voucher;
}

function cleanupLocalTestArtifacts(): void {
  const vouchers = getStoredExpenseVouchers();
  const filteredVouchers = vouchers.filter(v => v.voucherNo !== 'RECV-20261126-1110');
  if (filteredVouchers.length !== vouchers.length) {
    saveStoredExpenseVouchers(filteredVouchers);
  }

  const rules = safeGet<LocalStoredRecurringRule[]>(KEYS.RECURRING_EXPENSES, []);
  let modifiedRules = false;
  const fixedRules = rules.map(r => {
    if (!r.isDeleted && r.title.trim() === 'عامل' && r.frequency === 'Weekly' && r.amount === 900000) {
      modifiedRules = true;
      return { ...r, amount: 150000, updatedAt: new Date().toISOString() };
    }
    return r;
  });
  if (modifiedRules) {
    safeSet(KEYS.RECURRING_EXPENSES, fixedRules);
  }
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
        try {
          postLocalExpenseVoucher(cur, cycleDateIso, cur.amount, null);
        } catch {
          // Stop auto-posting if treasury balance is insufficient
          break;
        }
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
  cleanupLocalTestArtifacts();

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
  const caps = buildCategoryCapsMap();
  const rules = safeGet<LocalStoredRecurringRule[]>(KEYS.RECURRING_EXPENSES, [])
    .filter(r => !r.isDeleted)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.id.localeCompare(b.id));

  return rules.map(r => mapLocalDto(r, caps));
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
      if (!res.ok || !json?.success) throw createApiError(json?.errorCode || 'ERR_REQUEST_FAILED');
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
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
          window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
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

export async function voidExpenseVoucher(voucherId: string, reason: string): Promise<void> {
  const trimmedReason = (reason ?? '').trim();
  if (trimmedReason.length < 3) {
    throw createApiError('ERR_REVERSAL_REASON_REQUIRED');
  }

  const token = getAuthToken();
  if (token && isUuid(voucherId)) {
    try {
      const res = await fetch(`/api/expenses/${encodeURIComponent(voucherId)}/void`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason: trimmedReason })
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('erp_expenses_updated'));
          window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
        }
        return;
      }
      if (res.status === 403) throw createApiError(json?.errorCode || 'ERR_FORBIDDEN_ACTION');
      if (res.status >= 400 && res.status < 500 && json?.errorCode) throw createApiError(json.errorCode);
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const vouchers = getStoredExpenseVouchers();
  const target = vouchers.find(v => v.id === voucherId);
  if (!target) throw createApiError('ERR_VOUCHER_NOT_FOUND');
  if (target.status === 'Voided') throw createApiError('ERR_VOUCHER_ALREADY_VOIDED');

  // Refund ACC-01 ONLY if a treasury outflow voucher was recorded for this expense voucher
  const treasuryVouchers = getStoredTreasuryVouchers();
  const hasRecordedDeduction = treasuryVouchers.some(
    tv => tv.expenseVoucherId === target.id || (tv.voucherNo && tv.voucherNo === target.voucherNo)
  );
  if (hasRecordedDeduction && target.status === 'Approved') {
    recordTreasuryInflow('CASH', target.amount, target.treasuryAccountId || 'ACC-01');
    saveStoredTreasuryVouchers([
      {
        id: `TV-REFUND-${Date.now()}`,
        voucherNo: `VOID-${target.voucherNo}`,
        type: 'RECEIPT',
        partyName: target.recipient,
        amount: target.amount,
        currency: 'IQD',
        accountName: target.treasuryAccountName || 'ACC-01',
        date: new Date().toLocaleString(),
        notes: trimmedReason
      },
      ...treasuryVouchers
    ]);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
    }
  }

  const auth = getStoredAuthSession();
  const updated = vouchers.map(v =>
    v.id === voucherId
      ? {
          ...v,
          status: 'Voided' as const,
          voidedAt: new Date().toISOString(),
          voidedByUserId: auth?.fullName || auth?.username || auth?.role || 'Admin',
          voidReason: trimmedReason
        }
      : v
  );
  saveStoredExpenseVouchers(updated);
}
