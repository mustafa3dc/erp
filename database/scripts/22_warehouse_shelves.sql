-- ============================================================================
-- Migration 22: Warehouse Shelves + Fix warehouse_stock schema mismatch
-- Idempotent: safe to run multiple times
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A: Fix warehouse_stock to match EF Core entity expectations
-- The original SQL used (warehouse_id, item_id) but EF expects (warehouse_id, product_id)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add product_id column if missing (mirror of item_id for EF Core)
ALTER TABLE IF EXISTS warehouse_stock
    ADD COLUMN IF NOT EXISTS product_id      UUID          NULL,
    ADD COLUMN IF NOT EXISTS tenant_id       UUID          NULL,
    ADD COLUMN IF NOT EXISTS shelf_id        UUID          NULL,
    ADD COLUMN IF NOT EXISTS shelf_location  VARCHAR(100)  NULL,
    ADD COLUMN IF NOT EXISTS last_counted_at TIMESTAMPTZ   NULL;

-- 2. Backfill product_id from item_id where product_id is still NULL
UPDATE warehouse_stock
SET product_id = item_id
WHERE product_id IS NULL AND item_id IS NOT NULL;

-- 3. Add a unique constraint on (warehouse_id, product_id) if not exists
-- (EF Core requires this as the composite key)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'warehouse_stock'
          AND constraint_name = 'uq_ws_warehouse_product'
    ) THEN
        -- Only add if product_id has no NULLs (after backfill)
        IF NOT EXISTS (
            SELECT 1 FROM warehouse_stock WHERE product_id IS NULL
        ) THEN
            ALTER TABLE warehouse_stock
                ADD CONSTRAINT uq_ws_warehouse_product UNIQUE (warehouse_id, product_id);
        END IF;
    END IF;
END $$;

-- Index for fast lookup by tenant + warehouse
CREATE INDEX IF NOT EXISTS ix_warehouse_stock_tenant_wh
    ON warehouse_stock (tenant_id, warehouse_id);

CREATE INDEX IF NOT EXISTS ix_warehouse_stock_product
    ON warehouse_stock (product_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART B: Create warehouse_shelves table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warehouse_shelves (
    id              UUID         PRIMARY KEY,
    tenant_id       UUID         NULL,
    warehouse_id    UUID         NOT NULL,
    name            VARCHAR(150) NOT NULL,
    code            VARCHAR(50)  NULL,
    notes           TEXT         NULL,
    max_capacity    INT          NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NULL,
    created_by      VARCHAR(150) NULL
);

-- Idempotently add columns that may be missing on older schema versions
ALTER TABLE IF EXISTS warehouse_shelves
    ADD COLUMN IF NOT EXISTS tenant_id    UUID         NULL,
    ADD COLUMN IF NOT EXISTS warehouse_id UUID         NULL,
    ADD COLUMN IF NOT EXISTS name         VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS code         VARCHAR(50)  NULL,
    ADD COLUMN IF NOT EXISTS notes        TEXT         NULL,
    ADD COLUMN IF NOT EXISTS max_capacity INT          NULL,
    ADD COLUMN IF NOT EXISTS is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ  NULL,
    ADD COLUMN IF NOT EXISTS created_by   VARCHAR(150) NULL;

-- Make optional columns nullable
DO $$
DECLARE
    col_name TEXT;
BEGIN
    FOREACH col_name IN ARRAY ARRAY['code', 'notes', 'max_capacity', 'updated_at', 'created_by', 'tenant_id']
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'warehouse_shelves'
              AND column_name  = col_name
              AND is_nullable  = 'NO'
        ) THEN
            EXECUTE format('ALTER TABLE warehouse_shelves ALTER COLUMN %I DROP NOT NULL', col_name);
        END IF;
    END LOOP;
END $$;

-- Indexes for warehouse_shelves
CREATE INDEX IF NOT EXISTS ix_warehouse_shelves_tenant_wh
    ON warehouse_shelves (tenant_id, warehouse_id);

DROP INDEX IF EXISTS ux_warehouse_shelves_tenant_wh_code;

CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_shelves_tenant_wh_code_partial
    ON warehouse_shelves (tenant_id, warehouse_id, LOWER(code))
    WHERE code IS NOT NULL AND code <> '' AND is_active = TRUE;
