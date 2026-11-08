namespace ERP.Warehouse.Api.Domain.Constants;

/// <summary>
/// Enterprise Permission-Based Access Control (PBAC) Constants Catalog.
/// Provides strictly typed, granular permission codes across the 7 core ERP domains.
/// </summary>
public static class Permissions
{
    // =========================================================================
    // 1. Point of Sale (POS)
    // =========================================================================
    public static class POS
    {
        public const string Terminal = "pos.terminal.access";
        public const string TerminalAccess = "pos.terminal.access";
        public const string ShiftsManage = "pos.shifts.manage";
        public const string DiscountApply = "pos.discount.apply";
        public const string PriceOverride = "pos.price.override";
        public const string DrawerOpen = "pos.drawer.open";
    }

    // =========================================================================
    // 2. Sales & Invoices
    // =========================================================================
    public static class Sales
    {
        public const string InvoicesView = "sales.invoices.view";
        public const string InvoicesCreate = "sales.invoices.create";
        public const string InvoicesEdit = "sales.invoices.edit";
        public const string InvoicesDelete = "sales.invoices.delete";
        public const string ReturnsManage = "sales.returns.manage";
        public const string CustomersManage = "sales.customers.manage";
    }

    // =========================================================================
    // 3. Purchases & Suppliers
    // =========================================================================
    public static class Purchases
    {
        public const string BillsView = "purchases.bills.view";
        public const string BillsCreate = "purchases.bills.create";
        public const string BillsEdit = "purchases.bills.edit";
        public const string BillsDelete = "purchases.bills.delete";
        public const string OrdersManage = "purchases.orders.manage";
        public const string SuppliersManage = "purchases.suppliers.manage";
    }

    // =========================================================================
    // 4. Inventory & Warehouses
    // =========================================================================
    public static class Inventory
    {
        public const string ItemsView = "inventory.items.view";
        public const string ItemsCreate = "inventory.items.create";
        public const string ItemsEdit = "inventory.items.edit";
        public const string ItemsDelete = "inventory.items.delete";
        public const string CostPriceView = "inventory.cost_price.view";
        public const string TransfersManage = "inventory.transfers.manage";
        public const string StockCountsManage = "inventory.stock_counts.manage";
        public const string WarehousesManage = "inventory.warehouses.manage";
    }

    // =========================================================================
    // 5. Treasury & Cash Management
    // =========================================================================
    public static class Treasury
    {
        public const string AccountsView = "treasury.accounts.view";
        public const string VouchersManage = "treasury.vouchers.manage";
        public const string CashBoxesManage = "treasury.cashboxes.manage";
        public const string DebtsView = "treasury.debts.view";
    }

    // =========================================================================
    // 6. Reports & Analytics
    // =========================================================================
    public static class Reports
    {
        public const string ExecutiveView = "reports.executive.view";
        public const string SalesReports = "reports.sales.view";
        public const string InventoryReports = "reports.inventory.view";
        public const string FinancialReports = "reports.financial.view";
    }

    // =========================================================================
    // 7. System & Settings
    // =========================================================================
    public static class System
    {
        public const string DashboardView = "system.dashboard.view";
        public const string UsersManage = "system.users.manage";
        public const string PermissionsManage = "system.permissions.manage";
        public const string AuditLogView = "system.audit.view";
        public const string SettingsManage = "system.settings.manage";
    }

    // =========================================================================
    // Backward Compatibility Aliases with Legacy System Strings
    // =========================================================================
    public const string DashboardView = "system.dashboard.view";
    public const string InventoryView = "inventory.items.view";
    public const string InventoryManage = "inventory.items.edit";
    public const string InventoryCostPriceView = "inventory.cost_price.view";
    public const string TransfersManage = "inventory.transfers.manage";
    public const string StockCountsManage = "inventory.stock_counts.manage";
    public const string PosTerminalAccess = "pos.terminal.access";
    public const string ShiftsManage = "pos.shifts.manage";
    public const string InvoicesManage = "sales.invoices.create";
    public const string ReturnsManage = "sales.returns.manage";
    public const string LogisticsDispatch = "inventory.transfers.manage";
    public const string PurchasesManage = "purchases.bills.create";
    public const string CustomersManage = "sales.customers.manage";
    public const string FinanceLedger = "treasury.accounts.view";
    public const string ReportsExecutive = "reports.executive.view";
    public const string SettingsAudit = "system.audit.view";

    /// <summary>
    /// Returns the complete catalog of all standard granular permissions.
    /// </summary>
    public static IReadOnlyList<string> GetAll()
    {
        return new List<string>
        {
            POS.Terminal,
            POS.ShiftsManage,
            POS.DiscountApply,
            POS.PriceOverride,
            POS.DrawerOpen,

            Sales.InvoicesView,
            Sales.InvoicesCreate,
            Sales.InvoicesEdit,
            Sales.InvoicesDelete,
            Sales.ReturnsManage,
            Sales.CustomersManage,

            Purchases.BillsView,
            Purchases.BillsCreate,
            Purchases.BillsEdit,
            Purchases.BillsDelete,
            Purchases.OrdersManage,
            Purchases.SuppliersManage,

            Inventory.ItemsView,
            Inventory.ItemsCreate,
            Inventory.ItemsEdit,
            Inventory.ItemsDelete,
            Inventory.CostPriceView,
            Inventory.TransfersManage,
            Inventory.StockCountsManage,
            Inventory.WarehousesManage,

            Treasury.AccountsView,
            Treasury.VouchersManage,
            Treasury.CashBoxesManage,
            Treasury.DebtsView,

            Reports.ExecutiveView,
            Reports.SalesReports,
            Reports.InventoryReports,
            Reports.FinancialReports,

            System.DashboardView,
            System.UsersManage,
            System.PermissionsManage,
            System.AuditLogView,
            System.SettingsManage
        };
    }

    /// <summary>
    /// Standard Default Presets for rapid role assignment.
    /// </summary>
    public static IReadOnlyList<string> GetCashierDefaults() => new List<string>
    {
        POS.Terminal,
        POS.ShiftsManage,
        POS.DiscountApply,
        Sales.InvoicesView,
        Sales.InvoicesCreate,
        Sales.ReturnsManage,
        Inventory.ItemsView
    };

    public static IReadOnlyList<string> GetStorekeeperDefaults() => new List<string>
    {
        Inventory.ItemsView,
        Inventory.ItemsCreate,
        Inventory.ItemsEdit,
        Inventory.TransfersManage,
        Inventory.StockCountsManage,
        Inventory.WarehousesManage,
        Purchases.BillsView,
        Purchases.BillsCreate
    };

    public static IReadOnlyList<string> GetAccountantDefaults() => new List<string>
    {
        System.DashboardView,
        Sales.InvoicesView,
        Purchases.BillsView,
        Inventory.ItemsView,
        Inventory.CostPriceView,
        Treasury.AccountsView,
        Treasury.VouchersManage,
        Treasury.DebtsView,
        Reports.ExecutiveView,
        Reports.SalesReports,
        Reports.FinancialReports
    };

    public static IReadOnlyList<string> GetBranchManagerDefaults() => new List<string>
    {
        System.DashboardView,
        POS.Terminal,
        POS.ShiftsManage,
        POS.DiscountApply,
        POS.PriceOverride,
        Sales.InvoicesView,
        Sales.InvoicesCreate,
        Sales.InvoicesEdit,
        Sales.ReturnsManage,
        Sales.CustomersManage,
        Purchases.BillsView,
        Purchases.BillsCreate,
        Purchases.OrdersManage,
        Purchases.SuppliersManage,
        Inventory.ItemsView,
        Inventory.ItemsCreate,
        Inventory.ItemsEdit,
        Inventory.CostPriceView,
        Inventory.TransfersManage,
        Inventory.StockCountsManage,
        Inventory.WarehousesManage,
        Treasury.AccountsView,
        Treasury.VouchersManage,
        Reports.ExecutiveView,
        Reports.SalesReports,
        Reports.InventoryReports
    };
}
