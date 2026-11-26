-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16 Migration
-- Script 15: Multi-Tenant Partners, Equity Shares & Live Profit Distribution
-- ============================================================================

CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(50),
    capital_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (capital_amount >= 0),
    profit_share_percent NUMERIC(5, 2) NOT NULL CHECK (profit_share_percent > 0 AND profit_share_percent <= 100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partners_tenant_active
    ON partners(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS partner_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(40) NOT NULL CHECK (transaction_type IN ('Withdrawal', 'ProfitPayout', 'CapitalInjection')),
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    notes VARCHAR(1000),
    shift_id UUID,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partner_transactions_tenant_partner
    ON partner_transactions(tenant_id, partner_id, created_at DESC);
