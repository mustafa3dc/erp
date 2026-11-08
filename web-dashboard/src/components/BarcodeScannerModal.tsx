import React, { useState } from 'react';
import { QrCode, X, Search, CheckCircle, AlertCircle, Plus, Minus, MapPin, Tag, DollarSign, Package, Scale, Lock } from 'lucide-react';
import { Product } from '../types/warehouse';
import { useSettings } from '../context/settings-context';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialBarcode?: string;
  lang: string;
  onAdjustStock: (productId: string, delta: number) => void;
  onOpenAdjustment?: (product: Product) => void;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  products,
  initialBarcode = '',
  lang,
  onAdjustStock,
  onOpenAdjustment
}: BarcodeScannerModalProps) {
  if (!isOpen) return null;

  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const [barcodeInput, setBarcodeInput] = useState(initialBarcode || '8806091234567');
  const [scannedProduct, setScannedProduct] = useState<Product | undefined>(
    products.find(p => p.barcode === (initialBarcode || '8806091234567'))
  );

  const handleScanLookup = (code: string) => {
    const trimmed = code.trim();
    setBarcodeInput(trimmed);
    const found = products.find(
      p => p.barcode.toLowerCase() === trimmed.toLowerCase() || 
           p.sku.toLowerCase() === trimmed.toLowerCase()
    );
    setScannedProduct(found);
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div 
        className="modal-content glass-panel scanner-modal-container" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="scanner-modal-header">
          <div className="scanner-title-box">
            <div className="scanner-icon-badge">
              <QrCode size={22} className="text-cyan" />
            </div>
            <div>
              <h3 className="scanner-modal-title">
                {isAr ? 'محاكي قارئ وماسح الباركود السريع' : 'Quick Barcode Scanner Simulator'}
              </h3>
              <p className="scanner-modal-subtitle">
                {isAr ? 'فحص ومطابقة المنتجات وإدارة الرصيد لحظياً' : 'Instant product verification & real-time inventory adjustments'}
              </p>
            </div>
          </div>
          <button className="icon-circle-btn scanner-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder simulation with laser beam */}
        <div className="scanner-viewfinder-box">
          <div className="viewfinder-grid-overlay"></div>
          <div className="scanner-laser-line"></div>
          
          <div className="viewfinder-corner top-left"></div>
          <div className="viewfinder-corner top-right"></div>
          <div className="viewfinder-corner bottom-left"></div>
          <div className="viewfinder-corner bottom-right"></div>
          
          <div className="scanner-aim-guide">
            <QrCode size={36} className="aim-icon" />
            <span className="scanner-status-pulse">
              {isAr ? 'وجّه كاميرا القارئ أو امسح الباركود' : 'Point barcode sensor or type number below'}
            </span>
          </div>
        </div>

        {/* Input Bar */}
        <div className="scanner-input-container">
          <div className="scanner-input-wrapper">
            <QrCode size={18} className="scanner-input-icon text-muted" />
            <input 
              type="text" 
              className="scanner-code-input"
              placeholder={isAr ? 'أدخل أو امسح الباركود هنا (مثال: 8806091234567)...' : 'Scan or type barcode / SKU...'}
              value={barcodeInput}
              onChange={(e) => handleScanLookup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleScanLookup(barcodeInput);
              }}
              autoFocus
            />
          </div>
          <button 
            type="button"
            className="scanner-lookup-btn" 
            onClick={() => handleScanLookup(barcodeInput)}
          >
            <Search size={16} />
            <span>{isAr ? 'مطابقة الصنف' : 'Lookup'}</span>
          </button>
        </div>


        {/* Scanned Product Result */}
        {scannedProduct ? (
          <div className="scanned-card-wrapper fade-in">
            {/* Top Bar: SKU + Match Badge */}
            <div className="scanned-card-header">
              <div className="sku-tag-box">
                <span className="sku-label">SKU</span>
                <span className="sku-value">{scannedProduct.sku}</span>
              </div>
              <div className="match-status-badge">
                <CheckCircle size={15} />
                <span>{isAr ? 'تمت المطابقة بنجاح' : 'Product Matched'}</span>
              </div>
            </div>

            {/* Product Title */}
            <h4 className="scanned-product-heading">
              <span dir="auto">{scannedProduct.nameAr}</span>
            </h4>

            {/* Metrics Grid */}
            <div className="scanned-metrics-grid">
              <div className="scanned-metric-tile">
                <div className="metric-tile-header">
                  <MapPin size={14} className="text-cyan" />
                  <span>{isAr ? 'المستودع' : 'Warehouse'}</span>
                </div>
                <div className="metric-tile-value text-white">
                  <bdi>{scannedProduct.warehouseName}</bdi>
                </div>
              </div>

              <div className="scanned-metric-tile">
                <div className="metric-tile-header">
                  <Package size={14} className="text-cyan" />
                  <span>{isAr ? 'موقع الرف' : 'Shelf Location'}</span>
                </div>
                <div className="metric-tile-value">
                  <span className="shelf-location-chip">{scannedProduct.shelf}</span>
                </div>
              </div>

              <div className="scanned-metric-tile">
                <div className="metric-tile-header">
                  <DollarSign size={14} className="text-emerald" />
                  <span>{isAr ? 'سعر البيع' : 'Selling Price'}</span>
                </div>
                <div className="metric-tile-value price-text">
                  {formatMoney(Number(scannedProduct.sellingPrice))}
                </div>
              </div>

              <div className="scanned-metric-tile">
                <div className="metric-tile-header">
                  <span className="live-stock-dot"></span>
                  <span>{isAr ? 'الرصيد الفعلي المتوفر' : 'Stock Available'}</span>
                </div>
                <div className="metric-tile-value stock-text">
                  <strong>{scannedProduct.currentStock}</strong>
                  <span className="unit-label">{scannedProduct.unit}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="scanned-controls-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {onOpenAdjustment ? (
                <button 
                  type="button"
                  className="stock-control-btn"
                  onClick={() => {
                    onClose();
                    onOpenAdjustment(scannedProduct);
                  }}
                  style={{
                    width: '100%',
                    background: '#3b82f6',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Scale size={16} />
                  <span>{isAr ? 'تسوية مخزنية معتمدة (Stock Adjustment)' : 'Audited Stock Adjustment'}</span>
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button"
                    className="stock-control-btn btn-stock-add"
                    onClick={() => onAdjustStock(scannedProduct.id, 1)}
                  >
                    <Plus size={16} />
                    <span>{isAr ? 'إضافة 1 للمخزن' : 'Add 1 to stock'}</span>
                  </button>
                  <button 
                    type="button"
                    className="stock-control-btn btn-stock-dispatch"
                    onClick={() => onAdjustStock(scannedProduct.id, -1)}
                    disabled={scannedProduct.currentStock <= 0}
                  >
                    <Minus size={16} />
                    <span>{isAr ? 'صرف 1 من المخزن' : 'Dispatch 1 from stock'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="scanner-empty-card fade-in">
            <div className="empty-icon-circle">
              <AlertCircle size={28} className="text-warning" />
            </div>
            <h5>{isAr ? 'لم يتم العثور على الصنف' : 'No Item Matches'}</h5>
            <p>
              {isAr 
                ? 'تأكد من صحة رقم الباركود أو رمز الصنف، أو جرب اختيار أحد الأمثلة بالأعلى.'
                : 'Verify barcode number or SKU, or pick one of the sample test items above.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
