import React from 'react';
import { UserRole } from '../../types/rbac';

export interface RoleBadgeProps {
  role?: UserRole | string;
  isAr?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Standardized RoleBadge Component
 * Enforces unified dimensions (h-7 px-3) and subtle tinted styling (Zero Solid Blocks).
 */
export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role = 'Cashier',
  isAr = true,
  className = '',
  children
}) => {
  const normRole = (typeof role === 'string' ? role : '').trim();

  // Unified Base Dimensions & Typography
  const baseClasses =
    'h-7 px-3 text-xs font-semibold rounded-full inline-flex items-center justify-center border transition-all whitespace-nowrap';

  let colorClasses = 'bg-muted/60 text-muted-foreground border-border/70';
  let label = normRole;

  switch (normRole) {
    case 'SuperAdmin':
    case 'PlatformSuperAdmin':
      // Root Owner / Platform Owner - Elegant Tinted Indigo/Violet
      label = isAr ? 'المدير العام' : 'General Manager';
      colorClasses = 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
      break;

    case 'BranchManager':
      // Branch Manager / Administration - Subtle Slate Tint
      label = isAr ? 'مدير الفرع' : 'Branch Manager';
      colorClasses = 'bg-slate-500/10 text-slate-800 dark:text-slate-200 border-slate-500/30';
      break;

    case 'Accountant':
      // Financial Accountant - Subtle Emerald Tint
      label = isAr ? 'المحاسب المالي' : 'Accountant';
      colorClasses = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      break;

    case 'Storekeeper':
      // Warehouse Custodian - Subtle Amber Tint
      label = isAr ? 'أمين المخزن' : 'Storekeeper';
      colorClasses = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      break;

    case 'Cashier':
      // POS Cashier - Subtle Sky Tint
      label = isAr ? 'كاشير مبيعات' : 'Cashier';
      colorClasses = 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30';
      break;

    default:
      if (normRole.toLowerCase().includes('admin') || normRole.toLowerCase().includes('owner')) {
        label = isAr ? 'المدير العام' : 'General Manager';
        colorClasses = 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
      } else {
        label = normRole || (isAr ? 'موظف' : 'Staff');
        colorClasses = 'bg-slate-500/10 text-slate-800 dark:text-slate-200 border-slate-500/30';
      }
      break;
  }

  return (
    <span className={`${baseClasses} ${colorClasses} ${className}`}>
      {children || label}
    </span>
  );
};

export default RoleBadge;

