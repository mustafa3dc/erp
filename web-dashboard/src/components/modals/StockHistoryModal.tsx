import React from 'react';
import { X, History, Package, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Calculator, Printer } from 'lucide-react';
import { Product } from '../../types/warehouse';
import { TransactionDetail } from '../TransactionModal';
import { localizeWarehouse, localizeUnit, localizeTxType } from '../../lib/localeHelpers';
import { useSettings } from '../../context/settings-context';
import { formatMovementDate } from '../../utils/dateFormatter';

interface StockHistoryModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
  transactions: TransactionDetail[];
}

export default function StockHistoryModal({
  product,
  isOpen,
  onClose,
  lang = 'ar',
  transactions
}: StockHistoryModalProps) {
  if (!isOpen || !product) return null;
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  // Filter transactions related to this product (by sku or name)
  const productTx = transactions.filter(t => 
    t.sku.toLowerCase() === product.sku.toLowerCase() ||
    t.productName.toLowerCase().includes(product.nameAr.toLowerCase()) ||
    t.productName.toLowerCase().includes(product.nameEn.toLowerCase())
  );

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ maxWidth: '780px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="icon-circle-badge cyan">
              <History size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                {isAr ? 'سجل حركة الصنف المخزني' : 'Stock Movement History Ledger'}
              </h3>
              <small style={{ color: '#94a3b8' }}>
                <bdi dir="auto">{product.nameAr}</bdi> • SKU: <strong dir="ltr" style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{product.sku}</strong>
              </small>
            </div>
          </div>
          <button className="icon-circle-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-form-body">
          {/* Summary Banner */}
          <div className="stock-ledger-summary-banner">
            <div className="ledger-stat-item">
              <span className="lbl">{isAr ? 'الرصيد الفعلي الحالي' : 'Current Balance'}</span>
              <strong className="val cyan">{product.currentStock} {localizeUnit(product.unit, lang)}</strong>
            </div>
            <div className="ledger-stat-item">
              <span className="lbl">{isAr ? 'الموقع المخزني المعتمد' : 'Primary Location'}</span>
              <strong className="val">{localizeWarehouse(product.warehouseName, lang)} ({product.shelf})</strong>
            </div>
            <div className="ledger-stat-item">
              <span className="lbl">{isAr ? 'سعر البيع المعتمد' : 'Selling Price'}</span>
              <strong className="val">{formatMoney(product.sellingPrice)}</strong>
            </div>
            <div className="ledger-stat-item">
              <span className="lbl">{isAr ? 'إجمالي الحركات الموثقة' : 'Recorded Logs'}</span>
              <strong className="val">{productTx.length} {isAr ? 'حركات' : 'vouchers'}</strong>
            </div>
          </div>

          {/* Movements Table */}
          <div className="ledger-table-wrapper" style={{ marginTop: '1rem', maxHeight: '340px', overflowY: 'auto' }}>
            <table className="logistock-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>{isAr ? 'رقم الإذن' : 'Voucher'}</th>
                  <th>{isAr ? 'نوع الحركة' : 'Type'}</th>
                  <th>{isAr ? 'الكمية' : 'Qty'}</th>
                  <th>{isAr ? 'المسار / الموقع' : 'Location / Route'}</th>
                  <th>{isAr ? 'التاريخ والوقت' : 'Timestamp'}</th>
                  <th>{isAr ? 'المسؤول' : 'Operator'}</th>
                </tr>
              </thead>
              <tbody>
                {productTx.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                      {isAr ? 'لا توجد حركات مسجلة لهذا الصنف حتى الآن' : 'No movement transactions logged for this SKU yet'}
                    </td>
                  </tr>
                ) : (
                  productTx.map(tx => (
                    <tr key={tx.id}>
                      <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{tx.id.startsWith('#') ? tx.id : `#${tx.id}`}</td>
                      <td>
                        <span className={`tx-type-badge tx-type-${(tx.type || 'inbound').toLowerCase()}`}>
                          {tx.type === 'Inbound' ? (isAr ? 'وارد' : 'Inbound') :
                           tx.type === 'Outbound' ? (isAr ? 'صادر' : 'Outbound') :
                           tx.type === 'Transfer' ? (isAr ? 'تحويل' : 'Transfer') :
                           tx.type === 'Adjustment' ? (isAr ? 'تسوية' : 'Adjustment') : tx.type}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: tx.type === 'Inbound' ? '#4ade80' : tx.type === 'Outbound' ? '#fb923c' : '#ffffff' }}>
                          {tx.type === 'Inbound' ? `+${Math.abs(tx.qty)}` : tx.type === 'Outbound' ? `-${Math.abs(tx.qty)}` : `${Math.abs(tx.qty)}`} {localizeUnit(tx.unit, lang)}
                        </strong>
                      </td>
                      <td>
                        <span style={{ color: '#cbd5e1' }}>
                          {tx.fromLocation && tx.toLocation 
                            ? `${localizeWarehouse(tx.fromLocation, lang)} -> ${localizeWarehouse(tx.toLocation, lang)}` 
                            : localizeWarehouse(tx.location, lang)}
                        </span>
                      </td>
                      <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {formatMovementDate(tx.movementDate || tx.createdAt || tx.date || tx.timestamp, lang)}
                      </td>
                      <td style={{ color: '#e2e8f0', whiteSpace: 'nowrap' }}>{tx.operator}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
            <button type="button" className="btn-add-primary" onClick={onClose}>
              <span>{isAr ? 'إغلاق' : 'Close'}</span>
            </button>
            <button type="button" className="btn-secondary-flat" onClick={() => window.print()}>
              <Printer size={15} />
              <span>{isAr ? 'طباعة كارت الصنف' : 'Print Ledger'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
