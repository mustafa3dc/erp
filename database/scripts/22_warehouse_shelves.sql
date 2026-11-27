-- ============================================================================
-- Migration 22: Warehouse Shelves (Bins / Rack Locations)
-- Idempotent: safe to run multiple times
-- ============================================================================

-- 1. Create the warehouse_shelves table if it doesn't exist
CREATE TABLE IF NOT EXISTS warehouse_shelves (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NULL,
    warehouse_id    UUID NOT NULL,
    name            VARCHAR(150) NOT NULL,
    code            VARCHAR(50)  NULL,
    notes           TEXT         NULL,
    max_capacity    INT          NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NULL,
    created_by      VARCHAR(150) NULL
);

-- 2. Idempotently add any columns that may be missing (from earlier schema versions)
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

-- 3. Make optional columns nullable (drop NOT NULL if wrongly set)
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

-- 4. Add shelf_id column to warehouse_stock if missing
ALTER TABLE IF EXISTS warehouse_stock
    ADD COLUMN IF NOT EXISTS shelf_id        UUID         NULL,
    ADD COLUMN IF NOT EXISTS shelf_location  VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS tenant_id       UUID         NULL,
    ADD COLUMN IF NOT EXISTS product_id      UUID         NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS ix_warehouse_shelves_tenant_wh
    ON warehouse_shelves (tenant_id, warehouse_id);

-- Drop old non-partial unique index if present and replace with partial one
DROP INDEX IF EXISTS ux_warehouse_shelves_tenant_wh_code;

CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_shelves_tenant_wh_code_partial
    ON warehouse_shelves (tenant_id, warehouse_id, LOWER(code))
    WHERE code IS NOT NULL AND code <> '' AND is_active = TRUE;
