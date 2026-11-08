import React, { useState } from 'react';
import { 
  Package, X, Printer, Copy, Check, MapPin, 
  DollarSign, TrendingUp, AlertTriangle, ShieldCheck, 
  Plus, Minus, Barcode as BarcodeIcon, Boxes, FileText,
  Lock, Scale
} from 'lucide-react';
import { Product } from '../types/warehouse';
import BarcodeSvg from './BarcodeSvg';
import { localizeCategory, localizeWarehouse, localizeUnit } from '../lib/localeHelpers';
import { useSettings } from '../context/settings-context';

interface ProductDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  lang: string;
  onAdjustStock?: (productId: string, delta: number) => void;
  onOpenAdjustment?: (product: Product) => void;
}

export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  lang,
  onAdjustStock,
  onOpenAdjustment
}: ProductDetailsModalProps) {
  if (!isOpen || !product) return null;

  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const [copied, setCopied] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number>(1);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const profitMargin = product.sellingPrice - product.costPrice;
  const marginPercent = product.costPrice > 0 
    ? ((profitMargin / product.costPrice) * 100).toFixed(1) 
    : '0';

  const isLowStock = product.currentStock <= product.minStockAlert;
  const isOutOfStock = product.currentStock <= 0;

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(product.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Professional isolated print engine:
   * Prevents browser from printing the 3 background pages of the dashboard!
   * Guarantees EXACTLY 1 page for single thermal label, or 1 clean A4 sheet.
   */
  const handlePrintLabel = (mode: 'single' | 'sheet' = 'single') => {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) return;

    const singleStickerHtml = `
      <div class="sticker-card">
        <div class="store-brand">LOGISTOCK ERP • WAREHOUSE</div>
        <div class="product-title" dir="auto">${product.nameAr}</div>
        <div class="sku-row">SKU: <strong>${product.sku}</strong> | REF: ${product.shelf}</div>
        <div class="barcode-graphic">
          <svg viewBox="0 0 100 28" width="100%" height="46" preserveAspectRatio="none">
            <rect x="2" y="0" width="3" height="26" fill="#000" />
            <rect x="7" y="0" width="1.5" height="26" fill="#000" />
            <rect x="11" y="0" width="4" height="26" fill="#000" />
            <rect x="18" y="0" width="2" height="26" fill="#000" />
            <rect x="22" y="0" width="1.5" height="26" fill="#000" />
            <rect x="26" y="0" width="3.5" height="26" fill="#000" />
            <rect x="32" y="0" width="2" height="26" fill="#000" />
            <rect x="36" y="0" width="1" height="26" fill="#000" />
            <rect x="40" y="0" width="4" height="26" fill="#000" />
            <rect x="47" y="0" width="1.5" height="26" fill="#000" />
            <rect x="51" y="0" width="3" height="26" fill="#000" />
            <rect x="56" y="0" width="2" height="26" fill="#000" />
            <rect x="61" y="0" width="1.5" height="26" fill="#000" />
            <rect x="65" y="0" width="4" height="26" fill="#000" />
            <rect x="72" y="0" width="1" height="26" fill="#000" />
            <rect x="75" y="0" width="3" height="26" fill="#000" />
            <rect x="81" y="0" width="2" height="26" fill="#000" />
            <rect x="85" y="0" width="3.5" height="26" fill="#000" />
            <rect x="91" y="0" width="1.5" height="26" fill="#000" />
            <rect x="95" y="0" width="3" height="26" fill="#000" />
          </svg>
        </div>
        <div class="barcode-number">${product.barcode}</div>
        <div class="footer-price">
          <span class="wh-tag">${product.warehouseName.slice(0, 18)}</span>
          <span class="price-val">${formatMoney(Number(product.sellingPrice))}</span>
        </div>
      </div>
    `;

    const sheetHtml = Array.from({ length: 12 }, () => singleStickerHtml).join('');

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html dir="${isAr ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8" />
        <title>Barcode - ${product.sku}</title>
        <style>
          @page {
            size: ${mode === 'single' ? '70mm 45mm' : 'A4'};
            margin: ${mode === 'single' ? '0' : '8mm'};
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #fff;
            color: #000;
            display: flex;
            ${mode === 'single' 
              ? 'justify-content: center; align-items: center; width: 100vw; height: 100vh; overflow: hidden;' 
              : 'flex-wrap: wrap; gap: 8mm; justify-content: center;'}
          }
          .sticker-card {
            width: ${mode === 'single' ? '66mm' : '62mm'};
            height: ${mode === 'single' ? '41mm' : '38mm'};
            border: 1px dashed #888;
            border-radius: 4px;
            padding: 2.5mm 3mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
            background: #fff;
            page-break-inside: avoid;
          }
          .store-brand {
            font-size: 6.5pt;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #555;
            text-transform: uppercase;
          }
          .product-title {
            font-size: 8.5pt;
            font-weight: 700;
            color: #000;
            line-height: 1.15;
            max-width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin: 1mm 0 0.5mm 0;
          }
          .sku-row {
            font-size: 6.5pt;
            color: #444;
            margin-bottom: 1mm;
          }
          .barcode-graphic {
            width: 90%;
            height: 14mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .barcode-number {
            font-family: monospace;
            font-size: 8.5pt;
            font-weight: 800;
            letter-spacing: 2px;
            color: #000;
            margin-top: 0.5mm;
          }
          .footer-price {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 0.5px solid #bbb;
            padding-top: 1mm;
            margin-top: 1mm;
            font-size: 7.5pt;
          }
          .wh-tag { color: #555; font-size: 6pt; }
          .price-val { font-weight: 900; font-size: 9.5pt; color: #000; }
        </style>
      </head>
      <body>
        ${mode === 'single' ? singleStickerHtml : sheetHtml}
      </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 2000);
    }, 250);
  };

  const handleAdjust = (delta: number) => {
    const qty = delta * adjustAmount;
    if (delta < 0 && product.currentStock < Math.abs(qty)) {
      setFeedbackMsg(isAr ? 'الرصيد المتوفر غير كافٍ للصرف!' : 'Insufficient stock to dispatch!');
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }
    if (onAdjustStock) {
      onAdjustStock(product.id, qty);
    }
    setFeedbackMsg(
      delta > 0 
        ? (isAr ? `تمت إضافة ${qty} وحدة للمخزن بنجاح` : `Added ${qty} units successfully`)
        : (isAr ? `تم صرف ${Math.abs(qty)} وحدة من المخزن بنجاح` : `Dispatched ${Math.abs(qty)} units successfully`)
    );
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div 
        className="modal-content glass-panel product-details-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pdm-header">
          <div className="pdm-title-flex">
            <div className="pdm-icon-badge">
              <Package size={22} className="text-cyan" />
            </div>
            <div>
              <div className="pdm-meta-row">
                <span className="pdm-sku-tag">{product.sku}</span>
                <span className="pdm-category-tag">{localizeCategory(product.category, isAr ? 'ar' : 'en')}</span>
                <span className={`status-pill ${isOutOfStock ? 'status-danger' : isLowStock ? 'status-pending' : 'status-active'}`}>
                  {isOutOfStock 
                    ? (isAr ? 'نافد من المخزن' : 'Out of Stock') 
                    : isLowStock 
                      ? (isAr ? 'قرب النفاد' : 'Low Stock') 
                      : (isAr ? 'متوفر ومتاح' : 'In Stock')}
                </span>
              </div>
              <h2 className="pdm-product-title">
                <span dir="auto">{product.nameAr}</span>
              </h2>
            </div>
          </div>
          <button className="icon-circle-btn pdm-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="pdm-alert-box fade-in">
            <ShieldCheck size={16} />
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="pdm-body-grid">
          {/* Printable Barcode Label Card */}
          <div className="pdm-barcode-card">
            <div className="barcode-card-header">
              <div className="flex-center gap-6 text-muted">
                <BarcodeIcon size={16} />
                <span className="text-xs font-semibold">
                  {isAr ? 'ملصق الباركود المعتمد' : 'Official Barcode Label'}
                </span>
              </div>
              <div className="barcode-actions-btns">
                <button 
                  type="button" 
                  className="pdm-mini-btn" 
                  onClick={handleCopyBarcode}
                  title={isAr ? 'نسخ رقم الباركود' : 'Copy barcode'}
                >
                  {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                  <span>{copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}</span>
                </button>
                <button 
                  type="button" 
                  className="pdm-mini-btn btn-print-primary" 
                  onClick={() => handlePrintLabel('single')}
                  title={isAr ? 'طباعة ملصق حراري مفرد (صفحة واحدة فقط)' : 'Print 1 Thermal Sticker (Exactly 1 page)'}
                >
                  <Printer size={14} />
                  <span>{isAr ? 'طباعة ملصق' : 'Print Label'}</span>
                </button>
                <button 
                  type="button" 
                  className="pdm-mini-btn" 
                  onClick={() => handlePrintLabel('sheet')}
                  title={isAr ? 'طباعة ورقة A4 كاملة (12 ملصق)' : 'Print A4 Sheet (12 labels)'}
                >
                  <FileText size={14} />
                  <span>{isAr ? 'ورقة A4' : 'A4 Sheet'}</span>
                </button>
              </div>
            </div>

            {/* Visual Barcode Box */}
            <div id="printable-barcode-surface" className="barcode-visual-surface">
              <div className="barcode-product-subname" dir="auto">
                {product.nameAr}
              </div>
              <div className="barcode-svg-wrapper">
                <BarcodeSvg value={product.barcode} width={240} height={56} color="#000000" />
              </div>
              <div className="barcode-code-digits">
                {product.barcode}
              </div>
              <div className="barcode-price-tag">
                {formatMoney(Number(product.sellingPrice))}
              </div>
            </div>
          </div>

          {/* Location & Stock Summary Tiles */}
          <div className="pdm-stats-column">
            {/* Location Tile */}
            <div className="pdm-stat-card">
              <div className="stat-card-label">
                <MapPin size={15} className="text-cyan" />
                <span>{isAr ? 'موقع التخزين والمستودع' : 'Storage Location'}</span>
              </div>
              <div className="stat-card-main-val">
                <bdi dir="auto">{product.warehouseName}</bdi>
              </div>
              <div className="stat-card-sub">
                <span>{isAr ? 'الرف المخصص:' : 'Shelf:'}</span>
                <span className="pdm-shelf-badge">{product.shelf}</span>
              </div>
            </div>

            {/* Financials Tile */}
            <div className="pdm-stat-card">
              <div className="stat-card-label">
                <DollarSign size={15} className="text-emerald" />
                <span>{isAr ? 'الأسعار وهوامش الربح' : 'Pricing & Margin'}</span>
              </div>
              <div className="pdm-prices-row">
                <div>
                  <span className="sub-label">{isAr ? 'التكلفة:' : 'Cost:'}</span>
                  <span className="val-text">{formatMoney(Number(product.costPrice))}</span>
                </div>
                <div>
                  <span className="sub-label">{isAr ? 'البيع:' : 'Selling:'}</span>
                  <span className="val-text text-emerald font-bold">{formatMoney(Number(product.sellingPrice))}</span>
                </div>
                <div className="profit-margin-pill">
                  <TrendingUp size={12} />
                  <span>+{marginPercent}%</span>
                </div>
              </div>
            </div>

            {/* Stock Quantities Breakdown */}
            <div className="pdm-stat-card">
              <div className="stat-card-label">
                <Boxes size={15} className="text-cyan" />
                <span>{isAr ? 'تفاصيل الرصيد المخزني' : 'Stock Breakdown'}</span>
              </div>
              <div className="stock-breakdown-row">
                <div className="stock-col">
                  <span className="sub-label">{isAr ? 'الرصيد الفعلي' : 'On Hand'}</span>
                  <strong className="stock-num text-white">{product.currentStock}</strong>
                </div>
                <div className="stock-col">
                  <span className="sub-label">{isAr ? 'محجوز' : 'Reserved'}</span>
                  <strong className="stock-num text-muted">0.00</strong>
                </div>
                <div className="stock-col">
                  <span className="sub-label">{isAr ? 'المتاح للبيع' : 'Available'}</span>
                  <strong className="stock-num text-emerald">{product.currentStock}</strong>
                </div>
                <div className="stock-col">
                  <span className="sub-label">{isAr ? 'حد التنبيه' : 'Min Alert'}</span>
                  <strong className="stock-num text-warning">{product.minStockAlert}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audited Stock Adjustment Action & Policy Banner */}
        <div 
          className="pdm-footer-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            marginTop: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '460px' }}>
            <div 
              style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '8px', 
                background: 'rgba(59, 130, 246, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Lock size={18} style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--foreground)' }}>
                  {isAr ? 'قيد التعديل المباشر - نظام التدقيق المحاسبي' : 'Direct Edit Locked - Audit Trail'}
                </span>
                <span 
                  style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    fontWeight: 700
                  }}
                >
                  {isAr ? 'محمي' : 'Protected'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                {isAr
                  ? 'لا يمكن تعديل الرصيد يدوياً بدون إثبات حركة. لتسجيل فائض، عجز، أو تالف، افتح نافذة التسوية المعتمدة.'
                  : 'Manual stock overwrite is disabled. Use audited stock adjustment for surplus, deficit or write-off.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="pdm-action-btn"
              onClick={() => {
                onClose();
                if (onOpenAdjustment) {
                  onOpenAdjustment(product);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: '#3b82f6',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(59, 130, 246, 0.25)'
              }}
            >
              <Scale size={16} />
              <span>{isAr ? 'تسوية مخزنية (Stock Adjustment)' : 'Stock Adjustment'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
