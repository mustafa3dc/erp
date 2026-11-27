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
  Receipt,
  CalendarClock,
  Scale,
  QrCode,
  Gift
} from 'lucide-react';
import { useSettings, ScaleSettings } from '../../context/settings-context';
import { toLatinDigits, formatLatinNumber, formatLatinDateTime } from '../../lib/formatters';
import { getStoredJwtToken, getTenantAuthHeaders } from '../../lib/api-client';
import { resolveLatinDigitFromKeyboardEvent } from '../../utils/arabicNumeralConverter';
import { usePermissions } from '../../hooks/usePermissions';
import { Product, DiscountAuditLog, Warehouse, SalesInvoice } from '../../types/warehouse';
import DiscountAuditTrailModal from '../modals/DiscountAuditTrailModal';
import OpenShiftModal from '../modals/OpenShiftModal';
import ElectronicScaleModal from '../modals/ElectronicScaleModal';
import DigitalLoyaltyCardModal, { DigitalLoyaltyCustomerInfo } from '../modals/DigitalLoyaltyCardModal';
import RewardHandoverModal from '../modals/RewardHandoverModal';
import ManualVoucherLookupModal from '../modals/ManualVoucherLookupModal';
import QrCodeSvg from '../QrCodeSvg';
import {
  claimPosVoucher,
  fetchPendingPosVouchers,
  lookupCustomerByMemberCode,
  lookupPosVoucher,
  PosVoucherLookupResult,
  syncCustomersToBackend
} from '../../services/loyaltyRewardsService';
import {
  ActiveShift,
  getStoredActiveShift,
  saveStoredActiveShift,
  recordShiftSale,
  executePosSaleTransaction,
  createInstallmentContract,
  getStoredWarehouses,
  getStoredProducts,
  getStoredTransactions,
  getStoredSelectedWarehouseId,
  saveStoredSelectedWarehouseId,
  clearStoredSelectedWarehouseId,
  validateAndResolveActiveWarehouse,
  resolveQuantityUnitPrice,
  getStoredProductBundles,
  getEffectiveProductStock,
  validateCartStockWithBundles,
  getMaxAllowedCartQuantity,
  getStoredCustomers,
  getStoredLoyaltySettings,
  calculateLoyaltyCurrencyEquivalent,
  calculateProfitBasedEarnedPoints,
  resolveProductUnitCost,
  getStoredProductSerials,
  markLocalSerialsAsSold
} from '../../services/storageService';
import LoyaltyCheckoutWidget from '../LoyaltyCheckoutWidget';
import SmartCustomerCombobox from '../SmartCustomerCombobox';
import { getTranslation } from '../../lib/i18n';
import { formatMovementDate, formatShiftDateTime } from '../../utils/dateFormatter';
import PosCategoryFilter from '../PosCategoryFilter';
import { useCategories } from '../../hooks/useCategories';
import { ModalBackdropPortal } from '../ui/dialog';
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

type CartItemPricingSource = 'retail' | 'volume_tier' | 'manual_override';

interface CartItem {
  product: Product;
  quantity: number;
  serialNumbers?: string[];
  customPrice?: number; // Negotiated price directly (سعر تفاوضي)
  discountType?: 'PERCENT' | 'FIXED';
  discountValue?: number;
  pricingSource?: CartItemPricingSource;
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
  const { hasPermission } = usePermissions(currentUser ?? undefined);
  const canOverridePriceFloor = hasPermission('pos.price.override');
  const isIraqTenant = tenantCountryCode === 'IQ' || settings?.tenantCountryCode === 'IQ';

  // Real-time synchronization: sync products & bundles with storage
  const products = useMemo(() => {
    if (propProducts && propProducts.length > 0) return propProducts;
    return getStoredProducts();
  }, [propProducts]);

  const storedBundles = useMemo(() => getStoredProductBundles(), [products]);

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
  const { features } = useTenantFeatures(currentUser);

  // Strict Boolean Check: never default to true
  const isScaleEnabled = Boolean(
    (currentUser?.role === 'PlatformSuperAdmin' || features?.enableBarcodeScales === true) &&
    settings?.scaleSettings?.enabled !== false
  );
  const isSerialModuleEnabled = Boolean(
    currentUser?.role === 'PlatformSuperAdmin' ||
    features?.enableSerialNumbers === true ||
    features?.enableSerialTrackingModule === true
  );
  const [cartSerialInputs, setCartSerialInputs] = useState<Record<string, string>>({});

  // Auto-reset active category filter if scale is disabled while active
  useEffect(() => {
    if (!isScaleEnabled && (selectedCategory === 'scale' || selectedCategory === 'SCALE')) {
      setSelectedCategory('ALL');
    }
  }, [isScaleEnabled, selectedCategory]);

  // Listen for active shift updates across components & tabs
  React.useEffect(() => {
    const handleShiftSync = () => {
      setActiveShift(getStoredActiveShift());
    };
    window.addEventListener('erp_active_shift_updated', handleShiftSync);
    window.addEventListener('storage', handleShiftSync);
    return () => {
      window.removeEventListener('erp_active_shift_updated', handleShiftSync);
      window.removeEventListener('storage', handleShiftSync);
    };
  }, []);

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasShiftPermission) return;
    const now = new Date();
    const newShift: ActiveShift = {
      id: `SH-${Date.now().toString().slice(-4)}`,
      cashierName: effectiveCashierName,
      terminalId: shiftTerminalId.trim() || (isAr ? 'كاشير 1' : 'POS-01'),
      startTime: formatShiftDateTime(now, isAr),
      openedAt: now.toISOString(),
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
    loyaltyPointsEarned?: number;
    loyaltyPointsRedeemed?: number;
    loyaltyDiscountAmount?: number;
    customerInfo?: DigitalLoyaltyCustomerInfo | null;
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
  const [digitalCardCustomer, setDigitalCardCustomer] = useState<DigitalLoyaltyCustomerInfo | null>(null);
  const [handoverVoucher, setHandoverVoucher] = useState<PosVoucherLookupResult | null>(null);
  const [isHandoverSubmitting, setIsHandoverSubmitting] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [pendingCustomerVouchers, setPendingCustomerVouchers] = useState<PosVoucherLookupResult[]>([]);
  const [isManualHandoverModalOpen, setIsManualHandoverModalOpen] = useState(false);
  const [manualInitialVouchers, setManualInitialVouchers] = useState<PosVoucherLookupResult[] | undefined>(undefined);

  // Installment POS Modal States
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [posDownPayment, setPosDownPayment] = useState<number>(0);
  const [posInstallmentCount, setPosInstallmentCount] = useState<number>(6);
  const [posFirstDueDate, setPosFirstDueDate] = useState<string>(() =>
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [posInstallmentError, setPosInstallmentError] = useState<string>('');
  const [posGuarantorName, setPosGuarantorName] = useState<string>('');
  const [posGuarantorPhone, setPosGuarantorPhone] = useState<string>('');
  const [posCustomerName, setPosCustomerName] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [customersList, setCustomersList] = useState<any[]>(() => getStoredCustomers());
  const [customerErrorHighlight, setCustomerErrorHighlight] = useState<boolean>(false);
  const [redeemPoints, setRedeemPoints] = useState<number>(0);

  const loyaltySettings = useMemo(() => settings.loyaltySettings || getStoredLoyaltySettings(), [settings.loyaltySettings]);
  const selectedCustomerObj = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customersList.find(c => c && c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customersList]);
  const isWalkInCustomer = !selectedCustomerObj || Boolean(selectedCustomerObj.isDefaultCashCustomer) || selectedCustomerId === 'CUST-WALKIN';

  useEffect(() => {
    let cancelled = false;
    if (isWalkInCustomer || !selectedCustomerObj?.id) {
      setPendingCustomerVouchers([]);
      return;
    }

    fetchPendingPosVouchers({
      customerId: selectedCustomerObj.id,
      phone: selectedCustomerObj.phone
    })
      .then(vouchers => {
        if (!cancelled) setPendingCustomerVouchers(vouchers);
      })
      .catch(() => {
        if (!cancelled) setPendingCustomerVouchers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isWalkInCustomer, selectedCustomerObj?.id, selectedCustomerObj?.phone]);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useCategories();

  const getProductName = (p: Product) => {
    if (!p) return '';
    return p.nameAr || p.nameEn || '';
  };

  useEffect(() => {
    const handlePaymentShortcut = (e: KeyboardEvent) => {
      if (e.key !== 'F2' && e.key !== 'F3' && e.key !== 'F4' && e.key !== 'F5') return;
      e.preventDefault();
      if (
        cart.length === 0 ||
        grandTotal <= 0 ||
        !activeShift ||
        isInstallmentModalOpen ||
        isOpenShiftModalOpen
      ) {
        return;
      }
      if (e.key === 'F2') {
        handleCheckout('CASH');
      } else if (e.key === 'F3') {
        handleCheckout('CREDIT');
      } else if (e.key === 'F4') {
        setPosInstallmentError('');
        setIsInstallmentModalOpen(true);
      } else if (e.key === 'F5') {
        handleCheckout('CARD');
      }
    };
    window.addEventListener('keydown', handlePaymentShortcut);
    return () => window.removeEventListener('keydown', handlePaymentShortcut);
  });

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

    const isScaleItem = p.unit === 'كغم' || p.unit === 'كجم' || p.unit?.toLowerCase() === 'kg' || p.unit === 'غرام' || p.unit?.toLowerCase() === 'g' || (p.barcode && (p.barcode.startsWith('20') || p.barcode.startsWith('21') || p.barcode.startsWith('22')));

    const matchesCat =
      selectedCategory === 'ALL' ||
      (selectedCategory.toLowerCase() === 'scale' && isScaleItem) ||
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

  const addToCart = (product: Product, quantityToAdd: number = 1, serialToAttach?: string) => {
    const cleanSerial = serialToAttach?.trim();
    if (cleanSerial) {
      const alreadyInCart = cart.some(item =>
        (item.serialNumbers || []).some(sn => sn.toLowerCase() === cleanSerial.toLowerCase())
      );
      if (alreadyInCart) {
        return;
      }
    }

    // 1. Strict Stock Check against current available inventory (dynamic for bundles + shared cart components)
    const { maxQty: maxAllowedForCart, limitingComponentName } = getMaxAllowedCartQuantity(
      product,
      cart,
      products,
      storedBundles,
      selectedWarehouseId
    );
    const totalPhysicalOrBundleStock = getEffectiveProductStock(product, products, storedBundles, selectedWarehouseId);

    if (totalPhysicalOrBundleStock <= 0 || maxAllowedForCart <= 0) {
      const whLabel = isAr ? selectedWarehouse.nameAr : (selectedWarehouse.nameEn || selectedWarehouse.nameAr);
      setStockError(
        product.isBundle
          ? t('posMessages.outOfStockBundle', isAr
            ? `لا يمكن إضافة الحزمة "${getProductName(product)}": رصيد المكونات غير كافٍ في مستودع (${whLabel})!`
            : `Cannot add bundle "${getProductName(product)}": insufficient component stock in (${whLabel})!`)
            .replace('{name}', getProductName(product))
            .replace('{warehouse}', whLabel)
          : (isAr
            ? `لا يمكن إضافة الصنف "${getProductName(product)}": نفد المخزون في مستودع (${selectedWarehouse.nameAr})!`
            : `Cannot add "${getProductName(product)}": Out of stock in (${selectedWarehouse.nameEn || selectedWarehouse.nameAr})!`)
      );
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      const { maxQty: currentMax } = getMaxAllowedCartQuantity(product, prev, products, storedBundles, selectedWarehouseId);
      if (existing) {
        if (cleanSerial && (existing.serialNumbers || []).some(sn => sn.toLowerCase() === cleanSerial.toLowerCase())) {
          return prev;
        }
        const nextQty = Math.round((existing.quantity + quantityToAdd) * 1000) / 1000;
        if (nextQty > currentMax) {
          const itemLabel = limitingComponentName && product.isBundle
            ? `${getProductName(product)} (${limitingComponentName})`
            : getProductName(product);
          setStockError(
            isAr
              ? `الكمية المطلوبة (${nextQty}) تتجاوز الرصيد المتاح (${currentMax}) للصنف "${itemLabel}" في (${selectedWarehouse.nameAr}).`
              : `Requested quantity (${nextQty}) exceeds available stock (${currentMax}) for "${itemLabel}".`
          );
          return prev;
        }
        setStockError(null);
        return prev.map(item => {
          if (item.product.id !== product.id) return item;
          const isManual = item.pricingSource === 'manual_override' || item.customPrice !== undefined || (item.discountValue || 0) > 0;
          const nextTier = !isManual ? resolveQuantityUnitPrice(product, nextQty) : null;
          return {
            ...item,
            quantity: nextQty,
            ...(nextTier ? { pricingSource: (nextTier.isTierApplied ? 'volume_tier' : 'retail') as CartItemPricingSource, priceError: undefined } : {}),
            serialNumbers: cleanSerial
              ? [...(item.serialNumbers || []), cleanSerial]
              : item.serialNumbers
          };
        });
      }
      const initialQty = Math.round(quantityToAdd * 1000) / 1000;
      if (initialQty > currentMax) {
        setStockError(
          isAr
            ? `الكمية المطلوبة (${initialQty}) تتجاوز الرصيد المتاح (${currentMax}) للصنف "${getProductName(product)}".`
            : `Requested quantity (${initialQty}) exceeds available stock (${currentMax}) for "${getProductName(product)}".`
        );
        return prev;
      }
      setStockError(null);
      const initialTierRes = resolveQuantityUnitPrice(product, initialQty);
      return [
        ...prev,
        {
          product,
          quantity: initialQty,
          serialNumbers: cleanSerial ? [cleanSerial] : undefined,
          discountType: 'PERCENT',
          discountValue: 0,
          pricingSource: initialTierRes.isTierApplied ? 'volume_tier' : 'retail'
        }
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const freshProd = products.find(p => p.id === productId) || item.product;
        const { maxQty: currentAvailable, limitingComponentName } = getMaxAllowedCartQuantity(
          freshProd,
          prev,
          products,
          storedBundles,
          selectedWarehouseId
        );
        const newQty = item.quantity + delta;

        if (delta > 0 && newQty > currentAvailable) {
          const itemLabel = limitingComponentName && freshProd.isBundle
            ? `${getProductName(freshProd)} (${limitingComponentName})`
            : getProductName(freshProd);
          setStockError(
            isAr
              ? `الكمية المطلوبة (${newQty}) تتجاوز الرصيد المتاح (${currentAvailable}) للصنف "${itemLabel}".`
              : `Requested quantity (${newQty}) exceeds available stock (${currentAvailable}) for "${itemLabel}".`
          );
          return item;
        }
        setStockError(null);
        if (newQty <= 0) return null;
        const isManual = item.pricingSource === 'manual_override' || item.customPrice !== undefined || (item.discountValue || 0) > 0;
        const nextTier = !isManual ? resolveQuantityUnitPrice(freshProd, newQty) : null;
        return {
          ...item,
          quantity: newQty,
          ...(nextTier ? { pricingSource: (nextTier.isTierApplied ? 'volume_tier' : 'retail') as CartItemPricingSource, priceError: undefined } : {})
        };
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



  // Floor Price & Quantity Tier Engine: Resolve pricingSource ('retail' | 'volume_tier' | 'manual_override') and unitPrice
  const resolveCartItemPricing = (item: CartItem): {
    pricingSource: CartItemPricingSource;
    unitPrice: number;
    tierRes: ReturnType<typeof resolveQuantityUnitPrice>;
  } => {
    const tierRes = resolveQuantityUnitPrice(item.product, item.quantity);
    const hasManualPrice = item.customPrice !== undefined;
    const hasManualDiscount = (item.discountValue || 0) > 0;

    if (
      item.pricingSource === 'manual_override' ||
      (hasManualPrice && item.pricingSource !== 'volume_tier') ||
      hasManualDiscount
    ) {
      let unitPrice = item.customPrice !== undefined ? item.customPrice : tierRes.unitPrice;
      if (item.customPrice === undefined) {
        if (item.discountType === 'PERCENT' && item.discountValue) {
          unitPrice = Math.max(0, Math.round((tierRes.unitPrice * (1 - item.discountValue / 100)) * 100) / 100);
        } else if (item.discountType === 'FIXED' && item.discountValue) {
          unitPrice = Math.max(0, tierRes.unitPrice - item.discountValue);
        }
      }
      return { pricingSource: 'manual_override', unitPrice, tierRes };
    }

    if (tierRes.isTierApplied) {
      return { pricingSource: 'volume_tier', unitPrice: tierRes.unitPrice, tierRes };
    }

    return { pricingSource: 'retail', unitPrice: tierRes.basePrice, tierRes };
  };

  const getEffectiveUnitPrice = (item: CartItem): number => {
    return resolveCartItemPricing(item).unitPrice;
  };

  const getDiscountAmountPerUnit = (item: CartItem): number => {
    const resolved = resolveCartItemPricing(item);
    if (resolved.pricingSource !== 'manual_override') return 0;
    return Math.max(0, resolved.tierRes.unitPrice - resolved.unitPrice);
  };

  // Floor Price Engine (نظام الحد الأدنى للبيع):
  // Applies ONLY when the cashier enters a manual override/discount below MinSalePrice
  // (official volume pricing tiers & users with pos.price.override are exempt).
  const handleSetItemPrice = (item: CartItem, proposedPrice: number) => {
    const tierRes = resolveQuantityUnitPrice(item.product, item.quantity);
    const retail = item.product.sellingPrice;
    const floorPrice = item.product.minSellingPrice !== undefined
      ? item.product.minSellingPrice
      : (item.product.isBundle ? 0 : Math.round(retail * 0.88));

    // Resetting back to automatic volume tier or retail price
    const automaticTarget = tierRes.isTierApplied ? tierRes.unitPrice : retail;
    if (proposedPrice === automaticTarget) {
      handleResetItemPrice(item);
      return;
    }

    if (proposedPrice >= 0 && (canOverridePriceFloor || proposedPrice >= floorPrice)) {
      // Accepted manual override within floor (or authorized override permission)
      setCart(prev => prev.map(ci =>
        ci.product.id === item.product.id
          ? {
            ...ci,
            customPrice: proposedPrice,
            discountType: undefined,
            discountValue: undefined,
            pricingSource: 'manual_override',
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
      // Breached safety floor on manual override! Lock, reject, and show exact message.
      const errorMsg = isAr
        ? 'تجاوزت الحد المسموح به للخصم على هذه المادة'
        : 'Discount exceeds allowed floor limit for this item';

      setCart(prev => prev.map(ci =>
        ci.product.id === item.product.id
          ? {
            ...ci,
            customPrice: proposedPrice,
            pricingSource: 'manual_override',
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
    const tierRes = resolveQuantityUnitPrice(item.product, item.quantity);
    setCart(prev => prev.map(ci =>
      ci.product.id === item.product.id
        ? {
          ...ci,
          customPrice: undefined,
          discountType: undefined,
          discountValue: undefined,
          pricingSource: tierRes.isTierApplied ? 'volume_tier' : 'retail',
          priceError: undefined
        }
        : ci
    ));
    setEditingDiscountItemId(null);
    setBargainInputPrice('');
  };

  // Totals Calculations Memoized (Isolated from searchQuery and park actions)
  const {
    subtotal,
    totalDiscount,
    loyaltyDiscountAmount,
    estimatedEarnedPoints,
    subtotalAfterDiscount,
    taxRatePercent,
    tax,
    grandTotal,
    currentExchangeRate,
    isIqdBase,
    totalIqd
  } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + (resolveQuantityUnitPrice(item.product, item.quantity).unitPrice * item.quantity), 0);
    const disc = cart.reduce((sum, item) => sum + (getDiscountAmountPerUnit(item) * item.quantity), 0);
    const subAfterItemDiscounts = Math.max(0, sub - disc);

    let appliedLoyaltyDiscount = 0;
    if (redeemPoints > 0 && loyaltySettings.isLoyaltyEnabled && !isWalkInCustomer) {
      const rawDiscount = calculateLoyaltyCurrencyEquivalent(redeemPoints, loyaltySettings);
      appliedLoyaltyDiscount = Math.min(rawDiscount, subAfterItemDiscounts);
    }

    const subAfter = Math.max(0, subAfterItemDiscounts - appliedLoyaltyDiscount);

    // Profit-Based Loyalty Points Preview (registered customers only)
    let estEarned = 0;
    if (loyaltySettings.isLoyaltyEnabled && !isWalkInCustomer && cart.length > 0) {
      const lineProfits = cart.reduce((sum, item) => {
        const effSell = getEffectiveUnitPrice(item);
        const unitCost = resolveProductUnitCost(item.product, products, storedBundles);
        return sum + (effSell - unitCost) * item.quantity;
      }, 0);
      const realizedProfit = Math.max(0, lineProfits - appliedLoyaltyDiscount);
      estEarned = calculateProfitBasedEarnedPoints(realizedProfit, loyaltySettings);
    }

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
      loyaltyDiscountAmount: appliedLoyaltyDiscount,
      estimatedEarnedPoints: estEarned,
      subtotalAfterDiscount: subAfter,
      taxRatePercent: ratePct,
      tax: taxAmt,
      grandTotal: gTotal,
      currentExchangeRate: rate,
      isIqdBase: iqdBase,
      totalIqd: totIqd
    };
  }, [cart, exchangeRate, settings, isIraqTenant, currencySymbol, redeemPoints, loyaltySettings, isWalkInCustomer, products, storedBundles]);

  const handleCheckout = (
    method: 'CASH' | 'CREDIT' | 'CARD' | 'INSTALLMENT' | string,
    installmentData?: {
      downPayment: number;
      installmentCount: number;
      firstDueDate?: string;
      guarantorName: string;
      guarantorPhone: string;
      customerName?: string;
    }
  ) => {
    if (cart.length === 0 || grandTotal <= 0) return;

    if (!activeShift) {
      showPaymentToast(
        getTranslation(lang, 'ui.invoiceTreasury.errNoActiveShift')
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

    // 1. Strict Aggregated Stock Availability Check across ALL cart items (bundles + standalone items combined)
    const cartValidation = validateCartStockWithBundles(cart, products, storedBundles, targetWh.id);
    if (!cartValidation.isValid) {
      const stockShortages = cartValidation.shortages.map(s =>
        isAr
          ? `• الصنف "${s.name}"${s.sku ? ` [كود: ${s.sku}]` : ''} — إجمالي المطلوب: ${s.required} | المتبقي فعلياً في ${targetWhLabel}: ${s.available} قطعة`
          : `• "${s.name}"${s.sku ? ` [${s.sku}]` : ''} — Total Requested: ${s.required} | Remaining in ${targetWhLabel}: ${s.available}`
      );
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
    const resolvedInputCustomerName = (installmentData?.customerName ?? posCustomerName).trim();
    const isCreditOrInstallmentMethod = method === 'CREDIT' || method === 'INSTALLMENT';

    if (isCreditOrInstallmentMethod && (isWalkInCustomer || !selectedCustomerId) && !resolvedInputCustomerName) {
      setCustomerErrorHighlight(true);
      showPaymentToast(
        getTranslation(
          lang,
          method === 'INSTALLMENT'
            ? 'errors.ERR.POS.ERR_CUSTOMER_REQUIRED_FOR_INSTALLMENT'
            : 'errors.ERR.POS.ERR_CUSTOMER_REQUIRED_FOR_CREDIT'
        ),
        4000
      );
      return;
    }

    try {
      // 2. Execute Atomic POS Sale Transaction (Deduction or Staged Dispatch + Movement + Sales Invoice + Shift Sales + 3-Way Customer Resolution)
      const result = executePosSaleTransaction({
        invoiceNumber,
        warehouseId: selectedWarehouse.id,
        warehouseName: selectedWarehouse.nameAr,
        dispenseMode,
        targetWarehouseId: targetWh.id,
        targetWarehouseName: targetWh.nameAr,
        shiftId: activeShift.id,
        cashierId: activeShift.terminalId,
        cashierName: effectiveCashierName,
        paymentMethod: method,
        customerId: selectedCustomerId,
        customerName: resolvedInputCustomerName || undefined,
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
        grandTotal: grandTotal + loyaltyDiscountAmount,
        redeemPoints
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

      // Atomically mark scanned Serials / IMEIs as Sold locally & compute warranty countdown
      const checkoutCustomerLabel = resolvedInputCustomerName || selectedCustomerObj?.nameAr || t('posMessages.defaultCustomer', isAr ? 'عميل نقدي (POS)' : 'Walk-in Customer');
      cart.forEach(it => {
        if (it.serialNumbers && it.serialNumbers.length > 0) {
          markLocalSerialsAsSold({
            serialNumbers: it.serialNumbers,
            invoiceId: result.invoice.id,
            invoiceNumber: result.invoice.invoiceNo,
            customerId: selectedCustomerId,
            customerName: checkoutCustomerLabel,
            warrantyMonthsOverride: it.product.warrantyMonths,
          });
        }
      });

      let createdInstallmentDetails: CompletedOrderReceipt['installmentDetails'] = undefined;
      if (method === 'INSTALLMENT' && installmentData) {
        const rem = Math.max(0, grandTotal - installmentData.downPayment);
        const monthly = installmentData.installmentCount > 0 ? Math.round(rem / installmentData.installmentCount) : 0;
        const firstDueDate =
          installmentData.firstDueDate ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        createInstallmentContract({
          invoiceId: result.invoice.id,
          customerName:
            selectedCustomerObj?.name ||
            installmentData.customerName ||
            t('posMessages.defaultCustomer', isAr ? 'عميل كاشير مباشر (POS Retail)' : 'Retail Walk-in Customer'),
          guarantorName: installmentData.guarantorName.trim(),
          guarantorPhone: installmentData.guarantorPhone.trim(),
          totalCashPrice: subtotal,
          totalInstallmentPrice: grandTotal,
          downPayment: installmentData.downPayment,
          remainingAmount: rem,
          installmentCount: installmentData.installmentCount,
          monthlyAmount: monthly,
          startDate: new Date(firstDueDate).toISOString(),
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

      const latestCustomers = getStoredCustomers();
      const matchedCustomer = latestCustomers.find(
        c =>
          c &&
          !c.isDefaultCashCustomer &&
          (c.id === result.invoice.customerId || c.id === selectedCustomerId)
      );

      const orderData: CompletedOrderReceipt = {
        orderNumber: invoiceNumber,
        items: [...cart],
        subtotal,
        totalDiscount,
        total: grandTotal,
        paymentMethod: method,
        timestamp: formatLatinDateTime(new Date(), isAr ? 'ar' : 'en'),
        cashierName: effectiveCashierName,
        warehouseName: selectedWarehouse?.nameAr || selectedWarehouse?.nameEn || selectedWarehouse?.code || 'WH-01',
        dispenseMode,
        targetWarehouseName: targetWhLabel,
        receiptNotice: isWarehouseDispatch
          ? (isAr ? 'قيد التجهيز من المخزن - يرجى مراجعة أمين المخزن للاستلام' : 'Pending Warehouse Dispatch - Please claim at warehouse')
          : (isAr ? 'مستلمة ومصروفة من المحل' : 'Dispensed and received in-store'),
        loyaltyPointsEarned: result.loyaltyPointsEarned,
        loyaltyPointsRedeemed: result.loyaltyPointsRedeemed,
        loyaltyDiscountAmount: result.loyaltyDiscountAmount,
        customerInfo: matchedCustomer && matchedCustomer.loyaltyCardToken
          ? {
            id: matchedCustomer.id,
            name: matchedCustomer.name,
            phone: matchedCustomer.phone,
            loyaltyMemberCode: matchedCustomer.loyaltyMemberCode,
            loyaltyCardToken: matchedCustomer.loyaltyCardToken,
            loyaltyPointsBalance: matchedCustomer.loyaltyPointsBalance ?? matchedCustomer.loyaltyPoints ?? 0
          }
          : null,
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
      setCustomersList(latestCustomers);
      const checkoutCustomerId = selectedCustomerId;
      const checkoutCustomerName = resolvedInputCustomerName;
      setSelectedCustomerId(undefined);
      setPosCustomerName('');
      setRedeemPoints(0);
      setCustomerErrorHighlight(false);
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
        const headers = getTenantAuthHeaders();
        if (tenantCountryCode) headers['X-Tenant-Country'] = tenantCountryCode;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (matchedCustomer && matchedCustomer.loyaltyCardToken) {
          syncCustomersToBackend([matchedCustomer]).catch(() => { });
        }

        fetch('/api/pos/invoices', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            warehouseId: selectedWarehouse.id,
            dispenseMode,
            targetWarehouseId: targetWh.id,
            customerId: uuidRegex.test(checkoutCustomerId || '') ? checkoutCustomerId : null,
            customerName: checkoutCustomerName || null,
            shiftId: activeShift.id,
            cashierId: activeShift.terminalId,
            cashierName: effectiveCashierName,
            paymentMethod: method,
            redeemPoints,
            items: cart.map(it => {
              const resolved = resolveCartItemPricing(it);
              const manualDiff = resolved.pricingSource === 'manual_override' && it.customPrice !== undefined
                ? Math.max(0, resolved.tierRes.unitPrice - resolved.unitPrice)
                : 0;
              return {
                productId: it.product.id,
                quantity: it.quantity,
                discountType: resolved.pricingSource === 'volume_tier'
                  ? 'NONE'
                  : (it.customPrice !== undefined && manualDiff > 0 ? 'FIXED' : (it.discountType || 'NONE')),
                discountValue: resolved.pricingSource === 'volume_tier'
                  ? 0
                  : (it.customPrice !== undefined && manualDiff > 0 ? manualDiff : (it.discountValue || 0)),
                unitPrice: resolved.unitPrice,
                pricingSource: resolved.pricingSource,
                serialNumbers: it.serialNumbers || []
              };
            })
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
      } catch { }

    } catch (err: any) {
      if (err.message?.includes('ERR_NO_ACTIVE_SHIFT')) {
        const msg = getTranslation(lang, 'ui.invoiceTreasury.errNoActiveShift');
        setStockError(msg);
        showPaymentToast(msg, 4000);
        setIsOpenShiftModalOpen(true);
      } else if (err.message?.includes('ERR_CREDIT_SALE_REQUIRES_CUSTOMER')) {
        setCustomerErrorHighlight(true);
        const msg = getTranslation(lang, 'ui.customerPicker.creditRequiresCustomer');
        setStockError(msg);
        showPaymentToast(msg, 4000);
      } else if (err.message?.includes('ERR_CREDIT_LIMIT_EXCEEDED')) {
        setCustomerErrorHighlight(true);
        const msg = getTranslation(lang, 'ui.customerPicker.creditLimitExceeded').replace('{limit}', '');
        setStockError(msg);
        showPaymentToast(msg, 4000);
      } else if (err.message?.includes('ERR_BELOW_MIN_REDEEM_POINTS')) {
        const msg = getTranslation(lang, 'ui.loyalty.belowMinThresholdError').replace('{min}', String(loyaltySettings.minRedeemablePoints));
        setStockError(msg);
        showPaymentToast(msg, 4000);
      } else if (err.message?.includes('ERR_INSUFFICIENT_LOYALTY_POINTS')) {
        const msg = getTranslation(lang, 'ui.loyalty.insufficientPointsError');
        setStockError(msg);
        showPaymentToast(msg, 4000);
      } else if (err.message?.includes('ERR_LOYALTY_DISABLED')) {
        const msg = getTranslation(lang, 'ui.loyalty.loyaltyDisabledError');
        setStockError(msg);
        showPaymentToast(msg, 4000);
      } else if (err.message?.includes('ERR_LOYALTY_WALKIN_NOT_ALLOWED')) {
        const msg = getTranslation(lang, 'ui.loyalty.walkInNotAllowedError');
        setStockError(msg);
        showPaymentToast(msg, 4000);
      } else if (err.message?.includes('INVALID_WAREHOUSE') || err.message?.includes('المستودع المحدد غير موجود أو تم تعطيله')) {
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
            background: 'var(--card)',
            border: '1px solid var(--border)',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--foreground)'
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
                <option value="ALL">{isAr ? 'جميع المستودعات والفروع (الكل)' : 'All Warehouses & Hubs'}</option>
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
              background: 'var(--badge-emerald-bg)',
              border: '1px solid var(--badge-emerald-border)',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              color: 'var(--badge-emerald-fg)',
              fontWeight: 700
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span>{isAr ? `وردية: ${activeShift.cashierName}` : `Shift: ${activeShift.cashierName}`}</span>
              <span style={{ opacity: 0.85, fontSize: '10px' }}>({activeShift.terminalId})</span>
              <span style={{ opacity: 0.85, fontSize: '10px', fontFamily: 'monospace' }}>• {activeShift.startTime}</span>
              {onNavigateToShifts && (
                <button
                  type="button"
                  onClick={onNavigateToShifts}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--badge-emerald-fg)',
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
              background: 'var(--badge-red-bg)',
              border: '1px solid var(--badge-red-border)',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              color: 'var(--badge-red-fg)',
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

          {/* Manual Reward Handover Quick Button */}
          <button
            type="button"
            onClick={() => {
              setManualInitialVouchers(undefined);
              setIsManualHandoverModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
          >
            <Gift size={14} className="text-amber-500 shrink-0" />
            <span>{getTranslation(lang, 'ui.posLoyaltyScan.handoverToolbarBtn')}</span>
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
          background: 'var(--badge-red-bg)',
          border: '1px solid var(--badge-red-border)',
          borderRadius: 'var(--radius)',
          color: 'var(--badge-red-fg)',
          fontSize: '12px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--badge-red-fg)' }} />
            <div style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}>{stockError}</div>
          </div>
          <button
            type="button"
            onClick={() => setStockError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--badge-red-fg)', padding: '4px' }}
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
                inputMode="text"
                className="tabular-nums"
                placeholder={isAr ? 'امسح الباركود بقارئ الليزر أو ابحث... [F1]' : 'Scan barcode or search... [F1]'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(toLatinDigits(e.target.value))}
                onKeyDown={async (e) => {
                  const asciiDigit = resolveLatinDigitFromKeyboardEvent(e.nativeEvent, e.currentTarget);
                  if (asciiDigit !== null) {
                    e.preventDefault();
                    const start = e.currentTarget.selectionStart ?? searchQuery.length;
                    const end = e.currentTarget.selectionEnd ?? searchQuery.length;
                    const nextVal = toLatinDigits(searchQuery.slice(0, start) + asciiDigit + searchQuery.slice(end));
                    setSearchQuery(nextVal);
                    return;
                  }
                  if (e.key === 'Enter') {
                    const raw = toLatinDigits(searchQuery).trim();
                    if (!raw) return;

                    // 0A. Auto-detect LOY- Loyalty Member Card Barcode
                    if (/^LOY-/i.test(raw)) {
                      setSearchQuery('');
                      try {
                        const found = await lookupCustomerByMemberCode(raw);
                        setCustomersList(prev => {
                          const exists = prev.some(c => c.id === found.id);
                          return exists
                            ? prev
                            : [
                              {
                                id: found.id,
                                code: found.code,
                                name: found.name,
                                phone: found.phone || '—',
                                loyaltyMemberCode: found.loyaltyMemberCode,
                                loyaltyCardToken: found.loyaltyCardToken,
                                loyaltyPoints: found.loyaltyPointsBalance,
                                loyaltyPointsBalance: found.loyaltyPointsBalance,
                                creditLimit: found.creditLimit,
                                currentBalance: found.currentBalance,
                                isDefaultCashCustomer: found.isDefaultCashCustomer
                              },
                              ...prev
                            ];
                        });
                        setSelectedCustomerId(found.id);
                        setPosCustomerName(found.name);
                        setRedeemPoints(0);
                        setCustomerErrorHighlight(false);
                        showPaymentToast(
                          getTranslation(lang, 'ui.posLoyaltyScan.memberAttachedToast')
                            .replace('{name}', found.name)
                            .replace('{points}', Number(found.loyaltyPointsBalance || 0).toLocaleString('en-US'))
                        );
                      } catch {
                        showPaymentToast(
                          getTranslation(lang, 'ui.posLoyaltyScan.memberNotFoundToast').replace('{code}', raw.toUpperCase())
                        );
                      }
                      return;
                    }

                    // 0B. Auto-detect RDM- Loyalty Reward Redemption Voucher Barcode
                    if (/^RDM-/i.test(raw)) {
                      setSearchQuery('');
                      try {
                        const voucher = await lookupPosVoucher(raw);
                        setHandoverError(null);
                        setHandoverVoucher(voucher);
                      } catch (err: any) {
                        const code = err?.message || 'ERR_VOUCHER_NOT_FOUND';
                        showPaymentToast(
                          getTranslation(lang, `errors.ERR.LOYALTY.${code}`, raw.toUpperCase())
                        );
                      }
                      return;
                    }

                    // 0C. Serial / IMEI Barcode Scan Resolution (When Serial Module is active)
                    if (isSerialModuleEnabled) {
                      const localSerials = getStoredProductSerials();
                      const localMatch = localSerials.find(s => s.serialNumber.trim().toLowerCase() === raw.toLowerCase());
                      if (localMatch) {
                        if (localMatch.status === 'Sold') {
                          const msg = getTranslation(lang, 'errors.ERR_SERIAL_ALREADY_SOLD');
                          setStockError(msg);
                          showPaymentToast(msg, 4000);
                          setSearchQuery('');
                          return;
                        }
                        if (localMatch.status !== 'InStock') {
                          const msg = getTranslation(lang, 'errors.ERR_SERIAL_NOT_AVAILABLE_FOR_SALE');
                          setStockError(msg);
                          showPaymentToast(msg, 4000);
                          setSearchQuery('');
                          return;
                        }
                        const linkedProd = products.find(p => p.id === localMatch.productId || p.sku === localMatch.productSku);
                        if (linkedProd) {
                          addToCart(linkedProd, 1, localMatch.serialNumber);
                          setSearchQuery('');
                          showPaymentToast(
                            getTranslation(lang, 'serialTracking.posSerialAddedToast')
                              .replace('{sn}', localMatch.serialNumber)
                              .replace('{product}', getProductName(linkedProd))
                          );
                          return;
                        }
                      }

                      // Check Backend POS Serial Lookup if token is active
                      try {
                        const token = getStoredJwtToken();
                        if (token) {
                          const serialRes = await fetch(`/api/pos/serials/lookup?code=${encodeURIComponent(raw)}`, {
                            headers: getTenantAuthHeaders()
                          });
                          if (serialRes.ok) {
                            const scanData = await serialRes.json();
                            if (scanData?.found) {
                              if (!scanData.available) {
                                const errKey = scanData.errorCode === 'ERR_SERIAL_ALREADY_SOLD'
                                  ? 'errors.ERR_SERIAL_ALREADY_SOLD'
                                  : 'errors.ERR_SERIAL_NOT_AVAILABLE_FOR_SALE';
                                const msg = getTranslation(lang, errKey);
                                setStockError(msg);
                                showPaymentToast(msg, 4000);
                                setSearchQuery('');
                                return;
                              }
                              const backendProd = scanData.product;
                              const linkedProd = products.find(p => p.id === backendProd?.id || p.sku === backendProd?.sku) || (backendProd ? {
                                id: backendProd.id,
                                sku: backendProd.sku,
                                barcode: backendProd.barcode || '',
                                nameAr: backendProd.name,
                                nameEn: backendProd.name,
                                category: backendProd.categoryName || '',
                                costPrice: 0,
                                sellingPrice: Number(backendProd.retailPrice) || 0,
                                unit: backendProd.unitOfMeasure || 'قطعة',
                                currentStock: Number(backendProd.availableStock) || 1,
                                minStockAlert: 1,
                                warehouseId: selectedWarehouseId,
                                warehouseName: selectedWarehouse?.nameAr || '',
                                requiresSerialNumber: true,
                                warrantyMonths: Number(backendProd.warrantyMonths) || 0,
                                status: 'available' as const,
                                shelf: 'A-01',
                                updatedAt: new Date().toISOString().slice(0, 10)
                              } : undefined);
                              if (linkedProd) {
                                addToCart(linkedProd, 1, scanData.serialNumber || raw);
                                setSearchQuery('');
                                showPaymentToast(
                                  getTranslation(lang, 'serialTracking.posSerialAddedToast')
                                    .replace('{sn}', scanData.serialNumber || raw)
                                    .replace('{product}', getProductName(linkedProd))
                                );
                                return;
                              }
                            }
                          }
                        }
                      } catch {
                        // continue cleanly to barcode/SKU lookup
                      }
                    }

                    // 1. Check if input matches an Electronic Scale Barcode (only if scale feature is active)
                    if (isScaleEnabled) {
                      const scaleMatch = parseScaleBarcode(raw, products, settings?.scaleSettings);
                      if (scaleMatch) {
                        addToCart(scaleMatch.product, scaleMatch.quantity);
                        setSearchQuery('');
                        const unitStr = isAr ? 'كغم' : 'kg';
                        showPaymentToast(
                          isAr
                            ? `ميزان باركود: تم إضافة (${scaleMatch.product.nameAr}) بوزن ${scaleMatch.quantity} ${unitStr}`
                            : `Scale Item: Added (${scaleMatch.product.nameAr}) [${scaleMatch.quantity} ${unitStr}]`
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

            {/* Quick Smart Scale Filter & Launcher Button */}
            {isScaleEnabled && (
              <button
                type="button"
                onClick={() => {
                  if (selectedCategory === 'scale') {
                    setSelectedCategory('ALL');
                  } else {
                    setSelectedCategory('scale');
                    setScaleTargetProduct(null);
                    setIsScaleModalOpen(true);
                  }
                }}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 ${selectedCategory === 'scale'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                  }`}
                title={isAr ? 'أصناف الميزان والميزان الذكي' : 'Scale Items & Smart Scale'}
              >
                <Scale className="w-4 h-4" />
                <span>{t('pos.filters.scale', isAr ? 'الميزان' : 'Scale')}</span>
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
                const currentAvailable = getEffectiveProductStock(p, products, storedBundles, selectedWarehouseId);
                const isOutOfStock = currentAvailable <= 0;

                return (
                  <div
                    key={p.id}
                    className="pos-product-card glass-panel clickable"
                    onClick={() => addToCart(p)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isOutOfStock ? '1px dashed rgba(239, 68, 68, 0.4)' : (p.isBundle ? '1px solid rgba(139, 92, 246, 0.35)' : '1px solid var(--border)'),
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>{p.sku}</span>
                        {p.isBundle ? (
                          <span style={{ fontSize: '10px', color: '#7c3aed', background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.25)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            {getTranslation(lang, 'bundles.bundleBadge')}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--primary)', background: 'var(--primary-light)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {isAr ? 'سقف: 5%' : 'Max: 5%'}
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '13px', margin: '6px 0 4px 0', fontWeight: 700, color: 'var(--foreground)', lineHeight: '1.4' }}>{getProductName(p)}</h4>

                      {/* Live Stock Badge */}
                      <div style={{ marginTop: '4px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: currentAvailable > 5 ? 'var(--badge-emerald-fg)' : currentAvailable > 0 ? 'var(--badge-amber-fg)' : 'var(--badge-red-fg)',
                          background: currentAvailable > 5 ? 'var(--badge-emerald-bg)' : currentAvailable > 0 ? 'var(--badge-amber-bg)' : 'var(--badge-red-bg)',
                          border: `1px solid ${currentAvailable > 5 ? 'var(--badge-emerald-border)' : currentAvailable > 0 ? 'var(--badge-amber-border)' : 'var(--badge-red-border)'}`,
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
                        <span style={{ fontSize: '15px', fontWeight: 800, color: isOutOfStock ? 'var(--muted-foreground)' : 'var(--badge-emerald-fg)' }}>
                          {formatMoney(p.sellingPrice)}
                        </span>
                      </div>
                      <button
                        disabled={isOutOfStock}
                        style={{
                          background: isOutOfStock ? 'var(--muted)' : 'var(--primary)',
                          border: 'none',
                          color: isOutOfStock ? 'var(--muted-foreground)' : '#fff',
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

          {/* Smart Creatable Customer Selector (Default Walk-In / Search / Auto-Create New) */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--muted)/20' }}>
            <SmartCustomerCombobox
              lang={lang}
              customers={customersList}
              selectedCustomerId={selectedCustomerId}
              customerName={posCustomerName}
              onChange={({ customerId, customerName }) => {
                setSelectedCustomerId(customerId);
                setPosCustomerName(customerName);
                setRedeemPoints(0);
                setCustomerErrorHighlight(false);
              }}
              isCreditMode={isInstallmentModalOpen}
              highlightError={customerErrorHighlight}
              compact
              inputId="pos-customer-combobox"
            />
            <LoyaltyCheckoutWidget
              lang={lang}
              customer={selectedCustomerObj}
              isWalkIn={isWalkInCustomer}
              loyaltySettings={loyaltySettings}
              maxDiscountCap={Math.max(0, subtotal - totalDiscount)}
              appliedRedeemPoints={redeemPoints}
              appliedDiscountAmount={loyaltyDiscountAmount}
              onApplyRedeemPoints={setRedeemPoints}
              estimatedEarnedPoints={estimatedEarnedPoints}
              formatMoney={formatMoney}
              compact
            />
            {!isWalkInCustomer && pendingCustomerVouchers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (pendingCustomerVouchers.length === 1) {
                    setHandoverError(null);
                    setHandoverVoucher(pendingCustomerVouchers[0]);
                  } else {
                    setManualInitialVouchers(pendingCustomerVouchers);
                    setIsManualHandoverModalOpen(true);
                  }
                }}
                className="mt-2 w-full px-3 py-2 rounded-xl border border-amber-500/35 bg-amber-500/12 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors"
              >
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Gift size={14} className="shrink-0" />
                  <span className="truncate tabular-nums">
                    {getTranslation(lang, 'ui.posLoyaltyScan.pendingRewardAlert').replace(
                      '{count}',
                      String(pendingCustomerVouchers.length)
                    )}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-card border border-border text-[10px] font-bold text-foreground shrink-0">
                  {getTranslation(lang, 'ui.posLoyaltyScan.pendingRewardAlertCta')}
                </span>
              </button>
            )}
            {!isWalkInCustomer && selectedCustomerObj?.loyaltyCardToken && (
              <button
                type="button"
                onClick={() => setDigitalCardCustomer(selectedCustomerObj)}
                className="mt-2 w-full px-2.5 py-1.5 rounded-lg border border-primary/25 bg-primary/8 hover:bg-primary/15 text-primary text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <QrCode size={13} />
                <span>{getTranslation(lang, 'ui.digitalWallet.cardModalBtn')}</span>
              </button>
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
              (() => {
                const targetCheckWhId = dispenseMode === 'WAREHOUSE_DISPATCH' ? targetDispatchWarehouseId : selectedWarehouseId;
                const cartStockCheck = validateCartStockWithBundles(cart, products, storedBundles, targetCheckWhId);
                return cart.map(item => {
                  const { pricingSource, unitPrice: finalUnitPrice, tierRes: tierResolution } = resolveCartItemPricing(item);
                  const isManualBargain = pricingSource === 'manual_override';
                  const isTierActive = pricingSource === 'volume_tier';
                  const isModified = isTierActive || isManualBargain;
                  const floorPrice = item.product.minSellingPrice !== undefined
                    ? item.product.minSellingPrice
                    : (item.product.isBundle ? 0 : Math.round(item.product.sellingPrice * 0.88));
                  const isBreached = !!item.priceError || (pricingSource === 'manual_override' && !canOverridePriceFloor && finalUnitPrice < floorPrice);
                  const lineIssue = cartStockCheck.lineIssues[item.product.id];

                  return (
                    <div
                      key={item.product.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius)',
                        background: isBreached
                          ? 'rgba(239, 68, 68, 0.1)'
                          : isModified
                            ? 'rgba(16, 185, 129, 0.08)'
                            : 'var(--surface-subtle, var(--muted))',
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', textDecoration: isTierActive ? 'line-through' : 'none' }}>
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
                            {isTierActive && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                                {getTranslation(lang, 'quantityPricing.tierAppliedBadge')} ({tierResolution.maxQty != null ? `${tierResolution.minQty}-${tierResolution.maxQty}` : `${tierResolution.minQty}+`})
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

                      {/* Bound Serial / IMEI Chips & Inline Cart Scanner for Serialized Products */}
                      {isSerialModuleEnabled && (item.product.requiresSerialNumber || (item.serialNumbers && item.serialNumbers.length > 0)) && (
                        <div className="mt-1 pt-1.5 border-t border-border/50 space-y-1.5">
                          {item.serialNumbers && item.serialNumbers.length > 0 && (
                            <div className="flex flex-wrap gap-1" dir="ltr">
                              {item.serialNumbers.map(sn => (
                                <span
                                  key={sn}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold"
                                >
                                  <Barcode size={10} />
                                  <span>{sn}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCart(prev => prev.map(ci =>
                                        ci.product.id === item.product.id
                                          ? { ...ci, serialNumbers: (ci.serialNumbers || []).filter(x => x !== sn) }
                                          : ci
                                      ))
                                    }
                                    className="bg-transparent border-0 p-0 text-primary/70 hover:text-destructive cursor-pointer"
                                  >
                                    <X size={10} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          {item.product.requiresSerialNumber && (item.serialNumbers?.length || 0) < item.quantity && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                dir="ltr"
                                inputMode="text"
                                value={cartSerialInputs[item.product.id] || ''}
                                onChange={(e) => setCartSerialInputs(prev => ({ ...prev, [item.product.id]: toLatinDigits(e.target.value) }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const snVal = toLatinDigits(cartSerialInputs[item.product.id] || '').trim();
                                    if (!snVal) return;
                                    const storedMatch = getStoredProductSerials().find(
                                      s => s.serialNumber.trim().toLowerCase() === snVal.toLowerCase()
                                    );
                                    if (storedMatch && storedMatch.status === 'Sold') {
                                      showPaymentToast(getTranslation(lang, 'errors.ERR_SERIAL_ALREADY_SOLD'), 4000);
                                      return;
                                    }
                                    if (storedMatch && storedMatch.status !== 'InStock') {
                                      showPaymentToast(getTranslation(lang, 'errors.ERR_SERIAL_NOT_AVAILABLE_FOR_SALE'), 4000);
                                      return;
                                    }
                                    setCart(prev => prev.map(ci =>
                                      ci.product.id === item.product.id && !(ci.serialNumbers || []).some(x => x.toLowerCase() === snVal.toLowerCase())
                                        ? { ...ci, serialNumbers: [...(ci.serialNumbers || []), snVal] }
                                        : ci
                                    ));
                                    setCartSerialInputs(prev => ({ ...prev, [item.product.id]: '' }));
                                  }
                                }}
                                placeholder={getTranslation(lang, 'serialTracking.serialRequiredForPos')}
                                className="h-7 flex-1 px-2 rounded border border-border bg-background text-foreground font-mono text-[11px] outline-none focus:border-primary"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Stock Deficit Warning (dynamically validates bundles & shared cart component demand) */}
                      {lineIssue && (
                        <div style={{
                          background: 'var(--badge-red-bg)',
                          border: '1px solid var(--badge-red-border)',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          color: 'var(--badge-red-fg)',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <AlertCircle size={14} style={{ color: 'var(--badge-red-fg)', flexShrink: 0 }} />
                          <span>
                            {item.product.isBundle && lineIssue.conflictingComponent
                              ? t('posMessages.cartComponentConflict', isAr
                                ? `إجمالي الكمية المطلوبة للمكون "${lineIssue.conflictingComponent}" في السلة (${lineIssue.required}) يتجاوز المتاح (${lineIssue.available})!`
                                : `Component "${lineIssue.conflictingComponent}" stock (${lineIssue.available}) exceeded (Req: ${lineIssue.required})`)
                                .replace('{component}', lineIssue.conflictingComponent)
                                .replace('{available}', String(lineIssue.available))
                                .replace('{requested}', String(lineIssue.required))
                              : t('posMessages.cartShortageWarning', isAr
                                ? `تنبيه: الكمية المطلوبة (${lineIssue.required}) تتجاوز الرصيد المتاح (${lineIssue.available})!`
                                : `Shortage: available ${lineIssue.available} only (Req: ${lineIssue.required})`)
                                .replace('{available}', String(lineIssue.available))
                                .replace('{requested}', String(lineIssue.required))}
                          </span>
                        </div>
                      )}

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
                          ) : isManualBargain ? (
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
                                inputMode="decimal"
                                step="0.01"
                                placeholder={isAr ? `اكتب السعر مثلا: ${Math.round(item.product.sellingPrice * 0.9)}` : 'Enter negotiated price'}
                                value={bargainInputPrice}
                                onChange={(e) => setBargainInputPrice(toLatinDigits(e.target.value))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat(toLatinDigits(bargainInputPrice));
                                    if (!isNaN(val)) handleSetItemPrice(item, val);
                                  }
                                }}
                                className="tabular-nums"
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
                });
              })()
            )}
          </div>

          {/* Cart Summary & Payment */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--muted)/30' }}>
            {(totalDiscount > 0 || loyaltyDiscountAmount > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
                <span>{getTranslation(lang, 'posCheckout.originalSubtotal')}</span>
                <span className="tabular-nums" style={{ color: 'var(--foreground)', fontWeight: 600 }}>{formatMoney(subtotal)}</span>
              </div>
            )}

            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#059669', marginBottom: '4px', fontWeight: 600 }}>
                <span>{isAr ? 'إجمالي الخصم التفاوضي:' : 'Negotiated Discounts:'}</span>
                <span className="tabular-nums">-{formatMoney(totalDiscount)}</span>
              </div>
            )}

            {loyaltyDiscountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#d97706', marginBottom: '4px', fontWeight: 700 }}>
                <span className="tabular-nums">{getTranslation(lang, 'ui.loyalty.redeemDiscountApplied').replace('{points}', formatLatinNumber(redeemPoints))}:</span>
                <span className="tabular-nums">-{formatMoney(loyaltyDiscountAmount)}</span>
              </div>
            )}

            {estimatedEarnedPoints > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#059669', marginBottom: '4px', fontWeight: 700 }}>
                <span>{getTranslation(lang, 'ui.loyalty.pointsEarnedSummary')}:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {getTranslation(lang, 'ui.loyalty.pointsEarnedBadge').replace('{points}', formatLatinNumber(estimatedEarnedPoints))}
                </span>
              </div>
            )}

            {taxRatePercent > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                <span>{isAr ? `ضريبة القيمة المضافة (${taxRatePercent}%):` : `Tax (${taxRatePercent}%):`}</span>
                <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{formatMoney(tax)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>{getTranslation(lang, 'posCheckout.finalTotal')}</span>
              <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                <span className="tabular-nums" style={{ fontSize: '18px', fontWeight: 900, color: '#059669' }}>{formatMoney(grandTotal)}</span>
                {settings.multiCurrencyEnabled && grandTotal > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>
                    <span>~ {isIqdBase ? `$ ${(currentExchangeRate > 0 ? (grandTotal / currentExchangeRate).toFixed(2) : '0.00')}` : `${formatLatinNumber(Math.round(grandTotal * currentExchangeRate))} د.ع`}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Check if any manual override item breached floor limit or has stock deficit (volume tiers are exempt from manual MinSalePrice guard) */}
            {(() => {
              const hasFloorBreach = cart.some(ci => {
                if (ci.priceError) return true;
                const resolved = resolveCartItemPricing(ci);
                if (resolved.pricingSource === 'volume_tier') return false;
                if (canOverridePriceFloor) return false;
                const floorPrice = ci.product.minSellingPrice !== undefined
                  ? ci.product.minSellingPrice
                  : (ci.product.isBundle ? 0 : Math.round(ci.product.sellingPrice * 0.88));
                return resolved.unitPrice < floorPrice;
              });
              const targetCheckWhId = dispenseMode === 'WAREHOUSE_DISPATCH' ? targetDispatchWarehouseId : selectedWarehouseId;
              const cartStockCheck = validateCartStockWithBundles(cart, products, storedBundles, targetCheckWhId);
              const hasStockDeficit = !cartStockCheck.isValid;
              const isShiftActive = !!activeShift;
              const canCheckout = cart.length > 0 && grandTotal > 0 && !hasFloorBreach && !hasStockDeficit && isShiftActive;

              return (
                <>
                  {/* Shift Locked Warning Banner */}
                  {!isShiftActive && (
                    <div style={{
                      background: 'var(--badge-red-bg)',
                      border: '1.5px solid var(--badge-red-border)',
                      borderRadius: '10px',
                      padding: '12px',
                      marginBottom: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--badge-red-fg)', fontWeight: 700, fontSize: '13px' }}>
                        <Lock size={16} style={{ flexShrink: 0 }} />
                        <span>{isAr ? 'الوردية مقفلة حالياً - البيع معطّل' : 'Shift Locked - Checkout Disabled'}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--foreground)', opacity: 0.9, lineHeight: 1.5 }}>
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
                              color: 'var(--badge-red-fg)',
                              border: '1px solid var(--badge-red-border)',
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
                      background: 'var(--badge-red-bg)',
                      border: '1px solid var(--badge-red-border)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginBottom: '10px',
                      color: 'var(--badge-red-fg)',
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
                      background: 'var(--badge-red-bg)',
                      border: '1.5px solid var(--badge-red-border)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginBottom: '10px',
                      color: 'var(--badge-red-fg)',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                      <span>{t('posMessages.checkoutShortageBanner', isAr ? 'تنبيه: الكميات المطلوبة لبعض المواد أو مكونات الحزم تتجاوز الرصيد الفعلي للمستودع! يرجى تعديل الكمية لإتمام البيع.' : 'Warning: Requested quantities (including bundle components) exceed warehouse stock!')}</span>
                    </div>
                  )}

                  {/* Symmetrical 2x2 Payment Grid: Cash [F2], Credit [F3], Installment [F4], Card [F5] */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={!canCheckout}
                      onClick={() => handleCheckout('CASH')}
                      className="h-11 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
                    >
                      <Banknote size={16} className="shrink-0" />
                      <span>{getTranslation(lang, 'posCheckout.cashBtn')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={!canCheckout}
                      onClick={() => handleCheckout('CREDIT')}
                      className="h-11 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-border bg-card hover:bg-muted text-foreground disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Receipt size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>{getTranslation(lang, 'posCheckout.creditBtn')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={!canCheckout}
                      onClick={() => {
                        setPosDownPayment(0);
                        setPosInstallmentError('');
                        setIsInstallmentModalOpen(true);
                      }}
                      className="h-11 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-border bg-card hover:bg-muted text-foreground disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <CalendarClock size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>{getTranslation(lang, 'posCheckout.installmentBtn')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={!canCheckout}
                      onClick={() => handleCheckout('CARD')}
                      className="h-11 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-border bg-card hover:bg-muted text-foreground disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <CreditCard size={16} className="shrink-0 text-primary" />
                      <span>{getTranslation(lang, 'posCheckout.cardBtn')}</span>
                    </button>
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
        <ModalBackdropPortal onClose={() => setShowReceiptModal(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: '400px', padding: '24px', borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)', color: 'var(--foreground)' }}>
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
                  <span className="tabular-nums">-{formatMoney(lastCompletedOrder.totalDiscount)}</span>
                </div>
              )}
              {(lastCompletedOrder.loyaltyDiscountAmount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#d97706', marginBottom: '4px', fontWeight: 700 }}>
                  <span className="tabular-nums">
                    {getTranslation(lang, 'ui.loyalty.redeemDiscountApplied').replace('{points}', String(lastCompletedOrder.loyaltyPointsRedeemed || 0))}:
                  </span>
                  <span className="tabular-nums">-{formatMoney(lastCompletedOrder.loyaltyDiscountAmount || 0)}</span>
                </div>
              )}
              {(lastCompletedOrder.loyaltyPointsEarned || 0) > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '4px 10px',
                  marginBottom: '6px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#059669',
                  fontSize: '11.5px',
                  fontWeight: 800
                }} className="tabular-nums">
                  {getTranslation(lang, 'ui.loyalty.pointsEarnedBadge').replace('{points}', String(lastCompletedOrder.loyaltyPointsEarned || 0))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800 }}>
                <span>{isAr ? 'المدفوع النهائي:' : 'Total Paid:'}</span>
                <span style={{ color: '#059669' }}>{formatMoney(lastCompletedOrder.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#d97706', marginTop: '2px', fontWeight: 600 }}>
                <span>{isAr ? 'طريقة الدفع:' : 'Method:'}</span>
                <span>
                  {lastCompletedOrder.paymentMethod === 'CREDIT'
                    ? getTranslation(lang, 'posCheckout.methodCredit')
                    : lastCompletedOrder.paymentMethod === 'CARD'
                      ? getTranslation(lang, 'posCheckout.methodCard')
                      : lastCompletedOrder.paymentMethod === 'INSTALLMENT'
                        ? getTranslation(lang, 'posCheckout.methodInstallment')
                        : getTranslation(lang, 'posCheckout.methodCash')}
                </span>
              </div>

              {/* Installment Contract Breakdown on Receipt */}
              {lastCompletedOrder.installmentDetails && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--badge-blue-bg)',
                  border: '1.5px dashed var(--badge-blue-border)',
                  fontSize: '11px'
                }}>
                  <div style={{ fontWeight: 800, color: 'var(--badge-blue-fg)', marginBottom: '6px', textAlign: 'center', borderBottom: '1px solid var(--badge-blue-border)', paddingBottom: '4px' }}>
                    {isAr ? 'عقد بيع بالتقسيط المعتمد' : 'Installment Contract Schedule'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--foreground)', marginBottom: '2px' }}>
                    <span>{isAr ? 'الدفعة الأولى (المقدمة):' : 'Down Payment:'}</span>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatMoney(lastCompletedOrder.installmentDetails.downPayment)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--foreground)', marginBottom: '2px' }}>
                    <span>{isAr ? 'المتبقي المقسط:' : 'Remaining Balance:'}</span>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatMoney(lastCompletedOrder.installmentDetails.remainingAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--foreground)', marginBottom: '2px' }}>
                    <span>{isAr ? 'مدة التقسيط:' : 'Tenor:'}</span>
                    <span style={{ fontWeight: 700 }}>{lastCompletedOrder.installmentDetails.count} {isAr ? 'أشهر' : 'Months'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--badge-blue-fg)', marginBottom: '2px', borderTop: '1px dashed var(--badge-blue-border)', paddingTop: '4px' }}>
                    <span style={{ fontWeight: 700 }}>{isAr ? 'القسط الشهري:' : 'Monthly Installment:'}</span>
                    <span style={{ fontWeight: 900, color: 'var(--badge-blue-fg)', fontFamily: 'monospace' }}>{formatMoney(lastCompletedOrder.installmentDetails.monthlyAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                    <span>{isAr ? 'تاريخ أول قسط:' : 'First Due Date:'}</span>
                    <span style={{ fontWeight: 700 }}>{lastCompletedOrder.installmentDetails.firstDueDate}</span>
                  </div>
                  {lastCompletedOrder.installmentDetails.guarantorName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)', marginTop: '2px' }}>
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
                  background: 'var(--badge-blue-bg)',
                  border: '1.5px dashed var(--badge-blue-border)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--badge-blue-fg)', marginBottom: '4px' }}>
                    {lastCompletedOrder.receiptNotice || (isAr ? 'قيد التجهيز من المخزن - يرجى مراجعة أمين المخزن للاستلام' : 'Pending Dispatch - Please claim at warehouse')}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--badge-blue-fg)', marginBottom: '6px' }}>
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
                  <div style={{ fontSize: '9px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
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
                      invoiceDate: toLatinDigits(lastCompletedOrder.timestamp || formatLatinDateTime(new Date(), isAr ? 'ar' : 'en')),
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
                      cutPaper: true,
                      qrData:
                        lastCompletedOrder.customerInfo?.loyaltyCardToken && typeof window !== 'undefined'
                          ? `${window.location.origin}/card/${encodeURIComponent(lastCompletedOrder.customerInfo.loyaltyCardToken)}`
                          : undefined
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
                style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', cursor: 'pointer', fontWeight: 600 }}
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
            {lastCompletedOrder.customerInfo?.loyaltyCardToken && typeof window !== 'undefined' && (
              <div className="mt-3 pt-3 border-t border-dashed border-border flex flex-col items-center gap-2 text-center">
                <div className="bg-white p-2 rounded-lg border border-border inline-flex items-center justify-center shadow-xs">
                  <QrCodeSvg
                    value={`${window.location.origin}/card/${encodeURIComponent(lastCompletedOrder.customerInfo.loyaltyCardToken)}`}
                    size={90}
                  />
                </div>
                <div className="text-[11px] font-semibold text-muted-foreground">
                  {getTranslation(lang, 'ui.digitalWallet.receiptFooterQrTitle')}
                </div>
                <button
                  type="button"
                  onClick={() => setDigitalCardCustomer(lastCompletedOrder.customerInfo!)}
                  className="w-full px-3.5 py-2 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <QrCode size={15} />
                  <span>{getTranslation(lang, 'ui.digitalWallet.cardModalBtn')}</span>
                </button>
              </div>
            )}
          </div>
        </ModalBackdropPortal>
      )}

      {/* POS Installment Modal Dialog */}
      {isInstallmentModalOpen && (
        <ModalBackdropPortal onClose={() => setIsInstallmentModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div
            className="modal-content glass-panel"
            style={{ maxWidth: '520px', width: '92%', borderRadius: '16px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--badge-blue-bg)', color: 'var(--badge-blue-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              {posInstallmentError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
                  {posInstallmentError}
                </div>
              )}

              {/* Customer Selector (Required for Installment) */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>
                  {getTranslation(lang, 'posCheckout.selectCustomerLabel')} <span className="text-destructive">*</span>
                </label>
                <select
                  value={isWalkInCustomer ? '' : (selectedCustomerId || '')}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setSelectedCustomerId(cid || undefined);
                    const found = customersList.find(c => c && c.id === cid);
                    if (found) setPosCustomerName(found.name || found.nameAr || '');
                    setPosInstallmentError('');
                  }}
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
                  <option value="">{getTranslation(lang, 'posCheckout.chooseCustomerOption')}</option>
                  {customersList
                    .filter(c => c && !c.isDefaultCashCustomer && c.id !== 'CUST-WALKIN')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.nameAr} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>
                    {getTranslation(lang, 'posCheckout.downPaymentLabel')}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={Math.max(0, grandTotal - 1)}
                    value={posDownPayment === 0 ? '' : posDownPayment}
                    onChange={(e) => setPosDownPayment(Math.max(0, parseFloat(toLatinDigits(e.target.value)) || 0))}
                    placeholder="0"
                    className="tabular-nums"
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
                    {getTranslation(lang, 'posCheckout.installmentMonthsLabel')}
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

              {/* First Due Date */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>
                  {getTranslation(lang, 'posCheckout.firstDueDateLabel')}
                </label>
                <input
                  type="date"
                  value={posFirstDueDate}
                  onChange={(e) => setPosFirstDueDate(e.target.value)}
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
                />
              </div>

              {/* Monthly Amount Live Calculation */}
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--badge-blue-bg)',
                border: '1px solid var(--badge-blue-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--badge-blue-fg)' }}>
                  {isAr ? 'القسط الشهري المستحق:' : 'Monthly Installment:'}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--badge-blue-fg)', fontFamily: 'monospace' }}>
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
                    inputMode="numeric"
                    dir="ltr"
                    className="tabular-nums"
                    value={posGuarantorPhone}
                    onChange={(e) => setPosGuarantorPhone(toLatinDigits(e.target.value))}
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
                  if ((isWalkInCustomer || !selectedCustomerId) && !posCustomerName.trim()) {
                    setPosInstallmentError(getTranslation(lang, 'errors.ERR.POS.ERR_CUSTOMER_REQUIRED_FOR_INSTALLMENT'));
                    return;
                  }
                  if (posInstallmentCount < 1 || posDownPayment < 0 || posDownPayment >= grandTotal) {
                    setPosInstallmentError(getTranslation(lang, 'errors.ERR.POS.ERR_INVALID_INSTALLMENT_TERMS'));
                    return;
                  }
                  setPosInstallmentError('');
                  setIsInstallmentModalOpen(false);
                  handleCheckout('INSTALLMENT', {
                    downPayment: posDownPayment,
                    installmentCount: posInstallmentCount,
                    firstDueDate: posFirstDueDate,
                    guarantorName: posGuarantorName,
                    guarantorPhone: posGuarantorPhone,
                    customerName: selectedCustomerObj?.name || posCustomerName
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
        </ModalBackdropPortal>
      )}

      {/* Quick Open Shift Modal via Unified DialogPortal */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        currentUser={currentUser}
        lang={lang}
        onConfirm={({ id, cashierName, terminalId, openingFloat, openedAt, formattedStartTime }) => {
          const now = new Date();
          const newShift: ActiveShift = {
            id: id || `SH-${Date.now().toString().slice(-4)}`,
            cashierName,
            terminalId,
            startTime: formattedStartTime || formatShiftDateTime(now, isAr),
            openedAt: openedAt || now.toISOString(),
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

      {/* Digital Loyalty Card Modal (Cart / Post-Checkout Receipt Sharing) */}
      <DigitalLoyaltyCardModal
        isOpen={Boolean(digitalCardCustomer)}
        onClose={() => setDigitalCardCustomer(null)}
        customer={digitalCardCustomer}
        lang={lang}
      />

      {/* Reward Voucher Handover Confirmation Modal (RDM- Scan) */}
      <RewardHandoverModal
        isOpen={Boolean(handoverVoucher)}
        onClose={() => {
          setHandoverVoucher(null);
          setHandoverError(null);
        }}
        voucher={handoverVoucher}
        hasActiveShift={Boolean(activeShift)}
        isSubmitting={isHandoverSubmitting}
        errorMessage={handoverError}
        lang={lang}
        onConfirmHandover={async () => {
          if (!handoverVoucher || !activeShift) return;
          setIsHandoverSubmitting(true);
          setHandoverError(null);
          try {
            const claimed = await claimPosVoucher({
              code: handoverVoucher.voucherCode,
              shiftId: activeShift.id,
              warehouseId: selectedWarehouse?.id,
              actorName: effectiveCashierName
            });
            if (setProducts) {
              setProducts(getStoredProducts());
            }
            if (setTransactions) {
              setTransactions(getStoredTransactions());
            }
            setPendingCustomerVouchers(prev =>
              prev.filter(v => v.voucherCode !== claimed.voucherCode)
            );
            setHandoverVoucher(null);
            showPaymentToast(
              getTranslation(lang, 'ui.posLoyaltyScan.handoverSuccessToast').replace(
                '{code}',
                claimed.voucherCode
              )
            );
          } catch (err: any) {
            const code = err?.message || 'ERR_VOUCHER_INVALID_OR_CLAIMED';
            setHandoverError(getTranslation(lang, `errors.ERR.LOYALTY.${code}`, code));
          } finally {
            setIsHandoverSubmitting(false);
          }
        }}
      />

      {/* Manual Reward Handover Lookup Modal (RDM- Code OR Phone) */}
      <ManualVoucherLookupModal
        isOpen={isManualHandoverModalOpen}
        onClose={() => {
          setIsManualHandoverModalOpen(false);
          setManualInitialVouchers(undefined);
        }}
        initialVouchers={manualInitialVouchers}
        hasActiveShift={Boolean(activeShift)}
        shiftId={activeShift?.id}
        warehouseId={selectedWarehouse?.id}
        actorName={effectiveCashierName}
        lang={lang}
        onClaimSuccess={(claimed) => {
          if (setProducts) {
            setProducts(getStoredProducts());
          }
          if (setTransactions) {
            setTransactions(getStoredTransactions());
          }
          setPendingCustomerVouchers(prev =>
            prev.filter(v => v.voucherCode !== claimed.voucherCode)
          );
          showPaymentToast(
            getTranslation(lang, 'ui.posLoyaltyScan.handoverSuccessToast').replace(
              '{code}',
              claimed.voucherCode
            )
          );
        }}
      />

      {/* Smart Electronic Scale Modal */}
      {isScaleEnabled && (
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
                ? `تم إضافة (${getProductName(product)}) بوزن ${weightKg} كغم`
                : `Added (${getProductName(product)}) [${weightKg} kg]`
            );
          }}
        />
      )}
    </div>
  );
}
