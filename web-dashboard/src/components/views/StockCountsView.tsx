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
  Barcode as BarcodeIcon,
  RefreshCw,
  Filter
} from 'lucide-react';
import { Product, Warehouse } from '../../types/warehouse';
import { useSettings } from '../../context/settings-context';
import { getStoredWarehouses, getStoredProducts } from '../../services/storageService';
import { getTranslation } from '../../lib/i18n';

export interface StockAuditItem {
  rowKey: string;
  stocktakeItemId?: string;
  productId: string;
  sku: string;
  barcode: string;
  name: string;
  nameAr: string;
  warehouseId: string;
  warehouse: string;
  shelf: string;
  unit: string;
  systemQty: number;
  physicalQty: number;
  physicalCountInput: string;
  unitCost: number;
}

interface StockCountsViewProps {
  lang: 'en' | 'ar';
  products?: Product[];
  warehouses?: Warehouse[];
  onBulkReconcileStock?: (reconciledItems: {
    productId: string;
    warehouseId?: string;
    newStock: number;
    delta: number;
    warehouseName: string;
    operatorName?: string;
  }[]) => void;
  currentUser?: any;
}

const buildUniqueRowKey = (
  baseKey: string,
  seenCounts: Map<string, number>
): string => {
  const count = seenCounts.get(baseKey) || 0;
  seenCounts.set(baseKey, count + 1);
  return count === 0 ? baseKey : `${baseKey}__${count}`;
};

export default function StockCountsView({
  lang,
  products: propProducts,
  warehouses: propWarehouses,
  onBulkReconcileStock,
  currentUser
}: StockCountsViewProps) {
  const isAr = lang === 'ar';
  const tr = (k: string) => getTranslation(lang, `ui.stockCounts.${k}`);
  const { formatMoney } = useSettings();

  const allWarehouses = useMemo(() => {
    return (propWarehouses && propWarehouses.length > 0) ? propWarehouses : getStoredWarehouses();
  }, [propWarehouses]);

  const allProducts = useMemo(() => {
    const raw = (propProducts && propProducts.length > 0) ? propProducts : getStoredProducts();
    return raw.filter(p => !p.isBundle);
  }, [propProducts]);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    return allWarehouses[0]?.id || 'ALL';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DISCREPANCY' | 'MATCHED'>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [reconciledToast, setReconciledToast] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Optional API-sourced stocktake rows when backend reconciliation endpoint returns records
  const [apiRows, setApiRows] = useState<any[] | null>(null);

  // Independent per-row physical count map keyed STRICTLY by guaranteed unique rowKey
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});

  const fetchWarehouseItems = async (whId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/reconciliation?warehouseId=${encodeURIComponent(whId)}`, {
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const apiData = await res.json();
        if (Array.isArray(apiData) && apiData.length > 0) {
          const seenKeys = new Map<string, number>();
          const initialMap: Record<string, string> = {};
          const normalizedRows = apiData.map((it: any, idx: number) => {
            const stocktakeItemId = it.stocktakeItemId ?? it.stockCountItemId ?? (it.id ? String(it.id) : undefined);
            const productId = String(it.productId ?? it.id ?? it.sku ?? `row-${idx}`);
            const warehouseId = String(it.warehouseId ?? whId ?? 'wh');
            const baseKey = stocktakeItemId ? String(stocktakeItemId) : `${productId}-${warehouseId}`;
            const rowKey = buildUniqueRowKey(baseKey, seenKeys);
            const sysQty = Number(it.systemQty ?? it.bookQuantity ?? 0);
            const actQty = it.actualQuantity ?? it.physicalQty;
            const initialVal = typeof actQty === 'number' && Number.isFinite(actQty) ? actQty : sysQty;
            initialMap[rowKey] = String(initialVal);
            return { ...it, __rowKey: rowKey, __stocktakeItemId: stocktakeItemId, __productId: productId, __warehouseId: warehouseId };
          });
          setApiRows(normalizedRows);
          setPhysicalCounts(initialMap);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // Graceful fallback to live state / local storage
    }

    setApiRows(null);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchWarehouseItems(selectedWarehouseId);
  }, [selectedWarehouseId]);

  // Build isolated audit items with guaranteed unique rowKey per row
  const auditItems: StockAuditItem[] = useMemo(() => {
    const seenKeys = new Map<string, number>();

    if (apiRows && apiRows.length > 0) {
      return apiRows.map((it: any, idx: number) => {
        const rowKey = it.__rowKey || buildUniqueRowKey(`${it.__productId || idx}-${it.__warehouseId || selectedWarehouseId}`, seenKeys);
        const sysQty = Number(it.systemQty ?? it.bookQuantity ?? 0);
        const rawInput = physicalCounts[rowKey] !== undefined ? physicalCounts[rowKey] : String(sysQty);
        const parsedQty = rawInput.trim() === '' ? 0 : Math.max(0, Number(rawInput));
        const physicalQty = Number.isFinite(parsedQty) ? parsedQty : sysQty;
        const wh = allWarehouses.find(w => w.id === it.__warehouseId);
        const whName = wh ? (isAr ? wh.nameAr : (wh.nameEn || wh.nameAr)) : (it.warehouse || '');

        return {
          rowKey,
          stocktakeItemId: it.__stocktakeItemId,
          productId: it.__productId,
          sku: String(it.sku || ''),
          barcode: String(it.barcode || it.sku || ''),
          name: String(isAr ? (it.nameAr || it.name || '') : (it.nameEn || it.name || it.nameAr || '')),
          nameAr: String(it.nameAr || it.name || ''),
          warehouseId: it.__warehouseId,
          warehouse: whName,
          shelf: String(it.shelf || 'A-01'),
          unit: String(it.unit || tr('defaultUnit')),
          systemQty: sysQty,
          physicalQty,
          physicalCountInput: rawInput,
          unitCost: Number(it.unitCost ?? it.costPrice ?? 0)
        };
      });
    }

    const list = selectedWarehouseId === 'ALL'
      ? allProducts
      : allProducts.filter(p => p.warehouseId === selectedWarehouseId);

    return list.map((p, idx) => {
      const productId = p.id ? String(p.id).trim() : String(p.sku || `item-${idx}`);
      const warehouseId = p.warehouseId ? String(p.warehouseId).trim() : 'WH-01';
      const baseKey = `${productId}-${warehouseId}`;
      const rowKey = buildUniqueRowKey(baseKey, seenKeys);

      const wh = allWarehouses.find(w => w.id === warehouseId);
      const whName = isAr ? (wh?.nameAr || p.warehouseName) : (wh?.nameEn || p.warehouseNameEn || p.warehouseName);
      const sysQty = Number(p.currentStock) || 0;
      const rawInput = physicalCounts[rowKey] !== undefined ? physicalCounts[rowKey] : String(sysQty);
      const parsedQty = rawInput.trim() === '' ? 0 : Math.max(0, Number(rawInput));
      const physicalQty = Number.isFinite(parsedQty) ? parsedQty : sysQty;

      return {
        rowKey,
        productId,
        sku: p.sku,
        barcode: p.barcode || p.sku,
        name: isAr ? p.nameAr : (p.nameEn || p.nameAr),
        nameAr: p.nameAr,
        warehouseId,
        warehouse: whName,
        shelf: p.shelf || 'A-01',
        unit: p.unit || tr('defaultUnit'),
        systemQty: sysQty,
        physicalQty,
        physicalCountInput: rawInput,
        unitCost: Number(p.costPrice) || 0
      };
    });
  }, [apiRows, allProducts, allWarehouses, selectedWarehouseId, physicalCounts, isAr]);

  // Update ONLY the edited row identified by rowKey
  const handleUpdatePhysical = (rowKey: string, rawVal: string) => {
    if (rawVal === '') {
      setPhysicalCounts(prev => ({
        ...prev,
        [rowKey]: ''
      }));
      return;
    }

    const numeric = Number(rawVal);
    if (!Number.isFinite(numeric)) return;
    const cleanVal = numeric < 0 ? '0' : rawVal;
    setPhysicalCounts(prev => ({
      ...prev,
      [rowKey]: cleanVal
    }));
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return auditItems.filter(item => {
      const matchesSearch = !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q) ||
        item.warehouse.toLowerCase().includes(q);

      const variance = item.physicalQty - item.systemQty;
      const matchesStatus =
        statusFilter === 'ALL' ? true :
        statusFilter === 'DISCREPANCY' ? (variance !== 0) :
        (variance === 0);

      return matchesSearch && matchesStatus;
    });
  }, [auditItems, searchQuery, statusFilter]);

  const totalItemsCount = auditItems.length;
  const matchedCount = auditItems.filter(i => i.physicalQty === i.systemQty).length;
  const discrepancyItems = auditItems.filter(i => i.physicalQty !== i.systemQty);
  const discrepancyCount = discrepancyItems.length;
  const netVarianceValue = auditItems.reduce((acc, i) => acc + ((i.physicalQty - i.systemQty) * i.unitCost), 0);
  const shortageCount = auditItems.filter(i => i.physicalQty < i.systemQty).length;
  const surplusCount = auditItems.filter(i => i.physicalQty > i.systemQty).length;

  const handleReconcile = async () => {
    if (discrepancyCount === 0 || auditItems.length === 0) return;

    setIsSubmitting(true);

    const operatorName = currentUser?.fullName || currentUser?.username || tr('defaultOperator');
    const reconciliationPayload = discrepancyItems.map(item => ({
      stocktakeItemId: item.stocktakeItemId,
      productId: item.productId,
      warehouseId: item.warehouseId,
      bookQuantity: item.systemQty,
      actualQuantity: item.physicalQty,
      newStock: item.physicalQty,
      delta: item.physicalQty - item.systemQty,
      warehouseName: item.warehouse,
      operatorName
    }));

    try {
      await fetch('/api/v1/inventory/reconciliation/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: selectedWarehouseId,
          operator: operatorName,
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

    setPhysicalCounts(prev => {
      const next: Record<string, string> = { ...prev };
      discrepancyItems.forEach(item => {
        next[item.rowKey] = String(item.physicalQty);
      });
      return next;
    });

    setIsSubmitting(false);
    setReconciledToast(tr('reconcileSuccessToast').replace('{count}', String(discrepancyCount)));
    setTimeout(() => setReconciledToast(''), 4500);
  };

  return (
    <div className="view-content-wrapper fade-in" style={{ paddingBottom: '3rem' }} dir={isAr ? 'rtl' : 'ltr'}>
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
              {tr('title')}
            </h2>
          </div>
          <p className="view-subtitle" style={{ margin: '4px 0 0' }}>
            {tr('subtitle')}
          </p>
        </div>

        <div className="module-actions-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary-flat"
            onClick={() => fetchWarehouseItems(selectedWarehouseId)}
            disabled={isLoading}
            title={tr('refreshTitle')}
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
            <span>{tr('refreshBtn')}</span>
          </button>

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
                ? tr('reconcileEmptyTitle')
                : tr('reconcileReadyTitle').replace('{count}', String(discrepancyCount))
            }
          >
            <Check size={16} />
            <span>
              {isSubmitting
                ? tr('reconcilingBtn')
                : tr('reconcileBtn').replace('{count}', String(discrepancyCount))}
            </span>
          </button>
        </div>
      </div>

      {/* 4 Dynamic KPI Cards */}
      <div className="module-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '1.25rem' }}>
        <div className="module-kpi-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="module-kpi-info">
            <span className="module-kpi-label" style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {tr('kpiTotalSkus')}
            </span>
            <div className="module-kpi-value" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--foreground)', marginTop: '4px' }}>
              {totalItemsCount} <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 500 }}>{tr('kpiItemsUnit')}</span>
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.14)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PackageCheck size={22} />
          </div>
        </div>

        <div className="module-kpi-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="module-kpi-info">
            <span className="module-kpi-label" style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {tr('kpiExactMatched')}
            </span>
            <div className="module-kpi-value" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--badge-emerald-fg, #059669)', marginTop: '4px' }}>
              {matchedCount} <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 500 }}>({((matchedCount / (totalItemsCount || 1)) * 100).toFixed(0)}%)</span>
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--badge-emerald-bg)', color: 'var(--badge-emerald-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="module-kpi-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="module-kpi-info">
            <span className="module-kpi-label" style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {tr('kpiDiscrepancies')}
            </span>
            <div className="module-kpi-value" style={{ fontSize: '22px', fontWeight: 800, color: discrepancyCount > 0 ? 'var(--badge-amber-fg, #ea580c)' : 'var(--muted-foreground)', marginTop: '4px' }}>
              {discrepancyCount} <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 500 }}>({tr('kpiDiscrepancyBreakdown').replace('{short}', String(shortageCount)).replace('{surplus}', String(surplusCount))})</span>
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: discrepancyCount > 0 ? 'var(--badge-amber-bg)' : 'var(--muted)', color: discrepancyCount > 0 ? 'var(--badge-amber-fg)' : 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="module-kpi-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="module-kpi-info">
            <span className="module-kpi-label" style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {tr('kpiNetValue')}
            </span>
            <div className="module-kpi-value" style={{ fontSize: '20px', fontWeight: 800, color: netVarianceValue < 0 ? 'var(--badge-red-fg, #dc2626)' : netVarianceValue > 0 ? 'var(--badge-emerald-fg, #059669)' : 'var(--muted-foreground)', marginTop: '4px' }}>
              {formatMoney(Math.abs(netVarianceValue))}
              <span style={{ fontSize: '12px', fontWeight: 600, marginInlineStart: '6px', color: netVarianceValue < 0 ? 'var(--badge-red-fg, #dc2626)' : netVarianceValue > 0 ? 'var(--badge-emerald-fg, #059669)' : 'var(--muted-foreground)' }}>
                {netVarianceValue < 0 ? tr('statusDeficit') : netVarianceValue > 0 ? tr('statusSurplus') : tr('statusBalanced')}
              </span>
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: netVarianceValue < 0 ? 'var(--badge-red-bg)' : 'var(--badge-emerald-bg)', color: netVarianceValue < 0 ? 'var(--badge-red-fg)' : 'var(--badge-emerald-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: isAr ? '12px' : 'auto', left: isAr ? 'auto' : '12px', color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            placeholder={tr('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              paddingRight: isAr ? '36px' : '12px',
              paddingLeft: isAr ? '12px' : '36px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '13px'
            }}
          />
        </div>

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
            {tr('allWarehouses')}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'DISCREPANCY' ? 'ALL' : 'DISCREPANCY')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: statusFilter === 'DISCREPANCY' ? '1px solid var(--badge-amber-border)' : '1px solid var(--border)',
              background: statusFilter === 'DISCREPANCY' ? 'var(--badge-amber-bg)' : 'transparent',
              color: statusFilter === 'DISCREPANCY' ? 'var(--badge-amber-fg)' : 'var(--muted-foreground)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Filter size={14} />
            <span>{tr('discrepanciesOnly')}</span>
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
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ overflowX: 'auto', minWidth: '850px' }}>
          <table className="custom-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
            <thead>
              <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)', width: '50px' }}>#</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)', width: '140px' }}>{tr('colBarcodeSku')}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)' }}>{tr('colItemDesc')}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)', width: '180px' }}>{tr('colWarehouseShelf')}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)', width: '90px' }}>{tr('colUnit')}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)', width: '120px' }}>{tr('colSystemQty')}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)', width: '140px' }}>{tr('colActualQty')}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)', width: '120px' }}>{tr('colVariance')}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)', width: '120px' }}>{tr('colFinancialImpact')}</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--muted-foreground)', width: '110px' }}>{tr('colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted-foreground)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={32} className="text-muted-foreground" />
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                        {tr('emptyTitle')}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)' }}>
                        {tr('emptySubtitle')}
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
                      key={item.rowKey}
                      className={`border-b border-border transition-colors ${
                        hasDiscrepancy
                          ? variance < 0
                            ? 'bg-red-50/70 dark:bg-red-950/30'
                            : 'bg-emerald-50/70 dark:bg-emerald-950/30'
                          : ''
                      }`}
                    >
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>
                        {index + 1}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '12px' }} dir="ltr">
                          {item.sku}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px', fontFamily: 'monospace' }} dir="ltr">
                          <BarcodeIcon size={12} />
                          <span>{item.barcode}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '13px' }}>
                          <bdi dir="auto">{item.name}</bdi>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                          {tr('standardCostPrefix')} <span dir="ltr" className="tabular-nums">{formatMoney(item.unitCost)}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
                          <bdi dir="auto">{item.warehouse}</bdi>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px', fontFamily: 'monospace' }}>
                          {tr('shelfPrefix')} <strong dir="ltr">{item.shelf}</strong>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--muted-foreground)' }}>
                        {item.unit}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'monospace' }} dir="ltr">
                          {item.systemQty}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>
                          {tr('systemLedgerHint')}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <input
                          type="number"
                          id={`counted-input-${item.rowKey}`}
                          data-testid={`counted-input-${item.rowKey}`}
                          min="0"
                          step="1"
                          value={item.physicalCountInput}
                          onChange={(e) => handleUpdatePhysical(item.rowKey, e.target.value)}
                          dir="ltr"
                          className="tabular-nums"
                          style={{
                            width: '90px',
                            height: '36px',
                            background: 'var(--background)',
                            border: hasDiscrepancy
                              ? (variance < 0 ? '2px solid #ef4444' : '2px solid #10b981')
                              : '1px solid var(--border)',
                            color: 'var(--foreground)',
                            borderRadius: '8px',
                            padding: '4px 10px',
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {variance === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-muted text-muted-foreground border border-border tabular-nums">
                            0
                          </span>
                        ) : variance > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border tabular-nums bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60">
                            +{variance} ({tr('varianceSurplus')})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border tabular-nums bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60">
                            {variance} ({tr('varianceShortage')})
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div
                          dir="ltr"
                          className={`font-mono text-xs font-extrabold tabular-nums ${
                            variance === 0
                              ? 'text-muted-foreground'
                              : variance > 0
                                ? 'text-emerald-600 dark:text-emerald-300'
                                : 'text-red-600 dark:text-red-300'
                          }`}
                        >
                          {variance === 0 ? '-' : (variance > 0 ? `+${formatMoney(varianceValue)}` : `-${formatMoney(Math.abs(varianceValue))}`)}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            variance === 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60'
                          }`}
                        >
                          {variance === 0 ? tr('badgeMatched') : tr('badgeDiscrepancy')}
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
