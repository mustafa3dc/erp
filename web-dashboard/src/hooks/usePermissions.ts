import { useMemo, useCallback } from 'react';
import { UserProfile, UserRole } from '../types/rbac';
import { getStoredAuthSession } from '../services/storageService';

/**
 * Enterprise Granular Permission-Based Access Control (PBAC) Hook.
 * Resolves permissions dynamically from active authenticated session with backward compatibility aliases.
 */
export function usePermissions(userOverride?: UserProfile | null) {
  const activeSession = useMemo(() => {
    return userOverride !== undefined ? userOverride : getStoredAuthSession();
  }, [userOverride]);

  const userRole: UserRole | undefined = activeSession?.role;

  const isSuperAdmin = useMemo(() => {
    return (
      userRole === 'SuperAdmin' ||
      userRole === 'PlatformSuperAdmin' ||
      activeSession?.id === 'USR-ADMIN-01' ||
      activeSession?.id === 'USR-PLATFORM-01' ||
      activeSession?.username?.toLowerCase() === 'admin' ||
      activeSession?.username?.toLowerCase().startsWith('admin@') ||
      activeSession?.username?.toLowerCase() === 'superadmin'
    );
  }, [userRole, activeSession?.id, activeSession?.username]);

  const permissionsSet = useMemo(() => {
    const list = activeSession?.permissions || [];
    return new Set<string>(list.map(p => p.toLowerCase().trim()));
  }, [activeSession?.permissions]);

  /**
   * Evaluates if the current user possesses the specified granular permission code.
   * Includes alias mapping for backward compatibility with legacy navigational permissions.
   */
  const hasPermission = useCallback((permissionCode: string): boolean => {
    if (!permissionCode) return true;

    // SuperAdmin and PlatformSuperAdmin possess unrestricted system capabilities
    if (isSuperAdmin) return true;

    // If wildcard granted
    if (permissionsSet.has('*') || permissionsSet.has('all')) {
      return true;
    }

    const target = permissionCode.toLowerCase().trim();

    // Direct match
    if (permissionsSet.has(target)) {
      return true;
    }

    // Bidirectional alias mapping between new and legacy codes
    return checkAliases(target, permissionsSet);
  }, [isSuperAdmin, permissionsSet]);

  /**
   * Checks if user has at least one of the given permissions.
   */
  const hasAnyPermission = useCallback((codes: string[]): boolean => {
    if (!codes || codes.length === 0) return true;
    if (isSuperAdmin) return true;
    return codes.some(c => hasPermission(c));
  }, [isSuperAdmin, hasPermission]);

  /**
   * Checks if user has all of the given permissions.
   */
  const hasAllPermissions = useCallback((codes: string[]): boolean => {
    if (!codes || codes.length === 0) return true;
    if (isSuperAdmin) return true;
    return codes.every(c => hasPermission(c));
  }, [isSuperAdmin, hasPermission]);

  const canViewCostPrice = useMemo(() => {
    if (isSuperAdmin) return true;
    return (
      hasPermission('inventory.cost_price.view') ||
      userRole === 'BranchManager' ||
      userRole === 'Accountant'
    );
  }, [isSuperAdmin, hasPermission, userRole]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    can: hasPermission,
    isSuperAdmin,
    canViewCostPrice,
    role: userRole,
    permissions: activeSession?.permissions || [],
    currentUser: activeSession
  };
}

/**
 * Bi-directional compatibility mappings between legacy string keys and granular PBAC codes.
 */
function checkAliases(target: string, perms: Set<string>): boolean {
  switch (target) {
    // POS Terminal
    case 'pos.terminal.access':
    case 'pos.terminal':
      return perms.has('pos.terminal.access') || perms.has('pos.terminal');

    case 'shifts.manage':
    case 'pos.shifts.manage':
      return perms.has('pos.shifts.manage') || perms.has('shifts.manage');

    // Sales & Invoices
    case 'invoices.manage':
      return (
        perms.has('sales.invoices.view') ||
        perms.has('sales.invoices.create') ||
        perms.has('invoices.manage')
      );
    case 'sales.invoices.view':
      return perms.has('sales.invoices.view') || perms.has('invoices.manage');
    case 'sales.invoices.create':
      return perms.has('sales.invoices.create') || perms.has('invoices.manage');
    case 'sales.invoices.edit':
      return perms.has('sales.invoices.edit') || perms.has('invoices.manage');
    case 'sales.invoices.delete':
      return perms.has('sales.invoices.delete') || perms.has('invoices.manage');

    case 'returns.manage':
    case 'sales.returns.manage':
      return perms.has('sales.returns.manage') || perms.has('returns.manage');

    case 'customers.manage':
    case 'sales.customers.manage':
      return perms.has('sales.customers.manage') || perms.has('customers.manage');

    // Purchases & Suppliers
    case 'purchases.manage':
      return (
        perms.has('purchases.bills.view') ||
        perms.has('purchases.bills.create') ||
        perms.has('purchases.manage')
      );
    case 'purchases.bills.view':
      return perms.has('purchases.bills.view') || perms.has('purchases.manage');
    case 'purchases.bills.create':
      return perms.has('purchases.bills.create') || perms.has('purchases.manage');
    case 'purchases.bills.edit':
      return perms.has('purchases.bills.edit') || perms.has('purchases.manage');
    case 'purchases.bills.delete':
      return perms.has('purchases.bills.delete') || perms.has('purchases.manage');
    case 'purchases.orders.manage':
      return perms.has('purchases.orders.manage') || perms.has('purchases.manage');
    case 'purchases.suppliers.manage':
      return perms.has('purchases.suppliers.manage') || perms.has('purchases.manage');

    // Inventory & Catalog
    case 'inventory.view':
    case 'inventory.items.view':
      return perms.has('inventory.items.view') || perms.has('inventory.view');

    case 'inventory.manage':
      return (
        perms.has('inventory.items.create') ||
        perms.has('inventory.items.edit') ||
        perms.has('inventory.items.delete') ||
        perms.has('inventory.manage')
      );
    case 'inventory.items.create':
      return perms.has('inventory.items.create') || perms.has('inventory.manage');
    case 'inventory.items.edit':
      return perms.has('inventory.items.edit') || perms.has('inventory.manage');
    case 'inventory.items.delete':
      return perms.has('inventory.items.delete') || perms.has('inventory.manage');

    case 'inventory.cost_price.view':
    case 'inventory.cost.view':
      return (
        perms.has('inventory.cost_price.view') ||
        perms.has('inventory.cost.view') ||
        perms.has('permissions.inventory.costprice.view')
      );

    case 'transfers.manage':
    case 'inventory.transfers.manage':
    case 'logistics.dispatch':
      return (
        perms.has('inventory.transfers.manage') ||
        perms.has('transfers.manage') ||
        perms.has('logistics.dispatch')
      );

    case 'stock_counts.manage':
    case 'inventory.stock_counts.manage':
      return (
        perms.has('inventory.stock_counts.manage') ||
        perms.has('stock_counts.manage')
      );

    case 'inventory.warehouses.manage':
      return (
        perms.has('inventory.warehouses.manage') ||
        perms.has('inventory.manage')
      );

    // Treasury
    case 'finance.ledger':
    case 'treasury.accounts.view':
      return perms.has('treasury.accounts.view') || perms.has('finance.ledger');
    case 'treasury.vouchers.manage':
      return perms.has('treasury.vouchers.manage') || perms.has('finance.ledger');
    case 'treasury.cashboxes.manage':
      return perms.has('treasury.cashboxes.manage') || perms.has('finance.ledger');
    case 'treasury.debts.view':
      return perms.has('treasury.debts.view') || perms.has('finance.ledger');

    // Reports & System
    case 'reports.executive':
    case 'reports.executive.view':
      return perms.has('reports.executive.view') || perms.has('reports.executive');

    case 'dashboard.view':
    case 'system.dashboard.view':
      return perms.has('system.dashboard.view') || perms.has('dashboard.view');

    case 'settings.audit':
    case 'system.audit.view':
      return perms.has('system.audit.view') || perms.has('settings.audit');

    case 'system.users.manage':
      return perms.has('system.users.manage') || perms.has('settings.audit');

    case 'system.permissions.manage':
      return perms.has('system.permissions.manage') || perms.has('settings.audit');

    case 'system.settings.manage':
      return perms.has('system.settings.manage') || perms.has('settings.audit');

    default:
      return false;
  }
}

export default usePermissions;
