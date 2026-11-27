import {
  getStoredTreasuryAccounts,
  saveStoredTreasuryAccounts,
  getStoredTreasuryVouchers,
  saveStoredTreasuryVouchers
} from './storageService';
import { getAuthToken, isUuid } from './purchasesService';
import { getTranslation } from '../lib/i18n';
import { formatLatinDateTime } from '../lib/formatters';

export type TreasuryAccountType = 'Cashbox' | 'BankAccount' | 'DigitalWallet';

export interface TreasuryAccountRecord {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  accountType: TreasuryAccountType;
  currency: string;
  currentBalance: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TreasuryVoucherRecord {
  id: string;
  cashBoxId: string;
  cashBoxName: string;
  cashBoxCode: string;
  accountType: TreasuryAccountType;
  currency: string;
  transactionType: 'RECEIPT' | 'PAYMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'REFUND' | string;
  amount: number;
  balanceAfter: number;
  referenceNumber: string;
  partyName: string;
  voucherDate: string;
  notes: string;
  createdBy?: string | null;
  createdAt: string;
}

export interface CreateTreasuryVoucherInput {
  accountId: string;
  amount: number;
  partyName?: string;
  reference?: string;
  notes?: string;
  voucherDate?: string;
}

export interface TreasuryTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  reference?: string;
  notes?: string;
  voucherDate?: string;
}

export interface UpsertTreasuryAccountInput {
  name: string;
  accountType: TreasuryAccountType;
  currency?: string;
  initialBalance?: number;
  code?: string;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function notifyTreasuryUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
  }
}

export function normalizeAccountType(raw?: string | null, code?: string | null, name?: string | null): TreasuryAccountType {
  const val = (raw || '').trim().toLowerCase();
  if (val === 'bankaccount' || val === 'bank') return 'BankAccount';
  if (val === 'digitalwallet' || val === 'wallet') return 'DigitalWallet';
  if (val === 'cashbox' || val === 'cash') return 'Cashbox';

  const c = (code || '').toUpperCase();
  const n = (name || '').toLowerCase();
  if (c.startsWith('BNK') || c.startsWith('BANK') || c === 'ACC-02' || c === 'ACC-03' || n.includes('bank') || n.includes('بنك') || n.includes('مصرف')) {
    return 'BankAccount';
  }
  if (c.startsWith('WAL') || c === 'ACC-04' || n.includes('wallet') || n.includes('zain') || n.includes('محفظ') || n.includes('زين كاش')) {
    return 'DigitalWallet';
  }
  return 'Cashbox';
}

export function formatTreasuryErrorMessage(err: any, lang: string): string {
  const code = String(err?.errorCode || err?.message || 'ERR_TREASURY_VOUCHER_FAILED').trim();
  const candidates = [
    `errors.ERR.TREASURY.${code}`,
    `errors.ERR.EXPENSES.${code}`,
    `errors.ERR.PURCHASES.${code}`,
    `errors.ERR.RECURRING.${code}`
  ];
  for (const key of candidates) {
    const translated = getTranslation(lang, key, '');
    if (translated) return translated;
  }
  return code;
}

function mapLocalAccounts(includeInactive = false): TreasuryAccountRecord[] {
  const raw = getStoredTreasuryAccounts();
  return raw
    .map((acc: any, idx: number) => {
      const accountType = normalizeAccountType(acc.accountType || acc.type, acc.code || acc.id, acc.nameAr || acc.name);
      return {
        id: String(acc.id),
        code: String(acc.code || acc.accountNumber || acc.id || `CB-0${idx + 1}`),
        name: String(acc.nameAr || acc.name || acc.nameEn || ''),
        nameAr: acc.nameAr || acc.name,
        nameEn: acc.nameEn || acc.name,
        accountType,
        currency: String(acc.currency || 'IQD'),
        currentBalance: Number(acc.balanceIqd ?? acc.currentBalance ?? acc.balanceUsd ?? 0),
        isActive: acc.isActive !== false
      };
    })
    .filter(acc => includeInactive || acc.isActive);
}

export async function fetchTreasuryAccountsList(includeInactive = false): Promise<TreasuryAccountRecord[]> {
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch(`/api/treasury/accounts?includeInactive=${includeInactive ? 'true' : 'false'}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const rows = await res.json().catch(() => null);
        if (Array.isArray(rows)) {
          return rows.map((row: any) => ({
            id: String(row.id),
            code: String(row.code || ''),
            name: String(row.name || ''),
            accountType: normalizeAccountType(row.accountType, row.code, row.name),
            currency: String(row.currency || 'IQD'),
            currentBalance: Number(row.currentBalance) || 0,
            isActive: row.isActive !== false,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          }));
        }
      }
    } catch {
      // Fallback
    }
  }
  return mapLocalAccounts(includeInactive);
}

export async function fetchTreasuryVouchers(params?: {
  page?: number;
  pageSize?: number;
  type?: string;
  search?: string;
}): Promise<{ items: TreasuryVoucherRecord[]; totalCount: number }> {
  const token = getAuthToken();
  if (token) {
    try {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
      if (params?.type && params.type !== 'ALL') qs.set('type', params.type);
      if (params?.search?.trim()) qs.set('search', params.search.trim());

      const res = await fetch(`/api/treasury/vouchers?${qs.toString()}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && Array.isArray(json.items)) {
          return {
            items: json.items.map((tx: any) => ({
              id: String(tx.id),
              cashBoxId: String(tx.cashBoxId),
              cashBoxName: String(tx.cashBoxName || ''),
              cashBoxCode: String(tx.cashBoxCode || ''),
              accountType: normalizeAccountType(tx.accountType, tx.cashBoxCode, tx.cashBoxName),
              currency: String(tx.currency || 'IQD'),
              transactionType: String(tx.transactionType || 'PAYMENT'),
              amount: Number(tx.amount) || 0,
              balanceAfter: Number(tx.balanceAfter) || 0,
              referenceNumber: String(tx.referenceNumber || tx.id.slice(0, 8)),
              partyName: String(tx.partyName || ''),
              voucherDate: String(tx.voucherDate || tx.createdAt || new Date().toISOString()),
              notes: String(tx.notes || ''),
              createdBy: tx.createdBy ?? null,
              createdAt: String(tx.createdAt || new Date().toISOString())
            })),
            totalCount: Number(json.totalCount) || json.items.length
          };
        }
      }
    } catch {
      // Fallback
    }
  }

  const localVouchers = getStoredTreasuryVouchers();
  const mapped: TreasuryVoucherRecord[] = localVouchers.map((v: any) => ({
    id: String(v.id),
    cashBoxId: String(v.cashBoxId || ''),
    cashBoxName: String(v.accountName || ''),
    cashBoxCode: String(v.accountCode || ''),
    accountType: normalizeAccountType(v.accountType, v.accountCode, v.accountName),
    currency: String(v.currency || 'IQD'),
    transactionType: String(v.transactionType || v.type || 'PAYMENT'),
    amount: Number(v.amount) || 0,
    balanceAfter: Number(v.balanceAfter) || 0,
    referenceNumber: String(v.voucherNo || ''),
    partyName: String(v.partyName || ''),
    voucherDate: String(v.voucherDate || v.date || new Date().toISOString()),
    notes: String(v.notes || ''),
    createdAt: String(v.createdAt || v.date || new Date().toISOString())
  }));

  const search = params?.search?.trim().toLowerCase() || '';
  const typeFilter = (params?.type || 'ALL').toUpperCase();
  const filtered = mapped.filter(v => {
    const matchesType =
      typeFilter === 'ALL' ||
      (typeFilter === 'TRANSFER'
        ? v.transactionType === 'TRANSFER_OUT' || v.transactionType === 'TRANSFER_IN'
        : v.transactionType.toUpperCase() === typeFilter);
    const matchesSearch =
      !search ||
      v.referenceNumber.toLowerCase().includes(search) ||
      v.partyName.toLowerCase().includes(search) ||
      v.cashBoxName.toLowerCase().includes(search) ||
      v.notes.toLowerCase().includes(search);
    return matchesType && matchesSearch;
  });

  return { items: filtered, totalCount: filtered.length };
}

export async function createReceiptVoucher(input: CreateTreasuryVoucherInput): Promise<TreasuryVoucherRecord> {
  const amount = Math.round((Number(input.amount) || 0) * 10000) / 10000;
  if (amount <= 0) throw new Error('ERR_INVALID_AMOUNT');
  if (!input.accountId) throw new Error('ERR_TREASURY_ACCOUNT_REQUIRED');

  const token = getAuthToken();
  if (token && isUuid(input.accountId)) {
    const res = await fetch('/api/treasury/vouchers/receipt', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        accountId: input.accountId,
        amount,
        partyName: input.partyName?.trim() || null,
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        voucherDate: input.voucherDate ? new Date(input.voucherDate).toISOString() : null
      })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.errorCode || 'ERR_TREASURY_VOUCHER_FAILED');
    notifyTreasuryUpdated();
    const v = json.voucher;
    return {
      id: String(v.id),
      cashBoxId: String(v.cashBoxId),
      cashBoxName: String(v.cashBoxName || ''),
      cashBoxCode: String(v.cashBoxCode || ''),
      accountType: normalizeAccountType(v.accountType),
      currency: String(v.currency || 'IQD'),
      transactionType: 'RECEIPT',
      amount: Number(v.amount),
      balanceAfter: Number(v.balanceAfter),
      referenceNumber: String(v.referenceNumber),
      partyName: String(v.partyName || ''),
      voucherDate: String(v.voucherDate),
      notes: String(v.notes || ''),
      createdAt: String(v.createdAt)
    };
  }

  // Local fallback
  const stored = getStoredTreasuryAccounts();
  const idx = stored.findIndex((a: any) => a.id === input.accountId && a.isActive !== false);
  if (idx < 0) throw new Error('ERR_TREASURY_ACCOUNT_NOT_FOUND');

  const target = stored[idx];
  const prevBal = Number(target.balanceIqd ?? target.currentBalance ?? 0);
  const nextBal = Math.round((prevBal + amount) * 10000) / 10000;
  stored[idx] = {
    ...target,
    balanceIqd: nextBal,
    balanceUsd: Math.round(nextBal / 1520),
    currentBalance: nextBal
  };
  saveStoredTreasuryAccounts(stored);

  const voucherNo = `RV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const voucherDate = input.voucherDate || new Date().toISOString();
  const existingVouchers = getStoredTreasuryVouchers();
  const localRecord = {
    id: `TV-RV-${Date.now()}`,
    voucherNo,
    type: 'RECEIPT',
    transactionType: 'RECEIPT',
    cashBoxId: target.id,
    accountName: target.nameAr || target.name,
    accountCode: target.code || target.id,
    partyName: input.partyName?.trim() || '',
    amount,
    balanceAfter: nextBal,
    currency: target.currency || 'IQD',
    date: formatLatinDateTime(voucherDate, 'ar'),
    voucherDate,
    notes: [input.reference?.trim(), input.notes?.trim()].filter(Boolean).join(' — '),
    createdAt: new Date().toISOString()
  };
  saveStoredTreasuryVouchers([localRecord, ...existingVouchers]);
  notifyTreasuryUpdated();

  return {
    id: localRecord.id,
    cashBoxId: localRecord.cashBoxId,
    cashBoxName: localRecord.accountName,
    cashBoxCode: localRecord.accountCode,
    accountType: normalizeAccountType(target.accountType || target.type),
    currency: localRecord.currency,
    transactionType: 'RECEIPT',
    amount,
    balanceAfter: nextBal,
    referenceNumber: voucherNo,
    partyName: localRecord.partyName,
    voucherDate,
    notes: localRecord.notes,
    createdAt: localRecord.createdAt
  };
}

export async function createPaymentVoucher(input: CreateTreasuryVoucherInput): Promise<TreasuryVoucherRecord> {
  const amount = Math.round((Number(input.amount) || 0) * 10000) / 10000;
  if (amount <= 0) throw new Error('ERR_INVALID_AMOUNT');
  if (!input.accountId) throw new Error('ERR_TREASURY_ACCOUNT_REQUIRED');

  const token = getAuthToken();
  if (token && isUuid(input.accountId)) {
    const res = await fetch('/api/treasury/vouchers/payment', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        accountId: input.accountId,
        amount,
        partyName: input.partyName?.trim() || null,
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        voucherDate: input.voucherDate ? new Date(input.voucherDate).toISOString() : null
      })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.errorCode || 'ERR_TREASURY_VOUCHER_FAILED');
    notifyTreasuryUpdated();
    const v = json.voucher;
    return {
      id: String(v.id),
      cashBoxId: String(v.cashBoxId),
      cashBoxName: String(v.cashBoxName || ''),
      cashBoxCode: String(v.cashBoxCode || ''),
      accountType: normalizeAccountType(v.accountType),
      currency: String(v.currency || 'IQD'),
      transactionType: 'PAYMENT',
      amount: Number(v.amount),
      balanceAfter: Number(v.balanceAfter),
      referenceNumber: String(v.referenceNumber),
      partyName: String(v.partyName || ''),
      voucherDate: String(v.voucherDate),
      notes: String(v.notes || ''),
      createdAt: String(v.createdAt)
    };
  }

  // Local fallback
  const stored = getStoredTreasuryAccounts();
  const idx = stored.findIndex((a: any) => a.id === input.accountId && a.isActive !== false);
  if (idx < 0) throw new Error('ERR_TREASURY_ACCOUNT_NOT_FOUND');

  const target = stored[idx];
  const prevBal = Number(target.balanceIqd ?? target.currentBalance ?? 0);
  if (prevBal < amount) throw new Error('ERR_INSUFFICIENT_TREASURY_BALANCE');

  const nextBal = Math.round((prevBal - amount) * 10000) / 10000;
  stored[idx] = {
    ...target,
    balanceIqd: nextBal,
    balanceUsd: Math.round(nextBal / 1520),
    currentBalance: nextBal
  };
  saveStoredTreasuryAccounts(stored);

  const voucherNo = `PV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const voucherDate = input.voucherDate || new Date().toISOString();
  const existingVouchers = getStoredTreasuryVouchers();
  const localRecord = {
    id: `TV-PV-${Date.now()}`,
    voucherNo,
    type: 'PAYMENT',
    transactionType: 'PAYMENT',
    cashBoxId: target.id,
    accountName: target.nameAr || target.name,
    accountCode: target.code || target.id,
    partyName: input.partyName?.trim() || '',
    amount,
    balanceAfter: nextBal,
    currency: target.currency || 'IQD',
    date: formatLatinDateTime(voucherDate, 'ar'),
    voucherDate,
    notes: [input.reference?.trim(), input.notes?.trim()].filter(Boolean).join(' — '),
    createdAt: new Date().toISOString()
  };
  saveStoredTreasuryVouchers([localRecord, ...existingVouchers]);
  notifyTreasuryUpdated();

  return {
    id: localRecord.id,
    cashBoxId: localRecord.cashBoxId,
    cashBoxName: localRecord.accountName,
    cashBoxCode: localRecord.accountCode,
    accountType: normalizeAccountType(target.accountType || target.type),
    currency: localRecord.currency,
    transactionType: 'PAYMENT',
    amount,
    balanceAfter: nextBal,
    referenceNumber: voucherNo,
    partyName: localRecord.partyName,
    voucherDate,
    notes: localRecord.notes,
    createdAt: localRecord.createdAt
  };
}

export async function transferTreasuryFunds(input: TreasuryTransferInput): Promise<{ transferRef: string }> {
  const amount = Math.round((Number(input.amount) || 0) * 10000) / 10000;
  if (amount <= 0) throw new Error('ERR_INVALID_AMOUNT');
  if (!input.fromAccountId || !input.toAccountId) throw new Error('ERR_TREASURY_ACCOUNT_REQUIRED');
  if (input.fromAccountId === input.toAccountId) throw new Error('ERR_SAME_TREASURY_ACCOUNT');

  const token = getAuthToken();
  if (token && isUuid(input.fromAccountId) && isUuid(input.toAccountId)) {
    const res = await fetch('/api/treasury/transfers', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amount,
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        voucherDate: input.voucherDate ? new Date(input.voucherDate).toISOString() : null
      })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.errorCode || 'ERR_TREASURY_TRANSFER_FAILED');
    notifyTreasuryUpdated();
    return { transferRef: String(json.transferRef) };
  }

  // Local fallback
  const stored = getStoredTreasuryAccounts();
  const sIdx = stored.findIndex((a: any) => a.id === input.fromAccountId && a.isActive !== false);
  const dIdx = stored.findIndex((a: any) => a.id === input.toAccountId && a.isActive !== false);
  if (sIdx < 0 || dIdx < 0) throw new Error('ERR_TREASURY_ACCOUNT_NOT_FOUND');

  const sBal = Number(stored[sIdx].balanceIqd ?? stored[sIdx].currentBalance ?? 0);
  if (sBal < amount) throw new Error('ERR_INSUFFICIENT_TREASURY_BALANCE');

  const dBal = Number(stored[dIdx].balanceIqd ?? stored[dIdx].currentBalance ?? 0);
  const nextS = Math.round((sBal - amount) * 10000) / 10000;
  const nextD = Math.round((dBal + amount) * 10000) / 10000;

  stored[sIdx] = { ...stored[sIdx], balanceIqd: nextS, balanceUsd: Math.round(nextS / 1520), currentBalance: nextS };
  stored[dIdx] = { ...stored[dIdx], balanceIqd: nextD, balanceUsd: Math.round(nextD / 1520), currentBalance: nextD };
  saveStoredTreasuryAccounts(stored);

  const transferRef = `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const nowIso = input.voucherDate || new Date().toISOString();
  const existing = getStoredTreasuryVouchers();
  saveStoredTreasuryVouchers([
    {
      id: `TV-TR-IN-${Date.now()}`,
      voucherNo: transferRef,
      type: 'RECEIPT',
      transactionType: 'TRANSFER_IN',
      cashBoxId: stored[dIdx].id,
      accountName: stored[dIdx].nameAr || stored[dIdx].name,
      partyName: stored[sIdx].nameAr || stored[sIdx].name,
      amount,
      balanceAfter: nextD,
      currency: stored[dIdx].currency || 'IQD',
      date: formatLatinDateTime(nowIso, 'ar'),
      voucherDate: nowIso,
      notes: [input.reference?.trim(), input.notes?.trim()].filter(Boolean).join(' — '),
      createdAt: new Date().toISOString()
    },
    {
      id: `TV-TR-OUT-${Date.now() + 1}`,
      voucherNo: transferRef,
      type: 'PAYMENT',
      transactionType: 'TRANSFER_OUT',
      cashBoxId: stored[sIdx].id,
      accountName: stored[sIdx].nameAr || stored[sIdx].name,
      partyName: stored[dIdx].nameAr || stored[dIdx].name,
      amount,
      balanceAfter: nextS,
      currency: stored[sIdx].currency || 'IQD',
      date: formatLatinDateTime(nowIso, 'ar'),
      voucherDate: nowIso,
      notes: [input.reference?.trim(), input.notes?.trim()].filter(Boolean).join(' — '),
      createdAt: new Date().toISOString()
    },
    ...existing
  ]);
  notifyTreasuryUpdated();
  return { transferRef };
}

export async function createTreasuryAccount(input: UpsertTreasuryAccountInput): Promise<TreasuryAccountRecord> {
  if (!input.name.trim()) throw new Error('ERR_TREASURY_ACCOUNT_NAME_REQUIRED');
  const initialBalance = Math.round((Number(input.initialBalance) || 0) * 10000) / 10000;
  if (initialBalance < 0) throw new Error('ERR_INVALID_AMOUNT');

  const token = getAuthToken();
  if (token) {
    const res = await fetch('/api/treasury/accounts', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name: input.name.trim(),
        accountType: input.accountType,
        currency: input.currency || 'IQD',
        initialBalance,
        code: input.code?.trim() || null
      })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.errorCode || 'ERR_TREASURY_ACCOUNT_SAVE_FAILED');
    notifyTreasuryUpdated();
    return {
      id: String(json.id),
      code: String(json.code),
      name: String(json.name),
      accountType: normalizeAccountType(json.accountType),
      currency: String(json.currency || 'IQD'),
      currentBalance: Number(json.currentBalance) || 0,
      isActive: json.isActive !== false
    };
  }

  const stored = getStoredTreasuryAccounts();
  const prefix = input.accountType === 'BankAccount' ? 'BNK' : input.accountType === 'DigitalWallet' ? 'WAL' : 'CB';
  const code = input.code?.trim().toUpperCase() || `${prefix}-${String(stored.length + 1).padStart(2, '0')}`;
  const created = {
    id: `ACC-${Date.now().toString().slice(-6)}`,
    code,
    name: input.name.trim(),
    nameAr: input.name.trim(),
    nameEn: input.name.trim(),
    type: input.accountType === 'BankAccount' ? 'BANK' : input.accountType === 'DigitalWallet' ? 'WALLET' : 'CASH',
    accountType: input.accountType,
    balanceIqd: initialBalance,
    balanceUsd: Math.round(initialBalance / 1520),
    currentBalance: initialBalance,
    currency: input.currency || 'IQD',
    isActive: true
  };
  saveStoredTreasuryAccounts([...stored, created]);
  notifyTreasuryUpdated();

  return {
    id: created.id,
    code: created.code,
    name: created.name,
    accountType: input.accountType,
    currency: created.currency,
    currentBalance: initialBalance,
    isActive: true
  };
}

export async function updateTreasuryAccount(
  id: string,
  input: { name: string; accountType: TreasuryAccountType; currency?: string; isActive?: boolean }
): Promise<TreasuryAccountRecord> {
  if (!input.name.trim()) throw new Error('ERR_TREASURY_ACCOUNT_NAME_REQUIRED');

  const token = getAuthToken();
  if (token && isUuid(id)) {
    const res = await fetch(`/api/treasury/accounts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        name: input.name.trim(),
        accountType: input.accountType,
        currency: input.currency || 'IQD',
        isActive: input.isActive
      })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.errorCode || 'ERR_TREASURY_ACCOUNT_SAVE_FAILED');
    notifyTreasuryUpdated();
    return {
      id: String(json.id),
      code: String(json.code),
      name: String(json.name),
      accountType: normalizeAccountType(json.accountType),
      currency: String(json.currency || 'IQD'),
      currentBalance: Number(json.currentBalance) || 0,
      isActive: json.isActive !== false
    };
  }

  const stored = getStoredTreasuryAccounts();
  const idx = stored.findIndex((a: any) => a.id === id);
  if (idx < 0) throw new Error('ERR_TREASURY_ACCOUNT_NOT_FOUND');

  if (input.isActive === false && stored[idx].isActive !== false) {
    const activeCount = stored.filter((a: any) => a.isActive !== false).length;
    if (activeCount <= 1) throw new Error('ERR_LAST_ACTIVE_TREASURY_ACCOUNT');
  }

  const next = {
    ...stored[idx],
    name: input.name.trim(),
    nameAr: input.name.trim(),
    nameEn: input.name.trim(),
    accountType: input.accountType,
    type: input.accountType === 'BankAccount' ? 'BANK' : input.accountType === 'DigitalWallet' ? 'WALLET' : 'CASH',
    currency: input.currency || stored[idx].currency || 'IQD',
    isActive: input.isActive !== undefined ? input.isActive : stored[idx].isActive !== false
  };
  stored[idx] = next;
  saveStoredTreasuryAccounts(stored);
  notifyTreasuryUpdated();

  return {
    id: next.id,
    code: next.code || next.id,
    name: next.name,
    accountType: input.accountType,
    currency: next.currency,
    currentBalance: Number(next.balanceIqd ?? next.currentBalance ?? 0),
    isActive: next.isActive
  };
}

export async function toggleTreasuryAccountActive(id: string): Promise<void> {
  const token = getAuthToken();
  if (token && isUuid(id)) {
    const res = await fetch(`/api/treasury/accounts/${encodeURIComponent(id)}/toggle`, {
      method: 'PATCH',
      headers: authHeaders()
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.errorCode || 'ERR_TREASURY_ACCOUNT_SAVE_FAILED');
    notifyTreasuryUpdated();
    return;
  }

  const stored = getStoredTreasuryAccounts();
  const idx = stored.findIndex((a: any) => a.id === id);
  if (idx < 0) throw new Error('ERR_TREASURY_ACCOUNT_NOT_FOUND');

  const currentlyActive = stored[idx].isActive !== false;
  if (currentlyActive) {
    const activeCount = stored.filter((a: any) => a.isActive !== false).length;
    if (activeCount <= 1) throw new Error('ERR_LAST_ACTIVE_TREASURY_ACCOUNT');
  }

  stored[idx] = { ...stored[idx], isActive: !currentlyActive };
  saveStoredTreasuryAccounts(stored);
  notifyTreasuryUpdated();
}
