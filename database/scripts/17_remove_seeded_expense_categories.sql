-- 17_remove_seeded_expense_categories.sql
-- Removes pre-populated default expense categories cleanly and detaches any references safely.

ALTER TABLE IF EXISTS expense_vouchers
    ALTER COLUMN expense_category_id DROP NOT NULL;

DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'expense_vouchers'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'expense_category_id'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE expense_vouchers DROP CONSTRAINT %I', fk_name);
    END IF;
END $$;

ALTER TABLE IF EXISTS expense_vouchers
    ADD CONSTRAINT fk_expense_vouchers_expense_category_id
    FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id) ON DELETE SET NULL;

-- Detach any existing expense vouchers referencing default seeded categories before deleting them
UPDATE expense_vouchers
SET expense_category_id = NULL
WHERE expense_category_id IN (
    SELECT id FROM expense_categories
    WHERE LOWER(code) IN (
        'rent', 'utilities', 'salaries', 'logistics', 'maintenance',
        'exp-rent', 'exp-util', 'exp-sal', 'exp-maint', 'exp-log'
    )
);

-- Delete seeded default expense categories across all tenants
DELETE FROM expense_categories
WHERE LOWER(code) IN (
    'rent', 'utilities', 'salaries', 'logistics', 'maintenance',
    'exp-rent', 'exp-util', 'exp-sal', 'exp-maint', 'exp-log'
);
