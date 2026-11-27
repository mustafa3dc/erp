import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutGrid,
  Zap,
  ShoppingCart,
  ShoppingBag,
  Truck,
  Package,
  Box,
  Wallet,
  Settings,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Lock
} from 'lucide-react';
import { NavGroupDef, NAVIGATION_GROUPS, MAIN_DASHBOARD_ITEM, isFeatureAllowed } from '../../config/navigationSchema';
import { UserProfile } from '../../types/rbac';
import { usePermissions } from '../../hooks/usePermissions';
import { useTenantPlan } from '../../hooks/useTenantPlan';
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

const renderGroupIcon = (
  iconName: NavGroupDef['iconName'],
  size = 16,
  className = 'shrink-0 transition-colors'
) => {
  const props = { size, strokeWidth: 1.8, className };
  switch (iconName) {
    case 'Zap':
      return <Zap {...props} />;
    case 'ShoppingCart':
      return <ShoppingCart {...props} />;
    case 'ShoppingBag':
      return <ShoppingBag {...props} />;
    case 'Truck':
      return <Truck {...props} />;
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
  const { canAccess, getRequiredPlan, openUpgradeModal } = useTenantPlan();
  const [hoveredGroupKey, setHoveredGroupKey] = useState<string | null>(null);
  const [pinnedGroupKey, setPinnedGroupKey] = useState<string | null>(null);
  const pinnedGroupKeyRef = useRef<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelFlyoutClose = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const closeAllFlyouts = () => {
    cancelFlyoutClose();
    pinnedGroupKeyRef.current = null;
    setPinnedGroupKey(null);
    setHoveredGroupKey(null);
  };

  const openFlyout = (groupKey: string) => {
    cancelFlyoutClose();
    if (pinnedGroupKeyRef.current && pinnedGroupKeyRef.current !== groupKey) {
      pinnedGroupKeyRef.current = null;
      setPinnedGroupKey(null);
    }
    setHoveredGroupKey(groupKey);
  };

  const scheduleFlyoutClose = (groupKey: string) => {
    cancelFlyoutClose();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      if (pinnedGroupKeyRef.current !== groupKey) {
        setHoveredGroupKey(prev => (prev === groupKey ? null : prev));
      }
    }, 150);
  };

  const togglePinFlyout = (groupKey: string) => {
    cancelFlyoutClose();
    if (pinnedGroupKeyRef.current === groupKey) {
      pinnedGroupKeyRef.current = null;
      setPinnedGroupKey(null);
      setHoveredGroupKey(null);
    } else {
      pinnedGroupKeyRef.current = groupKey;
      setPinnedGroupKey(groupKey);
      setHoveredGroupKey(groupKey);
    }
  };

  useEffect(() => {
    if (!isCollapsed) {
      closeAllFlyouts();
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest('#app-sidebar')) {
        closeAllFlyouts();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAllFlyouts();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      cancelFlyoutClose();
    };
  }, [isCollapsed]);

  const permittedNav = useMemo(() => {
    const isDashboardAllowed =
      hasPermission(MAIN_DASHBOARD_ITEM.requiredPermission) || hasPermission('dashboard.view');

    const permittedGroups = NAVIGATION_GROUPS
      .filter(group => isFeatureAllowed(currentUser?.features, group.requiredFeature))
      .map(group => {
        const permittedItems = group.items.filter(item => {
          if (!hasPermission(item.requiredPermission)) return false;
          // Keep plan-gated items visible in sidebar even when tenant preset flags are false
          if (item.planFeature) return true;
          // Keep Warehouses & Racks visible so user can manage primary warehouse
          if (item.id === 'Warehouses & Racks') return true;
          return isFeatureAllowed(currentUser?.features, item.requiredFeature);
        });
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

  const isDashboardActive = activeNav === 'Dashboard' || activeNav === '/' || activeNav === '/dashboard';

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
        {/* Main Dashboard (Highlighted ONLY when on root / or /dashboard) */}
        {permittedNav.isDashboardAllowed && (
          <button
            type="button"
            className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'} rounded-lg text-sm transition-all text-start cursor-pointer mb-1 ${
              isDashboardActive
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-semibold'
            }`}
            onClick={() => setActiveNav('Dashboard')}
            title={getTranslation(lang, 'ui.sidebar.mainDashboard')}
          >
            <LayoutGrid
              size={17}
              strokeWidth={1.85}
              className={`shrink-0 transition-colors ${isDashboardActive ? 'text-primary' : 'text-muted-foreground'}`}
            />
            {!isCollapsed && (
              <span className="truncate">{getTranslation(lang, 'ui.sidebar.mainDashboard')}</span>
            )}
          </button>
        )}

        {/* Hierarchical Nav Groups */}
        {permittedNav.groups.map(group => {
          const isGroupActive = group.items.some(i => activeNav === i.id || activeNav === i.path);
          const isExpanded = expandedGroups[group.key] ?? false;
          const groupTitle = isAr ? group.titleAr : group.titleEn;
          const isOpenGroup = !isCollapsed && isExpanded;

          const isFlyoutOpen = isCollapsed && (hoveredGroupKey === group.key || pinnedGroupKey === group.key);

          return (
            <div
              key={group.key}
              className={`nav-group-container relative transition-all ${
                isOpenGroup
                  ? 'bg-muted/40 dark:bg-muted/20 border border-border/60 rounded-xl p-1.5 my-1'
                  : 'my-0.5'
              }`}
            >
              <button
                type="button"
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center p-2.5' : 'justify-between px-2.5 py-1.5'
                } rounded-lg text-sm font-semibold transition-all cursor-pointer select-none ${
                  isCollapsed
                    ? isGroupActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    : isExpanded
                      ? 'text-foreground hover:bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
                onMouseEnter={() => isCollapsed && openFlyout(group.key)}
                onMouseLeave={() => isCollapsed && scheduleFlyoutClose(group.key)}
                onClick={() => {
                  if (isCollapsed) {
                    togglePinFlyout(group.key);
                  } else {
                    onToggleGroup(group.key);
                  }
                }}
                aria-expanded={isCollapsed ? isFlyoutOpen : isExpanded}
                aria-label={isCollapsed ? groupTitle : undefined}
              >
                <div className="nav-group-left">
                  {renderGroupIcon(
                    group.iconName,
                    isCollapsed ? 18 : 15,
                    `shrink-0 transition-colors ${
                      isGroupActive && isCollapsed
                        ? 'text-primary'
                        : isOpenGroup
                          ? 'text-primary'
                          : 'text-muted-foreground'
                    }`
                  )}
                  {!isCollapsed && <span className="truncate">{groupTitle}</span>}
                </div>
                {!isCollapsed && (
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 transition-colors ${
                      isExpanded
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {isExpanded ? (
                      <ChevronDown size={13} strokeWidth={2.2} />
                    ) : isAr ? (
                      <ChevronLeft size={13} strokeWidth={2} />
                    ) : (
                      <ChevronRight size={13} strokeWidth={2} />
                    )}
                  </span>
                )}
              </button>

              {/* Expanded Sub-menu with indentation, dot indicator & vertical guide line */}
              {isOpenGroup && (
                <div className="mt-1 space-y-0.5 relative before:content-[''] before:absolute before:top-1.5 before:bottom-1.5 before:start-3.5 before:w-px before:bg-border/70">
                  {group.items.map(item => {
                    const isItemActive = activeNav === item.id || activeNav === item.path;
                    const isPlanLocked = Boolean(item.planFeature && !canAccess(item.planFeature));
                    const reqPlan = item.requiredPlan || (item.planFeature ? getRequiredPlan(item.planFeature) : 'Pro');
                    const planPillLabel =
                      reqPlan === 'Enterprise'
                        ? getTranslation(lang, 'ui.plans.pillEnterprise')
                        : getTranslation(lang, 'ui.plans.pillPro');

                    const badgeContent =
                      item.id === 'Transfers & In-Transit' && !isPlanLocked
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
                        className={`group w-full flex items-center justify-between gap-2 ps-7 pe-2.5 py-1.5 rounded-lg text-[13px] transition-all text-start cursor-pointer ${
                          isPlanLocked
                            ? 'text-muted-foreground/75 hover:text-foreground hover:bg-muted/40 font-medium'
                            : isItemActive
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
                        }`}
                        onClick={() => {
                          if (isPlanLocked && item.planFeature) {
                            openUpgradeModal(reqPlan, item.planFeature);
                            return;
                          }
                          setActiveNav(item.id);
                        }}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                              isItemActive && !isPlanLocked
                                ? 'bg-primary'
                                : 'bg-muted-foreground/45 group-hover:bg-foreground/60'
                            }`}
                          />
                          <span className="truncate">{isAr ? item.titleAr : item.titleEn}</span>
                        </span>
                        {isPlanLocked ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground border border-border shrink-0">
                            <Lock size={10} className="shrink-0" />
                            <span>{planPillLabel}</span>
                          </span>
                        ) : badgeContent ? (
                          <span className={`nav-sub-badge ${item.badgeClass || ''}`}>
                            {badgeContent}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Collapsed Icon-Only Rail Flyout Popover (flush wrapper + ps-2.5 hover bridge) */}
              {isFlyoutOpen && (
                <div
                  className="absolute top-0 start-full ps-2.5 z-[120]"
                  onMouseEnter={() => openFlyout(group.key)}
                  onMouseLeave={() => scheduleFlyoutClose(group.key)}
                >
                  <div className="min-w-[215px] bg-popover text-popover-foreground border border-border rounded-xl p-1.5 shadow-lg animate-in fade-in-0 duration-150">
                    <div className="sidebar-rail-flyout-title">{groupTitle}</div>
                    <div className="flex flex-col gap-0.5">
                      {group.items.map(item => {
                        const isItemActive = activeNav === item.id || activeNav === item.path;
                        const isPlanLocked = Boolean(item.planFeature && !canAccess(item.planFeature));
                        const reqPlan = item.requiredPlan || (item.planFeature ? getRequiredPlan(item.planFeature) : 'Pro');
                        const planPillLabel =
                          reqPlan === 'Enterprise'
                            ? getTranslation(lang, 'ui.plans.pillEnterprise')
                            : getTranslation(lang, 'ui.plans.pillPro');

                        const badgeContent =
                          item.id === 'Transfers & In-Transit' && !isPlanLocked
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
                            className={`group w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-all text-start cursor-pointer ${
                              isPlanLocked
                                ? 'text-muted-foreground/75 hover:text-foreground hover:bg-muted/40 font-medium'
                                : isItemActive
                                  ? 'bg-primary/10 text-primary font-semibold'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
                            }`}
                            onClick={() => {
                              if (isPlanLocked && item.planFeature) {
                                openUpgradeModal(reqPlan, item.planFeature);
                                closeAllFlyouts();
                                return;
                              }
                              setActiveNav(item.id);
                              closeAllFlyouts();
                            }}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isItemActive && !isPlanLocked ? 'bg-primary' : 'bg-muted-foreground/45'
                                }`}
                              />
                              <span className="truncate">{isAr ? item.titleAr : item.titleEn}</span>
                            </span>
                            {isPlanLocked ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground border border-border shrink-0">
                                <Lock size={10} className="shrink-0" />
                                <span>{planPillLabel}</span>
                              </span>
                            ) : badgeContent ? (
                              <span className={`nav-sub-badge ${item.badgeClass || ''}`}>
                                {badgeContent}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
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
