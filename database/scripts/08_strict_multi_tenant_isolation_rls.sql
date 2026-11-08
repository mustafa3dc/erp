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
