import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Upload,
  Camera,
  X,
  AlertTriangle,
  FileText,
  Loader2,
  KeyRound,
  CheckCircle2
} from 'lucide-react';
import { Product } from '../../types/warehouse';
import { getStoredSuppliers } from '../../services/storageService';
import { getTranslation } from '../../lib/i18n';
import { ModalBackdropPortal } from '../ui/dialog';

export interface ExtractedPurchaseInvoiceItem {
  rawItemName: string;
  barcodeOrSku?: string | null;
  quantity: number;
  unitCostPrice: number;
  lineTotal: number;
  matchedProductId?: string | null;
  matchedProductName?: string | null;
  matchedProductSku?: string | null;
  matchedProductBarcode?: string | null;
  matchConfidence: 'High' | 'Low' | 'None';
  warehouseStock: number;
  unitOfMeasure: string;
  currentSellingPrice: number;
}

export interface ExtractedPurchaseInvoicePayload {
  supplierName?: string | null;
  matchedSupplierId?: string | null;
  matchedSupplierName?: string | null;
  supplierMatchConfidence: 'High' | 'Low' | 'None';
  supplierInvoiceNumber?: string | null;
  invoiceDate?: string | null;
  currency: 'IQD' | 'USD' | string;
  invoiceDiscount: number;
  items: ExtractedPurchaseInvoiceItem[];
}

export interface OcrReviewSessionData {
  extracted: ExtractedPurchaseInvoicePayload;
  fileUrl: string;
  mimeType: string;
  fileName: string;
}

interface PurchaseOcrUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
  products: Product[];
  defaultWarehouseId?: string;
  onExtracted: (session: OcrReviewSessionData) => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT_REGEX = /\.(jpg|jpeg|png|webp|pdf)$/i;
const ALLOWED_MIME_SET = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

export default function PurchaseOcrUploadModal({
  isOpen,
  onClose,
  lang,
  products,
  defaultWarehouseId,
  onExtracted
}: PurchaseOcrUploadModalProps) {
  const isAr = lang === 'ar';
  const tr = (k: string) => getTranslation(lang, `ui.purchaseOcr.${k}`);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyActivatedNotice, setKeyActivatedNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const enrichReadOnlyMatches = (raw: ExtractedPurchaseInvoicePayload): ExtractedPurchaseInvoicePayload => {
    const localSuppliers = getStoredSuppliers();
    let matchedSupId = raw.matchedSupplierId || null;
    let matchedSupName = raw.matchedSupplierName || null;
    let supConfidence: 'High' | 'Low' | 'None' = raw.supplierMatchConfidence || 'None';

    if (!matchedSupId && raw.supplierName?.trim()) {
      const q = raw.supplierName.trim().toLowerCase();
      const sup = localSuppliers.find(
        s => s.company.toLowerCase() === q || s.company.toLowerCase().includes(q) || q.includes(s.company.toLowerCase())
      );
      if (sup) {
        matchedSupId = sup.id;
        matchedSupName = sup.company;
        supConfidence = sup.company.toLowerCase() === q ? 'High' : 'Low';
      }
    }

    const enrichedItems: ExtractedPurchaseInvoiceItem[] = (raw.items || []).map(item => {
      if (item.matchedProductId) return item;
      const code = (item.barcodeOrSku || '').trim().toLowerCase();
      const nameNorm = (item.rawItemName || '').trim().toLowerCase();
      const nonBundles = products.filter(p => !p.isBundle);

      let matched = code
        ? nonBundles.find(p => (p.barcode || '').toLowerCase() === code || (p.sku || '').toLowerCase() === code)
        : undefined;
      let conf: 'High' | 'Low' | 'None' = matched ? 'High' : 'None';

      if (!matched && nameNorm) {
        matched = nonBundles.find(
          p =>
            p.nameAr.toLowerCase() === nameNorm ||
            (p.nameEn && p.nameEn.toLowerCase() === nameNorm) ||
            p.nameAr.toLowerCase().includes(nameNorm) ||
            nameNorm.includes(p.nameAr.toLowerCase())
        );
        if (matched) {
          conf = matched.nameAr.toLowerCase() === nameNorm ? 'High' : 'Low';
        }
      }

      return {
        ...item,
        matchedProductId: matched?.id || null,
        matchedProductName: matched ? (isAr ? matched.nameAr : (matched.nameEn || matched.nameAr)) : null,
        matchedProductSku: matched?.sku || null,
        matchedProductBarcode: matched?.barcode || null,
        matchConfidence: conf,
        warehouseStock: matched ? Number(matched.currentStock) || 0 : 0,
        unitOfMeasure: matched?.unit || item.unitOfMeasure || (isAr ? 'قطعة' : 'Piece'),
        currentSellingPrice: matched ? Number(matched.sellingPrice) || 0 : 0
      };
    });

    return {
      ...raw,
      matchedSupplierId: matchedSupId,
      matchedSupplierName: matchedSupName,
      supplierMatchConfidence: supConfidence,
      items: enrichedItems
    };
  };

  const processSelectedFile = async (file: File) => {
    setErrorCode(null);

    if (!ALLOWED_EXT_REGEX.test(file.name) && !ALLOWED_MIME_SET.has(file.type)) {
      setErrorCode('ERR_INVALID_FILE_FORMAT');
      return;
    }

    if (file.size <= 0) {
      setErrorCode('ERR_INVALID_FILE_FORMAT');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorCode('ERR_FILE_TOO_LARGE');
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (defaultWarehouseId && uuidRegex.test(defaultWarehouseId)) {
        formData.append('warehouseId', defaultWarehouseId);
      }

      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('zilox_auth_token') || localStorage.getItem('logistock_erp_jwt_token'))
        : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/purchases/extract-from-image', {
        method: 'POST',
        headers,
        body: formData
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorCode(body?.errorCode || 'ERR_OCR_EXTRACTION_FAILED');
        return;
      }

      const enriched = enrichReadOnlyMatches(body as ExtractedPurchaseInvoicePayload);
      const fileUrl = URL.createObjectURL(file);
      onExtracted({
        extracted: enriched,
        fileUrl,
        mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        fileName: file.name
      });
    } catch {
      setErrorCode('ERR_OCR_UPSTREAM_FAILED');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) processSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isAnalyzing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handleSaveApiKey = async () => {
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setErrorCode('ERR_OCR_API_KEY_REQUIRED');
      return;
    }

    setIsSavingKey(true);
    setKeyActivatedNotice(null);
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('zilox_auth_token') || localStorage.getItem('logistock_erp_jwt_token'))
        : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/purchases/ocr-settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ apiKey: cleanKey })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorCode(body?.errorCode || 'ERR_OCR_EXTRACTION_FAILED');
        return;
      }

      setErrorCode(null);
      setApiKeyInput('');
      setKeyActivatedNotice(tr('keySavedToast'));
    } catch {
      setErrorCode('ERR_OCR_UPSTREAM_FAILED');
    } finally {
      setIsSavingKey(false);
    }
  };

  const errorText = errorCode
    ? (errorCode === 'ERR_OCR_API_KEY_REQUIRED'
        ? tr('errApiKeyRequired')
        : getTranslation(lang, `ui.purchaseOcr.errors.${errorCode}`, getTranslation(lang, 'ui.purchaseOcr.errors.ERR_OCR_EXTRACTION_FAILED')))
    : null;

  return (
    <ModalBackdropPortal onClose={() => { if (!isAnalyzing) onClose(); }} dir={isAr ? 'rtl' : 'ltr'}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground m-0">{tr('uploadModalTitle')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 m-0 leading-relaxed">{tr('uploadModalSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Banner */}
        {errorText && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{errorText}</span>
              <button type="button" onClick={() => setErrorCode(null)} className="cursor-pointer opacity-70 hover:opacity-100">
                <X size={14} />
              </button>
            </div>

            {errorCode === 'ERR_OCR_SERVICE_NOT_CONFIGURED' && (
              <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <KeyRound className="w-4 h-4 text-primary shrink-0" />
                  <span>{tr('configureKeyTitle')}</span>
                </div>
                <p className="text-[11px] text-muted-foreground m-0 leading-relaxed">{tr('configureKeyHint')}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={tr('apiKeyPlaceholder')}
                    dir="ltr"
                    className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    disabled={isSavingKey}
                    onClick={handleSaveApiKey}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isSavingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{isSavingKey ? tr('savingKeyBtn') : tr('saveAndActivateKeyBtn')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {keyActivatedNotice && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="flex-1">{keyActivatedNotice}</span>
          </div>
        )}

        {/* Loading Skeleton / Analyzing State vs Dropzone */}
        {isAnalyzing ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{tr('analyzingTitle')}</div>
                <p className="text-xs text-muted-foreground m-0 mt-0.5">{tr('analyzingSubtitle')}</p>
              </div>
            </div>
            <div className="space-y-2.5 pt-2">
              <div className="h-3 rounded-full bg-primary/15 w-3/4 animate-pulse" />
              <div className="h-10 rounded-xl bg-muted/60 w-full animate-pulse" />
              <div className="h-10 rounded-xl bg-muted/50 w-full animate-pulse" />
              <div className="h-10 rounded-xl bg-muted/40 w-5/6 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer space-y-3 ${
                isDragging
                  ? 'border-primary bg-primary/10 scale-[0.99]'
                  : 'border-border hover:border-primary/60 hover:bg-muted/30'
              }`}
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground m-0">{tr('dropzoneTitle')}</p>
                <p className="text-xs text-muted-foreground m-0 flex items-center justify-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{tr('dropzoneHint')}</span>
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileInput}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleFileInput}
              className="hidden"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{tr('browseFileBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card text-foreground text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-primary" />
                  <span>{tr('captureCameraBtn')}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {tr('cancelReviewBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalBackdropPortal>
  );
}
