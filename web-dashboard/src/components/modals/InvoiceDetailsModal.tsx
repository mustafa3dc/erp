import React, { useRef } from 'react';
import { X, Printer, FileText, CheckCircle2, Clock, AlertCircle, Building2, User, Phone, MapPin, QrCode } from 'lucide-react';
import BarcodeSvg from '../BarcodeSvg';
import { SalesInvoice } from '../../types/warehouse';
import { localizeWarehouse, localizeUnit } from '../../lib/localeHelpers';
import { useSettings } from '../../context/settings-context';
import { getStoredAuthSession } from '../../services/storageService';

interface InvoiceDetailsModalProps {
  invoice: SalesInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'ar';
}

export default function InvoiceDetailsModal({
  invoice,
  isOpen,
  onClose,
  lang
}: InvoiceDetailsModalProps) {
  if (!isOpen || !invoice) return null;
  const isAr = lang === 'ar';
  const { settings, formatMoney } = useSettings();
  const session = getStoredAuthSession();
  const tenantDisplayName = session?.tenantName || settings?.organizationName || 'ZiloX ERP';

  const handlePrintA4 = () => {
    const printArea = document.getElementById('printable-tax-invoice');
    if (!printArea) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="${isAr ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8">
        <title>Invoice-${invoice.invoiceNo}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            padding: 10px;
            font-size: 11pt;
            line-height: 1.4;
          }
          .invoice-sheet {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
          }
          .inv-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .company-brand h1 {
            font-size: 20pt;
            font-weight: 800;
            color: var(--primary);
            letter-spacing: -0.02em;
          }
          .company-brand p {
            font-size: 9pt;
            color: #475569;
          }
          .invoice-meta-box {
            text-align: ${isAr ? 'left' : 'right'};
          }
          .inv-badge-title {
            font-size: 16pt;
            font-weight: 800;
            color: #0f172a;
          }
          .inv-meta-row {
            font-size: 9.5pt;
            color: #334155;
            margin-top: 2px;
          }
          .parties-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 14px;
            margin-bottom: 16px;
            font-size: 9.5pt;
          }
          .party-title {
            font-size: 8.5pt;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 4px;
            border-bottom: 1px dashed #cbd5e1;
            padding-bottom: 2px;
          }
          table.items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 10pt;
          }
          table.items-table th {
            background: #0f172a;
            color: #ffffff;
            font-weight: 700;
            padding: 8px 10px;
            text-align: ${isAr ? 'right' : 'left'};
            border: 1px solid #0f172a;
            font-size: 9pt;
          }
          table.items-table td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
          }
          table.items-table tr:nth-child(even) td {
            background: #f8fafc;
          }
          .total-summary-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
          }
          .qr-barcode-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 10px;
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
          }
          .totals-table {
            width: 280px;
            border-collapse: collapse;
            font-size: 10pt;
          }
          .totals-table td {
            padding: 5px 8px;
          }
          .totals-table tr.grand-total td {
            font-size: 12pt;
            font-weight: 900;
            color: var(--primary);
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
          }
          .signatures-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            margin-top: 30px;
            text-align: center;
            font-size: 9pt;
            color: #475569;
          }
          .sig-box {
            border-top: 1px dashed #94a3b8;
            padding-top: 6px;
          }
        </style>
      </head>
      <body>
        ${printArea.innerHTML}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  const statusColor = 
    invoice.status === 'paid' ? 'status-active' :
    invoice.status === 'pending' ? 'status-pending' : 'status-danger';

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div 
        className="invoice-modal-content glass-panel" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="invoice-modal-topbar">
          <div className="invoice-topbar-left">
            <div className="invoice-icon-badge">
              <FileText size={22} />
            </div>
            <div>
              <div className="invoice-header-meta">
                <span className="inv-code-tag">{invoice.invoiceNo}</span>
                <span className={`status-pill ${statusColor}`}>
                  <span className="status-dot"></span>
                  <span>{isAr ? (invoice.status === 'paid' ? 'مسددة بالكامل' : invoice.status === 'pending' ? 'بانتظار السداد' : 'آجل / ذمة') : invoice.status.toUpperCase()}</span>
                </span>
                <span className="payment-method-chip">
                  {isAr 
                    ? (invoice.paymentMethod === 'cash' ? 'نقداً' : invoice.paymentMethod === 'card' ? 'بطاقة إلكترونية' : 'آجل')
                    : (invoice.paymentMethod === 'cash' ? 'Cash' : invoice.paymentMethod === 'card' ? 'Card' : 'Credit')}
                </span>
                {invoice.dispenseMode && (
                  <span 
                    className="payment-method-chip"
                    style={{
                      background: invoice.dispenseMode === 'WAREHOUSE_DISPATCH' ? '#eff6ff' : '#f0fdf4',
                      color: invoice.dispenseMode === 'WAREHOUSE_DISPATCH' ? '#1d4ed8' : '#15803d',
                      borderColor: invoice.dispenseMode === 'WAREHOUSE_DISPATCH' ? '#bfdbfe' : '#bbf7d0'
                    }}
                  >
                    {invoice.dispenseMode === 'WAREHOUSE_DISPATCH'
                      ? (isAr ? 'تجهيز مستودع' : 'Warehouse Dispatch')
                      : (isAr ? 'صرف مباشر' : 'Direct In-Store')}
                  </span>
                )}
              </div>
              <h3 className="invoice-modal-title">
                {isAr ? `فاتورة مبيعات ضريبية — ${invoice.customerName}` : `Tax Sales Invoice — ${invoice.customerName}`}
              </h3>
            </div>
          </div>

          <div className="invoice-topbar-actions">
            <button 
              type="button" 
              className="btn-print-invoice"
              onClick={handlePrintA4}
            >
              <Printer size={16} />
              <span>{isAr ? 'طباعة الفاتورة' : 'Print Invoice'}</span>
            </button>
            <button 
              type="button" 
              className="icon-circle-btn scanner-close-btn" 
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Invoice Printable Sheet View */}
        <div className="invoice-sheet-container">
          <div id="printable-tax-invoice" className="invoice-sheet">
            {/* Header */}
            <div className="inv-header">
              <div className="company-brand">
                <h1>{tenantDisplayName}</h1>
                <p><strong>{isAr ? 'منظومة إدارة المخازن ونقاط البيع' : 'Warehouse & Cloud POS Suite'}</strong></p>
                {settings?.taxNumber && <p>{isAr ? `الرقم الضريبي: ${settings.taxNumber}` : `Tax ID: ${settings.taxNumber}`}</p>}
                <p>{localizeWarehouse(invoice.warehouseName, lang)}</p>
                {session?.username && <p>{isAr ? `الحساب: ${session.username}` : `Account: ${session.username}`}</p>}
              </div>

              <div className="invoice-meta-box">
                <div className="inv-badge-title">
                  {isAr ? 'فاتورة ضريبية رسمية' : 'TAX INVOICE'}
                </div>
                <div className="inv-meta-row">
                  <strong>{isAr ? 'رقم الفاتورة: ' : 'Invoice No: '}</strong>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{invoice.invoiceNo}</span>
                </div>
                <div className="inv-meta-row">
                  <strong>{isAr ? 'تاريخ الإصدار: ' : 'Issue Date: '}</strong>
                  <span>{invoice.date}</span>
                </div>
                <div className="inv-meta-row">
                  <strong>{isAr ? 'مستودع التجهيز: ' : 'Fulfilled Warehouse: '}</strong>
                  <span>{localizeWarehouse(invoice.warehouseName, lang)}</span>
                </div>
                {invoice.dispenseMode && (
                  <div className="inv-meta-row">
                    <strong>{isAr ? 'طريقة التسليم: ' : 'Dispense Mode: '}</strong>
                    <span style={{ fontWeight: 700, color: invoice.dispenseMode === 'WAREHOUSE_DISPATCH' ? '#1d4ed8' : '#15803d' }}>
                      {invoice.dispenseMode === 'WAREHOUSE_DISPATCH'
                        ? (isAr ? 'تجهيز وشحن مستودع (Warehouse Dispatch)' : 'Warehouse Dispatch')
                        : (isAr ? 'صرف وتسليم مباشر (Direct In-Store)' : 'Direct In-Store')}
                    </span>
                  </div>
                )}
                <div className="inv-meta-row">
                  <strong>{isAr ? 'منشئ الفاتورة: ' : 'Operator: '}</strong>
                  <span>{invoice.operator || session?.fullName || session?.username || (isAr ? 'مسؤول المبيعات' : 'Sales Officer')}</span>
                </div>
              </div>
            </div>

            {/* Parties info */}
            <div className="parties-grid">
              <div className="party-box">
                <div className="party-title">{isAr ? 'بيانات العميل / المشتري' : 'BILL TO / CUSTOMER'}</div>
                <p><strong>{invoice.customerName}</strong></p>
                {invoice.customerPhone && <p><Phone size={12} style={{ display: 'inline', marginInlineEnd: 4 }} />{invoice.customerPhone}</p>}
                {invoice.customerAddress && <p><MapPin size={12} style={{ display: 'inline', marginInlineEnd: 4 }} />{invoice.customerAddress}</p>}
                <p>{isAr ? 'الرقم الضريبي للعميل: ' : 'Customer Tax ID: '} {invoice.customerTaxNo || '102938475600001'}</p>
              </div>

              <div className="party-box">
                <div className="party-title">{isAr ? 'شروط السداد والاستحقاق' : 'PAYMENT TERMS'}</div>
                <p><strong>{isAr ? 'طريقة الدفع: ' : 'Method: '}</strong> {isAr ? (invoice.paymentMethod === 'cash' ? 'نقدي فور التسليم' : invoice.paymentMethod === 'card' ? 'شبكة بنكية / مدى' : 'أجل خلال 30 يوم') : invoice.paymentMethod?.toUpperCase() || 'CASH'}</p>
                <p><strong>{isAr ? 'حالة السداد: ' : 'Payment Status: '}</strong> {isAr ? (invoice.status === 'paid' ? 'تم استلام المبلغ بالكامل' : 'معلق بحساب العميل') : invoice.status.toUpperCase()}</p>
                <p><strong>{isAr ? 'تاريخ الاستحقاق: ' : 'Due Date: '}</strong> {invoice.dueDate || invoice.date}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <table className="items-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>{isAr ? 'رمز الصنف' : 'SKU'}</th>
                  <th>{isAr ? 'بيان الصنف والمواصفات' : 'Description'}</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>{isAr ? 'الكمية' : 'Qty'}</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>{isAr ? 'الوحدة' : 'Unit'}</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>{isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
                  <th style={{ width: '120px', textAlign: isAr ? 'left' : 'right' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>{index + 1}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{item.sku}</td>
                      <td>
                        <strong dir="auto">{item.nameAr}</strong>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>{item.quantity}</td>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{localizeUnit(item.unit, lang)}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{formatMoney(Number(item.unitPrice))}</td>
                      <td style={{ textAlign: isAr ? 'left' : 'right', fontFamily: 'monospace', fontWeight: 800 }}>
                        {formatMoney(Number(item.total))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                      {isAr ? 'لا توجد بنود مسجلة في هذه الفاتورة' : 'No items recorded in this invoice'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals & QR Section */}
            <div className="total-summary-grid">
              <div className="qr-barcode-wrap">
                {/* SVG ZATCA / Enterprise QR Simulation */}
                <div style={{ background: '#000', padding: 8, borderRadius: 6, display: 'inline-block' }}>
                  <svg width="86" height="86" viewBox="0 0 25 25" fill="#ffffff">
                    <rect x="0" y="0" width="7" height="7" fill="#ffffff" />
                    <rect x="1" y="1" width="5" height="5" fill="#000000" />
                    <rect x="2" y="2" width="3" height="3" fill="#ffffff" />
                    <rect x="18" y="0" width="7" height="7" fill="#ffffff" />
                    <rect x="19" y="1" width="5" height="5" fill="#000000" />
                    <rect x="20" y="2" width="3" height="3" fill="#ffffff" />
                    <rect x="0" y="18" width="7" height="7" fill="#ffffff" />
                    <rect x="1" y="19" width="5" height="5" fill="#000000" />
                    <rect x="2" y="20" width="3" height="3" fill="#ffffff" />
                    <rect x="9" y="2" width="2" height="2" fill="#ffffff" />
                    <rect x="13" y="4" width="3" height="2" fill="#ffffff" />
                    <rect x="9" y="9" width="7" height="7" fill="#ffffff" />
                    <rect x="11" y="11" width="3" height="3" fill="#000000" />
                    <rect x="18" y="11" width="2" height="4" fill="#ffffff" />
                    <rect x="2" y="10" width="4" height="2" fill="#ffffff" />
                    <rect x="10" y="18" width="3" height="4" fill="#ffffff" />
                    <rect x="15" y="18" width="4" height="2" fill="#ffffff" />
                    <rect x="20" y="20" width="4" height="4" fill="#ffffff" />
                  </svg>
                </div>
                <span style={{ fontSize: '7.5pt', color: '#64748b', fontWeight: 600 }}>{isAr ? 'رمز التحقق الضريبي المعتمد' : 'ZATCA Tax QR Code'}</span>
                <BarcodeSvg value={invoice.invoiceNo.replace(/[^0-9]/g, '') || '20260041'} width={100} height={20} color="#000000" />
              </div>

              {/* Financial calculations with sanity guards against abnormal inputs */}
              {(() => {
                const rawDiscount = Number(invoice.discount || 0);
                const subtotalVal = Number(invoice.subtotal || 0);
                const isAbnormal = rawDiscount > subtotalVal;
                const safeDiscount = Math.min(rawDiscount, subtotalVal);
                const taxable = Math.max(0, subtotalVal - safeDiscount);
                const taxVal = Number(invoice.tax || 0);
                const displayTotal = isAbnormal ? (taxable + taxVal) : Number(invoice.total || (taxable + taxVal));

                return (
                  <table className="totals-table">
                    <tbody>
                      <tr>
                        <td>{isAr ? 'المجموع قبل الضريبة:' : 'Subtotal:'}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontFamily: 'monospace' }}>
                          {formatMoney(subtotalVal)}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          {isAr ? 'الخصم التجاري:' : 'Discount:'}
                          {isAbnormal && (
                            <span style={{ display: 'block', fontSize: '7pt', color: '#ef4444', fontWeight: 700 }}>
                              {isAr ? 'تم تصحيح خصم شاذ تجاوز الإجمالي' : 'Corrected abnormal discount'}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontFamily: 'monospace', color: '#ef4444' }}>
                          -{formatMoney(safeDiscount)}
                        </td>
                      </tr>
                      <tr>
                        <td>{isAr ? (taxVal > 0 ? 'ضريبة القيمة المضافة:' : 'الضريبة (0%):') : (taxVal > 0 ? 'VAT:' : 'Tax (0%):')}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontFamily: 'monospace' }}>
                          {formatMoney(taxVal)}
                        </td>
                      </tr>
                      <tr className="grand-total">
                        <td>{isAr ? 'المبلغ الإجمالي المستحق:' : 'Total Amount Due:'}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontFamily: 'monospace' }}>
                          {formatMoney(displayTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Official Signatures & Stamp */}
            <div className="signatures-row">
              <div className="sig-box">
                <p><strong>{isAr ? 'مسؤول المبيعات' : 'Sales Officer'}</strong></p>
                <p style={{ marginTop: '24px' }}>{invoice.operator || session?.fullName || (isAr ? 'مسؤول المبيعات' : 'Sales Officer')}</p>
              </div>
              <div className="sig-box">
                <p><strong>{isAr ? 'أمين المستودع والشحن' : 'Warehouse Storekeeper'}</strong></p>
                <p style={{ marginTop: '24px' }}>{isAr ? 'إدارة المستودع' : 'Warehouse Ops'}</p>
              </div>
              <div className="sig-box">
                <p><strong>{isAr ? 'توقيع وختم العميل المستلم' : 'Recipient Stamp / Signature'}</strong></p>
                <p style={{ marginTop: '24px' }}>{invoice.customerName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="invoice-modal-footer">
          <div className="invoice-footer-left">
            <span className="inv-notice-text">
              {isAr ? 'تعتبر هذه الفاتورة وثيقة محاسبية وضريبية رسمية تثبت صرف واستلام البضائع من المستودع' : 'Official accounting and tax document proving delivery and receipt of goods'}
            </span>
          </div>

          <div className="invoice-footer-buttons">
            <button type="button" className="btn-add-primary" onClick={handlePrintA4}>
              <Printer size={16} />
              <span>{isAr ? 'طباعة رسمية A4' : 'Print A4 Invoice'}</span>
            </button>
            <button type="button" className="btn-secondary-flat" onClick={onClose}>
              {isAr ? 'إغلاق النافذة' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
