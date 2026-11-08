import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  User, 
  Phone, 
  Tag, 
  CreditCard, 
  Banknote, 
  Clock, 
  ShoppingCart,
  Check,
  Zap,
  Package
} from 'lucide-react';
import type { Product, Warehouse, SalesInvoice, InvoiceLineItem, WarehouseDispatchOrder } from '../../types/warehouse';
import { useSettings } from '../../context/settings-context';
import { getStoredWarehouses, getStoredAuthSession, getStoredDispatchOrders, saveStoredDispatchOrders } from '../../services/storageService';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  warehouses?: Warehouse[];
  lang: 'ar' | 'en';
  onCreateInvoice: (invoice: SalesInvoice) => void;
}

export default function CreateInvoiceModal({
  isOpen,
  onClose,
  products,
  warehouses: propWarehouses,
  lang,
  onCreateInvoice
}: CreateInvoiceModalProps) {
  if (!isOpen) return null;
  const isAr = lang === 'ar';
  const { settings, formatMoney, currencySymbol } = useSettings();
  const currentSession = getStoredAuthSession();
  const isMultiWarehouse = currentSession?.features?.multiWarehouse !== false;

  const formatCurrency = (amount: number) => formatMoney(amount);

  // Dynamic warehouses scoped strictly to the current tenant
  const [availableWarehouses, setAvailableWarehouses] = useState<Warehouse[]>(() => {
    if (propWarehouses && propWarehouses.length > 0) return propWarehouses;
    const stored = getStoredWarehouses();
    if (stored.length > 0) return stored;
    return [{
      id: 'WH-01',
      code: 'WH-01',
      nameAr: 'المستودع الرئيسي',
      nameEn: 'Main Warehouse',
      status: 'active'
    } as Warehouse];
  });

  const [warehouseName, setWarehouseName] = useState<string>(() => {
    const first = availableWarehouses[0];
    return first ? (isAr ? (first.nameAr || first.nameEn) : (first.nameEn || first.nameAr)) : (isAr ? 'المستودع الرئيسي' : 'Main Warehouse');
  });

  const [dispenseMode, setDispenseMode] = useState<'IN_STORE' | 'WAREHOUSE_DISPATCH'>('IN_STORE');
  const [targetDispatchWarehouseId, setTargetDispatchWarehouseId] = useState<string>(() => availableWarehouses[0]?.id || 'WH-01');

  // Dynamic Tax configuration: Default 0% in Iraq / countries without general VAT
  const taxRatePercent = typeof settings?.taxRate === 'number' 
    ? settings.taxRate 
    : (settings?.tenantCountryCode === 'SA' ? 15 : 0);
  const [applyTax, setApplyTax] = useState<boolean>(() => Boolean(settings?.isTaxEnabled && taxRatePercent > 0));

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit'>('cash');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [itemQty, setItemQty] = useState<number>(1);
  const [discount, setDiscount] = useState<number>(0);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync prop warehouses
  useEffect(() => {
    if (propWarehouses && propWarehouses.length > 0) {
      setAvailableWarehouses(propWarehouses);
      if (!propWarehouses.some(w => (w.nameAr || w.nameEn) === warehouseName)) {
        setWarehouseName(isAr ? (propWarehouses[0].nameAr || propWarehouses[0].nameEn) : (propWarehouses[0].nameEn || propWarehouses[0].nameAr));
      }
    }
  }, [propWarehouses, isAr]);

  // Real-time backend query for tenant warehouses
  useEffect(() => {
    let isMounted = true;
    const fetchTenantWarehouses = async () => {
      try {
        const session = getStoredAuthSession();
        const token = typeof window !== 'undefined' ? (localStorage.getItem('zilox_auth_token') || localStorage.getItem('logistock_erp_jwt_token')) : null;
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (session?.tenantSlug) {
          headers['X-Tenant-Id'] = session.tenantSlug;
        }

        const res = await fetch('/api/v1/warehouses', { headers });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped: Warehouse[] = data.map((d: any) => ({
              id: d.id,
              code: d.code,
              nameAr: d.nameAr || d.name,
              nameEn: d.nameEn || d.name,
              status: d.isActive ? 'active' : 'inactive'
            } as Warehouse));
            setAvailableWarehouses(mapped);
            setWarehouseName(prev => {
              if (mapped.some(w => (w.nameAr || w.nameEn) === prev)) return prev;
              return isAr ? (mapped[0].nameAr || mapped[0].nameEn) : (mapped[0].nameEn || mapped[0].nameAr);
            });
          }
        }
      } catch {
        // Fallback silently to existing availableWarehouses
      }
    };

    fetchTenantWarehouses();
    return () => { isMounted = false; };
  }, [isAr]);

  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];

  const handleAddItemFromSelector = () => {
    if (!selectedProduct) return;
    if (itemQty <= 0) {
      setErrorMsg(isAr ? 'يرجى إدخال كمية صحيحة أكبر من الصفر' : 'Quantity must be greater than zero');
      return;
    }
    if (itemQty > selectedProduct.currentStock) {
      setErrorMsg(isAr ? `الكمية المطلوبة (${itemQty}) تتجاوز الرصيد المتاح (${selectedProduct.currentStock}) في المخزن!` : `Requested quantity exceeds stock (${selectedProduct.currentStock})`);
      return;
    }

    setErrorMsg(null);

    const existingIndex = lineItems.findIndex(i => i.productId === selectedProduct.id);
    if (existingIndex >= 0) {
      const updated = [...lineItems];
      const newQty = updated[existingIndex].quantity + itemQty;
      if (newQty > selectedProduct.currentStock) {
        setErrorMsg(isAr ? `إجمالي الكمية المطلوبة تتجاوز الرصيد المتاح بالمخزن (${selectedProduct.currentStock})` : 'Total item quantity exceeds stock');
        return;
      }
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].total = newQty * updated[existingIndex].unitPrice;
      setLineItems(updated);
    } else {
      const newItem: InvoiceLineItem = {
        id: `LI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: selectedProduct.id,
        sku: selectedProduct.sku,
        nameAr: selectedProduct.nameAr,
        nameEn: selectedProduct.nameEn,
        quantity: itemQty,
        unitPrice: selectedProduct.sellingPrice,
        unit: selectedProduct.unit,
        total: itemQty * selectedProduct.sellingPrice
      };
      setLineItems([...lineItems, newItem]);
    }

    setItemQty(1);
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
    const updated = [...lineItems];
    const item = updated[index];
    const product = products.find(p => p.id === item.productId);
    const maxStock = product?.currentStock || 999;
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    if (newQty > maxStock) {
      setErrorMsg(isAr ? `الكمية لا يمكن أن تتجاوز الرصيد المتاح بالمخزن (${maxStock})` : `Cannot exceed stock (${maxStock})`);
      return;
    }

    setErrorMsg(null);
    item.quantity = newQty;
    item.total = newQty * item.unitPrice;
    setLineItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const getProductFloor = (prodId: string): number => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return 0;
    return prod.minSellingPrice !== undefined ? prod.minSellingPrice : Math.round(prod.sellingPrice * 0.88);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

  // Check if any individual line item is below its floor price
  const hasLineItemFloorBreach = lineItems.some(item => {
    const floor = getProductFloor(item.productId);
    return item.unitPrice < floor;
  });

  // Total floor minimum cost of all items in invoice
  const invoiceFloorTotal = lineItems.reduce((sum, item) => {
    const floor = getProductFloor(item.productId);
    return sum + (floor * item.quantity);
  }, 0);

  // Check if total discount causes invoice to breach total floor
  const isDiscountBreachingFloor = subtotal > 0 && (subtotal - discount) < invoiceFloorTotal;

  const isFloorBreached = hasLineItemFloorBreach || isDiscountBreachingFloor;
  const isDiscountExceedingSubtotal = discount > subtotal;
  const isDiscountBlocked = isDiscountExceedingSubtotal || isFloorBreached;

  const taxableAmount = Math.max(0, subtotal - Math.min(discount, subtotal));
  const taxRate = taxRatePercent / 100;
  const tax = applyTax ? taxableAmount * taxRate : 0;
  const total = Math.max(0, taxableAmount + tax);
  const totalUnits = lineItems.reduce((acc, i) => acc + i.quantity, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMsg(isAr ? 'يرجى إدخال اسم العميل أو المشتري' : 'Please enter customer name');
      return;
    }
    if (lineItems.length === 0) {
      setErrorMsg(isAr ? 'يرجى إضافة صنف واحد على الأقل إلى الفاتورة' : 'Please add at least one line item');
      return;
    }
    if (isDiscountExceedingSubtotal) {
      setErrorMsg(isAr 
        ? `خطأ مالي فادح: قيمة الخصم (${formatCurrency(discount)}) لا يمكن أن تتجاوز إجمالي الفاتورة (${formatCurrency(subtotal)})!` 
        : `Discount (${formatCurrency(discount)}) cannot exceed invoice subtotal (${formatCurrency(subtotal)})!`);
      return;
    }
    if (isFloorBreached) {
      setErrorMsg(isAr 
        ? 'تجاوزت الحد المسموح به للخصم على هذه المادة' 
        : 'Discount exceeds allowed floor limit for this item');
      return;
    }

    const session = getStoredAuthSession();
    const nextInvoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const invoiceId = `INV-${Date.now()}`;

    const isWarehouseDispatch = dispenseMode === 'WAREHOUSE_DISPATCH';
    const targetWh = availableWarehouses.find(w => w.id === targetDispatchWarehouseId);
    const resolvedWarehouseName = isWarehouseDispatch && targetWh
      ? (isAr ? (targetWh.nameAr || targetWh.nameEn) : (targetWh.nameEn || targetWh.nameAr))
      : warehouseName;

    let dispatchOrder: WarehouseDispatchOrder | undefined;
    if (isWarehouseDispatch) {
      dispatchOrder = {
        id: `DISP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        invoiceId,
        invoiceNumber: nextInvoiceNumber,
        warehouseId: targetWh?.id || 'WH-01',
        warehouseName: resolvedWarehouseName,
        customerName: customerName.trim(),
        cashierName: session?.fullName?.trim() || session?.username?.trim() || (isAr ? 'أمين الصندوق' : 'Cashier'),
        items: lineItems.map(it => {
          const prod = products.find(p => p.id === it.productId);
          return {
            productId: it.productId,
            productName: it.productName || it.nameAr || it.nameEn,
            sku: prod?.sku || 'SKU',
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.total,
            shelfLocation: prod?.shelf || 'A-01'
          };
        }),
        totalQuantity: totalUnits,
        status: 'PENDING',
        notes: isAr ? 'طلب صرف وتجهيز صادر مع فاتورة المبيعات' : 'Warehouse dispatch order issued with sales invoice',
        createdAt: new Date().toISOString()
      };

      const currentOrders = getStoredDispatchOrders();
      saveStoredDispatchOrders([dispatchOrder, ...currentOrders]);
    }

    const newInvoice: SalesInvoice = {
      id: invoiceId,
      invoiceNo: nextInvoiceNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      warehouseName: resolvedWarehouseName,
      dispenseMode,
      fulfillmentStatus: isWarehouseDispatch ? 'PENDING_DISPATCH' : 'FULFILLED',
      dispatchOrderId: dispatchOrder?.id,
      receiptDispenseNotice: isWarehouseDispatch
        ? (isAr ? 'قيد التجهيز من المستودع - يرجى مراجعة أمين المستودع للاستلام' : 'Pending warehouse dispatch - please collect from warehouse')
        : (isAr ? 'مستلمة ومصروفة مباشرة' : 'Direct in-store fulfillment'),
      items: lineItems,
      itemsCount: totalUnits,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      status: paymentMethod === 'credit' ? 'credit' : 'paid',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      operator: session?.fullName?.trim() || session?.username?.trim() || (isAr ? 'أمين الصندوق' : 'Cashier')
    };

    onCreateInvoice(newInvoice);
    onClose();
  };

  return (
    <>
      <div className="modal-backdrop fade-in" onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
        <div 
          className="invoice-clean-modal" 
          onClick={(e) => e.stopPropagation()}
        >
        {/* Sleek Minimalist Header */}
        <div className="invoice-modal-header">
          <div className="invoice-header-info">
            <div className="invoice-header-title-wrap">
              <h3 className="invoice-modal-title">
                {isAr ? 'إصدار فاتورة مبيعات جديدة' : 'New Sales Invoice'}
              </h3>
              <span className="invoice-ref-tag">
                INV-{new Date().getFullYear()}-AUTO
              </span>
            </div>
            <p className="invoice-modal-desc">
              {isAr 
                ? 'تجهيز البضائع وحسم الرصيد الفوري من المخزن واحتساب الحركات المالية' 
                : 'Fulfill items, deduct inventory balance automatically, and ledger financial totals'}
            </p>
          </div>

          <button 
            type="button" 
            className="invoice-close-btn" 
            onClick={onClose} 
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="invoice-modal-form">
          {errorMsg && (
            <div className="invoice-alert-banner fade-in">
              <span>{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg(null)} className="alert-dismiss-btn">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Customer & Dispatch Section */}
          <div className="invoice-section-grid">
            {/* Customer Name */}
            <div className="invoice-field">
              <div className="invoice-field-label">
                <User size={13} />
                <span>{isAr ? 'اسم العميل / المشتري' : 'Cust\u200Comer Na\u200Cme'}</span>
                <span className="required-star">*</span>
              </div>
              <input 
                type="text" 
                autoComplete="new-password"
                className="invoice-text-input"
                placeholder={isAr ? "اسم العميل أو اسم الشركة..." : "Customer or Company Name..."}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Customer Phone */}
            <div className="invoice-field">
              <div className="invoice-field-label">
                <Phone size={13} />
                <span>{isAr ? 'رقم الهاتف' : 'Pho\u200Cne'}</span>
              </div>
              <input 
                type="text" 
                autoComplete="new-password"
                className="invoice-text-input"
                placeholder={isAr ? 'رقم الهاتف مع رمز الدولة...' : '+1 (555) 000-0000'}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>

            {/* Payment Method Segments */}
            <div className="invoice-field">
              <label className="invoice-field-label">
                <span>{isAr ? 'طريقة السداد' : 'Payment Method'}</span>
              </label>
              <div className="invoice-seg-control">
                <button 
                  type="button" 
                  className={`seg-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <Banknote size={13} />
                  <span>{isAr ? 'نقدي' : 'Cash'}</span>
                </button>
                <button 
                  type="button" 
                  className={`seg-btn ${paymentMethod === 'card' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('card')}
                >
                  <CreditCard size={13} />
                  <span>{isAr ? 'بطاقة' : 'Card'}</span>
                </button>
                <button 
                  type="button" 
                  className={`seg-btn ${paymentMethod === 'credit' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('credit')}
                >
                  <Clock size={13} />
                  <span>{isAr ? 'آجل' : 'Credit'}</span>
                </button>
              </div>
            </div>

            {/* Dispense Mode Segmented Control (Hidden if single warehouse) */}
            {isMultiWarehouse && (
              <div className="invoice-field">
                <label className="invoice-field-label">
                  <Package size={13} />
                  <span>{isAr ? 'طريقة الصرف والتسليم' : 'Dispense Mode'}</span>
                </label>
                <div className="invoice-seg-control">
                  <button 
                    type="button" 
                    className={`seg-btn ${dispenseMode === 'IN_STORE' ? 'active' : ''}`}
                    onClick={() => setDispenseMode('IN_STORE')}
                  >
                    <Zap size={13} style={{ color: dispenseMode === 'IN_STORE' ? '#eab308' : undefined }} />
                    <span>{isAr ? 'صرف مباشر' : 'Direct In-Store'}</span>
                  </button>
                  <button 
                    type="button" 
                    className={`seg-btn ${dispenseMode === 'WAREHOUSE_DISPATCH' ? 'active' : ''}`}
                    onClick={() => setDispenseMode('WAREHOUSE_DISPATCH')}
                  >
                    <Package size={13} style={{ color: dispenseMode === 'WAREHOUSE_DISPATCH' ? '#2563eb' : undefined }} />
                    <span>{isAr ? 'تجهيز مستودع' : 'Warehouse Dispatch'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Target Fulfillment Hub / Warehouse Banner */}
          {isMultiWarehouse ? (
            dispenseMode === 'WAREHOUSE_DISPATCH' ? (
              <div style={{
                margin: '6px 0 12px 0',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#1d4ed8',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  <Building2 size={16} />
                  <span>{isAr ? 'مستودع التجهيز والشحن المستهدف (Target Fulfillment Hub):' : 'Target Fulfillment Hub:'}</span>
                </div>
                <select
                  value={targetDispatchWarehouseId}
                  onChange={(e) => {
                    setTargetDispatchWarehouseId(e.target.value);
                    const selWh = availableWarehouses.find(w => w.id === e.target.value);
                    if (selWh) {
                      setWarehouseName(isAr ? (selWh.nameAr || selWh.nameEn) : (selWh.nameEn || selWh.nameAr));
                    }
                  }}
                  style={{
                    flex: 1,
                    maxWidth: '360px',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid #93c5fd',
                    background: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e3a8a',
                    outline: 'none'
                  }}
                >
                  {availableWarehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {isAr ? (wh.nameAr || wh.nameEn) : (wh.nameEn || wh.nameAr)} ({wh.code || wh.id})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{
                margin: '4px 0 10px 0',
                padding: '6px 12px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  <Building2 size={14} />
                  <span>{isAr ? 'مستودع الصرف المباشر:' : 'Direct In-Store Warehouse:'}</span>
                </div>
                <select
                  className="invoice-select-input"
                  style={{ maxWidth: '300px', height: '32px', fontSize: '12px' }}
                  value={warehouseName}
                  onChange={(e) => setWarehouseName(e.target.value)}
                >
                  {availableWarehouses.map((wh) => {
                    const val = isAr ? (wh.nameAr || wh.nameEn) : (wh.nameEn || wh.nameAr);
                    return (
                      <option key={wh.id} value={val}>
                        {val}
                      </option>
                    );
                  })}
                </select>
              </div>
            )
          ) : (
            <div style={{
              margin: '4px 0 10px 0',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600
            }}>
              <Building2 size={15} style={{ color: '#059669' }} />
              <span>{isAr ? 'المستودع الرئيسي (اعتماد تلقائي في الخلفية)' : 'Main Warehouse (Auto-assigned default)'}</span>
            </div>
          )}

          {/* Product Fast Insertion Action Bar */}
          <div className="invoice-action-bar">
            <div className="bar-select-col">
              <label className="invoice-field-label">
                <span>{isAr ? 'اختر مادة من المخزن' : 'Select Product from Warehouse'}</span>
              </label>
              <select 
                className="invoice-select-input"
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setItemQty(1);
                  setErrorMsg(null);
                }}
              >
                {products.map(p => {
                  const isOutOfStock = p.currentStock <= 0;
                  return (
                    <option key={p.id} value={p.id} disabled={isOutOfStock}>
                      {isOutOfStock ? (isAr ? '[نافد] ' : '[Out of Stock] ') : ''}
                      {p.nameAr} — {formatCurrency(p.sellingPrice)}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedProduct && (
              <div className="bar-preview-badge">
                <div className="preview-label">{isAr ? 'الرصيد المتاح' : 'Stock'}</div>
                <div className={`preview-value ${selectedProduct.currentStock <= 0 ? 'out' : selectedProduct.currentStock <= selectedProduct.minStockAlert ? 'low' : ''}`}>
                  {selectedProduct.currentStock} {selectedProduct.unit}
                </div>
              </div>
            )}

            <div className="bar-qty-col">
              <label className="invoice-field-label">
                <span>{isAr ? 'الكمية' : 'Qty'}</span>
              </label>
              <div className="invoice-stepper">
                <button 
                  type="button" 
                  className="step-btn"
                  onClick={() => setItemQty(Math.max(1, itemQty - 1))}
                  title={isAr ? 'إنقاص' : 'Minus'}
                >
                  <Minus size={13} />
                </button>
                <input 
                  type="text" 
                  inputMode="numeric"
                  className="step-input"
                  value={itemQty}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setItemQty(val ? Math.min(selectedProduct?.currentStock || 999, Math.max(1, parseInt(val, 10))) : 1);
                  }}
                />
                <button 
                  type="button" 
                  className="step-btn"
                  onClick={() => setItemQty(Math.min(selectedProduct?.currentStock || 999, itemQty + 1))}
                  title={isAr ? 'زيادة' : 'Plus'}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            <div className="bar-action-col">
              <label className="invoice-field-label" style={{ opacity: 0 }}>
                <span>&nbsp;</span>
              </label>
              <button 
                type="button" 
                className="invoice-add-btn"
                onClick={handleAddItemFromSelector}
                disabled={!selectedProduct || selectedProduct.currentStock <= 0}
              >
                <Plus size={15} />
                <span>{isAr ? 'إدراج الصنف' : 'Add Item'}</span>
              </button>
            </div>
          </div>

          {/* Line Items Accounting Ledger Table */}
          <div className="invoice-table-container">
            <table className="invoice-clean-table">
              <thead>
                <tr>
                  <th style={{ width: '44%' }}>{isAr ? 'الصنف والمواصفات' : 'Item Description'}</th>
                  <th style={{ width: '18%' }}>{isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
                  <th style={{ width: '16%' }}>{isAr ? 'الكمية' : 'Quantity'}</th>
                  <th style={{ width: '16%' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th style={{ width: '6%', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty-message">
                      <ShoppingCart size={28} className="empty-cart-icon" />
                      <div>{isAr ? 'الفاتورة فارغة حالياً' : 'No items added yet'}</div>
                      <span className="empty-hint">{isAr ? 'اختر صنفاً من القائمة أعلاه وانقر إدراج الصنف' : 'Choose an item above and click Add Item'}</span>
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item, idx) => (
                    <tr key={item.id} className="invoice-table-row">
                      <td>
                        <div className="row-item-title" dir="auto">{item.nameAr}</div>
                        <div className="row-item-sub">
                          <span className="sku-text">{item.sku}</span>
                          <span className="dot-divider">•</span>
                          <span className="unit-text">{item.unit}</span>
                        </div>
                      </td>
                      <td className="price-cell">
                        {(() => {
                          const itemFloor = getProductFloor(item.productId);
                          const isItemBreached = item.unitPrice < itemFloor;

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '11px', marginInlineEnd: 2 }}>{currencySymbol}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const updated = [...lineItems];
                                    updated[idx].unitPrice = val;
                                    updated[idx].total = val * updated[idx].quantity;
                                    setLineItems(updated);
                                  }}
                                  style={{
                                    width: '85px',
                                    padding: '2px 6px',
                                    borderRadius: '5px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    background: isItemBreached ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                    border: isItemBreached ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                                    color: isItemBreached ? '#ef4444' : '#10b981'
                                  }}
                                />
                              </div>
                              {isItemBreached && (
                                <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 700 }}>
                                  {isAr ? 'دون حد الأمان' : 'Below floor'}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        <div className="table-row-stepper">
                          <button 
                            type="button" 
                            className="row-step-btn"
                            onClick={() => handleUpdateItemQty(idx, -1)}
                          >
                            <Minus size={11} />
                          </button>
                          <span className="row-step-val">{item.quantity}</span>
                          <button 
                            type="button" 
                            className="row-step-btn"
                            onClick={() => handleUpdateItemQty(idx, 1)}
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </td>
                      <td className="total-cell">
                        {formatCurrency(item.total)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          type="button" 
                          className="row-del-btn"
                          onClick={() => handleRemoveItem(idx)}
                          title={isAr ? 'حذف' : 'Remove'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Financial Summary Ledger Panel */}
          <div className="invoice-summary-bar">
            {/* Left Controls: Discount & Tax */}
            <div className="summary-left-tools">
              <div className="discount-input-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                  <span className="tool-label">
                    <Tag size={13} />
                    <span>{isAr ? 'خصم الفاتورة التفاوضي:' : 'Discount:'}</span>
                  </span>
                  <div className="discount-input-box" style={{ flex: 1, borderColor: isDiscountBlocked ? '#ef4444' : undefined }}>
                    <span className="currency-sign">{currencySymbol}</span>
                    <input 
                      type="number" 
                      min="0" 
                      max={subtotal > 0 ? subtotal : undefined}
                      step="0.01"
                      className="discount-field"
                      value={discount || ''}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setDiscount(val);
                      }}
                    />
                  </div>
                </div>

                {/* Real-time Floor Price Protection Indicators */}
                {isDiscountExceedingSubtotal ? (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 8px', borderRadius: '6px', color: '#f87171', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={13} />
                    <span>{isAr ? `خطأ: الخصم (${formatCurrency(discount)}) لا يمكن أن يتجاوز قيمة الفاتورة (${formatCurrency(subtotal)})!` : `Error: Discount exceeds invoice subtotal!`}</span>
                  </div>
                ) : isFloorBreached ? (
                  <div style={{ background: 'rgba(239, 68, 68, 0.18)', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '5px 8px', borderRadius: '6px', color: '#fca5a5', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <span>{isAr ? 'تجاوزت الحد المسموح به للخصم على هذه المادة' : 'Discount exceeds allowed floor limit for this item'}</span>
                  </div>
                ) : discount > 0 ? (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 8px', borderRadius: '6px', color: '#34d399', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={13} />
                    <span>{isAr ? 'تم قبول الخصم التفاوضي ضمن حد الأمان المالي' : 'Discount accepted within safety floor'}</span>
                  </div>
                ) : null}
              </div>

              {/* Dynamic VAT Checkbox: Default 0% / unchecked in non-VAT regions */}
              <label className="vat-checkbox-label" style={{ marginTop: '6px', opacity: taxRatePercent > 0 ? 1 : 0.65 }}>
                <input 
                  type="checkbox" 
                  checked={applyTax}
                  disabled={taxRatePercent <= 0}
                  onChange={(e) => setApplyTax(e.target.checked)}
                  className="vat-check"
                />
                <span>
                  {taxRatePercent > 0 
                    ? (isAr ? `احتساب ضريبة القيمة المضافة (${taxRatePercent}% VAT)` : `Apply ${taxRatePercent}% VAT`)
                    : (isAr ? 'ضريبة القيمة المضافة (معفاة / 0%)' : 'Tax Exempt / 0%')}
                </span>
              </label>
            </div>

            {/* Right Totals: Clean Financial Summary */}
            <div className="summary-right-totals">
              <div className="calc-row">
                <span className="calc-label">{isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                <span className="calc-val">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="calc-row discount">
                  <span className="calc-label">{isAr ? 'الخصم الممنوح:' : 'Discount:'}</span>
                  <span className="calc-val discount-val">-{formatCurrency(Math.min(discount, subtotal))}</span>
                </div>
              )}
              {applyTax && taxRatePercent > 0 && (
                <div className="calc-row">
                  <span className="calc-label">{isAr ? `الضريبة (${taxRatePercent}%):` : `VAT (${taxRatePercent}%):`}</span>
                  <span className="calc-val">{formatCurrency(tax)}</span>
                </div>
              )}
              <div className="grand-total-row">
                <div className="grand-label-wrap">
                  <span className="grand-text">{isAr ? 'المبلغ المستحق' : 'Total Due'}</span>
                  {totalUnits > 0 && (
                    <span className="grand-units">({totalUnits} {isAr ? 'قطعة' : 'units'})</span>
                  )}
                </div>
                <div className="grand-amount">
                  {formatCurrency(total)}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Bottom Actions */}
          <div className="invoice-bottom-actions">
            <button 
              type="submit" 
              className="invoice-btn-confirm"
              disabled={lineItems.length === 0 || isDiscountBlocked}
              style={{
                opacity: (lineItems.length === 0 || isDiscountBlocked) ? 0.5 : 1,
                cursor: (lineItems.length === 0 || isDiscountBlocked) ? 'not-allowed' : 'pointer'
              }}
            >
              <CheckCircle2 size={17} />
              <span>{isAr ? 'حفظ وإصدار الفاتورة' : 'Save & Issue Invoice'}</span>
            </button>
            <button 
              type="button" 
              className="invoice-btn-cancel" 
              onClick={onClose}
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </>
  );
}
