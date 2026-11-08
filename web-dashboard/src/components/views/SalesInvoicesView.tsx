import React, { useState } from 'react';
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
  Layers
} from 'lucide-react';
import { SalesInvoice, Product } from '../../types/warehouse';
import { Button } from '../ui/button';
import { usePermissions } from '../../hooks/usePermissions';
import { useSettings } from '../../context/settings-context';
import { localizeWarehouse } from '../../lib/localeHelpers';

export interface SalesInvoicesViewProps {
  invoices: SalesInvoice[];
  products: Product[];
  lang: 'en' | 'ar';
  onOpenCreateModal?: () => void;
  onNavigateToCreate?: () => void;
  onOpenInvoiceDetails: (invoice: SalesInvoice) => void;
}

export default function SalesInvoicesView({
  invoices,
  products,
  lang,
  onOpenCreateModal,
  onNavigateToCreate,
  onOpenInvoiceDetails
}: SalesInvoicesViewProps) {
  const isAr = lang === 'ar';
  const { hasPermission } = usePermissions();
  const { formatMoney } = useSettings();

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
            <h2 className="view-title text-xl font-bold m-0 leading-tight">
              {isAr ? 'فواتير المبيعات' : 'Sales Invoices'}
            </h2>
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
      <div className="inventory-table-card bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="table-responsive-wrapper overflow-x-auto">
          <table className="inventory-master-table w-full text-sm text-start">
            <thead>
              <tr className="bg-muted/80 border-b border-border text-xs uppercase font-bold text-slate-700 dark:text-slate-200">
                <th className="py-3 px-3">{isAr ? 'رقم الفاتورة' : 'Invoice No'}</th>
                <th className="py-3 px-3">{isAr ? 'تاريخ الإصدار' : 'Date'}</th>
                <th className="py-3 px-3">{isAr ? 'العميل / المشتري' : 'Customer'}</th>
                <th className="py-3 px-3">{isAr ? 'مستودع التجهيز' : 'Warehouse'}</th>
                <th className="py-3 px-3">{isAr ? 'طريقة السداد' : 'Payment'}</th>
                <th className="py-3 px-3 text-center">{isAr ? 'الأصناف' : 'Items'}</th>
                <th className="py-3 px-3">{isAr ? 'المبلغ الإجمالي' : 'Total Amount'}</th>
                <th className="py-3 px-3">{isAr ? 'حالة الفاتورة' : 'Status'}</th>
                <th className="py-3 px-3 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
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
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => onOpenInvoiceDetails(inv)}
                      title={isAr ? 'انقر لعرض وطباعة الفاتورة' : 'Click to view invoice details'}
                    >
                      {/* Invoice No */}
                      <td className="py-3 px-3">
                        <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded border border-border bg-slate-100 dark:bg-slate-800 text-primary dark:text-blue-400">
                          {inv.invoiceNo}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-200 font-mono font-medium">
                        {inv.date}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3">
                        <strong className="block text-sm font-semibold text-slate-900 dark:text-slate-100" dir="auto">{inv.customerName}</strong>
                        {inv.customerPhone && <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{inv.customerPhone}</span>}
                      </td>

                      {/* Warehouse */}
                      <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-200 font-medium" dir="auto">
                        {localizeWarehouse(inv.warehouseName, lang)}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3">
                        <span className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-border font-medium">
                          {isAr 
                            ? (inv.paymentMethod === 'cash' ? 'نقداً' : inv.paymentMethod === 'card' ? 'بطاقة مصرفية' : 'آجل')
                            : (inv.paymentMethod === 'cash' ? 'Cash' : inv.paymentMethod === 'card' ? 'Card' : 'Credit')}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="py-3 px-3 text-center font-bold text-xs text-slate-800 dark:text-slate-200">
                        {inv.itemsCount}
                      </td>

                      {/* Total */}
                      <td className="py-3 px-3 font-mono font-bold text-sm text-slate-900 dark:text-emerald-400">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
