import React from 'react';
import { Warehouse as WarehouseIcon, MapPin, User, Phone, Box, CheckCircle, Edit3 } from 'lucide-react';
import { Warehouse as WarehouseType } from '../types/warehouse';

interface WarehousesTabProps {
  warehouses: WarehouseType[];
  lang: string;
  onSelectWarehouse: (id: string) => void;
  onEditWarehouse?: (id: string) => void;
}

export default function WarehousesTab({
  warehouses,
  lang,
  onSelectWarehouse,
  onEditWarehouse
}: WarehousesTabProps) {
  const isAr = lang === 'ar';

  return (
    <div className="warehouses-view fade-in">
      <div className="section-toolbar glass-panel">
        <div>
          <h2>{isAr ? 'شبكة المستودعات والمراكز اللوجستية' : 'Warehouse & Logistics Network'}</h2>
          <p className="chart-sub">{isAr ? 'إدارة المستودعات المركزية والفروع وسعات التخزين ومواقع التوزيع' : 'Central depots, regional hubs and distribution points'}</p>
        </div>
      </div>

      <div className="warehouses-grid">
        {warehouses.map(wh => {
          const occupancyRate = Math.round((wh.occupied / wh.capacity) * 100);
          return (
            <div key={wh.id} className="wh-card glass-panel">
              <div className="wh-card-header">
                <div className="wh-avatar-box">
                  <WarehouseIcon size={22} />
                </div>
                <div>
                  <span className="code-badge">{wh.code}</span>
                  <h3 className="wh-card-title"><span dir="auto">{wh.nameAr}</span></h3>
                </div>
              </div>

              <div className="wh-meta-list">
                <div className="wh-meta-row">
                  <MapPin size={16} />
                  <span dir="auto">{wh.city}</span>
                </div>
                <div className="wh-meta-row">
                  <User size={16} />
                  <span>{isAr ? 'المدير المسؤول:' : 'Manager:'} <span dir="auto">{wh.manager}</span></span>
                </div>
                <div className="wh-meta-row">
                  <Phone size={16} />
                  <span>{wh.phone}</span>
                </div>
                <div className="wh-meta-row">
                  <Box size={16} />
                  <span>{wh.itemsCount} {isAr ? 'صنف SKU مختلف مسجل' : 'different SKUs'}</span>
                </div>
              </div>

              <div className="wh-occupancy-section">
                <div className="occ-labels">
                  <span>{isAr ? 'السعة المشغولة:' : 'Storage Occupancy:'}</span>
                  <strong>{occupancyRate}% ({wh.occupied.toLocaleString()} / {wh.capacity.toLocaleString()} m³)</strong>
                </div>
                <div className="occupancy-progress-bar">
                  <div 
                    className={`occupancy-fill ${occupancyRate > 80 ? 'fill-warning' : 'fill-primary'}`}
                    style={{ width: `${occupancyRate}%` }}
                  ></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button 
                  className="btn-select-warehouse"
                  style={{ flex: 1 }}
                  onClick={() => onSelectWarehouse(wh.id)}
                >
                  <CheckCircle size={15} />
                  <span>{isAr ? 'تصفية البضائع' : 'Filter Items'}</span>
                </button>
                {onEditWarehouse && (
                  <button
                    type="button"
                    className="btn-secondary-flat"
                    onClick={() => onEditWarehouse(wh.id)}
                    style={{ 
                      padding: '0 12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '5px',
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    title={isAr ? `تعديل بيانات مستودع ${wh.nameAr}` : `Edit ${wh.nameAr}`}
                  >
                    <Edit3 size={15} />
                    <span>{isAr ? 'تعديل' : 'Edit'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
