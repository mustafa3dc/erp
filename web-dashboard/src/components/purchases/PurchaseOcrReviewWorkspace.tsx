import React, { useState, useMemo, useEffect } from 'react';
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
  Check,
  Search,
  Unlink
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
  rawBarcodeOrSku: string | null;
  matchedProductId: string | null;
  isNewProduct: boolean;
  sku: string;
  barcode: string;
  name: string;
  uom: string;
  quantity: number;
  unitCostPrice: number;
  sellingPriceInput: string;
  lineTotal: number;
  matchConfidence: 'High' | 'Low' | 'None';
  warehouseStock: number;
  searchQuery: string;
  isSearchOpen: boolean;
}

interface PurchaseOcrReviewWorkspaceProps {
  lang: 'ar' | 'en';
  session: OcrReviewSessionData;
  products: Product[];
  warehouses: Warehouse[];
  onPosted: (result: PurchaseInvoiceTransactionResult) => void;
  onCancel: () => void;
}

const parsePositiveSellingPrice = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(4)) : null;
};

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
      const isMatchedItem = Boolean(it.matchedProductId);
      const catalogSelling = matched
        ? Number(matched.sellingPrice) || 0
        : (Number(it.currentSellingPrice) || 0);

      return {
        id: `OCR-IT-${Date.now()}-${idx}`,
        rawItemName: it.rawItemName || '',
        rawBarcodeOrSku: it.barcodeOrSku?.trim() || null,
        matchedProductId: it.matchedProductId || null,
        isNewProduct: !isMatchedItem,
        sku: matched?.sku || it.matchedProductSku || it.barcodeOrSku?.trim() || `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`,
        barcode: matched?.barcode || it.matchedProductBarcode || it.barcodeOrSku?.trim() || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
        name: matched ? (isAr ? matched.nameAr : (matched.nameEn || matched.nameAr)) : (it.matchedProductName || it.rawItemName || ''),
        uom: matched?.unit || it.unitOfMeasure || (isAr ? 'قطعة' : 'Piece'),
        quantity: qty,
        unitCostPrice: cost,
        // 100% manual selling price: empty "" for new products, catalog SalePrice for matched items
        sellingPriceInput: isMatchedItem && catalogSelling > 0 ? String(catalogSelling) : '',
        lineTotal: it.lineTotal > 0 ? Number(it.lineTotal) : Number((qty * cost).toFixed(4)),
        matchConfidence: isMatchedItem ? (it.matchConfidence || 'High') : 'None',
        warehouseStock: matched ? Number(matched.currentStock) || 0 : (Number(it.warehouseStock) || 0),
        searchQuery: '',
        isSearchOpen: false
      };
    })
  );

  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const subtotal = useMemo(
    () => Number(items.reduce((sum, it) => sum + (Number(it.lineTotal) || 0), 0).toFixed(4)),
    [items]
  );
  const netTotal = useMemo(
    () => Math.max(0, Number((subtotal - (Number(invoiceDiscount) || 0)).toFixed(4))),
    [subtotal, invoiceDiscount]
  );

  const [paidAmountInput, setPaidAmountInput] = useState<string>(() => String(netTotal));

  useEffect(() => {
    if (paymentMethod === 'cash') {
      setPaidAmountInput(String(netTotal));
    }
  }, [netTotal, paymentMethod]);

  const handlePaymentMethodChange = (method: 'cash' | 'credit') => {
    setPaymentMethod(method);
    setPaidAmountInput(method === 'cash' ? String(netTotal) : '0');
  };

  const parsedPaidAmount = useMemo(() => {
    const n = Number(paidAmountInput);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Number(Math.min(n, netTotal).toFixed(4));
  }, [paidAmountInput, netTotal]);

  const balanceDue = Math.max(0, Number((netTotal - parsedPaidAmount).toFixed(4)));
  const currencyDisplay = currency === 'USD' ? tr('currencyUnitUsd') : tr('currencyUnitIqd');

  const formatAmount = (val: number) =>
    `${val.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${currencyDisplay}`;

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

  const handleSelectCatalogProduct = (rowIdx: number, prod: Product) => {
    const catalogSelling = Number(prod.sellingPrice) || 0;
    updateItem(rowIdx, {
      matchedProductId: prod.id,
      isNewProduct: false,
      name: isAr ? prod.nameAr : (prod.nameEn || prod.nameAr),
      sku: prod.sku,
      barcode: prod.barcode || '',
      uom: prod.unit || (isAr ? 'قطعة' : 'Piece'),
      sellingPriceInput: catalogSelling > 0 ? String(catalogSelling) : '',
      matchConfidence: 'High',
      warehouseStock: Number(prod.currentStock) || 0,
      searchQuery: '',
      isSearchOpen: false
    });
  };

  const handleUnlinkProduct = (rowIdx: number) => {
    setItems(prev =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        return {
          ...row,
          matchedProductId: null,
          isNewProduct: false,
          name: row.rawItemName,
          sku: row.rawBarcodeOrSku || `SKU-${Date.now().toString().slice(-4)}-${i + 1}`,
          barcode: row.rawBarcodeOrSku || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
          sellingPriceInput: '',
          matchConfidence: 'None',
          warehouseStock: 0,
          searchQuery: '',
          isSearchOpen: false
        };
      })
    );
  };

  const handleToggleCreateNewProduct = (rowIdx: number) => {
    setItems(prev =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        const nextIsNew = !row.isNewProduct;
        return {
          ...row,
          isNewProduct: nextIsNew,
          matchedProductId: null,
          name: nextIsNew ? (row.name.trim() || row.rawItemName) : row.rawItemName,
          sku: nextIsNew
            ? (row.sku.trim() || row.rawBarcodeOrSku || `SKU-${Date.now().toString().slice(-4)}-${i + 1}`)
            : row.sku,
          sellingPriceInput: nextIsNew ? '' : row.sellingPriceInput,
          isSearchOpen: false
        };
      })
    );
  };

  const handleAddEmptyRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `OCR-IT-${Date.now()}-${prev.length + 1}`,
        rawItemName: '',
        rawBarcodeOrSku: null,
        matchedProductId: null,
        isNewProduct: true,
        sku: `SKU-${Date.now().toString().slice(-4)}-${prev.length + 1}`,
        barcode: `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
        name: '',
        uom: isAr ? 'قطعة' : 'Piece',
        quantity: 1,
        unitCostPrice: 0,
        sellingPriceInput: '',
        lineTotal: 0,
        matchConfidence: 'None',
        warehouseStock: 0,
        searchQuery: '',
        isSearchOpen: false
      }
    ]);
  };

  const resolveApiErrorText = (errCode?: string | null, fallbackMsg?: string | null) => {
    if (errCode) {
      return getTranslation(lang, `ui.purchaseOcr.errors.${errCode}`, fallbackMsg || errCode);
    }
    return fallbackMsg || getTranslation(lang, 'ui.purchaseOcr.errors.ERR_OCR_EXTRACTION_FAILED');
  };

  const handleConfirmAndPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
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

    if (items.length === 0) {
      setErrorMessage(tr('errNoValidItems'));
      return;
    }

    for (const row of items) {
      const isMatched = Boolean(row.matchedProductId && !row.isNewProduct);
      if (!isMatched && !row.isNewProduct) {
        setErrorMessage(tr('errRowUnresolved'));
        return;
      }
      if (row.isNewProduct && (!row.name.trim() || !row.sku.trim())) {
        setErrorMessage(tr('errRowUnresolved'));
        return;
      }
      if (row.quantity <= 0 || row.unitCostPrice < 0) {
        setErrorMessage(tr('errNoValidItems'));
        return;
      }
      const parsedSelling = parsePositiveSellingPrice(row.sellingPriceInput);
      if (parsedSelling === null) {
        setErrorMessage(tr('errSellingPriceRequired'));
        return;
      }
    }

    const rawPaid = Number(paidAmountInput);
    if (!Number.isFinite(rawPaid) || rawPaid < 0 || rawPaid > netTotal + 0.0001) {
      setErrorMessage(tr('errPaidAmountInvalid'));
      return;
    }

    const finalPaid = Number(Math.min(rawPaid, netTotal).toFixed(4));
    const finalBalanceDue = Math.max(0, Number((netTotal - finalPaid).toFixed(4)));

    setIsPosting(true);
    try {
      const targetWh = warehouses.find(w => w.id === targetWarehouseId) || warehouses[0];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('zilox_auth_token') || localStorage.getItem('logistock_erp_jwt_token'))
        : null;

      // 1. Submit to Purchase Invoice ACID Backend API if online with warehouse UUID
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
            paymentTerms: paymentMethod === 'cash' && finalBalanceDue === 0 ? 'CASH' : 'CREDIT',
            currency,
            subtotal,
            discountAmount: Number(invoiceDiscount) || 0,
            shippingCost: 0,
            netTotal,
            paidAmount: finalPaid,
            balanceDue: finalBalanceDue,
            treasuryAccountId: finalPaid > 0 ? treasuryAccountId : null,
            notes: `AI OCR Verified (${fileName})`,
            items: items.map(it => ({
              productId: (!it.isNewProduct && it.matchedProductId && uuidRegex.test(it.matchedProductId)) ? it.matchedProductId : null,
              sku: it.sku.trim(),
              barcode: it.barcode.trim(),
              name: it.name.trim(),
              categoryName: isAr ? 'توريدات عامة' : 'General Supplies',
              unitOfMeasure: it.uom,
              quantity: Number(it.quantity),
              unitCost: Number(it.unitCostPrice),
              sellingPrice: parsePositiveSellingPrice(it.sellingPriceInput),
              lineTotal: Number(it.lineTotal),
              isNewProduct: Boolean(it.isNewProduct)
            }))
          })
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          setErrorMessage(resolveApiErrorText(errBody?.errorCode, errBody?.message));
          setIsPosting(false);
          return;
        }
      }

      // 2. Commit locally inside single workflow
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

      const purchaseItems: PurchaseInvoiceItem[] = items.map((it, idx) => {
        const manualSelling = parsePositiveSellingPrice(it.sellingPriceInput) || 0;
        return {
          id: `PI-${Date.now()}-${idx}`,
          productId: (!it.isNewProduct && it.matchedProductId) ? it.matchedProductId : undefined,
          sku: it.sku.trim(),
          barcode: it.barcode.trim(),
          nameAr: it.name.trim(),
          nameEn: it.name.trim(),
          uom: it.uom,
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCostPrice),
          currentSellingPrice: manualSelling,
          newSellingPrice: manualSelling,
          lineTotal: Number(it.lineTotal),
          isNewProduct: it.isNewProduct
        };
      });

      const localInvoice: PurchaseInvoice = {
        id: billId,
        billNumber,
        supplierId: finalSupplierId,
        supplierName: finalSupplierName,
        supplierRefNo: supplierInvoiceNumber.trim(),
        invoiceDate,
        warehouseId: targetWh?.id || 'WH-01',
        warehouseName: targetWh ? (isAr ? targetWh.nameAr : (targetWh.nameEn || targetWh.nameAr)) : (isAr ? 'المستودع الرئيسي' : 'Main Warehouse'),
        paymentTerms: finalBalanceDue === 0 ? 'cash' : (finalPaid > 0 ? 'partial' : 'credit'),
        items: purchaseItems,
        itemsCount: purchaseItems.reduce((acc, row) => acc + (Number(row.quantity) || 0), 0),
        subtotal,
        discount: Number(invoiceDiscount) || 0,
        shippingCost: 0,
        netTotal,
        amountPaid: finalPaid,
        balanceDue: finalBalanceDue,
        paidFromAccount: finalPaid > 0 ? treasuryAccountId : undefined,
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
      setErrorMessage(resolveApiErrorText(err?.errorCode, err?.message));
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
        <div className="xl:col-span-5 bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col xl:sticky xl:top-4">
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
                    dir="auto"
                    className="h-9 px-3 rounded-lg border border-amber-500/40 bg-background text-xs font-semibold text-foreground"
                  />
                  <input
                    type="text"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    placeholder={tr('newSupplierPhonePlaceholder')}
                    dir="ltr"
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
                  dir="ltr"
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
                  dir="ltr"
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
                    onClick={() => handlePaymentMethodChange('cash')}
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
                    onClick={() => handlePaymentMethodChange('credit')}
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
                    {tr('invoiceDiscountLabel')} ({currencyDisplay})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={invoiceDiscount}
                    onChange={(e) => setInvoiceDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    dir="ltr"
                    className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-mono tabular-nums text-foreground"
                  />
                </div>
              )}
            </div>

            {paymentMethod === 'cash' && (
              <div className="max-w-[210px]">
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  {tr('invoiceDiscountLabel')} ({currencyDisplay})
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  dir="ltr"
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
                    <th className="py-2 px-2 text-center font-bold w-20">{tr('colQuantity')}</th>
                    <th className="py-2 px-2 text-center font-bold w-24">{tr('colUnitCost')}</th>
                    <th className="py-2 px-2 text-center font-bold w-32">{tr('sellingPriceLabel')}</th>
                    <th className="py-2 px-2 text-end font-bold w-24">{tr('colLineTotal')}</th>
                    <th className="py-2 px-1 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {items.map((row, idx) => {
                    const isMatched = Boolean(row.matchedProductId && !row.isNewProduct);
                    const parsedSelling = parsePositiveSellingPrice(row.sellingPriceInput);
                    const sellingInvalid = (row.isNewProduct || isMatched) && (
                      parsedSelling === null && (hasAttemptedSubmit || (row.isNewProduct && row.sellingPriceInput.trim() !== ''))
                    );
                    const hasLiveMargin = parsedSelling !== null && row.unitCostPrice > 0;
                    const marginPct = hasLiveMargin
                      ? ((parsedSelling! - row.unitCostPrice) / row.unitCostPrice) * 100
                      : 0;
                    const isLowOrNegativeMargin = parsedSelling !== null && parsedSelling <= row.unitCostPrice;

                    const q = row.searchQuery.trim().toLowerCase();
                    const filteredCatalog = q
                      ? nonBundleProducts.filter(p =>
                          p.nameAr.toLowerCase().includes(q) ||
                          (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
                          p.sku.toLowerCase().includes(q) ||
                          (p.barcode && p.barcode.toLowerCase().includes(q))
                        ).slice(0, 25)
                      : nonBundleProducts.slice(0, 25);

                    return (
                      <tr key={row.id} className="align-top hover:bg-muted/20">
                        <td className="py-3 px-2 space-y-2 min-w-[250px]">
                          {/* Status Badge + Stock or New Hint */}
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
                            ) : row.isNewProduct ? (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                {tr('newProductCreatedHint')}
                              </span>
                            ) : null}
                          </div>

                          {/* Always-Preserved Original Scanned Invoice Subtitle */}
                          {row.rawItemName.trim() && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap bg-muted/40 px-2 py-1 rounded-md border border-border/40">
                              <span className="font-semibold shrink-0">{tr('originalInvoicePrefix')}</span>
                              <bdi dir="auto" className="text-foreground/85 font-medium">{row.rawItemName}</bdi>
                              {row.rawBarcodeOrSku && (
                                <span dir="ltr" className="font-mono text-[10px] text-muted-foreground">
                                  ({row.rawBarcodeOrSku})
                                </span>
                              )}
                            </div>
                          )}

                          {isMatched ? (
                            /* Matched Row: Read-Only Catalog Identity + Change/Unlink Button */
                            <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5">
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">
                                  <bdi dir="auto">{row.name}</bdi>
                                </div>
                                <div className="text-[10.5px] font-mono text-muted-foreground mt-0.5" dir="ltr">
                                  {row.sku}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUnlinkProduct(idx)}
                                className="shrink-0 h-7 px-2 rounded-md border border-border bg-card hover:bg-muted text-[10.5px] font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Unlink className="w-3 h-3" />
                                <span>{tr('unlinkOrChangeBtn')}</span>
                              </button>
                            </div>
                          ) : (
                            /* Unmatched Row: Inline Searchable Selector + Create as New Product Toggle */
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5">
                                <div className="relative flex-1">
                                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
                                  <input
                                    type="text"
                                    value={row.searchQuery}
                                    onFocus={() => updateItem(idx, { isSearchOpen: true })}
                                    onBlur={() => setTimeout(() => updateItem(idx, { isSearchOpen: false }), 150)}
                                    onChange={(e) => updateItem(idx, { searchQuery: e.target.value, isSearchOpen: true })}
                                    placeholder={tr('searchProductPlaceholder')}
                                    dir="auto"
                                    className="w-full h-8 ps-7 pe-2 rounded-lg border border-border bg-background text-[11px] font-medium text-foreground"
                                  />
                                  {row.isSearchOpen && (
                                    <div className="absolute z-30 top-full mt-1 inset-x-0 max-h-44 overflow-y-auto rounded-xl border border-border bg-card shadow-xl divide-y divide-border/40">
                                      {filteredCatalog.length > 0 ? (
                                        filteredCatalog.map(prod => (
                                          <button
                                            key={prod.id}
                                            type="button"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              handleSelectCatalogProduct(idx, prod);
                                            }}
                                            className="w-full px-2.5 py-1.5 text-start hover:bg-muted/70 flex items-center justify-between gap-2 cursor-pointer"
                                          >
                                            <span className="text-[11px] font-semibold text-foreground truncate">
                                              <bdi dir="auto">{isAr ? prod.nameAr : (prod.nameEn || prod.nameAr)}</bdi>
                                            </span>
                                            <span className="text-[10px] font-mono text-muted-foreground shrink-0" dir="ltr">
                                              {prod.sku}
                                            </span>
                                          </button>
                                        ))
                                      ) : (
                                        <div className="px-2.5 py-2 text-[11px] text-muted-foreground text-center">
                                          {tr('noMatchingProducts')}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleToggleCreateNewProduct(idx)}
                                  className={`h-8 px-2.5 rounded-lg border text-[10.5px] font-bold whitespace-nowrap cursor-pointer ${
                                    row.isNewProduct
                                      ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  {tr('createAsNewProductToggle')}
                                </button>
                              </div>

                              {row.isNewProduct && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                                      {tr('newProductNameLabel')} *
                                    </label>
                                    <input
                                      type="text"
                                      value={row.name}
                                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                                      placeholder={tr('newProductNamePlaceholder')}
                                      dir="auto"
                                      className={`w-full h-8 px-2 rounded-lg border bg-background text-xs font-semibold text-foreground ${
                                        hasAttemptedSubmit && !row.name.trim() ? 'border-destructive' : 'border-border/80'
                                      }`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                                      {tr('barcodeSkuPlaceholder')} *
                                    </label>
                                    <input
                                      type="text"
                                      value={row.sku}
                                      onChange={(e) => updateItem(idx, { sku: e.target.value })}
                                      placeholder={tr('barcodeSkuPlaceholder')}
                                      dir="ltr"
                                      className={`w-full h-8 px-2 rounded-lg border bg-background text-[11px] font-mono text-foreground ${
                                        hasAttemptedSubmit && !row.sku.trim() ? 'border-destructive' : 'border-border/80'
                                      }`}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min={0.0001}
                            step="0.0001"
                            value={row.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Math.max(0, parseFloat(e.target.value) || 0) })}
                            dir="ltr"
                            className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-mono tabular-nums text-center text-foreground"
                          />
                        </td>

                        {/* Unit Cost */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min={0}
                            step="0.0001"
                            value={row.unitCostPrice}
                            onChange={(e) => updateItem(idx, { unitCostPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                            dir="ltr"
                            className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-mono tabular-nums text-center text-foreground"
                          />
                        </td>

                        {/* Manual Selling Price + Live Read-Only Margin Badge */}
                        <td className="py-3 px-2">
                          <div className="space-y-1">
                            <input
                              type="number"
                              min={0}
                              step="0.0001"
                              disabled={!isMatched && !row.isNewProduct}
                              value={row.sellingPriceInput}
                              onChange={(e) => updateItem(idx, { sellingPriceInput: e.target.value })}
                              placeholder={row.isNewProduct ? '0' : tr('sellingPriceLabel')}
                              dir="ltr"
                              className={`w-full h-8 px-2 rounded-lg border bg-background text-xs font-mono tabular-nums text-center text-foreground disabled:opacity-40 ${
                                sellingInvalid
                                  ? 'border-destructive ring-1 ring-destructive/30'
                                  : isLowOrNegativeMargin
                                  ? 'border-amber-500'
                                  : 'border-border'
                              }`}
                            />

                            {sellingInvalid ? (
                              <div className="text-[10px] font-semibold text-destructive text-center leading-tight">
                                {tr('sellingPriceRequiredHint')}
                              </div>
                            ) : parsedSelling !== null ? (
                              <div
                                title={isLowOrNegativeMargin ? tr('lowMarginWarning') : tr('marginLabel')}
                                className={`text-[10px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded border text-center ${
                                  isLowOrNegativeMargin
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                                }`}
                                dir="ltr"
                              >
                                {hasLiveMargin
                                  ? `${marginPct > 0 ? '+' : ''}${marginPct.toFixed(1)}%`
                                  : '—'}
                              </div>
                            ) : null}
                          </div>
                        </td>

                        {/* Line Total */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min={0}
                            step="0.0001"
                            value={row.lineTotal}
                            onChange={(e) => updateItem(idx, { lineTotal: Math.max(0, parseFloat(e.target.value) || 0) })}
                            dir="ltr"
                            className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-mono font-bold tabular-nums text-end text-foreground"
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="py-3 px-1">
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
          </div>

          {/* Sticky Footer Summary & Confirmation Action Bar */}
          <div className="sticky bottom-3 z-20 bg-card/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              {/* Totals Breakdown */}
              <div className="flex flex-wrap items-center gap-5 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">{tr('subtotalLabel')}</span>
                  <strong className="font-mono tabular-nums text-foreground text-sm" dir="ltr">
                    {formatAmount(subtotal)}
                  </strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">{tr('invoiceDiscountLabel')}</span>
                  <strong className="font-mono tabular-nums text-amber-600 dark:text-amber-400 text-sm" dir="ltr">
                    {invoiceDiscount > 0 ? `-${formatAmount(invoiceDiscount)}` : formatAmount(0)}
                  </strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">{tr('netTotalLabel')}</span>
                  <strong className="font-mono font-black tabular-nums text-primary text-base" dir="ltr">
                    {formatAmount(netTotal)}
                  </strong>
                </div>
              </div>

              {/* Paid Amount + Balance Due */}
              <div className="flex items-end gap-3 flex-wrap">
                <div className="w-40">
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    {tr('paidAmountLabel')} ({currencyDisplay})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={netTotal}
                    step="0.0001"
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    dir="ltr"
                    className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-mono font-bold tabular-nums text-foreground"
                  />
                </div>

                <div className="pb-1 text-xs">
                  <span className="text-muted-foreground block text-[10.5px]">{tr('balanceDueLabel')}</span>
                  <strong
                    className={`font-mono tabular-nums text-xs ${
                      balanceDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                    dir="ltr"
                  >
                    {formatAmount(balanceDue)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2.5 border-t border-border/60 flex items-center justify-end gap-2.5">
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
      </form>
    </div>
  );
}
