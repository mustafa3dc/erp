import { UserRole, UserProfile } from '../types/rbac';

/**
 * Enterprise Role-Based Redirection & Landing Resolution
 */
export function getRoleDefaultNav(role?: string): string {
  if (!role) return 'Cloud POS';
  const normalized = role.toLowerCase().trim();

  // Cashier & Sales Rep -> Cloud POS Terminal
  if (
    normalized === 'cashier' || 
    normalized === 'cashier & sales rep' || 
    normalized.includes('cashier') ||
    normalized.includes('كاشير')
  ) {
    return 'Cloud POS';
  }

  // Storekeeper & Logistics -> Inventory Catalog
  if (
    normalized === 'storekeeper' || 
    normalized.includes('store') || 
    normalized.includes('warehouse') ||
    normalized.includes('مخزن')
  ) {
    return 'Inventory & Items';
  }

  // Accountant -> Finance & Treasury
  if (normalized === 'accountant' || normalized.includes('محاسب')) {
    return 'Finance & Treasury';
  }

  // Platform SuperAdmin -> SaaS Control Plane
  if (normalized === 'platformsuperadmin') {
    return 'SuperAdminTenants';
  }

  // Admin / BranchManager / SuperAdmin -> Dashboard
  return 'Dashboard';
}

/**
 * Resolve URL path for role landing
 */
export function getRoleLandingUrl(role?: string): string {
  const nav = getRoleDefaultNav(role);
  switch (nav) {
    case 'Cloud POS':
      return '/pos';
    case 'Inventory & Items':
      return '/inventory';
    case 'Finance & Treasury':
      return '/finance';
    case 'SuperAdminTenants':
      return '/super-admin/tenants';
    case 'Dashboard':
    default:
      return '/dashboard';
  }
}

/**
 * Purge '@a' or '@tenant' suffix leak and return clean username
 */
export function getCleanUsername(rawUsername?: string): string {
  if (!rawUsername) return '';
  const trimmed = rawUsername.trim();
  if (trimmed.includes('@')) {
    return trimmed.split('@')[0].trim();
  }
  return trimmed;
}

/**
 * Apply role-based destination to UserProfile
 */
export function applyRoleBasedLanding(profile: UserProfile): UserProfile {
  let landingNav = getRoleDefaultNav(profile.role);
  if (profile.features && profile.features.enablePOS === false && landingNav === 'Cloud POS') {
    landingNav = 'Sales Invoices';
  }
  return {
    ...profile,
    username: getCleanUsername(profile.username),
    defaultRoute: landingNav
  };
}
