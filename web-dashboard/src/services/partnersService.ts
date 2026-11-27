import {
  KEYS,
  getStoredInvoices,
  getStoredProducts,
  getStoredProductBundles,
  getStoredExpenseVouchers,
  getStoredQuickExpenses,
  getStoredAuthSession,
  resolveProductUnitCost,
  recordTreasuryInflow,
  recordTreasuryOutflow,
  safeGet,
  safeSet
} from './storageService';
import { getTranslation } from '../lib/i18n';
import { parseDateSafely } from '../utils/dateFormatter';
import { checkUserHasPermission } from '../config/navigationSchema';

export type PartnerPeriod = 'today' | 'week' | 'month' | 'all';
export type PartnerTransactionType = 'Withdrawal' | 'ProfitPayout' | 'CapitalInjection';

export interface PartnerItemSummary {
  id: string;
  name: string;
  phone?: string | null;
  capitalAmount: number;
  profitSharePercent: number;
  isActive: boolean;
  notes?: string | null;
  earnedProfit: number;
  totalWithdrawals: number;
  netPayableBalance: number;
  createdAt: string;
}

export interface PartnersSummaryResponse {
  period: PartnerPeriod | string;
  fromDate: string;
  toDate: string;
  totalRevenue: number;
  totalCogs: number;
  totalExpenses: number;
  totalNetProfit: number;
  allocatedSharePercent: number;
  unallocatedSharePercent: number;
  partners: PartnerItemSummary[];
}

export interface PartnerTransactionItem {
  id: string;
  partnerId: string;
  transactionType: PartnerTransactionType | string;
  amount: number;
  notes?: string | null;
  shiftId?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface PaginatedPartnerTransactions {
  partnerId: string;
  partnerName: string;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  items: PartnerTransactionItem[];
}

export interface UpsertPartnerPayload {
  name: string;
  phone?: string | null;
  capitalAmount: number;
  profitSharePercent: number;
  isActive: boolean;
  notes?: string | null;
}

export interface RecordPartnerTransactionPayload {
  transactionType: PartnerTransactionType;
  amount: number;
  notes?: string | null;
  shiftId?: string | null;
  deductFromTreasury: boolean;
}

interface LocalPartnerRecord {
  id: string;
  name: string;
  phone?: string | null;
  capitalAmount: number;
  profitSharePercent: number;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
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

function round4(n: number): number {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function createApiError(errorCode: string, metadata?: Record<string, any>): Error & { metadata?: Record<string, any> } {
  const err = new Error(errorCode) as Error & { metadata?: Record<string, any> };
  if (metadata) err.metadata = metadata;
  return err;
}

export function formatPartnerErrorMessage(err: any, lang: string): string {
  const code = String(err?.message || 'ERR_UNKNOWN').trim();
  const translated = getTranslation(lang, `errors.ERR.PARTNERS.${code}`, '');
  if (translated) {
    const remaining = err?.metadata?.remainingAvailable ?? err?.metadata?.remaining ?? '';
    return translated.replace('{remaining}', String(remaining));
  }
  return code;
}

function resolvePeriodBounds(period: PartnerPeriod): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  let from: Date;

  switch (period) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case 'week':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      break;
    case 'all':
      from = new Date(2000, 0, 1, 0, 0, 0, 0);
      break;
    case 'month':
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
  }
  return { from, to };
}

function normalizePeriod(period?: string): PartnerPeriod {
  if (period === 'today' || period === 'week' || period === 'month' || period === 'all') {
    return period;
  }
  return 'month';
}

function computeLocalPartnersSummary(rawPeriod: string): PartnersSummaryResponse {
  const period = normalizePeriod(rawPeriod);
  const { from, to } = resolvePeriodBounds(period);
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const partners = safeGet<LocalPartnerRecord[]>(KEYS.PARTNERS, []);
  const transactions = safeGet<PartnerTransactionItem[]>(KEYS.PARTNER_TRANSACTIONS, []);
  const invoices = getStoredInvoices();
  const products = getStoredProducts();
  const bundles = getStoredProductBundles();
  const expenseVouchers = getStoredExpenseVouchers();
  const quickExpenses = getStoredQuickExpenses();

  let totalRevenue = 0;
  let totalCogs = 0;

  for (const inv of invoices) {
    if (!inv || String(inv.status || '').toLowerCase() !== 'paid') continue;
    const invDate = parseDateSafely(inv.createdAt || inv.date)?.getTime();
    if (!invDate || invDate < fromMs || invDate > toMs) continue;

    const invTotal = Number(inv.total) || 0;
    totalRevenue += invTotal;

    if (Array.isArray(inv.items) && inv.items.length > 0) {
      for (const item of inv.items) {
        const prod = products.find(p => p.id === item.productId || (item.sku && p.sku === item.sku));
        const unitCost = resolveProductUnitCost(prod, products, bundles);
        totalCogs += unitCost * (Number(item.quantity) || 0);
      }
    } else if (typeof inv.realizedProfit === 'number') {
      totalCogs += Math.max(0, invTotal - inv.realizedProfit);
    }
  }

  let totalExpenses = 0;
  for (const v of expenseVouchers) {
    if (!v || String(v.status || '') !== 'Approved') continue;
    const dt = parseDateSafely(v.approvedAt || v.createdAt)?.getTime();
    if (!dt || dt < fromMs || dt > toMs) continue;
    totalExpenses += Number(v.amount) || 0;
  }
  for (const qe of quickExpenses) {
    if (!qe) continue;
    const dt = parseDateSafely(qe.createdAt)?.getTime();
    if (!dt || dt < fromMs || dt > toMs) continue;
    totalExpenses += Number(qe.amount) || 0;
  }

  const totalNetProfit = round4(totalRevenue - totalCogs - totalExpenses);
  const distributableProfit = totalNetProfit > 0 ? totalNetProfit : 0;

  const periodWithdrawalsByPartner = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx) continue;
    if (tx.transactionType !== 'Withdrawal' && tx.transactionType !== 'ProfitPayout') continue;
    const txMs = parseDateSafely(tx.createdAt)?.getTime();
    if (!txMs || txMs < fromMs || txMs > toMs) continue;
    periodWithdrawalsByPartner.set(
      tx.partnerId,
      (periodWithdrawalsByPartner.get(tx.partnerId) || 0) + (Number(tx.amount) || 0)
    );
  }

  const allocatedShare = round2(
    partners.filter(p => p.isActive).reduce((sum, p) => sum + (Number(p.profitSharePercent) || 0), 0)
  );
  const unallocatedShare = Math.max(0, round2(100 - allocatedShare));

  const items: PartnerItemSummary[] = [...partners]
    .sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || b.profitSharePercent - a.profitSharePercent || a.name.localeCompare(b.name))
    .map(p => {
      const earnedProfit = p.isActive ? round4(distributableProfit * (p.profitSharePercent / 100)) : 0;
      const totalWithdrawals = round4(periodWithdrawalsByPartner.get(p.id) || 0);
      return {
        id: p.id,
        name: p.name,
        phone: p.phone ?? null,
        capitalAmount: round4(p.capitalAmount),
        profitSharePercent: round2(p.profitSharePercent),
        isActive: p.isActive,
        notes: p.notes ?? null,
        earnedProfit,
        totalWithdrawals,
        netPayableBalance: round4(earnedProfit - totalWithdrawals),
        createdAt: p.createdAt
      };
    });

  return {
    period,
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
    totalRevenue: round4(totalRevenue),
    totalCogs: round4(totalCogs),
    totalExpenses: round4(totalExpenses),
    totalNetProfit,
    allocatedSharePercent: allocatedShare,
    unallocatedSharePercent: unallocatedShare,
    partners: items
  };
}

export async function fetchPartnersSummary(period: PartnerPeriod = 'month'): Promise<PartnersSummaryResponse> {
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch(`/api/partners/summary?period=${encodeURIComponent(period)}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && json.data) {
          return json.data;
        }
      }
      if (res.status === 401 || res.status === 403) {
        throw createApiError('ERR_UNAUTHORIZED');
      }
    } catch (err: any) {
      if (err?.message === 'ERR_UNAUTHORIZED') throw err;
    }
  }

  return computeLocalPartnersSummary(period);
}

export async function createPartner(payload: UpsertPartnerPayload): Promise<PartnerItemSummary> {
  if (!payload.name || !payload.name.trim()) {
    throw createApiError('ERR_PARTNER_NAME_REQUIRED');
  }
  if (payload.profitSharePercent <= 0 || payload.profitSharePercent > 100) {
    throw createApiError('ERR_INVALID_PARTNER_SHARE');
  }
  if (payload.capitalAmount < 0) {
    throw createApiError('ERR_INVALID_CAPITAL_AMOUNT');
  }

  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
      if (res.status >= 400 && res.status < 500 && json?.errorCode) {
        throw createApiError(json.errorCode, json.metadata);
      }
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const existing = safeGet<LocalPartnerRecord[]>(KEYS.PARTNERS, []);
  if (payload.isActive) {
    const currentAllocated = round2(existing.filter(p => p.isActive).reduce((s, p) => s + p.profitSharePercent, 0));
    const remaining = Math.max(0, round2(100 - currentAllocated));
    if (round2(currentAllocated + payload.profitSharePercent) > 100) {
      throw createApiError('ERR_PARTNER_SHARE_EXCEEDS_100', {
        currentAllocated,
        remainingAvailable: remaining
      });
    }
  }

  const created: LocalPartnerRecord = {
    id: `PRT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    name: payload.name.trim(),
    phone: payload.phone?.trim() || null,
    capitalAmount: round4(payload.capitalAmount),
    profitSharePercent: round2(payload.profitSharePercent),
    isActive: payload.isActive,
    notes: payload.notes?.trim() || null,
    createdAt: new Date().toISOString()
  };

  safeSet(KEYS.PARTNERS, [created, ...existing]);
  return {
    ...created,
    earnedProfit: 0,
    totalWithdrawals: 0,
    netPayableBalance: 0
  };
}

export async function updatePartner(partnerId: string, payload: UpsertPartnerPayload): Promise<PartnerItemSummary> {
  if (!payload.name || !payload.name.trim()) {
    throw createApiError('ERR_PARTNER_NAME_REQUIRED');
  }
  if (payload.profitSharePercent <= 0 || payload.profitSharePercent > 100) {
    throw createApiError('ERR_INVALID_PARTNER_SHARE');
  }
  if (payload.capitalAmount < 0) {
    throw createApiError('ERR_INVALID_CAPITAL_AMOUNT');
  }

  const token = getAuthToken();
  if (token && isUuid(partnerId)) {
    try {
      const res = await fetch(`/api/partners/${encodeURIComponent(partnerId)}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
      if (res.status >= 400 && res.status < 500 && json?.errorCode) {
        throw createApiError(json.errorCode, json.metadata);
      }
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const existing = safeGet<LocalPartnerRecord[]>(KEYS.PARTNERS, []);
  const targetIndex = existing.findIndex(p => p.id === partnerId);
  if (targetIndex < 0) {
    throw createApiError('ERR_PARTNER_NOT_FOUND');
  }

  if (payload.isActive) {
    const currentAllocated = round2(
      existing.filter(p => p.isActive && p.id !== partnerId).reduce((s, p) => s + p.profitSharePercent, 0)
    );
    const remaining = Math.max(0, round2(100 - currentAllocated));
    if (round2(currentAllocated + payload.profitSharePercent) > 100) {
      throw createApiError('ERR_PARTNER_SHARE_EXCEEDS_100', {
        currentAllocated,
        remainingAvailable: remaining
      });
    }
  }

  const updated: LocalPartnerRecord = {
    ...existing[targetIndex],
    name: payload.name.trim(),
    phone: payload.phone?.trim() || null,
    capitalAmount: round4(payload.capitalAmount),
    profitSharePercent: round2(payload.profitSharePercent),
    isActive: payload.isActive,
    notes: payload.notes?.trim() || null
  };

  const next = [...existing];
  next[targetIndex] = updated;
  safeSet(KEYS.PARTNERS, next);

  return {
    ...updated,
    earnedProfit: 0,
    totalWithdrawals: 0,
    netPayableBalance: 0
  };
}

export async function recordPartnerTransaction(
  partnerId: string,
  payload: RecordPartnerTransactionPayload
): Promise<PartnerTransactionItem> {
  if (payload.amount <= 0) {
    throw createApiError('ERR_INVALID_TRANSACTION_AMOUNT');
  }

  const token = getAuthToken();
  if (token && isUuid(partnerId)) {
    try {
      const res = await fetch(`/api/partners/${encodeURIComponent(partnerId)}/transactions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...payload,
          shiftId: isUuid(payload.shiftId) ? payload.shiftId : null
        })
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
      if (res.status >= 400 && res.status < 500 && json?.errorCode) {
        throw createApiError(json.errorCode, json.metadata);
      }
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const partners = safeGet<LocalPartnerRecord[]>(KEYS.PARTNERS, []);
  const partnerIdx = partners.findIndex(p => p.id === partnerId);
  if (partnerIdx < 0) {
    throw createApiError('ERR_PARTNER_NOT_FOUND');
  }

  if (payload.transactionType === 'CapitalInjection') {
    const nextPartners = [...partners];
    nextPartners[partnerIdx] = {
      ...nextPartners[partnerIdx],
      capitalAmount: round4(nextPartners[partnerIdx].capitalAmount + payload.amount)
    };
    safeSet(KEYS.PARTNERS, nextPartners);
    if (payload.deductFromTreasury) {
      recordTreasuryInflow('CASH', payload.amount, 'ACC-01');
    }
  } else {
    // Partner Withdrawal / ProfitPayout NEVER writes to Expenses; it reduces treasury cash if enabled.
    if (payload.deductFromTreasury) {
      recordTreasuryOutflow('CASH', payload.amount, 'ACC-01');
    }
  }

  const authUser = getStoredAuthSession();
  const tx: PartnerTransactionItem = {
    id: `PTX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    partnerId,
    transactionType: payload.transactionType,
    amount: round4(payload.amount),
    notes: payload.notes?.trim() || null,
    shiftId: payload.shiftId || null,
    createdBy: authUser?.fullName || authUser?.username || authUser?.role || null,
    createdAt: new Date().toISOString()
  };

  const existingTxs = safeGet<PartnerTransactionItem[]>(KEYS.PARTNER_TRANSACTIONS, []);
  safeSet(KEYS.PARTNER_TRANSACTIONS, [tx, ...existingTxs]);
  return tx;
}

export async function fetchPartnerStatement(
  partnerId: string,
  page = 1,
  pageSize = 15
): Promise<PaginatedPartnerTransactions> {
  const token = getAuthToken();
  if (token && isUuid(partnerId)) {
    try {
      const res = await fetch(
        `/api/partners/${encodeURIComponent(partnerId)}/transactions?page=${page}&pageSize=${pageSize}`,
        { headers: authHeaders() }
      );
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && json.data) {
          return json.data;
        }
      }
    } catch {
      // Fallback to local
    }
  }

  const partners = safeGet<LocalPartnerRecord[]>(KEYS.PARTNERS, []);
  const partner = partners.find(p => p.id === partnerId);
  if (!partner) {
    throw createApiError('ERR_PARTNER_NOT_FOUND');
  }

  const allTxs = safeGet<PartnerTransactionItem[]>(KEYS.PARTNER_TRANSACTIONS, [])
    .filter(t => t.partnerId === partnerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const totalCount = allTxs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    partnerId: partner.id,
    partnerName: partner.name,
    page: safePage,
    pageSize: safePageSize,
    totalCount,
    totalPages,
    items: allTxs.slice(start, start + safePageSize)
  };
}

export interface DashboardSummaryResponse {
  period: string;
  canViewProfits: boolean;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  invoicesCount: number;
  treasuryCashBalance: number;
  treasuryBankBalance: number;
  treasuryTotalBalance: number;
  inventoryValuation: number;
  lowStockCount: number;
  receivablesTotalBalance: number;
  receivablesCustomersCount: number;
  overdueInstallmentsCount: number;
  overdueInstallmentsAmount: number;
  totalInstallmentsRemaining: number;
  partnersSummary: PartnersSummaryResponse | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapDashboardPeriod(dateRangeId: string): PartnerPeriod {
  if (dateRangeId === 'today') return 'today';
  if (dateRangeId === 'week') return 'week';
  if (dateRangeId === 'month') return 'month';
  return 'all';
}

export async function fetchDashboardSummary(
  dateRangeId: string,
  warehouseId?: string
): Promise<DashboardSummaryResponse | null> {
  const mappedPeriod = mapDashboardPeriod(dateRangeId);
  const token = getAuthToken();
  if (!token) return null;

  try {
    const params = new URLSearchParams({ period: mappedPeriod });
    if (warehouseId && warehouseId !== 'ALL' && UUID_REGEX.test(warehouseId)) {
      params.set('warehouseId', warehouseId);
    }
    const res = await fetch(`/api/dashboard/summary?${params.toString()}`, {
      headers: authHeaders()
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json?.success && json.data) {
        return json.data as DashboardSummaryResponse;
      }
    }
  } catch {
    // Fallback handled by caller
  }
  return null;
}

export async function fetchDashboardPartnersSummary(
  dateRangeId: string,
  warehouseId?: string
): Promise<PartnersSummaryResponse | null> {
  const mappedPeriod = mapDashboardPeriod(dateRangeId);

  const token = getAuthToken();
  if (token) {
    try {
      const params = new URLSearchParams({ period: mappedPeriod });
      if (warehouseId && warehouseId !== 'ALL' && UUID_REGEX.test(warehouseId)) {
        params.set('warehouseId', warehouseId);
      }
      const res = await fetch(`/api/dashboard/summary?${params.toString()}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && json.data) {
          return json.data.partnersSummary ?? null;
        }
      }
    } catch {
      // Fallback below
    }
  }

  const session = getStoredAuthSession();
  if (!session || !checkUserHasPermission(session.permissions ?? [], 'finance.partners.manage')) {
    return null;
  }

  return computeLocalPartnersSummary(mappedPeriod);
}
