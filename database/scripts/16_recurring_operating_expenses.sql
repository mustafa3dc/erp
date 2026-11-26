-- 16_recurring_operating_expenses.sql
-- Multi-tenant Recurring & Fixed Operating Expenses (Rent, Utilities, Generators, Salaries)

CREATE TABLE IF NOT EXISTS recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NULL,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(150) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    frequency VARCHAR(30) NOT NULL DEFAULT 'Monthly',
    day_of_month INT NULL,
    day_of_week INT NULL,
    interval_days INT NULL,
    next_due_date TIMESTAMPTZ NOT NULL,
    last_executed_date TIMESTAMPTZ NULL,
    execution_mode VARCHAR(30) NOT NULL DEFAULT 'RemindAndConfirm',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    notes VARCHAR(1000) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_recurring_expense_amount CHECK (amount > 0),
    CONSTRAINT chk_recurring_day_of_month CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
    CONSTRAINT chk_recurring_day_of_week CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
    CONSTRAINT chk_recurring_interval_days CHECK (interval_days IS NULL OR interval_days >= 1)
);

CREATE INDEX IF NOT EXISTS ix_recurring_expenses_tenant_due
    ON recurring_expenses (tenant_id, is_active, is_deleted, next_due_date);

CREATE INDEX IF NOT EXISTS ix_recurring_expenses_due_date
    ON recurring_expenses (next_due_date)
    WHERE is_active = TRUE AND is_deleted = FALSE;

ALTER TABLE IF EXISTS expense_vouchers
    ADD COLUMN IF NOT EXISTS recurring_expense_id UUID NULL;

CREATE INDEX IF NOT EXISTS ix_expense_vouchers_recurring_expense_id
    ON expense_vouchers (recurring_expense_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_expense_vouchers_recurring_expense'
    ) THEN
        ALTER TABLE expense_vouchers
            ADD CONSTRAINT fk_expense_vouchers_recurring_expense
            FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id) ON DELETE SET NULL;
    END IF;
END $$;
