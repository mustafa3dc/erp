import React from 'react';
import { X, Printer, Barcode, CheckCircle2 } from 'lucide-react';
import { Product } from '../../types/warehouse';
import BarcodeSvg from '../BarcodeSvg';

interface BatchPrintLabelsModalProps {
  selectedProducts: Product[];
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
}

export default function BatchPrintLabelsModal({
  selectedProducts,
  isOpen,
  onClose,
  lang = 'ar'
}: BatchPrintLabelsModalProps) {
  if (!isOpen || selectedProducts.length === 0) return null;
  const isAr = lang === 'ar';

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

    const stickersHtml = selectedProducts.map(p => `
      <div class="sticker-card">
        <div class="store-brand">LOGISTOCK ERP • WAREHOUSE</div>
        <div class="product-title" dir="auto">${p.nameAr}</div>
        <div class="sku-row">SKU: <strong>${p.sku}</strong> | REF: ${p.shelf}</div>
        <div class="barcode-graphic">
          <svg viewBox="0 0 100 28" width="100%" height="44" preserveAspectRatio="none">
            <rect width="100%" height="100%" fill="#fff"/>
            <path d="M4 0h2v28H4z M8 0h3v28H8z M13 0h1v28h-1z M16 0h4v28h-4z M22 0h2v28h-2z M26 0h1v28h-1z M29 0h3v28h-3z M34 0h2v28h-2z M38 0h4v28h-4z M44 0h1v28h-1z M47 0h3v28h-3z M52 0h2v28h-2z M56 0h4v28h-4z M62 0h1v28h-1z M65 0h2v28h-2z M69 0h3v28h-3z M74 0h2v28h-2z M78 0h4v28h-4z M84 0h1v28h-1z M87 0h3v28h-3z M92 0h2v28h-2z M96 0h2v28h-2z" fill="#000"/>
          </svg>
        </div>
        <div class="barcode-number">${p.barcode}</div>
        <div class="location-shelf">LOC: ${p.warehouseName} [${p.shelf}]</div>
      </div>
    `).join('');

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Batch Print Barcodes</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
          .sheet-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8mm;
          }
          .sticker-card {
            border: 1px dashed #777;
            padding: 8px;
            border-radius: 4px;
            text-align: center;
            box-sizing: border-box;
            page-break-inside: avoid;
          }
          .store-brand { font-size: 8px; font-weight: bold; letter-spacing: 1px; color: #444; margin-bottom: 4px; }
          .product-title { font-size: 11px; font-weight: bold; margin-bottom: 4px; max-height: 28px; overflow: hidden; }
          .sku-row { font-size: 9px; margin-bottom: 4px; font-family: monospace; }
          .barcode-graphic { margin: 4px 0; }
          .barcode-number { font-family: monospace; font-size: 10px; font-weight: bold; letter-spacing: 2px; }
          .location-shelf { font-size: 8px; color: #555; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="sheet-grid">${stickersHtml}</div>
      </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => document.body.removeChild(printFrame), 1000);
    }, 250);
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="icon-circle-badge emerald">
              <Barcode size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                {isAr ? 'طباعة ملصقات الباركود الجماعية' : 'Batch Barcode Label Sheet'}
              </h3>
              <small style={{ color: '#94a3b8' }}>
                {isAr ? `تم تحديد ${selectedProducts.length} صنف لطباعة ملصقات الرفوف` : `Ready to print labels for ${selectedProducts.length} items`}
              </small>
            </div>
          </div>
          <button className="icon-circle-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-form-body">
          <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {selectedProducts.map(p => (
                <div key={p.id} className="glass-panel" style={{ padding: '10px', textAlign: 'center', background: '#ffffff', color: '#000000', borderRadius: '6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#475569', letterSpacing: '0.5px' }}>LOGISTOCK ERP</div>
                  <strong style={{ fontSize: '11px', display: 'block', margin: '4px 0', color: '#0f172a' }}>
                    <bdi dir="auto">{p.nameAr}</bdi>
                  </strong>
                  <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#334155' }}>
                    SKU: {p.sku} | {p.shelf}
                  </div>
                  <div style={{ margin: '6px 0' }}>
                    <BarcodeSvg value={p.barcode} width={80} height={20} color="#000000" />
                  </div>
                  <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{p.barcode}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
            <button type="button" className="btn-add-primary" onClick={handlePrint}>
              <Printer size={16} />
              <span>{isAr ? `طباعة الملصقات (${selectedProducts.length})` : `Print Labels (${selectedProducts.length})`}</span>
            </button>
            <button type="button" className="btn-secondary-flat" onClick={onClose}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
