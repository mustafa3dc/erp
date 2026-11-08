-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16 Initialization
-- Script 02: Core Table Definitions with Strict Precision & Check Constraints
-- ============================================================================

-- 1. Warehouses (المستودعات والمخازن)
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    location_address TEXT,
    manager_name VARCHAR(150),
    contact_phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories (تصنيفات الأصناف)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products Catalog (دليل الأصناف والمواد)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'PIECE',
    cost_price NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (cost_price >= 0.0000),
    selling_price NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (selling_price >= 0.0000),
    min_stock_alert NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (min_stock_alert >= 0.0000),
    max_stock_capacity NUMERIC(18, 4) NOT NULL DEFAULT 100000.0000 CHECK (max_stock_capacity >= min_stock_alert),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Customers (العملاء والزبائن)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(150),
    tax_number VARCHAR(100),
    credit_limit NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (credit_limit >= 0.0000),
    current_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Suppliers (الموردون وجهات التجهيز)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(150),
    current_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Current Inventory Balances (الأرصدة الحالية في كل مستودع)
CREATE TABLE IF NOT EXISTS inventory_balances (
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (quantity_on_hand >= 0.0000),
    quantity_reserved NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (quantity_reserved >= 0.0000),
    shelf_location VARCHAR(100),
    last_movement_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (warehouse_id, product_id),
    CONSTRAINT chk_reserved_not_exceed_on_hand CHECK (quantity_reserved <= quantity_on_hand)
);

-- 7. Immutable Inventory Audit Ledger (سجل الحركات المزدوج غير القابل للتعديل أو الحذف)
CREATE TABLE IF NOT EXISTS inventory_audit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    entry_number BIGSERIAL NOT NULL UNIQUE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN (
        'INBOUND_PURCHASE',
        'OUTBOUND_SALE',
        'TRANSFER_OUT',
        'TRANSFER_IN',
        'INVENTORY_AUDIT_ADJUSTMENT',
        'RETURN_INBOUND',
        'RETURN_OUTBOUND'
    )),
    quantity_delta NUMERIC(18, 4) NOT NULL CHECK (quantity_delta <> 0.0000),
    balance_after NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (balance_after >= 0.0000),
    unit_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (unit_cost >= 0.0000),
    total_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (total_cost >= 0.0000),
    reference_type VARCHAR(50) NOT NULL,
    reference_id UUID,
    reference_code VARCHAR(100) NOT NULL,
    operator_user_id VARCHAR(100) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Sales Invoices (فواتير ووصولات المبيعات)
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (subtotal >= 0.0000),
    discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (discount_amount >= 0.0000),
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (tax_amount >= 0.0000),
    grand_total NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (grand_total >= 0.0000),
    paid_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (paid_amount >= 0.0000),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID', 'VOID')),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'CUSTOMER_ACCOUNT_DEBIT')),
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Sales Invoice Items (بنود فواتير المبيعات)
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0.0000),
    unit_price NUMERIC(18, 4) NOT NULL CHECK (unit_price >= 0.0000),
    total_price NUMERIC(18, 4) NOT NULL CHECK (total_price >= 0.0000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Purchase Orders (أوامر الشراء والتوريد)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    target_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (total_amount >= 0.0000),
    order_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (order_status IN ('PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED')),
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Purchase Order Items (بنود أوامر الشراء)
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    ordered_quantity NUMERIC(18, 4) NOT NULL CHECK (ordered_quantity > 0.0000),
    received_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (received_quantity >= 0.0000),
    unit_cost NUMERIC(18, 4) NOT NULL CHECK (unit_cost >= 0.0000),
    total_cost NUMERIC(18, 4) NOT NULL CHECK (total_cost >= 0.0000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Performance & Full-Text / Barcode Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ledger_warehouse_product ON inventory_audit_ledger (warehouse_id, product_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction_id ON inventory_audit_ledger (transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entry_number ON inventory_audit_ledger (entry_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON sales_invoices (created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON sales_invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders (created_at);

-- ============================================================================
-- 12. Warehouse Stock Aggregate & Concurrency Token (EF Core Concurrency)
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouse_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL,
    item_id UUID NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    reserved_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    xmin UINT,
    CONSTRAINT uq_wh_item UNIQUE (warehouse_id, item_id),
    CONSTRAINT chk_stock_positive CHECK (quantity >= 0),
    CONSTRAINT chk_reserved_positive CHECK (reserved_quantity >= 0),
    CONSTRAINT chk_available_positive CHECK (quantity >= reserved_quantity)
);

-- ============================================================================
-- 13. Stock Movements (Immutable Double-Entry Ledger for EF Core)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_type INT NOT NULL,
    item_id UUID NOT NULL,
    source_warehouse_id UUID,
    target_warehouse_id UUID,
    quantity NUMERIC(18, 4) NOT NULL,
    cost_per_unit NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    total_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    reference_id UUID,
    reference_code VARCHAR(100),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_movement_qty_nonzero CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements (item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements (created_at);

