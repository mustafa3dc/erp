import React, { useState, useEffect, useRef } from 'react';
import { 
  Scan, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Building2, 
  User, 
  FileText, 
  Warehouse as WarehouseIcon, 
  Calendar, 
  Tag, 
  AlertTriangle,
  X,
  Smartphone,
  Check
} from 'lucide-react';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';
import { apiClient } from '../../lib/api-client';
import { 
  getStoredProductSerials, 
  saveStoredProductSerials,
  getStoredProducts,
  getStoredWarehouses,
  getStoredSuppliers
} from '../../services/storageService';
import { 
  ProductSerial, 
  ProductSerialStatus, 
  SerialLookupResult 
} from '../../types/businessModules';
import { Product, Warehouse } from '../../types/warehouse';

interface SerialTrackingViewProps {
  lang: 'en' | 'ar';
}

export default function SerialTrackingView({ lang }: SerialTrackingViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const getProdName = (p?: Product) => p ? ((isAr ? p.nameAr : p.nameEn) || p.nameAr || p.nameEn) : '';
  const getWhName = (w?: Warehouse) => w ? ((isAr ? w.nameAr : w.nameEn) || w.nameAr || w.nameEn) : '';

  const [serials, setSerials] = useState<ProductSerial[]>(() => getStoredProductSerials());
  const [products] = useState<Product[]>(() => getStoredProducts());
  const [warehouses] = useState<Warehouse[]>(() => getStoredWarehouses());
  const [suppliers] = useState(() => getStoredSuppliers());

  const [scanInput, setScanInput] = useState('');
  const [lookupResult, setLookupResult] = useState<SerialLookupResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [notFoundMsg, setNotFoundMsg] = useState(false);

  const [filterSearch, setFilterSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProductSerialStatus>('ALL');

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Modal: Register Serials
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regProductId, setRegProductId] = useState('');
  const [regWarehouseId, setRegWarehouseId] = useState('');
  const [regSupplierId, setRegSupplierId] = useState('');
  const [regBillNo, setRegBillNo] = useState('');
  const [regWarrantyMonths, setRegWarrantyMonths] = useState(12);
  const [bulkSerialsText, setBulkSerialsText] = useState('');

  const scanInputRef = useRef<HTMLInputElement>(null);

  // Fetch API with fallback
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get('/api/serial-tracking');
        if (res && res.success && Array.isArray(res.data)) {
          setSerials(res.data);
          saveStoredProductSerials(res.data);
        }
      } catch {
        // fallback
      }
    };
    fetchData();
  }, []);

  // Filter products requiring serial numbers
  const serializedProducts = products.filter(p => (p as any).requiresSerialNumber !== false);

  useEffect(() => {
    if (isRegisterModalOpen) {
      if (serializedProducts.length > 0 && !regProductId) {
        setRegProductId(serializedProducts[0].id);
      }
      if (warehouses.length > 0 && !regWarehouseId) {
        setRegWarehouseId(warehouses[0].id);
      }
      if (suppliers.length > 0 && !regSupplierId) {
        setRegSupplierId(suppliers[0].id);
      }
    }
  }, [isRegisterModalOpen, serializedProducts, warehouses, suppliers, regProductId, regWarehouseId, regSupplierId]);

  // KPIs
  const totalSerials = serials.length;
  const inStockCount = serials.filter(s => s.status === 'InStock').length;
  const soldCount = serials.filter(s => s.status === 'Sold').length;
  const activeWarrantyCount = serials.filter(s => {
    if (s.status !== 'Sold' || !s.warrantyEndDate) return false;
    return new Date(s.warrantyEndDate) >= new Date();
  }).length;

  // Handle Fast Scan / Lookup
  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = scanInput.trim();
    if (!query) return;

    setIsSearching(true);
    setNotFoundMsg(false);

    try {
      const res = await apiClient.get(`/api/serial-tracking/lookup/${encodeURIComponent(query)}`);
      if (res && res.success && res.data) {
        setLookupResult(res.data);
        setIsSearching(false);
        return;
      }
    } catch {
      // fallback to local search
    }

    // Local Search Fallback
    const found = serials.find(s => s.serialNumber.toLowerCase() === query.toLowerCase());
    if (found) {
      let isWarrantyActive = false;
      let warrantyDaysRemaining = 0;

      if (found.warrantyEndDate) {
        const diff = new Date(found.warrantyEndDate).getTime() - new Date().getTime();
        warrantyDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        isWarrantyActive = diff > 0;
      }

      setLookupResult({
        serialNumber: found.serialNumber,
        productId: found.productId,
        productName: found.productName,
        productSku: found.productSku,
        status: found.status,
        warehouseName: found.warehouseName,
        supplierName: found.supplierName,
        purchaseBillNo: found.purchaseBillNo,
        purchaseDate: found.purchaseDate,
        customerName: found.customerName,
        salesInvoiceNo: found.salesInvoiceNo,
        saleDate: found.saleDate,
        warrantyMonths: found.warrantyMonths,
        warrantyEndDate: found.warrantyEndDate,
        isWarrantyActive,
        warrantyDaysRemaining
      });
    } else {
      setLookupResult(null);
      setNotFoundMsg(true);
    }

    setIsSearching(false);
  };

  // Filtered Serials
  const filteredSerials = serials.filter(s => {
    const term = filterSearch.toLowerCase().trim();
    const matchesSearch = !term ||
      s.serialNumber.toLowerCase().includes(term) ||
      s.productName.toLowerCase().includes(term) ||
      s.productSku.toLowerCase().includes(term) ||
      (s.customerName && s.customerName.toLowerCase().includes(term)) ||
      (s.salesInvoiceNo && s.salesInvoiceNo.toLowerCase().includes(term));

    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
      matchesStatus = s.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  // Bulk Register Serials
  const handleBulkRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regProductId || !regWarehouseId || !bulkSerialsText.trim()) return;

    const prod = products.find(p => p.id === regProductId);
    const wh = warehouses.find(w => w.id === regWarehouseId);
    const supp = suppliers.find(s => s.id === regSupplierId);

    const rawList = bulkSerialsText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const uniqueSerials = Array.from(new Set(rawList));
    if (uniqueSerials.length === 0) return;

    const payload = {
      productId: regProductId,
      warehouseId: regWarehouseId,
      supplierId: regSupplierId || undefined,
      purchaseBillNo: regBillNo.trim() || undefined,
      warrantyMonths: Number(regWarrantyMonths) || 12,
      serialNumbers: uniqueSerials
    };

    let newSerials: ProductSerial[] = uniqueSerials.map((sn, idx) => ({
      id: `SN-${Date.now()}-${idx}`,
      tenantId: 'default',
      productId: regProductId,
      productName: getProdName(prod) || regProductId,
      productSku: prod?.sku || '',
      serialNumber: sn,
      warehouseId: regWarehouseId,
      warehouseName: getWhName(wh),
      supplierId: regSupplierId,
      supplierName: supp?.company,
      purchaseBillNo: regBillNo.trim() || undefined,
      purchaseDate: new Date().toISOString(),
      warrantyMonths: Number(regWarrantyMonths) || 12,
      status: 'InStock',
      createdAt: new Date().toISOString()
    }));

    try {
      const res = await apiClient.post('/api/serial-tracking/register', payload);
      if (res && res.success && Array.isArray(res.data)) {
        newSerials = res.data;
      }
    } catch {
      // fallback
    }

    const next = [...newSerials, ...serials];
    setSerials(next);
    saveStoredProductSerials(next);

    setIsRegisterModalOpen(false);
    setBulkSerialsText('');
    setRegBillNo('');
    showToast(getTranslation(lang, 'serialTracking.registerSuccess'));
  };

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {toastMsg && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: isAr ? 'auto' : '24px', right: isAr ? '24px' : 'auto', zIndex: 9999 }}>
          <CheckCircle2 size={16} className="green-text" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <Smartphone size={16} style={{ color: 'var(--primary)' }} />
            <span>{getTranslation(lang, 'serialTracking.subtitle')}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          <button 
            type="button" 
            className="btn-clean-primary"
            onClick={() => setIsRegisterModalOpen(true)}
          >
            <Plus size={15} />
            <span>{getTranslation(lang, 'serialTracking.registerSerials')}</span>
          </button>
        </div>
      </div>

      {/* FAST SCANNER LOOKUP BAR */}
      <div 
        className="panel-clean" 
        style={{ 
          padding: '20px 24px', 
          marginBottom: '20px', 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(168, 85, 247, 0.04) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Scan size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
            {getTranslation(lang, 'serialTracking.fastLookup')}
          </h3>
        </div>

        <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Scan size={18} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isAr ? 'right' : 'left']: '14px', color: '#94a3b8' }} />
            <input 
              ref={scanInputRef}
              type="text" 
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              placeholder={getTranslation(lang, 'serialTracking.scanPlaceholder')}
              className="input-clean font-mono"
              style={{ 
                width: '100%', 
                padding: '12px 16px', 
                [isAr ? 'paddingRight' : 'paddingLeft']: '42px', 
                fontSize: '15px', 
                fontWeight: 600,
                borderRadius: '12px',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.08)'
              }}
              autoFocus
            />
          </div>
          <button 
            type="submit" 
            className="btn-clean-primary"
            style={{ padding: '0 24px', fontSize: '14px', borderRadius: '12px' }}
            disabled={isSearching}
          >
            <Search size={16} />
            <span>{getTranslation(lang, 'common.actions')}</span>
          </button>
        </form>

        {/* Lookup Result Card */}
        {lookupResult && (
          <div 
            className="fade-in" 
            style={{ 
              marginTop: '18px', 
              padding: '18px 20px', 
              borderRadius: '14px', 
              background: '#fff', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    {lookupResult.productName}
                  </h4>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748b' }}>
                    ({lookupResult.productSku})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>
                    SN: {lookupResult.serialNumber}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: lookupResult.status === 'InStock' ? 'rgba(34, 197, 94, 0.12)' :
                                lookupResult.status === 'Sold' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: lookupResult.status === 'InStock' ? '#16a34a' :
                           lookupResult.status === 'Sold' ? '#2563eb' : '#dc2626'
                  }}>
                    {lookupResult.status}
                  </span>
                </div>
              </div>

              {/* Warranty Card */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                padding: '8px 14px', 
                borderRadius: '10px',
                background: lookupResult.isWarrantyActive ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${lookupResult.isWarrantyActive ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
              }}>
                {lookupResult.isWarrantyActive ? (
                  <ShieldCheck size={24} style={{ color: '#16a34a' }} />
                ) : (
                  <ShieldAlert size={24} style={{ color: '#dc2626' }} />
                )}
                <div>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: lookupResult.isWarrantyActive ? '#16a34a' : '#dc2626' }}>
                    {lookupResult.isWarrantyActive ? getTranslation(lang, 'serialTracking.activeWarranty') : getTranslation(lang, 'serialTracking.expiredWarranty')}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {lookupResult.isWarrantyActive 
                      ? `${lookupResult.warrantyDaysRemaining} ${getTranslation(lang, 'quotations.daysRemaining')}` 
                      : (lookupResult.warrantyEndDate ? lookupResult.warrantyEndDate.slice(0, 10) : '—')}
                  </span>
                </div>
              </div>
            </div>

            {/* Inbound & Outbound details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              {/* Inbound */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  {getTranslation(lang, 'serialTracking.purchaseInfo')}
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>{getTranslation(lang, 'serialTracking.supplier')}:</span>
                  <span style={{ fontWeight: 600 }}>{lookupResult.supplierName || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>{getTranslation(lang, 'serialTracking.purchaseBill')}:</span>
                  <span style={{ fontFamily: 'monospace' }}>{lookupResult.purchaseBillNo || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>{getTranslation(lang, 'expenses.voucherDate')}:</span>
                  <span>{(lookupResult.purchaseDate || '').slice(0, 10) || '—'}</span>
                </div>
              </div>

              {/* Outbound */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  {getTranslation(lang, 'serialTracking.salesInfo')}
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>{getTranslation(lang, 'serialTracking.customer')}:</span>
                  <span style={{ fontWeight: 600 }}>{lookupResult.customerName || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>{getTranslation(lang, 'serialTracking.salesInvoice')}:</span>
                  <span style={{ fontFamily: 'monospace' }}>{lookupResult.salesInvoiceNo || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>{getTranslation(lang, 'expenses.voucherDate')}:</span>
                  <span>{(lookupResult.saleDate || '').slice(0, 10) || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {notFoundMsg && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '13px', fontWeight: 600 }}>
            <AlertTriangle size={16} />
            <span>{getTranslation(lang, 'serialTracking.notFound')}</span>
          </div>
        )}
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'serialTracking.inStock')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#16a34a' }}>
              {inStockCount} <span className="kpi-sub-unit">IMEI</span>
            </div>
          </div>
          <div className="module-kpi-icon emerald">
            <WarehouseIcon size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'serialTracking.sold')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#2563eb' }}>
              {soldCount} <span className="kpi-sub-unit">IMEI</span>
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <User size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'serialTracking.activeWarranty')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#8b5cf6' }}>
              {activeWarrantyCount} <span className="kpi-sub-unit">{getTranslation(lang, 'serialTracking.warrantyStatus')}</span>
            </div>
          </div>
          <div className="module-kpi-icon purple">
            <ShieldCheck size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'serialTracking.title')}</span>
            <div className="module-kpi-value">
              {totalSerials} <span className="kpi-sub-unit">Units</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Smartphone size={20} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="module-toolbar">
        <div className="module-search-box">
          <Search size={16} />
          <input 
            type="text" 
            placeholder={getTranslation(lang, 'serialTracking.searchPlaceholder')}
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </div>

        <div className="module-filter-pills">
          {[
            { id: 'ALL', label: getTranslation(lang, 'serialTracking.filterAll') },
            { id: 'InStock', label: getTranslation(lang, 'serialTracking.filterInStock') },
            { id: 'Sold', label: getTranslation(lang, 'serialTracking.filterSold') },
            { id: 'Returned', label: getTranslation(lang, 'serialTracking.filterReturned') },
            { id: 'Defective', label: getTranslation(lang, 'serialTracking.filterDefective') }
          ].map(pill => (
            <button
              key={pill.id}
              type="button"
              className={`module-filter-pill ${statusFilter === pill.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(pill.id as any)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Serials Table */}
      <div className="panel-clean">
        <div className="table-responsive">
          <table className="table-clean">
            <thead>
              <tr>
                <th>{getTranslation(lang, 'serialTracking.fastLookup')} (IMEI / SN)</th>
                <th>{getTranslation(lang, 'quotations.product')}</th>
                <th>{getTranslation(lang, 'serialTracking.status')}</th>
                <th>{getTranslation(lang, 'quotations.warehouse')} / {getTranslation(lang, 'serialTracking.customer')}</th>
                <th>{getTranslation(lang, 'serialTracking.warrantyMonths')}</th>
                <th>{getTranslation(lang, 'serialTracking.warrantyStatus')}</th>
                <th>{getTranslation(lang, 'expenses.voucherDate')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSerials.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    {getTranslation(lang, 'serialTracking.noSerialsFound')}
                  </td>
                </tr>
              ) : (
                filteredSerials.map(s => {
                  const isWarrantyActive = s.warrantyEndDate ? new Date(s.warrantyEndDate) >= new Date() : false;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                        {s.serialNumber}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{s.productName}</span>
                        {s.productSku && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{s.productSku}</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: s.status === 'InStock' ? 'rgba(34, 197, 94, 0.12)' :
                                      s.status === 'Sold' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: s.status === 'InStock' ? '#16a34a' :
                                 s.status === 'Sold' ? '#2563eb' : '#dc2626'
                        }}>
                          {s.status === 'InStock' ? getTranslation(lang, 'serialTracking.inStock') :
                           s.status === 'Sold' ? getTranslation(lang, 'serialTracking.sold') :
                           s.status === 'Returned' ? getTranslation(lang, 'serialTracking.returned') :
                           getTranslation(lang, 'serialTracking.defective')}
                        </span>
                      </td>
                      <td>
                        {s.status === 'Sold' ? (
                          <div>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{s.customerName || 'Walk-in'}</span>
                            {s.salesInvoiceNo && (
                              <span style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: '#2563eb' }}>
                                #{s.salesInvoiceNo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#475569' }}>
                            {s.warehouseName || s.warehouseId}
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {s.warrantyMonths}m
                      </td>
                      <td>
                        {s.status === 'Sold' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: isWarrantyActive ? '#16a34a' : '#dc2626'
                          }}>
                            {isWarrantyActive ? <Check size={12} /> : <X size={12} />}
                            <span>{isWarrantyActive ? getTranslation(lang, 'serialTracking.activeWarranty') : getTranslation(lang, 'serialTracking.expiredWarranty')}</span>
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {(s.createdAt || '').slice(0, 10)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Bulk Register Serials */}
      {isRegisterModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsRegisterModalOpen(false)}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '580px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Smartphone size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{getTranslation(lang, 'serialTracking.registerSerials')}</h3>
              </div>
              <button type="button" onClick={() => setIsRegisterModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBulkRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'serialTracking.selectProduct')} *
                </label>
                <select 
                  className="select-clean"
                  value={regProductId}
                  onChange={e => setRegProductId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{getProdName(p)} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'serialTracking.selectWarehouse')} *
                  </label>
                  <select 
                    className="select-clean"
                    value={regWarehouseId}
                    onChange={e => setRegWarehouseId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{getWhName(w)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'serialTracking.warrantyMonths')}
                  </label>
                  <input 
                    type="number"
                    min="0"
                    max="60"
                    value={regWarrantyMonths}
                    onChange={e => setRegWarrantyMonths(Number(e.target.value))}
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'serialTracking.selectSupplier')}
                  </label>
                  <select 
                    className="select-clean"
                    value={regSupplierId}
                    onChange={e => setRegSupplierId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    <option value="">—</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.company}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'serialTracking.purchaseBillNo')}
                  </label>
                  <input 
                    type="text"
                    value={regBillNo}
                    onChange={e => setRegBillNo(e.target.value)}
                    placeholder="PO-2026-..."
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'serialTracking.serialsList')} (IMEI / Barcodes) *
                </label>
                <textarea 
                  rows={4}
                  value={bulkSerialsText}
                  onChange={e => setBulkSerialsText(e.target.value)}
                  placeholder={getTranslation(lang, 'serialTracking.enterSerialsHint')}
                  required
                  className="input-clean font-mono"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn-clean-secondary"
                  onClick={() => setIsRegisterModalOpen(false)}
                >
                  {getTranslation(lang, 'serialTracking.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="btn-clean-primary"
                >
                  {getTranslation(lang, 'serialTracking.register')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
