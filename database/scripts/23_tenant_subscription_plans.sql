-- Idempotent migration for SaaS Multi-Tier Subscription Plans & Feature Gating
ALTER TABLE IF EXISTS tenants
    ADD COLUMN IF NOT EXISTS plan_type INT NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS billing_cycle_type INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ NULL;

-- Ensure any existing NULL values default safely to Pro (2) / Monthly (1)
UPDATE tenants SET plan_type = 2 WHERE plan_type IS NULL OR plan_type NOT IN (1, 2, 3);
UPDATE tenants SET billing_cycle_type = 1 WHERE billing_cycle_type IS NULL OR billing_cycle_type NOT IN (1, 2, 3);
