-- ============================================================================
-- Feature Directive: Multi-Tenant Business Presets & Operational Feature Flags
-- Script 11: Business Presets Enum/Varchar & Company Features JSONB Columns
-- ============================================================================

-- 1. Add business_preset and features columns to tenants table
ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS business_preset VARCHAR(50) NOT NULL DEFAULT 'Custom',
    ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{
        "enablePOS": true,
        "multiWarehouse": true,
        "maxWarehouses": 5,
        "enableInstallments": true,
        "enableSerialNumbers": false,
        "enableVariants": false,
        "enableMultiCurrency": true,
        "enableCreditLimits": true,
        "enableBarcodeScales": false,
        "enableExpiryDates": false
    }'::jsonb;

-- 2. Populate preset and feature blueprints for standard initial tenants
UPDATE tenants
SET business_preset = 'Electronics',
    features = '{
        "enablePOS": true,
        "multiWarehouse": true,
        "maxWarehouses": 5,
        "enableInstallments": true,
        "enableSerialNumbers": true,
        "enableVariants": false,
        "enableMultiCurrency": true,
        "enableCreditLimits": true,
        "enableBarcodeScales": false,
        "enableExpiryDates": false
    }'::jsonb
WHERE slug = 'm';

UPDATE tenants
SET business_preset = 'Wholesale',
    features = '{
        "enablePOS": false,
        "multiWarehouse": true,
        "maxWarehouses": 10,
        "enableInstallments": false,
        "enableSerialNumbers": false,
        "enableVariants": true,
        "enableMultiCurrency": true,
        "enableCreditLimits": true,
        "enableBarcodeScales": false,
        "enableExpiryDates": false
    }'::jsonb
WHERE slug = 'baghdad';

UPDATE tenants
SET business_preset = 'Grocery',
    features = '{
        "enablePOS": true,
        "multiWarehouse": false,
        "maxWarehouses": 1,
        "enableInstallments": false,
        "enableSerialNumbers": false,
        "enableVariants": false,
        "enableMultiCurrency": false,
        "enableCreditLimits": false,
        "enableBarcodeScales": true,
        "enableExpiryDates": true
    }'::jsonb
WHERE slug = 'erbil';

UPDATE tenants
SET business_preset = 'Hardware',
    features = '{
        "enablePOS": false,
        "multiWarehouse": true,
        "maxWarehouses": 10,
        "enableInstallments": false,
        "enableSerialNumbers": false,
        "enableVariants": false,
        "enableMultiCurrency": true,
        "enableCreditLimits": true,
        "enableBarcodeScales": false,
        "enableExpiryDates": false
    }'::jsonb
WHERE slug = 'basra';

