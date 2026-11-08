import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Printer, 
  CheckCircle, 
  Search, 
  CreditCard,
  Banknote,
  Barcode
} from 'lucide-react';
import { Product, SalesInvoice } from '../types/warehouse';
import { useSettings } from '../context/settings-context';

interface SalesPosTabProps {
  products: Product[];
  salesInvoices: SalesInvoice[];
  lang: string;
  onCompleteSale: (invoice: SalesInvoice, cartItems: Array<{ product: Product; qty: number }>) => void;
}

export default function SalesPosTab({
  products,
  salesInvoices,
  lang,
  onCompleteSale
}: SalesPosTabProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const [cart, setCart] = useState<Array<{ product: Product; qty: number }>>([
    { product: products[0], qty: 2 },
    { product: products[3], qty: 5 }
  ]);
  const [customerName, setCustomerName] = useState('شركة الرشيد للحلول الهندسية');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit'>('cash');
  const [discount, setDiscount] = useState(0);

  // Computed cart totals
  const subtotal = cart.reduce((acc, item) => acc + (item.product.sellingPrice * item.qty), 0);
  const tax = subtotal * 0.05; // 5% tax
  const total = Math.max(0, subtotal + tax - discount);

  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) return;
    const existingIndex = cart.findIndex(i => i.product.id === product.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      if (updated[existingIndex].qty < product.currentStock) {
        updated[existingIndex].qty += 1;
        setCart(updated);
      }
    } else {
      setCart([...cart, { product, qty: 1 }]);
    }
  };

  const updateQty = (index: number, delta: number) => {
    const updated = [...cart];
    const newQty = updated[index].qty + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else if (newQty <= updated[index].product.currentStock) {
      updated[index].qty = newQty;
    }
    setCart(updated);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const newInvoice: SalesInvoice = {
      id: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceNo: `POS-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName,
      warehouseName: 'المستودع الرئيسي',
      itemsCount: cart.reduce((acc, item) => acc + item.qty, 0),
      subtotal,
      tax,
      total,
      status: paymentMethod === 'credit' ? 'credit' : 'paid',
      date: new Date().toISOString().slice(0, 10)
    };

    onCompleteSale(newInvoice, cart);
    setCart([]);
  };

  return (
    <div className="pos-layout fade-in">
      {/* Left/Main Column: Product Grid */}
      <div className="pos-products-col">
        <div className="pos-search-header glass-panel">
          <h3>{isAr ? 'المنتجات الجاهزة للبيع والتحميل' : 'Available Inventory for Sale'}</h3>
          <p className="chart-sub">{isAr ? 'انقر على أي صنف لإضافته فوراً إلى فاتورة البيع المباشرة' : 'Click any item to add to live POS invoice'}</p>
        </div>

        <div className="pos-products-grid">
          {products.map(p => (
            <div 
              key={p.id} 
              className={`pos-product-card glass-panel ${p.currentStock === 0 ? 'disabled' : ''}`}
              onClick={() => addToCart(p)}
            >
              <div className="pos-card-top">
                <span className="code-badge">{p.sku}</span>
                <span className={`badge ${p.currentStock > 10 ? 'badge-success' : p.currentStock > 0 ? 'badge-warning' : 'badge-danger'}`}>
                  {p.currentStock} {p.unit}
                </span>
              </div>
              <h4><span dir="auto">{p.nameAr}</span></h4>
              <div className="pos-card-footer">
                <span className="pos-price">{formatMoney(p.sellingPrice)}</span>
                <button className="btn-add-circle" disabled={p.currentStock === 0}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Active Bill / Cart & Checkout */}
      <div className="pos-bill-col glass-panel">
        <div className="bill-header">
          <div className="bill-title-box">
            <ShoppingCart size={20} className="text-primary" />
            <h3>{isAr ? 'فاتورة البيع الحالية' : 'Active Sales Invoice'}</h3>
          </div>
          <span className="code-badge">INV-NEW</span>
        </div>

        {/* Customer Input */}
        <div className="bill-customer-group">
          <label>{isAr ? 'العميل / جهة البيع:' : 'Customer:'}</label>
          <input 
            type="text" 
            value={customerName} 
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={isAr ? 'اسم العميل أو الشركة...' : 'Customer Name...'}
          />
        </div>

        {/* Cart Items List */}
        <div className="bill-items-list">
          {cart.length === 0 ? (
            <div className="empty-cart-msg">
              <ShoppingCart size={32} />
              <p>{isAr ? 'السلة فارغة. انقر على الأصناف لإضافتها.' : 'Cart is empty. Add products to begin.'}</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={item.product.id} className="bill-item-row">
                <div className="item-main-info">
                  <strong dir="auto">{item.product.nameAr}</strong>
                  <small>{formatMoney(item.product.sellingPrice)} × {item.qty} = {formatMoney(item.product.sellingPrice * item.qty)}</small>
                </div>
                <div className="item-qty-controls">
                  <button onClick={() => updateQty(idx, -1)} className="btn-qty-sm">
                    <Minus size={13} />
                  </button>
                  <span className="item-qty-val">{item.qty}</span>
                  <button onClick={() => updateQty(idx, 1)} className="btn-qty-sm" disabled={item.qty >= item.product.currentStock}>
                    <Plus size={13} />
                  </button>
                  <button onClick={() => {
                    const updated = [...cart];
                    updated.splice(idx, 1);
                    setCart(updated);
                  }} className="btn-remove-item">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Payment Calculation Summary */}
        <div className="bill-totals-box">
          <div className="total-line">
            <span>{isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
            <strong>{formatMoney(subtotal)}</strong>
          </div>
          <div className="total-line">
            <span>{isAr ? 'ضريبة القيمة المضافة (5%):' : 'Tax (5%):'}</span>
            <span>{formatMoney(tax)}</span>
          </div>
          <div className="total-line">
            <span>{isAr ? 'الخصم الترويجي:' : 'Discount:'}</span>
            <span>-{formatMoney(discount)}</span>
          </div>
          <div className="total-divider"></div>
          <div className="total-grand-line">
            <span>{isAr ? 'الإجمالي النهائي المطلوب:' : 'Grand Total:'}</span>
            <span className="grand-amount">{formatMoney(total)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="payment-method-selector">
          <button 
            className={`pay-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
            onClick={() => setPaymentMethod('cash')}
          >
            <Banknote size={16} />
            <span>{isAr ? 'نقداً' : 'Cash'}</span>
          </button>
          <button 
            className={`pay-btn ${paymentMethod === 'card' ? 'active' : ''}`}
            onClick={() => setPaymentMethod('card')}
          >
            <CreditCard size={16} />
            <span>{isAr ? 'بطاقة بنكية' : 'Card'}</span>
          </button>
          <button 
            className={`pay-btn ${paymentMethod === 'credit' ? 'active' : ''}`}
            onClick={() => setPaymentMethod('credit')}
          >
            <span>{isAr ? 'آجل (ذمم)' : 'Credit'}</span>
          </button>
        </div>

        {/* Checkout Button */}
        <button 
          className="btn-checkout-primary"
          onClick={handleCheckout}
          disabled={cart.length === 0}
        >
          <Printer size={18} />
          <span>{isAr ? 'تأكيد البيع وطباعة الإيصال وخفض المخزون' : 'Confirm Sale & Print Voucher'}</span>
        </button>
      </div>
    </div>
  );
}
