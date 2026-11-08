import React from 'react';
import { navigationItems } from '../config/navigationConfig';
import { CompanyFeatures } from '../types/rbac';
import { AppSidebar, AppSidebarProps } from './layout/AppSidebar';

export interface SidebarProps {
  currentPath?: string;
  features?: CompanyFeatures;
  onNavigate?: (href: string) => void;
  lang?: 'ar' | 'en';
}

/**
 * Enterprise Sidebar component with Dynamic Feature Flag Filtering.
 * Hides links or full menus if the tenant's features have the corresponding requiredFeature set to false.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  currentPath = '/',
  features,
  onNavigate,
  lang = 'ar'
}) => {
  // Dynamic Navigation Filter: filter out items and sub-items based on tenant feature flags
  const filteredNav = React.useMemo(() => {
    return navigationItems
      .filter((section) => {
        if (!section.requiredFeature) return true;
        if (!features) return true;
        return features[section.requiredFeature] !== false;
      })
      .map((section) => {
        const validItems = section.items.filter((item) => {
          if (!item.requiredFeature) return true;
          if (!features) return true;
          return features[item.requiredFeature] !== false;
        });
        return {
          ...section,
          items: validItems
        };
      })
      .filter((section) => section.items.length > 0);
  }, [features]);

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground border-e border-sidebar-border h-full flex flex-col p-4 select-none">
      <div className="mb-6 px-2">
        <h2 className="text-lg font-bold tracking-tight text-primary">
          {lang === 'ar' ? 'نظام زيلوكس للأعمال' : 'ZiloX Enterprise ERP'}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {lang === 'ar' ? 'إدارة المنظومة والمخازن' : 'Cloud POS & Inventory'}
        </p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        {filteredNav.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 px-2 mb-2">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item, itemIdx) => {
                const isActive = currentPath === item.href;
                return (
                  <button
                    key={itemIdx}
                    type="button"
                    onClick={() => onNavigate?.(item.href)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-start cursor-pointer ${
                      isActive 
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs' 
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default AppSidebar;
export { AppSidebar };
export type { AppSidebarProps };

