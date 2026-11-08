import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  Printer, 
  ArrowRight, 
  Boxes, 
  User, 
  Building2, 
  FileText, 
  RefreshCw,
  MapPin,
  Check
} from 'lucide-react';
import { 
  WarehouseDispatchOrder, 
  Product, 
  TransactionDetail, 
  SalesInvoice, 
  Warehouse 
} from '../../types/warehouse';
import { 
  getStoredDispatchOrders, 
  approveDispatchOrder 
} from '../../services/storageService';

interface WarehouseDispatchQueueViewProps {
  lang: 'ar' | 'en';
  currentUser?: any;
  warehouses?: Warehouse[];
  setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
  setTransactions?: React.Dispatch<React.SetStateAction<TransactionDetail[]>>;
  setInvoices?: React.Dispatch<React.SetStateAction<SalesInvoice[]>>;
  showToast: (msg: string) => void;
}

export default function WarehouseDispatchQueueView({
  lang,
  currentUser,
  warehouses = [],
  setProducts,
  setTransactions,
  setInvoices,
  showToast
}: WarehouseDispatchQueueViewProps) {
  const isAr = lang === 'ar';

  const [orders, setOrders] = useState<WarehouseDispatchOrder[]>(() => getStoredDispatchOrders());
  const [activeTab, setActiveTab] = useState<'PENDING' | 'FULFILLED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const refreshOrders = () => {
    setOrders(getStoredDispatchOrders());
  };

  useEffect(() => {
    refreshOrders();
    const timer = setInterval(refreshOrders, 5000);
    return () => clearInterval(timer);
  }, []);

  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'PENDING');
  }, [orders]);

  const fulfilledOrders = useMemo(() => {
    return orders.filter(o => o.status === 'FULFILLED');
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const list = activeTab === 'PENDING' ? pendingOrders : fulfilledOrders;
    return list.filter(o => {
      const matchesSearch = 
        !searchQuery || 
        o.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customerName && o.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        o.items.some(it => it.productName.toLowerCase().includes(searchQuery.toLowerCase()) || it.sku.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesWh = selectedWarehouseFilter === 'ALL' || o.warehouseId === selectedWarehouseFilter;

      return matchesSearch && matchesWh;
    });
  }, [activeTab, pendingOrders, fulfilledOrders, searchQuery, selectedWarehouseFilter]);

  const handleApprove = async (order: WarehouseDispatchOrder) => {
    setProcessingId(order.id);
    const keeperName = currentUser?.fullName || currentUser?.username || (isAr ? 'أمين المستودع' : 'Warehouse Keeper');

    try {
      // 1. Local atomic approve & stock deduction
      const result = approveDispatchOrder(order.id, keeperName);

      if (setProducts) {
        setProducts(result.updatedProducts);
      }
      if (setTransactions) {
        setTransactions(prev => [...result.createdTransactions, ...prev]);
      }
      if (setInvoices && result.invoice) {
        setInvoices(prev => prev.map(inv => inv.id === result.invoice?.id ? result.invoice : inv));
      }

      // 2. Background sync to backend API if available
      try {
        fetch(`/api/warehouse/dispatches/${order.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fulfilledBy: keeperName,
            notes: 'تم الصرف والاعتماد والتسليم للزبون'
          })
        }).catch(() => {});
      } catch {}

      refreshOrders();
      showToast(
        isAr 
          ? `تم تأكيد الصرف والتسليم لأمر التجهيز (${order.invoiceNumber}) وتثبيت خروج البضاعة مخزنياً بنجاح!` 
          : `Dispatch order (${order.invoiceNumber}) confirmed & inventory released!`
      );
    } catch (err: any) {
      showToast(err.message || (isAr ? 'حدث خطأ أثناء اعتماد الصرف' : 'Failed to confirm dispatch'));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="view-content-wrapper fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}>
              <Package size={22} />
            </div>
            <div>
              <h2 className="view-title" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--foreground)' }}>
                {isAr ? 'طابور تجهيز وصرف البضائع (أمين المخزن)' : 'Warehouse Dispatch Queue'}
              </h2>
              <p className="view-subtitle" style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--muted-foreground)' }}>
                {isAr ? 'أوامر التجهيز المحولة من نقطة البيع POS المعلقة بانتظار الصرف الفعلي والتسليم' : 'Customer orders waiting for physical picking, packing, and counter handoff'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={refreshOrders}
            className="btn-add-primary"
            style={{
              background: 'var(--card)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px'
            }}
          >
            <RefreshCw size={14} />
            <span>{isAr ? 'تحديث لحظي' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '1.25rem' }}>
        <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted-foreground)' }}>
              {isAr ? 'طلبات قيد التجهيز' : 'Pending Queue'}
            </span>
            <span style={{ padding: '4px 8px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: 800 }}>
              {pendingOrders.length}
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: '#2563eb' }}>
            {pendingOrders.length} {isAr ? 'طلب' : 'Orders'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted-foreground)' }}>
              {isAr ? 'إجمالي القطع المطلوب جلبها' : 'Items to Pick'}
            </span>
            <Boxes size={18} style={{ color: '#d97706' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: 'var(--foreground)' }}>
            {pendingOrders.reduce((sum, o) => sum + o.totalQuantity, 0)} {isAr ? 'قطعة' : 'Pcs'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted-foreground)' }}>
              {isAr ? 'تم صرفها اليوم' : 'Dispatched Today'}
            </span>
            <CheckCircle2 size={18} style={{ color: '#059669' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: '#059669' }}>
            {fulfilledOrders.length} {isAr ? 'طلب' : 'Orders'}
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', background: 'var(--muted)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'PENDING' ? 'var(--card)' : 'transparent',
              color: activeTab === 'PENDING' ? 'var(--foreground)' : 'var(--muted-foreground)',
              fontWeight: activeTab === 'PENDING' ? 800 : 500,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={14} style={{ color: '#2563eb' }} />
            <span>{isAr ? 'قيد التجهيز والصرف' : 'Pending Dispatch'}</span>
            <span style={{ background: '#2563eb', color: '#ffffff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
              {pendingOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FULFILLED')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'FULFILLED' ? 'var(--card)' : 'transparent',
              color: activeTab === 'FULFILLED' ? 'var(--foreground)' : 'var(--muted-foreground)',
              fontWeight: activeTab === 'FULFILLED' ? 800 : 500,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CheckCircle2 size={14} style={{ color: '#059669' }} />
            <span>{isAr ? 'سجل الأوامر المصروفة' : 'Completed History'}</span>
            <span style={{ background: '#059669', color: '#ffffff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
              {fulfilledOrders.length}
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: isAr ? undefined : '10px', right: isAr ? '10px' : undefined, color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder={isAr ? 'بحث برقم الفاتورة أو الصنف...' : 'Search invoice or SKU...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: isAr ? '6px 30px 6px 10px' : '6px 10px 6px 30px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                fontSize: '12px',
                outline: 'none',
                minWidth: '200px'
              }}
            />
          </div>

          {warehouses.length > 0 && (
            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none'
              }}
            >
              <option value="ALL">{isAr ? 'جميع المستودعات' : 'All Warehouses'}</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{isAr ? w.nameAr : (w.nameEn || w.nameAr)}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Orders List / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Package size={48} style={{ opacity: 0.25, margin: '0 auto 12px auto', color: 'var(--muted-foreground)' }} />
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--foreground)' }}>
            {activeTab === 'PENDING'
              ? (isAr ? 'لا توجد طلبات تجهيز معلقة حالياً' : 'No pending dispatch orders')
              : (isAr ? 'لا توجد طلبات مصروفة في السجل' : 'No completed dispatch history')}
          </h4>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--muted-foreground)' }}>
            {activeTab === 'PENDING'
              ? (isAr ? 'ستظهر هنا طلبات البيع من نقطة البيع POS التي اختار فيها الكاشير "طلب من المخزن"' : 'Orders chosen by cashier as "Warehouse Dispatch" will appear here')
              : (isAr ? 'الطلبات المعتمدة ستظهر هنا مع تاريخ ووقت الصرف' : 'Released orders will be archived here with timestamp')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredOrders.map(order => {
            const isPending = order.status === 'PENDING';
            const isProcessing = processingId === order.id;

            return (
              <div 
                key={order.id}
                className="glass-panel fade-in"
                style={{
                  borderRadius: 'var(--radius)',
                  background: 'var(--card)',
                  border: isPending ? '1.5px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--border)',
                  boxShadow: isPending ? '0 4px 14px rgba(37, 99, 235, 0.08)' : 'var(--shadow-sm)',
                  overflow: 'hidden'
                }}
              >
                {/* Order Top Bar */}
                <div style={{
                  padding: '12px 16px',
                  background: isPending ? 'rgba(59, 130, 246, 0.05)' : 'var(--muted)/40',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: isPending ? '#2563eb' : '#059669',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      letterSpacing: '0.5px'
                    }}>
                      #{order.invoiceNumber}
                    </div>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--foreground)'
                    }}>
                      <Building2 size={14} style={{ color: 'var(--primary)' }} />
                      <span>{order.warehouseName}</span>
                    </div>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: 'var(--muted-foreground)'
                    }}>
                      <User size={13} />
                      <span>{order.customerName}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} />
                      <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: isPending ? '#fef3c7' : '#ecfdf5',
                      color: isPending ? '#b45309' : '#047857'
                    }}>
                      {isPending ? (isAr ? 'بانتظار التجهيز والتسليم' : 'Pending Picking') : (isAr ? 'تم الصرف والتسليم' : 'Dispatched')}
                    </span>
                  </div>
                </div>

                {/* Items Breakdown Table */}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ marginBottom: '10px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)' }}>
                    {isAr ? 'المواد المطلوب جلبها وصرفها من المستودع:' : 'Items to pick from warehouse racks:'}
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--muted)/50', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '8px 10px', textAlign: isAr ? 'right' : 'left', color: 'var(--muted-foreground)' }}>SKU</th>
                          <th style={{ padding: '8px 10px', textAlign: isAr ? 'right' : 'left', color: 'var(--muted-foreground)' }}>{isAr ? 'اسم الصنف' : 'Product Name'}</th>
                          <th style={{ padding: '8px 10px', textAlign: isAr ? 'right' : 'left', color: 'var(--muted-foreground)' }}>{isAr ? 'موقع الرف / القاطع' : 'Shelf / Rack'}</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--muted-foreground)' }}>{isAr ? 'الكمية المطلوبة' : 'Quantity'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                              {item.sku}
                            </td>
                            <td style={{ padding: '10px', fontWeight: 700, color: 'var(--foreground)' }}>
                              {item.productName}
                            </td>
                            <td style={{ padding: '10px', color: 'var(--muted-foreground)' }}>
                              <span style={{ 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                background: 'var(--muted)', 
                                border: '1px solid var(--border)',
                                fontSize: '11px',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <MapPin size={11} style={{ color: '#f59e0b' }} />
                                {item.shelfLocation || 'A-01'}
                              </span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ 
                                padding: '3px 10px', 
                                borderRadius: '6px', 
                                background: '#eff6ff', 
                                color: '#1d4ed8', 
                                fontWeight: 800,
                                fontSize: '13px'
                              }}>
                                {item.quantity} {isAr ? 'قطعة' : 'Pcs'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions Bar */}
                  <div style={{
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: '1px dashed var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={13} />
                      <span>{isAr ? `الكاشير المصدر: ${order.cashierName}` : `Billed by Cashier: ${order.cashierName}`}</span>
                      {order.fulfilledBy && (
                        <span>• {isAr ? `تم الصرف بواسطة: ${order.fulfilledBy}` : `Released by: ${order.fulfilledBy}`}</span>
                      )}
                    </div>

                    {isPending ? (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleApprove(order)}
                        style={{
                          padding: '9px 18px',
                          borderRadius: 'var(--radius)',
                          border: 'none',
                          background: isProcessing ? 'var(--muted)' : '#059669',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '13px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: isProcessing ? 'not-allowed' : 'pointer',
                          boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Check size={16} />
                        <span>
                          {isProcessing 
                            ? (isAr ? 'جارِ اعتماد الصرف...' : 'Releasing...') 
                            : (isAr ? 'تأكيد الصرف والتسليم (Confirm & Release)' : 'Confirm & Release')}
                        </span>
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontSize: '12px', fontWeight: 700 }}>
                        <CheckCircle2 size={16} />
                        <span>{isAr ? 'تم صرف البضاعة وتثبيت خروجها محاسبياً ومخزنياً' : 'Goods Released & Stock Deducted'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

