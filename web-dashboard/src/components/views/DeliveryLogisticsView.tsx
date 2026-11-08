import React, { useState } from 'react';
import { getStoredDeliveries, saveStoredDeliveries } from '../../services/storageService';
import { useSettings } from '../../context/settings-context';
import { 
  Truck, 
  MapPin, 
  Phone, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Search, 
  User, 
  Navigation,
  Check,
  Plus,
  PackageCheck,
  Wallet
} from 'lucide-react';

interface DeliveryOrder {
  id: string;
  deliveryCode: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  driverName: string;
  driverPhone: string;
  codAmount: number;
  status: 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'ASSIGNED' | 'FAILED';
  dispatchedAt: string;
}

interface DeliveryLogisticsViewProps {
  lang: 'en' | 'ar';
}



export default function DeliveryLogisticsView({ lang }: DeliveryLogisticsViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>(() => {
    return getStoredDeliveries();
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleMarkDelivered = (id: string) => {
    const updated = deliveries.map(d => d.id === id ? { ...d, status: 'DELIVERED' as const } : d);
    setDeliveries(updated);
    saveStoredDeliveries(updated);
    showToast(isAr ? 'تم تأكيد التوصيل وتحصيل مبلغ الدفع عند الاستلام (COD) بنجاح!' : 'Delivery confirmed & COD payment collected!');
  };

  const filtered = deliveries.filter(d => {
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    const matchesSearch = d.deliveryCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.driverName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const outCount = deliveries.filter(d => d.status === 'OUT_FOR_DELIVERY').length;
  const deliveredCount = deliveries.filter(d => d.status === 'DELIVERED').length;
  const assignedCount = deliveries.filter(d => d.status === 'ASSIGNED').length;
  const totalCod = deliveries.filter(d => d.status === 'OUT_FOR_DELIVERY' || d.status === 'ASSIGNED').reduce((acc, d) => acc + d.codAmount, 0);

  return (
    <div className="view-content-wrapper fade-in">
      {toastMsg && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9999 }}>
          <CheckCircle2 size={16} className="green-text" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Module Context Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <Truck size={15} style={{ color: 'var(--primary)' }} />
            <span>{isAr ? 'سلاسل الإمداد / الشحن وإدارة المندوبين والتوصيل (COD)' : 'Logistics / Courier Dispatch & Cash on Delivery (COD)'}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          <button 
            type="button" 
            className="btn-clean-primary"
            onClick={() => showToast(isAr ? 'إنشاء أمر تسليم وشحن جديد' : 'New dispatch manifest')}
          >
            <Plus size={15} />
            <span>{isAr ? 'أمر شحن وتوصيل جديد' : 'New Delivery Dispatch'}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'طرود قيد التوصيل الآن' : 'Out for Delivery'}</span>
            <div className="module-kpi-value">
              {outCount} <span className="kpi-sub-unit">{isAr ? 'شحنات' : 'orders'}</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Truck size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'تم تسليمها اليوم' : 'Delivered Today'}</span>
            <div className="module-kpi-value">
              {deliveredCount} <span className="kpi-sub-unit">{isAr ? 'مكتملة' : 'completed'}</span>
            </div>
          </div>
          <div className="module-kpi-icon emerald">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'بانتظار خروج المندوب' : 'Pending Dispatch'}</span>
            <div className="module-kpi-value">
              {assignedCount} <span className="kpi-sub-unit">{isAr ? 'شحنات' : 'queued'}</span>
            </div>
          </div>
          <div className="module-kpi-icon cyan">
            <Clock size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'مبالغ COD قيد التحصيل' : 'COD To Collect'}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#fbbf24' }}>
              {formatMoney(totalCod)}
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="module-toolbar">
        <div className="module-search-box">
          <Search size={16} />
          <input 
            type="text" 
            placeholder={isAr ? 'بحث برقم الشحنة، الفاتورة، العميل، أو المندوب...' : 'Search dispatch #, invoice, customer, driver...'} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="module-filter-pills">
          {[
            { id: 'ALL', label: isAr ? 'جميع الشحنات' : 'All Orders' },
            { id: 'OUT_FOR_DELIVERY', label: isAr ? 'قيد التوصيل' : 'Out for Delivery' },
            { id: 'DELIVERED', label: isAr ? 'تم التسليم' : 'Delivered' },
            { id: 'ASSIGNED', label: isAr ? 'مجهزة للتسليم' : 'Assigned' }
          ].map(f => (
            <button
              key={f.id}
              className={`filter-pill ${statusFilter === f.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deliveries Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', background: 'var(--card)', borderRadius: '16px', border: '1px dashed var(--border)', color: 'var(--muted-foreground)' }}>
            <Truck size={36} style={{ color: 'var(--muted-foreground)', margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px', color: 'var(--foreground)', fontSize: '15px' }}>{isAr ? 'لا توجد شحنات توصيل مسجلة حالياً' : 'No deliveries recorded'}</h4>
            <p style={{ margin: 0, fontSize: '13px' }}>{isAr ? 'النظام صافٍ وجاهز لجدولة أوامر التوصيل والشحن المباشر' : 'Clean slate. Ready to dispatch and schedule direct deliveries.'}</p>
          </div>
        ) : (
          filtered.map(d => (
          <div key={d.id} className="module-kpi-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '18px', gap: '12px', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--primary)', fontFamily: 'monospace', fontWeight: 700 }}>{d.deliveryCode}</span>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{d.invoiceNumber}</span>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                background: d.status === 'OUT_FOR_DELIVERY' ? '#fffbeb' : d.status === 'DELIVERED' ? '#ecfdf5' : 'var(--primary-light)',
                color: d.status === 'OUT_FOR_DELIVERY' ? '#b45309' : d.status === 'DELIVERED' ? '#047857' : 'var(--primary)',
                border: `1px solid ${d.status === 'OUT_FOR_DELIVERY' ? '#fde68a' : d.status === 'DELIVERED' ? '#a7f3d0' : 'var(--primary-border)'}`
              }}>
                {d.status === 'OUT_FOR_DELIVERY' ? (isAr ? 'قيد التوصيل' : 'Out for Delivery') :
                 d.status === 'DELIVERED' ? (isAr ? 'تم التسليم بنجاح' : 'Delivered') :
                 (isAr ? 'مجهزة للتسليم' : 'Assigned')}
              </span>
            </div>

            {/* Customer Info */}
            <div>
              <strong style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700, display: 'block' }}>{d.customerName}</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                <Phone size={12} />
                <span>{d.customerPhone}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                <MapPin size={12} style={{ color: '#ea580c' }} />
                <span>{d.address}</span>
              </div>
            </div>

            {/* Driver & COD Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{isAr ? 'المندوب المسؤول:' : 'Courier:'}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{d.driverName}</span>
              </div>

              <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{isAr ? 'مبلغ التحصيل (COD):' : 'COD Amount:'}</span>
                <strong style={{ fontSize: '14px', color: '#047857', fontWeight: 800 }}>${d.codAmount.toFixed(2)}</strong>
              </div>
            </div>

            {/* Delivery Action Button */}
            {d.status === 'OUT_FOR_DELIVERY' && (
              <button 
                type="button" 
                className="btn-clean-success" 
                style={{ width: '100%', justifyContent: 'center', padding: '9px 14px', fontSize: '12px', marginTop: '4px' }}
                onClick={() => handleMarkDelivered(d.id)}
              >
                <CheckCircle2 size={15} />
                <span>{isAr ? 'تأكيد التسليم واستلام النقدية (COD)' : 'Confirm Delivery & Collect Cash'}</span>
              </button>
            )}
          </div>
        ))
      )}
      </div>
    </div>
  );
}
