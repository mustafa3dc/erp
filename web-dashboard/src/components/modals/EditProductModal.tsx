"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  List, 
  SlidersHorizontal, 
  CreditCard, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Tag, 
  Boxes, 
  MapPin, 
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Product } from '../../types/warehouse';
import { getStoredWarehouses, getStoredCategories, saveStoredCategories } from '../../services/storageService';
import { useSettings } from '../../context/settings-context';
import { localizeWarehouse, localizeUnit } from '../../lib/localeHelpers';
import { validateProductPricing } from '../../schemas/ProductValidationSchema';

interface EditProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
  onSave: (updatedProduct: Product) => void;
  onOpenAdjustment?: (product: Product) => void;
}

export default function EditProductModal({
  product,
  isOpen,
  onClose,
  lang = 'ar',
  onSave,
  onOpenAdjustment
}: EditProductModalProps) {
  // 1. Mandatory Unconditional Hooks (Must run in identical order on EVERY render)
  const isAr = lang === 'ar';
  const { financialSettings } = useSettings();
  const effectiveCurrencySymbol = financialSettings.baseCurrency.symbol;

  const warehouses = getStoredWarehouses();
  const [categoriesList, setCategoriesList] = useState<any[]>([]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [minSellingPrice, setMinSellingPrice] = useState(0);
  const [minStockAlert, setMinStockAlert] = useState(5);
  const [shelf, setShelf] = useState('A-01');
  const [warehouseId, setWarehouseId] = useState('');
  const [unit, setUnit] = useState('قطعة');

  // Synchronize state ONLY when modal opens or a different product is loaded
  useEffect(() => {
    if (product && isOpen) {
      setName(product.nameAr || product.nameEn || '');
      setSku(product.sku || '');
      setBarcode(product.barcode || '');
      setCategory(product.category || '');
      setUnit(product.unit || 'قطعة');
      setCostPrice(Number(product.costPrice) || 0);
      setSellingPrice(Number(product.sellingPrice) || 0);
      setMinSellingPrice(
        product.minSellingPrice !== undefined 
          ? Number(product.minSellingPrice) 
          : Math.round((Number(product.sellingPrice) || 0) * 0.88)
      );
      setMinStockAlert(Number(product.minStockAlert) || 5);
      setShelf(product.shelf || 'A-01');
      setWarehouseId(product.warehouseId || '');
      
      const loadedCats = getStoredCategories();
      setCategoriesList(loadedCats);
      const inStored = loadedCats.some(c => c.name === product.category);
      setIsCustomCategory(!inStored && !!product.category);
    }
  }, [product?.id, isOpen]);

  // Helper generators
  const handleGenerateSku = () => {
    const code = Math.floor(1000 + Math.random() * 9000);
    setSku(`PRD-${code}`);
  };

  const handleGenerateBarcode = () => {
    const code = `${Math.floor(6000000000000 + Math.random() * 3999999999999)}`;
    setBarcode(code);
  };

  // Real-time pricing validation
  const pricingValidation = validateProductPricing({
    costPrice: Number(costPrice) || 0,
    sellingPrice: Number(sellingPrice) || 0,
    minSellingPrice: Number(minSellingPrice) || 0
  }, lang);

  // Real-time violation states
  const hasPricingViolation = !pricingValidation.isValid;
  const isCostPriceInvalid = hasPricingViolation && (costPrice > sellingPrice || costPrice > minSellingPrice);
  const isSellingPriceInvalid = hasPricingViolation && (sellingPrice < costPrice || sellingPrice < minSellingPrice);
  const isMinPriceInvalid = hasPricingViolation && (minSellingPrice < costPrice || minSellingPrice > sellingPrice);

  // Stock alert calculation: compare current stock with safety threshold
  const currentStockVal = Number(product?.currentStock ?? 0);
  const alertThreshold = Number(minStockAlert) || 0;
  const isBelowSafety = currentStockVal <= alertThreshold;
  const isOutOfStock = currentStockVal <= 0;

  // Margin calculation helpers
  const unitProfit = sellingPrice - costPrice;
  const marginPercent = costPrice > 0 ? ((unitProfit / costPrice) * 100).toFixed(1) : '0';
  const discountBuffer = Math.max(0, sellingPrice - minSellingPrice);

  // 2. Safe Early Return ONLY after all hooks are evaluated
  if (!isOpen || !product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    if (!cleanName) return;

    // Strict Pricing Validation check
    const validation = validateProductPricing({
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      minSellingPrice: Number(minSellingPrice) || 0
    }, lang);

    if (!validation.isValid) {
      return;
    }

    const selectedWh = warehouses.find(w => w.id === warehouseId);
    const localizedWhName = selectedWh?.nameAr ? localizeWarehouse(selectedWh.nameAr, lang) : product.warehouseName;
    const localizedWhNameEn = selectedWh?.nameEn ? localizeWarehouse(selectedWh.nameEn, 'en') : (product.warehouseNameEn || product.warehouseName);

    const finalCategory = category.trim() || (isAr ? 'عام' : 'General');
    if (finalCategory) {
      const currentStored = getStoredCategories();
      if (!currentStored.some(c => c.name.toLowerCase() === finalCategory.toLowerCase())) {
        const nextCats = [
          ...currentStored,
          {
            id: `CAT-${Date.now()}`,
            name: finalCategory,
            code: `CAT-${currentStored.length + 1}`
          }
        ];
        saveStoredCategories(nextCats);
      }
    }

    const updated: Product = {
      ...product,
      nameAr: cleanName,
      nameEn: cleanName,
      sku: sku.trim() || product.sku,
      barcode: barcode.trim() || product.barcode,
      category: finalCategory,
      unit: unit || product.unit || (isAr ? 'قطعة' : 'Unit'),
      unitEn: localizeUnit(unit || product.unit || 'قطعة', 'en'),
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      minSellingPrice: Number(minSellingPrice) || 0,
      minStockAlert: Number(minStockAlert) || 0,
      shelf: shelf?.trim() || 'A-01',
      warehouseId,
      warehouseName: localizedWhName,
      warehouseNameEn: localizedWhNameEn,
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    onSave(updated);
    onClose();
  };

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent
        className="w-full max-w-4xl bg-card border border-border/80 shadow-2xl rounded-2xl p-0 text-foreground overflow-hidden flex flex-col my-auto"
        style={{
          maxWidth: '860px',
          width: '95%',
          maxHeight: '92vh',
          padding: 0,
          borderRadius: '1rem',
          backgroundColor: 'var(--card)',
          color: 'var(--foreground)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)'
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground m-0 leading-tight">
                  {isAr ? 'تعديل بيانات الصنف المخزني' : 'Edit Product Details'}
                </h3>
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20"
                  dir="ltr"
                >
                  SKU: {sku || product.sku}
                </span>
              </div>
              <p className="text-xs text-muted-foreground m-0 mt-0.5 leading-normal">
                {isAr
                  ? 'إدارة بيانات المادة، تسعير البيع والتكلفة، وحدود الأمان والموقع المخزني'
                  : 'Manage product identity, multi-tier pricing, safety reorder limits, and bin location'}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Wide Two-Column Form Body (Balanced Zero-Dead-Space Layout) */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 overflow-y-auto max-h-[calc(92vh-125px)] space-y-3.5">
            {/* Real-time Pricing Validation Banner */}
            {hasPricingViolation && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold shadow-2xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pricingValidation.errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Column 1: Product Identity, Categorization & Storage */}
              <div className="space-y-3.5">
                {/* Card 1: Basic Identity & Category */}
                <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                    <Package className="w-3.5 h-3.5 text-primary" />
                    <span>{isAr ? 'البيانات الأساسية والتصنيف' : 'Basic Identity & Category'}</span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Product Name */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground/80 block">
                        {isAr ? 'اسم الصنف / المنتج' : 'Product Name'} *
                      </span>
                      <div className="relative">
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          dir="auto"
                          placeholder={isAr ? 'أدخل اسم الصنف أو المنتج...' : 'e.g. Dell Latitude 5420...'}
                          className="h-9 bg-background border-border/80 px-2.5 text-xs font-medium"
                        />
                        <Package className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* SKU & Barcode Row */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* SKU Field with Auto-Generate */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-foreground/80 block">
                            {isAr ? 'رمز الصنف (SKU)' : 'SKU Code'} *
                          </span>
                          <button
                            type="button"
                            onClick={handleGenerateSku}
                            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                            title={isAr ? 'توليد كود SKU تلقائي' : 'Auto Generate SKU'}
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>{isAr ? 'توليد' : 'Generate'}</span>
                          </button>
                        </div>
                        <Input
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          required
                          dir="ltr"
                          placeholder="PRD-1001"
                          className="h-9 bg-background border-border/80 px-2.5 font-mono text-xs font-bold text-foreground"
                        />
                      </div>

                      {/* Barcode Field with Auto-Generate */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-foreground/80 block">
                            {isAr ? 'الباركود الدولي' : 'Barcode'}
                          </span>
                          <button
                            type="button"
                            onClick={handleGenerateBarcode}
                            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                            title={isAr ? 'توليد باركود دولي' : 'Auto Generate Barcode'}
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>{isAr ? 'توليد' : 'Generate'}</span>
                          </button>
                        </div>
                        <Input
                          value={barcode}
                          onChange={(e) => setBarcode(e.target.value)}
                          dir="ltr"
                          placeholder="628100..."
                          className="h-9 bg-background border-border/80 px-2.5 font-mono text-xs font-medium text-foreground"
                        />
                      </div>
                    </div>

                    {/* Category Selection with Custom Toggle */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground/80 block">
                        {isAr ? 'التصنيف / العائلة المخزنية' : 'Category'} *
                      </span>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 min-w-0">
                          {isCustomCategory ? (
                            <Input
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                              placeholder={isAr ? 'أدخل اسم التصنيف الجديد...' : 'Category name...'}
                              required
                              className="h-9 bg-background border-border/80 px-2.5 text-xs font-medium"
                            />
                          ) : (
                            <select
                              value={category}
                              onChange={(e) => {
                                if (e.target.value === '__custom__') {
                                  setIsCustomCategory(true);
                                  setCategory('');
                                } else {
                                  setCategory(e.target.value);
                                }
                              }}
                              className="w-full h-9 rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                            >
                              {categoriesList.map((c) => (
                                <option key={c.id || c.name} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                              <option value="__custom__">{isAr ? '+ تصنيف مخصص...' : '+ Custom Category...'}</option>
                            </select>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsCustomCategory(!isCustomCategory);
                            if (isCustomCategory && categoriesList.length > 0) {
                              setCategory(categoriesList[0].name);
                            }
                          }}
                          className="h-9 px-2.5 text-xs font-semibold shrink-0 gap-1.5"
                        >
                          <List className="w-3.5 h-3.5" />
                          <span>{isCustomCategory ? (isAr ? 'من القائمة' : 'From List') : (isAr ? 'مخصص' : 'Custom')}</span>
                        </Button>
                      </div>
                    </div>

                    {/* Unit of Measure & Primary Warehouse Grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Unit of Measure */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-foreground/80 block">
                          {isAr ? 'وحدة القياس' : 'Unit'} *
                        </span>
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className="w-full h-9 rounded-lg border border-border/80 bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                        >
                          <option value="قطعة">{isAr ? 'قطعة (Piece)' : 'Piece'}</option>
                          <option value="كجم">{isAr ? 'كجم (كيلوغرام) ⚖️' : 'Kg (Scale ⚖️)'}</option>
                          <option value="غرام">{isAr ? 'غرام (Gram) ⚖️' : 'Gram ⚖️'}</option>
                          <option value="صندوق">{isAr ? 'صندوق (Box)' : 'Box'}</option>
                          <option value="طرد">{isAr ? 'طرد (Package)' : 'Package'}</option>
                          <option value="بكرة">{isAr ? 'بكرة (Roll)' : 'Roll'}</option>
                          <option value="متر">{isAr ? 'متر (Meter)' : 'Meter'}</option>
                        </select>
                      </div>

                      {/* Primary Warehouse */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-foreground/80 block">
                          {isAr ? 'المستودع المعتمد' : 'Warehouse'}
                        </span>
                        <select
                          value={warehouseId}
                          onChange={(e) => setWarehouseId(e.target.value)}
                          className="w-full h-9 rounded-lg border border-border/80 bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                        >
                          {warehouses.length === 0 ? (
                            <option value="">{isAr ? 'لا توجد مستودعات' : 'No warehouses'}</option>
                          ) : (
                            warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {localizeWarehouse(w.nameAr || w.id, lang)}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Stock Balance & Bin Location */}
                <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                    <Boxes className="w-3.5 h-3.5 text-primary" />
                    <span>{isAr ? 'المخزون الفعلي والموقع' : 'Stock & Location'}</span>
                  </div>

                  {/* Physical Stock Snapshot with Safety Alerts */}
                  <div className={`p-2.5 rounded-lg border transition-all ${
                    isBelowSafety 
                      ? (isOutOfStock ? 'bg-destructive/10 border-destructive/30' : 'bg-amber-500/10 border-amber-500/30') 
                      : 'bg-muted/40 border-border/70'
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">
                          {isAr ? 'رصيد المخزون الفعلي' : 'On-Hand Stock'}
                        </span>
                        <span className="text-[10px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-1.5 py-0.2 rounded">
                          {isAr ? 'للقراءة فقط' : 'Read-only'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-background border border-border/80 shadow-2xs">
                        <span className={`text-xs font-mono font-bold ${isBelowSafety ? (isOutOfStock ? 'text-destructive' : 'text-amber-600 dark:text-amber-400') : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {currentStockVal}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {product.unit || (isAr ? 'قطعة' : 'Unit')}
                        </span>
                      </div>
                    </div>

                    {isBelowSafety && (
                      <div className={`flex items-center gap-1.5 text-[10.5px] font-bold py-1 px-2 rounded mb-1.5 ${
                        isOutOfStock ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      }`}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {isOutOfStock 
                            ? (isAr ? 'نفاد تام من المخزون (0 رصيد) - يتطلب توريداً' : 'Out of stock - Reorder urgently')
                            : (isAr ? 'المخزون تحت حد الأمان - يتطلب إعادة طلب' : 'Stock below safety reorder threshold')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground m-0 leading-tight">
                        {isAr 
                          ? 'التعديل المباشر مقفول نظامياً لضمان سلامة التدقيق.' 
                          : 'Locked for ledger audit integrity.'}
                      </p>
                      {onOpenAdjustment && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenAdjustment(product)}
                          className="h-7 px-2 text-[11px] font-bold text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 gap-1 shrink-0"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>{isAr ? 'تسوية مخزنية' : 'Adjustment'}</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Safety Alert & Shelf Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-0.5">
                    {/* Safety Reorder Point */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground/80 block">
                        {isAr ? 'حد تنبيه الأمان' : 'Safety Alert'}
                      </span>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          value={minStockAlert}
                          onChange={(e) => setMinStockAlert(parseInt(e.target.value) || 0)}
                          className="font-mono font-bold text-xs h-9 bg-background border-border/80 px-2.5"
                        />
                        <ShieldAlert className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* Shelf Location */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground/80 block">
                        {isAr ? 'الموقع والرف' : 'Shelf & Bin'}
                      </span>
                      <div className="relative">
                        <Input
                          type="text"
                          value={shelf}
                          onChange={(e) => setShelf(e.target.value)}
                          placeholder="A-01, B-03..."
                          className="font-mono font-bold text-xs h-9 bg-background border-border/80 px-2.5"
                        />
                        <MapPin className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: 3-Tier Pricing Architecture & Margin Analysis */}
              <div className="space-y-3.5">
                {/* Card 1: 3-Tier Pricing Architecture */}
                <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-primary" />
                      <span>{isAr ? 'نظام التسعير وحماية الهامش' : '3-Tier Pricing & Margin Safety'}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" />
                      {isAr ? 'محجوب عن الكاشير' : 'Secret from Cashier'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {/* 1. Cost Price (Secret) */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold flex items-center justify-between text-destructive">
                        <span>{isAr ? '1. سعر التكلفة (سري)' : '1. Cost Price (Secret)'} *</span>
                        <span className="text-[10px] font-bold font-mono">{effectiveCurrencySymbol}</span>
                      </span>
                      <div className="relative">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={costPrice || ''}
                          onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                          required
                          className={`font-mono font-bold text-xs h-9 px-2.5 ${
                            isCostPriceInvalid
                              ? 'border-destructive bg-destructive/5 text-destructive ring-1 ring-destructive'
                              : 'bg-background border-border/80 text-foreground'
                          }`}
                        />
                        <Lock className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      </div>
                      <span className="text-[10px] text-muted-foreground block">
                        {isAr ? 'محمي تماماً ومحجوب عن موظفي المبيعات' : 'Never exposed to sales or cashiers'}
                      </span>
                    </div>

                    {/* Pricing Grid: Retail & Floor Price */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 2. Official Retail Price */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                          <span>{isAr ? '2. سعر البيع الرسمي' : '2. Retail Price'} *</span>
                          <span className="text-[10px] font-bold font-mono">{effectiveCurrencySymbol}</span>
                        </span>
                        <div className="relative">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={sellingPrice || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setSellingPrice(val);
                              if (minSellingPrice === Math.round(sellingPrice * 0.88) || minSellingPrice === 0) {
                                setMinSellingPrice(Math.round(val * 0.88));
                              }
                            }}
                            required
                            className={`font-mono font-bold text-xs h-9 px-2.5 ${
                              isSellingPriceInvalid
                                ? 'border-destructive bg-destructive/5 text-destructive ring-1 ring-destructive'
                                : 'bg-background border-border/80 text-foreground'
                            }`}
                          />
                          <Tag className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                        </div>
                        <span className={`text-[10px] block ${isSellingPriceInvalid ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                          {isSellingPriceInvalid
                            ? (isAr ? 'أقل من التكلفة' : 'Below cost')
                            : (isAr ? 'السعر الافتراضي للزبون' : 'Default customer price')}
                        </span>
                      </div>

                      {/* 3. Floor Price */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold flex items-center justify-between text-amber-600 dark:text-amber-400">
                          <span>{isAr ? '3. أقل سعر مسموح' : '3. Floor Price'} *</span>
                          <span className="text-[10px] font-bold font-mono">{effectiveCurrencySymbol}</span>
                        </span>
                        <div className="relative">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={minSellingPrice || ''}
                            onChange={(e) => setMinSellingPrice(parseFloat(e.target.value) || 0)}
                            required
                            className={`font-mono font-bold text-xs h-9 px-2.5 ${
                              isMinPriceInvalid
                                ? 'border-destructive bg-destructive/5 text-destructive ring-1 ring-destructive'
                                : 'bg-background border-border/80 text-foreground'
                            }`}
                          />
                          <ShieldCheck className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                        </div>
                        <span className={`text-[10px] block ${isMinPriceInvalid ? 'text-destructive font-semibold' : 'text-amber-600 dark:text-amber-400'}`}>
                          {isMinPriceInvalid
                            ? (isAr ? 'أقل من التكلفة' : 'Below cost')
                            : (isAr ? 'سقف المكاسرة للكاشير' : 'Cashier floor limit')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Estimated Margin & Profitability Metrics */}
                <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      <span>{isAr ? 'مؤشرات الهامش والربحية التقديرية' : 'Estimated Margin & Profitability'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* Unit Profit */}
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/70 flex flex-col justify-between">
                      <span className="text-[10.5px] font-semibold text-muted-foreground">
                        {isAr ? 'هامش الربح الاسمي للقطعة' : 'Nominal Unit Profit'}
                      </span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className={`text-xs font-mono font-extrabold ${costPrice >= sellingPrice ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {(sellingPrice - costPrice).toLocaleString()} {effectiveCurrencySymbol}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${costPrice >= sellingPrice ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                          %{marginPercent}
                        </span>
                      </div>
                    </div>

                    {/* Cashier Discount Buffer */}
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/70 flex flex-col justify-between">
                      <span className="text-[10.5px] font-semibold text-muted-foreground">
                        {isAr ? 'سقف خصم الكاشير المتاح' : 'Cashier Discount Buffer'}
                      </span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xs font-mono font-extrabold text-amber-600 dark:text-amber-400">
                          {discountBuffer.toLocaleString()} {effectiveCurrencySymbol}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {isAr ? 'حد التفاوض' : 'Limit'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Profit Balance Indicator */}
                  <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/60">
                    <span className="text-muted-foreground font-medium">
                      {isAr ? 'حالة التوازن المالي للصنف:' : 'Financial Health:'}
                    </span>
                    {hasPricingViolation ? (
                      <span className="text-destructive font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {isAr ? 'خلل تسعيري حرج' : 'Critical Pricing Flaw'}
                      </span>
                    ) : (sellingPrice - costPrice) / (costPrice || 1) >= 0.2 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {isAr ? 'هامش ربح صحي ومستقر' : 'Healthy Profit Margin'}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        {isAr ? 'هامش ربح منخفض' : 'Low Margin Warning'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Action Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-border bg-muted/30 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>

            <Button
              type="submit"
              disabled={hasPricingViolation || !name.trim()}
              className="h-9 px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isAr ? 'حفظ التعديلات في النظام' : 'Save Changes'}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  );
}
