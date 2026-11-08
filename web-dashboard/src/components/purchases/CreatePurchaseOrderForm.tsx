import React, { useState } from 'react';
import { 
  Clock, Plus, Trash2, ArrowRight, Building2, Calendar, 
  AlertCircle, CheckCircle2, Package, Sparkles
} from 'lucide-react';
import { Product, Warehouse } from '../../types/warehouse';
import { PurchaseOrder, PurchaseOrderItem } from '../../types/purchases';
import { getStoredSuppliers, saveStoredPurchaseOrders, getStoredPurchaseOrders } from '../../services/storageService';
import PurchaseItemCombobox from './PurchaseItemCombobox';
import { formatIQD } from './PurchaseInvoiceItemsGrid';
import { useSettings } from '../../context/settings-context';

interface CreatePurchaseOrderFormProps {
  products: Product[];
  warehouses: Warehouse[];
  isAr?: boolean;
  onOrderCreated: (po: PurchaseOrder) => void;
  onCancel: () => void;
}

const DEFAULT_UOM_OPTIONS_AR = ['قطعة', 'درزن', 'كرتونة', 'كجم', 'طرد', 'بكرة', 'متر'];
const DEFAULT_UOM_OPTIONS_EN = ['Piece', 'Dozen', 'Box/Carton', 'Kg', 'Pack', 'Roll', 'Meter'];

export default function CreatePurchaseOrderForm({
  products,
  warehouses,
  isAr = true,
  onOrderCreated,
  onCancel
}: CreatePurchaseOrderFormProps) {
  const { tenantCountryCode, settings, currencySymbol, formatMoney } = useSettings();
  const isIraqTenant = (tenantCountryCode === 'IQ' || settings?.tenantCountryCode === 'IQ');
  const isIqd = (settings?.baseCurrency === 'IQD');
  const effectiveSymbol = currencySymbol || (isIqd ? (isAr ? 'د.ع' : 'IQD') : '$');

  const formatCurrency = (amt: number | undefined | null) => {
    return formatMoney(Number(amt) || 0);
  };

  const uomList = isAr ? DEFAULT_UOM_OPTIONS_AR : DEFAULT_UOM_OPTIONS_EN;
  const suppliers = getStoredSuppliers();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>(suppliers[0]?.company || (isAr ? 'مورد عام' : 'General Supplier'));
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>(warehouses[0]?.id || 'WH-01');
  const [orderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [orderNotes, setOrderNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Line items state
  const [items, setItems] = useState<PurchaseOrderItem[]>([
    {
      id: `POI-${Date.now()}-1`,
      sku: '',
      barcode: '',
      nameAr: '',
      uom: isAr ? 'قطعة' : 'Piece',
      quantity: 1,
      estimatedUnitCost: 0,
      lineTotal: 0
    }
  ]);

  const targetWarehouse: Warehouse = warehouses.find(w => w.id === targetWarehouseId) || warehouses[0] || {
    id: 'WH-01',
    code: 'WH-01',
    nameAr: 'المستودع الرئيسي',
    nameEn: 'Main Warehouse',
    city: 'المقر الرئيسي',
    manager: 'الإدارة المركزية',
    phone: '+964 770 000 0000',
    capacity: 10000,
    occupied: 0,
    itemsCount: 0,
    status: 'active'
  };

  const updateItem = (index: number, updates: Partial<PurchaseOrderItem>) => {
    setItems(prev => {
      const next = [...prev];
      const target = { ...next[index], ...updates };
      const qty = Number(target.quantity) || 0;
      const cost = Number(target.estimatedUnitCost) || 0;
      target.lineTotal = Math.round(qty * cost);
      next[index] = target;
      return next;
    });
  };

  const handleAddNewLine = () => {
    setItems(prev => [
      ...prev,
      {
        id: `POI-${Date.now()}-${prev.length + 1}`,
        sku: '',
        barcode: '',
        nameAr: '',
        uom: isAr ? 'قطعة' : 'Piece',
        quantity: 1,
        estimatedUnitCost: 0,
        lineTotal: 0
      }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (items.length === 1) {
      setItems([{
        id: `POI-${Date.now()}-1`,
        sku: '',
        barcode: '',
        nameAr: '',
        uom: isAr ? 'قطعة' : 'Piece',
        quantity: 1,
        estimatedUnitCost: 0,
        lineTotal: 0
      }]);
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSelectProduct = (index: number, p: Product) => {
    updateItem(index, {
      productId: p.id,
      sku: p.sku,
      barcode: p.barcode,
      nameAr: isAr ? p.nameAr : (p.nameEn || p.nameAr),
      nameEn: p.nameEn,
      uom: p.unit || (isAr ? 'قطعة' : 'Piece'),
      estimatedUnitCost: p.costPrice || 0
    });
  };

  // Calculated totals directly from line items
  const totalAmount = items.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
  const totalQuantity = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validItems = items.filter(it => it.nameAr.trim() && it.quantity > 0 && it.estimatedUnitCost >= 0);
    if (validItems.length === 0) {
      setErrorMessage(isAr ? 'يرجى إضافة مادة واحدة على الأقل ببيانات صحيحة' : 'Please add at least one valid item');
      return;
    }

    const completeItems = validItems.map((it, idx) => ({
      ...it,
      sku: it.sku.trim() || `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`,
      barcode: it.barcode?.trim() || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`
    }));

    const po: PurchaseOrder = {
      id: `PO-${Date.now().toString().slice(-6)}`,
      poNumber: `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      supplierId: selectedSupplierId,
      supplierName: selectedSupplierName,
      targetWarehouseId: targetWarehouse.id,
      targetWarehouseName: `${isAr ? targetWarehouse.nameAr : (targetWarehouse.nameEn || targetWarehouse.nameAr)} (${targetWarehouse.code || 'WH-01'})`,
      orderDate,
      expectedDate,
      items: completeItems,
      itemsCount: totalQuantity,
      totalAmount,
      status: 'SUBMITTED',
      notes: orderNotes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const currentPOs = getStoredPurchaseOrders();
    const next = [po, ...currentPOs];
    saveStoredPurchaseOrders(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp_purchases_updated'));
    }
    onOrderCreated(po);
  };

  return (
    <div className="w-full px-6 py-4 space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border w-full">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={isAr ? 'العودة' : 'Back'}
            >
              <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            </button>
            <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span>{isAr ? 'إصدار أمر شراء مجدول جديد (طلب توريد مستقبلي)' : 'New Scheduled Purchase Order (PO)'}</span>
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ps-8">
            {isAr
              ? 'تحديد المواد المطلوبة والكميات والتكلفة المتوقعة لحجز الطلبية مع المورد دون التأثير على المخزون الفعلي'
              : 'Specify required items, quantities and expected costs without affecting real warehouse inventory'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted text-xs font-bold transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء والعودة' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isAr ? 'إصدار وحفظ أمر الشراء المجدول' : 'Issue Purchase Order'}</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Card 1: ترويسة أمر الشراء */}
      <div className="bg-card border border-border rounded-xl p-5 w-full shadow-sm">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border">
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <div>
            <h3 className="font-bold text-foreground text-sm">
              1. {isAr ? 'بيانات أمر الشراء والمورد' : 'Order Header & Supplier Details'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr ? 'اختيار المورد المستهدف، مستودع التفريغ المستقبلي، وموعد الوصول المتوقع' : 'Target vendor, receiving hub, and estimated time of arrival'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Supplier */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              {isAr ? 'المورد / الشركة المتعاقد معها:' : 'Vendor / Supplier:'}
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => {
                const sId = e.target.value;
                setSelectedSupplierId(sId);
                const sObj = suppliers.find(s => s.id === sId);
                if (sObj) setSelectedSupplierName(sObj.company);
              }}
              className="h-10 w-full px-3 rounded-lg border border-border bg-card text-foreground text-xs font-medium outline-none focus:border-primary cursor-pointer"
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.company}</option>
              ))}
            </select>
          </div>

          {/* Target Warehouse */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              {isAr ? 'المستودع المطلوب التوريد إليه:' : 'Target Warehouse Hub:'}
            </label>
            <select
              value={targetWarehouseId}
              onChange={(e) => setTargetWarehouseId(e.target.value)}
              className="h-10 w-full px-3 rounded-lg border border-border bg-card text-foreground text-xs font-medium outline-none focus:border-primary cursor-pointer"
            >
              {warehouses.map(wh => {
                const whName = isAr ? wh.nameAr : (wh.nameEn || (wh.id === 'WH-01' ? 'Main Warehouse' : wh.nameAr));
                return (
                  <option key={wh.id} value={wh.id}>
                    ({wh.code || wh.id}) {whName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Order Date */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              {isAr ? 'تاريخ إصدار الطلب:' : 'Order Date:'}
            </label>
            <input
              type="date"
              disabled
              value={orderDate}
              className="h-10 w-full px-3 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-mono font-bold outline-none cursor-not-allowed"
            />
          </div>

          {/* Expected Date (ETA) */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              {isAr ? 'تاريخ الوصول المتوقع (ETA):' : 'Estimated Arrival (ETA):'}
            </label>
            <input
              type="date"
              required
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="h-10 w-full px-3 rounded-lg border border-border bg-card text-foreground text-xs font-mono font-bold outline-none focus:border-primary cursor-pointer"
            />
          </div>
        </div>

        {/* Order Notes */}
        <div className="mt-4">
          <label className="block text-xs font-bold text-foreground mb-1.5">
            {isAr ? 'شروط وملاحظات أمر الشراء:' : 'Terms & Order Instructions:'}
          </label>
          <input
            type="text"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder={isAr ? 'شروط الشحن، طريقة السداد المتفق عليها، أو متطلبات الفحص...' : 'Inspection requirements, payment terms...'}
            className="h-10 w-full px-3 rounded-lg border border-border bg-card text-foreground text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Card 2: جدول بنود المواد المطلوبة بالتفصيل */}
      <div className="bg-card border border-border rounded-xl p-5 w-full shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-border w-full">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-foreground">
                2. {isAr ? 'جدول بنود المواد والكميات المطلوبة' : '2. Ordered Line Items'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? 'تسجيل المواد والكميات والتكلفة المتوقعة للقطعة؛ تحسب القيم الإجمالية تلقائياً'
                  : 'Add items, required quantities, and expected unit costs; totals calculated automatically'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddNewLine}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'إضافة مادة للطلبية' : 'Add Item'}</span>
          </button>
        </div>

        {/* Line Items Grid */}
        <div className="border border-border rounded-xl bg-card overflow-x-auto w-full shadow-inner">
          <div className="w-full min-w-[840px]">
            {/* Header */}
            <div className="grid grid-cols-[40px_1fr_110px_100px_140px_140px_45px] gap-2 items-center px-4 py-3 bg-muted/60 border-b border-border text-muted-foreground text-xs font-bold select-none">
              <div className="text-center font-mono">#</div>
              <div className="text-start">{isAr ? 'الصنف والباركود' : 'Item & Barcode'}</div>
              <div className="text-center">{isAr ? 'الوحدة' : 'UOM'}</div>
              <div className="text-center">{isAr ? 'الكمية المطلوبة' : 'Order Qty'}</div>
              <div className="text-center text-[11px] leading-tight font-bold">{isAr ? `التكلفة المتوقعة (${effectiveSymbol})` : `Est. Cost (${effectiveSymbol})`}</div>
              <div className="text-center text-[11px] leading-tight font-bold">{isAr ? `إجمالي البند (${effectiveSymbol})` : `Line Total (${effectiveSymbol})`}</div>
              <div className="text-center" title={isAr ? 'حذف' : 'Remove'}>
                <Trash2 className="w-4 h-4 opacity-60 mx-auto" />
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/60">
              {items.map((item, idx) => (
                <div
                  key={item.id || `poi-${idx}`}
                  className="grid grid-cols-[40px_1fr_110px_100px_140px_140px_45px] gap-2 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors"
                >
                  <div className="text-center font-mono text-xs text-muted-foreground font-semibold">
                    {idx + 1}
                  </div>

                  <div className="min-w-0">
                    <PurchaseItemCombobox
                      value={item.nameAr || item.sku || ''}
                      barcode={item.barcode}
                      products={products}
                      placeholder={isAr ? 'ابحث باسم الصنف أو امسح الباركود...' : 'Scan barcode or enter product name...'}
                      isAr={isAr}
                      onSelectProduct={(p) => handleSelectProduct(idx, p)}
                      onOpenDefineProduct={(q) => updateItem(idx, { nameAr: q, sku: `SKU-${Date.now().toString().slice(-4)}` })}
                      onManualTextChange={(val) => updateItem(idx, { nameAr: val, sku: val })}
                    />
                  </div>

                  <div>
                    <select
                      value={item.uom}
                      onChange={(e) => updateItem(idx, { uom: e.target.value })}
                      className="h-10 w-full px-2 rounded-lg border border-border bg-card text-foreground text-xs text-center font-medium outline-none focus:border-primary cursor-pointer"
                    >
                      {uomList.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="h-10 w-full px-2 rounded-lg border border-border bg-card text-foreground text-xs font-mono font-bold text-center outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={item.estimatedUnitCost || ''}
                      onChange={(e) => updateItem(idx, { estimatedUnitCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                      placeholder="0"
                      className="h-10 w-full px-2 rounded-lg border border-border bg-card text-foreground text-xs font-mono font-bold text-center outline-none focus:border-primary"
                    />
                  </div>

                  <div className="text-center font-mono font-bold text-foreground text-xs whitespace-nowrap">
                    {formatCurrency(item.lineTotal)}
                  </div>

                  <div className="flex justify-center items-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      title={isAr ? 'حذف البند' : 'Remove'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Summary */}
          <div className="p-3.5 bg-muted/20 border-t border-border flex flex-wrap items-center justify-between gap-3 w-full">
            <button
              type="button"
              onClick={handleAddNewLine}
              className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إضافة سطر مادة جديد' : 'Add Item Line'}</span>
            </button>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-muted-foreground">
                {items.length === 1 ? (isAr ? 'صنف واحد' : '1 SKU') : `${items.length} ${isAr ? 'أصناف مختلفة' : 'SKUs'}`} • {totalQuantity} {isAr ? 'قطعة إجمالية' : 'total units'}
              </span>
              <div className="bg-primary/10 text-primary px-3.5 py-1.5 rounded-lg font-mono font-bold text-sm">
                <span>{isAr ? 'القيمة التقديرية المحتسبة: ' : 'Total Budget: '}</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Notice & Bottom Actions */}
      <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-800 dark:text-sky-300 flex items-start gap-3">
        <Sparkles className="w-5 h-5 shrink-0 mt-0.5 text-sky-600" />
        <div className="space-y-1">
          <div className="font-bold">{isAr ? 'آلية عمل أوامر الشراء المجدولة (POs):' : 'Purchase Order Lifecycle:'}</div>
          <p className="opacity-90">
            {isAr
              ? 'أمر الشراء هذا وثيقة تعاقدية تقديرية لتنسيق التوريد مع المورد ولن يؤثر على كميات المخزن الفعلي. عند وصول البضاعة للمستودع، يمكنك الضغط على زر "استلام وتوريد" لنقل هذه المواد المحددة مباشرة إلى فاتورة الشراء الواردة وتوريدها للمخزن بضغطة زر واحدة.'
              : 'This PO is a contractual schedule and does not alter physical warehouse stock. When goods arrive, click "Receive & Inbound" to populate an incoming purchase bill with these items in 1-click.'}
          </p>
        </div>
      </div>

    </div>
  );
}

