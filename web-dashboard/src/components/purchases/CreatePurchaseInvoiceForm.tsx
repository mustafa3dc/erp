import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Calendar, FileText, CheckCircle2, 
  ArrowRight, Scale, AlertCircle, Plus, X, Sparkles, Receipt
} from 'lucide-react';
import { Product, Warehouse } from '../../types/warehouse';
import { PurchaseInvoice, PurchaseInvoiceItem, PurchasePaymentTerm, PurchaseJournalEntry } from '../../types/purchases';
import { 
  getStoredSuppliers, 
  createSupplier, 
  executePurchaseInvoiceTransaction,
  saveNewProductToCatalog,
  PurchaseInvoiceTransactionResult 
} from '../../services/storageService';
import PurchaseInvoiceItemsGrid, { formatIQD } from './PurchaseInvoiceItemsGrid';
import { localizeUnit } from '../../lib/localeHelpers';
import { useSettings } from '../../context/settings-context';

export interface InitialPurchaseInvoicePrefill {
  supplierId?: string;
  supplierName?: string;
  supplierRefNo?: string;
  destinationWarehouseId?: string;
  items?: PurchaseInvoiceItem[];
  notes?: string;
  sourcePoId?: string;
  sourcePoNumber?: string;
}

interface CreatePurchaseInvoiceFormProps {
  products: Product[];
  warehouses: Warehouse[];
  isAr?: boolean;
  initialData?: InitialPurchaseInvoicePrefill | null;
  onInvoiceCreated: (result: PurchaseInvoiceTransactionResult, sourcePoId?: string) => void;
  onCancel: () => void;
}

const TREASURY_ACCOUNTS_DEF = [
  { id: 'ACC-01', nameAr: 'قاصة الخزينة النقدية الرئيسية', nameEn: 'Main Commercial Cash Vault' },
  { id: 'ACC-02', nameAr: 'حساب العمليات المصرفي التجاري', nameEn: 'Primary Commercial Bank Account' },
  { id: 'ACC-03', nameAr: 'حساب التحويلات والخزينة الثانوي', nameEn: 'Corporate Treasury & Wire Account' },
  { id: 'ACC-04', nameAr: 'محفظة زين كاش التجارية', nameEn: 'ZainCash Merchant Wallet', iraqOnly: true }
];

export default function CreatePurchaseInvoiceForm({
  products,
  warehouses,
  isAr = true,
  initialData,
  onInvoiceCreated,
  onCancel
}: CreatePurchaseInvoiceFormProps) {
  const { tenantCountryCode, settings, currencySymbol, formatMoney } = useSettings();
  const isIraqTenant = (tenantCountryCode === 'IQ' || settings?.tenantCountryCode === 'IQ');
  const isIqd = (settings?.baseCurrency === 'IQD');
  const effectiveSymbol = currencySymbol || (isIqd ? (isAr ? 'د.ع' : 'IQD') : '$');

  const formatCurrency = (amt: number | undefined | null) => {
    return formatMoney(Number(amt) || 0);
  };

  const [showJournalPreview, setShowJournalPreview] = useState(false);

  const availableTreasuryAccounts = useMemo(() => {
    return TREASURY_ACCOUNTS_DEF.filter(acc => {
      if (acc.iraqOnly && !isIraqTenant) return false;
      return true;
    }).map(acc => ({
      id: acc.id,
      name: isAr ? acc.nameAr : acc.nameEn
    }));
  }, [isIraqTenant, isAr]);

  // Suppliers
  const [suppliers, setSuppliers] = useState(() => getStoredSuppliers());
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(() => {
    if (initialData?.supplierId) return initialData.supplierId;
    if (initialData?.supplierName) {
      const match = getStoredSuppliers().find(s => s.company.toLowerCase().includes(initialData.supplierName!.toLowerCase()));
      if (match) return match.id;
    }
    return getStoredSuppliers()[0]?.id || '';
  });
  
  // Quick supplier modal state
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [newSupplierCompany, setNewSupplierCompany] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  // Invoice Header Fields: supplierRefNo starts completely EMPTY as required (or prefilled from PO if converting)
  const [supplierRefNo, setSupplierRefNo] = useState(() => initialData?.supplierRefNo || '');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string>(
    () => initialData?.destinationWarehouseId || warehouses[0]?.id || 'WH-01'
  );
  const [paymentTerms, setPaymentTerms] = useState<PurchasePaymentTerm>('cash');
  const [invoiceNotes, setInvoiceNotes] = useState(() => initialData?.notes || '');

  // Line items state (auto-populated if converting from PO!)
  const [lineItems, setLineItems] = useState<PurchaseInvoiceItem[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items;
    }
    return [
      {
        id: `PI-${Date.now()}-1`,
        sku: '',
        barcode: '',
        nameAr: '',
        nameEn: '',
        uom: isAr ? 'قطعة' : 'Piece',
        quantity: 1,
        unitCost: 0,
        currentSellingPrice: 0,
        newSellingPrice: 0,
        lineTotal: 0,
        isNewProduct: false
      }
    ];
  });

  // Inline Product Creation Dialog state
  const [isInlineProductOpen, setIsInlineProductOpen] = useState(false);
  const [inlineProductTargetRow, setInlineProductTargetRow] = useState<number | null>(null);
  const [inlineProductName, setInlineProductName] = useState('');
  const [inlineProductCategory, setInlineProductCategory] = useState('توريدات عامة');
  const [inlineProductCost, setInlineProductCost] = useState<number>(0);
  const [inlineProductSelling, setInlineProductSelling] = useState<number>(0);

  // Financial summary inputs
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [amountPaidNow, setAmountPaidNow] = useState<number>(0);
  const [treasuryAccount, setTreasuryAccount] = useState<string>('ACC-01');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Financial Totals
  const subtotal = lineItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
  const calculatedDiscount = discountType === 'percent'
    ? Number(((subtotal * (discountValue || 0)) / 100).toFixed(2))
    : (discountValue || 0);

  const netTotal = Math.max(0, subtotal - calculatedDiscount + (shippingCost || 0));

  // Sync amount paid based on payment terms
  useEffect(() => {
    if (paymentTerms === 'cash') {
      setAmountPaidNow(netTotal);
    } else if (paymentTerms === 'credit') {
      setAmountPaidNow(0);
    }
  }, [paymentTerms, netTotal]);

  const balanceDue = Math.max(0, netTotal - (amountPaidNow || 0));

  const selectedWarehouse = warehouses.find(w => w.id === destinationWarehouseId) || warehouses[0] || {
    id: 'WH-01',
    nameAr: 'المستودع الرئيسي',
    nameEn: 'Main Warehouse'
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0] || {
    id: '',
    company: isAr ? 'مورد غير محدد' : 'Unspecified Supplier'
  };

  const updateLineItem = (index: number, updates: Partial<PurchaseInvoiceItem>) => {
    setLineItems(prev => {
      const next = [...prev];
      const target = { ...next[index], ...updates };
      const qty = Number(target.quantity) || 0;
      const cost = Number(target.unitCost) || 0;
      target.lineTotal = Number((qty * cost).toFixed(2));
      next[index] = target;
      return next;
    });
  };

  const handleAddNewLine = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: `PI-${Date.now()}-${prev.length + 1}`,
        sku: '',
        barcode: '',
        nameAr: '',
        nameEn: '',
        uom: isAr ? 'قطعة' : 'Piece',
        quantity: 1,
        unitCost: 0,
        currentSellingPrice: 0,
        newSellingPrice: 0,
        lineTotal: 0,
        isNewProduct: false
      }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lineItems.length === 1) {
      setLineItems([{
        id: `PI-${Date.now()}-1`,
        sku: '',
        barcode: '',
        nameAr: '',
        nameEn: '',
        uom: isAr ? 'قطعة' : 'Piece',
        quantity: 1,
        unitCost: 0,
        currentSellingPrice: 0,
        newSellingPrice: 0,
        lineTotal: 0,
        isNewProduct: false
      }]);
      return;
    }
    setLineItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSelectProduct = (index: number, product: Product) => {
    updateLineItem(index, {
      productId: product.id,
      sku: product.sku,
      barcode: product.barcode,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      uom: isAr ? (product.unit || 'قطعة') : (localizeUnit(product.unit, 'en') || 'Piece'),
      unitCost: product.costPrice || 0,
      currentSellingPrice: product.sellingPrice || 0,
      newSellingPrice: product.sellingPrice || 0,
      isNewProduct: false
    });
  };

  const handleOpenDefineProduct = (rowIndex: number, initialQuery: string) => {
    setInlineProductTargetRow(rowIndex);
    setInlineProductName(initialQuery);
    setInlineProductCategory('توريدات عامة');
    setInlineProductCost(lineItems[rowIndex]?.unitCost || 0);
    setInlineProductSelling(lineItems[rowIndex]?.newSellingPrice || 0);
    setIsInlineProductOpen(true);
  };

  const handleSaveInlineProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineProductName.trim() || inlineProductTargetRow === null) return;

    const newProd = saveNewProductToCatalog({
      nameAr: inlineProductName.trim(),
      nameEn: inlineProductName.trim(),
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      barcode: `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      category: inlineProductCategory,
      unit: 'قطعة',
      costPrice: inlineProductCost,
      sellingPrice: inlineProductSelling,
      warehouseId: destinationWarehouseId,
      warehouseName: selectedWarehouse.nameAr
    });

    updateLineItem(inlineProductTargetRow, {
      productId: newProd.id,
      sku: newProd.sku,
      barcode: newProd.barcode,
      nameAr: newProd.nameAr,
      nameEn: newProd.nameEn,
      uom: newProd.unit,
      unitCost: inlineProductCost || newProd.costPrice,
      currentSellingPrice: newProd.sellingPrice,
      newSellingPrice: inlineProductSelling || newProd.sellingPrice,
      isNewProduct: true
    });

    setIsInlineProductOpen(false);
    setInlineProductName('');
  };

  const handleQuickSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierCompany.trim()) return;

    const created = createSupplier({
      company: newSupplierCompany.trim(),
      contact: newSupplierCompany.trim(),
      contactPerson: newSupplierCompany.trim(),
      phone: newSupplierPhone.trim() || '—',
      email: '',
      category: isAr ? 'توريدات عامة' : 'General Supplies',
      country: isAr ? 'دولي / عام' : 'Global / General'
    });

    setSuppliers(getStoredSuppliers());
    setSelectedSupplierId(created.id);
    setIsQuickSupplierOpen(false);
    setNewSupplierCompany('');
    setNewSupplierPhone('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!supplierRefNo.trim()) {
      setErrorMessage(isAr ? 'يرجى إدخال رقم قائمة التاجر الورقية (وصل المورد)' : 'Please enter Supplier Ref / Bill number');
      return;
    }

    const validItems = lineItems.filter(it => it.nameAr.trim() && it.quantity > 0 && it.unitCost >= 0);
    if (validItems.length === 0) {
      setErrorMessage(isAr ? 'يرجى إدخال مادة واحدة على الأقل ببيانات صحيحة' : 'Please enter at least one valid item');
      return;
    }

    const completeItems = validItems.map((item, idx) => ({
      ...item,
      sku: item.sku.trim() || `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`,
      barcode: item.barcode.trim() || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`
    }));

    setIsSubmitting(true);

    try {
      const billId = `BILL-${Date.now().toString().slice(-6)}`;
      const billNumber = `BILL-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      const journalLines = [
        {
          accountCode: '1105',
          accountNameAr: 'حـ/ المخزون والبضاعة المستلمة (مدين)',
          accountNameEn: 'Merchandise Inventory (Debit)',
          debit: netTotal,
          credit: 0,
          notes: `توريد بضاعة مشتريات - قائمة ${billNumber}`
        }
      ];

      if (amountPaidNow > 0) {
        const treasuryObj = availableTreasuryAccounts.find(a => a.id === treasuryAccount);
        journalLines.push({
          accountCode: '1101',
          accountNameAr: `حـ/ الخزينة والصندوق (${treasuryObj?.name.split('(')[0].trim() || 'الصندوق'}) (دائن)`,
          accountNameEn: 'Cash / Treasury Account (Credit)',
          debit: 0,
          credit: amountPaidNow,
          notes: 'دفعة نقدية مسددة للمورد'
        });
      }

      if (balanceDue > 0) {
        journalLines.push({
          accountCode: '2101',
          accountNameAr: `حـ/ الموردين والذمم الدائنة (${selectedSupplier.company}) (دائن)`,
          accountNameEn: `Accounts Payable - ${selectedSupplier.company} (Credit)`,
          debit: 0,
          credit: balanceDue,
          notes: 'رصيد آجل بذمة المحل للمورد'
        });
      }

      const journalEntry: PurchaseJournalEntry = {
        id: `JE-${Date.now().toString().slice(-6)}`,
        billId,
        billNumber,
        entryDate: invoiceDate,
        lines: journalLines,
        totalDebit: netTotal,
        totalCredit: (amountPaidNow || 0) + (balanceDue || 0),
        isBalanced: Math.abs(netTotal - ((amountPaidNow || 0) + (balanceDue || 0))) < 0.01
      };

      const invoice: PurchaseInvoice = {
        id: billId,
        billNumber,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.company,
        supplierRefNo: supplierRefNo.trim(),
        invoiceDate,
        warehouseId: destinationWarehouseId,
        warehouseName: selectedWarehouse.nameAr,
        paymentTerms,
        items: completeItems,
        itemsCount: completeItems.reduce((acc, it) => acc + it.quantity, 0),
        subtotal,
        discount: calculatedDiscount,
        shippingCost: shippingCost || 0,
        netTotal,
        amountPaid: amountPaidNow || 0,
        balanceDue,
        paidFromAccount: amountPaidNow > 0 ? treasuryAccount : undefined,
        status: 'POSTED',
        createdAt: new Date().toISOString(),
        notes: invoiceNotes.trim() || undefined,
        journalEntry
      };

      const result = executePurchaseInvoiceTransaction(invoice);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_purchases_updated'));
      }
      onInvoiceCreated(result, initialData?.sourcePoId);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ القائمة');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 py-4 space-y-4" dir={isAr ? 'rtl' : 'ltr'}>

      {/* PO Conversion Banner */}
      {initialData?.sourcePoNumber && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {isAr
              ? `تم نقل وتوريد بنود أمر الشراء المجدول (${initialData.sourcePoNumber}) تلقائياً بنجاح. يرجى مراجعة الكميات المستلمة وتأكيد التوريد النهائي.`
              : `Items from Purchase Order ${initialData.sourcePoNumber} transferred automatically. Review quantities and confirm final inbound receipt.`}
          </span>
        </div>
      )}
      
      {/* Header Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-border/80 w-full">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs"
            title={isAr ? 'العودة' : 'Back'}
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight m-0">
                {isAr ? 'تسجيل قائمة مشتريات وتوريد بضاعة للمستودع' : 'New Inward Purchase Invoice'}
              </h2>
              <p className="text-xs text-muted-foreground m-0 mt-0.5">
                {isAr 
                  ? 'تسجيل المواد المستلمة فعلياً، تحديث رصيد المخزن المباشر، وتثبيت التكلفة FIFO وحسابات المورد'
                  : 'Direct inward goods receipt, real-time stock update, FIFO cost adjustment, and vendor ledger posting'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-border/80 bg-card text-foreground hover:bg-muted text-xs font-semibold transition-all cursor-pointer h-9 shadow-xs"
          >
            {isAr ? 'إلغاء والعودة' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2 h-9"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? (isAr ? 'جاري التوريد...' : 'Posting...') : (isAr ? 'اعتماد وتوريد المخزون فوراً' : 'Post & Receive Goods')}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="p-1 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Card 1: ترويسة القائمة والبيانات التشغيلية */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 w-full shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground m-0 leading-tight">
                {isAr ? 'بيانات المورد والفاتورة الورقية' : 'Supplier & Bill Credentials'}
              </h3>
              <p className="text-xs text-muted-foreground m-0 mt-0.5">
                {isAr
                  ? 'الرقم المرجعي الورقي، المورد، تاريخ التوريد، ومستودع الاستلام'
                  : 'Vendor paper invoice reference, supplier credentials, date, and receiving hub'}
              </p>
            </div>
          </div>
          {paymentTerms === 'partial' && (
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              {isAr ? 'فاتورة بدفع جزئي' : 'Partial Payment Mode'}
            </span>
          )}
        </div>

        {/* Header Grid: 4 Columns in 1 Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1.1 Supplier Selection */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-foreground/85">
                {isAr ? 'المورد / التاجر' : 'Supplier'} <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsQuickSupplierOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{isAr ? 'مورد جديد' : 'New Supplier'}</span>
              </button>
            </div>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="h-10 w-full px-3 rounded-xl border border-border/80 bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer shadow-2xs"
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.company}</option>
              ))}
            </select>
          </div>

          {/* 1.2 Supplier Paper Bill Ref */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground/85">
              {isAr ? 'رقم قائمة التاجر (الوصل الورقي)' : 'Supplier Ref / Bill No'} <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={supplierRefNo}
              onChange={(e) => setSupplierRefNo(e.target.value)}
              placeholder={isAr ? 'مثال: INV-9821' : 'e.g. INV-9821'}
              dir="auto"
              className="h-10 w-full px-3 rounded-xl border border-border/80 bg-background text-foreground text-xs font-mono font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-2xs placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground"
            />
          </div>

          {/* 1.3 Invoice Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground/85">
              {isAr ? 'تاريخ الفاتورة والتوريد' : 'Invoice Date'}
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="h-10 w-full px-3 rounded-xl border border-border/80 bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer shadow-2xs"
            />
          </div>

          {/* 1.4 Destination Hub */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground/85">
              {isAr ? 'المستودع المستلم' : 'Destination Hub'}
            </label>
            <select
              value={destinationWarehouseId}
              onChange={(e) => setDestinationWarehouseId(e.target.value)}
              className="h-10 w-full px-3 rounded-xl border border-border/80 bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer shadow-2xs"
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
        </div>

        {/* 1.5 Inline Payment Terms Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/70">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-foreground/85 shrink-0">
              {isAr ? 'شروط الدفع:' : 'Payment Terms:'}
            </span>
            <div className="inline-flex rounded-xl border border-border/80 p-1 bg-muted/40 text-xs gap-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setPaymentTerms('cash')}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                  paymentTerms === 'cash'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isAr ? 'نقدي / كاش' : 'Cash on Delivery'}
              </button>
              <button
                type="button"
                onClick={() => setPaymentTerms('credit')}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                  paymentTerms === 'credit'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isAr ? 'آجل / ذمم (A/P)' : 'Full Credit (A/P)'}
              </button>
              <button
                type="button"
                onClick={() => setPaymentTerms('partial')}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                  paymentTerms === 'partial'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isAr ? 'دفع جزئي' : 'Partial Payment'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Partial Cash Input */}
            {paymentTerms === 'partial' && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {isAr ? 'المسدد حالياً:' : 'Paid Now:'}
                </span>
                <input
                  type="number"
                  min="0"
                  max={netTotal}
                  value={amountPaidNow}
                  onChange={(e) => setAmountPaidNow(Math.min(netTotal, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="h-7 w-28 px-2 rounded-lg border border-amber-500/30 bg-background text-foreground font-mono font-bold text-xs outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Treasury Safe Selector */}
            {amountPaidNow > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground/85">
                  {isAr ? 'حساب الخزينة / الصندوق:' : 'Treasury Account:'}
                </span>
                <select
                  value={treasuryAccount}
                  onChange={(e) => setTreasuryAccount(e.target.value)}
                  className="h-8.5 px-3 rounded-lg border border-border/80 bg-background text-foreground text-xs font-medium outline-none focus:border-primary cursor-pointer max-w-[220px] shadow-2xs"
                >
                  {availableTreasuryAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Card 2: جدول بنود المواد والتوريد الفعلي */}
      <PurchaseInvoiceItemsGrid
        lineItems={lineItems}
        products={products}
        isAr={isAr}
        currencySymbol={effectiveSymbol}
        onUpdateLineItem={updateLineItem}
        onAddNewLine={handleAddNewLine}
        onRemoveLine={handleRemoveLine}
        onSelectProduct={handleSelectProduct}
        onOpenDefineProduct={handleOpenDefineProduct}
      />

      {/* Card 3: المصاريف الإضافية والملخص المالي النهائي */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 w-full shadow-xs space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Side (7 cols): Financial Adjustments (Discount, Freight, Notes) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-xs">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground m-0 leading-tight">
                    {isAr ? 'الخصومات والمصاريف الإضافية' : 'Discounts & Landed Costs'}
                  </h4>
                  <p className="text-xs text-muted-foreground m-0 mt-0.5">
                    {isAr
                      ? 'تطبيق خصم التاجر، تكاليف الشحن والتوصيل، وتدوين الملاحظات'
                      : 'Apply vendor discounts, freight shipping costs, and receipt notes'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJournalPreview(!showJournalPreview)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>{showJournalPreview ? (isAr ? 'إخفاء القيد' : 'Hide Journal') : (isAr ? 'معاينة القيد' : 'View Journal')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Supplier Discount */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-foreground/85">
                  <span>{isAr ? 'الخصم الممنوح' : 'Discount'}</span>
                  <div className="flex border border-border/80 rounded-lg overflow-hidden text-[11px] shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-2 py-0.5 font-bold transition-colors cursor-pointer ${discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:text-foreground'}`}
                    >
                      {effectiveSymbol}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2 py-0.5 font-bold transition-colors cursor-pointer ${discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:text-foreground'}`}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="h-10 w-full px-3 rounded-xl border border-border/80 bg-background text-foreground font-mono font-bold text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 shadow-2xs"
                />
              </div>

              {/* Shipping / Landed Cost */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-foreground/85">
                  {isAr ? 'أجور الشحن (Landed)' : 'Freight / Landed'}
                </span>
                <input
                  type="number"
                  min="0"
                  value={shippingCost || ''}
                  onChange={(e) => setShippingCost(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="h-10 w-full px-3 rounded-xl border border-border/80 bg-background text-foreground font-mono font-bold text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 shadow-2xs"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-foreground/85">
                  {isAr ? 'ملاحظات القائمة' : 'Invoice Notes'}
                </span>
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder={isAr ? 'ملاحظات استلام الشحنة...' : 'Receipt notes...'}
                  className="h-10 w-full px-3 rounded-xl border border-border/80 bg-background text-foreground text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Right Side (5 cols): Net Financial Breakdown Box */}
          <div className="lg:col-span-5 bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="grid grid-cols-3 gap-2 pb-3 border-b border-border/70 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px] font-semibold">{isAr ? 'قيمة البضاعة' : 'Subtotal'}</span>
                <span className="font-mono font-bold text-foreground text-xs mt-0.5 block">{formatCurrency(subtotal)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-semibold">{isAr ? 'الخصم' : 'Discount'}</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs mt-0.5 block">
                  {calculatedDiscount > 0 ? `-${formatCurrency(calculatedDiscount)}` : '0'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-semibold">{isAr ? 'الشحن' : 'Freight'}</span>
                <span className="font-mono font-bold text-primary text-xs mt-0.5 block">
                  {shippingCost > 0 ? `+${formatCurrency(shippingCost)}` : '0'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div>
                <span className="text-[11px] text-muted-foreground block font-bold uppercase tracking-wider">{isAr ? 'الصافي النهائي المطلوب' : 'Net Bill Total'}</span>
                <span className="text-2xl font-black font-mono text-foreground tracking-tight leading-none mt-1 block">
                  {formatCurrency(netTotal)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-end">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold leading-none">{isAr ? 'المسدد' : 'Paid'}</span>
                  <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1 block">{formatCurrency(amountPaidNow)}</span>
                </div>
                <div className={`px-2.5 py-1.5 rounded-xl border text-end ${balanceDue > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-muted/60 border-border/80'}`}>
                  <span className={`text-[10px] block font-semibold leading-none ${balanceDue > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-muted-foreground'}`}>{isAr ? 'المتبقي دين' : 'Balance Due'}</span>
                  <span className={`text-xs font-bold font-mono mt-1 block ${balanceDue > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-foreground'}`}>
                    {formatCurrency(balanceDue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Collapsible Auto Journal Entry Preview */}
        {showJournalPreview && (
          <div className="mt-3 pt-3 border-t border-border/80">
            <div className="bg-muted/50 border border-border rounded-lg p-2.5 text-xs font-mono space-y-1">
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>{isAr ? 'من حـ/ المخزون والبضاعة المستلمة (مدين):' : 'Dr. Merchandise Inventory:'}</span>
                <span>+{formatCurrency(netTotal)}</span>
              </div>
              {amountPaidNow > 0 && (
                <div className="flex justify-between text-sky-600 font-bold">
                  <span>{isAr ? 'إلى حـ/ الصندوق والخزينة (دائن):' : 'Cr. Cash & Treasury:'}</span>
                  <span>-{formatCurrency(amountPaidNow)}</span>
                </div>
              )}
              {balanceDue > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>{isAr ? `إلى حـ/ الموردين والذمم الدائنة (${selectedSupplier.company}) (دائن):` : `Cr. Accounts Payable (${selectedSupplier.company}):`}</span>
                  <span>-{formatCurrency(balanceDue)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Modal: Inline Product Creation */}
      {isInlineProductOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 text-foreground">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>{isAr ? 'تعريف صنف جديد في الدليل' : 'Register New Item SKU'}</span>
              </h4>
              <button type="button" onClick={() => setIsInlineProductOpen(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInlineProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">{isAr ? 'اسم الصنف:' : 'Product Name:'}</label>
                <input
                  type="text"
                  required
                  value={inlineProductName}
                  onChange={(e) => setInlineProductName(e.target.value)}
                  className="h-10 w-full px-3 rounded-lg border border-border bg-card text-xs font-medium outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">{isAr ? 'التصنيف:' : 'Category:'}</label>
                <input
                  type="text"
                  value={inlineProductCategory}
                  onChange={(e) => setInlineProductCategory(e.target.value)}
                  className="h-10 w-full px-3 rounded-lg border border-border bg-card text-xs font-medium outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">{isAr ? `سعر الشراء (${effectiveSymbol}):` : `Cost Price (${effectiveSymbol}):`}</label>
                  <input
                    type="number"
                    value={inlineProductCost || ''}
                    onChange={(e) => setInlineProductCost(parseFloat(e.target.value) || 0)}
                    className="h-10 w-full px-3 rounded-lg border border-border bg-card text-xs font-mono font-bold outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">{isAr ? `سعر البيع المقترح (${effectiveSymbol}):` : `Selling Price (${effectiveSymbol}):`}</label>
                  <input
                    type="number"
                    value={inlineProductSelling || ''}
                    onChange={(e) => setInlineProductSelling(parseFloat(e.target.value) || 0)}
                    className="h-10 w-full px-3 rounded-lg border border-border bg-card text-xs font-mono font-bold outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsInlineProductOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-border hover:bg-muted"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-colors"
                >
                  {isAr ? 'حفظ وإسقاط في الجدول' : 'Save & Insert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Modal: New Supplier */}
      {isQuickSupplierOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 text-foreground">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span>{isAr ? 'إضافة مورد جديد' : 'Add New Supplier'}</span>
              </h4>
              <button type="button" onClick={() => setIsQuickSupplierOpen(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickSupplierSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">{isAr ? 'اسم الشركة / المورد:' : 'Supplier Name:'}</label>
                <input
                  type="text"
                  required
                  value={newSupplierCompany}
                  onChange={(e) => setNewSupplierCompany(e.target.value)}
                  placeholder={isAr ? "مثال: شركة التوريدات العالمية" : "e.g. Global Supplies Ltd"}
                  className="h-10 w-full px-3 rounded-lg border border-border bg-card text-xs font-medium outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">{isAr ? 'رقم الهاتف:' : 'Phone Number:'}</label>
                <input
                  type="text"
                  name="quick_supplier_phone_contact"
                  autoComplete="one-time-code"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder={isAr ? 'رقم الهاتف مع رمز الدولة...' : '+1 (555) 000-0000'}
                  className="h-10 w-full px-3 rounded-lg border border-border bg-card text-xs font-mono outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsQuickSupplierOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-border hover:bg-muted"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isAr ? 'إضافة واختيار' : 'Save & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

