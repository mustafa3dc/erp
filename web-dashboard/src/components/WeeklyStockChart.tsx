import React, { useState, useMemo } from 'react';
import { TransactionDetail } from './TransactionModal';
import { getStoredTransactions } from '../services/storageService';
import { parseDateSafely, extractMovementDate } from '../utils/dateFormatter';

interface WeeklyStockChartProps {
  lang?: 'en' | 'ar';
  transactions?: TransactionDetail[];
}

export default function WeeklyStockChart({ lang = 'ar', transactions }: WeeklyStockChartProps) {
  const isAr = lang === 'ar';
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Resolved transactions from props or persistent storage
  const allTxs = useMemo(() => {
    return transactions !== undefined ? transactions : getStoredTransactions();
  }, [transactions]);

  // Compute rolling 7-day window ending today (No future empty days!)
  const { weekData, maxVal, yLabels, totalInbound, totalOutbound, hasAnyMovement } = useMemo(() => {
    const now = new Date();
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // 7 days ending today: index 0 is 6 days ago, index 6 is today
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const dateObj = new Date(now);
      dateObj.setDate(now.getDate() - i);
      dateObj.setHours(0, 0, 0, 0);

      const y = dateObj.getFullYear();
      const m = dateObj.getMonth();
      const dayNum = dateObj.getDate();
      const dow = dateObj.getDay();

      const shortDate = `${String(dayNum).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`;
      const fullDate = `${y}/${String(m + 1).padStart(2, '0')}/${String(dayNum).padStart(2, '0')}`;

      days.push({
        dayIndex: dow,
        dayAr: dayNamesAr[dow],
        dayEn: dayNamesEn[dow],
        year: y,
        month: m,
        dayNum,
        dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
        shortDate,
        fullDate,
        isToday: i === 0,
        inbound: 0,
        outbound: 0
      });
    }

    // Calculate real aggregations per day
    if (Array.isArray(allTxs)) {
      for (const tx of allTxs) {
        const rawDate = extractMovementDate(tx) || (tx as any).createdAt || (tx as any).date || (tx as any).timestamp;
        const d = parseDateSafely(rawDate);
        if (!d || isNaN(d.getTime())) continue;

        const y = d.getFullYear();
        const m = d.getMonth();
        const dayNum = d.getDate();

        const targetDay = days.find(day => day.year === y && day.month === m && day.dayNum === dayNum);
        if (!targetDay) continue;

        const qty = Math.abs(Number(tx.qty) || 0);
        const typeLower = (tx.type || '').toLowerCase();

        if (
          typeLower.includes('inbound') || 
          typeLower.includes('received') ||
          tx.type === 'استلام' || 
          tx.type === 'توريد' ||
          tx.type === 'وارد' ||
          typeLower.includes('purchase') ||
          (tx.type === 'Adjustment' && Number(tx.qty) > 0)
        ) {
          targetDay.inbound += qty;
        } else if (
          typeLower.includes('outbound') || 
          typeLower.includes('dispatched') ||
          tx.type === 'صرف' || 
          tx.type === 'إخراج' || 
          tx.type === 'صادر' ||
          tx.type === 'مبيعات' ||
          typeLower.includes('sale') ||
          typeLower.includes('dispatch') ||
          (tx.type === 'Adjustment' && Number(tx.qty) < 0)
        ) {
          targetDay.outbound += qty;
        }
      }
    }

    let totIn = 0;
    let totOut = 0;
    let peak = 0;

    for (const d of days) {
      totIn += d.inbound;
      totOut += d.outbound;
      if (d.inbound > peak) peak = d.inbound;
      if (d.outbound > peak) peak = d.outbound;
    }

    const hasAny = totIn > 0 || totOut > 0;

    // Calculate dynamic Y-axis maximum
    let calculatedMax = 100;
    if (peak > 0) {
      if (peak <= 10) calculatedMax = 10;
      else if (peak <= 25) calculatedMax = 25;
      else if (peak <= 50) calculatedMax = 50;
      else if (peak <= 100) calculatedMax = 100;
      else if (peak <= 250) calculatedMax = 250;
      else if (peak <= 500) calculatedMax = 500;
      else if (peak <= 1000) calculatedMax = 1000;
      else if (peak <= 2000) calculatedMax = 2000;
      else {
        const mag = Math.pow(10, Math.floor(Math.log10(peak)));
        calculatedMax = Math.ceil((peak * 1.15) / mag) * mag;
      }
    }

    const yStep = calculatedMax / 4;
    const labels = [
      calculatedMax,
      Math.round(yStep * 3),
      Math.round(yStep * 2),
      Math.round(yStep * 1),
      0
    ];

    return {
      weekData: days,
      maxVal: calculatedMax,
      yLabels: labels,
      totalInbound: totIn,
      totalOutbound: totOut,
      hasAnyMovement: hasAny
    };
  }, [allTxs]);

  return (
    <div className="weekly-chart-card">
      <div className="weekly-chart-header">
        <div>
          <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', color: 'var(--foreground)' }}>
            <span>{isAr ? 'حركة الوارد والصادر الأسبوعية' : 'Stock In vs. Stock Out (Weekly)'}</span>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 700, 
              padding: '2.5px 9px', 
              borderRadius: '9999px',
              background: hasAnyMovement ? 'rgba(16, 185, 129, 0.16)' : 'var(--muted)',
              color: hasAnyMovement ? '#059669' : 'var(--muted-foreground)',
              border: hasAnyMovement ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border)'
            }}
            className={hasAnyMovement ? 'dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700/50' : ''}
            >
              {isAr 
                ? (hasAnyMovement 
                    ? `وارد: ${totalInbound.toLocaleString()} | صادر: ${totalOutbound.toLocaleString()} ق` 
                    : 'حركات فعلية: لا توجد حركات مسجلة هذا الأسبوع')
                : (hasAnyMovement 
                    ? `In: ${totalInbound.toLocaleString()} | Out: ${totalOutbound.toLocaleString()} U` 
                    : 'Live Data: No movements recorded this week')}
            </span>
          </h3>
          <span className="chart-unit-badge" style={{ color: 'var(--muted-foreground)' }}>
            {isAr ? 'مقارنة كميات التوريد والصرف لآخر 7 أيام (بالقطعة)' : 'Daily Inbound vs Outbound Quantities - Last 7 Days (Units)'}
          </span>
        </div>
        <div className="chart-legend">
          <span className="legend-item" style={{ color: 'var(--muted-foreground)' }}>
            <span className="legend-box inbound" style={{ backgroundColor: 'var(--primary)' }}></span> 
            {isAr ? `الوارد (${totalInbound.toLocaleString()} ق)` : `Inbound (${totalInbound.toLocaleString()} U)`}
          </span>
          <span className="legend-item" style={{ color: 'var(--muted-foreground)' }}>
            <span className="legend-box outbound" style={{ backgroundColor: '#64748b' }}></span> 
            {isAr ? `الصادر (${totalOutbound.toLocaleString()} ق)` : `Outbound (${totalOutbound.toLocaleString()} U)`}
          </span>
        </div>
      </div>

      <div className="chart-area-with-y-axis" style={{ marginBottom: '28px' }}>
        {/* Y Axis with dynamic real units */}
        <div className="y-axis">
          <span>{yLabels[0].toLocaleString()} <small className="y-unit">{isAr ? 'ق' : 'U'}</small></span>
          <span>{yLabels[1].toLocaleString()}</span>
          <span>{yLabels[2].toLocaleString()}</span>
          <span>{yLabels[3].toLocaleString()}</span>
          <span>0</span>
        </div>

        {/* Bars Container with grid lines */}
        <div className="bars-plot-area" style={{ position: 'relative' }}>
          <div className="grid-line" style={{ top: '0%' }}></div>
          <div className="grid-line" style={{ top: '25%' }}></div>
          <div className="grid-line" style={{ top: '50%' }}></div>
          <div className="grid-line" style={{ top: '75%' }}></div>
          <div className="grid-line" style={{ top: '100%' }}></div>

          {!hasAnyMovement && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 2
            }}>
              <span style={{
                background: 'var(--card)',
                border: '1px dashed var(--border)',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--muted-foreground)'
              }}>
                {isAr ? 'لا توجد حركات توريد أو صرف مسجلة خلال آخر 7 أيام' : 'No recorded stock movements during the last 7 days'}
              </span>
            </div>
          )}

          <div className="bars-columns-wrapper">
            {weekData.map((item, idx) => (
              <div 
                key={idx} 
                className="bar-group-col"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  position: 'relative',
                  background: hoveredIdx === idx ? 'rgba(2, 132, 199, 0.05)' : 'transparent',
                  borderRadius: '6px',
                  transition: 'background 0.2s ease'
                }}
              >
                {hoveredIdx === idx && (
                  <div style={{
                    position: 'absolute',
                    top: '-44px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#0f172a',
                    color: '#ffffff',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    pointerEvents: 'none',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: 800 }}>{isAr ? item.dayAr : item.dayEn} ({item.fullDate})</div>
                    <div style={{ color: '#38bdf8', fontSize: '9px', marginTop: '2px' }}>
                      {isAr ? 'الوارد' : 'Inbound'}: {item.inbound.toLocaleString()} {isAr ? 'ق' : 'U'}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '9px' }}>
                      {isAr ? 'الصادر' : 'Outbound'}: {item.outbound.toLocaleString()} {isAr ? 'ق' : 'U'}
                    </div>
                  </div>
                )}
                <div className="bars-pair">
                  <div 
                    className="bar inbound-bar" 
                    style={{ 
                      height: `${maxVal > 0 ? (item.inbound / maxVal) * 100 : 0}%`,
                      backgroundColor: 'var(--primary, #0284c7)',
                      minHeight: item.inbound > 0 ? '4px' : '0px'
                    }}
                    title={`${isAr ? 'الوارد' : 'Inbound'}: ${item.inbound.toLocaleString()} ${isAr ? 'قطعة' : 'units'}`}
                  ></div>
                  <div 
                    className="bar outbound-bar" 
                    style={{ 
                      height: `${maxVal > 0 ? (item.outbound / maxVal) * 100 : 0}%`,
                      backgroundColor: '#64748b',
                      minHeight: item.outbound > 0 ? '4px' : '0px'
                    }}
                    title={`${isAr ? 'الصادر' : 'Outbound'}: ${item.outbound.toLocaleString()} ${isAr ? 'قطعة' : 'units'}`}
                  ></div>
                </div>
                <div 
                  style={{ 
                    position: 'absolute',
                    bottom: '-30px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '1px',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: item.isToday ? 800 : 600,
                    color: item.isToday ? 'var(--primary, #0284c7)' : 'var(--foreground)'
                  }}>
                    {isAr ? item.dayAr : item.dayEn}
                  </span>
                  <span style={{ 
                    fontSize: '9.5px', 
                    color: item.isToday ? 'var(--primary, #0284c7)' : 'var(--muted-foreground)', 
                    fontFamily: 'monospace', 
                    fontWeight: item.isToday ? 700 : 500,
                    opacity: 0.9 
                  }}>
                    {item.shortDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
