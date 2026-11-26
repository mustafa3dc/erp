import React, { useState, useMemo, useCallback } from 'react';
import {
  MapPin,
  User,
  Snowflake,
  Layers,
  Plus,
  ArrowDownToLine,
  Edit3,
  Phone,
  CheckCircle2,
  AlertCircle,
  Building2,
  Boxes,
  Clock,
  DollarSign,
  Search,
  Filter,
  Package,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { Warehouse, Product, normalizeWarehouseStorageType } from '../../types/warehouse';
import RadialGauge from '../RadialGauge';
import EditWarehouseModal from '../modals/EditWarehouseModal';
import AddWarehouseModal from '../modals/AddWarehouseModal';
import WarehouseLiveLayout, { RackBayItem } from './WarehouseLiveLayout';
import {
  GLOBAL_COUNTRIES,
  getCountryByCode
} from '../../data/globalLocations';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';

export interface WarehousesRacksViewProps {
  lang: 'en' | 'ar';
  warehouses: Warehouse[];
  products?: Product[];
  selectedWarehouseId?: string;
  onSelectWarehouse?: (id: string) => void;
  onNavigateToInventory?: (warehouseId: string) => void;
  onAddWarehouse: (data: {
    code: string;
    nameAr: string;
    nameEn?: string;
    country: string;
    countryCode: string;
    state: string;
    city: string;
    cityAr?: string;
    cityEn?: string;
    address?: string;
    postalCode?: string;
    timezone?: string;
    currency?: string;
    storageType: string;
    storageTypeLabelAr?: string;
    storageTypeLabelEn?: string;
    manager: string;
    managerEn?: string;
    phone: string;
    capacity: number;
    status?: 'active' | 'maintenance';
  }) => void;
  onUpdateWarehouse: (id: string, updates: Partial<Warehouse>) => void;
  onOpenAddGoods?: (mode: 'new_product' | 'restock', warehouseId: string) => void;
  onDeleteWarehouse?: (id: string) => void;
}

function computeWarehouseMetrics(
  wh: Warehouse,
  allProducts: Product[],
  liveRacksForWh?: RackBayItem[]
) {
  const whProducts = allProducts.filter(
    p => !p.isBundle && (p.warehouseId === wh.id || p.warehouseId === wh.code)
  );
  const storedStock = whProducts.reduce((sum, p) => sum + Math.max(0, Number(p.currentStock) || 0), 0);

  const distinctShelves = new Set<string>();
  whProducts.forEach(p => {
    if (p.shelf && p.shelf.trim().length > 0) {
      distinctShelves.add(p.shelf.trim().toUpperCase());
    }
  });

  const hasLiveRacks = Array.isArray(liveRacksForWh);
  const totalRacks = hasLiveRacks ? liveRacksForWh.length : distinctShelves.size;
  const racksUsed = hasLiveRacks
    ? liveRacksForWh.reduce((sum, r) => sum + Math.max(0, Number(r.usedCapacity) || 0), 0)
    : storedStock;
  const racksCapacity = hasLiveRacks
    ? liveRacksForWh.reduce((sum, r) => sum + Math.max(0, Number(r.totalCapacity) || 0), 0)
    : distinctShelves.size * 32;

  const occupiedCapacity = hasLiveRacks && racksUsed > 0
    ? racksUsed
    : (storedStock > 0 ? storedStock : Math.max(0, Number(wh.occupied) || 0));

  let occupancyPct = 0;
  if (racksCapacity > 0) {
    occupancyPct = Math.min(100, Math.round((occupiedCapacity / racksCapacity) * 100));
  } else if (wh.capacity > 0 && occupiedCapacity > 0) {
    occupancyPct = Math.min(100, Math.max(1, Math.round((occupiedCapacity / wh.capacity) * 100)));
  }

  const availableCapacity = Math.max(0, (Number(wh.capacity) || 0) - occupiedCapacity);

  return {
    whProducts,
    storedStock,
    totalRacks,
    occupiedCapacity,
    availableCapacity,
    occupancyPct
  };
}

export default function WarehousesRacksView({
  lang,
  warehouses,
  products = [],
  selectedWarehouseId,
  onSelectWarehouse,
  onNavigateToInventory,
  onAddWarehouse,
  onUpdateWarehouse,
  onOpenAddGoods,
  onDeleteWarehouse
}: WarehousesRacksViewProps) {
  const isAr = lang === 'ar';
  const tr = useCallback((k: string) => getTranslation(lang, `ui.warehouses.${k}`), [lang]);
  const { formatMoney, settings } = useSettings();

  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [liveRacksByWarehouse, setLiveRacksByWarehouse] = useState<Record<string, RackBayItem[]>>({});

  const [selectedWhId, setSelectedWhId] = useState<string>(() => {
    if (selectedWarehouseId && selectedWarehouseId !== 'ALL') return selectedWarehouseId;
    return warehouses[0]?.id || '';
  });

  React.useEffect(() => {
    if (selectedWarehouseId && selectedWarehouseId !== 'ALL' && selectedWarehouseId !== selectedWhId) {
      setSelectedWhId(selectedWarehouseId);
    }
  }, [selectedWarehouseId, selectedWhId]);

  const handleRacksLoaded = useCallback((whId: string, loaded: RackBayItem[]) => {
    setLiveRacksByWarehouse(prev => ({
      ...prev,
      [whId]: loaded
    }));
  }, []);

  const filteredWarehouses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return warehouses.filter(w => {
      const wCountryCode = w.countryCode || settings.tenantCountryCode || 'IQ';
      const matchCountry = selectedCountryFilter === 'ALL' || wCountryCode === selectedCountryFilter;
      const matchSearch = !q ||
        w.nameAr.toLowerCase().includes(q) ||
        w.nameEn.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        (w.city && w.city.toLowerCase().includes(q)) ||
        (w.country && w.country.toLowerCase().includes(q));
      return matchCountry && matchSearch;
    });
  }, [warehouses, selectedCountryFilter, searchQuery, settings.tenantCountryCode]);

  const activeWh = warehouses.find(w => w.id === selectedWhId) || filteredWarehouses[0] || warehouses[0] || null;

  const activeMetrics = useMemo(() => {
    if (!activeWh) {
      return {
        whProducts: [] as Product[],
        storedStock: 0,
        totalRacks: 0,
        occupiedCapacity: 0,
        availableCapacity: 0,
        occupancyPct: 0
      };
    }
    return computeWarehouseMetrics(activeWh, products, liveRacksByWarehouse[activeWh.id]);
  }, [activeWh, products, liveRacksByWarehouse]);

  const activeWhProducts = activeMetrics.whProducts;
  const activeWhTotalStock = activeMetrics.storedStock;
  const hasStockOrProducts = activeWhProducts.length > 0;
  const isOnlyWarehouse = warehouses.length <= 1;

  // Respect tenant GeneralSettings defaults (Iraq / IQD / Asia/Baghdad)
  const tenantDefaultCountryCode = settings.tenantCountryCode || 'IQ';
  const resolvedCountryCode = activeWh?.countryCode || tenantDefaultCountryCode;
  const activeCountry = getCountryByCode(resolvedCountryCode);
  const normalizedStorageType = normalizeWarehouseStorageType(activeWh?.storageType);
  const isColdStorage = normalizedStorageType === 'ColdStorage';
  const storageTypeText = tr(isColdStorage ? 'storageTypeCold' : 'storageTypeStandard');

  const resolvedCountryName = useMemo(() => {
    if (!activeWh) return '';
    if (activeWh.country && activeWh.country !== 'Global') {
      return isAr ? activeWh.country : (activeCountry.nameEn || activeWh.country);
    }
    return isAr ? activeCountry.nameAr : activeCountry.nameEn;
  }, [activeWh, activeCountry, isAr]);

  const resolvedStateOrCity = useMemo(() => {
    if (!activeWh) return '';
    if (activeWh.state && activeWh.state !== 'Central') return activeWh.state;
    if (activeWh.city && activeWh.city !== 'Headquarters') return activeWh.city;
    const firstState = activeCountry.states[0];
    return firstState ? (isAr ? firstState.nameAr : firstState.nameEn) : '';
  }, [activeWh, activeCountry, isAr]);

  const resolvedTimezone = activeWh?.timezone && activeWh.timezone !== 'UTC'
    ? activeWh.timezone
    : (activeCountry.defaultTimezone || 'Asia/Baghdad (UTC+3)');

  const resolvedCurrency = activeWh?.currency || settings.baseCurrency || activeCountry.currencySymbol || 'IQD';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const occupancyPct = activeMetrics.occupancyPct;
  const totalRacks = activeMetrics.totalRacks;
  const occupiedCapacity = activeMetrics.occupiedCapacity;
  const availableCapacity = activeMetrics.availableCapacity;

  return (
    <div className="view-content-wrapper fade-in" style={{ paddingBottom: '3rem' }} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Header Bar */}
      <div className="view-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Building2 className="text-cyan" size={24} />
            <h2 className="view-title" style={{ margin: 0 }}>
              {tr('title')}
            </h2>
          </div>
          <p className="view-subtitle" style={{ margin: 0 }}>
            {tr('subtitle')}
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="view-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-add-primary"
              onClick={() => setIsAddModalOpen(true)}
              title={tr('addWarehouseTitle')}
            >
              <Plus size={18} />
              <span>{tr('addWarehouseBtn')}</span>
            </button>

            {activeWh && (
              <>
                <button
                  type="button"
                  className="btn-secondary-flat"
                  onClick={() => setIsEditModalOpen(true)}
                  title={tr('editHubTitle').replace('{name}', isAr ? activeWh.nameAr : (activeWh.nameEn || activeWh.nameAr))}
                  style={{
                    borderColor: 'var(--primary-border)',
                    color: 'var(--primary)',
                    background: 'var(--primary-light)',
                    fontWeight: 700
                  }}
                >
                  <Edit3 size={15} />
                  <span>{tr('editHubBtn')}</span>
                </button>

                {onDeleteWarehouse && (
                  <button
                    type="button"
                    className="btn-secondary-flat"
                    onClick={() => {
                      if (!activeWh) return;
                      const whDisplayName = isAr ? activeWh.nameAr : (activeWh.nameEn || activeWh.nameAr);

                      if (isOnlyWarehouse) {
                        alert(tr('deleteProtectedLast'));
                        return;
                      }

                      if (activeWhTotalStock > 0) {
                        alert(
                          tr('deleteProtectedStock')
                            .replace('{name}', whDisplayName)
                            .replace('{items}', String(activeWhProducts.length))
                            .replace('{stock}', activeWhTotalStock.toLocaleString())
                        );
                        return;
                      }

                      if (hasStockOrProducts) {
                        alert(
                          tr('deleteProtectedCatalog')
                            .replace('{name}', whDisplayName)
                            .replace('{items}', String(activeWhProducts.length))
                        );
                        return;
                      }

                      if (window.confirm(tr('deleteConfirm').replace('{name}', whDisplayName))) {
                        onDeleteWarehouse(activeWh.id);
                      }
                    }}
                    title={
                      hasStockOrProducts
                        ? tr('deleteProtectedStockTitle')
                            .replace('{items}', String(activeWhProducts.length))
                            .replace('{stock}', activeWhTotalStock.toLocaleString())
                        : (isOnlyWarehouse
                            ? tr('deleteProtectedSingleTitle')
                            : tr('deleteTitle').replace('{name}', isAr ? activeWh.nameAr : (activeWh.nameEn || activeWh.nameAr)))
                    }
                    style={{
                      borderColor: hasStockOrProducts ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      background: hasStockOrProducts ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)',
                      fontWeight: 700,
                      gap: '6px'
                    }}
                  >
                    <Trash2 size={15} />
                    <span>{tr('deleteHubBtn')}</span>
                    {hasStockOrProducts && (
                      <span style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#dc2626',
                        fontWeight: 800
                      }}>
                        {tr('itemsCountBadge').replace('{count}', String(activeWhProducts.length))}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {onOpenAddGoods && activeWh && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRight: isAr ? '1px solid var(--border)' : undefined,
              borderLeft: !isAr ? '1px solid var(--border)' : undefined,
              paddingRight: isAr ? '8px' : undefined,
              paddingLeft: !isAr ? '8px' : undefined
            }}>
              <button
                type="button"
                className="btn-secondary-flat"
                onClick={() => onOpenAddGoods('restock', activeWh.id)}
                title={tr('inboundRestockTitle')}
              >
                <ArrowDownToLine size={15} />
                <span>{tr('inboundRestockBtn')}</span>
              </button>
              <button
                type="button"
                className="btn-secondary-flat"
                onClick={() => onOpenAddGoods('new_product', activeWh.id)}
                title={tr('addItemSkuTitle')}
              >
                <Boxes size={15} />
                <span>{tr('addItemSkuBtn')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {warehouses.length === 0 ? (
        <div style={{
          background: 'var(--card)',
          border: '1px dashed var(--border)',
          borderRadius: '16px',
          padding: '4rem 2rem',
          textAlign: 'center',
          marginTop: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto'
          }}>
            <Building2 size={32} className="text-cyan" />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '8px' }}>
            {tr('emptyTitle')}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 1.5rem auto', lineHeight: '1.6' }}>
            {tr('emptySubtitle')}
          </p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-primary"
            style={{
              padding: '10px 24px',
              fontSize: '0.92rem',
              fontWeight: 700,
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <Plus size={18} />
            <span>{tr('addWarehouseTitle')}</span>
          </button>
        </div>
      ) : activeWh ? (
        <>
          {/* Global Filter Bar: Countries + Search */}
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '10px 16px',
              borderRadius: '12px',
              marginBottom: '1rem',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} style={{ color: 'var(--primary)' }} />
                {tr('filterCountryLabel')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCountryFilter('ALL')}
                  style={{
                    background: selectedCountryFilter === 'ALL' ? 'var(--primary)' : '#ffffff',
                    border: selectedCountryFilter === 'ALL' ? '1px solid var(--primary)' : '1px solid var(--border)',
                    color: selectedCountryFilter === 'ALL' ? '#ffffff' : '#475569',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: selectedCountryFilter === 'ALL' ? '0 2px 6px var(--primary-glow)' : 'none'
                  }}
                >
                  {tr('allCountries')}
                </button>

                {GLOBAL_COUNTRIES.map(c => {
                  const hasHubs = warehouses.some(w => (w.countryCode || tenantDefaultCountryCode) === c.code);
                  if (!hasHubs) return null;
                  const isSelected = selectedCountryFilter === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setSelectedCountryFilter(c.code)}
                      style={{
                        background: isSelected ? 'var(--primary)' : '#ffffff',
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                        color: isSelected ? '#ffffff' : '#475569',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 2px 6px var(--primary-glow)' : 'none'
                      }}
                    >
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: isSelected ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                        color: isSelected ? '#ffffff' : '#334155'
                      }}>
                        {c.code}
                      </span>
                      <span>{isAr ? c.nameAr : c.nameEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ position: 'relative', width: '280px', minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isAr ? 'right' : 'left']: '10px', color: '#64748b' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('searchPlaceholder')}
                style={{
                  width: '100%',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: isAr ? '7px 32px 7px 10px' : '7px 10px 7px 32px',
                  color: 'var(--foreground)',
                  fontSize: '0.82rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
              />
            </div>
          </div>

          {/* Hubs Selector Tabs Row */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', margin: '0.5rem 0 1.25rem 0' }}>
            {filteredWarehouses.map(h => {
              const tabMetrics = computeWarehouseMetrics(h, products, liveRacksByWarehouse[h.id]);
              const pct = tabMetrics.occupancyPct;
              const isSelected = activeWh.id === h.id;
              const countryDef = getCountryByCode(h.countryCode || tenantDefaultCountryCode);

              return (
                <button
                  key={h.id}
                  type="button"
                  className={`wh-tab-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedWhId(h.id);
                    if (onSelectWarehouse) onSelectWarehouse(h.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--primary)' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 8px var(--primary-glow)' : '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: isSelected ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    color: isSelected ? '#ffffff' : '#334155'
                  }}>
                    {countryDef.code}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                    <bdi dir="auto">{isAr ? h.nameAr : (h.nameEn || h.nameAr)}</bdi>
                  </span>
                  <span
                    className="wh-occ-tag"
                    dir="ltr"
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 7px',
                      borderRadius: '999px',
                      background: isSelected ? 'rgba(255, 255, 255, 0.25)' : (pct > 80 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                      color: isSelected ? '#ffffff' : (pct > 80 ? '#ef4444' : '#10b981'),
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {pct}%
                  </span>
                  {h.status === 'maintenance' && (
                    <span style={{ fontSize: '0.68rem', color: isSelected ? '#ffffff' : '#f59e0b', background: isSelected ? 'rgba(0,0,0,0.2)' : 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                      {tr('maintBadge')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Hub Details Summary Card (No duplicate edit button inside) */}
          <div
            className="wh-selected-card"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '1.75rem',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '2rem',
              alignItems: 'center',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
            }}
          >
            <div className="wh-info-left">
              {/* Warehouse Title, Country Code, Hub Code, Status, and Storage Type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569' }}>
                  {activeCountry.code}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--foreground)' }}>
                  <bdi dir="auto">{isAr ? activeWh.nameAr : (activeWh.nameEn || activeWh.nameAr)}</bdi>
                </h3>
                <span dir="ltr" style={{
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  border: '1px solid var(--border)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}>
                  {activeWh.code}
                </span>
                <span style={{
                  background: activeWh.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  color: activeWh.status === 'active' ? '#059669' : '#d97706',
                  border: activeWh.status === 'active' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {activeWh.status === 'active' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {activeWh.status === 'active' ? tr('statusActive') : tr('statusMaintenance')}
                </span>

                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: isColdStorage ? 'rgba(6, 182, 212, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                  border: `1px solid ${isColdStorage ? 'rgba(6, 182, 212, 0.35)' : 'rgba(59, 130, 246, 0.25)'}`,
                  color: isColdStorage ? '#0891b2' : 'var(--primary)',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}>
                  {isColdStorage ? <Snowflake size={13} /> : <Package size={13} />}
                  {storageTypeText}
                </span>
              </div>

              {/* Geographic Location & Address Banner */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 14px',
                margin: '8px 0 12px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155', flexWrap: 'wrap' }}>
                  <MapPin size={16} color="var(--primary)" />
                  <strong>{tr('locationLabel')}</strong>
                  <span>{resolvedCountryName}</span>
                  {resolvedStateOrCity && (
                    <>
                      <span>•</span>
                      <span>{resolvedStateOrCity}</span>
                    </>
                  )}
                  {activeWh.address && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#64748b' }}>{activeWh.address}</span>
                    </>
                  )}
                  {activeWh.postalCode && (
                    <span dir="ltr" style={{ background: '#e2e8f0', color: '#334155', padding: '1px 6px', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {activeWh.postalCode}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem' }}>
                  <span dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                    <Clock size={13} color="var(--primary)" />
                    {resolvedTimezone}
                  </span>
                  <span dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    <DollarSign size={13} />
                    {resolvedCurrency}
                  </span>
                </div>
              </div>

              {/* Operational Storage Type & Real Rack Count */}
              <div className="wh-specs-row" style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', color: '#64748b', fontSize: '0.83rem', marginTop: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} color="var(--primary)" />
                  <strong style={{ color: 'var(--foreground)' }}>{tr('managerLabel')}</strong> {activeWh.manager || tr('unassigned')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={15} color="var(--primary)" />
                  <strong style={{ color: 'var(--foreground)' }}>{tr('phoneLabel')}</strong>{' '}
                  <span dir="ltr" style={{ display: 'inline-block' }}>{activeWh.phone || tr('notRecorded')}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isColdStorage ? <Snowflake size={15} color="#0891b2" /> : <Package size={15} color="var(--primary)" />}
                  <strong style={{ color: 'var(--foreground)' }}>{tr('storageTypeLabel')}</strong>{' '}
                  <span style={{ color: isColdStorage ? '#0891b2' : 'var(--foreground)', fontWeight: isColdStorage ? 700 : 500 }}>
                    {storageTypeText}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={15} color="var(--primary)" />
                  <strong style={{ color: 'var(--foreground)' }}>{tr('racksLabel')}</strong>{' '}
                  <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--foreground)' }}>{totalRacks}</span>{' '}
                  {tr('storageBaysUnit')}
                </span>
              </div>

              {/* Dynamic Numerical Capacity Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '1.25rem' }}>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{tr('totalCapacityLabel')}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--foreground)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    <span dir="ltr">{activeWh.capacity.toLocaleString()}</span> <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{tr('capacityUnit')}</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{tr('occupiedVolumeLabel')}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    <span dir="ltr">{occupiedCapacity.toLocaleString()}</span> <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{tr('capacityUnit')}</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{tr('availableSpaceLabel')}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    <span dir="ltr">{availableCapacity.toLocaleString()}</span> <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{tr('capacityUnit')}</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{tr('storedSkusLabel')}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#d97706', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    <span dir="ltr">{activeWhProducts.length}</span> <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{tr('isolatedItemsUnit')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Radial Occupancy Gauge */}
            <div className="wh-radial-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <RadialGauge
                percentage={occupancyPct}
                label={tr('occupancyLabel')}
                color={occupancyPct > 80 ? '#ef4444' : occupancyPct > 60 ? '#f59e0b' : 'var(--primary)'}
                size={110}
              />
              <div style={{ marginTop: '8px', fontSize: '0.78rem', color: occupancyPct > 80 ? '#ef4444' : '#64748b', fontWeight: 700 }}>
                {occupancyPct > 80 ? tr('highLoadAlert') : tr('optimalCapacity')}
              </div>
            </div>
          </div>

          {/* Visual Live Rack Grid */}
          <WarehouseLiveLayout
            warehouse={activeWh}
            products={activeWhProducts}
            lang={lang}
            onConfigureRacks={() => setIsEditModalOpen(true)}
            onOpenRestock={() => onOpenAddGoods?.('restock', activeWh.id)}
            onNavigateToInventory={onNavigateToInventory}
            onRacksLoaded={handleRacksLoaded}
          />

          {/* Live Goods Stored in this Active Warehouse */}
          <div
            className="wh-live-goods-card"
            style={{
              marginTop: '1.5rem',
              padding: '1.5rem',
              borderRadius: '14px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Package size={20} color="var(--primary)" />
                  <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--foreground)' }}>
                    {tr('liveGoodsTitle')}{' '}
                    <bdi dir="auto">{isAr ? activeWh.nameAr : (activeWh.nameEn || activeWh.nameAr)}</bdi>
                  </h4>
                  <span style={{
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    border: '1px solid var(--border)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    {activeWhProducts.length} {tr('isolatedItemsUnit')}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  {tr('liveGoodsSubtitle')}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {onNavigateToInventory && (
                  <button
                    type="button"
                    onClick={() => onNavigateToInventory(activeWh.id)}
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      color: '#334155',
                      borderRadius: '8px',
                      padding: '7px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>{tr('openFullCatalogBtn')}</span>
                  </button>
                )}

                {onOpenAddGoods && (
                  <button
                    type="button"
                    onClick={() => onOpenAddGoods('new_product', activeWh.id)}
                    style={{
                      background: 'var(--primary)',
                      border: '1px solid var(--primary-hover)',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '7px 16px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px var(--primary-glow)'
                    }}
                  >
                    <Plus size={15} />
                    <span>{tr('addGoodsToHubBtn')}</span>
                  </button>
                )}
              </div>
            </div>

            {activeWhProducts.length === 0 ? (
              <div style={{
                padding: '2.5rem',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px dashed var(--border)'
              }}>
                <Package size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                <h5 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--foreground)' }}>
                  {tr('noGoodsTitle')}
                </h5>
                <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: '#64748b' }}>
                  {tr('noGoodsSubtitle')}
                </p>
                {onOpenAddGoods && (
                  <button
                    type="button"
                    onClick={() => onOpenAddGoods('new_product', activeWh.id)}
                    style={{
                      background: 'var(--primary)',
                      border: '1px solid var(--primary-hover)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '6px 16px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {tr('addFirstItemBtn')}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: isAr ? 'right' : 'left' }}>
                      <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{tr('colItemName')}</th>
                      <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{tr('colBarcodeSku')}</th>
                      <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{tr('colCategory')}</th>
                      <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{tr('colShelfBin')}</th>
                      <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{tr('colCurrentStock')}</th>
                      <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{tr('colSellingPrice')}</th>
                      <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{tr('colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeWhProducts.map((p) => {
                      const isLow = p.currentStock <= p.minStockAlert && p.currentStock > 0;
                      const isOut = p.currentStock <= 0;
                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.2s',
                            cursor: 'default'
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <strong style={{ color: 'var(--foreground)', display: 'block' }}>
                              <bdi dir="auto">{isAr ? p.nameAr : (p.nameEn || p.nameAr)}</bdi>
                            </strong>
                          </td>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.8rem' }} dir="ltr">
                            <div style={{ color: '#334155', fontWeight: 600 }}>{p.sku}</div>
                            <div style={{ color: '#64748b', fontSize: '0.74rem' }}>{p.barcode}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600 }}>
                              {isAr ? p.category : (p.categoryEn || p.category)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span dir="ltr" style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', color: '#d97706', fontSize: '0.78rem', fontWeight: 700 }}>
                              {p.shelf}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <strong dir="ltr" style={{ fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums', color: isOut ? '#ef4444' : isLow ? '#d97706' : '#059669' }}>
                              {p.currentStock.toLocaleString()}
                            </strong>{' '}
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.unit}</span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <strong dir="ltr" style={{ color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(p.sellingPrice)}</strong>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              background: isOut ? 'rgba(239, 68, 68, 0.1)' : isLow ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: isOut ? '#ef4444' : isLow ? '#d97706' : '#059669',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700
                            }}>
                              {isOut ? tr('statusOutOfStock') : isLow ? tr('statusLowStock') : tr('statusAvailable')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      <AddWarehouseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddWarehouse={onAddWarehouse}
        lang={lang}
        initialCountryCode={selectedCountryFilter !== 'ALL' ? selectedCountryFilter : tenantDefaultCountryCode}
        totalWarehousesCount={warehouses.length}
      />

      <EditWarehouseModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        warehouse={activeWh}
        lang={lang}
        onUpdateWarehouse={onUpdateWarehouse}
      />
    </div>
  );
}
