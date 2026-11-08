import React from 'react';
import { X, CheckCircle, Clock, MapPin, Package, ArrowRight, Printer, Barcode } from 'lucide-react';
import BarcodeSvg from './BarcodeSvg';
import { localizeTxType, localizeTxStatus, localizeUnit, localizeWarehouse } from '../lib/localeHelpers';
import { formatMovementDate } from '../utils/dateFormatter';

export interface TransactionDetail {
  id: string;
  sku: string;
  productName: string;
  type: 'Inbound' | 'Outbound' | 'Transfer' | 'Adjustment' | string;
  qty: number;
  unit?: string;
  location: string;
  fromLocation?: string;
  toLocation?: string;
  status: 'Received' | 'Pending' | 'Cancelled' | string;
  timestamp?: string;
  movementDate?: string | Date;
  createdAt?: string | Date;
  date?: string | Date;
  operator?: string;
  referenceNo?: string;
  unitCost?: number;
}

interface TransactionModalProps {
  transaction: TransactionDetail | null;
  onClose: () => void;
  lang: 'en' | 'ar';
}

export default function TransactionModal({ transaction, onClose, lang }: TransactionModalProps) {
  if (!transaction) return null;
  const isAr = lang === 'ar';

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-content glass-panel tx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="code-badge">{transaction.id.startsWith('#') ? transaction.id : `#${transaction.id}`}</span>
            <span className={`status-pill status-${transaction.status.toLowerCase().replace(' ', '-')}`}>
              {localizeTxStatus(transaction.status, lang)}
            </span>
          </div>
          <button className="icon-circle-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="tx-modal-body">
          <div className="tx-product-banner">
            <div className="tx-icon-box">
              <Package size={24} />
            </div>
            <div>
              <h3><bdi dir="auto">{transaction.productName}</bdi></h3>
              <div className="tx-sub-meta">
                <span>SKU: <strong dir="ltr" style={{ fontFamily: 'monospace' }}>{transaction.sku}</strong></span>
                <span className="meta-bullet">•</span>
                <span>{localizeTxType(transaction.type, lang)}</span>
              </div>
            </div>
            <div className="tx-barcode-preview">
              <BarcodeSvg value={transaction.id} width={90} height={26} />
            </div>
          </div>

          <div className="tx-details-grid">
            <div className="detail-field">
              <label>{isAr ? 'الكمية المنفذة' : 'Executed Quantity'}</label>
              <strong className="qty-highlight">
                {(transaction.type === 'Outbound' ? '-' : transaction.type === 'Inbound' ? '+' : '') + Math.abs(transaction.qty).toLocaleString()} {localizeUnit(transaction.unit, lang)}
              </strong>
            </div>

            <div className="detail-field">
              <label>{isAr ? 'مسار الحركة (المصدر -> الوجهة)' : 'Route (From -> To)'}</label>
              <strong>
                {transaction.fromLocation && transaction.toLocation
                  ? `${localizeWarehouse(transaction.fromLocation, lang)} -> ${localizeWarehouse(transaction.toLocation, lang)}`
                  : localizeWarehouse(transaction.location, lang)}
              </strong>
            </div>

            <div className="detail-field">
              <label>{isAr ? 'تاريخ ووقت المعاملة' : 'Timestamp'}</label>
              <span>{formatMovementDate(transaction.movementDate || transaction.createdAt || transaction.date || transaction.timestamp, lang)}</span>
            </div>

            <div className="detail-field">
              <label>{isAr ? 'المسؤول الميداني' : 'Operator'}</label>
              <span>{transaction.operator || (isAr ? 'أمين المخزن المناوب' : 'Duty Storekeeper')}</span>
            </div>

            <div className="detail-field">
              <label>{isAr ? 'رقم الإذن / المرجع' : 'Reference Voucher'}</label>
              <span className="barcode-mono">VCH-2026-9041</span>
            </div>

            <div className="detail-field">
              <label>{isAr ? 'حالة التوثيق' : 'Verification'}</label>
              <span className="green-text"> {isAr ? 'مطابق لقاعدة البيانات' : 'Verified in PostgreSQL'}</span>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-add-primary" onClick={onClose}>
            <span>{isAr ? 'إغلاق' : 'Close'}</span>
          </button>
          <button className="btn-secondary-flat" onClick={() => window.print()}>
            <Printer size={15} />
            <span>{isAr ? 'طباعة الإيصال' : 'Print Receipt'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
