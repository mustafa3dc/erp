"use client";

import React, { useState } from 'react';
import { getStoredRMA, saveStoredRMA } from '../../services/storageService';
import NewReturnModal, { ReturnRequestData } from '../modals/NewReturnModal';
import { useSettings } from '../../context/settings-context';
import { 
  RotateCcw, 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Package, 
  ArrowRight,
  DollarSign,
  Plus,
  Check,
  X
} from 'lucide-react';

interface ReturnRequest {
  id: string;
  rmaNumber: string;
  originalInvoiceNo: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  sku: string;
  serialNumber: string;
  returnReason: string;
  warrantyStatus: 'VALID_UNDER_WARRANTY' | 'EXPIRED' | 'VOID_PHYSICAL_DAMAGE';
  decision: 'PENDING_INSPECTION' | 'APPROVED_RESTOCKED' | 'SENT_TO_MAINTENANCE' | 'REJECTED';
  returnQuantity?: number;
  refundAmount: number;
  currency?: string;
  date: string;
}

interface ReturnsWarrantyViewProps {
  lang: 'en' | 'ar';
}



export default function ReturnsWarrantyView({ lang }: ReturnsWarrantyViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const [returnsList, setReturnsList] = useState<ReturnRequest[]>(() => {
    return getStoredRMA();
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDecision, setFilterDecision] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleApproveRestock = (id: string) => {
    const updated = returnsList.map(r => r.id === id ? { ...r, decision: 'APPROVED_RESTOCKED' as const } : r);
    setReturnsList(updated);
    saveStoredRMA(updated);
    showToast(isAr ? 'تم اعتماد إرجاع الصنف للمخزن وإصدار إشعار دائن بنجاح!' : 'RMA restock approved & credit note issued!');
  };

  const filtered = returnsList.filter(r => {
    const matchesDecision = filterDecision === 'ALL' || r.decision === filterDecision;
    const matchesSearch = r.rmaNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.originalInvoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDecision && matchesSearch;
  });

  const pendingCount = returnsList.filter(r => r.decision === 'PENDING_INSPECTION').length;
  const approvedCount = returnsList.filter(r => r.decision === 'APPROVED_RESTOCKED').length;
  const rejectedCount = returnsList.filter(r => r.decision === 'REJECTED').length;
  const totalRefunded = returnsList.filter(r => r.decision === 'APPROVED_RESTOCKED').reduce((sum, r) => sum + r.refundAmount, 0);

  return (
    <div className="view-content-wrapper fade-in">
      {toastMsg && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9999 }}>
          <CheckCircle2 size={16} className="green-text" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Module Context Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <RotateCcw size={15} style={{ color: 'var(--primary)' }} />
            <span>{isAr ? 'المبيعات / المرتجعات وإدارة الضمان (RMA)' : 'Sales / Returns Management & Warranty (RMA)'}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          <button 
            type="button" 
            className="btn-clean-primary"
            onClick={() => setIsReturnModalOpen(true)}
          >
            <Plus size={15} />
            <span>{isAr ? 'طلب إرجاع جديد (RMA)' : 'New Return Request'}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'قيد الفحص والمطابقة' : 'Pending Inspection'}</span>
            <div className="module-kpi-value">
              {pendingCount} <span className="kpi-sub-unit">{isAr ? 'طلبات' : 'requests'}</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Clock size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'مرتجعات مقبولة ومسترجعة' : 'Approved Restocked'}</span>
            <div className="module-kpi-value">
              {approvedCount} <span className="kpi-sub-unit">{isAr ? 'أصناف' : 'items'}</span>
            </div>
          </div>
          <div className="module-kpi-icon emerald">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'طلبات مرفوضة' : 'Rejected RMA'}</span>
            <div className="module-kpi-value">
              {rejectedCount} <span className="kpi-sub-unit">{isAr ? 'ملغاة' : 'rejected'}</span>
            </div>
          </div>
          <div className="module-kpi-icon rose">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{isAr ? 'مبالغ الاسترداد الصادرة' : 'Total Refunded'}</span>
            <div className="module-kpi-value font-mono">
              {formatMoney(totalRefunded)}
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="module-toolbar">
        <div className="module-search-box">
          <Search size={16} />
          <input 
            type="text" 
            placeholder={isAr ? 'بحث برقم RMA، الفاتورة الأصلية، السيريال، أو العميل...' : 'Search RMA #, Invoice, Serial, Customer...'} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="module-filter-pills">
          {[
            { id: 'ALL', label: isAr ? 'جميع الطلبات' : 'All Requests' },
            { id: 'PENDING_INSPECTION', label: isAr ? 'قيد الفحص' : 'Pending' },
            { id: 'APPROVED_RESTOCKED', label: isAr ? 'مقبولة للمخزن' : 'Restocked' },
            { id: 'REJECTED', label: isAr ? 'مرفوضة' : 'Rejected' }
          ].map(f => (
            <button
              key={f.id}
              className={`filter-pill ${filterDecision === f.id ? 'active' : ''}`}
              onClick={() => setFilterDecision(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* RMA Table */}
      <div className="transactions-table-card">
        <div className="table-responsive">
          <table className="custom-data-table">
            <thead>
              <tr>
                <th>{isAr ? 'رقم طلب الـ RMA' : 'RMA #'}</th>
                <th>{isAr ? 'الفاتورة الأصلية' : 'Original Invoice'}</th>
                <th>{isAr ? 'العميل' : 'Customer'}</th>
                <th>{isAr ? 'الصنف والسيريال' : 'Item & Serial'}</th>
                <th>{isAr ? 'حالة الضمان' : 'Warranty'}</th>
                <th>{isAr ? 'سبب الإرجاع' : 'Return Reason'}</th>
                <th>{isAr ? 'الحالة والقرار' : 'Status & Action'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    {isAr ? 'سجل المرتجعات والضمان فارغ حالياً - لا توجد طلبات RMA مسجلة' : 'No returns or RMA requests found. Registry is clean.'}
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{r.rmaNumber}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#334155', fontWeight: 600 }}>{r.originalInvoiceNo}</span>
                  </td>
                  <td>
                    <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>{r.customerName}</strong>
                    <small style={{ color: '#64748b' }}>{r.customerPhone}</small>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{r.productName}</span>
                      {r.returnQuantity && r.returnQuantity > 1 && (
                        <span style={{ fontSize: '11px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          ×{r.returnQuantity}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }} dir="ltr">
                        {r.serialNumber}
                      </span>
                      {r.refundAmount > 0 && (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                          ({formatMoney(r.refundAmount)})
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: r.warrantyStatus === 'VALID_UNDER_WARRANTY' ? '#ecfdf5' : '#fef2f2',
                      color: r.warrantyStatus === 'VALID_UNDER_WARRANTY' ? '#047857' : '#dc2626',
                      border: `1px solid ${r.warrantyStatus === 'VALID_UNDER_WARRANTY' ? '#a7f3d0' : '#fecaca'}`
                    }}>
                      {r.warrantyStatus === 'VALID_UNDER_WARRANTY' 
                        ? (isAr ? 'ضمان ساري' : 'Valid Warranty') 
                        : (isAr ? 'ضمان لاغٍ' : 'Void Warranty')}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: '#334155', fontWeight: 500, maxWidth: '200px' }}>
                    {r.returnReason}
                  </td>
                  <td>
                    {r.decision === 'PENDING_INSPECTION' ? (
                      <button 
                        type="button" 
                        className="btn-clean-success" 
                        onClick={() => handleApproveRestock(r.id)}
                      >
                        <Check size={14} />
                        <span>{isAr ? 'قبول وإرجاع للمخزن' : 'Approve & Restock'}</span>
                      </button>
                    ) : r.decision === 'APPROVED_RESTOCKED' ? (
                      <span style={{ color: '#047857', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={14} />
                        <span>{isAr ? 'تم الاسترجاع للمخزن' : 'Restocked & Credit Issued'}</span>
                      </span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <X size={14} />
                        <span>{isAr ? 'مرفوض - سوء استخدام' : 'Rejected'}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Return Request Modal */}
      <NewReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        lang={lang}
        onSubmit={(newReturn) => {
          const next = [newReturn, ...returnsList];
          setReturnsList(next);
          saveStoredRMA(next);
          setIsReturnModalOpen(false);
          showToast(
            isAr
              ? `تم تسجيل طلب الإرجاع (${newReturn.rmaNumber}) بنجاح!`
              : `RMA request (${newReturn.rmaNumber}) registered successfully!`
          );
        }}
      />
    </div>
  );
}
