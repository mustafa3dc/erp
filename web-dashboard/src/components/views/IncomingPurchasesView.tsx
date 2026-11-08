import React, { useState } from 'react';
import { 
  ShoppingBag, Plus, Search, CheckCircle2, Clock, 
  Receipt, Building2, Printer, Eye, X, Filter, Sparkles
} from 'lucide-react';
import { Product, Warehouse } from '../../types/warehouse';
import { TransactionDetail } from '../TransactionModal';
import { PurchaseInvoice, PurchaseInvoiceItem } from '../../types/purchases';
import { 
  getStoredPurchaseInvoices, 
  getStoredProducts, 
  getStoredWarehouses,
  PurchaseInvoiceTransactionResult 
} from '../../services/storageService';
import CreatePurchaseInvoiceForm, { InitialPurchaseInvoicePrefill } from '../purchases/CreatePurchaseInvoiceForm';
import PrintBarcodeLabelsModal from '../modals/PrintBarcodeLabelsModal';
import { getStoredPurchaseOrders, saveStoredPurchaseOrders } from '../../services/storageService';
import { useSettings } from '../../context/settings-context';

interface IncomingPurchasesViewProps {
  lang?: 'en' | 'ar';
  products?: Product[];
  setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
  warehouses?: Warehouse[];
  setTransactions?: React.Dispatch<React.SetStateAction<TransactionDetail[]>>;
  prefillFromPO?: InitialPurchaseInvoicePrefill | null;
  onClearPrefill?: () => void;
  onPOReceived?: (poId: string) => void;
}

export default function IncomingPurchasesView({
  lang = 'ar',
  products: initialProducts,
  setProducts: updateProductsState,
  warehouses: initialWarehouses,
  setTransactions: updateTransactionsState,
  prefillFromPO,
  onClearPrefill,
  onPOReceived
}: IncomingPurchasesViewProps) {
  const isAr = lang === 'ar';
  const { tenantCountryCode, settings, currencySymbol, formatMoney } = useSettings();
  const isIraqTenant = (tenantCountryCode === 'IQ' || settings?.tenantCountryCode === 'IQ');
  const isIqd = (settings?.baseCurrency === 'IQD');
  const effectiveSymbol = currencySymbol || (isIqd ? (isAr ? 'د.ع' : 'IQD') : '$');

  const formatCurrency = (amt: number | undefined | null) => {
    return formatMoney(Number(amt) || 0);
  };

  const getPaymentTermsBadge = (terms: string) => {
    switch (terms) {
      case 'cash':
        return {
          label: isAr ? 'نقدي / كاش' : 'Cash',
          cls: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
        };
      case 'credit':
        return {
          label: isAr ? 'آجل بالكامل' : 'Credit',
          cls: 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
        };
      case 'partial':
      default:
        return {
          label: isAr ? 'دفع جزئي' : 'Partial',
          cls: 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
        };
    }
  };

  const [invoices, setInvoices] = useState<PurchaseInvoice[]>(() => getStoredPurchaseInvoices());
  const [isCreating, setIsCreating] = useState(() => !!prefillFromPO);
  const [activePrefill, setActivePrefill] = useState<InitialPurchaseInvoicePrefill | null>(prefillFromPO || null);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  React.useEffect(() => {
    if (prefillFromPO) {
      setActivePrefill(prefillFromPO);
      setIsCreating(true);
    }
  }, [prefillFromPO]);

  // Barcode print modal
  const [barcodePrintData, setBarcodePrintData] = useState<{
    items: PurchaseInvoiceItem[];
    billNumber: string;
    warehouseName: string;
  } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [paymentTermsFilter, setPaymentTermsFilter] = useState('ALL');
  const [toastMsg, setToastMsg] = useState('');

  const activeProducts = initialProducts || getStoredProducts();
  const activeWarehouses = initialWarehouses || getStoredWarehouses();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleInvoiceCreated = (result: PurchaseInvoiceTransactionResult, sourcePoId?: string) => {
    setInvoices(prev => [result.invoice, ...prev]);
    if (updateProductsState) updateProductsState(result.updatedProducts);
    if (updateTransactionsState) updateTransactionsState(prev => [...result.createdTransactions, ...prev]);
    
    // Auto-update PO status to RECEIVED_POSTED
    if (sourcePoId) {
      const storedPOs = getStoredPurchaseOrders();
      const updated = storedPOs.map((po: any) => po.id === sourcePoId ? { ...po, status: 'RECEIVED_POSTED' } : po);
      saveStoredPurchaseOrders(updated);
      if (onPOReceived) onPOReceived(sourcePoId);
    }

    setIsCreating(false);
    setActivePrefill(null);
    if (onClearPrefill) onClearPrefill();

    showToast(isAr 
      ? `تم حفظ واعتماد قائمة المشتريات رقم ${result.invoice.billNumber} وتوريد البضاعة للمخزن بنجاح!` 
      : `Purchase Bill ${result.invoice.billNumber} posted and stock updated!`);
  };

  // Filtered List
  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      inv.billNumber.toLowerCase().includes(q) ||
      inv.supplierName.toLowerCase().includes(q) ||
      inv.supplierRefNo.toLowerCase().includes(q) ||
      inv.warehouseName.toLowerCase().includes(q);

    const matchesWh = warehouseFilter === 'ALL' || inv.warehouseId === warehouseFilter;
    const matchesTerms = paymentTermsFilter === 'ALL' || inv.paymentTerms === paymentTermsFilter;

    return matchesSearch && matchesWh && matchesTerms;
  });

  // KPI calculations
  const totalValue = invoices.reduce((acc, it) => acc + (it.netTotal || 0), 0);
  const totalCash = invoices.reduce((acc, it) => acc + (it.amountPaid || 0), 0);
  const totalDebt = invoices.reduce((acc, it) => acc + (it.balanceDue || 0), 0);

  // If in create mode: show full-width Create Form
  if (isCreating) {
    return (
      <CreatePurchaseInvoiceForm
        products={activeProducts}
        warehouses={activeWarehouses}
        isAr={isAr}
        initialData={activePrefill}
        onInvoiceCreated={handleInvoiceCreated}
        onCancel={() => {
          setIsCreating(false);
          setActivePrefill(null);
          if (onClearPrefill) onClearPrefill();
        }}
      />
    );
  }

  return (
    <div className="w-full px-6 py-4 space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 start-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-emerald-400 border border-emerald-500/30 rounded-xl shadow-2xl text-xs font-bold">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border w-full">
        <div>
          <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <span>{isAr ? 'فواتير الشراء الواردة وتوريد المخزون' : 'Incoming Purchase Invoices & Stock Inbound'}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAr
              ? 'سجل البضائع المستلمة فعلياً في المستودعات، تحديث تكلفة FIFO، وإدارة ديون الموردين ومصروفات الخزينة'
              : 'Actual inward goods records, real-time inventory increment, FIFO accounting, and accounts payable'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? 'تسجيل قائمة مشتريات جديدة' : 'New Purchase Bill'}</span>
        </button>
      </div>

      {/* KPI Cards (Full Width Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        
        {/* Total Inward Procurement */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-muted-foreground block">{isAr ? 'إجمالي مشتريات التوريد' : 'Total Inbound Value'}</span>
              <div className="text-xl font-black font-mono text-emerald-600 mt-1">
                {formatCurrency(totalValue)}
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Count of Bills with proper pluralization */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-muted-foreground block">{isAr ? 'قوائم المشتريات المعتمدة' : 'Posted Invoices'}</span>
              <div className="text-xl font-black font-mono text-primary mt-1">
                {invoices.length === 1 
                  ? (isAr ? 'قائمة واحدة' : '1 Bill') 
                  : (invoices.length === 2 
                    ? (isAr ? 'قائمتان' : '2 Bills') 
                    : (invoices.length <= 10 
                      ? `${invoices.length} ${isAr ? 'قوائم' : 'Bills'}` 
                      : `${invoices.length} ${isAr ? 'قائمة' : 'Bills'}`))}
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Paid Cash */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-muted-foreground block">{isAr ? 'المسدد نقداً من الخزينة' : 'Cash Paid'}</span>
              <div className="text-xl font-black font-mono text-sky-600 mt-1">
                {formatCurrency(totalCash)}
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Supplier Debt */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-muted-foreground block">{isAr ? 'ديون الموردين والآجل (A/P)' : 'Accounts Payable'}</span>
              <div className="text-xl font-black font-mono text-rose-600 mt-1">
                {formatCurrency(totalDebt)}
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3 w-full">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث برقم القائمة، المورد، رقم الوصل الورقي، أو المستودع...' : 'Search bills, supplier, ref...'}
            className="h-10 w-full ps-9 pe-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-border bg-card text-foreground text-xs font-medium outline-none focus:border-primary cursor-pointer"
          >
            <option value="ALL">{isAr ? 'جميع المستودعات' : 'All Warehouses'}</option>
            {activeWarehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{isAr ? wh.nameAr : (wh.nameEn || wh.nameAr)}</option>
            ))}
          </select>

          <select
            value={paymentTermsFilter}
            onChange={(e) => setPaymentTermsFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-border bg-card text-foreground text-xs font-medium outline-none focus:border-primary cursor-pointer"
          >
            <option value="ALL">{isAr ? 'كل طرق الدفع' : 'All Terms'}</option>
            <option value="cash">{isAr ? 'نقدي / كاش' : 'Cash'}</option>
            <option value="credit">{isAr ? 'آجل بالكامل' : 'Credit'}</option>
            <option value="partial">{isAr ? 'دفع جزئي' : 'Partial'}</option>
          </select>
        </div>
      </div>

      {/* Data Table (Full Width with overflow-x-auto) */}
      <div className="border border-border rounded-xl bg-card overflow-x-auto w-full shadow-sm">
        <table className="w-full text-xs text-start border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-muted-foreground font-bold select-none">
              <th className="py-3 px-4 text-start">{isAr ? 'كود القائمة' : 'Bill #'}</th>
              <th className="py-3 px-4 text-start">{isAr ? 'وصل المورد الورقي' : 'Supplier Ref'}</th>
              <th className="py-3 px-4 text-start">{isAr ? 'المورد / الشركة' : 'Supplier'}</th>
              <th className="py-3 px-4 text-start">{isAr ? 'المستودع المستلم' : 'Destination Hub'}</th>
              <th className="py-3 px-4 text-start">{isAr ? 'تاريخ التوريد' : 'Date'}</th>
              <th className="py-3 px-4 text-end">{isAr ? 'إجمالي الصافي' : 'Net Total'}</th>
              <th className="py-3 px-4 text-end">{isAr ? 'المدفوع كاش' : 'Paid Cash'}</th>
              <th className="py-3 px-4 text-end">{isAr ? 'المتبقي دين' : 'Balance Due'}</th>
              <th className="py-3 px-4 text-center">{isAr ? 'طريقة السداد' : 'Terms'}</th>
              <th className="py-3 px-4 text-center">{isAr ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-muted-foreground text-xs">
                  {isAr ? 'لا توجد فواتير مشتريات واردة مسجلة' : 'No incoming purchase bills recorded'}
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                  {/* Bill # with Items Count Badge placed cleanly underneath */}
                  <td className="py-3 px-4 font-mono font-bold text-primary">
                    <div>{inv.billNumber}</div>
                    <div className="text-[10px] font-sans font-normal text-muted-foreground mt-0.5">
                      {inv.itemsCount === 1 ? (isAr ? 'صنف واحد' : '1 item') : `${inv.itemsCount} ${isAr ? 'قطع / أصناف' : 'items'}`}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-amber-700 dark:text-amber-400">
                    {inv.supplierRefNo || '—'}
                  </td>
                  {/* Clean Supplier Name without displaced items count */}
                  <td className="py-3 px-4 font-bold text-foreground">
                    {inv.supplierName}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    <bdi dir="auto">{inv.warehouseName}</bdi>
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    {inv.invoiceDate}
                  </td>
                  <td className="py-3 px-4 text-end font-mono font-extrabold text-foreground">
                    {formatCurrency(inv.netTotal)}
                  </td>
                  <td className="py-3 px-4 text-end font-mono font-bold text-sky-600">
                    {formatCurrency(inv.amountPaid || 0)}
                  </td>
                  <td className="py-3 px-4 text-end font-mono font-bold">
                    <span className={inv.balanceDue > 0 ? 'text-rose-600' : 'text-muted-foreground'}>
                      {formatCurrency(inv.balanceDue || 0)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {(() => {
                      const badge = getPaymentTermsBadge(inv.paymentTerms);
                      return (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title={isAr ? 'عرض تفاصيل الفاتورة' : 'View details'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBarcodePrintData({
                          items: inv.items,
                          billNumber: inv.billNumber,
                          warehouseName: inv.warehouseName
                        })}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-emerald-600 transition-colors cursor-pointer"
                        title={isAr ? 'طباعة باركودات الشحنة' : 'Print barcodes'}
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bill Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-foreground">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  <span>{isAr ? `تفاصيل قائمة المشتريات: ${selectedInvoice.billNumber}` : `Bill Details: ${selectedInvoice.billNumber}`}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedInvoice.supplierName} • {selectedInvoice.invoiceDate} • وصل المورد: {selectedInvoice.supplierRefNo || '—'}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedInvoice(null)} className="p-1.5 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground font-bold">
                    <th className="py-2.5 px-3 text-center">#</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'الصنف والباركود' : 'Item'}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? 'الوحدة' : 'UOM'}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? 'الكمية' : 'Qty'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'سعر الشراء' : 'Cost'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {selectedInvoice.items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="py-2 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold">
                        <div>{isAr ? it.nameAr : (it.nameEn || it.nameAr)}</div>
                        {it.barcode && <div className="text-[10px] text-muted-foreground font-mono">{it.barcode}</div>}
                      </td>
                      <td className="py-2 px-3 text-center text-muted-foreground">
                        {isAr ? it.uom : (it.uom === 'قطعة' ? 'Piece' : it.uom === 'درزن' ? 'Dozen' : it.uom === 'كرتونة' ? 'Box/Carton' : it.uom === 'بكرة' ? 'Roll' : it.uom)}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{it.quantity}</td>
                      <td className="py-2 px-3 text-end font-mono">{formatCurrency(it.unitCost)}</td>
                      <td className="py-2 px-3 text-end font-mono font-bold text-foreground">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/40 rounded-xl font-bold text-xs">
              <span>{isAr ? 'الصافي النهائي للقائمة:' : 'Net Total:'}</span>
              <span className="text-base font-mono font-black text-emerald-600">
                {formatCurrency(selectedInvoice.netTotal)}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Print Modal */}
      {barcodePrintData && (
        <PrintBarcodeLabelsModal
          isOpen={!!barcodePrintData}
          onClose={() => setBarcodePrintData(null)}
          items={barcodePrintData.items}
          lang={lang}
          billNumber={barcodePrintData.billNumber}
          warehouseName={barcodePrintData.warehouseName}
        />
      )}

    </div>
  );
}

