-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16 Initialization
-- Script 01: Core Extensions
-- ============================================================================

-- UUID generation functions (e.g., gen_random_uuid(), uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigram matching for ultra-fast partial/fuzzy barcode, SKU, and item search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- B-Tree GIST and GIN for composite indexing and exclusion constraints
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
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

-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16 Initialization
-- Script 03: Automated Invariant Triggers, Immutability & Double-Entry Ledger
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Timestamp Automation: set updated_at on row mutation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON warehouses;
CREATE TRIGGER trg_warehouses_updated_at
BEFORE UPDATE ON warehouses
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Ledger Immutability Rule: Strict Block on UPDATE or DELETE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ERR_LEDGER_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = 'ERR_LEDGER_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_modification ON inventory_audit_ledger;
CREATE TRIGGER trg_prevent_ledger_modification
BEFORE UPDATE OR DELETE ON inventory_audit_ledger
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_ledger_modification();

-- ----------------------------------------------------------------------------
-- 3. Balance Direct Update Protection: Prohibit manual balance alterations
--    Balances must strictly and exclusively be altered via the Ledger pipeline
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prevent_direct_balance_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Permit changes only if the transaction explicitly sets the internal dispatch flag
    IF current_setting('erp.internal_ledger_dispatch', true) IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'ERR_DIRECT_BALANCE_UPDATE_PROHIBITED'
            USING ERRCODE = 'P0005',
                  DETAIL = 'ERR_DIRECT_BALANCE_UPDATE_PROHIBITED';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_direct_balance_update ON inventory_balances;
CREATE TRIGGER trg_prevent_direct_balance_update
BEFORE INSERT OR UPDATE OR DELETE ON inventory_balances
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_direct_balance_modification();

-- ----------------------------------------------------------------------------
-- 4. Double-Entry Verification: BEFORE INSERT on inventory_audit_ledger
--    - Verifies warehouse and product active status
--    - Row-locks current inventory balance with SELECT FOR UPDATE
--    - Enforces balance_after = current_on_hand + quantity_delta >= 0.0000
--    - Calculates total_cost if unpopulated
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_ledger_entry_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_warehouse_active BOOLEAN;
    v_product_active BOOLEAN;
    v_current_on_hand NUMERIC(18, 4);
    v_calculated_balance NUMERIC(18, 4);
BEGIN
    -- Verify warehouse status
    SELECT is_active INTO v_warehouse_active
    FROM warehouses
    WHERE id = NEW.warehouse_id;

    IF v_warehouse_active IS NULL OR v_warehouse_active = FALSE THEN
        RAISE EXCEPTION 'ERR_WAREHOUSE_INACTIVE'
            USING ERRCODE = 'P0006',
                  DETAIL = 'ERR_WAREHOUSE_INACTIVE';
    END IF;

    -- Verify product status
    SELECT is_active INTO v_product_active
    FROM products
    WHERE id = NEW.product_id;

    IF v_product_active IS NULL OR v_product_active = FALSE THEN
        RAISE EXCEPTION 'ERR_PRODUCT_INACTIVE'
            USING ERRCODE = 'P0007',
                  DETAIL = 'ERR_PRODUCT_INACTIVE';
    END IF;

    -- Ensure balance record exists; create initial 0.0000 row if not present
    PERFORM set_config('erp.internal_ledger_dispatch', 'active', true);
    INSERT INTO inventory_balances (
        warehouse_id,
        product_id,
        quantity_on_hand,
        quantity_reserved,
        last_movement_at
    )
    VALUES (
        NEW.warehouse_id,
        NEW.product_id,
        0.0000,
        0.0000,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (warehouse_id, product_id) DO NOTHING;
    PERFORM set_config('erp.internal_ledger_dispatch', 'inactive', true);

    -- Row lock for concurrency safety within database transaction
    SELECT quantity_on_hand INTO v_current_on_hand
    FROM inventory_balances
    WHERE warehouse_id = NEW.warehouse_id
      AND product_id = NEW.product_id
    FOR UPDATE;

    v_calculated_balance := v_current_on_hand + NEW.quantity_delta;

    -- Negative stock prevention
    IF v_calculated_balance < 0.0000 THEN
        RAISE EXCEPTION 'ERR_INSUFFICIENT_STOCK'
            USING ERRCODE = 'P0002',
                  DETAIL = 'ERR_INSUFFICIENT_STOCK';
    END IF;

    -- Enforce balance_after parity or assign computed balance
    IF NEW.balance_after IS NOT NULL AND NEW.balance_after <> 0.0000 AND NEW.balance_after <> v_calculated_balance THEN
        RAISE EXCEPTION 'ERR_LEDGER_BALANCE_MISMATCH'
            USING ERRCODE = 'P0004',
                  DETAIL = 'ERR_LEDGER_BALANCE_MISMATCH';
    END IF;
    NEW.balance_after := v_calculated_balance;

    -- Calculate total_cost if zero and unit_cost provided
    IF NEW.total_cost = 0.0000 AND NEW.unit_cost > 0.0000 THEN
        NEW.total_cost := ROUND(ABS(NEW.quantity_delta) * NEW.unit_cost, 4);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_ledger_before_insert ON inventory_audit_ledger;
CREATE TRIGGER trg_validate_ledger_before_insert
BEFORE INSERT ON inventory_audit_ledger
FOR EACH ROW
EXECUTE FUNCTION fn_validate_ledger_entry_before_insert();

-- ----------------------------------------------------------------------------
-- 5. Atomic Stock Balance Propagation: AFTER INSERT on inventory_audit_ledger
--    Updates inventory_balances.quantity_on_hand to match NEW.balance_after
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_propagate_ledger_to_balance()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM set_config('erp.internal_ledger_dispatch', 'active', true);

    UPDATE inventory_balances
    SET quantity_on_hand = NEW.balance_after,
        last_movement_at = NEW.recorded_at
    WHERE warehouse_id = NEW.warehouse_id
      AND product_id = NEW.product_id;

    PERFORM set_config('erp.internal_ledger_dispatch', 'inactive', true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_propagate_ledger_to_balance ON inventory_audit_ledger;
CREATE TRIGGER trg_propagate_ledger_to_balance
AFTER INSERT ON inventory_audit_ledger
FOR EACH ROW
EXECUTE FUNCTION fn_propagate_ledger_to_balance();

-- ----------------------------------------------------------------------------
-- 6. Customer Credit Limit & Balance Management on Sales Invoices
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_process_sales_invoice_credit()
RETURNS TRIGGER AS $$
DECLARE
    v_unpaid_amount NUMERIC(18, 4);
    v_customer_credit_limit NUMERIC(18, 4);
    v_customer_current_balance NUMERIC(18, 4);
BEGIN
    v_unpaid_amount := NEW.grand_total - NEW.paid_amount;

    IF v_unpaid_amount > 0.0000 THEN
        SELECT credit_limit, current_balance
        INTO v_customer_credit_limit, v_customer_current_balance
        FROM customers
        WHERE id = NEW.customer_id
        FOR UPDATE;

        IF v_customer_credit_limit > 0.0000 AND (v_customer_current_balance + v_unpaid_amount) > v_customer_credit_limit THEN
            RAISE EXCEPTION 'ERR_CUSTOMER_CREDIT_LIMIT_EXCEEDED'
                USING ERRCODE = 'P0003',
                      DETAIL = 'ERR_CUSTOMER_CREDIT_LIMIT_EXCEEDED';
        END IF;

        UPDATE customers
        SET current_balance = current_balance + v_unpaid_amount,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.customer_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_sales_invoice_credit ON sales_invoices;
CREATE TRIGGER trg_process_sales_invoice_credit
BEFORE INSERT ON sales_invoices
FOR EACH ROW
EXECUTE FUNCTION fn_process_sales_invoice_credit();

-- ----------------------------------------------------------------------------
-- 7. Audit Tampering Prevention for stock_movements (Immutable Ledger)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ERR.DATABASE.SECURITY.IMMUTABLE_AUDIT_LOG_MODIFICATION_PROHIBITED';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON stock_movements;
CREATE TRIGGER trg_stock_movements_immutable
BEFORE UPDATE OR DELETE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_tampering();

-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16
-- Script 04: Purchase Bills, FIFO Cost Batches & Supplier Ledgers
-- Supports Atomic DB Transaction for Inbound Receiving & Inline SKU Creation
-- ============================================================================

-- 1. Purchase Bills (فواتير وقوائم مشتريات الموردين)
CREATE TABLE IF NOT EXISTS purchase_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    supplier_ref_no VARCHAR(100) NOT NULL, -- رقم قائمة التاجر الورقية
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    payment_terms VARCHAR(50) NOT NULL DEFAULT 'CASH' CHECK (payment_terms IN ('CASH', 'CREDIT', 'PARTIAL')),
    subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (subtotal >= 0.0000),
    discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (discount_amount >= 0.0000),
    shipping_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (shipping_cost >= 0.0000),
    net_total NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (net_total >= 0.0000),
    paid_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (paid_amount >= 0.0000),
    balance_due NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (balance_due >= 0.0000),
    treasury_account_id VARCHAR(100),
    bill_status VARCHAR(50) NOT NULL DEFAULT 'POSTED' CHECK (bill_status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    notes TEXT,
    created_by VARCHAR(100) NOT NULL DEFAULT 'Admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Purchase Bill Line Items (بنود قائمة المشتريات)
CREATE TABLE IF NOT EXISTS purchase_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    item_sku VARCHAR(100) NOT NULL,
    item_barcode VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'قطعة',
    quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0.0000),
    unit_cost NUMERIC(18, 4) NOT NULL CHECK (unit_cost >= 0.0000),
    selling_price NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (selling_price >= 0.0000),
    line_total NUMERIC(18, 4) NOT NULL CHECK (line_total >= 0.0000),
    is_newly_created_product BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. FIFO Cost Batches (دفعات التكلفة بنظام الوارد أولاً يصرف أولاً)
CREATE TABLE IF NOT EXISTS fifo_cost_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    purchase_bill_id UUID REFERENCES purchase_bills(id) ON DELETE SET NULL,
    batch_reference VARCHAR(100) NOT NULL,
    batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    initial_quantity NUMERIC(18, 4) NOT NULL CHECK (initial_quantity > 0.0000),
    remaining_quantity NUMERIC(18, 4) NOT NULL CHECK (remaining_quantity >= 0.0000),
    unit_cost NUMERIC(18, 4) NOT NULL CHECK (unit_cost >= 0.0000),
    is_exhausted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_remaining_not_exceed_initial CHECK (remaining_quantity <= initial_quantity)
);

-- 4. Supplier Ledgers (سجل حسابات وديون الموردين والذمم الدائنة)
CREATE TABLE IF NOT EXISTS supplier_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('PURCHASE_BILL', 'PAYMENT_VOUCHER', 'DEBIT_NOTE', 'OPENING_BALANCE')),
    reference_id UUID,
    reference_number VARCHAR(100) NOT NULL,
    debit NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (debit >= 0.0000),   -- مدين (سداد)
    credit NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (credit >= 0.0000), -- دائن (فاتورة جديدة / دين)
    running_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Stock Transactions (سجل العمليات والحركات المخزنية الواردة والصادرة)
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_code VARCHAR(100) UNIQUE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('Inbound_Purchase', 'Outbound_Sale', 'Transfer', 'Adjustment', 'Return')),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0.0000),
    unit_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    reference_number VARCHAR(100),
    from_party VARCHAR(255),
    to_party VARCHAR(255),
    operator_name VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_bills_supplier ON purchase_bills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_date ON purchase_bills(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_status ON purchase_bills(bill_status);
CREATE INDEX IF NOT EXISTS idx_purchase_items_bill ON purchase_bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_bill_items(product_id);
CREATE INDEX IF NOT EXISTS idx_fifo_product_remaining ON fifo_cost_batches(product_id, warehouse_id, is_exhausted);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier ON supplier_ledgers(supplier_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_type ON stock_transactions(transaction_type, created_at);
-- ============================================================================
-- Feature Directive: Tenant-Scoped Identity & Auto-Prefixed Usernames
-- Script 05: Multi-Tenant Architecture & Composite Unique Constraint
-- Standard Format: [username]@[company_slug] (e.g. mustafa@m, admin@m)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants Table (الشركات والمنشآت المستأجرة)
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

-- Case-insensitive unique index on tenant slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_lower_slug ON tenants (LOWER(slug));

-- 2. Users Table with Tenant-Scoped Identity
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

-- Ensure any global unique constraint on username alone is dropped
DROP INDEX IF EXISTS idx_users_username;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- 3. Composite Unique Constraint: UNIQUE (tenant_id, LOWER(username))
-- Enables multiple tenants to have identical usernames (e.g. admin, cashier) without collision
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_lower_username 
    ON users (tenant_id, LOWER(username));

-- Index on tenant_id for high performance foreign key lookups
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);

-- 4. Seed Default Tenant & Standard Users
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

-- ============================================================================
-- Feature Directive: SaaS Control Plane Isolation & Platform SuperAdmin
-- Script 06: Platform SuperAdmin Role, Tenant Quotas, and Suspension Kill Switch
-- ============================================================================

-- 1. Upgrade Tenants Table with SaaS Quotas, Plan, and Expiration
ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS plan VARCHAR(50) NOT NULL DEFAULT 'Pro',
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    ADD COLUMN IF NOT EXISTS max_branches INT NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS max_users INT NOT NULL DEFAULT 20;

-- 2. Make tenant_id Nullable in users table for Platform SuperAdmin (SaaS Owner)
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;

-- 3. Composite Unique Constraint for Tenant-Scoped Identity
-- Dropping old global constraints if any remain
DROP INDEX IF EXISTS idx_users_username;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- Composite constraint: UNIQUE (tenant_id, LOWER(username))
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_lower_username 
    ON users (tenant_id, LOWER(username));

-- Unique constraint for Platform SuperAdmin accounts where tenant_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_platform_superadmin 
    ON users (LOWER(username)) WHERE tenant_id IS NULL;

-- 4. Seed Platform SuperAdmin Account (SaaS Owner)
INSERT INTO users (
    id, tenant_id, username, password_hash, full_name, email, phone, role, branch_id, default_warehouse_id, is_active
)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    NULL,
    'superadmin',
    'AQAAAAIAAYagAAAAEG3g1Vz5jXk...', -- standard hash for '123'
    'المدير العام للمنصة (SaaS Platform Owner)',
    'owner@zilox.cloud',
    '+964 770 000 0000',
    'PlatformSuperAdmin',
    'PLATFORM',
    'PLATFORM',
    TRUE
)
ON CONFLICT DO NOTHING;

-- 5. Seed Additional Demonstration Tenants
INSERT INTO tenants (id, name, slug, country_code, currency, plan, expires_at, max_branches, max_users, is_active)
VALUES 
    (
        'b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid,
        'شركة بغداد للتجارة والتوكيلات',
        'baghdad',
        'IQ',
        'IQD',
        'Enterprise',
        CURRENT_TIMESTAMP + INTERVAL '180 days',
        10,
        50,
        TRUE
    ),
    (
        'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid,
        'مجموعة أربيل للتوريدات العامة',
        'erbil',
        'IQ',
        'USD',
        'Pro',
        CURRENT_TIMESTAMP + INTERVAL '5 days', -- Expiring soon test
        3,
        15,
        TRUE
    ),
    (
        'd4e5f6a7-b8c9-0123-def1-234567890123'::uuid,
        'شركة البصرة للخدمات اللوجستية',
        'basra',
        'IQ',
        'IQD',
        'Starter',
        CURRENT_TIMESTAMP - INTERVAL '2 days',
        1,
        5,
        FALSE -- Suspended test (Kill Switch)
    )
ON CONFLICT (slug) DO UPDATE SET
    plan = EXCLUDED.plan,
    expires_at = EXCLUDED.expires_at,
    max_branches = EXCLUDED.max_branches,
    max_users = EXCLUDED.max_users,
    is_active = EXCLUDED.is_active;
-- ============================================================================
-- Feature Directive: Public Pricing Calculator & Automated Self-Service Onboarding
-- Script 07: Public Tenant Registration, Trial Management, Features & Default Operational Entities
-- ============================================================================

-- 1. Upgrade Tenants Table for Self-Service Onboarding & Feature Flags
ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
    ADD COLUMN IF NOT EXISTS features_enabled JSONB DEFAULT '{"wms": false, "pos": true}'::jsonb,
    ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'yearly',
    ADD COLUMN IF NOT EXISTS contact_info VARCHAR(150);

-- 2. Link Warehouses to Multi-Tenant Partitioning
ALTER TABLE warehouses 
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_id ON warehouses (tenant_id);

-- 3. Cash Boxes Table (صناديق الكاش والخزائن النقدية لنقاط البيع)
CREATE TABLE IF NOT EXISTS cash_boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    current_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (current_balance >= 0.0000),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cash_boxes_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cash_boxes_tenant_id ON cash_boxes (tenant_id);

-- 4. Atomic PostgreSQL Function for 100% Automated Self-Service Registration
CREATE OR REPLACE FUNCTION fn_register_tenant_self_service(
    p_company_name VARCHAR(150),
    p_slug VARCHAR(50),
    p_country_code VARCHAR(10),
    p_currency VARCHAR(10),
    p_max_warehouses INT,
    p_max_users INT,
    p_wms_enabled BOOLEAN,
    p_pos_enabled BOOLEAN,
    p_billing_cycle VARCHAR(20),
    p_admin_full_name VARCHAR(150),
    p_admin_username VARCHAR(100),
    p_password_hash VARCHAR(255),
    p_contact_info VARCHAR(150)
)
RETURNS TABLE (
    tenant_id UUID,
    user_id UUID,
    warehouse_id UUID,
    cash_box_id UUID,
    full_username VARCHAR(150),
    trial_ends_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_slug VARCHAR(50);
    v_tenant_id UUID;
    v_warehouse_id UUID;
    v_cash_box_id UUID;
    v_user_id UUID;
    v_full_username VARCHAR(150);
    v_trial_ends_at TIMESTAMP WITH TIME ZONE;
    v_features JSONB;
BEGIN
    -- Step A: Validate and Sanitize Slug
    v_clean_slug := LOWER(TRIM(p_slug));
    IF v_clean_slug = '' OR v_clean_slug IS NULL THEN
        RAISE EXCEPTION 'رمز المنشأة (Slug) مطلوب ولا يمكن تركه فارغاً.';
    END IF;

    IF EXISTS (SELECT 1 FROM tenants WHERE LOWER(slug) = v_clean_slug) THEN
        RAISE EXCEPTION 'رمز المنشأة (%) محجوز مسبقاً، يرجى اختيار رمز آخر.', v_clean_slug;
    END IF;

    -- Step B: Setup Dates and Feature Flags
    v_trial_ends_at := CURRENT_TIMESTAMP + INTERVAL '14 days';
    v_features := jsonb_build_object('wms', p_wms_enabled, 'pos', p_pos_enabled);

    -- Step C: Insert Tenant
    INSERT INTO tenants (
        name, slug, country_code, currency, plan, 
        max_branches, max_users, is_active, 
        trial_ends_at, expires_at, features_enabled, 
        billing_cycle, contact_info
    )
    VALUES (
        TRIM(p_company_name),
        v_clean_slug,
        COALESCE(NULLIF(p_country_code, ''), 'IQ'),
        COALESCE(NULLIF(p_currency, ''), 'IQD'),
        CASE 
            WHEN p_max_warehouses > 5 OR p_max_users > 20 THEN 'Enterprise'
            WHEN p_max_warehouses > 1 OR p_max_users > 5 THEN 'Pro'
            ELSE 'Starter'
        END,
        GREATEST(p_max_warehouses, 1),
        GREATEST(p_max_users, 3),
        TRUE,
        v_trial_ends_at,
        v_trial_ends_at,
        v_features,
        COALESCE(NULLIF(p_billing_cycle, ''), 'yearly'),
        TRIM(p_contact_info)
    )
    RETURNING id INTO v_tenant_id;

    -- Step D: Insert Default Main Warehouse (المستودع الرئيسي)
    INSERT INTO warehouses (
        tenant_id, code, name, location_address, manager_name, contact_phone, is_active
    )
    VALUES (
        v_tenant_id,
        'WH-01',
        'المستودع الرئيسي',
        'الفرع الرئيسي - الإدارة المركزية',
        p_admin_full_name,
        p_contact_info,
        TRUE
    )
    RETURNING id INTO v_warehouse_id;

    -- Step E: Insert Default Cash Box (صندوق الكاش الافتراضي)
    INSERT INTO cash_boxes (
        tenant_id, code, name, warehouse_id, currency, current_balance, is_active
    )
    VALUES (
        v_tenant_id,
        'CB-01',
        'صندوق الكاش الافتراضي (الخزينة الرئيسية)',
        v_warehouse_id,
        COALESCE(NULLIF(p_currency, ''), 'IQD'),
        0.0000,
        TRUE
    )
    RETURNING id INTO v_cash_box_id;

    -- Step F: Insert First Admin Account (Tenant Owner)
    v_full_username := LOWER(TRIM(p_admin_username)) || '@' || v_clean_slug;

    INSERT INTO users (
        tenant_id, username, password_hash, full_name, email, phone, 
        role, branch_id, default_warehouse_id, is_active, notes
    )
    VALUES (
        v_tenant_id,
        LOWER(TRIM(p_admin_username)),
        p_password_hash,
        TRIM(p_admin_full_name),
        CASE WHEN p_contact_info LIKE '%@%' THEN TRIM(p_contact_info) ELSE LOWER(TRIM(p_admin_username)) || '@' || v_clean_slug || '.zilox.com' END,
        CASE WHEN p_contact_info NOT LIKE '%@%' AND p_contact_info IS NOT NULL THEN TRIM(p_contact_info) ELSE '+964 770 000 0000' END,
        'SuperAdmin',
        'WH-01',
        'WH-01',
        TRUE,
        'حساب مالك المنشأة الأول المنشأ آلياً عبر بوابة التسجيل الذاتي'
    )
    RETURNING id INTO v_user_id;

    -- Step G: Return result tuple
    RETURN QUERY
    SELECT 
        v_tenant_id,
        v_user_id,
        v_warehouse_id,
        v_cash_box_id,
        v_full_username,
        v_trial_ends_at;
END;
$$;
-- ============================================================================
-- CRITICAL P0 SECURITY FIX: Strict Database-Level Multi-Tenant Isolation
-- Script 08: Universal tenant_id Foreign Keys, Indexes, and Defense-in-Depth RLS
-- ============================================================================

-- 1. Ensure all business tables have tenant_id column
ALTER TABLE IF EXISTS warehouses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS inventory_balances ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS inventory_audit_ledger ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS sales_invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS sales_invoice_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS purchase_bills ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS purchase_bill_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS fifo_cost_batches ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS supplier_ledgers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS staff_users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS discount_audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS cash_boxes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 2. High-Performance Partitioning Indexes
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_id ON warehouses (tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories (tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_tenant_id ON inventory_balances (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_ledger_tenant_id ON inventory_audit_ledger (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_tenant_id ON sales_invoices (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_tenant_id ON sales_invoice_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_tenant_id ON purchase_bills (tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_tenant_id ON purchase_bill_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fifo_cost_batches_tenant_id ON fifo_cost_batches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ledgers_tenant_id ON supplier_ledgers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_boxes_tenant_id ON cash_boxes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);

-- 3. Composite Uniqueness Scoped to Tenant
-- Prevent SKU / Barcode collision across tenants:
-- Two different tenants can have the same SKU or Barcode in their catalog!
DROP INDEX IF EXISTS idx_products_sku;
DROP INDEX IF EXISTS idx_products_barcode;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_tenant_sku ON products (tenant_id, LOWER(sku));
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_tenant_barcode ON products (tenant_id, LOWER(barcode)) WHERE barcode IS NOT NULL;

-- 4. Defense-in-Depth PostgreSQL Row-Level Security (RLS)
-- Can be activated to guarantee hardware-level isolation
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_boxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_products ON products;
CREATE POLICY tenant_isolation_products ON products
    FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    );

DROP POLICY IF EXISTS tenant_isolation_sales_invoices ON sales_invoices;
CREATE POLICY tenant_isolation_sales_invoices ON sales_invoices
    FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    );
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
-- ======================================================================
-- MIGRATION 10: MULTI-TIER DISPENSE (STOREFRONT DIRECT VS. WAREHOUSE QUEUE)
-- Stack: PostgreSQL | Clean Architecture | Enterprise ERP Engine
-- ======================================================================

-- 1. Classify Warehouses and Storefront Outlets
ALTER TABLE IF EXISTS warehouses 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'STORE';

COMMENT ON COLUMN warehouses.type IS 'Outlets classification: STORE for immediate point-of-sale dispense, WAREHOUSE for staged storage and keeper-managed dispatch orders';

-- Update existing default WH-01 to WAREHOUSE if name indicates main storage
UPDATE warehouses 
SET type = 'WAREHOUSE' 
WHERE code ILIKE '%WH%' OR name ILIKE '%المستودع الرئيسي%' OR name ILIKE '%Warehouse%';

-- 2. Sales Invoices Dispense Mode & Fulfillment Lifecycle
ALTER TABLE IF EXISTS sales_invoices 
ADD COLUMN IF NOT EXISTS dispense_mode VARCHAR(20) NOT NULL DEFAULT 'IN_STORE',
ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'FULFILLED';

COMMENT ON COLUMN sales_invoices.dispense_mode IS 'IN_STORE for immediate cashier counter release, WAREHOUSE_DISPATCH for keeper queueing';
COMMENT ON COLUMN sales_invoices.fulfillment_status IS 'FULFILLED for completed release, PENDING_DISPATCH for staged warehouse picking';

CREATE INDEX IF NOT EXISTS idx_sales_invoices_fulfillment ON sales_invoices(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_dispense_mode ON sales_invoices(dispense_mode);

-- 3. Sales Invoice Items: Explicit Source Location Attribution
ALTER TABLE IF EXISTS sales_invoice_items 
ADD COLUMN IF NOT EXISTS source_warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT;

-- 4. Stock Reservation on Warehouse Stock (Available To Promise ATP)
ALTER TABLE IF EXISTS warehouse_stock 
ADD COLUMN IF NOT EXISTS reserved_quantity INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN warehouse_stock.reserved_quantity IS 'Stock actively reserved for pending warehouse dispatch orders. ATP = quantity - reserved_quantity';

-- 5. Warehouse Dispatch Orders Queue (طابور مهام أمين المخزن)
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

-- Enable RLS for Warehouse Dispatch Orders Queue
ALTER TABLE warehouse_dispatch_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_warehouse_dispatch_orders ON warehouse_dispatch_orders;
CREATE POLICY tenant_isolation_warehouse_dispatch_orders ON warehouse_dispatch_orders
    FOR ALL
    USING (
        tenant_id IS NULL OR 
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    WITH CHECK (
        tenant_id IS NULL OR 
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    );

-- ============================================================================
-- Feature Directive: Multi-Tenant Business Presets & Operational Feature Flags
-- Script 11: Business Presets Enum/Varchar & Company Features JSONB Columns
-- ============================================================================

-- 1. Add business_preset and features columns to tenants table
ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS business_preset VARCHAR(50) NOT NULL DEFAULT 'Custom',
    ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{
        "enablePOS": true,
        "multiWarehouse": true,
        "maxWarehouses": 5,
        "enableInstallments": true,
        "enableSerialNumbers": false,
        "enableVariants": false,
        "enableMultiCurrency": true,
        "enableCreditLimits": true,
        "enableBarcodeScales": false,
        "enableExpiryDates": false
    }'::jsonb;

-- 2. Populate preset and feature blueprints for standard initial tenants
UPDATE tenants
SET business_preset = 'Electronics',
    features = '{
        "enablePOS": true,
        "multiWarehouse": true,
        "maxWarehouses": 5,
        "enableInstallments": true,
        "enableSerialNumbers": true,
        "enableVariants": false,
        "enableMultiCurrency": true,
        "enableCreditLimits": true,
        "enableBarcodeScales": false,
        "enableExpiryDates": false
    }'::jsonb
WHERE slug = 'm';

UPDATE tenants
SET business_preset = 'Wholesale',
    features = '{
        "enablePOS": false,
        "multiWarehouse": true,
        "maxWarehouses": 10,
        "enableInstallments": false,
        "enableSerialNumbers": false,
        "enableVariants": true,
        "enableMultiCurrency": true,
        "enableCreditLimits": true,
        "enableBarcodeScales": false,
        "enableExpiryDates": false
    }'::jsonb
WHERE slug = 'baghdad';

UPDATE tenants
SET business_preset = 'Grocery',
    features = '{
        "enablePOS": true,
        "multiWarehouse": false,
        "maxWarehouses": 1,
        "enableInstallments": false,
        "enableSerialNumbers": false,
        "enableVariants": false,
        "enableMultiCurrency": false,
        "enableCreditLimits": false,
        "enableBarcodeScales": true,
        "enableExpiryDates": true
    }'::jsonb
WHERE slug = 'erbil';

UPDATE tenants
SET business_preset = 'Hardware',
    features = '{
        "enablePOS": false,
        "multiWarehouse": true,
        "maxWarehouses": 10,
        "enableInstallments": false,
        "enableSerialNumbers": false,
        "enableVariants": false,
        "enableMultiCurrency": true,
        "enableCreditLimits": true,
        "enableBarcodeScales": false,
        "enableExpiryDates": false
    }'::jsonb
WHERE slug = 'basra';

