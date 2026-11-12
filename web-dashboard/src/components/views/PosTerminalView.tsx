import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  Printer, 
  PauseCircle, 
  PlayCircle, 
  CheckCircle2, 
  RotateCcw,
  Barcode,
  Layers,
  Sparkles,
  Percent,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Lock,
  History,
  AlertCircle,
  AlertTriangle,
  Check,
  Smartphone,
  Unlock,
  X,
  User,
  Building2,
  Package,
  Zap,
  Warehouse as WarehouseIcon,
  FileText,
  CalendarClock,
  Scale
} from 'lucide-react';
import { useSettings, ScaleSettings } from '../../context/settings-context';
import { Product, DiscountAuditLog, Warehouse, SalesInvoice } from '../../types/warehouse';
import DiscountAuditTrailModal from '../modals/DiscountAuditTrailModal';
import OpenShiftModal from '../modals/OpenShiftModal';
import ElectronicScaleModal from '../modals/ElectronicScaleModal';
import { 
  ActiveShift, 
  getStoredActiveShift, 
  saveStoredActiveShift, 
  recordShiftSale,
  executePosSaleTransaction,
  createInstallmentContract,
  getStoredWarehouses,
  getStoredProducts,
  getStoredSelectedWarehouseId,
  saveStoredSelectedWarehouseId,
  clearStoredSelectedWarehouseId,
  validateAndResolveActiveWarehouse
} from '../../services/storageService';
import { formatMovementDate } from '../../utils/dateFormatter';
import PosCategoryFilter from '../PosCategoryFilter';
import { useCategories } from '../../hooks/useCategories';
import { useTenantFeatures } from '../../hooks/useAuth';
import { localizeWarehouse } from '../../lib/localeHelpers';
import { isDesktopApp, printReceiptNative } from '../../services/desktopBridgeService';

interface PosTerminalViewProps {
  products: Product[];
  warehouses?: Warehouse[];
  setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
  setTransactions?: React.Dispatch<React.SetStateAction<any[]>>;
  setInvoices?: React.Dispatch<React.SetStateAction<SalesInvoice[]>>;
  lang: 'en' | 'ar';
  currentUser?: any;
  onNavigateToShifts?: () => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  customPrice?: number; // Negotiated price directly (سعر تفاوضي)
  discountType?: 'PERCENT' | 'FIXED';
  discountValue?: number;
  priceError?: string; // "تجاوزت الحد المسموح به للخصم على هذه المادة"
}

// EAN-13 Variable Weight Barcode Parser for Retail / Supermarket Scales
function parseScaleBarcode(
  rawInput: string,
  products: Product[],
  scaleSettings?: ScaleSettings
): { product: Product; quantity: number } | null {
  if (scaleSettings?.enabled === false) return null;
  const clean = rawInput.trim();
  if (!/^\d{12,14}$/.test(clean)) return null;

  const prefixes = (scaleSettings?.prefix || '20,21,22,23,24,28,29,99')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  const matchedPrefix = prefixes.find(p => clean.startsWith(p));
  if (!matchedPrefix) return null;

  const pluLen = scaleSettings?.itemCodeLength || 5;
  const startIdx = matchedPrefix.length;
  const pluRaw = clean.substring(startIdx, startIdx + pluLen);
  const pluNum = parseInt(pluRaw, 10).toString();

  const valString = clean.substring(startIdx + pluLen, clean.length - 1);
  const valNum = parseInt(valString, 10);
  if (isNaN(valNum) || valNum <= 0) return null;

  const matchedProduct = products.find(p => {
    const b = (p.barcode || '').trim().toLowerCase();
    const s = (p.sku || '').trim().toLowerCase();
    const pluLow = pluRaw.toLowerCase();
    const pluNumLow = pluNum.toLowerCase();

    return (
      b === pluLow ||
      s === pluLow ||
      b === pluNumLow ||
      s === pluNumLow ||
      b.endsWith(pluLow) ||
      s.endsWith(pluLow) ||
      b.endsWith(pluNumLow) ||
      s.endsWith(pluNumLow) ||
      b === `${matchedPrefix}${pluRaw}` ||
      b === `${matchedPrefix}${pluRaw}00000`
    );
  });

  if (!matchedProduct) return null;

  const isPriceBased = scaleSettings?.barcodeType === 'PRICE';
  let quantity = 1;

  if (isPriceBased) {
    const unitPrice = Number(matchedProduct.sellingPrice) || 1;
    quantity = Math.round((valNum / unitPrice) * 1000) / 1000;
  } else {
    quantity = Math.round((valNum / 1000) * 1000) / 1000;
  }

  return {
    product: matchedProduct,
    quantity: Math.max(0.001, quantity)
  };
}

export default function PosTerminalView({ 
  products: propProducts, 
  warehouses: propWarehouses,
  setProducts,
  setTransactions,
  setInvoices,
  lang, 
  currentUser, 
  onNavigateToShifts 
}: PosTerminalViewProps) {
  const isAr = lang === 'ar';
  const { tenantCountryCode, isMethodAllowed, formatMoney, currencySymbol, exchangeRate, settings, t } = useSettings();
  const isIraqTenant = tenantCountryCode === 'IQ' || settings?.tenantCountryCode === 'IQ';

  // Real-time synchronization: sync products with storage
  const products = useMemo(() => {
    if (propProducts && propProducts.length > 0) return propProducts;
    return getStoredProducts();
  }, [propProducts]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [parkedCarts, setParkedCarts] = useState<CartItem[][]>([]);
  const [paymentToast, setPaymentToast] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPaymentToast = (msg: string, duration = 3500) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setPaymentToast(msg);
    toastTimerRef.current = setTimeout(() => {
      setPaymentToast('');
    }, duration);
  };

  const [stockError, setStockError] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false); // Single instance discount audit state
  const [isScaleModalOpen, setIsScaleModalOpen] = useState<boolean>(false);
  const [scaleTargetProduct, setScaleTargetProduct] = useState<Product | null>(null);

  // Available warehouses & Active selling warehouse binding (Strict Active Filtering)
  const availableWarehouses = useMemo(() => {
    const raw = propWarehouses && propWarehouses.length > 0 ? propWarehouses : getStoredWarehouses();
    return raw.filter(w => (w as any).isActive !== false && w.status !== 'maintenance');
  }, [propWarehouses]);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    const stored = getStoredSelectedWarehouseId();
    const initialCandidate = stored || currentUser?.branchId;
    const { activeWarehouseId } = validateAndResolveActiveWarehouse(availableWarehouses, initialCandidate);
    return activeWarehouseId;
  });

  // Frontend Fallback Guard: When loading or available warehouses change, verify stored ID is still active
  useEffect(() => {
    if (availableWarehouses.length === 0) return;
    const resolution = validateAndResolveActiveWarehouse(availableWarehouses, selectedWarehouseId);
    if (resolution.wasInvalidFallback || resolution.activeWarehouseId !== selectedWarehouseId) {
      setSelectedWarehouseId(resolution.activeWarehouseId);
      saveStoredSelectedWarehouseId(resolution.activeWarehouseId);
      setPaymentToast(
        isAr 
          ? `تنبيه رقابي: المستودع السابق لم يعد نشطاً. تم التحويل تلقائياً إلى "${resolution.activeWarehouse.nameAr}".` 
          : `Guard Notice: Previous warehouse is disabled/missing. Switched to "${resolution.activeWarehouse.nameEn || resolution.activeWarehouse.nameAr}".`
      );
      setTimeout(() => setPaymentToast(''), 4500);
    }
  }, [availableWarehouses, selectedWarehouseId, isAr]);

  const selectedWarehouse = useMemo(() => {
    const resolution = validateAndResolveActiveWarehouse(availableWarehouses, selectedWarehouseId);
    return resolution.activeWarehouse;
  }, [availableWarehouses, selectedWarehouseId]);

  // Multi-Tier Dispense: In-Store Direct vs Warehouse Dispatch
  const [dispenseMode, setDispenseMode] = useState<'IN_STORE' | 'WAREHOUSE_DISPATCH'>('IN_STORE');
  const [targetDispatchWarehouseId, setTargetDispatchWarehouseId] = useState<string>(() => {
    const wh = availableWarehouses.find(w => w.type === 'WAREHOUSE' || w.code.includes('WH') || w.nameAr.includes('المستودع'));
    return wh?.id || availableWarehouses[0]?.id || 'WH-01';
  });

  useEffect(() => {
    if (availableWarehouses.length === 0) return;
    const exists = availableWarehouses.some(w => w.id === targetDispatchWarehouseId);
    if (!exists) {
      const fallback = availableWarehouses.find(w => w.type === 'WAREHOUSE' || w.code.includes('WH')) || availableWarehouses[0];
      if (fallback) setTargetDispatchWarehouseId(fallback.id);
    }
  }, [availableWarehouses, targetDispatchWarehouseId]);

  // Strictly bind cashier identity to authenticated session (never dummy "a" or "admin@a")
  const effectiveCashierName = useMemo(() => {
    const raw = currentUser?.fullName?.trim() || '';
    const userRaw = currentUser?.username?.trim() || '';

    if (raw && raw !== 'a' && !raw.includes('@') && raw.toLowerCase() !== 'admin') {
      return raw;
    }
    if (userRaw && userRaw !== 'a' && !userRaw.includes('@') && userRaw.toLowerCase() !== 'admin') {
      return userRaw;
    }
    if (currentUser?.roleNameAr && currentUser.roleNameAr.trim()) {
      return currentUser.roleNameAr;
    }
    return isAr ? 'المدير العام' : 'General Manager';
  }, [currentUser, isAr]);

  // Shift & Cash Drawer Enforcement State
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(() => getStoredActiveShift());
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [shiftTerminalId, setShiftTerminalId] = useState(isAr ? 'كاشير 1' : 'POS-01');
  const [shiftOpeningFloat, setShiftOpeningFloat] = useState<number>(0);

  // Permission & Role Check
  const hasShiftPermission = currentUser ? (
    currentUser.role === 'SuperAdmin' || 
    currentUser.role === 'BranchManager' || 
    currentUser.role === 'Cashier' ||
    (currentUser.permissions && currentUser.permissions.includes('shifts.manage')) || 
    (currentUser.permissions && currentUser.permissions.includes('pos.terminal.access'))
  ) : true;

  const isManagerOrAdmin = currentUser ? (
    currentUser.role === 'SuperAdmin' || currentUser.role === 'BranchManager'
  ) : false;

  // Super Admin Feature Flag & Tenant Settings check for Electronic Scales
  const { isFeatureEnabled } = useTenantFeatures(currentUser);
  const isScaleFeatureActive = useMemo(() => {
    // 1. Super Admin Feature Flag: enableBarcodeScales must be true for the tenant activity (e.g. Grocery/Spices)
    const allowedBySuperAdmin = isFeatureEnabled('enableBarcodeScales');
    if (!allowedBySuperAdmin) return false;

    // 2. Tenant Settings: scaleSettings.enabled must not be disabled
    return settings?.scaleSettings?.enabled !== false;
  }, [isFeatureEnabled, settings?.scaleSettings?.enabled]);

  // Listen for storage shift events (e.g., opened/closed in another tab or in ShiftsView)
  React.useEffect(() => {
    const handleStorageChange = () => {
      setActiveShift(getStoredActiveShift());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasShiftPermission) return;
    const newShift: ActiveShift = {
      id: `SH-${Date.now().toString().slice(-4)}`,
      cashierName: effectiveCashierName,
      terminalId: shiftTerminalId.trim() || (isAr ? 'كاشير 1' : 'POS-01'),
      startTime: formatMovementDate(new Date()),
      openingFloat: Number(shiftOpeningFloat) || 0,
      cashSales: 0,
      cardSales: 0,
      zainCashSales: 0,
      qiCardSales: 0,
      refunds: 0,
      status: 'ACTIVE'
    };
    saveStoredActiveShift(newShift);
    setActiveShift(newShift);
    setIsOpenShiftModalOpen(false);
    setPaymentToast(isAr ? 'تم فتح وردية الكاشير بنجاح وتفعيل نقاط البيع' : 'Shift opened successfully! POS sales unlocked.');
    setTimeout(() => setPaymentToast(''), 3500);
  };
  
  // Active editing discount item
  const [editingDiscountItemId, setEditingDiscountItemId] = useState<string | null>(null);
  const [bargainInputPrice, setBargainInputPrice] = useState<string>('');


  // Local Discount Audit Logs
  const [auditLogs, setAuditLogs] = useState<DiscountAuditLog[]>([]);

  interface CompletedOrderReceipt {
    orderNumber: string;
    items: CartItem[];
    subtotal: number;
    totalDiscount: number;
    total: number;
    paymentMethod: string;
    timestamp: string;
    cashierName: string;
    warehouseName?: string;
    dispenseMode?: 'IN_STORE' | 'WAREHOUSE_DISPATCH';
    targetWarehouseName?: string;
    receiptNotice?: string;
    installmentDetails?: {
      downPayment: number;
      remainingAmount: number;
      count: number;
      monthlyAmount: number;
      guarantorName?: string;
      guarantorPhone?: string;
      firstDueDate: string;
    };
    warehouse?: {
      id?: string;
      name?: string;
      nameAr?: string;
      nameEn?: string;
    };
  }

  const [lastCompletedOrder, setLastCompletedOrder] = useState<CompletedOrderReceipt | null>(null);

  // Installment POS Modal States
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [posDownPayment, setPosDownPayment] = useState<number>(0);
  const [posInstallmentCount, setPosInstallmentCount] = useState<number>(6);
  const [posGuarantorName, setPosGuarantorName] = useState<string>('');
  const [posGuarantorPhone, setPosGuarantorPhone] = useState<string>('');
  const [posCustomerName, setPosCustomerName] = useState<string>('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useCategories();

  const getProductName = (p: Product) => {
    if (!p) return '';
    return p.nameAr || p.nameEn || '';
  };

  const filteredProducts = products.filter(p => {
    // 1. Warehouse Binding:
    // If selectedWarehouseId is 'ALL' or empty, display products from all warehouses!
    const matchesWarehouse = 
      !selectedWarehouseId || 
      selectedWarehouseId === 'ALL' || 
      !p.warehouseId || 
      p.warehouseId === 'ALL' ||
      p.warehouseId.toLowerCase() === selectedWarehouseId.toLowerCase() ||
      (selectedWarehouse && (
        (p.warehouseName && p.warehouseName === selectedWarehouse.nameAr) ||
        (p.warehouseName && p.warehouseName === selectedWarehouse.nameEn) ||
        p.warehouseId === selectedWarehouse.code
      ));
    if (!matchesWarehouse) return false;

    const selectedCatObj = categories.find(c => c.id === selectedCategory);
    const selectedCatName = selectedCatObj ? selectedCatObj.name.toLowerCase() : selectedCategory.toLowerCase();

    const matchesCat = 
      selectedCategory === 'ALL' ||
      p.categoryId === selectedCategory ||
      (p.category && (
        p.category.toLowerCase() === selectedCatName ||
        p.category.toLowerCase().includes(selectedCatName) ||
        p.category.toLowerCase() === selectedCategory.toLowerCase()
      ));
    if (!matchesCat) return false;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const pName = getProductName(p).toLowerCase();
    const matchesSearch = 
      pName.includes(query) ||
      (p.barcode && p.barcode.toLowerCase().includes(query)) ||
      (p.sku && p.sku.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query));

    return matchesSearch;
  });

  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    // 1. Strict Stock Check against current available inventory
    const currentAvailable = Number(product.currentStock) || 0;
    if (currentAvailable <= 0) {
      setStockError(
        isAr 
          ? `لا يمكن إضافة الصنف "${getProductName(product)}": نفد المخزون في مستودع (${selectedWarehouse.nameAr})!`
          : `Cannot add "${getProductName(product)}": Out of stock in (${selectedWarehouse.nameEn || selectedWarehouse.nameAr})!`
      );
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const nextQty = Math.round((existing.quantity + quantityToAdd) * 1000) / 1000;
        if (nextQty > currentAvailable) {
          setStockError(
            isAr
              ? `الكمية المطلوبة تتجاوز الرصيد المتاح (${currentAvailable}) للصنف "${getProductName(product)}" في (${selectedWarehouse.nameAr}).`
              : `Requested quantity exceeds available stock (${currentAvailable}) for "${getProductName(product)}".`
          );
          return prev;
        }
        setStockError(null);
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: nextQty }
            : item
        );
      }
      const initialQty = Math.round(quantityToAdd * 1000) / 1000;
      if (initialQty > currentAvailable) {
        setStockError(
          isAr
            ? `الكمية المطلوبة (${initialQty}) تتجاوز الرصيد المتاح (${currentAvailable}) للصنف "${getProductName(product)}".`
            : `Requested quantity exceeds available stock (${currentAvailable}) for "${getProductName(product)}".`
        );
        return prev;
      }
      setStockError(null);
      return [...prev, { product, quantity: initialQty, discountType: 'PERCENT', discountValue: 0 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const freshProd = products.find(p => p.id === productId) || item.product;
        const currentAvailable = Number(freshProd.currentStock) || 0;
        const newQty = item.quantity + delta;

        if (delta > 0 && newQty > currentAvailable) {
          setStockError(
            isAr
              ? `الكمية المطلوبة (${newQty}) تتجاوز الرصيد المتاح (${currentAvailable}) للصنف "${getProductName(freshProd)}".`
              : `Requested quantity (${newQty}) exceeds available stock (${currentAvailable}) for "${getProductName(freshProd)}".`
          );
          return item;
        }
        setStockError(null);
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const parkCurrentCart = () => {
    if (cart.length === 0) return;
    setParkedCarts(prev => [...prev, cart]);
    setCart([]);
    setPaymentToast(isAr ? 'تم تعليق الفاتورة الحالية في قائمة الانتظار' : 'Current cart parked successfully');
    setTimeout(() => setPaymentToast(''), 3000);
  };

  const resumeParkedCart = (index: number) => {
    const resumed = parkedCarts[index];
    setCart(resumed);
    setParkedCarts(prev => prev.filter((_, idx) => idx !== index));
  };



  // Floor Price Engine: Get the current effective unit price
  const getEffectiveUnitPrice = (item: CartItem): number => {
    if (item.customPrice !== undefined) {
      return item.customPrice;
    }
    if (item.discountType === 'PERCENT' && item.discountValue) {
      return Math.max(0, Math.round((item.product.sellingPrice * (1 - item.discountValue / 100)) * 100) / 100);
    }
    if (item.discountType === 'FIXED' && item.discountValue) {
      return Math.max(0, item.product.sellingPrice - item.discountValue);
    }
    return item.product.sellingPrice;
  };

  const getDiscountAmountPerUnit = (item: CartItem): number => {
    const effective = getEffectiveUnitPrice(item);
    return Math.max(0, item.product.sellingPrice - effective);
  };

  // Floor Price Engine (نظام الحد الأدنى للبيع):
  // When the employee enters any bargained price:
  // If price >= Floor Price: ACCEPTED IMMEDIATELY without any PIN or supervisor prompt!
  // If price < Floor Price: REJECTED, LOCKED, exact message: "تجاوزت الحد المسموح به للخصم على هذه المادة"
  const handleSetItemPrice = (item: CartItem, proposedPrice: number) => {
    const retail = item.product.sellingPrice;
    const floorPrice = item.product.minSellingPrice !== undefined 
      ? item.product.minSellingPrice 
      : Math.round(retail * 0.88);

    // Resetting to original retail price
    if (proposedPrice === retail) {
      setCart(prev => prev.map(ci => 
        ci.product.id === item.product.id 
          ? { ...ci, customPrice: undefined, discountType: undefined, discountValue: undefined, priceError: undefined }
          : ci
      ));
      setEditingDiscountItemId(null);
      setBargainInputPrice('');
      return;
    }

    if (proposedPrice >= floorPrice && proposedPrice >= 0) {
      // 1. Accepted immediately! No questions asked!
      setCart(prev => prev.map(ci => 
        ci.product.id === item.product.id 
          ? { 
              ...ci, 
              customPrice: proposedPrice, 
              discountType: undefined, 
              discountValue: undefined, 
              priceError: undefined 
            }
          : ci
      ));
      setEditingDiscountItemId(null);
      setBargainInputPrice('');
      setPaymentToast(isAr 
        ? `تم قبول السعر (${formatMoney(proposedPrice)}) بنجاح` 
        : `Price (${formatMoney(proposedPrice)}) accepted`);
      setTimeout(() => setPaymentToast(''), 3000);
    } else {
      // 2. Breached safety floor! Lock, reject, and show exact message.
      const errorMsg = isAr 
        ? 'تجاوزت الحد المسموح به للخصم على هذه المادة' 
        : 'Discount exceeds allowed floor limit for this item';

      setCart(prev => prev.map(ci => 
        ci.product.id === item.product.id 
          ? { 
              ...ci, 
              customPrice: proposedPrice, 
              priceError: errorMsg 
            }
          : ci
      ));
      setPaymentToast(errorMsg);
      setTimeout(() => setPaymentToast(''), 4500);
    }
  };

  const handleApplyDiscountPercent = (item: CartItem, percent: number) => {
    if (percent <= 0) {
      handleResetItemPrice(item);
      return;
    }
    const retail = item.product.sellingPrice;
    const calculatedPrice = Math.max(0, Math.round((retail * (1 - percent / 100)) * 100) / 100);
    handleSetItemPrice(item, calculatedPrice);
  };

  const handleResetItemPrice = (item: CartItem) => {
    setCart(prev => prev.map(ci => 
      ci.product.id === item.product.id 
        ? { ...ci, customPrice: undefined, discountType: undefined, discountValue: undefined, priceError: undefined }
        : ci
    ));
    setEditingDiscountItemId(null);
    setBargainInputPrice('');
  };

  // Totals Calculations Memoized (Isolated from searchQuery and park actions)
  const {
    subtotal,
    totalDiscount,
    subtotalAfterDiscount,
    taxRatePercent,
    tax,
    grandTotal,
    currentExchangeRate,
    isIqdBase,
    totalIqd
  } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);
    const disc = cart.reduce((sum, item) => sum + (getDiscountAmountPerUnit(item) * item.quantity), 0);
    const subAfter = Math.max(0, sub - disc);

    // Dynamic Tax from Company Settings (0% if tax is not enabled)
    const isTaxOn = (settings as any)?.isTaxEnabled ?? false;
    const ratePct = isTaxOn ? (Number((settings as any)?.taxRate) || 0) : 0;
    const taxAmt = subAfter * (ratePct / 100);
    let gTotal = subAfter + taxAmt;

    // Currency & Exchange Rate Resolution (Single source from useSettings hook)
    const rate = exchangeRate || (settings as any)?.exchangeRateUsdToIqd || 1520;
    const iqdBase = ((settings as any)?.baseCurrency === 'IQD') || (!((settings as any)?.baseCurrency) && (currencySymbol === 'د.ع' || currencySymbol === 'IQD'));

    // In Iraqi Dinars, physical cash and retail transactions strictly round to the nearest 250 IQD (banknote minimum)
    if (iqdBase) {
      gTotal = Math.round(gTotal / 250) * 250;
    }

    // If base currency is IQD, grandTotal is the final direct dinar amount (never multiply by exchange rate).
    // If base currency is USD, calculate the parallel IQD reference amount for the buyer.
    const totIqd = iqdBase ? gTotal : Math.round(gTotal * rate);

    return {
      subtotal: sub,
      totalDiscount: disc,
      subtotalAfterDiscount: subAfter,
      taxRatePercent: ratePct,
      tax: taxAmt,
      grandTotal: gTotal,
      currentExchangeRate: rate,
      isIqdBase: iqdBase,
      totalIqd: totIqd
    };
  }, [cart, exchangeRate, settings, isIraqTenant, currencySymbol]);

  const handleCheckout = (
    method: 'CASH' | 'CARD' | 'ZAIN_CASH' | 'QI_CARD' | 'INSTALLMENT' | string,
    installmentData?: {
      downPayment: number;
      installmentCount: number;
      guarantorName: string;
      guarantorPhone: string;
      customerName?: string;
    }
  ) => {
    if (cart.length === 0) return;

    if (!activeShift) {
      showPaymentToast(
        t('posMessages.shiftClosedError', isAr ? 'لا يمكن إتمام البيع: الوردية مقفلة، يرجى فتح وردية كاشير أولاً' : 'Cannot checkout: Shift is closed, please open a shift first')
      );
      setIsOpenShiftModalOpen(true);
      return;
    }

    // Strict regional check
    if (!isMethodAllowed(method)) {
      showPaymentToast(
        t('posMessages.paymentMethodRestricted', isAr ? 'وسيلة الدفع غير مدعومة في النطاق الجغرافي للمتجر' : 'Payment method restricted by region')
      );
      return;
    }

    setStockError(null);

    const isWarehouseDispatch = dispenseMode === 'WAREHOUSE_DISPATCH';
    const targetWh = isWarehouseDispatch
      ? (availableWarehouses.find(w => w.id === targetDispatchWarehouseId) || selectedWarehouse)
      : selectedWarehouse;
    const targetWhLabel = isAr ? targetWh.nameAr : (targetWh.nameEn || targetWh.nameAr);

    // 1. Strict Stock Availability Check across ALL cart items for the designated warehouse
    const stockShortages: string[] = [];
    for (const item of cart) {
      const freshProd = products.find(p => p.id === item.product.id || p.sku === item.product.sku) || item.product;
      const currentAvailable = Number(freshProd.currentStock) || 0;
      if (item.quantity > currentAvailable) {
        stockShortages.push(
          isAr
            ? `• الصنف "${getProductName(freshProd)}" [كود: ${freshProd.sku}] — المطلوب: ${item.quantity} | المتبقي فعلياً في ${targetWhLabel}: ${currentAvailable} قطعة`
            : `• "${getProductName(freshProd)}" [${freshProd.sku}] — Requested: ${item.quantity} | Remaining in ${targetWhLabel}: ${currentAvailable}`
        );
      }
    }

    if (stockShortages.length > 0) {
      const msg = isAr
        ? `تم رفض الفاتورة! رصيد المخزون غير كافٍ في مستودع (${targetWhLabel}):\n${stockShortages.join('\n')}`
        : `Checkout Rejected! Insufficient inventory in (${targetWhLabel}):\n${stockShortages.join('\n')}`;
      setStockError(msg);
      showPaymentToast(
        t('posMessages.insufficientStock', isAr ? 'فشل إتمام البيع: كميات بعض المواد غير متوفرة في المستودع!' : 'Checkout failed: items out of stock!')
      );
      return;
    }

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    try {
      // 2. Execute Atomic POS Sale Transaction (Deduction or Staged Dispatch + Movement + Sales Invoice + Shift Sales)
      const result = executePosSaleTransaction({
        invoiceNumber,
        warehouseId: selectedWarehouse.id,
        warehouseName: selectedWarehouse.nameAr,
        dispenseMode,
        targetWarehouseId: targetWh.id,
        targetWarehouseName: targetWh.nameAr,
        cashierId: activeShift.terminalId,
        cashierName: effectiveCashierName,
        paymentMethod: method,
        customerName: t('posMessages.defaultCustomer', isAr ? 'عميل كاشير مباشر (POS Retail)' : 'Retail Walk-in Customer'),
        items: cart.map(it => {
          const discUnit = getDiscountAmountPerUnit(it);
          const unitPrice = getEffectiveUnitPrice(it);
          return {
            product: it.product,
            quantity: it.quantity,
            unitPrice,
            discountType: it.discountType || 'PERCENT',
            discountValue: it.discountValue || 0,
            discountAmountMoney: discUnit * it.quantity,
            totalPrice: unitPrice * it.quantity
          };
        }),
        subtotal,
        totalDiscount,
        taxAmount: tax,
        grandTotal
      });

      // 3. Instant UI State Update (Cache Invalidation & Real-time deduction)
      if (setProducts) {
        setProducts(result.updatedProducts);
      }
      if (setTransactions) {
        setTransactions(prev => [...result.createdTransactions, ...prev]);
      }
      if (setInvoices) {
        setInvoices(prev => [result.invoice, ...prev]);
      }

      // Create Audit Log entries for discounted items
      const newLogs: DiscountAuditLog[] = [];
      cart.forEach(item => {
        const discUnit = getDiscountAmountPerUnit(item);
        if (discUnit > 0) {
          newLogs.push({
            id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            invoiceNumber,
            productId: item.product.id,
            productSku: item.product.sku,
            productName: getProductName(item.product),
            discountType: item.discountType || 'PERCENT',
            discountValue: item.discountValue || 0,
            discountAmountMoney: discUnit * item.quantity,
            originalRetailPrice: item.product.sellingPrice,
            finalSellingPrice: getEffectiveUnitPrice(item),
            cashierId: activeShift.terminalId,
            cashierName: effectiveCashierName,
            wasManagerOverride: false,
            overrideReason: 'تفاوض ومكاسرة كاشير ضمن الحد الأدنى المسموح (Floor Price)',
            createdAt: new Date().toISOString()
          });
        }
      });

      if (newLogs.length > 0) {
        setAuditLogs(prev => [...newLogs, ...prev]);
      }

      // Record Shift Sale into storage and update activeShift state
      setActiveShift(getStoredActiveShift());

      let createdInstallmentDetails: CompletedOrderReceipt['installmentDetails'] = undefined;
      if (method === 'INSTALLMENT' && installmentData) {
        const rem = Math.max(0, grandTotal - installmentData.downPayment);
        const monthly = installmentData.installmentCount > 0 ? Math.round(rem / installmentData.installmentCount) : 0;
        const firstDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        createInstallmentContract({
          invoiceId: result.invoice.id,
          customerName: installmentData.customerName || t('posMessages.defaultCustomer', isAr ? 'عميل كاشير مباشر (POS Retail)' : 'Retail Walk-in Customer'),
          guarantorName: installmentData.guarantorName.trim(),
          guarantorPhone: installmentData.guarantorPhone.trim(),
          totalCashPrice: subtotal,
          totalInstallmentPrice: grandTotal,
          downPayment: installmentData.downPayment,
          remainingAmount: rem,
          installmentCount: installmentData.installmentCount,
          monthlyAmount: monthly,
          startDate: new Date().toISOString(),
          notes: `عقد بيع بالتقسيط صادر من الكاشير لفاتورة #${invoiceNumber}`
        });

        createdInstallmentDetails = {
          downPayment: installmentData.downPayment,
          remainingAmount: rem,
          count: installmentData.installmentCount,
          monthlyAmount: monthly,
          guarantorName: installmentData.guarantorName,
          guarantorPhone: installmentData.guarantorPhone,
          firstDueDate
        };
      }

      const orderData: CompletedOrderReceipt = {
        orderNumber: invoiceNumber,
        items: [...cart],
        subtotal,
        totalDiscount,
        total: grandTotal,
        paymentMethod: method,
        timestamp: new Date().toLocaleString(),
        cashierName: effectiveCashierName,
        warehouseName: selectedWarehouse?.nameAr || selectedWarehouse?.nameEn || selectedWarehouse?.code || 'WH-01',
        dispenseMode,
        targetWarehouseName: targetWhLabel,
        receiptNotice: isWarehouseDispatch 
          ? (isAr ? 'قيد التجهيز من المخزن - يرجى مراجعة أمين المخزن للاستلام' : 'Pending Warehouse Dispatch - Please claim at warehouse')
          : (isAr ? 'مستلمة ومصروفة من المحل' : 'Dispensed and received in-store'),
        installmentDetails: createdInstallmentDetails,
        warehouse: {
          id: selectedWarehouse?.id,
          name: selectedWarehouse?.nameAr,
          nameAr: selectedWarehouse?.nameAr,
          nameEn: selectedWarehouse?.nameEn
        }
      };

      setLastCompletedOrder(orderData);
      setShowReceiptModal(true);
      setCart([]);
      setStockError(null);
      const warehouseLabel = isAr ? selectedWarehouse.nameAr : (selectedWarehouse.nameEn || selectedWarehouse.nameAr);
      showPaymentToast(
        isWarehouseDispatch
          ? (isAr ? `تم تسجيل طلب التجهيز وإرساله لأمين المخزن (${targetWhLabel}) بنجاح!` : `Dispatch order queued for warehouse keeper at (${targetWhLabel})!`)
          : t('posMessages.saleSuccess', isAr 
            ? `تم إتمام عملية البيع وخصم الكميات من مستودع (${warehouseLabel}) وتوثيق حركة الصرف بنجاح!` 
            : `Sale completed & stock deducted from (${warehouseLabel})!`),
        4000
      );

      // 4. Background Async API Call to Backend (if online)
      try {
        const token = localStorage.getItem('zilox_auth_token') || localStorage.getItem('logistock_erp_jwt_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (tenantCountryCode) headers['X-Tenant-Country'] = tenantCountryCode;

        fetch('/api/pos/invoices', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            warehouseId: selectedWarehouse.id,
            dispenseMode,
            targetWarehouseId: targetWh.id,
            cashierId: activeShift.terminalId,
            cashierName: effectiveCashierName,
            paymentMethod: method,
            items: cart.map(it => ({
              productId: it.product.id,
              quantity: it.quantity,
              discountType: it.discountType || 'NONE',
              discountValue: it.discountValue || 0
            }))
          })
        }).then(async res => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.errorCode === 'INVALID_WAREHOUSE') {
              clearStoredSelectedWarehouseId();
              const resolution = validateAndResolveActiveWarehouse(availableWarehouses);
              setSelectedWarehouseId(resolution.activeWarehouseId);
              saveStoredSelectedWarehouseId(resolution.activeWarehouseId);
            }
          }
        }).catch(() => {
          // Handled safely locally
        });
      } catch {}

    } catch (err: any) {
      if (err.message?.includes('INVALID_WAREHOUSE') || err.message?.includes('المستودع المحدد غير موجود أو تم تعطيله')) {
        clearStoredSelectedWarehouseId();
        const resolution = validateAndResolveActiveWarehouse(availableWarehouses);
        setSelectedWarehouseId(resolution.activeWarehouseId);
        saveStoredSelectedWarehouseId(resolution.activeWarehouseId);
        setStockError(isAr ? 'المستودع المحدد غير موجود أو تم تعطيله. تم تحويلك تلقائياً إلى المستودع الرئيسي النشط.' : 'Selected warehouse is invalid or inactive. Switched to active main warehouse.');
        showPaymentToast(isAr ? 'المستودع غير صالح - تم اختيار المستودع النشط' : 'Invalid warehouse - switched to active warehouse', 4000);
      } else {
        setStockError(err.message || t('posMessages.transactionError', isAr ? 'حدث خطأ أثناء تنفيذ معاملة البيع وخصم المخزون' : 'Error executing sale transaction'));
        showPaymentToast(t('posMessages.saleFailed', isAr ? 'فشل تنفيذ عملية البيع' : 'Sale transaction failed'), 4000);
      }
    }
  };

  return (
    <div className="view-content-wrapper fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {paymentToast && (
        <div 
          className="fixed bottom-6 start-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900/95 dark:bg-card text-white dark:text-foreground border border-slate-700/80 dark:border-border shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{ maxWidth: '440px' }}
        >
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold leading-relaxed flex-1">{paymentToast}</span>
          <button
            type="button"
            onClick={() => {
              if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
              setPaymentToast('');
            }}
            className="p-1 rounded-md hover:bg-white/10 dark:hover:bg-muted text-slate-400 hover:text-white dark:hover:text-foreground transition-colors cursor-pointer shrink-0"
            title={isAr ? 'إغلاق الإشعار' : 'Dismiss'}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* POS Top Bar */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <ShoppingCart size={15} style={{ color: 'var(--primary)' }} />
            <span>{isAr ? 'نقطة البيع السريعة وقارئ الباركود (Blind Discount Engine)' : 'Fast Cloud POS Terminal (Blind Discount Engine)'}</span>
          </p>
        </div>

        <div className="module-actions-wrap" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Selling Warehouse Binding */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            color: '#1e293b'
          }}>
            <Building2 size={14} style={{ color: 'var(--primary)' }} />
            <span>{isAr ? 'مستودع البيع والخصم:' : 'Sales Hub:'}</span>
            {isManagerOrAdmin && currentUser?.features?.multiWarehouse !== false ? (
              <select
                value={selectedWarehouseId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedWarehouseId(newId);
                  saveStoredSelectedWarehouseId(newId);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  fontSize: '11px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="ALL">{isAr ? '🌐 جميع المستودعات والفروع (الكل)' : '🌐 All Warehouses & Hubs'}</option>
                {availableWarehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.nameAr} ({w.code})</option>
                ))}
              </select>
            ) : (
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>
                {selectedWarehouseId === 'ALL' ? (isAr ? 'جميع المستودعات والفروع' : 'All Warehouses') : `${selectedWarehouse?.nameAr || 'المستودع الرئيسي'} (${selectedWarehouse?.code || 'WH-01'})`}
              </span>
            )}
          </div>

          {/* Active Shift Indicator & Quick Control */}
          {activeShift ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              color: '#065f46',
              fontWeight: 700
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span>{isAr ? `وردية: ${activeShift.cashierName}` : `Shift: ${activeShift.cashierName}`}</span>
              <span style={{ color: '#047857', fontSize: '10px' }}>({activeShift.terminalId})</span>
              {onNavigateToShifts && (
                <button
                  type="button"
                  onClick={onNavigateToShifts}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#059669',
                    fontSize: '10px',
                    cursor: 'pointer',
                    padding: '0 2px',
                    textDecoration: 'underline'
                  }}
                >
                  {isAr ? 'إغلاق الوردية' : 'Close Shift'}
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              color: '#be123c',
              fontWeight: 700
            }}>
              <Lock size={12} />
              <span>{isAr ? 'الوردية مقفلة' : 'Shift Closed'}</span>
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(true)}
                style={{
                  background: '#be123c',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                {isAr ? 'فتح وردية' : 'Open'}
              </button>
            </div>
          )}

          {/* Security & Masking Indicator Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--success-light)',
            border: '1px solid var(--success-border)',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            color: 'var(--success)',
            fontWeight: 700
          }}>
            <ShieldCheck size={13} />
            <span>{isAr ? 'حماية التكلفة مشغلة (Cost Masked)' : 'Strict Cost Masking Active'}</span>
          </div>

          {/* Audit Trail Button */}
          <button
            onClick={() => setShowAuditModal(true)}
            className="filter-pill"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              background: 'var(--primary-light)',
              border: '1px solid var(--primary-glow)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <History size={14} />
            <span>{isAr ? 'سجل تدقيق الخصومات' : 'Discount Audit Log'}</span>
            <span style={{
              background: 'var(--primary)',
              color: '#fff',
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '10px'
            }}>
              {auditLogs.length}
            </span>
          </button>

          {/* Parked Carts */}
          {parkedCarts.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 700 }}>
                {isAr ? `معلقة (${parkedCarts.length}):` : `Parked (${parkedCarts.length}):`}
              </span>
              {parkedCarts.map((_, idx) => (
                <button
                  key={idx}
                  className="filter-pill"
                  onClick={() => resumeParkedCart(idx)}
                  style={{ padding: '3px 8px', fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24' }}
                >
                  <PlayCircle size={12} style={{ display: 'inline', marginLeft: isAr ? '4px' : '0', marginRight: isAr ? '0' : '4px' }} />
                  #{idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stock Check Alert Banner */}
      {stockError && (
        <div style={{
          margin: '0 0 12px 0',
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius)',
          color: '#991b1b',
          fontSize: '12px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
            <div style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}>{stockError}</div>
          </div>
          <button
            type="button"
            onClick={() => setStockError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* POS Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 410px', gap: '18px', flex: 1, minHeight: 0 }}>
        {/* Left Column: Product Catalog & Barcode Search */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Search & Category Filter */}
          <div className="glass-panel" style={{ padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="search-bar-wrap" style={{ flex: 1 }}>
              <Barcode size={18} className="search-icon-inside" style={{ color: 'var(--primary)' }} />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder={isAr ? 'امسح الباركود بقارئ الليزر أو ابحث... [F1]' : 'Scan barcode or search... [F1]'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const raw = searchQuery.trim();
                    if (!raw) return;

                    // 1. Check if input matches an Electronic Scale Barcode (only if scale feature is active)
                    if (isScaleFeatureActive) {
                      const scaleMatch = parseScaleBarcode(raw, products, settings?.scaleSettings);
                      if (scaleMatch) {
                        addToCart(scaleMatch.product, scaleMatch.quantity);
                        setSearchQuery('');
                        const unitStr = isAr ? 'كغم' : 'kg';
                        showPaymentToast(
                          isAr 
                            ? `⚖️ ميزان باركود: تم إضافة (${scaleMatch.product.nameAr}) بوزن ${scaleMatch.quantity} ${unitStr}`
                            : `⚖️ Scale Item: Added (${scaleMatch.product.nameAr}) [${scaleMatch.quantity} ${unitStr}]`
                        );
                        return;
                      }
                    }

                    // 2. Direct exact barcode / SKU match
                    const exactMatched = products.find(p => 
                      (p.barcode && p.barcode.toLowerCase() === raw.toLowerCase()) || 
                      (p.sku && p.sku.toLowerCase() === raw.toLowerCase())
                    );
                    if (exactMatched) {
                      addToCart(exactMatched, 1);
                      setSearchQuery('');
                      showPaymentToast(isAr ? `تمت إضافة (${exactMatched.nameAr})` : `Added ${exactMatched.nameAr}`);
                      return;
                    }

                    // 3. Fallback to filtered list or name match
                    if (filteredProducts.length > 0) {
                      addToCart(filteredProducts[0], 1);
                      setSearchQuery('');
                    } else {
                      const q = raw.toLowerCase();
                      const matched = products.find(p => 
                        (p.nameAr && p.nameAr.toLowerCase() === q) || 
                        (p.nameEn && p.nameEn.toLowerCase() === q)
                      );
                      if (matched) {
                        addToCart(matched, 1);
                        setSearchQuery('');
                        showPaymentToast(isAr ? `تمت إضافة (${matched.nameAr}) من مستودع (${matched.warehouseName || 'المستودع'})` : `Added ${matched.nameAr}`);
                      }
                    }
                  }
                }}
                autoFocus
              />
            </div>

            <PosCategoryFilter
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              lang={lang}
            />

            {/* Quick Smart Scale Launcher Button (Conditionally rendered by Super Admin Feature Flag) */}
            {isScaleFeatureActive && (
              <button
                type="button"
                onClick={() => {
                  setScaleTargetProduct(null);
                  setIsScaleModalOpen(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  background: 'rgba(245, 158, 11, 0.08)',
                  color: '#d97706',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
                title={isAr ? 'الميزان الإلكتروني الذكي (قراءة مباشرة أو وزن سريع)' : 'Smart Electronic Scale'}
              >
                <Scale size={16} />
                <span>{isAr ? 'الميزان' : 'Scale'}</span>
              </button>
            )}
          </div>

          {/* Product Grid (Masked: NO Cost Price) - alignContent: 'start' prevents single rows from stretching vertically */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', 
            alignContent: 'start',
            gap: '12px', 
            paddingRight: '4px' 
          }}>
            {filteredProducts.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                padding: '48px 24px',
                textAlign: 'center',
                background: 'var(--card)',
                border: '2px dashed var(--border)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                color: 'var(--muted-foreground)',
                minHeight: '260px'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Package size={28} />
                </div>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 6px 0' }}>
                    {isAr ? 'لم يتم العثور على أي منتجات مطابقة' : 'No matching products found'}
                  </h4>
                  <p style={{ fontSize: '12px', maxWidth: '420px', margin: 0, lineHeight: '1.6' }}>
                    {searchQuery 
                      ? (isAr ? `لا توجد أصناف تطابق عبارة البحث "${searchQuery}"` : `No items matching "${searchQuery}"`)
                      : (isAr ? 'قد تكون المنتجات مسجلة في مستودع آخر أو تم حصرها بتصنيف مختلف.' : 'Products may be assigned to another warehouse or filtered by category.')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
                  {(selectedWarehouseId !== 'ALL' || selectedCategory !== 'ALL' || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWarehouseId('ALL');
                        saveStoredSelectedWarehouseId('ALL');
                        setSelectedCategory('ALL');
                        setSearchQuery('');
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        background: 'var(--primary)',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px var(--primary-glow)'
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>{isAr ? 'عرض كافة الأصناف من جميع المستودعات' : 'Show All Items from All Warehouses'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredProducts.map(p => {
                const currentAvailable = Number(p.currentStock) || 0;
                const isOutOfStock = currentAvailable <= 0;

                return (
                  <div
                    key={p.id}
                    className="pos-product-card glass-panel clickable"
                    onClick={() => addToCart(p)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isOutOfStock ? '1px dashed rgba(239, 68, 68, 0.4)' : '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '135px',
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      background: isOutOfStock ? 'rgba(239, 68, 68, 0.05)' : 'var(--card)',
                      opacity: isOutOfStock ? 0.75 : 1,
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>{p.sku}</span>
                        <span style={{ fontSize: '10px', color: 'var(--primary)', background: 'var(--primary-light)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          {isAr ? 'سقف: 5%' : 'Max: 5%'}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '13px', margin: '6px 0 4px 0', fontWeight: 700, color: 'var(--foreground)', lineHeight: '1.4' }}>{getProductName(p)}</h4>
                      
                      {/* Live Stock Badge */}
                      <div style={{ marginTop: '4px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: currentAvailable > 5 ? '#059669' : currentAvailable > 0 ? '#d97706' : '#dc2626',
                          background: currentAvailable > 5 ? '#ecfdf5' : currentAvailable > 0 ? '#fffbeb' : '#fee2e2',
                          border: `1px solid ${currentAvailable > 5 ? '#a7f3d0' : currentAvailable > 0 ? '#fde68a' : '#fecaca'}`,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-block'
                        }}>
                          {currentAvailable > 0 
                            ? `${isAr ? 'المخزون:' : 'Stock:'} ${currentAvailable} ${p.unit || ''}` 
                            : (isAr ? 'نفد من المستودع' : 'Out of stock')}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
                      <div>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: isOutOfStock ? '#94a3b8' : '#059669' }}>
                          {formatMoney(p.sellingPrice)}
                        </span>
                      </div>
                      <button 
                        disabled={isOutOfStock}
                        style={{ 
                          background: isOutOfStock ? '#e2e8f0' : 'var(--primary)', 
                          border: 'none', 
                          color: isOutOfStock ? '#94a3b8' : '#fff', 
                          borderRadius: '6px', 
                          width: '28px', 
                          height: '28px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer', 
                          boxShadow: isOutOfStock ? 'none' : '0 2px 6px var(--primary-glow)' 
                        }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Cart with Line Item Blind Discounts */}
        <div className="glass-panel" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}>
          {/* Cart Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--muted)/40' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--foreground)' }}>{isAr ? 'سلة المبيعات' : 'Active Cart'}</h3>
              <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px' }}>
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </div>

            {cart.length > 0 && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={parkCurrentCart}
                  title={isAr ? 'تعليق الفاتورة' : 'Park Cart'}
                  style={{ background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer' }}
                >
                  <PauseCircle size={18} />
                </button>
                <button 
                  onClick={clearCart}
                  title={isAr ? 'تفريغ السلة' : 'Clear Cart'}
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
                <ShoppingCart size={40} style={{ opacity: 0.3, margin: '0 auto 12px auto' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>{isAr ? 'السلة فارغة حالياً' : 'Cart is empty'}</p>
                <span style={{ fontSize: '12px' }}>{isAr ? 'امسح الباركود أو انقر على صنف لإضافته' : 'Scan barcode or click items to add'}</span>
              </div>
            ) : (
              cart.map(item => {
                const discountPerUnit = getDiscountAmountPerUnit(item);
                const finalUnitPrice = getEffectiveUnitPrice(item);
                const isModified = item.customPrice !== undefined || (item.discountValue || 0) > 0;
                const floorPrice = item.product.minSellingPrice !== undefined 
                  ? item.product.minSellingPrice 
                  : Math.round(item.product.sellingPrice * 0.88);
                const isBreached = !!item.priceError || finalUnitPrice < floorPrice;

                return (
                  <div 
                    key={item.product.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius)',
                      background: isBreached 
                        ? 'rgba(239, 68, 68, 0.08)' 
                        : isModified 
                          ? 'rgba(16, 185, 129, 0.06)' 
                          : '#f8fafc',
                      border: isBreached 
                        ? '1px solid rgba(239, 68, 68, 0.4)' 
                        : isModified 
                          ? '1px solid rgba(16, 185, 129, 0.3)' 
                          : '1px solid var(--border)',
                      marginBottom: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Item Title and Total Line Price */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>{getProductName(item.product)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                            {formatMoney(item.product.sellingPrice)}
                          </span>
                          {isModified && (
                            <span style={{ 
                              fontSize: '11px', 
                              color: isBreached ? '#ef4444' : '#059669', 
                              fontWeight: 700 
                            }}>
                              ({formatMoney(finalUnitPrice)})
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                        <span style={{ 
                              fontSize: '14px', 
                              fontWeight: 700, 
                              color: isBreached ? '#ef4444' : '#059669' 
                        }}>
                          {formatMoney(finalUnitPrice * item.quantity)}
                        </span>
                        {isModified && (
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted-foreground)', textDecoration: 'line-through' }}>
                            {formatMoney(item.product.sellingPrice * item.quantity)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stock Deficit Warning */}
                    {(() => {
                      const freshProd = products.find(p => p.id === item.product.id || p.sku === item.product.sku) || item.product;
                      const available = Number(freshProd.currentStock) || 0;
                      if (item.quantity > available) {
                        return (
                          <div style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            color: '#dc2626',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <AlertCircle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                            <span>
                              {isAr 
                                ? `تنبيه: الكمية المطلوبة (${item.quantity}) تتجاوز رصيد المستودع (${available})!`
                                : `Shortage: In stock ${available} only (Req: ${item.quantity})`}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Floor Price Breach Alert Warning */}
                    {isBreached && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.18)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        color: '#fca5a5',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <AlertTriangle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                          <span>{item.priceError || (isAr ? 'تجاوزت الحد المسموح به للخصم على هذه المادة' : 'Discount exceeds floor limit')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleResetItemPrice(item)}
                          style={{
                            background: '#ef4444',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isAr ? 'استعادة السعر' : 'Reset'}
                        </button>
                      </div>
                    )}

                    {/* Quantity & Bargaining Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      {/* Price Bargaining Trigger Button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isBreached ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDiscountItemId(editingDiscountItemId === item.product.id ? null : item.product.id);
                              setBargainInputPrice(finalUnitPrice.toString());
                            }}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            <AlertCircle size={11} />
                            <span>{isAr ? `تعديل السعر المرفوض (${formatMoney(finalUnitPrice)})` : `Invalid Price (${formatMoney(finalUnitPrice)})`}</span>
                          </button>
                        ) : isModified ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDiscountItemId(editingDiscountItemId === item.product.id ? null : item.product.id);
                              setBargainInputPrice(finalUnitPrice.toString());
                            }}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              color: '#34d399',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            <Check size={11} />
                            <span>{isAr ? `سعر تفاوضي: ${formatMoney(finalUnitPrice)}` : `Bargained: ${formatMoney(finalUnitPrice)}`}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDiscountItemId(editingDiscountItemId === item.product.id ? null : item.product.id);
                              setBargainInputPrice(item.product.sellingPrice.toString());
                            }}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'var(--card)',
                              border: '1px solid var(--border)',
                              color: 'var(--foreground)',
                              fontSize: '11px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            <Tag size={11} />
                            <span>{isAr ? 'مكاسرة / سعر مخصص' : 'Bargain Price'}</span>
                          </button>
                        )}
                      </div>

                      {/* Quantity buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                          onClick={() => updateQuantity(item.product.id, -1)}
                          style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <Minus size={12} />
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '18px', textAlign: 'center', color: 'var(--foreground)' }}>{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.product.id, 1)}
                          style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <Plus size={12} />
                        </button>
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', marginLeft: '6px', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Popover / Expandable Bargaining Panel for Item */}
                    {editingDiscountItemId === item.product.id && (
                      <div style={{
                        marginTop: '6px',
                        padding: '10px',
                        background: 'rgba(0,0,0,0.5)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.12)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                            {isAr ? 'مكاسرة وتفاوض مع الزبون (Floor Price Protection):' : 'Bargaining & Negotiated Price:'}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {isAr ? `السعر الرسمي: ${formatMoney(item.product.sellingPrice)}` : `Retail: ${formatMoney(item.product.sellingPrice)}`}
                          </span>
                        </div>

                        {/* Direct Price Input */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <span style={{ position: 'absolute', left: isAr ? undefined : '8px', right: isAr ? '8px' : undefined, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '11px', fontWeight: 700 }}>{currencySymbol}</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={isAr ? `اكتب السعر مثلا: ${Math.round(item.product.sellingPrice * 0.9)}` : 'Enter negotiated price'}
                              value={bargainInputPrice}
                              onChange={(e) => setBargainInputPrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseFloat(bargainInputPrice);
                                  if (!isNaN(val)) handleSetItemPrice(item, val);
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: isAr ? '6px 22px 6px 8px' : '6px 8px 6px 22px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                background: 'var(--card)',
                                border: '1px solid var(--border)',
                                color: 'var(--foreground)'
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const val = parseFloat(bargainInputPrice);
                              if (!isNaN(val)) handleSetItemPrice(item, val);
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: 'var(--primary)',
                              border: 'none',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px var(--primary-glow)'
                            }}
                          >
                            {isAr ? 'تثبيت السعر' : 'Apply'}
                          </button>
                        </div>

                        {/* Quick Presets: 5%, 10%, 15% */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                          {[5, 10, 15].map(pct => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => handleApplyDiscountPercent(item, pct)}
                              style={{
                                flex: 1,
                                padding: '4px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                background: 'var(--primary-light)',
                                border: '1px solid var(--primary-glow)',
                                color: 'var(--primary)'
                              }}
                            >
                              -{pct}% ({formatMoney(Math.round(item.product.sellingPrice * (1 - pct / 100)))})
                            </button>
                          ))}
                          {isModified && (
                            <button
                              type="button"
                              onClick={() => handleResetItemPrice(item)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                background: 'var(--destructive-light)',
                                border: '1px solid var(--destructive-border)',
                                color: 'var(--destructive)',
                                cursor: 'pointer'
                              }}
                            >
                              {isAr ? 'إلغاء' : 'Reset'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Summary & Payment */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--muted)/30' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
              <span>{isAr ? 'المجموع الفرعي الأصلي:' : 'Original Subtotal:'}</span>
              <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{formatMoney(subtotal)}</span>
            </div>

            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#059669', marginBottom: '4px', fontWeight: 600 }}>
                <span>{isAr ? 'إجمالي الخصم التفاوضي:' : 'Negotiated Discounts:'}</span>
                <span>-{formatMoney(totalDiscount)}</span>
              </div>
            )}

            {taxRatePercent > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                <span>{isAr ? `ضريبة القيمة المضافة (${taxRatePercent}%):` : `Tax (${taxRatePercent}%):`}</span>
                <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{formatMoney(tax)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>{isAr ? 'المجموع النهائي:' : 'Grand Total:'}</span>
              <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#059669' }}>{formatMoney(grandTotal)}</span>
                {settings.multiCurrencyEnabled && grandTotal > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>
                    <span>~ {isIqdBase ? `$ ${(currentExchangeRate > 0 ? (grandTotal / currentExchangeRate).toFixed(2) : '0.00')}` : `${Math.round(grandTotal * currentExchangeRate).toLocaleString('en-US')} د.ع`}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Check if any item breached floor limit or has stock deficit */}
            {(() => {
              const hasFloorBreach = cart.some(ci => 
                !!ci.priceError || getEffectiveUnitPrice(ci) < (ci.product.minSellingPrice ?? Math.round(ci.product.sellingPrice * 0.88))
              );
              const hasStockDeficit = cart.some(ci => {
                const fresh = products.find(p => p.id === ci.product.id || p.sku === ci.product.sku) || ci.product;
                return ci.quantity > (fresh.currentStock || 0);
              });
              const isShiftActive = !!activeShift;
              const canCheckout = cart.length > 0 && !hasFloorBreach && !hasStockDeficit && isShiftActive;

              return (
                <>
                  {/* Shift Locked Warning Banner */}
                  {!isShiftActive && (
                    <div style={{
                      background: '#fff1f2',
                      border: '1.5px solid #fecdd3',
                      borderRadius: '10px',
                      padding: '12px',
                      marginBottom: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c', fontWeight: 700, fontSize: '13px' }}>
                        <Lock size={16} style={{ flexShrink: 0 }} />
                        <span>{isAr ? 'الوردية مقفلة حالياً - البيع معطّل' : 'Shift Locked - Checkout Disabled'}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#881337', lineHeight: 1.5 }}>
                        {isAr 
                          ? 'يرجى فتح وردية كاشير جديدة وتسجيل الرصيد النقدي الافتتاحي (الفكة) لتفعيل عمليات البيع وإصدار الفواتير.'
                          : 'Please start a cashier shift and register opening float to enable sales.'}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <button
                          type="button"
                          onClick={() => setIsOpenShiftModalOpen(true)}
                          style={{
                            background: '#e11d48',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Plus size={14} />
                          <span>{isAr ? 'فتح وردية كاشير الآن' : 'Open Shift Now'}</span>
                        </button>
                        {onNavigateToShifts && (
                          <button
                            type="button"
                            onClick={onNavigateToShifts}
                            style={{
                              background: 'var(--card)',
                              color: '#be123c',
                              border: '1px solid #fecdd3',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {isAr ? 'إدارة الورديات' : 'Manage Shifts'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {hasFloorBreach && (
                    <div style={{
                      background: 'var(--destructive-light)',
                      border: '1px solid var(--destructive-border)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginBottom: '10px',
                      color: 'var(--destructive)',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                      <span>{isAr ? 'تجاوزت الحد المسموح به للخصم على هذه المادة! يرجى تصحيح السعر لإتمام البيع.' : 'Discount exceeds floor limit! Please correct price before checkout.'}</span>
                    </div>
                  )}

                  {hasStockDeficit && (
                    <div style={{
                      background: '#fff1f2',
                      border: '1.5px solid #fecdd3',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginBottom: '10px',
                      color: '#be123c',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                      <span>{isAr ? 'تنبيه: الكميات المطلوبة لبعض المواد تتجاوز الرصيد الفعلي للمستودع! يرجى تصحيح الكمية لإتمام البيع.' : 'Warning: Requested quantities exceed warehouse stock!'}</span>
                    </div>
                  )}

                  {/* Fast Payment Buttons with Strict Regional Isolation & Shift Gating */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', 
                    gap: '6px' 
                  }}>
                    <button
                      disabled={!canCheckout}
                      onClick={() => handleCheckout('CASH')}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 'var(--radius)',
                        border: 'none',
                        background: canCheckout ? '#059669' : 'var(--muted)',
                        color: canCheckout ? '#ffffff' : 'var(--muted-foreground)',
                        fontWeight: 700,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        cursor: canCheckout ? 'pointer' : 'not-allowed',
                        opacity: canCheckout ? 1 : 0.6,
                        boxShadow: canCheckout ? '0 2px 6px rgba(5, 150, 105, 0.25)' : 'none'
                      }}
                    >
                      <Banknote size={15} />
                      <span>{isAr ? 'نقدي [F2]' : 'Cash [F2]'}</span>
                    </button>

                    <button
                      disabled={!canCheckout}
                      onClick={() => handleCheckout('CARD')}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 'var(--radius)',
                        border: 'none',
                        background: canCheckout ? 'var(--primary)' : 'var(--muted)',
                        color: canCheckout ? '#ffffff' : 'var(--muted-foreground)',
                        fontWeight: 700,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        cursor: canCheckout ? 'pointer' : 'not-allowed',
                        opacity: canCheckout ? 1 : 0.6,
                        boxShadow: canCheckout ? '0 2px 6px var(--primary-glow)' : 'none'
                      }}
                    >
                      <CreditCard size={15} />
                      <span>{isAr ? 'بطاقة [F3]' : 'Card [F3]'}</span>
                    </button>

                    <button
                      disabled={!canCheckout}
                      onClick={() => {
                        setPosDownPayment(Math.round(grandTotal * 0.2));
                        setIsInstallmentModalOpen(true);
                      }}
                      title={isAr ? 'عقد بيع بالتقسيط مع جدول دفعات' : 'Installment Sale with payment schedule'}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 'var(--radius)',
                        border: 'none',
                        background: canCheckout ? '#2563eb' : 'var(--muted)',
                        color: canCheckout ? '#ffffff' : 'var(--muted-foreground)',
                        fontWeight: 700,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        cursor: canCheckout ? 'pointer' : 'not-allowed',
                        opacity: canCheckout ? 1 : 0.6,
                        boxShadow: canCheckout ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none'
                      }}
                    >
                      <CalendarClock size={15} />
                      <span>{isAr ? 'تقسيط [F5]' : 'Installment [F5]'}</span>
                    </button>

                    {isIraqTenant && (
                      <button
                        disabled={!canCheckout}
                        onClick={() => handleCheckout('ZAIN_CASH')}
                        title={isAr ? 'محفظة زين كاش (توثيق وقبض يدوي)' : 'ZainCash (Manual Tender)'}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 'var(--radius)',
                          border: 'none',
                          background: canCheckout ? '#db2777' : '#e2e8f0',
                          color: canCheckout ? '#ffffff' : '#94a3b8',
                          fontWeight: 700,
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          cursor: canCheckout ? 'pointer' : 'not-allowed',
                          opacity: canCheckout ? 1 : 0.6,
                          boxShadow: canCheckout ? '0 2px 6px rgba(219, 39, 119, 0.25)' : 'none'
                        }}
                      >
                        <Smartphone size={15} />
                        <span>{isAr ? 'زين كاش' : 'ZainCash'}</span>
                      </button>
                    )}

                    {isIraqTenant && (
                      <button
                        disabled={!canCheckout}
                        onClick={() => handleCheckout('QI_CARD')}
                        title={isAr ? 'بطاقة كي كارد (توثيق وقبض يدوي)' : 'Qi Card (Manual Tender)'}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 'var(--radius)',
                          border: 'none',
                          background: canCheckout ? '#d97706' : '#e2e8f0',
                          color: canCheckout ? '#ffffff' : '#94a3b8',
                          fontWeight: 700,
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          cursor: canCheckout ? 'pointer' : 'not-allowed',
                          opacity: canCheckout ? 1 : 0.6,
                          boxShadow: canCheckout ? '0 2px 6px rgba(217, 119, 6, 0.25)' : 'none'
                        }}
                      >
                        <ShieldCheck size={15} />
                        <span>{isAr ? 'كي كارد' : 'Qi Card'}</span>
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Discount Audit Trail Modal */}
      <DiscountAuditTrailModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        logs={auditLogs}
        lang={lang}
      />

      {/* Instant Receipt Modal */}
      {showReceiptModal && lastCompletedOrder && (
        <div className="modal-backdrop fade-in" onClick={() => setShowReceiptModal(false)}>
          <div className="glass-panel" style={{ width: '400px', padding: '24px', borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)', color: 'var(--foreground)' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--border)', paddingBottom: '14px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--foreground)' }}>Bontu Retail Cloud</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted-foreground)' }}>{isAr ? 'إيصال دفع إلكتروني معتمد' : 'Authorized Sales Receipt'}</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '4px', fontSize: '11px', color: 'var(--primary)', fontFamily: 'monospace', fontWeight: 700 }}>
                <span>#{lastCompletedOrder.orderNumber}</span>
                <span>•</span>
                <span>{lastCompletedOrder.cashierName}</span>
                {(lastCompletedOrder.warehouseName || lastCompletedOrder.warehouse?.name) && (
                  <>
                    <span>•</span>
                    <span>{lastCompletedOrder.warehouseName || lastCompletedOrder.warehouse?.name}</span>
                  </>
                )}
              </div>
            </div>

            <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '14px' }}>
              {lastCompletedOrder.items.map((item, idx) => {
                const finalPrice = getEffectiveUnitPrice(item);
                const isModified = item.customPrice !== undefined || (item.discountValue || 0) > 0;
                return (
                  <div key={idx} style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>{item.quantity}x {getProductName(item.product)}</span>
                      <strong style={{ fontFamily: 'monospace' }}>{formatMoney(finalPrice * item.quantity)}</strong>
                    </div>
                    {isModified && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#059669', marginTop: '2px' }}>
                        <span>
                          {isAr ? 'سعر تفاوضي معتمد' : 'Negotiated Price'}
                        </span>
                        <span style={{ textDecoration: 'line-through', color: 'var(--muted-foreground)' }}>
                          {formatMoney(item.product.sellingPrice * item.quantity)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '10px', marginBottom: '16px' }}>
              {lastCompletedOrder.totalDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#ef4444', marginBottom: '4px' }}>
                  <span>{isAr ? 'إجمالي التخفيض المعتمد:' : 'Total Discount:'}</span>
                  <span>-{formatMoney(lastCompletedOrder.totalDiscount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800 }}>
                <span>{isAr ? 'المدفوع النهائي:' : 'Total Paid:'}</span>
                <span style={{ color: '#059669' }}>{formatMoney(lastCompletedOrder.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#d97706', marginTop: '2px', fontWeight: 600 }}>
                <span>{isAr ? 'طريقة الدفع:' : 'Method:'}</span>
                <span>
                  {lastCompletedOrder.paymentMethod === 'ZAIN_CASH' 
                    ? (isAr ? 'محفظة زين كاش (ZainCash)' : 'ZainCash')
                    : lastCompletedOrder.paymentMethod === 'QI_CARD'
                    ? (isAr ? 'بطاقة كي كارد (Qi Card)' : 'Qi Card')
                    : lastCompletedOrder.paymentMethod === 'CARD'
                    ? (isAr ? 'بطاقة إلكترونية (Card)' : 'Card')
                    : lastCompletedOrder.paymentMethod === 'INSTALLMENT'
                    ? (isAr ? 'بيع بالتقسيط (Installment Plan)' : 'Installment Plan')
                    : (isAr ? 'نقداً (Cash)' : 'Cash')}
                </span>
              </div>

              {/* Installment Contract Breakdown on Receipt */}
              {lastCompletedOrder.installmentDetails && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: '#eff6ff',
                  border: '1.5px dashed #3b82f6',
                  fontSize: '11px'
                }}>
                  <div style={{ fontWeight: 800, color: '#1d4ed8', marginBottom: '6px', textAlign: 'center', borderBottom: '1px solid #bfdbfe', paddingBottom: '4px' }}>
                    {isAr ? 'عقد بيع بالتقسيط المعتمد' : 'Installment Contract Schedule'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e40af', marginBottom: '2px' }}>
                    <span>{isAr ? 'الدفعة الأولى (المقدمة):' : 'Down Payment:'}</span>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatMoney(lastCompletedOrder.installmentDetails.downPayment)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e40af', marginBottom: '2px' }}>
                    <span>{isAr ? 'المتبقي المقسط:' : 'Remaining Balance:'}</span>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatMoney(lastCompletedOrder.installmentDetails.remainingAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e40af', marginBottom: '2px' }}>
                    <span>{isAr ? 'مدة التقسيط:' : 'Tenor:'}</span>
                    <span style={{ fontWeight: 700 }}>{lastCompletedOrder.installmentDetails.count} {isAr ? 'أشهر' : 'Months'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e40af', marginBottom: '2px', borderTop: '1px dashed #bfdbfe', paddingTop: '4px' }}>
                    <span style={{ fontWeight: 700 }}>{isAr ? 'القسط الشهري:' : 'Monthly Installment:'}</span>
                    <span style={{ fontWeight: 900, color: '#1d4ed8', fontFamily: 'monospace' }}>{formatMoney(lastCompletedOrder.installmentDetails.monthlyAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginTop: '2px' }}>
                    <span>{isAr ? 'تاريخ أول قسط:' : 'First Due Date:'}</span>
                    <span style={{ fontWeight: 700 }}>{lastCompletedOrder.installmentDetails.firstDueDate}</span>
                  </div>
                  {lastCompletedOrder.installmentDetails.guarantorName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginTop: '2px' }}>
                      <span>{isAr ? 'الكفيل:' : 'Guarantor:'}</span>
                      <span>{lastCompletedOrder.installmentDetails.guarantorName} ({lastCompletedOrder.installmentDetails.guarantorPhone || '—'})</span>
                    </div>
                  )}
                </div>
              )}
              {(lastCompletedOrder.warehouseName || lastCompletedOrder.warehouse?.name) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                  <span>{isAr ? 'المستودع المنصرف منه:' : 'Dispatched Hub:'}</span>
                  <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{lastCompletedOrder.warehouseName || lastCompletedOrder.warehouse?.name}</span>
                </div>
              )}

              {/* Multi-Tier Dispense Receipt Notice & Claim Barcode */}
              {lastCompletedOrder.dispenseMode === 'WAREHOUSE_DISPATCH' ? (
                <div style={{
                  marginTop: '10px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: '#eff6ff',
                  border: '1.5px dashed #3b82f6',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', marginBottom: '4px' }}>
                    {lastCompletedOrder.receiptNotice || (isAr ? 'قيد التجهيز من المخزن - يرجى مراجعة أمين المخزن للاستلام' : 'Pending Dispatch - Please claim at warehouse')}
                  </div>
                  <div style={{ fontSize: '10px', color: '#2563eb', marginBottom: '6px' }}>
                    {isAr ? `مستودع التجهيز: ${lastCompletedOrder.targetWarehouseName || lastCompletedOrder.warehouseName}` : `Hub: ${lastCompletedOrder.targetWarehouseName || lastCompletedOrder.warehouseName}`}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 14px',
                    borderRadius: '4px',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '13px',
                    letterSpacing: '2px',
                    color: 'var(--primary)'
                  }}>
                    *DSP-{lastCompletedOrder.orderNumber.replace(/[^0-9]/g, '')}*
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', marginTop: '3px' }}>
                    {isAr ? 'رمز استلام البضاعة من أمين المخزن' : 'Dispatch Order Claim Barcode'}
                  </div>
                </div>
              ) : (
                <div style={{
                  marginTop: '10px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#059669'
                }}>
                  <CheckCircle2 size={13} />
                  <span>{isAr ? 'مستلمة ومصروفة من المحل' : 'Dispensed and received in-store'}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={async () => {
                  if (lastCompletedOrder && isDesktopApp()) {
                    await printReceiptNative({
                      companyName: (settings as any)?.companyName || 'ZiloX Store',
                      companyPhone: (settings as any)?.phone || '',
                      companyAddress: (settings as any)?.address || '',
                      invoiceNumber: lastCompletedOrder.orderNumber,
                      invoiceDate: lastCompletedOrder.timestamp || new Date().toLocaleString(),
                      cashierName: lastCompletedOrder.cashierName,
                      customerName: (lastCompletedOrder as any).customerName || lastCompletedOrder.installmentDetails?.guarantorName || '',
                      items: (lastCompletedOrder.items || []).map((it: any) => ({
                        name: it.product?.nameAr || it.product?.name || 'صنف',
                        quantity: Number(it.quantity) || 1,
                        unitPrice: Number(it.product?.sellingPrice) || 0,
                        totalPrice: (Number(it.product?.sellingPrice) || 0) * (Number(it.quantity) || 1),
                        unit: it.product?.unit
                      })),
                      subtotal: lastCompletedOrder.subtotal,
                      discount: lastCompletedOrder.totalDiscount || 0,
                      tax: 0,
                      grandTotal: lastCompletedOrder.total,
                      currency: currencySymbol,
                      paymentMethod: lastCompletedOrder.paymentMethod || 'CASH',
                      openDrawer: (lastCompletedOrder.paymentMethod || 'CASH').toUpperCase() === 'CASH',
                      cutPaper: true
                    });
                  } else {
                    window.print();
                  }
                  setShowReceiptModal(false);
                }}
                className="btn-add-primary" 
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Printer size={16} />
                <span>{isAr ? 'طباعة حرارية ESC/POS (صامتة)' : 'Print Receipt (Silent)'}</span>
              </button>

              <button 
                onClick={() => setShowReceiptModal(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#f8fafc', color: 'var(--foreground)', cursor: 'pointer', fontWeight: 600 }}
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Installment Modal Dialog */}
      {isInstallmentModalOpen && (
        <div className="modal-backdrop fade-in" onClick={() => setIsInstallmentModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '520px', width: '92%', borderRadius: '16px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarClock size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
                    {isAr ? 'بيع بالتقسيط (Installment Contract)' : 'POS Installment Contract'}
                  </h3>
                  <small style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}>
                    {isAr ? 'حساب جدول الأقساط الشهرية وتوثيق الضامن' : 'Configure down payment, tenor, and guarantor'}
                  </small>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsInstallmentModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Grand Total Display */}
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--muted)/40', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                  {isAr ? 'إجمالي الفاتورة المطلوب:' : 'Invoice Grand Total:'}
                </span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#2563eb', fontFamily: 'monospace' }}>
                  {formatMoney(grandTotal)}
                </span>
              </div>

              {/* Down Payment & Tenor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>
                    {isAr ? 'الدفعة الأولى (المقدمة):' : 'Down Payment:'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={grandTotal}
                    value={posDownPayment === 0 ? '' : posDownPayment}
                    onChange={(e) => setPosDownPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>
                    {isAr ? 'عدد أشهر التقسيط:' : 'Installment Tenor:'}
                  </label>
                  <select
                    value={posInstallmentCount}
                    onChange={(e) => setPosInstallmentCount(parseInt(e.target.value, 10) || 6)}
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      fontWeight: 600,
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value={3}>{isAr ? '3 أشهر' : '3 Months'}</option>
                    <option value={6}>{isAr ? '6 أشهر' : '6 Months'}</option>
                    <option value={12}>{isAr ? '12 شهراً (سنة)' : '12 Months'}</option>
                    <option value={24}>{isAr ? '24 شهراً (سنتان)' : '24 Months'}</option>
                  </select>
                </div>
              </div>

              {/* Monthly Amount Live Calculation */}
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>
                  {isAr ? 'القسط الشهري المستحق:' : 'Monthly Installment:'}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#1d4ed8', fontFamily: 'monospace' }}>
                  {formatMoney(posInstallmentCount > 0 ? Math.round(Math.max(0, grandTotal - posDownPayment) / posInstallmentCount) : 0)} / {isAr ? 'شهر' : 'mo'}
                </span>
              </div>

              {/* Customer and Guarantor Details */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>
                  {isAr ? 'اسم المشتري / العميل:' : 'Customer Name:'}
                </label>
                <input
                  type="text"
                  value={posCustomerName}
                  onChange={(e) => setPosCustomerName(e.target.value)}
                  placeholder={isAr ? 'اسم العميل (اختياري، افتراضي: عميل كاشير مباشر)...' : 'Customer Name...'}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>
                    {isAr ? 'اسم الكفيل / الضامن:' : 'Guarantor Name:'}
                  </label>
                  <input
                    type="text"
                    value={posGuarantorName}
                    onChange={(e) => setPosGuarantorName(e.target.value)}
                    placeholder={isAr ? 'اسم الكفيل...' : 'Guarantor name...'}
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>
                    {isAr ? 'هاتف الكفيل:' : 'Guarantor Phone:'}
                  </label>
                  <input
                    type="tel"
                    value={posGuarantorPhone}
                    onChange={(e) => setPosGuarantorPhone(e.target.value)}
                    placeholder="07xxxxxxxxx"
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsInstallmentModalOpen(false);
                  handleCheckout('INSTALLMENT', {
                    downPayment: posDownPayment,
                    installmentCount: posInstallmentCount,
                    guarantorName: posGuarantorName,
                    guarantorPhone: posGuarantorPhone,
                    customerName: posCustomerName
                  });
                }}
                className="btn-add-primary"
                style={{ flex: 1, height: '40px', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}
              >
                <CheckCircle2 size={16} />
                <span>{isAr ? 'اعتماد البيع بالتقسيط وإصدار الوصل' : 'Confirm Sale & Issue Voucher'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsInstallmentModalOpen(false)}
                style={{
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--muted)',
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px'
                }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Open Shift Modal via Unified DialogPortal */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        currentUser={currentUser}
        lang={lang}
        onConfirm={({ cashierName, terminalId, openingFloat }) => {
          const newShift: ActiveShift = {
            id: `SH-${Date.now().toString().slice(-4)}`,
            cashierName,
            terminalId,
            startTime: formatMovementDate(new Date()),
            openingFloat,
            cashSales: 0,
            cardSales: 0,
            zainCashSales: 0,
            qiCardSales: 0,
            refunds: 0,
            status: 'ACTIVE'
          };
          saveStoredActiveShift(newShift);
          setActiveShift(newShift);
          setPaymentToast(isAr ? 'تم فتح الوردية وتفعيل نقطة البيع بنجاح' : 'Shift opened successfully');
          setTimeout(() => setPaymentToast(''), 3500);
        }}
      />

      {/* Smart Electronic Scale Modal */}
      {isScaleFeatureActive && (
        <ElectronicScaleModal
          isOpen={isScaleModalOpen}
          onClose={() => {
            setIsScaleModalOpen(false);
            setScaleTargetProduct(null);
          }}
          lang={lang}
          products={products}
          initialProduct={scaleTargetProduct}
          onAddWeightedItem={(product, weightKg) => {
            addToCart(product, weightKg);
            showPaymentToast(
              isAr 
                ? `⚖️ تم إضافة (${getProductName(product)}) بوزن ${weightKg} كغم`
                : `⚖️ Added (${getProductName(product)}) [${weightKg} kg]`
            );
          }}
        />
      )}
    </div>
  );
}
