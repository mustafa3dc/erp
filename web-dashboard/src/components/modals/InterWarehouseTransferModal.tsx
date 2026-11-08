import React, { useState } from 'react';
import { X, ArrowLeftRight, Warehouse, Package, Truck, CheckCircle2 } from 'lucide-react';
import { Product } from '../../types/warehouse';
import { getStoredWarehouses } from '../../services/storageService';

interface InterWarehouseTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  lang?: 'en' | 'ar';
  initialProductId?: string;
  onTransfer: (data: {
    productId: string;
    fromWarehouse: string;
    toWarehouse: string;
    quantity: number;
    carrier: string;
    reference: string;
  }) => void;
}

export default function InterWarehouseTransferModal({
  isOpen,
  onClose,
  products,
  lang = 'ar',
  initialProductId,
  onTransfer
}: InterWarehouseTransferModalProps) {
  if (!isOpen) return null;
  const isAr = lang === 'ar';
  const warehouses = getStoredWarehouses();

  const [fromWh, setFromWh] = useState(warehouses[0]?.nameAr || '');
  const [toWh, setToWh] = useState(warehouses[1]?.nameAr || warehouses[0]?.nameAr || '');
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId && products.some(p => p.id === initialProductId)
      ? initialProductId
      : (products[0]?.id || '')
  );
  const [qty, setQty] = useState(10);
  const [carrier, setCarrier] = useState('حيدر جاسم (سائق أسطول النقل الداخلي)');
  const [refNo, setRefNo] = useState(`TRF-2026-${Math.floor(1000 + Math.random() * 9000)}`);

  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || qty <= 0) return;

    onTransfer({
      productId: selectedProductId,
      fromWarehouse: fromWh,
      toWarehouse: toWh,
      quantity: Number(qty),
      carrier,
      reference: refNo
    });
    onClose();
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="icon-circle-badge blue">
              <ArrowLeftRight size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                {isAr ? 'إذن تحويل بين المخازن' : 'Inter-Warehouse Transfer'}
              </h3>
              <small style={{ color: '#94a3b8' }}>
                {isAr ? 'مناقلة البضائع وسجلات الأرصدة بين المستودعات' : 'Transfer inventory between storage hubs'}
              </small>
            </div>
          </div>
          <button className="icon-circle-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-body">
          {/* Source and Destination */}
          <div className="form-grid-2">
            <div className="form-group">
              <label>{isAr ? 'من المستودع (المصدر) *' : 'From Warehouse (Source) *'}</label>
              <select value={fromWh} onChange={e => setFromWh(e.target.value)} className="form-input">
                {warehouses.length === 0 ? (
                  <option value="">{isAr ? 'لا توجد مستودعات مضافة' : 'No warehouses'}</option>
                ) : (
                  warehouses.map(w => (
                    <option key={w.id} value={w.nameAr}>
                      {w.nameAr}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label>{isAr ? 'إلى المستودع (الوجهة) *' : 'To Warehouse (Destination) *'}</label>
              <select value={toWh} onChange={e => setToWh(e.target.value)} className="form-input">
                {warehouses.length === 0 ? (
                  <option value="">{isAr ? 'لا توجد مستودعات مضافة' : 'No warehouses'}</option>
                ) : (
                  warehouses.map(w => (
                    <option key={w.id} value={w.nameAr}>
                      {w.nameAr}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Product Selection */}
          <div className="form-group">
            <label>{isAr ? 'الصنف المراد تحويله *' : 'Select Product SKU *'}</label>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="form-input"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.nameAr} ({isAr ? 'الرصيد:' : 'Stock:'} {p.currentStock})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity and Unit */}
          <div className="form-grid-2">
            <div className="form-group">
              <label>{isAr ? 'الكمية المحولة *' : 'Transfer Quantity *'}</label>
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
                value={selectedProduct?.unit || (isAr ? 'قطعة' : 'Unit')}
                readOnly
                className="form-input"
                style={{ opacity: 0.7 }}
              />
            </div>
          </div>

          {/* Carrier and Ref */}
          <div className="form-grid-2">
            <div className="form-group">
              <label>{isAr ? 'المسؤول / السائق الناقل' : 'Carrier / Driver'}</label>
              <input
                type="text"
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
                className="form-input"
                placeholder={isAr ? 'اسم السائق أو وسيلة النقل' : 'Driver or freight carrier'}
              />
            </div>
            <div className="form-group">
              <label>{isAr ? 'رقم الإذن / المرجع' : 'Reference Voucher #'}</label>
              <input
                type="text"
                value={refNo}
                onChange={e => setRefNo(e.target.value)}
                className="form-input"
                dir="ltr"
              />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
            <button type="submit" className="btn-add-primary">
              <CheckCircle2 size={16} />
              <span>{isAr ? 'اعتماد وترحيل المناقلة' : 'Confirm & Transfer Stock'}</span>
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
