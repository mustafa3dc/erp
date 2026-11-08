import React, { useState } from 'react';
import { getStoredTransfers, saveStoredTransfers } from '../../services/storageService';
import { 
  ArrowLeftRight, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Search, 
  Package, 
  User, 
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Building2,
  Calendar,
  Printer,
  FileText,
  Trash2,
  X,
  Phone,
  Layers,
  MapPin,
  Send
} from 'lucide-react';
import { localizeWarehouse } from '../../lib/localeHelpers';
import { Product, Warehouse } from '../../types/warehouse';
import { getStoredWarehouses } from '../../services/storageService';
import TransferManifestModal from '../modals/TransferManifestModal';
import CreateTransferModal from '../modals/CreateTransferModal';

export interface TransferItem {
  productId?: string;
  sku: string;
  name: string;
  qty: number;
  unit?: string;
}

export interface TransferRecord {
  id: string;
  transferNumber: string;
  fromWarehouse: string;
  toWarehouse: string;
  status: 'In-Transit' | 'Received' | 'Pending';
  dispatchDate: string;
  estimatedArrival: string;
  driverName: string;
  driverPhone?: string;
  truckPlate: string;
  items: TransferItem[];
  notes?: string;
  receivedDate?: string;
  receivedBy?: string;
}

export interface TransfersViewProps {
  lang: 'en' | 'ar';
  products?: Product[];
  warehouses?: Warehouse[];
  onUpdateProducts?: (products: Product[]) => void;
}

export default function TransfersView({ 
  lang, 
  products = [], 
  warehouses = [], 
  onUpdateProducts 
}: TransfersViewProps) {
  const isAr = lang === 'ar';
  
  const currentWarehouses = warehouses && warehouses.length > 0 ? warehouses : getStoredWarehouses();
  
  const [transfers, setTransfers] = useState<TransferRecord[]>(() => {
    return getStoredTransfers();
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'In-Transit' | 'Received' | 'Pending'>('ALL');
  const [toastMsg, setToastMsg] = useState('');
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const [selectedTransferForManifest, setSelectedTransferForManifest] = useState<TransferRecord | null>(null);

  const handleOpenNewTransfer = () => {
    setIsNewTransferOpen(true);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const persistTransfers = (updated: TransferRecord[]) => {
    setTransfers(updated);
    saveStoredTransfers(updated);
  };

  // Mark In-Transit shipment as Received
  const handleReceive = (id: string) => {
    const targetTransfer = transfers.find(t => t.id === id);
    if (!targetTransfer) return;

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const updated = transfers.map(t => {
      if (t.id === id) {
        return { 
          ...t, 
          status: 'Received' as const,
          receivedDate: nowStr,
          receivedBy: isAr ? 'أمين المستودع (استلام معتمد)' : 'Warehouse Officer (Verified)'
        };
      }
      return t;
    });

    // If destination warehouse stock needs incrementing:
    if (onUpdateProducts && products.length > 0) {
      const updatedProducts = products.map(p => {
        const itemTransferred = targetTransfer.items.find(i => i.sku === p.sku);
        if (itemTransferred && p.warehouseId === targetTransfer.toWarehouse) {
          return {
            ...p,
            currentStock: p.currentStock + itemTransferred.qty,
            updatedAt: nowStr
          };
        }
        return p;
      });
      onUpdateProducts(updatedProducts);
    }

    persistTransfers(updated);
    showToast(isAr ? 'تم استلام الشحنة وتفريغها بالمستودع وتحديث الرصيد بنجاح!' : 'Shipment received, stored, and stock credited!');
  };

  // Dispatch a Pending Transfer
  const handleDispatchPending = (id: string) => {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const updated = transfers.map(t => {
      if (t.id === id) {
        return { 
          ...t, 
          status: 'In-Transit' as const,
          dispatchDate: nowStr
        };
      }
      return t;
    });
    persistTransfers(updated);
    showToast(isAr ? 'تم تسيير الشاحنة وتحديث الحالة إلى: في الطريق (In-Transit)' : 'Dispatched! Status changed to In-Transit');
  };

  // Submit and create new transfer order
  const handleCreateTransfer = (newRecord: TransferRecord) => {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    // Deduct stock from origin warehouse if In-Transit
    if (newRecord.status === 'In-Transit' && onUpdateProducts && products.length > 0) {
      const updatedProducts = products.map(p => {
        const transferred = newRecord.items.find(i => i.sku === p.sku);
        if (transferred && p.warehouseId === newRecord.fromWarehouse) {
          const newQty = Math.max(0, p.currentStock - transferred.qty);
          return {
            ...p,
            currentStock: newQty,
            status: newQty === 0 ? ('out_of_stock' as const) : newQty <= p.minStockAlert ? ('low' as const) : ('available' as const),
            updatedAt: nowStr
          };
        }
        return p;
      });
      onUpdateProducts(updatedProducts);
    }

    const updatedList = [newRecord, ...transfers];
    persistTransfers(updatedList);

    showToast(isAr ? `تم إصدار أمر المناقلة رقم ${newRecord.transferNumber} بنجاح!` : `Transfer order ${newRecord.transferNumber} created!`);
    
    // Automatically preview manifest
    setSelectedTransferForManifest(newRecord);
  };

  const filtered = transfers.filter(t => {
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      t.transferNumber.toLowerCase().includes(q) ||
      t.driverName.toLowerCase().includes(q) ||
      t.truckPlate.toLowerCase().includes(q) ||
      t.items.some(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  const inTransitCount = transfers.filter(t => t.status === 'In-Transit').length;
  const receivedCount = transfers.filter(t => t.status === 'Received').length;
  const pendingCount = transfers.filter(t => t.status === 'Pending').length;
  const totalUnitsMoving = transfers
    .filter(t => t.status === 'In-Transit')
    .reduce((acc, t) => acc + t.items.reduce((s, i) => s + i.qty, 0), 0);

  return (
    <div className="view-content-wrapper fade-in" style={{ paddingBottom: '60px' }}>
      {toastMsg && (
        <div className="toast-banner glass-panel" style={{ 
          position: 'fixed', 
          bottom: '24px', 
          left: '24px', 
          zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#34d399',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
          padding: '12px 20px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Module Context Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <Truck size={15} style={{ color: 'var(--primary)' }} />
            <span>{isAr ? 'سلاسل الإمداد اللوجستية / التحويلات بين الفروع وتتبع الطريق' : 'Supply Chain Logistics / Inter-Warehouse Transfers & In-Transit'}</span>
          </p>
          <h2 style={{ margin: '4px 0 0 0', fontSize: '20px', color: 'var(--foreground)', fontWeight: 800 }}>
            {isAr ? 'إدارة المناقلات والشحنات بين المستودعات' : 'Freight & Warehouse Transfer Management'}
          </h2>
        </div>

        <div className="module-actions-wrap">
          <button 
            type="button"
            className="btn-clean-primary"
            onClick={handleOpenNewTransfer}
          >
            <Plus size={16} />
            <span>{isAr ? 'إصدار أمر مناقلة وشحن جديد' : 'New Transfer & Freight Order'}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards Row */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'شحنات في الطريق نشطة' : 'Active In-Transit'}</span>
            <div className="module-kpi-value">
              {inTransitCount} <span className="kpi-sub-unit">{isAr ? 'شاحنات' : 'trucks'}</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Truck size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'قطع بضائع قيد النقل' : 'Units In Motion'}</span>
            <div className="module-kpi-value">
              {totalUnitsMoving} <span className="kpi-sub-unit">{isAr ? 'قطعة' : 'units'}</span>
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <Package size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'مناقلات تم استلامها بنجاح' : 'Delivered & Stored'}</span>
            <div className="module-kpi-value">
              {receivedCount} <span className="kpi-sub-unit">{isAr ? 'مكتملة' : 'completed'}</span>
            </div>
          </div>
          <div className="module-kpi-icon emerald">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'قيد التجهيز والتحميل' : 'Pending Loading'}</span>
            <div className="module-kpi-value">
              {pendingCount} <span className="kpi-sub-unit">{isAr ? 'شحنات' : 'orders'}</span>
            </div>
          </div>
          <div className="module-kpi-icon cyan">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="module-toolbar" style={{ marginTop: '20px', marginBottom: '20px' }}>
        <div className="module-search-box" style={{ flex: '1', minWidth: '280px' }}>
          <Search size={16} />
          <input 
            type="text" 
            placeholder={isAr ? 'بحث برقم المناقلة، الصنف، السائق، أو رقم الشاحنة...' : 'Search transfer #, SKU, product, driver, truck...'} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="module-filter-pills">
          {(['ALL', 'In-Transit', 'Pending', 'Received'] as const).map((st) => (
            <button
              key={st}
              className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'ALL' ? (isAr ? 'جميع الشحنات' : 'All Transfers') :
               st === 'In-Transit' ? (isAr ? 'في الطريق' : 'In-Transit') :
               st === 'Pending' ? (isAr ? 'قيد التجهيز' : 'Pending') :
               (isAr ? 'تم الاستلام' : 'Received')}
            </button>
          ))}
        </div>
      </div>

      {/* Transfers Manifest Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', background: 'var(--card)', borderRadius: '16px', border: '1px dashed var(--border)', color: 'var(--muted-foreground)' }}>
            <Truck size={36} style={{ color: 'var(--muted-foreground)', margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px', color: 'var(--foreground)', fontSize: '15px' }}>{isAr ? 'لا توجد مناقلات أو شحنات مسجلة حالياً' : 'No transfers recorded'}</h4>
            <p style={{ margin: 0, fontSize: '13px' }}>{isAr ? 'النظام صافٍ وجاهز لإنشاء أول أمر مناقلة بين المستودعات' : 'Clean slate. Ready to create your first inter-branch transfer.'}</p>
          </div>
        ) : (
          filtered.map(t => {
          const totalPcs = t.items.reduce((s, i) => s + i.qty, 0);
          return (
            <div 
              key={t.id} 
              style={{ 
                display: 'flex',
                flexDirection: 'column', 
                alignItems: 'stretch', 
                padding: '20px', 
                gap: '16px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Top Accent Strip */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: t.status === 'In-Transit' 
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' 
                  : t.status === 'Received' 
                    ? 'linear-gradient(90deg, #10b981, #34d399)' 
                    : 'linear-gradient(90deg, var(--primary), var(--primary-hover))'
              }} />

              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--primary)', fontFamily: 'monospace', fontWeight: 800 }}>
                      {t.transferNumber}
                    </span>
                    <span style={{ 
                      fontSize: '11px', 
                      background: '#f1f5f9', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      color: '#64748b',
                      fontWeight: 600
                    }}>
                      {t.id}
                    </span>
                  </div>

                  {/* Route Flow */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }} dir="auto">
                      {t.fromWarehouse}
                    </span>
                    <ArrowRight size={14} style={{ color: 'var(--primary)', transform: isAr ? 'rotate(180deg)' : 'none' }} />
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)' }} dir="auto">
                      {t.toWarehouse}
                    </span>
                  </div>
                </div>

                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: t.status === 'In-Transit' ? '#fffbeb' : t.status === 'Received' ? '#ecfdf5' : 'var(--primary-light)',
                  color: t.status === 'In-Transit' ? '#b45309' : t.status === 'Received' ? '#047857' : 'var(--primary)',
                  border: `1px solid ${t.status === 'In-Transit' ? '#fde68a' : t.status === 'Received' ? '#a7f3d0' : 'var(--primary-border)'}`
                }}>
                  {t.status === 'In-Transit' ? (isAr ? 'في الطريق' : 'In-Transit') :
                   t.status === 'Received' ? (isAr ? 'تم الاستلام' : 'Received') :
                   (isAr ? 'قيد التجهيز' : 'Pending')}
                </span>
              </div>

              {/* Carrier & Logistics Box */}
              <div style={{ 
                fontSize: '12px', 
                color: '#475569', 
                lineHeight: '1.7', 
                background: '#f8fafc', 
                padding: '12px 14px', 
                borderRadius: '10px', 
                border: '1px solid #e2e8f0' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={13} style={{ color: 'var(--primary)' }} />
                    <span>{isAr ? 'السائق:' : 'Driver:'} <strong style={{ color: '#0f172a' }}>{t.driverName}</strong></span>
                  </div>
                  {t.driverPhone && (
                    <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{t.driverPhone}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <Truck size={13} style={{ color: '#64748b' }} />
                  <span>{isAr ? 'الشاحنة والمركبة:' : 'Truck:'} <span style={{ color: '#0f172a', fontWeight: 600 }}>{t.truckPlate}</span></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <Clock size={13} style={{ color: '#64748b' }} />
                  <span>{isAr ? 'وقت الإرسال:' : 'Dispatched:'} <span style={{ color: '#0f172a' }}>{t.dispatchDate}</span></span>
                </div>
                {t.receivedDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: '#047857' }}>
                    <CheckCircle2 size={13} />
                    <span>{isAr ? 'تاريخ الاستلام:' : 'Delivered:'} {t.receivedDate} ({t.receivedBy || ''})</span>
                  </div>
                )}
              </div>

              {/* Manifest Items List */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Layers size={13} style={{ color: 'var(--primary)' }} />
                    <span>{isAr ? 'محتويات الشحنة (Cargo Items):' : 'Cargo Manifest Items:'}</span>
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>
                    {totalPcs} {isAr ? 'قطعة إجمالية' : 'total units'}
                  </span>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 12px', border: '1px solid #e2e8f0' }}>
                  {t.items.map((item, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        fontSize: '12px', 
                        padding: '6px 0', 
                        borderBottom: idx < t.items.length - 1 ? '1px dashed #e2e8f0' : 'none' 
                      }}
                    >
                      <div>
                        <span style={{ color: '#0f172a', display: 'block', fontWeight: 600 }}>{item.name}</span>
                        <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>{item.sku}</span>
                      </div>
                      <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '13px' }}>
                        {item.qty} {item.unit || (isAr ? 'قطعة' : 'pcs')}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {t.notes && (
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontStyle: 'italic', background: '#f1f5f9', padding: '6px 10px', borderRadius: '6px' }}>
                  {t.notes}
                </p>
              )}

              {/* Actions Row */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTransferForManifest(t)}
                  style={{
                    flex: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = 'var(--primary)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#334155';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                >
                  <FileText size={15} />
                  <span>{isAr ? 'بيان الشحنة (Manifest)' : 'Waybill Manifest'}</span>
                </button>

                {t.status === 'In-Transit' && (
                  <button 
                    type="button"
                    className="btn-clean-success" 
                    style={{ flex: '1.2', justifyContent: 'center', padding: '9px 12px', fontSize: '12px' }}
                    onClick={() => handleReceive(t.id)}
                  >
                    <CheckCircle2 size={15} />
                    <span>{isAr ? 'استلام بالمخزن' : 'Confirm Receipt'}</span>
                  </button>
                )}

                {t.status === 'Pending' && (
                  <button 
                    type="button"
                    className="btn-clean-primary" 
                    style={{ flex: '1.2', justifyContent: 'center', padding: '9px 12px', fontSize: '12px' }}
                    onClick={() => handleDispatchPending(t.id)}
                  >
                    <Send size={15} />
                    <span>{isAr ? 'بدء وتسيير الشاحنة' : 'Dispatch Now'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
      </div>

      {/* NEW ENTERPRISE TRANSFER ORDER MODAL */}
      <CreateTransferModal
        isOpen={isNewTransferOpen}
        onClose={() => setIsNewTransferOpen(false)}
        lang={lang}
        warehouses={currentWarehouses}
        products={products}
        onCreateTransfer={handleCreateTransfer}
      />

      {/* Official Electronic Transfer Manifest Modal */}
      <TransferManifestModal
        transfer={selectedTransferForManifest}
        isOpen={!!selectedTransferForManifest}
        onClose={() => setSelectedTransferForManifest(null)}
        lang={lang}
      />
    </div>
  );
}
