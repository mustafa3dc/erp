-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16 Migration
-- Script 14: Multi-Tenant Loyalty Rewards Store & Customer Digital Wallet
-- ============================================================================

-- 1. Extend tenants with optional store logo URL
ALTER TABLE IF EXISTS tenants
    ADD COLUMN IF NOT EXISTS logo_url VARCHAR(1000);

-- 2. Extend stock_movements with reference_type for LoyaltyRewardRedemption auditing
ALTER TABLE IF EXISTS stock_movements
    ADD COLUMN IF NOT EXISTS reference_type VARCHAR(60);

-- 3. Extend customers with Loyalty Member Code, Public Card Token & Normalized Phone
ALTER TABLE IF EXISTS customers
    ADD COLUMN IF NOT EXISTS loyalty_member_code VARCHAR(40),
    ADD COLUMN IF NOT EXISTS loyalty_card_token VARCHAR(128),
    ADD COLUMN IF NOT EXISTS normalized_phone VARCHAR(40);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_loyalty_member_code
    ON customers(loyalty_member_code)
    WHERE loyalty_member_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_loyalty_card_token
    ON customers(loyalty_card_token)
    WHERE loyalty_card_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_normalized_phone
    ON customers(normalized_phone)
    WHERE normalized_phone IS NOT NULL;

-- Backfill missing loyalty_member_code, loyalty_card_token, and normalized_phone for registered customers
CREATE SEQUENCE IF NOT EXISTS seq_loyalty_member_code START WITH 10001;

UPDATE customers
SET loyalty_member_code = 'LOY-' || nextval('seq_loyalty_member_code')
WHERE is_default_cash_customer = FALSE
  AND UPPER(COALESCE(code, '')) <> 'WALK-IN-CASH'
  AND (loyalty_member_code IS NULL OR btrim(loyalty_member_code) = '');

UPDATE customers
SET loyalty_card_token = replace(replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'), '=', '')
WHERE is_default_cash_customer = FALSE
  AND UPPER(COALESCE(code, '')) <> 'WALK-IN-CASH'
  AND (loyalty_card_token IS NULL OR btrim(loyalty_card_token) = '');

UPDATE customers
SET normalized_phone = regexp_replace(
        regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'),
        '^(00964|964|0)',
        ''
    )
WHERE is_default_cash_customer = FALSE
  AND UPPER(COALESCE(code, '')) <> 'WALK-IN-CASH'
  AND phone IS NOT NULL
  AND btrim(phone) <> ''
  AND (normalized_phone IS NULL OR btrim(normalized_phone) = '');

-- 4. Allow 'Refunded' in loyalty_transactions type constraint
ALTER TABLE IF EXISTS loyalty_transactions
    DROP CONSTRAINT IF EXISTS loyalty_transactions_type_check;

ALTER TABLE IF EXISTS loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_type_check
    CHECK (type IN ('Earned', 'Redeemed', 'ReversedOnReturn', 'ManualAdjustment', 'Refunded'));

-- 5. Per-Tenant Loyalty Rewards Store Catalog
CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(1000),
    image_url TEXT,
    points_cost NUMERIC(18, 4) NOT NULL CHECK (points_cost > 0),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_tenant_active
    ON loyalty_rewards(tenant_id, is_active, is_deleted, display_order);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_product
    ON loyalty_rewards(product_id)
    WHERE product_id IS NOT NULL;

-- 6. Loyalty Redemption Vouchers (PendingPickup -> Claimed / Cancelled)
CREATE TABLE IF NOT EXISTS loyalty_redemption_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    reward_id UUID NOT NULL REFERENCES loyalty_rewards(id) ON DELETE RESTRICT,
    voucher_code VARCHAR(40) NOT NULL,
    points_spent NUMERIC(18, 4) NOT NULL CHECK (points_spent > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'PendingPickup' CHECK (status IN ('PendingPickup', 'Claimed', 'Cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMPTZ,
    claimed_by_shift_id UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_redemption_vouchers_code
    ON loyalty_redemption_vouchers(voucher_code);

CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_vouchers_tenant_customer
    ON loyalty_redemption_vouchers(tenant_id, customer_id, status, created_at DESC);
