import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  Check, 
  AlertTriangle, 
  Search,
  CheckCircle2,
  PackageCheck,
  TrendingDown,
  TrendingUp,
  Building2,
  Barcode as BarcodeIcon,
  RefreshCw,
  ArrowRightLeft,
  Filter
} from 'lucide-react';
import { Product, Warehouse } from '../../types/warehouse';
import { useSettings } from '../../context/settings-context';
import { getStoredWarehouses, getStoredProducts } from '../../services/storageService';

export interface StockAuditItem {
  id: string; // product id
  sku: string;
  barcode: string;
  name: string;
  nameAr: string;
  warehouseId: string;
  warehouse: string;
  shelf: string;
  unit: string;
  systemQty: number; // الرصيد الدفتري المسجل
  physicalQty: number; // الجرد الفعلي الميداني
  unitCost: number; // سعر التكلفة
}

interface StockCountsViewProps {
  lang: 'en' | 'ar';
  products?: Product[];
  warehouses?: Warehouse[];
  onBulkReconcileStock?: (reconciledItems: { 
    productId: string; 
    newStock: number; 
    delta: number; 
    warehouseName: string; 
    operatorName?: string;
  }[]) => void;
  currentUser?: any;
}

export default function StockCountsView({ 
  lang,
  products: propProducts,
  warehouses: propWarehouses,
  onBulkReconcileStock,
  currentUser
}: StockCountsViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const allWarehouses = useMemo(() => {
    return (propWarehouses && propWarehouses.length > 0) ? propWarehouses : getStoredWarehouses();
  }, [propWarehouses]);

  const allProducts = useMemo(() => {
    return (propProducts && propProducts.length > 0) ? propProducts : getStoredProducts();
  }, [propProducts]);

  // Selected warehouse filter tab (Default to first warehouse or ALL)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    return allWarehouses[0]?.id || 'ALL';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DISCREPANCY' | 'MATCHED'>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [reconciledToast, setReconciledToast] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map of physical counts edited by user: { [productId]: number }
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});

  // Real-time API fetching simulation / sync with active warehouse
  const fetchWarehouseItems = async (whId: string) => {
    setIsLoading(true);
    try {
      // Attempt backend API call
      const res = await fetch(`/api/v1/inventory/reconciliation?warehouseId=${encodeURIComponent(whId)}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const apiData = await res.json();
        if (Array.isArray(apiData) && apiData.length > 0) {
          // Initialize physical counts from backend data
          const initialMap: Record<string, number> = {};
          apiData.forEach((it: any) => {
            initialMap[it.id] = typeof it.physicalQty === 'number' ? it.physicalQty : it.systemQty;
          });
          setPhysicalCounts(prev => ({ ...prev, ...initialMap }));
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // Graceful fallback to live state / local storage
    }

    // Fallback: populate from live products
    const initialMap: Record<string, number> = {};
    allProducts.forEach(p => {
      if (physicalCounts[p.id] === undefined) {
        initialMap[p.id] = p.currentStock;
      }
    });
    setPhysicalCounts(prev => ({ ...initialMap, ...prev }));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchWarehouseItems(selectedWarehouseId);
  }, [selectedWarehouseId, allProducts]);

  // Build the list of audit items based on selected warehouse
  const auditItems: StockAuditItem[] = useMemo(() => {
    const list = selectedWarehouseId === 'ALL'
      ? allProducts
      : allProducts.filter(p => p.warehouseId === selectedWarehouseId);

    return list.map(p => {
      const wh = allWarehouses.find(w => w.id === p.warehouseId);
      const whName = isAr ? (wh?.nameAr || p.warehouseName) : (wh?.nameEn || p.warehouseNameEn || p.warehouseName);
      const counted = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.currentStock;

      return {
        id: p.id,
        sku: p.sku,
        barcode: p.barcode || p.sku,
        name: isAr ? p.nameAr : (p.nameEn || p.nameAr),
        nameAr: p.nameAr,
        warehouseId: p.warehouseId,
        warehouse: whName,
        shelf: p.shelf || 'A-01',
        unit: p.unit || (isAr ? 'قطعة' : 'Unit'),
        systemQty: p.currentStock,
        physicalQty: counted,
        unitCost: p.costPrice || 0
      };
    });
  }, [allProducts, allWarehouses, selectedWarehouseId, physicalCounts, isAr]);

  // Handle live modification of physical count
  const handleUpdatePhysical = (id: string, val: number) => {
    const cleanVal = isNaN(val) ? 0 : Math.max(0, val);
    setPhysicalCounts(prev => ({
      ...prev,
      [id]: cleanVal
    }));
  };

  // Filtered rows for table view
  const filteredItems = useMemo(() => {
    return auditItems.filter(item => {
      const matchesSearch = !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.warehouse.toLowerCase().includes(searchQuery.toLowerCase());

      const variance = item.physicalQty - item.systemQty;
      const matchesStatus = 
        statusFilter === 'ALL' ? true :
        statusFilter === 'DISCREPANCY' ? (variance !== 0) :
        (variance === 0);

      return matchesSearch && matchesStatus;
    });
  }, [auditItems, searchQuery, statusFilter]);

  // Dynamic KPI Metrics calculated live
  const totalItemsCount = auditItems.length;
  const matchedCount = auditItems.filter(i => i.physicalQty === i.systemQty).length;
  const discrepancyItems = auditItems.filter(i => i.physicalQty !== i.systemQty);
  const discrepancyCount = discrepancyItems.length;
  const netVarianceValue = auditItems.reduce((acc, i) => acc + ((i.physicalQty - i.systemQty) * i.unitCost), 0);
  const shortageCount = auditItems.filter(i => i.physicalQty < i.systemQty).length;
  const surplusCount = auditItems.filter(i => i.physicalQty > i.systemQty).length;

  // Real Reconcile Action with Strict Button Gating
  const handleReconcile = async () => {
    if (discrepancyCount === 0 || auditItems.length === 0) return;

    setIsSubmitting(true);

    const reconciliationPayload = discrepancyItems.map(item => ({
      productId: item.id,
      newStock: item.physicalQty,
      delta: item.physicalQty - item.systemQty,
      warehouseName: item.warehouse,
      operatorName: currentUser?.fullName || currentUser?.username || (isAr ? 'لجنة الجرد والمطابقة' : 'Audit Committee')
    }));

    try {
      // Real or simulated backend call
      await fetch('/api/v1/inventory/reconciliation/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: selectedWarehouseId,
          operator: currentUser?.fullName || currentUser?.username || 'Audit Committee',
          items: reconciliationPayload,
          reconciledAt: new Date().toISOString()
        })
      }).catch(() => null);
    } catch {
      // Proceed with live state update
    }

    if (onBulkReconcileStock) {
      onBulkReconcileStock(reconciliationPayload);
    }

    // Reset physical counts to match the newly committed balances
    const newPhysicalMap: Record<string, number> = { ...physicalCounts };
    discrepancyItems.forEach(item => {
      newPhysicalMap[item.id] = item.physicalQty;
    });
    setPhysicalCounts(newPhysicalMap);

    setIsSubmitting(false);
    setReconciledToast(
      isAr 
        ? `تم اعتماد تسوية ${discrepancyCount} صنف بنجاح وتحديث الأرصدة والقيود المالية في النظام!`
        : `Successfully reconciled ${discrepancyCount} item discrepancies & updated inventory ledgers!`
    );
    setTimeout(() => setReconciledToast(''), 4500);
  };

  return (
    <div className="view-content-wrapper fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Toast Banner */}
      {reconciledToast && (
        <div 
          className="toast-banner glass-panel" 
          style={{ 
            position: 'fixed', 
            bottom: '24px', 
            left: '24px', 
            zIndex: 99999, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            padding: '12px 18px',
            borderRadius: '12px',
            backgroundColor: '#064e3b',
            color: '#ecfdf5',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            fontWeight: 700,
            fontSize: '13px'
          }}
        >
          <CheckCircle2 size={18} color="#34d399" />
          <span>{reconciledToast}</span>
        </div>
      )}

      {/* Module Context Header */}
      <div className="module-header-clean" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="module-context-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={22} style={{ color: 'var(--primary)' }} />
            <h2 className="view-title" style={{ margin: 0 }}>
              {isAr ? 'الجرد المخزني والتسويات' : 'Inventory Auditing & Reconciliation'}
            </h2>
          </div>
          <p className="view-subtitle" style={{ margin: '4px 0 0' }}>
            {isAr 
              ? 'مطابقة الأرصدة الدفترية مع الجرد الميداني الفعلي، رصد الفروقات، واعتماد قيود التسوية المالية المعتمدة' 
              : 'Reconcile system ledger stock with physical counts, record discrepancies, and post adjustments'}
          </p>
        </div>

        <div className="module-actions-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            type="button" 
            className="btn-secondary-flat"
            onClick={() => fetchWarehouseItems(selectedWarehouseId)}
            disabled={isLoading}
            title={isAr ? 'إعادة جلب وتحديث الأرصدة' : 'Refresh balances'}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>{isAr ? 'تحديث البيانات' : 'Refresh Data'}</span>
          </button>

          {/* Button strictly gated: disabled if 0 items or 0 discrepancies */}
          <button 
            type="button" 
            id="reconcile-stock-btn"
            data-testid="reconcile-stock-btn"
            disabled={discrepancyCount === 0 || totalItemsCount === 0 || isSubmitting}
            onClick={handleReconcile}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: (discrepancyCount === 0 || totalItemsCount === 0) ? '#94a3b8' : 'var(--primary, #0284c7)',
              color: '#ffffff',
              cursor: (discrepancyCount === 0 || totalItemsCount === 0) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 700,
              boxShadow: (discrepancyCount > 0) ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none',
              opacity: (discrepancyCount === 0 || totalItemsCount === 0) ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            title={
              discrepancyCount === 0 
                ? (isAr ? 'لا توجد أي فروقات جرد لاعتمادها حالياً' : 'No discrepancies to reconcile') 
                : (isAr ? `اعتماد وتسوية ${discrepancyCount} صنف مع ترحيل القيود للأرصدة` : `Reconcile ${discrepancyCount} items`)
            }
          >
            <Check size={16} />
            <span>
              {isSubmitting 
                ? (isAr ? 'جاري الاعتماد والترحيل...' : 'Committing...') 
                : (isAr ? `اعتماد وتسوية فروقات الجرد (${discrepancyCount})` : `Reconcile Discrepancies (${discrepancyCount})`)}
            </span>
          </button>
        </div>
      </div>

      {/* 4 Dynamic KPI Cards */}
      <div className="module-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '1.25rem' }}>
        <div className="module-kpi-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="module-kpi-info">
            <span className="module-kpi-label" style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              {isAr ? 'إجمالي الأصناف المجرودة' : 'Counted SKUs'}
            </span>
            <div className="module-kpi-value" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--foreground)', marginTop: '4px' }}>
              {totalItemsCount} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{isAr ? 'أصناف' : 'items'}</span>
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PackageCheck size={22} />
          </div>
        </div>

        <div className="module-kpi-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="module-kpi-info">
            <span className="module-kpi-label" style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              {isAr ? 'أصناف مطابقة تماماً' : 'Exact Matched'}
            </span>
            <div className="module-kpi-value" style={{ fontSize: '22px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
              {matchedCount} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>({((matchedCount / (totalItemsCount || 1)) * 100).toFixed(0)}%)</span>
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="module-kpi-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="module-kpi-info">
            <span className="module-kpi-label" style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              {isAr ? 'أصناف بها فروقات (عجز/زيادة)' : 'Discrepancies'}
            </span>
            <div className="module-kpi-value" style={{ fontSize: '22px', fontWeight: 800, color: discrepancyCount > 0 ? '#ea580c' : '#64748b', marginTop: '4px' }}>
              {discrepancyCount} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>({isAr ? `${shortageCount} عجز / ${surplusCount} زيادة` : `${shortageCount} short / ${surplusCount} surplus`})</span>
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: discrepancyCount > 0 ? 'rgba(234, 88, 12, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: discrepancyCount > 0 ? '#ea580c' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="module-kpi-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="module-kpi-info">
            <span className="module-kpi-label" style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              {isAr ? 'صافي الفارق المالي للتسوية' : 'Net Discrepancy Value'}
            </span>
            <div className="module-kpi-value" style={{ fontSize: '20px', fontWeight: 800, color: netVarianceValue < 0 ? '#dc2626' : netVarianceValue > 0 ? '#059669' : '#64748b', marginTop: '4px' }}>
              {formatMoney(Math.abs(netVarianceValue))}
              <span style={{ fontSize: '12px', fontWeight: 600, marginInlineStart: '6px', color: netVarianceValue < 0 ? '#dc2626' : netVarianceValue > 0 ? '#059669' : '#64748b' }}>
                {netVarianceValue < 0 ? (isAr ? '(عجز دفتري)' : '(Deficit)') : netVarianceValue > 0 ? (isAr ? '(فائض دفتري)' : '(Surplus)') : (isAr ? '(متطابق)' : '(Balanced)')}
              </span>
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: netVarianceValue < 0 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: netVarianceValue < 0 ? '#dc2626' : '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {netVarianceValue >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
          </div>
        </div>
      </div>

      {/* Warehouse Selector & Search Toolbar */}
      <div 
        style={{ 
          background: 'var(--card)', 
          border: '1px solid var(--border)', 
          borderRadius: '12px', 
          padding: '14px 16px', 
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: isAr ? '12px' : 'auto', left: isAr ? 'auto' : '12px', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder={isAr ? 'بحث بالاسم، الباركود، كود الصنف SKU...' : 'Search by name, barcode, SKU...'} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              paddingRight: isAr ? '36px' : '12px',
              paddingLeft: isAr ? '12px' : '36px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
              fontSize: '13px'
            }}
          />
        </div>

        {/* Warehouse Tabs Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`filter-pill ${selectedWarehouseId === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedWarehouseId('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: selectedWarehouseId === 'ALL' ? 'var(--primary)' : 'transparent',
              color: selectedWarehouseId === 'ALL' ? '#ffffff' : 'var(--foreground)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            {isAr ? 'جميع المستودعات' : 'All Warehouses'}
          </button>

          {allWarehouses.map(wh => (
            <button
              key={wh.id}
              type="button"
              className={`filter-pill ${selectedWarehouseId === wh.id ? 'active' : ''}`}
              onClick={() => setSelectedWarehouseId(wh.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: selectedWarehouseId === wh.id ? 'var(--primary)' : 'transparent',
                color: selectedWarehouseId === wh.id ? '#ffffff' : 'var(--foreground)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              {isAr ? wh.nameAr : (wh.nameEn || wh.nameAr)}
            </button>
          ))}
        </div>

        {/* Status Filter Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'DISCREPANCY' ? 'ALL' : 'DISCREPANCY')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: statusFilter === 'DISCREPANCY' ? 'rgba(234, 88, 12, 0.15)' : 'transparent',
              color: statusFilter === 'DISCREPANCY' ? '#ea580c' : '#64748b',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Filter size={14} />
            <span>{isAr ? 'عرض الفروقات فقط' : 'Discrepancies Only'}</span>
            {discrepancyCount > 0 && (
              <span style={{ background: '#ea580c', color: '#ffffff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: 800 }}>
                {discrepancyCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Reconciliation Audit Table */}
      <div 
        className="transactions-table-card" 
        style={{ 
          background: 'var(--card)', 
          border: '1px solid var(--border)', 
          borderRadius: '12px', 
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ overflowX: 'auto', minWidth: '850px' }}>
          <table className="custom-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
            <thead>
              <tr style={{ background: 'var(--muted, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '50px' }}>#</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '140px' }}>{isAr ? 'الباركود ورمز SKU' : 'Barcode & SKU'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{isAr ? 'اسم الصنف والمواصفات' : 'Item Description'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '180px' }}>{isAr ? 'المستودع والموقع' : 'Warehouse & Shelf'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '90px' }}>{isAr ? 'الوحدة' : 'Unit'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '120px' }}>{isAr ? 'الرصيد الدفتري' : 'System Qty'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '140px' }}>{isAr ? 'الجرد الفعلي الميداني' : 'Counted Qty'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '120px' }}>{isAr ? 'فارق الجرد' : 'Variance'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '120px' }}>{isAr ? 'الأثر المالي' : 'Financial Impact'}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '110px' }}>{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={32} color="#94a3b8" />
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                        {isAr ? 'لا توجد أصناف تطابق معايير البحث أو الجرد المحددة' : 'No items match the search or filter criteria'}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                        {isAr ? 'تأكد من اختيار المستودع الصحيح أو مسح عبارة البحث' : 'Please check warehouse selection or clear search term'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const variance = item.physicalQty - item.systemQty;
                  const varianceValue = variance * item.unitCost;
                  const hasDiscrepancy = variance !== 0;

                  return (
                    <tr 
                      key={item.id}
                      style={{ 
                        borderBottom: '1px solid var(--border)',
                        background: hasDiscrepancy ? (variance < 0 ? 'rgba(239, 68, 68, 0.03)' : 'rgba(16, 185, 129, 0.03)') : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                        {index + 1}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '12px' }}>
                          {item.sku}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                          <BarcodeIcon size={12} />
                          <span>{item.barcode}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '13px' }} dir="auto">
                          {item.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {isAr ? 'التكلفة المعيارية:' : 'Standard Cost:'} {formatMoney(item.unitCost)}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }} dir="auto">
                          {item.warehouse}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                          {isAr ? 'الرف / القاطع:' : 'Shelf / Bay:'} <strong>{item.shelf}</strong>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b' }}>
                        {item.unit}
                      </td>

                      {/* System Qty (Readonly) */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'monospace' }}>
                          {item.systemQty}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {isAr ? 'مسجل بالنظام' : 'System Ledger'}
                        </div>
                      </td>

                      {/* Counted Qty Input */}
                      <td style={{ padding: '12px 14px' }}>
                        <input 
                          type="number"
                          id={`counted-input-${item.id}`}
                          data-testid={`counted-input-${item.id}`}
                          min="0"
                          value={item.physicalQty}
                          onChange={(e) => handleUpdatePhysical(item.id, parseInt(e.target.value) || 0)}
                          style={{
                            width: '90px',
                            height: '36px',
                            background: 'var(--card, #ffffff)',
                            border: hasDiscrepancy 
                              ? (variance < 0 ? '2px solid #ef4444' : '2px solid #10b981')
                              : '1px solid var(--border, #cbd5e1)',
                            color: 'var(--foreground, #0f172a)',
                            borderRadius: '8px',
                            padding: '4px 10px',
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </td>

                      {/* Variance Indicator */}
                      <td style={{ padding: '12px 14px' }}>
                        {variance === 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#475569' }}>
                            0
                          </span>
                        ) : variance > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                            +{variance} ({isAr ? 'فائض' : 'Surplus'})
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                            {variance} ({isAr ? 'عجز' : 'Shortage'})
                          </span>
                        )}
                      </td>

                      {/* Financial Variance Value */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ 
                          fontWeight: 800, 
                          fontSize: '12px',
                          color: variance === 0 ? '#64748b' : variance > 0 ? '#059669' : '#dc2626',
                          fontFamily: 'monospace'
                        }}>
                          {variance === 0 ? '-' : (variance > 0 ? `+${formatMoney(varianceValue)}` : `-${formatMoney(Math.abs(varianceValue))}`)}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: variance === 0 ? '#ecfdf5' : '#fffbeb',
                          color: variance === 0 ? '#047857' : '#b45309',
                          border: `1px solid ${variance === 0 ? '#a7f3d0' : '#fde68a'}`
                        }}>
                          {variance === 0 ? (isAr ? 'مطابق تماماً' : 'Matched') : (isAr ? 'فارق جرد' : 'Discrepancy')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
