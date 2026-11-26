import React, { useMemo, useState } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { NavGroupDef, NAVIGATION_GROUPS, MAIN_DASHBOARD_ITEM, isFeatureAllowed } from '../../config/navigationSchema';
import { UserProfile } from '../../types/rbac';
import { usePermissions } from '../../hooks/usePermissions';
import { getStoredTransfers } from '../../services/storageService';
import { getTranslation } from '../../lib/i18n';

export interface AppSidebarProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  currentUser: UserProfile;
  lang?: 'ar' | 'en';
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupKey: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const renderGroupIcon = (iconName: NavGroupDef['iconName'], size = 16) => {
  const props = { size, strokeWidth: 1.8, className: 'nav-icon' };
  switch (iconName) {
    case 'Zap':
      return <Zap {...props} />;
    case 'ShoppingCart':
      return <ShoppingCart {...props} />;
    case 'ShoppingBag':
      return <ShoppingBag {...props} />;
    case 'Package':
      return <Package {...props} />;
    case 'Box':
      return <Box {...props} />;
    case 'Wallet':
      return <Wallet {...props} />;
    case 'Settings':
      return <Settings {...props} />;
    default:
      return <Package {...props} />;
  }
};

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeNav,
  setActiveNav,
  currentUser,
  lang = 'ar',
  expandedGroups,
  onToggleGroup,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const isAr = lang === 'ar';
  const { hasPermission } = usePermissions(currentUser);
  const [hoveredGroupKey, setHoveredGroupKey] = useState<string | null>(null);

  const permittedNav = useMemo(() => {
    const isDashboardAllowed =
      hasPermission(MAIN_DASHBOARD_ITEM.requiredPermission) || hasPermission('dashboard.view');

    const permittedGroups = NAVIGATION_GROUPS
      .filter(group => isFeatureAllowed(currentUser?.features, group.requiredFeature))
      .map(group => {
        const permittedItems = group.items.filter(
          item =>
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
  }, [hasPermission, currentUser?.features]);

  const inTransitTransfersCount = useMemo(() => {
    try {
      const list = getStoredTransfers();
      return Array.isArray(list) ? list.filter((t: any) => t.status === 'In-Transit').length : 0;
    } catch {
      return 0;
    }
  }, [activeNav]);

  const CollapseIcon = isAr
    ? (isCollapsed ? PanelRightOpen : PanelRightClose)
    : (isCollapsed ? PanelLeftOpen : PanelLeftClose);

  const collapseLabel = isCollapsed
    ? getTranslation(lang, 'ui.sidebar.expand')
    : getTranslation(lang, 'ui.sidebar.collapse');

  return (
    <aside
      className={`sidebar bg-sidebar text-sidebar-foreground border-sidebar-border ${isCollapsed ? 'collapsed' : ''}`}
      id="app-sidebar"
    >
      {/* Top Collapse Bar */}
      {onToggleCollapse && (
        <div className="sidebar-top-controls">
          {!isCollapsed && (
            <span className="sidebar-section-caption">
              {getTranslation(lang, 'ui.sidebar.railHint')}
            </span>
          )}
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={collapseLabel}
            aria-label={collapseLabel}
          >
            <CollapseIcon size={15} strokeWidth={1.85} />
          </button>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="sidebar-nav">
        {/* Main Dashboard */}
        {permittedNav.isDashboardAllowed && (
          <button
            type="button"
            className={`nav-btn ${activeNav === 'Dashboard' ? 'active' : ''}`}
            onClick={() => setActiveNav('Dashboard')}
            title={getTranslation(lang, 'ui.sidebar.mainDashboard')}
          >
            <LayoutGrid size={17} strokeWidth={1.8} className="nav-icon" />
            {!isCollapsed && (
              <span className="truncate">{getTranslation(lang, 'ui.sidebar.mainDashboard')}</span>
            )}
          </button>
        )}

        {/* Hierarchical Nav Groups */}
        {permittedNav.groups.map(group => {
          const isGroupActive = group.items.some(i => i.id === activeNav);
          const isExpanded = expandedGroups[group.key] ?? true;
          const groupTitle = isAr ? group.titleAr : group.titleEn;

          return (
            <div
              key={group.key}
              className="nav-group-container"
              onMouseEnter={() => isCollapsed && setHoveredGroupKey(group.key)}
              onMouseLeave={() => isCollapsed && setHoveredGroupKey(prev => (prev === group.key ? null : prev))}
            >
              <button
                type="button"
                className={`nav-group-header ${isGroupActive ? 'has-active' : ''}`}
                onClick={() => {
                  if (isCollapsed) {
                    setHoveredGroupKey(prev => (prev === group.key ? null : group.key));
                  } else {
                    onToggleGroup(group.key);
                  }
                }}
                aria-expanded={isCollapsed ? hoveredGroupKey === group.key : isExpanded}
                title={isCollapsed ? groupTitle : undefined}
              >
                <div className="nav-group-left">
                  {renderGroupIcon(group.iconName, isCollapsed ? 18 : 15)}
                  {!isCollapsed && <span className="truncate">{groupTitle}</span>}
                </div>
                {!isCollapsed && (
                  <ChevronRight
                    size={13}
                    strokeWidth={2}
                    className={`nav-group-chevron ${isExpanded ? 'expanded' : ''}`}
                  />
                )}
              </button>

              {/* Expanded Sub-menu */}
              {!isCollapsed && isExpanded && (
                <div className="nav-sub-menu">
                  {group.items.map(item => {
                    const badgeContent =
                      item.id === 'Transfers & In-Transit'
                        ? inTransitTransfersCount > 0
                          ? String(inTransitTransfersCount)
                          : null
                        : isAr
                          ? item.badge
                          : item.badgeEn || item.badge;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`nav-sub-btn ${activeNav === item.id ? 'active' : ''}`}
                        onClick={() => setActiveNav(item.id)}
                      >
                        <span className="truncate">{isAr ? item.titleAr : item.titleEn}</span>
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

              {/* Collapsed Icon-Only Rail Flyout Popover */}
              {isCollapsed && hoveredGroupKey === group.key && (
                <div className="sidebar-rail-flyout">
                  <div className="sidebar-rail-flyout-title">{groupTitle}</div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map(item => {
                      const badgeContent =
                        item.id === 'Transfers & In-Transit'
                          ? inTransitTransfersCount > 0
                            ? String(inTransitTransfersCount)
                            : null
                          : isAr
                            ? item.badge
                            : item.badgeEn || item.badge;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`nav-sub-btn ${activeNav === item.id ? 'active' : ''}`}
                          onClick={() => {
                            setActiveNav(item.id);
                            setHoveredGroupKey(null);
                          }}
                        >
                          <span className="truncate">{isAr ? item.titleAr : item.titleEn}</span>
                          {badgeContent && (
                            <span className={`nav-sub-badge ${item.badgeClass || ''}`}>
                              {badgeContent}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default AppSidebar;
