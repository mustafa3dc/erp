import React from 'react';
import { 
  DollarSign, 
  Package, 
  AlertTriangle, 
  ArrowDownUp, 
  TrendingUp, 
  Warehouse, 
  CheckCircle2, 
  ShoppingCart,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { Product, Warehouse as WarehouseType, StockMovement } from '../types/warehouse';
import { localizeWarehouse, localizeUnit } from '../lib/localeHelpers';

interface OverviewTabProps {
  products: Product[];
  warehouses: WarehouseType[];
  movements: StockMovement[];
  lang: 'en' | 'ar';
  onNavigateToProducts: () => void;
  onTriggerReorder: (productName: string) => void;
}

export default function OverviewTab({
  products,
  warehouses,
  movements,
  lang,
  onNavigateToProducts,
  onTriggerReorder
}: OverviewTabProps) {
  const isAr = lang === 'ar';

  // Compute key logistics metrics
  const totalStockValue = products.reduce((acc, p) => acc + (p.costPrice * p.currentStock), 0);
  const totalUnitsInStock = products.reduce((acc, p) => acc + p.currentStock, 0);
  const lowStockItems = products.filter(p => p.currentStock <= p.minStockAlert);
  const outOfStockItems = products.filter(p => p.currentStock === 0);

  return (
    <div className="overview-view fade-in">
      {/* 4 Main KPI Banner Cards */}
      <div className="kpi-banner-grid">
        <div className="app-kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-name">{isAr ? 'إجمالي قيمة المخزون الحقيقي' : 'Total Stock Valuation'}</span>
            <div className="kpi-pill-icon emerald">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="kpi-value">${totalStockValue.toLocaleString()}</div>
          <div className="kpi-footer-meta">
            <TrendingUp size={14} className="trend-icon green" />
            <span className="trend-txt green">+14.2%</span>
            <span className="trend-sub">{isAr ? 'تقييم بسعر التكلفة FIFO' : 'Evaluated via FIFO Cost'}</span>
          </div>
        </div>

        <div className="app-kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-name">{isAr ? 'إجمالي الوحدات والأصناف المخزنة' : 'Total Inventory Units'}</span>
            <div className="kpi-pill-icon blue">
              <Package size={20} />
            </div>
          </div>
          <div className="kpi-value">{totalUnitsInStock.toLocaleString()} <span className="val-unit">{isAr ? 'قطعة' : 'units'}</span></div>
          <div className="kpi-footer-meta">
            <span className="trend-txt blue">{products.length} {isAr ? 'صنف SKU مختلف' : 'distinct SKUs'}</span>
            <span className="trend-sub">{isAr ? 'موزعة عبر 4 مستودعات' : 'across 4 warehouses'}</span>
          </div>
        </div>

        <div className="app-kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-name">{isAr ? 'تنبيهات نقص المخزون' : 'Low Stock Alerts'}</span>
            <div className="kpi-pill-icon amber">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="kpi-value warning-text">{lowStockItems.length} <span className="val-unit">{isAr ? 'أصناف حرجة' : 'items'}</span></div>
          <div className="kpi-footer-meta">
            <span className="badge-warning">{outOfStockItems.length} {isAr ? 'نفد تماماً' : 'out of stock'}</span>
            <span className="trend-sub">{isAr ? 'تتطلب أوامر شراء عاجلة' : 'Immediate PO required'}</span>
          </div>
        </div>

        <div className="app-kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-name">{isAr ? 'حركات المستودعات المنفذة' : 'Warehouse Movements'}</span>
            <div className="kpi-pill-icon indigo">
              <ArrowDownUp size={20} />
            </div>
          </div>
          <div className="kpi-value">{movements.length} <span className="val-unit">{isAr ? 'أذونات' : 'vouchers'}</span></div>
          <div className="kpi-footer-meta">
            <span className="trend-txt indigo">{isAr ? 'إدخال، صرف، ومناقلات' : 'Inbound, Outbound & Transfers'}</span>
          </div>
        </div>
      </div>

      {/* Charts & Warehouses Capacity Grid */}
      <div className="charts-split-grid">
        {/* Logistics Inbound vs Outbound Bar Chart */}
        <div className="chart-card glass-panel">
          <div className="chart-header">
            <div>
              <h3>{isAr ? 'حركة التوريد والصرف اللوجستي (الوحدات / شهر)' : 'Inventory Inflow vs Outflow Velocity'}</h3>
              <p className="chart-sub">{isAr ? 'مقارنة بين البضائع المستلمة والمباعة شهرياً' : 'Monthly Goods Received vs Dispatched'}</p>
            </div>
            <div className="chart-legend">
              <span className="legend-item"><span className="dot blue"></span> {isAr ? 'إدخال وتوريد' : 'Inbound'}</span>
              <span className="legend-item"><span className="dot emerald"></span> {isAr ? 'صرف ومبيعات' : 'Outbound'}</span>
            </div>
          </div>

          <div className="velocity-chart">
            {[
              { month: isAr ? 'مايو' : 'May', in: 140, out: 110 },
              { month: isAr ? 'يونيو' : 'Jun', in: 180, out: 155 },
              { month: isAr ? 'يوليو' : 'Jul', in: 130, out: 125 },
              { month: isAr ? 'أغسطس' : 'Aug', in: 210, out: 190 },
              { month: isAr ? 'سبتمبر' : 'Sep', in: 250, out: 230 },
              { month: isAr ? 'أكتوبر' : 'Oct', in: 290, out: 260 }
            ].map((bar, i) => (
              <div key={i} className="velocity-col">
                <div className="bars-pair">
                  <div className="v-bar in-bar" style={{ height: `${(bar.in / 300) * 100}%` }} title={isAr ? `وارد: ${bar.in}` : `Inbound: ${bar.in}`}></div>
                  <div className="v-bar out-bar" style={{ height: `${(bar.out / 300) * 100}%` }} title={isAr ? `منصرف: ${bar.out}` : `Outbound: ${bar.out}`}></div>
                </div>
                <span className="v-label">{bar.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warehouses Capacity Occupancy */}
        <div className="capacity-card glass-panel">
          <div className="chart-header">
            <h3>{isAr ? 'سعة المستودعات ومعدل الإشغال' : 'Warehouses Occupancy'}</h3>
            <span className="badge badge-primary">{warehouses.length} {isAr ? 'مواقع' : 'locations'}</span>
          </div>

          <div className="capacity-list">
            {warehouses.map(wh => {
              const occupancyPct = Math.round((wh.occupied / wh.capacity) * 100);
              return (
                <div key={wh.id} className="capacity-item">
                  <div className="capacity-meta">
                    <div className="wh-info-box">
                      <Warehouse size={16} className="wh-icon-small" />
                      <strong dir="auto">{wh.nameAr}</strong>
                    </div>
                    <span className="occupancy-pct">{occupancyPct}%</span>
                  </div>
                  <div className="occupancy-progress-bar">
                    <div 
                      className={`occupancy-fill ${occupancyPct > 85 ? 'fill-danger' : occupancyPct > 65 ? 'fill-warning' : 'fill-primary'}`} 
                      style={{ width: `${occupancyPct}%` }}
                    ></div>
                  </div>
                  <div className="capacity-sub-info">
                    <span>{wh.occupied.toLocaleString()} / {wh.capacity.toLocaleString()} {isAr ? 'متر مكعب' : 'm³'}</span>
                    <span>{wh.itemsCount} {isAr ? 'صنف' : 'SKUs'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Critical Reorder Warnings Table */}
      <div className="reorder-alerts-card glass-panel">
        <div className="card-top-flex">
          <div>
            <h3>{isAr ? ' تنبيهات النقص الحرج وإعادة الطلب' : ' Critical Stock Reorder Alerts'}</h3>
            <p className="chart-sub">{isAr ? 'أصناف بلغت الحد الأدنى أو نفدت ويجب إصدار أمر شراء بها فوراً' : 'Items at or below safety stock needing purchase orders'}</p>
          </div>
          <button className="btn-secondary-flat" onClick={onNavigateToProducts}>
            <span>{isAr ? 'عرض دليل البضائع الكامل' : 'View Full Catalog'}</span>
            <ArrowUpRight size={16} />
          </button>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>{isAr ? 'رمز الصنف' : 'SKU'}</th>
                <th>{isAr ? 'اسم المنتج والباركود' : 'Product & Barcode'}</th>
                <th>{isAr ? 'المستودع والموقع' : 'Warehouse & Shelf'}</th>
                <th>{isAr ? 'الرصيد الفعلي' : 'Current Stock'}</th>
                <th>{isAr ? 'حد الأمان الأدنى' : 'Min Safety Stock'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'إجراء عاجل' : 'Quick Action'}</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      {isAr ? 'لا توجد تنبيهات نقص حالياً (المخزون صافٍ)' : 'No low stock alerts recorded'}
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      {isAr ? 'كافة الأصناف المسجلة مستقرة أو النظام في وضع الفحص النظيف' : 'All items are stocked or system is in clean testing mode'}
                    </div>
                  </td>
                </tr>
              ) : (
                lowStockItems.map((p) => (
                  <tr key={p.id}>
                    <td><span className="code-badge">{p.sku}</span></td>
                    <td>
                      <div className="product-info-cell">
                        <strong dir="auto">{p.nameAr}</strong>
                        <span className="barcode-mono">Barcode: {p.barcode}</span>
                      </div>
                    </td>
                    <td>
                      <div dir="auto">{p.warehouseName}</div>
                      <small className="shelf-badge">{isAr ? 'الرف:' : 'Shelf:'} {p.shelf}</small>
                    </td>
                    <td>
                      <span className={`stock-count-highlight ${p.currentStock === 0 ? 'red' : 'orange'}`}>
                        {p.currentStock} {localizeUnit(p.unit, lang)}
                      </span>
                    </td>
                    <td>{p.minStockAlert} {localizeUnit(p.unit, lang)}</td>
                    <td>
                      <span className={`badge ${p.currentStock === 0 ? 'badge-danger' : 'badge-warning'}`}>
                        {p.currentStock === 0 ? (isAr ? 'نافد تماماً' : 'Out of Stock') : (isAr ? 'قرب النفاد' : 'Low Stock')}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn-reorder-action"
                        onClick={() => onTriggerReorder(p.nameAr)}
                      >
                        <ShoppingCart size={14} />
                        <span>{isAr ? 'إصدار أمر شراء توريد' : 'Create PO'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
