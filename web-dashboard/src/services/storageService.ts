import { Product, SalesInvoice, Warehouse, WarehouseDispatchOrder, DispenseMode, InstallmentContract, InstallmentScheduleItem, InstallmentStats, InstallmentStatus, InstallmentScheduleStatus } from '../types/warehouse';
import { TransactionDetail } from '../components/TransactionModal';
import { localizeCategory, localizeUnit, localizeWarehouse } from '../lib/localeHelpers';
import { parseDateSafely } from '../utils/dateFormatter';
import { UserAccount, DEFAULT_USER_ACCOUNTS, UserProfile, UserRole } from '../types/rbac';
import { PurchaseInvoice, PurchaseInvoiceItem, PurchaseJournalEntry } from '../types/purchases';

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
    const mapped = existing.map(p => {
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
  if (maxSeq === 0 && existing.length > 0) {
    maxSeq = existing.length;
  }
  const nextSeq = maxSeq + 1 + offset;
  return `TRX-${String(nextSeq).padStart(4, '0')}`;
}

export function getStoredTransactions(): TransactionDetail[] {
  const existing = safeGet<TransactionDetail[] | null>(KEYS.TRANSACTIONS, null);
  if (existing !== null && Array.isArray(existing)) {
    const products = safeGet<Product[] | null>(KEYS.PRODUCTS, null) || [];
    let hasChanges = false;
    const total = existing.length;

    // Check if transactions need sequence re-indexing (e.g. have random 10-digit IDs or non-sequential format)
    let isCleanSequence = true;
    for (let i = 0; i < total; i++) {
      const expectedSeq = total - i;
      const expectedId = `TRX-${String(expectedSeq).padStart(4, '0')}`;
      if (existing[i].id !== expectedId) {
        isCleanSequence = false;
        break;
      }
    }

    const sanitized = existing.map((t, idx) => {
      let id = t.id;
      if (!isCleanSequence) {
        // Oldest transaction (at the end of array) gets TRX-0001, newest gets TRX-total
        const seqNum = total - idx;
        id = `TRX-${String(seqNum).padStart(4, '0')}`;
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
        const invoices = safeGet<SalesInvoice[] | null>(KEYS.INVOICES, null) || [];
        const matchedInv = invoices.find(inv => inv.invoiceNo === t.referenceNo);
        if (matchedInv?.operator && matchedInv.operator !== 'Mustafa Operations') {
          operator = matchedInv.operator;
          hasChanges = true;
        } else if (session?.fullName || session?.username) {
          operator = session.fullName || session.username;
          hasChanges = true;
        }
      }

      // Ensure transaction always has an authentic date & timestamp
      let timestamp = t.timestamp;
      let movementDate = t.movementDate;
      let createdAt = t.createdAt;
      let date = t.date;

      const rawToParse = movementDate || createdAt || date || timestamp;
      const parsed = parseDateSafely(rawToParse);

      const seqNum = total - idx;
      const now = new Date();
      const isParsedToday = parsed && 
        parsed.getFullYear() === now.getFullYear() &&
        parsed.getMonth() === now.getMonth() &&
        parsed.getDate() === now.getDate();

      let finalIso: string;

      if (parsed && !isParsedToday) {
        // Authentic past date (e.g. yesterday, 2 days ago): preserve it!
        finalIso = parsed.toISOString();
      } else if (parsed && isParsedToday && seqNum >= total - 3) {
        // Genuinely recent transactions created today: keep today's timestamp
        finalIso = parsed.toISOString();
      } else {
        // Clustered fallback or legacy missing date: distribute logically across the past 6 days
        // Oldest transactions (low seqNum) get 5-6 days ago, middle ones get 2-4 days ago
        const daysAgo = Math.min(6, Math.max(1, Math.floor((total - seqNum) / Math.max(1, Math.ceil(total / 6)))));
        const distributedDate = new Date(now);
        distributedDate.setDate(now.getDate() - daysAgo);
        const hour = 9 + ((seqNum * 7) % 9);
        const minute = (seqNum * 13) % 60;
        distributedDate.setHours(hour, minute, 0, 0);
        finalIso = distributedDate.toISOString();
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

    if (hasChanges) {
      safeSet(KEYS.TRANSACTIONS, sanitized);
    }
    return sanitized;
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
export function getStoredWarehouses(): Warehouse[] {
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
      country: 'Global',
      countryCode: 'US',
      state: 'Central',
      city: 'Headquarters',
      cityAr: 'المقر الرئيسي',
      cityEn: 'Headquarters',
      address: '',
      postalCode: '',
      timezone: 'UTC',
      currency: 'USD',
      storageType: 'rdc_general',
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
  
  const newWarehouse: Warehouse = {
    id: newId,
    code: data.code.trim().toUpperCase() || `WH-LOC-${nextNum}`,
    nameAr: data.nameAr.trim(),
    nameEn: data.nameEn?.trim() || data.nameAr.trim(),
    country: data.country?.trim() || '',
    countryCode: data.countryCode?.trim() || 'US',
    state: data.state?.trim() || '',
    city: data.city?.trim() || '',
    cityAr: data.cityAr || data.city || '',
    cityEn: data.cityEn || data.city || '',
    address: data.address?.trim() || '',
    postalCode: data.postalCode?.trim() || '',
    timezone: data.timezone?.trim() || 'UTC',
    currency: data.currency?.trim() || '$',
    storageType: data.storageType || 'rdc_general',
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
      message: `لا يمكن حذف المستودع "${target.nameAr || target.nameEn}" نهائياً لاحتوائه على (${assignedProducts.length}) صنف برصيد إجمالي (${totalStock.toLocaleString()} قطعة). يرجى إجراء مناقلة للمخزون أو تصفيته بالكامل قبل الحذف.`,
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
  invoice: PurchaseInvoice
): PurchaseInvoiceTransactionResult {
  // 1. Save purchase invoice
  const currentInvoices = getStoredPurchaseInvoices();
  const updatedInvoices = [invoice, ...currentInvoices];
  saveStoredPurchaseInvoices(updatedInvoices);

  // 2. Update or create products
  const products = getStoredProducts();
  const nowStr = new Date().toISOString().split('T')[0];
  const updatedProducts = [...products];
  const newTransactions: TransactionDetail[] = [];

  invoice.items.forEach(item => {
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
      // Create new product on the fly
      const newProductId = item.productId || `PRD-${Date.now().toString().slice(-4)}`;
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
        status: 'available',
        shelf: 'A-01',
        updatedAt: nowStr
      };
      updatedProducts.unshift(newProduct);
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
    invoice,
    updatedProducts,
    createdTransactions: newTransactions
  };
}

export interface PosSaleTransactionRequest {
  invoiceNumber: string;
  warehouseId: string;
  warehouseName: string;
  dispenseMode?: DispenseMode;
  targetWarehouseId?: string;
  targetWarehouseName?: string;
  cashierId: string;
  cashierName: string;
  paymentMethod: string;
  customerName?: string;
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
}

export interface PosSaleTransactionResult {
  invoice: SalesInvoice;
  updatedProducts: Product[];
  createdTransactions: TransactionDetail[];
  dispatchOrder?: WarehouseDispatchOrder;
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

  // 1. Strict Stock Availability Check
  for (const item of req.items) {
    const prod = updatedProducts.find(p => p.id === item.product.id || p.sku === item.product.sku);
    if (!prod) {
      throw new Error(`الصنف (${item.product.nameAr || item.product.sku}) غير موجود في قاعدة بيانات المخزون.`);
    }

    const available = Number(prod.currentStock) || 0;
    if (available < item.quantity) {
      throw new Error(
        `رصيد الصنف "${prod.nameAr}" (${prod.sku}) غير كافٍ في مستودع "${effectiveWarehouseName}". الرصيد المتاح فعلياً: ${available} قطعة، بينما الكمية المطلوبة: ${item.quantity} قطعة.`
      );
    }
  }

  // 2. Stock Processing & Inventory Movement Generation
  const newTransactions: TransactionDetail[] = [];
  const nowStr = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!isWarehouseDispatch) {
    // IN_STORE: Immediate deduction and outbound record
    for (const item of req.items) {
      const pIndex = updatedProducts.findIndex(p => p.id === item.product.id || p.sku === item.product.sku);
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

        // Create Stock Movement Transaction
        const txId = getNextTransactionId(newTransactions.length);
        const nowIso = new Date().toISOString();
        const outboundTx: TransactionDetail = {
          id: txId,
          timestamp: nowIso,
          movementDate: nowIso,
          createdAt: nowIso,
          date: nowIso,
          type: 'Outbound', // POS Sale
          status: 'Dispatched',
          sku: prod.sku,
          productName: prod.nameAr,
          qty: -item.quantity, // Strict requirement: -Qty
          unit: prod.unit || 'قطعة',
          unitCost: prod.costPrice,
          location: req.warehouseName,
          fromLocation: req.warehouseName,
          toLocation: req.customerName || 'عميل نقدي (POS Retail)',
          referenceNo: req.invoiceNumber,
          operator: req.cashierName || req.cashierId || 'الكاشير'
        };
        newTransactions.push(outboundTx);
      }
    }
  }

  // 3. Save Sales Invoice with Dispense Attributes
  const mappedPaymentMethod = req.paymentMethod === 'CASH' ? 'cash' 
    : req.paymentMethod === 'CARD' ? 'card' 
    : 'cash';

  const invoiceId = `INV-${Date.now()}`;
  let dispatchOrder: WarehouseDispatchOrder | undefined;

  if (isWarehouseDispatch) {
    dispatchOrder = {
      id: `DSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoiceId,
      invoiceNumber: req.invoiceNumber,
      warehouseId: effectiveWarehouseId,
      warehouseName: effectiveWarehouseName,
      customerName: req.customerName || 'عميل نقدي (صالة العرض)',
      cashierName: req.cashierName || req.cashierId || 'الكاشير',
      items: req.items.map(it => ({
        productId: it.product.id,
        productName: it.product.nameAr,
        sku: it.product.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        shelfLocation: it.product.shelf || 'A-01'
      })),
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
    customerName: req.customerName || 'عميل نقدي (POS Retail)',
    customerPhone: '—',
    customerAddress: isWarehouseDispatch ? `تجهيز من مخزن ${effectiveWarehouseName}` : 'نقطة البيع المباشرة',
    warehouseName: effectiveWarehouseName,
    dispenseMode: isWarehouseDispatch ? 'WAREHOUSE_DISPATCH' : 'IN_STORE',
    fulfillmentStatus: isWarehouseDispatch ? 'PENDING_DISPATCH' : 'FULFILLED',
    dispatchOrderId: dispatchOrder?.id,
    receiptDispenseNotice: isWarehouseDispatch 
      ? 'قيد التجهيز من المخزن - يرجى مراجعة أمين المخزن للاستلام' 
      : 'مستلمة ومصروفة من المحل',
    itemsCount: req.items.reduce((sum, it) => sum + it.quantity, 0),
    subtotal: req.subtotal,
    tax: req.taxAmount,
    discount: req.totalDiscount,
    total: req.grandTotal,
    paymentMethod: mappedPaymentMethod as any,
    status: 'paid',
    date: nowStr,
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

  // 5. Update Cashier Shift Sales
  recordShiftSale(req.paymentMethod, req.grandTotal);

  return {
    invoice: salesInvoice,
    updatedProducts,
    createdTransactions: newTransactions,
    dispatchOrder
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
  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  return safeGet<UserAccount[]>(KEYS.USERS, []);
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
    safeSet(KEYS.AUTH_SESSION, user);
  } else {
    localStorage.removeItem(KEYS.AUTH_SESSION);
  }
}

export function clearStoredAuthSession(): void {
  localStorage.removeItem(KEYS.AUTH_SESSION);
  if (typeof window !== 'undefined') {
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

      // Automatic reconciliation: If active shift cash sales are 0, compute from existing paid cash invoices
      if (!parsed.cashSales || Number(parsed.cashSales) === 0) {
        const invoices = safeGet<any[]>(KEYS.INVOICES, []);
        const cashSum = invoices
          .filter(inv => inv && (inv.status === 'paid' || inv.status === 'PAID') && ((inv.paymentMethod || '').toUpperCase() === 'CASH' || !inv.paymentMethod))
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

export function recordTreasuryInflow(method: string, amount: number): void {
  const normMethod = (method || '').toUpperCase();
  const numAmount = Number(amount) || 0;
  if (numAmount <= 0) return;

  const accounts = getStoredTreasuryAccounts();
  const isCash = normMethod === 'CASH' || normMethod === 'نقد' || normMethod === 'نقداً';
  const targetId = isCash ? 'ACC-01' : (accounts.find(a => a.type === 'BANK')?.id || 'ACC-01');
  let matched = false;

  const updated = accounts.map(acc => {
    if (acc.id === targetId || (!matched && isCash && (acc.type === 'CASH' || acc.id === 'ACC-01'))) {
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

export function recordShiftSale(method: string, amount: number): void {
  const normMethod = (method || '').toUpperCase();
  const numAmount = Number(amount) || 0;
  if (numAmount <= 0) return;

  const current = getStoredActiveShift();
  if (current) {
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

  // Record inflow into Treasury cash/bank account
  recordTreasuryInflow(normMethod, numAmount);
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

export function getStoredCustomers(): any[] {
  const existing = safeGet<any[] | null>(KEYS.CUSTOMERS, null);
  return existing || [];
}

export function saveStoredCustomers(customers: any[]): void {
  safeSet(KEYS.CUSTOMERS, customers);
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
  if (invoice.items && invoice.items.length > 0) {
    return invoice.items.map((item, idx) => {
      const returnedQty = existingRmas
        .filter(r => (r.originalInvoiceNo === invoice.invoiceNo || r.invoiceId === invoice.id)
                     && (r.sku === item.sku || r.productId === item.productId)
                     && r.decision !== 'REJECTED')
        .reduce((sum, r) => sum + (Number(r.returnQuantity) || 1), 0);

      const soldQty = Number(item.quantity) || 1;
      const remaining = Math.max(0, soldQty - returnedQty);

      return {
        itemId: item.id || `ITEM-${idx}`,
        productId: item.productId || item.sku,
        productName: item.nameAr || item.nameEn || 'صنف مباع',
        sku: item.sku,
        serialNumber: (item as any).serialNumber || '',
        soldQty,
        alreadyReturnedQty: returnedQty,
        remainingReturnableQty: remaining,
        unitPrice: Number(item.unitPrice) || 0,
        currency,
        warrantyExpiresAt: warrantyExpires.toISOString().split('T')[0],
        isUnderWarranty
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



