-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16 Migration
-- Script 12: Missing Core Business Modules:
-- 1. Operational Expenses (Categories & Vouchers)
-- 2. Sales Quotations (Price Offers & Invoice Conversion)
-- 3. Multi-Tier Price Lists, Tiered Rules & Product Bundles
-- 4. Supplier Purchase Returns & Ledger Adjustments
-- 5. Serial / IMEI Tracking & Active Warranty Lifecycle
-- 6. Immutable Audit Trail Ledger
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Update Existing Tables
-- ----------------------------------------------------------------------------

-- Alter products to support serial tracking, warranty, and bundles
ALTER TABLE IF EXISTS products 
    ADD COLUMN IF NOT EXISTS requires_serial_number BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS warranty_months INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure customers table has price_list_id and tenant_id
ALTER TABLE IF EXISTS customers 
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS price_list_id UUID;

CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);
CREATE INDEX IF NOT EXISTS idx_customers_price_list ON customers(price_list_id);

-- ----------------------------------------------------------------------------
-- 1. Operational Expenses (Categories & Vouchers)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_categories_tenant_code 
    ON expense_categories(tenant_id, LOWER(code));

CREATE TABLE IF NOT EXISTS expense_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    voucher_number VARCHAR(50) NOT NULL,
    voucher_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expense_category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
    cash_box_id UUID REFERENCES cash_boxes(id) ON DELETE RESTRICT,
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    exchange_rate NUMERIC(18, 4) NOT NULL DEFAULT 1.0000 CHECK (exchange_rate > 0),
    base_currency_amount NUMERIC(18, 4) NOT NULL CHECK (base_currency_amount > 0),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH',
    beneficiary_name VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'APPROVED', 'REJECTED', 'CANCELLED'
    approved_by VARCHAR(150),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    receipt_reference VARCHAR(100),
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_vouchers_tenant_number 
    ON expense_vouchers(tenant_id, LOWER(voucher_number));
CREATE INDEX IF NOT EXISTS idx_expense_vouchers_tenant_status 
    ON expense_vouchers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_vouchers_category 
    ON expense_vouchers(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_expense_vouchers_cash_box 
    ON expense_vouchers(cash_box_id);
CREATE INDEX IF NOT EXISTS idx_expense_vouchers_date 
    ON expense_vouchers(voucher_date);

-- ----------------------------------------------------------------------------
-- 2. Sales Quotations & Quotation Line Items
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    quotation_number VARCHAR(100) NOT NULL,
    quotation_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 days'),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(50),
    customer_address VARCHAR(255),
    customer_tax_no VARCHAR(100),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (subtotal >= 0),
    discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (tax_amount >= 0),
    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (total_amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    exchange_rate NUMERIC(18, 4) NOT NULL DEFAULT 1.0000 CHECK (exchange_rate > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Sent', 'Accepted', 'Expired', 'Converted', 'Cancelled'
    converted_invoice_id UUID REFERENCES sales_invoices(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ,
    salesperson_id VARCHAR(100),
    salesperson_name VARCHAR(150),
    terms_and_conditions TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quotations_tenant_number 
    ON sales_quotations(tenant_id, LOWER(quotation_number));
CREATE INDEX IF NOT EXISTS idx_sales_quotations_customer 
    ON sales_quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotations_status 
    ON sales_quotations(status);
CREATE INDEX IF NOT EXISTS idx_sales_quotations_converted_inv 
    ON sales_quotations(converted_invoice_id);

CREATE TABLE IF NOT EXISTS sales_quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    quotation_id UUID NOT NULL REFERENCES sales_quotations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_sku VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'قطعة',
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(18, 4) NOT NULL CHECK (unit_price >= 0),
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (discount_amount >= 0),
    tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_percent >= 0),
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (tax_amount >= 0),
    line_total NUMERIC(18, 4) NOT NULL CHECK (line_total >= 0),
    notes VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_sales_quotation_items_quotation 
    ON sales_quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotation_items_product 
    ON sales_quotation_items(product_id);

-- ----------------------------------------------------------------------------
-- 3. Price Lists, Tiers & Product Bundles
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_price_lists_tenant_code 
    ON price_lists(tenant_id, LOWER(code));

CREATE TABLE IF NOT EXISTS price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    min_quantity NUMERIC(12, 3) NOT NULL DEFAULT 1.000 CHECK (min_quantity > 0),
    unit_price NUMERIC(18, 4) NOT NULL CHECK (unit_price >= 0),
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_price_list_items_tier 
    ON price_list_items(price_list_id, product_id, min_quantity);
CREATE INDEX IF NOT EXISTS idx_price_list_items_product 
    ON price_list_items(product_id);

CREATE TABLE IF NOT EXISTS product_bundle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    parent_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 1.000 CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_bundle_items 
    ON product_bundle_items(parent_product_id, component_product_id);
CREATE INDEX IF NOT EXISTS idx_bundle_component 
    ON product_bundle_items(component_product_id);

-- ----------------------------------------------------------------------------
-- 4. Supplier Purchase Returns & Return Line Items
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS purchase_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    return_number VARCHAR(100) NOT NULL,
    original_bill_id UUID NOT NULL REFERENCES purchase_bills(id) ON DELETE RESTRICT,
    original_bill_number VARCHAR(100) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    return_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED'
    subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (subtotal >= 0),
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (tax_amount >= 0),
    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (total_amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    exchange_rate NUMERIC(18, 4) NOT NULL DEFAULT 1.0000 CHECK (exchange_rate > 0),
    refund_method VARCHAR(50) NOT NULL DEFAULT 'SUPPLIER_CREDIT', -- 'SUPPLIER_CREDIT', 'CASH_REFUND', 'BANK_REFUND'
    cash_box_id UUID REFERENCES cash_boxes(id) ON DELETE RESTRICT,
    return_reason TEXT,
    approved_by VARCHAR(150),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_returns_tenant_number 
    ON purchase_returns(tenant_id, LOWER(return_number));
CREATE INDEX IF NOT EXISTS idx_purchase_returns_bill 
    ON purchase_returns(original_bill_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier 
    ON purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_warehouse 
    ON purchase_returns(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_status 
    ON purchase_returns(status);

CREATE TABLE IF NOT EXISTS purchase_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    return_id UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    purchase_bill_item_id UUID NOT NULL REFERENCES purchase_bill_items(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_sku VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'قطعة',
    purchased_quantity NUMERIC(12, 3) NOT NULL CHECK (purchased_quantity > 0),
    previously_returned_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (previously_returned_quantity >= 0),
    return_quantity NUMERIC(12, 3) NOT NULL CHECK (return_quantity > 0),
    unit_cost NUMERIC(18, 4) NOT NULL CHECK (unit_cost >= 0),
    line_total NUMERIC(18, 4) NOT NULL CHECK (line_total >= 0),
    reason VARCHAR(255),
    serial_number VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return 
    ON purchase_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_bill_item 
    ON purchase_return_items(purchase_bill_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_product 
    ON purchase_return_items(product_id);

-- ----------------------------------------------------------------------------
-- 5. Serial / IMEI & Warranty Tracking
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_serials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'InStock', -- 'InStock', 'Sold', 'Returned', 'Defective', 'Transferred'
    
    -- Inbound Purchase Attribution
    purchase_bill_id UUID REFERENCES purchase_bills(id) ON DELETE SET NULL,
    purchase_bill_item_id UUID,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(150),
    purchase_date TIMESTAMPTZ,
    unit_cost NUMERIC(18, 4),
    
    -- Outbound Sales Attribution
    sales_invoice_id UUID REFERENCES sales_invoices(id) ON DELETE SET NULL,
    sales_invoice_item_id UUID,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(150),
    customer_phone VARCHAR(50),
    sold_date TIMESTAMPTZ,
    selling_price NUMERIC(18, 4),
    
    -- Warranty Lifecycle
    warranty_months INT NOT NULL DEFAULT 12,
    warranty_start_date TIMESTAMPTZ,
    warranty_end_date TIMESTAMPTZ,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_serials_tenant_product_serial 
    ON product_serials(tenant_id, product_id, LOWER(serial_number));
CREATE INDEX IF NOT EXISTS idx_product_serials_tenant_serial 
    ON product_serials(tenant_id, LOWER(serial_number));
CREATE INDEX IF NOT EXISTS idx_product_serials_status 
    ON product_serials(status);
CREATE INDEX IF NOT EXISTS idx_product_serials_warehouse 
    ON product_serials(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_invoice 
    ON product_serials(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_bill 
    ON product_serials(purchase_bill_id);

-- GIN Trigram index for ultra-fast serial and IMEI scanner autocomplete
CREATE INDEX IF NOT EXISTS idx_product_serials_gin 
    ON product_serials 
    USING gin(serial_number gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 6. Immutable Audit Trail Ledger
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(100),
    username VARCHAR(150),
    action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'CONVERT'
    entity_name VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entity 
    ON audit_logs(tenant_id, entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp 
    ON audit_logs(timestamp DESC);

-- Protect audit_logs from mutation or deletion
CREATE OR REPLACE FUNCTION fn_prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ERR_AUDIT_LOG_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = 'Modifying or deleting enterprise audit records is strictly prohibited by security governance.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_modification
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_audit_log_modification();

-- ----------------------------------------------------------------------------
-- 7. Automated Timestamps Triggers
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_expense_categories_updated_at ON expense_categories;
CREATE TRIGGER trg_expense_categories_updated_at
BEFORE UPDATE ON expense_categories
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_expense_vouchers_updated_at ON expense_vouchers;
CREATE TRIGGER trg_expense_vouchers_updated_at
BEFORE UPDATE ON expense_vouchers
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_sales_quotations_updated_at ON sales_quotations;
CREATE TRIGGER trg_sales_quotations_updated_at
BEFORE UPDATE ON sales_quotations
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_price_lists_updated_at ON price_lists;
CREATE TRIGGER trg_price_lists_updated_at
BEFORE UPDATE ON price_lists
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_price_list_items_updated_at ON price_list_items;
CREATE TRIGGER trg_price_list_items_updated_at
BEFORE UPDATE ON price_list_items
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_returns_updated_at ON purchase_returns;
CREATE TRIGGER trg_purchase_returns_updated_at
BEFORE UPDATE ON purchase_returns
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_product_serials_updated_at ON product_serials;
CREATE TRIGGER trg_product_serials_updated_at
BEFORE UPDATE ON product_serials
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Expense Categories RLS
    DROP POLICY IF EXISTS tenant_isolation_expense_categories ON expense_categories;
    CREATE POLICY tenant_isolation_expense_categories ON expense_categories
        FOR ALL USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL 
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        );

    -- Expense Vouchers RLS
    DROP POLICY IF EXISTS tenant_isolation_expense_vouchers ON expense_vouchers;
    CREATE POLICY tenant_isolation_expense_vouchers ON expense_vouchers
        FOR ALL USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL 
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        );

    -- Sales Quotations RLS
    DROP POLICY IF EXISTS tenant_isolation_sales_quotations ON sales_quotations;
    CREATE POLICY tenant_isolation_sales_quotations ON sales_quotations
        FOR ALL USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL 
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        );

    -- Price Lists RLS
    DROP POLICY IF EXISTS tenant_isolation_price_lists ON price_lists;
    CREATE POLICY tenant_isolation_price_lists ON price_lists
        FOR ALL USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL 
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        );

    -- Purchase Returns RLS
    DROP POLICY IF EXISTS tenant_isolation_purchase_returns ON purchase_returns;
    CREATE POLICY tenant_isolation_purchase_returns ON purchase_returns
        FOR ALL USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL 
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        );

    -- Product Serials RLS
    DROP POLICY IF EXISTS tenant_isolation_product_serials ON product_serials;
    CREATE POLICY tenant_isolation_product_serials ON product_serials
        FOR ALL USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL 
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        );

    -- Audit Logs RLS
    DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
    CREATE POLICY tenant_isolation_audit_logs ON audit_logs
        FOR ALL USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR tenant_id IS NULL 
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        );
END $$;

-- ----------------------------------------------------------------------------
-- 9. Register Granular Permissions in permissions table
-- ----------------------------------------------------------------------------

INSERT INTO permissions (id, code, module, name_ar, name_en, description_ar, description_en)
VALUES
    -- Operational Expenses
    (gen_random_uuid(), 'treasury.expenses.view', 'Treasury & Cash Management', 'عرض المصروفات التشغيلية', 'View Operational Expenses', 'عرض سندات وقوائم وتصنيفات المصروفات التشغيلية', 'View operational expense vouchers and categories'),
    (gen_random_uuid(), 'treasury.expenses.create', 'Treasury & Cash Management', 'تسجيل سند صرف ومصروف', 'Create Expense Voucher', 'إصدار سند صرف مالي جديد لمصروف تشغيلي', 'Issue a new operational expense voucher'),
    (gen_random_uuid(), 'treasury.expenses.edit', 'Treasury & Cash Management', 'تعديل سندات المصروفات', 'Edit Expense Vouchers', 'تعديل بيانات سند المصروف قبل الاعتماد', 'Edit draft expense voucher details'),
    (gen_random_uuid(), 'treasury.expenses.delete', 'Treasury & Cash Management', 'حذف أو إلغاء سند مصروف', 'Delete Expense Voucher', 'حذف أو إلغاء سند مصروفات تشغيلية', 'Delete or cancel expense vouchers'),
    (gen_random_uuid(), 'treasury.expenses.approve', 'Treasury & Cash Management', 'اعتماد وصرف المصروفات', 'Approve Expense Voucher', 'اعتماد السند وخصم قيمته تلقائياً من الصندوق أو البنك', 'Approve expense and automatically deduct from treasury account'),

    -- Sales Quotations
    (gen_random_uuid(), 'sales.quotations.view', 'Sales & Invoices', 'عرض عروض الأسعار', 'View Sales Quotations', 'استعراض عروض الأسعار الصادرة للعملاء', 'View customer sales quotations'),
    (gen_random_uuid(), 'sales.quotations.create', 'Sales & Invoices', 'إنشاء عرض سعر', 'Create Sales Quotation', 'إنشاء وحفظ عرض سعر رسمي جديد دون خصم مخزني', 'Create a formal price quotation without stock deduction'),
    (gen_random_uuid(), 'sales.quotations.edit', 'Sales & Invoices', 'تعديل عروض الأسعار', 'Edit Sales Quotations', 'تعديل بنود وشروط وتخفيضات عرض السعر', 'Edit sales quotation terms and line items'),
    (gen_random_uuid(), 'sales.quotations.delete', 'Sales & Invoices', 'حذف عروض الأسعار', 'Delete Sales Quotations', 'حذف أو إلغاء عروض الأسعار غير المحولة', 'Delete or cancel unaccepted sales quotations'),
    (gen_random_uuid(), 'sales.quotations.approve', 'Sales & Invoices', 'اعتماد عرض السعر', 'Approve Sales Quotation', 'اعتماد قبول عرض السعر من العميل', 'Approve customer quotation acceptance'),
    (gen_random_uuid(), 'sales.quotations.convert', 'Sales & Invoices', 'تحويل عرض السعر إلى فاتورة', 'Convert Quotation to Invoice', 'تحويل عرض السعر المعتمد إلى فاتورة بيع وخصم المخزون', 'Convert accepted quotation directly into a sales invoice'),

    -- Price Lists & Promotions
    (gen_random_uuid(), 'sales.pricelists.view', 'Sales & Invoices', 'عرض قوائم الأسعار', 'View Price Lists', 'عرض قوائم الأسعار المتعددة والشرائح السعرية', 'View price tiers and multi-level price lists'),
    (gen_random_uuid(), 'sales.pricelists.manage', 'Sales & Invoices', 'إدارة قوائم الأسعار وحزم المنتجات', 'Manage Price Lists & Bundles', 'إنشاء وتعديل قوائم الأسعار وحزم الأصناف والكميات', 'Create and manage tiered price rules, customer price lists, and product kits'),

    -- Purchase Returns
    (gen_random_uuid(), 'purchases.returns.view', 'Purchases & Suppliers', 'عرض مرتجعات المشتريات', 'View Purchase Returns', 'استعراض فواتير وسندات إرجاع البضاعة للموردين', 'View supplier purchase return vouchers'),
    (gen_random_uuid(), 'purchases.returns.create', 'Purchases & Suppliers', 'إنشاء مرتجع مشتريات', 'Create Purchase Return', 'إنشاء مرتجع مشتريات مرتبط بفاتورة شراء أصلية', 'Create a purchase return linked to an original purchase bill'),
    (gen_random_uuid(), 'purchases.returns.edit', 'Purchases & Suppliers', 'تعديل مرتجع المشتريات', 'Edit Purchase Return', 'تعديل كميات وبنود مرتجع المشتريات المسودة', 'Edit draft purchase return quantities and lines'),
    (gen_random_uuid(), 'purchases.returns.delete', 'Purchases & Suppliers', 'حذف مرتجع المشتريات', 'Delete Purchase Return', 'حذف أو إلغاء مرتجع المشتريات غير المعتمد', 'Delete or cancel unapproved purchase return'),
    (gen_random_uuid(), 'purchases.returns.approve', 'Purchases & Suppliers', 'اعتماد مرتجع المشتريات', 'Approve Purchase Return', 'اعتماد المرتجع وخصم المخزن وتعديل ذمة المورد المالية', 'Approve return, deduct inventory, and adjust supplier ledger'),

    -- Serial / IMEI & Warranty Tracking
    (gen_random_uuid(), 'inventory.serials.view', 'Inventory & Warehouses', 'عرض سجلات الأرقام التسلسلية', 'View Serial / IMEI Numbers', 'استعراض وفحص الأرقام التسلسلية وبطاقات الضمان', 'View product serial/IMEI records and warranty cards'),
    (gen_random_uuid(), 'inventory.serials.manage', 'Inventory & Warehouses', 'إدارة الأرقام التسلسلية والضمان', 'Manage Serials & Warranties', 'تسجيل وتعديل وتحديث حالة الأرقام التسلسلية وفترات الضمان', 'Register, update, and manage serial numbers and warranty lifecycles')
ON CONFLICT (code) DO NOTHING;

-- Grant all new permissions to SuperAdmin role
INSERT INTO user_permissions (user_id, permission_code)
SELECT u.id, p.code
FROM users u
CROSS JOIN permissions p
WHERE u.role IN ('SuperAdmin', 'PlatformSuperAdmin')
  AND p.code IN (
      'treasury.expenses.view', 'treasury.expenses.create', 'treasury.expenses.edit', 'treasury.expenses.delete', 'treasury.expenses.approve',
      'sales.quotations.view', 'sales.quotations.create', 'sales.quotations.edit', 'sales.quotations.delete', 'sales.quotations.approve', 'sales.quotations.convert',
      'sales.pricelists.view', 'sales.pricelists.manage',
      'purchases.returns.view', 'purchases.returns.create', 'purchases.returns.edit', 'purchases.returns.delete', 'purchases.returns.approve',
      'inventory.serials.view', 'inventory.serials.manage'
  )
ON CONFLICT (user_id, permission_code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 10. Seed Initial Expense Categories & Price Lists
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        -- Seed Standard Expense Categories
        INSERT INTO expense_categories (tenant_id, code, name, description)
        VALUES 
            (t.id, 'EXP-RENT', 'إيجارات ومقرات', 'مصروفات إيجار المحلات والمستودعات والمكاتب'),
            (t.id, 'EXP-UTIL', 'فواتير وطاقة وخدمات', 'كهرباء، ماء، إنترنت، ومولدات'),
            (t.id, 'EXP-SAL', 'رواتب وأجور تشغيلية', 'رواتب الكوادر، مكافآت، وبدلات تشغيل'),
            (t.id, 'EXP-MAINT', 'صيانة وتشغيل', 'صيانة المعدات، تجديدات الديكور، ومستلزمات الورش'),
            (t.id, 'EXP-LOG', 'شحن ونقل ولوجستيات', 'أجور التوصيل، بنزين المركبات، والجمارك')
        ON CONFLICT (tenant_id, lower(code)) DO NOTHING;

        -- Seed Standard Price Lists
        INSERT INTO price_lists (tenant_id, code, name, is_default, description)
        VALUES
            (t.id, 'PL-RETAIL', 'سعر البيع بالتجزئة (قطاعي)', TRUE, 'قائمة أسعار البيع المباشر للمستهلك'),
            (t.id, 'PL-WHOLESALE', 'سعر الجملة', FALSE, 'أسعار مخفضة لتجار الجملة والمحلات'),
            (t.id, 'PL-VIP', 'سعر كبار العملاء (VIP)', FALSE, 'أسعار وخصومات خاصة للعملاء المميزين')
        ON CONFLICT (tenant_id, lower(code)) DO NOTHING;
    END LOOP;
END $$;
