-- 20_purchase_treasury_and_supplier_payments.sql
-- Links Purchase Invoices & Supplier Debt Settlement to CashBox treasury deductions & void reversals

ALTER TABLE IF EXISTS purchase_bills
    ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) NOT NULL DEFAULT 'Cash',
    ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS cash_account_id UUID NULL REFERENCES cash_boxes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(500) NULL;

UPDATE purchase_bills
SET payment_type = CASE UPPER(COALESCE(payment_terms, 'CASH'))
        WHEN 'CREDIT' THEN 'Credit'
        WHEN 'PARTIAL' THEN 'Partial'
        ELSE 'Cash'
    END,
    remaining_amount = CASE
        WHEN remaining_amount = 0 AND COALESCE(balance_due, 0) > 0 THEN balance_due
        ELSE remaining_amount
    END
WHERE payment_type IS NULL
   OR payment_type NOT IN ('Cash', 'Credit', 'Partial')
   OR (remaining_amount = 0 AND COALESCE(balance_due, 0) > 0);

CREATE INDEX IF NOT EXISTS ix_purchase_bills_tenant_cash_status
    ON purchase_bills (tenant_id, cash_account_id, bill_status);

ALTER TABLE IF EXISTS treasury_transactions
    ADD COLUMN IF NOT EXISTS purchase_bill_id UUID NULL REFERENCES purchase_bills(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_treasury_transactions_purchase_bill
    ON treasury_transactions (purchase_bill_id);

CREATE INDEX IF NOT EXISTS ix_treasury_transactions_supplier
    ON treasury_transactions (supplier_id);

ALTER TABLE IF EXISTS supplier_ledgers
    DROP CONSTRAINT IF EXISTS supplier_ledgers_transaction_type_check;

ALTER TABLE IF EXISTS supplier_ledgers
    ADD CONSTRAINT supplier_ledgers_transaction_type_check
    CHECK (transaction_type IN ('PURCHASE_BILL', 'PAYMENT_VOUCHER', 'DEBIT_NOTE', 'OPENING_BALANCE', 'PURCHASE_RETURN', 'PURCHASE_CANCEL'));
