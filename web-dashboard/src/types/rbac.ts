export type UserRole = 
  | 'PlatformSuperAdmin'
  | 'SuperAdmin' 
  | 'BranchManager' 
  | 'Accountant' 
  | 'Storekeeper' 
  | 'Cashier';

export type PermissionKey =
  | 'saas.control_plane'
  | 'saas.tenants.manage'
  | 'saas.plans.view'
  | 'saas.billing.view'
  | 'saas.health.view'
  | 'dashboard.view'
  | 'inventory.view'
  | 'inventory.manage'
  | 'inventory.cost_price.view'
  | 'transfers.manage'
  | 'stock_counts.manage'
  | 'pos.terminal.access'
  | 'shifts.manage'
  | 'invoices.manage'
  | 'returns.manage'
  | 'logistics.dispatch'
  | 'purchases.manage'
  | 'customers.manage'
  | 'finance.ledger'
  | 'reports.executive'
  | 'settings.audit';

export type BusinessPreset = 
  | 'Custom' 
  | 'Grocery' 
  | 'Electronics' 
  | 'Fashion' 
  | 'Hardware' 
  | 'Wholesale';

export interface CompanyFeatures {
  enablePOS: boolean;
  multiWarehouse: boolean;
  maxWarehouses: number;
  enableInstallments: boolean;
  enableSerialNumbers: boolean;
  enableVariants: boolean;
  enableMultiCurrency: boolean;
  enableCreditLimits: boolean;
  enableBarcodeScales: boolean;
  enableExpiryDates: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  roleNameAr: string;
  roleNameEn: string;
  branchId: string;
  branchName: string;
  defaultWarehouseId?: string;
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  plan?: string;
  businessPreset?: BusinessPreset;
  businessPresetName?: string;
  features?: CompanyFeatures;
  assignedBranches?: string[];
  permissions: PermissionKey[];
  defaultRoute: string;
  canViewCostPrice: boolean;
  isReadOnlyCatalog: boolean;
  avatarUrl?: string;
  avatarId?: string;
  preferredLanguage?: 'ar' | 'en' | 'ku';
}

export const SYSTEM_ROLES_CONFIG: Record<UserRole, UserProfile> = {
  Cashier: {
    id: 'USR-CASH-01',
    username: 'cashier',
    fullName: 'حسين ميثم (كاشير الفرع)',
    email: 'cashier@zilox-suite.com',
    role: 'Cashier',
    roleNameAr: 'الكاشير وموظف البيع',
    roleNameEn: 'Cashier & Sales Rep',
    branchId: 'WH-01',
    branchName: 'صالة المبيعات',
    defaultRoute: 'Cloud POS',
    canViewCostPrice: false,
    isReadOnlyCatalog: true,
    permissions: [
      'pos.terminal.access',
      'shifts.manage',
      'invoices.manage',
      'returns.manage',
      'inventory.view'
    ]
  },

  Storekeeper: {
    id: 'USR-STORE-01',
    username: 'storekeeper',
    fullName: 'عمار جاسم (أمين المستودع)',
    email: 'warehouse@zilox-suite.com',
    role: 'Storekeeper',
    roleNameAr: 'أمين المخزن',
    roleNameEn: 'Warehouse Storekeeper',
    branchId: 'WH-01',
    branchName: 'المستودع الرئيسي',
    defaultRoute: 'Inventory & Items',
    canViewCostPrice: false,
    isReadOnlyCatalog: false,
    permissions: [
      'inventory.view',
      'inventory.manage',
      'transfers.manage',
      'stock_counts.manage',
      'logistics.dispatch',
      'purchases.manage'
    ]
  },

  Accountant: {
    id: 'USR-ACC-01',
    username: 'accountant.chief',
    fullName: 'ضرغام خليل (المحاسب المالي)',
    email: 'finance@zilox-suite.com',
    role: 'Accountant',
    roleNameAr: 'المحاسب المالي',
    roleNameEn: 'Chief Accountant',
    branchId: 'WH-01',
    branchName: 'الإدارة المالية المركزية',
    defaultRoute: 'Finance & Treasury',
    canViewCostPrice: true,
    isReadOnlyCatalog: true,
    permissions: [
      'finance.ledger',
      'customers.manage',
      'reports.executive',
      'invoices.manage',
      'shifts.manage',
      'inventory.cost_price.view'
    ]
  },

  BranchManager: {
    id: 'USR-MGR-01',
    username: 'manager',
    fullName: 'مدير الفرع',
    email: 'manager@zilox-suite.com',
    role: 'BranchManager',
    roleNameAr: 'مدير الفرع / المشرف',
    roleNameEn: 'Branch Manager',
    branchId: 'WH-01',
    branchName: 'إدارة الفرع',
    defaultRoute: 'Dashboard',
    canViewCostPrice: true,
    isReadOnlyCatalog: false,
    permissions: [
      'dashboard.view',
      'pos.terminal.access',
      'shifts.manage',
      'invoices.manage',
      'returns.manage',
      'inventory.view',
      'inventory.manage',
      'transfers.manage',
      'reports.executive',
      'inventory.cost_price.view',
      'settings.audit'
    ]
  },

  PlatformSuperAdmin: {
    id: 'USR-PLATFORM-01',
    username: 'superadmin',
    fullName: 'المدير العام للمنصة (SaaS Platform Owner)',
    email: 'owner@zilox.cloud',
    role: 'PlatformSuperAdmin',
    roleNameAr: 'مالك المنصة (SaaS Super Admin)',
    roleNameEn: 'Platform Super Admin',
    branchId: 'PLATFORM',
    branchName: 'SaaS Platform Control Plane',
    defaultRoute: 'SuperAdminTenants',
    canViewCostPrice: false,
    isReadOnlyCatalog: true,
    permissions: [
      'saas.control_plane',
      'saas.tenants.manage',
      'saas.plans.view',
      'saas.billing.view',
      'saas.health.view'
    ]
  },

  SuperAdmin: {
    id: 'USR-ADMIN-01',
    username: 'admin',
    fullName: 'مدير المنشأة',
    email: 'admin@zilox-suite.com',
    role: 'SuperAdmin',
    roleNameAr: 'المدير العام',
    roleNameEn: 'Super Admin (Owner)',
    branchId: 'ALL',
    branchName: 'كافة الفروع والمستودعات',
    defaultRoute: 'Dashboard',
    canViewCostPrice: true,
    isReadOnlyCatalog: false,
    permissions: [
      'dashboard.view',
      'inventory.view',
      'inventory.manage',
      'inventory.cost_price.view',
      'transfers.manage',
      'stock_counts.manage',
      'pos.terminal.access',
      'shifts.manage',
      'invoices.manage',
      'returns.manage',
      'logistics.dispatch',
      'purchases.manage',
      'customers.manage',
      'finance.ledger',
      'reports.executive',
      'settings.audit'
    ]
  }
};

export interface UserAccount {
  id: string;
  fullName: string;
  username: string;
  password?: string;
  email: string;
  phone?: string;
  role: UserRole;
  branchId: string;
  branchName: string;
  defaultWarehouseId?: string;
  assignedBranches?: string[];
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  notes?: string;
  permissions?: string[];
  avatarUrl?: string;
  avatarId?: string;
  preferredLanguage?: 'ar' | 'en' | 'ku';
}

export const DEFAULT_USER_ACCOUNTS: UserAccount[] = [];

export function buildUserProfileFromAccount(account: UserAccount): UserProfile {
  const baseConfig = SYSTEM_ROLES_CONFIG[account.role] || SYSTEM_ROLES_CONFIG.Cashier;
  const effectivePermissions = (account.permissions && account.permissions.length > 0)
    ? (account.permissions as any[])
    : baseConfig.permissions;

  const canViewCostPrice = effectivePermissions.includes('inventory.cost_price.view') || 
                           account.role === 'SuperAdmin' || 
                           account.role === 'BranchManager' || 
                           account.role === 'Accountant';

  const isReadOnlyCatalog = account.role === 'Cashier' && 
                            !effectivePermissions.includes('inventory.items.create') && 
                            !effectivePermissions.includes('inventory.manage');

  return {
    ...baseConfig,
    id: account.id,
    username: account.username,
    fullName: account.fullName,
    email: account.email,
    role: account.role,
    branchId: account.branchId,
    branchName: account.branchName,
    defaultWarehouseId: account.defaultWarehouseId || account.branchId,
    tenantId: account.tenantId,
    tenantSlug: account.tenantSlug,
    tenantName: account.tenantName,
    avatarUrl: account.avatarUrl,
    avatarId: account.avatarId,
    assignedBranches: account.assignedBranches || (account.branchId === 'ALL' ? ['WH-01', 'WH-02', 'WH-03'] : [account.branchId]),
    permissions: effectivePermissions,
    canViewCostPrice,
    isReadOnlyCatalog
  };
}


