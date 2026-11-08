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
