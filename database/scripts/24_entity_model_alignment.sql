-- ============================================================================
-- Script 24: Align schema with the API's entity model
-- Adds tables and columns that the C# entities map but no earlier script creates.
-- Fully idempotent: safe on fresh and existing databases.
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_financial_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid,
    employee_id uuid NOT NULL,
    employee_name character varying(150) NOT NULL DEFAULT '',
    transaction_date timestamp with time zone NOT NULL DEFAULT NOW(),
    reference_number character varying(50) NOT NULL DEFAULT '',
    transaction_type character varying(50) NOT NULL DEFAULT '',
    description character varying(500) NOT NULL DEFAULT '',
    debit numeric(18,2) NOT NULL DEFAULT 0,
    credit numeric(18,2) NOT NULL DEFAULT 0,
    currency character varying(10) NOT NULL DEFAULT '',
    created_by character varying(100) NOT NULL DEFAULT '',
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_employee_financial_transactions" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS staff_users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid,
    staff_code character varying(50) NOT NULL DEFAULT '',
    full_name character varying(100) NOT NULL DEFAULT '',
    role integer NOT NULL DEFAULT 0,
    pin_hash text NOT NULL DEFAULT '',
    max_discount_percent numeric NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT FALSE,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_staff_users" PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS stock_movements
    ADD COLUMN IF NOT EXISTS tenant_id uuid NULL,
    ADD COLUMN IF NOT EXISTS movement_number text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS from_warehouse_id uuid NULL,
    ADD COLUMN IF NOT EXISTS to_warehouse_id uuid NULL,
    ADD COLUMN IF NOT EXISTS reference_number text NULL,
    ADD COLUMN IF NOT EXISTS notes text NULL,
    ADD COLUMN IF NOT EXISTS movement_date timestamp with time zone NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS suppliers
    ADD COLUMN IF NOT EXISTS tenant_id uuid NULL;

ALTER TABLE IF EXISTS tenants
    ADD COLUMN IF NOT EXISTS last_backup_at timestamp with time zone NULL;

ALTER TABLE IF EXISTS warehouses
    ADD COLUMN IF NOT EXISTS location character varying(255) NULL,
    ADD COLUMN IF NOT EXISTS storage_type character varying(30) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS total_capacity numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS cash_expenses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid,
    amount numeric NOT NULL DEFAULT 0,
    currency character varying(10) NOT NULL DEFAULT '',
    expense_category_id character varying(100) NOT NULL DEFAULT '',
    category_name character varying(150) NOT NULL DEFAULT '',
    shift_id character varying(100),
    source character varying(30) NOT NULL DEFAULT '',
    treasury_account_id uuid,
    cash_box_id uuid,
    notes character varying(500),
    created_by character varying(100),
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_cash_expenses" PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS min_selling_price numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS min_profit_margin numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_cashier_discount_percent numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS min_stock_level integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_stock_level integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS inventory_transactions (
    transaction_id uuid NOT NULL,
    tenant_id uuid,
    product_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    quantity_change integer NOT NULL DEFAULT 0,
    transaction_type text NOT NULL DEFAULT '',
    reason text NOT NULL DEFAULT '',
    reference_user_id text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_inventory_transactions" PRIMARY KEY (transaction_id)
);

CREATE TABLE IF NOT EXISTS stock_movement_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid,
    movement_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL DEFAULT 0,
    unit_cost numeric NOT NULL DEFAULT 0,
    CONSTRAINT "PK_stock_movement_items" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS discount_audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid,
    invoice_number text NOT NULL DEFAULT '',
    product_id uuid NOT NULL,
    product_sku text NOT NULL DEFAULT '',
    product_name text NOT NULL DEFAULT '',
    discount_type text NOT NULL DEFAULT '',
    discount_value numeric NOT NULL DEFAULT 0,
    discount_amount_money numeric NOT NULL DEFAULT 0,
    original_retail_price numeric NOT NULL DEFAULT 0,
    final_selling_price numeric NOT NULL DEFAULT 0,
    cashier_id text NOT NULL DEFAULT '',
    cashier_name text,
    customer_id uuid,
    customer_name character varying(255),
    shift_id character varying(100),
    source character varying(30) NOT NULL DEFAULT '',
    treasury_account_id uuid,
    was_manager_override boolean NOT NULL DEFAULT FALSE,
    approved_by_manager_id text,
    approved_by_manager_name text,
    override_reason text,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_discount_audit_logs" PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS sales_invoices
    ADD COLUMN IF NOT EXISTS cashier_id text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cashier_name text NULL,
    ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS installment_contracts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid,
    contract_number character varying(50) NOT NULL DEFAULT '',
    invoice_id uuid NOT NULL,
    invoice_number character varying(100) NOT NULL DEFAULT '',
    customer_id uuid NOT NULL,
    customer_name character varying(150) NOT NULL DEFAULT '',
    customer_phone character varying(50) NOT NULL DEFAULT '',
    guarantor_name character varying(150) NOT NULL DEFAULT '',
    guarantor_phone character varying(50) NOT NULL DEFAULT '',
    guarantor_national_id character varying(50),
    total_cash_price numeric NOT NULL DEFAULT 0,
    total_installment_price numeric NOT NULL DEFAULT 0,
    down_payment numeric NOT NULL DEFAULT 0,
    remaining_amount numeric NOT NULL DEFAULT 0,
    installment_count integer NOT NULL DEFAULT 0,
    monthly_amount numeric NOT NULL DEFAULT 0,
    start_date timestamp with time zone NOT NULL DEFAULT NOW(),
    status integer NOT NULL DEFAULT 0,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone,
    CONSTRAINT "PK_installment_contracts" PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS sales_invoice_items
    ADD COLUMN IF NOT EXISTS original_price numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS was_manager_override boolean NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS approved_by_manager_id text NULL,
    ADD COLUMN IF NOT EXISTS "SalesInvoiceId" uuid NULL;

CREATE TABLE IF NOT EXISTS installment_schedule_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid,
    contract_id uuid NOT NULL,
    installment_number integer NOT NULL DEFAULT 0,
    due_date timestamp with time zone NOT NULL DEFAULT NOW(),
    amount numeric NOT NULL DEFAULT 0,
    paid_amount numeric NOT NULL DEFAULT 0,
    paid_date timestamp with time zone,
    status integer NOT NULL DEFAULT 0,
    cashier_shift_id uuid,
    payment_method character varying(50),
    receipt_voucher_number character varying(100),
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_installment_schedule_items" PRIMARY KEY (id)
);

