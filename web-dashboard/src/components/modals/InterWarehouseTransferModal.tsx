import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowLeftRight, CheckCircle2, AlertCircle, Info, Barcode, Loader2 } from 'lucide-react';
import { Product, Warehouse } from '../../types/warehouse';
import { getStoredWarehouses, getStoredProductSerials, saveStoredProductSerials } from '../../services/storageService';
import { getAuthToken, isUuid } from '../../services/purchasesService';
import { useTenantFeatures } from '../../hooks/useAuth';
import { getTranslation } from '../../lib/i18n';
import { ModalBackdropPortal } from '../ui/dialog';

interface AvailableSerialOption {
  id: string;
  serialNumber: string;
}

interface InterWarehouseTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  warehouses?: Warehouse[];
  lang?: 'en' | 'ar';
  initialProductId?: string;
  onTransfer: (data: {
    productId: string;
    fromWarehouse: string;
    toWarehouse: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    quantity: number;
    carrier: string;
    reference: string;
    serialIds?: string[];
  }) => void;
}

export default function InterWarehouseTransferModal({
  isOpen,
  onClose,
  products,
  warehouses: warehousesProp,
  lang = 'ar',
  initialProductId,
  onTransfer
}: InterWarehouseTransferModalProps) {
  const isAr = lang === 'ar';
  const { isFeatureEnabled } = useTenantFeatures();
  const isSerialModuleEnabled = isFeatureEnabled('enableSerialNumbers');

  const activeWarehouses = useMemo(() => {
    const list = warehousesProp && warehousesProp.length > 0 ? warehousesProp : getStoredWarehouses();
    return list.filter(w => w && (w as any).isActive !== false);
  }, [warehousesProp, isOpen]);

  const physicalProducts = useMemo(() => products.filter(p => !p.isBundle), [products]);

  const [fromWhId, setFromWhId] = useState('');
  const [toWhId, setToWhId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [carrier, setCarrier] = useState('');
  const [generatedRef, setGeneratedRef] = useState('');
  const [sourceStockMap, setSourceStockMap] = useState<Record<string, number>>({});
  const [availableSerials, setAvailableSerials] = useState<AvailableSerialOption[]>([]);
  const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([]);
  const [isLoadingSerials, setIsLoadingSerials] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize fields cleanly whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    const defaultFrom = activeWarehouses[0]?.id || '';
    const validDestinations = activeWarehouses.filter(w => w.id !== defaultFrom);
    setFromWhId(defaultFrom);
    setToWhId(validDestinations[0]?.id || '');
    const defaultProd =
      initialProductId && physicalProducts.some(p => p.id === initialProductId)
        ? initialProductId
        : physicalProducts[0]?.id || '';
    setSelectedProductId(defaultProd);
    setQty(1);
    setCarrier('');
    setGeneratedRef('');
    setSelectedSerialIds([]);
    setErrorMessage(null);
  }, [isOpen, activeWarehouses, physicalProducts, initialProductId]);

  // Keep destination warehouse strictly distinct from source warehouse
  const destinationWarehouses = useMemo(
    () => activeWarehouses.filter(w => w.id !== fromWhId),
    [activeWarehouses, fromWhId]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (!fromWhId) {
      setToWhId('');
      return;
    }
    if (!destinationWarehouses.some(w => w.id === toWhId)) {
      setToWhId(destinationWarehouses[0]?.id || '');
    }
  }, [isOpen, fromWhId, toWhId, destinationWarehouses]);

  // Fetch source-warehouse-specific stock
  useEffect(() => {
    if (!isOpen || !fromWhId) {
      setSourceStockMap({});
      return;
    }

    let active = true;
    const token = getAuthToken();
    if (token && isUuid(fromWhId)) {
      fetch(`/api/inventory/warehouse-stock?warehouseId=${encodeURIComponent(fromWhId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => (res.ok ? res.json() : null))
        .then(rows => {
          if (!active || !Array.isArray(rows)) return;
          const map: Record<string, number> = {};
          rows.forEach((r: any) => {
            if (r?.productId) map[String(r.productId)] = Math.max(0, Number(r.availableQuantity ?? r.quantity) || 0);
          });
          setSourceStockMap(map);
        })
        .catch(() => {});
    } else {
      const localMap: Record<string, number> = {};
      physicalProducts.forEach(p => {
        localMap[p.id] = !p.warehouseId || p.warehouseId === fromWhId ? Math.max(0, Number(p.currentStock) || 0) : 0;
      });
      setSourceStockMap(localMap);
    }

    return () => {
      active = false;
    };
  }, [isOpen, fromWhId, physicalProducts]);

  const selectedProduct = useMemo(
    () => physicalProducts.find(p => p.id === selectedProductId) || null,
    [physicalProducts, selectedProductId]
  );

  const getProductSourceStock = (product: Product | null): number => {
    if (!product) return 0;
    if (Object.prototype.hasOwnProperty.call(sourceStockMap, product.id)) {
      return sourceStockMap[product.id];
    }
    if (isUuid(fromWhId) && getAuthToken()) {
      return 0;
    }
    return !product.warehouseId || product.warehouseId === fromWhId ? Math.max(0, Number(product.currentStock) || 0) : 0;
  };

  const sourceAvailableStock = getProductSourceStock(selectedProduct);
  const requiresSerialSelection = Boolean(selectedProduct?.requiresSerialNumber && isSerialModuleEnabled);

  // Load InStock serials in SourceWarehouse when serialized item is selected
  useEffect(() => {
    if (!isOpen || !requiresSerialSelection || !selectedProductId || !fromWhId) {
      setAvailableSerials([]);
      setSelectedSerialIds([]);
      return;
    }

    let active = true;
    setSelectedSerialIds([]);
    const token = getAuthToken();

    if (token && isUuid(fromWhId) && isUuid(selectedProductId)) {
      setIsLoadingSerials(true);
      fetch(
        `/api/serial-tracking?productId=${encodeURIComponent(selectedProductId)}&warehouseId=${encodeURIComponent(fromWhId)}&status=InStock&limit=200`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
        .then(res => (res.ok ? res.json() : null))
        .then(json => {
          if (!active) return;
          const rows = Array.isArray(json?.data) ? json.data : [];
          setAvailableSerials(
            rows.map((s: any) => ({
              id: String(s.id),
              serialNumber: String(s.serialNumber)
            }))
          );
        })
        .catch(() => {
          if (active) setAvailableSerials([]);
        })
        .finally(() => {
          if (active) setIsLoadingSerials(false);
        });
    } else {
      const localSerials = getStoredProductSerials()
        .filter(s => s.productId === selectedProductId && s.warehouseId === fromWhId && s.status === 'InStock')
        .map(s => ({ id: s.id, serialNumber: s.serialNumber }));
      setAvailableSerials(localSerials);
    }

    return () => {
      active = false;
    };
  }, [isOpen, requiresSerialSelection, selectedProductId, fromWhId]);

  if (!isOpen) return null;

  const isSingleWarehouse = activeWarehouses.length < 2;

  const resolveErrorText = (code: string) => {
    const candidates = [
      `errors.ERR.INVENTORY.${code}`,
      `errors.ERR.CONCURRENCY.${code}`,
      `errors.${code}`
    ];
    for (const key of candidates) {
      const msg = getTranslation(lang, key, '');
      if (msg) return msg;
    }
    return code;
  };

  const toggleSerial = (serialId: string) => {
    setSelectedSerialIds(prev =>
      prev.includes(serialId) ? prev.filter(id => id !== serialId) : [...prev, serialId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isSingleWarehouse) {
      setErrorMessage(getTranslation(lang, 'inventory.transfer.singleWarehouseWarning'));
      return;
    }

    if (!fromWhId || !toWhId || fromWhId === toWhId) {
      setErrorMessage(resolveErrorText('ERR_SAME_SOURCE_AND_DESTINATION_WAREHOUSE'));
      return;
    }

    if (!selectedProductId || qty <= 0) {
      setErrorMessage(resolveErrorText('ERR_INVALID_QUANTITY'));
      return;
    }

    if (qty > sourceAvailableStock) {
      setErrorMessage(resolveErrorText('ERR_INSUFFICIENT_SOURCE_STOCK'));
      return;
    }

    if (requiresSerialSelection && selectedSerialIds.length !== qty) {
      setErrorMessage(resolveErrorText('ERR_INVALID_SERIAL_FOR_TRANSFER'));
      return;
    }

    const fromWhObj = activeWarehouses.find(w => w.id === fromWhId);
    const toWhObj = activeWarehouses.find(w => w.id === toWhId);
    const fromLabel = fromWhObj ? (isAr ? fromWhObj.nameAr : (fromWhObj.nameEn || fromWhObj.nameAr)) : fromWhId;
    const toLabel = toWhObj ? (isAr ? toWhObj.nameAr : (toWhObj.nameEn || toWhObj.nameAr)) : toWhId;

    setIsSubmitting(true);
    try {
      const token = getAuthToken();
      let finalRef = `TRF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      if (token && isUuid(fromWhId) && isUuid(toWhId) && isUuid(selectedProductId)) {
        const res = await fetch('/api/inventory/transfers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            sourceWarehouseId: fromWhId,
            destinationWarehouseId: toWhId,
            itemId: selectedProductId,
            quantity: Number(qty),
            driverOrResponsibleName: carrier.trim() || null,
            serialIds: requiresSerialSelection ? selectedSerialIds : null
          })
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setErrorMessage(resolveErrorText(json?.errorCode || 'ERR_TRANSFER_FAILED'));
          setIsSubmitting(false);
          return;
        }

        if (json?.referenceNumber) {
          finalRef = String(json.referenceNumber);
          setGeneratedRef(finalRef);
        }
      } else if (requiresSerialSelection && selectedSerialIds.length > 0) {
        const allSerials = getStoredProductSerials();
        const selectedSet = new Set(selectedSerialIds);
        saveStoredProductSerials(
          allSerials.map(s =>
            selectedSet.has(s.id)
              ? { ...s, warehouseId: toWhId, warehouseName: toLabel }
              : s
          )
        );
      }

      onTransfer({
        productId: selectedProductId,
        fromWarehouse: fromLabel,
        toWarehouse: toLabel,
        fromWarehouseId: fromWhId,
        toWarehouseId: toWhId,
        quantity: Number(qty),
        carrier: carrier.trim(),
        reference: finalRef,
        serialIds: requiresSerialSelection ? selectedSerialIds : undefined
      });
      onClose();
    } catch {
      setErrorMessage(resolveErrorText('ERR_TRANSFER_FAILED'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBackdropPortal onClose={() => !isSubmitting && onClose()} dir={isAr ? 'rtl' : 'ltr'}>
      <div
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-foreground"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <ArrowLeftRight size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground m-0">
                {getTranslation(lang, 'inventory.transfer.modalTitle')}
              </h3>
              <p className="text-xs text-muted-foreground m-0 mt-0.5">
                {getTranslation(lang, 'inventory.transfer.modalSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {isSingleWarehouse && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-start gap-2.5">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>{getTranslation(lang, 'inventory.transfer.singleWarehouseWarning')}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Source and Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                {getTranslation(lang, 'inventory.transfer.fromWarehouseLabel')} <span className="text-destructive">*</span>
              </label>
              <select
                value={fromWhId}
                onChange={e => setFromWhId(e.target.value)}
                disabled={activeWarehouses.length === 0}
                className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary cursor-pointer"
              >
                {activeWarehouses.length === 0 ? (
                  <option value="">{getTranslation(lang, 'inventory.transfer.noWarehousesOption')}</option>
                ) : (
                  activeWarehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {isAr ? w.nameAr : (w.nameEn || w.nameAr)}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                {getTranslation(lang, 'inventory.transfer.toWarehouseLabel')} <span className="text-destructive">*</span>
              </label>
              <select
                value={toWhId}
                onChange={e => setToWhId(e.target.value)}
                disabled={destinationWarehouses.length === 0}
                className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary cursor-pointer disabled:opacity-50"
              >
                {destinationWarehouses.length === 0 ? (
                  <option value="">{getTranslation(lang, 'inventory.transfer.noDestinationOption')}</option>
                ) : (
                  destinationWarehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {isAr ? w.nameAr : (w.nameEn || w.nameAr)}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Product Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-foreground">
                {getTranslation(lang, 'inventory.transfer.productLabel')} <span className="text-destructive">*</span>
              </label>
              {selectedProduct && (
                <span
                  className={`text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-md border ${
                    sourceAvailableStock > 0
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  {getTranslation(lang, 'inventory.transfer.sourceStockBadge').replace('{qty}', String(sourceAvailableStock))}
                </span>
              )}
            </div>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary cursor-pointer"
            >
              {physicalProducts.map(p => {
                const whStock = getProductSourceStock(p);
                return (
                  <option key={p.id} value={p.id}>
                    {p.sku} - {isAr ? p.nameAr : (p.nameEn || p.nameAr)} ({getTranslation(lang, 'inventory.transfer.sourceStockShort')}: {whStock})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Quantity and Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                {getTranslation(lang, 'inventory.transfer.quantityLabel')} <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={Math.max(1, sourceAvailableStock)}
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground font-mono tabular-nums font-bold text-xs outline-none focus:border-primary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                {getTranslation(lang, 'inventory.transfer.unitLabel')}
              </label>
              <input
                type="text"
                value={selectedProduct?.unit || getTranslation(lang, 'inventory.transfer.defaultUnit')}
                readOnly
                className="h-9 w-full px-3 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-medium outline-none"
              />
            </div>
          </div>

          {/* Conditional Serial Selector */}
          {requiresSerialSelection && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-foreground inline-flex items-center gap-1.5">
                  <Barcode size={14} className="text-primary" />
                  <span>{getTranslation(lang, 'inventory.transfer.selectSerialsLabel')}</span>
                </span>
                <span
                  className={`font-mono tabular-nums text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    selectedSerialIds.length === qty
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {selectedSerialIds.length} / {qty}
                </span>
              </div>

              {isLoadingSerials ? (
                <div className="py-3 text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
                  <Loader2 size={14} className="animate-spin" />
                  <span>{getTranslation(lang, 'common.loading')}</span>
                </div>
              ) : availableSerials.length === 0 ? (
                <div className="py-2 text-xs text-destructive font-medium">
                  {getTranslation(lang, 'inventory.transfer.noSerialsInSource')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                  {availableSerials.map(serial => {
                    const checked = selectedSerialIds.includes(serial.id);
                    return (
                      <label
                        key={serial.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono cursor-pointer transition-colors ${
                          checked
                            ? 'bg-primary/10 border-primary text-foreground font-bold'
                            : 'bg-card border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSerial(serial.id)}
                          className="accent-primary"
                        />
                        <span className="truncate" dir="ltr">{serial.serialNumber}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Carrier and Auto-generated Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                {getTranslation(lang, 'inventory.transfer.driverLabel')}
              </label>
              <input
                type="text"
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
                placeholder={getTranslation(lang, 'inventory.transfer.driverPlaceholder')}
                className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                {getTranslation(lang, 'inventory.transfer.referenceLabel')}
              </label>
              <div
                dir="ltr"
                className="h-9 w-full px-3 rounded-lg border border-border bg-muted/60 text-muted-foreground font-mono tabular-nums text-xs flex items-center justify-between"
              >
                <span className="truncate">
                  {generatedRef || getTranslation(lang, 'inventory.transfer.autoGeneratedRef')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold cursor-pointer"
            >
              {getTranslation(lang, 'actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSingleWarehouse || isSubmitting || sourceAvailableStock <= 0}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer transition-colors shadow-sm"
            >
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              <span>{getTranslation(lang, 'inventory.transfer.confirmBtn')}</span>
            </button>
          </div>
        </form>
      </div>
    </ModalBackdropPortal>
  );
}
