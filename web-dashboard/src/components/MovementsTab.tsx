import React, { useState } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  SlidersHorizontal, 
  Plus, 
  FileText,
  Search,
  Check
} from 'lucide-react';
import { StockMovement, Warehouse as WarehouseType, Product } from '../types/warehouse';
import { localizeTxType, localizeWarehouse } from '../lib/localeHelpers';
import { formatMovementDate } from '../utils/dateFormatter';

interface MovementsTabProps {
  movements: StockMovement[];
  warehouses: WarehouseType[];
  products: Product[];
  lang: 'en' | 'ar';
  onAddMovement: (movement: StockMovement) => void;
}

export default function MovementsTab({
  movements,
  warehouses,
  products,
  lang,
  onAddMovement
}: MovementsTabProps) {
  const isAr = lang === 'ar';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [newMovement, setNewMovement] = useState({
    type: 'IN' as 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT',
    productId: products[0]?.id || '',
    fromWarehouse: warehouses[0]?.nameAr || '',
    toWarehouse: warehouses[1]?.nameAr || '',
    quantity: 10,
    notes: ''
  });

  const filteredMovements = movements.filter(m => {
    return filterType === 'ALL' || m.type === filterType;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === newMovement.productId);
    if (!product) return;

    const nowIso = new Date().toISOString();
    const created: StockMovement = {
      id: `MOV-2026-${String(movements.length + 1).padStart(3, '0')}`,
      movementNumber: `${newMovement.type}-${Math.floor(1000 + Math.random() * 9000)}`,
      type: newMovement.type,
      productName: product.nameAr,
      sku: product.sku,
      fromWarehouse: newMovement.type === 'IN' ? undefined : newMovement.fromWarehouse,
      toWarehouse: newMovement.type === 'OUT' ? undefined : newMovement.toWarehouse,
      quantity: newMovement.quantity,
      unitCost: product.costPrice,
      date: nowIso,
      movementDate: nowIso,
      createdAt: nowIso,
      operator: isAr ? 'أمين المخزن المناوب' : 'Duty Storekeeper',
      notes: newMovement.notes || (isAr ? 'حركة مخزنية موثقة' : 'Recorded stock transaction')
    };

    onAddMovement(created);
    setIsModalOpen(false);
  };

  return (
    <div className="movements-view fade-in">
      {/* Toolbar */}
      <div className="section-toolbar glass-panel">
        <div className="toolbar-left">
          <div className="movement-type-pills">
            {['ALL', 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'].map((t) => (
              <button 
                key={t}
                className={`type-pill ${filterType === t ? 'active' : ''}`}
                onClick={() => setFilterType(t)}
              >
                {t === 'ALL' 
                  ? (isAr ? 'الكل' : 'All') 
                  : t === 'IN' 
                  ? (isAr ? 'إدخال وتوريد' : 'Inbound') 
                  : t === 'OUT' 
                  ? (isAr ? 'صرف ومبيعات' : 'Outbound') 
                  : t === 'TRANSFER' 
                  ? (isAr ? 'مناقلة فروع' : 'Transfer') 
                  : (isAr ? 'تسوية جردية' : 'Adjustment')}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-right">
          <button className="btn-add-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            <span>{isAr ? 'إصدار إذن حركة جديد' : 'New Stock Voucher'}</span>
          </button>
        </div>
      </div>

      {/* Movements Table */}
      <div className="table-responsive glass-panel table-container-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>{isAr ? 'رقم الإذن' : 'Voucher No'}</th>
              <th>{isAr ? 'نوع الحركة' : 'Movement Type'}</th>
              <th>{isAr ? 'الصنف ورمز SKU' : 'Item & SKU'}</th>
              <th>{isAr ? 'من مستودع' : 'From'}</th>
              <th>{isAr ? 'إلى مستودع' : 'To'}</th>
              <th>{isAr ? 'الكمية' : 'Quantity'}</th>
              <th>{isAr ? 'التكلفة الإجمالية' : 'Total Cost'}</th>
              <th>{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
              <th>{isAr ? 'المسؤول والملاحظات' : 'Operator & Notes'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredMovements.map((m) => (
              <tr key={m.id}>
                <td><span className="code-badge">{m.movementNumber}</span></td>
                <td>
                  <span className={`badge ${
                    m.type === 'IN' ? 'badge-success' : 
                    m.type === 'OUT' ? 'badge-danger' : 
                    m.type === 'TRANSFER' ? 'badge-primary' : 'badge-warning'
                  }`}>
                    {m.type === 'IN' && <ArrowDownLeft size={13} />}
                    {m.type === 'OUT' && <ArrowUpRight size={13} />}
                    {m.type === 'TRANSFER' && <ArrowLeftRight size={13} />}
                    {m.type === 'ADJUSTMENT' && <SlidersHorizontal size={13} />}
                    <span>{localizeTxType(m.type, lang)}</span>
                  </span>
                </td>
                <td>
                  <div>
                    <strong dir="auto">{m.productName}</strong>
                    <small className="barcode-mono d-block">{m.sku}</small>
                  </div>
                </td>
                <td dir="auto">{m.fromWarehouse || '—'}</td>
                <td dir="auto">{m.toWarehouse || '—'}</td>
                <td>
                  <strong className={`qty-number ${m.type === 'IN' ? 'green' : m.type === 'OUT' ? 'red' : 'blue'}`}>
                    {m.type === 'IN' ? `+${m.quantity}` : m.type === 'OUT' ? `-${m.quantity}` : `${m.quantity}`}
                  </strong>
                </td>
                <td>${(m.quantity * m.unitCost).toLocaleString()}</td>
                <td><span className="date-text">{formatMovementDate(m.movementDate || m.createdAt || m.date, lang)}</span></td>
                <td>
                  <div>
                    <span className="operator-name">{m.operator}</span>
                    <small className="text-muted d-block">{m.notes}</small>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: New Movement */}
      {isModalOpen && (
        <div className="modal-backdrop fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isAr ? 'إصدار إذن حركة مخزنية جديدة' : 'Create Stock Movement Voucher'}</h3>
              <button className="icon-circle-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>{isAr ? 'نوع الحركة *' : 'Movement Type *'}</label>
                <select 
                  value={newMovement.type}
                  onChange={(e) => setNewMovement({ ...newMovement, type: e.target.value as any })}
                >
                  <option value="IN">{isAr ? 'إذن استلام وتوريد بضاعة' : 'Inbound Receipt'}</option>
                  <option value="OUT">{isAr ? 'إذن صرف بضاعة ومبيعات' : 'Outbound Dispatch'}</option>
                  <option value="TRANSFER">{isAr ? 'مناقلة بين مستودعين' : 'Inter-warehouse Transfer'}</option>
                  <option value="ADJUSTMENT">{isAr ? 'تسوية جردية وفروقات' : 'Inventory Adjustment'}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{isAr ? 'اختر المنتج / الصنف *' : 'Select Product *'}</label>
                <select 
                  value={newMovement.productId}
                  onChange={(e) => setNewMovement({ ...newMovement, productId: e.target.value })}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.nameAr} ({isAr ? 'الرصيد' : 'Stock'}: {p.currentStock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>{isAr ? 'من مستودع' : 'From Warehouse'}</label>
                  <select 
                    value={newMovement.fromWarehouse}
                    onChange={(e) => setNewMovement({ ...newMovement, fromWarehouse: e.target.value })}
                    disabled={newMovement.type === 'IN'}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.nameAr}>{w.nameAr}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{isAr ? 'إلى مستودع' : 'To Warehouse'}</label>
                  <select 
                    value={newMovement.toWarehouse}
                    onChange={(e) => setNewMovement({ ...newMovement, toWarehouse: e.target.value })}
                    disabled={newMovement.type === 'OUT'}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.nameAr}>{w.nameAr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>{isAr ? 'الكمية المطلوبة *' : 'Quantity *'}</label>
                <input 
                  type="number" 
                  min="1" 
                  required
                  value={newMovement.quantity}
                  onChange={(e) => setNewMovement({ ...newMovement, quantity: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>{isAr ? 'ملاحظات أو رقم المرجع / الفاتورة' : 'Reference / Notes'}</label>
                <input 
                  type="text" 
                  placeholder={isAr ? 'مثال: توريد شحنة رقم PO-4491' : 'e.g. PO-4491 or sales voucher'}
                  value={newMovement.notes}
                  onChange={(e) => setNewMovement({ ...newMovement, notes: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-add-primary">
                  <span>{isAr ? 'تأكيد وترحيل الحركة للمخزن' : 'Post Movement'}</span>
                </button>
                <button type="button" className="btn-secondary-flat" onClick={() => setIsModalOpen(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
