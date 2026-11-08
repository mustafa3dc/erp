/**
 * Enterprise Permission-Based Access Control (PBAC) Schema & Catalog
 * Full production definitions across 7 enterprise operational domains.
 */

export type StandardPermissionCode =
  // 1. Point of Sale (POS)
  | 'pos.terminal.access'
  | 'pos.shifts.manage'
  | 'pos.discount.apply'
  | 'pos.price.override'
  | 'pos.drawer.open'

  // 2. Sales & Invoices (Sales)
  | 'sales.invoices.view'
  | 'sales.invoices.create'
  | 'sales.invoices.edit'
  | 'sales.invoices.delete'
  | 'sales.returns.manage'
  | 'sales.customers.manage'

  // 3. Purchases & Suppliers (Purchases)
  | 'purchases.bills.view'
  | 'purchases.bills.create'
  | 'purchases.bills.edit'
  | 'purchases.bills.delete'
  | 'purchases.orders.manage'
  | 'purchases.suppliers.manage'

  // 4. Inventory & Warehouses (Inventory)
  | 'inventory.items.view'
  | 'inventory.items.create'
  | 'inventory.items.edit'
  | 'inventory.items.delete'
  | 'inventory.cost_price.view'
  | 'inventory.transfers.manage'
  | 'inventory.stock_counts.manage'
  | 'inventory.warehouses.manage'

  // 5. Treasury & Cash Management (Treasury)
  | 'treasury.accounts.view'
  | 'treasury.vouchers.manage'
  | 'treasury.cashboxes.manage'
  | 'treasury.debts.view'

  // 6. Reports & Analytics (Reports)
  | 'reports.executive.view'
  | 'reports.sales.view'
  | 'reports.inventory.view'
  | 'reports.financial.view'

  // 7. System & Settings (System)
  | 'system.dashboard.view'
  | 'system.users.manage'
  | 'system.permissions.manage'
  | 'system.audit.view'
  | 'system.settings.manage';

export interface PermissionDefinition {
  code: string;
  group: 'pos' | 'sales' | 'purchases' | 'inventory' | 'treasury' | 'reports' | 'system';
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface PermissionGroupSection {
  key: 'pos' | 'sales' | 'purchases' | 'inventory' | 'treasury' | 'reports' | 'system';
  titleAr: string;
  titleEn: string;
  iconName: 'Zap' | 'ShoppingCart' | 'ShoppingBag' | 'Package' | 'Wallet' | 'FileText' | 'ShieldCheck';
  permissions: PermissionDefinition[];
}

export interface UpdateUserPermissionsRequest {
  permissions: string[];
}

export interface UserPermissionsResponse {
  userId: string;
  username: string;
  role: string;
  permissions: string[];
  updatedAt: string;
}

// =========================================================================
// Standard Permission Presets
// =========================================================================

export const CASHIER_DEFAULT_PERMISSIONS: string[] = [
  'pos.terminal.access',
  'pos.shifts.manage',
  'pos.discount.apply',
  'sales.invoices.view',
  'sales.invoices.create',
  'sales.returns.manage',
  'inventory.items.view'
];

export const STOREKEEPER_DEFAULT_PERMISSIONS: string[] = [
  'inventory.items.view',
  'inventory.items.create',
  'inventory.items.edit',
  'inventory.transfers.manage',
  'inventory.stock_counts.manage',
  'inventory.warehouses.manage',
  'purchases.bills.view',
  'purchases.bills.create'
];

export const ACCOUNTANT_DEFAULT_PERMISSIONS: string[] = [
  'system.dashboard.view',
  'sales.invoices.view',
  'purchases.bills.view',
  'inventory.items.view',
  'inventory.cost_price.view',
  'treasury.accounts.view',
  'treasury.vouchers.manage',
  'treasury.debts.view',
  'reports.executive.view',
  'reports.sales.view',
  'reports.financial.view'
];

export const BRANCH_MANAGER_DEFAULT_PERMISSIONS: string[] = [
  'system.dashboard.view',
  'pos.terminal.access',
  'pos.shifts.manage',
  'pos.discount.apply',
  'pos.price.override',
  'sales.invoices.view',
  'sales.invoices.create',
  'sales.invoices.edit',
  'sales.returns.manage',
  'sales.customers.manage',
  'purchases.bills.view',
  'purchases.bills.create',
  'purchases.orders.manage',
  'purchases.suppliers.manage',
  'inventory.items.view',
  'inventory.items.create',
  'inventory.items.edit',
  'inventory.cost_price.view',
  'inventory.transfers.manage',
  'inventory.stock_counts.manage',
  'inventory.warehouses.manage',
  'treasury.accounts.view',
  'treasury.vouchers.manage',
  'reports.executive.view',
  'reports.sales.view',
  'reports.inventory.view'
];

export const ALL_SYSTEM_PERMISSIONS: string[] = [
  'pos.terminal.access',
  'pos.shifts.manage',
  'pos.discount.apply',
  'pos.price.override',
  'pos.drawer.open',

  'sales.invoices.view',
  'sales.invoices.create',
  'sales.invoices.edit',
  'sales.invoices.delete',
  'sales.returns.manage',
  'sales.customers.manage',

  'purchases.bills.view',
  'purchases.bills.create',
  'purchases.bills.edit',
  'purchases.bills.delete',
  'purchases.orders.manage',
  'purchases.suppliers.manage',

  'inventory.items.view',
  'inventory.items.create',
  'inventory.items.edit',
  'inventory.items.delete',
  'inventory.cost_price.view',
  'inventory.transfers.manage',
  'inventory.stock_counts.manage',
  'inventory.warehouses.manage',

  'treasury.accounts.view',
  'treasury.vouchers.manage',
  'treasury.cashboxes.manage',
  'treasury.debts.view',

  'reports.executive.view',
  'reports.sales.view',
  'reports.inventory.view',
  'reports.financial.view',

  'system.dashboard.view',
  'system.users.manage',
  'system.permissions.manage',
  'system.audit.view',
  'system.settings.manage'
];

// =========================================================================
// Complete Hierarchical Matrix Catalog (7 Core Sections)
// =========================================================================

export const PERMISSIONS_MATRIX_GROUPS: PermissionGroupSection[] = [
  // 1. Point of Sale (POS)
  {
    key: 'pos',
    titleAr: 'نقاط البيع السريعة (POS)',
    titleEn: 'Point of Sale (POS)',
    iconName: 'Zap',
    permissions: [
      {
        code: 'pos.terminal.access',
        group: 'pos',
        nameAr: 'الدخول لنقطة البيع السريعة',
        nameEn: 'POS Terminal Access',
        descriptionAr: 'صلاحية فتح شاشة نقطة البيع وتسجيل حركات البيع المباشرة',
        descriptionEn: 'Access and utilize retail POS cashier terminal'
      },
      {
        code: 'pos.shifts.manage',
        group: 'pos',
        nameAr: 'إدارة الورديات وإغلاق الصندوق',
        nameEn: 'Shift Management & Z-Report',
        descriptionAr: 'فتح وإغلاق ورديات الكاشير وطباعة تقرير الـ Z-Report',
        descriptionEn: 'Open/close shifts, reconcile drawer cash and print Z-reports'
      },
      {
        code: 'pos.discount.apply',
        group: 'pos',
        nameAr: 'تطبيق خصومات على الفاتورة',
        nameEn: 'Apply Cashier Discounts',
        descriptionAr: 'صلاحية تطبيق نسب الخصم المسموحة للكاشير على الفواتير',
        descriptionEn: 'Permission to grant percentage/amount discounts on cart'
      },
      {
        code: 'pos.price.override',
        group: 'pos',
        nameAr: 'تعديل أسعار البيع المباشرة',
        nameEn: 'Override Selling Price',
        descriptionAr: 'تعديل سعر بيع الصنف المباشر أثناء إصدار الفاتورة',
        descriptionEn: 'Override unit selling price directly at checkout'
      },
      {
        code: 'pos.drawer.open',
        group: 'pos',
        nameAr: 'فتح درج النقدية يدوياً',
        nameEn: 'Manual Cash Drawer Kick',
        descriptionAr: 'صلاحية فتح درج الكاش المالي دون إتمام حركة بيع',
        descriptionEn: 'Trigger hardware receipt printer cash drawer release'
      }
    ]
  },

  // 2. Sales & Invoices
  {
    key: 'sales',
    titleAr: 'المبيعات والفواتير',
    titleEn: 'Sales & Invoices',
    iconName: 'ShoppingCart',
    permissions: [
      {
        code: 'sales.invoices.view',
        group: 'sales',
        nameAr: 'استعراض فواتير المبيعات',
        nameEn: 'View Sales Invoices',
        descriptionAr: 'الاطلاع على قائمة فواتير المبيعات والبحث فيها واستعراض تفاصيلها',
        descriptionEn: 'Browse, filter, and inspect past sales invoices and receipts'
      },
      {
        code: 'sales.invoices.create',
        group: 'sales',
        nameAr: 'إنشاء واعتماد فواتير جديدة',
        nameEn: 'Create & Post Invoices',
        descriptionAr: 'إصدار فواتير بيع نقدية وآجلة من لوحة التحكم الرئيسية',
        descriptionEn: 'Issue and post new commercial sales orders and tax invoices'
      },
      {
        code: 'sales.invoices.edit',
        group: 'sales',
        nameAr: 'تعديل الفواتير المعلقة',
        nameEn: 'Edit Pending Invoices',
        descriptionAr: 'تعديل بنود الفواتير غير المعتمدة قبل ترحيلها النهائي',
        descriptionEn: 'Modify draft or pending invoices prior to final ledger lock'
      },
      {
        code: 'sales.invoices.delete',
        group: 'sales',
        nameAr: 'إلغاء وحذف فواتير المبيعات',
        nameEn: 'Void & Delete Invoices',
        descriptionAr: 'إلغاء الفواتير الصادرة وعكس أثرها المالي والمخزني',
        descriptionEn: 'Void or remove sales invoices with full ledger reversing entries'
      },
      {
        code: 'sales.returns.manage',
        group: 'sales',
        nameAr: 'إدارة المرتجعات والضمان (RMA)',
        nameEn: 'Returns & Warranty RMA',
        descriptionAr: 'قبول مرتجعات العملاء، فحص الضمان، وإصدار إشعارات دائنة',
        descriptionEn: 'Process customer returns, RMA warranties, and credit notes'
      },
      {
        code: 'sales.customers.manage',
        group: 'sales',
        nameAr: 'إدارة العملاء وسقف الذمم',
        nameEn: 'Customers & Receivables',
        descriptionAr: 'إضافة وتعديل بيانات العملاء وسقف الديون الائتمانية',
        descriptionEn: 'Manage customer database, loyalty tiers, and credit limits'
      }
    ]
  },

  // 3. Purchases & Suppliers
  {
    key: 'purchases',
    titleAr: 'المشتريات والموردين',
    titleEn: 'Purchases & Suppliers',
    iconName: 'ShoppingBag',
    permissions: [
      {
        code: 'purchases.bills.view',
        group: 'purchases',
        nameAr: 'استعراض فواتير الشراء الواردة',
        nameEn: 'View Purchase Invoices',
        descriptionAr: 'الاطلاع على فواتير المشتريات ومطابقة تكاليف البضاعة المستلمة',
        descriptionEn: 'View incoming supplier bills, payments, and landed costs'
      },
      {
        code: 'purchases.bills.create',
        group: 'purchases',
        nameAr: 'تسجيل فواتير الشراء وإدخال FIFO',
        nameEn: 'Create Purchase Bills',
        descriptionAr: 'إدخال فواتير شراء جديدة وتغذية المستودعات بدفعات FIFO',
        descriptionEn: 'Enter purchase bills and increment stock via FIFO cost layers'
      },
      {
        code: 'purchases.bills.edit',
        group: 'purchases',
        nameAr: 'تعديل فواتير الشراء',
        nameEn: 'Edit Purchase Bills',
        descriptionAr: 'تعديل بنود وتكاليف فواتير الشراء قبل الترحيل',
        descriptionEn: 'Update items, freight fees, or quantities on unposted bills'
      },
      {
        code: 'purchases.bills.delete',
        group: 'purchases',
        nameAr: 'حذف أو إلغاء فواتير الشراء',
        nameEn: 'Delete Purchase Bills',
        descriptionAr: 'إلغاء فاتورة شراء وعكس رصيد المورد وكميات المخزون',
        descriptionEn: 'Void purchase invoices with supplier ledger balance reversal'
      },
      {
        code: 'purchases.orders.manage',
        group: 'purchases',
        nameAr: 'إدارة أوامر الشراء المجدولة',
        nameEn: 'Purchase Orders (PO)',
        descriptionAr: 'إنشاء واعتماد أوامر الشراء الرسمية ومتابعة مواعيد التوريد',
        descriptionEn: 'Draft and approve official purchase orders and dispatch dates'
      },
      {
        code: 'purchases.suppliers.manage',
        group: 'purchases',
        nameAr: 'إدارة الموردين وسجل المستحقات',
        nameEn: 'Suppliers & Payables',
        descriptionAr: 'تسجيل الموردين ومتابعة كشوف الحساب والمستحقات المالية',
        descriptionEn: 'Manage vendor catalog, contact details, and payables ledgers'
      }
    ]
  },

  // 4. Inventory & Warehouses
  {
    key: 'inventory',
    titleAr: 'المخزون والمستودعات',
    titleEn: 'Inventory & Warehouses',
    iconName: 'Package',
    permissions: [
      {
        code: 'inventory.items.view',
        group: 'inventory',
        nameAr: 'استعراض دليل الأصناف والباركود',
        nameEn: 'View Item Catalog',
        descriptionAr: 'الاطلاع على قائمة الأصناف والأرصدة والباركودات المتاحة',
        descriptionEn: 'Browse product listings, SKU identities, and available stock'
      },
      {
        code: 'inventory.items.create',
        group: 'inventory',
        nameAr: 'إضافة أصناف جديدة للدليل',
        nameEn: 'Create New Products',
        descriptionAr: 'إنشاء بطاقة صنف جديدة وتوليد باركودات وتحديد أسعار البيع',
        descriptionEn: 'Register new inventory items and configure SKU attributes'
      },
      {
        code: 'inventory.items.edit',
        group: 'inventory',
        nameAr: 'تعديل بيانات الأصناف والأسعار',
        nameEn: 'Edit Products & Prices',
        descriptionAr: 'تعديل مواصفات الصنف، وحدات القياس، والحد الأدنى والأقصى',
        descriptionEn: 'Modify product parameters, category assignment, and units'
      },
      {
        code: 'inventory.items.delete',
        group: 'inventory',
        nameAr: 'حذف الأصناف من الدليل',
        nameEn: 'Delete Products',
        descriptionAr: 'حذف أو أرشفة الأصناف نهائياً من دليل المنتجات',
        descriptionEn: 'Permanently remove or archive items from product database'
      },
      {
        code: 'inventory.cost_price.view',
        group: 'inventory',
        nameAr: 'الاطلاع على أسعار التكلفة وهامش الربح',
        nameEn: 'View Cost Price & Margins',
        descriptionAr: 'فك حجب أسعار الشراء وتكلفة الصنف وهوامش الأرباح الإجمالية',
        descriptionEn: 'Strict permission to unmask procurement cost prices and profit margins'
      },
      {
        code: 'inventory.transfers.manage',
        group: 'inventory',
        nameAr: 'إدارة المناقلات وتتبع الطريق',
        nameEn: 'Transfers & In-Transit',
        descriptionAr: 'إنشاء واعتماد ومطابقة شحنات النقل بين الفروع والمستودعات',
        descriptionEn: 'Dispatch, track, and receive inter-warehouse inventory transfers'
      },
      {
        code: 'inventory.stock_counts.manage',
        group: 'inventory',
        nameAr: 'الجرد المخزني وتسوية الفروقات',
        nameEn: 'Stock Audits & Reconciliation',
        descriptionAr: 'تنفيذ جرد الأصناف الدوري وإقرار قيود التسوية المخزنية',
        descriptionEn: 'Create physical inventory audit sessions and post adjustments'
      },
      {
        code: 'inventory.warehouses.manage',
        group: 'inventory',
        nameAr: 'تخطيط المستودعات والرفوف (WMS)',
        nameEn: 'Warehouse Layout & WMS',
        descriptionAr: 'إدارة المستودعات، الأقسام، والمواقع والرفوف التخزينية',
        descriptionEn: 'Configure warehouse facilities, aisle sections, and rack bins'
      }
    ]
  },

  // 5. Treasury & Cash Management
  {
    key: 'treasury',
    titleAr: 'الخزينة وإدارة النقدية',
    titleEn: 'Treasury & Cash Management',
    iconName: 'Wallet',
    permissions: [
      {
        code: 'treasury.accounts.view',
        group: 'treasury',
        nameAr: 'استعراض الصناديق والمحافظ المالية',
        nameEn: 'View Cash & Bank Accounts',
        descriptionAr: 'الاطلاع على أرصدة الصناديق النقدية والمحافظ الإلكترونية',
        descriptionEn: 'View real-time balances of cash drawers, bank accounts, and e-wallets'
      },
      {
        code: 'treasury.vouchers.manage',
        group: 'treasury',
        nameAr: 'إنشاء سندات القبض والصرف المالي',
        nameEn: 'Receipt & Payment Vouchers',
        descriptionAr: 'تسجيل سندات القبض وسندات الصرف المالي وإقفالها',
        descriptionEn: 'Generate and disburse receipt and payment financial vouchers'
      },
      {
        code: 'treasury.cashboxes.manage',
        group: 'treasury',
        nameAr: 'إدارة وتعديل الصناديق النقدية',
        nameEn: 'Manage Cash Boxes',
        descriptionAr: 'إضافة وتعديل حسابات الصناديق وتعيين أمناء العهد النقدية',
        descriptionEn: 'Create and assign physical cash drawers and custodial registers'
      },
      {
        code: 'treasury.debts.view',
        group: 'treasury',
        nameAr: 'متابعة سجل الديون وأعمار الذمم',
        nameEn: 'Debts & Aging Schedule',
        descriptionAr: 'الاطلاع على كشوفات الذمم المدينة والدائنة ومواعيد الاستحقاق',
        descriptionEn: 'Track customer and vendor aging schedules and credit obligations'
      }
    ]
  },

  // 6. Reports & Analytics
  {
    key: 'reports',
    titleAr: 'التقارير التنفيذية والمؤشرات',
    titleEn: 'Executive Reports & Analytics',
    iconName: 'FileText',
    permissions: [
      {
        code: 'reports.executive.view',
        group: 'reports',
        nameAr: 'الاطلاع على التقارير التنفيذية',
        nameEn: 'Executive Reports & KPIs',
        descriptionAr: 'استعراض مؤشرات الأداء الحية ومقارنات الفروع الإجمالية',
        descriptionEn: 'Access macro business health dashboards, sales trends, and profit KPIs'
      },
      {
        code: 'reports.sales.view',
        group: 'reports',
        nameAr: 'تقارير المبيعات والأرباح',
        nameEn: 'Sales & Revenue Reports',
        descriptionAr: 'توليد تقارير المبيعات اليومية والشهرية ومعدلات أداء الموظفين',
        descriptionEn: 'Generate granular product sales reports and cashier performance'
      },
      {
        code: 'reports.inventory.view',
        group: 'reports',
        nameAr: 'تقارير حركة وركود المخزون',
        nameEn: 'Inventory Aging & Movements',
        descriptionAr: 'استعراض تقارير سرعة دوران الصنف والأصناف الراكدة تحت حد الطلب',
        descriptionEn: 'Audit inventory turnover velocity, slow-moving items, and stock health'
      },
      {
        code: 'reports.financial.view',
        group: 'reports',
        nameAr: 'القوائم والتقارير المالية والضريبية',
        nameEn: 'Financial Statements & Tax',
        descriptionAr: 'استخراج ميزان المراجعة وقائمة الدخل والإقرارات الضريبية',
        descriptionEn: 'Export trial balance, income statements, and tax summary reports'
      }
    ]
  },

  // 7. System & Settings
  {
    key: 'system',
    titleAr: 'إدارة النظام وسجل الرقابة',
    titleEn: 'System & Administration',
    iconName: 'ShieldCheck',
    permissions: [
      {
        code: 'system.dashboard.view',
        group: 'system',
        nameAr: 'عرض لوحة القيادة والمؤشرات العامة',
        nameEn: 'Dashboard & Live Analytics',
        descriptionAr: 'صلاحية فتح الشاشة الرئيسية للوحة القيادة ومؤشرات النظام',
        descriptionEn: 'Access executive command center and real-time operational feeds'
      },
      {
        code: 'system.users.manage',
        group: 'system',
        nameAr: 'إدارة حسابات الموظفين والفرقاء',
        nameEn: 'Staff & User Management',
        descriptionAr: 'إنشاء وتعديل وتعطيل حسابات الموظفين وإعادة تعيين كلمات المرور',
        descriptionEn: 'Create, update, suspend employee accounts and reset login passwords'
      },
      {
        code: 'system.permissions.manage',
        group: 'system',
        nameAr: 'تخصيص مصفوفة الصلاحيات (PBAC)',
        nameEn: 'Granular Permissions Matrix',
        descriptionAr: 'تعديل وتعيين الصلاحيات الدقيقة لكل موظف عبر مصفوفة التحكم',
        descriptionEn: 'Fine-tune granular permission matrix switches per employee'
      },
      {
        code: 'system.audit.view',
        group: 'system',
        nameAr: 'سجل الرقابة والتتبع غير القابل للحذف',
        nameEn: 'Immutable Audit Logs',
        descriptionAr: 'الاطلاع على سجل التدقيق الأمني لجميع حركات الإدخال والتعديل',
        descriptionEn: 'Inspect immutable system event audit trail and security logs'
      },
      {
        code: 'system.settings.manage',
        group: 'system',
        nameAr: 'إعدادات المنظومة وتخصيص الشركة',
        nameEn: 'Company & General Settings',
        descriptionAr: 'تعديل بيانات الشركة، العملات الافتراضية، وسياسات النظام',
        descriptionEn: 'Configure tenant metadata, base currency, and operating policies'
      }
    ]
  }
];
