import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Barcode,
  Search,
  Building2,
  User,
  CreditCard,
  Banknote,
  ShoppingBag,
  Zap,
  Package,
  Phone,
  MapPin,
  Tag,
  Receipt,
  Store
} from 'lucide-react';
import type { Product, Warehouse, SalesInvoice, InvoiceLineItem, WarehouseDispatchOrder } from '../../types/warehouse';
import { UserProfile } from '../../types/rbac';
import { getStoredCustomers, getStoredWarehouses, getStoredDispatchOrders, saveStoredDispatchOrders, createInstallmentContract } from '../../services/storageService';
import { useSettings } from '../../context/settings-context';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../ui/select';

export interface CreateInvoiceViewProps {
  products: Product[];
  warehouses: Warehouse[];
  lang: 'ar' | 'en';
  currentUser: UserProfile;
  onInvoiceCreated: (invoice: SalesInvoice) => void;
  onCancel: () => void;
}

export default function CreateInvoiceView({
  products,
  warehouses: propWarehouses,
  lang,
  currentUser,
  onInvoiceCreated,
  onCancel
}: CreateInvoiceViewProps) {
  const isAr = lang === 'ar';
  const { settings, formatMoney, tenantCountryCode } = useSettings();
  const isIraqTenant = (tenantCountryCode === 'IQ' || settings?.tenantCountryCode === 'IQ');

  const [customersList] = useState<any[]>(() => getStoredCustomers());
  const [warehousesList] = useState<Warehouse[]>(() => {
    if (propWarehouses && propWarehouses.length > 0) return propWarehouses;
    return getStoredWarehouses();
  });

  // Pre-default to Walk-in Cash Customer to remove friction for instant counter sales
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('WALK_IN');
  const [customerName, setCustomerName] = useState<string>(() => isAr ? 'عميل نقدي عام' : 'Walk-in Cash Customer');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  
  // Warehouse & Fulfillment States
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    if (currentUser.branchId && currentUser.branchId !== 'ALL') {
      return currentUser.branchId;
    }
    return warehousesList[0]?.id || '';
  });

  const isMultiWarehouse = currentUser?.features?.multiWarehouse !== false;

  const [dispenseMode, setDispenseMode] = useState<'IN_STORE' | 'WAREHOUSE_DISPATCH'>('IN_STORE');
  const [targetDispatchWarehouseId, setTargetDispatchWarehouseId] = useState<string>(() => {
    if (currentUser.branchId && currentUser.branchId !== 'ALL') {
      return currentUser.branchId;
    }
    return warehousesList[0]?.id || '';
  });

  // Auto-Behavior: When multiWarehouse is disabled, automatically enforce main default warehouse
  useEffect(() => {
    if (!isMultiWarehouse) {
      const defaultWhId = warehousesList[0]?.id || 'WH-01';
      if (selectedWarehouseId !== defaultWhId) {
        setSelectedWarehouseId(defaultWhId);
      }
      if (dispenseMode !== 'IN_STORE') {
        setDispenseMode('IN_STORE');
      }
    }
  }, [isMultiWarehouse, warehousesList, selectedWarehouseId, dispenseMode]);

  // Product Selection & Line Items
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [barcodeQuery, setBarcodeQuery] = useState<string>('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  // Financials & Payment
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'card' | 'electronic' | 'installment'>('cash');
  const [downPayment, setDownPayment] = useState<number>(0);
  const [installmentCount, setInstallmentCount] = useState<number>(6);
  const [guarantorName, setGuarantorName] = useState<string>('');
  const [guarantorPhone, setGuarantorPhone] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Automatically reset payment method to cash if user is not in Iraq and had electronic selected
  useEffect(() => {
    if (!isIraqTenant && paymentMethod === 'electronic') {
      setPaymentMethod('cash');
    }
  }, [isIraqTenant, paymentMethod]);

  // Tax calculation from settings
  const taxRatePercent = typeof settings?.taxRate === 'number' ? settings.taxRate : 0;
  const [applyTax] = useState<boolean>(() => Boolean(settings?.isTaxEnabled && taxRatePercent > 0));

  // Sync customer selection without confusing the user
  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    if (id === 'WALK_IN') {
      setCustomerName(isAr ? 'عميل نقدي عام' : 'Walk-in Cash Customer');
      setCustomerPhone('');
      setCustomerAddress('');
      return;
    }
    const found = customersList.find(c => c.id === id);
    if (found) {
      setCustomerName(found.name || '');
      setCustomerPhone(found.phone || '');
      setCustomerAddress(found.city || found.address || '');
    }
  };

  // Barcode / SKU Fast Lookup
  const handleBarcodeLookup = (query: string) => {
    setBarcodeQuery(query);
    const clean = query.trim().toLowerCase();
    if (!clean) return;

    const matched = products.find(p => 
      p.barcode?.toLowerCase() === clean || 
      p.sku?.toLowerCase() === clean
    );

    if (matched) {
      setSelectedProductId(matched.id);
    }
  };

  // Add Item to Invoice
  const handleAddItem = () => {
    setFormError('');
    if (!selectedProductId) {
      setFormError(isAr ? 'يرجى اختيار مادة من القائمة أو مسح الباركود' : 'Please select an item or scan barcode');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) {
      setFormError(isAr ? 'المادة المحددة غير موجودة في النظام' : 'Selected product not found');
      return;
    }

    if (product.sellingPrice <= 0) {
      setFormError(isAr ? 'سعر بيع المادة غير صالح' : 'Product selling price must be greater than zero');
      return;
    }

    if (itemQty <= 0) {
      setFormError(isAr ? 'يرجى إدخال كمية صحيحة أكبر من الصفر' : 'Quantity must be greater than zero');
      return;
    }

    const availableStock = product.currentStock ?? 0;
    if (availableStock <= 0) {
      setFormError(isAr ? `نفد رصيد هذه المادة في المخزن (${product.nameAr})` : `Item is out of stock (${product.nameEn || product.nameAr})`);
      return;
    }

    const existingIndex = lineItems.findIndex(i => i.productId === product.id);
    if (existingIndex >= 0) {
      const updated = [...lineItems];
      const newQty = updated[existingIndex].quantity + itemQty;
      if (newQty > availableStock) {
        setFormError(isAr 
          ? `الكمية الإجمالية (${newQty}) تتجاوز الرصيد المتوفر بالمخزن (${availableStock})` 
          : `Requested quantity exceeds available stock (${availableStock})`);
        return;
      }
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].total = newQty * updated[existingIndex].unitPrice;
      setLineItems(updated);
    } else {
      if (itemQty > availableStock) {
        setFormError(isAr 
          ? `الكمية المطلوبة (${itemQty}) تتجاوز الرصيد المتوفر بالمخزن (${availableStock})` 
          : `Requested quantity exceeds available stock (${availableStock})`);
        return;
      }

      const newItem: InvoiceLineItem = {
        id: `LI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: product.id,
        sku: product.sku,
        nameAr: product.nameAr,
        nameEn: product.nameEn || product.nameAr,
        quantity: itemQty,
        unitPrice: product.sellingPrice,
        unit: product.unit || (isAr ? 'قطعة' : 'pcs'),
        total: itemQty * product.sellingPrice
      };
      setLineItems([...lineItems, newItem]);
    }

    // Reset selection input
    setSelectedProductId('');
    setItemQty(1);
    setBarcodeQuery('');
  };

  const handleUpdateQty = (index: number, delta: number) => {
    const updated = [...lineItems];
    const item = updated[index];
    const product = products.find(p => p.id === item.productId);
    const maxStock = product?.currentStock ?? 999;
    const nextQty = item.quantity + delta;

    if (nextQty <= 0) {
      setLineItems(lineItems.filter((_, i) => i !== index));
      return;
    }

    if (nextQty > maxStock) {
      setFormError(isAr ? `الكمية لا يمكن أن تتجاوز الرصيد المتوفر (${maxStock})` : `Cannot exceed available stock (${maxStock})`);
      return;
    }

    setFormError('');
    item.quantity = nextQty;
    item.total = nextQty * item.unitPrice;
    setLineItems(updated);
  };

  const handleRemoveLine = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = lineItems.reduce((acc, i) => acc + i.total, 0);
  const totalUnits = lineItems.reduce((acc, i) => acc + i.quantity, 0);

  // Financial safety validation
  const taxableAmount = Math.max(0, subtotal - Math.min(discount, subtotal));
  const taxRate = taxRatePercent / 100;
  const taxAmount = applyTax ? taxableAmount * taxRate : 0;
  const grandTotal = Math.max(0, taxableAmount + taxAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!customerName.trim()) {
      setFormError(isAr ? 'يرجى إدخال اسم العميل أو المشتري' : 'Please provide customer name');
      return;
    }

    if (lineItems.length === 0) {
      setFormError(isAr ? 'يرجى إضافة مادة واحدة على الأقل إلى الفاتورة' : 'Please add at least one item to the invoice');
      return;
    }

    if (discount > subtotal) {
      setFormError(isAr ? 'قيمة الخصم لا يمكن أن تتجاوز إجمالي الفاتورة' : 'Discount cannot exceed subtotal');
      return;
    }

    const isWarehouseDispatch = dispenseMode === 'WAREHOUSE_DISPATCH';
    const effectiveWarehouseId = isWarehouseDispatch ? targetDispatchWarehouseId : selectedWarehouseId;
    const warehouseObj = warehousesList.find(w => w.id === effectiveWarehouseId);
    const resolvedWarehouseName = warehouseObj 
      ? (isAr ? warehouseObj.nameAr : (warehouseObj.nameEn || warehouseObj.nameAr))
      : (isAr ? 'المستودع الرئيسي' : 'Main Warehouse');

    const nextInvoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const invoiceId = `INV-${Date.now()}`;

    let dispatchOrder: WarehouseDispatchOrder | undefined;
    if (isWarehouseDispatch) {
      dispatchOrder = {
        id: `DISP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        invoiceId,
        invoiceNumber: nextInvoiceNumber,
        warehouseId: effectiveWarehouseId || 'WH-01',
        warehouseName: resolvedWarehouseName,
        customerName: customerName.trim(),
        cashierName: currentUser.fullName || (isAr ? 'أمين الصندوق' : 'Cashier'),
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

    let installmentContractId: string | undefined = undefined;
    if (paymentMethod === 'installment') {
      const remainingInstallment = Math.max(0, grandTotal - downPayment);
      const monthlyAmount = installmentCount > 0 ? Math.round(remainingInstallment / installmentCount) : 0;
      const contract = createInstallmentContract({
        invoiceId,
        customerId: selectedCustomerId !== 'WALK_IN' ? selectedCustomerId : undefined,
        customerName: customerName.trim(),
        guarantorName: guarantorName.trim(),
        guarantorPhone: guarantorPhone.trim(),
        totalCashPrice: subtotal,
        totalInstallmentPrice: grandTotal,
        downPayment,
        remainingAmount: remainingInstallment,
        installmentCount,
        monthlyAmount,
        startDate: new Date().toISOString(),
        notes: notes.trim()
      });
      installmentContractId = contract.id;
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
      tax: taxAmount,
      total: grandTotal,
      paymentMethod: paymentMethod === 'electronic' ? 'card' : paymentMethod,
      installmentContractId,
      status: paymentMethod === 'credit' ? 'credit' : 'paid',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      operator: currentUser.fullName || (isAr ? 'أمين الصندوق' : 'Cashier')
    };

    onInvoiceCreated(newInvoice);
  };

  return (
    <div className="view-content-wrapper fade-in space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Header Bar - Clean & Minimalist */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-9 px-3 gap-1.5 rounded-lg border-border/80 text-foreground hover:bg-muted font-medium text-xs"
          >
            {isAr ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
            <span>{isAr ? 'العودة لسجل الفواتير' : 'Back to Invoices'}</span>
          </Button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground m-0 tracking-tight leading-tight">
                {isAr ? 'فاتورة مبيعات جديدة' : 'New Sales Invoice'}
              </h1>
              <span className="text-[11px] text-muted-foreground">
                {isAr ? 'إصدار فوري، خصم المخزون، وتوثيق المدفوعات' : 'Direct issuance, stock deduction, and billing'}
              </span>
            </div>
          </div>
        </div>

        {/* Tenant Scope Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border/70">
            <Store size={12} className="text-primary" />
            <span>{currentUser.tenantSlug ? `@${currentUser.tenantSlug}` : (isAr ? 'الفرع المباشر' : 'Direct Branch')}</span>
          </span>
        </div>
      </div>

      {/* Error Alert Banner */}
      {formError && (
        <div className="flex items-center justify-between p-3 text-xs rounded-lg bg-destructive/10 border border-destructive/20 text-destructive animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{formError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFormError('')}
            className="text-destructive/70 hover:text-destructive text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            {isAr ? 'إغلاق' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Main Grid: Clean 75% Document Workspace vs 25% Cohesive Sidebar */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* PRIMARY WORKSPACE: Customer & Items (75% on XL, 67% on LG) */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-4 min-w-0">
            
            {/* Card 1: Customer & Fulfillment - Flat, Intuitive, No Nested Boxes */}
            <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <User size={14} className="text-primary" />
                  <span>{isAr ? 'بيانات العميل والتسليم' : 'Customer & Delivery'}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {isAr ? 'افتراضي: عميل نقدي عام' : 'Default: Walk-in Cash'}
                </span>
              </div>

              {/* Row 1: Customer Account & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Registered Account Picker */}
                <div className="space-y-1">
                  <Label htmlFor="customerSelect" className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <span>{isAr ? 'حساب العميل' : 'Customer Account'}</span>
                  </Label>
                  <Select
                    value={selectedCustomerId}
                    onValueChange={handleCustomerSelect}
                  >
                    <SelectTrigger id="customerSelect" className="h-9 rounded-lg border border-border/80 bg-background text-xs font-medium">
                      <SelectValue placeholder={isAr ? 'اختر حساب العميل...' : 'Select customer...'} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground border-border shadow-xl">
                      <SelectItem value="WALK_IN">
                        {isAr ? 'عميل نقدي عام (نقدي مباشر)' : 'Walk-in Cash Customer'}
                      </SelectItem>
                      {customersList.map((cust) => (
                        <SelectItem key={cust.id} value={cust.id}>
                          {cust.name} {cust.phone ? `(${cust.phone})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer Display Name */}
                <div className="space-y-1">
                  <Label htmlFor="custName" className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                    <span>{isAr ? 'اسم العميل / المشتري' : 'Customer Name'}</span>
                    <span className="text-destructive font-bold">*</span>
                  </Label>
                  <Input
                    id="custName"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={isAr ? 'اسم العميل أو اسم المنشأة...' : 'Customer or company name...'}
                    className="h-9 rounded-lg border border-border/80 bg-background text-xs"
                  />
                </div>
              </div>

              {/* Row 2: Phone Number & Fulfillment Switcher */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-0.5">
                {/* Phone Number */}
                <div className="space-y-1">
                  <Label htmlFor="custPhone" className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Phone size={12} className="text-muted-foreground" />
                    <span>{isAr ? 'رقم الهاتف' : 'Phone Number'}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">{isAr ? '(اختياري)' : '(Optional)'}</span>
                  </Label>
                  <Input
                    id="custPhone"
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={isAr ? '0770 000 0000 أو رقم الاتصال...' : '+1 (555) 000-0000'}
                    className="h-9 rounded-lg border border-border/80 bg-background text-xs font-mono"
                  />
                </div>

                {/* Fulfillment / Dispense Toggle & Warehouse */}
                {isMultiWarehouse ? (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <Package size={12} className="text-muted-foreground" />
                      <span>{isAr ? 'طريقة الاستلام والتجهيز' : 'Fulfillment Method'}</span>
                    </Label>
                    
                    <div className="flex items-center gap-2">
                      {/* Compact Segmented Control - Clean Text, Zero Emojis */}
                      <div className="inline-flex p-0.5 bg-muted rounded-lg border border-border/60 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDispenseMode('IN_STORE')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                            dispenseMode === 'IN_STORE'
                              ? 'bg-background text-foreground shadow-2xs font-bold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Zap size={12} className={dispenseMode === 'IN_STORE' ? 'text-amber-500 fill-amber-500' : ''} />
                          <span>{isAr ? 'صرف مباشر' : 'Direct In-Store'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDispenseMode('WAREHOUSE_DISPATCH')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                            dispenseMode === 'WAREHOUSE_DISPATCH'
                              ? 'bg-background text-blue-600 shadow-2xs font-bold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Package size={12} className={dispenseMode === 'WAREHOUSE_DISPATCH' ? 'text-blue-600' : ''} />
                          <span>{isAr ? 'تجهيز مستودع' : 'Warehouse Dispatch'}</span>
                        </button>
                      </div>

                      {/* Warehouse Dropdown - Dynamic based on Mode */}
                      <div className="flex-1 min-w-[130px]">
                        {dispenseMode === 'WAREHOUSE_DISPATCH' ? (
                          <Select
                            value={targetDispatchWarehouseId}
                            onValueChange={setTargetDispatchWarehouseId}
                          >
                            <SelectTrigger className="h-8 border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-blue-950 dark:text-blue-100 font-semibold text-xs rounded-lg">
                              <SelectValue placeholder={isAr ? 'مستودع التجهيز...' : 'Target Hub...'} />
                            </SelectTrigger>
                            <SelectContent className="bg-popover text-popover-foreground border-border shadow-xl">
                              {warehousesList.map((wh) => (
                                <SelectItem key={wh.id} value={wh.id}>
                                  {isAr ? wh.nameAr : (wh.nameEn || wh.nameAr)} ({wh.code || wh.id})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={selectedWarehouseId}
                            onValueChange={setSelectedWarehouseId}
                            disabled={currentUser.role === 'BranchManager'}
                          >
                            <SelectTrigger className="h-8 border-border/80 bg-background text-xs rounded-lg font-medium">
                              <SelectValue placeholder={isAr ? 'المستودع...' : 'Warehouse...'} />
                            </SelectTrigger>
                            <SelectContent className="bg-popover text-popover-foreground border-border shadow-xl">
                              {warehousesList.map((wh) => (
                                <SelectItem key={wh.id} value={wh.id}>
                                  {isAr ? wh.nameAr : (wh.nameEn || wh.nameAr)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <Building2 size={12} className="text-muted-foreground" />
                      <span>{isAr ? 'المستودع المعتمد' : 'Default Warehouse'}</span>
                    </Label>
                    <div className="flex items-center gap-2 h-8 px-3 bg-muted/60 border border-border/60 rounded-lg text-xs font-medium text-foreground/80">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>{isAr ? 'المستودع الرئيسي (اعتماد تلقائي)' : 'Main Warehouse (Auto Assigned)'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Items Table & Quick Insertion Bar */}
            <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <ShoppingBag size={14} className="text-primary" />
                  <span>{isAr ? 'أصناف ومواد الفاتورة' : 'Invoice Items'}</span>
                </span>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md font-mono">
                  {lineItems.length} {isAr ? 'أصناف' : 'items'} • {totalUnits} {isAr ? 'قطع' : 'units'}
                </span>
              </div>

              {/* Fast Item Insertion Bar - Smooth & Natural */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  {/* Product Catalog Dropdown */}
                  <div className="sm:col-span-6 space-y-1">
                    <Label htmlFor="productSelect" className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <Tag size={12} className="text-muted-foreground" />
                      <span>{isAr ? 'اختيار المادة من الكتالوج' : 'Product Catalog'}</span>
                    </Label>
                    <Select
                      value={selectedProductId}
                      onValueChange={setSelectedProductId}
                    >
                      <SelectTrigger id="productSelect" className="h-9 rounded-lg border border-border/80 bg-background text-xs font-medium">
                        <SelectValue placeholder={isAr ? 'ابحث أو اختر الصنف...' : 'Select product...'} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover text-popover-foreground border-border shadow-xl max-h-60">
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {isAr ? p.nameAr : (p.nameEn || p.nameAr)} — {formatMoney(p.sellingPrice)} (متاح: {p.currentStock ?? 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Barcode Quick Scan */}
                  <div className="sm:col-span-3 space-y-1">
                    <Label htmlFor="barcodeInput" className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <Barcode size={12} className="text-muted-foreground" />
                      <span>{isAr ? 'مسح الباركود / SKU' : 'Barcode / SKU'}</span>
                    </Label>
                    <Input
                      id="barcodeInput"
                      value={barcodeQuery}
                      onChange={(e) => handleBarcodeLookup(e.target.value)}
                      placeholder={isAr ? 'امسح الباركود...' : 'Scan code...'}
                      className="h-9 rounded-lg border border-border/80 bg-background text-xs font-mono"
                    />
                  </div>

                  {/* Quantity */}
                  <div className="sm:col-span-1 space-y-1">
                    <Label htmlFor="itemQty" className="text-xs font-semibold text-foreground/80">
                      {isAr ? 'الكمية' : 'Qty'}
                    </Label>
                    <Input
                      id="itemQty"
                      type="number"
                      min={1}
                      value={itemQty}
                      onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-9 text-center font-bold font-mono rounded-lg border border-border/80 bg-background text-xs"
                    />
                  </div>

                  {/* Add Button */}
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full h-9 rounded-lg bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 font-bold text-xs gap-1.5 cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>{isAr ? 'إضافة' : 'Add Item'}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Items Table - Clean, Compact & Calming */}
              <div className="overflow-x-auto border border-border/80 rounded-lg bg-background">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border/80 text-muted-foreground font-semibold text-[11px]">
                      <th className="py-2 px-3 text-start">{isAr ? 'الصنف والرمز' : 'Item & SKU'}</th>
                      <th className="py-2 px-3 text-center">{isAr ? 'السعر' : 'Unit Price'}</th>
                      <th className="py-2 px-3 text-center">{isAr ? 'الكمية' : 'Quantity'}</th>
                      <th className="py-2 px-3 text-center">{isAr ? 'الإجمالي' : 'Total'}</th>
                      <th className="py-2 px-3 text-center w-10">{isAr ? 'إجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 px-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                            <ShoppingBag className="w-5 h-5 opacity-40" />
                            <p className="text-xs font-medium text-foreground m-0">
                              {isAr ? 'لم تتم إضافة أي مادة للفاتورة بعد' : 'No items added to invoice yet'}
                            </p>
                            <span className="text-[11px] text-muted-foreground">
                              {isAr ? 'اختر مادة من القائمة أعلاه أو امسح الباركود لإضافتها مباشرة' : 'Select an item above or scan a barcode to add'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2 px-3">
                            <strong className="block text-foreground font-semibold text-xs leading-snug">
                              {isAr ? item.nameAr : (item.nameEn || item.nameAr)}
                            </strong>
                            <span className="text-[10px] text-muted-foreground font-mono">{item.sku}</span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-medium text-xs">
                            {formatMoney(item.unitPrice)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="inline-flex items-center gap-1.5 border border-border rounded-md px-1.5 py-0.5 bg-background shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(idx, -1)}
                                className="w-4 h-4 flex items-center justify-center rounded text-muted-foreground hover:bg-muted font-bold text-xs cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-bold text-xs min-w-[18px] text-center font-mono">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(idx, 1)}
                                className="w-4 h-4 flex items-center justify-center rounded text-muted-foreground hover:bg-muted font-bold text-xs cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-foreground text-xs">
                            {formatMoney(item.total)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-destructive/70 hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors cursor-pointer"
                              title={isAr ? 'حذف البند' : 'Remove item'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SIDEBAR: Unified Single Cohesive Card (Payment + Summary + Issue Action) */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-4 lg:sticky lg:top-4">
            
            <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <CreditCard size={14} className="text-primary" />
                  <span>{isAr ? 'السداد والملخص المالي' : 'Payment & Summary'}</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {lineItems.length > 0 ? `${totalUnits} ${isAr ? 'قطع' : 'units'}` : ''}
                </span>
              </div>

              {/* Payment Mode Selector - No Emojis */}
              <div className="space-y-1">
                <Label htmlFor="paymentMethodSelect" className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                  <span>{isAr ? 'طريقة السداد' : 'Payment Method'}</span>
                  <span className="text-destructive font-bold">*</span>
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(val) => setPaymentMethod(val as any)}
                >
                  <SelectTrigger id="paymentMethodSelect" className="h-9 rounded-lg border border-border/80 bg-background text-xs font-medium">
                    <SelectValue placeholder={isAr ? 'اختر طريقة الدفع' : 'Select Payment Method'} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border-border shadow-xl">
                    <SelectItem value="cash">
                      {isAr ? 'نقداً (Cash)' : 'Cash Payment'}
                    </SelectItem>
                    <SelectItem value="credit">
                      {isAr ? 'آجل / ذمم مدينة (Credit Account)' : 'Credit / Receivables'}
                    </SelectItem>
                    <SelectItem value="card">
                      {isAr ? 'بطاقة مصرفية / جهاز POS' : 'POS Bank Card'}
                    </SelectItem>
                    <SelectItem value="installment">
                      {isAr ? 'بيع بالتقسيط (Installment Plan)' : 'Installment Plan'}
                    </SelectItem>
                    {isIraqTenant && (
                      <SelectItem value="electronic">
                        {isAr ? 'دفع إلكتروني (زين كاش / كي كارد)' : 'E-Wallet (ZainCash / Qi)'}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Installment Plan Configuration Box */}
              {paymentMethod === 'installment' && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      {isAr ? 'بيانات عقد البيع بالتقسيط' : 'Installment Contract Details'}
                    </span>
                    <span className="text-[11px] font-semibold text-primary font-mono">
                      {isAr ? 'القسط الشهري:' : 'Monthly:'} {formatMoney(installmentCount > 0 ? Math.round(Math.max(0, grandTotal - downPayment) / installmentCount) : 0)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-muted-foreground">
                        {isAr ? 'الدفعة الأولى (المقدمة)' : 'Down Payment'}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={grandTotal}
                        value={downPayment === 0 ? '' : downPayment}
                        onChange={(e) => setDownPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0.00"
                        className="h-8 rounded-lg border-border/80 bg-background text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-muted-foreground">
                        {isAr ? 'مدة التقسيط' : 'Duration'}
                      </Label>
                      <Select
                        value={String(installmentCount)}
                        onValueChange={(val) => setInstallmentCount(parseInt(val, 10) || 6)}
                      >
                        <SelectTrigger className="h-8 rounded-lg border-border/80 bg-background text-xs font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover text-popover-foreground border-border shadow-xl">
                          <SelectItem value="3">{isAr ? '3 أشهر' : '3 Months'}</SelectItem>
                          <SelectItem value="6">{isAr ? '6 أشهر' : '6 Months'}</SelectItem>
                          <SelectItem value="12">{isAr ? '12 شهراً (سنة)' : '12 Months'}</SelectItem>
                          <SelectItem value="24">{isAr ? '24 شهراً (سنتان)' : '24 Months'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-muted-foreground">
                        {isAr ? 'اسم الكفيل / الضامن' : 'Guarantor Name'}
                      </Label>
                      <Input
                        value={guarantorName}
                        onChange={(e) => setGuarantorName(e.target.value)}
                        placeholder={isAr ? 'اسم الكفيل الثلاثي...' : 'Guarantor full name...'}
                        className="h-8 rounded-lg border-border/80 bg-background text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-muted-foreground">
                        {isAr ? 'هاتف الكفيل' : 'Guarantor Phone'}
                      </Label>
                      <Input
                        value={guarantorPhone}
                        onChange={(e) => setGuarantorPhone(e.target.value)}
                        placeholder="07xxxxxxxxx"
                        className="h-8 rounded-lg border-border/80 bg-background text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Discount & Notes in Clean Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <div className="space-y-1">
                  <Label htmlFor="discountInput" className="text-xs font-semibold text-foreground/80">
                    {isAr ? 'الخصم' : 'Discount'}
                  </Label>
                  <Input
                    id="discountInput"
                    type="number"
                    min={0}
                    max={subtotal}
                    value={discount === 0 ? '' : discount}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="h-8 rounded-lg border border-border/80 bg-background text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="notesInput" className="text-xs font-semibold text-foreground/80">
                    {isAr ? 'ملاحظات' : 'Notes'}
                  </Label>
                  <Input
                    id="notesInput"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isAr ? 'اختياري...' : 'Optional...'}
                    className="h-8 rounded-lg border border-border/80 bg-background text-xs"
                  />
                </div>
              </div>

              <div className="border-t border-border/50 pt-2 space-y-2 text-xs">
                {/* Financial Breakdown */}
                <div className="flex justify-between text-muted-foreground">
                  <span>{isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                  <span className="font-mono font-semibold text-foreground">{formatMoney(subtotal)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                    <span>{isAr ? 'الخصم الممنوح:' : 'Discount:'}</span>
                    <span className="font-mono font-bold">-{formatMoney(discount)}</span>
                  </div>
                )}

                {taxRatePercent > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{isAr ? `ضريبة القيمة المضافة (${taxRatePercent}%):` : `VAT (${taxRatePercent}%):`}</span>
                    <span className="font-mono font-semibold text-foreground">{formatMoney(taxAmount)}</span>
                  </div>
                )}
              </div>

              {/* Grand Total Box - High Contrast, Clear & Focused */}
              <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/25 space-y-0.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>{isAr ? 'المبلغ الإجمالي المستحق' : 'Total Amount Due'}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    paymentMethod === 'credit' 
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' 
                      : paymentMethod === 'installment'
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {paymentMethod === 'credit' 
                      ? (isAr ? 'آجل' : 'Credit') 
                      : paymentMethod === 'installment'
                      ? (isAr ? 'أقساط مجدولة' : 'Installments')
                      : (isAr ? 'نقدي فوري' : 'Due Now')}
                  </span>
                </div>
                <div className="text-2xl font-black font-mono tracking-tight text-primary">
                  {formatMoney(grandTotal)}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 space-y-2">
                <Button
                  type="submit"
                  disabled={lineItems.length === 0}
                  className="w-full h-11 text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-all rounded-lg gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>{isAr ? 'إصدار وحفظ الفاتورة' : 'Issue Invoice'}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="w-full h-8 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground border-border/80"
                >
                  {isAr ? 'إلغاء والعودة' : 'Cancel & Return'}
                </Button>
              </div>
            </div>

          </div>

        </div>
      </form>
    </div>
  );
}
