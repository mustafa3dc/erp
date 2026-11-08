import React, { useState, useEffect } from 'react';
import { ArrowUpFromLine, Send, CheckCircle2, Clock, MapPin, Truck, Box, Package } from 'lucide-react';
import { getStoredOutboundOrders, saveStoredOutboundOrders } from '../../services/storageService';

interface OutboundViewProps {
  lang: 'en' | 'ar';
  onDispatchOrder: (orderId: string) => void;
  onOpenNewDispatch?: () => void;
  onNavigateToDispatchQueue?: () => void;
}

export default function OutboundView({ lang, onDispatchOrder, onOpenNewDispatch, onNavigateToDispatchQueue }: OutboundViewProps) {
  const isAr = lang === 'ar';

  const [orders, setOrders] = useState(() => getStoredOutboundOrders());

  useEffect(() => {
    saveStoredOutboundOrders(orders);
  }, [orders]);

  const handleDispatch = (id: string) => {
    const updated = orders.map(o => {
      if (o.id === id) {
        return { ...o, status: 'Dispatched' };
      }
      return o;
    });
    setOrders(updated);
    saveStoredOutboundOrders(updated);
    onDispatchOrder(id);
  };

  const dispatchedCount = orders.filter(o => o.status === 'Dispatched').length;
  const pendingCount = orders.filter(o => o.status !== 'Dispatched').length;

  return (
    <div className="view-content-wrapper fade-in">
      <div className="view-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '1.25rem' }}>
        <div>
          <h2 className="view-title" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--foreground)' }}>
            {isAr ? 'المنصرف وإرسال البضائع' : 'Outbound Orders & Dispatching'}
          </h2>
          <p className="view-subtitle" style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted-foreground)' }}>
            {isAr ? 'تجهيز طلبيات البيع، التحميل، صرف البضائع من المستودع' : 'Pick, pack, issue delivery notes and dispatch finished shipments'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {onNavigateToDispatchQueue && (
            <button 
              type="button" 
              onClick={onNavigateToDispatchQueue}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                background: 'rgba(59, 130, 246, 0.08)',
                color: '#2563eb',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Package size={16} />
              <span>{isAr ? 'طابور تجهيز طلبات المحل' : 'Store Dispatch Queue'}</span>
            </button>
          )}

          {onOpenNewDispatch && (
            <button 
              type="button" 
              className="btn-add-primary"
              onClick={onOpenNewDispatch}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ArrowUpFromLine size={16} />
              <span>{isAr ? 'تسجيل إذن صرف وشحن جديد' : 'New Dispatch Order'}</span>
            </button>
          )}

          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <span style={{ color: '#10b981' }}>{dispatchedCount} {isAr ? 'تم شحنها' : 'Dispatched'}</span>
            <span style={{ color: 'var(--muted-foreground)' }}>•</span>
            <span style={{ color: '#f59e0b' }}>{pendingCount} {isAr ? 'قيد التجهيز' : 'Picking'}</span>
          </div>
        </div>
      </div>

      <div 
        className="transactions-table-card"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}
      >
        <table className="logistock-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{isAr ? 'رقم الإذن' : 'Order ID'}</th>
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{isAr ? 'أمر المبيعات' : 'SO Number'}</th>
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{isAr ? 'العميل المستلم' : 'Customer'}</th>
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{isAr ? 'وجهة التسليم' : 'Destination'}</th>
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{isAr ? 'البضائع والكمية' : 'Items & Quantity'}</th>
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{isAr ? 'أسطول النقل' : 'Carrier'}</th>
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{isAr ? 'الحالة' : 'Status'}</th>
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{isAr ? 'الإجراء' : 'Action'}</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '52px 20px', color: 'var(--muted-foreground)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <div 
                      style={{ 
                        width: '48px', 
                        height: '48px', 
                        borderRadius: '12px', 
                        background: 'var(--muted)', 
                        border: '1px solid var(--border)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--muted-foreground)'
                      }}
                    >
                      <Box size={24} style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                    <strong style={{ fontSize: '14px', color: 'var(--foreground)' }}>
                      {isAr ? 'لا توجد أذونات صرف معلقة حالياً' : 'No pending dispatch orders'}
                    </strong>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)', maxWidth: '380px', lineHeight: 1.5 }}>
                      {isAr 
                        ? 'كافة طلبيات ومبيعات المستودع تم صرفها وشحنها بنجاح، أو يمكنك تسجيل إذن صرف وشحن بضاعة جديد يدوياً.' 
                        : 'All warehouse outbound orders have been dispatched, or you can register a new dispatch order.'}
                    </p>
                    {onOpenNewDispatch && (
                      <button 
                        type="button" 
                        onClick={onOpenNewDispatch}
                        style={{
                          marginTop: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 16px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: 'var(--background)',
                          color: 'var(--foreground)',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <ArrowUpFromLine size={14} />
                        <span>{isAr ? 'تسجيل إذن صرف جديد' : 'New Dispatch Order'}</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--foreground)' }}>{o.id}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', background: 'var(--muted)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                      {o.soNumber}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--foreground)' }}>{o.customer}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--muted-foreground)' }}>
                      <MapPin size={12} /> {o.destination}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>{o.items}</span>
                      <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--muted-foreground)', fontWeight: 500 }}>
                        ({o.qty} {isAr ? 'قطعة' : 'units'})
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--muted-foreground)' }}>
                      <Truck size={12} /> {o.carrier}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span 
                      style={{
                        padding: '2px 9px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: o.status === 'Dispatched' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        color: o.status === 'Dispatched' ? '#10b981' : '#f59e0b',
                        border: o.status === 'Dispatched' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                      }}
                    >
                      {isAr ? (o.status === 'Dispatched' ? 'تم الشحن' : o.status === 'Ready for Dispatch' ? 'جاهز للصرف' : 'قيد التجهيز') : o.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {o.status !== 'Dispatched' ? (
                      <button 
                        type="button"
                        onClick={() => handleDispatch(o.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#2563eb',
                          color: '#ffffff',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Send size={12} />
                        <span>{isAr ? 'صرف وترحيل' : 'Dispatch'}</span>
                      </button>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
                        <CheckCircle2 size={14} />
                        <span>{isAr ? 'تم الشحن' : 'Dispatched'}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
