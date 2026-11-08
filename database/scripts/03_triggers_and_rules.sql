-- ============================================================================
-- ERP Warehouse & Supply Chain Engine - PostgreSQL 16 Initialization
-- Script 03: Automated Invariant Triggers, Immutability & Double-Entry Ledger
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Timestamp Automation: set updated_at on row mutation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON warehouses;
CREATE TRIGGER trg_warehouses_updated_at
BEFORE UPDATE ON warehouses
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Ledger Immutability Rule: Strict Block on UPDATE or DELETE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ERR_LEDGER_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = 'ERR_LEDGER_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_modification ON inventory_audit_ledger;
CREATE TRIGGER trg_prevent_ledger_modification
BEFORE UPDATE OR DELETE ON inventory_audit_ledger
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_ledger_modification();

-- ----------------------------------------------------------------------------
-- 3. Balance Direct Update Protection: Prohibit manual balance alterations
--    Balances must strictly and exclusively be altered via the Ledger pipeline
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prevent_direct_balance_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Permit changes only if the transaction explicitly sets the internal dispatch flag
    IF current_setting('erp.internal_ledger_dispatch', true) IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'ERR_DIRECT_BALANCE_UPDATE_PROHIBITED'
            USING ERRCODE = 'P0005',
                  DETAIL = 'ERR_DIRECT_BALANCE_UPDATE_PROHIBITED';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_direct_balance_update ON inventory_balances;
CREATE TRIGGER trg_prevent_direct_balance_update
BEFORE INSERT OR UPDATE OR DELETE ON inventory_balances
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_direct_balance_modification();

-- ----------------------------------------------------------------------------
-- 4. Double-Entry Verification: BEFORE INSERT on inventory_audit_ledger
--    - Verifies warehouse and product active status
--    - Row-locks current inventory balance with SELECT FOR UPDATE
--    - Enforces balance_after = current_on_hand + quantity_delta >= 0.0000
--    - Calculates total_cost if unpopulated
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_ledger_entry_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_warehouse_active BOOLEAN;
    v_product_active BOOLEAN;
    v_current_on_hand NUMERIC(18, 4);
    v_calculated_balance NUMERIC(18, 4);
BEGIN
    -- Verify warehouse status
    SELECT is_active INTO v_warehouse_active
    FROM warehouses
    WHERE id = NEW.warehouse_id;

    IF v_warehouse_active IS NULL OR v_warehouse_active = FALSE THEN
        RAISE EXCEPTION 'ERR_WAREHOUSE_INACTIVE'
            USING ERRCODE = 'P0006',
                  DETAIL = 'ERR_WAREHOUSE_INACTIVE';
    END IF;

    -- Verify product status
    SELECT is_active INTO v_product_active
    FROM products
    WHERE id = NEW.product_id;

    IF v_product_active IS NULL OR v_product_active = FALSE THEN
        RAISE EXCEPTION 'ERR_PRODUCT_INACTIVE'
            USING ERRCODE = 'P0007',
                  DETAIL = 'ERR_PRODUCT_INACTIVE';
    END IF;

    -- Ensure balance record exists; create initial 0.0000 row if not present
    PERFORM set_config('erp.internal_ledger_dispatch', 'active', true);
    INSERT INTO inventory_balances (
        warehouse_id,
        product_id,
        quantity_on_hand,
        quantity_reserved,
        last_movement_at
    )
    VALUES (
        NEW.warehouse_id,
        NEW.product_id,
        0.0000,
        0.0000,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (warehouse_id, product_id) DO NOTHING;
    PERFORM set_config('erp.internal_ledger_dispatch', 'inactive', true);

    -- Row lock for concurrency safety within database transaction
    SELECT quantity_on_hand INTO v_current_on_hand
    FROM inventory_balances
    WHERE warehouse_id = NEW.warehouse_id
      AND product_id = NEW.product_id
    FOR UPDATE;

    v_calculated_balance := v_current_on_hand + NEW.quantity_delta;

    -- Negative stock prevention
    IF v_calculated_balance < 0.0000 THEN
        RAISE EXCEPTION 'ERR_INSUFFICIENT_STOCK'
            USING ERRCODE = 'P0002',
                  DETAIL = 'ERR_INSUFFICIENT_STOCK';
    END IF;

    -- Enforce balance_after parity or assign computed balance
    IF NEW.balance_after IS NOT NULL AND NEW.balance_after <> 0.0000 AND NEW.balance_after <> v_calculated_balance THEN
        RAISE EXCEPTION 'ERR_LEDGER_BALANCE_MISMATCH'
            USING ERRCODE = 'P0004',
                  DETAIL = 'ERR_LEDGER_BALANCE_MISMATCH';
    END IF;
    NEW.balance_after := v_calculated_balance;

    -- Calculate total_cost if zero and unit_cost provided
    IF NEW.total_cost = 0.0000 AND NEW.unit_cost > 0.0000 THEN
        NEW.total_cost := ROUND(ABS(NEW.quantity_delta) * NEW.unit_cost, 4);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_ledger_before_insert ON inventory_audit_ledger;
CREATE TRIGGER trg_validate_ledger_before_insert
BEFORE INSERT ON inventory_audit_ledger
FOR EACH ROW
EXECUTE FUNCTION fn_validate_ledger_entry_before_insert();

-- ----------------------------------------------------------------------------
-- 5. Atomic Stock Balance Propagation: AFTER INSERT on inventory_audit_ledger
--    Updates inventory_balances.quantity_on_hand to match NEW.balance_after
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_propagate_ledger_to_balance()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM set_config('erp.internal_ledger_dispatch', 'active', true);

    UPDATE inventory_balances
    SET quantity_on_hand = NEW.balance_after,
        last_movement_at = NEW.recorded_at
    WHERE warehouse_id = NEW.warehouse_id
      AND product_id = NEW.product_id;

    PERFORM set_config('erp.internal_ledger_dispatch', 'inactive', true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_propagate_ledger_to_balance ON inventory_audit_ledger;
CREATE TRIGGER trg_propagate_ledger_to_balance
AFTER INSERT ON inventory_audit_ledger
FOR EACH ROW
EXECUTE FUNCTION fn_propagate_ledger_to_balance();

-- ----------------------------------------------------------------------------
-- 6. Customer Credit Limit & Balance Management on Sales Invoices
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_process_sales_invoice_credit()
RETURNS TRIGGER AS $$
DECLARE
    v_unpaid_amount NUMERIC(18, 4);
    v_customer_credit_limit NUMERIC(18, 4);
    v_customer_current_balance NUMERIC(18, 4);
BEGIN
    v_unpaid_amount := NEW.grand_total - NEW.paid_amount;

    IF v_unpaid_amount > 0.0000 THEN
        SELECT credit_limit, current_balance
        INTO v_customer_credit_limit, v_customer_current_balance
        FROM customers
        WHERE id = NEW.customer_id
        FOR UPDATE;

        IF v_customer_credit_limit > 0.0000 AND (v_customer_current_balance + v_unpaid_amount) > v_customer_credit_limit THEN
            RAISE EXCEPTION 'ERR_CUSTOMER_CREDIT_LIMIT_EXCEEDED'
                USING ERRCODE = 'P0003',
                      DETAIL = 'ERR_CUSTOMER_CREDIT_LIMIT_EXCEEDED';
        END IF;

        UPDATE customers
        SET current_balance = current_balance + v_unpaid_amount,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.customer_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_sales_invoice_credit ON sales_invoices;
CREATE TRIGGER trg_process_sales_invoice_credit
BEFORE INSERT ON sales_invoices
FOR EACH ROW
EXECUTE FUNCTION fn_process_sales_invoice_credit();

-- ----------------------------------------------------------------------------
-- 7. Audit Tampering Prevention for stock_movements (Immutable Ledger)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ERR.DATABASE.SECURITY.IMMUTABLE_AUDIT_LOG_MODIFICATION_PROHIBITED';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON stock_movements;
CREATE TRIGGER trg_stock_movements_immutable
BEFORE UPDATE OR DELETE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_tampering();

