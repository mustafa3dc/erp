import { Product, SalesInvoice, Warehouse, WarehouseDispatchOrder, DispenseMode, InstallmentContract, InstallmentScheduleItem, InstallmentStats, InstallmentStatus, InstallmentScheduleStatus } from '../types/warehouse';
import { TransactionDetail } from '../components/TransactionModal';
import { localizeCategory, localizeUnit, localizeWarehouse } from '../lib/localeHelpers';
import { parseDateSafely } from '../utils/dateFormatter';
import { formatLatinDateTime, formatLatinNumber, formatLatinTime } from '../lib/formatters';
import { UserAccount, DEFAULT_USER_ACCOUNTS, UserProfile, UserRole } from '../types/rbac';
import { PurchaseInvoice, PurchaseInvoiceItem, PurchaseJournalEntry } from '../types/purchases';
import { 
  ExpenseCategory, 
  ExpenseVoucher, 
  SalesQuotation, 
  PriceList, 
  ProductBundleItem,
  ProductQuantityTier,
  PurchaseReturn, 
  ProductSerial 
} from '../types/businessModules';

export const initialProducts: Product[] = [];
export const initialWarehouses: Warehouse[] = [];
export const initialSalesInvoices: SalesInvoice[] = [];

// LocalStorage Keys with Multi-Tenant Isolation
export function getActiveTenantSlug(): string {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('logistock_erp_v3_auth_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.tenantSlug) return parsed.tenantSlug.toLowerCase().trim();
        if (parsed?.role === 'PlatformSuperAdmin') return 'platform';
      }
    }
  } catch {
    // fallback
  }
  return 'default';
}

export function getScopedKey(baseName: string, explicitTenantSlug?: string): string {
  if (baseName === 'lang' || baseName === 'auth_session' || baseName === 'users') {
    return `logistock_erp_v3_${baseName}`;
  }
  const slug = (explicitTenantSlug || getActiveTenantSlug() || 'default').toLowerCase().trim();
  return `zilox_tenant_${slug}_${baseName}`;
}

export const KEYS = {
  get PRODUCTS() { return getScopedKey('products'); },
  get INVOICES() { return getScopedKey('invoices'); },
  get PURCHASE_INVOICES() { return getScopedKey('purchase_invoices'); },
  get TRANSACTIONS() { return getScopedKey('transactions'); },
  get WAREHOUSES() { return getScopedKey('warehouses'); },
  get INBOUND() { return getScopedKey('inbound_shipments'); },
  get OUTBOUND() { return getScopedKey('outbound_orders'); },
  get STOCK_COUNTS() { return getScopedKey('stock_counts'); },
  get SUPPLIERS() { return getScopedKey('suppliers'); },
  get LANG() { return 'logistock_erp_v3_lang'; },
  get SELECTED_WAREHOUSE() { return getScopedKey('selected_warehouse'); },
  get USERS() { return 'logistock_erp_v3_users'; },
  get AUTH_SESSION() { return 'logistock_erp_v3_auth_session'; },
  get ACTIVE_SHIFT() { return getScopedKey('active_shift'); },
  get SHIFTS_HISTORY() { return getScopedKey('shifts_history'); },
  get POS_LAST_TERMINAL() { return getScopedKey('pos_last_terminal'); },
  get TREASURY_ACCOUNTS() { return getScopedKey('treasury_accounts'); },
  get TREASURY_VOUCHERS() { return getScopedKey('treasury_vouchers'); },
  get CUSTOMERS() { return getScopedKey('customers_list'); },
  get RMA() { return getScopedKey('rma_list'); },
  get DELIVERIES() { return getScopedKey('deliveries_list'); },
  get TRANSFERS() { return getScopedKey('transfers_list'); },
  get PO_LIST() { return getScopedKey('po_list'); },
  get CATEGORIES() { return getScopedKey('categories'); },
  get DISPATCH_ORDERS() { return getScopedKey('dispatch_orders'); },
  get STOCK_ADJUSTMENTS() { return getScopedKey('stock_adjustments'); },
  get EMPLOYEE_TRANSACTIONS() { return getScopedKey('employee_transactions'); },
  get INSTALLMENT_CONTRACTS() { return getScopedKey('installment_contracts'); },
  get EXPENSE_CATEGORIES() { return getScopedKey('expense_categories'); },
  get EXPENSE_VOUCHERS() { return getScopedKey('expense_vouchers'); },
  get SALES_QUOTATIONS() { return getScopedKey('sales_quotations'); },
  get PRICE_LISTS() { return getScopedKey('price_lists'); },
  get PRODUCT_QUANTITY_TIERS() { return getScopedKey('product_quantity_tiers'); },
  get PRODUCT_BUNDLES() { return getScopedKey('product_bundles'); },
  get PURCHASE_RETURNS() { return getScopedKey('purchase_returns'); },
  get PRODUCT_SERIALS() { return getScopedKey('product_serials'); },
  get LOYALTY_SETTINGS() { return getScopedKey('loyalty_settings'); },
  get LOYALTY_TRANSACTIONS() { return getScopedKey('loyalty_transactions'); },
  get LOYALTY_REWARDS() { return getScopedKey('loyalty_rewards'); },
  get LOYALTY_VOUCHERS() { return getScopedKey('loyalty_vouchers'); },
  get PARTNERS() { return getScopedKey('partners'); },
  get PARTNER_TRANSACTIONS() { return getScopedKey('partner_transactions'); },
  get RECURRING_EXPENSES() { return getScopedKey('recurring_expenses'); },
};


export const defaultFullInvoices: SalesInvoice[] = [];
export const initialTransactions: TransactionDetail[] = [];
export const initialInboundShipments: any[] = [];
export const initialOutboundOrders: any[] = [];
export const initialStockCountItems: any[] = [];


// Helper to safely read from localStorage
export function safeGet<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return defaultValue;
  }
}

// Helper to safely write to localStorage
export function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to localStorage:`, err);
  }
}

// --- PRODUCTS ---
export function getStoredProducts(): Product[] {
  const warehouses = getStoredWarehouses();
  const existing = safeGet<Product[] | null>(KEYS.PRODUCTS, null);

  if (existing !== null && Array.isArray(existing)) {
    let hasRepairedWarehouse = false;
    const seenIds = new Set<string>();
    const mapped = existing.map((p, idx) => {
      let resolvedId = p.id ? String(p.id).trim() : '';
      if (!resolvedId || seenIds.has(resolvedId)) {
        resolvedId = `PRD-${Date.now()}-${idx}-${Math.floor(1000 + Math.random() * 9000)}`;
        hasRepairedWarehouse = true;
      }
      seenIds.add(resolvedId);

      // Virtual bundles are warehouse-agnostic and derive stock dynamically from their components
      if (p.isBundle) {
        return {
          ...p,
          id: resolvedId,
          warehouseId: 'ALL',
          warehouseName: p.warehouseName || 'حزمة مركبة (افتراضي)',
          warehouseNameEn: p.warehouseNameEn || 'Virtual Bundle',
          minSellingPrice: p.minSellingPrice ?? 0,
          currentStock: 0,
          unit: p.unit || 'حزمة',
          unitEn: p.unitEn || 'Bundle',
          category: p.category || 'حزم المنتجات',
          categoryEn: p.categoryEn || 'Product Bundles'
        };
      }

      let targetWhId = p.warehouseId || warehouses[0]?.id || 'WH-01';
      let matchedWh = warehouses.find(w => w.id === targetWhId || w.code === targetWhId);

      // Self-healing guard: if product's warehouse was deleted or missing, reassign to primary active warehouse
      if (!matchedWh && warehouses.length > 0) {
        targetWhId = warehouses[0].id;
        matchedWh = warehouses[0];
        hasRepairedWarehouse = true;
      }

      const resolvedWarehouseName = matchedWh ? matchedWh.nameAr : (p.warehouseName || 'المستودع الرئيسي');
      const resolvedWarehouseNameEn = matchedWh ? (matchedWh.nameEn || matchedWh.nameAr) : (p.warehouseNameEn || 'Main Warehouse');

      return {
        ...p,
        id: resolvedId,
        warehouseId: targetWhId,
        warehouseName: resolvedWarehouseName,
        warehouseNameEn: resolvedWarehouseNameEn,
        minSellingPrice: p.minSellingPrice || Math.round(p.sellingPrice * 0.88),
        unit: localizeUnit(p.unit, 'ar'),
        unitEn: p.unitEn || localizeUnit(p.unit, 'en'),
        category: localizeCategory(p.category, 'ar'),
        categoryEn: p.categoryEn || localizeCategory(p.category, 'en')
      };
    });

    if (hasRepairedWarehouse) {
      safeSet(KEYS.PRODUCTS, mapped);
    }

    return mapped;
  }

  safeSet(KEYS.PRODUCTS, []);
  return [];
}

export function saveStoredProducts(products: Product[]): void {
  safeSet(KEYS.PRODUCTS, products);
}

// --- CATEGORIES ---
export interface StoredCategory {
  id: string;
  name: string;
  code?: string;
  description?: string;
  nameAr?: string;
  nameEn?: string;
}

export function getStoredCategories(tenantSlug?: string): StoredCategory[] {
  const existing = safeGet<StoredCategory[] | null>(getScopedKey('categories', tenantSlug), null);
  if (existing !== null && Array.isArray(existing) && existing.length > 0) {
    return existing;
  }

  // Dynamically extract real categories from existing tenant products
  const products = getStoredProducts();
  const distinctNames = Array.from(new Set(products.map(p => p.category?.trim()).filter(Boolean))) as string[];

  if (distinctNames.length > 0) {
    return distinctNames.map((name, index) => ({
      id: `CAT-${index + 1}`,
      name,
      code: `CAT-${index + 1}`
    }));
  }

  // Strict Zero-Mock: return empty array if tenant has no categories yet
  return [];
}

export function saveStoredCategories(categories: StoredCategory[], tenantSlug?: string): void {
  safeSet(getScopedKey('categories', tenantSlug), categories);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erp_categories_updated'));
  }
}

// --- INVOICES ---
export function getStoredInvoices(): SalesInvoice[] {
  const existing = safeGet<SalesInvoice[] | null>(KEYS.INVOICES, null);
  if (existing !== null && Array.isArray(existing)) {
    // Sanitize any existing invoices to prevent discount > subtotal anomalies
    return existing.map(inv => {
      const sub = Number(inv.subtotal || 0);
      const rawDisc = Number(inv.discount || 0);
      if (rawDisc > sub) {
        const safeDisc = sub * 0.05; // clamp to standard 5% max if corrupted
        const taxable = Math.max(0, sub - safeDisc);
        const tax = Number(inv.tax || 0);
        return {
          ...inv,
          discount: safeDisc,
          total: taxable + tax
        };
      }
      return inv;
    });
  }
  safeSet(KEYS.INVOICES, []);
  return [];
}

export function saveStoredInvoices(invoices: SalesInvoice[]): void {
  // Ensure we never write corrupted discount invoices to disk/storage
  const sanitized = invoices.map(inv => {
    const sub = Number(inv.subtotal || 0);
    const rawDisc = Number(inv.discount || 0);
    if (rawDisc > sub) {
      const safeDisc = Math.min(rawDisc, sub);
      const taxable = Math.max(0, sub - safeDisc);
      const tax = Number(inv.tax || 0);
      return {
        ...inv,
        discount: safeDisc,
        total: taxable + tax
      };
    }
    return inv;
  });
  safeSet(KEYS.INVOICES, sanitized);
}

// --- WAREHOUSE DISPATCH ORDERS QUEUE ---
export function getStoredDispatchOrders(): WarehouseDispatchOrder[] {
  const existing = safeGet<WarehouseDispatchOrder[] | null>(KEYS.DISPATCH_ORDERS, null);
  if (existing !== null && Array.isArray(existing)) {
    return existing;
  }
  safeSet(KEYS.DISPATCH_ORDERS, []);
  return [];
}

export function saveStoredDispatchOrders(orders: WarehouseDispatchOrder[]): void {
  safeSet(KEYS.DISPATCH_ORDERS, orders);
}

// --- TRANSACTIONS ---
export function getNextTransactionId(offset: number = 0): string {
  const existing = safeGet<TransactionDetail[] | null>(KEYS.TRANSACTIONS, null) || [];
  let maxSeq = 0;
  for (const tx of existing) {
    const match = (tx.id || '').match(/TRX-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  const nextSeq = maxSeq + 1 + offset;
  return `TRX-${String(nextSeq).padStart(4, '0')}`;
}

export function getStoredTransactions(): TransactionDetail[] {
  const existing = safeGet<TransactionDetail[] | null>(KEYS.TRANSACTIONS, null);
  if (existing !== null && Array.isArray(existing)) {
    const products = safeGet<Product[] | null>(KEYS.PRODUCTS, null) || [];
    const invoices = safeGet<SalesInvoice[] | null>(KEYS.INVOICES, null) || [];
    let hasChanges = false;
    const total = existing.length;

    const sanitized = existing.map((t, idx) => {
      // Preserve genuine persisted IDs (MOV-..., ADJ-..., TRX-...) without fabricating sequential #TRX-0001 overrides
      const id = ((t as any).movementNumber || t.id || '').trim() || `MOV-${Date.now()}-${idx}`;
      if (id !== t.id) {
        hasChanges = true;
      }

      let normType = t.type;
      if (normType === 'Received' || normType === 'Active') normType = 'Inbound';
      let normStatus = t.status;
      if (normStatus === 'Active' || normStatus === 'In Transit') normStatus = 'Received';
      if (normType === 'Outbound' && (normStatus === 'Received' || !normStatus)) {
        normStatus = 'Dispatched';
        hasChanges = true;
      }

      // Fix product name if it was erroneously set to a customer name or generic invoice label
      let productName = t.productName;
      const lowerProd = (productName || '').toLowerCase();
      if (
        !productName ||
        productName === 'Walk-in Cash Customer' ||
        productName === 'عميل نقدي عام' ||
        productName === 'عميل نقدي' ||
        productName === 'فاتورة مبيعات' ||
        productName === 'Sales Invoice' ||
        lowerProd.includes('walk-in') ||
        lowerProd.includes('customer') ||
        lowerProd.includes('invoice') ||
        lowerProd.includes('فاتورة')
      ) {
        const foundProd = products.find(p => p.sku === t.sku || p.id === t.sku);
        if (foundProd) {
          productName = foundProd.nameAr;
          hasChanges = true;
        }
      }

      let qty = Number(t.qty) || 0;
      if (normType === 'Outbound' && qty > 0) {
        qty = -Math.abs(qty);
        hasChanges = true;
      } else if (normType === 'Inbound' && qty < 0) {
        qty = Math.abs(qty);
        hasChanges = true;
      }

      let unit = localizeUnit(t.unit || 'قطعة', 'ar');
      if (unit === 'طرد' || unit === 'طرد مبيعات' || unit === 'Order Pkg') {
        const foundProd = products.find(p => p.sku === t.sku || p.id === t.sku);
        if (foundProd?.unit) {
          unit = localizeUnit(foundProd.unit, 'ar');
          hasChanges = true;
        } else {
          unit = 'قطعة';
          hasChanges = true;
        }
      }

      const fromLocation = t.fromLocation || (normType === 'Inbound' ? 'مورد معتمد' : t.location);
      const toLocation = t.toLocation || (normType === 'Outbound' ? 'مبيعات وشحن' : t.location);

      let operator = t.operator;
      if (operator === 'Mustafa Operations' || !operator) {
        const session = getStoredAuthSession();
        const matchedInv = invoices.find(inv => inv.invoiceNo === t.referenceNo);
        if (matchedInv?.operator && matchedInv.operator !== 'Mustafa Operations') {
          operator = matchedInv.operator;
          hasChanges = true;
        } else if (session?.fullName || session?.username) {
          operator = session.fullName || session.username;
          hasChanges = true;
        }
      }

      // Strictly preserve real timestamps — NEVER stagger/subtract days (AddDays(-i))
      let timestamp = t.timestamp;
      let movementDate = t.movementDate;
      let createdAt = t.createdAt;
      let date = t.date;

      const rawToParse = movementDate || createdAt || date || timestamp;
      const parsed = parseDateSafely(rawToParse);

      // Heal transactions whose timestamp was corrupted by the old synthetic daysAgo distributor
      const seqNum = total - idx;
      let finalIso: string;
      if (parsed) {
        const looksSyntheticStagger =
          parsed.getSeconds() === 0 &&
          parsed.getMilliseconds() === 0 &&
          parsed.getHours() === 9 + ((seqNum * 7) % 9) &&
          parsed.getMinutes() === (seqNum * 13) % 60;

        if (looksSyntheticStagger) {
          const matchedInv = t.referenceNo ? invoices.find(inv => inv.invoiceNo === t.referenceNo) : undefined;
          const invParsed = matchedInv ? parseDateSafely(matchedInv.createdAt || matchedInv.date) : null;
          if (invParsed) {
            finalIso = invParsed.toISOString();
          } else {
            const matchedProd = products.find(p => p.sku === t.sku || p.id === t.sku);
            const prodUpdated = matchedProd?.updatedAt ? parseDateSafely(matchedProd.updatedAt) : null;
            finalIso = prodUpdated ? prodUpdated.toISOString() : new Date().toISOString();
          }
          hasChanges = true;
        } else {
          finalIso = parsed.toISOString();
        }
      } else {
        finalIso = new Date().toISOString();
        hasChanges = true;
      }

      if (timestamp !== finalIso || movementDate !== finalIso || createdAt !== finalIso || date !== finalIso) {
        timestamp = finalIso;
        movementDate = finalIso;
        createdAt = finalIso;
        date = finalIso;
        hasChanges = true;
      }

      return {
        ...t,
        id,
        productName,
        type: normType,
        status: normStatus,
        qty,
        unit,
        fromLocation,
        toLocation,
        timestamp: timestamp || '',
        movementDate,
        createdAt,
        date,
        operator: operator || ''
      };
    });

    // Sort strictly newest-first (ORDER BY CreatedAt / MovementDate DESC)
    const sorted = [...sanitized].sort((a, b) => {
      const ta = parseDateSafely(a.movementDate || a.createdAt || a.date || a.timestamp)?.getTime() || 0;
      const tb = parseDateSafely(b.movementDate || b.createdAt || b.date || b.timestamp)?.getTime() || 0;
      return tb - ta;
    });

    if (hasChanges) {
      safeSet(KEYS.TRANSACTIONS, sorted);
    }
    return sorted;
  }
  safeSet(KEYS.TRANSACTIONS, []);
  return [];
}

export function saveStoredTransactions(txs: TransactionDetail[]): void {
  safeSet(KEYS.TRANSACTIONS, txs);
}

// Record a new transaction and prepend it
export function logTransaction(tx: Omit<TransactionDetail, 'id' | 'timestamp'>): TransactionDetail[] {
  const all = getStoredTransactions();
  const nowIso = new Date().toISOString();
  const newTx: TransactionDetail = {
    ...tx,
    id: getNextTransactionId(),
    timestamp: nowIso,
    movementDate: nowIso,
    createdAt: nowIso,
    date: nowIso
  };
  const updated = [newTx, ...all];
  saveStoredTransactions(updated);
  return updated;
}

// --- INBOUND SHIPMENTS ---
export function getStoredInboundShipments() {
  const existing = safeGet<typeof initialInboundShipments | null>(KEYS.INBOUND, null);
  if (existing !== null && Array.isArray(existing)) {
    return existing;
  }
  safeSet(KEYS.INBOUND, []);
  return [];
}

export function saveStoredInboundShipments(shipments: typeof initialInboundShipments): void {
  safeSet(KEYS.INBOUND, shipments);
}

// --- OUTBOUND ORDERS ---
export function getStoredOutboundOrders() {
  const existing = safeGet<typeof initialOutboundOrders | null>(KEYS.OUTBOUND, null);
  if (existing !== null && Array.isArray(existing)) {
    return existing;
  }
  safeSet(KEYS.OUTBOUND, []);
  return [];
}

export function saveStoredOutboundOrders(orders: typeof initialOutboundOrders): void {
  safeSet(KEYS.OUTBOUND, orders);
}

// --- STOCK COUNTS ---
export function getStoredStockCounts() {
  const existing = safeGet<typeof initialStockCountItems | null>(KEYS.STOCK_COUNTS, null);
  if (existing !== null && Array.isArray(existing) && existing.length > 0) {
    return existing;
  }
  safeSet(KEYS.STOCK_COUNTS, []);
  return [];
}

export function saveStoredStockCounts(items: typeof initialStockCountItems): void {
  safeSet(KEYS.STOCK_COUNTS, items);
}

// --- WAREHOUSES ---
const DEFAULT_COUNTRY_META: Record<string, { nameAr: string; stateAr: string; currency: string; timezone: string }> = {
  IQ: { nameAr: 'العراق', stateAr: 'بغداد', currency: 'IQD', timezone: 'Asia/Baghdad (UTC+3)' },
  AE: { nameAr: 'الإمارات العربية المتحدة', stateAr: 'دبي', currency: 'AED', timezone: 'Asia/Dubai (UTC+4)' },
  SA: { nameAr: 'المملكة العربية السعودية', stateAr: 'الرياض', currency: 'SAR', timezone: 'Asia/Riyadh (UTC+3)' },
  JO: { nameAr: 'الأردن', stateAr: 'عمان', currency: 'JOD', timezone: 'Asia/Amman (UTC+3)' },
  EG: { nameAr: 'مصر', stateAr: 'القاهرة', currency: 'EGP', timezone: 'Africa/Cairo (UTC+2)' },
  TR: { nameAr: 'تركيا', stateAr: 'إسطنبول', currency: 'TRY', timezone: 'Europe/Istanbul (UTC+3)' },
  DE: { nameAr: 'ألمانيا', stateAr: 'هامبورغ', currency: 'EUR', timezone: 'Europe/Berlin (UTC+1)' },
  GB: { nameAr: 'المملكة المتحدة', stateAr: 'لندن', currency: 'GBP', timezone: 'Europe/London (UTC+0)' },
  US: { nameAr: 'الولايات المتحدة الأمريكية', stateAr: 'كاليفورنيا', currency: 'USD', timezone: 'America/New_York (UTC-5)' }
};

function resolveTenantWarehouseDefaults() {
  let countryCode = 'IQ';
  let currency = 'IQD';
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('zilox_user_preferences');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.tenantCountryCode) countryCode = String(parsed.tenantCountryCode).toUpperCase();
        if (parsed?.baseCurrency) currency = String(parsed.baseCurrency).toUpperCase();
      }
    } catch {
      // keep Iraq / IQD defaults
    }
  }
  const meta = DEFAULT_COUNTRY_META[countryCode] || DEFAULT_COUNTRY_META.IQ;
  return {
    countryCode,
    countryName: meta.nameAr,
    stateName: meta.stateAr,
    currency: currency || meta.currency,
    timezone: meta.timezone
  };
}

export function getStoredWarehouses(): Warehouse[] {
  const tenantDefaults = resolveTenantWarehouseDefaults();
  const existing = safeGet<Warehouse[] | null>(KEYS.WAREHOUSES, null);
  if (existing && Array.isArray(existing) && existing.length > 0) {
    let modified = false;
    const migrated = existing.map(w => {
      if (w.nameEn && /nadx/i.test(w.nameEn)) {
        w.nameEn = w.nameEn.replace(/nadx\s*/gi, '').trim() || 'Main Warehouse';
        modified = true;
      }
      if (w.nameAr && /نادكس/i.test(w.nameAr)) {
        w.nameAr = w.nameAr.replace(/نادكس\s*/gi, '').trim() || 'المستودع الرئيسي';
        modified = true;
      }
      if (!w.nameEn || w.nameEn === w.nameAr || /[\u0600-\u06FF]/.test(w.nameEn)) {
        if (w.id === 'WH-01' || (w.nameAr && w.nameAr.includes('الرئيسي'))) {
          w.nameEn = 'Main Warehouse';
        } else if (w.id === 'WH-02' || (w.nameAr && w.nameAr.includes('الإقليمي'))) {
          w.nameEn = 'Regional Distribution Hub';
        } else if (w.id === 'WH-03' || (w.nameAr && w.nameAr.includes('البصرة'))) {
          w.nameEn = 'Basra Port Regional Hub';
        } else if (w.id === 'WH-04' || (w.nameAr && w.nameAr.includes('أربيل'))) {
          w.nameEn = 'Erbil Northern Gateway';
        } else {
          w.nameEn = w.code || `Hub ${w.id}`;
        }
        modified = true;
      }
      // Heal legacy hardcoded Global/US/Central/UTC/USD defaults on primary warehouse
      if (w.country === 'Global' || w.state === 'Central' || (w.countryCode === 'US' && tenantDefaults.countryCode !== 'US' && w.city === 'Headquarters')) {
        w.country = tenantDefaults.countryName;
        w.countryCode = tenantDefaults.countryCode;
        w.state = tenantDefaults.stateName;
        w.city = tenantDefaults.stateName;
        w.cityAr = tenantDefaults.stateName;
        w.timezone = tenantDefaults.timezone;
        w.currency = tenantDefaults.currency;
        modified = true;
      }
      if (!w.timezone || w.timezone === 'UTC') {
        w.timezone = (DEFAULT_COUNTRY_META[w.countryCode || tenantDefaults.countryCode] || tenantDefaults).timezone;
        modified = true;
      }
      if (!w.currency || (w.currency === 'USD' && w.countryCode === 'IQ' && tenantDefaults.currency === 'IQD')) {
        w.currency = tenantDefaults.currency;
        modified = true;
      }
      const normStorage = (w.storageType || '').toLowerCase();
      if (normStorage !== 'standard' && normStorage !== 'coldstorage') {
        w.storageType = (normStorage === 'cold_chain' || normStorage === 'deep_freeze' || normStorage === 'cold_storage')
          ? 'ColdStorage'
          : 'Standard';
        modified = true;
      }
      return w;
    });
    if (modified) {
      safeSet(KEYS.WAREHOUSES, migrated);
    }
    return migrated;
  }
  const defaultTenantWarehouse: Warehouse[] = [
    {
      id: 'WH-01',
      code: 'WH-01',
      nameAr: 'المستودع الرئيسي',
      nameEn: 'Main Warehouse',
      country: tenantDefaults.countryName,
      countryCode: tenantDefaults.countryCode,
      state: tenantDefaults.stateName,
      city: tenantDefaults.stateName,
      cityAr: tenantDefaults.stateName,
      cityEn: tenantDefaults.stateName,
      address: '',
      postalCode: '',
      timezone: tenantDefaults.timezone,
      currency: tenantDefaults.currency,
      storageType: 'Standard',
      manager: '',
      managerEn: '',
      phone: '',
      capacity: 10000,
      occupied: 0,
      itemsCount: 0,
      status: 'active'
    }
  ];
  safeSet(KEYS.WAREHOUSES, defaultTenantWarehouse);
  return defaultTenantWarehouse;
}

export function saveStoredWarehouses(warehouses: Warehouse[]): void {
  safeSet(KEYS.WAREHOUSES, warehouses);
}

export function deleteAllWarehouses(): void {
  safeSet(KEYS.WAREHOUSES, []);
}

export function createWarehouse(data: {
  code: string;
  nameAr: string;
  nameEn?: string;
  country?: string;
  countryCode?: string;
  state?: string;
  city: string;
  cityAr?: string;
  cityEn?: string;
  address?: string;
  postalCode?: string;
  timezone?: string;
  currency?: string;
  storageType?: string;
  storageTypeLabelAr?: string;
  storageTypeLabelEn?: string;
  manager: string;
  managerEn?: string;
  phone: string;
  capacity: number;
  status?: 'active' | 'maintenance';
}): Warehouse {
  const warehouses = getStoredWarehouses();
  const nextNum = warehouses.length + 1;
  const newId = `WH-${String(nextNum).padStart(2, '0')}`;
  
  const tenantDefaults = resolveTenantWarehouseDefaults();
  const newWarehouse: Warehouse = {
    id: newId,
    code: data.code.trim().toUpperCase() || `WH-LOC-${nextNum}`,
    nameAr: data.nameAr.trim(),
    nameEn: data.nameEn?.trim() || data.nameAr.trim(),
    country: data.country?.trim() || tenantDefaults.countryName,
    countryCode: data.countryCode?.trim() || tenantDefaults.countryCode,
    state: data.state?.trim() || tenantDefaults.stateName,
    city: data.city?.trim() || tenantDefaults.stateName,
    cityAr: data.cityAr || data.city || tenantDefaults.stateName,
    cityEn: data.cityEn || data.city || tenantDefaults.stateName,
    address: data.address?.trim() || '',
    postalCode: data.postalCode?.trim() || '',
    timezone: data.timezone?.trim() || tenantDefaults.timezone,
    currency: data.currency?.trim() || tenantDefaults.currency,
    storageType: data.storageType === 'ColdStorage' ? 'ColdStorage' : 'Standard',
    storageTypeLabelAr: data.storageTypeLabelAr,
    storageTypeLabelEn: data.storageTypeLabelEn,
    manager: data.manager?.trim() || '',
    managerEn: data.managerEn || data.manager || '',
    phone: data.phone?.trim() || '',
    capacity: Number(data.capacity) || 10000,
    occupied: 0,
    itemsCount: 0,
    status: data.status || 'active'
  };

  const updated = [...warehouses, newWarehouse];
  saveStoredWarehouses(updated);
  return newWarehouse;
}

export function updateWarehouse(id: string, updates: Partial<Warehouse>): Warehouse {
  const warehouses = getStoredWarehouses();
  let updatedWarehouse: Warehouse | null = null;
  const next = warehouses.map(w => {
    if (w.id === id) {
      updatedWarehouse = {
        ...w,
        ...updates,
        id: w.id
      };
      return updatedWarehouse;
    }
    return w;
  });

  if (!updatedWarehouse) {
    throw new Error(`Warehouse with ID ${id} not found`);
  }

  saveStoredWarehouses(next);

  // If status changed to maintenance or inactive, clear invalid warehouse from localStorage
  if (updates.status === 'maintenance' || (updates as any).isActive === false) {
    const storedId = getStoredSelectedWarehouseId();
    if (storedId === id) {
      clearStoredSelectedWarehouseId();
      validateAndResolveActiveWarehouse(next);
    }
  }

  return updatedWarehouse;
}

export interface DeleteWarehouseResult {
  success: boolean;
  errorCode?: string;
  message: string;
  details?: {
    warehouseId?: string;
    warehouseName?: string;
    itemsCount?: number;
    totalStock?: number;
    activeTransfersCount?: number;
    activeDispatchCount?: number;
  };
}

export function deleteWarehouse(id: string): DeleteWarehouseResult {
  const warehouses = getStoredWarehouses();
  const target = warehouses.find(w => w.id === id || w.code === id);
  if (!target) {
    return { 
      success: false, 
      errorCode: 'ERR_WAREHOUSE_NOT_FOUND',
      message: 'المستودع غير موجود في النظام.' 
    };
  }

  // 1. Prevent deleting the only active warehouse in the system
  if (warehouses.length <= 1) {
    return {
      success: false,
      errorCode: 'ERR_LAST_WAREHOUSE',
      message: 'لا يمكن حذف المستودع الوحيد المتبقي في المنشأة. يجب الإبقاء على مستودع نشط واحد على الأقل.'
    };
  }

  // 2. Prevent deleting warehouse with active products or stock
  const allProducts = getStoredProducts();
  const assignedProducts = allProducts.filter(p => 
    p.warehouseId === target.id || 
    p.warehouseId === target.code ||
    (target.code && p.warehouseId === target.code)
  );

  const totalStock = assignedProducts.reduce((sum, p) => sum + (Number(p.currentStock) || 0), 0);
  const itemsWithStock = assignedProducts.filter(p => (Number(p.currentStock) || 0) > 0);

  // If physical stock exists, STRICTLY BLOCK DELETION
  if (totalStock > 0 || itemsWithStock.length > 0) {
    return {
      success: false,
      errorCode: 'ERR_CANNOT_DELETE_WAREHOUSE_WITH_STOCK',
      message: `لا يمكن حذف المستودع "${target.nameAr || target.nameEn}" نهائياً لاحتوائه على (${assignedProducts.length}) صنف برصيد إجمالي (${formatLatinNumber(totalStock)} قطعة). يرجى إجراء مناقلة للمخزون أو تصفيته بالكامل قبل الحذف.`,
      details: {
        warehouseId: target.id,
        warehouseName: target.nameAr || target.nameEn,
        itemsCount: assignedProducts.length,
        totalStock: totalStock
      }
    };
  }

  // If products are registered to this warehouse in catalog (even if current stock is 0)
  if (assignedProducts.length > 0) {
    return {
      success: false,
      errorCode: 'ERR_WAREHOUSE_HAS_CATALOG_PRODUCTS',
      message: `لا يمكن حذف المستودع "${target.nameAr || target.nameEn}" لوجود (${assignedProducts.length}) صنف مسجل به في دليل المنتجات. يرجى إعادة تعيين أو نقل المستودع لهذه الأصناف أولاً.`,
      details: {
        warehouseId: target.id,
        warehouseName: target.nameAr || target.nameEn,
        itemsCount: assignedProducts.length,
        totalStock: 0
      }
    };
  }

  // 3. Check pending transfers
  const transfers = safeGet<any[]>(KEYS.TRANSFERS, []) || [];
  const activeTransfers = transfers.filter(t => 
    (t.fromWarehouseId === target.id || t.toWarehouseId === target.id || 
     t.fromWarehouse === target.nameAr || t.toWarehouse === target.nameAr ||
     t.fromWarehouse === target.id || t.toWarehouse === target.id) &&
    (t.status === 'pending' || t.status === 'in_transit' || t.status === 'processing')
  );

  if (activeTransfers.length > 0) {
    return {
      success: false,
      errorCode: 'ERR_WAREHOUSE_ACTIVE_TRANSFERS',
      message: `لا يمكن حذف المستودع "${target.nameAr || target.nameEn}" لوجود (${activeTransfers.length}) مناقلة مخزنية معلقة قيد التنفيذ.`,
      details: {
        warehouseId: target.id,
        activeTransfersCount: activeTransfers.length
      }
    };
  }

  // 4. Check pending dispatch orders
  const dispatches = getStoredDispatchOrders();
  const pendingDispatches = dispatches.filter(d => 
    (d.warehouseId === target.id || (d as any).warehouseCode === target.code) && 
    (d.status === 'PENDING' || (d as any).status === 'pending')
  );

  if (pendingDispatches.length > 0) {
    return {
      success: false,
      errorCode: 'ERR_WAREHOUSE_ACTIVE_DISPATCHES',
      message: `لا يمكن حذف المستودع "${target.nameAr || target.nameEn}" لوجود (${pendingDispatches.length}) أمر صرف معلق قيد المعالجة.`,
      details: {
        warehouseId: target.id,
        activeDispatchCount: pendingDispatches.length
      }
    };
  }

  // 5. Safe to delete from stored list
  const next = warehouses.filter(w => w.id !== target.id && w.code !== target.code);
  saveStoredWarehouses(next);

  // If deleted warehouse was currently selected in localStorage, purge and fallback immediately
  const storedId = getStoredSelectedWarehouseId();
  if (storedId === target.id || storedId === target.code) {
    clearStoredSelectedWarehouseId();
    validateAndResolveActiveWarehouse(next);
  }

  return { 
    success: true, 
    message: `تم حذف المستودع "${target.nameAr || target.nameEn}" بنجاح من النظام.` 
  };
}

// --- SELECTED WAREHOUSE STORAGE & ACTIVE FALLBACK ENGINE ---
export function getStoredSelectedWarehouseId(): string | null {
  return safeGet<string | null>(KEYS.SELECTED_WAREHOUSE, null);
}

export function saveStoredSelectedWarehouseId(warehouseId: string): void {
  safeSet(KEYS.SELECTED_WAREHOUSE, warehouseId);
}

export function clearStoredSelectedWarehouseId(): void {
  try {
    localStorage.removeItem(KEYS.SELECTED_WAREHOUSE);
  } catch (err) {
    console.error('Error clearing selected warehouse from localStorage:', err);
  }
}

/**
 * Validates candidate warehouse ID against the list of active warehouses.
 * If candidate is missing, deleted, or deactivated:
 * 1. Clears old ID from localStorage.
 * 2. Fallbacks automatically to the main active warehouse (or first active warehouse).
 * 3. Persists the active warehouse ID and returns it.
 */
export function validateAndResolveActiveWarehouse(
  warehouses: Warehouse[],
  candidateId?: string | null
): {
  activeWarehouseId: string;
  activeWarehouse: Warehouse;
  wasInvalidFallback: boolean;
} {
  const activeList = (warehouses || []).filter(w => {
    const isExplicitlyInactive = (w as any).isActive === false || w.status === 'maintenance';
    return !isExplicitlyInactive;
  });

  const defaultMainWh: Warehouse = activeList.find(w => w.id === 'WH-01' || w.code === 'WH-01' || (w.nameAr && w.nameAr.includes('الرئيسي')))
    || activeList[0]
    || {
      id: 'WH-01',
      code: 'WH-01',
      nameAr: 'المستودع الرئيسي',
      nameEn: 'Main Warehouse',
      city: 'المقر الرئيسي',
      cityAr: 'المقر الرئيسي',
      cityEn: 'Headquarters',
      manager: 'الإدارة المركزية',
      managerEn: 'Central Management',
      phone: '+964 770 000 0000',
      status: 'active' as const,
      capacity: 10000,
      occupied: 0,
      itemsCount: 0
    };

  const storedId = candidateId || getStoredSelectedWarehouseId();

  if (storedId === 'ALL') {
    return {
      activeWarehouseId: 'ALL',
      activeWarehouse: defaultMainWh,
      wasInvalidFallback: false
    };
  }

  const matched = storedId ? activeList.find(w => w.id === storedId || w.code === storedId) : null;

  if (matched) {
    return {
      activeWarehouseId: matched.id,
      activeWarehouse: matched,
      wasInvalidFallback: false
    };
  }

  // Fallback: Clear stale/deleted warehouse from localStorage
  clearStoredSelectedWarehouseId();

  const fallbackId = defaultMainWh.id || 'WH-01';
  saveStoredSelectedWarehouseId(fallbackId);

  return {
    activeWarehouseId: fallbackId,
    activeWarehouse: defaultMainWh,
    wasInvalidFallback: Boolean(storedId)
  };
}

// --- SUPPLIERS ---
export interface StoredSupplier {
  id: string;
  company: string;
  contact: string;
  phone: string;
  email: string;
  country: string;
  category: string;
  rating: number;
  activePOs: number;
  currentBalance?: number;
}

export const initialSuppliers: StoredSupplier[] = [];

export function getStoredSuppliers(): StoredSupplier[] {
  const existing = safeGet<StoredSupplier[] | null>(KEYS.SUPPLIERS, null);
  if (existing !== null && Array.isArray(existing)) {
    // Purge legacy mock demo suppliers
    const cleaned = existing.filter(s =>
      s &&
      s.id !== 'SUP-01' &&
      s.id !== 'SUP-02' &&
      s.id !== 'SUP-03' &&
      s.id !== 'SUP-04' &&
      !s.company?.includes('Samsung') &&
      !s.company?.includes('Dell Technologies') &&
      !s.company?.includes('Cisco Systems') &&
      !s.company?.includes('Schneider')
    );
    if (cleaned.length !== existing.length) {
      safeSet(KEYS.SUPPLIERS, cleaned);
    }
    return cleaned;
  }
  safeSet(KEYS.SUPPLIERS, []);
  return [];
}

export function saveStoredSuppliers(suppliers: StoredSupplier[]): void {
  safeSet(KEYS.SUPPLIERS, suppliers);
}

export function createSupplier(data: {
  company: string;
  contact?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  country?: string;
  category?: string;
  rating?: number;
  notes?: string;
}): typeof initialSuppliers[0] {
  const suppliers = getStoredSuppliers();
  const newId = `SUP-${(suppliers.length + 1).toString().padStart(2, '0')}`;
  const newSupplier = {
    id: newId,
    company: data.company,
    contact: data.contact || data.contactPerson || data.company,
    phone: data.phone || '',
    email: data.email || 'supplier@example.com',
    country: data.country || '',
    category: data.category || 'General Supplies',
    rating: data.rating || 5.0,
    activePOs: 0
  };
  const updated = [newSupplier, ...suppliers];
  saveStoredSuppliers(updated);
  return newSupplier;
}

// --- PURCHASE INVOICES (BILLS) ---
export const initialPurchaseInvoices: PurchaseInvoice[] = [];

export function getStoredPurchaseInvoices(): PurchaseInvoice[] {
  const existing = safeGet<PurchaseInvoice[] | null>(KEYS.PURCHASE_INVOICES, null);
  if (existing !== null && Array.isArray(existing)) {
    return existing;
  }
  safeSet(KEYS.PURCHASE_INVOICES, []);
  return [];
}

export function saveStoredPurchaseInvoices(invoices: PurchaseInvoice[]): void {
  safeSet(KEYS.PURCHASE_INVOICES, invoices);
}

export interface PurchaseInvoiceTransactionResult {
  invoice: PurchaseInvoice;
  updatedProducts: Product[];
  createdTransactions: TransactionDetail[];
}

export function executePurchaseInvoiceTransaction(
  invoice: PurchaseInvoice,
  options?: { skipTreasuryDeduction?: boolean }
): PurchaseInvoiceTransactionResult {
  // 0. Validate Treasury Balance & Deduct Cash Outflow if amountPaid > 0 (unless already deducted atomically on backend)
  const paidAmt = Number(invoice.amountPaid) || 0;
  let targetCashAccount: any = null;
  if (paidAmt > 0 && !options?.skipTreasuryDeduction) {
    const accounts = getStoredTreasuryAccounts();
    const preferredId = invoice.cashAccountId || invoice.paidFromAccount;
    targetCashAccount = preferredId
      ? accounts.find(a => a.id === preferredId)
      : accounts.find(a => a.id === 'ACC-01' || a.type === 'CASH');
    if (!targetCashAccount) {
      throw new Error('ERR_TREASURY_ACCOUNT_NOT_FOUND');
    }
    const availableBalance = Number(targetCashAccount.balanceIqd ?? targetCashAccount.balanceUsd ?? 0);
    if (availableBalance < paidAmt) {
      throw new Error('ERR_INSUFFICIENT_TREASURY_BALANCE');
    }
    recordTreasuryOutflow('CASH', paidAmt, targetCashAccount.id);

    const existingVouchers = getStoredTreasuryVouchers();
    saveStoredTreasuryVouchers([
      {
        id: `TV-PUR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        voucherNo: invoice.billNumber,
        type: 'PAYMENT',
        partyName: invoice.supplierName,
        amount: paidAmt,
        currency: 'IQD',
        accountName: targetCashAccount.nameAr || targetCashAccount.name || preferredId || 'ACC-01',
        date: formatLatinDateTime(new Date(), 'ar'),
        notes: `${invoice.billNumber} - ${invoice.supplierName}`
      },
      ...existingVouchers
    ]);
  }

  // 1. Save purchase invoice
  const currentInvoices = getStoredPurchaseInvoices();
  const normalizedInvoice: PurchaseInvoice = {
    ...invoice,
    cashAccountName: invoice.cashAccountName || targetCashAccount?.nameAr || targetCashAccount?.name || undefined
  };
  const updatedInvoices = [normalizedInvoice, ...currentInvoices];
  saveStoredPurchaseInvoices(updatedInvoices);

  // 2. Update or create products
  const products = getStoredProducts();
  const nowStr = new Date().toISOString().split('T')[0];
  const updatedProducts = [...products];
  const newTransactions: TransactionDetail[] = [];

  invoice.items.forEach((item, idx) => {
    const existingIndex = updatedProducts.findIndex(
      p => (item.productId && p.id === item.productId) || 
           (item.sku && p.sku.toLowerCase() === item.sku.toLowerCase()) ||
           (item.barcode && p.barcode === item.barcode)
    );

    if (existingIndex >= 0) {
      const existing = updatedProducts[existingIndex];
      const prevStock = existing.currentStock || 0;
      const addedQty = Number(item.quantity) || 0;
      const newStock = prevStock + addedQty;

      // FIFO / Weighted Batch Costing calculation
      const prevCost = Number(existing.costPrice) || 0;
      const unitCost = Number(item.unitCost) || 0;
      const totalCostBasis = (prevStock * prevCost) + (addedQty * unitCost);
      const newCostBasis = newStock > 0 ? Number((totalCostBasis / newStock).toFixed(2)) : unitCost;

      const newSelling = (item.newSellingPrice && item.newSellingPrice > 0) 
        ? Number(item.newSellingPrice) 
        : existing.sellingPrice;

      const nextProduct: Product = {
        ...existing,
        currentStock: newStock,
        costPrice: newCostBasis,
        sellingPrice: newSelling,
        status: newStock > (existing.minStockAlert || 5) ? 'available' : (newStock > 0 ? 'low' : 'out_of_stock'),
        updatedAt: nowStr
      };
      updatedProducts[existingIndex] = nextProduct;
    } else {
      // Create new product on the fly with guaranteed unique ID per line item
      let newProductId = item.productId || `PRD-${Date.now()}-${idx}-${Math.floor(1000 + Math.random() * 9000)}`;
      while (updatedProducts.some(p => p.id === newProductId)) {
        newProductId = `PRD-${Date.now()}-${idx}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      const unitCost = Number(item.unitCost) || 0;
      const newProduct: Product = {
        id: newProductId,
        sku: item.sku || `SKU-${Date.now().toString().slice(-4)}`,
        barcode: item.barcode || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
        nameAr: item.nameAr,
        nameEn: item.nameEn || item.nameAr,
        category: 'مشتريات وتوريدات',
        categoryEn: 'Purchases & Supplies',
        costPrice: unitCost,
        sellingPrice: item.newSellingPrice && item.newSellingPrice > 0 ? Number(item.newSellingPrice) : Number((unitCost * 1.25).toFixed(2)),
        unit: item.uom || 'قطعة',
        currentStock: Number(item.quantity) || 0,
        minStockAlert: 5,
        warehouseId: invoice.warehouseId,
        warehouseName: invoice.warehouseName,
        requiresSerialNumber: Boolean(item.requiresSerialNumber),
        warrantyMonths: Math.max(0, Number(item.warrantyMonths) || 0),
        status: 'available',
        shelf: 'A-01',
        updatedAt: nowStr
      };
      updatedProducts.unshift(newProduct);
    }

    // Create InStock serial records if serialNumbers were entered on purchase item
    if (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
      const targetProd = updatedProducts.find(
        p => (item.productId && p.id === item.productId) ||
             (item.sku && p.sku.toLowerCase() === item.sku.toLowerCase())
      );
      const existingSerials = getStoredProductSerials();
      const existingSet = new Set(existingSerials.map(s => s.serialNumber.trim().toLowerCase()));
      const warrantyMonths = Math.max(0, Number(item.warrantyMonths ?? targetProd?.warrantyMonths) || 0);
      const addedSerials: ProductSerial[] = item.serialNumbers
        .map(sn => sn.trim())
        .filter(sn => sn.length > 0 && !existingSet.has(sn.toLowerCase()))
        .map((sn, sIdx) => ({
          id: `SN-${Date.now()}-${idx}-${sIdx}`,
          tenantId: 'default',
          productId: targetProd?.id || item.productId || item.sku,
          productName: targetProd?.nameAr || item.nameAr,
          productSku: targetProd?.sku || item.sku,
          serialNumber: sn,
          warehouseId: invoice.warehouseId,
          warehouseName: invoice.warehouseName,
          supplierId: invoice.supplierId,
          supplierName: invoice.supplierName,
          purchaseBillId: invoice.id,
          purchaseBillNo: invoice.billNumber,
          purchaseDate: invoice.invoiceDate || nowStr,
          warrantyMonths,
          warrantyStatus: 'NotStarted',
          isWarrantyActive: false,
          status: 'InStock',
          createdAt: new Date().toISOString()
        }));
      if (addedSerials.length > 0) {
        saveStoredProductSerials([...addedSerials, ...existingSerials]);
      }
    }

    // 3. Generate Inbound Stock Transaction
    const txId = getNextTransactionId(newTransactions.length);
    const nowIso = new Date().toISOString();
    const inboundTx: TransactionDetail = {
      id: txId,
      timestamp: nowIso,
      movementDate: nowIso,
      createdAt: nowIso,
      date: nowIso,
      type: 'Inbound',
      status: 'Received',
      sku: item.sku,
      productName: item.nameAr,
      qty: item.quantity,
      unit: item.uom,
      unitCost: item.unitCost,
      location: invoice.warehouseName,
      fromLocation: invoice.supplierName,
      toLocation: invoice.warehouseName,
      referenceNo: invoice.billNumber,
      operator: 'أمين المخزن والمشتريات'
    };
    newTransactions.push(inboundTx);
  });

  saveStoredProducts(updatedProducts);

  // Prepend new transactions to stock ledger
  const currentTxs = getStoredTransactions();
  const allTxs = [...newTransactions, ...currentTxs];
  saveStoredTransactions(allTxs);

  // 4. Update supplier balance / accounts payable
  if (invoice.supplierId) {
    const suppliers = getStoredSuppliers();
    const supIndex = suppliers.findIndex(s => s.id === invoice.supplierId);
    if (supIndex >= 0) {
      const currentSup = suppliers[supIndex] as any;
      const prevBal = Number(currentSup.currentBalance || currentSup.balance || 0);
      currentSup.currentBalance = Number((prevBal + (invoice.balanceDue || 0)).toFixed(2));
      currentSup.activePOs = (currentSup.activePOs || 0) + 1;
      saveStoredSuppliers(suppliers);
    }
  }

  return {
    invoice: normalizedInvoice,
    updatedProducts,
    createdTransactions: newTransactions
  };
}

export function cancelLocalPurchaseInvoice(billId: string, reason?: string): PurchaseInvoice {
  const invoices = getStoredPurchaseInvoices();
  const target = invoices.find(inv => inv.id === billId || inv.billNumber === billId);
  if (!target) throw new Error('ERR_PURCHASE_BILL_NOT_FOUND');
  if (target.status === 'CANCELLED') throw new Error('ERR_PURCHASE_ALREADY_CANCELLED');

  const products = getStoredProducts();
  const nextProducts = [...products];
  for (const item of target.items) {
    const idx = nextProducts.findIndex(
      p => (item.productId && p.id === item.productId) ||
           (item.sku && p.sku.toLowerCase() === item.sku.toLowerCase())
    );
    if (idx >= 0) {
      const currentQty = Number(nextProducts[idx].currentStock) || 0;
      if (currentQty < item.quantity) {
        throw new Error('ERR_INSUFFICIENT_STOCK_FOR_VOID');
      }
      const nextQty = currentQty - item.quantity;
      nextProducts[idx] = {
        ...nextProducts[idx],
        currentStock: nextQty,
        status: nextQty > (nextProducts[idx].minStockAlert || 5) ? 'available' : (nextQty > 0 ? 'low' : 'out_of_stock')
      };
    }
  }
  saveStoredProducts(nextProducts);

  const due = Number(target.remainingAmount ?? target.balanceDue) || 0;
  if (target.supplierId && due > 0) {
    const suppliers = getStoredSuppliers();
    const sIdx = suppliers.findIndex(s => s.id === target.supplierId);
    if (sIdx >= 0) {
      const prevBal = Number(suppliers[sIdx].currentBalance || 0);
      suppliers[sIdx].currentBalance = Math.max(0, Number((prevBal - due).toFixed(4)));
      saveStoredSuppliers(suppliers);
    }
  }

  const paid = Number(target.amountPaid) || 0;
  const accountId = target.cashAccountId || target.paidFromAccount;
  if (paid > 0 && accountId) {
    recordTreasuryInflow('CASH', paid, accountId);
    const accounts = getStoredTreasuryAccounts();
    const matchedAcc = accounts.find(a => a.id === accountId);
    const existingVouchers = getStoredTreasuryVouchers();
    saveStoredTreasuryVouchers([
      {
        id: `TV-REF-${Date.now()}`,
        voucherNo: target.billNumber,
        type: 'RECEIPT',
        partyName: target.supplierName,
        amount: paid,
        currency: 'IQD',
        accountName: matchedAcc?.nameAr || matchedAcc?.name || accountId,
        date: formatLatinDateTime(new Date(), 'ar'),
        notes: reason?.trim() || target.billNumber
      },
      ...existingVouchers
    ]);
  }

  const cancelledInvoice: PurchaseInvoice = {
    ...target,
    status: 'CANCELLED',
    cancelledAt: new Date().toISOString(),
    cancelReason: reason?.trim() || null
  };
  saveStoredPurchaseInvoices(invoices.map(inv => (inv.id === target.id ? cancelledInvoice : inv)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erp_purchases_updated'));
    window.dispatchEvent(new CustomEvent('erp_treasury_updated'));
  }
  return cancelledInvoice;
}

export interface PosSaleTransactionRequest {
  invoiceNumber: string;
  warehouseId: string;
  warehouseName: string;
  dispenseMode?: DispenseMode;
  targetWarehouseId?: string;
  targetWarehouseName?: string;
  shiftId?: string;
  cashierId: string;
  cashierName: string;
  paymentMethod: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: {
    product: Product;
    quantity: number;
    unitPrice: number;
    discountType?: 'PERCENT' | 'FIXED' | 'NONE';
    discountValue?: number;
    discountAmountMoney?: number;
    totalPrice: number;
  }[];
  subtotal: number;
  totalDiscount: number;
  taxAmount: number;
  grandTotal: number;
  redeemPoints?: number;
}

export interface PosSaleTransactionResult {
  invoice: SalesInvoice;
  updatedProducts: Product[];
  createdTransactions: TransactionDetail[];
  dispatchOrder?: WarehouseDispatchOrder;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscountAmount: number;
}

/**
 * Executes a POS sale atomically:
 * 1. Checks stock availability in the designated warehouse (storefront or dispatch hub).
 * 2. If IN_STORE: Immediately deducts sold quantities from stock & records Outbound movement.
 * 3. If WAREHOUSE_DISPATCH: Staged fulfillment; reserves item quantities, creates keeper dispatch order, marks PENDING_DISPATCH.
 * 4. Saves the Sales Invoice.
 * 5. Updates Cashier Shift sales.
 */
export function executePosSaleTransaction(
  req: PosSaleTransactionRequest
): PosSaleTransactionResult {
  if (!req.warehouseId) {
    throw new Error('يجب تحديد مستودع البيع لإتمام الفاتورة.');
  }

  // Validate Warehouse Guard: Warehouse must exist and be active
  const warehouses = getStoredWarehouses();
  const activeWarehouses = warehouses.filter(w => (w as any).isActive !== false && w.status !== 'maintenance');
  const validWarehouse = activeWarehouses.find(w => w.id === req.warehouseId || w.code === req.warehouseId);

  if (!validWarehouse) {
    clearStoredSelectedWarehouseId();
    validateAndResolveActiveWarehouse(warehouses);
    throw new Error('المستودع المحدد غير موجود أو تم تعطيله. يرجى اختيار مستودع نشط.');
  }

  if (!req.items || req.items.length === 0) {
    throw new Error('لا يمكن إتمام البيع: سلة المبيعات فارغة.');
  }

  const isWarehouseDispatch = req.dispenseMode === 'WAREHOUSE_DISPATCH';

  if (isWarehouseDispatch && req.targetWarehouseId) {
    const validTargetWh = activeWarehouses.find(w => w.id === req.targetWarehouseId || w.code === req.targetWarehouseId);
    if (!validTargetWh) {
      throw new Error('مستودع التجهيز المحدد غير موجود أو تم تعطيله. يرجى اختيار مستودع نشط.');
    }
  }

  const effectiveWarehouseName = isWarehouseDispatch && req.targetWarehouseName 
    ? req.targetWarehouseName 
    : (validWarehouse.nameAr || req.warehouseName);
  const effectiveWarehouseId = isWarehouseDispatch && req.targetWarehouseId 
    ? req.targetWarehouseId 
    : validWarehouse.id;

  const storedProducts = getStoredProducts();
  const updatedProducts = [...storedProducts];
  const storedBundles = getStoredProductBundles();

  // 1. Strict Aggregated Stock Availability Check (bundles + standalone items combined)
  const aggregatedDemand = new Map<string, { name: string; sku: string; requiredQty: number }>();

  for (const item of req.items) {
    const prod = updatedProducts.find(p => p.id === item.product.id || p.sku === item.product.sku);
    if (!prod) {
      throw new Error(`الصنف (${item.product.nameAr || item.product.sku}) غير موجود في قاعدة بيانات المخزون.`);
    }

    const bundleComponents = storedBundles.filter(b => b.parentProductId === prod.id);
    if (prod.isBundle || bundleComponents.length > 0) {
      if (bundleComponents.length === 0) {
        throw new Error(`حزمة المنتجات "${prod.nameAr}" (${prod.sku}) لا تحتوي على مكونات صالحة.`);
      }
      for (const bc of bundleComponents) {
        const compProd = updatedProducts.find(p => !p.isBundle && (p.id === bc.childProductId || (bc.childProductSku && p.sku === bc.childProductSku)));
        if (!compProd) {
          throw new Error(`مكون الحزمة "${bc.childProductName || bc.childProductSku}" داخل "${prod.nameAr}" غير موجود في المخزون.`);
        }
        const reqCompQty = Math.ceil((Number(bc.quantity) || 1) * item.quantity);
        const existing = aggregatedDemand.get(compProd.id);
        aggregatedDemand.set(compProd.id, {
          name: compProd.nameAr,
          sku: compProd.sku,
          requiredQty: (existing?.requiredQty || 0) + reqCompQty
        });
      }
    } else {
      const existing = aggregatedDemand.get(prod.id);
      aggregatedDemand.set(prod.id, {
        name: prod.nameAr,
        sku: prod.sku,
        requiredQty: (existing?.requiredQty || 0) + item.quantity
      });
    }
  }

  for (const [physId, demand] of aggregatedDemand.entries()) {
    const physProd = updatedProducts.find(p => p.id === physId);
    const available = Number(physProd?.currentStock) || 0;
    if (!physProd || available < demand.requiredQty) {
      throw new Error(
        `رصيد الصنف "${demand.name}" (${demand.sku}) غير كافٍ في مستودع "${effectiveWarehouseName}". الرصيد المتاح فعلياً: ${available} قطعة، بينما إجمالي الكمية المطلوبة: ${demand.requiredQty} قطعة.`
      );
    }
  }

  // 2. Stock Processing & Inventory Movement Generation
  const newTransactions: TransactionDetail[] = [];
  const nowStr = new Date().toISOString().split('T')[0];
  const nowTime = formatLatinTime(new Date(), 'ar', { hour: '2-digit', minute: '2-digit' });

  if (!isWarehouseDispatch) {
    // IN_STORE: Immediate deduction and outbound record (handles Product Bundles by deducting component SKUs ONLY)
    for (const item of req.items) {
      const bundleComponents = storedBundles.filter(b => b.parentProductId === item.product.id);
      const isBundleItem = Boolean(item.product.isBundle) || bundleComponents.length > 0;
      const deductionTargets: Array<{ product: Product | undefined; qty: number }> = isBundleItem
        ? bundleComponents.map(bc => ({
            product: updatedProducts.find(p => p.id === bc.childProductId || (bc.childProductSku && p.sku === bc.childProductSku)),
            qty: Math.ceil((Number(bc.quantity) || 1) * item.quantity),
          }))
        : [{ product: updatedProducts.find(p => p.id === item.product.id || p.sku === item.product.sku), qty: item.quantity }];

      for (const target of deductionTargets) {
        if (!target.product || target.product.isBundle) continue;
        const pIndex = updatedProducts.findIndex(p => p.id === target.product!.id);
        if (pIndex >= 0) {
          const prod = updatedProducts[pIndex];
          const prevStock = Number(prod.currentStock) || 0;
          const newStock = Math.max(0, prevStock - target.qty);

          updatedProducts[pIndex] = {
            ...prod,
            currentStock: newStock,
            status: newStock <= 0 ? 'out_of_stock' : newStock <= (prod.minStockAlert || 5) ? 'low' : 'available',
            updatedAt: nowStr
          };

          const txId = getNextTransactionId(newTransactions.length);
          const nowIso = new Date().toISOString();
          newTransactions.push({
            id: txId,
            timestamp: nowIso,
            movementDate: nowIso,
            createdAt: nowIso,
            date: nowIso,
            type: 'Outbound',
            status: 'Dispatched',
            sku: prod.sku,
            productName: isBundleItem ? `${prod.nameAr} (${item.product.nameAr})` : prod.nameAr,
            qty: -target.qty,
            unit: prod.unit || 'قطعة',
            unitCost: prod.costPrice,
            location: req.warehouseName,
            fromLocation: req.warehouseName,
            toLocation: req.customerName || 'عميل نقدي (POS Retail)',
            referenceNo: req.invoiceNumber,
            operator: req.cashierName || req.cashierId || 'الكاشير'
          });
        }
      }
    }
  }

  // 3. Enforce Strict Active POS Shift & Dispatch Attributes
  const activeShift = getStoredActiveShift();
  const resolvedShiftId = req.shiftId || activeShift?.id;
  if (!activeShift || activeShift.status !== 'ACTIVE' || !resolvedShiftId) {
    throw new Error('ERR_NO_ACTIVE_SHIFT');
  }
  const invoiceCreatedIso = new Date().toISOString();
  const upperMethod = (req.paymentMethod || 'CASH').toUpperCase();
  const isCreditOrInstallment = upperMethod === 'CREDIT' || upperMethod === 'INSTALLMENT' || upperMethod === 'CUSTOMER_ACCOUNT_DEBIT';

  const resolvedCustomer = resolveOrCreateLocalCustomer({
    customerId: req.customerId,
    customerName: req.customerName,
    customerPhone: req.customerPhone,
    customerAddress: req.customerAddress,
    isCreditOrInstallment,
    saleAmount: req.grandTotal
  });

  const mappedPaymentMethod =
    upperMethod === 'CARD' || upperMethod === 'CREDIT_CARD'
      ? 'card'
      : upperMethod === 'ZAIN_CASH'
      ? 'zain_cash'
      : upperMethod === 'QI_CARD'
      ? 'qi_card'
      : upperMethod === 'INSTALLMENT'
      ? 'installment'
      : upperMethod === 'CREDIT'
      ? 'credit'
      : 'cash';

  const invoiceId = `INV-${Date.now()}`;
  const realizedProfitBeforeLoyalty = req.items.reduce((sum, it) => {
    const unitCost = resolveProductUnitCost(it.product, updatedProducts, storedBundles);
    return sum + (Number(it.unitPrice) - unitCost) * Number(it.quantity);
  }, 0);

  const loyaltyOutcome = applyLocalCheckoutLoyalty({
    customerId: resolvedCustomer.customerId,
    customerName: resolvedCustomer.customerName,
    isDefaultCashCustomer: resolvedCustomer.isDefaultCashCustomer,
    invoiceId,
    invoiceNo: req.invoiceNumber,
    lineProfitsSum: realizedProfitBeforeLoyalty,
    invoiceLevelDiscount: 0,
    maxRedeemCap: Math.max(0, req.subtotal - req.totalDiscount),
    requestedRedeemPoints: Number(req.redeemPoints) || 0,
    operator: req.cashierName || req.cashierId || 'الكاشير'
  });

  const netGrandTotal = Math.max(0, req.grandTotal - loyaltyOutcome.loyaltyDiscountAmount);
  let dispatchOrder: WarehouseDispatchOrder | undefined;

  if (isWarehouseDispatch) {
    const expandedDispatchItems: WarehouseDispatchOrder['items'] = [];
    for (const it of req.items) {
      const bundleComponents = storedBundles.filter(b => b.parentProductId === it.product.id);
      if (bundleComponents.length > 0) {
        for (const bc of bundleComponents) {
          const compProd = updatedProducts.find(p => p.id === bc.childProductId || (bc.childProductSku && p.sku === bc.childProductSku));
          const reqQty = Math.ceil((Number(bc.quantity) || 1) * it.quantity);
          expandedDispatchItems.push({
            productId: bc.childProductId,
            productName: `${compProd?.nameAr || bc.childProductName} (${it.product.nameAr})`,
            sku: compProd?.sku || bc.childProductSku,
            quantity: reqQty,
            unitPrice: compProd?.sellingPrice ?? bc.componentSellingPrice ?? 0,
            totalPrice: (compProd?.sellingPrice ?? bc.componentSellingPrice ?? 0) * reqQty,
            shelfLocation: compProd?.shelf || 'A-01'
          });
        }
      } else {
        expandedDispatchItems.push({
          productId: it.product.id,
          productName: it.product.nameAr,
          sku: it.product.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          shelfLocation: it.product.shelf || 'A-01'
        });
      }
    }

    dispatchOrder = {
      id: `DSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoiceId,
      invoiceNumber: req.invoiceNumber,
      warehouseId: effectiveWarehouseId,
      warehouseName: effectiveWarehouseName,
      customerName: resolvedCustomer.customerName,
      cashierName: req.cashierName || req.cashierId || 'الكاشير',
      items: expandedDispatchItems,
      totalQuantity: req.items.reduce((sum, it) => sum + it.quantity, 0),
      status: 'PENDING',
      notes: 'طلب تجهيز وتسليم صادر من نقطة البيع POS',
      createdAt: new Date().toISOString()
    };

    const currentOrders = getStoredDispatchOrders();
    saveStoredDispatchOrders([dispatchOrder, ...currentOrders]);
  }

  const salesInvoice: SalesInvoice = {
    id: invoiceId,
    invoiceNo: req.invoiceNumber,
    customerId: resolvedCustomer.customerId,
    customerName: resolvedCustomer.customerName,
    customerPhone: req.customerPhone || resolvedCustomer.customerPhone || '—',
    customerAddress: req.customerAddress || (isWarehouseDispatch ? `تجهيز من مخزن ${effectiveWarehouseName}` : 'نقطة البيع المباشرة'),
    warehouseName: effectiveWarehouseName,
    shiftId: resolvedShiftId,
    sourceModule: 'POS',
    dispenseMode: isWarehouseDispatch ? 'WAREHOUSE_DISPATCH' : 'IN_STORE',
    fulfillmentStatus: isWarehouseDispatch ? 'PENDING_DISPATCH' : 'FULFILLED',
    dispatchOrderId: dispatchOrder?.id,
    receiptDispenseNotice: isWarehouseDispatch 
      ? 'قيد التجهيز من المخزن - يرجى مراجعة أمين المخزن للاستلام' 
      : 'مستلمة ومصروفة من المحل',
    itemsCount: req.items.reduce((sum, it) => sum + it.quantity, 0),
    subtotal: req.subtotal,
    tax: req.taxAmount,
    discount: req.totalDiscount + loyaltyOutcome.loyaltyDiscountAmount,
    total: netGrandTotal,
    loyaltyPointsEarned: loyaltyOutcome.pointsEarned,
    loyaltyPointsRedeemed: loyaltyOutcome.pointsRedeemed,
    loyaltyDiscountAmount: loyaltyOutcome.loyaltyDiscountAmount,
    realizedProfit: loyaltyOutcome.realizedProfit,
    paymentMethod: mappedPaymentMethod as any,
    status: 'paid',
    date: nowStr,
    createdAt: invoiceCreatedIso,
    operator: req.cashierName,
    items: req.items.map(it => ({
      id: `LNE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productId: it.product.id,
      sku: it.product.sku,
      nameAr: it.product.nameAr,
      nameEn: it.product.nameEn || it.product.nameAr,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      unit: it.product.unit || 'قطعة',
      total: it.totalPrice
    }))
  };

  // 4. Atomic Commit to Local Storage
  if (!isWarehouseDispatch) {
    saveStoredProducts(updatedProducts);
    const currentTxs = getStoredTransactions();
    saveStoredTransactions([...newTransactions, ...currentTxs]);
  }

  const currentInvoices = getStoredInvoices();
  saveStoredInvoices([salesInvoice, ...currentInvoices]);

  // 5. Update Cashier Shift Sales (strictly isolated to resolvedShiftId)
  recordShiftSale(req.paymentMethod, netGrandTotal, resolvedShiftId);

  return {
    invoice: salesInvoice,
    updatedProducts,
    createdTransactions: newTransactions,
    dispatchOrder,
    loyaltyPointsEarned: loyaltyOutcome.pointsEarned,
    loyaltyPointsRedeemed: loyaltyOutcome.pointsRedeemed,
    loyaltyDiscountAmount: loyaltyOutcome.loyaltyDiscountAmount
  };
}

/**
 * Warehouse Keeper Action: Confirms and releases a pending dispatch order.
 * Converts reservation to actual stock deduction, creates outbound movements, and marks invoice fulfilled.
 */
export function approveDispatchOrder(dispatchOrderId: string, fulfilledBy?: string): {
  success: boolean;
  order: WarehouseDispatchOrder;
  invoice?: SalesInvoice;
  createdTransactions: TransactionDetail[];
  updatedProducts: Product[];
} {
  const allOrders = getStoredDispatchOrders();
  const orderIdx = allOrders.findIndex(o => o.id === dispatchOrderId);
  if (orderIdx < 0) {
    throw new Error('أمر التجهيز المطلوب غير موجود في النظام.');
  }

  const order = allOrders[orderIdx];
  if (order.status === 'FULFILLED') {
    return {
      success: true,
      order,
      createdTransactions: [],
      updatedProducts: getStoredProducts()
    };
  }

  const storedProducts = getStoredProducts();
  const updatedProducts = [...storedProducts];
  const newTransactions: TransactionDetail[] = [];
  const nowStr = new Date().toISOString().split('T')[0];
  const nowTime = formatLatinTime(new Date(), 'ar', { hour: '2-digit', minute: '2-digit' });
  const keeperName = fulfilledBy || 'أمين المستودع';

  // Deduct stock for each item in the dispatch order
  for (const item of order.items) {
    const pIndex = updatedProducts.findIndex(p => p.id === item.productId || p.sku === item.sku);
    if (pIndex >= 0) {
      const prod = updatedProducts[pIndex];
      const prevStock = Number(prod.currentStock) || 0;
      const newStock = Math.max(0, prevStock - item.quantity);

      updatedProducts[pIndex] = {
        ...prod,
        currentStock: newStock,
        status: newStock <= 0 ? 'out_of_stock' : newStock <= (prod.minStockAlert || 5) ? 'low' : 'available',
        updatedAt: nowStr
      };

      const txId = getNextTransactionId(newTransactions.length);
      const nowIso = new Date().toISOString();
      const outboundTx: TransactionDetail = {
        id: txId,
        timestamp: nowIso,
        movementDate: nowIso,
        createdAt: nowIso,
        date: nowIso,
        type: 'Outbound', // Warehouse Dispatch Release
        status: 'Dispatched',
        sku: prod.sku,
        productName: prod.nameAr,
        qty: -item.quantity,
        unit: prod.unit || 'قطعة',
        unitCost: prod.costPrice,
        location: order.warehouseName,
        fromLocation: order.warehouseName,
        toLocation: order.customerName || 'عميل نقدي (صالة العرض)',
        referenceNo: order.invoiceNumber,
        operator: keeperName
      };
      newTransactions.push(outboundTx);
    }
  }

  // Update order status
  const updatedOrder: WarehouseDispatchOrder = {
    ...order,
    status: 'FULFILLED',
    fulfilledAt: new Date().toISOString(),
    fulfilledBy: keeperName
  };
  allOrders[orderIdx] = updatedOrder;
  saveStoredDispatchOrders(allOrders);

  // Update matching Sales Invoice
  const allInvoices = getStoredInvoices();
  const invIdx = allInvoices.findIndex(i => i.id === order.invoiceId || i.invoiceNo === order.invoiceNumber);
  let updatedInvoice: SalesInvoice | undefined;
  if (invIdx >= 0) {
    updatedInvoice = {
      ...allInvoices[invIdx],
      fulfillmentStatus: 'FULFILLED'
    };
    allInvoices[invIdx] = updatedInvoice;
    saveStoredInvoices(allInvoices);
  }

  saveStoredProducts(updatedProducts);
  const currentTxs = getStoredTransactions();
  saveStoredTransactions([...newTransactions, ...currentTxs]);

  return {
    success: true,
    order: updatedOrder,
    invoice: updatedInvoice,
    createdTransactions: newTransactions,
    updatedProducts
  };
}

export function saveNewProductToCatalog(data: {
  nameAr: string;
  nameEn?: string;
  sku?: string;
  barcode?: string;
  category?: string;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  warehouseId?: string;
  warehouseName?: string;
}): Product {
  const products = getStoredProducts();
  const nowStr = new Date().toISOString().split('T')[0];
  const newSku = data.sku?.trim() || `SKU-${Date.now().toString().slice(-4)}`;
  const newBarcode = data.barcode?.trim() || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;

  const newProduct: Product = {
    id: `PRD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    sku: newSku,
    barcode: newBarcode,
    nameAr: data.nameAr.trim(),
    nameEn: data.nameEn?.trim() || data.nameAr.trim(),
    category: data.category?.trim() || 'مشتريات وتوريدات',
    categoryEn: 'Purchases & Supplies',
    costPrice: Number(data.costPrice) || 0,
    sellingPrice: Number(data.sellingPrice) || (Number(data.costPrice) ? Number((Number(data.costPrice) * 1.25).toFixed(2)) : 0),
    unit: data.unit || 'قطعة',
    currentStock: 0,
    minStockAlert: 5,
    warehouseId: data.warehouseId || 'WH-01',
    warehouseName: data.warehouseName || 'المستودع الرئيسي',
    status: 'low',
    shelf: 'A-01',
    updatedAt: nowStr
  };

  const updated = [newProduct, ...products];
  saveStoredProducts(updated);
  return newProduct;
}

// --- LANGUAGE (Per-User & Local Session Isolation) ---
export function getStoredLang(): 'ar' | 'en' {
  try {
    if (typeof window !== 'undefined') {
      const session = getStoredAuthSession();
      if (session?.preferredLanguage === 'ar' || session?.preferredLanguage === 'en') {
        return session.preferredLanguage;
      }
      if (session?.id) {
        const userVal = localStorage.getItem(`zilox_user_lang_${session.id}`);
        if (userVal === 'ar' || userVal === 'en') return userVal;
      }
      const localVal = localStorage.getItem('zilox_client_lang') || localStorage.getItem(KEYS.LANG);
      if (localVal === 'ar' || localVal === 'en') return localVal;
    }
  } catch {}
  return 'ar';
}

export function saveStoredLang(lang: 'ar' | 'en'): void {
  try {
    if (typeof window !== 'undefined') {
      const session = getStoredAuthSession();
      if (session) {
        session.preferredLanguage = lang;
        saveStoredAuthSession(session);
        localStorage.setItem(`zilox_user_lang_${session.id}`, lang);
      }
      localStorage.setItem('zilox_client_lang', lang);
      localStorage.setItem(KEYS.LANG, lang);
    }
  } catch (err) {
    console.error('Error saving lang:', err);
  }
}

// --- USERS & STAFF ACCOUNTS ---
export function getAllStoredUsersMaster(): UserAccount[] {
  const users = safeGet<UserAccount[]>(KEYS.USERS, []);
  let changed = false;
  const list = [...users];

  // 1. Ensure Platform Super Admin is always registered
  if (!list.some(u => u.role === 'PlatformSuperAdmin' || u.username.toLowerCase() === 'superadmin')) {
    list.unshift({
      id: 'USR-PLATFORM-01',
      fullName: 'المدير العام للمنصة (SaaS Platform Owner)',
      username: 'superadmin',
      password: '123',
      email: 'owner@zilox.cloud',
      phone: '+964 770 000 0000',
      role: 'PlatformSuperAdmin',
      branchId: 'PLATFORM',
      branchName: 'SaaS Platform Control Plane',
      assignedBranches: [],
      isActive: true,
      createdAt: '2026-01-01',
      tenantSlug: ''
    });
    changed = true;
  }

  // 2. Ensure default tenant admin for 'm' (Mustafa)
  if (!list.some(u => u.tenantSlug?.toLowerCase() === 'm' || u.username.toLowerCase().endsWith('@m') || u.username.toLowerCase() === 'admin@m')) {
    list.push({
      id: 'USR-M-ADMIN-01',
      fullName: 'مصطفى قاسم (مدير المنشأة)',
      username: 'admin@m',
      password: '123',
      email: 'admin@m.zilox.com',
      phone: '+964 780 123 4567',
      role: 'SuperAdmin',
      branchId: 'WH-01',
      branchName: 'المستودع الرئيسي',
      assignedBranches: ['WH-01'],
      isActive: true,
      createdAt: '2026-01-01',
      tenantSlug: 'm'
    });
    changed = true;
  }

  if (changed) {
    safeSet(KEYS.USERS, list);
  }

  return list;
}

export function saveStoredUsers(users: UserAccount[]): void {
  safeSet(KEYS.USERS, users);
}

// User-facing getter strictly filtered by active tenant scope with zero mock data
export function getStoredUsers(explicitSlug?: string): UserAccount[] {
  const allUsers = getAllStoredUsersMaster();
  const session = getStoredAuthSession();

  // Platform SuperAdmin can view all users unless filtering for a specific tenant
  if (session?.role === 'PlatformSuperAdmin' && !explicitSlug) {
    return allUsers;
  }

  const currentSlug = (explicitSlug || session?.tenantSlug || getActiveTenantSlug() || '').toLowerCase().trim();
  if (!currentSlug) return allUsers;

  return allUsers.filter(u => {
    const userSlug = (u.tenantSlug || (u.username.includes('@') ? u.username.split('@')[1] : '')).toLowerCase().trim();
    return userSlug === currentSlug;
  });
}

export function createUserAccount(userData: Omit<UserAccount, 'id' | 'createdAt'>): UserAccount {
  const users = getAllStoredUsersMaster();
  const newId = `USR-${Date.now().toString().slice(-5)}`;
  const session = getStoredAuthSession();
  const tenantSlug = (userData.tenantSlug || session?.tenantSlug || getActiveTenantSlug() || 'm').toLowerCase().trim();
  const newUser: UserAccount = {
    ...userData,
    tenantSlug,
    id: newId,
    createdAt: new Date().toISOString().split('T')[0],
    isActive: true
  };
  const updated = [newUser, ...users];
  saveStoredUsers(updated);
  return newUser;
}

export function updateUserAccount(updated: UserAccount): void {
  const users = getAllStoredUsersMaster();
  const next = users.map(u => u.id === updated.id ? updated : u);
  saveStoredUsers(next);
}

export function toggleUserStatus(id: string): boolean {
  const users = getAllStoredUsersMaster();
  let nextStatus = false;
  const next = users.map(u => {
    if (u.id === id) {
      nextStatus = !u.isActive;
      return { ...u, isActive: nextStatus };
    }
    return u;
  });
  saveStoredUsers(next);
  return nextStatus;
}

export function deleteUserAccount(id: string): void {
  const users = getAllStoredUsersMaster();
  const next = users.filter(u => u.id !== id);
  saveStoredUsers(next);
}

// --- AUTH SESSION ---
export function getStoredAuthSession(): UserProfile | null {
  const session = safeGet<UserProfile | null>(KEYS.AUTH_SESSION, null);
  if (!session) return null;

  // Defensive auto-healing: If session belongs to a tenant other than 'm',
  // guarantee zero cross-tenant name bleeding from old stale caches
  if (session.tenantSlug && session.tenantSlug !== 'm') {
    if (session.fullName === 'مصطفى قاسم' || session.fullName === 'مصطفى قاسم (مدير المنشأة)' || session.fullName === 'مصطفى قاسم (المدير العام)') {
      try {
        const rawTenants = localStorage.getItem('zilox_platform_tenants_v1');
        if (rawTenants) {
          const tenants = JSON.parse(rawTenants);
          const tenant = tenants.find((t: any) => t.slug?.toLowerCase() === session.tenantSlug?.toLowerCase());
          if (tenant?.adminFullName && tenant.adminFullName.trim() !== 'مصطفى قاسم') {
            session.fullName = tenant.adminFullName;
          } else {
            session.fullName = 'مدير المنشأة';
          }
        } else {
          session.fullName = 'مدير المنشأة';
        }
      } catch {
        session.fullName = 'مدير المنشأة';
      }
      safeSet(KEYS.AUTH_SESSION, session);
    }
  }

  return session;
}

export function saveStoredAuthSession(user: UserProfile | null): void {
  if (user) {
    let payload: any = user;
    if (typeof window !== 'undefined') {
      const existingToken =
        (user as any).token ||
        localStorage.getItem('zilox_auth_token') ||
        localStorage.getItem('logistock_erp_jwt_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('zilox_token');
      if (existingToken && !(user as any).token) {
        payload = { ...user, token: existingToken };
      } else if ((user as any).token) {
        localStorage.setItem('zilox_auth_token', (user as any).token);
        localStorage.setItem('logistock_erp_jwt_token', (user as any).token);
        localStorage.setItem('token', (user as any).token);
        localStorage.setItem('zilox_token', (user as any).token);
      }
    }
    safeSet(KEYS.AUTH_SESSION, payload);
  } else {
    localStorage.removeItem(KEYS.AUTH_SESSION);
  }
}

export function clearStoredAuthSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEYS.AUTH_SESSION);
    localStorage.removeItem('logistock_erp_v3_auth_session');
    localStorage.removeItem('zilox_sys_auth_session');
    localStorage.removeItem('zilox_auth_session');
    localStorage.removeItem('zilox_auth_token');
    localStorage.removeItem('logistock_erp_jwt_token');
    localStorage.removeItem('token');
    localStorage.removeItem('zilox_token');
    localStorage.removeItem('token_expires_at');
    sessionStorage.removeItem('zilox_impersonating_superadmin');
    sessionStorage.clear();
  }
}

// --- SYSTEM RESET HANDLERS ---
export function resetToCleanSlate(): void {
  safeSet(KEYS.PRODUCTS, []);
  safeSet(KEYS.INVOICES, []);
  safeSet(KEYS.PURCHASE_INVOICES, []);
  safeSet(KEYS.TRANSACTIONS, []);
  safeSet(KEYS.INBOUND, []);
  safeSet(KEYS.OUTBOUND, []);
  safeSet(KEYS.STOCK_COUNTS, []);
  safeSet(KEYS.SUPPLIERS, []);
  safeSet(KEYS.WAREHOUSES, []);
  safeSet(KEYS.TREASURY_ACCOUNTS, []);
  safeSet(KEYS.TREASURY_VOUCHERS, []);
  safeSet(KEYS.CUSTOMERS, []);
  safeSet(KEYS.RMA, []);
  safeSet(KEYS.DELIVERIES, []);
  safeSet(KEYS.TRANSFERS, []);
  safeSet(KEYS.PO_LIST, []);
  safeSet(KEYS.SHIFTS_HISTORY, []);
  safeSet(KEYS.LOYALTY_TRANSACTIONS, []);

  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEYS.ACTIVE_SHIFT);
  }
}

export function resetToDemoDefaults(): void {
  safeSet(KEYS.PRODUCTS, initialProducts);
  safeSet(KEYS.INVOICES, defaultFullInvoices);
  safeSet(KEYS.PURCHASE_INVOICES, initialPurchaseInvoices);
  safeSet(KEYS.TRANSACTIONS, initialTransactions);
  safeSet(KEYS.INBOUND, initialInboundShipments);
  safeSet(KEYS.OUTBOUND, initialOutboundOrders);
  safeSet(KEYS.STOCK_COUNTS, initialStockCountItems);
  safeSet(KEYS.SUPPLIERS, initialSuppliers);
  safeSet(KEYS.WAREHOUSES, initialWarehouses);
}

export interface ActiveShift {
  id: string;
  cashierName: string;
  terminalId: string;
  startTime: string;
  openedAt?: string;
  closedAt?: string;
  duration?: string;
  openingFloat: number;
  openingBalance?: number;
  cashSales: number;
  cardSales: number;
  zainCashSales: number;
  qiCardSales: number;
  refunds: number;
  expenses?: number;
  status: 'ACTIVE' | 'CLOSED';
}

export interface QuickExpenseRecord {
  id: string;
  amount: number;
  currency: 'IQD' | 'USD' | string;
  currencyCode?: string;
  expenseCategoryId: string;
  categoryName: string;
  shiftId?: string;
  notes?: string;
  createdAt: string;
}

export function recordShiftExpense(amount: number): void {
  const current = getStoredActiveShift();
  if (!current) return;
  current.expenses = (current.expenses || 0) + amount;
  saveStoredActiveShift(current);
}

export function getStoredQuickExpenses(): QuickExpenseRecord[] {
  return safeGet<QuickExpenseRecord[]>('zilox_quick_expenses', []);
}

export function saveStoredQuickExpense(record: QuickExpenseRecord): void {
  const existing = getStoredQuickExpenses();
  safeSet('zilox_quick_expenses', [record, ...existing]);
}

export function getStoredActiveShift(): ActiveShift | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEYS.ACTIVE_SHIFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.status === 'ACTIVE') {
      let needsSave = false;

      // Iraqi Dinar Cash Rounding Self-Healing:
      // Minimum physical banknote is 250 IQD (denominations: 250, 500, 1000, 5000, 10000, 25000, 50000).
      // Eliminate odd single-dinar amounts (e.g. 635,187 or 635,188) by rounding to nearest 250 IQD.
      if (parsed.cashSales && Number(parsed.cashSales) > 250) {
        const roundedCash = Math.round(Number(parsed.cashSales) / 250) * 250;
        if (roundedCash !== parsed.cashSales) {
          parsed.cashSales = roundedCash;
          needsSave = true;
        }
      }
      if (parsed.openingFloat && Number(parsed.openingFloat) > 250) {
        const roundedFloat = Math.round(Number(parsed.openingFloat) / 250) * 250;
        if (roundedFloat !== parsed.openingFloat) {
          parsed.openingFloat = roundedFloat;
          needsSave = true;
        }
      }

      // Automatic reconciliation strictly scoped to invoices belonging to THIS exact shiftId
      if (!parsed.cashSales || Number(parsed.cashSales) === 0) {
        const invoices = safeGet<any[]>(KEYS.INVOICES, []);
        const cashSum = invoices
          .filter(
            inv =>
              inv &&
              inv.shiftId === parsed.id &&
              (inv.status === 'paid' || inv.status === 'PAID') &&
              ((inv.paymentMethod || '').toUpperCase() === 'CASH' || !inv.paymentMethod)
          )
          .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
        if (cashSum > 0) {
          parsed.cashSales = cashSum > 250 ? Math.round(cashSum / 250) * 250 : cashSum;
          needsSave = true;
        }
      }

      if (needsSave) {
        try {
          localStorage.setItem(KEYS.ACTIVE_SHIFT, JSON.stringify(parsed));
        } catch {}
      }

      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredActiveShift(shift: ActiveShift | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (shift) {
      localStorage.setItem(KEYS.ACTIVE_SHIFT, JSON.stringify(shift));
    } else {
      localStorage.removeItem(KEYS.ACTIVE_SHIFT);
    }
    window.dispatchEvent(new CustomEvent('erp_active_shift_updated', { detail: shift }));
  } catch (e) {
    console.error(e);
  }
}

export function recordTreasuryInflow(method: string, amount: number, preferredAccountId?: string): void {
  const normMethod = (method || '').toUpperCase();
  const numAmount = Number(amount) || 0;
  if (numAmount <= 0) return;

  const accounts = getStoredTreasuryAccounts();
  const isCash = normMethod === 'CASH' || normMethod === 'نقد' || normMethod === 'نقداً';
  const targetId = preferredAccountId
    ? preferredAccountId
    : isCash
    ? 'ACC-01'
    : (accounts.find(a => a.type === 'BANK')?.id || 'ACC-01');
  let matched = false;

  const updated = accounts.map(acc => {
    if (acc.id === targetId || (!matched && !preferredAccountId && isCash && (acc.type === 'CASH' || acc.id === 'ACC-01'))) {
      matched = true;
      const isLargeIqd = numAmount > 10000;
      const addedIqd = isLargeIqd ? numAmount : Math.round(numAmount * 1520);
      const addedUsd = isLargeIqd ? Math.round(numAmount / 1520) : numAmount;
      return {
        ...acc,
        balanceIqd: (Number(acc.balanceIqd) || 0) + addedIqd,
        balanceUsd: (Number(acc.balanceUsd) || 0) + addedUsd
      };
    }
    return acc;
  });

  saveStoredTreasuryAccounts(updated);
}

/**
 * Deducts cash/bank outflow from Treasury (used for partner withdrawals/payouts, NOT logged as store expense).
 */
export function recordTreasuryOutflow(method: string, amount: number, preferredAccountId?: string): void {
  const normMethod = (method || '').toUpperCase();
  const numAmount = Number(amount) || 0;
  if (numAmount <= 0) return;

  const accounts = getStoredTreasuryAccounts();
  const isCash = normMethod === 'CASH' || normMethod === 'نقد' || normMethod === 'نقداً';
  const targetId = preferredAccountId
    ? preferredAccountId
    : isCash
    ? 'ACC-01'
    : (accounts.find(a => a.type === 'BANK')?.id || 'ACC-01');
  let matched = false;

  const updated = accounts.map(acc => {
    if (acc.id === targetId || (!matched && !preferredAccountId && isCash && (acc.type === 'CASH' || acc.id === 'ACC-01'))) {
      matched = true;
      const isLargeIqd = numAmount > 10000;
      const deductIqd = isLargeIqd ? numAmount : Math.round(numAmount * 1520);
      const deductUsd = isLargeIqd ? Math.round(numAmount / 1520) : numAmount;
      return {
        ...acc,
        balanceIqd: Math.max(0, (Number(acc.balanceIqd) || 0) - deductIqd),
        balanceUsd: Math.max(0, (Number(acc.balanceUsd) || 0) - deductUsd)
      };
    }
    return acc;
  });

  saveStoredTreasuryAccounts(updated);
}

/**
 * Transfers POS cash drawer balance to the Main Safe (ACC-01) upon closing the shift / Z-Report.
 */
export function transferShiftDrawerToMainSafe(amount: number): void {
  const numAmount = Number(amount) || 0;
  if (numAmount <= 0) return;
  recordTreasuryInflow('CASH', numAmount, 'ACC-01');
}

export function recordShiftSale(method: string, amount: number, targetShiftId?: string): void {
  const normMethod = (method || '').toUpperCase();
  const numAmount = Number(amount) || 0;
  if (numAmount <= 0) return;

  // POS Cash stays strictly inside the Shift Drawer until Shift Close / Z-Report
  const current = getStoredActiveShift();
  if (current && (!targetShiftId || current.id === targetShiftId)) {
    if (normMethod === 'CASH' || normMethod === 'نقد' || normMethod === 'نقداً') {
      const isIqdCash = numAmount >= 250;
      const cashAddition = isIqdCash ? Math.round(numAmount / 250) * 250 : numAmount;
      const totalCash = (Number(current.cashSales) || 0) + cashAddition;
      current.cashSales = isIqdCash ? Math.round(totalCash / 250) * 250 : totalCash;
    } else if (normMethod === 'CARD' || normMethod === 'بطاقة') {
      current.cardSales = (Number(current.cardSales) || 0) + numAmount;
    } else if (normMethod === 'ZAIN_CASH' || normMethod === 'زين كاش') {
      current.zainCashSales = (Number(current.zainCashSales) || 0) + numAmount;
    } else if (normMethod === 'QI_CARD' || normMethod === 'كي كارد') {
      current.qiCardSales = (Number(current.qiCardSales) || 0) + numAmount;
    }
    saveStoredActiveShift(current);
  }
}

export interface LocalShiftBreakdown {
  invoices: SalesInvoice[];
  expenses: QuickExpenseRecord[];
  cashSales: number;
  cardSales: number;
  zainCashSales: number;
  qiCardSales: number;
  pettyExpenses: number;
}

export function getLocalShiftBreakdown(shiftId: string): LocalShiftBreakdown {
  if (!shiftId) {
    return {
      invoices: [],
      expenses: [],
      cashSales: 0,
      cardSales: 0,
      zainCashSales: 0,
      qiCardSales: 0,
      pettyExpenses: 0
    };
  }

  const allInvoices = getStoredInvoices();
  const shiftInvoices = allInvoices.filter(
    inv =>
      inv &&
      inv.shiftId === shiftId &&
      (inv.status === 'paid' || (inv.status as string) === 'PAID')
  );

  const allExpenses = getStoredQuickExpenses();
  const shiftExpenses = allExpenses.filter(exp => exp && exp.shiftId === shiftId);

  let cashSales = 0;
  let cardSales = 0;
  let zainCashSales = 0;
  let qiCardSales = 0;

  for (const inv of shiftInvoices) {
    const amt = Number(inv.total) || 0;
    const method = (inv.paymentMethod || 'cash').toUpperCase();
    if (method === 'CARD' || method === 'CREDIT_CARD') {
      cardSales += amt;
    } else if (method === 'ZAIN_CASH') {
      zainCashSales += amt;
    } else if (method === 'QI_CARD') {
      qiCardSales += amt;
    } else if (method === 'CASH') {
      cashSales += amt;
    }
  }

  const pettyExpenses = shiftExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  return {
    invoices: shiftInvoices,
    expenses: shiftExpenses,
    cashSales,
    cardSales,
    zainCashSales,
    qiCardSales,
    pettyExpenses
  };
}

export function getStoredPastShifts(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEYS.SHIFTS_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredPastShifts(shifts: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEYS.SHIFTS_HISTORY, JSON.stringify(shifts));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredLastPosTerminal(defaultTerminal = 'كاشير 1'): string {
  if (typeof window === 'undefined') return defaultTerminal;
  try {
    const saved = localStorage.getItem(KEYS.POS_LAST_TERMINAL);
    return saved && saved.trim() ? saved.trim() : defaultTerminal;
  } catch {
    return defaultTerminal;
  }
}

export function saveStoredLastPosTerminal(terminalId: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = terminalId.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(KEYS.POS_LAST_TERMINAL, trimmed);
  } catch (e) {
    console.error(e);
  }
}

export function getAvailablePosTerminals(presets: string[] = ['كاشير 1', 'كاشير 2', 'كاشير 3']): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const addUnique = (val?: string | null) => {
    const trimmed = val?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  };

  const savedLast = getStoredLastPosTerminal('');
  addUnique(savedLast);
  presets.forEach(addUnique);

  const active = getStoredActiveShift();
  addUnique(active?.terminalId);

  const past = getStoredPastShifts();
  if (Array.isArray(past)) {
    past.forEach((s: any) => addUnique(s?.terminalId));
  }

  return result;
}

// --- DOMAIN HELPERS FOR STRICT MULTI-TENANCY ---
export function getStoredTreasuryAccounts(): any[] {
  const existing = safeGet<any[] | null>(KEYS.TREASURY_ACCOUNTS, null);
  const invoices = safeGet<any[]>(KEYS.INVOICES, []);
  const paidCashSum = invoices
    .filter(inv => inv && (inv.status === 'paid' || inv.status === 'PAID') && ((inv.paymentMethod || '').toUpperCase() === 'CASH' || !inv.paymentMethod))
    .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

  if (existing && Array.isArray(existing) && existing.length > 0) {
    let modified = false;
    const normalized = existing.map(acc => {
      let updated = { ...acc };
      if (acc.id === 'ACC-01') {
        if (acc.name?.includes('صندوق') || !acc.nameEn) {
          updated.name = 'Main Cash Safe';
          updated.nameAr = 'صندوق الكاش الرئيسي';
          updated.nameEn = 'Main Cash Safe';
          modified = true;
        }
        // Self-heal: If cash safe balance is 0 but there are recorded cash sales
        if ((!updated.balanceIqd || Number(updated.balanceIqd) === 0) && paidCashSum > 0) {
          updated.balanceIqd = paidCashSum;
          updated.balanceUsd = Math.round(paidCashSum / 1520);
          modified = true;
        }
      }
      return updated;
    });
    if (modified) {
      safeSet(KEYS.TREASURY_ACCOUNTS, normalized);
    }
    return normalized;
  }
  const defaultAccounts = [
    { 
      id: 'ACC-01', 
      name: 'Main Cash Safe', 
      nameAr: 'صندوق الكاش الرئيسي', 
      nameEn: 'Main Cash Safe', 
      type: 'CASH', 
      balanceUsd: paidCashSum > 0 ? Math.round(paidCashSum / 1520) : 0, 
      balanceIqd: paidCashSum, 
      currency: 'IQD' 
    },
    {
      id: 'ACC-02',
      name: 'Primary Bank Account',
      nameAr: 'الحساب البنكي الرئيسي',
      nameEn: 'Primary Bank Account',
      type: 'BANK',
      balanceUsd: 0,
      balanceIqd: 0,
      currency: 'IQD'
    }
  ];
  safeSet(KEYS.TREASURY_ACCOUNTS, defaultAccounts);
  return defaultAccounts;
}

export function saveStoredTreasuryAccounts(accounts: any[]): void {
  safeSet(KEYS.TREASURY_ACCOUNTS, accounts);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erp_treasury_updated', { detail: accounts }));
  }
}

export function getStoredTreasuryVouchers(): any[] {
  const existing = safeGet<any[] | null>(KEYS.TREASURY_VOUCHERS, null);
  return existing || [];
}

export function saveStoredTreasuryVouchers(vouchers: any[]): void {
  safeSet(KEYS.TREASURY_VOUCHERS, vouchers);
}

export function normalizeLoyaltyPhone(phone?: string | null): string {
  if (!phone) return '';
  const converted = String(phone)
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\D/g, '');
  if (!converted) return '';
  if (converted.startsWith('00964')) return converted.slice(5);
  if (converted.startsWith('964') && converted.length > 9) return converted.slice(3);
  if (converted.startsWith('0') && converted.length >= 10) return converted.slice(1);
  return converted;
}

const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateLocalCardToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let token = '';
  for (let i = 0; i < bytes.length; i++) {
    token += ALPHANUMERIC_CHARS[bytes[i] % ALPHANUMERIC_CHARS.length];
  }
  return token;
}

export function generateLocalMemberCode(existingCodes: Set<string>): string {
  let candidate = '';
  do {
    candidate = `LOY-${Math.floor(10000 + Math.random() * 90000)}`;
  } while (existingCodes.has(candidate.toUpperCase()));
  existingCodes.add(candidate.toUpperCase());
  return candidate;
}

export function getStoredCustomers(): any[] {
  const existing = safeGet<any[] | null>(KEYS.CUSTOMERS, null);
  if (!existing || !Array.isArray(existing)) return [];

  let changed = false;
  const usedCodes = new Set<string>();
  existing.forEach(c => {
    if (c?.loyaltyMemberCode) usedCodes.add(String(c.loyaltyMemberCode).toUpperCase());
  });

  const normalizedList = existing.map(c => {
    if (!c) return c;
    const isWalkIn = Boolean(
      c.isDefaultCashCustomer ||
      String(c.code || '').toUpperCase() === 'WALK-IN-CASH' ||
      c.id === 'CUST-WALKIN' ||
      c.id === 'WALK_IN'
    );
    if (isWalkIn) return c;

    const normPhone = c.normalizedPhone || normalizeLoyaltyPhone(c.phone);
    let memberCode = c.loyaltyMemberCode;
    let cardToken = c.loyaltyCardToken;

    if (!memberCode) {
      memberCode = generateLocalMemberCode(usedCodes);
      changed = true;
    }
    if (!cardToken) {
      cardToken = generateLocalCardToken();
      changed = true;
    }
    if (normPhone && c.normalizedPhone !== normPhone) {
      changed = true;
    }

    return {
      ...c,
      loyaltyMemberCode: memberCode,
      loyaltyCardToken: cardToken,
      normalizedPhone: normPhone
    };
  });

  if (changed) {
    safeSet(KEYS.CUSTOMERS, normalizedList);
  }

  return normalizedList;
}

export function saveStoredCustomers(customers: any[]): void {
  safeSet(KEYS.CUSTOMERS, customers);
}

export interface CustomerResolutionInput {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  isCreditOrInstallment?: boolean;
  saleAmount?: number;
}

export interface CustomerResolutionResult {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  isDefaultCashCustomer: boolean;
  createdNew: boolean;
}

/**
 * 3-Way Customer Resolution for POS & Sales Invoices:
 * 1) Existing customerId -> validates existence & credit limit, updates debt on credit/installment.
 * 2) Typed customerName (without customerId) -> auto-creates a new persistent Customer profile immediately.
 * 3) Empty input -> rejects Credit/Installment with ERR_CREDIT_SALE_REQUIRES_CUSTOMER, else assigns "عميل نقدي".
 */
export function resolveOrCreateLocalCustomer(input: CustomerResolutionInput): CustomerResolutionResult {
  const customers = getStoredCustomers();
  const saleAmt = Math.max(0, Number(input.saleAmount) || 0);
  const isCredit = Boolean(input.isCreditOrInstallment);
  const trimmedId = (input.customerId || '').trim();

  // Case 1: Selected existing customerId
  if (trimmedId && trimmedId !== 'WALK_IN' && trimmedId !== 'CUST-WALKIN') {
    const idx = customers.findIndex(c => c && c.id === trimmedId);
    if (idx >= 0) {
      const cust = customers[idx];
      if (cust.isDefaultCashCustomer && isCredit) {
        throw new Error('ERR_CREDIT_SALE_REQUIRES_CUSTOMER');
      }
      if (isCredit) {
        const limit = Number(cust.creditLimit) || 0;
        const currBal = Number(cust.currentBalance) || 0;
        if (limit > 0 && currBal + saleAmt > limit) {
          throw new Error('ERR_CREDIT_LIMIT_EXCEEDED');
        }
        customers[idx] = {
          ...cust,
          currentBalance: currBal + saleAmt,
          phone: cust.phone || input.customerPhone || '',
          city: cust.city || input.customerAddress || ''
        };
        saveStoredCustomers(customers);
      }
      return {
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        isDefaultCashCustomer: Boolean(cust.isDefaultCashCustomer),
        createdNew: false
      };
    }
  }

  // Case 2: Typed customer name (creates a new customer automatically on the fly)
  const rawName = (input.customerName || '').trim();
  const lowerName = rawName.toLowerCase();
  const isWalkInAlias =
    !rawName ||
    lowerName === 'عميل نقدي' ||
    lowerName === 'عميل نقدي عام' ||
    lowerName === 'walk-in cash customer' ||
    lowerName === 'retail walk-in customer' ||
    lowerName === 'عميل كاشير مباشر (pos retail)';

  if (!isWalkInAlias) {
    // Re-use if an exact name match exists (case-insensitive), otherwise create a brand-new Customer record
    const exactMatchIdx = customers.findIndex(
      c => c && typeof c.name === 'string' && c.name.trim().toLowerCase() === lowerName
    );
    if (exactMatchIdx >= 0) {
      const existingCust = customers[exactMatchIdx];
      if (isCredit) {
        const limit = Number(existingCust.creditLimit) || 0;
        const currBal = Number(existingCust.currentBalance) || 0;
        if (limit > 0 && currBal + saleAmt > limit) {
          throw new Error('ERR_CREDIT_LIMIT_EXCEEDED');
        }
        customers[exactMatchIdx] = { ...existingCust, currentBalance: currBal + saleAmt };
        saveStoredCustomers(customers);
      }
      return {
        customerId: existingCust.id,
        customerName: existingCust.name,
        customerPhone: existingCust.phone,
        isDefaultCashCustomer: false,
        createdNew: false
      };
    }

    const usedCodes = new Set<string>(
      customers.map(c => String(c?.loyaltyMemberCode || '').toUpperCase()).filter(Boolean)
    );
    const phoneStr = (input.customerPhone || '').trim() || '—';
    const newCustomer = {
      id: `CUST-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      code: `C-${Date.now().toString().slice(-5)}`,
      name: rawName,
      phone: phoneStr,
      normalizedPhone: normalizeLoyaltyPhone(phoneStr),
      city: (input.customerAddress || '').trim() || 'بغداد',
      creditLimit: 0,
      currentBalance: isCredit ? saleAmt : 0,
      loyaltyTier: 'BRONZE' as const,
      loyaltyPoints: 0,
      loyaltyPointsBalance: 0,
      loyaltyMemberCode: generateLocalMemberCode(usedCodes),
      loyaltyCardToken: generateLocalCardToken(),
      isDefaultCashCustomer: false,
      createdAt: new Date().toISOString()
    };
    saveStoredCustomers([newCustomer, ...customers]);

    return {
      customerId: newCustomer.id,
      customerName: newCustomer.name,
      customerPhone: newCustomer.phone,
      isDefaultCashCustomer: false,
      createdNew: true
    };
  }

  // Case 3: Empty -> reject Credit/Installment, or resolve default Walk-In Cash Customer
  if (isCredit) {
    throw new Error('ERR_CREDIT_SALE_REQUIRES_CUSTOMER');
  }

  return {
    customerId: 'CUST-WALKIN',
    customerName: 'عميل نقدي',
    customerPhone: '—',
    isDefaultCashCustomer: true,
    createdNew: false
  };
}

// ============================================================================
// Profit-Based Customer Loyalty Engine (Frontend Sync & Offline Mirror)
// ============================================================================

export interface LoyaltySettingsConfig {
  isLoyaltyEnabled: boolean;
  profitUnitAmount: number;
  pointsEarnedPerUnit: number;
  pointsRedemptionUnit: number;
  currencyValuePerUnit: number;
  minRedeemablePoints: number;
}

export type LoyaltyTransactionType = 'Earned' | 'Redeemed' | 'ReversedOnReturn' | 'ManualAdjustment';

export interface LoyaltyTransactionRecord {
  id: string;
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  returnId?: string;
  rmaNumber?: string;
  type: LoyaltyTransactionType;
  pointsChange: number;
  profitBasis: number;
  balanceAfter: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettingsConfig = {
  isLoyaltyEnabled: true,
  profitUnitAmount: 1000,
  pointsEarnedPerUnit: 10,
  pointsRedemptionUnit: 100,
  currencyValuePerUnit: 1000,
  minRedeemablePoints: 500
};

export function getStoredLoyaltySettings(): LoyaltySettingsConfig {
  const stored = safeGet<Partial<LoyaltySettingsConfig> | null>(KEYS.LOYALTY_SETTINGS, null);
  if (stored && typeof stored.profitUnitAmount === 'number') {
    return { ...DEFAULT_LOYALTY_SETTINGS, ...stored };
  }
  try {
    if (typeof window !== 'undefined') {
      const prefsRaw = localStorage.getItem('zilox_user_preferences');
      if (prefsRaw) {
        const parsed = JSON.parse(prefsRaw);
        if (parsed?.loyaltySettings) {
          return { ...DEFAULT_LOYALTY_SETTINGS, ...parsed.loyaltySettings };
        }
      }
    }
  } catch {}
  return { ...DEFAULT_LOYALTY_SETTINGS };
}

export function saveStoredLoyaltySettings(config: LoyaltySettingsConfig): void {
  safeSet(KEYS.LOYALTY_SETTINGS, config);
  try {
    if (typeof window !== 'undefined') {
      const prefsRaw = localStorage.getItem('zilox_user_preferences');
      const parsed = prefsRaw ? JSON.parse(prefsRaw) : {};
      parsed.loyaltySettings = config;
      localStorage.setItem('zilox_user_preferences', JSON.stringify(parsed));
    }
  } catch {}
}

export function getStoredLoyaltyTransactions(): LoyaltyTransactionRecord[] {
  return safeGet<LoyaltyTransactionRecord[]>(KEYS.LOYALTY_TRANSACTIONS, []);
}

export function saveStoredLoyaltyTransactions(txs: LoyaltyTransactionRecord[]): void {
  safeSet(KEYS.LOYALTY_TRANSACTIONS, txs);
}

export function resolveProductUnitCost(
  product: Partial<Product> | undefined,
  allProducts: Product[],
  storedBundles: ProductBundleItem[]
): number {
  if (!product) return 0;
  const bundleComps = storedBundles.filter(b => b.parentProductId === product.id);
  if (product.isBundle || bundleComps.length > 0) {
    const bundleCost = bundleComps.reduce((sum, bc) => {
      const compProd = allProducts.find(p => p.id === bc.childProductId || (bc.childProductSku && p.sku === bc.childProductSku));
      const unitCost = Number(compProd?.costPrice ?? bc.componentSellingPrice ?? 0) || 0;
      return sum + unitCost * (Number(bc.quantity) || 1);
    }, 0);
    if (bundleCost > 0) return bundleCost;
  }
  return Number(product.costPrice) || 0;
}

export function calculateProfitBasedEarnedPoints(realizedProfit: number, settings: LoyaltySettingsConfig): number {
  if (!settings.isLoyaltyEnabled || realizedProfit <= 0 || settings.profitUnitAmount <= 0 || settings.pointsEarnedPerUnit <= 0) {
    return 0;
  }
  return Math.floor((realizedProfit / settings.profitUnitAmount) * settings.pointsEarnedPerUnit);
}

export function calculateLoyaltyCurrencyEquivalent(points: number, settings: LoyaltySettingsConfig): number {
  if (points <= 0 || settings.pointsRedemptionUnit <= 0 || settings.currencyValuePerUnit <= 0) {
    return 0;
  }
  return Math.round(((points / settings.pointsRedemptionUnit) * settings.currencyValuePerUnit) * 10000) / 10000;
}

export interface LocalCheckoutLoyaltyInput {
  customerId?: string;
  customerName?: string;
  isDefaultCashCustomer?: boolean;
  invoiceId: string;
  invoiceNo: string;
  lineProfitsSum: number;
  invoiceLevelDiscount: number;
  maxRedeemCap: number;
  requestedRedeemPoints: number;
  operator: string;
}

export interface LocalCheckoutLoyaltyOutput {
  pointsEarned: number;
  pointsRedeemed: number;
  loyaltyDiscountAmount: number;
  realizedProfit: number;
  balanceAfter: number;
}

export function applyLocalCheckoutLoyalty(input: LocalCheckoutLoyaltyInput): LocalCheckoutLoyaltyOutput {
  const settings = getStoredLoyaltySettings();
  const customers = getStoredCustomers();
  const isWalkIn = Boolean(
    input.isDefaultCashCustomer ||
    !input.customerId ||
    input.customerId === 'CUST-WALKIN' ||
    input.customerId === 'WALK_IN'
  );

  const custIdx = !isWalkIn ? customers.findIndex(c => c && c.id === input.customerId) : -1;
  const customer = custIdx >= 0 ? customers[custIdx] : null;
  let currentBalance = Number(customer?.loyaltyPointsBalance ?? customer?.loyaltyPoints ?? 0) || 0;

  let redeemedPoints = 0;
  let loyaltyDiscountAmount = 0;
  const reqRedeem = Math.max(0, Number(input.requestedRedeemPoints) || 0);

  if (reqRedeem > 0) {
    if (!settings.isLoyaltyEnabled) {
      throw new Error('ERR_LOYALTY_DISABLED');
    }
    if (isWalkIn || !customer) {
      throw new Error('ERR_LOYALTY_WALKIN_NOT_ALLOWED');
    }
    if (currentBalance < settings.minRedeemablePoints) {
      throw new Error('ERR_BELOW_MIN_REDEEM_POINTS');
    }
    if (reqRedeem > currentBalance) {
      throw new Error('ERR_INSUFFICIENT_LOYALTY_POINTS');
    }

    if (settings.pointsRedemptionUnit > 0 && settings.currencyValuePerUnit > 0 && input.maxRedeemCap > 0) {
      const requestedDiscount = calculateLoyaltyCurrencyEquivalent(reqRedeem, settings);
      loyaltyDiscountAmount = Math.min(requestedDiscount, Math.max(0, input.maxRedeemCap));
      redeemedPoints = requestedDiscount > 0 && loyaltyDiscountAmount < requestedDiscount
        ? Math.round(((loyaltyDiscountAmount / settings.currencyValuePerUnit) * settings.pointsRedemptionUnit) * 10000) / 10000
        : Math.round(reqRedeem * 10000) / 10000;
      redeemedPoints = Math.min(redeemedPoints, currentBalance);
    }
  }

  const realizedProfit = Math.round(Math.max(0, input.lineProfitsSum - (Number(input.invoiceLevelDiscount) || 0) - loyaltyDiscountAmount) * 10000) / 10000;
  const pointsEarned = (settings.isLoyaltyEnabled && !isWalkIn && customer)
    ? calculateProfitBasedEarnedPoints(realizedProfit, settings)
    : 0;

  const newEntries: LoyaltyTransactionRecord[] = [];
  const nowIso = new Date().toISOString();

  if (customer && (redeemedPoints > 0 || pointsEarned > 0)) {
    if (redeemedPoints > 0) {
      currentBalance = Math.round((currentBalance - redeemedPoints) * 10000) / 10000;
      newEntries.push({
        id: `LOY-${Date.now()}-R`,
        customerId: customer.id,
        customerName: customer.name,
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNo,
        type: 'Redeemed',
        pointsChange: -redeemedPoints,
        profitBasis: 0,
        balanceAfter: currentBalance,
        notes: `${redeemedPoints} pts`,
        createdBy: input.operator,
        createdAt: nowIso
      });
    }

    if (pointsEarned > 0) {
      currentBalance = Math.round((currentBalance + pointsEarned) * 10000) / 10000;
      newEntries.push({
        id: `LOY-${Date.now()}-E`,
        customerId: customer.id,
        customerName: customer.name,
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNo,
        type: 'Earned',
        pointsChange: pointsEarned,
        profitBasis: realizedProfit,
        balanceAfter: currentBalance,
        createdBy: input.operator,
        createdAt: new Date(Date.now() + 1).toISOString()
      });
    }

    customers[custIdx] = {
      ...customer,
      loyaltyPoints: currentBalance,
      loyaltyPointsBalance: currentBalance
    };
    saveStoredCustomers(customers);
    saveStoredLoyaltyTransactions([...newEntries.reverse(), ...getStoredLoyaltyTransactions()]);
  }

  return {
    pointsEarned,
    pointsRedeemed: redeemedPoints,
    loyaltyDiscountAmount,
    realizedProfit,
    balanceAfter: currentBalance
  };
}

export function reverseLocalLoyaltyOnReturn(params: {
  rmaId: string;
  rmaNumber: string;
  invoiceNo: string;
  productId?: string;
  sku: string;
  returnQuantity: number;
  operator: string;
}): number {
  const existingLedger = getStoredLoyaltyTransactions();
  if (existingLedger.some(tx => tx.returnId === params.rmaId && tx.type === 'ReversedOnReturn')) {
    return 0;
  }

  const invoices = getStoredInvoices();
  const invoice = invoices.find(inv => inv.invoiceNo === params.invoiceNo || inv.id === params.invoiceNo);
  if (!invoice || !invoice.customerId || invoice.customerId === 'CUST-WALKIN' || !(Number(invoice.loyaltyPointsEarned) > 0)) {
    return 0;
  }

  const customers = getStoredCustomers();
  const custIdx = customers.findIndex(c => c && c.id === invoice.customerId);
  if (custIdx < 0 || customers[custIdx].isDefaultCashCustomer) {
    return 0;
  }

  const customer = customers[custIdx];
  const earnedOnInvoice = Number(invoice.loyaltyPointsEarned) || 0;
  const previouslyReversed = existingLedger
    .filter(tx => tx.invoiceNumber === invoice.invoiceNo && tx.type === 'ReversedOnReturn')
    .reduce((sum, tx) => sum + Math.abs(Number(tx.pointsChange) || 0), 0);
  const remainingEarned = Math.max(0, earnedOnInvoice - previouslyReversed);
  if (remainingEarned <= 0) return 0;

  const products = getStoredProducts();
  const bundles = getStoredProductBundles();
  const invoiceItem = (invoice.items || []).find(
    it => (params.productId && it.productId === params.productId) || (params.sku && it.sku === params.sku)
  );
  const matchedProd = products.find(p => p.id === (invoiceItem?.productId || params.productId) || p.sku === params.sku);
  const returnedUnitCost = resolveProductUnitCost(matchedProd, products, bundles);
  const returnedUnitSell = Number(invoiceItem?.unitPrice ?? matchedProd?.sellingPrice ?? 0);
  const returnedProfit = Math.max(0, (returnedUnitSell - returnedUnitCost) * (Number(params.returnQuantity) || 1));

  const totalLineProfits = (invoice.items || []).reduce((sum, it) => {
    const p = products.find(pr => pr.id === it.productId || pr.sku === it.sku);
    const uc = resolveProductUnitCost(p, products, bundles);
    return sum + Math.max(0, (Number(it.unitPrice) - uc) * Number(it.quantity));
  }, 0);

  let pointsToReverse = totalLineProfits > 0
    ? Math.floor((returnedProfit / totalLineProfits) * earnedOnInvoice)
    : 0;
  if (pointsToReverse <= 0) {
    const settings = getStoredLoyaltySettings();
    pointsToReverse = calculateProfitBasedEarnedPoints(returnedProfit, settings);
  }
  pointsToReverse = Math.min(pointsToReverse, remainingEarned);
  if (pointsToReverse <= 0) return 0;

  const currentBalance = Number(customer.loyaltyPointsBalance ?? customer.loyaltyPoints ?? 0) || 0;
  const nextBalance = Math.round((currentBalance - pointsToReverse) * 10000) / 10000;

  customers[custIdx] = {
    ...customer,
    loyaltyPoints: nextBalance,
    loyaltyPointsBalance: nextBalance
  };
  saveStoredCustomers(customers);

  const txEntry: LoyaltyTransactionRecord = {
    id: `LOY-${Date.now()}-REV`,
    customerId: customer.id,
    customerName: customer.name,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNo,
    returnId: params.rmaId,
    rmaNumber: params.rmaNumber,
    type: 'ReversedOnReturn',
    pointsChange: -pointsToReverse,
    profitBasis: returnedProfit,
    balanceAfter: nextBalance,
    notes: params.rmaNumber,
    createdBy: params.operator,
    createdAt: new Date().toISOString()
  };

  saveStoredLoyaltyTransactions([txEntry, ...existingLedger]);
  return pointsToReverse;
}

export function adjustCustomerLoyaltyPointsLocally(params: {
  customerId: string;
  pointsChange: number;
  notes?: string;
  operator: string;
}): LoyaltyTransactionRecord {
  const customers = getStoredCustomers();
  const idx = customers.findIndex(c => c && c.id === params.customerId);
  if (idx < 0) throw new Error('ERR_CUSTOMER_NOT_FOUND');
  if (customers[idx].isDefaultCashCustomer) throw new Error('ERR_LOYALTY_WALKIN_NOT_ALLOWED');

  const currentBalance = Number(customers[idx].loyaltyPointsBalance ?? customers[idx].loyaltyPoints ?? 0) || 0;
  const nextBalance = Math.round((currentBalance + params.pointsChange) * 10000) / 10000;
  customers[idx] = {
    ...customers[idx],
    loyaltyPoints: nextBalance,
    loyaltyPointsBalance: nextBalance
  };
  saveStoredCustomers(customers);

  const entry: LoyaltyTransactionRecord = {
    id: `LOY-${Date.now()}-ADJ`,
    customerId: customers[idx].id,
    customerName: customers[idx].name,
    type: 'ManualAdjustment',
    pointsChange: Math.round(params.pointsChange * 10000) / 10000,
    profitBasis: 0,
    balanceAfter: nextBalance,
    notes: params.notes || 'Manual adjustment',
    createdBy: params.operator,
    createdAt: new Date().toISOString()
  };
  saveStoredLoyaltyTransactions([entry, ...getStoredLoyaltyTransactions()]);
  return entry;
}

export function getStoredRMA(): any[] {
  const existing = safeGet<any[] | null>(KEYS.RMA, null);
  return existing || [];
}

export function saveStoredRMA(items: any[]): void {
  safeSet(KEYS.RMA, items);
}

export interface ReturnableInvoiceItem {
  itemId: string;
  productId: string;
  productName: string;
  sku: string;
  serialNumber: string;
  requiresSerialNumber?: boolean;
  soldSerialNumbers?: string[];
  warehouseId?: string;
  warehouseName?: string;
  soldQty: number;
  alreadyReturnedQty: number;
  remainingReturnableQty: number;
  unitPrice: number;
  currency: string;
  warrantyExpiresAt: string;
  isUnderWarranty: boolean;
}

/**
 * Calculates returnable items strictly from an invoice's sold line items,
 * subtracting previously approved/pending RMA quantities and computing warranty status.
 */
export function getInvoiceReturnableItems(invoiceNoOrId: string): ReturnableInvoiceItem[] {
  if (!invoiceNoOrId) return [];

  const invoices = getStoredInvoices();
  const invoice = invoices.find(i => i.invoiceNo === invoiceNoOrId || i.id === invoiceNoOrId);
  if (!invoice) return [];

  const warehouses = getStoredWarehouses();
  const matchedWarehouse = warehouses.find(
    w =>
      w.nameAr === invoice.warehouseName ||
      w.nameEn === invoice.warehouseName ||
      w.id === invoice.warehouseName ||
      w.code === invoice.warehouseName
  ) || warehouses.find(w => (w as any).isActive !== false) || warehouses[0];

  const existingRmas = getStoredRMA();
  const now = new Date();
  
  // Warranty period: 12 months from invoice date
  const invoiceDate = invoice.date ? new Date(invoice.date) : new Date();
  const warrantyExpires = new Date(invoiceDate);
  warrantyExpires.setMonth(warrantyExpires.getMonth() + 12);
  const isUnderWarranty = now <= warrantyExpires;

  // Determine invoice currency
  const isIqd = (invoice.total && invoice.total > 10000) || 
                (invoice.items && invoice.items.some(it => it.unitPrice > 500));
  const currency = isIqd ? 'IQD' : 'USD';

  // If invoice has line items, compute eligibility per item
  const allProducts = getStoredProducts();
  const allSerials = getStoredProductSerials();
  if (invoice.items && invoice.items.length > 0) {
    return invoice.items.map((item, idx) => {
      const returnedQty = existingRmas
        .filter(r => (r.originalInvoiceNo === invoice.invoiceNo || r.invoiceId === invoice.id)
                     && (r.sku === item.sku || r.productId === item.productId)
                     && r.decision !== 'REJECTED')
        .reduce((sum, r) => sum + (Number(r.returnQuantity) || 1), 0);

      const soldQty = Number(item.quantity) || 1;
      const remaining = Math.max(0, soldQty - returnedQty);
      const matchedProduct = allProducts.find(p => p.id === item.productId || p.sku === item.sku);
      const soldSerialsForLine = allSerials
        .filter(s => s.status === 'Sold'
          && (s.salesInvoiceNo === invoice.invoiceNo || s.salesInvoiceNumber === invoice.invoiceNo || s.salesInvoiceId === invoice.id)
          && (s.productId === item.productId || s.productSku === item.sku))
        .map(s => s.serialNumber);

      const prodMonths = Number(matchedProduct?.warrantyMonths) || 0;
      const itemWarrantyExp = new Date(invoiceDate);
      if (prodMonths > 0) itemWarrantyExp.setMonth(itemWarrantyExp.getMonth() + prodMonths);
      const itemUnderWarranty = prodMonths > 0 && now <= itemWarrantyExp;

      return {
        itemId: item.id || `ITEM-${idx}`,
        productId: item.productId || item.sku,
        productName: item.nameAr || item.nameEn || 'صنف مباع',
        sku: item.sku,
        serialNumber: soldSerialsForLine[0] || (item as any).serialNumber || '',
        requiresSerialNumber: Boolean(matchedProduct?.requiresSerialNumber),
        soldSerialNumbers: soldSerialsForLine,
        warehouseId: matchedWarehouse?.id,
        warehouseName: invoice.warehouseName || matchedWarehouse?.nameAr || matchedWarehouse?.nameEn || '',
        soldQty,
        alreadyReturnedQty: returnedQty,
        remainingReturnableQty: remaining,
        unitPrice: Number(item.unitPrice) || 0,
        currency,
        warrantyExpiresAt: itemWarrantyExp.toISOString().split('T')[0],
        isUnderWarranty: itemUnderWarranty
      };
    });
  }

  // Fallback for legacy single-item / POS summary invoices
  const singleReturned = existingRmas
    .filter(r => (r.originalInvoiceNo === invoice.invoiceNo || r.invoiceId === invoice.id) && r.decision !== 'REJECTED')
    .reduce((sum, r) => sum + (Number(r.returnQuantity) || 1), 0);

  const fallbackSold = Number(invoice.itemsCount) || 1;
  const fallbackRemaining = Math.max(0, fallbackSold - singleReturned);

  return [{
    itemId: `ITEM-${invoice.id}`,
    productId: 'PROD-GENERAL',
    productName: invoice.customerName ? `مشتريات ${invoice.customerName}` : 'بضاعة الفاتورة',
    sku: 'SKU-INVOICE',
    serialNumber: '',
    warehouseId: matchedWarehouse?.id,
    warehouseName: invoice.warehouseName || matchedWarehouse?.nameAr || matchedWarehouse?.nameEn || '',
    soldQty: fallbackSold,
    alreadyReturnedQty: singleReturned,
    remainingReturnableQty: fallbackRemaining,
    unitPrice: Number(invoice.total) || 0,
    currency,
    warrantyExpiresAt: warrantyExpires.toISOString().split('T')[0],
    isUnderWarranty
  }];
}

/**
 * Validates RMA return parameters against invoice line items and remaining quotas.
 */
export function validateRmaReturn(
  invoiceNo: string,
  sku: string,
  returnQty: number
): { isValid: boolean; message?: string } {
  const returnables = getInvoiceReturnableItems(invoiceNo);
  const matched = returnables.find(it => it.sku === sku);

  if (!matched) {
    return {
      isValid: false,
      message: 'الصنف المحدد غير موجود ضمن بنود هذه الفاتورة الأصلية.'
    };
  }

  if (returnQty <= 0) {
    return {
      isValid: false,
      message: 'يجب أن تكون كمية الإرجاع قطعة واحدة على الأقل.'
    };
  }

  if (returnQty > matched.remainingReturnableQty) {
    return {
      isValid: false,
      message: `الكمية المطلوبة (${returnQty}) تتجاوز المتاح للإرجاع من هذا الصنف (${matched.remainingReturnableQty} قطعة).`
    };
  }

  return { isValid: true };
}

export interface SalesReturnRestockRequest {
  rmaId: string;
  rmaNumber: string;
  invoiceNo: string;
  productId?: string;
  sku: string;
  productName: string;
  returnQuantity: number;
  warehouseId?: string;
  warehouseName?: string;
  customerName?: string;
  serialNumber?: string;
  operator?: string;
}

export interface SalesReturnRestockResult {
  updatedProducts: Product[];
  createdTransactions: TransactionDetail[];
  restockedWarehouseName: string;
  reversedLoyaltyPoints: number;
}

/**
 * Atomically increments local warehouse inventory upon Sales Return (RMA) approval/restock:
 * - Expands Product Bundles into underlying physical component SKUs.
 * - Restores Serial/IMEI status back from Sold to InStock when present.
 * - Logs an Inbound SalesReturn TransactionDetail audit movement.
 */
export function executeSalesReturnRestock(req: SalesReturnRestockRequest): SalesReturnRestockResult {
  const storedProducts = getStoredProducts();
  const updatedProducts = [...storedProducts];
  const storedBundles = getStoredProductBundles();
  const warehouses = getStoredWarehouses();

  const resolvedWarehouse =
    warehouses.find(w => req.warehouseId && (w.id === req.warehouseId || w.code === req.warehouseId)) ||
    warehouses.find(w => req.warehouseName && (w.nameAr === req.warehouseName || w.nameEn === req.warehouseName)) ||
    warehouses.find(w => (w as any).isActive !== false) ||
    warehouses[0];

  const effectiveWarehouseName = resolvedWarehouse?.nameAr || req.warehouseName || 'المستودع الرئيسي';
  const matchedProduct = updatedProducts.find(
    p => (req.productId && p.id === req.productId) || (req.sku && p.sku === req.sku)
  );

  const qty = Math.max(1, Number(req.returnQuantity) || 1);
  const bundleComponents = matchedProduct
    ? storedBundles.filter(b => b.parentProductId === matchedProduct.id)
    : [];
  const isBundle = Boolean(matchedProduct?.isBundle) || bundleComponents.length > 0;

  const restockTargets: Array<{ product: Product | undefined; qty: number }> = isBundle
    ? bundleComponents.map(bc => ({
        product: updatedProducts.find(
          p => !p.isBundle && (p.id === bc.childProductId || (bc.childProductSku && p.sku === bc.childProductSku))
        ),
        qty: Math.ceil((Number(bc.quantity) || 1) * qty)
      }))
    : [{ product: matchedProduct, qty }];

  const newTransactions: TransactionDetail[] = [];
  const nowStr = new Date().toISOString().split('T')[0];

  for (const target of restockTargets) {
    if (!target.product || target.product.isBundle) continue;
    const pIndex = updatedProducts.findIndex(p => p.id === target.product!.id);
    if (pIndex < 0) continue;

    const prod = updatedProducts[pIndex];
    const prevStock = Number(prod.currentStock) || 0;
    const newStock = prevStock + target.qty;

    updatedProducts[pIndex] = {
      ...prod,
      currentStock: newStock,
      status: newStock <= 0 ? 'out_of_stock' : newStock <= (prod.minStockAlert || 5) ? 'low' : 'available',
      updatedAt: nowStr
    };

    const nowIso = new Date().toISOString();
    newTransactions.push({
      id: getNextTransactionId(newTransactions.length),
      timestamp: nowIso,
      movementDate: nowIso,
      createdAt: nowIso,
      date: nowIso,
      type: 'Inbound',
      status: 'SalesReturn',
      sku: prod.sku,
      productName: isBundle ? `${prod.nameAr} (${req.productName})` : prod.nameAr,
      qty: target.qty,
      unit: prod.unit || 'قطعة',
      unitCost: prod.costPrice,
      location: effectiveWarehouseName,
      fromLocation: req.customerName || req.invoiceNo,
      toLocation: effectiveWarehouseName,
      referenceNo: req.rmaNumber,
      operator: req.operator || 'مسؤول المرتجعات'
    });
  }

  // Update Product Serial / IMEI status to Returned upon RMA restock
  if (req.serialNumber && req.serialNumber !== 'N/A') {
    const cleanSerial = req.serialNumber.trim().toLowerCase();
    const serials = getStoredProductSerials();
    let changed = false;
    const updatedSerials = serials.map(s => {
      if (s.serialNumber.trim().toLowerCase() === cleanSerial) {
        changed = true;
        return {
          ...s,
          status: 'Returned' as const,
          warehouseId: resolvedWarehouse?.id || s.warehouseId,
          warehouseName: effectiveWarehouseName,
          warrantyStartDate: undefined,
          warrantyEndDate: undefined,
          warrantyStatus: 'NotStarted' as const,
          isWarrantyActive: false
        };
      }
      return s;
    });
    if (changed) {
      saveStoredProductSerials(updatedSerials);
    }
  }

  if (newTransactions.length > 0) {
    saveStoredProducts(updatedProducts);
    const existingTxs = getStoredTransactions();
    saveStoredTransactions([...newTransactions, ...existingTxs]);
  }

  const reversedLoyaltyPoints = reverseLocalLoyaltyOnReturn({
    rmaId: req.rmaId,
    rmaNumber: req.rmaNumber,
    invoiceNo: req.invoiceNo,
    productId: req.productId,
    sku: req.sku,
    returnQuantity: qty,
    operator: req.operator || 'مسؤول المرتجعات'
  });

  return {
    updatedProducts,
    createdTransactions: newTransactions,
    restockedWarehouseName: effectiveWarehouseName,
    reversedLoyaltyPoints
  };
}

export function getStoredDeliveries(): any[] {
  const existing = safeGet<any[] | null>(KEYS.DELIVERIES, null);
  return existing || [];
}

export function saveStoredDeliveries(items: any[]): void {
  safeSet(KEYS.DELIVERIES, items);
}

export function getStoredTransfers(): any[] {
  const existing = safeGet<any[] | null>(KEYS.TRANSFERS, null);
  return existing || [];
}

export function saveStoredTransfers(items: any[]): void {
  safeSet(KEYS.TRANSFERS, items);
}

const isLegacyDemoPO = (po: any): boolean => {
  if (!po) return true;
  const id = String(po.id || '');
  const poNum = String(po.poNumber || '');
  const supplier = String(po.supplierName || '');
  if (id === 'PO-01' || id === 'PO-02' || id === 'PO-03') return true;
  if (poNum === 'PO-2026-0410' || poNum === 'PO-2026-0409' || poNum === 'PO-2026-0412' || poNum.startsWith('PO-2026-04')) return true;
  if (supplier.includes('التقنية') || supplier.includes('النور') || supplier.includes('الشرق الأوسط')) return true;
  return false;
};

export function getStoredPurchaseOrders(): any[] {
  // Purge any legacy demo POs from all localStorage keys on access
  if (typeof window !== 'undefined') {
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k && (k.includes('po_list') || k.includes('PO_LIST') || k.includes('purchase_order'))) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const cleaned = parsed.filter((po: any) => !isLegacyDemoPO(po));
              if (cleaned.length !== parsed.length) {
                localStorage.setItem(k, JSON.stringify(cleaned));
              }
            }
          }
        }
      }
    } catch {}
  }

  const existing = safeGet<any[] | null>(KEYS.PO_LIST, null);
  if (!existing || !Array.isArray(existing)) return [];

  const cleaned = existing.filter((po: any) => !isLegacyDemoPO(po));

  if (cleaned.length !== existing.length) {
    safeSet(KEYS.PO_LIST, cleaned);
  }

  return cleaned;
}

export function saveStoredPurchaseOrders(items: any[]): void {
  safeSet(KEYS.PO_LIST, items);
}

// =========================================================================
// STOCK ADJUSTMENT AUDIT ENGINE
// =========================================================================

export interface StockAdjustmentData {
  productId: string;
  warehouseId: string;
  adjustmentType: 'SURPLUS' | 'DEFICIT' | 'DAMAGED';
  quantity: number;
  reason: string;
  notes?: string;
  operator?: string;
}

export interface StockAdjustmentRecord {
  id: string;
  transactionId: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  adjustmentType: 'SURPLUS' | 'DEFICIT' | 'DAMAGED';
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: string;
  notes?: string;
  operator: string;
  createdAt: string;
}

export const STOCK_ADJUSTMENT_REASONS = [
  { code: 'DAMAGED_IN_TRANSIT', labelAr: 'تلف أثناء النقل أو العرض', labelEn: 'Damaged during transit or showroom display' },
  { code: 'PHYSICAL_COUNT_DEFICIT', labelAr: 'عجز ناتج عن جرد فعلي', labelEn: 'Deficit from physical stock count' },
  { code: 'EXPIRED_UNSELLABLE', labelAr: 'بضاعة منتهية الصلاحية / غير صالحة للبيع', labelEn: 'Expired or unsellable stock' },
  { code: 'DATA_ENTRY_CORRECTION', labelAr: 'تصحيح خطأ إدخال سابق', labelEn: 'Correction of previous entry error' },
  { code: 'PROMOTIONAL_INTERNAL_USE', labelAr: 'عينة ترويجية / استخدام داخلي', labelEn: 'Promotional sample or internal use' },
] as const;

export function getStoredStockAdjustments(): StockAdjustmentRecord[] {
  const existing = safeGet<StockAdjustmentRecord[] | null>(KEYS.STOCK_ADJUSTMENTS, null);
  return existing || [];
}

export function saveStoredStockAdjustments(items: StockAdjustmentRecord[]): void {
  safeSet(KEYS.STOCK_ADJUSTMENTS, items);
}

export async function executeStockAdjustment(data: StockAdjustmentData): Promise<{
  success: boolean;
  updatedProduct: Product;
  transaction: TransactionDetail;
  record: StockAdjustmentRecord;
}> {
  if (!data.productId) throw new Error('يجب تحديد الصنف المراد تسويته.');
  if (!data.warehouseId) throw new Error('يجب تحديد المستودع المعني بالحركة.');
  if (data.quantity <= 0) throw new Error('يجب أن تكون كمية التسوية رقماً موجباً أكبر من صفر.');
  if (!data.reason || !data.reason.trim()) throw new Error('سبب التسوية المخزنية إجباري ومطلوب لتوثيق الحركة.');

  const products = getStoredProducts();
  const prodIndex = products.findIndex(p => p.id === data.productId || p.sku === data.productId);
  if (prodIndex === -1) {
    throw new Error('الصنف المحدد غير موجود في قاعدة بيانات المخزون.');
  }

  const prod = products[prodIndex];
  const warehouses = getStoredWarehouses();
  const activeWarehouses = warehouses.filter(w => (w as any).isActive !== false && w.status !== 'maintenance');
  const wh = activeWarehouses.find(w => w.id === data.warehouseId || w.code === data.warehouseId);
  if (!wh) {
    throw new Error('المستودع المحدد غير موجود أو تم تعطيله. يرجى اختيار مستودع نشط.');
  }
  const warehouseName = wh.nameAr || (prod.warehouseName || 'المستودع الرئيسي');

  const previousStock = Number(prod.currentStock || 0);

  // Validate deficit/damaged
  if (data.adjustmentType === 'DEFICIT' || data.adjustmentType === 'DAMAGED') {
    if (previousStock < data.quantity) {
      throw new Error(`الرصيد المتاح حالياً في المخزن (${previousStock}) غير كافٍ لإجراء خصم/تلف بمقدار (${data.quantity}).`);
    }
  }

  const quantityDelta = data.adjustmentType === 'SURPLUS' ? data.quantity : -data.quantity;
  const newStock = Math.max(0, previousStock + quantityDelta);

  const updatedProduct: Product = {
    ...prod,
    currentStock: newStock,
    status: newStock <= 0 ? 'out_of_stock' : newStock <= (prod.minStockAlert || 5) ? 'low' : 'available',
    updatedAt: new Date().toISOString().slice(0, 10)
  };

  products[prodIndex] = updatedProduct;
  saveStoredProducts(products);

  // Create immutable transaction detail in ledger
  const txId = getNextTransactionId();
  const nowIso = new Date().toISOString();
  const tx: TransactionDetail = {
    id: txId,
    timestamp: nowIso,
    movementDate: nowIso,
    createdAt: nowIso,
    date: nowIso,
    type: 'Adjustment',
    status: 'Received',
    sku: prod.sku,
    productName: prod.nameAr,
    qty: quantityDelta,
    unit: prod.unit || 'قطعة',
    unitCost: prod.costPrice,
    location: warehouseName,
    fromLocation: data.adjustmentType !== 'SURPLUS' ? warehouseName : data.reason,
    toLocation: data.adjustmentType === 'SURPLUS' ? warehouseName : data.reason,
    referenceNo: `ADJ-${Date.now().toString().slice(-6)}`,
    operator: data.operator || 'أمين المستودع'
  };

  const storedTxs = getStoredTransactions();
  saveStoredTransactions([tx, ...storedTxs]);

  // Create audit adjustment record
  const record: StockAdjustmentRecord = {
    id: `ADJ-REC-${Date.now()}`,
    transactionId: tx.id,
    productId: prod.id,
    productName: prod.nameAr,
    sku: prod.sku,
    warehouseId: data.warehouseId,
    warehouseName,
    adjustmentType: data.adjustmentType,
    quantityChange: quantityDelta,
    previousStock,
    newStock,
    reason: data.reason,
    notes: data.notes,
    operator: data.operator || 'أمين المستودع',
    createdAt: new Date().toISOString()
  };

  const storedAdjustments = getStoredStockAdjustments();
  saveStoredStockAdjustments([record, ...storedAdjustments]);

  // Async sync to Backend API if available
  try {
    fetch('/api/inventory/adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: prod.id,
        warehouseId: data.warehouseId,
        adjustmentType: data.adjustmentType,
        quantity: data.quantity,
        reason: data.reason,
        notes: data.notes
      })
    }).catch(() => {
      // Backend offline: safely handled via local ledger
    });
  } catch {
    // Silent offline catch
  }

  return {
    success: true,
    updatedProduct,
    transaction: tx,
    record
  };
}

// ======================================================================
// EMPLOYEE STATEMENT OF ACCOUNT (LEDGER & STATEMENT CALCULATION)
// ======================================================================

export interface StatementLineItemDto {
  transactionId: string;
  transactionDate: string;
  referenceNumber: string;
  transactionType: string; // سلفة نقدية، راتب شهري، عمولة مبيعات، خصم، عجز وردية
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface EmployeeStatementDto {
  employeeId: string;
  employeeName: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  items: StatementLineItemDto[];
}

export function getStoredEmployeeTransactions(employeeId: string, _employeeName = 'موظف'): StatementLineItemDto[] {
  const allStored = safeGet<Record<string, StatementLineItemDto[]> | null>(KEYS.EMPLOYEE_TRANSACTIONS, null) || {};
  if (allStored[employeeId] && Array.isArray(allStored[employeeId])) {
    // Purge any dummy test constants from stored cache
    const dummyRefs = new Set(['ADV-2026-102', 'COM-2026-044', 'DED-2026-019', 'SFT-2026-009']);
    const cleanItems = allStored[employeeId].filter(t => 
      !dummyRefs.has(t.referenceNumber) &&
      !t.referenceNumber?.startsWith('SAL-2026') &&
      !t.description?.includes('سلفة نقدية عاجلة على حساب الراتب') &&
      !t.description?.includes('حافز وعمولة تحقيق تارجت') &&
      !t.description?.includes('استحقاق الراتب الأساسي لشهر') &&
      !t.description?.includes('تسوية فارق ونقص صندوق كاشير') &&
      !t.description?.includes('خصم تأخير ومخالفة إدارية')
    );
    if (cleanItems.length !== allStored[employeeId].length) {
      allStored[employeeId] = cleanItems;
      safeSet(KEYS.EMPLOYEE_TRANSACTIONS, allStored);
    }
    return cleanItems;
  }

  return [];
}

export function saveStoredEmployeeTransaction(
  employeeId: string, 
  item: Omit<StatementLineItemDto, 'runningBalance'>
): StatementLineItemDto {
  const allStored = safeGet<Record<string, StatementLineItemDto[]> | null>(KEYS.EMPLOYEE_TRANSACTIONS, null) || {};
  const current = allStored[employeeId] || [];

  const newItem: StatementLineItemDto = {
    ...item,
    runningBalance: 0 // Will be recalculated by statement logic
  };

  const updated = [...current, newItem];
  allStored[employeeId] = updated;
  safeSet(KEYS.EMPLOYEE_TRANSACTIONS, allStored);

  // Background API sync
  try {
    fetch(`/api/v1/employees/${employeeId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    }).catch(() => {});
  } catch {}

  return newItem;
}

export function calculateEmployeeStatement(
  employeeId: string,
  employeeName: string,
  filterType: 'daily' | 'monthly' | 'custom' = 'monthly',
  date?: string,
  year?: number,
  month?: number,
  fromDateStr?: string,
  toDateStr?: string
): EmployeeStatementDto {
  const allTransactions = getStoredEmployeeTransactions(employeeId, employeeName);

  const now = new Date();
  let start: Date;
  let end: Date;

  if (filterType === 'daily') {
    const d = date ? new Date(date) : new Date();
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  } else if (filterType === 'custom') {
    start = fromDateStr ? new Date(`${fromDateStr}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
    end = toDateStr ? new Date(`${toDateStr}T23:59:59.999`) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    // monthly
    const y = year || now.getFullYear();
    const m = (month !== undefined ? month : now.getMonth() + 1) - 1; // 0-indexed for Date
    start = new Date(y, m, 1, 0, 0, 0, 0);
    end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  }

  // 1. Opening Balance: Transactions before 'start'
  let openingBalance = 0;
  for (const t of allTransactions) {
    const tDate = new Date(t.transactionDate);
    if (tDate < start) {
      openingBalance += (t.credit - t.debit);
    }
  }

  // 2. Transactions within range (ordered ascending)
  const inRange = allTransactions.filter(t => {
    const tDate = new Date(t.transactionDate);
    return tDate >= start && tDate <= end;
  }).sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  // 3. Compute running balance iteratively
  let currentBalance = openingBalance;
  const items: StatementLineItemDto[] = [];
  let totalCredit = 0;
  let totalDebit = 0;

  for (const t of inRange) {
    currentBalance += (t.credit - t.debit);
    totalCredit += t.credit;
    totalDebit += t.debit;
    items.push({
      ...t,
      runningBalance: currentBalance
    });
  }

  return {
    employeeId,
    employeeName,
    fromDate: start.toISOString(),
    toDate: end.toISOString(),
    openingBalance,
    totalCredit,
    totalDebit,
    closingBalance: currentBalance,
    items
  };
}

// -------------------------------------------------------------
// Installment System (Sales & POS Installment Management Module)
// -------------------------------------------------------------

export const initialInstallmentContracts: InstallmentContract[] = [];

export function getStoredInstallmentContracts(): InstallmentContract[] {
  let contracts = safeGet<InstallmentContract[]>(KEYS.INSTALLMENT_CONTRACTS, initialInstallmentContracts);

  // Automatically purge legacy test mock contracts if present in localStorage
  if (Array.isArray(contracts) && contracts.length > 0) {
    const cleaned = contracts.filter(c => c.id !== 'INS-20261015-1082' && c.id !== 'INS-20261028-2045');
    if (cleaned.length !== contracts.length) {
      contracts = cleaned;
      saveStoredInstallmentContracts(contracts);
    }
  } else if (!Array.isArray(contracts)) {
    contracts = [];
  }

  const now = new Date();

  // Evaluate overdue status dynamically
  let hasChanges = false;
  const updated = contracts.map(contract => {
    let contractModified = false;
    const schedules = contract.schedules.map(sch => {
      const dueDate = new Date(sch.dueDate);
      if (dueDate < now && sch.status === 'PENDING') {
        contractModified = true;
        hasChanges = true;
        return { ...sch, status: 'OVERDUE' as InstallmentScheduleStatus };
      }
      return sch;
    });

    if (contractModified) {
      return { ...contract, schedules };
    }
    return contract;
  });

  if (hasChanges) {
    saveStoredInstallmentContracts(updated);
  }

  return updated;
}

export function saveStoredInstallmentContracts(contracts: InstallmentContract[]): void {
  safeSet(KEYS.INSTALLMENT_CONTRACTS, contracts);
}

export function createInstallmentContract(data: {
  invoiceId: string;
  invoiceNumber?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorNationalId?: string;
  totalCashPrice?: number;
  totalInstallmentPrice: number;
  downPayment?: number;
  remainingAmount?: number;
  installmentCount?: number;
  monthlyAmount?: number;
  startDate?: string;
  notes?: string;
  cashierShiftId?: string;
}): InstallmentContract {
  const downPayment = data.downPayment || 0;
  const remainingAmount = data.remainingAmount ?? Math.max(0, data.totalInstallmentPrice - downPayment);
  const count = Math.max(1, data.installmentCount || 1);
  const monthlyAmount = data.monthlyAmount ?? (Math.round((remainingAmount / count) * 100) / 100);
  const startDateStr = data.startDate || new Date().toISOString().split('T')[0];
  const startDateTime = new Date(startDateStr);
  const contractNumber = `INS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const schedules: InstallmentScheduleItem[] = [];
  let runningSum = 0;

  for (let i = 1; i <= count; i++) {
    const itemAmount = (i === count) ? Math.round((remainingAmount - runningSum) * 100) / 100 : monthlyAmount;
    runningSum += itemAmount;

    const dueDate = new Date(startDateTime);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedules.push({
      id: `SCH-${Date.now()}-${i}`,
      contractId: contractNumber,
      installmentNumber: i,
      dueDate: dueDate.toISOString().split('T')[0],
      amount: itemAmount,
      paidAmount: 0,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });
  }

  const contract: InstallmentContract = {
    id: `INS-${Date.now()}`,
    contractNumber,
    invoiceId: data.invoiceId,
    invoiceNumber: data.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
    customerId: data.customerId || 'CUST-WALKIN',
    customerName: data.customerName || 'عميل نقدي مباشر',
    customerPhone: data.customerPhone || '',
    guarantorName: data.guarantorName || '',
    guarantorPhone: data.guarantorPhone || '',
    guarantorNationalId: data.guarantorNationalId,
    totalCashPrice: data.totalCashPrice || data.totalInstallmentPrice,
    totalInstallmentPrice: data.totalInstallmentPrice,
    downPayment,
    remainingAmount,
    installmentCount: count,
    monthlyAmount,
    startDate: startDateStr,
    status: 'ACTIVE',
    notes: data.notes,
    createdAt: new Date().toISOString(),
    schedules
  };

  const existing = getStoredInstallmentContracts();
  saveStoredInstallmentContracts([contract, ...existing]);

  return contract;
}

export function payInstallmentScheduleItem(
  scheduleItemId: string,
  amount: number,
  shiftId?: string,
  paymentMethod = 'CASH',
  notes?: string
): { success: boolean; item: InstallmentScheduleItem; contract: InstallmentContract; receiptNumber: string } {
  const contracts = getStoredInstallmentContracts();
  const contractIdx = contracts.findIndex(c => c.schedules.some(s => s.id === scheduleItemId));

  if (contractIdx < 0) {
    throw new Error('قسط الاستحقاق المطلوب غير موجود في سجلات النظام');
  }

  const contract = contracts[contractIdx];
  const scheduleIdx = contract.schedules.findIndex(s => s.id === scheduleItemId);
  const schedule = contract.schedules[scheduleIdx];

  if (schedule.status === 'PAID') {
    throw new Error('هذا القسط مسدد بالفعل بالكامل مسبقاً');
  }

  const receiptNumber = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newPaidAmount = schedule.paidAmount + amount;
  const isFullyPaid = newPaidAmount >= schedule.amount;

  const updatedSchedule: InstallmentScheduleItem = {
    ...schedule,
    paidAmount: newPaidAmount,
    paidDate: isFullyPaid ? new Date().toISOString() : schedule.paidDate,
    status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
    cashierShiftId: shiftId || schedule.cashierShiftId,
    paymentMethod,
    receiptVoucherNumber: receiptNumber,
    notes: notes || schedule.notes
  };

  const updatedSchedules = [...contract.schedules];
  updatedSchedules[scheduleIdx] = updatedSchedule;

  const allPaid = updatedSchedules.every(s => s.status === 'PAID');
  const newRemaining = Math.max(0, contract.remainingAmount - amount);

  const updatedContract: InstallmentContract = {
    ...contract,
    remainingAmount: newRemaining,
    status: allPaid ? 'COMPLETED' : contract.status,
    updatedAt: new Date().toISOString(),
    schedules: updatedSchedules
  };

  contracts[contractIdx] = updatedContract;
  saveStoredInstallmentContracts(contracts);

  // If cashier shift is active and cash payment, record in active shift movements
  if (paymentMethod === 'CASH') {
    try {
      const activeShift = getStoredActiveShift();
      if (activeShift) {
        // Register transaction in shift
      }
    } catch {}
  }

  return {
    success: true,
    item: updatedSchedule,
    contract: updatedContract,
    receiptNumber
  };
}

export function getInstallmentStats(): InstallmentStats {
  const contracts = getStoredInstallmentContracts();
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let dueThisMonthAmount = 0;
  let dueThisMonthCount = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let totalCollected = 0;
  let totalRemaining = 0;

  for (const contract of contracts) {
    totalCollected += contract.downPayment;
    if (contract.status === 'ACTIVE') {
      totalRemaining += contract.remainingAmount;
    }

    for (const s of contract.schedules) {
      totalCollected += s.paidAmount;
      const unpaid = Math.max(0, s.amount - s.paidAmount);

      if (s.status === 'OVERDUE') {
        overdueAmount += unpaid;
        overdueCount += 1;
      }

      if (s.dueDate.startsWith(currentMonthStr) && s.status !== 'PAID') {
        dueThisMonthAmount += unpaid;
        dueThisMonthCount += 1;
      }
    }
  }

  return {
    activeContractsCount: contracts.filter(c => c.status === 'ACTIVE').length,
    dueThisMonthAmount,
    dueThisMonthCount,
    overdueAmount,
    overdueCount,
    totalCollectedAmount: totalCollected,
    totalRemainingAmount: totalRemaining
  };
}

// ----------------------------------------------------
// Operational Expenses (Clean Tenant Start — Zero Pre-Seeded Categories)
// ----------------------------------------------------
const LEGACY_SEEDED_CATEGORY_CODES = new Set([
  'RENT', 'UTILITIES', 'SALARIES', 'LOGISTICS', 'MAINTENANCE',
  'EXP-RENT', 'EXP-UTIL', 'EXP-SAL', 'EXP-MAINT', 'EXP-LOG'
]);

export function getStoredExpenseCategories(): ExpenseCategory[] {
  const stored = safeGet<ExpenseCategory[]>(KEYS.EXPENSE_CATEGORIES, []);
  if (!Array.isArray(stored) || stored.length === 0) return [];
  // Filter out legacy seeded defaults if untouched so existing browsers start clean
  const cleaned = stored.filter(
    c => !(LEGACY_SEEDED_CATEGORY_CODES.has((c.code || '').toUpperCase()) && c.createdAt === '2026-01-01T00:00:00Z')
  );
  if (cleaned.length !== stored.length) {
    safeSet(KEYS.EXPENSE_CATEGORIES, cleaned);
  }
  return cleaned;
}

export function saveStoredExpenseCategories(categories: ExpenseCategory[]): void {
  safeSet(KEYS.EXPENSE_CATEGORIES, categories);
}

export function getStoredExpenseVouchers(): ExpenseVoucher[] {
  return safeGet<ExpenseVoucher[]>(KEYS.EXPENSE_VOUCHERS, []);
}

export function saveStoredExpenseVouchers(vouchers: ExpenseVoucher[]): void {
  safeSet(KEYS.EXPENSE_VOUCHERS, vouchers);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erp_expenses_updated', { detail: vouchers }));
  }
}

// ----------------------------------------------------
// Sales Quotations
// ----------------------------------------------------
export function getStoredSalesQuotations(): SalesQuotation[] {
  return safeGet<SalesQuotation[]>(KEYS.SALES_QUOTATIONS, []);
}

export function saveStoredSalesQuotations(quotations: SalesQuotation[]): void {
  safeSet(KEYS.SALES_QUOTATIONS, quotations);
}

// ----------------------------------------------------
// Price Lists & Bundles
// ----------------------------------------------------
const DEFAULT_PRICE_LISTS: PriceList[] = [
  { id: 'PL-RETAIL', tenantId: 'default', code: 'RETAIL', name: 'Standard Retail', nameAr: 'سعر التجزئة الافتراضي', currency: 'USD', isDefault: true, isActive: true, customerTier: 'BRONZE', description: 'Base retail prices for all walking customers', createdAt: '2026-01-01T00:00:00Z', items: [] },
  { id: 'PL-WHOLESALE', tenantId: 'default', code: 'WHOLESALE', name: 'Wholesale Tier', nameAr: 'سعر الجملة', currency: 'USD', isDefault: false, isActive: true, customerTier: 'GOLD', description: 'Wholesale discount rates for bulk partners', createdAt: '2026-01-01T00:00:00Z', items: [] },
  { id: 'PL-VIP', tenantId: 'default', code: 'VIP', name: 'VIP Platinum Tier', nameAr: 'سعر كبار العملاء VIP', currency: 'USD', isDefault: false, isActive: true, customerTier: 'PLATINUM', description: 'Exclusive contracted prices for VIP clients', createdAt: '2026-01-01T00:00:00Z', items: [] }
];

export function getStoredPriceLists(): PriceList[] {
  return safeGet<PriceList[]>(KEYS.PRICE_LISTS, DEFAULT_PRICE_LISTS);
}

export function saveStoredPriceLists(lists: PriceList[]): void {
  safeSet(KEYS.PRICE_LISTS, lists);
}

export function getStoredProductBundles(): ProductBundleItem[] {
  return safeGet<ProductBundleItem[]>(KEYS.PRODUCT_BUNDLES, []);
}

export function saveStoredProductBundles(bundles: ProductBundleItem[]): void {
  safeSet(KEYS.PRODUCT_BUNDLES, bundles);
}

export function generateNextBundleSku(existingProducts?: Product[]): string {
  const prods = existingProducts ?? getStoredProducts();
  let maxNum = 1000;
  for (const p of prods) {
    const sku = (p.sku || '').trim().toUpperCase();
    if (sku.startsWith('BND-')) {
      const parsed = parseInt(sku.slice(4), 10);
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }
  return `BND-${maxNum + 1}`;
}

export function generateNextBundleBarcode(existingProducts?: Product[]): string {
  const prods = existingProducts ?? getStoredProducts();
  const used = new Set(prods.map(p => (p.barcode || '').trim()));
  let candidate = '';
  for (let i = 0; i < 20; i++) {
    candidate = `299${Math.floor(1000000000 + Math.random() * 8999999999)}`;
    if (!used.has(candidate)) return candidate;
  }
  return `299${Date.now().toString().slice(-10)}`;
}

/**
 * Dynamically calculates how many full bundles can be fulfilled from component stock:
 * Min(Floor(Component.AvailableStock / Component.RequiredQty))
 */
export function getBundleAvailableStock(
  bundleProductId: string,
  allProducts?: Product[],
  allBundles?: ProductBundleItem[],
  warehouseId?: string
): number {
  const products = allProducts ?? getStoredProducts();
  const bundles = allBundles ?? getStoredProductBundles();
  const comps = bundles.filter(b => b.parentProductId === bundleProductId);
  if (comps.length === 0) return 0;

  let minFulfillable = Infinity;
  for (const c of comps) {
    const reqQty = Number(c.quantity) || 1;
    if (reqQty <= 0) continue;

    // Match component products by ID or SKU; if scoped to a specific warehouse, sum stock in that warehouse
    const matchingComps = products.filter(p =>
      !p.isBundle &&
      (p.id === c.childProductId || (c.childProductSku && p.sku === c.childProductSku)) &&
      (!warehouseId || warehouseId === 'ALL' || !p.warehouseId || p.warehouseId === warehouseId)
    );

    const compStock = matchingComps.length > 0
      ? matchingComps.reduce((sum, p) => sum + Math.max(0, Number(p.currentStock) || 0), 0)
      : (typeof c.availableStock === 'number' ? c.availableStock : 0);

    const fulfillable = Math.floor(compStock / reqQty);
    if (fulfillable < minFulfillable) {
      minFulfillable = fulfillable;
    }
  }

  return Number.isFinite(minFulfillable) ? Math.max(0, minFulfillable) : 0;
}

/**
 * Returns physical stock for standalone items or dynamic component-derived stock for bundles.
 */
export function getEffectiveProductStock(
  product: Product,
  allProducts?: Product[],
  allBundles?: ProductBundleItem[],
  warehouseId?: string
): number {
  if (!product) return 0;
  if (product.isBundle) {
    return getBundleAvailableStock(product.id, allProducts, allBundles, warehouseId);
  }
  return Math.max(0, Number(product.currentStock) || 0);
}

/**
 * Resolves a component's total available physical stock (matching ID or SKU, optionally scoped to warehouse).
 */
function getPhysicalComponentStock(
  componentId: string,
  componentSku: string | undefined,
  products: Product[],
  bundles: ProductBundleItem[],
  warehouseId?: string
): number {
  const matching = products.filter(p =>
    !p.isBundle &&
    (p.id === componentId || (componentSku && p.sku === componentSku)) &&
    (!warehouseId || warehouseId === 'ALL' || !p.warehouseId || p.warehouseId === warehouseId)
  );
  if (matching.length > 0) {
    return matching.reduce((sum, p) => sum + Math.max(0, Number(p.currentStock) || 0), 0);
  }
  const bundleFallback = bundles.find(b => b.childProductId === componentId);
  return typeof bundleFallback?.availableStock === 'number' ? Math.max(0, bundleFallback.availableStock) : 0;
}

/**
 * Validates an entire cart (handling BOTH bundle component stock AND shared standalone items in the same cart).
 */
export function validateCartStockWithBundles(
  cartItems: Array<{ product: Product; quantity: number }>,
  allProducts?: Product[],
  allBundles?: ProductBundleItem[],
  warehouseId?: string
): {
  isValid: boolean;
  lineIssues: Record<string, { available: number; required: number; conflictingComponent?: string }>;
  shortages: Array<{ productId: string; name: string; sku: string; available: number; required: number }>;
} {
  const products = allProducts ?? getStoredProducts();
  const bundles = allBundles ?? getStoredProductBundles();

  const demandMap = new Map<string, {
    key: string;
    name: string;
    sku: string;
    available: number;
    required: number;
    cartProductIds: Set<string>;
  }>();

  for (const item of cartItems) {
    const freshProd = products.find(p => p.id === item.product.id || p.sku === item.product.sku) || item.product;
    const comps = bundles.filter(b => b.parentProductId === freshProd.id);

    if (freshProd.isBundle || comps.length > 0) {
      if (comps.length === 0) {
        const k = freshProd.id;
        demandMap.set(k, {
          key: k,
          name: freshProd.nameAr || freshProd.nameEn,
          sku: freshProd.sku,
          available: 0,
          required: item.quantity,
          cartProductIds: new Set([item.product.id])
        });
        continue;
      }

      for (const bc of comps) {
        const compProd = products.find(p => !p.isBundle && (p.id === bc.childProductId || (bc.childProductSku && p.sku === bc.childProductSku)));
        const physKey = compProd?.id || bc.childProductId;
        const avail = getPhysicalComponentStock(bc.childProductId, bc.childProductSku, products, bundles, warehouseId);
        const reqQty = Math.ceil((Number(bc.quantity) || 1) * item.quantity);

        const prev = demandMap.get(physKey);
        if (prev) {
          prev.required += reqQty;
          prev.cartProductIds.add(item.product.id);
        } else {
          demandMap.set(physKey, {
            key: physKey,
            name: compProd?.nameAr || compProd?.nameEn || bc.childProductName || bc.childProductSku,
            sku: compProd?.sku || bc.childProductSku || '',
            available: avail,
            required: reqQty,
            cartProductIds: new Set([item.product.id])
          });
        }
      }
    } else {
      const physKey = freshProd.id;
      const avail = Math.max(0, Number(freshProd.currentStock) || 0);
      const prev = demandMap.get(physKey);
      if (prev) {
        prev.required += item.quantity;
        prev.cartProductIds.add(item.product.id);
      } else {
        demandMap.set(physKey, {
          key: physKey,
          name: freshProd.nameAr || freshProd.nameEn,
          sku: freshProd.sku,
          available: avail,
          required: item.quantity,
          cartProductIds: new Set([item.product.id])
        });
      }
    }
  }

  const lineIssues: Record<string, { available: number; required: number; conflictingComponent?: string }> = {};
  const shortages: Array<{ productId: string; name: string; sku: string; available: number; required: number }> = [];

  for (const entry of demandMap.values()) {
    if (entry.required > entry.available) {
      shortages.push({
        productId: entry.key,
        name: entry.name,
        sku: entry.sku,
        available: entry.available,
        required: entry.required
      });
      for (const cartProdId of entry.cartProductIds) {
        if (!lineIssues[cartProdId]) {
          lineIssues[cartProdId] = {
            available: entry.available,
            required: entry.required,
            conflictingComponent: entry.name
          };
        }
      }
    }
  }

  return {
    isValid: shortages.length === 0,
    lineIssues,
    shortages
  };
}

/**
 * Returns the maximum total quantity of `targetProduct` allowed in the cart, accounting for
 * component stock already consumed by other bundles or standalone items in `currentCart`.
 */
export function getMaxAllowedCartQuantity(
  targetProduct: Product,
  currentCart: Array<{ product: Product; quantity: number }>,
  allProducts?: Product[],
  allBundles?: ProductBundleItem[],
  warehouseId?: string
): { maxQty: number; limitingComponentName?: string } {
  const products = allProducts ?? getStoredProducts();
  const bundles = allBundles ?? getStoredProductBundles();

  // Compute component demand from all OTHER lines in cart
  const otherItems = currentCart.filter(ci => ci.product.id !== targetProduct.id);
  const otherDemand = new Map<string, number>();

  for (const ci of otherItems) {
    const fresh = products.find(p => p.id === ci.product.id || p.sku === ci.product.sku) || ci.product;
    const comps = bundles.filter(b => b.parentProductId === fresh.id);
    if (fresh.isBundle || comps.length > 0) {
      for (const bc of comps) {
        const compProd = products.find(p => !p.isBundle && (p.id === bc.childProductId || (bc.childProductSku && p.sku === bc.childProductSku)));
        const physKey = compProd?.id || bc.childProductId;
        otherDemand.set(physKey, (otherDemand.get(physKey) || 0) + Math.ceil((Number(bc.quantity) || 1) * ci.quantity));
      }
    } else {
      otherDemand.set(fresh.id, (otherDemand.get(fresh.id) || 0) + ci.quantity);
    }
  }

  const targetComps = bundles.filter(b => b.parentProductId === targetProduct.id);
  if (targetProduct.isBundle || targetComps.length > 0) {
    if (targetComps.length === 0) return { maxQty: 0 };
    let minAllowed = Infinity;
    let limitingName: string | undefined;
    for (const bc of targetComps) {
      const compProd = products.find(p => !p.isBundle && (p.id === bc.childProductId || (bc.childProductSku && p.sku === bc.childProductSku)));
      const physKey = compProd?.id || bc.childProductId;
      const totalCompAvail = getPhysicalComponentStock(bc.childProductId, bc.childProductSku, products, bundles, warehouseId);
      const alreadyUsed = otherDemand.get(physKey) || 0;
      const remaining = Math.max(0, totalCompAvail - alreadyUsed);
      const reqPerBundle = Number(bc.quantity) || 1;
      const maxForComp = Math.floor(remaining / reqPerBundle);
      if (maxForComp < minAllowed) {
        minAllowed = maxForComp;
        limitingName = compProd?.nameAr || compProd?.nameEn || bc.childProductName;
      }
    }
    return {
      maxQty: Number.isFinite(minAllowed) ? Math.max(0, minAllowed) : 0,
      limitingComponentName: limitingName
    };
  }

  const freshTarget = products.find(p => p.id === targetProduct.id || p.sku === targetProduct.sku) || targetProduct;
  const rawAvail = Math.max(0, Number(freshTarget.currentStock) || 0);
  const usedByBundles = otherDemand.get(freshTarget.id) || 0;
  return {
    maxQty: Math.max(0, rawAvail - usedByBundles),
    limitingComponentName: freshTarget.nameAr || freshTarget.nameEn
  };
}

/**
 * Computes total components cost & total individual retail price for a bundle.
 */
export function getBundleFinancials(
  components: Array<{ childProductId: string; quantity: number }>,
  allProducts?: Product[]
): { totalCost: number; totalRetail: number } {
  const products = allProducts ?? getStoredProducts();
  let totalCost = 0;
  let totalRetail = 0;
  for (const c of components) {
    const prod = products.find(p => p.id === c.childProductId);
    const qty = Number(c.quantity) || 0;
    if (prod && qty > 0) {
      totalCost += (Number(prod.costPrice) || 0) * qty;
      totalRetail += (Number(prod.sellingPrice) || 0) * qty;
    }
  }
  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalRetail: Math.round(totalRetail * 100) / 100
  };
}

/**
 * Creates or updates a decoupled Virtual Bundle Product + its component rows in localStorage
 * without ever modifying an existing standalone physical product.
 */
export function saveVirtualBundleInStorage(params: {
  bundleId?: string | null;
  bundleName: string;
  bundleSku?: string;
  barcode?: string;
  bundleSellingPrice: number;
  components: Array<{ childProductId: string; quantity: number }>;
}): { bundleProduct: Product; bundleItems: ProductBundleItem[] } {
  const products = getStoredProducts();
  const existingBundles = getStoredProductBundles();
  const nowDate = new Date().toISOString().split('T')[0];

  const isUpdate = Boolean(params.bundleId);
  const existingTarget = isUpdate ? products.find(p => p.id === params.bundleId) : undefined;
  if (existingTarget && !existingTarget.isBundle) {
    throw new Error('ERR_CANNOT_CONVERT_PHYSICAL_PRODUCT_TO_BUNDLE');
  }

  const bundleId = existingTarget?.id || params.bundleId || `BND-PRD-${Date.now()}`;
  const cleanName = params.bundleName.trim();
  const cleanSku = params.bundleSku?.trim() || existingTarget?.sku || generateNextBundleSku(products);
  const cleanBarcode = params.barcode?.trim() || existingTarget?.barcode || generateNextBundleBarcode(products);
  const { totalCost } = getBundleFinancials(params.components, products);

  const bundleProduct: Product = {
    ...(existingTarget || {}),
    id: bundleId,
    sku: cleanSku,
    barcode: cleanBarcode,
    nameAr: cleanName,
    nameEn: cleanName,
    category: 'حزم المنتجات',
    categoryEn: 'Product Bundles',
    costPrice: totalCost,
    sellingPrice: Number(params.bundleSellingPrice) || 0,
    minSellingPrice: 0,
    unit: 'حزمة',
    unitEn: 'Bundle',
    currentStock: 0,
    minStockAlert: 0,
    warehouseId: 'ALL',
    warehouseName: 'حزمة مركبة (افتراضي)',
    warehouseNameEn: 'Virtual Bundle',
    status: 'available',
    shelf: 'BUNDLE',
    updatedAt: nowDate,
    isBundle: true
  };

  const nextProducts = existingTarget
    ? products.map(p => (p.id === bundleId ? bundleProduct : p))
    : [bundleProduct, ...products];
  saveStoredProducts(nextProducts);

  const newItems: ProductBundleItem[] = params.components.map((bc, idx) => {
    const child = nextProducts.find(p => p.id === bc.childProductId);
    return {
      id: `PBI-${Date.now()}-${idx}`,
      parentProductId: bundleId,
      parentProductName: cleanName,
      parentProductSku: cleanSku,
      parentBarcode: cleanBarcode,
      parentSellingPrice: bundleProduct.sellingPrice,
      childProductId: bc.childProductId,
      childProductName: child ? (child.nameAr || child.nameEn) : bc.childProductId,
      childProductSku: child?.sku || '',
      quantity: Number(bc.quantity) || 1,
      unitPriceRatio: 1.0,
      componentCostPrice: Number(child?.costPrice) || 0,
      componentSellingPrice: Number(child?.sellingPrice) || 0,
      availableStock: Number(child?.currentStock) || 0
    };
  });

  const nextBundles = [...existingBundles.filter(b => b.parentProductId !== bundleId), ...newItems];
  saveStoredProductBundles(nextBundles);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zilox_products_updated'));
  }

  return { bundleProduct, bundleItems: newItems };
}

export function deleteVirtualBundleInStorage(bundleId: string): void {
  const existingBundles = getStoredProductBundles();
  saveStoredProductBundles(existingBundles.filter(b => b.parentProductId !== bundleId));

  const products = getStoredProducts();
  // Remove only if it's a virtual bundle record — never delete a physical product
  const nextProducts = products.filter(p => !(p.id === bundleId && p.isBundle));
  saveStoredProducts(nextProducts);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zilox_products_updated'));
  }
}

// ----------------------------------------------------
// Direct Product Quantity Tiered Pricing
// ----------------------------------------------------
export function getStoredQuantityTiers(): ProductQuantityTier[] {
  return safeGet<ProductQuantityTier[]>(KEYS.PRODUCT_QUANTITY_TIERS, []);
}

export function saveStoredQuantityTiers(tiers: ProductQuantityTier[]): void {
  safeSet(KEYS.PRODUCT_QUANTITY_TIERS, tiers);
}

export function validateQuantityTierRanges(
  tiers: Array<{ minQty: number; maxQty?: number | null; unitPrice: number }>
): { valid: boolean; errorCode?: 'ERR_INVALID_QTY_RANGE' | 'ERR_OVERLAPPING_QTY_TIER' } {
  for (const t of tiers) {
    if (!Number.isFinite(t.minQty) || t.minQty < 2 || (t.maxQty != null && (!Number.isFinite(t.maxQty) || t.maxQty < t.minQty)) || !Number.isFinite(t.unitPrice) || t.unitPrice < 0) {
      return { valid: false, errorCode: 'ERR_INVALID_QTY_RANGE' };
    }
  }

  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.maxQty == null || current.maxQty >= next.minQty) {
      return { valid: false, errorCode: 'ERR_OVERLAPPING_QTY_TIER' };
    }
  }

  return { valid: true };
}

export function getProductQuantityTiers(productId: string, fallbackProduct?: Partial<Product>): ProductQuantityTier[] {
  const stored = getStoredQuantityTiers().filter(t => t.productId === productId);
  if (stored.length > 0) {
    return [...stored].sort((a, b) => a.minQty - b.minQty);
  }
  const embedded = fallbackProduct?.quantityTiers;
  if (Array.isArray(embedded) && embedded.length > 0) {
    return embedded.map((t, idx) => ({
      id: t.id || `TIER-${productId}-${idx}`,
      productId,
      minQty: Number(t.minQty),
      maxQty: t.maxQty != null ? Number(t.maxQty) : null,
      unitPrice: Number(t.unitPrice),
      updatedAt: t.updatedAt,
    })).sort((a, b) => a.minQty - b.minQty);
  }
  return [];
}

export function saveProductQuantityTiers(
  productId: string,
  tiers: Array<{ id?: string; minQty: number; maxQty?: number | null; unitPrice: number }>,
  productMeta?: { sku?: string; name?: string; baseSellingPrice?: number }
): ProductQuantityTier[] {
  const existingAll = getStoredQuantityTiers().filter(t => t.productId !== productId);
  const nowIso = new Date().toISOString();
  const normalized: ProductQuantityTier[] = [...tiers]
    .sort((a, b) => a.minQty - b.minQty)
    .map((t, idx) => ({
      id: t.id || `TIER-${Date.now()}-${idx}`,
      productId,
      productSku: productMeta?.sku,
      productName: productMeta?.name,
      baseSellingPrice: productMeta?.baseSellingPrice,
      minQty: Math.floor(Number(t.minQty)),
      maxQty: t.maxQty != null && String(t.maxQty) !== '' ? Math.floor(Number(t.maxQty)) : null,
      unitPrice: Number(t.unitPrice),
      updatedAt: nowIso,
    }));

  saveStoredQuantityTiers([...existingAll, ...normalized]);

  // Keep product.quantityTiers in sync inside KEYS.PRODUCTS
  const storedProducts = getStoredProducts();
  const nextProducts = storedProducts.map(p =>
    p.id === productId
      ? {
          ...p,
          quantityTiers: normalized.map(nt => ({
            id: nt.id,
            productId: nt.productId,
            minQty: nt.minQty,
            maxQty: nt.maxQty ?? null,
            unitPrice: nt.unitPrice,
            updatedAt: nt.updatedAt,
          })),
        }
      : p
  );
  saveStoredProducts(nextProducts);
  return normalized;
}

export function deleteStoredQuantityTier(tierId: string): void {
  const all = getStoredQuantityTiers();
  const target = all.find(t => t.id === tierId);
  const remaining = all.filter(t => t.id !== tierId);
  saveStoredQuantityTiers(remaining);

  if (target) {
    const productTiers = remaining.filter(t => t.productId === target.productId);
    const storedProducts = getStoredProducts();
    saveStoredProducts(
      storedProducts.map(p =>
        p.id === target.productId
          ? {
              ...p,
              quantityTiers: productTiers.map(nt => ({
                id: nt.id,
                productId: nt.productId,
                minQty: nt.minQty,
                maxQty: nt.maxQty ?? null,
                unitPrice: nt.unitPrice,
                updatedAt: nt.updatedAt,
              })),
            }
          : p
      )
    );
  }
}

export function resolveQuantityUnitPrice(
  product: { id: string; sellingPrice?: number; retailPrice?: number; quantityTiers?: Product['quantityTiers'] } | undefined,
  quantity: number,
  explicitTiers?: Array<{ minQty: number; maxQty?: number | null; unitPrice: number }>
): { unitPrice: number; basePrice: number; isTierApplied: boolean; minQty?: number; maxQty?: number | null } {
  const basePrice = Number(product?.sellingPrice ?? product?.retailPrice ?? 0);
  if (!product?.id) {
    return { unitPrice: basePrice, basePrice, isTierApplied: false };
  }

  const safeQty = Math.max(1, Math.floor(Number(quantity) || 1));
  const tiers = explicitTiers && explicitTiers.length > 0
    ? explicitTiers
    : getProductQuantityTiers(product.id, product);

  if (!tiers || tiers.length === 0 || safeQty < 2) {
    return { unitPrice: basePrice, basePrice, isTierApplied: false };
  }

  const matching = [...tiers]
    .filter(t => safeQty >= t.minQty && (t.maxQty == null || safeQty <= t.maxQty))
    .sort((a, b) => b.minQty - a.minQty)[0];

  if (matching) {
    return {
      unitPrice: Number(matching.unitPrice),
      basePrice,
      isTierApplied: true,
      minQty: matching.minQty,
      maxQty: matching.maxQty ?? null,
    };
  }

  return { unitPrice: basePrice, basePrice, isTierApplied: false };
}

// ----------------------------------------------------
// Purchase Returns
// ----------------------------------------------------
export function getStoredPurchaseReturns(): PurchaseReturn[] {
  return safeGet<PurchaseReturn[]>(KEYS.PURCHASE_RETURNS, []);
}

export function saveStoredPurchaseReturns(returns: PurchaseReturn[]): void {
  safeSet(KEYS.PURCHASE_RETURNS, returns);
}

// ----------------------------------------------------
// Product Serials / IMEI & Warranty
// ----------------------------------------------------
export function getStoredProductSerials(): ProductSerial[] {
  return safeGet<ProductSerial[]>(KEYS.PRODUCT_SERIALS, []);
}

export function saveStoredProductSerials(serials: ProductSerial[]): void {
  safeSet(KEYS.PRODUCT_SERIALS, serials);
}

export function markLocalSerialsAsSold(params: {
  serialNumbers: string[];
  invoiceId?: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  warrantyMonthsOverride?: number;
}): void {
  if (!params.serialNumbers || params.serialNumbers.length === 0) return;
  const targets = new Set(params.serialNumbers.map(s => s.trim().toLowerCase()).filter(Boolean));
  if (targets.size === 0) return;

  const soldDate = new Date();
  const serials = getStoredProductSerials();
  let changed = false;

  const updated = serials.map(s => {
    if (!targets.has(s.serialNumber.trim().toLowerCase())) return s;
    changed = true;
    const months = Math.max(0, Number(params.warrantyMonthsOverride ?? s.warrantyMonths) || 0);
    const endDate = months > 0 ? new Date(soldDate) : null;
    if (endDate) endDate.setMonth(endDate.getMonth() + months);

    return {
      ...s,
      status: 'Sold' as const,
      salesInvoiceId: params.invoiceId || s.salesInvoiceId,
      salesInvoiceNo: params.invoiceNumber,
      customerId: params.customerId || s.customerId,
      customerName: params.customerName || s.customerName,
      saleDate: soldDate.toISOString(),
      soldDate: soldDate.toISOString(),
      warrantyMonths: months,
      warrantyStartDate: months > 0 ? soldDate.toISOString() : undefined,
      warrantyEndDate: endDate ? endDate.toISOString() : undefined,
      warrantyStatus: months > 0 ? ('Active' as const) : ('NoWarranty' as const),
      isWarrantyActive: months > 0,
      updatedAt: soldDate.toISOString(),
    };
  });

  if (changed) {
    saveStoredProductSerials(updated);
  }
}

export function updateLocalSerialStatus(serialNumber: string, status: ProductSerial['status']): void {
  const target = serialNumber.trim().toLowerCase();
  if (!target) return;
  const serials = getStoredProductSerials();
  let changed = false;
  const updated = serials.map(s => {
    if (s.serialNumber.trim().toLowerCase() !== target) return s;
    changed = true;
    return {
      ...s,
      status,
      warrantyStartDate: status === 'Sold' ? s.warrantyStartDate : undefined,
      warrantyEndDate: status === 'Sold' ? s.warrantyEndDate : undefined,
      warrantyStatus: status === 'Sold' ? s.warrantyStatus : ('NotStarted' as const),
      isWarrantyActive: status === 'Sold' ? s.isWarrantyActive : false,
      updatedAt: new Date().toISOString(),
    };
  });
  if (changed) saveStoredProductSerials(updated);
}




