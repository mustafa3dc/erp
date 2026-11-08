import React, { useMemo } from 'react';
import { 
  LayoutGrid, 
  Zap, 
  ShoppingCart, 
  ShoppingBag, 
  Package, 
  Box,
  Wallet, 
  Settings, 
  ChevronRight, 
  Globe 
} from 'lucide-react';
import { NavGroupDef, NAVIGATION_GROUPS, MAIN_DASHBOARD_ITEM, isFeatureAllowed } from '../../config/navigationSchema';
import { UserProfile } from '../../types/rbac';
import { usePermissions } from '../../hooks/usePermissions';
import { getStoredTransfers } from '../../services/storageService';

export interface AppSidebarProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  currentUser: UserProfile;
  isOnline: boolean;
  lang?: 'ar' | 'en';
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupKey: string) => void;
  onOpenSettings?: () => void;
}

const renderGroupIcon = (iconName: NavGroupDef['iconName']) => {
  switch (iconName) {
    case 'Zap':
      return <Zap size={15} className="nav-icon" />;
    case 'ShoppingCart':
      return <ShoppingCart size={15} className="nav-icon" />;
    case 'ShoppingBag':
      return <ShoppingBag size={15} className="nav-icon" />;
    case 'Package':
      return <Package size={15} className="nav-icon" />;
    case 'Box':
      return <Box size={15} className="nav-icon" />;
    case 'Wallet':
      return <Wallet size={15} className="nav-icon" />;
    case 'Settings':
      return <Settings size={15} className="nav-icon" />;
    default:
      return <Package size={15} className="nav-icon" />;
  }
};

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeNav,
  setActiveNav,
  currentUser,
  isOnline,
  lang = 'ar',
  expandedGroups,
  onToggleGroup,
  onOpenSettings
}) => {
  const isAr = lang === 'ar';
  const { hasPermission } = usePermissions(currentUser);

  const permittedNav = useMemo(() => {
    const isDashboardAllowed = hasPermission(MAIN_DASHBOARD_ITEM.requiredPermission) || hasPermission('dashboard.view');

    const permittedGroups = NAVIGATION_GROUPS
      .filter(group => isFeatureAllowed(currentUser?.features, group.requiredFeature))
      .map(group => {
        const permittedItems = group.items.filter(item => 
          isFeatureAllowed(currentUser?.features, item.requiredFeature) &&
          hasPermission(item.requiredPermission)
        );
        return {
          ...group,
          items: permittedItems
        };
      })
      .filter(group => group.items.length > 0);

    return {
      isDashboardAllowed,
      groups: permittedGroups
    };
  }, [hasPermission]);

  const inTransitTransfersCount = useMemo(() => {
    try {
      const list = getStoredTransfers();
      return Array.isArray(list) ? list.filter((t: any) => t.status === 'In-Transit').length : 0;
    } catch {
      return 0;
    }
  }, [activeNav]);

  return (
    <aside className="sidebar bg-sidebar text-sidebar-foreground border-sidebar-border" id="app-sidebar">
      {/* Navigation Items - Structured Hierarchical Navigation */}
      <nav className="sidebar-nav">
        {/* Main Dashboard (Rendered only if permitted for role) */}
        {permittedNav.isDashboardAllowed && (
          <button 
            type="button"
            className={`nav-btn ${activeNav === 'Dashboard' ? 'active' : ''}`}
            onClick={() => setActiveNav('Dashboard')}
          >
            <LayoutGrid size={17} className="nav-icon" />
            <span>{isAr ? 'لوحة القيادة والمؤشرات' : 'Dashboard & Live KPIs'}</span>
          </button>
        )}

        {/* Dynamically Filtered Groups */}
        {permittedNav.groups.map(group => {
          const isGroupActive = group.items.some(i => i.id === activeNav);
          const isExpanded = expandedGroups[group.key] ?? true;

          return (
            <div key={group.key} className="nav-group-container">
              <button 
                type="button"
                className={`nav-group-header ${isGroupActive ? 'has-active' : ''}`}
                onClick={() => onToggleGroup(group.key)}
                aria-expanded={isExpanded}
              >
                <div className="nav-group-left">
                  {renderGroupIcon(group.iconName)}
                  <span>{isAr ? group.titleAr : group.titleEn}</span>
                </div>
                <ChevronRight size={13} className={`nav-group-chevron ${isExpanded ? 'expanded' : ''}`} />
              </button>

              {isExpanded && (
                <div className="nav-sub-menu">
                  {group.items.map(item => {
                    const badgeContent = item.id === 'Transfers & In-Transit'
                      ? (inTransitTransfersCount > 0 ? String(inTransitTransfersCount) : null)
                      : (isAr ? item.badge : (item.badgeEn || item.badge));

                    return (
                      <button 
                        key={item.id}
                        type="button"
                        className={`nav-sub-btn ${activeNav === item.id ? 'active' : ''}`}
                        onClick={() => setActiveNav(item.id)}
                      >
                        <span>{isAr ? item.titleAr : item.titleEn}</span>
                        {badgeContent && (
                          <span className={`nav-sub-badge ${item.badgeClass || ''}`}>
                            {badgeContent}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Live Sync Status & Language Switcher */}
      <div className="sidebar-footer">
        <div className="sidebar-sync-status">
          <div className="sync-status-indicator">
            <span className={`sync-dot ${isOnline ? 'online' : 'offline'}`}></span>
            <span className="sync-label">
              {isOnline 
                ? (isAr ? 'متصل ومزامن لحظياً' : 'Online & Synced') 
                : (isAr ? 'وضع العمل دون اتصال' : 'Offline Mode')}
            </span>
          </div>
          <span className="sync-subtext">
            {isOnline 
              ? (isAr ? 'المزامنة السحابية نشطة' : 'Cloud sync is active')
              : (isAr ? 'يتم حفظ البيانات محلياً' : 'Local storage active')}
          </span>
        </div>

        <button 
          type="button"
          id="sidebar-lang-toggle"
          className="lang-pill-btn"
          onClick={() => {
            if (onOpenSettings) {
              onOpenSettings();
            } else {
              setActiveNav('Settings');
            }
          }}
          title={isAr ? 'فتح إعدادات المظهر واللغة' : 'Open Appearance & Language Settings'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <Globe size={14} />
          <span>{isAr ? 'المظهر واللغة (العربية)' : 'Appearance & Language (EN)'}</span>
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
