import React, { useState } from 'react';
import { X, Printer, Barcode, CheckCircle2, Copy } from 'lucide-react';
import { PurchaseInvoiceItem } from '../../types/purchases';
import BarcodeSvg from '../BarcodeSvg';

interface PrintBarcodeLabelsModalProps {
  items: PurchaseInvoiceItem[];
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
  billNumber?: string;
  warehouseName?: string;
}

export default function PrintBarcodeLabelsModal({
  items,
  isOpen,
  onClose,
  lang = 'ar',
  billNumber = '',
  warehouseName = ''
}: PrintBarcodeLabelsModalProps) {
  const isAr = lang === 'ar';

  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (items && items.length > 0) {
      items.forEach(it => {
        map[it.id] = it.quantity || 1;
      });
    }
    return map;
  });

  if (!isOpen || !items || items.length === 0) return null;

  const totalLabels = Object.values(quantities).reduce((acc, q) => acc + (q || 0), 0);

  const handlePrint = () => {
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

    const stickersHtml = items.map(item => {
      const count = quantities[item.id] || 1;
      const singleSticker = `
        <div class="sticker-card">
          <div class="store-brand">ZILOX ERP • WAREHOUSE & INVENTORY</div>
          <div class="product-title" dir="auto">${item.nameAr}</div>
          <div class="sku-row">SKU: <strong>${item.sku}</strong> | الوحدة: ${item.uom}</div>
          <div class="barcode-graphic">
            <svg viewBox="0 0 100 28" width="100%" height="40" preserveAspectRatio="none">
              <rect width="100%" height="100%" fill="#fff"/>
              <path d="M4 0h2v28H4z M8 0h3v28H8z M13 0h1v28h-1z M16 0h4v28h-4z M22 0h2v28h-2z M26 0h1v28h-1z M29 0h3v28h-3z M34 0h2v28h-2z M38 0h4v28h-4z M44 0h1v28h-1z M47 0h3v28h-3z M52 0h2v28h-2z M56 0h4v28h-4z M62 0h1v28h-1z M65 0h2v28h-2z M69 0h3v28h-3z M74 0h2v28h-2z M78 0h4v28h-4z M84 0h1v28h-1z M87 0h3v28h-3z M92 0h2v28h-2z M96 0h2v28h-2z" fill="#000"/>
            </svg>
          </div>
          <div class="barcode-number">${item.barcode}</div>
          <div class="price-row">سعر البيع: $${item.newSellingPrice || item.currentSellingPrice || 0}</div>
          <div class="location-shelf">المستودع: ${warehouseName || 'المخزن الرئيسي'}</div>
        </div>
      `;
      return Array(count).fill(singleSticker).join('');
    }).join('');

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>طباعة ملصقات الباركود - ${billNumber}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; direction: rtl; }
          .sheet-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6mm;
            padding: 4mm;
          }
          .sticker-card {
            border: 1px dashed #94a3b8;
            border-radius: 6px;
            padding: 8px;
            box-sizing: border-box;
            background: #fff;
            text-align: center;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 120px;
          }
          .store-brand {
            font-size: 8px;
            font-weight: 700;
            color: #64748b;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 2px;
          }
          .product-title {
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
            margin: 4px 0 2px;
            line-height: 1.2;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .sku-row {
            font-size: 9px;
            color: #475569;
            margin-bottom: 3px;
          }
          .barcode-graphic {
            margin: 2px 0;
            display: flex;
            justify-content: center;
          }
          .barcode-number {
            font-family: monospace;
            font-size: 10px;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: 2px;
          }
          .price-row {
            font-size: 10px;
            font-weight: 800;
            color: #047857;
            margin-top: 2px;
          }
          .location-shelf {
            font-size: 8px;
            color: #64748b;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        <div class="sheet-grid">
          ${stickersHtml}
        </div>
      </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    }, 400);
  };

  return (
    <div className="modal-backdrop fade-in" style={{ zIndex: 100070 }} onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div 
        className="invoice-clean-modal" 
        style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', background: 'var(--card)', color: 'var(--foreground)' }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="invoice-modal-header">
          <div className="invoice-header-info">
            <div className="invoice-header-title-wrap">
              <h3 className="invoice-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Barcode size={20} style={{ color: '#047857' }} />
                <span>{isAr ? 'طباعة ملصقات الباركود للمواد المشتراة' : 'Print Barcode Labels for Received Items'}</span>
              </h3>
              <span className="invoice-ref-tag" style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>
                {totalLabels} {isAr ? 'ملصق' : 'Labels'}
              </span>
            </div>
            <p className="invoice-modal-desc">
              {isAr 
                ? `قائمة المشتريات: ${billNumber || 'مشتريات جديدة'} • المستودع: ${warehouseName || 'المركزي'}` 
                : `Bill: ${billNumber || 'New Purchase'} • Warehouse: ${warehouseName}`}
            </p>
          </div>

          <button 
            type="button"
            className="invoice-close-btn" 
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content & Items List */}
        <div className="invoice-modal-form" style={{ padding: '4px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span>{isAr ? 'تعديل عدد النسخ لكل مادة بناءً على الكمية المستلمة الفورية:' : 'Adjust copies per received item:'}</span>
            <span style={{ fontWeight: 800, color: '#047857' }}>{items.length} مواد مشمولة</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map(item => {
              const currentCopies = quantities[item.id] ?? item.quantity;
              return (
                <div 
                  key={item.id} 
                  style={{
                    background: 'var(--card)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', width: '130px', textAlign: 'center' }}>
                      <BarcodeSvg value={item.barcode} width={110} height={24} color="#000000" />
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '1px', marginTop: '2px' }}>
                        {item.barcode}
                      </div>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>{item.nameAr}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                        <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>SKU: {item.sku}</span>
                        <span>الوحدة: {item.uom}</span>
                        <span style={{ color: '#047857', fontWeight: 700 }}>سعر البيع: ${item.newSellingPrice || item.currentSellingPrice || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{isAr ? 'عدد النسخ:' : 'Copies:'}</span>
                    <input 
                      type="number"
                      min="1"
                      max="1000"
                      value={currentCopies}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setQuantities(prev => ({ ...prev, [item.id]: val }));
                      }}
                      style={{
                        width: '65px',
                        padding: '6px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 800,
                        textAlign: 'center',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e2e8f0', marginTop: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {isAr ? 'جاهز للطباعة الحرارية ومقاس A4' : 'Ready for Thermal & A4 sticker sheets'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'var(--card)',
                color: '#64748b',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                background: '#047857',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(4, 120, 87, 0.35)'
              }}
            >
              <Printer size={15} />
              <span>{isAr ? `طباعة الآن (${totalLabels} ملصق)` : `Print Now (${totalLabels})`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
