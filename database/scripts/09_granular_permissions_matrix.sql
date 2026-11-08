-- ============================================================================
-- Enterprise ERP: Granular Permission-Based Access Control (PBAC) Migration
-- Script 09: Permissions Catalog & UserPermissions Join Table
-- Zero-Mock / Production Schema
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create permissions Catalog Table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    group_name VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-speed permission verification
CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_code ON permissions (code);
CREATE INDEX IF NOT EXISTS idx_permissions_group_name ON permissions (group_name);

-- 2. Create user_permissions Join Table
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_code VARCHAR(100) NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_code ON user_permissions (permission_code);

-- 3. Populate Standard Granular Permissions Across 7 Core Enterprise Domains
-- Group 1: Point of Sale (POS)
INSERT INTO permissions (id, code, group_name, name_ar, name_en, description_ar, description_en)
VALUES
    (uuid_generate_v4(), 'pos.terminal.access', 'Point of Sale', 'الدخول لنقطة البيع السريعة', 'POS Terminal Access', 'صلاحية فتح شاشة نقطة البيع وتسجيل المبيعات المباشرة', 'Access to quick sales POS screen and daily sales register'),
    (uuid_generate_v4(), 'pos.shifts.manage', 'Point of Sale', 'إدارة الورديات وإغلاق الصندوق', 'Shift Management & Z-Report', 'فتح وإغلاق ورديات الصندوق وطباعة تقرير الـ Z-Report', 'Open and close cash drawer shifts and issue end-of-day Z reports'),
    (uuid_generate_v4(), 'pos.discount.apply', 'Point of Sale', 'تطبيق خصم يدوي على الفاتورة', 'Apply Invoice Discounts', 'صلاحية تطبيق نسب الخصم المسموحة للكاشير على الفواتير', 'Permission to grant manual discounts on POS invoice items'),
    (uuid_generate_v4(), 'pos.price.override', 'Point of Sale', 'تعديل أسعار البيع المباشرة', 'Override Selling Price', 'تعديل سعر بيع الصنف لحظة إصدار فاتورة البيع', 'Override item retail selling price directly at checkout'),
    (uuid_generate_v4(), 'pos.drawer.open', 'Point of Sale', 'فتح درج النقدية يدوياً', 'Manual Cash Drawer Kick', 'صلاحية فتح درج الكاش دون إجراء حركة بيع', 'Manually trigger ESC/POS cash drawer kick without a sale transaction')
ON CONFLICT (code) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en;

-- Group 2: Sales & Invoices (Sales)
INSERT INTO permissions (id, code, group_name, name_ar, name_en, description_ar, description_en)
VALUES
    (uuid_generate_v4(), 'sales.invoices.view', 'Sales & Invoices', 'استعراض فواتير المبيعات', 'View Sales Invoices', 'الاطلاع على قائمة فواتير المبيعات الصادرة والبحث فيها', 'Browse and search all historical sales invoices and receipts'),
    (uuid_generate_v4(), 'sales.invoices.create', 'Sales & Invoices', 'إنشاء فواتير المبيعات', 'Create Sales Invoices', 'إصدار فواتير بيع نقدية وآجلة من لوحة التحكم', 'Create and finalize new sales invoices from back-office'),
    (uuid_generate_v4(), 'sales.invoices.edit', 'Sales & Invoices', 'تعديل فواتير المبيعات', 'Edit Sales Invoices', 'تعديل بيانات الفواتير المعلقة أو غير المعتمدة', 'Modify pending sales draft invoices prior to final posting'),
    (uuid_generate_v4(), 'sales.invoices.delete', 'Sales & Invoices', 'إلغاء وحذف فواتير المبيعات', 'Cancel & Void Invoices', 'إلغاء الفواتير الصادرة وتعديل أثرها المحاسبي والمخزني', 'Void or delete posted sales invoices with ledger reversal'),
    (uuid_generate_v4(), 'sales.returns.manage', 'Sales & Invoices', 'إدارة المرتجعات والضمان', 'Returns & Warranty RMA', 'قبول المرتجعات وفحص الضمان وإصدار إشعارات دائنة', 'Process sales returns, warranty RMA inspection and credit notes'),
    (uuid_generate_v4(), 'sales.customers.manage', 'Sales & Invoices', 'إدارة سجل العملاء والذمم', 'Customers & Receivables', 'إضافة وتعديل بيانات العملاء وسقف الديون المسموح', 'Manage customer accounts, credit limits, and loyalty profiles')
ON CONFLICT (code) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en;

-- Group 3: Purchases & Suppliers (Purchases)
INSERT INTO permissions (id, code, group_name, name_ar, name_en, description_ar, description_en)
VALUES
    (uuid_generate_v4(), 'purchases.bills.view', 'Purchases', 'استعراض فواتير الشراء الواردة', 'View Purchase Invoices', 'الاطلاع على فواتير المشتريات ومطابقتها', 'View incoming vendor purchase bills and receipts'),
    (uuid_generate_v4(), 'purchases.bills.create', 'Purchases', 'تسجيل فواتير الشراء الواردة', 'Create Purchase Bills', 'إدخال فواتير شراء جديدة وتغذية المخزون بدفعات FIFO', 'Record new purchase invoices and inject FIFO stock batches'),
    (uuid_generate_v4(), 'purchases.bills.edit', 'Purchases', 'تعديل فواتير المشتريات', 'Edit Purchase Bills', 'تعديل بنود وتكاليف فواتير الشراء قبل الاعتماد النهائي', 'Update purchase bill items and landing costs prior to posting'),
    (uuid_generate_v4(), 'purchases.bills.delete', 'Purchases', 'حذف أو إلغاء فواتير الشراء', 'Delete Purchase Bills', 'إلغاء فاتورة شراء وإرجاع الأثر المخزني والمالي', 'Delete or cancel unposted purchase bills'),
    (uuid_generate_v4(), 'purchases.orders.manage', 'Purchases', 'إدارة أوامر الشراء المجدولة', 'Purchase Orders (PO)', 'إنشاء ومتابعة أوامر الشراء ومذكرات التوريد الخارجية', 'Create and approve scheduled vendor Purchase Orders'),
    (uuid_generate_v4(), 'purchases.suppliers.manage', 'Purchases', 'إدارة دليل الموردين والديون', 'Suppliers & Payables', 'تسجيل الموردين ومتابعة كشوف الحساب والمستحقات', 'Manage supplier accounts, payables ledger, and payment terms')
ON CONFLICT (code) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en;

-- Group 4: Inventory & Warehouses (Inventory)
INSERT INTO permissions (id, code, group_name, name_ar, name_en, description_ar, description_en)
VALUES
    (uuid_generate_v4(), 'inventory.items.view', 'Inventory', 'استعراض دليل الأصناف والباركود', 'View Item Catalog', 'الاطلاع على قائمة الأصناف والأرصدة والباركودات', 'Browse item catalog, SKU codes, and current on-hand stock'),
    (uuid_generate_v4(), 'inventory.items.create', 'Inventory', 'إضافة أصناف جديدة للدليل', 'Create New Products', 'إنشاء بطاقة صنف جديدة وتوليد باركودات وتحديد الأسعار', 'Create new inventory items, SKU attributes, and selling prices'),
    (uuid_generate_v4(), 'inventory.items.edit', 'Inventory', 'تعديل بيانات الأصناف والأسعار', 'Edit Products & Prices', 'تعديل مواصفات الصنف، وحدات القياس، وأسعار البيع', 'Edit item details, pricing tiers, and reorder levels'),
    (uuid_generate_v4(), 'inventory.items.delete', 'Inventory', 'حذف الأصناف من الدليل', 'Delete Products', 'حذف أو أرشفة الأصناف نهائياً من دليل المنتجات', 'Permanently delete or archive products from the SKU master'),
    (uuid_generate_v4(), 'inventory.cost_price.view', 'Inventory', 'الاطلاع على أسعار التكلفة وهامش الربح', 'View Cost Price & Margins', 'فك حجب تكلفة الشراء وهامش الربح الإجمالي', 'Unmask procurement cost price and gross profit margins'),
    (uuid_generate_v4(), 'inventory.transfers.manage', 'Inventory', 'إدارة المناقلات وتتبع الطريق', 'Transfers & In-Transit', 'إنشاء واعتماد ومطابقة شحنات النقل بين الفروع والمستودعات', 'Initiate, approve, and receive inter-warehouse transfer orders'),
    (uuid_generate_v4(), 'inventory.stock_counts.manage', 'Inventory', 'الجرد المخزني وتسوية الفروقات', 'Stock Audits & Reconciliation', 'تنفيذ جرد الأصناف وإقرار قيود التسوية المخزنية', 'Conduct stock audit counts and post variance adjustments'),
    (uuid_generate_v4(), 'inventory.warehouses.manage', 'Inventory', 'تخطيط المستودعات والرفوف WMS', 'Warehouse Layout & WMS', 'إدارة المستودعات، الأقسام، والمواقع والرفوف التخزينية', 'Manage warehouse hubs, bin locations, and rack topologies')
ON CONFLICT (code) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en;

-- Group 5: Treasury & Cash Management (Treasury)
INSERT INTO permissions (id, code, group_name, name_ar, name_en, description_ar, description_en)
VALUES
    (uuid_generate_v4(), 'treasury.accounts.view', 'Treasury', 'استعراض الصناديق والمحافظ المالية', 'View Cash & Bank Accounts', 'الاطلاع على أرصدة الصناديق النقدية والمحافظ الإلكترونية', 'View live balances of cash drawers, bank accounts, and wallets'),
    (uuid_generate_v4(), 'treasury.vouchers.manage', 'Treasury', 'إنشاء سندات القبض والصرف', 'Receipt & Payment Vouchers', 'تسجيل سندات القبض وسندات الصرف المالي ومطابقتها', 'Create and post financial receipt and payment disbursement vouchers'),
    (uuid_generate_v4(), 'treasury.cashboxes.manage', 'Treasury', 'إدارة وتعديل الصناديق النقدية', 'Manage Cash Boxes', 'إضافة صناديق ومحافظ جديدة وتعيين المسؤولين عنها', 'Create and configure physical cash registers and sub-treasuries'),
    (uuid_generate_v4(), 'treasury.debts.view', 'Treasury', 'متابعة سجل الديون والمستحقات', 'Debts & Aging Ledger', 'الاطلاع على كشوفات الذمم المدينة والدائنة وأعمار الديون', 'Monitor debt aging schedules, receivables, and payables ledgers')
ON CONFLICT (code) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en;

-- Group 6: Reports & Analytics (Reports)
INSERT INTO permissions (id, code, group_name, name_ar, name_en, description_ar, description_en)
VALUES
    (uuid_generate_v4(), 'reports.executive.view', 'Reports', 'الاطلاع على التقارير التنفيذية', 'Executive Reports & KPIs', 'استعراض مؤشرات الأداء الحية ومقارنات الفروع الإجمالية', 'Access executive summaries, macro performance KPIs, and multi-branch metrics'),
    (uuid_generate_v4(), 'reports.sales.view', 'Reports', 'تقارير المبيعات والأرباح', 'Sales & Revenue Reports', 'توليد تقارير المبيعات التفصيلية وتحليل الربحية اليومية', 'Generate detailed sales revenue analysis, top products, and rep performance'),
    (uuid_generate_v4(), 'reports.inventory.view', 'Reports', 'تقارير حركة وركود المخزون', 'Inventory Aging & Movements', 'استعراض تقارير سرعة دوران الصنف والأصناف الراكدة', 'Analyze stock turnover velocity, dead stock, and reorder projections'),
    (uuid_generate_v4(), 'reports.financial.view', 'Reports', 'القوائم والتقارير المالية', 'Financial Statements & Tax', 'استخراج ميزان المراجعة وقائمة الدخل والتقارير الضريبية', 'Export trial balance, income statement, and sales tax compliance reports')
ON CONFLICT (code) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en;

-- Group 7: System & Settings (System)
INSERT INTO permissions (id, code, group_name, name_ar, name_en, description_ar, description_en)
VALUES
    (uuid_generate_v4(), 'system.dashboard.view', 'System', 'عرض لوحة القيادة والمؤشرات العامة', 'Dashboard & Live Analytics', 'صلاحية فتح الشاشة الرئيسية للوحة القيادة ومؤشرات النظام', 'Access primary executive dashboard and real-time operations summary'),
    (uuid_generate_v4(), 'system.users.manage', 'System', 'إدارة حسابات الموظفين والفرقاء', 'Staff & User Management', 'إنشاء وتعديل وتعطيل حسابات الموظفين وإعادة تعيين كلمات المرور', 'Create, update, activate/deactivate staff user profiles and reset credentials'),
    (uuid_generate_v4(), 'system.permissions.manage', 'System', 'تخصيص مصفوفة الصلاحيات (PBAC)', 'Granular Permissions Matrix', 'تعديل وتعيين الصلاحيات الدقيقة لكل موظف عبر المصفوفة', 'Configure and assign granular permission matrix switches per employee'),
    (uuid_generate_v4(), 'system.audit.view', 'System', 'سجل الرقابة والتتبع غير القابل للحذف', 'Immutable Audit Logs', 'الاطلاع على سجل التدقيق الأمني لجميع حركات الإدخال والحذف', 'Inspect tamper-proof audit trail of system mutations and overrides'),
    (uuid_generate_v4(), 'system.settings.manage', 'System', 'إعدادات المنظومة وتخصيص الشركة', 'Company & General Settings', 'تعديل بيانات الشركة، العملات الافتراضية، وسياسات النظام', 'Manage tenant configuration, default currency, and operational rules')
ON CONFLICT (code) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en;

-- 4. Initial Bootstrap: Grant all permissions to SuperAdmin users
INSERT INTO user_permissions (user_id, permission_code, granted_by, created_at)
SELECT u.id, p.code, u.id, CURRENT_TIMESTAMP
FROM users u
CROSS JOIN permissions p
WHERE u.role = 'SuperAdmin' OR LOWER(u.username) = 'admin'
ON CONFLICT (user_id, permission_code) DO NOTHING;

-- Grant default cashier permissions to Cashier users
INSERT INTO user_permissions (user_id, permission_code, granted_by, created_at)
SELECT u.id, p.code, NULL, CURRENT_TIMESTAMP
FROM users u
CROSS JOIN permissions p
WHERE u.role = 'Cashier' AND p.code IN (
    'pos.terminal.access',
    'pos.shifts.manage',
    'pos.discount.apply',
    'sales.invoices.view',
    'sales.invoices.create',
    'sales.returns.manage',
    'inventory.items.view'
)
ON CONFLICT (user_id, permission_code) DO NOTHING;

-- Grant default storekeeper permissions to Storekeeper users
INSERT INTO user_permissions (user_id, permission_code, granted_by, created_at)
SELECT u.id, p.code, NULL, CURRENT_TIMESTAMP
FROM users u
CROSS JOIN permissions p
WHERE u.role = 'Storekeeper' AND p.code IN (
    'inventory.items.view',
    'inventory.items.create',
    'inventory.items.edit',
    'inventory.transfers.manage',
    'inventory.stock_counts.manage',
    'inventory.warehouses.manage',
    'purchases.bills.view',
    'purchases.bills.create'
)
ON CONFLICT (user_id, permission_code) DO NOTHING;
