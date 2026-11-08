import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, CheckCircle2, Clock, Truck, Plus, PackageCheck, FileText } from 'lucide-react';
import { getStoredInboundShipments, saveStoredInboundShipments } from '../../services/storageService';
import { localizeWarehouse } from '../../lib/localeHelpers';

interface InboundViewProps {
  lang: 'en' | 'ar';
  onReceiveShipment: (shipmentId: string) => void;
  onOpenNewInbound?: () => void;
}

export default function InboundView({ lang, onReceiveShipment, onOpenNewInbound }: InboundViewProps) {
  const isAr = lang === 'ar';

  const [shipments, setShipments] = useState(() => getStoredInboundShipments());

  useEffect(() => {
    saveStoredInboundShipments(shipments);
  }, [shipments]);

  const handleMarkReceived = (id: string) => {
    setShipments(shipments.map(s => {
      if (s.id === id) {
        return { ...s, status: 'Received', receivedQty: s.expectedQty };
      }
      return s;
    }));
    onReceiveShipment(id);
  };

  const pendingCount = shipments.filter(s => s.status === 'Pending').length;
  const receivedCount = shipments.filter(s => s.status === 'Received').length;

  return (
    <div className="view-content-wrapper fade-in">
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">{isAr ? 'الوارد واستلام الشحنات' : 'Inbound Shipments & Receiving'}</h2>
          <p className="view-subtitle">{isAr ? 'تأكيد أوامر الشراء، فحص البضائع المستلمة، وترحيلها للأرصدة' : 'Inspect incoming consignments, verify purchase orders and accept into stock'}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {onOpenNewInbound && (
            <button 
              type="button" 
              className="btn-add-primary"
              onClick={onOpenNewInbound}
              title={isAr ? 'تسجيل قائمة مشتريات وتوريد بضاعة من مورد بالكامل مع تعريف الأصناف على الطاير' : 'Record supplier purchase bill & inward stock'}
            >
              <FileText size={16} />
              <span>{isAr ? 'تسجيل استلام بضاعة (قائمة مشتريات)' : 'New Supplier Purchase Bill'}</span>
            </button>
          )}
          <div className="inbound-kpi-pill">
            <span className="green-text"> {receivedCount} {isAr ? 'مستلمة' : 'Received'}</span>
            <span className="meta-bullet">•</span>
            <span className="orange-text">{pendingCount} {isAr ? 'قيد الانتظار' : 'Pending Today'}</span>
          </div>
        </div>
      </div>

      <div className="transactions-table-card">
        <table className="logistock-table">
          <thead>
            <tr>
              <th>{isAr ? 'رقم الشحنة' : 'Shipment ID'}</th>
              <th>{isAr ? 'أمر الشراء' : 'PO Number'}</th>
              <th>{isAr ? 'المورد الناقل' : 'Supplier / Carrier'}</th>
              <th>{isAr ? 'المستودع المستهدف' : 'Target Warehouse'}</th>
              <th>{isAr ? 'الأصناف المشحونة' : 'Items Description'}</th>
              <th>{isAr ? 'الكمية' : 'Expected Qty'}</th>
              <th>{isAr ? 'الموعد المتوقع' : 'ETA'}</th>
              <th>{isAr ? 'الحالة' : 'Status'}</th>
              <th>{isAr ? 'الإجراء' : 'Action'}</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map(s => (
              <tr key={s.id}>
                <td className="tx-id-cell">{s.id}</td>
                <td><strong className="code-badge">{s.poNumber}</strong></td>
                <td>
                  <div>
                    <strong dir="auto">{s.supplier}</strong>
                    <small className="carrier-sub"><Truck size={12} /> {s.carrier}</small>
                  </div>
                </td>
                <td dir="auto">{s.warehouse}</td>
                <td className="product-name-cell" dir="auto">{s.items}</td>
                <td><strong>{s.expectedQty} {isAr ? 'وحدة' : 'units'}</strong></td>
                <td><span className="date-text"><Clock size={12} /> {s.eta}</span></td>
                <td>
                  <span className={`status-pill ${s.status === 'Received' ? 'status-received' : 'status-pending'}`}>
                    {isAr ? (s.status === 'Received' ? 'مستلم' : 'قيد الانتظار') : s.status}
                  </span>
                </td>
                <td>
                  {s.status === 'Pending' ? (
                    <button className="btn-receive-action" onClick={() => handleMarkReceived(s.id)}>
                      <PackageCheck size={14} />
                      <span>{isAr ? 'فحص واستلام' : 'Receive'}</span>
                    </button>
                  ) : (
                    <span className="green-text check-received">
                      <CheckCircle2 size={15} />
                      <span>{isAr ? 'تم الاستلام' : 'Stored'}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
