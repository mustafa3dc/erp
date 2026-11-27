import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  X,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  ShoppingBag,
  DollarSign,
  Layers,
  Lock,
  Unlock,
  AlertTriangle,
  MessageCircle
} from 'lucide-react';
import { SalesInvoice, Product } from '../../types/warehouse';
import { Button } from '../ui/button';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { usePermissions } from '../../hooks/usePermissions';
import { useSettings } from '../../context/settings-context';
import { localizeWarehouse } from '../../lib/localeHelpers';
import { getTranslation } from '../../lib/i18n';
import { ActiveShift, getStoredActiveShift, getStoredAuthSession } from '../../services/storageService';
import { formatInvoiceWhatsAppMessage, openWhatsAppShare } from '../../utils/whatsappUtils';
import { toast } from 'sonner';

export interface SalesInvoicesViewProps {
  invoices: SalesInvoice[];
  products: Product[];
  lang: 'en' | 'ar';
  onOpenCreateModal?: () => void;
  onNavigateToCreate?: () => void;
  onNavigateToShifts?: () => void;
  onOpenInvoiceDetails: (invoice: SalesInvoice) => void;
}

export default function SalesInvoicesView({
  invoices,
  products,
  lang,
  onOpenCreateModal,
  onNavigateToCreate,
  onNavigateToShifts,
  onOpenInvoiceDetails
}: SalesInvoicesViewProps) {
  const isAr = lang === 'ar';
  const { hasPermission } = usePermissions();
  const { settings, formatMoney } = useSettings();
  const gt = (key: string, fallback?: string) => getTranslation(lang, `ui.invoiceShiftGate.${key}`, fallback);

  const handleShareInvoiceWhatsApp = (inv: SalesInvoice, e: React.MouseEvent) => {
    e.stopPropagation();
    const session = getStoredAuthSession();
    const storeName = session?.tenantName || settings.organizationName || 'ZiloX ERP';
    const total = Number(inv.total || 0);
    const paid = inv.status === 'paid' ? total : 0;
    const remaining = Math.max(0, total - paid);
    const itemsSummary = inv.items && inv.items.length > 0
      ? inv.items.slice(0, 4).map(it => `${isAr ? it.nameAr : (it.nameEn || it.nameAr)} x${it.quantity}`).join('، ')
      : undefined;

    const msg = formatInvoiceWhatsAppMessage({
      lang,
      storeName,
      invoiceNo: inv.invoiceNo,
      customerName: inv.customerName,
      itemsSummary,
      itemsCount: inv.itemsCount,
      totalAmountFormatted: formatMoney(total),
      paidAmountFormatted: formatMoney(paid),
      remainingAmountFormatted: formatMoney(remaining),
    });

    openWhatsAppShare(inv.customerPhone, msg);
    toast.success(getTranslation(lang, 'whatsapp.openedToast'));
  };

  const [activeShift, setActiveShift] = useState<ActiveShift | null>(() => getStoredActiveShift());
  const [showNoShiftModal, setShowNoShiftModal] = useState(false);

  useEffect(() => {
    const syncShift = () => setActiveShift(getStoredActiveShift());
    window.addEventListener('erp_active_shift_updated', syncShift);
    window.addEventListener('storage', syncShift);
    return () => {
      window.removeEventListener('erp_active_shift_updated', syncShift);
      window.removeEventListener('storage', syncShift);
    };
  }, []);

  const isShiftActive = Boolean(activeShift && activeShift.status === 'ACTIVE');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'CREDIT'>('ALL');

  // KPI Calculations
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const paidCount = invoices.filter(inv => inv.status === 'paid').length;
  const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0);
  const pendingCount = invoices.filter(inv => inv.status === 'pending').length;
  const creditCount = invoices.filter(inv => inv.status === 'credit').length;
  const outstandingAmount = invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0);

  const filtered = invoices.filter(inv => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      !term ||
      inv.invoiceNo.toLowerCase().includes(term) ||
      inv.customerName.toLowerCase().includes(term) ||
      (inv.customerPhone && inv.customerPhone.includes(term)) ||
      (inv.warehouseName && inv.warehouseName.toLowerCase().includes(term));

    let matchesStatus = true;
    if (statusFilter === 'PAID') {
      matchesStatus = inv.status === 'paid';
    } else if (statusFilter === 'PENDING') {
      matchesStatus = inv.status === 'pending';
    } else if (statusFilter === 'CREDIT') {
      matchesStatus = inv.status === 'credit';
    }

    return matchesSearch && matchesStatus;
  });

  const handleCreateClick = () => {
    const liveShift = getStoredActiveShift();
    setActiveShift(liveShift);
    if (!liveShift || liveShift.status !== 'ACTIVE') {
      setShowNoShiftModal(true);
      return;
    }

    if (onNavigateToCreate) {
      onNavigateToCreate();
    } else if (onOpenCreateModal) {
      onOpenCreateModal();
    }
  };

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Header Bar */}
      <div className="view-header-bar flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="view-title text-xl font-bold m-0 leading-tight">
                {isAr ? 'فواتير المبيعات' : 'Sales Invoices'}
              </h2>
              {isShiftActive && activeShift ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Unlock size={11} />
                  <span>{gt('activeShiftLinkedBadge').replace('{shiftId}', activeShift.id)}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                  <Lock size={11} />
                  <span>{gt('noActiveShiftBadge')}</span>
                </span>
              )}
            </div>
            <p className="view-subtitle text-xs text-muted-foreground m-0 mt-0.5">
              {isAr ? 'سجل العمليات المفوترة، التحصيل النقدي، وإدارة الذمم المدينة' : 'Issued invoices register, cash receipts, and customer receivables'}
            </p>
          </div>
        </div>

        <div className="view-header-actions">
          {hasPermission('sales.invoices.create') && (
            <Button
              type="button"
              onClick={handleCreateClick}
              className="h-10 px-4 text-sm font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 flex items-center gap-2"
            >
              <Plus size={16} />
              <span>{isAr ? 'إنشاء فاتورة جديدة' : 'New Invoice'}</span>
            </Button>
          )}
        </div>

      </div>

      {/* Top KPI Metrics Row */}
      <div className="inventory-kpi-row grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="inv-kpi-card bg-card border border-border p-4 rounded-xl shadow-xs">
          <div className="inv-kpi-data">
            <span className="inv-kpi-label text-xs font-semibold text-muted-foreground">{isAr ? 'إجمالي المبيعات المفوترة' : 'Total Revenue'}</span>
            <div className="inv-kpi-val-row mt-1">
              <span className="inv-kpi-val text-xl font-extrabold text-foreground font-mono">
                {formatMoney(totalRevenue)}
              </span>
            </div>
            <span className="inv-kpi-sub text-xs text-muted-foreground">{isAr ? 'إجمالي المبيعات الصادرة' : 'Gross revenue'}</span>
          </div>
        </div>

        <div 
          className="inv-kpi-card bg-card border border-border p-4 rounded-xl shadow-xs cursor-pointer hover:border-primary/50 transition-colors" 
          onClick={() => setStatusFilter(statusFilter === 'PAID' ? 'ALL' : 'PAID')}
        >
          <div className="inv-kpi-data">
            <span className="inv-kpi-label text-xs font-semibold text-muted-foreground">{isAr ? 'فواتير مسددة بالكامل' : 'Paid Invoices'}</span>
            <div className="inv-kpi-val-row mt-1 flex items-baseline gap-1.5">
              <span className="inv-kpi-val text-xl font-extrabold text-emerald-600 font-mono">{paidCount}</span>
              <span className="text-xs text-muted-foreground font-medium">{isAr ? 'فاتورة' : 'invoices'}</span>
            </div>
            <span className="inv-kpi-sub text-xs text-muted-foreground">
              ({formatMoney(paidAmount)} {isAr ? 'متحصلات' : 'collected'})
            </span>
          </div>
        </div>

        <div 
          className="inv-kpi-card bg-card border border-border p-4 rounded-xl shadow-xs cursor-pointer hover:border-primary/50 transition-colors" 
          onClick={() => setStatusFilter(statusFilter === 'CREDIT' ? 'ALL' : 'CREDIT')}
        >
          <div className="inv-kpi-data">
            <span className="inv-kpi-label text-xs font-semibold text-muted-foreground">{isAr ? 'فواتير آجلة وذمم' : 'Pending Receivables'}</span>
            <div className="inv-kpi-val-row mt-1 flex items-baseline gap-1.5">
              <span className="inv-kpi-val text-xl font-extrabold text-amber-500 font-mono">{pendingCount + creditCount}</span>
              <span className="text-xs text-muted-foreground font-medium">{isAr ? 'فاتورة' : 'invoices'}</span>
            </div>
            <span className="inv-kpi-sub text-xs text-muted-foreground">
              ({formatMoney(outstandingAmount)} {isAr ? 'مستحقات معلقة' : 'due'})
            </span>
          </div>
        </div>

        <div className="inv-kpi-card bg-card border border-border p-4 rounded-xl shadow-xs">
          <div className="inv-kpi-data">
            <span className="inv-kpi-label text-xs font-semibold text-muted-foreground">{isAr ? 'عدد العمليات الصادرة' : 'Issued Invoices'}</span>
            <div className="inv-kpi-val-row mt-1 flex items-baseline gap-1.5">
              <span className="inv-kpi-val text-xl font-extrabold text-foreground font-mono">{invoices.length}</span>
              <span className="text-xs text-muted-foreground font-medium">{isAr ? 'عملية' : 'total'}</span>
            </div>
            <span className="inv-kpi-sub text-xs text-muted-foreground">{isAr ? 'سجل العمليات المعتمد' : 'approved operations'}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Panel */}
      <div className="inventory-filter-panel mb-4 p-3 bg-card border border-border rounded-xl">
        <div className="inventory-search-row flex flex-wrap items-center justify-between gap-3">
          <div className="inventory-search-input-box relative flex-1 min-w-[280px]">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input 
              type="text" 
              className="h-10 w-full rounded-lg border border-border/80 bg-background ps-9 pe-8 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
              placeholder={isAr ? 'ابحث برقم الفاتورة، اسم العميل، الهاتف، أو المستودع...' : 'Search by invoice number, customer name, phone, or warehouse...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                type="button" 
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1" 
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="inventory-status-tabs flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/60">
            <button 
              type="button" 
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setStatusFilter('ALL')}
            >
              <span>{isAr ? 'الكل' : 'All'}</span>
              <span className="ms-1.5 text-[11px] opacity-75">({invoices.length})</span>
            </button>
            <button 
              type="button" 
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === 'PAID' ? 'bg-card text-emerald-600 shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setStatusFilter('PAID')}
            >
              <span>{isAr ? 'مسددة' : 'Paid'}</span>
              <span className="ms-1.5 text-[11px] opacity-75">({paidCount})</span>
            </button>
            <button 
              type="button" 
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === 'PENDING' ? 'bg-card text-amber-600 shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setStatusFilter('PENDING')}
            >
              <span>{isAr ? 'معلقة' : 'Pending'}</span>
              <span className="ms-1.5 text-[11px] opacity-75">({pendingCount})</span>
            </button>
            <button 
              type="button" 
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === 'CREDIT' ? 'bg-card text-amber-600 shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setStatusFilter('CREDIT')}
            >
              <span>{isAr ? 'آجل / ذمم' : 'Credit'}</span>
              <span className="ms-1.5 text-[11px] opacity-75">({creditCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Invoices Master Table */}
      <div className="inventory-table-card bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
        <div className="table-responsive-wrapper overflow-x-auto">
          <table className="inventory-master-table w-full text-sm text-start">
            <thead>
              <tr className="bg-muted/90 backdrop-blur-md border-b border-border text-xs uppercase font-bold text-muted-foreground sticky top-0 z-10">
                <th className="py-3 px-3.5">{isAr ? 'رقم الفاتورة' : 'Invoice No'}</th>
                <th className="py-3 px-3.5">{isAr ? 'تاريخ الإصدار' : 'Date'}</th>
                <th className="py-3 px-3.5">{isAr ? 'العميل / المشتري' : 'Customer'}</th>
                <th className="py-3 px-3.5">{isAr ? 'مستودع التجهيز' : 'Warehouse'}</th>
                <th className="py-3 px-3.5">{isAr ? 'طريقة السداد' : 'Payment'}</th>
                <th className="py-3 px-3.5 text-center">{isAr ? 'الأصناف' : 'Items'}</th>
                <th className="py-3 px-3.5">{isAr ? 'المبلغ الإجمالي' : 'Total Amount'}</th>
                <th className="py-3 px-3.5">{isAr ? 'حالة الفاتورة' : 'Status'}</th>
                <th className="py-3 px-3.5 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <FileText size={36} className="mx-auto mb-2 opacity-40 text-muted-foreground" />
                    <h4 className="text-sm font-semibold text-foreground m-0">{isAr ? 'لا توجد فواتير تطابق معايير البحث' : 'No invoices match current search'}</h4>
                    <p className="text-xs text-muted-foreground m-0 mt-1">{isAr ? 'يمكنك إنشاء فاتورة جديدة بالضغط على زر "إنشاء فاتورة جديدة"' : 'Create a new invoice by clicking "New Invoice"'}</p>
                  </td>
                </tr>
              ) : (
                filtered.map(inv => {
                  const isPaid = inv.status === 'paid';
                  const isCredit = inv.status === 'credit';
                  return (
                    <tr 
                      key={inv.id} 
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => onOpenInvoiceDetails(inv)}
                      title={isAr ? 'انقر لعرض وطباعة الفاتورة' : 'Click to view invoice details'}
                    >
                      {/* Invoice No */}
                      <td className="py-3 px-3.5">
                        <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md border border-border bg-muted text-primary tabular-nums" dir="ltr">
                          {inv.invoiceNo}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3.5 text-xs text-muted-foreground font-mono font-medium tabular-nums" dir="ltr">
                        {inv.date}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3.5">
                        <strong className="block text-sm font-semibold text-foreground" dir="auto">{inv.customerName}</strong>
                        {inv.customerPhone && <span className="text-xs text-muted-foreground font-mono tabular-nums" dir="ltr">{inv.customerPhone}</span>}
                      </td>

                      {/* Warehouse */}
                      <td className="py-3 px-3.5 text-xs text-muted-foreground font-medium" dir="auto">
                        {localizeWarehouse(inv.warehouseName, lang)}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3.5">
                        <span className="text-xs px-2.5 py-1 rounded-md bg-muted text-foreground border border-border font-medium">
                          {isAr 
                            ? (inv.paymentMethod === 'cash' ? 'نقداً' : inv.paymentMethod === 'card' ? 'بطاقة مصرفية' : 'آجل')
                            : (inv.paymentMethod === 'cash' ? 'Cash' : inv.paymentMethod === 'card' ? 'Card' : 'Credit')}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="py-3 px-3.5 text-center font-bold text-xs text-foreground font-mono tabular-nums" dir="ltr">
                        {inv.itemsCount}
                      </td>

                      {/* Total */}
                      <td className="py-3 px-3.5 font-mono font-bold text-sm text-foreground tabular-nums" dir="ltr">
                        {formatMoney(Number(inv.total || 0))}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isPaid 
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' 
                            : isCredit 
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30' 
                            : 'bg-destructive/15 text-destructive border border-destructive/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span>
                            {isAr 
                              ? (isPaid ? 'مسددة بالكامل' : isCredit ? 'آجل / ذمة' : 'بانتظار السداد')
                              : inv.status.toUpperCase()}
                          </span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <Button 
                            type="button" 
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenInvoiceDetails(inv);
                            }}
                          >
                            <Eye size={13} />
                            <span>{isAr ? 'عرض' : 'View'}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                            onClick={(e) => handleShareInvoiceWhatsApp(inv, e)}
                            title={getTranslation(lang, 'whatsapp.sendBtn')}
                          >
                            <MessageCircle size={13} />
                            <span>{getTranslation(lang, 'whatsapp.sendBtn')}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blocking Modal when user tries to create a Sales Invoice without an Active Shift */}
      {showNoShiftModal && (
        <DialogPortal>
          <DialogOverlay onClick={() => setShowNoShiftModal(false)} />
          <DialogContent
            className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl p-6 text-foreground"
            style={{ maxWidth: '460px', width: '92%' }}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-foreground m-0">
                  {gt('noActiveShiftTitle')}
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed m-0">
                  {gt('noActiveShiftMessage')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-5 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNoShiftModal(false)}
                className="h-9 px-4 text-xs font-semibold rounded-lg"
              >
                {gt('dismissBtn')}
              </Button>
              {onNavigateToShifts && (
                <Button
                  type="button"
                  onClick={() => {
                    setShowNoShiftModal(false);
                    onNavigateToShifts();
                  }}
                  className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg flex items-center gap-1.5"
                >
                  <Unlock size={14} />
                  <span>{gt('openShiftActionBtn')}</span>
                </Button>
              )}
            </div>
          </DialogContent>
        </DialogPortal>
      )}
    </div>
  );
}
