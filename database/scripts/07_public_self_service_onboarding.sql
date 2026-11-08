-- ============================================================================
-- Feature Directive: Public Pricing Calculator & Automated Self-Service Onboarding
-- Script 07: Public Tenant Registration, Trial Management, Features & Default Operational Entities
-- ============================================================================

-- 1. Upgrade Tenants Table for Self-Service Onboarding & Feature Flags
ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
    ADD COLUMN IF NOT EXISTS features_enabled JSONB DEFAULT '{"wms": false, "pos": true}'::jsonb,
    ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'yearly',
    ADD COLUMN IF NOT EXISTS contact_info VARCHAR(150);

-- 2. Link Warehouses to Multi-Tenant Partitioning
ALTER TABLE warehouses 
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_id ON warehouses (tenant_id);

-- 3. Cash Boxes Table (صناديق الكاش والخزائن النقدية لنقاط البيع)
CREATE TABLE IF NOT EXISTS cash_boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    current_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (current_balance >= 0.0000),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cash_boxes_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cash_boxes_tenant_id ON cash_boxes (tenant_id);

-- 4. Atomic PostgreSQL Function for 100% Automated Self-Service Registration
CREATE OR REPLACE FUNCTION fn_register_tenant_self_service(
    p_company_name VARCHAR(150),
    p_slug VARCHAR(50),
    p_country_code VARCHAR(10),
    p_currency VARCHAR(10),
    p_max_warehouses INT,
    p_max_users INT,
    p_wms_enabled BOOLEAN,
    p_pos_enabled BOOLEAN,
    p_billing_cycle VARCHAR(20),
    p_admin_full_name VARCHAR(150),
    p_admin_username VARCHAR(100),
    p_password_hash VARCHAR(255),
    p_contact_info VARCHAR(150)
)
RETURNS TABLE (
    tenant_id UUID,
    user_id UUID,
    warehouse_id UUID,
    cash_box_id UUID,
    full_username VARCHAR(150),
    trial_ends_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_slug VARCHAR(50);
    v_tenant_id UUID;
    v_warehouse_id UUID;
    v_cash_box_id UUID;
    v_user_id UUID;
    v_full_username VARCHAR(150);
    v_trial_ends_at TIMESTAMP WITH TIME ZONE;
    v_features JSONB;
BEGIN
    -- Step A: Validate and Sanitize Slug
    v_clean_slug := LOWER(TRIM(p_slug));
    IF v_clean_slug = '' OR v_clean_slug IS NULL THEN
        RAISE EXCEPTION 'رمز المنشأة (Slug) مطلوب ولا يمكن تركه فارغاً.';
    END IF;

    IF EXISTS (SELECT 1 FROM tenants WHERE LOWER(slug) = v_clean_slug) THEN
        RAISE EXCEPTION 'رمز المنشأة (%) محجوز مسبقاً، يرجى اختيار رمز آخر.', v_clean_slug;
    END IF;

    -- Step B: Setup Dates and Feature Flags
    v_trial_ends_at := CURRENT_TIMESTAMP + INTERVAL '14 days';
    v_features := jsonb_build_object('wms', p_wms_enabled, 'pos', p_pos_enabled);

    -- Step C: Insert Tenant
    INSERT INTO tenants (
        name, slug, country_code, currency, plan, 
        max_branches, max_users, is_active, 
        trial_ends_at, expires_at, features_enabled, 
        billing_cycle, contact_info
    )
    VALUES (
        TRIM(p_company_name),
        v_clean_slug,
        COALESCE(NULLIF(p_country_code, ''), 'IQ'),
        COALESCE(NULLIF(p_currency, ''), 'IQD'),
        CASE 
            WHEN p_max_warehouses > 5 OR p_max_users > 20 THEN 'Enterprise'
            WHEN p_max_warehouses > 1 OR p_max_users > 5 THEN 'Pro'
            ELSE 'Starter'
        END,
        GREATEST(p_max_warehouses, 1),
        GREATEST(p_max_users, 3),
        TRUE,
        v_trial_ends_at,
        v_trial_ends_at,
        v_features,
        COALESCE(NULLIF(p_billing_cycle, ''), 'yearly'),
        TRIM(p_contact_info)
    )
    RETURNING id INTO v_tenant_id;

    -- Step D: Insert Default Main Warehouse (المستودع الرئيسي)
    INSERT INTO warehouses (
        tenant_id, code, name, location_address, manager_name, contact_phone, is_active
    )
    VALUES (
        v_tenant_id,
        'WH-01',
        'المستودع الرئيسي',
        'الفرع الرئيسي - الإدارة المركزية',
        p_admin_full_name,
        p_contact_info,
        TRUE
    )
    RETURNING id INTO v_warehouse_id;

    -- Step E: Insert Default Cash Box (صندوق الكاش الافتراضي)
    INSERT INTO cash_boxes (
        tenant_id, code, name, warehouse_id, currency, current_balance, is_active
    )
    VALUES (
        v_tenant_id,
        'CB-01',
        'صندوق الكاش الافتراضي (الخزينة الرئيسية)',
        v_warehouse_id,
        COALESCE(NULLIF(p_currency, ''), 'IQD'),
        0.0000,
        TRUE
    )
    RETURNING id INTO v_cash_box_id;

    -- Step F: Insert First Admin Account (Tenant Owner)
    v_full_username := LOWER(TRIM(p_admin_username)) || '@' || v_clean_slug;

    INSERT INTO users (
        tenant_id, username, password_hash, full_name, email, phone, 
        role, branch_id, default_warehouse_id, is_active, notes
    )
    VALUES (
        v_tenant_id,
        LOWER(TRIM(p_admin_username)),
        p_password_hash,
        TRIM(p_admin_full_name),
        CASE WHEN p_contact_info LIKE '%@%' THEN TRIM(p_contact_info) ELSE LOWER(TRIM(p_admin_username)) || '@' || v_clean_slug || '.zilox.com' END,
        CASE WHEN p_contact_info NOT LIKE '%@%' AND p_contact_info IS NOT NULL THEN TRIM(p_contact_info) ELSE '+964 770 000 0000' END,
        'SuperAdmin',
        'WH-01',
        'WH-01',
        TRUE,
        'حساب مالك المنشأة الأول المنشأ آلياً عبر بوابة التسجيل الذاتي'
    )
    RETURNING id INTO v_user_id;

    -- Step G: Return result tuple
    RETURN QUERY
    SELECT 
        v_tenant_id,
        v_user_id,
        v_warehouse_id,
        v_cash_box_id,
        v_full_username,
        v_trial_ends_at;
END;
$$;
