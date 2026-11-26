import {
  KEYS,
  getStoredSuppliers,
  saveStoredSuppliers,
  createSupplier,
  getStoredPurchaseInvoices,
  saveStoredPurchaseInvoices,
  getStoredTreasuryAccounts,
  getStoredTreasuryVouchers,
  saveStoredTreasuryVouchers,
  recordTreasuryOutflow,
  executePurchaseInvoiceTransaction,
  cancelLocalPurchaseInvoice,
  PurchaseInvoiceTransactionResult,
  StoredSupplier,
  safeGet,
  safeSet
} from './storageService';
import {
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchasePaymentTerm,
  PurchasePaymentType
} from '../types/purchases';
import { getTranslation } from '../lib/i18n';

export interface TreasuryCashBoxOption {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  currency: string;
  currentBalance: number;
  isPrimary: boolean;
}

export interface TreasuryTransactionRecord {
  id: string;
  cashBoxId: string;
  cashBoxName: string;
  cashBoxCode: string;
  currency: string;
  expenseVoucherId?: string | null;
  purchaseBillId?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  referenceNumber?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface SupplierDirectoryRecord {
  id: string;
  code: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  currentBalance: number;
  country?: string;
  category?: string;
  rating?: number;
  activePOs?: number;
  createdAt?: string;
}

export interface SupplierLedgerEntryRecord {
  id: string;
  supplierId: string;
  transactionType: string;
  referenceId?: string | null;
  referenceNumber: string;
  debit: number;
  credit: number;
  runningBalance: number;
  notes?: string | null;
  createdAt: string;
}

export interface CreatePurchaseBillApiInput {
  supplierId?: string | null;
  newSupplierName?: string | null;
  newSupplierPhone?: string | null;
  supplierRefNo: string;
  invoiceDate: string;
  targetWarehouseId: string;
  warehouseName: string;
  paymentType: PurchasePaymentType;
  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  netTotal: number;
  paidAmount: number;
  remainingAmount: number;
  cashAccountId?: string | null;
  cashAccountName?: string | null;
  notes?: string | null;
  currency?: string | null;
  items: PurchaseInvoiceItem[];
  localFallbackInvoice: PurchaseInvoice;
}

const LOCAL_SUPPLIER_LEDGERS_KEY = 'zilox_supplier_ledgers_v1';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('zilox_auth_token') ||
    localStorage.getItem('logistock_erp_jwt_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('zilox_token')
  );
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function isUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));
}

export function normalizePaymentTerm(raw?: string | null): PurchasePaymentTerm {
  const up = (raw || 'CASH').toUpperCase();
  if (up === 'CREDIT') return 'credit';
  if (up === 'PARTIAL') return 'partial';
  return 'cash';
}

export function normalizePaymentType(raw?: string | null): PurchasePaymentType {
  const up = (raw || 'CASH').toUpperCase();
  if (up === 'CREDIT') return 'Credit';
  if (up === 'PARTIAL') return 'Partial';
  return 'Cash';
}

export function formatPurchaseErrorMessage(err: any, lang: string): string {
  const rawCode = String(err?.errorCode || err?.message || 'ERR_PURCHASE_POST_FAILED').trim();
  const candidates = [
    `errors.ERR.PURCHASES.${rawCode}`,
    `errors.ERR.EXPENSES.${rawCode}`,
    `errors.ERR.RECURRING.${rawCode}`,
    `errors.ERR.INVENTORY.${rawCode}`,
    `errors.ERR.SALES.${rawCode}`,
    `ui.purchaseOcr.errors.${rawCode}`
  ];
  for (const key of candidates) {
    const translated = getTranslation(lang, key, '');
    if (translated) return translated;
  }
  return rawCode;
}

function mapLocalStoredAccounts(): TreasuryCashBoxOption[] {
  const local = getStoredTreasuryAccounts().filter((acc: any) => acc && acc.isActive !== false);
  return local.map((acc: any, idx: number) => ({
    id: acc.id,
    code: acc.code || acc.id || `ACC-0${idx + 1}`,
    name: acc.nameAr || acc.name || 'صندوق الكاش الرئيسي',
    nameAr: acc.nameAr || acc.name,
    nameEn: acc.nameEn || acc.name,
    currency: acc.currency || 'IQD',
    currentBalance: Number(acc.balanceIqd ?? acc.currentBalance ?? acc.balanceUsd ?? 0),
    isPrimary: acc.id === 'ACC-01' || acc.code === 'CB-01' || acc.type === 'CASH' || idx === 0
  }));
}

export async function fetchTreasuryAccounts(): Promise<TreasuryCashBoxOption[]> {
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/finance/treasury-accounts', {
        headers: authHeaders()
      });
      if (res.ok) {
        const rows = await res.json().catch(() => null);
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((row: any, idx: number) => ({
            id: String(row.id),
            code: String(row.code || `CB-0${idx + 1}`),
            name: String(row.name || ''),
            currency: String(row.currency || 'IQD'),
            currentBalance: Number(row.currentBalance) || 0,
            isPrimary:
              String(row.code || '').toUpperCase() === 'CB-01' ||
              String(row.code || '').toUpperCase() === 'ACC-01' ||
              String(row.name || '').includes('الرئيسي') ||
              idx === 0
          }));
        }
      }
    } catch {
      // Fallback to local treasury accounts
    }
  }
  return mapLocalStoredAccounts();
}

export async function fetchTreasuryTransactions(): Promise<TreasuryTransactionRecord[]> {
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/finance/treasury-transactions', {
        headers: authHeaders()
      });
      if (res.ok) {
        const rows = await res.json().catch(() => null);
        if (Array.isArray(rows)) {
          return rows.map((tx: any) => ({
            id: String(tx.id),
            cashBoxId: String(tx.cashBoxId),
            cashBoxName: String(tx.cashBoxName || ''),
            cashBoxCode: String(tx.cashBoxCode || ''),
            currency: String(tx.currency || 'IQD'),
            expenseVoucherId: tx.expenseVoucherId ?? null,
            purchaseBillId: tx.purchaseBillId ?? null,
            supplierId: tx.supplierId ?? null,
            supplierName: tx.supplierName ?? null,
            transactionType: String(tx.transactionType || 'PAYMENT'),
            amount: Number(tx.amount) || 0,
            balanceAfter: Number(tx.balanceAfter) || 0,
            referenceNumber: tx.referenceNumber ?? null,
            notes: tx.notes ?? null,
            createdBy: tx.createdBy ?? null,
            createdAt: String(tx.createdAt || new Date().toISOString())
          }));
        }
      }
    } catch {
      // Fallback
    }
  }
  return [];
}

export async function fetchPurchaseBills(): Promise<PurchaseInvoice[]> {
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/purchases', {
        headers: authHeaders()
      });
      if (res.ok) {
        const rows = await res.json().catch(() => null);
        if (Array.isArray(rows)) {
          return rows.map((b: any) => {
            const pType = normalizePaymentType(b.paymentType || b.paymentTerms);
            const pTerms = normalizePaymentTerm(b.paymentType || b.paymentTerms);
            const items: PurchaseInvoiceItem[] = Array.isArray(b.items)
              ? b.items.map((it: any) => ({
                  id: String(it.id),
                  productId: it.productId ? String(it.productId) : undefined,
                  sku: String(it.itemSku || ''),
                  barcode: String(it.itemBarcode || ''),
                  nameAr: String(it.itemName || ''),
                  nameEn: String(it.itemName || ''),
                  uom: String(it.unitOfMeasure || 'قطعة'),
                  quantity: Number(it.quantity) || 0,
                  unitCost: Number(it.unitCost) || 0,
                  currentSellingPrice: Number(it.sellingPrice) || 0,
                  newSellingPrice: Number(it.sellingPrice) || 0,
                  lineTotal: Number(it.lineTotal) || 0,
                  isNewProduct: Boolean(it.isNewlyCreatedProduct)
                }))
              : [];
            return {
              id: String(b.id),
              billNumber: String(b.billNumber),
              supplierId: String(b.supplierId),
              supplierName: String(b.supplierName || ''),
              supplierRefNo: String(b.supplierRefNo || ''),
              invoiceDate: String(b.invoiceDate || '').slice(0, 10),
              warehouseId: String(b.targetWarehouseId || ''),
              warehouseName: String(b.targetWarehouseName || ''),
              paymentTerms: pTerms,
              paymentType: pType,
              items,
              itemsCount: Number(b.totalQuantity ?? b.itemsCount ?? items.length) || 0,
              subtotal: Number(b.subtotal) || 0,
              discount: Number(b.discountAmount) || 0,
              shippingCost: Number(b.shippingCost) || 0,
              netTotal: Number(b.netTotal) || 0,
              amountPaid: Number(b.paidAmount) || 0,
              balanceDue: Number(b.remainingAmount ?? b.balanceDue) || 0,
              remainingAmount: Number(b.remainingAmount ?? b.balanceDue) || 0,
              cashAccountId: b.cashAccountId ? String(b.cashAccountId) : (b.treasuryAccountId || null),
              cashAccountName: b.cashAccountName ?? null,
              cashAccountCode: b.cashAccountCode ?? null,
              paidFromAccount: b.cashAccountName || b.treasuryAccountId || undefined,
              status: String(b.billStatus || 'POSTED').toUpperCase() === 'CANCELLED' ? 'CANCELLED' : 'POSTED',
              cancelledAt: b.cancelledAt ?? null,
              cancelReason: b.cancelReason ?? null,
              createdAt: String(b.createdAt || new Date().toISOString()),
              notes: b.notes ?? undefined
            };
          });
        }
      }
    } catch {
      // Fallback
    }
  }
  return getStoredPurchaseInvoices();
}

export async function createPurchaseBill(
  input: CreatePurchaseBillApiInput
): Promise<PurchaseInvoiceTransactionResult> {
  const token = getAuthToken();
  const canCallApi = Boolean(token && isUuid(input.targetWarehouseId));

  if (canCallApi) {
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        supplierId: input.supplierId && isUuid(input.supplierId) ? input.supplierId : null,
        newSupplierName: (!input.supplierId || !isUuid(input.supplierId)) ? (input.newSupplierName || input.localFallbackInvoice.supplierName) : null,
        newSupplierPhone: input.newSupplierPhone || null,
        supplierRefNo: input.supplierRefNo.trim(),
        invoiceDate: input.invoiceDate,
        targetWarehouseId: input.targetWarehouseId,
        paymentType: input.paymentType,
        paymentTerms: input.paymentType.toUpperCase(),
        currency: input.currency || null,
        subtotal: input.subtotal,
        discountAmount: input.discountAmount,
        shippingCost: input.shippingCost,
        netTotal: input.netTotal,
        paidAmount: input.paidAmount,
        remainingAmount: input.remainingAmount,
        balanceDue: input.remainingAmount,
        cashAccountId: input.cashAccountId && isUuid(input.cashAccountId) ? input.cashAccountId : null,
        treasuryAccountId: input.cashAccountId || null,
        notes: input.notes || null,
        items: input.items.map(it => ({
          productId: it.productId && isUuid(it.productId) ? it.productId : null,
          sku: it.sku,
          barcode: it.barcode,
          name: it.nameAr || it.nameEn,
          unitOfMeasure: it.uom,
          quantity: it.quantity,
          unitCost: it.unitCost,
          sellingPrice: it.newSellingPrice || it.currentSellingPrice || 0,
          lineTotal: it.lineTotal,
          isNewProduct: Boolean(it.isNewProduct),
          serialNumbers: it.serialNumbers && it.serialNumbers.length > 0 ? it.serialNumbers : null,
          requiresSerialTracking: it.requiresSerialNumber ?? null,
          warrantyMonths: it.warrantyMonths ?? null
        }))
      })
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.errorCode || 'ERR_PURCHASE_POST_FAILED');
    }

    const syncedInvoice: PurchaseInvoice = {
      ...input.localFallbackInvoice,
      id: String(json?.billId || input.localFallbackInvoice.id),
      billNumber: String(json?.billNumber || input.localFallbackInvoice.billNumber),
      paymentType: normalizePaymentType(json?.paymentType || input.paymentType),
      paymentTerms: normalizePaymentTerm(json?.paymentType || input.paymentType),
      amountPaid: Number(json?.paidAmount ?? input.paidAmount),
      balanceDue: Number(json?.remainingAmount ?? json?.balanceDue ?? input.remainingAmount),
      remainingAmount: Number(json?.remainingAmount ?? json?.balanceDue ?? input.remainingAmount),
      cashAccountId: json?.cashAccountId ? String(json.cashAccountId) : (input.cashAccountId || null),
      cashAccountName: json?.cashAccountName ?? input.cashAccountName ?? null,
      status: 'POSTED'
    };

    const result = executePurchaseInvoiceTransaction(syncedInvoice, { skipTreasuryDeduction: true });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp_purchases_updated'));
      window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
    }
    return result;
  }

  const localResult = executePurchaseInvoiceTransaction(input.localFallbackInvoice);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erp_purchases_updated'));
    window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
  }
  return localResult;
}

export async function cancelPurchaseBill(billId: string, reason?: string): Promise<void> {
  const token = getAuthToken();
  if (token && isUuid(billId)) {
    const res = await fetch(`/api/purchases/${encodeURIComponent(billId)}/cancel`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason: reason?.trim() || null })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.errorCode || 'ERR_PURCHASE_CANCEL_FAILED');
    }
    const existing = getStoredPurchaseInvoices();
    if (existing.some(inv => inv.id === billId)) {
      saveStoredPurchaseInvoices(
        existing.map(inv =>
          inv.id === billId
            ? { ...inv, status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelReason: reason?.trim() || null }
            : inv
        )
      );
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp_purchases_updated'));
      window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
    }
    return;
  }

  cancelLocalPurchaseInvoice(billId, reason);
}

export async function fetchSuppliers(): Promise<SupplierDirectoryRecord[]> {
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/suppliers', {
        headers: authHeaders()
      });
      if (res.ok) {
        const rows = await res.json().catch(() => null);
        if (Array.isArray(rows)) {
          return rows.map((s: any) => ({
            id: String(s.id),
            code: String(s.code || ''),
            companyName: String(s.companyName || ''),
            contactPerson: String(s.contactPerson || s.companyName || ''),
            phone: String(s.phone || ''),
            email: String(s.email || ''),
            currentBalance: Number(s.currentBalance) || 0,
            createdAt: s.createdAt
          }));
        }
      }
    } catch {
      // Fallback
    }
  }

  return getStoredSuppliers().map((s: StoredSupplier) => ({
    id: s.id,
    code: s.id,
    companyName: s.company,
    contactPerson: s.contact,
    phone: s.phone,
    email: s.email,
    currentBalance: Number(s.currentBalance) || 0,
    country: s.country,
    category: s.category,
    rating: s.rating,
    activePOs: s.activePOs
  }));
}

export async function createSupplierRemote(payload: {
  companyName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  country?: string;
  category?: string;
  rating?: number;
}): Promise<SupplierDirectoryRecord> {
  const token = getAuthToken();
  if (token) {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        companyName: payload.companyName.trim(),
        contactPerson: payload.contactPerson?.trim() || null,
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null
      })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.errorCode || 'ERR_SUPPLIER_NAME_REQUIRED');
    }
    return {
      id: String(json.id),
      code: String(json.code || ''),
      companyName: String(json.companyName || payload.companyName),
      contactPerson: String(json.contactPerson || payload.companyName),
      phone: String(json.phone || ''),
      email: String(json.email || ''),
      currentBalance: Number(json.currentBalance) || 0,
      createdAt: json.createdAt
    };
  }

  const created = createSupplier({
    company: payload.companyName.trim(),
    contact: payload.contactPerson?.trim() || payload.companyName.trim(),
    phone: payload.phone?.trim() || '',
    email: payload.email?.trim() || '',
    country: payload.country || '',
    category: payload.category || '',
    rating: payload.rating || 5.0
  });
  return {
    id: created.id,
    code: created.id,
    companyName: created.company,
    contactPerson: created.contact,
    phone: created.phone,
    email: created.email,
    currentBalance: 0
  };
}

export async function fetchSupplierLedger(supplierId: string): Promise<SupplierLedgerEntryRecord[]> {
  const token = getAuthToken();
  if (token && isUuid(supplierId)) {
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/ledger`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const rows = await res.json().catch(() => null);
        if (Array.isArray(rows)) {
          return rows.map((l: any) => ({
            id: String(l.id),
            supplierId: String(l.supplierId),
            transactionType: String(l.transactionType || 'PURCHASE_BILL'),
            referenceId: l.referenceId ?? null,
            referenceNumber: String(l.referenceNumber || ''),
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            runningBalance: Number(l.runningBalance) || 0,
            notes: l.notes ?? null,
            createdAt: String(l.createdAt || new Date().toISOString())
          }));
        }
      }
    } catch {
      // Fallback
    }
  }
  const localLedgers = safeGet<SupplierLedgerEntryRecord[]>(LOCAL_SUPPLIER_LEDGERS_KEY, []);
  return localLedgers.filter(l => l.supplierId === supplierId);
}

export async function settleSupplierDebt(
  supplierId: string,
  payload: { amount: number; cashAccountId: string; referenceNumber?: string; notes?: string }
): Promise<{
  voucherNumber: string;
  supplierNewBalance: number;
  cashAccountNewBalance?: number;
}> {
  const amount = Math.round((Number(payload.amount) || 0) * 10000) / 10000;
  if (amount <= 0) throw new Error('ERR_INVALID_PAYMENT_AMOUNT');
  if (!payload.cashAccountId) throw new Error('ERR_TREASURY_ACCOUNT_REQUIRED');

  const token = getAuthToken();
  if (token && isUuid(supplierId)) {
    const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/payments`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        amount,
        cashAccountId: payload.cashAccountId,
        referenceNumber: payload.referenceNumber?.trim() || null,
        notes: payload.notes?.trim() || null
      })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.errorCode || 'ERR_SUPPLIER_PAYMENT_FAILED');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
    }
    return {
      voucherNumber: String(json.voucherNumber),
      supplierNewBalance: Number(json.supplierNewBalance) || 0,
      cashAccountNewBalance: json.cashAccountNewBalance !== undefined ? Number(json.cashAccountNewBalance) : undefined
    };
  }

  // Local fallback mode
  const suppliers = getStoredSuppliers();
  const sIdx = suppliers.findIndex(s => s.id === supplierId);
  if (sIdx < 0) throw new Error('ERR_SUPPLIER_NOT_FOUND');

  const currentSupplierBal = Number(suppliers[sIdx].currentBalance || 0);
  if (amount > currentSupplierBal) throw new Error('ERR_PAYMENT_EXCEEDS_SUPPLIER_BALANCE');

  const accounts = getStoredTreasuryAccounts();
  const cashAcc = accounts.find(a => a.id === payload.cashAccountId);
  if (!cashAcc) throw new Error('ERR_TREASURY_ACCOUNT_NOT_FOUND');

  const available = Number(cashAcc.balanceIqd ?? cashAcc.balanceUsd ?? 0);
  if (available < amount) throw new Error('ERR_INSUFFICIENT_TREASURY_BALANCE');

  recordTreasuryOutflow('CASH', amount, cashAcc.id);
  const nextSupplierBal = Math.max(0, Math.round((currentSupplierBal - amount) * 10000) / 10000);
  suppliers[sIdx].currentBalance = nextSupplierBal;
  saveStoredSuppliers(suppliers);

  const voucherNo = payload.referenceNumber?.trim() || `SUP-PAY-${Date.now().toString().slice(-6)}`;
  const existingVouchers = getStoredTreasuryVouchers();
  saveStoredTreasuryVouchers([
    {
      id: `TV-SUP-${Date.now()}`,
      voucherNo,
      type: 'PAYMENT',
      partyName: suppliers[sIdx].company,
      amount,
      currency: 'IQD',
      accountName: cashAcc.nameAr || cashAcc.name || cashAcc.id,
      date: new Date().toLocaleString(),
      notes: payload.notes?.trim() || `${voucherNo} - ${suppliers[sIdx].company}`
    },
    ...existingVouchers
  ]);

  const localLedgers = safeGet<SupplierLedgerEntryRecord[]>(LOCAL_SUPPLIER_LEDGERS_KEY, []);
  safeSet(LOCAL_SUPPLIER_LEDGERS_KEY, [
    {
      id: `SL-${Date.now()}`,
      supplierId,
      transactionType: 'PAYMENT_VOUCHER',
      referenceNumber: voucherNo,
      debit: amount,
      credit: 0,
      runningBalance: nextSupplierBal,
      notes: payload.notes?.trim() || voucherNo,
      createdAt: new Date().toISOString()
    },
    ...localLedgers
  ]);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
  }

  return {
    voucherNumber: voucherNo,
    supplierNewBalance: nextSupplierBal,
    cashAccountNewBalance: Math.max(0, available - amount)
  };
}
