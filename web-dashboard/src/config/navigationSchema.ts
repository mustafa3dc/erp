import { UserProfile, PermissionKey, CompanyFeatures } from '../types/rbac';

export interface NavItemDef {
  id: string;
  titleAr: string;
  titleEn: string;
  path: string;
  requiredPermission: PermissionKey;
  requiredFeature?: keyof CompanyFeatures;
  badge?: string;
  badgeEn?: string;
  badgeClass?: string;
}

export interface NavGroupDef {
  key: string;
  titleAr: string;
  titleEn: string;
  iconName: 'Zap' | 'ShoppingCart' | 'ShoppingBag' | 'Package' | 'Box' | 'Wallet' | 'Settings';
  requiredFeature?: keyof CompanyFeatures;
  items: NavItemDef[];
}

export const MAIN_DASHBOARD_ITEM: NavItemDef = {
  id: 'Dashboard',
  titleAr: 'لوحة القيادة والمؤشرات',
  titleEn: 'Dashboard & Live KPIs',
  path: '/dashboard',
  requiredPermission: 'dashboard.view'
};

export function isFeatureAllowed(
  features?: CompanyFeatures, 
  requiredFeature?: keyof CompanyFeatures
): boolean {
  if (!requiredFeature) return true;
  if (!features) return true;
  return features[requiredFeature] !== false;
}

export const NAVIGATION_GROUPS: NavGroupDef[] = [
  // [1] قسم: نقاط البيع
  {
    key: 'pos',
    titleAr: 'نقاط البيع',
    titleEn: 'Point of Sale',
    iconName: 'Zap',
    requiredFeature: 'enablePOS',
    items: [
      {
        id: 'Cloud POS',
        titleAr: 'شاشة البيع',
        titleEn: 'POS Screen',
        path: '/pos',
        requiredPermission: 'pos.terminal.access',
        requiredFeature: 'enablePOS',
      },
      {
        id: 'Shifts & Cash Drawer',
        titleAr: 'الورديات',
        titleEn: 'Shifts',
        path: '/shifts',
        requiredPermission: 'shifts.manage',
        requiredFeature: 'enablePOS',
      }
    ]
  },

  // [2] قسم: المبيعات
  {
    key: 'sales',
    titleAr: 'المبيعات',
    titleEn: 'Sales',
    iconName: 'ShoppingCart',
    items: [
      {
        id: 'Sales Invoices',
        titleAr: 'فواتير المبيعات',
        titleEn: 'Sales Invoices',
        path: '/invoices',
        requiredPermission: 'invoices.manage'
      },
      {
        id: 'Installments',
        titleAr: 'إدارة الأقساط',
        titleEn: 'Installments',
        path: '/sales/installments',
        requiredPermission: 'invoices.manage',
        requiredFeature: 'enableInstallments',
      },
      {
        id: 'Returns & Warranty',
        titleAr: 'المرتجعات',
        titleEn: 'Returns',
        path: '/returns',
        requiredPermission: 'returns.manage'
      },
      {
        id: 'Customers & Loyalty',
        titleAr: 'العملاء',
        titleEn: 'Customers',
        path: '/customers',
        requiredPermission: 'customers.manage'
      }
    ]
  },

  // [3] قسم: المشتريات
  {
    key: 'purchases',
    titleAr: 'المشتريات',
    titleEn: 'Purchases',
    iconName: 'Package',
    items: [
      {
        id: 'Purchases & POs',
        titleAr: 'فواتير المشتريات',
        titleEn: 'Purchase Bills',
        path: '/purchases',
        requiredPermission: 'purchases.manage'
      },
      {
        id: 'Purchase Orders',
        titleAr: 'أوامر الشراء',
        titleEn: 'Purchase Orders',
        path: '/purchases/orders',
        requiredPermission: 'purchases.manage'
      },
      {
        id: 'Suppliers',
        titleAr: 'الموردون',
        titleEn: 'Suppliers',
        path: '/suppliers',
        requiredPermission: 'purchases.manage'
      }
    ]
  },

  // [4] قسم: المخزون
  {
    key: 'warehouse',
    titleAr: 'المخزون',
    titleEn: 'Inventory',
    iconName: 'Box',
    items: [
      {
        id: 'Inventory & Items',
        titleAr: 'المنتجات',
        titleEn: 'Products',
        path: '/items',
        requiredPermission: 'inventory.view'
      },
      {
        id: 'Transfers & In-Transit',
        titleAr: 'المناقلات المخزنية',
        titleEn: 'Stock Transfers',
        path: '/transfers',
        requiredPermission: 'transfers.manage',
        requiredFeature: 'multiWarehouse',
      },
      {
        id: 'Stock Counts',
        titleAr: 'الجرد والتسويات',
        titleEn: 'Audits & Adjustments',
        path: '/stock-counts',
        requiredPermission: 'stock_counts.manage'
      },
      {
        id: 'Warehouses & Racks',
        titleAr: 'المستودعات والرفوف',
        titleEn: 'Warehouses & Racks',
        path: '/warehouses',
        requiredPermission: 'inventory.manage',
        requiredFeature: 'multiWarehouse',
      },
      {
        id: 'Dispatch Queue',
        titleAr: 'أوامر التجهيز والصرف',
        titleEn: 'Dispatch Orders',
        path: '/warehouse/dispatch-queue',
        requiredPermission: 'inventory.view',
        requiredFeature: 'multiWarehouse',
      }
    ]
  },

  // [5] قسم: الخزينة والمالية
  {
    key: 'finance',
    titleAr: 'الخزينة والمالية',
    titleEn: 'Treasury & Finance',
    iconName: 'Wallet',
    items: [
      {
        id: 'Finance & Treasury',
        titleAr: 'الصناديق والبنوك',
        titleEn: 'Cash & Banks',
        path: '/finance',
        requiredPermission: 'finance.ledger'
      },
      {
        id: 'Finance Vouchers',
        titleAr: 'سندات القبض والصرف',
        titleEn: 'Receipt & Payment Vouchers',
        path: '/finance/vouchers',
        requiredPermission: 'finance.ledger'
      }
    ]
  },

  // [6] قسم: الإدارة والتقارير
  {
    key: 'system',
    titleAr: 'الإدارة والتقارير',
    titleEn: 'Administration & Reports',
    iconName: 'Settings',
    items: [
      {
        id: 'Reports',
        titleAr: 'التقارير',
        titleEn: 'Reports',
        path: '/reports',
        requiredPermission: 'reports.executive'
      },
      {
        id: 'Users & Staff',
        titleAr: 'المستخدمون والصلاحيات',
        titleEn: 'Users & Permissions',
        path: '/users-staff',
        requiredPermission: 'settings.audit',
        badge: 'أمان',
        badgeEn: 'Security',
        badgeClass: 'accent'
      },
      {
        id: 'Settings',
        titleAr: 'الإعدادات العامة',
        titleEn: 'General Settings',
        path: '/settings',
        requiredPermission: 'settings.audit'
      }
    ]
  }
];

export function checkUserHasPermission(permissions: string[], required: string): boolean {
  if (!required) return true;
  const set = new Set(permissions.map(p => p.toLowerCase().trim()));
  const target = required.toLowerCase().trim();

  if (set.has(target) || set.has('*') || set.has('all')) return true;

  switch (target) {
    case 'pos.terminal.access':
    case 'pos.terminal':
      return set.has('pos.terminal.access') || set.has('pos.terminal');
    case 'shifts.manage':
    case 'pos.shifts.manage':
      return set.has('pos.shifts.manage') || set.has('shifts.manage');
    case 'invoices.manage':
      return set.has('sales.invoices.view') || set.has('sales.invoices.create') || set.has('invoices.manage');
    case 'sales.invoices.view':
    case 'sales.invoices.create':
      return set.has('sales.invoices.view') || set.has('sales.invoices.create') || set.has('invoices.manage');
    case 'returns.manage':
    case 'sales.returns.manage':
      return set.has('sales.returns.manage') || set.has('returns.manage');
    case 'customers.manage':
    case 'sales.customers.manage':
      return set.has('sales.customers.manage') || set.has('customers.manage');
    case 'purchases.manage':
    case 'purchases.bills.view':
    case 'purchases.bills.create':
      return set.has('purchases.bills.view') || set.has('purchases.bills.create') || set.has('purchases.manage');
    case 'inventory.view':
    case 'inventory.items.view':
      return set.has('inventory.items.view') || set.has('inventory.view');
    case 'inventory.manage':
    case 'inventory.items.create':
    case 'inventory.items.edit':
    case 'inventory.items.delete':
      return set.has('inventory.items.create') || set.has('inventory.items.edit') || set.has('inventory.items.delete') || set.has('inventory.manage');
    case 'transfers.manage':
    case 'inventory.transfers.manage':
      return set.has('inventory.transfers.manage') || set.has('transfers.manage') || set.has('logistics.dispatch');
    case 'stock_counts.manage':
    case 'inventory.stock_counts.manage':
      return set.has('inventory.stock_counts.manage') || set.has('stock_counts.manage');
    case 'finance.ledger':
    case 'treasury.accounts.view':
      return set.has('treasury.accounts.view') || set.has('finance.ledger');
    case 'reports.executive':
    case 'reports.executive.view':
      return set.has('reports.executive.view') || set.has('reports.executive');
    case 'dashboard.view':
    case 'system.dashboard.view':
      return set.has('system.dashboard.view') || set.has('dashboard.view');
    case 'settings.audit':
    case 'system.audit.view':
      return set.has('system.audit.view') || set.has('settings.audit') || set.has('system.users.manage');
    default:
      return false;
  }
}

export function isRouteAllowed(user: UserProfile, routeId: string): boolean {
  if (user.role === 'PlatformSuperAdmin') return true;

  // Tenant Feature Flags Guard
  if (user.features) {
    if ((routeId === 'Cloud POS' || routeId === 'POS Terminal' || routeId === '/pos' || routeId === 'Shifts & Cash Drawer' || routeId === '/shifts') && user.features.enablePOS === false) {
      return false;
    }
    if ((routeId === 'Installments' || routeId === '/sales/installments') && user.features.enableInstallments === false) {
      return false;
    }
    if ((routeId === 'Transfers & In-Transit' || routeId === '/transfers' || routeId === 'Warehouses & Racks' || routeId === '/warehouses' || routeId === 'Dispatch Queue' || routeId === '/warehouse/dispatch-queue') && user.features.multiWarehouse === false) {
      return false;
    }
  }

  if (user.role === 'SuperAdmin') return true;

  if (routeId === 'Dashboard') {
    return checkUserHasPermission(user.permissions, 'dashboard.view');
  }

  if (routeId === 'Cloud POS' || routeId === 'POS Terminal' || routeId === '/pos') {
    return checkUserHasPermission(user.permissions, 'pos.terminal.access');
  }

  // Find the item in all groups
  for (const group of NAVIGATION_GROUPS) {
    const item = group.items.find(i => i.id === routeId);
    if (item) {
      return checkUserHasPermission(user.permissions, item.requiredPermission);
    }
  }

  // Supporting views & aliases
  if (routeId === 'Sales Invoices' || routeId === 'Create Invoice' || routeId === 'Invoices & Billing') {
    return checkUserHasPermission(user.permissions, 'invoices.manage');
  }

  if (routeId === 'Warehouses & Racks' || routeId === 'Inbound (Goods In)' || routeId === 'Outbound (Goods Out)' || routeId === 'Dispatch Queue') {
    return checkUserHasPermission(user.permissions, 'inventory.view') || checkUserHasPermission(user.permissions, 'inventory.manage') || checkUserHasPermission(user.permissions, 'transfers.manage');
  }

  if (routeId === 'Suppliers' || routeId === 'Purchase Orders') {
    return checkUserHasPermission(user.permissions, 'purchases.manage');
  }

  if (routeId === 'Finance Vouchers') {
    return checkUserHasPermission(user.permissions, 'finance.ledger');
  }

  return false;
}

export function getPermittedNavigation(user: UserProfile) {
  const isPlatformSuper = user.role === 'PlatformSuperAdmin';
  const isSuper = user.role === 'SuperAdmin' || isPlatformSuper;
  const isDashboardAllowed = isSuper || checkUserHasPermission(user.permissions, MAIN_DASHBOARD_ITEM.requiredPermission);

  const permittedGroups = NAVIGATION_GROUPS
    .filter(group => isPlatformSuper || isFeatureAllowed(user.features, group.requiredFeature))
    .map(group => {
      const permittedItems = group.items.filter(item => {
        const featureOk = isPlatformSuper || isFeatureAllowed(user.features, item.requiredFeature);
        if (!featureOk) return false;
        return isSuper || checkUserHasPermission(user.permissions, item.requiredPermission);
      });
      return {
        ...group,
        items: permittedItems
      };
    })
    .filter(group => group.items.length > 0);

  return {
    isDashboardAllowed,
    dashboardItem: MAIN_DASHBOARD_ITEM,
    groups: permittedGroups
  };
}

