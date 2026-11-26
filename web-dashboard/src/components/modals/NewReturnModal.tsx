"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  RotateCcw, 
  CheckCircle2, 
  FileText, 
  AlertTriangle, 
  User, 
  Phone,
  Hash, 
  Package,
  Clock,
  Barcode,
  Layers,
  Search,
  Check,
  Lock,
  Info,
  Warehouse as WarehouseIcon
} from 'lucide-react';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  getStoredInvoices, 
  getStoredWarehouses,
  getInvoiceReturnableItems, 
  ReturnableInvoiceItem,
  validateRmaReturn
} from '../../services/storageService';
import { useSettings } from '../../context/settings-context';
import { getCurrencySymbol } from '../../lib/currencyUtils';
import { getTranslation } from '../../lib/i18n';
import { localizeWarehouse } from '../../lib/localeHelpers';
import { SalesInvoice, Warehouse } from '../../types/warehouse';

export interface ReturnRequestData {
  id: string;
  backendRmaId?: string;
  rmaNumber: string;
  originalInvoiceNo: string;
  customerName: string;
  customerPhone: string;
  productId?: string;
  productName: string;
  sku: string;
  serialNumber: string;
  warehouseId?: string;
  warehouseName?: string;
  returnReason: string;
  warrantyStatus: 'VALID_UNDER_WARRANTY' | 'EXPIRED' | 'VOID_PHYSICAL_DAMAGE';
  decision: 'PENDING_INSPECTION' | 'APPROVED_RESTOCKED' | 'SENT_TO_MAINTENANCE' | 'REJECTED';
  isRestocked?: boolean;
  returnQuantity: number;
  refundAmount: number;
  currency: string;
  date: string;
}

interface NewReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
  warehouses?: Warehouse[];
  onSubmit: (data: ReturnRequestData) => void | Promise<void>;
}

export default function NewReturnModal({
  isOpen,
  onClose,
  lang = 'ar',
  warehouses: propWarehouses,
  onSubmit
}: NewReturnModalProps) {
  if (!isOpen) return null;
  const isAr = lang === 'ar';
  const tr = (key: string, fallback?: string) => getTranslation(lang, `ui.rma.${key}`, fallback);
  const { financialSettings, formatMoney } = useSettings();
  const defaultCurrencySymbol = financialSettings.baseCurrency.symbol;

  const invoices = getStoredInvoices();
  const availableWarehouses = useMemo(() => {
    const list = propWarehouses && propWarehouses.length > 0 ? propWarehouses : getStoredWarehouses();
    return list.filter(w => (w as any).isActive !== false && w.status !== 'maintenance');
  }, [propWarehouses]);

  // RMA Identification
  const [rmaNumber, setRmaNumber] = useState(() => `RMA-${Math.floor(10000 + Math.random() * 90000)}`);
  
  // Invoice Selection & Combobox State
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [isInvoiceComboboxOpen, setIsInvoiceComboboxOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');

  // Target Warehouse Selection (Pre-filled from Invoice)
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>(() => availableWarehouses[0]?.id || '');

  // Customer Details (Strictly Read-Only from Invoice)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Cascade Item Selection (Strictly from Invoice Returnables)
  const [returnableItems, setReturnableItems] = useState<ReturnableInvoiceItem[]>([]);
  const [selectedItemSku, setSelectedItemSku] = useState('');
  const [selectedItem, setSelectedItem] = useState<ReturnableInvoiceItem | null>(null);
  const [serialNumber, setSerialNumber] = useState('');
  const [returnQuantity, setReturnQuantity] = useState<number>(1);
  const [refundAmount, setRefundAmount] = useState<number>(0);

  // Warranty & Operational Decision
  const [warrantyStatus, setWarrantyStatus] = useState<'VALID_UNDER_WARRANTY' | 'EXPIRED' | 'VOID_PHYSICAL_DAMAGE'>('VALID_UNDER_WARRANTY');
  const [decision, setDecision] = useState<'PENDING_INSPECTION' | 'APPROVED_RESTOCKED' | 'SENT_TO_MAINTENANCE' | 'REJECTED'>('APPROVED_RESTOCKED');
  const [returnReason, setReturnReason] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const comboboxRef = useRef<HTMLDivElement>(null);

  // Close combobox on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsInvoiceComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filtered invoices for the Combobox search
  const filteredInvoices = useMemo(() => {
    if (!invoiceSearchQuery.trim()) {
      return invoices.slice(0, 10);
    }
    const q = invoiceSearchQuery.toLowerCase().trim();
    return invoices.filter(inv => 
      inv.invoiceNo.toLowerCase().includes(q) ||
      (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
      (inv.customerPhone && inv.customerPhone.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [invoices, invoiceSearchQuery]);

  // Choose invoice from Combobox
  const handleSelectInvoice = (inv: SalesInvoice) => {
    setSelectedInvoice(inv);
    setSelectedInvoiceNo(inv.invoiceNo);
    setInvoiceSearchQuery(`${inv.invoiceNo} — ${inv.customerName || tr('cashCustomerFallback')}`);
    setIsInvoiceComboboxOpen(false);
    setFormError('');

    // Auto-fill customer details as Read-Only
    setCustomerName(inv.customerName || tr('cashCustomerFallback'));
    setCustomerPhone(inv.customerPhone && inv.customerPhone !== '—' ? inv.customerPhone : '0770xxxxxxx');

    // Auto-fill target restock warehouse from original Sales Invoice
    const matchedWh = availableWarehouses.find(
      w =>
        w.nameAr === inv.warehouseName ||
        w.nameEn === inv.warehouseName ||
        w.id === inv.warehouseName ||
        w.code === inv.warehouseName
    );
    if (matchedWh) {
      setTargetWarehouseId(matchedWh.id);
    } else if (availableWarehouses.length > 0 && !targetWarehouseId) {
      setTargetWarehouseId(availableWarehouses[0].id);
    }

    // Load returnables strictly from this invoice
    const items = getInvoiceReturnableItems(inv.invoiceNo);
    setReturnableItems(items);

    // If only one returnable item with available quota exists, auto-select it
    const availableItems = items.filter(it => it.remainingReturnableQty > 0);
    if (availableItems.length === 1) {
      applySelectedItem(availableItems[0]);
    } else {
      setSelectedItemSku('');
      setSelectedItem(null);
      setSerialNumber('');
      setReturnQuantity(1);
      setRefundAmount(0);
    }
  };

  // Select item from returnable items dropdown
  const applySelectedItem = (item: ReturnableInvoiceItem) => {
    setSelectedItem(item);
    setSelectedItemSku(item.sku);
    const soldList = item.soldSerialNumbers || [];
    setSerialNumber(soldList[0] || (!item.requiresSerialNumber ? (item.serialNumber || '') : ''));
    setReturnQuantity(1);
    setRefundAmount(item.unitPrice * 1);
    if (item.warehouseId && availableWarehouses.some(w => w.id === item.warehouseId)) {
      setTargetWarehouseId(item.warehouseId);
    }
    
    // Auto-calculate statutory warranty status based on invoice purchase date
    setWarrantyStatus(item.isUnderWarranty ? 'VALID_UNDER_WARRANTY' : 'EXPIRED');
    setFormError('');
  };

  const handleProductChange = (sku: string) => {
    if (!sku) {
      setSelectedItemSku('');
      setSelectedItem(null);
      setSerialNumber('');
      setReturnQuantity(1);
      setRefundAmount(0);
      return;
    }

    const matched = returnableItems.find(it => it.sku === sku);
    if (matched) {
      applySelectedItem(matched);
    }
  };

  // Handle return quantity change with quota clamping
  const handleQuantityChange = (newQty: number) => {
    if (!selectedItem) return;
    const maxAllowed = selectedItem.remainingReturnableQty;
    const clamped = Math.max(1, Math.min(newQty, maxAllowed));
    setReturnQuantity(clamped);
    setRefundAmount(clamped * selectedItem.unitPrice);
  };

  // Determine active currency symbol from invoice item
  const activeCurrencySymbol = useMemo(() => {
    if (selectedItem?.currency) {
      return getCurrencySymbol(selectedItem.currency, isAr);
    }
    return defaultCurrencySymbol;
  }, [selectedItem, defaultCurrencySymbol, isAr]);

  const resolvedTargetWarehouse = useMemo(() => {
    return availableWarehouses.find(w => w.id === targetWarehouseId) || availableWarehouses[0];
  }, [availableWarehouses, targetWarehouseId]);

  // Strict Form Validation
  const isFormValid = Boolean(
    selectedInvoiceNo &&
    selectedItem &&
    (resolvedTargetWarehouse?.id || selectedInvoice?.warehouseName) &&
    returnQuantity > 0 &&
    returnQuantity <= (selectedItem?.remainingReturnableQty || 0) &&
    selectedItem.remainingReturnableQty > 0 &&
    customerName.trim()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedInvoiceNo) {
      setFormError(tr('errNoInvoice'));
      return;
    }

    if (!selectedItem || !selectedItemSku) {
      setFormError(tr('errNoItem'));
      return;
    }

    if (!resolvedTargetWarehouse?.id && !selectedInvoice?.warehouseName) {
      setFormError(tr('errNoWarehouse'));
      return;
    }

    if (returnQuantity <= 0) {
      setFormError(tr('errQtyZero'));
      return;
    }

    if (returnQuantity > selectedItem.remainingReturnableQty) {
      setFormError(
        tr('errQtyExceeded')
          .replace('{qty}', String(returnQuantity))
          .replace('{max}', String(selectedItem.remainingReturnableQty))
      );
      return;
    }

    const soldSerials = selectedItem.soldSerialNumbers || [];
    const trimmedSerial = serialNumber.trim();
    if (selectedItem.requiresSerialNumber || soldSerials.length > 0) {
      if (!trimmedSerial) {
        setFormError(getTranslation(lang, 'errors.ERR_SERIAL_NOT_FOUND_FOR_RETURN'));
        return;
      }
      if (soldSerials.length > 0 && !soldSerials.some(sn => sn.toLowerCase() === trimmedSerial.toLowerCase())) {
        setFormError(getTranslation(lang, 'errors.ERR_SERIAL_NOT_FOUND_FOR_RETURN'));
        return;
      }
    }

    // Call storage validation rule
    const val = validateRmaReturn(selectedInvoiceNo, selectedItemSku, returnQuantity);
    if (!val.isValid) {
      setFormError(val.message || tr('errNoItem'));
      return;
    }

    const payload: ReturnRequestData = {
      id: `RMA-${Date.now()}`,
      rmaNumber: rmaNumber.trim(),
      originalInvoiceNo: selectedInvoiceNo,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || '—',
      productId: selectedItem.productId,
      productName: selectedItem.productName,
      sku: selectedItem.sku,
      serialNumber: serialNumber.trim() || 'N/A',
      warehouseId: resolvedTargetWarehouse?.id,
      warehouseName: resolvedTargetWarehouse
        ? localizeWarehouse(resolvedTargetWarehouse.nameAr, lang)
        : (selectedInvoice?.warehouseName || tr('unassignedWarehouse')),
      returnReason: returnReason.trim() || tr('defaultReturnReason'),
      warrantyStatus,
      decision,
      isRestocked: decision === 'APPROVED_RESTOCKED',
      returnQuantity,
      refundAmount: Number(refundAmount) || 0,
      currency: selectedItem.currency || 'IQD',
      date: new Date().toISOString().split('T')[0]
    };

    try {
      setIsSubmitting(true);
      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent
        className="w-full max-w-4xl bg-card border border-border/80 shadow-2xl rounded-2xl p-0 text-foreground overflow-hidden flex flex-col my-auto"
        style={{
          maxWidth: '920px',
          width: '95%',
          maxHeight: '92vh',
          padding: 0,
          borderRadius: '1.25rem',
          backgroundColor: 'var(--card)',
          color: 'var(--foreground)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)'
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-7 py-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-bold text-foreground m-0 leading-tight">
                  {tr('modalTitle')}
                </h3>
                <span 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20 tracking-wider"
                  dir="ltr"
                >
                  {rmaNumber}
                </span>
              </div>
              <p className="text-xs text-muted-foreground m-0 mt-1 leading-normal">
                {tr('modalSubtitle')}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            title={tr('closeBtn')}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Spacious, Harmonious Form Body */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 overflow-hidden">
          {/* Dummy input to catch browser autofill */}
          <input type="text" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
          
          <div className="p-6 overflow-y-auto max-h-[calc(92vh-130px)] space-y-4">
            {/* Error Notification */}
            {formError && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* SECTION 1: Original Invoice, Target Warehouse & Customer Info */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground/90">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>{tr('sectionInvoiceTitle')}</span>
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                  <Lock className="w-3 h-3 text-muted-foreground/80" />
                  <span>{tr('customerLockedNote')}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Original Invoice Searchable Combobox */}
                <div className="space-y-1.5 relative" ref={comboboxRef}>
                  <Label htmlFor="rma-invoice-combobox" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                    <span>{tr('invoiceLabel')} *</span>
                    <span className="text-[10px] text-primary font-bold">
                      {tr('fastCombobox')}
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="rma-invoice-combobox"
                      type="text"
                      value={invoiceSearchQuery}
                      onChange={(e) => {
                        setInvoiceSearchQuery(e.target.value);
                        setIsInvoiceComboboxOpen(true);
                      }}
                      onFocus={() => setIsInvoiceComboboxOpen(true)}
                      placeholder={tr('invoicePlaceholder')}
                      className="h-10.5 bg-background border-border/80 px-3.5 pe-10 text-xs sm:text-sm font-medium"
                    />
                    <Search className="w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>

                  {/* Dropdown Suggestions Menu */}
                  {isInvoiceComboboxOpen && (
                    <div 
                      className="absolute z-50 top-full mt-1.5 w-full bg-card border border-border shadow-xl rounded-xl max-h-56 overflow-y-auto p-1.5 divide-y divide-border/40"
                    >
                      {filteredInvoices.length > 0 ? (
                        filteredInvoices.map((inv) => (
                          <div
                            key={inv.id}
                            onClick={() => handleSelectInvoice(inv)}
                            className={`p-2.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between hover:bg-muted/60 ${
                              selectedInvoiceNo === inv.invoiceNo ? 'bg-primary/10 text-primary font-bold' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-foreground" dir="ltr">{inv.invoiceNo}</span>
                                <span className="text-[10px] text-muted-foreground">{inv.date}</span>
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                <span>{inv.customerName || tr('cashCustomerFallback')}</span>
                                {inv.customerPhone && <span className="mx-1.5" dir="ltr">({inv.customerPhone})</span>}
                              </div>
                            </div>
                            <div className="text-end shrink-0 ps-2">
                              <span className="text-xs font-bold text-foreground font-mono">
                                {formatMoney(inv.total)}
                              </span>
                              <span className="block text-[10px] text-muted-foreground">
                                {inv.items ? `${inv.items.length} ${tr('itemsWord')}` : tr('saleWord')}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          {tr('noInvoicesFound')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. RMA Number (Auto-Generated Unique Identifier) */}
                <div className="space-y-1.5">
                  <Label htmlFor="rma-code" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                    <span>{tr('rmaNumberLabel')} *</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {tr('authorizedToken')}
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="rma-code"
                      value={rmaNumber}
                      onChange={(e) => setRmaNumber(e.target.value)}
                      required
                      dir="ltr"
                      className="font-mono font-bold tracking-wider h-10.5 bg-muted/30 border-border/80 text-foreground px-3.5 pe-10 text-xs sm:text-sm"
                    />
                    <Hash className="w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* 3. Customer Name (Strictly Read-Only) */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-foreground/90 block">
                    {tr('customerNameLabel')} *
                  </span>
                  <div className="relative">
                    <Input
                      value={customerName}
                      readOnly
                      placeholder={tr('customerNamePlaceholder')}
                      className="h-10.5 bg-muted/40 border-border/80 px-3.5 pe-10 text-xs sm:text-sm text-foreground font-medium cursor-not-allowed"
                    />
                    <User className="w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                  </div>
                </div>

                {/* 4. Customer Phone (Strictly Read-Only, dir="ltr") */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-foreground/90 block">
                    {tr('customerPhoneLabel')}
                  </span>
                  <div className="relative">
                    <Input
                      value={customerPhone}
                      readOnly
                      dir="ltr"
                      placeholder="—"
                      className="font-mono h-10.5 bg-muted/40 border-border/80 px-3.5 pe-10 text-xs sm:text-sm text-foreground cursor-not-allowed"
                    />
                    <Phone className="w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                  </div>
                </div>

                {/* 5. Target Restock Warehouse (Pre-filled from Invoice) */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rma-warehouse-select" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <WarehouseIcon className="w-3.5 h-3.5 text-primary" />
                      <span>{tr('targetWarehouseLabel')} *</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {tr('targetWarehouseHint')}
                    </span>
                  </Label>
                  <select
                    id="rma-warehouse-select"
                    value={targetWarehouseId}
                    onChange={(e) => setTargetWarehouseId(e.target.value)}
                    className="flex h-10.5 w-full rounded-lg border border-border/80 bg-background px-3.5 py-2 text-xs sm:text-sm font-semibold text-foreground shadow-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                  >
                    {availableWarehouses.length === 0 ? (
                      <option value="">{tr('selectWarehousePlaceholder')}</option>
                    ) : (
                      availableWarehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>
                          {localizeWarehouse(wh.nameAr, lang)} ({wh.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 2: Cascade Product Selection & Warranty Valuation */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground/90">
                  <Package className="w-4 h-4 text-primary" />
                  <span>{tr('sectionItemTitle')}</span>
                </div>
                {selectedItem && (
                  <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    {tr('availableToReturnBadge').replace('{qty}', String(selectedItem.remainingReturnableQty))}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Cascade Line Item Selector */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rma-product-select" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                    <span>{tr('selectProductLabel')} *</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {selectedInvoiceNo ? tr('filteredToInvoice') : tr('selectInvoiceFirstHint')}
                    </span>
                  </Label>
                  <select
                    id="rma-product-select"
                    value={selectedItemSku}
                    disabled={!selectedInvoiceNo || returnableItems.length === 0}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="flex h-10.5 w-full rounded-lg border border-border/80 bg-background px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground shadow-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!selectedInvoiceNo 
                        ? tr('selectInvoiceOptionPlaceholder')
                        : returnableItems.length === 0
                        ? tr('noReturnablesOption')
                        : tr('chooseReturnItemOption')}
                    </option>
                    {returnableItems.map((it) => (
                      <option 
                        key={it.itemId} 
                        value={it.sku}
                        disabled={it.remainingReturnableQty <= 0}
                      >
                        {it.productName} — [{it.sku}] 
                        {it.remainingReturnableQty > 0 
                          ? ` (${tr('availableToReturnBadge').replace('{qty}', String(it.remainingReturnableQty))}) — ${it.unitPrice.toLocaleString()} ${activeCurrencySymbol}`
                          : tr('alreadyFullyReturnedOption')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Return Quantity with Quota Validation */}
                <div className="space-y-1.5">
                  <Label htmlFor="rma-qty" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                    <span>{tr('returnQtyLabel')} *</span>
                    {selectedItem && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {tr('maxLabel').replace('{qty}', String(selectedItem.remainingReturnableQty))}
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="rma-qty"
                      type="number"
                      min={1}
                      max={selectedItem?.remainingReturnableQty || 1}
                      value={returnQuantity}
                      disabled={!selectedItem || selectedItem.remainingReturnableQty <= 0}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                      required
                      className="font-mono font-bold text-xs sm:text-sm h-10.5 bg-background border-border/80 px-3.5 pe-10 disabled:opacity-50"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                      {tr('pcsUnit')}
                    </span>
                  </div>
                </div>

                {/* 3. Refund Amount (Computed: Qty × Unit Price with Invoice Currency) */}
                <div className="space-y-1.5">
                  <Label htmlFor="rma-amount" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                    <span>{tr('estimatedRefundLabel')} *</span>
                    <span className="text-xs text-primary font-bold">
                      {activeCurrencySymbol}
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="rma-amount"
                      type="text"
                      readOnly
                      value={refundAmount.toLocaleString()}
                      className="font-mono font-bold text-xs sm:text-sm h-10.5 bg-muted/40 border-border/80 text-foreground px-3.5 pe-14 cursor-not-allowed"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary pointer-events-none">
                      {activeCurrencySymbol}
                    </span>
                  </div>
                </div>

                {/* 4. Serial Number (S/N) */}
                <div className="space-y-1.5">
                  <Label htmlFor="rma-serial" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                    <span>{tr('serialLabel')} {selectedItem?.requiresSerialNumber ? '*' : ''}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      IMEI / SN
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="rma-serial"
                      value={serialNumber}
                      onChange={(e) => {
                        setSerialNumber(e.target.value);
                        setFormError('');
                      }}
                      required={Boolean(selectedItem?.requiresSerialNumber)}
                      dir="ltr"
                      placeholder={
                        selectedItem?.requiresSerialNumber
                          ? getTranslation(lang, 'serialTracking.selectOrScanReturnSerial')
                          : 'SN-XXXXXXX'
                      }
                      className="font-mono font-semibold h-10.5 bg-background border-border/80 px-3.5 pe-10 uppercase text-xs sm:text-sm"
                    />
                    <Barcode className="w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                  {selectedItem?.soldSerialNumbers && selectedItem.soldSerialNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1" dir="ltr">
                      {selectedItem.soldSerialNumbers.map(sn => (
                        <button
                          key={sn}
                          type="button"
                          onClick={() => {
                            setSerialNumber(sn);
                            setFormError('');
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border cursor-pointer transition-colors ${
                            serialNumber.trim().toLowerCase() === sn.toLowerCase()
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/50 text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {sn}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Automated Warranty Validity Status */}
                <div className="space-y-1.5">
                  <Label htmlFor="rma-warranty" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                    <span>{tr('warrantyLabel')} *</span>
                    <span className="text-[10px] text-muted-foreground">
                      {tr('warrantyAutoNote')}
                    </span>
                  </Label>
                  <select
                    id="rma-warranty"
                    value={warrantyStatus}
                    onChange={(e) => setWarrantyStatus(e.target.value as any)}
                    className="flex h-10.5 w-full rounded-lg border border-border/80 bg-background px-3.5 py-2 text-xs sm:text-sm font-semibold text-foreground shadow-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                  >
                    <option value="VALID_UNDER_WARRANTY">
                      {tr('warrantyOptValid')}
                    </option>
                    <option value="EXPIRED">
                      {tr('warrantyOptExpired')}
                    </option>
                    <option value="VOID_PHYSICAL_DAMAGE">
                      {tr('warrantyOptVoid')}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 3: Return Reason & Operational Decision (Balanced 2-Column Split) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Return Reason Textarea */}
              <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2.5 shadow-2xs flex flex-col">
                <Label htmlFor="rma-reason" className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5 pb-2 border-b border-border/50">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>{tr('reasonLabel')} *</span>
                </Label>
                <textarea
                  id="rma-reason"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  required
                  placeholder={tr('reasonPlaceholder')}
                  className="w-full flex-1 min-h-[96px] rounded-lg border border-border/80 bg-background p-3 text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none shadow-xs"
                />
              </div>

              {/* Operational Decision Workflow */}
              <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2.5 shadow-2xs flex flex-col">
                <div className="flex items-center justify-between text-xs font-bold text-foreground/90 pb-2 border-b border-border/50">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary" />
                    <span>{tr('decisionSectionTitle')}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {tr('selectWorkflowHint')}
                  </span>
                </div>

                <div className="flex flex-col gap-2 flex-1 justify-center">
                  {/* Option 1: Pending Inspection */}
                  <div
                    onClick={() => setDecision('PENDING_INSPECTION')}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex items-center gap-3 select-none ${
                      decision === 'PENDING_INSPECTION'
                        ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20 shadow-xs'
                        : 'border-border/80 hover:border-border hover:bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        decision === 'PENDING_INSPECTION'
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/40'
                      }`}
                    >
                      {decision === 'PENDING_INSPECTION' && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                          {tr('decisionPendingTitle')}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                        {tr('decisionPendingDesc')}
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Immediate Restock & Credit */}
                  <div
                    onClick={() => setDecision('APPROVED_RESTOCKED')}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex items-center gap-3 select-none ${
                      decision === 'APPROVED_RESTOCKED'
                        ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/20 shadow-xs'
                        : 'border-border/80 hover:border-border hover:bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        decision === 'APPROVED_RESTOCKED'
                          ? 'border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500'
                          : 'border-muted-foreground/40'
                      }`}
                    >
                      {decision === 'APPROVED_RESTOCKED' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                          {tr('decisionRestockTitle')}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                        {tr('decisionRestockDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Action Footer */}
          <div className="flex items-center justify-between px-7 py-4 border-t border-border bg-muted/30 shrink-0">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              {!isFormValid && (
                <>
                  <Info className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {!selectedInvoiceNo 
                      ? tr('footerSelectInvoice')
                      : !selectedItem 
                      ? tr('footerSelectItem')
                      : tr('footerCheckQty')}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-10 px-5 text-xs sm:text-sm font-semibold rounded-lg"
              >
                {tr('cancelBtn')}
              </Button>

              <Button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className={`h-10 px-6 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm flex items-center gap-2 rounded-lg transition-all ${
                  isFormValid && !isSubmitting
                    ? 'bg-primary hover:bg-primary/90 cursor-pointer' 
                    : 'bg-muted-foreground/30 text-muted-foreground cursor-not-allowed opacity-60'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? tr('processingBtn') : tr('submitBtn')}</span>
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  );
}
