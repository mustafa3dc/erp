-- ============================================================================
-- Feature Directive: Tenant-Scoped Identity & Auto-Prefixed Usernames
-- Script 05: Multi-Tenant Architecture & Composite Unique Constraint
-- Standard Format: [username]@[company_slug] (e.g. mustafa@m, admin@m)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants Table (الشركات والمنشآت المستأجرة)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    country_code VARCHAR(10) NOT NULL DEFAULT 'IQ',
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case-insensitive unique index on tenant slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_lower_slug ON tenants (LOWER(slug));

-- 2. Users Table with Tenant-Scoped Identity
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'Cashier',
    branch_id VARCHAR(50) DEFAULT 'WH-01',
    default_warehouse_id VARCHAR(50) DEFAULT 'WH-01',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Ensure any global unique constraint on username alone is dropped
DROP INDEX IF EXISTS idx_users_username;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- 3. Composite Unique Constraint: UNIQUE (tenant_id, LOWER(username))
-- Enables multiple tenants to have identical usernames (e.g. admin, cashier) without collision
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_lower_username 
    ON users (tenant_id, LOWER(username));

-- Index on tenant_id for high performance foreign key lookups
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);

-- 4. Seed Default Tenant & Standard Users
INSERT INTO tenants (id, name, slug, country_code, currency, is_active)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    'مؤسسة مصطفى للتجارة والحلول البرمجية',
    'm',
    'IQ',
    'IQD',
    TRUE
)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

