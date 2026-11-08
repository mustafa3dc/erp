import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Warehouse as WarehouseIcon, 
  MapPin, 
  User, 
  Thermometer, 
  Box, 
  Layers, 
  Plus, 
  ArrowDownToLine, 
  Edit3, 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Check, 
  Building2,
  Boxes,
  Globe2,
  Clock,
  DollarSign,
  ShieldCheck,
  Snowflake,
  ShieldAlert,
  Search,
  Filter,
  Package,
  ExternalLink,
  Trash2,
  Printer,
  Barcode,
  SlidersHorizontal
} from 'lucide-react';
import { Warehouse, Product } from '../../types/warehouse';
import { PurchaseInvoiceItem } from '../../types/purchases';
import RadialGauge from '../RadialGauge';
import EditWarehouseModal from '../modals/EditWarehouseModal';
import AddWarehouseModal from '../modals/AddWarehouseModal';
import PrintBarcodeLabelsModal from '../modals/PrintBarcodeLabelsModal';
import WarehouseLiveLayout from './WarehouseLiveLayout';
import { 
  GLOBAL_COUNTRIES, 
  STORAGE_CLASSIFICATIONS, 
  getCountryByCode, 
  getStatesForCountry, 
  getStorageTypeById, 
  CountryDef, 
  StorageClassificationDef 
} from '../../data/globalLocations';
import { useSettings } from '../../context/settings-context';

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
  const { formatMoney } = useSettings();
  
  // Country Filter for Tabs
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected warehouse tab
  const [selectedWhId, setSelectedWhId] = useState<string>(() => {
    if (selectedWarehouseId && selectedWarehouseId !== 'ALL') return selectedWarehouseId;
    return warehouses[0]?.id || '';
  });

  // Keep in sync if prop changes
  React.useEffect(() => {
    if (selectedWarehouseId && selectedWarehouseId !== 'ALL' && selectedWarehouseId !== selectedWhId) {
      setSelectedWhId(selectedWarehouseId);
    }
  }, [selectedWarehouseId]);

  // Filtered warehouses by country and search
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter(w => {
      const matchCountry = selectedCountryFilter === 'ALL' || w.countryCode === selectedCountryFilter;
      const matchSearch = !searchQuery.trim() || 
        w.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.city && w.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (w.country && w.country.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCountry && matchSearch;
    });
  }, [warehouses, selectedCountryFilter, searchQuery]);

  // Keep selected ID valid if list changes
  const activeWh = warehouses.find(w => w.id === selectedWhId) || filteredWarehouses[0] || warehouses[0] || null;

  // Dedicated products strictly assigned to this active warehouse
  const activeWhProducts = useMemo(() => {
    if (!activeWh) return [];
    return products.filter(p => p.warehouseId === activeWh.id || p.warehouseId === activeWh.code);
  }, [products, activeWh?.id, activeWh?.code]);

  const activeWhTotalStock = useMemo(() => {
    return activeWhProducts.reduce((sum, p) => sum + (Number(p.currentStock) || 0), 0);
  }, [activeWhProducts]);

  const hasStockOrProducts = activeWhProducts.length > 0;
  const isOnlyWarehouse = warehouses.length <= 1;

  // Resolve storage classification object
  const activeStorageType = getStorageTypeById(activeWh?.storageType || 'rdc_general');
  const activeCountry = getCountryByCode(activeWh?.countryCode || 'US');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Calculations
  const occupancyPct = (activeWh && activeWh.capacity > 0)
    ? Math.min(100, Math.round((activeWh.occupied / activeWh.capacity) * 100))
    : 0;

  const totalRacks = activeWh ? Math.max(0, Math.round(activeWh.capacity / 250)) : 0;
  const availableCapacity = activeWh ? Math.max(0, activeWh.capacity - activeWh.occupied) : 0;

  return (
    <div className="view-content-wrapper fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Top Header Bar */}
      {/* Top Header Bar */}
      <div className="view-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Building2 className="text-cyan" size={24} />
            <h2 className="view-title" style={{ margin: 0 }}>
              {isAr ? 'إدارة المستودعات والمخازن' : 'Warehouses & Storage Management'}
            </h2>
          </div>
          <p className="view-subtitle" style={{ margin: 0 }}>
            {isAr 
              ? 'إدارة شبكة المستودعات والفروع، رصد السعة التخزينية وحركة الرفوف والباركود' 
              : 'Warehouse and branch network management, capacity tracking, and rack layouts'}
          </p>
        </div>

        {/* Action Buttons Toolbar - Grouped & Clean */}
        <div className="view-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Warehouse Operations Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              type="button" 
              className="btn-add-primary"
              onClick={() => setIsAddModalOpen(true)}
              title={isAr ? 'إضافة مستودع جديد' : 'Register warehouse'}
            >
              <Plus size={18} />
              <span>{isAr ? 'إضافة مخزن جديد' : 'Add Warehouse'}</span>
            </button>

            {activeWh && (
              <>
                <button 
                  type="button" 
                  className="btn-secondary-flat"
                  onClick={() => setIsEditModalOpen(true)}
                  title={isAr ? `تعديل بيانات ومواصفات ${activeWh.nameAr}` : `Edit ${activeWh.nameAr} specs`}
                  style={{ 
                    borderColor: 'var(--primary-border)', 
                    color: 'var(--primary)', 
                    background: 'var(--primary-light)', 
                    fontWeight: 700 
                  }}
                >
                  <Edit3 size={15} />
                  <span>{isAr ? 'تعديل بيانات المستودع' : 'Edit Hub Details'}</span>
                </button>

                {onDeleteWarehouse && (
                  <button 
                    type="button" 
                    className="btn-secondary-flat"
                    onClick={() => {
                      if (!activeWh) return;

                      // Guard 1: Cannot delete the only remaining active warehouse
                      if (isOnlyWarehouse) {
                        alert(isAr 
                          ? 'تنبيه أمني لمنع فقدان البيانات:\n\nلا يمكن حذف المستودع الوحيد المتبقي في المنشأة. يجب الإبقاء على مستودع رئيسي نشط واحد على الأقل.' 
                          : 'Security Guard:\nCannot delete the only warehouse in the facility. At least one active warehouse must be maintained.');
                        return;
                      }

                      // Guard 2: Cannot delete warehouse with active physical stock
                      if (activeWhTotalStock > 0) {
                        alert(isAr
                          ? `حظر حذف المستودع لمنع فقدان البضائع:\n\nالمستودع "${activeWh.nameAr}" يحتوي حالياً على (${activeWhProducts.length}) صنف برصيد إجمالي (${activeWhTotalStock.toLocaleString()} قطعة).\n\nالنظام يمنع تماماً حذف أي مستودع به بضائع ورصيد فعلي لتفادي فقدان البيانات وتلف قيود المخزون. يرجى نقل المخزون أو تصفيته بالكامل قبل حذف المستودع.`
                          : `Cannot delete warehouse "${activeWh.nameAr}": It contains ${activeWhProducts.length} items with total physical stock of ${activeWhTotalStock.toLocaleString()} units.\nPlease transfer or liquidate stock before deletion.`);
                        return;
                      }

                      // Guard 3: Cannot delete warehouse with catalog products assigned to it
                      if (hasStockOrProducts) {
                        alert(isAr
                          ? `تنبيه:\n\nالمستودع "${activeWh.nameAr}" مسجل به (${activeWhProducts.length}) صنف في الدليل (رغم أن الرصيد الحالي 0).\n\nيرجى إعادة تعيين أو نقل ارتباط هذه الأصناف إلى مستودع آخر أولاً قبل حذف المستودع.`
                          : `Alert:\nWarehouse "${activeWh.nameAr}" has ${activeWhProducts.length} catalog items associated with it. Please reassign them before deletion.`);
                        return;
                      }

                      // Confirmation for empty warehouse
                      if (window.confirm(isAr 
                        ? `هل أنت متأكد من حذف المستودع الفارغ "${activeWh.nameAr}" نهائياً من النظام؟` 
                        : `Are you sure you want to delete empty warehouse "${activeWh.nameAr}"?`)) {
                        onDeleteWarehouse(activeWh.id);
                      }
                    }}
                    title={
                      hasStockOrProducts 
                        ? (isAr ? `المستودع محمي من الحذف: يحتوي على ${activeWhProducts.length} صنف (${activeWhTotalStock.toLocaleString()} قطعة)` : `Protected: contains ${activeWhProducts.length} items (${activeWhTotalStock.toLocaleString()} units)`)
                        : (isOnlyWarehouse 
                            ? (isAr ? 'المستودع الوحيد في المنشأة (محمي من الحذف)' : 'Single active warehouse (protected)') 
                            : (isAr ? `حذف ${activeWh.nameAr}` : `Delete ${activeWh.nameAr}`))
                    }
                    style={{ 
                      borderColor: hasStockOrProducts ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.3)', 
                      color: hasStockOrProducts ? '#ef4444' : '#ef4444', 
                      background: hasStockOrProducts ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)', 
                      fontWeight: 700,
                      gap: '6px'
                    }}
                  >
                    <Trash2 size={15} />
                    <span>{isAr ? 'حذف المستودع' : 'Delete Hub'}</span>
                    {hasStockOrProducts && (
                      <span style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#dc2626',
                        fontWeight: 800
                      }}>
                        {isAr ? `${activeWhProducts.length} صنف` : `${activeWhProducts.length} items`}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Goods Operations Group (if provided and active warehouse exists) */}
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
                title={isAr ? 'توريد واستلام شحنة واردة لهذا المستودع' : 'Inbound Restock'}
              >
                <ArrowDownToLine size={15} />
                <span>{isAr ? 'توريد شحنة' : 'Inbound Restock'}</span>
              </button>
              <button 
                type="button" 
                className="btn-secondary-flat"
                onClick={() => onOpenAddGoods('new_product', activeWh.id)}
                title={isAr ? 'إضافة صنف SKU لهذا المخزن' : 'Add Item SKU'}
              >
                <Boxes size={15} />
                <span>{isAr ? 'إضافة صنف SKU' : 'Add Item SKU'}</span>
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
            {isAr ? 'لا توجد مستودعات مسجلة في النظام' : 'No Warehouses Registered'}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 1.5rem auto', lineHeight: '1.6' }}>
            {isAr 
              ? 'تم حذف وتصفير جميع المستودعات بالكامل. النظام الآن نظيف ومصفّر بدون أي مخازن افتراضية، ويمكنك إنشاء مستودع جديد في أي وقت للبدء بإدارة المخازن والأرفف.' 
              : 'All warehouses have been deleted. The system is clean and ready.'}
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
            <span>{isAr ? 'إضافة مستودع جديد' : 'Add Warehouse'}</span>
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
        {/* Country Quick Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} style={{ color: 'var(--primary)' }} />
            {isAr ? 'تصفية حسب الدولة:' : 'Filter Country:'}
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
              {isAr ? 'جميع الدول' : 'All Countries'}
            </button>

            {GLOBAL_COUNTRIES.map(c => {
              const hasHubs = warehouses.some(w => w.countryCode === c.code);
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

        {/* Search Input */}
        <div style={{ position: 'relative', width: '280px', minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isAr ? 'right' : 'left']: '10px', color: '#64748b' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث باسم المستودع، الكود، المدينة...' : 'Search hub, code, city...'}
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

      {/* Hubs Selector Tabs Row with Country Flags */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', margin: '0.5rem 0 1.25rem 0' }}>
        {filteredWarehouses.map(h => {
          const pct = h.capacity > 0 ? Math.min(100, Math.round((h.occupied / h.capacity) * 100)) : 0;
          const isSelected = activeWh.id === h.id;
          const countryDef = getCountryByCode(h.countryCode || 'US');

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
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }} dir="auto">{h.nameAr}</span>
              <span 
                className="wh-occ-tag"
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: isSelected ? 'rgba(255, 255, 255, 0.25)' : (pct > 80 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                  color: isSelected ? '#ffffff' : (pct > 80 ? '#ef4444' : '#10b981'),
                  fontWeight: 800
                }}
              >
                {pct}%
              </span>
              {h.status === 'maintenance' && (
                <span style={{ fontSize: '0.68rem', color: isSelected ? '#ffffff' : '#f59e0b', background: isSelected ? 'rgba(0,0,0,0.2)' : 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                  {isAr ? 'صيانة' : 'Maint'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Hub Details Master Enterprise Card */}
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
          {/* Warehouse Title, Country Flag, Code, and Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569' }}>{activeCountry.code}</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--foreground)' }}>
              <span dir="auto">{activeWh.nameAr}</span>
            </h3>
            <span style={{ 
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
              {activeWh.status === 'active' ? (isAr ? 'نشط ويعمل' : 'Active') : (isAr ? 'تحت الصيانة والجرد' : 'Under Maintenance')}
            </span>

            {/* Storage Type Classification Pill */}
            <span style={{
              background: `${activeStorageType.badgeColor}15`,
              border: `1px solid ${activeStorageType.badgeColor}35`,
              color: activeStorageType.badgeColor,
              padding: '3px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              {isAr ? activeStorageType.nameAr : activeStorageType.nameEn}
            </span>

            {/* Edit Warehouse Button */}
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              style={{
                background: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                color: 'var(--primary)',
                borderRadius: '8px',
                padding: '5px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.2s'
              }}
              title={isAr ? 'تعديل بيانات هذا المستودع وتصنيفه' : 'Edit hub specifications'}
            >
              <Edit3 size={14} />
              <span>{isAr ? 'تعديل البيانات' : 'Edit Hub'}</span>
            </button>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155' }}>
              <MapPin size={16} color="var(--primary)" />
              <strong>{isAr ? 'الموقع الجغرافي:' : 'Location:'}</strong>
              <span>{isAr ? activeWh.country : (activeWh.country || activeCountry.nameEn)}</span>
              <span>•</span>
              <span>{activeWh.state || activeWh.city}</span>
              {activeWh.address && (
                <>
                  <span>•</span>
                  <span style={{ color: '#64748b' }}>{activeWh.address}</span>
                </>
              )}
              {activeWh.postalCode && (
                <span style={{ background: '#e2e8f0', color: '#334155', padding: '1px 6px', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  ZIP: {activeWh.postalCode}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                <Clock size={13} color="var(--primary)" />
                {activeWh.timezone || activeCountry.defaultTimezone}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                <DollarSign size={13} />
                {activeWh.currency || activeCountry.currency}
              </span>
            </div>
          </div>

          {/* Operational Climate & Manager Specs */}
          <div className="wh-specs-row" style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', color: '#64748b', fontSize: '0.83rem', marginTop: '6px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={15} color="var(--primary)" />
              <strong style={{ color: 'var(--foreground)' }}>{isAr ? 'المدير المسؤول:' : 'Manager:'}</strong> {activeWh.manager || (isAr ? 'غير محدد' : 'Unassigned')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={15} color="var(--primary)" />
              <strong style={{ color: 'var(--foreground)' }}>{isAr ? 'هاتف المستودع:' : 'Phone:'}</strong> <span style={{ direction: 'ltr', display: 'inline-block' }}>{activeWh.phone || (isAr ? 'غير مسجل' : 'Not recorded')}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Thermometer size={15} color="var(--primary)" />
              <strong style={{ color: 'var(--foreground)' }}>{isAr ? 'التحكم بالمناخ:' : 'Climate:'}</strong> {isAr ? activeStorageType.tempRangeAr : activeStorageType.tempRangeEn}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} color="var(--primary)" />
              <strong style={{ color: 'var(--foreground)' }}>{isAr ? 'القواطع والرفوف:' : 'Racks:'}</strong> {totalRacks} {isAr ? 'قاطع تخزين' : 'storage bays'}
            </span>
          </div>

          {/* Numerical Capacity Chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '1.25rem' }}>
            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{isAr ? 'السعة الكلية' : 'Total Capacity'}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--foreground)', marginTop: '2px' }}>
                {activeWh.capacity.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>m³</span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{isAr ? 'الحجم المشغول' : 'Occupied Volume'}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                {activeWh.occupied.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>m³</span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{isAr ? 'المساحة الشاغرة' : 'Available Space'}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                {availableCapacity.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>m³</span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{isAr ? 'الأصناف المخزنة فعلياً' : 'Stored SKUs'}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                {activeWhProducts.length} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{isAr ? 'صنف معزول' : 'isolated items'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Radial Occupancy Gauge */}
        <div className="wh-radial-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <RadialGauge 
            percentage={occupancyPct}
            label={isAr ? 'نسبة الإشغال' : 'Occupancy'}
            color={occupancyPct > 80 ? '#ef4444' : occupancyPct > 60 ? '#f59e0b' : 'var(--primary)'}
            size={110}
          />
          <div style={{ marginTop: '8px', fontSize: '0.78rem', color: occupancyPct > 80 ? '#ef4444' : '#64748b', fontWeight: 700 }}>
            {occupancyPct > 80 ? (isAr ? 'إشغال مرتفع' : 'High Load Alert') : (isAr ? 'مستقر ومتوازن' : 'Optimal Capacity')}
          </div>
        </div>
      </div>

      {/* Visual Live Rack Grid Section powered by WarehouseLiveLayout */}
      <WarehouseLiveLayout
        warehouse={activeWh}
        products={activeWhProducts}
        lang={lang}
        onConfigureRacks={() => setIsEditModalOpen(true)}
        onOpenRestock={(bayCode) => onOpenAddGoods?.('restock', activeWh.id)}
        onNavigateToInventory={onNavigateToInventory}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={20} color="var(--primary)" />
              <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--foreground)' }}>
                {isAr ? 'البضائع والمواد المخزنة في: ' : 'Goods & Stock Stored in: '}<span dir="auto">{activeWh.nameAr}</span>
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
                {activeWhProducts.length} {isAr ? 'صنف معزول' : 'isolated items'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              {isAr 
                ? 'قائمة حية بالمواد المخصصة حصرياً لهذا المستودع، أرقام الأرفف، والكميات المتوفرة' 
                : 'Live manifest of goods assigned exclusively to this warehouse hub with rack bins'}
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
                <span>{isAr ? 'فتح الجرد الكامل لهذا المخزن ↗' : 'Open Full Catalog ↗'}</span>
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
                <span>{isAr ? 'إضافة بضاعة لهذا المخزن' : 'Add Goods to Hub'}</span>
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
              {isAr ? 'لا توجد بضائع مخزنة في هذا المستودع حتى الآن' : 'No products stored in this hub yet'}
            </h5>
            <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: '#64748b' }}>
              {isAr ? 'يمكنك توريد شحنة جديدة أو إضافة صنف وتحديده لهذا المستودع مباشرة.' : 'You can add new goods or transfer stock to this warehouse.'}
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
                {isAr ? 'إضافة أول بضاعة لهذا المستودع' : 'Add First Item'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: isAr ? 'right' : 'left' }}>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'اسم الصنف' : 'Item Name'}</th>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'الباركود و SKU' : 'Barcode & SKU'}</th>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'التصنيف' : 'Category'}</th>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'الرف المعتمد' : 'Shelf Bin'}</th>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'الرصيد المتوفر' : 'Current Stock'}</th>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'سعر البيع' : 'Selling Price'}</th>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'الحالة' : 'Status'}</th>
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
                        <strong style={{ color: 'var(--foreground)', display: 'block' }} dir="auto">{p.nameAr}</strong>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        <div style={{ color: '#334155', fontWeight: 600 }}>{p.sku}</div>
                        <div style={{ color: '#64748b', fontSize: '0.74rem' }}>{p.barcode}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {p.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', color: '#d97706', fontSize: '0.78rem', fontWeight: 700 }}>
                          {p.shelf}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ fontSize: '0.95rem', color: isOut ? '#ef4444' : isLow ? '#d97706' : '#059669' }}>
                          {p.currentStock.toLocaleString()}
                        </strong>{' '}
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.unit}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ color: 'var(--foreground)' }}>{formatMoney(p.sellingPrice)}</strong>
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
                          {isOut ? (isAr ? 'نافد' : 'Out of stock') : isLow ? (isAr ? 'قرب النفاد' : 'Low stock') : (isAr ? 'متوفر' : 'Available')}
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

      {/* ========================================================
          MODAL 1: ADD NEW WAREHOUSE (+ إضافة مخزن جديد)
      ======================================================== */}
      <AddWarehouseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddWarehouse={onAddWarehouse}
        lang={lang}
        initialCountryCode={selectedCountryFilter !== "ALL" ? selectedCountryFilter : "IQ"}
        totalWarehousesCount={warehouses.length}
      />

      {/* ========================================================
          MODAL 2: EDIT WAREHOUSE (تعديل المستودع بكامل مواصفاته)
      ======================================================== */}
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
