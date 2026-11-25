-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16 Migration
-- Script 14: Tenant-Scoped AI OCR Settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    gemini_api_key VARCHAR(500) NOT NULL DEFAULT '',
    gemini_model VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5-flash',
    updated_by VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_settings_tenant
    ON ai_settings(tenant_id);
