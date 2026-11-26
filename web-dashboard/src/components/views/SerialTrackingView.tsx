import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  Search,
  ShieldCheck,
  ShieldAlert,
  Plus,
  CheckCircle2,
  Clock,
  User,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  X,
  Smartphone,
  Check,
  Wrench,
  Printer,
  RotateCcw,
  Ban
} from 'lucide-react';
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
  SerialLookupResult,
  SerialWarrantyStatus
} from '../../types/businessModules';
import { Product, Warehouse } from '../../types/warehouse';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { ModalBackdropPortal } from '../ui/dialog';

interface SerialTrackingViewProps {
  lang: 'en' | 'ar';
  initialSerialLookup?: string;
}

function resolveSerialWarrantyStatus(serial: {
  status: string;
  warrantyMonths?: number;
  warrantyEndDate?: string;
  warrantyStatus?: SerialWarrantyStatus;
}): SerialWarrantyStatus {
  if (serial.status !== 'Sold') {
    return 'NotStarted';
  }
  const months = Number(serial.warrantyMonths) || 0;
  if (months <= 0 || !serial.warrantyEndDate) {
    return 'NoWarranty';
  }
  return new Date(serial.warrantyEndDate) >= new Date() ? 'Active' : 'Expired';
}

function getStatusTranslation(lang: 'en' | 'ar', status: string): string {
  switch (status) {
    case 'InStock':
      return getTranslation(lang, 'serialTracking.inStock');
    case 'Sold':
      return getTranslation(lang, 'serialTracking.sold');
    case 'Returned':
      return getTranslation(lang, 'serialTracking.returned');
    case 'Defective':
      return getTranslation(lang, 'serialTracking.defective');
    case 'Transferred':
      return getTranslation(lang, 'serialTracking.transferred');
    default:
      return status;
  }
}

function getStatusTone(status: string): 'emerald' | 'indigo' | 'amber' | 'rose' {
  switch (status) {
    case 'InStock':
      return 'emerald';
    case 'Sold':
      return 'indigo';
    case 'Returned':
      return 'amber';
    default:
      return 'rose';
  }
}

export default function SerialTrackingView({ lang, initialSerialLookup }: SerialTrackingViewProps) {
  const isAr = lang === 'ar';
  const getProdName = (p?: Product) => (p ? (isAr ? p.nameAr : p.nameEn) || p.nameAr || p.nameEn : '');
  const getWhName = (w?: Warehouse) => (w ? (isAr ? w.nameAr : w.nameEn) || w.nameAr || w.nameEn : '');

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
  const [regWarrantyMonths, setRegWarrantyMonths] = useState(0);
  const [bulkSerialsText, setBulkSerialsText] = useState('');

  const scanInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus top Fast Scanner input immediately upon entering module
  useEffect(() => {
    const timer = setTimeout(() => {
      scanInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  // Fetch API with offline fallback
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get('/api/serial-tracking');
        if (res && res.success && Array.isArray(res.data)) {
          const normalized: ProductSerial[] = res.data.map((item: any) => ({
            ...item,
            purchaseBillNo: item.purchaseBillNo ?? item.purchaseBillNumber,
            salesInvoiceNo: item.salesInvoiceNo ?? item.salesInvoiceNumber,
            saleDate: item.saleDate ?? item.soldDate,
            warrantyStatus: item.warrantyStatus ?? resolveSerialWarrantyStatus(item),
          }));
          setSerials(normalized);
          saveStoredProductSerials(normalized);
        }
      } catch {
        // fallback to local storage
      }
    };
    fetchData();
  }, []);

  const serializedProducts = products.filter(p => p.requiresSerialNumber === true);
  const selectableProducts = serializedProducts.length > 0 ? serializedProducts : products;

  useEffect(() => {
    if (isRegisterModalOpen) {
      if (selectableProducts.length > 0 && !regProductId) {
        const firstProd = selectableProducts[0];
        setRegProductId(firstProd.id);
        setRegWarrantyMonths(Math.max(0, Number(firstProd.warrantyMonths) || 0));
      }
      if (warehouses.length > 0 && !regWarehouseId) {
        setRegWarehouseId(warehouses[0].id);
      }
    }
  }, [isRegisterModalOpen, selectableProducts, warehouses, regProductId, regWarehouseId]);

  const handleRegProductChange = (prodId: string) => {
    setRegProductId(prodId);
    const matched = products.find(p => p.id === prodId);
    if (matched) {
      setRegWarrantyMonths(Math.max(0, Number(matched.warrantyMonths) || 0));
    }
  };

  // KPIs
  const totalSerials = serials.length;
  const inStockCount = serials.filter(s => s.status === 'InStock').length;
  const soldCount = serials.filter(s => s.status === 'Sold').length;
  const activeWarrantyCount = serials.filter(s => resolveSerialWarrantyStatus(s) === 'Active').length;

  // Handle Fast Scan / Lookup
  const executeLookup = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setNotFoundMsg(false);

    try {
      const res = await apiClient.get(`/api/serial-tracking/lookup?serialNumber=${encodeURIComponent(query)}`);
      const payload = res?.data;
      const detail = payload?.detail ?? (payload?.serialNumber ? payload : null);
      if (res?.success && detail) {
        const statusVal = detail.status as ProductSerialStatus;
        const wStatus = detail.warrantyStatus || resolveSerialWarrantyStatus({
          status: statusVal,
          warrantyMonths: detail.warrantyMonths,
          warrantyEndDate: detail.warrantyEndDate,
        });
        setLookupResult({
          id: detail.id,
          serialNumber: detail.serialNumber,
          productId: detail.productId,
          productName: detail.productName,
          productSku: detail.productSku,
          status: statusVal,
          warehouseName: detail.warehouseName,
          supplierName: detail.supplierName,
          purchaseBillNo: detail.purchaseBillNumber ?? detail.purchaseBillNo,
          purchaseDate: detail.purchaseDate,
          customerName: detail.customerName,
          salesInvoiceNo: detail.salesInvoiceNumber ?? detail.salesInvoiceNo,
          saleDate: detail.soldDate ?? detail.saleDate,
          warrantyMonths: Number(detail.warrantyMonths) || 0,
          warrantyEndDate: detail.warrantyEndDate,
          warrantyStatus: wStatus,
          isWarrantyActive: wStatus === 'Active',
          warrantyDaysRemaining: Number(detail.remainingWarrantyDays ?? detail.warrantyDaysRemaining ?? 0),
        });
        setIsSearching(false);
        return;
      }
    } catch {
      // fallback to local search
    }

    const found = serials.find(s => s.serialNumber.toLowerCase() === query.toLowerCase());
    if (found) {
      const wStatus = resolveSerialWarrantyStatus(found);
      let warrantyDaysRemaining = 0;
      if (wStatus === 'Active' && found.warrantyEndDate) {
        const diff = new Date(found.warrantyEndDate).getTime() - new Date().getTime();
        warrantyDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }

      setLookupResult({
        id: found.id,
        serialNumber: found.serialNumber,
        productId: found.productId,
        productName: found.productName,
        productSku: found.productSku,
        status: found.status,
        warehouseName: found.warehouseName,
        supplierName: found.supplierName,
        purchaseBillNo: found.purchaseBillNumber ?? found.purchaseBillNo,
        purchaseDate: found.purchaseDate,
        customerName: found.customerName,
        salesInvoiceNo: found.salesInvoiceNumber ?? found.salesInvoiceNo,
        saleDate: found.soldDate ?? found.saleDate,
        warrantyMonths: found.warrantyMonths,
        warrantyEndDate: found.warrantyEndDate,
        warrantyStatus: wStatus,
        isWarrantyActive: wStatus === 'Active',
        warrantyDaysRemaining,
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

  const handleChangeSerialStatus = async (targetSerialNumber: string, serialId: string | undefined, nextStatus: 'Defective' | 'InStock') => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (serialId && uuidRegex.test(serialId)) {
      try {
        await apiClient.put(`/api/serial-tracking/${serialId}/status`, { status: nextStatus });
      } catch {
        // continue local state update cleanly
      }
    }

    const updatedList = serials.map(s => {
      if ((serialId && s.id === serialId) || s.serialNumber.toLowerCase() === targetSerialNumber.toLowerCase()) {
        return {
          ...s,
          status: nextStatus as ProductSerialStatus,
          warrantyStartDate: undefined,
          warrantyEndDate: undefined,
          warrantyStatus: 'NotStarted' as SerialWarrantyStatus,
          isWarrantyActive: false,
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });
    setSerials(updatedList);
    saveStoredProductSerials(updatedList);

    if (lookupResult && lookupResult.serialNumber.toLowerCase() === targetSerialNumber.toLowerCase()) {
      setLookupResult({
        ...lookupResult,
        status: nextStatus,
        warrantyStatus: 'NotStarted',
        isWarrantyActive: false,
        warrantyDaysRemaining: 0,
      });
    }

    showToast(getTranslation(lang, 'serialTracking.statusUpdatedToast'));
  };

  const handlePrintBarcodeLabel = (item: { serialNumber: string; productName: string; productSku?: string; warrantyMonths?: number }) => {
    if (typeof window === 'undefined') return;
    const printWin = window.open('', '_blank', 'width=420,height=300');
    if (!printWin) return;
    const months = Number(item.warrantyMonths) || 0;
    const warrantyLine = months > 0
      ? `${months} ${getTranslation(lang, 'serialTracking.monthUnit')}`
      : getTranslation(lang, 'serialTracking.noWarranty');
    printWin.document.write(`
      <html dir="${isAr ? 'rtl' : 'ltr'}">
        <head>
          <title>${item.serialNumber}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; text-align: center; color: #0f172a; }
            .box { border: 1px dashed #94a3b8; border-radius: 10px; padding: 14px; }
            .title { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
            .sku { font-size: 11px; color: #475569; font-family: monospace; margin-bottom: 10px; }
            .sn { font-size: 18px; font-weight: 800; font-family: monospace; letter-spacing: 1px; margin: 8px 0; }
            .war { font-size: 11px; color: #334155; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="title">${item.productName}</div>
            <div class="sku">${item.productSku || ''}</div>
            <div class="sn">*${item.serialNumber}*</div>
            <div class="war">${getTranslation(lang, 'serialTracking.warrantyStatus')}: ${warrantyLine}</div>
          </div>
          <script>window.onload = function(){ window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Filtered Serials
  const filteredSerials = serials.filter(s => {
    const term = filterSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      s.serialNumber.toLowerCase().includes(term) ||
      s.productName.toLowerCase().includes(term) ||
      s.productSku.toLowerCase().includes(term) ||
      (s.customerName && s.customerName.toLowerCase().includes(term)) ||
      (s.salesInvoiceNo && s.salesInvoiceNo.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
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

    const parsedWarrantyMonths = Math.max(0, Number(regWarrantyMonths) || 0);
    const payload = {
      productId: regProductId,
      warehouseId: regWarehouseId,
      supplierId: regSupplierId || undefined,
      supplierName: supp?.company || undefined,
      warrantyMonths: parsedWarrantyMonths,
      serialNumbers: uniqueSerials,
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
      warrantyMonths: parsedWarrantyMonths,
      warrantyStatus: 'NotStarted',
      isWarrantyActive: false,
      status: 'InStock',
      createdAt: new Date().toISOString(),
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

  const renderWarrantyBadge = (item: {
    status: string;
    warrantyMonths?: number;
    warrantyEndDate?: string;
    warrantyStatus?: SerialWarrantyStatus;
  }) => {
    const wStatus = resolveSerialWarrantyStatus(item);
    if (wStatus === 'NotStarted') {
      return (
        <StatusBadge
          tone="slate"
          icon={<Clock size={11} />}
          label={getTranslation(lang, 'serialTracking.notStarted')}
        />
      );
    }
    if (wStatus === 'NoWarranty') {
      return (
        <StatusBadge
          tone="slate"
          icon={<Ban size={11} />}
          label={getTranslation(lang, 'serialTracking.noWarranty')}
        />
      );
    }
    if (wStatus === 'Active') {
      return (
        <StatusBadge
          tone="emerald"
          icon={<Check size={11} />}
          label={getTranslation(lang, 'serialTracking.activeWarranty')}
        />
      );
    }
    return (
      <StatusBadge
        tone="rose"
        icon={<X size={11} />}
        label={getTranslation(lang, 'serialTracking.expiredWarranty')}
      />
    );
  };

  const lookupWarrantyStatus = lookupResult ? resolveSerialWarrantyStatus(lookupResult) : 'NotStarted';

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {toastMsg && (
        <div
          className="toast-banner glass-panel"
          style={{ position: 'fixed', bottom: '24px', left: isAr ? 'auto' : '24px', right: isAr ? '24px' : 'auto', zIndex: 9999 }}
        >
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
          borderColor: 'var(--primary-border)',
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
            <span>{getTranslation(lang, 'serialTracking.fastLookup')}</span>
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold font-mono text-primary" dir="ltr">
                    SN: {lookupResult.serialNumber}
                  </span>
                  <StatusBadge
                    tone={getStatusTone(lookupResult.status)}
                    dot
                    label={getStatusTranslation(lang, lookupResult.status)}
                  />
                  <span className="text-xs font-semibold text-muted-foreground">
                    {lookupResult.warrantyMonths > 0
                      ? `${lookupResult.warrantyMonths} ${getTranslation(lang, 'serialTracking.monthUnit')}`
                      : getTranslation(lang, 'serialTracking.noWarranty')}
                  </span>
                </div>
              </div>

              {/* Strict Lifecycle Warranty Box */}
              <div className="flex flex-wrap items-center gap-2.5">
                {lookupWarrantyStatus === 'Active' ? (
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10">
                    <ShieldCheck size={20} className="text-emerald-500 shrink-0" />
                    <div>
                      <span className="block text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {getTranslation(lang, 'serialTracking.activeWarranty')}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {lookupResult.warrantyDaysRemaining} {getTranslation(lang, 'serialTracking.remainingDays')}
                      </span>
                    </div>
                  </div>
                ) : lookupWarrantyStatus === 'NotStarted' ? (
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-border bg-muted/60">
                    <Clock size={20} className="text-muted-foreground shrink-0" />
                    <div>
                      <span className="block text-xs font-bold text-foreground">
                        {getTranslation(lang, 'serialTracking.notStarted')}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {lookupResult.warrantyMonths > 0
                          ? `${lookupResult.warrantyMonths} ${getTranslation(lang, 'serialTracking.monthUnit')}`
                          : getTranslation(lang, 'serialTracking.noWarranty')}
                      </span>
                    </div>
                  </div>
                ) : lookupWarrantyStatus === 'NoWarranty' ? (
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-border bg-muted/60">
                    <Ban size={20} className="text-muted-foreground shrink-0" />
                    <div>
                      <span className="block text-xs font-bold text-foreground">
                        {getTranslation(lang, 'serialTracking.noWarranty')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-destructive/25 bg-destructive/10">
                    <ShieldAlert size={20} className="text-destructive shrink-0" />
                    <div>
                      <span className="block text-xs font-bold text-destructive">
                        {getTranslation(lang, 'serialTracking.expiredWarranty')}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums" dir="ltr">
                        {lookupResult.warrantyEndDate ? lookupResult.warrantyEndDate.slice(0, 10) : '—'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Quick Lifecycle Actions */}
                <button
                  type="button"
                  onClick={() => handlePrintBarcodeLabel(lookupResult)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Printer size={14} />
                  <span>{getTranslation(lang, 'serialTracking.printLabel')}</span>
                </button>

                {lookupResult.status !== 'Defective' ? (
                  <button
                    type="button"
                    onClick={() => handleChangeSerialStatus(lookupResult.serialNumber, lookupResult.id, 'Defective')}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Wrench size={14} />
                    <span>{getTranslation(lang, 'serialTracking.markDefective')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleChangeSerialStatus(lookupResult.serialNumber, lookupResult.id, 'InStock')}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <RotateCcw size={14} />
                    <span>{getTranslation(lang, 'serialTracking.restoreInStock')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inbound & Outbound details grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3.5 border-t border-border">
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
            { id: 'Defective', label: getTranslation(lang, 'serialTracking.filterDefective') },
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
                <th>{getTranslation(lang, 'ui.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSerials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      lang={lang}
                      icon={<Smartphone size={22} />}
                      title={getTranslation(lang, 'serialTracking.noSerialsFound')}
                    />
                  </td>
                </tr>
              ) : (
                filteredSerials.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono font-bold text-primary" dir="ltr">
                      <button
                        type="button"
                        onClick={() => {
                          setScanInput(s.serialNumber);
                          executeLookup(s.serialNumber);
                        }}
                        className="bg-transparent border-0 p-0 font-mono font-bold text-primary hover:underline cursor-pointer"
                      >
                        {s.serialNumber}
                      </button>
                    </td>
                    <td>
                      <span className="font-semibold text-foreground" dir="auto">{s.productName}</span>
                      {s.productSku && (
                        <span className="block text-[11px] font-mono text-muted-foreground" dir="ltr">{s.productSku}</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        tone={getStatusTone(s.status)}
                        dot
                        label={getStatusTranslation(lang, s.status)}
                      />
                    </td>
                    <td>
                      {s.status === 'Sold' ? (
                        <div>
                          <span className="font-semibold text-foreground" dir="auto">{s.customerName || '—'}</span>
                          {(s.salesInvoiceNo || s.salesInvoiceNumber) && (
                            <span className="block text-[11px] font-mono text-primary" dir="ltr">
                              #{s.salesInvoiceNo || s.salesInvoiceNumber}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground" dir="auto">
                          {s.warehouseName || s.warehouseId}
                        </span>
                      )}
                    </td>
                    <td className="font-mono tabular-nums text-foreground">
                      {s.warrantyMonths > 0
                        ? `${s.warrantyMonths} ${getTranslation(lang, 'serialTracking.monthUnit')}`
                        : getTranslation(lang, 'serialTracking.noWarranty')}
                    </td>
                    <td>{renderWarrantyBadge(s)}</td>
                    <td className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                      {(s.createdAt || '').slice(0, 10)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePrintBarcodeLabel(s)}
                          title={getTranslation(lang, 'serialTracking.printLabel')}
                          className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Printer size={13} />
                        </button>
                        {s.status !== 'Defective' ? (
                          <button
                            type="button"
                            onClick={() => handleChangeSerialStatus(s.serialNumber, s.id, 'Defective')}
                            title={getTranslation(lang, 'serialTracking.markDefective')}
                            className="p-1.5 rounded-lg border border-border bg-background hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            <Wrench size={13} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleChangeSerialStatus(s.serialNumber, s.id, 'InStock')}
                            title={getTranslation(lang, 'serialTracking.restoreInStock')}
                            className="p-1.5 rounded-lg border border-border bg-background hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 cursor-pointer"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Bulk Register Serials */}
      {isRegisterModalOpen && (
        <ModalBackdropPortal onClose={() => setIsRegisterModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
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
                  onChange={e => handleRegProductChange(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                >
                  {selectableProducts.map(p => (
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
                    {getTranslation(lang, 'serialTracking.warrantyMonthsLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={regWarrantyMonths}
                    onChange={e => setRegWarrantyMonths(Math.max(0, Number(e.target.value) || 0))}
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
        </ModalBackdropPortal>
      )}
    </div>
  );
}
