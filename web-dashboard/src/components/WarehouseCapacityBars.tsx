import React from 'react';
import { Warehouse, Truck } from 'lucide-react';
import { Warehouse as WarehouseType } from '../types/warehouse';
import { localizeWarehouse } from '../lib/localeHelpers';

interface WarehouseCapacityBarsProps {
  lang?: 'en' | 'ar';
  warehouses?: WarehouseType[];
  inTransitShipmentsCount?: number;
  inTransitQty?: number;
  onNavigateWarehouses?: () => void;
}

export default function WarehouseCapacityBars({ 
  lang = 'ar', 
  warehouses: inputWarehouses, 
  inTransitShipmentsCount = 0,
  inTransitQty = 0,
  onNavigateWarehouses 
}: WarehouseCapacityBarsProps) {
  const isAr = lang === 'ar';

  const processedWarehouses = (inputWarehouses && inputWarehouses.length > 0)
    ? inputWarehouses.map((wh) => {
        const pct = wh.capacity > 0 ? Math.min(100, Math.round((wh.occupied / wh.capacity) * 100)) : 0;
        return {
          id: wh.id,
          nameAr: localizeWarehouse(wh.nameAr || wh.id, 'ar'),
          nameEn: localizeWarehouse(wh.nameEn || wh.nameAr || wh.id, 'en'),
          percentage: pct,
          usedVolume: wh.occupied.toLocaleString(),
          totalVolume: wh.capacity.toLocaleString(),
          usedPallets: (Math.round(wh.occupied / 10)).toLocaleString(),
          isOverCapacity: pct > 85
        };
      })
    : [];

  // Display top 3 representative warehouses on the dashboard card for perfect symmetry with the chart
  const displayWarehouses = processedWarehouses.slice(0, 3);

  return (
    <div className="warehouse-capacity-card" onClick={onNavigateWarehouses} style={{ cursor: 'pointer' }}>
      <div className="wc-card-header">
        <div>
          <h3 className="chart-title">
            {isAr ? 'سعة المستودعات ونسب الإشغال' : 'Warehouse Capacity & Occupancy'}
          </h3>
          <span className="wc-subtitle">
            {isAr ? 'مؤشرات المساحة التخزينية الأرضية' : 'Floor Occupancy Metrics'}
          </span>
        </div>
        <span className="wc-click-hint">
          {isAr ? 'عرض تفاصيل الأرفف ←' : 'View Racks →'}
        </span>
      </div>

      {/* 1. Scalable List of Physical Warehouses with Independent Occupancy Cards */}
      <div className="warehouses-bars-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {displayWarehouses.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: 'var(--muted-foreground)',
            background: 'var(--muted)',
            borderRadius: '10px',
            border: '1px dashed var(--border)'
          }}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>
              {isAr ? 'لا توجد مستودعات مسجلة في النظام حالياً' : 'No warehouses registered'}
            </p>
          </div>
        ) : (
          displayWarehouses.map((wh) => (
          <div 
            key={wh.id} 
            className="wh-bar-item-structured"
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            {/* Top Row: Name with Soft Green Active Badge (Right) and Bold % on Left */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Warehouse 
                  size={15} 
                  style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} 
                />
                <span 
                  style={{ fontWeight: 600, fontSize: '13px', color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} 
                  dir="auto"
                >
                  {isAr ? wh.nameAr : wh.nameEn}
                </span>
                <span 
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '1px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    lineHeight: '1.3',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {isAr ? 'نشط' : 'Active'}
                </span>
              </div>
              <span 
                style={{
                  fontWeight: 700,
                  fontSize: '14px',
                  color: wh.isOverCapacity ? 'var(--destructive)' : 'var(--foreground)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0
                }}
              >
                {wh.percentage}%
              </span>
            </div>

            {/* Middle Row: Progress Bar */}
            <div 
              style={{
                width: '100%',
                height: '8px',
                background: 'var(--muted)',
                borderRadius: '9999px',
                overflow: 'hidden',
                margin: '3px 0'
              }}
            >
              <div
                style={{
                  width: `${wh.percentage}%`,
                  height: '100%',
                  backgroundColor: wh.isOverCapacity ? 'var(--destructive)' : 'var(--primary)',
                  borderRadius: '9999px',
                  transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            </div>

            {/* Bottom Row: Single Readable Line */}
            <div 
              style={{
                fontSize: '11px',
                color: 'var(--muted-foreground)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {isAr ? (
                <>المستغلة: <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{wh.usedVolume} م³</strong> ({wh.usedPallets} طبلية) من إجمالي <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{wh.totalVolume} م³</strong></>
              ) : (
                <>Used: <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{wh.usedVolume} m³</strong> ({wh.usedPallets} pallets) of total <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{wh.totalVolume} m³</strong></>
              )}
            </div>
          </div>
        ))
      )}
      </div>

      {/* 2. Independent In-Transit Section (Moving cargo, not fixed floor capacity) */}
      <div 
        className="in-transit-section" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          marginTop: '10px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '10px 12px'
        }}
      >
        <div className="in-transit-header">
          <div className="transit-title-flex">
            <div className="truck-pulse-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <Truck size={15} />
            </div>
            <div>
              <strong style={{ color: 'var(--foreground)' }}>{isAr ? 'بضاعة قيد النقل والشحن' : 'In-Transit Cargo'}</strong>
              <small style={{ color: 'var(--muted-foreground)' }}>{isAr ? 'مناقلات جارية بين الفروع والمستودعات' : 'Active transfers between branches & warehouses'}</small>
            </div>
          </div>
          <span 
            className={inTransitShipmentsCount > 0 ? "transit-badge-active" : "transit-badge-idle"}
            style={inTransitShipmentsCount === 0 ? {
              background: 'var(--muted)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600
            } : undefined}
          >
            {inTransitShipmentsCount > 0 
              ? (isAr ? `${inTransitShipmentsCount} شحنات في الطريق` : `${inTransitShipmentsCount} Shipments En Route`)
              : (isAr ? 'لا توجد شحنات جارية' : 'No Shipments En Route')}
          </span>
        </div>

        <div className="transit-metrics-row">
          <div className="transit-stat-chip">
            <span className="chip-label" style={{ color: 'var(--muted-foreground)' }}>{isAr ? 'الكمية المتحركة:' : 'Moving Goods:'}</span>
            <span className="chip-value" style={{ color: 'var(--foreground)' }}>
              {inTransitQty > 0 
                ? `${inTransitQty.toLocaleString()} ${isAr ? 'طرد وكرتونة' : 'parcels & boxes'}` 
                : `0 ${isAr ? 'طرد' : 'parcels'}`}
            </span>
          </div>
          <div className="transit-stat-chip">
            <span className="chip-label" style={{ color: 'var(--muted-foreground)' }}>{isAr ? 'الشحنة الأقرب:' : 'Next Arrival:'}</span>
            <span className="chip-value" style={{ color: 'var(--foreground)' }}>
              {inTransitShipmentsCount > 0 
                ? (isAr ? 'شحنة واردة قيد النقل (16:00)' : 'Inbound Cargo in Transit (16:00)')
                : (isAr ? 'لا توجد وصولات مجدولة' : 'None scheduled')}
            </span>
          </div>
        </div>

        <div className="transit-live-bar" style={{ height: '6px', background: 'var(--muted)', borderRadius: '9999px', overflow: 'hidden' }}>
          <div 
            className="transit-live-fill" 
            style={{ 
              width: inTransitShipmentsCount > 0 ? '68%' : '0%', 
              height: '100%', 
              background: '#10b981', 
              borderRadius: '9999px' 
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}
