-- ==========================================================
-- PostgreSQL Database Schema: Enterprise ERP Warehouse & Inventory
-- Engine: PostgreSQL 16+ with Foreign Keys & Trigger Automations
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Warehouses Table (المستودعات والمخازن)
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    manager_name VARCHAR(150),
    contact_phone VARCHAR(50),
    type VARCHAR(20) NOT NULL DEFAULT 'STORE', -- 'STORE' (صالة عرض / بيع مباشر), 'WAREHOUSE' (مستودع تخزيني / يتطلب صرف أمين مخزن)
    total_capacity NUMERIC(12, 2) DEFAULT 10000.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories Table (تصنيفات البضائع والمنتجات)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products Table (دليل الأصناف والمنتجات)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_profit_margin NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    max_cashier_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    unit_of_measure VARCHAR(50) DEFAULT 'قطعة (Piece)',
    min_stock_level INT DEFAULT 10,
    max_stock_level INT DEFAULT 500,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Warehouse Stock (الأرصدة الحالية لكل صنف في كل مستودع)
CREATE TABLE IF NOT EXISTS warehouse_stock (
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    shelf_location VARCHAR(100),
    last_counted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (warehouse_id, product_id)
);

-- 5. Suppliers Table (الموردون وجهات التوريد)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(150),
    address TEXT,
    current_balance NUMERIC(14, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Customers Table (العملاء ونقاط التوزيع)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(150),
    tax_number VARCHAR(100),
    credit_limit NUMERIC(14, 2) DEFAULT 5000.00,
    current_balance NUMERIC(14, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Stock Movements (سجل حركات المخزون: استلام، صرف، نقل، جرد)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_number VARCHAR(100) UNIQUE NOT NULL,
    movement_type VARCHAR(50) NOT NULL, -- 'IN' (إدخال), 'OUT' (صرف), 'TRANSFER' (نقل), 'ADJUSTMENT' (تسوية جردية)
    from_warehouse_id UUID REFERENCES warehouses(id),
    to_warehouse_id UUID REFERENCES warehouses(id),
    reference_number VARCHAR(100),
    notes TEXT,
    created_by VARCHAR(100),
    movement_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Stock Movement Items (تفاصيل الأصناف في الحركة)
CREATE TABLE IF NOT EXISTS stock_movement_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_id UUID REFERENCES stock_movements(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL
);

-- 9. Staff Users & Roles (موظفو المبيعات والصلاحيات والرموز السرية)
CREATE TABLE IF NOT EXISTS staff_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Cashier', -- 'Cashier', 'Supervisor', 'Admin'
    pin_hash VARCHAR(255) NOT NULL,
    max_discount_percent NUMERIC(5, 2) DEFAULT 5.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Sales Invoices (فواتير المبيعات ونقاط البيع POS)
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
    dispense_mode VARCHAR(20) NOT NULL DEFAULT 'IN_STORE', -- 'IN_STORE' (صرف فوري من المحل), 'WAREHOUSE_DISPATCH' (طلب تجهيز من المخزن)
    fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'FULFILLED', -- 'FULFILLED', 'PENDING_DISPATCH'
    cashier_id VARCHAR(50) DEFAULT 'CSH-01',
    cashier_name VARCHAR(150),
    subtotal NUMERIC(14, 2) NOT NULL,
    tax_amount NUMERIC(14, 2) DEFAULT 0.00,
    discount_amount NUMERIC(14, 2) DEFAULT 0.00,
    total_amount NUMERIC(14, 2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'PAID', -- 'PAID', 'PARTIAL', 'CREDIT'
    payment_method VARCHAR(50) DEFAULT 'CASH', -- 'CASH', 'CARD', 'TRANSFER'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Sales Invoice Items (بنود الفاتورة مع تفاصيل الخصم والاعتماد)
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    source_warehouse_id UUID REFERENCES warehouses(id),
    quantity INT NOT NULL,
    original_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_type VARCHAR(20) DEFAULT 'NONE', -- 'NONE', 'PERCENT', 'FIXED'
    discount_value NUMERIC(10, 2) DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(14, 2) NOT NULL,
    was_manager_override BOOLEAN DEFAULT FALSE,
    approved_by_manager_id VARCHAR(50)
);

-- 12. Discount Audit Trail (سجل الرقابة وتتبع الخصومات الاستثنائية)
CREATE TABLE IF NOT EXISTS discount_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_sku VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    discount_type VARCHAR(20) NOT NULL, -- 'PERCENT', 'FIXED'
    discount_value NUMERIC(10, 2) NOT NULL,
    discount_amount_money NUMERIC(12, 2) NOT NULL,
    original_retail_price NUMERIC(12, 2) NOT NULL,
    final_selling_price NUMERIC(12, 2) NOT NULL,
    cashier_id VARCHAR(100) NOT NULL,
    cashier_name VARCHAR(150),
    was_manager_override BOOLEAN DEFAULT FALSE,
    approved_by_manager_id VARCHAR(100),
    approved_by_manager_name VARCHAR(150),
    override_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_stock_product ON warehouse_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movement_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_audit_invoice ON discount_audit_logs(invoice_number);
CREATE INDEX IF NOT EXISTS idx_audit_created ON discount_audit_logs(created_at);

-- 13. Purchase Bills (قوائم وفواتير مشتريات الموردين والتوريد المخزني)
CREATE TABLE IF NOT EXISTS purchase_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    supplier_ref_no VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    payment_terms VARCHAR(50) NOT NULL DEFAULT 'CASH', -- 'CASH', 'CREDIT', 'PARTIAL'
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    shipping_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    net_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    treasury_account_id VARCHAR(100),
    bill_status VARCHAR(50) NOT NULL DEFAULT 'POSTED',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Purchase Bill Items (تفاصيل بنود قائمة المشتريات)
CREATE TABLE IF NOT EXISTS purchase_bill_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    item_sku VARCHAR(100) NOT NULL,
    item_barcode VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'قطعة',
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0.00),
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(14, 2) NOT NULL,
    is_newly_created_product BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. FIFO Cost Batches (دفعات التكلفة بنظام الوارد أولاً يصرف أولاً)
CREATE TABLE IF NOT EXISTS fifo_cost_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    purchase_bill_id UUID REFERENCES purchase_bills(id) ON DELETE SET NULL,
    batch_reference VARCHAR(100) NOT NULL,
    batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    initial_quantity INT NOT NULL CHECK (initial_quantity > 0),
    remaining_quantity INT NOT NULL CHECK (remaining_quantity >= 0),
    unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0.00),
    is_exhausted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Supplier Ledgers (سجل حسابات الموردين والذمم الدائنة)
CREATE TABLE IF NOT EXISTS supplier_ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(50) NOT NULL, -- 'PURCHASE_BILL', 'PAYMENT_VOUCHER'
    reference_id UUID,
    reference_number VARCHAR(100) NOT NULL,
    debit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    credit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    running_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_bills_supplier ON purchase_bills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_bill ON purchase_bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_fifo_product ON fifo_cost_batches(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger ON supplier_ledgers(supplier_id);

-- ============================================================================
-- 17. Multi-Tenant Architecture & Tenant-Scoped Identity
-- Format: [username]@[company_slug] (e.g. mustafa@m, admin@m)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    country_code VARCHAR(10) NOT NULL DEFAULT 'IQ',
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_lower_slug ON tenants (LOWER(slug));

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'Cashier',
    branch_id VARCHAR(50) DEFAULT 'WH-01',
    default_warehouse_id VARCHAR(50) DEFAULT 'WH-01',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Drop single unique index if exists
DROP INDEX IF EXISTS idx_users_username;

-- Composite Unique Constraint: UNIQUE (tenant_id, LOWER(username))
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_lower_username 
    ON users (tenant_id, LOWER(username));

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);

-- Seed Default Tenant 'm'
INSERT INTO tenants (id, name, slug, country_code, currency, is_active)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    'مؤسسة مصطفى للتجارة والحلول البرمجية',
    'm',
    'IQ',
    'IQD',
    TRUE
)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

-- 12. Permissions Table (Granular PBAC System)
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_code ON permissions (code);
CREATE INDEX IF NOT EXISTS idx_permissions_group_name ON permissions (group_name);

-- 13. User Permissions Join Table
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_code VARCHAR(100) NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_code ON user_permissions (permission_code);

-- 14. Warehouse Dispatch Orders Queue (طابور مهام أمين المخزن)
CREATE TABLE IF NOT EXISTS warehouse_dispatch_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    customer_name VARCHAR(150),
    cashier_name VARCHAR(150),
    items_snapshot JSONB NOT NULL,
    total_quantity INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'FULFILLED', 'CANCELLED'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    fulfilled_by VARCHAR(150)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_orders_tenant_status ON warehouse_dispatch_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_warehouse_status ON warehouse_dispatch_orders(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_invoice ON warehouse_dispatch_orders(invoice_id);



