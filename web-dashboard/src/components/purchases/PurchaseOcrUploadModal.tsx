import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Upload,
  Camera,
  X,
  AlertTriangle,
  FileText,
  Loader2
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

const normalizeMatchText = (input?: string | null): string => {
  if (!input) return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const levenshteinDistance = (a: string, b: string): number => {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  let curr = new Array<number>(m + 1);
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
};

const computeNameSimilarity = (a: string, b: string): number => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));
  let inter = 0;
  setA.forEach(tok => { if (setB.has(tok)) inter++; });
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union > 0 ? inter / union : 0;
  const maxLen = Math.max(a.length, b.length);
  const lev = maxLen > 0 ? 1 - levenshteinDistance(a, b) / maxLen : 0;
  return Math.max(jaccard, lev);
};

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
      const nameNorm = normalizeMatchText(item.rawItemName);
      const nonBundles = products.filter(p => !p.isBundle);

      let matched: Product | undefined;
      let conf: 'High' | 'Low' | 'None' = 'None';

      if (code) {
        // Strict rule: if Barcode/SKU is present, match ONLY on exact Barcode/SKU.
        // Never fall back to fuzzy text matching against unrelated catalog products.
        matched = nonBundles.find(
          p => (p.barcode || '').trim().toLowerCase() === code || (p.sku || '').trim().toLowerCase() === code
        );
        if (matched) conf = 'High';
      } else if (nameNorm) {
        let bestScore = 0;
        let bestCand: Product | undefined;
        for (const p of nonBundles) {
          const score = Math.max(
            computeNameSimilarity(nameNorm, normalizeMatchText(p.nameAr)),
            p.nameEn ? computeNameSimilarity(nameNorm, normalizeMatchText(p.nameEn)) : 0
          );
          if (score > bestScore) {
            bestScore = score;
            bestCand = p;
          }
        }
        if (bestCand && bestScore >= 0.85) {
          matched = bestCand;
          conf = 'High';
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

  const errorText = errorCode
    ? getTranslation(lang, `ui.purchaseOcr.errors.${errorCode}`, getTranslation(lang, 'ui.purchaseOcr.errors.ERR_AI_SCAN_UNAVAILABLE'))
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
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{errorText}</span>
            <button type="button" onClick={() => setErrorCode(null)} className="cursor-pointer opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
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
