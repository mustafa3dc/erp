-- 21_treasury_vouchers_and_accounts.sql
-- Adds account_type on cash_boxes and party_name / voucher_date / transfer_group_id on treasury_transactions

ALTER TABLE IF EXISTS cash_boxes
    ADD COLUMN IF NOT EXISTS account_type VARCHAR(30) NOT NULL DEFAULT 'Cashbox';

UPDATE cash_boxes
SET account_type = CASE
    WHEN UPPER(COALESCE(code, '')) LIKE 'BNK%'
      OR UPPER(COALESCE(code, '')) LIKE 'BANK%'
      OR UPPER(COALESCE(code, '')) IN ('ACC-02', 'ACC-03')
      OR LOWER(COALESCE(name, '')) LIKE '%bank%'
      OR COALESCE(name, '') LIKE '%بنك%'
      OR COALESCE(name, '') LIKE '%مصرف%'
        THEN 'BankAccount'
    WHEN UPPER(COALESCE(code, '')) LIKE 'WAL%'
      OR UPPER(COALESCE(code, '')) = 'ACC-04'
      OR LOWER(COALESCE(name, '')) LIKE '%wallet%'
      OR LOWER(COALESCE(name, '')) LIKE '%zain%'
      OR COALESCE(name, '') LIKE '%محفظ%'
      OR COALESCE(name, '') LIKE '%زين كاش%'
        THEN 'DigitalWallet'
    ELSE 'Cashbox'
END
WHERE account_type IS NULL
   OR account_type = ''
   OR account_type NOT IN ('Cashbox', 'BankAccount', 'DigitalWallet');

ALTER TABLE IF EXISTS treasury_transactions
    ADD COLUMN IF NOT EXISTS party_name VARCHAR(200) NULL,
    ADD COLUMN IF NOT EXISTS voucher_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS transfer_group_id UUID NULL;

CREATE INDEX IF NOT EXISTS ix_treasury_transactions_transfer_group
    ON treasury_transactions (transfer_group_id);
