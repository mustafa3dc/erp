import React, { useState } from 'react';
import { X, ArrowUpFromLine, Truck, CheckCircle2 } from 'lucide-react';
import { Product, Warehouse } from '../../types/warehouse';
import { localizeUnit, localizeWarehouse } from '../../lib/localeHelpers';
import { getStoredWarehouses } from '../../services/storageService';

interface OutboundDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  lang?: 'en' | 'ar';
  onDispatch: (data: {
    productId: string;
    fromWarehouse: string;
    destination: string;
    quantity: number;
    carrier: string;
    soNumber: string;
  }) => void;
}

export default function OutboundDispatchModal({
  isOpen,
  onClose,
  products,
  lang = 'ar',
  onDispatch
}: OutboundDispatchModalProps) {
  if (!isOpen) return null;
  const isAr = lang === 'ar';

  const availableWarehouses = getStoredWarehouses();
  const [fromWh, setFromWh] = useState(() => availableWarehouses[0]?.nameAr || (isAr ? 'المستودع الرئيسي' : 'Main Warehouse'));
  const [destination, setDestination] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [carrier, setCarrier] = useState('');
  const [soNo, setSoNo] = useState(`SO-2026-${Math.floor(1000 + Math.random() * 9000)}`);

  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || qty <= 0) return;

    onDispatch({
      productId: selectedProductId,
      fromWarehouse: fromWh,
      destination,
      quantity: Number(qty),
      carrier,
      soNumber: soNo
    });
    onClose();
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="icon-circle-badge orange">
              <ArrowUpFromLine size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                {isAr ? 'إذن صرف وشحن بضاعة' : 'Outbound Goods Dispatch Voucher'}
              </h3>
              <small style={{ color: '#94a3b8' }}>
                {isAr ? 'صرف وتجهيز بضائع للعملاء أو الفروع الخارجية' : 'Dispatch merchandise and issue delivery waybills'}
              </small>
            </div>
          </div>
          <button className="icon-circle-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-body">
          <div className="form-grid-2">
            <div className="form-group">
              <label>{isAr ? 'من المستودع (المصدر) *' : 'From Warehouse *'}</label>
              <select value={fromWh} onChange={e => setFromWh(e.target.value)} className="form-input">
                {availableWarehouses.map(wh => (
                  <option key={wh.id} value={wh.nameAr || wh.nameEn}>
                    {isAr ? (wh.nameAr || wh.nameEn) : (wh.nameEn || wh.nameAr)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{isAr ? 'العميل / وجهة الاستلام *' : 'Customer / Destination *'}</label>
              <input
                type="text"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                className="form-input"
                placeholder={isAr ? 'اسم العميل أو الفرع المستلم' : 'Customer or receiving branch'}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>{isAr ? 'الصنف المراد صرفه *' : 'Product to Dispatch *'}</label>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="form-input"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.nameAr} ({isAr ? 'المتاح' : 'Available'}: {p.currentStock})
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{isAr ? 'الكمية المنصرفة *' : 'Dispatch Quantity *'}</label>
              <input
                type="number"
                min="1"
                max={selectedProduct ? selectedProduct.currentStock : 9999}
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label>{isAr ? 'وحدة القياس' : 'Unit'}</label>
              <input
                type="text"
                value={selectedProduct ? localizeUnit(selectedProduct.unit, lang) : (isAr ? 'قطعة' : 'unit')}
                readOnly
                className="form-input"
                style={{ opacity: 0.7 }}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{isAr ? 'جهة وأسطول الشحن' : 'Carrier / Transporter'}</label>
              <input
                type="text"
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>{isAr ? 'رقم أمر البيع' : 'Sales Order #'}</label>
              <input
                type="text"
                value={soNo}
                onChange={e => setSoNo(e.target.value)}
                className="form-input"
                dir="ltr"
              />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
            <button type="submit" className="btn-add-primary">
              <CheckCircle2 size={16} />
              <span>{isAr ? 'اعتماد إذن الصرف والشحن' : 'Approve & Dispatch Cargo'}</span>
            </button>
            <button type="button" className="btn-secondary-flat" onClick={onClose}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
