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
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';

interface SerialTrackingViewProps {
  lang: 'en' | 'ar';
  initialSerialLookup?: string;
}

export default function SerialTrackingView({ lang, initialSerialLookup }: SerialTrackingViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const getProdName = (p?: Product) => p ? ((isAr ? p.nameAr : p.nameEn) || p.nameAr || p.nameEn) : '';
  const getWhName = (w?: Warehouse) => w ? ((isAr ? w.nameAr : w.nameEn) || w.nameAr || w.nameEn) : '';

  const [serials, setSerials] = useState<ProductSerial[]>(() => getStoredProductSerials());
  const [products] = useState<Product[]>(() => getStoredProducts());
  const [warehouses] = useState<Warehouse[]>(() => getStoredWarehouses());
  const [suppliers] = useState(() => getStoredSuppliers());

  const [scanInput, setScanInput] = useState(initialSerialLookup || '');
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
  const executeLookup = async (rawQuery: string) => {
    const query = rawQuery.trim();
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

  useEffect(() => {
    if (initialSerialLookup && initialSerialLookup.trim()) {
      setScanInput(initialSerialLookup.trim());
      executeLookup(initialSerialLookup);
    }
  }, [initialSerialLookup]);

  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await executeLookup(scanInput);
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
        className="panel-clean p-5 mb-5"
        style={{
          background: 'linear-gradient(135deg, var(--primary-light) 0%, color-mix(in oklch, var(--primary) 4%, var(--card)) 100%)',
          borderColor: 'var(--primary-border)'
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Scan size={17} style={{ color: 'var(--primary)' }} />
          <h3 className="m-0 text-sm font-bold text-foreground">
            {getTranslation(lang, 'serialTracking.fastLookup')}
          </h3>
        </div>

        <form onSubmit={handleScanSubmit} className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Scan size={16} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              placeholder={getTranslation(lang, 'serialTracking.scanPlaceholder')}
              className="input-clean font-mono w-full h-11 ps-10 pe-4 text-sm font-semibold rounded-xl border border-primary/30 bg-background text-foreground shadow-xs"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn-clean-primary h-11 px-5 rounded-xl"
            disabled={isSearching}
          >
            <Search size={15} />
            <span>{getTranslation(lang, 'ui.common.actions')}</span>
          </button>
        </form>

        {/* Lookup Result Card */}
        {lookupResult && (
          <div
            className="fade-in mt-4 p-5 rounded-2xl bg-card border border-border"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h4 className="m-0 text-base font-extrabold text-foreground" dir="auto">
                    {lookupResult.productName}
                  </h4>
                  <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                    ({lookupResult.productSku})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-primary" dir="ltr">
                    SN: {lookupResult.serialNumber}
                  </span>
                  <StatusBadge
                    tone={
                      lookupResult.status === 'InStock'
                        ? 'emerald'
                        : lookupResult.status === 'Sold'
                          ? 'indigo'
                          : 'rose'
                    }
                    dot
                    label={lookupResult.status}
                  />
                </div>
              </div>

              {/* Warranty Card */}
              <div
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border"
                style={{
                  background: lookupResult.isWarrantyActive ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)',
                  borderColor: lookupResult.isWarrantyActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'
                }}
              >
                {lookupResult.isWarrantyActive ? (
                  <ShieldCheck size={22} className="text-emerald-500 shrink-0" />
                ) : (
                  <ShieldAlert size={22} className="text-destructive shrink-0" />
                )}
                <div>
                  <span className={`block text-xs font-bold ${lookupResult.isWarrantyActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                    {lookupResult.isWarrantyActive ? getTranslation(lang, 'serialTracking.activeWarranty') : getTranslation(lang, 'serialTracking.expiredWarranty')}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums" dir="ltr">
                    {lookupResult.isWarrantyActive
                      ? `${lookupResult.warrantyDaysRemaining} ${getTranslation(lang, 'quotations.daysRemaining')}`
                      : (lookupResult.warrantyEndDate ? lookupResult.warrantyEndDate.slice(0, 10) : '—')}
                  </span>
                </div>
              </div>
            </div>

            {/* Inbound & Outbound details grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3.5 border-t border-border">
              {/* Inbound */}
              <div className="bg-muted/50 border border-border/70 p-3.5 rounded-xl space-y-1.5">
                <span className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  {getTranslation(lang, 'serialTracking.purchaseInfo')}
                </span>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{getTranslation(lang, 'serialTracking.supplier')}:</span>
                  <span className="font-semibold text-foreground" dir="auto">{lookupResult.supplierName || '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{getTranslation(lang, 'serialTracking.purchaseBill')}:</span>
                  <span className="font-mono text-foreground" dir="ltr">{lookupResult.purchaseBillNo || '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{getTranslation(lang, 'expenses.voucherDate')}:</span>
                  <span className="tabular-nums text-foreground" dir="ltr">{(lookupResult.purchaseDate || '').slice(0, 10) || '—'}</span>
                </div>
              </div>

              {/* Outbound */}
              <div className="bg-muted/50 border border-border/70 p-3.5 rounded-xl space-y-1.5">
                <span className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  {getTranslation(lang, 'serialTracking.salesInfo')}
                </span>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{getTranslation(lang, 'serialTracking.customer')}:</span>
                  <span className="font-semibold text-foreground" dir="auto">{lookupResult.customerName || '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{getTranslation(lang, 'serialTracking.salesInvoice')}:</span>
                  <span className="font-mono text-foreground" dir="ltr">{lookupResult.salesInvoiceNo || '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{getTranslation(lang, 'expenses.voucherDate')}:</span>
                  <span className="tabular-nums text-foreground" dir="ltr">{(lookupResult.saleDate || '').slice(0, 10) || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {notFoundMsg && (
          <div className="mt-3 flex items-center gap-2 text-destructive text-xs font-semibold">
            <AlertTriangle size={15} />
            <span>{getTranslation(lang, 'serialTracking.notFound')}</span>
          </div>
        )}
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'serialTracking.inStock')}</span>
            <div className="module-kpi-value font-mono text-emerald-600 dark:text-emerald-400">
              {inStockCount} <span className="kpi-sub-unit">IMEI</span>
            </div>
          </div>
          <div className="module-kpi-icon emerald">
            <WarehouseIcon size={19} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'serialTracking.sold')}</span>
            <div className="module-kpi-value font-mono text-primary">
              {soldCount} <span className="kpi-sub-unit">IMEI</span>
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <User size={19} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'serialTracking.activeWarranty')}</span>
            <div className="module-kpi-value font-mono text-purple-600 dark:text-purple-400">
              {activeWarrantyCount} <span className="kpi-sub-unit">{getTranslation(lang, 'serialTracking.warrantyStatus')}</span>
            </div>
          </div>
          <div className="module-kpi-icon purple">
            <ShieldCheck size={19} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'serialTracking.title')}</span>
            <div className="module-kpi-value font-mono">
              {totalSerials} <span className="kpi-sub-unit">IMEI</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Smartphone size={19} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="module-toolbar">
        <div className="module-search-box">
          <Search size={15} />
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
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      lang={lang}
                      icon={<Smartphone size={22} />}
                      title={getTranslation(lang, 'serialTracking.noSerialsFound')}
                    />
                  </td>
                </tr>
              ) : (
                filteredSerials.map(s => {
                  const isWarrantyActive = s.warrantyEndDate ? new Date(s.warrantyEndDate) >= new Date() : false;
                  return (
                    <tr key={s.id}>
                      <td className="font-mono font-bold text-primary" dir="ltr">
                        {s.serialNumber}
                      </td>
                      <td>
                        <span className="font-semibold text-foreground" dir="auto">{s.productName}</span>
                        {s.productSku && (
                          <span className="block text-[11px] font-mono text-muted-foreground" dir="ltr">{s.productSku}</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge
                          tone={
                            s.status === 'InStock'
                              ? 'emerald'
                              : s.status === 'Sold'
                                ? 'indigo'
                                : s.status === 'Returned'
                                  ? 'amber'
                                  : 'rose'
                          }
                          dot
                          label={
                            s.status === 'InStock'
                              ? getTranslation(lang, 'serialTracking.inStock')
                              : s.status === 'Sold'
                                ? getTranslation(lang, 'serialTracking.sold')
                                : s.status === 'Returned'
                                  ? getTranslation(lang, 'serialTracking.returned')
                                  : getTranslation(lang, 'serialTracking.defective')
                          }
                        />
                      </td>
                      <td>
                        {s.status === 'Sold' ? (
                          <div>
                            <span className="font-semibold text-foreground" dir="auto">{s.customerName || '—'}</span>
                            {s.salesInvoiceNo && (
                              <span className="block text-[11px] font-mono text-primary" dir="ltr">
                                #{s.salesInvoiceNo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground" dir="auto">
                            {s.warehouseName || s.warehouseId}
                          </span>
                        )}
                      </td>
                      <td className="font-mono tabular-nums text-foreground" dir="ltr">
                        {s.warrantyMonths}m
                      </td>
                      <td>
                        {s.status === 'Sold' ? (
                          <StatusBadge
                            tone={isWarrantyActive ? 'emerald' : 'rose'}
                            icon={isWarrantyActive ? <Check size={11} /> : <X size={11} />}
                            label={
                              isWarrantyActive
                                ? getTranslation(lang, 'serialTracking.activeWarranty')
                                : getTranslation(lang, 'serialTracking.expiredWarranty')
                            }
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-xs text-muted-foreground tabular-nums" dir="ltr">
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
