import React, { useRef, useState } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check
} from 'lucide-react';
import { ModalBackdropPortal } from '../ui/dialog';
import { Button } from '../ui/button';
import { getTranslation } from '../../lib/i18n';
import { toLatinDigits } from '../../lib/formatters';
import { getTenantAuthHeaders } from '../../lib/api-client';
import { getAuthToken } from '../../services/purchasesService';
import { Product, Warehouse } from '../../types/warehouse';
import { saveStoredProducts } from '../../services/storageService';
import { useSettings } from '../../context/settings-context';
import { toast } from 'sonner';

interface ImportPreviewRow {
  rowNumber: number;
  name: string;
  sku: string;
  barcode?: string | null;
  category?: string | null;
  costPrice: number;
  salePrice: number;
  minSalePrice: number;
  openingQuantity: number;
  warehouseCode?: string | null;
  shelfCode?: string | null;
  isValid: boolean;
  errorCode?: string | null;
  errorField?: string | null;
}

interface BulkImportResult {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedProductsCount: number;
  openingStockMovementsCount: number;
  rows: ImportPreviewRow[];
}

interface BulkImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
  existingProducts: Product[];
  warehouses: Warehouse[];
  onImported: (nextProducts: Product[]) => void;
}

export default function BulkImportProductsModal({
  isOpen,
  onClose,
  lang,
  existingProducts,
  warehouses,
  onImported
}: BulkImportProductsModalProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const t = (key: string) => getTranslation(lang, `bulkImport.${key}`);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'ERRORS'>('ALL');
  const [previewResult, setPreviewResult] = useState<BulkImportResult | null>(null);
  const [finalResult, setFinalResult] = useState<BulkImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const translateErrCode = (code?: string | null): string => {
    if (!code) return '';
    return getTranslation(lang, `errors.ERR.INVENTORY.${code}`, code);
  };

  const resetModalState = () => {
    setStep(1);
    setSelectedFile(null);
    setPreviewResult(null);
    setFinalResult(null);
    setPreviewFilter('ALL');
    setErrorMsg('');
  };

  const handleClose = () => {
    if (isValidating || isImporting) return;
    resetModalState();
    onClose();
  };

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    const token = getAuthToken();
    if (token) {
      try {
        const headers = getTenantAuthHeaders();
        delete headers['Content-Type'];
        const res = await fetch(`/api/products/import-template?format=${format}`, { headers });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `products_import_template.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }
      } catch {
        // fallback to client CSV generation below
      }
    }

    const csvHeader = '\uFEFFName,SKU,Barcode,Category,CostPrice,SalePrice,MinSalePrice,OpeningQuantity,WarehouseCode,ShelfCode\r\n';
    const blob = new Blob([csvHeader], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validateCsvLocally = async (file: File): Promise<BulkImportResult> => {
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length <= 1) {
      throw new Error('ERR_IMPORT_EMPTY_FILE');
    }

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let curr = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            curr += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            curr += ch;
          }
        } else {
          if (ch === '"') inQuotes = true;
          else if (ch === ',') {
            result.push(curr);
            curr = '';
          } else {
            curr += ch;
          }
        }
      }
      result.push(curr);
      return result;
    };

    const headers = parseCsvLine(lines[0]).map(h => h.trim().replace(/[\s_]/g, '').toLowerCase());
    const idx = (key: string) => headers.indexOf(key);
    if (idx('name') < 0 || idx('sku') < 0 || idx('saleprice') < 0) {
      throw new Error('ERR_IMPORT_INVALID_FORMAT');
    }

    const existingSkus = new Set(existingProducts.map(p => p.sku.toLowerCase()));
    const seenSkus = new Set<string>();
    const rows: ImportPreviewRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const getVal = (k: string) => {
        const pos = idx(k);
        return pos >= 0 && pos < cells.length ? toLatinDigits((cells[pos] || '').trim()) : '';
      };

      const name = getVal('name');
      const sku = getVal('sku');
      const barcode = getVal('barcode') || null;
      const category = getVal('category') || null;
      const costPrice = Number(getVal('costprice') || '0');
      const salePrice = Number(getVal('saleprice') || '-1');
      const minSalePrice = Number(getVal('minsaleprice') || '0');
      const openingQuantity = Number(getVal('openingquantity') || '0');
      const warehouseCode = getVal('warehousecode') || null;
      const shelfCode = getVal('shelfcode') || null;

      let err: string | null = null;
      let field: string | null = null;

      if (!name) {
        err = 'ERR_IMPORT_MISSING_NAME';
        field = 'Name';
      } else if (!sku) {
        err = 'ERR_IMPORT_MISSING_SKU';
        field = 'SKU';
      } else if (existingSkus.has(sku.toLowerCase()) || seenSkus.has(sku.toLowerCase())) {
        err = 'ERR_IMPORT_DUPLICATE_SKU';
        field = 'SKU';
      } else if (Number.isNaN(costPrice) || costPrice < 0 || Number.isNaN(salePrice) || salePrice <= 0 || Number.isNaN(minSalePrice) || minSalePrice < 0 || minSalePrice > salePrice) {
        err = 'ERR_IMPORT_INVALID_PRICE';
        field = 'SalePrice';
      } else if (Number.isNaN(openingQuantity) || openingQuantity < 0 || !Number.isInteger(openingQuantity)) {
        err = 'ERR_IMPORT_INVALID_QUANTITY';
        field = 'OpeningQuantity';
      } else if (warehouseCode && !warehouses.some(w => w.code.toLowerCase() === warehouseCode.toLowerCase() || w.nameAr.toLowerCase() === warehouseCode.toLowerCase())) {
        err = 'ERR_IMPORT_WAREHOUSE_NOT_FOUND';
        field = 'WarehouseCode';
      }

      if (sku) seenSkus.add(sku.toLowerCase());

      rows.push({
        rowNumber: i + 1,
        name,
        sku,
        barcode,
        category,
        costPrice: Number.isNaN(costPrice) ? 0 : costPrice,
        salePrice: Number.isNaN(salePrice) ? 0 : salePrice,
        minSalePrice: Number.isNaN(minSalePrice) ? 0 : minSalePrice,
        openingQuantity: Number.isNaN(openingQuantity) ? 0 : openingQuantity,
        warehouseCode,
        shelfCode,
        isValid: err === null,
        errorCode: err,
        errorField: field
      });
    }

    return {
      dryRun: true,
      totalRows: rows.length,
      validRows: rows.filter(r => r.isValid).length,
      invalidRows: rows.filter(r => !r.isValid).length,
      importedProductsCount: 0,
      openingStockMovementsCount: 0,
      rows
    };
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    setErrorMsg('');
    setFinalResult(null);

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.csv')) {
      setErrorMsg(translateErrCode('ERR_IMPORT_INVALID_FORMAT'));
      return;
    }

    setSelectedFile(file);
    setIsValidating(true);

    try {
      const token = getAuthToken();
      if (token) {
        const headers = getTenantAuthHeaders();
        delete headers['Content-Type'];
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/products/import?dryRun=true', {
          method: 'POST',
          headers,
          body: formData
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          setErrorMsg(translateErrCode(json?.errorCode || 'ERR_IMPORT_INVALID_FORMAT'));
          setPreviewResult(null);
          return;
        }
        setPreviewResult(json.data);
      } else {
        if (lowerName.endsWith('.xlsx')) {
          setErrorMsg(translateErrCode('ERR_IMPORT_INVALID_FORMAT'));
          setPreviewResult(null);
          return;
        }
        const localRes = await validateCsvLocally(file);
        setPreviewResult(localRes);
      }
    } catch (err: any) {
      setErrorMsg(translateErrCode(err?.message || 'ERR_IMPORT_INVALID_FORMAT'));
      setPreviewResult(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || !previewResult || previewResult.invalidRows > 0) {
      setErrorMsg(t('errFixErrorsFirst'));
      return;
    }

    setIsImporting(true);
    setErrorMsg('');

    try {
      const token = getAuthToken();
      let resultData: BulkImportResult;

      if (token) {
        const headers = getTenantAuthHeaders();
        delete headers['Content-Type'];
        const formData = new FormData();
        formData.append('file', selectedFile);

        const res = await fetch('/api/products/import?dryRun=false', {
          method: 'POST',
          headers,
          body: formData
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          setErrorMsg(translateErrCode(json?.errorCode || 'ERR_IMPORT_TRANSACTION_FAILED'));
          return;
        }
        resultData = json.data;
      } else {
        resultData = {
          ...previewResult,
          dryRun: false,
          importedProductsCount: previewResult.validRows,
          openingStockMovementsCount: previewResult.rows.filter(r => r.openingQuantity > 0).length
        };
      }

      const nowStr = new Date().toISOString().slice(0, 10);
      const defaultWh = warehouses[0];
      const newLocalProducts: Product[] = resultData.rows
        .filter(r => r.isValid)
        .map((r, idx) => {
          const matchedWh = warehouses.find(
            w => r.warehouseCode && (w.code.toLowerCase() === r.warehouseCode.toLowerCase() || w.nameAr.toLowerCase() === r.warehouseCode.toLowerCase())
          ) || defaultWh;
          const qty = Number(r.openingQuantity) || 0;
          return {
            id: `IMP-${Date.now()}-${idx + 1}`,
            sku: r.sku,
            barcode: r.barcode || '',
            nameAr: r.name,
            nameEn: r.name,
            category: r.category || (isAr ? 'عام' : 'General'),
            costPrice: Number(r.costPrice) || 0,
            sellingPrice: Number(r.salePrice) || 0,
            minSellingPrice: Number(r.minSalePrice) || 0,
            unit: isAr ? 'قطعة' : 'Piece',
            currentStock: qty,
            minStockAlert: 5,
            warehouseId: matchedWh?.id || 'WH-01',
            warehouseName: matchedWh?.nameAr || r.warehouseCode || 'المستودع الرئيسي',
            status: qty <= 0 ? 'out_of_stock' : qty <= 5 ? 'low' : 'available',
            shelf: r.shelfCode || 'A-01',
            updatedAt: nowStr
          };
        });

      const merged = [...newLocalProducts, ...existingProducts];
      saveStoredProducts(merged);
      onImported(merged);
      window.dispatchEvent(new CustomEvent('zilox_products_updated'));
      setFinalResult(resultData);
      toast.success(t('successTitle'));
    } catch {
      setErrorMsg(translateErrCode('ERR_IMPORT_TRANSACTION_FAILED'));
    } finally {
      setIsImporting(false);
    }
  };

  const displayedPreviewRows = (previewResult?.rows || []).filter(r =>
    previewFilter === 'ALL' ? true : !r.isValid
  );

  return (
    <ModalBackdropPortal onClose={handleClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div
        className="bg-card text-foreground border border-border rounded-2xl shadow-2xl w-full max-w-4xl mx-auto my-auto overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground m-0">{t('modalTitle')}</h3>
              <p className="text-xs text-muted-foreground m-0 mt-0.5">{t('modalSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Step Indicator */}
        <div className="px-6 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-2 overflow-x-auto">
          {([
            { num: 1 as const, label: t('step1Title') },
            { num: 2 as const, label: t('step2Title') },
            { num: 3 as const, label: t('step3Title') }
          ]).map((s, idx) => {
            const isActive = step === s.num;
            const isDone = step > s.num || Boolean(finalResult);
            return (
              <React.Fragment key={s.num}>
                <div className={`flex items-center gap-2 text-xs font-bold whitespace-nowrap ${
                  isActive ? 'text-primary' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                }`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono tabular-nums border ${
                    isDone
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                      : isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border text-muted-foreground'
                  }`}>
                    {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </span>
                  <span>{s.label}</span>
                </div>
                {idx < 2 && <div className="h-px flex-1 bg-border min-w-[20px]" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Download Template */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-foreground font-medium m-0">{t('step1Desc')}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  className="flex items-center justify-center gap-2.5 p-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-sm transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('downloadXlsx')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  className="flex items-center justify-center gap-2.5 p-4 rounded-xl border border-border bg-muted/40 hover:bg-muted text-foreground font-bold text-sm transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('downloadCsv')}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                <span className="text-xs font-bold text-foreground block">{t('columnsGuideTitle')}</span>
                <code className="block text-xs font-mono text-primary bg-background border border-border rounded-lg p-3 overflow-x-auto" dir="ltr">
                  {t('columnsList')}
                </code>
              </div>
            </div>
          )}

          {/* STEP 2: Upload & Preview Rows */}
          {step === 2 && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files?.[0] || null;
                  handleFileSelected(dropped);
                }}
                className="flex flex-col items-center justify-center gap-2.5 p-6 rounded-xl border-2 border-dashed border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer text-center"
              >
                <Upload className="w-7 h-7 text-primary" />
                <p className="text-sm font-semibold text-foreground m-0">{t('uploadZoneTitle')}</p>
                <span className="text-xs text-muted-foreground">{t('uploadZoneHint')}</span>
                <Button type="button" variant="outline" size="sm" className="mt-1 h-8 px-3 text-xs font-bold">
                  {t('selectFileBtn')}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
                />
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-lg border border-border bg-muted/30 text-xs">
                  <span className="text-muted-foreground">{t('selectedFileLabel')}</span>
                  <strong className="font-mono text-foreground" dir="ltr">{selectedFile.name}</strong>
                </div>
              )}

              {isValidating && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-primary font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('validatingFile')}</span>
                </div>
              )}

              {previewResult && !isValidating && (
                <div className="space-y-3">
                  {/* Summary Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-muted text-foreground border border-border tabular-nums">
                        {t('totalRows')}: {previewResult.totalRows}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 tabular-nums">
                        {t('validRows')}: {previewResult.validRows}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 tabular-nums">
                        {t('invalidRows')}: {previewResult.invalidRows}
                      </span>
                    </div>

                    <div className="inline-flex p-0.5 rounded-lg bg-muted border border-border">
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('ALL')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                          previewFilter === 'ALL' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                        }`}
                      >
                        {t('previewTabAll')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('ERRORS')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                          previewFilter === 'ERRORS' ? 'bg-card text-rose-600 dark:text-rose-400 shadow-2xs' : 'text-muted-foreground'
                        }`}
                      >
                        {t('previewTabErrors')} ({previewResult.invalidRows})
                      </button>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="overflow-x-auto border border-border rounded-xl max-h-72">
                    <table className="w-full text-xs text-start">
                      <thead className="bg-muted/80 sticky top-0 z-10 border-b border-border text-muted-foreground font-bold">
                        <tr>
                          <th className="py-2 px-2.5 text-center">{t('colRow')}</th>
                          <th className="py-2 px-2.5 text-start">{t('colName')}</th>
                          <th className="py-2 px-2.5 text-start">{t('colSku')}</th>
                          <th className="py-2 px-2.5 text-start">{t('colCategory')}</th>
                          <th className="py-2 px-2.5 text-end">{t('colCost')}</th>
                          <th className="py-2 px-2.5 text-end">{t('colSalePrice')}</th>
                          <th className="py-2 px-2.5 text-center">{t('colOpeningQty')}</th>
                          <th className="py-2 px-2.5 text-start">{t('colWarehouse')}</th>
                          <th className="py-2 px-2.5 text-start">{t('colStatus')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {displayedPreviewRows.map(row => (
                          <tr key={row.rowNumber} className={row.isValid ? 'bg-card' : 'bg-rose-500/5'}>
                            <td className="py-2 px-2.5 text-center font-mono tabular-nums">{row.rowNumber}</td>
                            <td className="py-2 px-2.5 font-semibold text-foreground">
                              <bdi dir="auto">{row.name || '—'}</bdi>
                            </td>
                            <td className="py-2 px-2.5 font-mono text-primary" dir="ltr">{row.sku || '—'}</td>
                            <td className="py-2 px-2.5 text-muted-foreground">
                              <bdi dir="auto">{row.category || '—'}</bdi>
                            </td>
                            <td className="py-2 px-2.5 text-end font-mono tabular-nums" dir="ltr">
                              {formatMoney(row.costPrice)}
                            </td>
                            <td className="py-2 px-2.5 text-end font-mono font-bold tabular-nums" dir="ltr">
                              {formatMoney(row.salePrice)}
                            </td>
                            <td className="py-2 px-2.5 text-center font-mono font-bold tabular-nums" dir="ltr">
                              {row.openingQuantity}
                            </td>
                            <td className="py-2 px-2.5 font-mono text-muted-foreground" dir="ltr">
                              {row.warehouseCode || '—'}{row.shelfCode ? ` / ${row.shelfCode}` : ''}
                            </td>
                            <td className="py-2 px-2.5">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{t('statusValid')}</span>
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>{t('statusError')}</span>
                                  </span>
                                  <p className="text-[11px] text-rose-600 dark:text-rose-400 m-0">
                                    {translateErrCode(row.errorCode)}
                                  </p>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Confirm Import */}
          {step === 3 && (
            <div className="space-y-4">
              {finalResult ? (
                <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-foreground m-0">{t('successTitle')}</h4>
                  <p className="text-xs text-muted-foreground m-0">{t('successMessage')}</p>
                  <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pt-2">
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <span className="text-[11px] text-muted-foreground block">{t('importedCountLabel')}</span>
                      <strong className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {finalResult.importedProductsCount}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <span className="text-[11px] text-muted-foreground block">{t('movementsCountLabel')}</span>
                      <strong className="text-lg font-mono font-black text-primary tabular-nums">
                        {finalResult.openingStockMovementsCount}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-border bg-muted/30 space-y-3">
                  <h4 className="text-sm font-bold text-foreground m-0">{t('confirmSummaryTitle')}</h4>
                  <p className="text-xs text-muted-foreground m-0">{t('confirmSummaryDesc')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-card border border-border">
                      <span className="text-[11px] text-muted-foreground block">{t('selectedFileLabel')}</span>
                      <strong className="text-xs font-mono text-foreground block truncate" dir="ltr">
                        {selectedFile?.name}
                      </strong>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border">
                      <span className="text-[11px] text-muted-foreground block">{t('validRows')}</span>
                      <strong className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {previewResult?.validRows ?? 0}
                      </strong>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border">
                      <span className="text-[11px] text-muted-foreground block">{t('movementsCountLabel')}</span>
                      <strong className="text-base font-mono font-bold text-primary tabular-nums">
                        {previewResult?.rows.filter(r => r.isValid && r.openingQuantity > 0).length ?? 0}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between gap-3">
          {finalResult ? (
            <Button type="button" onClick={handleClose} className="ms-auto h-9 px-5 text-xs font-bold">
              {t('closeBtn')}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (step === 1) handleClose();
                  else setStep(step === 3 ? 2 : 1);
                }}
                disabled={isValidating || isImporting}
                className="h-9 px-4 text-xs font-semibold gap-1.5"
              >
                {step > 1 && (isAr ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />)}
                <span>{step === 1 ? getTranslation(lang, 'editProduct.cancel') : t('backBtn')}</span>
              </Button>

              <div className="flex items-center gap-2">
                {step === 1 && (
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    className="h-9 px-4 text-xs font-bold gap-1.5"
                  >
                    <span>{t('nextBtn')}</span>
                    {isAr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </Button>
                )}

                {step === 2 && (
                  <Button
                    type="button"
                    onClick={() => {
                      if (!previewResult || previewResult.totalRows === 0) {
                        setErrorMsg(t('errNoValidFile'));
                        return;
                      }
                      if (previewResult.invalidRows > 0) {
                        setErrorMsg(t('errFixErrorsFirst'));
                        return;
                      }
                      setStep(3);
                    }}
                    disabled={!previewResult || previewResult.invalidRows > 0 || isValidating}
                    className="h-9 px-4 text-xs font-bold gap-1.5"
                  >
                    <span>{t('continueConfirmBtn')}</span>
                    {isAr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </Button>
                )}

                {step === 3 && (
                  <Button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="h-9 px-5 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{isImporting ? t('importingBtn') : t('confirmImportBtn')}</span>
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ModalBackdropPortal>
  );
}
