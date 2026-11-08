import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  X, 
  Layers, 
  Box, 
  Barcode, 
  Printer, 
  Plus, 
  Warehouse, 
  RefreshCw 
} from 'lucide-react';
import { Product, Warehouse as WarehouseType } from '../../types/warehouse';
import { getTenantAuthHeaders } from '../../lib/api-client';
import PrintBarcodeLabelsModal from '../modals/PrintBarcodeLabelsModal';

export interface RackBayItem {
  id: string;
  bayCode: string;
  label: string;
  labelEn?: string;
  totalCapacity: number;
  usedCapacity: number;
  occupancy: number;
  items: Product[];
  isHighlighted?: boolean;
}

export interface WarehouseLiveLayoutProps {
  warehouse: WarehouseType;
  products?: Product[];
  lang?: 'ar' | 'en';
  onConfigureRacks?: () => void;
  onOpenRestock?: (bayCode?: string) => void;
  onNavigateToInventory?: (warehouseId: string) => void;
}

export const WarehouseLiveLayout: React.FC<WarehouseLiveLayoutProps> = ({
  warehouse,
  products = [],
  lang = 'ar',
  onConfigureRacks,
  onOpenRestock,
  onNavigateToInventory
}) => {
  const isAr = lang === 'ar';
  const [racks, setRacks] = useState<RackBayItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [racksViewMode, setRacksViewMode] = useState<'pallets' | 'bins'>('pallets');
  const [rackSearchTerm, setRackSearchTerm] = useState<string>('');
  const [selectedRackDrawer, setSelectedRackDrawer] = useState<RackBayItem | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // 1. Fetch live racks exclusively from backend API: GET /api/v1/wms/warehouses/{warehouseId}/racks
  const fetchRacks = useCallback(async () => {
    if (!warehouse?.id) return;
    setIsLoading(true);

    try {
      const headers = getTenantAuthHeaders();
      const res = await fetch(`/api/v1/wms/warehouses/${encodeURIComponent(warehouse.id)}/racks`, {
        method: 'GET',
        headers
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Normalize server rack models
          const mappedRacks: RackBayItem[] = data.map((r: any) => {
            const bayCode = r.bayCode || r.code || `BAY-${r.id}`;
            const totalCap = Number(r.totalCapacity) || (racksViewMode === 'pallets' ? 32 : 100);
            const usedCap = Number(r.usedCapacity) || (r.items ? r.items.reduce((sum: number, it: any) => sum + (it.currentStock || 1), 0) : 0);
            const calculatedOccupancy = totalCap > 0 ? Math.min(100, Math.round((usedCap / totalCap) * 100)) : 0;

            return {
              id: r.id || bayCode,
              bayCode: bayCode,
              label: r.label || (isAr ? `الرف قاطع ${bayCode}` : `Rack Bay ${bayCode}`),
              labelEn: r.labelEn || `Rack Bay ${bayCode}`,
              totalCapacity: totalCap,
              usedCapacity: usedCap,
              occupancy: calculatedOccupancy,
              items: Array.isArray(r.items) ? r.items : []
            };
          });
          setRacks(mappedRacks);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // Fallback: If network / dev server is disconnected, check if products have real shelf locations
    }

    // Local fallback purely derived from products actually assigned to shelf locations for this warehouse
    const whProducts = products.filter(p => p.warehouseId === warehouse.id || p.warehouseName === warehouse.nameAr);
    const shelfGroups: Record<string, Product[]> = {};

    whProducts.forEach(prod => {
      if (prod.shelf && prod.shelf.trim().length > 0) {
        const shelfKey = prod.shelf.trim().toUpperCase();
        if (!shelfGroups[shelfKey]) {
          shelfGroups[shelfKey] = [];
        }
        shelfGroups[shelfKey].push(prod);
      }
    });

    const shelfKeys = Object.keys(shelfGroups);
    if (shelfKeys.length === 0) {
      // Zero mock data: If no shelves are actually defined, racks strictly remains empty []
      setRacks([]);
    } else {
      const derivedRacks: RackBayItem[] = shelfKeys.map(shelfKey => {
        const bayCode = shelfKey.startsWith('BAY-') ? shelfKey : `BAY-${shelfKey}`;
        const items = shelfGroups[shelfKey];
        const usedCap = items.reduce((acc, it) => acc + (it.currentStock || 1), 0);
        const totalCap = racksViewMode === 'pallets' ? 32 : 100;
        const occ = totalCap > 0 ? Math.min(100, Math.round((usedCap / totalCap) * 100)) : 0;

        return {
          id: `rack-${bayCode.toLowerCase()}`,
          bayCode: bayCode,
          label: isAr ? `الرف قاطع ${shelfKey}` : `Rack Bay ${shelfKey}`,
          totalCapacity: totalCap,
          usedCapacity: usedCap,
          occupancy: occ,
          items: items
        };
      });
      setRacks(derivedRacks);
    }

    setIsLoading(false);
  }, [warehouse, products, racksViewMode, isAr]);

  useEffect(() => {
    fetchRacks();
  }, [fetchRacks]);

  // Filtered racks based on search term
  const displayedRacks = useMemo(() => {
    const term = rackSearchTerm.trim().toLowerCase();
    if (!term) return racks;

    return racks.map(rack => {
      const isMatch = 
        rack.bayCode.toLowerCase().includes(term) ||
        rack.label.toLowerCase().includes(term) ||
        rack.items.some(it => 
          it.nameAr.toLowerCase().includes(term) ||
          (it.nameEn && it.nameEn.toLowerCase().includes(term)) ||
          it.sku.toLowerCase().includes(term) ||
          (it.barcode && it.barcode.toLowerCase().includes(term))
        );
      return {
        ...rack,
        isHighlighted: isMatch
      };
    });
  }, [racks, rackSearchTerm]);

  return (
    <div className="racks-visual-card" style={{ marginTop: '1.5rem', padding: '1.5rem', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
      {/* Visualizer Header: Title, Controls & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '1.25rem' }}>
        <div>
          <h4 className="chart-title" style={{ margin: 0, fontSize: '1.15rem', color: 'var(--foreground)', fontWeight: 800 }}>
            {isAr ? 'توزيع الرفوف الحية والقواطع - ' : 'Live Rack Bays Layout - '}
            <span dir="auto">{warehouse.nameAr}</span>
          </h4>
          <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
            {isAr ? 'خريطة تفاعلية لمواقع التخزين، سعة الرفوف الرأسية، ومستوى الامتلاء اللوجستي الفعلي' : 'Interactive live warehouse bays layout with actual stored item occupancy'}
          </p>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Refresh button */}
          <button
            type="button"
            onClick={fetchRacks}
            className="btn-outline"
            title={isAr ? 'تحديث خريطة الرفوف' : 'Refresh Racks Layout'}
            style={{ padding: '6px 10px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span style={{ fontSize: '0.78rem' }}>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          {/* Rack Search Input */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search 
              size={14} 
              style={{ 
                position: 'absolute', 
                right: isAr ? '10px' : undefined, 
                left: !isAr ? '10px' : undefined, 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#94a3b8',
                pointerEvents: 'none'
              }} 
            />
            <input
              type="text"
              value={rackSearchTerm}
              onChange={(e) => setRackSearchTerm(e.target.value)}
              placeholder={isAr ? "بحث عن رف أو صنف أو باركود..." : "Search bay, SKU, barcode..."}
              style={{
                width: '100%',
                height: '34px',
                paddingRight: isAr ? '32px' : '10px',
                paddingLeft: !isAr ? '32px' : '10px',
                fontSize: '0.78rem',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: '#f8fafc',
                outline: 'none'
              }}
            />
            {rackSearchTerm && (
              <button
                type="button"
                onClick={() => setRackSearchTerm('')}
                style={{
                  position: 'absolute',
                  left: isAr ? '8px' : undefined,
                  right: !isAr ? '8px' : undefined,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 0
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* View Mode Switcher: Pallets vs Small Bins */}
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setRacksViewMode('pallets')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: racksViewMode === 'pallets' ? 700 : 500,
                background: racksViewMode === 'pallets' ? '#ffffff' : 'transparent',
                color: racksViewMode === 'pallets' ? '#0f172a' : '#64748b',
                boxShadow: racksViewMode === 'pallets' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Layers size={13} />
              <span>{isAr ? 'طبليات كبيرة' : 'Pallets'}</span>
            </button>
            <button
              type="button"
              onClick={() => setRacksViewMode('bins')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: racksViewMode === 'bins' ? 700 : 500,
                background: racksViewMode === 'bins' ? '#ffffff' : 'transparent',
                color: racksViewMode === 'bins' ? '#0f172a' : '#64748b',
                boxShadow: racksViewMode === 'bins' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Box size={13} />
              <span>{isAr ? 'خانات وأدراج صغيرة' : 'Small Bins'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Corrected Color Legend Bar strictly following Directive:
          - Stable Capacity: < 70% (#2563eb)
          - Crowded / High Load: 70% to 99% (#ea580c)
          - Full: 100% (#991b1b)
      */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: '16px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', marginBottom: '1rem', fontSize: '0.75rem', color: '#475569' }}>
        <span style={{ fontWeight: 700, color: '#334155' }}>
          {isAr ? 'دليل إشغال الرفوف:' : 'Rack Occupancy Key:'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#2563eb', display: 'inline-block' }}></span>
          <span>{isAr ? 'سعة منخفضة / مستقرة (< 70%)' : 'Stable Capacity (< 70%)'}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ea580c', display: 'inline-block' }}></span>
          <span>{isAr ? 'سعة مرتفعة / مكتظة (70% - 99%)' : 'Crowded (70% - 99%)'}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#991b1b', display: 'inline-block' }}></span>
          <span>{isAr ? 'ممتلئ كلياً (100%)' : 'Full (100%)'}</span>
        </span>
      </div>

      {/* 2. True Empty State when racks.length === 0 */}
      {racks.length === 0 && !isLoading ? (
        <div 
          className="wms-empty-state"
          id="wms-empty-state-view"
          data-testid="wms-empty-state-view"
          style={{
            padding: '3.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1.5px dashed #cbd5e1',
            margin: '1rem 0'
          }}
        >
          {/* Calm warehouse icon */}
          <div 
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              color: '#0284c7'
            }}
          >
            <Warehouse size={32} strokeWidth={1.75} />
          </div>

          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            {isAr ? 'لم يتم تخطيط قواطع ورفوف لهذا المستودع بعد' : 'No racks or bays have been planned for this warehouse yet'}
          </h3>

          <p style={{ fontSize: '0.84rem', color: '#64748b', maxWidth: '440px', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            {isAr 
              ? 'لم يتم تهيئة هيكل الرفوف أو تسكين أي بضائع في قواطع تخزين لهذا المستودع حتى الآن. يمكنك البدء بتخطيط وتوزيع الرفوف وتسكين البضائع فوراً.'
              : 'No rack layout has been defined or inventory slotted in storage bays for this warehouse yet. You can start planning the layout and allocating racks now.'}
          </p>

          <button
            type="button"
            id="configure-racks-btn"
            className="btn-primary"
            onClick={onConfigureRacks}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              fontSize: '0.88rem',
              fontWeight: 700,
              borderRadius: '8px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
            }}
          >
            <Plus size={16} />
            <span>{isAr ? 'تخطيط وتسكين الرفوف' : 'Configure & Plan Racks'}</span>
          </button>
        </div>
      ) : (
        /* Dynamic Interactive Rack Grid */
        <div className="racks-grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '12px' }}>
          {displayedRacks.map((bay) => {
            const isFull = bay.occupancy >= 100;
            const isCrowded = bay.occupancy >= 70 && !isFull;
            const statusColor = isFull ? '#991b1b' : isCrowded ? '#ea580c' : '#2563eb';
            const statusBg = isFull ? 'rgba(153, 27, 27, 0.12)' : isCrowded ? 'rgba(234, 88, 12, 0.12)' : 'rgba(37, 99, 235, 0.12)';
            const availableCount = Math.max(0, bay.totalCapacity - bay.usedCapacity);

            return (
              <div 
                key={bay.id || bay.bayCode} 
                id={`rack-bay-${bay.bayCode.toLowerCase()}`}
                data-testid={`rack-bay-${bay.bayCode.toLowerCase()}`}
                className="rack-bay-box"
                onClick={() => setSelectedRackDrawer(bay)}
                style={{
                  background: bay.isHighlighted ? '#eff6ff' : '#f8fafc',
                  border: bay.isHighlighted 
                    ? '2px solid #2563eb' 
                    : isFull 
                    ? '1px solid rgba(153, 27, 27, 0.4)' 
                    : isCrowded 
                    ? '1px solid rgba(234, 88, 12, 0.4)' 
                    : '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxShadow: bay.isHighlighted 
                    ? '0 0 0 3px rgba(37, 99, 235, 0.3), 0 4px 10px rgba(37, 99, 235, 0.2)' 
                    : '0 1px 2px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
                title={isAr ? `انقر لعرض أصناف ومحتويات ${bay.label}` : `Click to inspect ${bay.label} contents`}
              >
                {/* Header row */}
                <div className="rack-bay-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="rack-code" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>
                    {bay.bayCode}
                  </span>
                  <span 
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 800,
                      background: statusBg,
                      color: statusColor
                    }}
                  >
                    {bay.occupancy}%
                  </span>
                </div>

                {/* Visual Shelf Representation based on racksViewMode */}
                {racksViewMode === 'pallets' ? (
                  /* Pallets: 3 vertical tiers with crossbeams */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', margin: '4px 0', padding: '4px', background: 'var(--muted)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '2px', height: '8px' }}>
                      <span style={{ flex: 1, borderRadius: '2px', background: bay.occupancy >= 70 ? statusColor : 'var(--border)' }}></span>
                      <span style={{ flex: 1, borderRadius: '2px', background: bay.occupancy >= 90 ? statusColor : 'var(--border)' }}></span>
                    </div>
                    <div style={{ height: '2px', background: 'var(--border)' }}></div>
                    <div style={{ display: 'flex', gap: '2px', height: '8px' }}>
                      <span style={{ flex: 1, borderRadius: '2px', background: bay.occupancy >= 35 ? statusColor : 'var(--border)' }}></span>
                      <span style={{ flex: 1, borderRadius: '2px', background: bay.occupancy >= 50 ? statusColor : 'var(--border)' }}></span>
                    </div>
                    <div style={{ height: '2px', background: 'var(--border)' }}></div>
                    <div style={{ display: 'flex', gap: '2px', height: '8px' }}>
                      <span style={{ flex: 1, borderRadius: '2px', background: bay.occupancy > 0 ? statusColor : 'var(--border)' }}></span>
                      <span style={{ flex: 1, borderRadius: '2px', background: bay.occupancy >= 20 ? statusColor : 'var(--border)' }}></span>
                    </div>
                  </div>
                ) : (
                  /* Bins / Slots: Grid of small drawers */
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px', margin: '4px 0', padding: '4px', background: 'var(--muted)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    {Array.from({ length: 8 }).map((_, slotIdx) => {
                      const slotFilled = bay.occupancy >= ((slotIdx + 1) * 12.5);
                      return (
                        <div 
                          key={slotIdx}
                          style={{
                            height: '10px',
                            borderRadius: '2px',
                            background: slotFilled ? statusColor : '#e2e8f0',
                            border: '1px solid rgba(0,0,0,0.05)'
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Capacity breakdown under bay */}
                <div style={{ fontSize: '0.72rem', color: '#1e293b', fontWeight: 700, marginTop: '2px' }}>
                  {bay.usedCapacity} / {bay.totalCapacity} {racksViewMode === 'pallets' ? (isAr ? 'طبلية' : 'Pallets') : (isAr ? 'علبة' : 'Bins')}
                </div>
                <div style={{ fontSize: '0.68rem', color: isFull ? '#b91c1c' : '#64748b', fontWeight: isFull ? 700 : 500 }}>
                  {isAr ? 'متاح: ' : 'Avail: '} {availableCount} {racksViewMode === 'pallets' ? (isAr ? 'طبلية' : 'Pallets') : (isAr ? 'علبة' : 'Bins')}
                </div>

                <small className="rack-label" style={{ fontSize: '0.68rem', color: '#94a3b8', borderTop: '1px dashed #e2e8f0', paddingTop: '4px', marginTop: '2px' }}>
                  {bay.label}
                </small>
              </div>
            );
          })}
        </div>
      )}

      {/* Side Drawer for Inspected Rack Bay rendered via Portal */}
      {selectedRackDrawer && typeof document !== 'undefined' && createPortal(
        <div 
          id="rack-drawer-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: isAr ? 'flex-start' : 'flex-end',
            overflow: 'hidden'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedRackDrawer(null);
            }
          }}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div 
            id="rack-drawer-bay"
            data-testid="rack-drawer-bay"
            style={{
              width: '100%',
              maxWidth: '460px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--card, #ffffff)',
              color: 'var(--foreground, #0f172a)',
              borderLeft: isAr ? '1px solid var(--border, #e2e8f0)' : 'none',
              borderRight: isAr ? 'none' : '1px solid var(--border, #e2e8f0)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              zIndex: 100000,
              overflow: 'hidden'
            }}
          >
            {/* 1. ترويسة ثابتة بأعلى الشاشة دائماً */}
            <div 
              style={{
                padding: '1.25rem',
                borderBottom: '1px solid var(--border, #e2e8f0)',
                backgroundColor: 'var(--card, #ffffff)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--foreground, #0f172a)' }}>
                    {isAr ? `تفاصيل القاطع: ${selectedRackDrawer.bayCode}` : `Bay Details: ${selectedRackDrawer.bayCode}`}
                  </h3>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px' }}>
                    {selectedRackDrawer.label}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  {isAr ? `المستودع: ${warehouse.nameAr}` : `Warehouse: ${warehouse.nameEn || warehouse.nameAr}`}
                </p>
              </div>
              <button 
                type="button" 
                id="close-rack-drawer-btn"
                onClick={() => setSelectedRackDrawer(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  color: '#64748b'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* 2. محتوى الرف القابل للتمرير */}
            <div 
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              {/* Capacity Progress Metric */}
              <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--card, #ffffff)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                    {isAr ? 'مستوى الاستيعاب والإشغال الفعلي:' : 'Capacity Occupancy:'}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: selectedRackDrawer.occupancy >= 100 ? '#991b1b' : selectedRackDrawer.occupancy >= 70 ? '#ea580c' : '#2563eb' }}>
                    {selectedRackDrawer.occupancy}%
                  </span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{
                      height: '100%',
                      width: `${selectedRackDrawer.occupancy}%`,
                      background: selectedRackDrawer.occupancy >= 100 ? '#991b1b' : selectedRackDrawer.occupancy >= 70 ? '#ea580c' : '#2563eb',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>{isAr ? 'المشغول فعلياً:' : 'Used:'} <strong>{selectedRackDrawer.usedCapacity}</strong></span>
                  <span>{isAr ? 'المتاح:' : 'Available:'} <strong>{Math.max(0, selectedRackDrawer.totalCapacity - selectedRackDrawer.usedCapacity)}</strong></span>
                  <span>{isAr ? 'الكل:' : 'Total:'} <strong>{selectedRackDrawer.totalCapacity}</strong></span>
                </div>
              </div>

              {/* Stored Items List */}
              <div>
                <h5 style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--foreground, #0f172a)' }}>
                  {isAr ? 'الأصناف المسكنة بالقاطع' : 'Items Stored in this Bay'} ({selectedRackDrawer.items.length})
                </h5>

                {selectedRackDrawer.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                    <Box size={32} color="#94a3b8" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                      {isAr ? 'الرف فارغ حالياً وجاهز للتسكين' : 'Bay is empty and ready for allocation'}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {isAr ? 'يمكنك تسكين بضائع جديدة في هذا الرف مباشرة' : 'You can allocate items to this rack'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedRackDrawer.items.map((prod) => (
                      <div 
                        key={prod.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border, #e2e8f0)',
                          background: 'var(--card, #ffffff)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {prod.nameAr}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.72rem', color: '#64748b' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{prod.sku}</span>
                            <span>•</span>
                            <span>{prod.category}</span>
                            {prod.barcode && (
                              <>
                                <span>•</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Barcode size={12} />
                                  {prod.barcode}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--foreground, #0f172a)' }}>
                            {prod.currentStock || 0}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {prod.unit || (isAr ? 'قطعة' : 'Unit')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Action footer in drawer */}
            <div 
              style={{
                padding: '1.25rem',
                borderTop: '1px solid var(--border, #e2e8f0)',
                backgroundColor: 'var(--card, #ffffff)',
                position: 'sticky',
                bottom: 0,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <button 
                type="button" 
                id="drawer-print-rack-labels-btn"
                onClick={() => setIsPrintModalOpen(true)}
                className="btn-outline"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '8px'
                }}
              >
                <Printer size={15} />
                <span>{isAr ? 'طباعة ملصق الباركود للقاطع (ZPL / A4)' : 'Print Bay Barcode Label'}</span>
              </button>

              <button 
                type="button" 
                id="drawer-deposit-btn"
                onClick={() => {
                  if (onNavigateToInventory) {
                    onNavigateToInventory(warehouse.id);
                  } else if (onOpenRestock) {
                    onOpenRestock(selectedRackDrawer.bayCode);
                  }
                  setSelectedRackDrawer(null);
                }}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '8px'
                }}
              >
                <Plus size={15} />
                <span>{isAr ? 'إيداع وتسكين بضاعة هنا' : 'Deposit & Allocate Stock Here'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Barcode Print Modal for Selected Rack */}
      {selectedRackDrawer && isPrintModalOpen && (
        <PrintBarcodeLabelsModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          lang={lang}
          warehouseName={warehouse.nameAr || ''}
          billNumber={selectedRackDrawer.bayCode}
          items={
            selectedRackDrawer.items.length > 0
              ? selectedRackDrawer.items.map(p => ({
                  id: p.id,
                  sku: p.sku,
                  nameAr: p.nameAr,
                  nameEn: p.nameEn || p.nameAr,
                  quantity: p.currentStock || 1,
                  barcode: p.barcode || p.sku,
                  unitCost: p.costPrice || 0,
                  currentSellingPrice: p.sellingPrice || 0,
                  sellingPrice: p.sellingPrice || 0,
                  lineTotal: (p.costPrice || 0) * (p.currentStock || 1),
                  uom: p.unit || (isAr ? 'قطعة' : 'Unit'),
                  category: p.category || (isAr ? 'عام' : 'General')
                }))
              : [{
                  id: selectedRackDrawer.bayCode,
                  sku: selectedRackDrawer.bayCode,
                  nameAr: `${selectedRackDrawer.label} - ${warehouse?.nameAr || ''}`,
                  nameEn: `${selectedRackDrawer.bayCode} - Shelf Location`,
                  quantity: 1,
                  barcode: `${selectedRackDrawer.bayCode}`,
                  unitCost: 0,
                  currentSellingPrice: 0,
                  sellingPrice: 0,
                  lineTotal: 0,
                  uom: isAr ? 'موقع' : 'Location',
                  category: isAr ? 'رفوف' : 'Racks'
                }]
          }
        />
      )}
    </div>
  );
};

export default WarehouseLiveLayout;
