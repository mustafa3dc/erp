import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ArrowLeft,
  Send, 
  Check, 
  AlertCircle, 
  X, 
  Eye, 
  Trash2,
  TrendingUp,
  Percent,
  Warehouse as WarehouseIcon,
  ShoppingBag
} from 'lucide-react';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';
import { apiClient } from '../../lib/api-client';
import { 
  getStoredSalesQuotations, 
  saveStoredSalesQuotations,
  getStoredProducts,
  getStoredWarehouses,
  getStoredInvoices,
  saveStoredInvoices
} from '../../services/storageService';
import { 
  SalesQuotation, 
  SalesQuotationItem, 
  QuotationStatus 
} from '../../types/businessModules';
import { Product, Warehouse, SalesInvoice } from '../../types/warehouse';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';

interface QuotationsViewProps {
  lang: 'en' | 'ar';
  onNavigateToInvoices?: () => void;
}

export default function QuotationsView({ lang, onNavigateToInvoices }: QuotationsViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const getProdName = (p?: Product) => p ? ((isAr ? p.nameAr : p.nameEn) || p.nameAr || p.nameEn) : '';
  const getWhName = (w?: Warehouse) => w ? ((isAr ? w.nameAr : w.nameEn) || w.nameAr || w.nameEn) : '';

  const [quotations, setQuotations] = useState<SalesQuotation[]>(() => getStoredSalesQuotations());
  const [products] = useState<Product[]>(() => getStoredProducts());
  const [warehouses] = useState<Warehouse[]>(() => getStoredWarehouses());

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | QuotationStatus>('ALL');

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<SalesQuotation | null>(null);
  const [quoteToConvert, setQuoteToConvert] = useState<SalesQuotation | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [validUntilDays, setValidUntilDays] = useState(14);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState<Array<{
    productId: string;
    productName: string;
    productSku: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxPercent: number;
  }>>([]);

  // Fetch real data from API with fallback
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get('/api/quotations');
        if (res && res.success && Array.isArray(res.data)) {
          setQuotations(res.data);
          saveStoredSalesQuotations(res.data);
        }
      } catch {
        // fallback to localStorage
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (isCreateModalOpen) {
      if (warehouses.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(warehouses[0].id);
      }
      if (items.length === 0 && products.length > 0) {
        // pre-populate one initial line item
        const p = products[0];
        setItems([{
          productId: p.id,
          productName: getProdName(p),
          productSku: p.sku,
          unit: p.unit || 'pcs',
          quantity: 1,
          unitPrice: p.sellingPrice || 0,
          discountPercent: 0,
          taxPercent: 0
        }]);
      }
    }
  }, [isCreateModalOpen, warehouses, products, selectedWarehouseId, items.length]);

  // KPIs
  const totalQuotationsCount = quotations.length;
  const acceptedQuotations = quotations.filter(q => q.status === 'Accepted' || q.status === 'Converted');
  const acceptedTotal = acceptedQuotations.reduce((sum, q) => sum + (q.total || 0), 0);
  const pendingQuotations = quotations.filter(q => q.status === 'Draft' || q.status === 'Sent');
  const pendingTotal = pendingQuotations.reduce((sum, q) => sum + (q.total || 0), 0);
  const conversionRate = totalQuotationsCount > 0 
    ? Math.round((quotations.filter(q => q.status === 'Converted').length / totalQuotationsCount) * 100) 
    : 0;

  // Filtered quotes
  const filteredQuotes = quotations.filter(q => {
    const term = searchQuery.toLowerCase().trim();
    const matchesSearch = !term ||
      q.quotationNo.toLowerCase().includes(term) ||
      q.customerName.toLowerCase().includes(term) ||
      (q.customerPhone && q.customerPhone.includes(term));

    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
      matchesStatus = q.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  // Calculate form totals
  const formSubtotal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
  const formDiscount = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice * (i.discountPercent / 100)), 0);
  const formTax = items.reduce((sum, i) => {
    const afterDisc = (i.quantity * i.unitPrice) - (i.quantity * i.unitPrice * (i.discountPercent / 100));
    return sum + (afterDisc * (i.taxPercent / 100));
  }, 0);
  const formTotal = formSubtotal - formDiscount + formTax;

  // Add Item to Form
  const handleAddItem = () => {
    if (products.length === 0) return;
    const p = products[0];
    setItems([
      ...items,
      {
        productId: p.id,
        productName: getProdName(p),
        productSku: p.sku,
        unit: p.unit || 'pcs',
        quantity: 1,
        unitPrice: p.sellingPrice || 0,
        discountPercent: 0,
        taxPercent: 0
      }
    ]);
  };

  const handleItemProductChange = (index: number, prodId: string) => {
    const p = products.find(x => x.id === prodId);
    if (!p) return;
    const next = [...items];
    next[index] = {
      ...next[index],
      productId: p.id,
      productName: getProdName(p),
      productSku: p.sku,
      unit: p.unit || 'pcs',
      unitPrice: p.sellingPrice || 0
    };
    setItems(next);
  };

  const handleItemFieldChange = (index: number, field: string, value: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Create Quotation
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || items.length === 0 || !selectedWarehouseId) return;

    const w = warehouses.find(x => x.id === selectedWarehouseId);
    const issueDate = new Date();
    const expiry = new Date();
    expiry.setDate(issueDate.getDate() + validUntilDays);

    const quoteItems: SalesQuotationItem[] = items.map((i, idx) => {
      const lineSubtotal = i.quantity * i.unitPrice;
      const lineDisc = lineSubtotal * (i.discountPercent / 100);
      const lineTax = (lineSubtotal - lineDisc) * (i.taxPercent / 100);
      return {
        id: `QI-${Date.now()}-${idx}`,
        quotationId: '',
        productId: i.productId,
        productName: i.productName,
        productSku: i.productSku,
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountPercent: i.discountPercent,
        discountAmount: lineDisc,
        taxPercent: i.taxPercent,
        taxAmount: lineTax,
        total: lineSubtotal - lineDisc + lineTax
      };
    });

    const payload = {
      customerId: undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      warehouseId: selectedWarehouseId,
      validUntil: expiry.toISOString(),
      notes: notes.trim() || undefined,
      terms: terms.trim() || undefined,
      items: quoteItems.map(qi => ({
        productId: qi.productId,
        quantity: qi.quantity,
        unitPrice: qi.unitPrice,
        discountPercent: qi.discountPercent,
        taxPercent: qi.taxPercent
      }))
    };

    let newQuote: SalesQuotation = {
      id: `QUO-${Date.now()}`,
      tenantId: 'default',
      quotationNo: `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      warehouseId: selectedWarehouseId,
      warehouseName: getWhName(w) || selectedWarehouseId,
      date: issueDate.toISOString(),
      validUntil: expiry.toISOString(),
      subtotal: formSubtotal,
      discountTotal: formDiscount,
      taxTotal: formTax,
      total: formTotal,
      currency: 'USD',
      exchangeRate: 1,
      notes: notes.trim() || undefined,
      terms: terms.trim() || undefined,
      status: 'Draft',
      createdAt: issueDate.toISOString(),
      items: quoteItems
    };

    try {
      const res = await apiClient.post('/api/quotations', payload);
      if (res && res.success && res.data) {
        newQuote = {
          ...newQuote,
          id: res.data.id || newQuote.id,
          quotationNo: res.data.quotationNo || newQuote.quotationNo
        };
      }
    } catch {
      // local fallback
    }

    const next = [newQuote, ...quotations];
    setQuotations(next);
    saveStoredSalesQuotations(next);

    setIsCreateModalOpen(false);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setTerms('');
    showToast(getTranslation(lang, 'quotations.createSuccess'));
  };

  // Update Status
  const handleUpdateStatus = async (q: SalesQuotation, nextStatus: QuotationStatus) => {
    try {
      await apiClient.put(`/api/quotations/${q.id}/status`, { status: nextStatus });
    } catch {
      // local fallback
    }

    const next = quotations.map(item => {
      if (item.id === q.id) {
        return { ...item, status: nextStatus };
      }
      return item;
    });

    setQuotations(next);
    saveStoredSalesQuotations(next);
    showToast(getTranslation(lang, 'quotations.statusUpdated'));
  };

  // Convert to Sales Invoice
  const handleConfirmConvert = async () => {
    if (!quoteToConvert) return;

    let invoiceId = `INV-${Date.now()}`;
    let invoiceNo = `SI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const res = await apiClient.post(`/api/quotations/${quoteToConvert.id}/convert-to-invoice`, {});
      if (res && res.success && res.data) {
        invoiceId = res.data.invoiceId || invoiceId;
        invoiceNo = res.data.invoiceNumber || invoiceNo;
      }
    } catch {
      // local fallback
    }

    // Save corresponding Sales Invoice locally so it appears in Invoices
    const existingInvoices = getStoredInvoices();
    const newInvoice: SalesInvoice = {
      id: invoiceId,
      invoiceNo: invoiceNo,
      date: new Date().toISOString(),
      customerName: quoteToConvert.customerName,
      customerPhone: quoteToConvert.customerPhone || '',
      warehouseName: quoteToConvert.warehouseName || '',
      items: quoteToConvert.items.map((it, idx) => ({
        id: `ILI-${invoiceId}-${idx}`,
        productId: it.productId,
        sku: it.productSku,
        nameAr: it.productName,
        nameEn: it.productName,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unit: it.unit || 'pcs',
        total: it.total
      })),
      itemsCount: quoteToConvert.items.length,
      subtotal: quoteToConvert.subtotal,
      discount: quoteToConvert.discountTotal,
      tax: quoteToConvert.taxTotal,
      total: quoteToConvert.total,
      paymentMethod: 'cash',
      status: 'pending',
      notes: `Converted from Quotation #${quoteToConvert.quotationNo}`
    };

    saveStoredInvoices([newInvoice, ...existingInvoices]);

    // Update Quotation state to Converted
    const updatedQuotes = quotations.map(q => {
      if (q.id === quoteToConvert.id) {
        return {
          ...q,
          status: 'Converted' as QuotationStatus,
          convertedInvoiceId: invoiceId,
          convertedInvoiceNo: invoiceNo,
          convertedAt: new Date().toISOString()
        };
      }
      return q;
    });

    setQuotations(updatedQuotes);
    saveStoredSalesQuotations(updatedQuotes);
    setQuoteToConvert(null);
    showToast(getTranslation(lang, 'quotations.convertSuccess'));
  };

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {toastMsg && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: isAr ? 'auto' : '24px', right: isAr ? '24px' : 'auto', zIndex: 9999 }}>
          <CheckCircle2 size={16} className="green-text" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <FileText size={16} style={{ color: 'var(--primary)' }} />
            <span>{getTranslation(lang, 'quotations.subtitle')}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          <button 
            type="button" 
            className="btn-clean-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={15} />
            <span>{getTranslation(lang, 'quotations.newQuotation')}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'quotations.accepted')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#16a34a' }}>
              {formatMoney(acceptedTotal)}
            </div>
          </div>
          <div className="module-kpi-icon emerald">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'quotations.draft')} / {getTranslation(lang, 'quotations.sent')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#3b82f6' }}>
              {formatMoney(pendingTotal)}
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <Clock size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'quotations.converted')}</span>
            <div className="module-kpi-value">
              {conversionRate}% <span className="kpi-sub-unit">({quotations.filter(q => q.status === 'Converted').length})</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'quotations.title')}</span>
            <div className="module-kpi-value">
              {totalQuotationsCount} <span className="kpi-sub-unit">{getTranslation(lang, 'quotations.quotationNumber')}</span>
            </div>
          </div>
          <div className="module-kpi-icon purple">
            <FileText size={20} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="module-toolbar">
        <div className="module-search-box">
          <Search size={16} />
          <input 
            type="text" 
            placeholder={getTranslation(lang, 'quotations.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="module-filter-pills">
          {[
            { id: 'ALL', label: getTranslation(lang, 'quotations.filterAll') },
            { id: 'Draft', label: getTranslation(lang, 'quotations.draft') },
            { id: 'Sent', label: getTranslation(lang, 'quotations.sent') },
            { id: 'Accepted', label: getTranslation(lang, 'quotations.accepted') },
            { id: 'Converted', label: getTranslation(lang, 'quotations.converted') },
            { id: 'Expired', label: getTranslation(lang, 'quotations.expired') }
          ].map(pill => (
            <button
              key={pill.id}
              type="button"
              className={`module-filter-pill ${statusFilter === pill.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(pill.id as any)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations Table */}
      <div className="panel-clean">
        <div className="table-responsive">
          <table className="table-clean">
            <thead>
              <tr>
                <th>{getTranslation(lang, 'quotations.quotationNumber')}</th>
                <th>{getTranslation(lang, 'quotations.customer')}</th>
                <th>{getTranslation(lang, 'quotations.warehouse')}</th>
                <th>{getTranslation(lang, 'quotations.quotationDate')}</th>
                <th>{getTranslation(lang, 'quotations.expiryDate')}</th>
                <th>{getTranslation(lang, 'quotations.total')}</th>
                <th>{getTranslation(lang, 'quotations.status')}</th>
                <th style={{ textAlign: 'center' }}>{getTranslation(lang, 'expenses.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      lang={lang}
                      icon={<FileText size={22} />}
                      title={getTranslation(lang, 'quotations.noQuotesFound')}
                    />
                  </td>
                </tr>
              ) : (
                filteredQuotes.map(q => {
                  const isExpired = new Date(q.validUntil) < new Date() && q.status !== 'Converted';
                  return (
                    <tr key={q.id}>
                      <td className="font-mono font-bold text-primary" dir="ltr">
                        {q.quotationNo}
                      </td>
                      <td>
                        <span className="font-semibold text-foreground" dir="auto">{q.customerName}</span>
                        {q.customerPhone && (
                          <span className="block text-[11px] font-mono text-muted-foreground tabular-nums" dir="ltr">{q.customerPhone}</span>
                        )}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <WarehouseIcon size={12} />
                          <span dir="auto">{q.warehouseName || getWhName(warehouses.find(w => w.id === q.warehouseId)) || q.warehouseId}</span>
                        </span>
                      </td>
                      <td className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                        {(q.date || '').slice(0, 10)}
                      </td>
                      <td>
                        <span
                          className={`text-xs tabular-nums ${isExpired ? 'text-destructive font-bold' : 'text-muted-foreground font-medium'}`}
                          dir="ltr"
                        >
                          {(q.validUntil || '').slice(0, 10)}
                        </span>
                      </td>
                      <td className="font-bold text-foreground font-mono tabular-nums" dir="ltr">
                        {formatMoney(q.total)}
                      </td>
                      <td>
                        <StatusBadge
                          tone={
                            q.status === 'Converted'
                              ? 'indigo'
                              : q.status === 'Accepted'
                                ? 'emerald'
                                : q.status === 'Sent'
                                  ? 'purple'
                                  : q.status === 'Expired' || isExpired
                                    ? 'rose'
                                    : 'amber'
                          }
                          dot
                          label={
                            q.status === 'Converted'
                              ? getTranslation(lang, 'quotations.converted')
                              : q.status === 'Accepted'
                                ? getTranslation(lang, 'quotations.accepted')
                                : q.status === 'Sent'
                                  ? getTranslation(lang, 'quotations.sent')
                                  : q.status === 'Expired' || isExpired
                                    ? getTranslation(lang, 'quotations.expired')
                                    : getTranslation(lang, 'quotations.draft')
                          }
                        />
                      </td>
                      <td className="text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            className="btn-clean-secondary py-1 px-2 text-xs"
                            onClick={() => setSelectedQuote(q)}
                            title={getTranslation(lang, 'quotations.viewDetails')}
                          >
                            <Eye size={13} />
                          </button>

                          {q.status === 'Draft' && (
                            <button
                              type="button"
                              className="btn-clean-secondary py-1 px-2 text-xs text-purple-600 dark:text-purple-400"
                              onClick={() => handleUpdateStatus(q, 'Sent')}
                              title={getTranslation(lang, 'quotations.markSent')}
                            >
                              <Send size={13} />
                            </button>
                          )}

                          {q.status === 'Sent' && (
                            <button
                              type="button"
                              className="btn-clean-secondary py-1 px-2 text-xs text-emerald-600 dark:text-emerald-400"
                              onClick={() => handleUpdateStatus(q, 'Accepted')}
                              title={getTranslation(lang, 'quotations.markAccepted')}
                            >
                              <Check size={13} />
                            </button>
                          )}

                          {q.status === 'Accepted' && (
                            <button
                              type="button"
                              className="btn-clean-primary py-1 px-2.5 text-[11px]"
                              onClick={() => setQuoteToConvert(q)}
                              title={getTranslation(lang, 'quotations.convertToInvoice')}
                            >
                              {isAr ? <ArrowLeft size={12} /> : <ArrowRight size={12} />}
                              <span>{getTranslation(lang, 'quotations.convertToInvoice')}</span>
                            </button>
                          )}

                          {q.status === 'Converted' && q.convertedInvoiceNo && (
                            <span
                              className={`text-[11px] font-mono text-primary font-bold ${onNavigateToInvoices ? 'cursor-pointer underline' : ''}`}
                              dir="ltr"
                              onClick={() => onNavigateToInvoices && onNavigateToInvoices()}
                            >
                              {q.convertedInvoiceNo}
                            </span>
                          )}
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

      {/* Modal: Create Quotation */}
      {isCreateModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '820px', width: '95%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{getTranslation(lang, 'quotations.newQuotation')}</h3>
              </div>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'quotations.customer')} *
                  </label>
                  <input 
                    type="text" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
                    placeholder={getTranslation(lang, 'quotations.customerPlaceholder')}
                    required
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'quotations.customerPhone')}
                  </label>
                  <input 
                    type="text" 
                    value={customerPhone} 
                    onChange={e => setCustomerPhone(e.target.value)} 
                    placeholder="0770..."
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'quotations.warehouse')} *
                  </label>
                  <select 
                    className="select-clean"
                    value={selectedWarehouseId}
                    onChange={e => setSelectedWarehouseId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{getWhName(w)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-border rounded-xl p-3.5 bg-muted/40">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-xs font-bold text-foreground">
                    {getTranslation(lang, 'priceLists.components')} ({items.length})
                  </span>
                  <button 
                    type="button" 
                    className="btn-clean-secondary"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={handleAddItem}
                  >
                    <Plus size={13} />
                    <span>{getTranslation(lang, 'quotations.addItem')}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.map((it, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                      <select 
                        className="select-clean"
                        value={it.productId}
                        onChange={e => handleItemProductChange(idx, e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px' }}
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{getProdName(p)} ({p.sku})</option>
                        ))}
                      </select>

                      <input 
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={e => handleItemFieldChange(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                        placeholder="Qty"
                        className="input-clean"
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '6px', textAlign: 'center' }}
                      />

                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.unitPrice}
                        onChange={e => handleItemFieldChange(idx, 'unitPrice', Number(e.target.value))}
                        placeholder="Price"
                        className="input-clean"
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '6px', textAlign: 'center' }}
                      />

                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={it.discountPercent}
                        onChange={e => handleItemFieldChange(idx, 'discountPercent', Number(e.target.value))}
                        placeholder="Disc %"
                        className="input-clean"
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '6px', textAlign: 'center' }}
                      />

                      <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', textAlign: 'center' }}>
                        {formatMoney((it.quantity * it.unitPrice) * (1 - it.discountPercent / 100))}
                      </span>

                      <button 
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        style={{ background: 'none', border: 'none', cursor: items.length <= 1 ? 'not-allowed' : 'pointer', color: '#dc2626', padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Form Totals */}
                <div className="flex justify-end gap-5 mt-3.5 pt-2.5 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    {getTranslation(lang, 'quotations.subtotal')}: <strong className="text-foreground tabular-nums" dir="ltr">{formatMoney(formSubtotal)}</strong>
                  </div>
                  {formDiscount > 0 && (
                    <div className="text-xs text-destructive">
                      {getTranslation(lang, 'quotations.discount')}: <strong className="tabular-nums" dir="ltr">-{formatMoney(formDiscount)}</strong>
                    </div>
                  )}
                  <div className="text-sm font-bold text-primary tabular-nums" dir="ltr">
                    {getTranslation(lang, 'quotations.total')}: {formatMoney(formTotal)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-muted-foreground">
                    {getTranslation(lang, 'quotations.termsPlaceholder')}
                  </label>
                  <textarea
                    rows={2}
                    value={terms}
                    onChange={e => setTerms(e.target.value)}
                    className="input-clean w-full px-3 py-2 rounded-lg resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-muted-foreground">
                    {getTranslation(lang, 'quotations.notesPlaceholder')}
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="input-clean w-full px-3 py-2 rounded-lg resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-2.5">
                <button
                  type="button"
                  className="btn-clean-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  {getTranslation(lang, 'quotations.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn-clean-primary"
                >
                  {getTranslation(lang, 'quotations.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Quotation Details */}
      {selectedQuote && (
        <div className="modal-backdrop" onClick={() => setSelectedQuote(null)}>
          <div
            className="modal-content glass-panel max-w-2xl w-[92%] rounded-2xl p-6"
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <FileText size={19} />
                </div>
                <div>
                  <h3 className="m-0 text-base font-bold text-foreground font-mono" dir="ltr">{selectedQuote.quotationNo}</h3>
                  <span className="text-xs text-muted-foreground" dir="auto">{selectedQuote.customerName}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedQuote(null)} className="text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 bg-muted/50 border border-border/70 p-3 rounded-xl mb-4">
              <div>
                <span className="block text-[11px] text-muted-foreground">{getTranslation(lang, 'quotations.quotationDate')}</span>
                <span className="text-xs font-semibold text-foreground tabular-nums" dir="ltr">{(selectedQuote.date || '').slice(0, 10)}</span>
              </div>
              <div>
                <span className="block text-[11px] text-muted-foreground">{getTranslation(lang, 'quotations.expiryDate')}</span>
                <span className="text-xs font-semibold text-foreground tabular-nums" dir="ltr">{(selectedQuote.validUntil || '').slice(0, 10)}</span>
              </div>
              <div>
                <span className="block text-[11px] text-muted-foreground">{getTranslation(lang, 'quotations.warehouse')}</span>
                <span className="text-xs font-semibold text-foreground" dir="auto">{selectedQuote.warehouseName || selectedQuote.warehouseId}</span>
              </div>
              <div>
                <span className="block text-[11px] text-muted-foreground">{getTranslation(lang, 'quotations.status')}</span>
                <span className="text-xs font-bold text-primary">{selectedQuote.status}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="max-h-52 overflow-y-auto mb-4 border border-border rounded-xl">
              <table className="table-clean text-xs">
                <thead>
                  <tr>
                    <th>{getTranslation(lang, 'quotations.product')}</th>
                    <th>{getTranslation(lang, 'quotations.quantity')}</th>
                    <th>{getTranslation(lang, 'quotations.unitPrice')}</th>
                    <th>{getTranslation(lang, 'quotations.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedQuote.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td dir="auto">{it.productName} ({it.productSku})</td>
                      <td className="tabular-nums" dir="ltr">{it.quantity} {it.unit}</td>
                      <td className="font-mono tabular-nums" dir="ltr">{formatMoney(it.unitPrice)}</td>
                      <td className="font-bold font-mono tabular-nums" dir="ltr">{formatMoney(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center border-t border-border pt-3">
              <div>
                {selectedQuote.convertedInvoiceNo && (
                  <span className="text-xs text-primary font-semibold font-mono" dir="ltr">
                    {getTranslation(lang, 'quotations.converted')}: {selectedQuote.convertedInvoiceNo}
                  </span>
                )}
              </div>
              <div className="text-base font-extrabold text-foreground tabular-nums" dir="ltr">
                {getTranslation(lang, 'quotations.total')}: {formatMoney(selectedQuote.total)}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                className="btn-clean-secondary"
                onClick={() => setSelectedQuote(null)}
              >
                {getTranslation(lang, 'quotations.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Convert to Sales Invoice */}
      {quoteToConvert && (
        <div className="modal-backdrop" onClick={() => setQuoteToConvert(null)}>
          <div
            className="modal-content glass-panel max-w-md w-[92%] rounded-2xl p-6"
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {isAr ? <ArrowLeft size={22} /> : <ArrowRight size={22} />}
              </div>
              <div>
                <h3 className="m-0 text-base font-bold text-foreground">{getTranslation(lang, 'quotations.confirmConvert')}</h3>
                <span className="text-xs font-mono text-muted-foreground" dir="ltr">{quoteToConvert.quotationNo}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed m-0 mb-4">
              {getTranslation(lang, 'quotations.confirmConvertMsg')}
            </p>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{getTranslation(lang, 'quotations.customer')}:</span>
                <span className="font-bold text-foreground" dir="auto">{quoteToConvert.customerName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{getTranslation(lang, 'quotations.total')}:</span>
                <span className="text-sm font-bold text-primary font-mono tabular-nums" dir="ltr">
                  {formatMoney(quoteToConvert.total)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="btn-clean-secondary"
                onClick={() => setQuoteToConvert(null)}
              >
                {getTranslation(lang, 'quotations.cancel')}
              </button>
              <button
                type="button"
                className="btn-clean-primary"
                onClick={handleConfirmConvert}
              >
                {getTranslation(lang, 'quotations.convertToInvoice')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
