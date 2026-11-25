import React, { useState, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Warehouse as WarehouseIcon,
  Calendar,
  Coins,
  CreditCard,
  Banknote,
  Loader2,
  FileText,
  PackagePlus,
  Check
} from 'lucide-react';
import { Product, Warehouse } from '../../types/warehouse';
import { PurchaseInvoice, PurchaseInvoiceItem } from '../../types/purchases';
import {
  getStoredSuppliers,
  createSupplier,
  executePurchaseInvoiceTransaction,
  getStoredTreasuryAccounts,
  PurchaseInvoiceTransactionResult
} from '../../services/storageService';
import { getTranslation } from '../../lib/i18n';
import { OcrReviewSessionData } from './PurchaseOcrUploadModal';

interface EditableOcrItem {
  id: string;
  rawItemName: string;
  matchedProductId: string | null;
  isNewProduct: boolean;
  sku: string;
  barcode: string;
  name: string;
  uom: string;
  quantity: number;
  unitCostPrice: number;
  sellingPrice: number;
  lineTotal: number;
  matchConfidence: 'High' | 'Low' | 'None';
  warehouseStock: number;
}

interface PurchaseOcrReviewWorkspaceProps {
  lang: 'ar' | 'en';
  session: OcrReviewSessionData;
  products: Product[];
  warehouses: Warehouse[];
  onPosted: (result: PurchaseInvoiceTransactionResult) => void;
  onCancel: () => void;
}

export default function PurchaseOcrReviewWorkspace({
  lang,
  session,
  products,
  warehouses,
  onPosted,
  onCancel
}: PurchaseOcrReviewWorkspaceProps) {
  const isAr = lang === 'ar';
  const tr = (k: string) => getTranslation(lang, `ui.purchaseOcr.${k}`);
  const { extracted, fileUrl, mimeType, fileName } = session;

  // Panel 1 Viewer controls
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  // Panel 2 Editable Form State
  const suppliers = useMemo(() => getStoredSuppliers(), []);
  const treasuryAccounts = useMemo(() => getStoredTreasuryAccounts(), []);
  const nonBundleProducts = useMemo(() => products.filter(p => !p.isBundle), [products]);

  const [createNewSupplier, setCreateNewSupplier] = useState<boolean>(
    !extracted.matchedSupplierId && Boolean(extracted.supplierName?.trim())
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    extracted.matchedSupplierId || suppliers[0]?.id || ''
  );
  const [newSupplierName, setNewSupplierName] = useState<string>(extracted.supplierName || '');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');

  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>(
    extracted.supplierInvoiceNumber || ''
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    extracted.invoiceDate || new Date().toISOString().split('T')[0]
  );
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>(
    warehouses[0]?.id || 'WH-01'
  );
  const [currency, setCurrency] = useState<'IQD' | 'USD'>(
    extracted.currency?.toUpperCase() === 'USD' ? 'USD' : 'IQD'
  );
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [treasuryAccountId, setTreasuryAccountId] = useState<string>(
    treasuryAccounts.find(a => a.id === 'ACC-01' || a.type === 'CASH')?.id || treasuryAccounts[0]?.id || 'ACC-01'
  );
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(
    Number(extracted.invoiceDiscount) || 0
  );

  const [items, setItems] = useState<EditableOcrItem[]>(() =>
    (extracted.items || []).map((it, idx) => {
      const qty = Number(it.quantity) || 1;
      const cost = Number(it.unitCostPrice) || 0;
      const matched = it.matchedProductId
        ? nonBundleProducts.find(p => p.id === it.matchedProductId)
        : null;
      return {
        id: `OCR-IT-${Date.now()}-${idx}`,
        rawItemName: it.rawItemName,
        matchedProductId: it.matchedProductId || null,
        isNewProduct: !it.matchedProductId,
        sku: matched?.sku || it.matchedProductSku || it.barcodeOrSku || `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`,
        barcode: matched?.barcode || it.matchedProductBarcode || it.barcodeOrSku || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
        name: matched ? (isAr ? matched.nameAr : (matched.nameEn || matched.nameAr)) : it.rawItemName,
        uom: matched?.unit || it.unitOfMeasure || (isAr ? 'قطعة' : 'Piece'),
        quantity: qty,
        unitCostPrice: cost,
        sellingPrice: matched ? Number(matched.sellingPrice) || 0 : Number((cost * 1.25).toFixed(4)),
        lineTotal: it.lineTotal > 0 ? Number(it.lineTotal) : Number((qty * cost).toFixed(4)),
        matchConfidence: it.matchConfidence || (matched ? 'High' : 'None'),
        warehouseStock: matched ? Number(matched.currentStock) || 0 : (Number(it.warehouseStock) || 0)
      };
    })
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.lineTotal) || 0), 0),
    [items]
  );
  const netTotal = Math.max(0, Number((subtotal - (Number(invoiceDiscount) || 0)).toFixed(4)));
  const amountPaid = paymentMethod === 'cash' ? netTotal : 0;
  const balanceDue = paymentMethod === 'credit' ? netTotal : 0;

  const updateItem = (rowIdx: number, patch: Partial<EditableOcrItem>) => {
    setItems(prev =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        const next = { ...row, ...patch };
        if ('quantity' in patch || 'unitCostPrice' in patch) {
          next.lineTotal = Number(((Number(next.quantity) || 0) * (Number(next.unitCostPrice) || 0)).toFixed(4));
        }
        return next;
      })
    );
  };

  const handleSelectCatalogProduct = (rowIdx: number, prodId: string) => {
    if (!prodId) {
      updateItem(rowIdx, {
        matchedProductId: null,
        isNewProduct: true,
        matchConfidence: 'None',
        warehouseStock: 0
      });
      return;
    }
    const prod = nonBundleProducts.find(p => p.id === prodId);
    if (!prod) return;
    updateItem(rowIdx, {
      matchedProductId: prod.id,
      isNewProduct: false,
      name: isAr ? prod.nameAr : (prod.nameEn || prod.nameAr),
      sku: prod.sku,
      barcode: prod.barcode || '',
      uom: prod.unit || (isAr ? 'قطعة' : 'Piece'),
      sellingPrice: Number(prod.sellingPrice) || 0,
      matchConfidence: 'High',
      warehouseStock: Number(prod.currentStock) || 0
    });
  };

  const handleAddEmptyRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `OCR-IT-${Date.now()}-${prev.length + 1}`,
        rawItemName: '',
        matchedProductId: null,
        isNewProduct: true,
        sku: `SKU-${Date.now().toString().slice(-4)}-${prev.length + 1}`,
        barcode: `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
        name: '',
        uom: isAr ? 'قطعة' : 'Piece',
        quantity: 1,
        unitCostPrice: 0,
        sellingPrice: 0,
        lineTotal: 0,
        matchConfidence: 'None',
        warehouseStock: 0
      }
    ]);
  };

  const handleConfirmAndPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!supplierInvoiceNumber.trim()) {
      setErrorMessage(tr('errSupplierRefRequired'));
      return;
    }

    if (createNewSupplier && !newSupplierName.trim()) {
      setErrorMessage(tr('errSupplierRequired'));
      return;
    }

    if (!createNewSupplier && !selectedSupplierId) {
      setErrorMessage(tr('errSupplierRequired'));
      return;
    }

    const validRows = items.filter(it => it.name.trim() && it.quantity > 0 && it.unitCostPrice >= 0);
    if (validRows.length === 0) {
      setErrorMessage(tr('errNoValidItems'));
      return;
    }

    setIsPosting(true);
    try {
      const targetWh = warehouses.find(w => w.id === targetWarehouseId) || warehouses[0];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('zilox_auth_token') || localStorage.getItem('logistock_erp_jwt_token'))
        : null;

      // 1. Submit to standard Purchase Invoice ACID Backend API if online with warehouse UUID
      if (token && targetWh && uuidRegex.test(targetWh.id)) {
        const res = await fetch('/api/purchases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            supplierId: (!createNewSupplier && uuidRegex.test(selectedSupplierId)) ? selectedSupplierId : null,
            newSupplierName: createNewSupplier ? newSupplierName.trim() : null,
            newSupplierPhone: createNewSupplier ? newSupplierPhone.trim() : null,
            supplierRefNo: supplierInvoiceNumber.trim(),
            invoiceDate: new Date(invoiceDate).toISOString(),
            targetWarehouseId: targetWh.id,
            paymentTerms: paymentMethod === 'cash' ? 'CASH' : 'CREDIT',
            currency,
            subtotal,
            discountAmount: Number(invoiceDiscount) || 0,
            shippingCost: 0,
            netTotal,
            paidAmount: amountPaid,
            balanceDue,
            treasuryAccountId: paymentMethod === 'cash' ? treasuryAccountId : null,
            notes: `AI OCR Verified (${fileName})`,
            items: validRows.map(it => ({
              productId: (!it.isNewProduct && it.matchedProductId && uuidRegex.test(it.matchedProductId)) ? it.matchedProductId : null,
              sku: it.sku.trim(),
              barcode: it.barcode.trim(),
              name: it.name.trim(),
              categoryName: isAr ? 'توريدات عامة' : 'General Supplies',
              unitOfMeasure: it.uom,
              quantity: Number(it.quantity),
              unitCost: Number(it.unitCostPrice),
              sellingPrice: Number(it.sellingPrice) > 0 ? Number(it.sellingPrice) : Number((it.unitCostPrice * 1.25).toFixed(4)),
              lineTotal: Number(it.lineTotal),
              isNewProduct: Boolean(it.isNewProduct)
            }))
          })
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          setErrorMessage(errBody?.message || errBody?.errorCode || 'ERR_CREATE_PURCHASE_FAILED');
          setIsPosting(false);
          return;
        }
      }

      // 2. Commit locally inside single workflow (creating new supplier if opted-in now on confirmation!)
      let finalSupplierId = selectedSupplierId;
      let finalSupplierName = suppliers.find(s => s.id === selectedSupplierId)?.company || '';

      if (createNewSupplier) {
        const createdSup = createSupplier({
          company: newSupplierName.trim(),
          contact: newSupplierName.trim(),
          contactPerson: newSupplierName.trim(),
          phone: newSupplierPhone.trim() || '—',
          email: '',
          category: isAr ? 'توريدات عامة' : 'General Supplies',
          country: isAr ? 'دولي / عام' : 'Global / General'
        });
        finalSupplierId = createdSup.id;
        finalSupplierName = createdSup.company;
      }

      const billId = `BILL-${Date.now().toString().slice(-6)}`;
      const billNumber = `BILL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const purchaseItems: PurchaseInvoiceItem[] = validRows.map((it, idx) => ({
        id: `PI-${Date.now()}-${idx}`,
        productId: (!it.isNewProduct && it.matchedProductId) ? it.matchedProductId : undefined,
        sku: it.sku.trim(),
        barcode: it.barcode.trim(),
        nameAr: it.name.trim(),
        nameEn: it.name.trim(),
        uom: it.uom,
        quantity: Number(it.quantity),
        unitCost: Number(it.unitCostPrice),
        currentSellingPrice: Number(it.sellingPrice),
        newSellingPrice: Number(it.sellingPrice),
        lineTotal: Number(it.lineTotal),
        isNewProduct: it.isNewProduct
      }));

      const localInvoice: PurchaseInvoice = {
        id: billId,
        billNumber,
        supplierId: finalSupplierId,
        supplierName: finalSupplierName,
        supplierRefNo: supplierInvoiceNumber.trim(),
        invoiceDate,
        warehouseId: targetWh?.id || 'WH-01',
        warehouseName: targetWh ? (isAr ? targetWh.nameAr : (targetWh.nameEn || targetWh.nameAr)) : (isAr ? 'المستودع الرئيسي' : 'Main Warehouse'),
        paymentTerms: paymentMethod,
        items: purchaseItems,
        itemsCount: purchaseItems.reduce((acc, row) => acc + (Number(row.quantity) || 0), 0),
        subtotal,
        discount: Number(invoiceDiscount) || 0,
        shippingCost: 0,
        netTotal,
        amountPaid,
        balanceDue,
        paidFromAccount: paymentMethod === 'cash' ? treasuryAccountId : undefined,
        status: 'POSTED',
        createdAt: new Date().toISOString(),
        notes: `AI OCR Verified (${currency} • ${fileName})`
      };

      const txResult = executePurchaseInvoiceTransaction(localInvoice);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_purchases_updated'));
      }
      onPosted(txResult);
    } catch (err: any) {
      setErrorMessage(err?.message || 'ERR_CREATE_PURCHASE_FAILED');
      setIsPosting(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 py-4 space-y-4 fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted inline-flex items-center gap-1.5 cursor-pointer"
          >
            {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            <span>{tr('cancelReviewBtn')}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground m-0">{tr('reviewScreenTitle')}</h2>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold m-0 mt-0.5">
                {tr('reviewDraftNotice')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Side-by-Side Split Screen */}
      <form onSubmit={handleConfirmAndPost} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* PANEL 1: Original Invoice Viewer (5 cols on XL) */}
        <div className="xl:col-span-5 bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              <span className="truncate max-w-[190px]">{tr('originalViewerTitle')}</span>
            </div>

            {!isPdf && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  title={tr('zoomOutBtn')}
                  className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-[11px] font-mono tabular-nums text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  title={tr('zoomInBtn')}
                  className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  title={tr('rotateBtn')}
                  className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  title={tr('resetViewBtn')}
                  className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="h-[540px] bg-slate-950/5 dark:bg-slate-950/60 overflow-auto flex items-center justify-center p-4">
            {isPdf ? (
              <iframe src={fileUrl} title={fileName} className="w-full h-full rounded-lg border border-border" />
            ) : (
              <img
                src={fileUrl}
                alt={fileName}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.18s ease'
                }}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md select-none"
              />
            )}
          </div>
        </div>

        {/* PANEL 2: Editable Pre-Filled Purchase Form (7 cols on XL) */}
        <div className="xl:col-span-7 space-y-4">
          {/* Header & Supplier Card */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <span className="text-xs font-bold text-foreground">{tr('editableFormTitle')}</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                extracted.matchedSupplierId && !createNewSupplier
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}>
                {extracted.matchedSupplierId && !createNewSupplier ? tr('supplierMatchedBadge') : tr('supplierNewBadge')}
              </span>
            </div>

            {/* Supplier Mode Switch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>{tr('supplierSectionLabel')}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setCreateNewSupplier(prev => !prev)}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  {createNewSupplier ? tr('selectExistingSupplierOption') : tr('createNewSupplierToggle')}
                </button>
              </div>

              {createNewSupplier ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    placeholder={tr('newSupplierNamePlaceholder')}
                    className="h-9 px-3 rounded-lg border border-amber-500/40 bg-background text-xs font-semibold text-foreground"
                  />
                  <input
                    type="text"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    placeholder={tr('newSupplierPhonePlaceholder')}
                    className="h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono text-foreground"
                  />
                </div>
              ) : (
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-semibold text-foreground"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.company}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Purchase Header Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  {tr('supplierInvoiceNoLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-mono tabular-nums text-foreground"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{tr('invoiceDateLabel')}</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <WarehouseIcon className="w-3 h-3" />
                  <span>{tr('targetWarehouseLabel')}</span>
                </label>
                <select
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{isAr ? w.nameAr : (w.nameEn || w.nameAr)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Coins className="w-3 h-3" />
                  <span>{tr('currencyLabel')}</span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value === 'USD' ? 'USD' : 'IQD')}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-bold font-mono text-foreground"
                >
                  <option value="IQD">IQD</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  {tr('paymentMethodLabel')}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`h-9 px-2 rounded-lg border text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span className="truncate">{tr('paymentCashSafe')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit')}
                    className={`h-9 px-2 rounded-lg border text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${
                      paymentMethod === 'credit'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span className="truncate">{tr('paymentCreditSupplier')}</span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'cash' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    {tr('treasurySafeLabel')}
                  </label>
                  <select
                    value={treasuryAccountId}
                    onChange={(e) => setTreasuryAccountId(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground"
                  >
                    {treasuryAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {isAr ? (acc.nameAr || acc.name) : (acc.nameEn || acc.name)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    {tr('invoiceDiscountLabel')} ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={invoiceDiscount}
                    onChange={(e) => setInvoiceDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-mono tabular-nums text-foreground"
                  />
                </div>
              )}
            </div>

            {paymentMethod === 'cash' && (
              <div className="max-w-[210px]">
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  {tr('invoiceDiscountLabel')} ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-mono tabular-nums text-foreground"
                />
              </div>
            )}
          </div>

          {/* Editable Line Items Table */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-foreground m-0">{tr('itemsTableTitle')}</h3>
              <button
                type="button"
                onClick={handleAddEmptyRow}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-bold text-foreground cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{tr('addLineBtn')}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-2 text-start font-bold">{tr('colItemAndMatch')}</th>
                    <th className="py-2 px-2 text-center font-bold w-24">{tr('colQuantity')}</th>
                    <th className="py-2 px-2 text-center font-bold w-28">{tr('colUnitCost')}</th>
                    <th className="py-2 px-2 text-end font-bold w-28">{tr('colLineTotal')}</th>
                    <th className="py-2 px-1 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {items.map((row, idx) => {
                    const isMatched = Boolean(row.matchedProductId && !row.isNewProduct);
                    return (
                      <tr key={row.id} className="align-top hover:bg-muted/20">
                        <td className="py-2.5 px-2 space-y-1.5 min-w-[240px]">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isMatched
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            }`}>
                              {isMatched ? <Check className="w-3 h-3" /> : <PackagePlus className="w-3 h-3" />}
                              <span>{isMatched ? tr('badgeMatched') : tr('badgeUnmatched')}</span>
                            </span>

                            {isMatched ? (
                              <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                                {tr('currentStockHint').replace('{qty}', row.warehouseStock.toLocaleString('en-US'))}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                {tr('newProductCreatedHint')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <select
                              value={row.isNewProduct ? '' : (row.matchedProductId || '')}
                              onChange={(e) => handleSelectCatalogProduct(idx, e.target.value)}
                              className="flex-1 h-8 px-2 rounded-lg border border-border bg-background text-[11px] font-semibold text-foreground"
                            >
                              <option value="">{tr('searchCatalogPlaceholder')}</option>
                              {nonBundleProducts.map(p => (
                                <option key={p.id} value={p.id}>
                                  {isAr ? p.nameAr : (p.nameEn || p.nameAr)} ({p.sku})
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => updateItem(idx, { isNewProduct: !row.isNewProduct, matchedProductId: row.isNewProduct ? row.matchedProductId : null })}
                              className={`h-8 px-2 rounded-lg border text-[10px] font-bold whitespace-nowrap cursor-pointer ${
                                row.isNewProduct
                                  ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {tr('createAsNewProductToggle')}
                            </button>
                          </div>

                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateItem(idx, { name: e.target.value })}
                            className="w-full h-8 px-2 rounded-lg border border-border/70 bg-background text-xs font-semibold text-foreground"
                          />

                          {row.isNewProduct && (
                            <div className="grid grid-cols-2 gap-1.5">
                              <input
                                type="text"
                                value={row.sku}
                                onChange={(e) => updateItem(idx, { sku: e.target.value })}
                                placeholder={tr('barcodeSkuPlaceholder')}
                                className="h-7 px-2 rounded border border-border/70 bg-background text-[10.5px] font-mono text-foreground"
                              />
                              <input
                                type="number"
                                min={0}
                                step="0.0001"
                                value={row.sellingPrice}
                                onChange={(e) => updateItem(idx, { sellingPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                                placeholder={tr('sellingPriceLabel')}
                                className="h-7 px-2 rounded border border-border/70 bg-background text-[10.5px] font-mono tabular-nums text-foreground"
                              />
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min={0.0001}
                            step="0.0001"
                            value={row.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-mono tabular-nums text-center text-foreground"
                          />
                        </td>

                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min={0}
                            step="0.0001"
                            value={row.unitCostPrice}
                            onChange={(e) => updateItem(idx, { unitCostPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-mono tabular-nums text-center text-foreground"
                          />
                        </td>

                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min={0}
                            step="0.0001"
                            value={row.lineTotal}
                            onChange={(e) => updateItem(idx, { lineTotal: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-mono font-bold tabular-nums text-end text-foreground"
                          />
                        </td>

                        <td className="py-2.5 px-1">
                          <button
                            type="button"
                            onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                            disabled={items.length <= 1}
                            className="p-1.5 rounded-lg text-destructive/70 hover:text-destructive disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals & Final Confirmation Button */}
            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-5 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">{tr('subtotalLabel')}</span>
                  <strong className="font-mono tabular-nums text-foreground text-sm" dir="ltr">
                    {subtotal.toLocaleString('en-US', { maximumFractionDigits: 4 })} {currency}
                  </strong>
                </div>
                {invoiceDiscount > 0 && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">{tr('invoiceDiscountLabel')}</span>
                    <strong className="font-mono tabular-nums text-amber-600 text-sm" dir="ltr">
                      -{invoiceDiscount.toLocaleString('en-US', { maximumFractionDigits: 4 })} {currency}
                    </strong>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground block text-[11px]">{tr('netTotalLabel')}</span>
                  <strong className="font-mono font-black tabular-nums text-primary text-base" dir="ltr">
                    {netTotal.toLocaleString('en-US', { maximumFractionDigits: 4 })} {currency}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isPosting}
                  className="h-10 px-4 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {tr('cancelReviewBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isPosting}
                  className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{isPosting ? tr('postingBtn') : tr('confirmAndPostBtn')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
