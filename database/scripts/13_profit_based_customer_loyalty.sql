-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16 Migration
-- Script 13: Profit-Based Customer Loyalty & Points System
-- ============================================================================

-- 1. Extend customers with numeric(18, 4) loyalty points balance
ALTER TABLE IF EXISTS customers
    ADD COLUMN IF NOT EXISTS loyalty_points_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000;

-- 2. Extend sales_invoices & sales_invoice_items with profit & loyalty audit snapshots
ALTER TABLE IF EXISTS sales_invoices
    ADD COLUMN IF NOT EXISTS loyalty_points_earned NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS loyalty_points_redeemed NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS loyalty_discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS realized_profit NUMERIC(18, 4) NOT NULL DEFAULT 0.0000;

ALTER TABLE IF EXISTS sales_invoice_items
    ADD COLUMN IF NOT EXISTS unit_cost_price NUMERIC(18, 4) NOT NULL DEFAULT 0.0000;

-- 3. Tenant-scoped Loyalty Settings table
CREATE TABLE IF NOT EXISTS loyalty_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    is_loyalty_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    profit_unit_amount NUMERIC(18, 4) NOT NULL DEFAULT 1000.0000 CHECK (profit_unit_amount > 0),
    points_earned_per_unit NUMERIC(18, 4) NOT NULL DEFAULT 10.0000 CHECK (points_earned_per_unit >= 0),
    points_redemption_unit NUMERIC(18, 4) NOT NULL DEFAULT 100.0000 CHECK (points_redemption_unit > 0),
    currency_value_per_unit NUMERIC(18, 4) NOT NULL DEFAULT 1000.0000 CHECK (currency_value_per_unit >= 0),
    min_redeemable_points NUMERIC(18, 4) NOT NULL DEFAULT 500.0000 CHECK (min_redeemable_points >= 0),
    updated_by VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_settings_tenant
    ON loyalty_settings(tenant_id);

-- 4. Immutable Loyalty Transaction Audit Ledger table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE SET NULL,
    return_id UUID REFERENCES rma_return_requests(id) ON DELETE SET NULL,
    type VARCHAR(40) NOT NULL CHECK (type IN ('Earned', 'Redeemed', 'ReversedOnReturn', 'ManualAdjustment')),
    points_change NUMERIC(18, 4) NOT NULL,
    profit_basis NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    balance_after NUMERIC(18, 4) NOT NULL,
    notes VARCHAR(500),
    created_by VARCHAR(150) NOT NULL DEFAULT 'System',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_tenant_customer
    ON loyalty_transactions(tenant_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_invoice
    ON loyalty_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_return
    ON loyalty_transactions(return_id);
