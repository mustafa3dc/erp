import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config/locales';
import { UserRole } from './types/rbac';

export const localesConfig = {
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed' as const
};

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};

export interface RouteGuardResult {
  allowed: boolean;
  redirectTo?: string;
  isNotFound?: boolean;
  reason?: string;
}

/**
 * Role-Based Dynamic Landing & Route Guard
 * 
 * Rules:
 * 1. Cashier:
 *    - Automatically redirected to /pos (Cloud POS) on login & root '/'
 *    - Strictly guarded from /dashboard
 * 2. Storekeeper:
 *    - Automatically redirected to /inventory on login & root '/'
 *    - Guarded from /dashboard
 * 3. Admin / BranchManager / SuperAdmin:
 *    - Land on /dashboard
 * 4. PlatformSuperAdmin:
 *    - Land on /super-admin/tenants
 */
export function evaluateRouteAccess(
  pathname: string, 
  userRole?: UserRole,
  userPermissions?: string[]
): RouteGuardResult {
  const cleanPath = pathname.toLowerCase();

  // Public / Auth routes
  if (cleanPath === '/login' || cleanPath.startsWith('/auth')) {
    return { allowed: true };
  }

  // Not authenticated
  if (!userRole) {
    if (cleanPath === '/' || cleanPath === '') {
      return { allowed: true };
    }
    return { allowed: false, redirectTo: '/login' };
  }

  // POS Route Guard: Strict Granular Permission Check
  if (cleanPath === '/pos' || cleanPath.startsWith('/pos/')) {
    const isSuper = userRole === 'SuperAdmin' || userRole === 'PlatformSuperAdmin';
    const hasPosPermission = isSuper || (userPermissions && (
      userPermissions.includes('pos.terminal.access') ||
      userPermissions.includes('pos.terminal') ||
      userPermissions.includes('*') ||
      userPermissions.includes('all')
    ));

    if (!isSuper && userPermissions && !hasPosPermission) {
      return {
        allowed: false,
        redirectTo: '/dashboard',
        reason: 'Access denied: pos.terminal.access required.'
      };
    }
  }

  // 1. Dynamic Root '/' & Landing Page Redirection by Role
  if (cleanPath === '/' || cleanPath === '') {
    if (userRole === 'Cashier') {
      return { allowed: false, redirectTo: '/pos', reason: 'Cashier role landing redirection' };
    }
    if (userRole === 'Storekeeper') {
      return { allowed: false, redirectTo: '/inventory', reason: 'Storekeeper role landing redirection' };
    }
    if (userRole === 'PlatformSuperAdmin') {
      return { allowed: false, redirectTo: '/super-admin/tenants', reason: 'Platform SuperAdmin landing' };
    }
    return { allowed: false, redirectTo: '/dashboard', reason: 'Management role landing' };
  }

  // 2. Guard Cashier from /dashboard (Prevents 403 Blocker)
  if (userRole === 'Cashier' && (cleanPath === '/dashboard' || cleanPath.startsWith('/dashboard/'))) {
    return {
      allowed: false,
      redirectTo: '/pos',
      reason: 'Cashier is strictly assigned to POS Terminal, dashboard is forbidden.'
    };
  }

  // 3. Guard Storekeeper from /dashboard
  if (userRole === 'Storekeeper' && (cleanPath === '/dashboard' || cleanPath.startsWith('/dashboard/'))) {
    return {
      allowed: false,
      redirectTo: '/inventory',
      reason: 'Storekeeper is assigned to Inventory, dashboard is forbidden.'
    };
  }


  const isSuperAdminRoute = cleanPath.startsWith('/super-admin') || cleanPath.startsWith('/(saas-admin)');
  const isTenantErpRoute = 
    cleanPath.startsWith('/dashboard') || 
    cleanPath.startsWith('/pos') || 
    cleanPath.startsWith('/sales') || 
    cleanPath.startsWith('/invoices') || 
    cleanPath.startsWith('/inventory') || 
    cleanPath.startsWith('/transfers') || 
    cleanPath.startsWith('/stock-counts') || 
    cleanPath.startsWith('/purchases') || 
    cleanPath.startsWith('/shifts') || 
    cleanPath.startsWith('/delivery') || 
    cleanPath.startsWith('/finance') || 
    cleanPath.startsWith('/customers') || 
    cleanPath.startsWith('/reports') || 
    cleanPath.startsWith('/settings') ||
    cleanPath.startsWith('/(tenant-erp)');

  // 4. Platform Super Admin Isolation
  if (userRole === 'PlatformSuperAdmin') {
    if (isTenantErpRoute) {
      return {
        allowed: false,
        redirectTo: '/super-admin/tenants',
        reason: 'SaaS Platform Super Admin cannot access retail store ERP routes.'
      };
    }
    return { allowed: true };
  }

  // 5. Tenant Users Isolation from SaaS Control Plane
  if (isSuperAdminRoute) {
    return {
      allowed: false,
      isNotFound: true,
      reason: 'Tenant users cannot access SaaS platform control plane.'
    };
  }

  return { allowed: true };
}

export default function middleware(request?: any) {
  if (!request?.url) return;
  const url = new URL(request.url);
  const userRole = request.cookies?.get('user_role')?.value as UserRole | undefined;
  const result = evaluateRouteAccess(url.pathname, userRole);

  if (!result.allowed && result.redirectTo) {
    return { redirect: result.redirectTo };
  }
}
