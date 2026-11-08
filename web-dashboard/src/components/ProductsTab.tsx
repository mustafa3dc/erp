import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  QrCode, 
  Edit, 
  Trash2, 
  Tag, 
  Layers, 
  ArrowUpDown,
  Barcode,
  Package
} from 'lucide-react';
import { Product } from '../types/warehouse';
import { localizeCategory, localizeWarehouse, localizeUnit } from '../lib/localeHelpers';
import { useSettings } from '../context/settings-context';

interface ProductsTabProps {
  products: Product[];
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  lang: 'en' | 'ar';
  onQuickScanSimulate: (barcode: string) => void;
  canViewCostPrice?: boolean;
  isReadOnly?: boolean;
}

export default function ProductsTab({
  products,
  onOpenAddModal,
  onOpenScanner,
  lang,
  onQuickScanSimulate,
  canViewCostPrice = true,
  isReadOnly = false
}: ProductsTabProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const categories = Array.from(new Set(products.map(p => p.category)));

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.nameAr.toLowerCase().includes(search.toLowerCase()) ||
      p.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);

    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesCat && matchesStatus;
  });

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['SKU', 'Barcode', 'Name Ar', 'Category', 'Cost Price', 'Selling Price', 'Stock', 'Warehouse', 'Status'];
    const rows = filteredProducts.map(p => [
      p.sku,
      p.barcode,
      `"${p.nameAr}"`,
      `"${p.category}"`,
      p.costPrice,
      p.sellingPrice,
      p.currentStock,
      `"${p.warehouseName}"`,
      p.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `inventory_stock_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="products-view fade-in">
      {/* Search & Actions Toolbar */}
      <div className="section-toolbar glass-panel">
        <div className="toolbar-left">
          <div className="filter-input-wrap">
            <Search size={18} />
            <input 
              type="text" 
              placeholder={isAr ? 'بحث بالاسم، رمز SKU، أو مسح الباركود...' : 'Search by name, SKU, or scan barcode...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-dropdown-wrap">
            <Layers size={16} />
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="ALL">{isAr ? 'جميع التصنيفات' : 'All Categories'}</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="filter-dropdown-wrap">
            <Filter size={16} />
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">{isAr ? 'حالة المخزون (الكل)' : 'Stock Status (All)'}</option>
              <option value="available">{isAr ? 'متوفر' : 'Available'}</option>
              <option value="low">{isAr ? 'قرب النفاد (حد الطلب)' : 'Low Stock'}</option>
              <option value="out_of_stock">{isAr ? 'نافد تماماً' : 'Out of Stock'}</option>
            </select>
          </div>
        </div>

        <div className="toolbar-right">
          {!isReadOnly && (
            <button className="btn-add-primary" onClick={onOpenAddModal}>
              <Plus size={16} />
              <span>{isAr ? 'إضافة صنف جديد' : 'New Product'}</span>
            </button>
          )}

          <button className="btn-secondary-flat" onClick={onOpenScanner}>
            <QrCode size={16} />
            <span>{isAr ? 'ماسح الباركود' : 'Barcode Scanner'}</span>
          </button>

          <button className="btn-secondary-flat" onClick={handleExportCSV}>
            <Download size={16} />
            <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* RBAC Security Banner for Cashier / Read-Only */}
      {isReadOnly && (
        <div style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '10px',
          padding: '10px 16px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '12px',
          color: 'var(--primary)'
        }}>
          <Tag size={16} />
          <span>
            {isAr
              ? ' صلاحية استعلام وبحث فقط لموظفي البيع/الكاشير للتحقق من التوفر وسعر البيع — تم حجب أسعار التكلفة وهوامش الأرباح لحماية السرية التجارية.'
              : ' View-Only Mode for Cashiers: Retail prices and stock lookup active. Cost prices and profit margins are masked for privacy.'}
          </span>
        </div>
      )}

      {/* Products Inventory Table */}
      <div className="table-responsive glass-panel table-container-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>{isAr ? 'رمز الصنف' : 'SKU'}</th>
              <th>{isAr ? 'الباركود' : 'Barcode'}</th>
              <th>{isAr ? 'اسم المنتج والتصنيف' : 'Product & Category'}</th>
              <th>{isAr ? 'سعر التكلفة' : 'Cost Price'}</th>
              <th>{isAr ? 'سعر البيع' : 'Selling Price'}</th>
              <th>{isAr ? 'هامش الربح' : 'Margin'}</th>
              <th>{isAr ? 'الرصيد الفعلي' : 'Current Stock'}</th>
              <th>{isAr ? 'المستودع والرف' : 'Warehouse & Shelf'}</th>
              <th>{isAr ? 'الحالة' : 'Status'}</th>
              <th>{isAr ? 'مسح سريع' : 'Quick Scan'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              const profitMargin = Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100);
              return (
                <tr key={p.id}>
                  <td><span className="code-badge">{p.sku}</span></td>
                  <td>
                    <div className="barcode-click-wrap" onClick={() => onQuickScanSimulate(p.barcode)} title="انقر لمحاكاة مسح هذا الباركود">
                      <Barcode size={16} className="barcode-icon" />
                      <span className="barcode-mono">{p.barcode}</span>
                    </div>
                  </td>
                  <td>
                    <div className="product-title-cell">
                      <strong dir="auto">{p.nameAr}</strong>
                      <span className="category-pill">{localizeCategory(p.category, lang)}</span>
                    </div>
                  </td>
                  <td>
                    {canViewCostPrice ? (
                      formatMoney(p.costPrice)
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '11px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '3px' }}>
                         {isAr ? 'محجوب' : 'Masked'}
                      </span>
                    )}
                  </td>
                  <td><strong className="selling-price">{formatMoney(p.sellingPrice)}</strong></td>
                  <td>
                    {canViewCostPrice ? (
                      <span className="margin-pill green">+{profitMargin}%</span>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '11px' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div className="stock-level-cell">
                      <strong className={`stock-number ${p.currentStock <= p.minStockAlert ? 'text-warning' : ''}`}>
                        {p.currentStock} {localizeUnit(p.unit, lang)}
                      </strong>
                      <small className="min-alert-text">{isAr ? 'حد الطلب:' : 'Min:'} {p.minStockAlert}</small>
                    </div>
                  </td>
                  <td>
                    <div className="warehouse-shelf-cell">
                      <span dir="auto">{p.warehouseName}</span>
                      <small className="shelf-badge">{p.shelf}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${p.status === 'available' ? 'badge-success' : p.status === 'low' ? 'badge-warning' : 'badge-danger'}`}>
                      {p.status === 'available' ? (isAr ? 'متوفر' : 'Available') : p.status === 'low' ? (isAr ? 'حد الطلب' : 'Low Stock') : (isAr ? 'نافد' : 'Out of Stock')}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn-scan-trigger" 
                      onClick={() => onQuickScanSimulate(p.barcode)}
                      title="محاكاة مسح الصنف"
                    >
                      <QrCode size={14} />
                      <span>{isAr ? 'مسح' : 'Scan'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <Package size={40} style={{ margin: '0 auto 12px', display: 'block', color: '#cbd5e1' }} />
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>
              {products.length === 0
                ? (isAr ? 'دليل المواد فارغ تماماً (0 مواد)' : 'Catalog is completely clean (0 items)')
                : (isAr ? 'لم يتم العثور على بضائع تطابق البحث' : 'No items match your filter')}
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {products.length === 0
                ? (isAr ? 'النظام صافٍ وجاهز للبدء وإدخال أصناف جديدة أو تسجيل فواتير المشتريات والتوريد' : 'System is clean and ready for new items or inward purchase bills')
                : (isAr ? 'جرّب تعديل كلمات البحث أو اختيار مستودع آخر' : 'Try adjusting your search terms or selecting another warehouse')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
