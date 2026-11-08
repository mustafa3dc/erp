import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Scale, PlusCircle, MinusCircle, AlertOctagon, 
  Warehouse, CheckCircle2, AlertTriangle, ShieldCheck, 
  ArrowRight, Sparkles, FileText, Lock
} from 'lucide-react';
import { Product, Warehouse as WarehouseType, TransactionDetail } from '../../types/warehouse';
import { 
  executeStockAdjustment, 
  STOCK_ADJUSTMENT_REASONS, 
  StockAdjustmentRecord,
  getStoredAuthSession
} from '../../services/storageService';

interface StockAdjustmentModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  warehouses: WarehouseType[];
  lang?: 'ar' | 'en';
  onAdjustmentSuccess?: (updatedProduct: Product, transaction: TransactionDetail, record: StockAdjustmentRecord) => void;
}

export default function StockAdjustmentModal({
  product,
  isOpen,
  onClose,
  warehouses,
  lang = 'ar',
  onAdjustmentSuccess
}: StockAdjustmentModalProps) {
  if (!isOpen || !product) return null;

  const isAr = lang === 'ar';
  const currentUser = getStoredAuthSession();

  const activeWarehouses: WarehouseType[] = useMemo(() => {
    return (warehouses || []).filter((w: WarehouseType) => (w as any).isActive !== false && w.status !== 'maintenance');
  }, [warehouses]);

  const [adjustmentType, setAdjustmentType] = useState<'SURPLUS' | 'DEFICIT' | 'DAMAGED'>('SURPLUS');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    const match = activeWarehouses.find((w: WarehouseType) => w.id === product.warehouseId);
    return match ? match.id : (activeWarehouses[0]?.id || 'WH-01');
  });
  const [quantity, setQuantity] = useState<number>(1);
  const [reasonCode, setReasonCode] = useState<string>(STOCK_ADJUSTMENT_REASONS[0].labelAr);
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (product) {
      const match = activeWarehouses.find((w: WarehouseType) => w.id === product.warehouseId);
      setSelectedWarehouseId(match ? match.id : (activeWarehouses[0]?.id || 'WH-01'));
      setQuantity(1);
      setReasonCode(isAr ? STOCK_ADJUSTMENT_REASONS[0].labelAr : STOCK_ADJUSTMENT_REASONS[0].labelEn);
      setNotes('');
      setErrorMsg('');
      setAdjustmentType('SURPLUS');
    }
  }, [product, isOpen, isAr, activeWarehouses]);

  const currentStock = Number(product.currentStock || 0);
  const isDeficit = adjustmentType === 'DEFICIT' || adjustmentType === 'DAMAGED';
  const quantityDelta = isDeficit ? -quantity : quantity;
  const projectedBalance = isDeficit 
    ? Math.max(0, currentStock - quantity)
    : currentStock + quantity;
  const isInsufficient = isDeficit && quantity > currentStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (quantity <= 0) {
      setErrorMsg(isAr ? 'يجب أن تكون كمية التسوية رقماً موجباً أكبر من صفر.' : 'Quantity must be greater than zero.');
      return;
    }

    if (isInsufficient) {
      setErrorMsg(
        isAr 
          ? `الرصيد المتاح حالياً (${currentStock}) غير كافٍ لإجراء خصم/تلف بمقدار (${quantity}).`
          : `Current available stock (${currentStock}) is insufficient for deficit of (${quantity}).`
      );
      return;
    }

    if (!reasonCode || !reasonCode.trim()) {
      setErrorMsg(isAr ? 'يجب اختيار سبب التسوية المخزنية الإجباري.' : 'Adjustment reason is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await executeStockAdjustment({
        productId: product.id,
        warehouseId: selectedWarehouseId,
        adjustmentType,
        quantity,
        reason: reasonCode,
        notes: notes.trim(),
        operator: currentUser?.fullName || currentUser?.username || (isAr ? 'أمين المستودع' : 'Warehouse Keeper')
      });

      if (onAdjustmentSuccess) {
        onAdjustmentSuccess(res.updatedProduct, res.transaction, res.record);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || (isAr ? 'فشلت عملية التسوية المخزنية' : 'Stock adjustment failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedWh = warehouses.find(w => w.id === selectedWarehouseId);

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} style={{ zIndex: 1200 }} dir={isAr ? 'rtl' : 'ltr'}>
      <div 
        className="modal-content glass-panel" 
        style={{ 
          maxWidth: '620px', 
          maxHeight: '92vh', 
          overflowY: 'auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: 0
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.25)'
              }}
            >
              <Scale size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--foreground)' }}>
                {isAr ? 'تسوية مخزنية معتمدة (Stock Adjustment)' : 'Stock Adjustment Order'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--muted-foreground)' }}>
                {isAr ? 'قيد حركة تعديل رصيد موثقة ومقيدة في دفتر أستاذ المخزون التراكمي' : 'Immutable adjustment transaction posted to stock ledger'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Product Identity Banner */}
        <div 
          style={{
            padding: '14px 22px',
            background: 'var(--muted)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span 
                style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 800, 
                  fontSize: '11px', 
                  color: 'var(--primary)',
                  background: 'var(--card)',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  border: '1px solid var(--border)'
                }}
                dir="ltr"
              >
                {product.sku}
              </span>
              <strong style={{ fontSize: '13.5px', color: 'var(--foreground)' }}>
                {product.nameAr || product.nameEn}
              </strong>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--muted-foreground)', display: 'block', marginTop: '3px' }}>
              {isAr ? 'التصنيف:' : 'Category:'} {product.category} • {isAr ? 'الرف:' : 'Shelf:'} {product.shelf || 'A-01'}
            </span>
          </div>

          <div style={{ textAlign: isAr ? 'left' : 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', display: 'block' }}>
              {isAr ? 'الرصيد المسجل حالياً' : 'Current Registered Balance'}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: isAr ? 'flex-start' : 'flex-end' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: currentStock > 0 ? 'var(--foreground)' : '#ef4444', fontFamily: 'monospace' }}>
                {currentStock}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                {product.unit || (isAr ? 'قطعة' : 'unit')}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px' }}>
          {errorMsg && (
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '12.5px',
                fontWeight: 600,
                marginBottom: '16px'
              }}
            >
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Adjustment Type Segmented Cards */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '8px' }}>
              {isAr ? '1. مسار ونوع التسوية المخزنية *' : '1. Adjustment Type *'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {/* SURPLUS */}
              <button
                type="button"
                onClick={() => setAdjustmentType('SURPLUS')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: adjustmentType === 'SURPLUS' ? '2px solid #10b981' : '1px solid var(--border)',
                  background: adjustmentType === 'SURPLUS' ? 'rgba(16, 185, 129, 0.08)' : 'var(--card)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <PlusCircle size={20} style={{ color: '#10b981', marginBottom: '4px' }} />
                <strong style={{ fontSize: '12px', color: adjustmentType === 'SURPLUS' ? '#047857' : 'var(--foreground)' }}>
                  {isAr ? 'إضافة / فائض (+)' : 'Surplus (+)'}
                </strong>
                <span style={{ fontSize: '10.5px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                  {isAr ? 'زيادة جردية أو تصحيح' : 'Audit surplus / Inbound'}
                </span>
              </button>

              {/* DEFICIT */}
              <button
                type="button"
                onClick={() => setAdjustmentType('DEFICIT')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: adjustmentType === 'DEFICIT' ? '2px solid #f59e0b' : '1px solid var(--border)',
                  background: adjustmentType === 'DEFICIT' ? 'rgba(245, 158, 11, 0.08)' : 'var(--card)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <MinusCircle size={20} style={{ color: '#f59e0b', marginBottom: '4px' }} />
                <strong style={{ fontSize: '12px', color: adjustmentType === 'DEFICIT' ? '#b45309' : 'var(--foreground)' }}>
                  {isAr ? 'خصم / عجز (-)' : 'Deficit (-)'}
                </strong>
                <span style={{ fontSize: '10.5px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                  {isAr ? 'عجز جرد أو فرق رصيد' : 'Audit deficit / Outbound'}
                </span>
              </button>

              {/* DAMAGED */}
              <button
                type="button"
                onClick={() => setAdjustmentType('DAMAGED')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: adjustmentType === 'DAMAGED' ? '2px solid #ef4444' : '1px solid var(--border)',
                  background: adjustmentType === 'DAMAGED' ? 'rgba(239, 68, 68, 0.08)' : 'var(--card)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <AlertOctagon size={20} style={{ color: '#ef4444', marginBottom: '4px' }} />
                <strong style={{ fontSize: '12px', color: adjustmentType === 'DAMAGED' ? '#dc2626' : 'var(--foreground)' }}>
                  {isAr ? 'تلف / كسر (-)' : 'Damaged / Write-Off'}
                </strong>
                <span style={{ fontSize: '10.5px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                  {isAr ? 'إتلاف وخسارة تشغيلية' : 'Damaged stock write-off'}
                </span>
              </button>
            </div>
          </div>

          {/* 2. Warehouse & Quantity Grid */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
              gap: '16px',
              marginBottom: '18px' 
            }}
          >
            {/* Target Warehouse */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '6px' }}>
                {isAr ? '2. المستودع / الفرع المستهدف *' : '2. Target Warehouse *'}
              </label>
              <div style={{ position: 'relative' }}>
                <select 
                  value={selectedWarehouseId}
                  onChange={e => setSelectedWarehouseId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {activeWarehouses.map((w: WarehouseType) => (
                    <option key={w.id} value={w.id}>
                      {isAr ? w.nameAr : (w.nameEn || w.nameAr)} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quantity to Adjust */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>
                  {isAr ? '3. الكمية المراد تسويتها *' : '3. Adjustment Quantity *'}
                </label>
                <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                  {isAr ? 'رقم موجب' : 'Positive integer'}
                </span>
              </div>
              <input 
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: isInsufficient ? '2px solid #ef4444' : '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '15px',
                  fontWeight: 800,
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>

          {/* Quick Quantity Presets & Balance Calculation Card */}
          <div 
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              marginBottom: '18px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  {isAr ? 'أزرار سريعة:' : 'Quick Presets:'}
                </span>
                {[1, 5, 10, 25, 50].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQuantity(val)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      border: quantity === val ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: quantity === val ? 'var(--primary)' : 'var(--card)',
                      color: quantity === val ? '#ffffff' : 'var(--foreground)',
                      cursor: 'pointer'
                    }}
                  >
                    +{val}
                  </button>
                ))}
              </div>

              {/* Dynamic Balance Impact Preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontFamily: 'monospace' }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{currentStock}</span>
                <span style={{ fontWeight: 800, color: isDeficit ? '#ef4444' : '#10b981' }}>
                  {isDeficit ? `-${quantity}` : `+${quantity}`}
                </span>
                <span style={{ color: 'var(--muted-foreground)' }}>=</span>
                <span style={{ fontWeight: 800, color: isInsufficient ? '#ef4444' : 'var(--foreground)', fontSize: '13px' }}>
                  {projectedBalance} {product.unit || (isAr ? 'قطعة' : 'unit')}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Mandatory Reason Selection */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '6px' }}>
              {isAr ? '4. سبب التسوية المخزنية المعتمد (إجباري للتدقيق) *' : '4. Mandatory Audit Reason *'}
            </label>
            <select
              value={reasonCode}
              onChange={e => setReasonCode(e.target.value)}
              required
              style={{
                width: '100%',
                height: '42px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {STOCK_ADJUSTMENT_REASONS.map(r => (
                <option key={r.code} value={isAr ? r.labelAr : r.labelEn}>
                  {isAr ? r.labelAr : r.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Notes & Remarks */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', marginBottom: '6px' }}>
              {isAr ? '5. تفاصيل وملاحظات إضافية (اختياري)' : '5. Additional Remarks / Audit Reference (Optional)'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isAr ? 'مثال: محضر جرد دوري رقم 402، إتلاف كرتونة مكسورة أثناء التنزيل...' : 'E.g., Inventory audit report #402, box crushed during forklift transport...'}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                fontSize: '12.5px',
                resize: 'none'
              }}
            />
          </div>

          {/* Audit Trail Security Notice */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              marginBottom: '20px',
              fontSize: '11.5px',
              color: 'var(--muted-foreground)'
            }}
          >
            <ShieldCheck size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <span>
              {isAr 
                ? 'سيتم تسجيل هذه الحركة في جدول حركات المخزون ودفتر الأستاذ التراكمي وتحديث رصيد المستودع بصورة غير قابلة للتراجع.'
                : 'This adjustment creates an immutable transaction in the stock ledger with user attribution.'}
            </span>
          </div>

          {/* Actions Bar */}
          <div 
            style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              borderTop: '1px solid var(--border)',
              paddingTop: '16px'
            }}
          >
            <button 
              type="button" 
              onClick={onClose}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--foreground)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button 
              type="submit"
              disabled={isSubmitting || isInsufficient}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: isInsufficient ? '#94a3b8' : adjustmentType === 'SURPLUS' ? '#059669' : '#dc2626',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isInsufficient ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              <CheckCircle2 size={16} />
              <span>
                {isSubmitting 
                  ? (isAr ? 'جاري قيد التسوية...' : 'Posting...') 
                  : (isAr ? 'تأكيد وقيد التسوية المخزنية' : 'Confirm & Post Adjustment')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

