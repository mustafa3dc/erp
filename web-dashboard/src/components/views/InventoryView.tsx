import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, Eye, EyeOff, X, Package, Layers, AlertTriangle, 
  AlertOctagon, DollarSign, CheckCircle2, LayoutGrid, List, MapPin, 
  TrendingUp, Download, Printer, Copy, Check, ChevronDown, ChevronUp,
  Edit3, History, ArrowLeftRight, ChevronLeft, ChevronRight, Filter,
  Tag, Shield, Lock, Unlock, Barcode as BarcodeIcon, Building2,
  ArrowUpDown, ArrowUp, ArrowDown, FolderTree, Trash2, Scale
} from 'lucide-react';
import { Product, Warehouse } from '../../types/warehouse';
import { TransactionDetail } from '../TransactionModal';
import EditProductModal from '../modals/EditProductModal';
import StockHistoryModal from '../modals/StockHistoryModal';
import BatchPrintLabelsModal from '../modals/BatchPrintLabelsModal';
import ManageCategoriesModal from '../modals/ManageCategoriesModal';
import StockAdjustmentModal from '../modals/StockAdjustmentModal';
import { localizeCategory, localizeWarehouse, localizeUnit } from '../../lib/localeHelpers';
import { useSettings } from '../../context/settings-context';
import { usePermissions } from '../../hooks/usePermissions';
import { saveStoredProducts } from '../../services/storageService';

interface InventoryViewProps {
  products: Product[];

  lang: 'en' | 'ar';
  onOpenAddModal: (preselectedWarehouseId?: string) => void;
  onOpenProductDetails: (product: Product) => void;
  onOpenQuickTransfer?: (product: Product) => void;
  onUpdateProducts?: (products: Product[]) => void;
  transactions?: TransactionDetail[];
  canViewCostPrice?: boolean;
  isReadOnly?: boolean;
  selectedWarehouseId?: string;
  onSelectWarehouse?: (warehouseId: string) => void;
  onEditWarehouse?: (warehouseId: string) => void;
  warehouses?: Warehouse[];
}

export default function InventoryView({ 
  products, 
  lang, 
  onOpenAddModal, 
  onOpenProductDetails,
  onOpenQuickTransfer,
  onUpdateProducts,
  transactions = [],
  canViewCostPrice = true,
  isReadOnly = false,
  selectedWarehouseId = 'ALL',
  onSelectWarehouse,
  onEditWarehouse,
  warehouses = []
}: InventoryViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney, currencySymbol } = useSettings();
  const { hasPermission } = usePermissions();

  const handleDeleteProduct = async (product: Product) => {
    if (!hasPermission('inventory.items.delete')) {
      alert(isAr ? 'ليس لديك صلاحية حذف الأصناف' : 'Permission denied: cannot delete products');
      return;
    }
    const confirmed = window.confirm(
      isAr 
        ? `هل أنت متأكد من حذف الصنف (${product.nameAr}) نهائياً؟`
        : `Are you sure you want to delete ${product.nameEn || product.nameAr}?`
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
      await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
    } catch {
      // offline resilience fallback
    }

    const nextProducts = products.filter(item => item.id !== product.id);
    saveStoredProducts(nextProducts);
    if (onUpdateProducts) {
      onUpdateProducts(nextProducts);
    }
  };

  // 1. Critical Financial Security: Hide Cost & Margin by default; permanently locked if not permitted
  const [showCostMargin, setShowCostMargin] = useState<boolean>(false);
  const effectiveShowCostMargin = canViewCostPrice ? showCostMargin : false;


  // 2. Search & Category Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [categorySearchText, setCategorySearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'LOW' | 'OUT'>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // 3. Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchPrintOpen, setIsBatchPrintOpen] = useState(false);
  const [isBulkCatModalOpen, setIsBulkCatModalOpen] = useState(false);
  const [targetBulkCategory, setTargetBulkCategory] = useState('');

  // 4. Multi-Warehouse Breakdown Drawer
  const [expandedBreakdownId, setExpandedBreakdownId] = useState<string | null>(null);

  // 5. Sorting & Pagination
  const [sortKey, setSortKey] = useState<'name' | 'stock' | 'price' | 'category'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // 6. Row Action Modals State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [copiedCode, setCopiedCode] = useState<string>('');

  // Active warehouse object for isolation banner and specs
  const activeWh = useMemo(() => {
    if (!selectedWarehouseId || selectedWarehouseId === 'ALL') return null;
    return warehouses.find(w => w.id === selectedWarehouseId) || null;
  }, [warehouses, selectedWarehouseId]);

  // Products strictly isolated to the selected warehouse (or all if ALL selected)
  const baseProducts = useMemo(() => {
    if (!selectedWarehouseId || selectedWarehouseId === 'ALL') return products;
    return products.filter(p => p.warehouseId === selectedWarehouseId);
  }, [products, selectedWarehouseId]);

  const categories = useMemo(() => {
    const rawCats = Array.from(new Set(baseProducts.map(p => p.category)));
    return rawCats.map(c => ({
      raw: c,
      label: localizeCategory(c, lang)
    }));
  }, [baseProducts, lang]);

  // Copy helper with feedback
  const handleCopyCode = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  // Multi-Warehouse real allocation lookup
  const getWarehouseBreakdown = (p: Product) => {
    const matchingProducts = products.filter(item => item.sku === p.sku || item.id === p.id);
    const totalMatchingStock = matchingProducts.reduce((sum, item) => sum + item.currentStock, 0);

    return matchingProducts.map(item => {
      const wh = warehouses.find(w => w.id === item.warehouseId);
      const whName = item.warehouseName || wh?.nameAr || item.warehouseId;
      const pct = totalMatchingStock > 0 ? Math.round((item.currentStock / totalMatchingStock) * 100) : 100;
      return {
        id: item.warehouseId,
        name: whName,
        shelf: item.shelf || 'A-01',
        stock: item.currentStock,
        percent: pct
      };
    });
  };

  // Filtered list
  const filtered = useMemo(() => {
    return baseProducts.filter(p => {
      const term = searchTerm.toLowerCase().trim();
      const catLoc = localizeCategory(p.category, lang).toLowerCase();
      const whLoc = localizeWarehouse(p.warehouseName, lang).toLowerCase();
      const matchesSearch = 
        !term ||
        p.nameAr.toLowerCase().includes(term) ||
        p.nameEn.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.barcode.includes(term) ||
        catLoc.includes(term) ||
        whLoc.includes(term);

      const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;

      let matchesStatus = true;
      if (statusFilter === 'AVAILABLE') {
        matchesStatus = p.currentStock > p.minStockAlert;
      } else if (statusFilter === 'LOW') {
        matchesStatus = p.currentStock <= p.minStockAlert && p.currentStock > 0;
      } else if (statusFilter === 'OUT') {
        matchesStatus = p.currentStock <= 0;
      }

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [baseProducts, searchTerm, categoryFilter, statusFilter, lang]);

  // Sorted list
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let result = 0;
      if (sortKey === 'name') {
        const nameA = a.nameAr;
        const nameB = b.nameAr;
        result = nameA.localeCompare(nameB, 'ar');
      } else if (sortKey === 'stock') {
        result = a.currentStock - b.currentStock;
      } else if (sortKey === 'price') {
        result = a.sellingPrice - b.sellingPrice;
      } else if (sortKey === 'category') {
        result = a.category.localeCompare(b.category);
      }
      return sortDirection === 'asc' ? result : -result;
    });
  }, [filtered, sortKey, sortDirection, isAr]);

  // Paginated list
  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sorted.slice(startIndex, startIndex + pageSize);
  }, [sorted, currentPage, pageSize]);

  // Sorting header click
  const handleSort = (key: 'name' | 'stock' | 'price' | 'category') => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Bulk selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginated.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    const targetProducts = selectedIds.length > 0 
      ? products.filter(p => selectedIds.includes(p.id)) 
      : sorted;

    const headers = isAr ? [
      'رمز SKU', 'الباركود', 'اسم الصنف', 'التصنيف', 'الرصيد الحالي', 'الوحدة', 'سعر البيع ($)', 'المستودع', 'الرف'
    ] : [
      'SKU Code', 'Barcode', 'Product Name', 'Category', 'Current Stock', 'Unit', 'Selling Price ($)', 'Warehouse Location', 'Shelf Bin'
    ];

    const rows = [
      headers,
      ...targetProducts.map(p => [
        p.sku,
        p.barcode,
        `"${p.nameAr}"`,
        `"${localizeCategory(p.category, lang)}"`,
        p.currentStock,
        `"${localizeUnit(p.unit, lang)}"`,
        p.sellingPrice.toFixed(2),
        `"${p.warehouseName}"`,
        `"${p.shelf}"`
      ])
    ];

    const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to PDF / Print sheet
  const handleExportPdf = () => {
    window.print();
  };

  // Single thermal sticker print helper
  const handlePrintSingleLabel = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) return;

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Label - ${p.sku}</title>
        <style>
          @page { size: 70mm 50mm; margin: 0; }
          body { font-family: system-ui, sans-serif; margin: 0; padding: 6mm; text-align: center; }
          .brand { font-size: 8px; font-weight: bold; letter-spacing: 1px; color: #555; }
          .title { font-size: 11px; font-weight: bold; margin: 4px 0; }
          .sku { font-size: 9px; font-family: monospace; }
          .barcode-wrap { margin: 6px 0; }
          .barcode-num { font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 2px; }
          .loc { font-size: 8px; color: #444; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="brand">LOGISTOCK ERP • WAREHOUSE</div>
        <div class="title" dir="auto">${p.nameAr}</div>
        <div class="sku">SKU: <strong>${p.sku}</strong> | REF: ${p.shelf}</div>
        <div class="barcode-wrap">
          <svg viewBox="0 0 100 28" width="80%" height="38" preserveAspectRatio="none">
            <rect width="100%" height="100%" fill="#fff"/>
            <path d="M4 0h2v28H4z M8 0h3v28H8z M13 0h1v28h-1z M16 0h4v28h-4z M22 0h2v28h-2z M26 0h1v28h-1z M29 0h3v28h-3z M34 0h2v28h-2z M38 0h4v28h-4z M44 0h1v28h-1z M47 0h3v28h-3z M52 0h2v28h-2z M56 0h4v28h-4z M62 0h1v28h-1z M65 0h2v28h-2z M69 0h3v28h-3z M74 0h2v28h-2z M78 0h4v28h-4z M84 0h1v28h-1z M87 0h3v28h-3z M92 0h2v28h-2z M96 0h2v28h-2z" fill="#000"/>
          </svg>
        </div>
        <div class="barcode-num">${p.barcode}</div>
        <div class="loc">LOC: ${p.warehouseName} [${p.shelf}]</div>
      </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => document.body.removeChild(printFrame), 1000);
    }, 250);
  };

  // Bulk Category Update
  const handleApplyBulkCategory = () => {
    if (!targetBulkCategory || selectedIds.length === 0 || !onUpdateProducts) return;
    const updated = products.map(p => {
      if (selectedIds.includes(p.id)) {
        return { ...p, category: targetBulkCategory, updatedAt: new Date().toISOString().slice(0, 10) };
      }
      return p;
    });
    saveStoredProducts(updated);
    onUpdateProducts(updated);
    setIsBulkCatModalOpen(false);
    setSelectedIds([]);
  };

  // Handle saving product edit
  const handleSaveProductEdit = (updatedProduct: Product) => {
    if (onUpdateProducts) {
      const updatedList = products.map(p => p.id === updatedProduct.id ? updatedProduct : p);
      saveStoredProducts(updatedList);
      onUpdateProducts(updatedList);
    }
  };

  // KPI calculations (strictly scoped to the currently active warehouse isolation)
  const totalValuation = baseProducts.reduce((sum, p) => sum + (p.currentStock * p.sellingPrice), 0);
  const totalUnits = baseProducts.reduce((sum, p) => sum + p.currentStock, 0);
  const lowStockCount = baseProducts.filter(p => p.currentStock <= p.minStockAlert && p.currentStock > 0).length;
  const outOfStockCount = baseProducts.filter(p => p.currentStock <= 0).length;
  const availableCount = baseProducts.filter(p => p.currentStock > p.minStockAlert).length;

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {/* 1. Top Header Bar: Clean Corporate Card */}
      <div className="view-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Package size={22} />
          </div>
          <div>
            <h2 className="view-title">
              {isAr ? 'دليل البضائع والمخزون' : 'Inventory & Items Catalog'}
            </h2>
            <p className="view-subtitle">
              {isAr ? 'كتالوج الأصناف والأسعار، تتبع الأرصدة، وعزل المخزون حسب كل مستودع وفرع' : 'Central catalog for SKUs, pricing, safety stock, and strict per-warehouse inventory isolation'}
            </p>
          </div>
        </div>

        <div className="view-header-actions">
          {!isReadOnly && hasPermission('inventory.items.create') && (
            <button 
              type="button" 
              className="btn-add-primary" 
              onClick={() => onOpenAddModal(selectedWarehouseId !== 'ALL' ? selectedWarehouseId : undefined)}
              title={activeWh ? (isAr ? `إضافة بضاعة مباشرة إلى ${activeWh.nameAr}` : `Add item directly to ${activeWh.nameAr}`) : undefined}
            >
              <Plus size={15} />
              <span>{activeWh ? (isAr ? `إضافة بضاعة لـ ${activeWh.nameAr}` : `Add to ${activeWh.nameEn || activeWh.nameAr}`) : (isAr ? 'إضافة صنف جديد' : 'New Item')}</span>
            </button>
          )}
          <button type="button" className="btn-secondary-flat" onClick={handleExportPdf} title={isAr ? 'طباعة وحفظ كتقرير' : 'Print / Export PDF'}>

            <Printer size={15} />
            <span>{isAr ? 'طباعة التقرير' : 'Export PDF'}</span>
          </button>
          <button type="button" className="btn-secondary-flat" onClick={handleExportExcel} title={isAr ? 'تصدير كامل بيانات الأصناف لملف إكسل' : 'Export catalog to Excel'}>
            <Download size={15} />
            <span>{isAr ? 'تصدير إكسل' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* RBAC Mode Notice for Cashiers */}
      {isReadOnly && (
        <div style={{
          background: 'var(--primary-light)',
          border: '1px solid var(--primary-border)',
          borderRadius: '10px',
          padding: '10px 16px',
          margin: '0 0 16px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '12px',
          color: 'var(--primary)'
        }}>
          <Tag size={16} />
          <span>
            {isAr
              ? 'وضع الكاشير وموظف البيع: صلاحية بحث وعرض فقط للتأكد من التوفر وسعر البيع — تم حجب أسعار التكلفة وأوامر التعديل لحماية السرية التجارية.'
              : 'Cashier Catalog View: Search & stock lookup mode active. Cost prices and editing controls are masked for privacy.'}
          </span>
        </div>
      )}

      {/* Multi-Warehouse Stock Isolation Selector Bar (Sleek Compact Enterprise) */}
      <div className="wh-isolation-selector-panel">
        <div className="wh-isolation-title-group">
          <div className="wh-isolation-icon-box">
            <Building2 size={16} />
          </div>
          <span className="wh-isolation-title">
            {isAr ? 'عزل المخزون حسب المستودع:' : 'Filter by Warehouse:'}
          </span>
          {activeWh && selectedWarehouseId !== 'ALL' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span className="wh-isolation-active-badge">
                <CheckCircle2 size={12} />
                <span dir="auto">{isAr ? `مستودع نشط: [${activeWh.nameAr}]` : `Active: [${activeWh.nameAr}]`}</span>
              </span>
              {onEditWarehouse && (
                <button
                  type="button"
                  onClick={() => onEditWarehouse(activeWh.id)}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '3px 9px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                  title={isAr ? `تعديل مواصفات وبيانات مستودع ${activeWh.nameAr}` : `Edit ${activeWh.nameAr}`}
                >
                  <Edit3 size={12} />
                  <span>{isAr ? 'تعديل هذا المستودع' : 'Edit Hub'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Warehouse Quick Pills Switcher */}
        <div className="wh-pills-container">
          {/* ALL Warehouses Pill */}
          <button
            type="button"
            className={`wh-pill-btn ${(!selectedWarehouseId || selectedWarehouseId === 'ALL') ? 'active' : ''}`}
            onClick={() => onSelectWarehouse && onSelectWarehouse('ALL')}
          >
            <span>{isAr ? 'كافة المستودعات' : 'All Warehouses'}</span>
            <span className="wh-pill-badge">{products.length}</span>
          </button>

          {/* Each individual warehouse */}
          {warehouses.map(w => {
            const isSelected = selectedWarehouseId === w.id;
            const hubCount = products.filter(p => p.warehouseId === w.id).length;

            return (
              <button
                key={w.id}
                type="button"
                className={`wh-pill-btn ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectWarehouse && onSelectWarehouse(w.id)}
              >
                <span dir="auto">{w.nameAr}</span>
                <span className="wh-pill-badge">{hubCount}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top KPI Metrics Row (Balanced CSS Grid with Clean Soft Icon Boxes) */}
      <div className="inventory-kpi-row">
        <div className="inv-kpi-card">
          <div className="inv-kpi-data">
            <span className="inv-kpi-label">{isAr ? 'إجمالي الأصناف والوحدات' : 'Isolated SKUs'}</span>
            <div className="inv-kpi-val-row">
              <span className="inv-kpi-val"><bdi dir="ltr">{baseProducts.length}</bdi></span>
              <span className="inv-kpi-unit">{isAr ? 'صنف' : 'SKUs'}</span>
            </div>
            <span className="inv-kpi-sub">
              (<bdi dir="ltr">{totalUnits.toLocaleString()}</bdi> {isAr ? 'وحدة مسجلة بالمخزن' : 'units in stock'})
            </span>
          </div>
          <div className="inv-kpi-icon-box cyan">
            <Package size={22} />
          </div>
        </div>

        <div className="inv-kpi-card">
          <div className="inv-kpi-data">
            <span className="inv-kpi-label">{isAr ? 'إجمالي تقييم المخزون' : 'Inventory Valuation'}</span>
            <div className="inv-kpi-val-row">
              <span className="inv-kpi-val text-emerald">
                <bdi dir="ltr">{formatMoney(totalValuation, true)}</bdi>
              </span>
            </div>
            <span className="inv-kpi-sub">
              {effectiveShowCostMargin ? (isAr ? 'تقييم بسعر التكلفة' : 'At Cost Price') : (isAr ? 'مُقدّر بسعر البيع المعتمد' : 'At Retail Value')}
            </span>
          </div>
          <div className="inv-kpi-icon-box emerald">
            <DollarSign size={22} />
          </div>
        </div>

        <div 
          className={`inv-kpi-card clickable ${statusFilter === 'LOW' ? 'active-filter-low' : ''}`} 
          onClick={() => setStatusFilter(statusFilter === 'LOW' ? 'ALL' : 'LOW')} 
          title={isAr ? 'تصفية الأصناف قرب النفاد' : 'Filter low stock items'}
        >
          <div className="inv-kpi-data">
            <span className="inv-kpi-label">{isAr ? 'أصناف قرب النفاد' : 'Low Stock Warning'}</span>
            <div className="inv-kpi-val-row">
              <span className="inv-kpi-val text-amber"><bdi dir="ltr">{lowStockCount}</bdi></span>
              <span className="inv-kpi-unit text-amber">{isAr ? 'أصناف' : 'items'}</span>
            </div>
            <span className="inv-kpi-sub">{isAr ? 'تحت حد الأمان المطلوب' : 'Below safety limit'}</span>
          </div>
          <div className="inv-kpi-icon-box amber">
            <AlertTriangle size={22} />
          </div>
        </div>

        <div 
          className={`inv-kpi-card clickable ${statusFilter === 'OUT' ? 'active-filter-out' : ''}`} 
          onClick={() => setStatusFilter(statusFilter === 'OUT' ? 'ALL' : 'OUT')} 
          title={isAr ? 'تصفية الأصناف نافدة الرصيد' : 'Filter out of stock items'}
        >
          <div className="inv-kpi-data">
            <span className="inv-kpi-label">{isAr ? 'أصناف نافدة الرصيد' : 'Out of Stock'}</span>
            <div className="inv-kpi-val-row">
              <span className="inv-kpi-val text-red"><bdi dir="ltr">{outOfStockCount}</bdi></span>
              <span className="inv-kpi-unit text-red">{isAr ? 'صنف' : 'items'}</span>
            </div>
            <span className="inv-kpi-sub">{isAr ? 'الرصيد صفر - بحاجة لتوريد' : 'Needs restock'}</span>
          </div>
          <div className="inv-kpi-icon-box red">
            <AlertOctagon size={22} />
          </div>
        </div>
      </div>

      {/* 2. Modern Filter & Search Panel with Searchable Category Dropdown */}
      <div className="inventory-filter-panel">
        <div className="inventory-search-row">
          <div className="inventory-search-input-box">
            <Search size={18} className="search-icon text-muted" />
            <input 
              type="text" 
              className="inventory-search-field"
              placeholder={isAr ? 'ابحث باسم المنتج، رقم الباركود، رمز SKU، أو المستودع...' : 'Search by item name, barcode, SKU, or warehouse...'}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button 
                type="button" 
                className="clear-search-btn" 
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Searchable Category Selector Dropdown (Replaces horizontal pills) */}
          <div className="category-dropdown-wrap">
            <button 
              type="button" 
              className="category-dropdown-trigger"
              onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag size={14} style={{ color: 'var(--primary)' }} />
                <span>
                  {categoryFilter === 'ALL' 
                    ? (isAr ? 'جميع التصنيفات' : 'All Categories') 
                    : localizeCategory(categoryFilter, lang)}
                </span>
              </div>
              <ChevronDown size={14} className="text-muted" />
            </button>

            {isCatDropdownOpen && (
              <div className="category-dropdown-menu fade-in">
                <input 
                  type="text"
                  className="category-search-inside"
                  placeholder={isAr ? 'ابحث عن تصنيف...' : 'Search category...'}
                  value={categorySearchText}
                  onChange={(e) => setCategorySearchText(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div 
                  className={`category-dropdown-item ${categoryFilter === 'ALL' ? 'selected' : ''}`}
                  onClick={() => {
                    setCategoryFilter('ALL');
                    setIsCatDropdownOpen(false);
                    setCurrentPage(1);
                  }}
                >
                  <span>{isAr ? 'جميع التصنيفات' : 'All Categories'}</span>
                  <span className="category-badge-count">{products.length}</span>
                </div>
                {categories
                  .filter(c => c.label.toLowerCase().includes(categorySearchText.toLowerCase()) || c.raw.toLowerCase().includes(categorySearchText.toLowerCase()))
                  .map(cat => {
                    const count = products.filter(p => p.category === cat.raw).length;
                    return (
                      <div 
                        key={cat.raw}
                        className={`category-dropdown-item ${categoryFilter === cat.raw ? 'selected' : ''}`}
                        onClick={() => {
                          setCategoryFilter(cat.raw);
                          setIsCatDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                      >
                        <span>{cat.label}</span>
                        <span className="category-badge-count">{count}</span>
                      </div>
                    );
                  })}
                <div 
                  className="category-dropdown-manage-action"
                  onClick={() => {
                    setIsCatDropdownOpen(false);
                    setIsManageCategoriesOpen(true);
                  }}
                  style={{
                    borderTop: '1px solid var(--border)',
                    padding: '8px 12px',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    background: 'var(--primary-light)',
                    borderRadius: '0 0 6px 6px'
                  }}
                >
                  <FolderTree size={14} />
                  <span>{isAr ? 'إدارة وتعديل أسماء التصنيفات' : 'Manage & Rename Categories'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Manage Categories Trigger Button */}
          <button
            type="button"
            className="category-manage-btn"
            onClick={() => setIsManageCategoriesOpen(true)}
            title={isAr ? 'إدارة وتعديل أسماء التصنيفات' : 'Manage Categories'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--primary)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <FolderTree size={15} />
            <span>{isAr ? 'تعديل التصنيفات' : 'Categories'}</span>
          </button>

          {/* Quick Status Filter Tabs (Modern Pill Chips) */}
          <div className="inventory-status-chips">
            <button 
              type="button"
              className={`status-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
            >
              <span>{isAr ? 'الكل' : 'All'}</span>
              <bdi className="chip-counter" dir="ltr">{products.length}</bdi>
            </button>
            <button 
              type="button"
              className={`status-chip chip-available ${statusFilter === 'AVAILABLE' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('AVAILABLE'); setCurrentPage(1); }}
            >
              <span className="chip-dot available"></span>
              <span>{isAr ? 'متوفر' : 'Available'}</span>
              <bdi className="chip-counter" dir="ltr">{availableCount}</bdi>
            </button>
            <button 
              type="button"
              className={`status-chip chip-low ${statusFilter === 'LOW' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('LOW'); setCurrentPage(1); }}
            >
              <span className="chip-dot low"></span>
              <span>{isAr ? 'قرب النفاد' : 'Low'}</span>
              <bdi className="chip-counter" dir="ltr">{lowStockCount}</bdi>
            </button>
            <button 
              type="button"
              className={`status-chip chip-out ${statusFilter === 'OUT' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('OUT'); setCurrentPage(1); }}
            >
              <span className="chip-dot out"></span>
              <span>{isAr ? 'نافد' : 'Out'}</span>
              <bdi className="chip-counter" dir="ltr">{outOfStockCount}</bdi>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="inv-controls-right">
            <div className="view-mode-toggle">
              <button 
                type="button" 
                className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title={isAr ? 'عرض جدول متناسق' : 'Balanced Table View'}
              >
                <List size={15} />
                <span>{isAr ? 'جدول' : 'Table'}</span>
              </button>
              <button 
                type="button" 
                className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title={isAr ? 'عرض كروت شبكية' : 'Grid Cards View'}
              >
                <LayoutGrid size={15} />
                <span>{isAr ? 'كروت' : 'Cards'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sticky Bulk Actions Bar (Appears when items are selected) */}
      {selectedIds.length > 0 && (
        <div className="bulk-actions-bar">
          <div className="bulk-count-badge">
            <CheckCircle2 size={16} className="text-emerald" />
            <span>{isAr ? `تم تحديد ${selectedIds.length} صنف من الجدول` : `${selectedIds.length} items selected`}</span>
          </div>

          <div className="bulk-buttons-group">
            <button 
              type="button" 
              className="btn-bulk-action primary"
              onClick={() => setIsBatchPrintOpen(true)}
            >
              <BarcodeIcon size={14} />
              <span>{isAr ? 'طباعة باركودات دفعة واحدة' : 'Batch Print Labels'}</span>
            </button>
            <button 
              type="button" 
              className="btn-bulk-action"
              onClick={handleExportExcel}
            >
              <Download size={14} />
              <span>{isAr ? 'تصدير المحدد' : 'Export Selected'}</span>
            </button>
            <button 
              type="button" 
              className="btn-bulk-action"
              onClick={() => setIsBulkCatModalOpen(true)}
            >
              <Tag size={14} />
              <span>{isAr ? 'تغيير التصنيف للمحدد' : 'Bulk Category Change'}</span>
            </button>
            <button 
              type="button" 
              className="btn-bulk-action"
              onClick={() => setSelectedIds([])}
            >
              <X size={14} />
              <span>{isAr ? 'إلغاء التحديد' : 'Deselect All'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. MAIN VIEW CONTENT: Seamless Table with Security & Actions */}
      {viewMode === 'table' ? (
        <div className="inventory-table-card">
          <div className="table-responsive-wrapper">
            <table className="inventory-master-table balanced-fit-table">
              <thead>
                <tr>
                  {/* Bulk Select Checkbox Column */}
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox"
                      checked={paginated.length > 0 && paginated.every(p => selectedIds.includes(p.id))}
                      onChange={handleSelectAll}
                      title={isAr ? 'تحديد جميع أصناف الصفحة الحالية' : 'Select all page items'}
                    />
                  </th>
                  <th className="th-product th-sortable" onClick={() => handleSort('name')}>
                    <span className="th-sort-flex">
                      <span>{isAr ? 'الصنف والرمز والباركود' : 'Product & Identifiers'}</span>
                      <span className="sort-arrows-icon">
                        {sortKey === 'name' ? (
                          sortDirection === 'asc' ? <ArrowUp size={12} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={12} style={{ color: 'var(--primary)' }} />
                        ) : (
                          <ArrowUpDown size={12} style={{ color: '#94a3b8' }} />
                        )}
                      </span>
                    </span>
                  </th>
                  <th className="th-cat th-sortable" onClick={() => handleSort('category')}>
                    <span className="th-sort-flex">
                      <span>{isAr ? 'التصنيف' : 'Category'}</span>
                      <span className="sort-arrows-icon">
                        {sortKey === 'category' ? (
                          sortDirection === 'asc' ? <ArrowUp size={12} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={12} style={{ color: 'var(--primary)' }} />
                        ) : (
                          <ArrowUpDown size={12} style={{ color: '#94a3b8' }} />
                        )}
                      </span>
                    </span>
                  </th>
                  <th className="th-location">
                    <span>{isAr ? 'المستودع وتوزيع الأرفف' : 'Warehouse & Multi-Hub Shelf'}</span>
                  </th>
                  {/* Financial Security Column with Eye Toggle */}
                  <th className="th-price">
                    <div className="th-price-header-flex">
                      <span className="th-sortable" onClick={() => handleSort('price')}>
                        <span className="th-sort-flex">
                          <span>{isAr ? `سعر البيع المعتمد (${currencySymbol})` : `Selling Price (${currencySymbol})`}</span>
                          <span className="sort-arrows-icon">
                            {sortKey === 'price' ? (
                              sortDirection === 'asc' ? <ArrowUp size={12} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={12} style={{ color: 'var(--primary)' }} />
                            ) : (
                              <ArrowUpDown size={12} style={{ color: '#94a3b8' }} />
                            )}
                          </span>
                        </span>
                      </span>
                      {canViewCostPrice ? (
                        <button 
                          type="button" 
                          className="btn-toggle-eye" 
                          onClick={() => setShowCostMargin(!showCostMargin)}
                          title={effectiveShowCostMargin 
                            ? (isAr ? 'حظر تسريب التكلفة وهامش الربح' : 'Hide Cost & Margin (Security)') 
                            : (isAr ? 'كشف سعر التكلفة والأرباح (صلاحيات المدير/المحاسب)' : 'Show Cost & Margin (Admin/Finance)')}
                        >
                          {effectiveShowCostMargin ? <Eye size={14} style={{ color: 'var(--primary)' }} /> : <EyeOff size={14} />}
                        </button>
                      ) : (
                        <span 
                          className="btn-toggle-eye" 
                          style={{ opacity: 0.5, cursor: 'not-allowed' }}
                          title={isAr ? 'حجب التكلفة مفعل وفق صلاحيات هذا الحساب' : 'Cost masking active for this account'}
                        >
                          <Lock size={12} style={{ color: '#f59e0b' }} />
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="th-stock th-sortable" onClick={() => handleSort('stock')}>
                    <span className="th-sort-flex">
                      <span>{isAr ? 'الرصيد والحالة' : 'Stock & Status'}</span>
                      <span className="sort-arrows-icon">
                        {sortKey === 'stock' ? (
                          sortDirection === 'asc' ? <ArrowUp size={12} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={12} style={{ color: 'var(--primary)' }} />
                        ) : (
                          <ArrowUpDown size={12} style={{ color: '#94a3b8' }} />
                        )}
                      </span>
                    </span>
                  </th>
                  <th className="th-actions text-center" style={{ minWidth: '150px' }}>
                    {isAr ? 'إجراءات سريعة' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-table-cell">
                      <Package size={36} className="text-muted" />
                      <h4>{isAr ? 'لا توجد أصناف تطابق معايير البحث الحالية' : 'No products match current search criteria'}</h4>
                      <p>{isAr ? 'جرّب تعديل كلمات البحث أو اختيار تصنيف آخر' : 'Try adjusting your search terms or clearing the filter'}</p>
                    </td>
                  </tr>
                ) : (
                  paginated.map(p => {
                    const isLow = p.currentStock <= p.minStockAlert && p.currentStock > 0;
                    const isOut = p.currentStock <= 0;
                    const cost = Number(p.costPrice) || 0;
                    const price = Number(p.sellingPrice) || 0;
                    const margin = cost > 0 ? ((price - cost) / cost) * 100 : 0;
                    const isBreakdownOpen = expandedBreakdownId === p.id;
                    const breakdown = getWarehouseBreakdown(p);
                    const isSelected = selectedIds.includes(p.id);

                    return (
                      <React.Fragment key={p.id}>
                        <tr 
                          className={`inv-table-row ${isSelected ? 'row-selected' : ''}`}
                          onClick={() => onOpenProductDetails(p)}
                        >
                          {/* Bulk Checkbox */}
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleSelect(p.id, e as any)}
                            />
                          </td>

                          {/* Product & Identifiers (Clean Monospace SKU & Barcode - NO fake SVG lines) */}
                          <td className="td-product">
                            <div className="inv-product-col">
                              <div className="inv-name-box">
                                <strong className="inv-primary-name">
                                  <span dir="auto">{p.nameAr}</span>
                                </strong>
                              </div>
                              <div className="inv-identifiers-row" style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                                {/* Clean Monospace SKU with Copy */}
                                <div className="sku-mono-box" dir="ltr" title={isAr ? 'رمز الصنف (SKU)' : 'SKU Code'}>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, opacity: 0.7, marginRight: '3px' }}>SKU:</span>
                                  <span>{p.sku}</span>
                                  <button 
                                    type="button" 
                                    className="btn-copy-sku" 
                                    onClick={(e) => handleCopyCode(p.sku, e)}
                                    title={isAr ? 'نسخ كود الـ SKU' : 'Copy SKU'}
                                  >
                                    {copiedCode === p.sku ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                                  </button>
                                </div>

                                {/* Clean Monospace Barcode with Copy */}
                                <div className="barcode-mono-box" dir="ltr" title={isAr ? 'الباركود الدولي' : 'Barcode'}>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, opacity: 0.7, marginRight: '3px' }}>{isAr ? 'باركود:' : 'BAR:'}</span>
                                  <span>{p.barcode}</span>
                                  <button 
                                    type="button" 
                                    className="btn-copy-sku" 
                                    onClick={(e) => handleCopyCode(p.barcode, e)}
                                    title={isAr ? 'نسخ رقم الباركود' : 'Copy Barcode'}
                                  >
                                    {copiedCode === p.barcode ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="td-cat">
                            <span className="inv-category-tag">{localizeCategory(p.category, lang)}</span>
                          </td>

                          {/* Location & Multi-Warehouse Breakdown */}
                          <td className="td-location">
                            <div className="inv-location-stack">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Building2 size={14} style={{ color: 'var(--primary)' }} />
                                <strong className="inv-wh-name" style={{ color: '#0f172a' }}>
                                  <span dir="auto">{warehouses.find(w => w.id === p.warehouseId)?.nameAr || p.warehouseName}</span>
                                </strong>
                              </div>
                              <span className="inv-shelf-chip">
                                <span className="shelf-label">{isAr ? 'الرف المعتمد' : 'Shelf'}:</span> {p.shelf}
                              </span>
                              <button 
                                type="button" 
                                className="wh-breakdown-trigger-clean"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedBreakdownId(isBreakdownOpen ? null : p.id);
                                }}
                                title={isAr ? 'عرض موقع وتوزيع المستودع' : 'View warehouse allocation'}
                              >
                                <MapPin size={11} />
                                <span>{isBreakdownOpen ? (isAr ? 'إغلاق التفاصيل' : 'Hide') : (isAr ? 'بيانات التخزين' : 'Stock Info')}</span>
                                {isBreakdownOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                            </div>
                          </td>

                          {/* Pricing & Margin: Confidential Protection */}
                          <td className="td-price">
                            <div className="inv-price-stack">
                              <div className="inv-sell-row">
                                <strong className="inv-price-val" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                                  {formatMoney(price)}
                                </strong>
                              </div>
                              {effectiveShowCostMargin ? (
                                <div className="inv-cost-sub" style={{ marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{isAr ? 'التكلفة:' : 'Cost:'} <strong style={{ color: '#ef4444' }}>{formatMoney(cost)}</strong></span>
                                    {margin > 0 && (
                                      <span className="inv-margin-badge">
                                        +{margin.toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#f59e0b' }}>
                                    {isAr ? 'أقل سعر مسموح:' : 'Floor:'} <strong>{formatMoney(p.minSellingPrice || Math.round(price * 0.88))}</strong>
                                  </span>
                                </div>
                              ) : (
                                <div style={{ marginTop: '3px' }}>
                                  <span className="confidential-cost-masked" title={isAr ? 'التكلفة وهوامش الربح محجوبة لحماية السرية التجارية' : 'Cost & Margin masked for security'}>
                                    <Lock size={10} />
                                    <span>{isAr ? 'التكلفة محجوبة' : 'Cost Confidential'}</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* In Stock & Status Badge */}
                          <td className="td-stock">
                            <div className="inv-stock-status-stack">
                              <div className="inv-stock-container flex items-center">
                                <span className={`inv-stock-number ${isOut ? 'stock-danger' : isLow ? 'stock-warning' : 'stock-good'}`}>
                                  {p.currentStock.toLocaleString()}
                                </span>
                                <span className="inv-unit-text">{localizeUnit(p.unit, lang)}</span>
                                {!isReadOnly && hasPermission('inventory.items.edit') && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAdjustingProduct(p);
                                    }}
                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors ms-1.5"
                                    title={isAr ? 'تسوية مخزنية للصنف' : 'Stock Adjustment'}
                                  >
                                    <Scale size={13} />
                                  </button>
                                )}
                              </div>
                              <span className={`status-pill compact ${isOut ? 'status-danger' : isLow ? 'status-pending' : 'status-active'}`}>
                                <span className="status-dot"></span>
                                <span>
                                  {isOut 
                                    ? (isAr ? 'نافد' : 'Out of Stock') 
                                    : isLow 
                                      ? (isAr ? 'قرب النفاد' : 'Low Stock') 
                                      : (isAr ? 'متوفر' : 'Available')}
                                </span>
                              </span>
                            </div>
                          </td>

                          {/* 4 Operational Row Actions */}
                          <td className="td-actions text-center" onClick={e => e.stopPropagation()}>
                            <div className="row-actions-flex">
                              {/* 1. Print Thermal Label */}
                              <button 
                                type="button" 
                                className="row-action-icon-btn emerald"
                                onClick={(e) => handlePrintSingleLabel(p, e)}
                                title={isAr ? 'طباعة ليبل الباركود فوراً' : 'Print Barcode Label'}
                              >
                                <BarcodeIcon size={14} />
                              </button>

                              {/* 2. Edit Item (Guarded by inventory.items.edit) */}
                              {!isReadOnly && hasPermission('inventory.items.edit') && (
                                <button 
                                  type="button" 
                                  className="row-action-icon-btn"
                                  onClick={() => setEditingProduct(p)}
                                  title={isAr ? 'تعديل بيانات الصنف' : 'Edit Item'}
                                >
                                  <Edit3 size={14} />
                                </button>
                              )}

                              {/* 2.2 Stock Adjustment Action (Strict Audit Control) */}
                              {!isReadOnly && hasPermission('inventory.items.edit') && (
                                <button 
                                  type="button" 
                                  className="row-action-icon-btn cyan"
                                  onClick={() => setAdjustingProduct(p)}
                                  title={isAr ? 'تسوية مخزنية (Stock Adjustment)' : 'Stock Adjustment'}
                                >
                                  <Scale size={14} />
                                </button>
                              )}

                              {/* 2.5 Delete Item (Guarded by inventory.items.delete) */}
                              {hasPermission('inventory.items.delete') && (
                                <button 
                                  type="button" 
                                  className="row-action-icon-btn red"
                                  onClick={() => handleDeleteProduct(p)}
                                  title={isAr ? 'حذف الصنف نهائياً' : 'Delete Product'}
                                  style={{ color: '#f87171' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}

                              {/* 3. Stock History Ledger */}
                              <button 
                                type="button" 
                                className="row-action-icon-btn purple"
                                onClick={() => setHistoryProduct(p)}
                                title={isAr ? 'كارت حركة وسجل الصنف' : 'Stock Movement Ledger'}
                              >
                                <History size={14} />
                              </button>

                              {/* 4. Quick Inter-Warehouse Transfer */}
                              <button 
                                type="button" 
                                className="row-action-icon-btn"
                                onClick={() => onOpenQuickTransfer ? onOpenQuickTransfer(p) : onOpenProductDetails(p)}
                                title={isAr ? 'تحويل لمستودع آخر' : 'Inter-Warehouse Transfer'}
                              >
                                <ArrowLeftRight size={14} />
                              </button>

                            </div>
                          </td>
                        </tr>

                        {/* Multi-Warehouse Breakdown Drawer Row */}
                        {isBreakdownOpen && (
                          <tr className="wh-breakdown-drawer-row fade-in">
                            <td colSpan={7} style={{ padding: '0' }}>
                              <div className="wh-breakdown-content">
                                {breakdown.map((b, idx) => (
                                  <div key={idx} className="wh-breakdown-box">
                                    <div className="wh-box-title">
                                      <span>{b.name}</span>
                                      <strong style={{ color: b.stock > 0 ? 'var(--primary)' : 'var(--destructive)' }}>
                                        {b.stock} {localizeUnit(p.unit, lang)}
                                      </strong>
                                    </div>
                                    <span className="wh-box-shelf">
                                      {isAr ? 'الرف المخصص:' : 'Shelf:'} <strong>{b.shelf}</strong>
                                    </span>
                                    <div className="wh-box-stock-bar">
                                      <div className="wh-progress-track" style={{ width: '75%', height: '5px' }}>
                                        <div 
                                          className="wh-progress-fill" 
                                          style={{ width: `${b.percent}%`, backgroundColor: b.stock > 0 ? 'var(--primary)' : '#64748b' }}
                                        ></div>
                                      </div>
                                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{b.percent}%</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 5. Pagination & Page Size Bar */}
          <div className="inventory-pagination-bar">
            <div className="pagination-info-text">
              {isAr 
                ? `عرض ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, sorted.length)} من أصل ${sorted.length} صنف`
                : `Showing ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, sorted.length)} of ${sorted.length} items`}
            </div>

            <div className="pagination-controls-right">
              <div className="page-size-selector">
                <span>{isAr ? 'لكل صفحة:' : 'Per page:'}</span>
                <select 
                  className="page-size-select" 
                  value={pageSize} 
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="pagination-pages-group">
                <button 
                  type="button" 
                  className="btn-page-nav" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronRight size={14} />
                  <span>{isAr ? 'السابق' : 'Prev'}</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button 
                    key={page}
                    type="button" 
                    className={`btn-page-nav ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}

                <button 
                  type="button" 
                  className="btn-page-nav" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <span>{isAr ? 'التالي' : 'Next'}</span>
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Modern Unified Product Cards Grid */
        <div className="inventory-cards-grid">
          {paginated.length === 0 ? (
            <div className="empty-grid-card">
              <div className="empty-icon-wrap">
                <Package size={34} />
              </div>
              <h4 style={{ fontWeight: 700, fontSize: '0.95rem', margin: '6px 0 2px 0', color: 'var(--foreground)' }}>
                {isAr ? 'لا توجد أصناف تطابق معايير البحث' : 'No products found'}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: 0 }}>
                {isAr ? 'جرّب تعديل البحث أو اختيار تصنيف ومستودع آخر' : 'Try adjusting search or selecting a different category'}
              </p>
            </div>
          ) : (
            paginated.map(p => {
              const isLow = p.currentStock <= p.minStockAlert && p.currentStock > 0;
              const isOut = p.currentStock <= 0;
              const price = Number(p.sellingPrice) || 0;
              const targetWh = warehouses.find(w => w.id === p.warehouseId || w.code === p.warehouseId);
              const whName = targetWh?.nameAr || p.warehouseName || (isAr ? 'المستودع الرئيسي' : 'Main Hub');

              return (
                <div 
                  key={p.id} 
                  className="inv-product-card"
                  onClick={() => onOpenProductDetails(p)}
                >
                  {/* Card Header: Product Info (Right) & Status Badge (Left) */}
                  <div className="inv-card-header-row">
                    <div className="inv-card-identity">
                      <span className="inv-card-cat-tag">
                        {localizeCategory(p.category, lang)}
                      </span>
                      <h3 className="inv-card-title" title={p.nameAr}>
                        <span dir="auto">{p.nameAr}</span>
                      </h3>
                      <div className="inv-card-sku-meta">
                        <span className="sku-tag-label">SKU:</span>
                        <bdi className="sku-code-value" dir="ltr">{p.sku}</bdi>
                        <button 
                          type="button" 
                          className="btn-sku-copy" 
                          onClick={(e) => handleCopyCode(p.sku, e)}
                          title={isAr ? 'نسخ رمز SKU' : 'Copy SKU'}
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="inv-card-status-wrapper">
                      <span className={`inv-status-badge ${isOut ? 'badge-out' : isLow ? 'badge-low' : 'badge-available'}`}>
                        <span className="badge-indicator-dot"></span>
                        <span>
                          {isOut 
                            ? (isAr ? 'نافد' : 'Out') 
                            : isLow 
                              ? (isAr ? 'قرب النفاد' : 'Low') 
                              : (isAr ? 'متوفر' : 'Available')}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Card Divider */}
                  <div className="inv-card-divider" />

                  {/* Card Specs: Clean Distinct Rows with Minimalist Icons */}
                  <div className="inv-card-specs-list">
                    {/* Selling Price Row */}
                    <div className="inv-card-spec-row">
                      <div className="spec-row-label">
                        <Tag size={13} className="spec-row-icon" />
                        <span>{isAr ? 'سعر البيع' : 'Selling Price'}</span>
                      </div>
                      <div className="spec-row-value price-highlight">
                        <bdi dir="ltr">{formatMoney(price)}</bdi>
                      </div>
                    </div>

                    {/* Physical Stock Quantity Row */}
                    <div className="inv-card-spec-row">
                      <div className="spec-row-label">
                        <Package size={13} className="spec-row-icon" />
                        <span>{isAr ? 'الرصيد الفعلي' : 'Current Stock'}</span>
                      </div>
                      <div className="spec-row-value stock-highlight">
                        <span className={`stock-qty-pill ${isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-good'}`}>
                          <bdi dir="ltr">{p.currentStock.toLocaleString()}</bdi>
                          <span className="stock-unit-label">{localizeUnit(p.unit, lang)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Warehouse & Shelf Location Row */}
                    <div className="inv-card-spec-row">
                      <div className="spec-row-label">
                        <MapPin size={13} className="spec-row-icon" />
                        <span>{isAr ? 'الموقع والرف' : 'Location & Shelf'}</span>
                      </div>
                      <div className="spec-row-value location-value">
                        <span className="warehouse-name-text" dir="auto" title={whName}>
                          {whName}
                        </span>
                        <span className="shelf-badge-code" dir="ltr">
                          <bdi>{p.shelf || 'A-01'}</bdi>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Barcode + Details Button */}
                  <div className="inv-card-footer-row">
                    <div className="inv-card-barcode-info">
                      {p.barcode ? (
                        <span className="barcode-badge-mono" dir="ltr">
                          <BarcodeIcon size={12} className="barcode-icon" />
                          <bdi>{p.barcode}</bdi>
                        </span>
                      ) : (
                        <span className="barcode-placeholder-empty">—</span>
                      )}
                    </div>

                    <button 
                      type="button" 
                      className="btn-card-details-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProductDetails(p);
                      }}
                      title={isAr ? `عرض تفاصيل ${p.nameAr}` : `View details for ${p.nameAr}`}
                    >
                      <Eye size={13} />
                      <span>{isAr ? 'تفاصيل' : 'Details'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Row Action Modals (Mounted only when active item is selected to maintain strict hook lifecycle) */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          isOpen={true}
          onClose={() => setEditingProduct(null)}
          lang={lang}
          onSave={handleSaveProductEdit}
          onOpenAdjustment={(prod) => {
            setEditingProduct(null);
            setAdjustingProduct(prod);
          }}
        />
      )}

      {adjustingProduct && (
        <StockAdjustmentModal
          product={adjustingProduct}
          isOpen={true}
          onClose={() => setAdjustingProduct(null)}
          warehouses={warehouses}
          lang={lang}
          onAdjustmentSuccess={(updatedProduct) => {
            if (onUpdateProducts) {
              onUpdateProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
            }
            setAdjustingProduct(null);
          }}
        />
      )}

      {historyProduct && (
        <StockHistoryModal
          product={historyProduct}
          isOpen={true}
          onClose={() => setHistoryProduct(null)}
          lang={lang}
          transactions={transactions}
        />
      )}

      <BatchPrintLabelsModal
        selectedProducts={products.filter(p => selectedIds.includes(p.id))}
        isOpen={isBatchPrintOpen}
        onClose={() => setIsBatchPrintOpen(false)}
        lang={lang}
      />

      {/* Bulk Category Change Modal */}
      {isBulkCatModalOpen && (
        <div className="modal-backdrop fade-in" onClick={() => setIsBulkCatModalOpen(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <Tag size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--foreground)' }}>
                  {isAr ? 'تغيير التصنيف للأصناف المحددة' : 'Change Category for Selected Items'}
                </h3>
              </div>
              <button className="icon-circle-btn" onClick={() => setIsBulkCatModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-form-body">
              <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                {isAr ? `سيتم تعيين التصنيف الجديد لجميع الأصناف المحددة (${selectedIds.length} صنف).` : `Update category for all ${selectedIds.length} selected items.`}
              </p>
              <div className="form-group">
                <label>{isAr ? 'اختر أو اكتب التصنيف الجديد *' : 'Select or type category *'}</label>
                <input 
                  type="text"
                  list="categories-list"
                  className="form-input"
                  value={targetBulkCategory}
                  onChange={e => setTargetBulkCategory(e.target.value)}
                  placeholder={isAr ? 'مثال: شاشات، لابتوبات، شبكات...' : 'e.g. Laptops, Displays...'}
                  required
                />
                <datalist id="categories-list">
                  {categories.map(c => <option key={c.raw} value={c.raw}>{c.label}</option>)}
                </datalist>
              </div>
              <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="btn-add-primary" onClick={handleApplyBulkCategory}>
                  <CheckCircle2 size={16} />
                  <span>{isAr ? 'تطبيق التغيير' : 'Apply Change'}</span>
                </button>
                <button type="button" className="btn-secondary-flat" onClick={() => setIsBulkCatModalOpen(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      <ManageCategoriesModal
        isOpen={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        products={products}
        onUpdateProducts={onUpdateProducts}
        lang={lang}
      />
    </div>
  );
}
