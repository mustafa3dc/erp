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

