-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16 Initialization
-- Script 01: Core Extensions
-- ============================================================================

-- UUID generation functions (e.g., gen_random_uuid(), uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigram matching for ultra-fast partial/fuzzy barcode, SKU, and item search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- B-Tree GIST and GIN for composite indexing and exclusion constraints
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
