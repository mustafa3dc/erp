-- ============================================================================
-- Script 19: Multi-Tenant Serial & Warranty Lifecycle Automation
-- 1. Ensure product serial tracking columns & warranty defaults
-- 2. Ensure sales_invoice_items stores bound serial_numbers JSONB
-- 3. Fix historical unsold InStock serials so they are not marked expired
-- 4. Auto-enable serial module for tenants with existing serials or Hardware/Electronics preset
-- ============================================================================

ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS requires_serial_number BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS warranty_months INT NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS sales_invoice_items
    ADD COLUMN IF NOT EXISTS serial_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Unsold inventory must never have an active/expired warranty clock
UPDATE product_serials
SET warranty_start_date = NULL,
    warranty_end_date = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE status <> 'Sold'
  AND (warranty_start_date IS NOT NULL OR warranty_end_date IS NOT NULL);

-- Automatically enable the Serial & Warranty Tracking module for tenants that
-- already have serial records OR belong to Electronics / Hardware industry presets
UPDATE tenants t
SET features = jsonb_set(
        COALESCE(t.features, '{}'::jsonb),
        '{enableSerialNumbers}',
        'true'::jsonb,
        true
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1
    FROM product_serials ps
    WHERE ps.tenant_id = t.id
)
OR t.business_preset IN ('Electronics', 'Hardware');
