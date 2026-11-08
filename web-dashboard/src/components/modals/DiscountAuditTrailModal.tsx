import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  X, 
  FileSpreadsheet, 
  Clock, 
  UserCheck, 
  Lock,
  Tag,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { DiscountAuditLog } from '../../types/warehouse';

interface DiscountAuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DiscountAuditLog[];
  lang: 'en' | 'ar';
}

export default function DiscountAuditTrailModal({
  isOpen,
  onClose,
  logs,
  lang
}: DiscountAuditTrailModalProps) {
  const isAr = lang === 'ar';
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'OVERRIDE' | 'STANDARD'>('ALL');

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      log.productName.toLowerCase().includes(search.toLowerCase()) ||
      log.productSku.toLowerCase().includes(search.toLowerCase()) ||
      (log.approvedByManagerName && log.approvedByManagerName.toLowerCase().includes(search.toLowerCase()));

    const matchesFilter = 
      filterType === 'ALL' ||
      (filterType === 'OVERRIDE' && log.wasManagerOverride) ||
      (filterType === 'STANDARD' && !log.wasManagerOverride);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="modal-backdrop-custom fade-in" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 10, 24, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        borderRadius: '18px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          background: 'var(--primary-light)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'var(--card)',
              border: '1px solid var(--primary-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--foreground)' }}>
                {isAr ? 'سجل الرقابة وتدقيق الخصومات (Discount Audit Trail)' : 'Discount Audit Trail & Override Log'}
              </h3>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                {isAr ? 'تتبع فوري لكافة الخصومات المعتمدة وهوية المشرفين المحمية' : 'Real-time ledger of approved discounts and manager overrides'}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <div className="search-bar-wrap" style={{ flex: 1 }}>
            <Search size={16} className="search-icon-inside" style={{ color: 'var(--primary)' }} />
            <input
              type="text"
              placeholder={isAr ? 'ابحث برقم الفاتورة، اسم الصنف، أو اسم المشرف...' : 'Search invoice #, product, or manager...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '8px 12px 8px 36px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {(['ALL', 'OVERRIDE', 'STANDARD'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: filterType === type ? 'var(--primary)' : 'transparent',
                  color: filterType === type ? '#fff' : 'var(--muted-foreground)'
                }}
              >
                {type === 'ALL' && (isAr ? 'الكل' : 'All')}
                {type === 'OVERRIDE' && (isAr ? 'اعتمادات المشرفين' : 'Manager Overrides')}
                {type === 'STANDARD' && (isAr ? 'خصومات الكاشير' : 'Cashier Discounts')}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              <ShieldCheck size={44} style={{ opacity: 0.25, margin: '0 auto 12px auto' }} />
              <p style={{ margin: 0, fontSize: '14px' }}>{isAr ? 'لا توجد سجلات خصم تطابق البحث' : 'No discount audit records found'}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: isAr ? 'right' : 'left' }}>
                  <th style={{ padding: '8px' }}>{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                  <th style={{ padding: '8px' }}>{isAr ? 'الصنف' : 'Product'}</th>
                  <th style={{ padding: '8px' }}>{isAr ? 'قيمة الخصم' : 'Discount'}</th>
                  <th style={{ padding: '8px' }}>{isAr ? 'السعر النهائي' : 'Final Price'}</th>
                  <th style={{ padding: '8px' }}>{isAr ? 'الكاشير' : 'Cashier'}</th>
                  <th style={{ padding: '8px' }}>{isAr ? 'اعتماد المشرف' : 'Manager Override'}</th>
                  <th style={{ padding: '8px' }}>{isAr ? 'التوقيت' : 'Time'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '10px 8px', fontFamily: 'monospace', color: '#a5b4fc', fontWeight: 600 }}>
                      {log.invoiceNumber}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ fontWeight: 600, color: '#f1f5f9', display: 'block' }}>{log.productName}</span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{log.productSku}</span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{
                        background: log.wasManagerOverride ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: log.wasManagerOverride ? '#f87171' : '#34d399',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '11px'
                      }}>
                        {log.discountType === 'PERCENT' ? `${log.discountValue}%` : `$${log.discountValue}`}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>
                      <span style={{ color: '#94a3b8', textDecoration: 'line-through', marginRight: '6px' }}>
                        ${log.originalRetailPrice.toFixed(2)}
                      </span>
                      <strong style={{ color: '#10b981' }}>
                        ${log.finalSellingPrice.toFixed(2)}
                      </strong>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#cbd5e1' }}>
                      {log.cashierName || log.cashierId}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {log.wasManagerOverride ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            border: '1px solid var(--primary-border)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Lock size={10} />
                            {log.approvedByManagerName || log.approvedByManagerId}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '11px' }}>
                          {isAr ? 'صلاحية كاشير عادية' : 'Cashier Limit'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      <Clock size={11} style={{ display: 'inline', marginLeft: isAr ? '4px' : '0', marginRight: isAr ? '0' : '4px' }} />
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px'
        }}>
          <span style={{ color: '#94a3b8' }}>
            {isAr ? `إجمالي العمليات المسجلة: ${filteredLogs.length}` : `Total Logged Records: ${filteredLogs.length}`}
          </span>
          <button 
            onClick={onClose}
            className="btn-add-primary"
            style={{ padding: '6px 18px', fontSize: '12px' }}
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
