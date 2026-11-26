-- 18_recurring_budget_cap_and_treasury_ledger.sql
-- Adds treasury_transactions ledger table for strict expense deduction & voiding auditability
-- and safely cleans up un-deducted test voucher RECV-20261126-1110 + weekly rule 'عامل'.

CREATE TABLE IF NOT EXISTS treasury_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NULL,
    cash_box_id UUID NOT NULL REFERENCES cash_boxes(id) ON DELETE RESTRICT,
    expense_voucher_id UUID NULL REFERENCES expense_vouchers(id) ON DELETE SET NULL,
    transaction_type VARCHAR(30) NOT NULL DEFAULT 'PAYMENT',
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    balance_after NUMERIC(18, 4) NOT NULL,
    reference_number VARCHAR(100) NULL,
    notes VARCHAR(500) NULL,
    created_by VARCHAR(150) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_treasury_transactions_tenant_box
    ON treasury_transactions (tenant_id, cash_box_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_treasury_transactions_expense_voucher
    ON treasury_transactions (expense_voucher_id);

-- Safely remove un-deducted test voucher RECV-20261126-1110 WITHOUT modifying cashbox balance (710,000 IQD preserved)
DELETE FROM expense_vouchers
WHERE voucher_number = 'RECV-20261126-1110'
  AND NOT EXISTS (
      SELECT 1 FROM treasury_transactions tt WHERE tt.expense_voucher_id = expense_vouchers.id
  );

-- Align weekly recurring rule 'عامل' from 900,000 IQD to 150,000 IQD (600,000 / 4)
UPDATE recurring_expenses
SET amount = 150000.0000,
    updated_at = NOW()
WHERE is_deleted = FALSE
  AND TRIM(title) = 'عامل'
  AND frequency = 'Weekly'
  AND amount = 900000.0000;
