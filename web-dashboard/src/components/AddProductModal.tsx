import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Plus, Package, Barcode, Warehouse, ArrowDownToLine, 
  CheckCircle2, Sparkles, RefreshCw, Layers, DollarSign, 
  TrendingUp, Truck, FileText, Check, Search, Tag, AlertTriangle
} from 'lucide-react';
import { Product, Warehouse as WarehouseType } from '../types/warehouse';
import BarcodeSvg from './BarcodeSvg';
import { localizeCategory, localizeWarehouse, localizeUnit } from '../lib/localeHelpers';
import { useSettings } from '../context/settings-context';
import { validateProductPricing } from '../schemas/ProductValidationSchema';
import { getStoredCategories, saveStoredCategories } from '../services/storageService';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: WarehouseType[];
  products?: Product[];
  lang: string;
  initialMode?: 'new_product' | 'restock';
  initialWarehouseId?: string;
  onAddProduct: (product: Product) => void;
  onRestockProduct?: (productId: string, qtyToAdd: number, warehouseId: string, supplier: string, poRef: string) => void;
}

export default function AddProductModal({
  isOpen,
  onClose,
  warehouses,
  products = [],
  lang,
  initialMode = 'new_product',
  initialWarehouseId,
  onAddProduct,
  onRestockProduct
}: AddProductModalProps) {
  if (!isOpen) return null;

  const isAr = lang === 'ar';
  const { currencySymbol } = useSettings();
  const [activeTab, setActiveTab] = useState<'new_product' | 'restock'>(initialMode);

  // Sync mode if initialMode changes
  useEffect(() => {
    setActiveTab(initialMode);
  }, [initialMode, isOpen]);

  // Dynamic Categories: Loaded from user storage + active products
  const [categoriesList, setCategoriesList] = useState<string[]>(() => {
    const fromStorage = getStoredCategories().map(c => c.name?.trim()).filter(Boolean);
    const fromProducts = Array.from(new Set((products || []).map(p => p.category?.trim()).filter(Boolean)));
    const merged = Array.from(new Set([...fromStorage, ...fromProducts]));
    return merged.length > 0 ? merged : [isAr ? 'عام' : 'General'];
  });

  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  // ---------------- New Product Form State ----------------
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [sku, setSku] = useState(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
  const [barcode, setBarcode] = useState(`${Math.floor(1000000000000 + Math.random() * 9000000000000)}`);
  const [category, setCategory] = useState<string>(() => {
    const fromStorage = getStoredCategories().map(c => c.name?.trim()).filter(Boolean);
    const fromProducts = Array.from(new Set((products || []).map(p => p.category?.trim()).filter(Boolean)));
    return fromStorage[0] || fromProducts[0] || (isAr ? 'عام' : 'General');
  });

  // Keep categories updated if changed in database/storage
  useEffect(() => {
    const refreshCategories = () => {
      const fromStorage = getStoredCategories().map(c => c.name?.trim()).filter(Boolean);
      const fromProducts = Array.from(new Set((products || []).map(p => p.category?.trim()).filter(Boolean)));
      const merged = Array.from(new Set([...fromStorage, ...fromProducts]));
      if (merged.length > 0) {
        setCategoriesList(merged);
        setCategory(prev => (prev && merged.includes(prev) ? prev : merged[0]));
      }
    };

    refreshCategories();
    window.addEventListener('erp_categories_updated', refreshCategories);
    return () => window.removeEventListener('erp_categories_updated', refreshCategories);
  }, [products, isOpen, isAr]);

  const handleAddNewCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) {
      setIsAddingNewCat(false);
      return;
    }
    if (!categoriesList.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...categoriesList, trimmed];
      setCategoriesList(updated);
      try {
        const stored = getStoredCategories();
        saveStoredCategories([...stored, { id: `CAT-${Date.now().toString().slice(-4)}`, name: trimmed }]);
      } catch {}
    }
    setCategory(trimmed);
    setNewCatInput('');
    setIsAddingNewCat(false);
  };
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId || warehouses[0]?.id || '');
  const [shelf, setShelf] = useState('A-02-04');
  const [costPrice, setCostPrice] = useState(120);
  const [sellingPrice, setSellingPrice] = useState(175);
  const [minSellingPrice, setMinSellingPrice] = useState(150);
  const [unit, setUnit] = useState('قطعة');
  const [currentStock, setCurrentStock] = useState(30);
  const [minStockAlert, setMinStockAlert] = useState(10);
  const [newProdError, setNewProdError] = useState('');

  // ---------------- Restock Form State ----------------
  const [restockProductId, setRestockProductId] = useState<string>(products[0]?.id || '');
  const [restockSearch, setRestockSearch] = useState('');
  const [restockWarehouseId, setRestockWarehouseId] = useState(initialWarehouseId || warehouses[0]?.id || '');
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockSupplier, setRestockSupplier] = useState('');
  const [restockPo, setRestockPo] = useState('');
  const [restockCost, setRestockCost] = useState<number>(0);
  const [restockError, setRestockError] = useState('');

  useEffect(() => {
    if (warehouses && warehouses.length > 0) {
      if (!warehouseId || !warehouses.some(w => w.id === warehouseId)) {
        setWarehouseId(warehouses[0].id);
      }
      if (!restockWarehouseId || !warehouses.some(w => w.id === restockWarehouseId)) {
        setRestockWarehouseId(warehouses[0].id);
      }
    }
  }, [warehouses, warehouseId, restockWarehouseId]);

  // Auto-generate SKU
  const handleGenerateSku = () => {
    const code = Math.floor(1000 + Math.random() * 9000);
    setSku(`PRD-${code}`);
  };

  // Auto-generate Barcode
  const handleGenerateBarcode = () => {
    const code = `${Math.floor(6000000000000 + Math.random() * 3999999999999)}`;
    setBarcode(code);
  };

  // Calculated profit margin for new product
  const profitMargin = useMemo(() => {
    if (costPrice <= 0) return 0;
    return (((sellingPrice - costPrice) / costPrice) * 100).toFixed(1);
  }, [costPrice, sellingPrice]);

  // Filtered products for restock search
  const filteredProductsForRestock = useMemo(() => {
    if (!restockSearch.trim()) return products;
    const term = restockSearch.toLowerCase();
    return products.filter(p => 
      p.nameAr.toLowerCase().includes(term) ||
      p.nameEn.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      p.barcode.includes(term)
    );
  }, [products, restockSearch]);

  const selectedRestockProduct = useMemo(() => {
    return products.find(p => p.id === restockProductId) || products[0];
  }, [products, restockProductId]);

  // Quick suppliers presets
  const quickSuppliers = [
    'سامسونج إلكترونيكس الشرق الأوسط',
    'ديل تكنولوجيز العراق',
    'سيسكو سيستمز العالمية',
    'شنايدر إلكتريك للطاقة',
    'أنكر للحلول التقنية'
  ];

  // Submit New Product
  const handleSubmitNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      setNewProdError(isAr ? 'يرجى إدخال اسم المنتج باللغة العربية' : 'Please enter product name');
      return;
    }
    if (!sku.trim()) {
      setNewProdError(isAr ? 'يرجى إدخال كود الصنف SKU' : 'Please enter SKU code');
      return;
    }

    // Strict 3-Tier Pricing Validation
    const pricingVal = validateProductPricing({
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      minSellingPrice: Number(minSellingPrice) || Math.round(Number(sellingPrice) * 0.88)
    }, lang as any);

    if (!pricingVal.isValid) {
      setNewProdError(pricingVal.errorMessage || '');
      return;
    }

    const selectedWh = warehouses.find(w => w.id === warehouseId);
    const resolvedWhName = selectedWh?.nameAr ? localizeWarehouse(selectedWh.nameAr, lang === 'en' ? 'en' : 'ar') : (isAr ? 'المستودع الرئيسي' : 'Main Warehouse');
    const resolvedWhNameEn = selectedWh?.nameEn ? localizeWarehouse(selectedWh.nameEn, 'en') : 'Main Warehouse';

    const newProd: Product = {
      id: `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
      sku: sku.toUpperCase().trim(),
      barcode: barcode.trim(),
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      category,
      categoryEn: localizeCategory(category, 'en'),
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      minSellingPrice: Number(minSellingPrice) || Math.round(Number(sellingPrice) * 0.88),
      unit,
      unitEn: localizeUnit(unit, 'en'),
      currentStock: Number(currentStock) || 0,
      minStockAlert: Number(minStockAlert) || 5,
      warehouseId,
      warehouseName: resolvedWhName,
      warehouseNameEn: resolvedWhNameEn,
      status: Number(currentStock) > Number(minStockAlert) ? 'available' : Number(currentStock) > 0 ? 'low' : 'out_of_stock',
      shelf: shelf.trim() || 'A-01-01',
      updatedAt: new Date().toISOString().slice(0, 10)
    };

    // Ensure selected category is persisted to stored categories
    try {
      const stored = getStoredCategories();
      const catTrimmed = category.trim();
      if (catTrimmed && !stored.some(c => c.name.toLowerCase() === catTrimmed.toLowerCase())) {
        saveStoredCategories([...stored, { id: `CAT-${Date.now().toString().slice(-4)}`, name: catTrimmed }]);
      }
    } catch {}

    onAddProduct(newProd);
    onClose();
  };

  // Submit Restock
  const handleSubmitRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestockProduct) {
      setRestockError(isAr ? 'يرجى اختيار المنتج المراد توريده' : 'Please select a product');
      return;
    }
    if (restockQty <= 0) {
      setRestockError(isAr ? 'الكمية المستلمة يجب أن تكون 1 على الأقل' : 'Quantity must be at least 1');
      return;
    }

    if (onRestockProduct) {
      onRestockProduct(
        selectedRestockProduct.id,
        Number(restockQty),
        restockWarehouseId,
        restockSupplier,
        restockPo
      );
    }
    onClose();
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div 
        className="modal-content glass-panel goods-master-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="goods-modal-topbar">
          <div className="goods-modal-header-left">
            <div className="goods-modal-icon-badge">
              {activeTab === 'new_product' ? <Package size={22} /> : <ArrowDownToLine size={22} />}
            </div>
            <div>
              <div className="goods-header-meta">
                <span className="goods-tag-pill">
                  {isAr ? 'إدارة المستودعات والمخزون' : 'Warehouse & Stock Ops'}
                </span>
                <span className="meta-bullet">•</span>
                <span className="goods-code-text">ERP-INV-2026</span>
              </div>
              <h2 className="goods-modal-title">
                {isAr ? 'إضافة بضاعة أو أصناف جديدة للمستودع' : 'Add Goods or Register New SKU'}
              </h2>
            </div>
          </div>

          <button className="icon-circle-btn" onClick={onClose} title={isAr ? 'إغلاق النافذة' : 'Close'}>
            <X size={18} />
          </button>
        </div>

        {/* Big Dual-Mode Navigation Tabs */}
        <div className="goods-mode-tabs-container">
          <button
            type="button"
            className={`goods-mode-tab-btn ${activeTab === 'new_product' ? 'active emerald-active' : ''}`}
            onClick={() => setActiveTab('new_product')}
          >
            <Package size={17} />
            <div className="tab-btn-text">
              <strong>{isAr ? '1. تعريف صنف جديد كلياً بالدليل' : '1. Register New SKU / Catalog Item'}</strong>
              <small>{isAr ? 'إنشاء كود SKU، باركود، تسعير، ورصيد افتتاحي' : 'Create new SKU code, barcode, pricing & initial stock'}</small>
            </div>
          </button>

          <button
            type="button"
            className={`goods-mode-tab-btn ${activeTab === 'restock' ? 'active cyan-active' : ''}`}
            onClick={() => setActiveTab('restock')}
          >
            <ArrowDownToLine size={17} />
            <div className="tab-btn-text">
              <strong>{isAr ? '2. استلام وتوريد بضاعة للمستودع (وارد)' : '2. Inbound Restock & Goods Receipt'}</strong>
              <small>{isAr ? 'زيادة رصيد مادة موجودة عبر أمر شراء أو شحنة مورد' : 'Increase stock of existing item via PO or supplier shipment'}</small>
            </div>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="goods-modal-scroll-body">
          {/* ============================================================== */}
          {/* TAB 1: NEW PRODUCT / CATALOG SKU                               */}
          {/* ============================================================== */}
          {activeTab === 'new_product' && (
            <form onSubmit={handleSubmitNewProduct} className="goods-tab-form fade-in">
              {newProdError && (
                <div className="goods-alert-banner">
                  <AlertTriangle size={16} />
                  <span>{newProdError}</span>
                </div>
              )}

              {/* Section 1: Basic Identity */}
              <div className="goods-form-section">
                <div className="section-title-row">
                  <Tag size={15} className="text-cyan" />
                  <h4>{isAr ? 'البيانات التعريفية للمنتج' : 'Product Identification'}</h4>
                </div>

                <div className="goods-input-group">
                  <label>{isAr ? 'اسم الصنف / المنتج *' : 'Product Name *'}</label>
                  <input 
                    type="text" 
                    required
                    placeholder={isAr ? 'مثال: شاحن أنكر 65 واط فائق السرعة' : 'e.g. Anker 65W GaN Fast Charger'}
                    value={nameAr}
                    onChange={(e) => {
                      setNameAr(e.target.value);
                      setNameEn(e.target.value);
                    }}
                    className="goods-text-input"
                  />
                </div>

                {/* SKU & Barcode Generation Row */}
                <div className="form-grid-2" style={{ marginTop: '12px' }}>
                  <div className="goods-input-group">
                    <div className="label-with-action">
                      <label>{isAr ? 'رمز الصنف الفريد *' : 'Unique SKU Code *'}</label>
                      <button 
                        type="button" 
                        className="btn-tiny-generate" 
                        onClick={handleGenerateSku}
                        title={isAr ? 'توليد تلقائي' : 'Auto Generate'}
                      >
                        <RefreshCw size={11} />
                        <span>{isAr ? 'توليد كود' : 'Generate'}</span>
                      </button>
                    </div>
                    <input 
                      type="text" 
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="goods-text-input font-mono"
                    />
                  </div>

                  <div className="goods-input-group">
                    <div className="label-with-action">
                      <label>{isAr ? 'الباركود الدولي' : 'Barcode'}</label>
                      <button 
                        type="button" 
                        className="btn-tiny-generate" 
                        onClick={handleGenerateBarcode}
                        title={isAr ? 'توليد باركود تلقائي' : 'Generate Barcode'}
                      >
                        <RefreshCw size={11} />
                        <span>{isAr ? 'توليد باركود' : 'New Barcode'}</span>
                      </button>
                    </div>
                    <div className="barcode-input-container">
                      <input 
                        type="text" 
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        className="goods-text-input font-mono"
                      />
                      <div className="mini-barcode-box" title="Live Barcode Preview">
                        <BarcodeSvg value={barcode} width={65} height={20} color="#000000" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category Selection Chips with Dynamic User Categories & Quick Add */}
                <div className="goods-input-group" style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ margin: 0, fontWeight: 700, fontSize: '12px' }}>{isAr ? 'تصنيف الصنف:' : 'Category:'}</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCat(!isAddingNewCat)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={12} />
                      <span>{isAddingNewCat ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? '+ إضافة تصنيف جديد' : '+ New Category')}</span>
                    </button>
                  </div>

                  {isAddingNewCat && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        value={newCatInput}
                        onChange={(e) => setNewCatInput(e.target.value)}
                        placeholder={isAr ? 'اكتب اسم التصنيف الجديد واضغط إضافة...' : 'Enter new category name...'}
                        className="goods-text-input"
                        style={{ height: '34px', fontSize: '12px', flex: 1 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNewCategory();
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddNewCategory}
                        className="btn-add-primary"
                        style={{ height: '34px', padding: '0 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                      >
                        <Check size={13} />
                        <span>{isAr ? 'حفظ وتحديد' : 'Save & Select'}</span>
                      </button>
                    </div>
                  )}

                  <div className="goods-category-pills">
                    {categoriesList.map(catName => (
                      <button
                        key={catName}
                        type="button"
                        className={`cat-pill-chip ${category === catName ? 'active' : ''}`}
                        onClick={() => setCategory(catName)}
                      >
                        {category === catName && <Check size={12} />}
                        <span>{catName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 2: Storage & Warehouse */}
              <div className="goods-form-section">
                <div className="section-title-row">
                  <Warehouse size={15} className="text-emerald" />
                  <h4>{isAr ? 'موقع التخزين والمستودع' : 'Warehouse Location & Shelf'}</h4>
                </div>

                <div className="form-grid-3">
                  <div className="goods-input-group">
                    <label>{isAr ? 'المستودع المستهدف' : 'Target Warehouse'}</label>
                    <select 
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      className="goods-select-input"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="goods-input-group">
                    <label>{isAr ? 'موقع الرف والقاطع' : 'Shelf / Rack Code'}</label>
                    <input 
                      type="text" 
                      placeholder="e.g. A-02-04"
                      value={shelf}
                      onChange={(e) => setShelf(e.target.value)}
                      className="goods-text-input font-mono"
                    />
                  </div>

                  <div className="goods-input-group">
                    <label>{isAr ? 'وحدة القياس' : 'Unit of Measure'}</label>
                    <select 
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="goods-select-input"
                    >
                      <option value="قطعة">{isAr ? 'قطعة' : 'Piece'}</option>
                      <option value="صندوق">{isAr ? 'صندوق' : 'Box'}</option>
                      <option value="طرد">{isAr ? 'طرد' : 'Package'}</option>
                      <option value="جهاز">{isAr ? 'جهاز' : 'Unit / Device'}</option>
                      <option value="بكرة">{isAr ? 'بكرة' : 'Roll'}</option>
                      <option value="متر">{isAr ? 'متر' : 'Meter'}</option>
                      <option value="كجم">{isAr ? 'كيلوغرام' : 'Kg'}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: 3-Figure Pricing Scheme & Stock Balances */}
              <div className="goods-form-section">
                <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={15} className="text-amber" />
                    <h4>{isAr ? 'نظام التسعير الثلاثي وحماية هامش الربح' : '3-Tier Pricing & Profit Shield'}</h4>
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {isAr ? ' سعر التكلفة والحد الأدنى مشفّرين عن الكاشير' : ' Cost & floor price hidden from cashier'}
                  </span>
                </div>

                {/* Clean Theme-Adaptive 3-Tier Pricing Card */}
                <div 
                  className="p-4 rounded-xl border border-border bg-card space-y-4"
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border, #e2e8f0)',
                    background: 'var(--card, #ffffff)',
                    color: 'var(--foreground, #0f172a)',
                    marginBottom: '16px'
                  }}
                >
                  {/* 3-Column Equal Grid */}
                  <div 
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '14px'
                    }}
                  >
                    {/* 1. Cost Price */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#dc2626', marginBottom: '6px' }}>
                        {isAr ? 'سعر التكلفة (شراء)' : 'Cost Price (Purchasing)'}
                      </label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        value={costPrice}
                        onChange={(e) => setCostPrice(Number(e.target.value))}
                        placeholder="0.00"
                        style={{
                          width: '100%',
                          height: '40px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid #fca5a5',
                          background: 'var(--card, #ffffff)',
                          color: 'var(--foreground, #0f172a)',
                          fontSize: '14px',
                          fontWeight: 700,
                          fontFamily: 'monospace'
                        }}
                      />
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                        {isAr ? 'مخفي عن الكاشير والمبيعات' : 'Hidden from cashier & sales'}
                      </span>
                    </div>

                    {/* 2. Official Selling Price */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#059669', marginBottom: '6px' }}>
                        {isAr ? 'سعر البيع الرسمي (للكاشير)' : 'Official Retail Price (Cashier)'}
                      </label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        value={sellingPrice}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSellingPrice(val);
                          if (minSellingPrice === Math.round(sellingPrice * 0.85) || minSellingPrice === 0) {
                            setMinSellingPrice(Math.round(val * 0.85));
                          }
                        }}
                        placeholder="0.00"
                        style={{
                          width: '100%',
                          height: '40px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid #86efac',
                          background: 'var(--card, #ffffff)',
                          color: 'var(--foreground, #0f172a)',
                          fontSize: '14px',
                          fontWeight: 700,
                          fontFamily: 'monospace'
                        }}
                      />
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                        {isAr ? 'السعر الافتراضي بنقاط البيع' : 'Default retail POS price'}
                      </span>
                    </div>

                    {/* 3. Min Allowed Selling Price */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#d97706', marginBottom: '6px' }}>
                        {isAr ? 'أقل سعر مسموح (حد الأمان)' : 'Minimum Floor Price (Safety)'}
                      </label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        value={minSellingPrice}
                        onChange={(e) => setMinSellingPrice(Number(e.target.value))}
                        placeholder="0.00"
                        style={{
                          width: '100%',
                          height: '40px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid #fcd34d',
                          background: 'var(--card, #ffffff)',
                          color: 'var(--foreground, #0f172a)',
                          fontSize: '14px',
                          fontWeight: 700,
                          fontFamily: 'monospace'
                        }}
                      />
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                        {isAr ? 'أدنى حد للتخفيض المسموح به' : 'Lowest allowed discounted price'}
                      </span>
                    </div>
                  </div>

                  {/* Independent Calm Green Expected Profit Margin Badge */}
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      marginTop: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={16} color="#059669" />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#065f46' }}>
                        {isAr ? 'هامش الربح المتوقع:' : 'Expected Profit Margin:'}
                      </span>
                    </div>
                    <span 
                      style={{ 
                        fontSize: '13px', 
                        fontWeight: 800, 
                        color: Number(profitMargin) >= 0 ? '#059669' : '#dc2626',
                        fontFamily: 'monospace'
                      }}
                    >
                      {Number(profitMargin) >= 0 ? `+${profitMargin}%` : `${profitMargin}%`}
                    </span>
                  </div>
                </div>

                {/* Initial Stock & Reorder Alert */}
                <div className="form-grid-2">
                  <div className="goods-input-group">
                    <label>{isAr ? 'الكمية الافتتاحية الحالية' : 'Initial Stock'}</label>
                    <input 
                      type="number" 
                      min="0"
                      value={currentStock}
                      onChange={(e) => setCurrentStock(Number(e.target.value))}
                      className="goods-text-input font-bold"
                    />
                  </div>

                  <div className="goods-input-group">
                    <label>{isAr ? 'حد التنبيه وإعادة الطلب' : 'Safety Reorder Alert'}</label>
                    <input 
                      type="number" 
                      min="1"
                      value={minStockAlert}
                      onChange={(e) => setMinStockAlert(Number(e.target.value))}
                      className="goods-text-input text-amber"
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="goods-modal-actions">
                <button type="submit" className="btn-modal-submit emerald-btn">
                  <Plus size={16} />
                  <span>{isAr ? 'حفظ وإضافة الصنف للمستودع' : 'Save & Register SKU'}</span>
                </button>
                <button type="button" className="btn-modal-cancel" onClick={onClose}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* TAB 2: INBOUND RESTOCK / RECEIVE GOODS                         */}
          {/* ============================================================== */}
          {activeTab === 'restock' && (
            <form onSubmit={handleSubmitRestock} className="goods-tab-form fade-in">
              {restockError && (
                <div className="goods-alert-banner">
                  <AlertTriangle size={16} />
                  <span>{restockError}</span>
                </div>
              )}

              {/* Section 1: Choose Product to Restock */}
              <div className="goods-form-section">
                <div className="section-title-row">
                  <Search size={15} className="text-cyan" />
                  <h4>{isAr ? 'اختيار الصنف المراد توريد كمية جديدة منه' : 'Select Product to Restock'}</h4>
                </div>

                <div className="goods-search-select-box">
                  <div className="form-grid-2">
                    <div className="search-input-wrap">
                      <Search size={15} className="search-icon-pos" />
                      <input 
                        type="text" 
                        placeholder={isAr ? 'ابحث بالاسم أو الباركود أو SKU...' : 'Search item or SKU...'}
                        value={restockSearch}
                        onChange={(e) => setRestockSearch(e.target.value)}
                        className="goods-text-input"
                      />
                    </div>

                    <select 
                      value={restockProductId}
                      onChange={(e) => setRestockProductId(e.target.value)}
                      className="goods-select-input"
                    >
                      {filteredProductsForRestock.map(prod => (
                        <option key={prod.id} value={prod.id}>
                          {prod.nameAr} — [SKU: {prod.sku}] — ({isAr ? 'الرصيد:' : 'Stock:'} {prod.currentStock})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selected Product Card Banner */}
                {selectedRestockProduct && (
                  <div className="selected-product-preview-card">
                    <div className="prev-icon-box">
                      <Package size={22} />
                    </div>
                    <div className="prev-info">
                      <div className="prev-title">
                        <strong dir="auto">{selectedRestockProduct.nameAr}</strong>
                        <span className="code-pill font-mono">{selectedRestockProduct.sku}</span>
                      </div>
                      <div className="prev-meta">
                        <span dir="auto">{isAr ? 'المستودع الحالي:' : 'Warehouse:'} {selectedRestockProduct.warehouseName}</span>
                        <span className="meta-bullet">•</span>
                        <span>{isAr ? 'التصنيف:' : 'Category:'} {selectedRestockProduct.category}</span>
                        <span className="meta-bullet">•</span>
                        <span>{isAr ? 'سعر الشراء:' : 'Cost:'} {currencySymbol} {selectedRestockProduct.costPrice}</span>
                      </div>
                    </div>
                    <div className="prev-stock-badge">
                      <span className="stock-label">{isAr ? 'الرصيد الفعلي الحالي' : 'Current Stock'}</span>
                      <strong className="stock-number">{selectedRestockProduct.currentStock}</strong>
                      <span className="stock-unit">{selectedRestockProduct.unit}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Inbound Supply Details */}
              <div className="goods-form-section">
                <div className="section-title-row">
                  <Truck size={15} className="text-emerald" />
                  <h4>{isAr ? 'تفاصيل شحنة التوريد والمورد' : 'Consignment & Supplier Info'}</h4>
                </div>

                <div className="form-grid-3">
                  <div className="goods-input-group">
                    <label>{isAr ? 'المستودع المستلم للشحنة' : 'Receiving Warehouse'}</label>
                    <select 
                      value={restockWarehouseId}
                      onChange={(e) => setRestockWarehouseId(e.target.value)}
                      className="goods-select-input"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="goods-input-group">
                    <label>{isAr ? 'اسم المورد أو الناقل' : 'Supplier Name'}</label>
                    <input 
                      type="text" 
                      value={restockSupplier}
                      onChange={(e) => setRestockSupplier(e.target.value)}
                      placeholder={isAr ? 'اسم شركة التوريد...' : 'Supplier company...'}
                      className="goods-text-input"
                    />
                  </div>

                  <div className="goods-input-group">
                    <label>{isAr ? 'رقم أمر الشراء أو الإذن' : 'PO / Voucher Ref'}</label>
                    <input 
                      type="text" 
                      value={restockPo}
                      onChange={(e) => setRestockPo(e.target.value)}
                      className="goods-text-input font-mono"
                    />
                  </div>
                </div>

                {/* Quick Supplier Chips */}
                <div className="goods-input-group" style={{ marginTop: '10px' }}>
                  <label className="sub-hint-label">{isAr ? 'موردون سريعون:' : 'Quick Supplier Presets:'}</label>
                  <div className="supplier-preset-chips">
                    {quickSuppliers.map(s => (
                      <button
                        key={s}
                        type="button"
                        className={`supplier-chip ${restockSupplier === s ? 'active' : ''}`}
                        onClick={() => setRestockSupplier(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 3: Quantity Stepper & Impact Preview */}
              <div className="goods-form-section">
                <div className="section-title-row">
                  <Layers size={15} className="text-cyan" />
                  <h4>{isAr ? 'الكمية المستلمة وتحديث الرصيد' : 'Received Quantity & New Balance'}</h4>
                </div>

                <div className="restock-qty-row">
                  <div className="qty-stepper-container">
                    <label>{isAr ? 'الكمية الواردة المستلمة:' : 'Inbound Quantity:'}</label>
                    <div className="stepper-controls">
                      <input 
                        type="number" 
                        min="1"
                        value={restockQty}
                        onChange={(e) => setRestockQty(Math.max(1, Number(e.target.value)))}
                        className="goods-text-input qty-huge-input font-bold"
                      />
                      <div className="quick-qty-chips">
                        {[10, 25, 50, 100, 250].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            className="qty-quick-chip"
                            onClick={() => setRestockQty(amt)}
                          >
                            +{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Projected Stock Balance Calculator */}
                  {selectedRestockProduct && (
                    <div className="stock-projection-card">
                      <div className="proj-item">
                        <span className="proj-label">{isAr ? 'الرصيد السابق' : 'Previous'}</span>
                        <strong className="proj-num">{selectedRestockProduct.currentStock}</strong>
                      </div>
                      <div className="proj-op">+</div>
                      <div className="proj-item">
                        <span className="proj-label">{isAr ? 'الكمية الواردة' : 'Incoming'}</span>
                        <strong className="proj-num text-cyan">+{restockQty}</strong>
                      </div>
                      <div className="proj-op">=</div>
                      <div className="proj-item highlight">
                        <span className="proj-label">{isAr ? 'الرصيد الجديد بالمستودع' : 'Projected Stock'}</span>
                        <strong className="proj-num text-emerald">
                          {selectedRestockProduct.currentStock + Number(restockQty)}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="goods-modal-actions">
                <button type="submit" className="btn-modal-submit cyan-btn">
                  <ArrowDownToLine size={16} />
                  <span>{isAr ? 'تأكيد استلام الشحنة وزيادة الرصيد' : 'Confirm Inbound Receipt'}</span>
                </button>
                <button type="button" className="btn-modal-cancel" onClick={onClose}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
