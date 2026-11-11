import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutGrid,
  Package,
  Warehouse as WarehouseIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calculator,
  Users,
  FileText,
  Settings,
  ChevronDown,
  Search,
  Bell,
  Calendar,
  ChevronRight,
  AlertTriangle,
  Send,
  Boxes,
  Globe,
  Plus,
  CheckCircle2,
  LogOut,
  UserCheck,
  ReceiptText,
  QrCode,
  Bot,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShoppingCart,
  ArrowLeftRight,
  Truck,
  Clock,
  RotateCcw,
  ShieldCheck,
  Shield,
  ShoppingBag,
  Award,
  DollarSign,
  Wallet,
  Receipt,
  Edit3,
  Sun,
  Moon,
  Building2
} from 'lucide-react';
import { SettingsProvider, useSettings } from './context/settings-context';
import { Toaster, toast } from 'sonner';
import BarcodeSvg from './components/BarcodeSvg';
import WarehouseCapacityBars from './components/WarehouseCapacityBars';
import WeeklyStockChart from './components/WeeklyStockChart';
import { RecentTransactionsTable } from './components/RecentTransactionsTable';
import TransactionModal, { TransactionDetail } from './components/TransactionModal';
import BarcodeScannerModal from './components/BarcodeScannerModal';
import { UserNav } from './components/UserNav';
import { AppSidebar } from './components/layout/AppSidebar';
import ProductDetailsModal from './components/ProductDetailsModal';
import ErrorBoundary from './components/common/ErrorBoundary';
import StockAdjustmentModal from './components/modals/StockAdjustmentModal';
import AddProductModal from './components/AddProductModal';
import GeminiCopilotModal from './components/GeminiCopilotModal';
import InterWarehouseTransferModal from './components/modals/InterWarehouseTransferModal';
import OutboundDispatchModal from './components/modals/OutboundDispatchModal';
import EditWarehouseModal from './components/modals/EditWarehouseModal';
import QuickExpenseModal from './components/modals/QuickExpenseModal';
import { QuickOperationsBar } from './components/QuickOperationsBar';
import InventoryView from './components/views/InventoryView';
import ForbiddenView from './components/views/ForbiddenView';
import InvoicesView from './components/views/InvoicesView';
import SalesInvoicesView from './components/views/SalesInvoicesView';
import CreateInvoiceView from './components/views/CreateInvoiceView';
import InstallmentsView from './components/views/InstallmentsView';
import LoginView from './components/views/LoginView';
import LandingPageView from './components/views/LandingPageView';
import PricingCalculatorView from './components/views/PricingCalculatorView';
import SelfServiceRegisterView from './components/views/SelfServiceRegisterView';
import UsersStaffView from './components/views/UsersStaffView';
import { UserRole, UserProfile, UserAccount, SYSTEM_ROLES_CONFIG, buildUserProfileFromAccount } from './types/rbac';
import { getPermittedNavigation, isRouteAllowed } from './config/navigationSchema';
import InvoiceDetailsModal from './components/modals/InvoiceDetailsModal';
import CreateInvoiceModal from './components/modals/CreateInvoiceModal';
import WarehousesRacksView from './components/views/WarehousesRacksView';
import InboundView from './components/views/InboundView';
import OutboundView from './components/views/OutboundView';
import WarehouseDispatchQueueView from './components/views/WarehouseDispatchQueueView';
import StockCountsView from './components/views/StockCountsView';
import SuppliersView from './components/views/SuppliersView';
import ReportsView from './components/views/ReportsView';
import SettingsView from './components/views/SettingsView';
import TransfersView from './components/views/TransfersView';
import PosTerminalView from './components/views/PosTerminalView';
import ShiftsView from './components/views/ShiftsView';
import ReturnsWarrantyView from './components/views/ReturnsWarrantyView';
import DeliveryLogisticsView from './components/views/DeliveryLogisticsView';
import IncomingPurchasesView from './components/views/IncomingPurchasesView';
import PurchaseOrdersView from './components/views/PurchaseOrdersView';
import CustomersLoyaltyView from './components/views/CustomersLoyaltyView';
import FinanceTreasuryView from './components/views/FinanceTreasuryView';
import SaasAdminLayout, { SaasAdminTab } from './layouts/SaasAdminLayout';
import TenantsManagementView from './components/views/superadmin/TenantsManagementView';
import { PlansView, BillingView, ServerHealthView } from './components/views/superadmin/SaasControlPlaneSubViews';
import { Tenant } from './services/tenantService';
import { evaluateRouteAccess } from './middleware';
import { getRoleDefaultNav, getCleanUsername } from './auth/login-handler';
import { Product, SalesInvoice, Warehouse } from './types/warehouse';
import { localizeTxType, localizeTxStatus, localizeUnit, localizeWarehouse } from './lib/localeHelpers';
import {
  getStoredProducts,
  saveStoredProducts,
  getStoredInvoices,
  saveStoredInvoices,
  getStoredTransactions,
  saveStoredTransactions,
  getNextTransactionId,
  getStoredOutboundOrders,
  saveStoredOutboundOrders,
  getStoredLang,
  saveStoredLang,
  getStoredAuthSession,
  saveStoredAuthSession,
  clearStoredAuthSession,
  getStoredWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getStoredSelectedWarehouseId,
  saveStoredSelectedWarehouseId,
  clearStoredSelectedWarehouseId,
  validateAndResolveActiveWarehouse,
  getStoredUsers,
  getAllStoredUsersMaster,
  recordShiftSale
} from './services/storageService';
import './App.css';

const DATE_RANGE_OPTIONS = [
  { id: 'today', ar: 'اليوم (15 تشرين الأول)', en: 'Today (15 Oct 2026)' },
  { id: 'week', ar: 'هذا الأسبوع', en: 'This Week' },
  { id: 'month', ar: 'هذا الشهر', en: 'This Month' },
  { id: '90days', ar: 'آخر 90 يوماً', en: 'Past 90 Days' }
];

const NAV_TITLES: Record<string, { ar: string; en: string }> = {
  'Dashboard': { ar: 'لوحة القيادة والمؤشرات الحية', en: 'Dashboard & Live KPIs' },
  'Cloud POS': { ar: 'شاشة البيع', en: 'POS Screen' },
  'Shifts & Cash Drawer': { ar: 'الورديات', en: 'Shifts' },
  'Sales Invoices': { ar: 'فواتير المبيعات', en: 'Sales Invoices' },
  'Create Invoice': { ar: 'فواتير المبيعات', en: 'Sales Invoices' },
  'Invoices & Billing': { ar: 'فواتير المبيعات', en: 'Sales Invoices' },
  'Installments': { ar: 'إدارة الأقساط', en: 'Installments' },
  'Returns & Warranty': { ar: 'المرتجعات', en: 'Returns' },
  'Customers & Loyalty': { ar: 'العملاء', en: 'Customers' },
  'Purchases & POs': { ar: 'فواتير المشتريات', en: 'Purchase Bills' },
  'Purchase Orders': { ar: 'أوامر الشراء', en: 'Purchase Orders' },
  'Suppliers': { ar: 'الموردون', en: 'Suppliers' },
  'Inventory & Items': { ar: 'المنتجات', en: 'Products' },
  'Transfers & In-Transit': { ar: 'المناقلات المخزنية', en: 'Stock Transfers' },
  'Stock Counts': { ar: 'الجرد والتسويات', en: 'Audits & Adjustments' },
  'Warehouses & Racks': { ar: 'المستودعات والرفوف', en: 'Warehouses & Racks' },
  'Finance & Treasury': { ar: 'الصناديق والبنوك', en: 'Cash & Banks' },
  'Finance Vouchers': { ar: 'سندات القبض والصرف', en: 'Receipt & Payment Vouchers' },
  'Reports': { ar: 'التقارير', en: 'Reports' },
  'Users & Staff': { ar: 'المستخدمون والصلاحيات', en: 'Users & Permissions' },
  'Settings': { ar: 'الإعدادات العامة', en: 'General Settings' },
  'Delivery & Logistics': { ar: 'الشحن والتوصيل', en: 'Delivery & Logistics' },
  'Inbound (Goods In)': { ar: 'الوارد ومذكرات الاستلام', en: 'Inbound Shipments' },
  'Outbound (Goods Out)': { ar: 'المنصرف وأذونات الصرف', en: 'Outbound Dispatch' },
  'Dispatch Queue': { ar: 'أوامر التجهيز والصرف', en: 'Dispatch Orders' }
};

function getInitialPublicRoute(): 'landing' | 'login' | 'pricing' | 'register' {
  if (typeof window === 'undefined') return 'landing';
  const path = window.location.pathname.toLowerCase();
  const search = new URLSearchParams(window.location.search);
  const routeParam = search.get('route') || search.get('view');
  
  if (path === '/login' || routeParam === 'login') return 'login';
  if (path.includes('pricing') || routeParam === 'pricing') return 'pricing';
  if (path.includes('register') || routeParam === 'register') return 'register';
  return 'landing';
}

function parseRegisterParamsFromUrl() {
  if (typeof window === 'undefined') return {};
  const search = new URLSearchParams(window.location.search);
  const planParam = search.get('plan');
  const plan = (planParam === 'Starter' || planParam === 'Enterprise' || planParam === 'Pro') ? planParam : undefined;
  const warehouses = parseInt(search.get('warehouses') || '') || undefined;
  const users = parseInt(search.get('users') || '') || undefined;
  const wms = search.has('wms') ? search.get('wms') === 'true' : undefined;
  const pos = search.has('pos') ? search.get('pos') === 'true' : undefined;
  const cycle = search.get('cycle') === 'monthly' ? 'monthly' : search.get('cycle') === 'yearly' ? 'yearly' : undefined;
  const currency = search.get('currency') || undefined;

  return { plan, warehouses, users, wms, pos, cycle, currency };
}

function DashboardApp() {
  const { effectiveLanguage, updateSetting, isAr, settings, formatMoney, currencySymbol, currencyLabel, effectiveTheme, setTheme, setLocale } = useSettings();
  const lang: 'ar' | 'en' = effectiveLanguage === 'ar' ? 'ar' : 'en';
  const [activeNav, setActiveNav] = useState<string>(() => {
    const session = getStoredAuthSession();
    if (session) {
      return getRoleDefaultNav(session.role);
    }
    return 'Dashboard';
  });
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    const stored = getStoredSelectedWarehouseId();
    if (!stored || stored === 'ALL') return 'ALL';
    const whs = getStoredWarehouses();
    const resolution = validateAndResolveActiveWarehouse(whs, stored);
    return resolution.wasInvalidFallback ? 'ALL' : resolution.activeWarehouseId;
  });
  const [selectedDateRangeId, setSelectedDateRangeId] = useState<string>('today');
  const [searchTerm, setSearchTerm] = useState('');

  // Public Routes (Landing Page, Pricing Calculator, Self-Service Onboarding, Login)
  const [publicRoute, setPublicRoute] = useState<'landing' | 'login' | 'pricing' | 'register'>(() => getInitialPublicRoute());
  const [registerParams, setRegisterParams] = useState<any>(() => parseRegisterParamsFromUrl());

  const navigateToPublic = (route: 'landing' | 'login' | 'pricing' | 'register', params?: any) => {
    setPublicRoute(route);
    if (params) setRegisterParams(params);

    if (typeof window !== 'undefined') {
      let newUrl = route === 'landing' ? '/' : `/${route}`;
      if (route === 'register' && params) {
        const query = new URLSearchParams();
        if (params.plan) query.set('plan', params.plan);
        if (params.warehouses) query.set('warehouses', String(params.warehouses));
        if (params.users) query.set('users', String(params.users));
        if (params.wms !== undefined) query.set('wms', String(params.wms));
        if (params.pos !== undefined) query.set('pos', String(params.pos));
        if (params.cycle) query.set('cycle', params.cycle);
        if (params.currency) query.set('currency', params.currency);
        const qStr = query.toString();
        if (qStr) newUrl += `?${qStr}`;
      }
      window.history.pushState({ route }, '', newUrl);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setPublicRoute(getInitialPublicRoute());
      setRegisterParams(parseRegisterParamsFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Persistent Multi-User Authentication & Session State (Strict Zero-Auto-Admin)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return getStoredAuthSession();
  });

  // Guard role routes: Prevent Cashier / Storekeeper from ever getting stuck on /dashboard
  useEffect(() => {
    if (currentUser) {
      const safeLanding = getRoleDefaultNav(currentUser.role);
      if (safeLanding !== 'Dashboard' && activeNav === 'Dashboard') {
        setActiveNav(safeLanding);
      }

      // Feature Flags Route Guard: Auto redirect if current screen's module is disabled
      if (currentUser.features) {
        if ((activeNav === 'Cloud POS' || activeNav === 'Shifts & Cash Drawer') && currentUser.features.enablePOS === false) {
          setActiveNav('Sales Invoices');
        } else if (activeNav === 'Installments' && currentUser.features.enableInstallments === false) {
          setActiveNav('Sales Invoices');
        } else if ((activeNav === 'Transfers & In-Transit' || activeNav === 'Warehouses & Racks' || activeNav === 'Dispatch Queue') && currentUser.features.multiWarehouse === false) {
          setActiveNav('Inventory & Items');
        }

        if (currentUser.features.enableMultiCurrency === false && settings.multiCurrencyEnabled) {
          updateSetting('multiCurrencyEnabled', false);
        }
      }
    }
  }, [currentUser, activeNav]);

  const [saasAdminTab, setSaasAdminTab] = useState<SaasAdminTab>('tenants');
  const [impersonatingSuperAdminProfile, setImpersonatingSuperAdminProfile] = useState<UserProfile | null>(() => {
    try {
      const raw = sessionStorage.getItem('zilox_impersonating_superadmin');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const permittedNav = useMemo(() => {
    return currentUser ? getPermittedNavigation(currentUser) : null;
  }, [currentUser]);

  const handleLogout = () => {
    clearStoredAuthSession();
    sessionStorage.removeItem('zilox_impersonating_superadmin');
    setImpersonatingSuperAdminProfile(null);
    setCurrentUser(null);
    setActiveNav('Dashboard');
    // Flush in-memory tenant data to eliminate cross-tenant bleeding
    setProducts([]);
    setInvoices([]);
    setTransactions([]);
    setWarehouses([]);
    setSelectedWarehouseId('ALL');
    navigateToPublic('login');
    showToast(isAr ? 'تم تسجيل الخروج بنجاح' : 'Signed out successfully');
  };

  const handleImpersonateTenant = (tenant: Tenant) => {
    const allUsers: UserAccount[] = getAllStoredUsersMaster();
    const cleanSlug = tenant.slug.toLowerCase();
    const tenantUser = allUsers.find((u: UserAccount) => u.tenantSlug?.toLowerCase() === cleanSlug && (u.role === 'SuperAdmin' || u.role === 'BranchManager'))
      || allUsers.find((u: UserAccount) => u.tenantSlug?.toLowerCase() === cleanSlug)
      || allUsers.find((u: UserAccount) => u.username.toLowerCase().endsWith(`@${cleanSlug}`));

    if (tenantUser) {
      const profile = buildUserProfileFromAccount(tenantUser);
      profile.tenantId = tenant.id;
      profile.tenantSlug = tenant.slug;
      profile.tenantName = tenant.name;
      profile.businessPreset = tenant.businessPreset;
      profile.businessPresetName = tenant.businessPresetName;
      profile.features = tenant.features;

      if (currentUser?.role === 'PlatformSuperAdmin') {
        sessionStorage.setItem('zilox_impersonating_superadmin', JSON.stringify(currentUser));
        setImpersonatingSuperAdminProfile(currentUser);
      }

      setProducts([]);
      setInvoices([]);
      setTransactions([]);
      setWarehouses([]);

      setCurrentUser(profile);
      saveStoredAuthSession(profile);
      // Reload isolated data for the impersonated tenant
      setProducts(getStoredProducts());
      setInvoices(getStoredInvoices());
      setTransactions(getStoredTransactions());
      setWarehouses(getStoredWarehouses());
      setActiveNav(profile.defaultRoute || 'Dashboard');
      showToast(isAr 
        ? `تم الدخول كعميل (Impersonation): مدير منشأة "${tenant.name}"` 
        : `Impersonating: Admin of "${tenant.name}"`);
    } else {
      showToast(isAr ? 'لا يوجد حساب مدير مسجل لهذه المنشأة' : 'No admin found for this tenant');
    }
  };

  const handleReturnToPlatformSuperAdmin = () => {
    if (impersonatingSuperAdminProfile) {
      setProducts([]);
      setInvoices([]);
      setTransactions([]);
      setWarehouses([]);

      setCurrentUser(impersonatingSuperAdminProfile);
      saveStoredAuthSession(impersonatingSuperAdminProfile);
      sessionStorage.removeItem('zilox_impersonating_superadmin');
      setImpersonatingSuperAdminProfile(null);
      // Reload isolated data for platform superadmin
      setProducts(getStoredProducts());
      setInvoices(getStoredInvoices());
      setTransactions(getStoredTransactions());
      setWarehouses(getStoredWarehouses());
      setSaasAdminTab('tenants');
      showToast(isAr ? 'تمت العودة إلى لوحة تحكم مالك المنصة (SaaS Super Admin)' : 'Returned to Platform Super Admin');
    }
  };

  const handleLoginSuccess = (profile: UserProfile, account: UserAccount) => {
    // Purge memory state immediately to guarantee zero bleeding across login sessions
    setProducts([]);
    setInvoices([]);
    setTransactions([]);
    setWarehouses([]);

    setCurrentUser(profile);
    saveStoredAuthSession(profile);

    // Reload isolated data for the new tenant
    setProducts(getStoredProducts());
    setInvoices(getStoredInvoices());
    setTransactions(getStoredTransactions());
    setWarehouses(getStoredWarehouses());
    const assignedWh = profile.defaultWarehouseId || profile.branchId;
    if (assignedWh && assignedWh !== 'ALL' && assignedWh !== 'PLATFORM') {
      setSelectedWarehouseId(assignedWh);
    } else {
      setSelectedWarehouseId('ALL');
    }
    const targetRoute = getRoleDefaultNav(profile.role);
    profile.defaultRoute = targetRoute;
    profile.username = getCleanUsername(profile.username);
    setActiveNav(targetRoute);
    showToast(isAr 
      ? `مرحباً بك، ${profile.fullName}! (${profile.roleNameAr})` 
      : `Welcome back, ${profile.fullName}! (${profile.roleNameEn})`);
  };

  
  // Mutually Exclusive Dropdown & Popover State
  type ActiveMenu = 'warehouse' | 'date' | 'notifications' | 'profile' | null;
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);

  const toggleMenu = (menu: ActiveMenu) => {
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  const closeMenu = () => {
    setActiveMenu(null);
  };

  // Modals
  const [selectedTxForModal, setSelectedTxForModal] = useState<TransactionDetail | null>(null);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [adjustingProductForModal, setAdjustingProductForModal] = useState<Product | null>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<SalesInvoice | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerInitialBarcode, setScannerInitialBarcode] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [addProductModalMode, setAddProductModalMode] = useState<'new_product' | 'restock'>('new_product');
  const [addProductTargetWarehouse, setAddProductTargetWarehouse] = useState<string>(() => getStoredWarehouses()[0]?.id || '');
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showValuation, setShowValuation] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferInitialProductId, setTransferInitialProductId] = useState<string | undefined>(undefined);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState<boolean>(false);
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState<boolean>(false);
  const [copiedSku, setCopiedSku] = useState<string>('');
  const [poToReceivePrefill, setPoToReceivePrefill] = useState<any | null>(null);

  // Collapsible Sidebar Groups State
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    pos: true,
    sales: true,
    purchases: false,
    warehouse: true,
    finance: false,
    system: false
  });

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Auto-expand matching parent group when navigating
  useEffect(() => {
    if (['Cloud POS', 'Shifts & Cash Drawer'].includes(activeNav)) {
      setExpandedGroups(prev => ({ ...prev, pos: true }));
    } else if (['Invoices & Billing', 'Sales Invoices', 'Create Invoice', 'Installments', 'Returns & Warranty', 'Customers & Loyalty'].includes(activeNav)) {
      setExpandedGroups(prev => ({ ...prev, sales: true }));
    } else if (['Purchases & POs', 'Purchase Orders', 'Suppliers'].includes(activeNav)) {
      setExpandedGroups(prev => ({ ...prev, purchases: true }));
    } else if (['Inventory & Items', 'Transfers & In-Transit', 'Stock Counts', 'Warehouses & Racks', 'Dispatch Queue'].includes(activeNav)) {
      setExpandedGroups(prev => ({ ...prev, warehouse: true }));
    } else if (['Finance & Treasury', 'Finance Vouchers'].includes(activeNav)) {
      setExpandedGroups(prev => ({ ...prev, finance: true }));
    } else if (['Reports', 'Users & Staff', 'Settings'].includes(activeNav)) {
      setExpandedGroups(prev => ({ ...prev, system: true }));
    }
  }, [activeNav]);

  // Auto-close open menu on click outside or on Escape key
  useEffect(() => {
    if (!activeMenu) return;

    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const isInside = target.closest(
        '.dropdown-container, .notification-bell-container, .dropdown-menu-floating, .notification-popover'
      );

      if (!isInside) {
        setActiveMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenu]);

  // Auto-close open menu on route change
  useEffect(() => {
    setActiveMenu(null);
  }, [activeNav]);

  // Data State - Loaded from LocalStorage and permanently saved
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());
  const [invoices, setInvoices] = useState<SalesInvoice[]>(() => getStoredInvoices());
  const [transactions, setTransactions] = useState<TransactionDetail[]>(() => getStoredTransactions());
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => getStoredWarehouses());

  // Guard: Automatically clear and fallback if selected warehouse was deleted or deactivated
  useEffect(() => {
    if (selectedWarehouseId !== 'ALL') {
      const isStillActive = warehouses.some(w => w.id === selectedWarehouseId && (w as any).isActive !== false && w.status !== 'maintenance');
      if (!isStillActive) {
        clearStoredSelectedWarehouseId();
        setSelectedWarehouseId('ALL');
      }
    }
  }, [warehouses, selectedWarehouseId]);

  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const editingWarehouse = useMemo(() => warehouses.find(w => w.id === editingWarehouseId) || null, [warehouses, editingWarehouseId]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    toast(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Dynamic Warehouse Filter Options including newly created warehouses
  const warehouseFilterOptions = useMemo(() => [
    { id: 'ALL', ar: 'جميع المستودعات والفروع', en: 'All Warehouses & Hubs' },
    ...warehouses.map(w => ({
      id: w.id,
      ar: localizeWarehouse(w.nameAr || w.id, 'ar'),
      en: localizeWarehouse(w.nameEn || w.nameAr || w.id, 'en')
    }))
  ], [warehouses]);

  // Warehouse CRUD Handlers
  const handleCreateWarehouse = (data: {
    code: string;
    nameAr: string;
    nameEn?: string;
    city: string;
    cityAr?: string;
    cityEn?: string;
    manager: string;
    managerEn?: string;
    phone: string;
    capacity: number;
    status?: 'active' | 'maintenance';
  }) => {
    try {
      const newWh = createWarehouse(data);
      setWarehouses(getStoredWarehouses());
      showToast(isAr 
        ? `تم تسجيل المستودع بنجاح: ${newWh.nameAr} (${newWh.code})` 
        : `Warehouse registered: ${newWh.nameAr} (${newWh.code})`);
    } catch (err: any) {
      showToast(`${err?.message || 'Error registering warehouse'}`);
    }
  };

  const handleUpdateWarehouse = (id: string, updates: Partial<Warehouse>) => {
    try {
      const updated = updateWarehouse(id, updates);
      setWarehouses(getStoredWarehouses());
      showToast(isAr 
        ? `تم تحديث بيانات المستودع: ${updated.nameAr}` 
        : `Warehouse updated: ${updated.nameAr}`);
    } catch (err: any) {
      showToast(`${err?.message || 'Error updating warehouse'}`);
    }
  };

  const handleDeleteWarehouse = (id: string) => {
    try {
      const res = deleteWarehouse(id);
      if (res.success) {
        setWarehouses(getStoredWarehouses());
        setSelectedWarehouseId('ALL');
        showToast(isAr ? 'تم حذف المستودع بنجاح من النظام' : 'Warehouse deleted successfully');
      } else {
        alert(res.message);
        showToast(res.message || (isAr ? 'لا يمكن حذف المستودع' : 'Error deleting warehouse'));
      }
    } catch (err: any) {
      alert(err?.message || (isAr ? 'حدث خطأ أثناء محاولة حذف المستودع' : 'Error deleting warehouse'));
      showToast(err?.message || (isAr ? 'حدث خطأ أثناء محاولة حذف المستودع' : 'Error deleting warehouse'));
    }
  };

  // Monitor live online/offline sync status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast(isAr ? ' استعادة الاتصال بالإنترنت والمزامنة اللحظية' : ' Internet restored & synced');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast(isAr ? ' انقطع الاتصال - تم التحويل إلى وضع العمل دون اتصال' : ' Offline Mode active');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAr]);

  // Automatic LocalStorage sync effects
  useEffect(() => {
    saveStoredProducts(products);
  }, [products]);

  useEffect(() => {
    saveStoredInvoices(invoices);
  }, [invoices]);

  useEffect(() => {
    saveStoredTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    saveStoredLang(lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  // Keyboard shortcut [Q] to focus search with strict input isolation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Strict Active Element Isolation: Ignore keypress if emitted from within any form field or editable area
      const target = (e.target || document.activeElement) as HTMLElement | null;
      if (target) {
        const tagName = target.tagName ? target.tagName.toUpperCase() : '';
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) || target.isContentEditable) {
          return;
        }
      }

      // 2. Only trigger shortcut when typing outside any input
      if ((e.key === 'q' || e.key === 'Q') && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Automatic barcode scan detection handler
  const handleBarcodeSearch = (val: string) => {
    const term = val.trim().toLowerCase();
    if (!term) return;
    const matched = products.find(p => 
      p.barcode?.toLowerCase() === term ||
      p.sku?.toLowerCase() === term ||
      p.id?.toLowerCase() === term
    );
    if (matched) {
      setSelectedProductForModal(matched);
      showToast(isAr 
        ? ` تم التقاط وقراءة الباركود تلقائياً: ${matched.nameAr} [${matched.sku}]` 
        : ` Barcode Auto-detected: ${matched.nameAr} [${matched.sku}]`);
    } else {
      showToast(isAr ? `تصفية البحث: "${val}"` : `Filtering items for: "${val}"`);
    }
  };

  const handleRestockProduct = (productId: string, qtyToAdd: number, warehouseId: string, supplier: string, poRef: string) => {
    let matchedName = 'صنف وارد';
    let matchedSku = 'SKU';
    let matchedLocation = 'المستودع الرئيسي';
    let matchedUnit = isAr ? 'قطعة' : 'unit';

    setProducts(prevProducts => {
      return prevProducts.map(p => {
        if (p.id === productId) {
          matchedName = p.nameAr;
          matchedSku = p.sku;
          matchedLocation = p.warehouseName;
          matchedUnit = p.unit || (isAr ? 'قطعة' : 'unit');
          const newStock = p.currentStock + qtyToAdd;
          return {
            ...p,
            currentStock: newStock,
            status: newStock <= 0 ? 'out_of_stock' : newStock <= p.minStockAlert ? 'low' : 'available',
            updatedAt: new Date().toISOString().slice(0, 10)
          };
        }
        return p;
      });
    });

    const newTx: TransactionDetail = {
      id: getNextTransactionId(),
      sku: matchedSku,
      productName: matchedName,
      type: 'Inbound',
      qty: qtyToAdd,
      unit: matchedUnit,
      location: matchedLocation,
      fromLocation: supplier ? `مورد: ${supplier}` : (isAr ? 'مورد معتمد' : 'Authorized Supplier'),
      toLocation: matchedLocation,
      status: 'Received',
      timestamp: new Date().toISOString(),
      movementDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(),
      operator: supplier || (isAr ? 'أمين المخزن' : 'Storekeeper'),
      referenceNo: poRef
    };
    setTransactions(prev => {
      const updated = [newTx, ...prev];
      saveStoredTransactions(updated);
      return updated;
    });

    showToast(lang === 'ar' 
      ? `تم توريد وحفظ ${qtyToAdd} ${matchedUnit} بنجاح للمستودع عبر إذن استلام (${poRef})!` 
      : `Received & saved ${qtyToAdd} ${matchedUnit} into warehouse under (${poRef})!`);
  };

  const handleCreateInvoice = (newInvoice: SalesInvoice) => {
    // 1. Resolve authentic operator from invoice or logged in user session (strictly prevent 'Mustafa Operations' fallback)
    const effectiveOperator = newInvoice.operator?.trim() 
      || currentUser?.fullName?.trim() 
      || currentUser?.username?.trim() 
      || (isAr ? 'أمين الصندوق' : 'Cashier');

    // Ensure invoice stores the actual operator
    const finalizedInvoice: SalesInvoice = {
      ...newInvoice,
      operator: effectiveOperator
    };

    setInvoices(prev => [finalizedInvoice, ...prev]);

    const isWarehouseDispatch = finalizedInvoice.dispenseMode === 'WAREHOUSE_DISPATCH';

    // 2. Deduct stock and generate movements ONLY for direct in-store (for warehouse dispatch, stock is deducted when keeper approves dispatch)
    if (!isWarehouseDispatch) {
      setProducts(prevProducts => {
        return prevProducts.map(p => {
          const itemInInv = finalizedInvoice.items?.find(i => i.productId === p.id || i.sku === p.sku);
          if (itemInInv) {
            const newStock = Math.max(0, p.currentStock - itemInInv.quantity);
            return {
              ...p,
              currentStock: newStock,
              status: newStock <= 0 ? 'out_of_stock' : newStock <= p.minStockAlert ? 'low' : 'available'
            };
          }
          return p;
        });
      });

      // 3. Generate atomic Outbound Stock Movements for each item with authentic product name & operator
      const newTxs: TransactionDetail[] = [];
      const nowIso = new Date().toISOString();

      if (finalizedInvoice.items && finalizedInvoice.items.length > 0) {
        finalizedInvoice.items.forEach((item, index) => {
          const matchedProd = products.find(p => p.id === item.productId || p.sku === item.sku);
          const prodName = isAr 
            ? (item.nameAr || matchedProd?.nameAr || item.nameEn || matchedProd?.nameEn || item.sku)
            : (item.nameEn || matchedProd?.nameEn || item.nameAr || matchedProd?.nameAr || item.sku);
          const itemUnit = item.unit || matchedProd?.unit || (isAr ? 'قطعة' : 'unit');

          newTxs.push({
            id: getNextTransactionId(index),
            sku: item.sku || matchedProd?.sku || 'INV-SALE',
            productName: prodName,
            type: 'Outbound',
            qty: -Math.abs(item.quantity || 1),
            unit: itemUnit,
            location: finalizedInvoice.warehouseName,
            fromLocation: finalizedInvoice.warehouseName,
            toLocation: finalizedInvoice.customerName || (isAr ? 'عميل نقدي عام' : 'Retail Customer'),
            status: 'Dispatched',
            timestamp: nowIso,
            movementDate: nowIso,
            createdAt: nowIso,
            date: nowIso,
            operator: effectiveOperator,
            referenceNo: finalizedInvoice.invoiceNo
          });
        });
      } else {
        newTxs.push({
          id: getNextTransactionId(0),
          sku: 'INV-SALE',
          productName: isAr ? 'فاتورة مبيعات' : 'Sales Invoice',
          type: 'Outbound',
          qty: -Math.abs(finalizedInvoice.itemsCount || 1),
          unit: isAr ? 'قطعة' : 'unit',
          location: finalizedInvoice.warehouseName,
          fromLocation: finalizedInvoice.warehouseName,
          toLocation: finalizedInvoice.customerName || (isAr ? 'عميل نقدي عام' : 'Customer'),
          status: 'Dispatched',
          timestamp: nowIso,
          movementDate: nowIso,
          createdAt: nowIso,
          date: nowIso,
          operator: effectiveOperator,
          referenceNo: finalizedInvoice.invoiceNo
        });
      }

      setTransactions(prev => {
        const updated = [...newTxs, ...prev];
        saveStoredTransactions(updated);
        return updated;
      });
    }

    // 4. Update Shift sales and Treasury safe if paid
    if (finalizedInvoice.status === 'paid') {
      recordShiftSale(finalizedInvoice.paymentMethod || 'CASH', Number(finalizedInvoice.total) || 0);
    }

    setSelectedInvoiceForModal(finalizedInvoice);
    showToast(
      isWarehouseDispatch
        ? (lang === 'ar' ? `تم إصدار الفاتورة رقم ${finalizedInvoice.invoiceNo} وإرسال أمر التجهيز لطابور المستودع بنجاح!` : `Invoice ${finalizedInvoice.invoiceNo} issued & queued for warehouse dispatch!`)
        : (lang === 'ar' ? `تم إصدار الفاتورة رقم ${finalizedInvoice.invoiceNo} وصرف البضاعة بنجاح!` : `Invoice ${finalizedInvoice.invoiceNo} issued & dispensed successfully!`)
    );
  };

  const handleTransferStock = (data: {
    productId: string;
    fromWarehouse: string;
    toWarehouse: string;
    quantity: number;
    carrier: string;
    reference: string;
  }) => {
    let pName = 'صنف محول';
    let pSku = 'SKU-TRF';
    let pUnit = isAr ? 'قطعة' : 'unit';

    setProducts(prev => prev.map(p => {
      if (p.id === data.productId) {
        pName = p.nameAr;
        pSku = p.sku;
        pUnit = p.unit || (isAr ? 'قطعة' : 'unit');
      }
      return p;
    }));

    const newTx: TransactionDetail = {
      id: getNextTransactionId(),
      sku: pSku,
      productName: pName,
      type: 'Transfer',
      qty: data.quantity,
      unit: pUnit,
      location: data.toWarehouse,
      fromLocation: data.fromWarehouse,
      toLocation: data.toWarehouse,
      status: 'Received',
      timestamp: new Date().toISOString(),
      movementDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(),
      operator: data.carrier || (isAr ? 'مسؤول النقل الداخلي' : 'Internal Logistics'),
      referenceNo: data.reference
    };

    setTransactions(prev => {
      const updated = [newTx, ...prev];
      saveStoredTransactions(updated);
      return updated;
    });

    showToast(isAr 
      ? `تم ترحيل وتحويل ${data.quantity} ${pUnit} من ${data.fromWarehouse} إلى ${data.toWarehouse} بنجاح!` 
      : `Transferred ${data.quantity} ${pUnit} from ${data.fromWarehouse} to ${data.toWarehouse}!`);
  };

  const handleOutboundDispatch = (data: {
    productId: string;
    fromWarehouse: string;
    destination: string;
    quantity: number;
    carrier: string;
    soNumber: string;
  }) => {
    let pName = 'صنف منصرف';
    let pSku = 'SKU-OUT';
    let pUnit = isAr ? 'قطعة' : 'unit';

    setProducts(prev => prev.map(p => {
      if (p.id === data.productId) {
        pName = p.nameAr;
        pSku = p.sku;
        pUnit = p.unit || (isAr ? 'قطعة' : 'unit');
        const newStock = Math.max(0, p.currentStock - data.quantity);
        return {
          ...p,
          currentStock: newStock,
          status: newStock <= 0 ? 'out_of_stock' : newStock <= p.minStockAlert ? 'low' : 'available'
        };
      }
      return p;
    }));

    const newTx: TransactionDetail = {
      id: getNextTransactionId(),
      sku: pSku,
      productName: pName,
      type: 'Outbound',
      qty: -data.quantity,
      unit: pUnit,
      location: data.fromWarehouse,
      fromLocation: data.fromWarehouse,
      toLocation: data.destination,
      status: 'Dispatched',
      timestamp: new Date().toISOString(),
      movementDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(),
      operator: data.carrier || (isAr ? 'سائق أسطول الشحن' : 'Freight Carrier'),
      referenceNo: data.soNumber
    };

    setTransactions(prev => {
      const updated = [newTx, ...prev];
      saveStoredTransactions(updated);
      return updated;
    });

    const newOutboundOrder = {
      id: `DO-${Date.now().toString().slice(-4)}`,
      soNumber: data.soNumber,
      customer: data.destination || (isAr ? 'عميل استلام' : 'Consignee Customer'),
      destination: data.destination,
      items: pName,
      qty: data.quantity,
      carrier: data.carrier || (isAr ? 'أسطول النقل الداخلي' : 'Fleet Carrier'),
      status: 'Dispatched'
    };
    saveStoredOutboundOrders([newOutboundOrder, ...getStoredOutboundOrders()]);
    showToast(isAr 
      ? `تم اعتماد إذن الصرف وشحن ${data.quantity} ${pUnit} إلى ${data.destination} بنجاح!` 
      : `Dispatched ${data.quantity} ${pUnit} to ${data.destination}!`);
  };

  const filteredTransactions = transactions.filter(t => 
    t.id.includes(searchTerm) ||
    t.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.fromLocation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.toLocation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dynamically compute warehouses with occupied and itemsCount from real products
  const computedWarehouses = useMemo(() => {
    return warehouses.map(w => {
      const whProducts = products.filter(p => p.warehouseId === w.id || p.warehouseName === w.nameAr || p.warehouseName === w.nameEn);
      const itemsCount = whProducts.length;
      const occupied = whProducts.reduce((sum, p) => sum + (Number(p.currentStock) || 0), 0);
      return {
        ...w,
        itemsCount,
        occupied
      };
    });
  }, [warehouses, products]);

  // Dynamic Valuation calculation from products
  const totalStockValuation = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.costPrice || 0) * Number(p.currentStock || 0)), 0);
  }, [products]);

  const formattedValuation = useMemo(() => {
    return formatMoney(totalStockValuation, true);
  }, [totalStockValuation, formatMoney]);

  // Dynamic Low stock alerts count
  const lowStockCount = useMemo(() => {
    return products.filter(p => Number(p.currentStock || 0) <= Number(p.minStockAlert || 0)).length;
  }, [products]);

  // Dynamic Shipments & Logistics counters
  const shipmentStats = useMemo(() => {
    const inboundPending = transactions.filter(t => t.type === 'Inbound' && t.status === 'Pending').length;
    const inboundReceived = transactions.filter(t => t.type === 'Inbound' && (t.status === 'Received' || t.status === 'Completed')).length;
    const outboundPicking = transactions.filter(t => t.type === 'Outbound' && (t.status === 'Picking' || t.status === 'Pending' || t.status === 'Ready for Dispatch')).length;
    const outboundShipped = transactions.filter(t => t.type === 'Outbound' && (t.status === 'Dispatched' || t.status === 'Completed' || t.status === 'Received')).length;
    return {
      inboundPending,
      inboundReceived,
      outboundPicking,
      outboundShipped
    };
  }, [transactions]);

  const totalNotifications = useMemo(() => {
    return (lowStockCount > 0 ? 1 : 0) + (shipmentStats.outboundPicking > 0 ? 1 : 0);
  }, [lowStockCount, shipmentStats.outboundPicking]);

  const handleAdjustStock = (productId: string, delta: number) => {
    let matchedName = 'صنف مخزني';
    let matchedSku = 'SKU';
    let matchedLocation = 'المستودع الرئيسي';
    let matchedUnit = isAr ? 'قطعة' : 'unit';

    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        matchedName = p.nameAr;
        matchedSku = p.sku;
        matchedLocation = p.warehouseName;
        matchedUnit = p.unit || (isAr ? 'قطعة' : 'unit');
        const updated = Math.max(0, p.currentStock + delta);
        return {
          ...p,
          currentStock: updated,
          status: updated <= 0 ? 'out_of_stock' : updated <= p.minStockAlert ? 'low' : 'available'
        };
      }
      return p;
    }));

    const newTx: TransactionDetail = {
      id: getNextTransactionId(),
      sku: matchedSku,
      productName: matchedName,
      type: 'Adjustment',
      qty: Math.abs(delta),
      unit: matchedUnit,
      location: matchedLocation,
      fromLocation: matchedLocation,
      toLocation: delta > 0 ? (isAr ? 'فائض تسوية جردية' : 'Surplus Adjustment') : (isAr ? 'عجز وتالف جردي' : 'Deficit / Waste Adjustment'),
      status: 'Received',
      timestamp: new Date().toISOString(),
      movementDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(),
      operator: isAr ? 'لجنة الجرد والمطابقة' : 'Audit Committee'
    };
    setTransactions(prev => {
      const updated = [newTx, ...prev];
      saveStoredTransactions(updated);
      return updated;
    });

    showToast(isAr ? `تم تعديل وحفظ رصيد الصنف بمقدار (${delta > 0 ? `+${delta}` : delta})` : `Stock adjusted & saved (${delta > 0 ? `+${delta}` : delta})`);
  };

  const handleBulkReconcileStock = (
    reconciledItems: { productId: string; newStock: number; delta: number; warehouseName: string; operatorName?: string }[]
  ) => {
    if (reconciledItems.length === 0) return;

    // 1. Update live products catalog with audited counted quantities
    setProducts(prev => {
      const stockMap = new Map(reconciledItems.map(r => [r.productId, r.newStock]));
      return prev.map(p => {
        if (stockMap.has(p.id)) {
          const updated = Math.max(0, stockMap.get(p.id)!);
          return {
            ...p,
            currentStock: updated,
            status: updated <= 0 ? 'out_of_stock' : updated <= p.minStockAlert ? 'low' : 'available'
          };
        }
        return p;
      });
    });

    // 2. Generate formal atomic stock adjustment journal records in transaction ledger
    const newTxs: TransactionDetail[] = reconciledItems.map((item, idx) => {
      const prod = products.find(p => p.id === item.productId);
      return {
        id: getNextTransactionId(idx),
        sku: prod?.sku || 'SKU',
        productName: prod?.nameAr || 'صنف مخزني',
        type: 'Adjustment',
        qty: Math.abs(item.delta),
        unit: prod?.unit || (isAr ? 'قطعة' : 'unit'),
        location: item.warehouseName || prod?.warehouseName || 'المستودع',
        fromLocation: item.warehouseName || prod?.warehouseName || 'المستودع',
        toLocation: item.delta > 0 ? (isAr ? 'فائض تسوية جردية معتمد' : 'Surplus Stock Adjustment') : (isAr ? 'عجز وتسوية جردية معتمدة' : 'Deficit Stock Adjustment'),
        status: 'Received',
        timestamp: new Date().toISOString(),
        movementDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        date: new Date().toISOString(),
        operator: item.operatorName || (isAr ? 'لجنة الجرد والمطابقة' : 'Audit Committee')
      };
    });

    setTransactions(prev => {
      const updated = [...newTxs, ...prev];
      saveStoredTransactions(updated);
      return updated;
    });
    showToast(isAr ? `تم اعتماد تسوية ${reconciledItems.length} صنف بنجاح وتحديث الأرصدة والقيود في النظام!` : `Successfully reconciled ${reconciledItems.length} items & updated stock!`);
  };

  // If no user is authenticated, render Public Routing (Landing Page, Pricing, Register, or Login)
  if (!currentUser) {
    if (publicRoute === 'login') {
      return (
        <LoginView 
          onLoginSuccess={handleLoginSuccess}
          lang={lang}
          onNavigateToHome={() => navigateToPublic('landing')}
        />
      );
    }

    if (publicRoute === 'pricing') {
      return (
        <PricingCalculatorView 
          onNavigateToRegister={(params) => navigateToPublic('register', params)}
          onNavigateToLogin={() => navigateToPublic('login')}
          onNavigateToHome={() => navigateToPublic('landing')}
          initialParams={registerParams || undefined}
        />
      );
    }

    if (publicRoute === 'register') {
      return (
        <SelfServiceRegisterView 
          initialConfig={registerParams || parseRegisterParamsFromUrl()}
          onNavigateToPricing={() => navigateToPublic('pricing')}
          onNavigateToLogin={() => navigateToPublic('login')}
          onNavigateToHome={() => navigateToPublic('landing')}
          onRegisterSuccess={handleLoginSuccess}
        />
      );
    }

    // Default route ('/' or 'landing')
    return (
      <LandingPageView 
        onNavigateToLogin={() => navigateToPublic('login')}
        onNavigateToRegister={(params) => navigateToPublic('register', params)}
        onNavigateToPricing={() => navigateToPublic('pricing')}
      />
    );
  }

  // 1. DUAL-LAYOUT ROUTE SHELL 1: SaaS Control Plane Isolation (PlatformSuperAdmin)
  // Completely isolated visually & architecturally from the store/POS/inventory system
  if (currentUser.role === 'PlatformSuperAdmin') {
    return (
      <SaasAdminLayout
        activeTab={saasAdminTab}
        onTabChange={setSaasAdminTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        lang={lang}
        onToggleLang={() => setLocale(lang === 'ar' ? 'en' : 'ar')}
        theme={effectiveTheme}
        onToggleTheme={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
      >
        {saasAdminTab === 'tenants' && (
          <TenantsManagementView 
            lang={lang} 
            onImpersonate={handleImpersonateTenant} 
          />
        )}
        {saasAdminTab === 'plans' && <PlansView lang={lang} />}
        {saasAdminTab === 'billing' && <BillingView lang={lang} />}
        {saasAdminTab === 'health' && <ServerHealthView lang={lang} />}
      </SaasAdminLayout>
    );
  }

  // 2. DUAL-LAYOUT ROUTE SHELL 2: Tenant Retail & ERP Store
  if (!permittedNav) {
    return null;
  }

  return (
    <div className={`logistock-app ${lang === 'ar' ? 'rtl-layout' : ''}`}>
      {/* Impersonation Banner */}
      {impersonatingSuperAdminProfile && (
        <div 
          style={{
            gridColumn: '1 / -1',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            padding: '0.5rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            fontWeight: 700,
            zIndex: 9999
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{isAr ? 'وضع الدخول كعميل لتقديم الدعم الفني (Impersonation Mode):' : 'Impersonation Mode (Tech Support):'}</span>
            <span style={{ backgroundColor: 'rgba(0,0,0,0.25)', padding: '2px 8px', borderRadius: '4px' }}>
              {currentUser.tenantName || currentUser.tenantSlug || 'مؤسسة مصطفى'} (@{currentUser.tenantSlug || 'm'})
            </span>
          </div>

          <button
            type="button"
            onClick={handleReturnToPlatformSuperAdmin}
            style={{
              backgroundColor: '#ffffff',
              color: '#0369a1',
              border: 'none',
              borderRadius: '6px',
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {isAr ? '← إنهاء الجلسة والعودة للوحة المالك' : '← Exit to SaaS Super Admin'}
          </button>
        </div>
      )}

      {/* Toast Banner */}
      {toastMessage && (
        <div className="toast-banner glass-panel">
          <CheckCircle2 size={18} className="green-text" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Unified Topbar Header - Merged Brand & Controls */}
      <header className="topbar bg-card text-foreground border-border">
        {/* Brand Section (Merged into Topbar, permanently fixed on scroll without @i tag) */}
        <div 
          className="topbar-brand" 
          onClick={() => setActiveNav('Dashboard')} 
          style={{ cursor: 'pointer' }}
          title={isAr ? 'العودة إلى لوحة القيادة' : 'Back to Dashboard'}
        >
          <div className="brand-cube-icon">
            <Boxes size={22} className="cube-svg" />
          </div>
          <span className="brand-name">
            Bontu <span className="brand-badge">Suite</span>
          </span>
        </div>

        <div className="topbar-divider" />

        <div className="topbar-title-block">
          <h1 className="page-title">
            {activeNav === 'Dashboard' 
              ? (isAr ? 'لوحة القيادة والمؤشرات الحية' : 'Live Dashboard & KPIs')
              : (NAV_TITLES[activeNav] ? (isAr ? NAV_TITLES[activeNav].ar : NAV_TITLES[activeNav].en) : activeNav)}
          </h1>
          <p className="page-subtitle">
            {isAr ? 'إدارة المستودعات، الشحنات، ونقاط البيع' : 'Warehouse, Freight & POS Management'}
          </p>
        </div>

          <div className="topbar-center">
            {/* Interactive Warehouse Dropdown */}
            <div className="dropdown-container">
              <div 
                className="dropdown-pill"
                onClick={() => toggleMenu('warehouse')}
              >
                <span>
                  {selectedWarehouseId === 'ALL'
                    ? (isAr ? 'جميع المستودعات والفروع' : 'All Warehouses & Branches')
                    : <span dir="auto">{localizeWarehouse(warehouses.find(w => w.id === selectedWarehouseId)?.nameAr || selectedWarehouseId, lang)}</span>}
                </span>
                <ChevronDown size={15} className="chevron-muted" />
              </div>

              {activeMenu === 'warehouse' && (
                <div className="dropdown-menu-floating glass-panel fade-in">
                  {warehouseFilterOptions.map((wh) => (
                    <div 
                      key={wh.id} 
                      className={`dropdown-menu-item ${selectedWarehouseId === wh.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedWarehouseId(wh.id);
                        saveStoredSelectedWarehouseId(wh.id);
                        closeMenu();
                        showToast(isAr 
                          ? `تم التصفية حسب: ${wh.id === 'ALL' ? 'جميع المستودعات والفروع' : wh.ar}` 
                          : `Filtered by: ${wh.id === 'ALL' ? 'All Warehouses & Branches' : wh.ar}`);
                      }}
                    >
                      {wh.id === 'ALL' ? (isAr ? wh.ar : wh.en) : <span dir="auto">{wh.ar}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input with [Q] shortcut */}
            <div className="search-bar-wrap" style={{ flex: 1, position: 'relative' }}>
              <input
                ref={searchInputRef}
                type="text"
                style={{ width: '100%', paddingInlineEnd: '42px' }}
                placeholder={isAr ? 'بحث سريع في النظام...' : 'Search system...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleBarcodeSearch(searchTerm);
                  }
                }}
              />
              <kbd className="search-shortcut-kbd">Q</kbd>
              <Search size={16} className="search-icon-inside" />
            </div>
          </div>

          <div className="topbar-controls">
            {/* Quick Theme Switcher Button */}
            <button 
              type="button"
              className="icon-btn-square" 
              onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
              title={isAr ? (effectiveTheme === 'dark' ? 'التحويل للوضع الفاتح' : 'التحويل للوضع الداكن') : (effectiveTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode')}
            >
              {effectiveTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Calendar Range Filter */}
            <div className="dropdown-container">
              <button 
                className="icon-btn-square" 
                onClick={() => toggleMenu('date')}
                title={isAr ? 'تصفية حسب الفترة الزمنية' : 'Date Range Filter'}
              >
                <Calendar size={18} />
              </button>

              {activeMenu === 'date' && (
                <div className="dropdown-menu-floating glass-panel fade-in" style={{ width: '180px' }}>
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <div 
                      key={opt.id} 
                      className={`dropdown-menu-item ${selectedDateRangeId === opt.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedDateRangeId(opt.id);
                        closeMenu();
                        showToast(isAr ? `الفترة الزمنية: ${opt.ar}` : `Date range: ${opt.en}`);
                      }}
                    >
                      {isAr ? opt.ar : opt.en}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Bell with Dynamic Live Alerts */}
            <div className="notification-bell-container">
              <button 
                className="bell-btn" 
                onClick={() => toggleMenu('notifications')}
                title={isAr ? 'التنبيهات والإشعارات' : 'Notifications'}
              >
                <Bell size={18} />
                {totalNotifications > 0 && (
                  <span className="bell-badge-count">{totalNotifications}</span>
                )}
              </button>

              {activeMenu === 'notifications' && (
                <div className="notification-popover glass-panel fade-in" style={{ minWidth: '260px' }}>
                  {totalNotifications > 0 ? (
                    <>
                      {lowStockCount > 0 && (
                        <div 
                          className="notif-line warning clickable" 
                          onClick={() => {
                            setActiveNav('Inventory & Items');
                            closeMenu();
                            showToast(isAr ? 'تم فتح الأصناف التي بحاجة لإعادة طلب' : 'Showing low stock items requiring reorder');
                          }}
                        >
                          <AlertTriangle size={14} className="icon-orange" />
                          <span>{isAr ? `تنبيهات نقص المخزون (${lowStockCount})` : `Low stock alerts (${lowStockCount})`}</span>
                        </div>
                      )}
                      {shipmentStats.outboundPicking > 0 && (
                        <div 
                          className="notif-line success clickable" 
                          onClick={() => {
                            setActiveNav('Outbound (Goods Out)');
                            closeMenu();
                            showToast(isAr ? 'تم فتح أوامر الشحن الجاهزة' : 'Showing ready dispatch alerts');
                          }}
                        >
                          <Send size={14} className="icon-green" />
                          <span>{isAr ? `أذونات الصرف قيد التجهيز (${shipmentStats.outboundPicking})` : `Pending dispatch alerts (${shipmentStats.outboundPicking})`}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <Bell size={18} style={{ color: '#94a3b8' }} />
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        {isAr ? 'لا توجد تنبيهات جديدة' : 'No new notifications'}
                      </span>
                      <small style={{ color: '#10b981', fontSize: '11px' }}>
                        {isAr ? 'المخزون متوازن والعمليات مكتملة' : 'Stock levels and operations are normal'}
                      </small>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clean UserNav Component (shadcn/ui style with strict tenant isolation) */}
            <UserNav
              user={currentUser}
              isAr={isAr}
              onNavigate={(route) => setActiveNav(route)}
              onLogout={handleLogout}
            />
          </div>
        </header>

        {/* Workspace Area: Fixed Sidebar + Scrollable Main Content */}
        <div className="app-workspace">
          <AppSidebar
            activeNav={activeNav}
            setActiveNav={setActiveNav}
            currentUser={currentUser}
            isOnline={isOnline}
            lang={lang}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
            onOpenSettings={() => setActiveNav('Settings')}
          />

          {/* Main Content Viewport */}
          <main className="main-content">
            {/* Dynamic Route Guard: Strict RBAC Permission Check */}
        {!isRouteAllowed(currentUser, activeNav) ? (
          <ForbiddenView
            requestedNav={NAV_TITLES[activeNav] ? (isAr ? NAV_TITLES[activeNav].ar : NAV_TITLES[activeNav].en) : activeNav}
            user={currentUser}
            onNavigateHome={() => {
              const safeNav = getRoleDefaultNav(currentUser.role);
              setActiveNav(safeNav);
            }}
            lang={lang}
          />
        ) : (
          <>
            {/* View 1: Main Dashboard */}
            {activeNav === 'Dashboard' && (
          <div className="dashboard-tab-content fade-in">
            {/* Dashboard Quick Operations Bar (Strict RTL Grouping - Zero Dead Space) */}
            <QuickOperationsBar
              onNewProduct={() => {
                setAddProductModalMode('new_product');
                setIsAddProductOpen(true);
              }}
              onPos={() => {
                setActiveNav('Cloud POS');
              }}
              onInboundReceipt={() => {
                setActiveNav('Purchases & POs');
              }}
              onQuickExpense={() => {
                setIsQuickExpenseOpen(true);
              }}
              onTransfer={() => setIsTransferModalOpen(true)}
              isAr={isAr}
            />

            {/* Row 1: 4 KPI Cards */}
            <div className="kpi-row">
              {/* KPI 1: SKU Varieties */}
              <div 
                className="kpi-card clickable" 
                onClick={() => setActiveNav('Inventory & Items')} 
                title={isAr ? 'عرض دليل الأصناف' : 'Click to view all SKU varieties'}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">{isAr ? 'أصناف الـ SKU المسجلة' : 'Total SKU Varieties'}</span>
                  <Package size={18} style={{ color: 'var(--muted-slate)' }} />
                </div>
                <div className="kpi-main-number">
                  {products.length.toLocaleString()} <span className="kpi-unit">{isAr ? 'صنف' : 'items'}</span>
                </div>
                <div className={`kpi-card-footer ${products.length > 0 ? 'green' : 'text-muted'}`}>
                  <span>{products.length > 0 ? (isAr ? `${products.length} صنف مسجل في الدليل` : `${products.length} registered items`) : (isAr ? 'الدليل صافٍ - جاهز لإدخال المواد' : 'Clean catalog - ready for items')}</span>
                </div>
              </div>

              {/* KPI 2: Total Inventory Value with Eye Toggle */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-card-title">{isAr ? 'إجمالي قيمة المخزون' : 'Total Inventory Value'}</span>
                  <button 
                    type="button" 
                    className="btn-toggle-eye" 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentUser.role === 'SuperAdmin' || currentUser.role === 'BranchManager' || currentUser.role === 'Accountant') {
                        setShowValuation(!showValuation);
                      } else {
                        showToast(isAr ? 'عذراً: عرض القيمة المالية محصور بالمدير العام والمحاسب' : 'Access Restricted: Valuation viewable by Managers & Accountants only');
                      }
                    }}
                    title={showValuation ? (isAr ? 'حجب القيمة المالية للحماية' : 'Hide financial value') : (isAr ? 'إظهار القيمة المالية' : 'Show financial value')}
                  >
                    {showValuation ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
                <div className="kpi-main-number">
                  {showValuation && (currentUser.role === 'SuperAdmin' || currentUser.role === 'BranchManager' || currentUser.role === 'Accountant') ? (
                    <>
                      {formattedValuation}
                    </>
                  ) : (
                    <span className="confidential-masked">
                      •••••••• <span className="confidential-tag">{isAr ? 'سري للغاية' : 'Confidential'}</span>
                    </span>
                  )}
                </div>
                <div className="kpi-card-footer text-muted">
                  <span>{isAr ? `تقييم المخزون المالي (${settings.costValuationMethod || 'FIFO'})` : `Financial Inventory Valuation (${settings.costValuationMethod || 'FIFO'})`}</span>
                </div>
              </div>

              {/* KPI 3: Daily Shipments (Inbound & Outbound) */}
              <div 
                className="kpi-card kpi-card-green clickable" 
                onClick={() => setActiveNav('Inbound (Goods In)')} 
                title={isAr ? 'عرض تفاصيل حركة الشحنات اليومية' : 'View daily inbound & outbound cargo'}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">{isAr ? 'حركة الشحنات اليومية' : 'Daily Shipments Flow'}</span>
                  <div className="kpi-signal-meter">
                    <span className={`sig-bar ${transactions.length > 0 ? 'active' : ''}`} style={{ backgroundColor: 'var(--chart-3)' }}></span>
                    <span className={`sig-bar ${transactions.length > 0 ? 'active' : ''}`} style={{ backgroundColor: 'var(--chart-3)' }}></span>
                    <span className={`sig-bar ${transactions.length > 0 ? 'active' : ''}`} style={{ backgroundColor: 'var(--chart-1)' }}></span>
                    <span className={`sig-bar ${transactions.length > 0 ? 'active' : ''}`} style={{ backgroundColor: 'var(--chart-1)' }}></span>
                  </div>
                </div>
                <div className="kpi-dual-shipments">
                  <div className="shipment-flow-row">
                    <span className="shipment-flow-label">
                      <ArrowDownToLine size={13} style={{ color: 'var(--chart-1)' }} />
                      <span>{isAr ? 'الوارد:' : 'Inbound:'}</span>
                    </span>
                    <span className="shipment-flow-values">
                      <span className="val-pending">{shipmentStats.inboundPending} {isAr ? 'معلق' : 'pending'}</span> / <span className="val-received">{shipmentStats.inboundReceived} {isAr ? 'مستلم' : 'rcvd'}</span>
                    </span>
                  </div>
                  <div className="shipment-flow-row">
                    <span className="shipment-flow-label">
                      <ArrowUpFromLine size={13} style={{ color: 'var(--chart-3)' }} />
                      <span>{isAr ? 'الصادر:' : 'Outbound:'}</span>
                    </span>
                    <span className="shipment-flow-values">
                      <span className="val-pending">{shipmentStats.outboundPicking} {isAr ? 'قيد التجهيز' : 'picking'}</span> / <span className="val-received">{shipmentStats.outboundShipped} {isAr ? 'تم شحنه' : 'shipped'}</span>
                    </span>
                  </div>
                </div>
                <div className="kpi-card-footer green">
                  <span>{isAr ? 'متابعة حركة الشحن والتسليم لحظياً' : 'Live freight & shipment dispatch'}</span>
                </div>
              </div>

              {/* KPI 4: Low Stock Alerts with Immediate Action Button */}
              <div 
                className="kpi-card kpi-card-orange clickable" 
                onClick={() => setActiveNav('Inventory & Items')} 
                title={isAr ? 'عرض الأصناف التي بحاجة لإعادة طلب' : 'View low stock items needing reorder'}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">{isAr ? 'تنبيهات نقص المخزون' : 'Low Stock Alerts'}</span>
                  <AlertTriangle size={18} className="kpi-alert-icon" />
                </div>
                <div className={`kpi-main-number ${lowStockCount > 0 ? 'orange-text' : ''}`}>
                  {lowStockCount} <span className={lowStockCount > 0 ? 'kpi-unit-orange' : 'kpi-unit'}>{isAr ? (lowStockCount > 0 ? 'صنف بحاجة لإعادة الطلب' : 'أصناف تحت حد الطلب') : 'items need reorder'}</span>
                </div>
                {lowStockCount > 0 ? (
                  <button 
                    type="button" 
                    className="kpi-direct-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveNav('Inventory & Items');
                      showToast(isAr ? 'تم فتح قائمة الأصناف التي بحاجة لإعادة طلب فوري' : 'Opening low stock items for replenishment');
                    }}
                  >
                    <ShoppingCart size={13} />
                    <span>{isAr ? 'عرض المواد وإصدار أمر شراء' : 'View Items & Issue PO'}</span>
                  </button>
                ) : (
                  <div className="kpi-card-footer text-muted" style={{ marginTop: '6px' }}>
                    <span style={{ fontSize: '11.5px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 500 }}>
                      <CheckCircle2 size={13} />
                      {isAr ? 'المخزون متوازن ضمن الحدود الآمنة' : 'Stock is balanced within safe thresholds'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Charts */}
            <div className="charts-row">
              <div className="chart-box left-chart">
                <WeeklyStockChart lang={lang} transactions={transactions} />
              </div>

              <div className="chart-box right-chart">
                <WarehouseCapacityBars 
                  lang={lang} 
                  warehouses={computedWarehouses}
                  inTransitShipmentsCount={0}
                  inTransitQty={0}
                  onNavigateWarehouses={() => setActiveNav('Warehouses & Racks')} 
                />
              </div>
            </div>

            {/* Row 3: Recent Stock Transactions Table (9 Mandatory Columns & 1-Click Copy ID) */}
            <RecentTransactionsTable
              transactions={filteredTransactions}
              products={products}
              lang={lang}
              onSelectTx={setSelectedTxForModal}
              showToast={showToast}
            />
          </div>
        )}

        {/* View 2: Inventory & Items */}
        {activeNav === 'Inventory & Items' && (
          <InventoryView
            products={products}
            lang={lang}
            canViewCostPrice={currentUser.canViewCostPrice}
            isReadOnly={currentUser.isReadOnlyCatalog}
            selectedWarehouseId={selectedWarehouseId}
            onSelectWarehouse={(whId) => setSelectedWarehouseId(whId)}
            onEditWarehouse={(whId) => setEditingWarehouseId(whId)}
            warehouses={warehouses}
            onOpenAddModal={(preselectedWhId) => {
              setAddProductModalMode('new_product');
              if (preselectedWhId) {
                setAddProductTargetWarehouse(preselectedWhId);
              } else if (selectedWarehouseId !== 'ALL') {
                setAddProductTargetWarehouse(selectedWarehouseId);
              }
              setIsAddProductOpen(true);
            }}
            onOpenProductDetails={(prod) => setSelectedProductForModal(prod)}
            onOpenQuickTransfer={(prod) => {
              setTransferInitialProductId(prod.id);
              setIsTransferModalOpen(true);
            }}
            onUpdateProducts={(updated) => {
              setProducts(updated);
              saveStoredProducts(updated);
            }}
            transactions={transactions}
          />
        )}

        {/* View 3: Transfers & In-Transit */}
        {activeNav === 'Transfers & In-Transit' && (
          <TransfersView 
            lang={lang} 
            products={products} 
            warehouses={warehouses}
            onUpdateProducts={(updated) => {
              setProducts(updated);
              saveStoredProducts(updated);
            }}
          />
        )}

        {/* View: Sales Invoices Register */}
        {(activeNav === 'Sales Invoices' || activeNav === 'Invoices & Billing') && (
          <SalesInvoicesView 
            invoices={invoices}
            products={products}
            lang={lang}
            onOpenCreateModal={() => setIsCreateInvoiceOpen(true)}
            onNavigateToCreate={() => setActiveNav('Create Invoice')}
            onOpenInvoiceDetails={(inv) => setSelectedInvoiceForModal(inv)}
          />
        )}

        {/* View: Create Invoice Screen */}
        {activeNav === 'Create Invoice' && (
          <CreateInvoiceView 
            products={products}
            warehouses={warehouses}
            lang={lang}
            currentUser={currentUser}
            onInvoiceCreated={(newInvoice) => {
              handleCreateInvoice(newInvoice);
              setActiveNav('Sales Invoices');
            }}
            onCancel={() => setActiveNav('Sales Invoices')}
          />
        )}

        {/* View: Installments Management (إدارة الأقساط وجدول الاستحقاقات) */}
        {activeNav === 'Installments' && (
          <InstallmentsView lang={lang} />
        )}

        {/* View 5: Cloud POS Terminal */}
        {activeNav === 'Cloud POS' && (
          <PosTerminalView 
            products={products}
            warehouses={warehouses}
            setProducts={setProducts}
            setTransactions={setTransactions}
            setInvoices={setInvoices}
            lang={lang} 
            currentUser={currentUser}
            onNavigateToShifts={() => setActiveNav('Shifts & Cash Drawer')}
          />
        )}

        {/* View 6: Shifts & Cash Drawer */}
        {activeNav === 'Shifts & Cash Drawer' && (
          <ShiftsView lang={lang} currentUser={currentUser} />
        )}

        {/* View 8: Returns & Warranty */}
        {activeNav === 'Returns & Warranty' && (
          <ReturnsWarrantyView lang={lang} />
        )}

        {/* View 9: Delivery & Logistics */}
        {activeNav === 'Delivery & Logistics' && (
          <DeliveryLogisticsView lang={lang} />
        )}

        {/* View 10: Incoming Purchase Invoices (فواتير الشراء الواردة وتوريد المخزون) */}
        {activeNav === 'Purchases & POs' && (
          <IncomingPurchasesView 
            lang={lang} 
            products={products}
            setProducts={setProducts}
            warehouses={warehouses}
            setTransactions={setTransactions}
            prefillFromPO={poToReceivePrefill}
            onClearPrefill={() => setPoToReceivePrefill(null)}
          />
        )}

        {/* View 10.2: Scheduled Purchase Orders (أوامر الشراء المجدولة) */}
        {activeNav === 'Purchase Orders' && (
          <PurchaseOrdersView 
            lang={lang} 
            products={products}
            warehouses={warehouses}
            onConvertToInvoice={(po) => {
              const convertedItems = (po.items || []).map((it, idx) => ({
                id: `PI-${Date.now()}-${idx + 1}`,
                productId: it.productId,
                sku: it.sku,
                barcode: it.barcode || '',
                nameAr: it.nameAr,
                nameEn: it.nameEn || it.nameAr,
                uom: it.uom || 'قطعة',
                quantity: it.quantity || 1,
                unitCost: it.estimatedUnitCost || 0,
                currentSellingPrice: 0,
                newSellingPrice: Math.round((it.estimatedUnitCost || 0) * 1.3),
                lineTotal: it.lineTotal || 0,
                isNewProduct: false
              }));

              setPoToReceivePrefill({
                supplierId: po.supplierId,
                supplierName: po.supplierName,
                supplierRefNo: po.poNumber,
                destinationWarehouseId: po.targetWarehouseId,
                items: convertedItems,
                notes: `توريد واستلام بضاعة أمر الشراء ${po.poNumber}`,
                sourcePoId: po.id,
                sourcePoNumber: po.poNumber
              });
              setActiveNav('Purchases & POs');
            }}
          />
        )}

        {/* View 11: Customers & Loyalty */}
        {activeNav === 'Customers & Loyalty' && (
          <CustomersLoyaltyView lang={lang} />
        )}

        {/* View 12: Finance & Treasury */}
        {(activeNav === 'Finance & Treasury' || activeNav === 'Finance Vouchers') && (
          <FinanceTreasuryView 
            lang={lang} 
            initialTab={activeNav === 'Finance Vouchers' ? 'VOUCHERS' : 'ACCOUNTS'}
          />
        )}

        {/* View: Warehouses & Racks */}
        {activeNav === 'Warehouses & Racks' && (
          <WarehousesRacksView 
            lang={lang} 
            warehouses={warehouses}
            products={products}
            selectedWarehouseId={selectedWarehouseId}
            onSelectWarehouse={(whId) => setSelectedWarehouseId(whId)}
            onNavigateToInventory={(whId) => {
              setSelectedWarehouseId(whId);
              setActiveNav('Inventory & Items');
            }}
            onAddWarehouse={handleCreateWarehouse}
            onUpdateWarehouse={handleUpdateWarehouse}
            onDeleteWarehouse={handleDeleteWarehouse}
            onOpenAddGoods={(mode, whId) => {
              if (mode === 'restock') {
                setActiveNav('Purchases & POs');
              } else {
                setAddProductModalMode(mode);
                setAddProductTargetWarehouse(whId);
                setIsAddProductOpen(true);
              }
            }}
          />
        )}

        {/* View: Inbound Goods In */}
        {activeNav === 'Inbound (Goods In)' && (
          <InboundView 
            lang={lang} 
            onReceiveShipment={(id) => showToast(isAr ? `تم فحص واستلام الشحنة ${id} وترحيلها للأرصدة بنجاح!` : `Shipment ${id} inspected & received into inventory!`)} 
            onOpenNewInbound={() => {
              setActiveNav('Purchases & POs');
            }}
          />
        )}

        {/* View: Outbound Goods Out */}
        {activeNav === 'Outbound (Goods Out)' && (
          <OutboundView 
            lang={lang} 
            onDispatchOrder={(id) => showToast(lang === 'ar' ? `تم اعتماد وصرف الطلبية ${id} بنجاح!` : `Order ${id} packaged & dispatched!`)} 
            onOpenNewDispatch={() => setIsDispatchModalOpen(true)}
            onNavigateToDispatchQueue={() => setActiveNav('Dispatch Queue')}
          />
        )}

        {/* View: Warehouse Dispatch Queue (طابور مهام أمين المخزن للصرف والتسليم) */}
        {(activeNav === 'Dispatch Queue' || activeNav === 'Warehouse Dispatch Queue' || activeNav === '/warehouse/dispatch-queue') && (
          <WarehouseDispatchQueueView 
            lang={lang}
            currentUser={currentUser}
            warehouses={warehouses}
            setProducts={setProducts}
            setTransactions={setTransactions}
            setInvoices={setInvoices}
            showToast={showToast}
          />
        )}

        {/* View 4: Stock Counts */}
        {activeNav === 'Stock Counts' && (
          <StockCountsView 
            lang={lang} 
            products={products}
            warehouses={warehouses}
            onBulkReconcileStock={handleBulkReconcileStock}
            currentUser={currentUser}
          />
        )}

        {/* View: Suppliers */}
        {activeNav === 'Suppliers' && (
          <SuppliersView lang={lang} />
        )}

        {/* View 13: Reports */}
        {activeNav === 'Reports' && (
          <ReportsView 
            lang={lang} 
            onOpenAiAssistant={() => setIsCopilotOpen(true)}
            tenantPlan={currentUser?.plan as any}
          />
        )}

        {/* View: Users & Staff Management (Manager / Admin RBAC) */}
        {activeNav === 'Users & Staff' && (
          <UsersStaffView 
            currentUser={currentUser}
            lang={lang}
            showToast={showToast}
          />
        )}

        {/* View 14: Settings */}
        {activeNav === 'Settings' && (
          <SettingsView lang={lang} warehouses={warehouses} />
        )}
      </>
    )}
  </main>
</div>


      {/* Transaction Details Modal */}
      <TransactionModal
        transaction={selectedTxForModal}
        onClose={() => setSelectedTxForModal(null)}
        lang={lang}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        initialBarcode={scannerInitialBarcode}
        lang={lang}
        onAdjustStock={handleAdjustStock}
        onOpenAdjustment={(prod) => {
          setIsScannerOpen(false);
          setAdjustingProductForModal(prod);
        }}
      />

      {/* Product Details & Printable Barcode Modal */}
      <ProductDetailsModal
        product={selectedProductForModal}
        isOpen={selectedProductForModal !== null}
        onClose={() => setSelectedProductForModal(null)}
        lang={lang}
        onAdjustStock={handleAdjustStock}
        onOpenAdjustment={(prod) => {
          setSelectedProductForModal(null);
          setAdjustingProductForModal(prod);
        }}
      />

      {/* Certified Stock Adjustment Modal (Audit Compliant) */}
      <StockAdjustmentModal
        product={adjustingProductForModal}
        isOpen={adjustingProductForModal !== null}
        onClose={() => setAdjustingProductForModal(null)}
        warehouses={warehouses}
        lang={lang}
        onAdjustmentSuccess={(updatedProduct) => {
          setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
          setAdjustingProductForModal(null);
        }}
      />

      {/* Invoice Details & Printable A4 Tax Modal */}
      <InvoiceDetailsModal
        invoice={selectedInvoiceForModal}
        isOpen={selectedInvoiceForModal !== null}
        onClose={() => setSelectedInvoiceForModal(null)}
        lang={lang}
      />

      {/* Create Sales Invoice Modal */}
      <CreateInvoiceModal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        products={products}
        warehouses={warehouses}
        lang={lang}
        onCreateInvoice={handleCreateInvoice}
      />

      {/* Inter-Warehouse Transfer Modal */}
      <InterWarehouseTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferInitialProductId(undefined);
        }}
        products={products}
        lang={lang}
        initialProductId={transferInitialProductId}
        onTransfer={handleTransferStock}
      />

      {/* Outbound Dispatch Modal */}
      <OutboundDispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        products={products}
        lang={lang}
        onDispatch={handleOutboundDispatch}
      />

      {/* Add Product & Inbound Goods Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        warehouses={warehouses}
        products={products}
        lang={lang}
        initialMode={addProductModalMode}
        initialWarehouseId={addProductTargetWarehouse}
        onAddProduct={(newProd) => {
          setProducts(prev => {
            const updated = [newProd, ...prev];
            saveStoredProducts(updated);
            return updated;
          });
          const newTx: TransactionDetail = {
            id: getNextTransactionId(),
            sku: newProd.sku,
            productName: newProd.nameAr,
            type: 'Inbound',
            qty: newProd.currentStock,
            unit: newProd.unit || (isAr ? 'قطعة' : 'unit'),
            location: newProd.warehouseName,
            fromLocation: isAr ? 'مورد معتمد' : 'Authorized Supplier',
            toLocation: newProd.warehouseName,
            status: 'Received',
            timestamp: new Date().toISOString(),
            movementDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            date: new Date().toISOString(),
            operator: isAr ? 'مسؤول الاستلام' : 'Receiver Officer'
          };
          setTransactions(prev => {
            const updated = [newTx, ...prev];
            saveStoredTransactions(updated);
            return updated;
          });
          showToast(lang === 'ar' ? `تم تسجيل وحفظ الصنف (${newProd.nameAr}) في النظام بنجاح!` : `Saved ${newProd.nameAr} to inventory!`);
        }}
        onRestockProduct={handleRestockProduct}
      />
      {/* Gemini AI Copilot Modal */}
      <GeminiCopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        products={products}
        invoices={invoices}
        lang={lang}
        plan={currentUser?.plan as any}
        companyName={currentUser?.tenantName}
      />

      {/* Global Edit Warehouse Modal */}
      {editingWarehouse && (
        <EditWarehouseModal
          lang={lang}
          warehouse={editingWarehouse}
          isOpen={!!editingWarehouse}
          onClose={() => setEditingWarehouseId(null)}
          onUpdateWarehouse={(id, updates) => {
            handleUpdateWarehouse(id, updates);
            setEditingWarehouseId(null);
          }}
        />
      )}

      {/* Quick Expense Modal */}
      <QuickExpenseModal
        isOpen={isQuickExpenseOpen}
        onClose={() => setIsQuickExpenseOpen(false)}
        lang={lang}
        onExpenseRecorded={() => {
          showToast(isAr ? 'تم قيد المصروف النثري بنجاح وخصمه من الخزينة' : 'Expense recorded and deducted from cash drawer');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ErrorBoundary>
        <DashboardApp />
      </ErrorBoundary>
      <Toaster position="top-center" richColors closeButton />
    </SettingsProvider>
  );
}
