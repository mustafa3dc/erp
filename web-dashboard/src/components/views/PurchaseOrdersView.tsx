import React, { useState } from 'react';
import { 
  Clock, Plus, Search, CheckCircle2, FileText, 
  ArrowDownToLine, Eye, X, PackageCheck, Package, Sparkles, Send, Trash2
} from 'lucide-react';
import { Product, Warehouse } from '../../types/warehouse';
import { PurchaseOrder, PurchaseOrderItem } from '../../types/purchases';
import { 
  getStoredPurchaseOrders, 
  saveStoredPurchaseOrders,
  getStoredWarehouses,
  getStoredProducts
} from '../../services/storageService';
import CreatePurchaseOrderForm from '../purchases/CreatePurchaseOrderForm';
import { formatIQD } from '../purchases/PurchaseInvoiceItemsGrid';
import { useSettings } from '../../context/settings-context';

const isLegacyDemoPO = (po: any): boolean => {
  if (!po) return true;
  const id = String(po.id || '');
  const poNum = String(po.poNumber || '');
  const supplier = String(po.supplierName || '');
  if (id === 'PO-01' || id === 'PO-02' || id === 'PO-03') return true;
  if (poNum === 'PO-2026-0410' || poNum === 'PO-2026-0409' || poNum === 'PO-2026-0412' || poNum.startsWith('PO-2026-04')) return true;
  if (supplier.includes('التقنية') || supplier.includes('النور') || supplier.includes('الشرق الأوسط')) return true;
  return false;
};

const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];

interface PurchaseOrdersViewProps {
  lang?: 'en' | 'ar';
  products?: Product[];
  warehouses?: Warehouse[];
  onConvertToInvoice?: (po: PurchaseOrder) => void;
}

export default function PurchaseOrdersView({
  lang = 'ar',
  products: initialProducts,
  warehouses: initialWarehouses,
  onConvertToInvoice
}: PurchaseOrdersViewProps) {
  const isAr = lang === 'ar';
  const { tenantCountryCode, settings, currencySymbol, formatMoney } = useSettings();
  const isIraqTenant = (tenantCountryCode === 'IQ' || settings?.tenantCountryCode === 'IQ');
  const isIqd = (settings?.baseCurrency === 'IQD');
  const effectiveSymbol = currencySymbol || (isIqd ? (isAr ? 'د.ع' : 'IQD') : '$');

  const formatCurrency = (amt: number | undefined | null) => {
    return formatMoney(Number(amt) || 0);
  };

  const [orders, setOrders] = useState<PurchaseOrder[]>(() => {
    // 1. Purge across all tenant scoped localStorage keys
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('po_list') || key.includes('PO_LIST') || key.includes('purchase_order'))) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const filtered = parsed.filter((po: any) => !isLegacyDemoPO(po));
                localStorage.setItem(key, JSON.stringify(filtered));
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
    const stored = getStoredPurchaseOrders();
    const cleaned = (stored || []).filter(po => !isLegacyDemoPO(po));
    saveStoredPurchaseOrders(cleaned);
    return cleaned;
  });

  // Ensure clean state on mount
  React.useEffect(() => {
    setOrders(prev => {
      const filtered = prev.filter(po => !isLegacyDemoPO(po));
      if (filtered.length !== prev.length) {
        saveStoredPurchaseOrders(filtered);
      }
      return filtered;
    });
  }, []);

  const [isCreating, setIsCreating] = useState(false);
  const [selectedPOForPreview, setSelectedPOForPreview] = useState<PurchaseOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toastMsg, setToastMsg] = useState('');

  const activeProducts = initialProducts || getStoredProducts();
  const activeWarehouses = initialWarehouses || getStoredWarehouses();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleDeleteOrder = (orderId: string, poNumber: string) => {
    const updated = orders.filter(o => o.id !== orderId);
    setOrders(updated);
    saveStoredPurchaseOrders(updated);
    showToast(isAr ? `تم حذف أمر الشراء ${poNumber} بنجاح` : `Purchase order ${poNumber} deleted`);
  };

  const handleClearAll = () => {
    setOrders([]);
    saveStoredPurchaseOrders([]);
    showToast(isAr ? 'تم مسح كافة أوامر الشراء' : 'All purchase orders cleared');
  };

  const handleOrderCreated = (po: PurchaseOrder) => {
    setOrders(prev => [po, ...prev]);
    setIsCreating(false);
    showToast(isAr ? `تم إصدار أمر الشراء ${po.poNumber} بنجاح!` : `Purchase Order ${po.poNumber} issued!`);
  };

  const handleSubmitDraft = (po: PurchaseOrder) => {
    const updated = orders.map(o => o.id === po.id ? { ...o, status: 'SUBMITTED' as const } : o);
    setOrders(updated);
    saveStoredPurchaseOrders(updated);
    showToast(isAr ? `تم إرسال واعتماد أمر الشراء ${po.poNumber} بنجاح!` : `PO ${po.poNumber} submitted!`);
  };

  const handleReceiveAndTransfer = (po: PurchaseOrder) => {
    if (onConvertToInvoice) {
      onConvertToInvoice(po);
    } else {
      // Direct in-place status toggle if no navigation callback
      const updated = orders.map(o => o.id === po.id ? { ...o, status: 'RECEIVED_POSTED' as const } : o);
      setOrders(updated);
      saveStoredPurchaseOrders(updated);
      showToast(isAr ? `تم استلام وتوريد بضاعة أمر الشراء ${po.poNumber} بنجاح!` : `PO ${po.poNumber} received!`);
    }
  };

  const filteredOrders = orders.filter(po => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      po.poNumber.toLowerCase().includes(q) ||
      po.supplierName.toLowerCase().includes(q) ||
      (po.targetWarehouseName && po.targetWarehouseName.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOpenOrdersValue = orders
    .filter(po => po.status !== 'RECEIVED_POSTED')
    .reduce((acc, it) => acc + (it.totalAmount || 0), 0);
  const submittedCount = orders.filter(po => po.status === 'SUBMITTED').length;
  const draftCount = orders.filter(po => po.status === 'DRAFT').length;
  const receivedCount = orders.filter(po => po.status === 'RECEIVED_POSTED').length;

  const submittedLabel = isAr
    ? (submittedCount === 1 ? 'أمر مفتوح' : submittedCount === 2 ? 'أمران مفتوحان' : `${submittedCount} أوامر مفتوحة`)
    : (submittedCount === 1 ? '1 Order' : `${submittedCount} Orders`);

  const draftLabel = isAr
    ? (draftCount === 1 ? 'مسودة واحدة' : draftCount === 2 ? 'مسودتان' : `${draftCount} مسودات`)
    : (draftCount === 1 ? '1 Draft' : `${draftCount} Drafts`);

  const receivedLabel = isAr
    ? (receivedCount === 1 ? 'أمر مكتمل' : receivedCount === 2 ? 'أمران مكتملان' : `${receivedCount} مكتمل`)
    : (receivedCount === 1 ? '1 Received' : `${receivedCount} Received`);

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'RECEIVED_POSTED':
        return {
          label: isAr ? 'مستلم ومورد' : 'Received',
          cls: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
        };
      case 'SUBMITTED':
        return {
          label: isAr ? 'قيد الشحن' : 'In Transit',
          cls: 'bg-sky-500/10 text-sky-600 border border-sky-500/20'
        };
      case 'DRAFT':
      default:
        return {
          label: isAr ? 'مسودة' : 'Draft',
          cls: 'bg-muted text-muted-foreground border border-border'
        };
    }
  };

  // Render Full-Width Creation View
  if (isCreating) {
    return (
      <CreatePurchaseOrderForm
        products={activeProducts}
        warehouses={activeWarehouses}
        isAr={isAr}
        onOrderCreated={handleOrderCreated}
        onCancel={() => setIsCreating(false)}
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
            <Clock className="w-5 h-5 text-primary" />
            <span>{isAr ? 'أوامر الشراء المجدولة (طلبيات التوريد المستقبلية)' : 'Scheduled Purchase Orders (POs)'}</span>
          </h2>
          <p className="text-xs text-muted-foreground leading-normal mt-1 block">
            {isAr
              ? 'إصدار ومتابعة طلبيات الشراء المعلقة مع الموردين ببنود مواد فعلية، ونقلها بضغطة زر واحدة إلى المخزن عند الاستلام'
              : 'Draft and track scheduled vendor orders with real line items, convert to stock with 1-click'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-2 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-bold transition-all cursor-pointer"
            >
              {isAr ? 'مسح كافة الأوامر' : 'Clear All'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'إصدار أمر شراء مجدول جديد' : 'New Purchase Order'}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards (Full Width Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-muted-foreground block">{isAr ? 'قيمة الأوامر المفتوحة المعلقة' : 'Open Orders Value'}</span>
              <div className="text-xl font-black font-mono text-primary mt-1">
                {formatCurrency(totalOpenOrdersValue)}
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-muted-foreground block">{isAr ? 'أوامر قيد الشحن والتوريد' : 'Submitted Orders'}</span>
              <div className="text-xl font-black font-mono text-sky-600 mt-1">
                {submittedLabel}
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-muted-foreground block">{isAr ? 'طلبيات في طور المسودة' : 'Draft Orders'}</span>
              <div className="text-xl font-black font-mono text-slate-500 mt-1">
                {draftLabel}
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-500/10 text-slate-500 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-muted-foreground block">{isAr ? 'أوامر مستلمة وموردة' : 'Received Orders'}</span>
              <div className="text-xl font-black font-mono text-emerald-600 mt-1">
                {receivedLabel}
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3 w-full">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث برقم الأمر (PO)، المورد، أو المستودع...' : 'Search POs, supplier, hub...'}
            className="h-10 w-full ps-9 pe-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-foreground text-xs font-medium outline-none focus:border-primary cursor-pointer"
        >
          <option value="ALL">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
          <option value="SUBMITTED">{isAr ? 'قيد الشحن والتوريد' : 'Submitted'}</option>
          <option value="DRAFT">{isAr ? 'مسودة' : 'Draft'}</option>
          <option value="RECEIVED_POSTED">{isAr ? 'مستلم ومورد' : 'Received'}</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="border border-border rounded-xl bg-card overflow-x-auto w-full shadow-sm">
        <table className="w-full text-xs text-start border-collapse min-w-[880px]">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-muted-foreground font-bold select-none">
              <th className="py-3 px-4 text-start">{isAr ? 'رقم أمر الشراء' : 'PO #'}</th>
              <th className="py-3 px-4 text-start">{isAr ? 'المورد / الشركة' : 'Supplier'}</th>
              <th className="py-3 px-4 text-start">{isAr ? 'المستودع المطلوب' : 'Target Hub'}</th>
              <th className="py-3 px-4 text-start whitespace-nowrap">{isAr ? 'تاريخ الطلب' : 'Order Date'}</th>
              <th className="py-3 px-4 text-start whitespace-nowrap">{isAr ? 'الوصول المتوقع (ETA)' : 'ETA'}</th>
              <th className="py-3 px-4 text-end whitespace-nowrap">{isAr ? `القيمة التقديرية (${effectiveSymbol})` : `Est. Amount (${effectiveSymbol})`}</th>
              <th className="py-3 px-4 text-center whitespace-nowrap">{isAr ? 'عدد البنود' : 'Items'}</th>
              <th className="py-3 px-4 text-center whitespace-nowrap">{isAr ? 'الحالة' : 'Status'}</th>
              <th className="py-3 px-4 text-center whitespace-nowrap">{isAr ? 'الإجراء والتوريد' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted-foreground text-xs">
                  {isAr ? 'لا توجد أوامر شراء مجدولة مطابقة' : 'No purchase orders found'}
                </td>
              </tr>
            ) : (
              filteredOrders.map((po) => {
                const count = po.items?.length || (po.itemsCount ? 1 : 0);
                const itemsCountLabel = isAr
                  ? (count === 1 ? 'صنف واحد' : count === 2 ? 'صنفان' : count <= 10 ? `${count} أصناف` : `${count} صنف`)
                  : (count === 1 ? '1 item' : `${count} items`);
                const statusInfo = getStatusBadge(po.status);

                return (
                  <tr key={po.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-extrabold text-primary whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedPOForPreview(po)}
                        className="hover:underline text-start cursor-pointer"
                        title={isAr ? 'عرض بنود ومواد الطلبية' : 'View order items'}
                      >
                        {po.poNumber}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      {po.supplierName}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <bdi dir="auto">{po.targetWarehouseName || (isAr ? 'غير محدد' : '—')}</bdi>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {po.orderDate}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {po.expectedDate}
                    </td>
                    <td className="py-3 px-4 text-end font-mono font-bold text-foreground whitespace-nowrap">
                      {formatCurrency(po.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <button
                        type="button"
                        onClick={() => setSelectedPOForPreview(po)}
                        className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-bold cursor-pointer"
                      >
                        {itemsCountLabel}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPOForPreview(po)}
                          className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title={isAr ? 'معاينة بنود الطلبية' : 'View items'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* SUBMITTED: Allow Receive & Convert to Stock */}
                        {po.status === 'SUBMITTED' && (
                          <button
                            type="button"
                            onClick={() => handleReceiveAndTransfer(po)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                            title={isAr ? 'نقل بنود الطلبية إلى فاتورة واردة وتوريدها للمخزن' : 'Receive & convert to inbound bill'}
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            <span>{isAr ? 'استلام وتوريد' : 'Receive'}</span>
                          </button>
                        )}

                        {/* DRAFT: Block Receive! Show Submit PO action */}
                        {po.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => handleSubmitDraft(po)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                            title={isAr ? 'إرسال واعتماد أمر الشراء للمورد' : 'Submit PO to vendor'}
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isAr ? 'إرسال واعتماد' : 'Submit'}</span>
                          </button>
                        )}

                        {/* RECEIVED_POSTED: Display Received badge */}
                        {po.status === 'RECEIVED_POSTED' && (
                          <span className="text-[11px] font-bold text-muted-foreground px-2 py-1">
                            {isAr ? 'تم التوريد' : 'Received'}
                          </span>
                        )}

                        {/* Delete PO Action */}
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(po.id, po.poNumber)}
                          className="p-1.5 rounded-lg border border-border hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer"
                          title={isAr ? 'حذف أمر الشراء' : 'Delete PO'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PO Items Details Modal */}
      {selectedPOForPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-foreground">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <span>{isAr ? `بنود ومواد أمر الشراء: ${selectedPOForPreview.poNumber}` : `PO Items: ${selectedPOForPreview.poNumber}`}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedPOForPreview.supplierName} • <bdi dir="auto">{selectedPOForPreview.targetWarehouseName || (isAr ? 'غير محدد' : '—')}</bdi> • {isAr ? 'وصول متوقع:' : 'ETA:'} {selectedPOForPreview.expectedDate}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedPOForPreview(null)} className="p-1.5 hover:bg-muted rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground font-bold">
                    <th className="py-2.5 px-3 text-center">#</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'الصنف والباركود' : 'Item & Barcode'}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? 'الوحدة' : 'UOM'}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? 'الكمية المطلوبة' : 'Qty'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? `التكلفة التقديرية (${effectiveSymbol})` : `Est. Cost (${effectiveSymbol})`}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? `الإجمالي (${effectiveSymbol})` : `Total (${effectiveSymbol})`}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {selectedPOForPreview.items && selectedPOForPreview.items.length > 0 ? (
                    selectedPOForPreview.items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold">
                          <div>{isAr ? it.nameAr : (it.nameEn || it.nameAr)}</div>
                          {it.sku && <div className="text-[10px] text-muted-foreground font-mono">SKU: {it.sku} {it.barcode ? `| ${it.barcode}` : ''}</div>}
                        </td>
                        <td className="py-2 px-3 text-center text-muted-foreground">
                          {isAr ? it.uom : (it.uom === 'قطعة' ? 'Piece' : it.uom === 'درزن' ? 'Dozen' : it.uom === 'كرتونة' ? 'Box/Carton' : it.uom === 'بكرة' ? 'Roll' : it.uom)}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold">{it.quantity}</td>
                        <td className="py-2 px-3 text-end font-mono">{formatCurrency(it.estimatedUnitCost)}</td>
                        <td className="py-2 px-3 text-end font-mono font-bold text-foreground">{formatCurrency(it.lineTotal)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        {isAr ? 'لا توجد بنود تفصيلية مسجلة' : 'No items'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/40 rounded-xl font-bold text-xs">
              <span>{isAr ? 'إجمالي القيمة التقديرية للطلبية:' : 'Total Estimated Budget:'}</span>
              <span className="text-base font-mono font-black text-primary">
                {formatCurrency(selectedPOForPreview.totalAmount)}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setSelectedPOForPreview(null)}
                className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>

              {/* In Modal: Show Receive ONLY if SUBMITTED */}
              {selectedPOForPreview.status === 'SUBMITTED' && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedPOForPreview;
                    setSelectedPOForPreview(null);
                    handleReceiveAndTransfer(target);
                  }}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{isAr ? 'استلام وتوريد هذه البنود للمخزن' : 'Receive Items & Inbound'}</span>
                </button>
              )}

              {/* In Modal: Show Submit if DRAFT */}
              {selectedPOForPreview.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedPOForPreview;
                    setSelectedPOForPreview(null);
                    handleSubmitDraft(target);
                  }}
                  className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isAr ? 'إرسال واعتماد أمر الشراء' : 'Submit Purchase Order'}</span>
                </button>
              )}

              {/* In Modal: If already received */}
              {selectedPOForPreview.status === 'RECEIVED_POSTED' && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isAr ? 'تم استلام وتوريد البضاعة' : 'Received & Inbounded'}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
