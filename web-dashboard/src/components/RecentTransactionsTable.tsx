import React, { useState, useMemo } from 'react';
import { Copy, Check, FileText, ChevronRight, Box } from 'lucide-react';
import { TransactionDetail } from './TransactionModal';
import { localizeTxType, localizeTxStatus, localizeUnit, localizeWarehouse } from '../lib/localeHelpers';
import { formatMovementDate } from '../utils/dateFormatter';
import { Product } from '../types/warehouse';
import { getStoredProducts } from '../services/storageService';

interface RecentTransactionsTableProps {
  transactions: TransactionDetail[];
  products?: Product[];
  lang?: 'en' | 'ar';
  onSelectTx: (tx: TransactionDetail) => void;
  showToast?: (msg: string) => void;
}

export const RecentTransactionsTable: React.FC<RecentTransactionsTableProps> = ({
  transactions,
  products: inputProducts,
  lang = 'ar',
  onSelectTx,
  showToast
}) => {
  const isAr = lang === 'ar';
  const [copiedId, setCopiedId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Resolve products for SKU & name lookup
  const productsList = useMemo(() => {
    return inputProducts && inputProducts.length > 0 ? inputProducts : getStoredProducts();
  }, [inputProducts]);

  const formatTxId = (id: string): string => {
    if (id.startsWith('#TRX-')) return id;
    if (id.startsWith('TRX-')) return `#${id}`;
    if (id.startsWith('#')) return id;
    const clean = id.replace(/[^0-9A-Za-z]/g, '');
    const suffix = clean.length > 4 ? clean.slice(-4) : clean;
    return `#TRX-${suffix}`;
  };

  const handleCopyId = (formattedId: string) => {
    navigator.clipboard.writeText(formattedId);
    setCopiedId(formattedId);
    if (showToast) {
      showToast(isAr ? `تم نسخ رقم الإذن: ${formattedId}` : `Copied Transaction ID: ${formattedId}`);
    }
    setTimeout(() => {
      setCopiedId('');
    }, 2000);
  };

  const getResolvedSku = (tx: TransactionDetail): string => {
    if (tx.sku && tx.sku !== 'SKU' && tx.sku !== 'SKU-INVOICE' && tx.sku.trim() !== '') {
      return tx.sku;
    }
    const found = productsList.find(p => 
      p.id === tx.sku || 
      p.nameAr === tx.productName || 
      p.nameEn === tx.productName ||
      (tx.productName && p.nameAr && tx.productName.includes(p.nameAr))
    );
    if (found?.sku) return found.sku;
    const num = (tx.id || '').replace(/[^0-9]/g, '');
    return `SKU-${num.slice(-4) || '4647'}`;
  };

  const getTypeStyle = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t === 'inbound' || t === 'in' || t === 'receipt') {
      return {
        background: 'rgba(16, 185, 129, 0.12)',
        color: '#10b981',
        border: '1px solid rgba(16, 185, 129, 0.3)'
      };
    }
    if (t === 'outbound' || t === 'out' || t === 'dispatch') {
      return {
        background: 'rgba(100, 116, 139, 0.12)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)'
      };
    }
    if (t === 'transfer') {
      return {
        background: 'rgba(59, 130, 246, 0.12)',
        color: '#3b82f6',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      };
    }
    return {
      background: 'rgba(245, 158, 11, 0.12)',
      color: '#f59e0b',
      border: '1px solid rgba(245, 158, 11, 0.3)'
    };
  };

  const getStatusStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'received' || s === 'completed') {
      return {
        background: 'rgba(16, 185, 129, 0.12)',
        color: '#10b981',
        border: '1px solid rgba(16, 185, 129, 0.3)'
      };
    }
    if (s === 'dispatched' || s === 'shipped') {
      return {
        background: 'rgba(100, 116, 139, 0.12)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)'
      };
    }
    if (s === 'pending') {
      return {
        background: 'rgba(245, 158, 11, 0.12)',
        color: '#f59e0b',
        border: '1px solid rgba(245, 158, 11, 0.3)'
      };
    }
    if (s === 'cancelled') {
      return {
        background: 'rgba(239, 68, 68, 0.12)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.3)'
      };
    }
    return {
      background: 'var(--muted)',
      color: 'var(--muted-foreground)',
      border: '1px solid var(--border)'
    };
  };

  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginatedTransactions = transactions.slice(startIdx, startIdx + pageSize);

  return (
    <div 
      className="transactions-table-card" 
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '16px 16px 20px 16px',
        marginTop: '1.25rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* Table Header */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.08)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <FileText size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1.2 }}>
              {isAr ? 'أحدث حركات المخزون والعمليات التشغيلية' : 'Recent Stock Transactions & Audit Ledger'}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
              {isAr ? 'سجل رقابي موثق لحركات الإدخال، الصرف، والمناقلة الفورية' : 'Live operational audit trail for inbound, outbound and warehouse transfers'}
            </span>
          </div>
        </div>

        <span 
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            padding: '4px 10px',
            borderRadius: '6px'
          }}
        >
          {transactions.length} {isAr ? 'حركة مسجلة' : 'records logged'}
        </span>
      </div>

      {/* Table Container - No fixed height constraints */}
      <div className="table-wrapper" style={{ width: '100%', overflowX: 'auto', minHeight: 'auto' }}>
        <table 
          className="logistock-table" 
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: isAr ? 'right' : 'left'
          }}
        >
          <thead>
            <tr>
              {/* 1 */}
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {isAr ? 'رقم الإذن' : 'Transaction ID'}
              </th>
              {/* 2 */}
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {isAr ? 'التوقيت' : 'Date & Time'}
              </th>
              {/* 3 */}
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {isAr ? 'كود الصنف (SKU)' : 'SKU'}
              </th>
              {/* 4 */}
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', minWidth: '180px' }}>
                {isAr ? 'اسم المنتج' : 'Product Name'}
              </th>
              {/* 5 */}
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {isAr ? 'نوع الحركة' : 'Type'}
              </th>
              {/* 6 */}
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {isAr ? 'المسار (من إلى)' : 'Route (From / To)'}
              </th>
              {/* 7 */}
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {isAr ? 'الكمية' : 'Quantity'}
              </th>
              {/* 8 */}
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {isAr ? 'الحالة' : 'Status'}
              </th>
              {/* 9 */}
              <th style={{ padding: '10px 12px', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {isAr ? 'المنفّذ' : 'Handled By'}
              </th>
              <th style={{ padding: '10px 8px', background: 'var(--muted)', borderBottom: '1px solid var(--border)', width: '28px' }}></th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted-foreground)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Box size={28} style={{ color: 'var(--muted-foreground)', strokeWidth: 1.5 }} />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)' }}>
                      {isAr ? 'لا توجد حركات مخزنية مسجلة لهذا اليوم' : 'No warehouse transactions recorded for today'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((tx) => {
                const formattedId = formatTxId(tx.id);
                const isCopied = copiedId === formattedId;
                const typeStyle = getTypeStyle(tx.type);
                const statusStyle = getStatusStyle(tx.status);
                const skuCode = getResolvedSku(tx);
                const prodName = tx.productName || (productsList.find(p => p.sku === skuCode)?.nameAr) || 'صنف مخزني';

                return (
                  <tr
                    key={tx.id}
                    onClick={() => onSelectTx(tx)}
                    className="clickable-row"
                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    title={isAr ? 'انقر لعرض تفاصيل الإيصال والمطابقة' : 'Click to view voucher receipt'}
                  >
                    {/* 1. رقم الإذن (Transaction ID) with dir="ltr" to fix leading # symbol */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }} dir="ltr">
                      <button
                        type="button"
                        dir="ltr"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyId(formattedId);
                        }}
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          background: 'rgba(37, 99, 235, 0.08)',
                          border: '1px solid rgba(37, 99, 235, 0.25)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          direction: 'ltr'
                        }}
                        title={isAr ? 'انقر لنسخ رقم الإذن' : 'Click to copy Transaction ID'}
                      >
                        <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{formattedId}</span>
                        {isCopied ? (
                          <Check size={12} color="#10b981" />
                        ) : (
                          <Copy size={12} color="var(--muted-foreground)" />
                        )}
                      </button>
                    </td>

                    {/* 2. التوقيت (Date & Time) */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--muted-foreground)', fontWeight: 500 }}>
                      {formatMovementDate(tx.movementDate || tx.createdAt || tx.date || tx.timestamp, lang)}
                    </td>

                    {/* 3. كود الصنف (SKU) - Bound to actual SKU */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }} dir="ltr">
                      <span 
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          background: 'var(--muted)',
                          borderRadius: '5px',
                          color: 'var(--foreground)',
                          border: '1px solid var(--border)',
                          display: 'inline-block',
                          userSelect: 'all'
                        }}
                      >
                        {skuCode}
                      </span>
                    </td>

                    {/* 4. اسم المنتج (Product Name) with adequate width, truncate & title Tooltip */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', minWidth: '180px', maxWidth: '300px' }}>
                      <span 
                        dir="auto" 
                        title={prodName}
                        style={{
                          fontWeight: 600,
                          fontSize: '13px',
                          color: 'var(--foreground)',
                          display: 'block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {prodName}
                      </span>
                    </td>

                    {/* 5. نوع الحركة (Type) */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span 
                        style={{
                          padding: '2px 9px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          ...typeStyle
                        }}
                      >
                        {localizeTxType(tx.type, lang)}
                      </span>
                    </td>

                    {/* 6. المسار (From / To) with Arabic warehouse name */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11.5px',
                          color: 'var(--muted-foreground)'
                        }}
                        dir="auto"
                      >
                        <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                          {localizeWarehouse(tx.fromLocation || (isAr ? 'مورد معتمد' : 'Supplier'), lang)}
                        </span>
                        <span style={{ color: 'var(--muted-foreground)' }}>→</span>
                        <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                          {localizeWarehouse(tx.toLocation || tx.location, lang)}
                        </span>
                      </div>
                    </td>

                    {/* 7. الكمية (Quantity) */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const isOut = (tx.type || '').toLowerCase().includes('outbound') || tx.type === 'صرف';
                        const isIn = (tx.type || '').toLowerCase().includes('inbound') || tx.type === 'استلام' || tx.type === 'توريد';
                        const abs = Math.abs(Number(tx.qty) || 0);
                        const displayQty = isOut ? `-${abs.toLocaleString()}` : isIn ? `+${abs.toLocaleString()}` : abs.toLocaleString();
                        const color = isOut ? '#f43f5e' : isIn ? '#10b981' : 'var(--foreground)';
                        return (
                          <>
                            <span style={{ fontWeight: 700, fontSize: '13px', color, fontVariantNumeric: 'tabular-nums' }}>
                              {displayQty}
                            </span>{' '}
                            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                              {localizeUnit(tx.unit, lang)}
                            </span>
                          </>
                        );
                      })()}
                    </td>

                    {/* 8. الحالة (Status) */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span 
                        style={{
                          padding: '2px 9px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          ...statusStyle
                        }}
                      >
                        {localizeTxStatus(tx.status, lang)}
                      </span>
                    </td>

                    {/* 9. المنفّذ (Handled By) */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
                      {tx.operator || (isAr ? 'أمين المخزن' : 'Storekeeper')}
                    </td>

                    {/* Arrow Indicator */}
                    <td style={{ padding: '10px 6px', verticalAlign: 'middle', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                      <ChevronRight size={14} className="rtl:rotate-180" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls - Prevents table cutoff */}
      {transactions.length > pageSize && (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '14px',
            marginTop: '10px',
            borderTop: '1px solid var(--border)',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 500 }}>
            {isAr 
              ? `عرض ${startIdx + 1} - ${Math.min(startIdx + pageSize, transactions.length)} من إجمالي ${transactions.length} حركة`
              : `Showing ${startIdx + 1} - ${Math.min(startIdx + pageSize, transactions.length)} of ${transactions.length} records`}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: safePage <= 1 ? 'var(--muted)' : 'var(--card)',
                color: safePage <= 1 ? 'var(--muted-foreground)' : 'var(--foreground)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                opacity: safePage <= 1 ? 0.6 : 1
              }}
            >
              {isAr ? 'السابق' : 'Previous'}
            </button>

            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)', padding: '0 8px' }}>
              {safePage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: safePage >= totalPages ? 'var(--muted)' : 'var(--card)',
                color: safePage >= totalPages ? 'var(--muted-foreground)' : 'var(--foreground)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: safePage >= totalPages ? 0.6 : 1
              }}
            >
              {isAr ? 'التالي' : 'Next'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
