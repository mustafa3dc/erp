import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    {getTranslation(lang, 'quotations.noQuotesFound')}
                  </td>
                </tr>
              ) : (
                filteredQuotes.map(q => {
                  const isExpired = new Date(q.validUntil) < new Date() && q.status !== 'Converted';
                  return (
                    <tr key={q.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                        {q.quotationNo}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{q.customerName}</span>
                        {q.customerPhone && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{q.customerPhone}</span>
                        )}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#475569' }}>
                          <WarehouseIcon size={12} />
                          <span>{q.warehouseName || getWhName(warehouses.find(w => w.id === q.warehouseId)) || q.warehouseId}</span>
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: '#64748b' }}>
                        {(q.date || '').slice(0, 10)}
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: isExpired ? '#ef4444' : '#64748b', fontWeight: isExpired ? 700 : 400 }}>
                          {(q.validUntil || '').slice(0, 10)}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        {formatMoney(q.total)}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: q.status === 'Converted' ? 'rgba(59, 130, 246, 0.12)' :
                                      q.status === 'Accepted' ? 'rgba(34, 197, 94, 0.12)' :
                                      q.status === 'Sent' ? 'rgba(168, 85, 247, 0.12)' :
                                      q.status === 'Expired' || isExpired ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: q.status === 'Converted' ? '#2563eb' :
                                 q.status === 'Accepted' ? '#16a34a' :
                                 q.status === 'Sent' ? '#9333ea' :
                                 q.status === 'Expired' || isExpired ? '#dc2626' : '#d97706',
                          border: `1px solid ${q.status === 'Converted' ? 'rgba(59, 130, 246, 0.3)' :
                                               q.status === 'Accepted' ? 'rgba(34, 197, 94, 0.3)' :
                                               q.status === 'Sent' ? 'rgba(168, 85, 247, 0.3)' :
                                               q.status === 'Expired' || isExpired ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                        }}>
                          {q.status === 'Converted' ? getTranslation(lang, 'quotations.converted') :
                           q.status === 'Accepted' ? getTranslation(lang, 'quotations.accepted') :
                           q.status === 'Sent' ? getTranslation(lang, 'quotations.sent') :
                           q.status === 'Expired' || isExpired ? getTranslation(lang, 'quotations.expired') :
                           getTranslation(lang, 'quotations.draft')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-clean-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => setSelectedQuote(q)}
                            title={getTranslation(lang, 'quotations.viewDetails')}
                          >
                            <Eye size={12} />
                          </button>

                          {q.status === 'Draft' && (
                            <button
                              type="button"
                              className="btn-clean-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px', color: '#9333ea' }}
                              onClick={() => handleUpdateStatus(q, 'Sent')}
                              title={getTranslation(lang, 'quotations.markSent')}
                            >
                              <Send size={12} />
                            </button>
                          )}

                          {q.status === 'Sent' && (
                            <button
                              type="button"
                              className="btn-clean-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px', color: '#16a34a' }}
                              onClick={() => handleUpdateStatus(q, 'Accepted')}
                              title={getTranslation(lang, 'quotations.markAccepted')}
                            >
                              <Check size={12} />
                            </button>
                          )}

                          {q.status === 'Accepted' && (
                            <button
                              type="button"
                              className="btn-clean-primary"
                              style={{ padding: '3px 8px', fontSize: '11px', background: '#2563eb', borderColor: '#2563eb' }}
                              onClick={() => setQuoteToConvert(q)}
                              title={getTranslation(lang, 'quotations.convertToInvoice')}
                            >
                              <ArrowRight size={12} />
                              <span>{getTranslation(lang, 'quotations.convertToInvoice')}</span>
                            </button>
                          )}

                          {q.status === 'Converted' && q.convertedInvoiceNo && (
                            <span 
                              style={{ 
                                fontSize: '11px', 
                                fontFamily: 'monospace', 
                                color: 'var(--primary)', 
                                fontWeight: 700, 
                                cursor: onNavigateToInvoices ? 'pointer' : 'default',
                                textDecoration: onNavigateToInvoices ? 'underline' : 'none'
                              }}
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
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', background: 'rgba(248, 250, 252, 0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
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
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {getTranslation(lang, 'quotations.subtotal')}: <strong style={{ color: '#0f172a' }}>{formatMoney(formSubtotal)}</strong>
                  </div>
                  {formDiscount > 0 && (
                    <div style={{ fontSize: '12px', color: '#ef4444' }}>
                      {getTranslation(lang, 'quotations.discount')}: <strong>-{formatMoney(formDiscount)}</strong>
                    </div>
                  )}
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>
                    {getTranslation(lang, 'quotations.total')}: {formatMoney(formTotal)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'quotations.termsPlaceholder')}
                  </label>
                  <textarea 
                    rows={2}
                    value={terms}
                    onChange={e => setTerms(e.target.value)}
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', resize: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'quotations.notesPlaceholder')}
                  </label>
                  <textarea 
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', resize: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
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
            className="modal-content glass-panel" 
            style={{ maxWidth: '640px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{selectedQuote.quotationNo}</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{selectedQuote.customerName}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedQuote(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{getTranslation(lang, 'quotations.quotationDate')}</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{(selectedQuote.date || '').slice(0, 10)}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{getTranslation(lang, 'quotations.expiryDate')}</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{(selectedQuote.validUntil || '').slice(0, 10)}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{getTranslation(lang, 'quotations.warehouse')}</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedQuote.warehouseName || selectedQuote.warehouseId}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{getTranslation(lang, 'quotations.status')}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>{selectedQuote.status}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
              <table className="table-clean" style={{ fontSize: '12px' }}>
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
                      <td>{it.productName} ({it.productSku})</td>
                      <td>{it.quantity} {it.unit}</td>
                      <td>{formatMoney(it.unitPrice)}</td>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatMoney(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <div>
                {selectedQuote.convertedInvoiceNo && (
                  <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>
                    {getTranslation(lang, 'quotations.converted')}: {selectedQuote.convertedInvoiceNo}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                {getTranslation(lang, 'quotations.total')}: {formatMoney(selectedQuote.total)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
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
            className="modal-content glass-panel" 
            style={{ maxWidth: '440px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowRight size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{getTranslation(lang, 'quotations.confirmConvert')}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{quoteToConvert.quotationNo}</span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px 0' }}>
              {getTranslation(lang, 'quotations.confirmConvertMsg')}
            </p>

            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '10px', padding: '12px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{getTranslation(lang, 'quotations.customer')}:</span>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>{quoteToConvert.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{getTranslation(lang, 'quotations.total')}:</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                  {formatMoney(quoteToConvert.total)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
                style={{ background: '#2563eb', borderColor: '#2563eb' }}
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
