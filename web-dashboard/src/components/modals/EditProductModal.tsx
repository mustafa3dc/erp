"use client";

import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  CheckCircle2,
  AlertCircle,
  List,
  SlidersHorizontal,
  Lock,
  Boxes,
  MapPin,
  RefreshCw,
  Layers,
  Plus,
  Trash2,
  ShieldAlert,
  CreditCard
} from 'lucide-react';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Product } from '../../types/warehouse';
import {
  getStoredWarehouses,
  getStoredCategories,
  saveStoredCategories,
  getProductQuantityTiers,
  saveProductQuantityTiers,
  validateQuantityTierRanges
} from '../../services/storageService';
import { useSettings } from '../../context/settings-context';
import { useTenantFeatures } from '../../hooks/useAuth';
import { localizeWarehouse, localizeUnit } from '../../lib/localeHelpers';
import { validateProductPricing } from '../../schemas/ProductValidationSchema';
import { getTranslation } from '../../lib/i18n';
import { apiClient } from '../../lib/api-client';

interface EditProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
  onSave: (updatedProduct: Product) => void;
  onOpenAdjustment?: (product: Product) => void;
}

type ModalTab = 'GENERAL' | 'STOCK' | 'TIERS';

interface ShelfOption {
  id: string;
  name: string;
  code?: string | null;
}

export default function EditProductModal({
  product,
  isOpen,
  onClose,
  lang = 'ar',
  onSave,
  onOpenAdjustment
}: EditProductModalProps) {
  // 1. Mandatory Unconditional Hooks
  const isAr = lang === 'ar';
  const localeKey: 'ar' | 'en' = lang === 'en' ? 'en' : 'ar';
  const t = (key: string) => getTranslation(localeKey, key);
  const { financialSettings, formatMoney } = useSettings();
  const { isFeatureEnabled } = useTenantFeatures();
  const isSerialModuleEnabled = isFeatureEnabled('enableSerialNumbers');
  const effectiveCurrencySymbol = financialSettings.baseCurrency.symbol;

  const warehouses = getStoredWarehouses();
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ModalTab>('GENERAL');

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
  const [warehouseShelves, setWarehouseShelves] = useState<ShelfOption[]>([]);
  const [isCustomShelf, setIsCustomShelf] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [unit, setUnit] = useState('قطعة');
  const [requiresSerialNumber, setRequiresSerialNumber] = useState(false);
  const [warrantyMonths, setWarrantyMonths] = useState(0);
  const [tierDrafts, setTierDrafts] = useState<Array<{ id?: string; minQty: string; maxQty: string; unitPrice: string }>>([]);
  const [tierError, setTierError] = useState('');

  // Synchronize state when modal opens or a different product is loaded
  useEffect(() => {
    if (product && isOpen) {
      setActiveTab('GENERAL');
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
      setIsCustomShelf(false);
      setWarehouseId(product.warehouseId || warehouses[0]?.id || '');
      setRequiresSerialNumber(Boolean(product.requiresSerialNumber));
      setWarrantyMonths(Math.max(0, Number(product.warrantyMonths) || 0));

      const loadedCats = getStoredCategories();
      setCategoriesList(loadedCats);
      const inStored = loadedCats.some(c => c.name === product.category);
      setIsCustomCategory(!inStored && !!product.category);

      const existingTiers = getProductQuantityTiers(product.id, product);
      setTierDrafts(
        existingTiers.map(tier => ({
          id: tier.id,
          minQty: String(tier.minQty),
          maxQty: tier.maxQty != null ? String(tier.maxQty) : '',
          unitPrice: String(tier.unitPrice),
        }))
      );
      setTierError('');
    }
  }, [product?.id, isOpen]);

  // Load shelves for the selected warehouse so the shelf picker displays live warehouse shelves
  useEffect(() => {
    if (!isOpen || !warehouseId) {
      setWarehouseShelves([]);
      return;
    }

    let cancelled = false;
    apiClient
      .get(`/api/warehouses/${encodeURIComponent(warehouseId)}/shelves`)
      .then((res: any) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        const mapped: ShelfOption[] = list
          .filter((s: any) => s && (s.name || s.code))
          .map((s: any) => ({
            id: String(s.id || s.code || s.name),
            name: String(s.name || s.code || ''),
            code: s.code ? String(s.code) : null,
          }));
        setWarehouseShelves(mapped);

        if (mapped.length > 0 && shelf) {
          const matchesShelf = mapped.some(
            s => s.code === shelf || s.name === shelf
          );
          if (!matchesShelf) {
            setIsCustomShelf(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setWarehouseShelves([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, warehouseId]);

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

  const hasPricingViolation = !pricingValidation.isValid;
  const isCostPriceInvalid = hasPricingViolation && (costPrice > sellingPrice || costPrice > minSellingPrice);
  const isSellingPriceInvalid = hasPricingViolation && (sellingPrice < costPrice || sellingPrice < minSellingPrice);
  const isMinPriceInvalid = hasPricingViolation && (minSellingPrice < costPrice || minSellingPrice > sellingPrice);

  // Stock & Margin metrics
  const currentStockVal = Number(product?.currentStock ?? 0);
  const alertThreshold = Number(minStockAlert) || 0;
  const isBelowSafety = currentStockVal <= alertThreshold;
  const isOutOfStock = currentStockVal <= 0;

  const unitProfit = sellingPrice - costPrice;
  const marginPercent = costPrice > 0 ? ((unitProfit / costPrice) * 100).toFixed(1) : '0.0';
  const discountBuffer = Math.max(0, sellingPrice - minSellingPrice);

  // 2. Safe Early Return after all hooks
  if (!isOpen || !product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    if (!cleanName) {
      setActiveTab('GENERAL');
      return;
    }

    const validation = validateProductPricing({
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      minSellingPrice: Number(minSellingPrice) || 0
    }, lang);

    if (!validation.isValid) {
      setActiveTab('GENERAL');
      return;
    }

    const selectedWh = warehouses.find(w => w.id === warehouseId);
    const localizedWhName = selectedWh?.nameAr ? localizeWarehouse(selectedWh.nameAr, lang) : product.warehouseName;
    const localizedWhNameEn = selectedWh?.nameEn ? localizeWarehouse(selectedWh.nameEn, 'en') : (product.warehouseNameEn || product.warehouseName);

    const finalCategory = category.trim() || t('editProduct.defaultCategory');
    if (finalCategory) {
      const currentStored = getStoredCategories();
      if (!currentStored.some(c => c.name.toLowerCase() === finalCategory.toLowerCase())) {
        saveStoredCategories([
          ...currentStored,
          {
            id: `CAT-${Date.now()}`,
            name: finalCategory,
            code: `CAT-${currentStored.length + 1}`
          }
        ]);
      }
    }

    const parsedTiers = tierDrafts
      .filter(tier => tier.minQty.trim() !== '' || tier.unitPrice.trim() !== '')
      .map(tier => ({
        id: tier.id,
        minQty: Number(tier.minQty),
        maxQty: tier.maxQty.trim() !== '' ? Number(tier.maxQty) : null,
        unitPrice: Number(tier.unitPrice),
      }));

    if (parsedTiers.length > 0) {
      const check = validateQuantityTierRanges(parsedTiers);
      if (!check.valid) {
        const errKey = check.errorCode ? `errors.${check.errorCode}` : 'errors.ERR_INVALID_QTY_RANGE';
        setTierError(t(errKey));
        setActiveTab('TIERS');
        return;
      }
    }

    const updatedTiers = saveProductQuantityTiers(product.id, parsedTiers, {
      sku: sku.trim() || product.sku,
      name: cleanName,
      baseSellingPrice: Number(sellingPrice) || 0,
    });

    apiClient.put('/api/quantity-tiers', {
      productId: product.id,
      tiers: parsedTiers.map(tier => ({ minQty: tier.minQty, maxQty: tier.maxQty, unitPrice: tier.unitPrice })),
    }).catch(() => {});

    const updated: Product = {
      ...product,
      nameAr: cleanName,
      nameEn: cleanName,
      sku: sku.trim() || product.sku,
      barcode: barcode.trim() || product.barcode,
      category: finalCategory,
      unit: unit || product.unit || t('editProduct.unitPiece'),
      unitEn: localizeUnit(unit || product.unit || 'قطعة', 'en'),
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      minSellingPrice: Number(minSellingPrice) || 0,
      minStockAlert: Number(minStockAlert) || 0,
      shelf: shelf?.trim() || 'A-01',
      warehouseId,
      warehouseName: localizedWhName,
      warehouseNameEn: localizedWhNameEn,
      requiresSerialNumber: isSerialModuleEnabled ? requiresSerialNumber : product.requiresSerialNumber,
      warrantyMonths: isSerialModuleEnabled ? Math.max(0, Number(warrantyMonths) || 0) : product.warrantyMonths,
      quantityTiers: updatedTiers.map(nt => ({
        id: nt.id,
        productId: nt.productId,
        minQty: nt.minQty,
        maxQty: nt.maxQty ?? null,
        unitPrice: nt.unitPrice,
        updatedAt: nt.updatedAt,
      })),
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    onSave(updated);
    onClose();
  };

  const displayUnit = localizeUnit(unit || product.unit || 'قطعة', localeKey);

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent
        className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl p-0 text-foreground overflow-hidden flex flex-col my-auto"
        style={{
          maxWidth: '42rem',
          width: '95%',
          maxHeight: '90vh',
          padding: 0,
          borderRadius: '1rem',
          backgroundColor: 'var(--card)',
          color: 'var(--foreground)',
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Clean Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-foreground m-0 truncate">
              {t('editProduct.title')}
            </h3>
            <span
              dir="ltr"
              className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border text-xs font-mono font-semibold shrink-0"
            >
              {sku || product.sku}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            title={t('editProduct.close')}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Clean 3-Tab Navigation */}
        <div
          className="px-6 pt-3 pb-0 border-b border-border bg-muted/50 shrink-0"
          style={{ backgroundColor: 'color-mix(in oklch, var(--muted) 40%, transparent)' }}
        >
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('GENERAL')}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer bg-transparent ${
                activeTab === 'GENERAL'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{t('editProduct.tabGeneralPricing')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STOCK')}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer bg-transparent ${
                activeTab === 'STOCK'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>{t('editProduct.tabStockLocation')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('TIERS')}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer bg-transparent ${
                activeTab === 'TIERS'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('editProduct.tabVolumePricing')}</span>
              {tierDrafts.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums bg-muted text-foreground border border-border">
                  {tierDrafts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Single-Column Form Body */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {/* Real-time Pricing Validation Banner */}
            {hasPricingViolation && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-destructive text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pricingValidation.errorMessage}</span>
              </div>
            )}

            {/* TAB 1: General & Pricing */}
            {activeTab === 'GENERAL' && (
              <div className="space-y-5">
                {/* Basic Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Product Name (Full Width) */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      {t('editProduct.productName')} *
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      dir="auto"
                      placeholder={t('editProduct.productNamePlaceholder')}
                      className="h-9 bg-background border-border text-sm font-medium"
                    />
                  </div>

                  {/* SKU + Inline Generate */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        {t('editProduct.sku')} *
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateSku}
                        title={t('editProduct.generateSkuTooltip')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{t('editProduct.generate')}</span>
                      </button>
                    </div>
                    <Input
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      required
                      dir="ltr"
                      placeholder={t('editProduct.skuPlaceholder')}
                      className="h-9 bg-background border-border font-mono text-xs font-semibold"
                    />
                  </div>

                  {/* Barcode + Inline Generate */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        {t('editProduct.barcode')}
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateBarcode}
                        title={t('editProduct.generateBarcodeTooltip')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{t('editProduct.generate')}</span>
                      </button>
                    </div>
                    <Input
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      dir="ltr"
                      placeholder={t('editProduct.barcodePlaceholder')}
                      className="h-9 bg-background border-border font-mono text-xs"
                    />
                  </div>

                  {/* Category Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      {t('editProduct.category')}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {isCustomCategory ? (
                          <Input
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder={t('editProduct.customCategoryPlaceholder')}
                            required
                            className="h-9 bg-background border-border text-xs"
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
                            className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            {categoriesList.map((c) => (
                              <option key={c.id || c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                            <option value="__custom__">{t('editProduct.customCategoryOption')}</option>
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
                        className="h-9 px-2.5 text-xs font-medium shrink-0 gap-1"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>{isCustomCategory ? t('editProduct.fromList') : t('editProduct.custom')}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Unit of Measure */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      {t('editProduct.unit')}
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="قطعة">{t('editProduct.unitPiece')}</option>
                      <option value="كجم">{t('editProduct.unitKg')}</option>
                      <option value="غرام">{t('editProduct.unitGram')}</option>
                      <option value="صندوق">{t('editProduct.unitBox')}</option>
                      <option value="طرد">{t('editProduct.unitPackage')}</option>
                      <option value="بكرة">{t('editProduct.unitRoll')}</option>
                      <option value="متر">{t('editProduct.unitMeter')}</option>
                    </select>
                  </div>
                </div>

                {/* Clean 3-Column Pricing Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Cost Price with subtle lock icon tooltip */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <span>{t('editProduct.costPrice')} *</span>
                        <span
                          title={t('editProduct.costPriceHiddenTooltip')}
                          className="inline-flex items-center text-muted-foreground cursor-help"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      </label>
                      <span className="text-[11px] font-mono text-muted-foreground">{effectiveCurrencySymbol}</span>
                    </div>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={costPrice || ''}
                      onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                      required
                      dir="ltr"
                      className={`h-9 font-mono text-xs font-semibold tabular-nums ${
                        isCostPriceInvalid
                          ? 'border-destructive bg-red-500/5 text-destructive ring-1 ring-destructive'
                          : 'bg-background border-border text-foreground'
                      }`}
                    />
                  </div>

                  {/* Selling Price */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        {t('editProduct.sellingPrice')} *
                      </label>
                      <span className="text-[11px] font-mono text-muted-foreground">{effectiveCurrencySymbol}</span>
                    </div>
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
                      dir="ltr"
                      className={`h-9 font-mono text-xs font-semibold tabular-nums ${
                        isSellingPriceInvalid
                          ? 'border-destructive bg-red-500/5 text-destructive ring-1 ring-destructive'
                          : 'bg-background border-border text-foreground'
                      }`}
                    />
                  </div>

                  {/* Min Selling Price */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        {t('editProduct.minSellingPrice')} *
                      </label>
                      <span className="text-[11px] font-mono text-muted-foreground">{effectiveCurrencySymbol}</span>
                    </div>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={minSellingPrice || ''}
                      onChange={(e) => setMinSellingPrice(parseFloat(e.target.value) || 0)}
                      required
                      dir="ltr"
                      className={`h-9 font-mono text-xs font-semibold tabular-nums ${
                        isMinPriceInvalid
                          ? 'border-destructive bg-red-500/5 text-destructive ring-1 ring-destructive'
                          : 'bg-background border-border text-foreground'
                      }`}
                    />
                  </div>
                </div>

                {/* Compact 1-Line Profit Summary Bar */}
                <div
                  className="bg-muted/50 border border-border rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm"
                  style={{ backgroundColor: 'color-mix(in oklch, var(--muted) 50%, transparent)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('editProduct.netProfit')}
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        unitProfit < 0
                          ? 'text-destructive'
                          : 'text-foreground'
                      }`}
                    >
                      {formatMoney(unitProfit)}
                    </span>
                    <span
                      dir="ltr"
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold tabular-nums ${
                        unitProfit < 0
                          ? 'bg-red-500/10 text-destructive'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {unitProfit >= 0 ? `+${marginPercent}%` : `${marginPercent}%`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('editProduct.discountCeiling')}
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      {formatMoney(discountBuffer)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Stock & Location */}
            {activeTab === 'STOCK' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Warehouse Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      {t('editProduct.warehouse')}
                    </label>
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {warehouses.length === 0 ? (
                        <option value="">{t('editProduct.noWarehouses')}</option>
                      ) : (
                        warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {localizeWarehouse(w.nameAr || w.id, lang)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Shelf Selector */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        {t('editProduct.shelfLocation')}
                      </label>
                      {warehouseShelves.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextCustom = !isCustomShelf;
                            setIsCustomShelf(nextCustom);
                            if (!nextCustom && warehouseShelves.length > 0) {
                              const first = warehouseShelves[0];
                              setShelf(first.code || first.name);
                            }
                          }}
                          className="text-[11px] font-medium text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer"
                        >
                          {isCustomShelf ? t('editProduct.fromList') : t('editProduct.custom')}
                        </button>
                      )}
                    </div>

                    {warehouseShelves.length > 0 && !isCustomShelf ? (
                      <select
                        value={shelf}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomShelf(true);
                          } else {
                            setShelf(e.target.value);
                          }
                        }}
                        className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        {warehouseShelves.map((s) => {
                          const val = s.code || s.name;
                          const label = s.code && s.name && s.code !== s.name
                            ? `${s.name} (${s.code})`
                            : val;
                          return (
                            <option key={s.id} value={val}>
                              {label}
                            </option>
                          );
                        })}
                        <option value="__custom__">{t('editProduct.customShelfOption')}</option>
                      </select>
                    ) : (
                      <div className="relative">
                        <Input
                          type="text"
                          value={shelf}
                          onChange={(e) => setShelf(e.target.value)}
                          placeholder={t('editProduct.shelfPlaceholder')}
                          dir="ltr"
                          className="h-9 bg-background border-border font-mono text-xs font-semibold"
                        />
                        <MapPin className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      </div>
                    )}
                  </div>

                  {/* Reorder Level */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-foreground block">
                      {t('editProduct.reorderLevel')}
                    </label>
                    <div className="relative sm:max-w-[calc(50%-0.5rem)]">
                      <Input
                        type="number"
                        min="0"
                        value={minStockAlert}
                        onChange={(e) => setMinStockAlert(parseInt(e.target.value) || 0)}
                        dir="ltr"
                        className="h-9 bg-background border-border font-mono text-xs font-semibold tabular-nums"
                      />
                      <ShieldAlert className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Clean Read-Only Stock Status Row */}
                <div
                  className="bg-muted/50 border border-border rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3"
                  style={{ backgroundColor: 'color-mix(in oklch, var(--muted) 50%, transparent)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('editProduct.currentStockLabel')}:
                    </span>
                    <span
                      className={`text-sm font-mono font-bold tabular-nums ${
                        isBelowSafety
                          ? (isOutOfStock ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {currentStockVal} {displayUnit}
                    </span>
                  </div>

                  {onOpenAdjustment && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenAdjustment(product)}
                      className="h-8 px-3 text-xs font-semibold gap-1.5"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>{t('editProduct.stockAdjustment')}</span>
                    </Button>
                  )}
                </div>

                {/* Conditional Serial & Warranty Fields (Shown ONLY when EnableSerialTrackingModule is active) */}
                {isSerialModuleEnabled && (
                  <div
                    className="rounded-lg border border-border bg-muted/50 p-3.5 space-y-3"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--muted) 35%, transparent)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-foreground block">
                          {t('serialTracking.requiresSerialTracking')}
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          {t('serialTracking.warrantyStartsOnSaleHint')}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={requiresSerialNumber}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setRequiresSerialNumber(checked);
                          if (checked && warrantyMonths === 0) {
                            setWarrantyMonths(12);
                          }
                        }}
                        className="h-4 w-4 accent-primary cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[120px] space-y-1">
                        <label className="text-xs font-semibold text-foreground block">
                          {t('serialTracking.warrantyMonthsLabel')}
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={warrantyMonths}
                          onChange={(e) => setWarrantyMonths(Math.max(0, Number(e.target.value) || 0))}
                          dir="ltr"
                          className="font-mono font-semibold text-xs h-8 bg-background border-border tabular-nums"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        {[0, 6, 12, 24].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setWarrantyMonths(m)}
                            className={`px-2 py-1 rounded text-[11px] font-mono font-semibold border cursor-pointer transition-colors ${
                              warrantyMonths === m
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {m === 0
                              ? t('serialTracking.noWarranty')
                              : `${m} ${t('serialTracking.monthUnit')}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Volume Pricing */}
            {activeTab === 'TIERS' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t('quantityPricing.sectionHint')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (tierDrafts.length === 0) {
                        setTierDrafts([
                          {
                            minQty: '2',
                            maxQty: '',
                            unitPrice: sellingPrice > 0 ? String(Math.round(sellingPrice * 0.9 * 100) / 100) : ''
                          }
                        ]);
                      } else {
                        const last = tierDrafts[tierDrafts.length - 1];
                        const lastMax = last?.maxQty ? Number(last.maxQty) : 0;
                        const lastMin = last?.minQty ? Number(last.minQty) : 2;
                        const nextMin = lastMax >= lastMin ? lastMax + 1 : lastMin + 5;
                        setTierDrafts([...tierDrafts, { minQty: String(nextMin), maxQty: '', unitPrice: '' }]);
                      }
                      setTierError('');
                    }}
                    className="h-8 px-3 text-xs font-semibold gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('quantityPricing.addTierRange')}</span>
                  </Button>
                </div>

                {tierDrafts.length === 0 ? (
                  <div
                    className="bg-muted/50 border border-border rounded-lg px-4 py-8 text-center text-xs text-muted-foreground"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--muted) 40%, transparent)' }}
                  >
                    {t('editProduct.volumePricingEmpty')}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-[1fr_1fr_1.15fr_32px] gap-2 text-xs font-semibold text-muted-foreground px-0.5">
                      <span>{t('quantityPricing.fromQty')}</span>
                      <span>{t('quantityPricing.toQty')}</span>
                      <span>{t('quantityPricing.unitPrice')}</span>
                      <span />
                    </div>

                    {tierDrafts.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_1.15fr_32px] gap-2 items-center">
                        <Input
                          type="number"
                          min="2"
                          step="1"
                          value={row.minQty}
                          onChange={e => {
                            const next = [...tierDrafts];
                            next[idx].minQty = e.target.value;
                            setTierDrafts(next);
                            setTierError('');
                          }}
                          dir="ltr"
                          className="font-mono font-semibold text-xs h-9 bg-background border-border tabular-nums"
                        />
                        <Input
                          type="number"
                          min={Number(row.minQty) || 2}
                          step="1"
                          placeholder={t('quantityPricing.toQtyOptional')}
                          value={row.maxQty}
                          onChange={e => {
                            const next = [...tierDrafts];
                            next[idx].maxQty = e.target.value;
                            setTierDrafts(next);
                            setTierError('');
                          }}
                          dir="ltr"
                          className="font-mono text-xs h-9 bg-background border-border tabular-nums"
                        />
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={row.unitPrice}
                          onChange={e => {
                            const next = [...tierDrafts];
                            next[idx].unitPrice = e.target.value;
                            setTierDrafts(next);
                            setTierError('');
                          }}
                          dir="ltr"
                          className="font-mono font-semibold text-xs h-9 bg-background border-border tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setTierDrafts(tierDrafts.filter((_, i) => i !== idx));
                            setTierError('');
                          }}
                          className="w-8 h-9 flex items-center justify-center rounded-lg bg-transparent border border-transparent text-destructive hover:bg-red-500/10 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {tierError && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-destructive text-xs font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{tierError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Modal Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-border bg-card shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold"
            >
              {t('editProduct.cancel')}
            </Button>

            <Button
              type="submit"
              disabled={hasPricingViolation || !name.trim()}
              className="h-9 px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('editProduct.saveChanges')}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  );
}
