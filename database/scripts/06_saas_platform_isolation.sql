-- ============================================================================
-- Feature Directive: SaaS Control Plane Isolation & Platform SuperAdmin
-- Script 06: Platform SuperAdmin Role, Tenant Quotas, and Suspension Kill Switch
-- ============================================================================

-- 1. Upgrade Tenants Table with SaaS Quotas, Plan, and Expiration
ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS plan VARCHAR(50) NOT NULL DEFAULT 'Pro',
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    ADD COLUMN IF NOT EXISTS max_branches INT NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS max_users INT NOT NULL DEFAULT 20;

-- 2. Make tenant_id Nullable in users table for Platform SuperAdmin (SaaS Owner)
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;

-- 3. Composite Unique Constraint for Tenant-Scoped Identity
-- Dropping old global constraints if any remain
DROP INDEX IF EXISTS idx_users_username;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- Composite constraint: UNIQUE (tenant_id, LOWER(username))
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_lower_username 
    ON users (tenant_id, LOWER(username));

-- Unique constraint for Platform SuperAdmin accounts where tenant_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_platform_superadmin 
    ON users (LOWER(username)) WHERE tenant_id IS NULL;

-- 4. Seed Platform SuperAdmin Account (SaaS Owner)
INSERT INTO users (
    id, tenant_id, username, password_hash, full_name, email, phone, role, branch_id, default_warehouse_id, is_active
)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    NULL,
    'superadmin',
    'AQAAAAIAAYagAAAAEG3g1Vz5jXk...', -- standard hash for '123'
    'المدير العام للمنصة (SaaS Platform Owner)',
    'owner@zilox.cloud',
    '+964 770 000 0000',
    'PlatformSuperAdmin',
    'PLATFORM',
    'PLATFORM',
    TRUE
)
ON CONFLICT DO NOTHING;

-- 5. Seed Additional Demonstration Tenants
INSERT INTO tenants (id, name, slug, country_code, currency, plan, expires_at, max_branches, max_users, is_active)
VALUES 
    (
        'b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid,
        'شركة بغداد للتجارة والتوكيلات',
        'baghdad',
        'IQ',
        'IQD',
        'Enterprise',
        CURRENT_TIMESTAMP + INTERVAL '180 days',
        10,
        50,
        TRUE
    ),
    (
        'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid,
        'مجموعة أربيل للتوريدات العامة',
        'erbil',
        'IQ',
        'USD',
        'Pro',
        CURRENT_TIMESTAMP + INTERVAL '5 days', -- Expiring soon test
        3,
        15,
        TRUE
    ),
    (
        'd4e5f6a7-b8c9-0123-def1-234567890123'::uuid,
        'شركة البصرة للخدمات اللوجستية',
        'basra',
        'IQ',
        'IQD',
        'Starter',
        CURRENT_TIMESTAMP - INTERVAL '2 days',
        1,
        5,
        FALSE -- Suspended test (Kill Switch)
    )
ON CONFLICT (slug) DO UPDATE SET
    plan = EXCLUDED.plan,
    expires_at = EXCLUDED.expires_at,
    max_branches = EXCLUDED.max_branches,
    max_users = EXCLUDED.max_users,
    is_active = EXCLUDED.is_active;
