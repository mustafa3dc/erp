import React, { useState, useMemo } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  SlidersHorizontal, 
  Search,
  Filter,
  Calendar,
  Box
} from 'lucide-react';
import { StockMovement, TransactionDetail } from '../types/warehouse';
import { localizeTxType, localizeWarehouse } from '../lib/localeHelpers';
import { formatMovementDate } from '../utils/dateFormatter';

export interface StockMovementsTableProps {
  movements: (StockMovement | TransactionDetail)[];
  lang?: 'en' | 'ar';
  title?: string;
  showFilters?: boolean;
  onSelectMovement?: (movement: StockMovement | TransactionDetail) => void;
  emptyMessage?: string;
}

export const StockMovementsTable: React.FC<StockMovementsTableProps> = ({
  movements,
  lang = 'ar',
  title,
  showFilters = true,
  onSelectMovement,
  emptyMessage
}) => {
  const isAr = lang === 'ar';
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const normalizedMovements = useMemo(() => {
    return (movements || []).map((m: any) => {
      // Normalize StockMovement vs TransactionDetail fields
      const id = m.id || m.movementNumber || '';
      const movementNumber = m.movementNumber || (m.id?.startsWith('#') ? m.id : `#${m.id}`);
      const rawType = (m.type || m.movementType || 'IN').toUpperCase();
      
      let normType: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' = 'IN';
      if (rawType.includes('OUT') || rawType === 'DISPATCH' || rawType === 'SALE') {
        normType = 'OUT';
      } else if (rawType.includes('TRANSFER')) {
        normType = 'TRANSFER';
      } else if (rawType.includes('ADJUST') || rawType === 'DAMAGE' || rawType === 'DEFICIT' || rawType === 'SURPLUS') {
        normType = 'ADJUSTMENT';
      } else {
        normType = 'IN';
      }

      const productName = m.productName || m.nameAr || m.name || '';
      const sku = m.sku || m.itemSku || '';
      const quantity = Math.abs(Number(m.quantity ?? m.qty ?? 0));
      const unitCost = Number(m.unitCost ?? m.costPerUnit ?? 0);
      const fromWarehouse = m.fromWarehouse || m.fromLocation || '';
      const toWarehouse = m.toWarehouse || m.toLocation || m.location || '';
      const operator = m.operator || m.createdBy || '';
      const notes = m.notes || m.reason || '';

      // Server date properties priority: movementDate -> createdAt -> date -> timestamp
      const rawDate = m.movementDate || m.createdAt || m.date || m.timestamp;

      return {
        original: m,
        id,
        movementNumber,
        type: normType,
        rawType: m.type,
        productName,
        sku,
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        fromWarehouse,
        toWarehouse,
        operator,
        notes,
        rawDate
      };
    });
  }, [movements]);

  const filteredItems = useMemo(() => {
    return normalizedMovements.filter(item => {
      if (filterType !== 'ALL' && item.type !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSku = item.sku.toLowerCase().includes(q);
        const matchesName = item.productName.toLowerCase().includes(q);
        const matchesNum = item.movementNumber.toLowerCase().includes(q);
        const matchesNotes = item.notes.toLowerCase().includes(q);
        if (!matchesSku && !matchesName && !matchesNum && !matchesNotes) {
          return false;
        }
      }
      return true;
    });
  }, [normalizedMovements, filterType, searchQuery]);

  return (
    <div className="stock-movements-table-container glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header and Filter Controls */}
      {showFilters && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)'
        }}>
          {title && (
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
              {title}
            </h3>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              minWidth: '220px'
            }}>
              <Search size={14} style={{ color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                placeholder={isAr ? 'بحث برقم الإذن، الصنف أو الرمز...' : 'Search by voucher, SKU, item...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--foreground)',
                  fontSize: '12px',
                  width: '100%'
                }}
              />
            </div>

            <div style={{ display: 'inline-flex', gap: '4px', background: 'var(--muted)', padding: '3px', borderRadius: '8px' }}>
              {[
                { id: 'ALL', ar: 'الكل', en: 'All' },
                { id: 'IN', ar: 'وارد', en: 'Inbound' },
                { id: 'OUT', ar: 'صادر', en: 'Outbound' },
                { id: 'TRANSFER', ar: 'مناقلة', en: 'Transfer' },
                { id: 'ADJUSTMENT', ar: 'تسوية', en: 'Adjustment' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  style={{
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: filterType === tab.id ? 'var(--primary)' : 'transparent',
                    color: filterType === tab.id ? '#ffffff' : 'var(--muted-foreground)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isAr ? tab.ar : tab.en}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Movements Table */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600 }}>{isAr ? 'رقم الإذن' : 'Voucher No'}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600 }}>{isAr ? 'نوع الحركة' : 'Movement Type'}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600 }}>{isAr ? 'الصنف ورمز SKU' : 'Item & SKU'}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600 }}>{isAr ? 'مسار الحركة' : 'Location / Route'}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600 }}>{isAr ? 'الكمية' : 'Quantity'}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600 }}>{isAr ? 'التكلفة الإجمالية' : 'Total Cost'}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600 }}>{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600 }}>{isAr ? 'المسؤول والملاحظات' : 'Operator & Notes'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-foreground)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Box size={28} style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '12.5px' }}>
                      {emptyMessage || (isAr ? 'لا توجد حركات مخزنية مطابقة' : 'No matching stock movements found')}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                // Safely format the date using the DateFormatter helper
                // Prevents fallback to 'today' when rawDate is missing or invalid
                const formattedDate = formatMovementDate(item.rawDate, lang);

                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectMovement && onSelectMovement(item.original)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: onSelectMovement ? 'pointer' : 'default',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        background: 'var(--muted)',
                        borderRadius: '4px',
                        border: '1px solid var(--border)'
                      }}>
                        {item.movementNumber}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: item.type === 'IN' ? 'rgba(16, 185, 129, 0.12)' :
                                    item.type === 'OUT' ? 'rgba(239, 68, 68, 0.12)' :
                                    item.type === 'TRANSFER' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        color: item.type === 'IN' ? '#10b981' :
                               item.type === 'OUT' ? '#ef4444' :
                               item.type === 'TRANSFER' ? '#3b82f6' : '#f59e0b',
                        border: `1px solid ${
                          item.type === 'IN' ? 'rgba(16, 185, 129, 0.3)' :
                          item.type === 'OUT' ? 'rgba(239, 68, 68, 0.3)' :
                          item.type === 'TRANSFER' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'
                        }`
                      }}>
                        {item.type === 'IN' && <ArrowDownLeft size={12} />}
                        {item.type === 'OUT' && <ArrowUpRight size={12} />}
                        {item.type === 'TRANSFER' && <ArrowLeftRight size={12} />}
                        {item.type === 'ADJUSTMENT' && <SlidersHorizontal size={12} />}
                        <span>{localizeTxType(item.type, lang)}</span>
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', maxWidth: '240px' }}>
                      <strong style={{ display: 'block', fontSize: '12.5px', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.productName || '—'}
                      </strong>
                      <small style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted-foreground)' }}>
                        {item.sku || '—'}
                      </small>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '12px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                      {item.fromWarehouse && item.toWarehouse
                        ? `${localizeWarehouse(item.fromWarehouse, lang)} -> ${localizeWarehouse(item.toWarehouse, lang)}`
                        : localizeWarehouse(item.toWarehouse || item.fromWarehouse, lang) || '—'}
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <strong style={{
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: item.type === 'IN' ? '#10b981' : item.type === 'OUT' ? '#ef4444' : 'var(--foreground)'
                      }}>
                        {item.type === 'IN' ? `+${item.quantity}` : item.type === 'OUT' ? `-${item.quantity}` : `${item.quantity}`}
                      </strong>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                      ${item.totalCost.toLocaleString()}
                    </td>

                    {/* Accurate date formatting preventing "today" error */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '11.5px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} style={{ opacity: 0.6 }} />
                        <span>{formattedDate}</span>
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', maxWidth: '200px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--foreground)' }}>{item.operator || '—'}</div>
                      {item.notes && (
                        <small style={{ fontSize: '10.5px', color: 'var(--muted-foreground)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.notes}
                        </small>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StockMovementsTable;

