import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  Package,
  Trash2,
  Edit2,
  X,
  Boxes,
  Boxes as PackageCheck,
  AlertCircle,
  Tag
} from 'lucide-react';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';
import { apiClient } from '../../lib/api-client';
import {
  getStoredQuantityTiers,
  saveStoredQuantityTiers,
  saveProductQuantityTiers,
  deleteStoredQuantityTier,
  validateQuantityTierRanges,
  getStoredProductBundles,
  saveStoredProductBundles,
  getStoredProducts
} from '../../services/storageService';
import {
  ProductQuantityTier,
  ProductBundleItem
} from '../../types/businessModules';
import { Product } from '../../types/warehouse';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { ModalBackdropPortal } from '../ui/dialog';

interface PriceListsViewProps {
  lang: 'en' | 'ar';
}

interface TierDraftRow {
  minQty: string;
  maxQty: string;
  unitPrice: string;
}

export default function PriceListsView({ lang }: PriceListsViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const getProdName = (p?: Product) => p ? ((isAr ? p.nameAr : p.nameEn) || p.nameAr || p.nameEn) : '';

  const [activeTab, setActiveTab] = useState<'TIERS' | 'BUNDLES'>('TIERS');
  const [tiers, setTiers] = useState<ProductQuantityTier[]>(() => getStoredQuantityTiers());
  const [bundles, setBundles] = useState<ProductBundleItem[]>(() => getStoredProductBundles());
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());
  const [searchQuery, setSearchQuery] = useState('');

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Modals
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);

  // Add/Edit Quantity Tier Modal State
  const [tierProductId, setTierProductId] = useState('');
  const [tierRows, setTierRows] = useState<TierDraftRow[]>([{ minQty: '2', maxQty: '', unitPrice: '' }]);
  const [tierModalError, setTierModalError] = useState('');

  // Create Bundle Modal State
  const [bundleParentId, setBundleParentId] = useState('');
  const [bundleComponents, setBundleComponents] = useState<Array<{
    childProductId: string;
    quantity: number;
    unitPriceRatio: number;
  }>>([]);

  // Fetch remote data with offline fallback
  useEffect(() => {
    const fetchData = async () => {
      try {
        const tiersRes = await apiClient.get('/api/quantity-tiers');
        if (tiersRes && tiersRes.success && Array.isArray(tiersRes.data)) {
          const mappedTiers: ProductQuantityTier[] = tiersRes.data.map((t: any) => ({
            id: String(t.id ?? t.Id),
            productId: String(t.productId ?? t.ProductId),
            productSku: t.productSku ?? t.ProductSku ?? '',
            productName: t.productName ?? t.ProductName ?? '',
            baseSellingPrice: Number(t.baseSellingPrice ?? t.BaseSellingPrice ?? 0),
            minQty: Number(t.minQty ?? t.MinQty ?? 2),
            maxQty: t.maxQty !== null && t.maxQty !== undefined ? Number(t.maxQty) : (t.MaxQty !== null && t.MaxQty !== undefined ? Number(t.MaxQty) : null),
            unitPrice: Number(t.unitPrice ?? t.UnitPrice ?? 0),
            updatedAt: t.updatedAt ?? t.UpdatedAt
          }));
          setTiers(mappedTiers);
          saveStoredQuantityTiers(mappedTiers);
        }
      } catch {
        // fallback to localStorage tiers
      }

      try {
        const bRes = await apiClient.get('/api/bundles');
        if (bRes && bRes.success && Array.isArray(bRes.data)) {
          const flattened: ProductBundleItem[] = [];
          for (const b of bRes.data) {
            const pId = String(b.parentProductId ?? b.ParentProductId ?? '');
            const pName = b.bundleName ?? b.BundleName ?? '';
            const comps = Array.isArray(b.components ?? b.Components) ? (b.components ?? b.Components) : [];
            comps.forEach((c: any, idx: number) => {
              flattened.push({
                id: `${pId}-${c.componentProductId ?? c.ComponentProductId ?? idx}`,
                parentProductId: pId,
                parentProductName: pName,
                childProductId: String(c.componentProductId ?? c.ComponentProductId ?? ''),
                childProductName: c.componentName ?? c.ComponentName ?? '',
                childProductSku: c.componentSku ?? c.ComponentSku ?? '',
                quantity: Number(c.quantity ?? c.Quantity ?? 1),
                unitPriceRatio: 1.0
              });
            });
          }
          setBundles(flattened);
          saveStoredProductBundles(flattened);
        }
      } catch {
        // fallback to localStorage bundles
      }

      try {
        const prodRes = await apiClient.get('/api/products');
        const rawList = Array.isArray(prodRes)
          ? prodRes
          : (prodRes && Array.isArray(prodRes.data) ? prodRes.data : null);
        if (rawList && rawList.length > 0) {
          const mapped: Product[] = rawList
            .filter((p: any) => p && (p.id || p.Id))
            .map((p: any) => ({
              id: String(p.id ?? p.Id),
              sku: p.sku ?? p.Sku ?? '',
              barcode: p.barcode ?? p.Barcode ?? '',
              nameAr: p.nameAr ?? p.name ?? p.Name ?? p.sku ?? p.Sku ?? '',
              nameEn: p.nameEn ?? p.name ?? p.Name ?? p.sku ?? p.Sku ?? '',
              category: p.categoryName ?? p.CategoryName ?? p.category ?? '',
              costPrice: Number(p.costPrice ?? p.CostPrice ?? 0),
              sellingPrice: Number(p.sellingPrice ?? p.SellingPrice ?? p.retailPrice ?? p.RetailPrice ?? 0),
              unit: p.unitOfMeasure ?? p.UnitOfMeasure ?? p.unit ?? 'pcs',
              currentStock: Number(p.totalQuantity ?? p.TotalQuantity ?? p.currentStock ?? 0),
              minStockAlert: Number(p.minStockLevel ?? p.MinStockLevel ?? 0),
              warehouseId: p.warehouseId || '',
              warehouseName: p.warehouseName || '',
              status: Number(p.totalQuantity ?? p.TotalQuantity ?? p.currentStock ?? 0) > 0 ? 'available' : 'out_of_stock',
              shelf: p.shelf || 'A-01',
              updatedAt: p.updatedAt || new Date().toISOString().split('T')[0],
              isBundle: Boolean(p.isBundle ?? p.IsBundle),
              quantityTiers: Array.isArray(p.quantityTiers ?? p.QuantityTiers)
                ? (p.quantityTiers ?? p.QuantityTiers).map((t: any) => ({
                    id: String(t.id ?? t.Id ?? ''),
                    productId: String(t.productId ?? t.ProductId ?? p.id ?? p.Id ?? ''),
                    minQty: Number(t.minQty ?? t.MinQty ?? 2),
                    maxQty: t.maxQty ?? t.MaxQty ?? null,
                    unitPrice: Number(t.unitPrice ?? t.UnitPrice ?? 0),
                    updatedAt: t.updatedAt ?? t.UpdatedAt
                  }))
                : undefined
            }));
          setProducts(mapped);
        }
      } catch {
        // fallback to localStorage products
      }
    };

    fetchData();
  }, []);

  // Group bundles by parentProductId
  const bundleGroups = useMemo(() => {
    const groups = new Map<string, {
      parentProductId: string;
      parentProduct?: Product;
      components: ProductBundleItem[];
    }>();

    bundles.forEach(item => {
      if (!groups.has(item.parentProductId)) {
        const parent = products.find(p => p.id === item.parentProductId);
        groups.set(item.parentProductId, {
          parentProductId: item.parentProductId,
          parentProduct: parent,
          components: []
        });
      }
      groups.get(item.parentProductId)!.components.push(item);
    });

    return Array.from(groups.values());
  }, [bundles, products]);

  // Filtered Quantity Tiers
  const filteredTiers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const enriched = tiers.map(t => {
      const prod = products.find(p => p.id === t.productId);
      return {
        tier: t,
        product: prod,
        productName: prod ? getProdName(prod) : (t.productName || t.productId),
        productSku: prod?.sku || t.productSku || '',
        basePrice: prod ? Number(prod.sellingPrice) : Number(t.baseSellingPrice ?? 0)
      };
    });

    return enriched
      .filter(entry =>
        !q ||
        entry.productName.toLowerCase().includes(q) ||
        entry.productSku.toLowerCase().includes(q)
      )
      .sort((a, b) => a.productName.localeCompare(b.productName) || a.tier.minQty - b.tier.minQty);
  }, [tiers, products, searchQuery, isAr]);

  const filteredBundleGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bundleGroups;
    return bundleGroups.filter(bg => {
      const pName = (getProdName(bg.parentProduct) || bg.components[0]?.parentProductName || '').toLowerCase();
      const pSku = (bg.parentProduct?.sku || '').toLowerCase();
      return pName.includes(q) || pSku.includes(q) || bg.components.some(c =>
        c.childProductName.toLowerCase().includes(q) || c.childProductSku.toLowerCase().includes(q)
      );
    });
  }, [bundleGroups, searchQuery, isAr]);

  // KPIs
  const totalProductsWithTiers = useMemo(() => new Set(tiers.map(t => t.productId)).size, [tiers]);
  const totalTierRules = tiers.length;
  const totalBundles = bundleGroups.length;
  const totalComponents = bundles.length;

  // Open Quantity Tier Modal (New or Edit Existing Product)
  const openTierModal = (preselectedProductId?: string) => {
    setTierModalError('');
    if (preselectedProductId) {
      setTierProductId(preselectedProductId);
      const existing = tiers
        .filter(t => t.productId === preselectedProductId)
        .sort((a, b) => a.minQty - b.minQty);
      if (existing.length > 0) {
        setTierRows(
          existing.map(t => ({
            minQty: String(t.minQty),
            maxQty: t.maxQty != null ? String(t.maxQty) : '',
            unitPrice: String(t.unitPrice)
          }))
        );
      } else {
        setTierRows([{ minQty: '2', maxQty: '', unitPrice: '' }]);
      }
    } else {
      setTierProductId('');
      setTierRows([{ minQty: '2', maxQty: '', unitPrice: '' }]);
    }
    setIsTierModalOpen(true);
  };

  const handleSelectModalProduct = (prodId: string) => {
    setTierProductId(prodId);
    setTierModalError('');
    const existing = tiers
      .filter(t => t.productId === prodId)
      .sort((a, b) => a.minQty - b.minQty);
    if (existing.length > 0) {
      setTierRows(
        existing.map(t => ({
          minQty: String(t.minQty),
          maxQty: t.maxQty != null ? String(t.maxQty) : '',
          unitPrice: String(t.unitPrice)
        }))
      );
    } else {
      const prod = products.find(p => p.id === prodId);
      setTierRows([
        {
          minQty: '2',
          maxQty: '',
          unitPrice: prod && prod.sellingPrice > 0 ? String(Math.round(prod.sellingPrice * 0.9 * 100) / 100) : ''
        }
      ]);
    }
  };

  const handleAddTierRow = () => {
    const last = tierRows[tierRows.length - 1];
    const lastMax = last?.maxQty ? Number(last.maxQty) : 0;
    const lastMin = last?.minQty ? Number(last.minQty) : 2;
    const suggestedMin = lastMax >= lastMin ? lastMax + 1 : lastMin + 5;
    setTierRows([...tierRows, { minQty: String(suggestedMin), maxQty: '', unitPrice: '' }]);
  };

  const handleSaveTiers = async (e: React.FormEvent) => {
    e.preventDefault();
    setTierModalError('');

    if (!tierProductId) {
      setTierModalError(getTranslation(lang, 'quantityPricing.selectValidProduct'));
      return;
    }

    if (tierRows.length === 0) {
      setTierModalError(getTranslation(lang, 'quantityPricing.atLeastOneTier'));
      return;
    }

    const parsed = tierRows.map(r => ({
      minQty: Number(r.minQty),
      maxQty: r.maxQty.trim() !== '' ? Number(r.maxQty) : null,
      unitPrice: Number(r.unitPrice)
    }));

    const validation = validateQuantityTierRanges(parsed);
    if (!validation.valid) {
      const errKey = validation.errorCode ? `errors.${validation.errorCode}` : 'errors.ERR_INVALID_QTY_RANGE';
      setTierModalError(getTranslation(lang, errKey));
      return;
    }

    const prod = products.find(p => p.id === tierProductId);
    try {
      const res = await apiClient.put('/api/quantity-tiers', {
        productId: tierProductId,
        tiers: parsed
      });
      if (res && res.success && Array.isArray(res.data)) {
        const remoteTiers: ProductQuantityTier[] = res.data.map((t: any) => ({
          id: String(t.id ?? t.Id),
          productId: String(t.productId ?? t.ProductId),
          productSku: t.productSku ?? t.ProductSku ?? prod?.sku ?? '',
          productName: t.productName ?? t.ProductName ?? getProdName(prod),
          baseSellingPrice: Number(t.baseSellingPrice ?? t.BaseSellingPrice ?? prod?.sellingPrice ?? 0),
          minQty: Number(t.minQty ?? t.MinQty),
          maxQty: t.maxQty ?? t.MaxQty ?? null,
          unitPrice: Number(t.unitPrice ?? t.UnitPrice),
          updatedAt: t.updatedAt ?? t.UpdatedAt
        }));
        const nextAll = [...tiers.filter(x => x.productId !== tierProductId), ...remoteTiers];
        setTiers(nextAll);
        saveStoredQuantityTiers(nextAll);
        setIsTierModalOpen(false);
        showToast(getTranslation(lang, 'quantityPricing.tiersSaved'));
        return;
      }
      if (res && res.success === false && res.errorCode) {
        setTierModalError(getTranslation(lang, `errors.${res.errorCode}`) || res.errorCode);
        return;
      }
    } catch {
      // fallback to localStorage
    }

    saveProductQuantityTiers(tierProductId, parsed, {
      sku: prod?.sku,
      name: getProdName(prod),
      baseSellingPrice: prod?.sellingPrice
    });
    setTiers(getStoredQuantityTiers());
    setIsTierModalOpen(false);
    showToast(getTranslation(lang, 'quantityPricing.tiersSaved'));
  };

  const handleDeleteTier = async (tierId: string) => {
    try {
      await apiClient.delete(`/api/quantity-tiers/${tierId}`);
    } catch {
      // fallback to local
    }
    deleteStoredQuantityTier(tierId);
    setTiers(getStoredQuantityTiers());
    showToast(getTranslation(lang, 'quantityPricing.tierDeleted'));
  };

  // Bundle Handlers
  const openBundleModal = () => {
    setBundleParentId('');
    setBundleComponents([{ childProductId: '', quantity: 1, unitPriceRatio: 1.0 }]);
    setIsBundleModalOpen(true);
  };

  const handleCreateBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    const validComponents = bundleComponents.filter(bc => bc.childProductId && bc.quantity > 0);
    if (!bundleParentId || validComponents.length === 0 || validComponents.length !== bundleComponents.length) {
      showToast(getTranslation(lang, 'bundles.validationError'));
      return;
    }

    const parent = products.find(x => x.id === bundleParentId);
    const newItems: ProductBundleItem[] = validComponents.map((bc, idx) => {
      const child = products.find(x => x.id === bc.childProductId);
      return {
        id: `PBI-${Date.now()}-${idx}`,
        parentProductId: bundleParentId,
        parentProductName: getProdName(parent),
        childProductId: bc.childProductId,
        childProductName: getProdName(child) || bc.childProductId,
        childProductSku: child?.sku || '',
        quantity: bc.quantity,
        unitPriceRatio: bc.unitPriceRatio
      };
    });

    try {
      await apiClient.post('/api/bundles', {
        parentProductId: bundleParentId,
        components: validComponents.map(bc => ({
          componentProductId: bc.childProductId,
          quantity: bc.quantity
        }))
      });
    } catch {
      // fallback
    }

    const nextBundles = [...bundles.filter(b => b.parentProductId !== bundleParentId), ...newItems];
    setBundles(nextBundles);
    saveStoredProductBundles(nextBundles);

    setBundleParentId('');
    setBundleComponents([{ childProductId: '', quantity: 1, unitPriceRatio: 1.0 }]);
    setIsBundleModalOpen(false);
    showToast(getTranslation(lang, 'priceLists.bundleSaved'));
  };

  const handleDeleteBundle = async (parentProductId: string) => {
    try {
      await apiClient.delete(`/api/bundles/${parentProductId}`);
    } catch {
      // fallback
    }
    const nextBundles = bundles.filter(b => b.parentProductId !== parentProductId);
    setBundles(nextBundles);
    saveStoredProductBundles(nextBundles);
    showToast(getTranslation(lang, 'quantityPricing.bundleDeleted'));
  };

  const selectedTierProduct = useMemo(
    () => products.find(p => p.id === tierProductId),
    [products, tierProductId]
  );

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {toastMsg && (
        <div
          className="toast-banner glass-panel"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: isAr ? 'auto' : '24px',
            right: isAr ? '24px' : 'auto',
            zIndex: 9999
          }}
        >
          <CheckCircle2 size={16} className="green-text" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <Layers size={16} style={{ color: 'var(--primary)' }} />
            <span>{getTranslation(lang, 'quantityPricing.subtitle')}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          {activeTab === 'BUNDLES' ? (
            <button
              type="button"
              className="btn-clean-primary"
              onClick={openBundleModal}
            >
              <PackageCheck size={15} />
              <span>{getTranslation(lang, 'priceLists.newBundle')}</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-clean-primary"
              onClick={() => openTierModal()}
            >
              <Plus size={15} />
              <span>{getTranslation(lang, 'quantityPricing.addQuantityPrice')}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'quantityPricing.kpiProductsWithTiers')}</span>
            <div className="module-kpi-value tabular-nums">
              {totalProductsWithTiers} <span className="kpi-sub-unit">{getTranslation(lang, 'priceLists.itemsCount')}</span>
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <Tag size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'quantityPricing.kpiTierRulesCount')}</span>
            <div className="module-kpi-value tabular-nums text-emerald-600 dark:text-emerald-400">
              {totalTierRules} <span className="kpi-sub-unit">{getTranslation(lang, 'quantityPricing.tabTiers')}</span>
            </div>
          </div>
          <div className="module-kpi-icon emerald">
            <Layers size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'quantityPricing.kpiBundlesCount')}</span>
            <div className="module-kpi-value tabular-nums text-violet-600 dark:text-violet-400">
              {totalBundles} <span className="kpi-sub-unit">{getTranslation(lang, 'priceLists.bundleSku')}</span>
            </div>
          </div>
          <div className="module-kpi-icon purple">
            <Boxes size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'quantityPricing.kpiComponentsCount')}</span>
            <div className="module-kpi-value tabular-nums">
              {totalComponents} <span className="kpi-sub-unit">{getTranslation(lang, 'priceLists.components')}</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Package size={20} />
          </div>
        </div>
      </div>

      {/* Minimalist Two-Tab Switcher + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="module-tabs-wrap" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`module-tab-btn ${activeTab === 'TIERS' ? 'active' : ''}`}
            onClick={() => setActiveTab('TIERS')}
          >
            <Layers size={15} />
            <span>{getTranslation(lang, 'quantityPricing.tabTiers')}</span>
          </button>
          <button
            type="button"
            className={`module-tab-btn ${activeTab === 'BUNDLES' ? 'active' : ''}`}
            onClick={() => setActiveTab('BUNDLES')}
          >
            <Boxes size={15} />
            <span>{getTranslation(lang, 'quantityPricing.tabBundles')}</span>
          </button>
        </div>

        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            className="input-clean w-full h-9 ps-9 pe-3 rounded-lg text-xs"
            placeholder={getTranslation(lang, 'quantityPricing.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tab 1: Direct Product Quantity Pricing */}
      {activeTab === 'TIERS' && (
        <div className="data-table-container clean-card" style={{ borderRadius: '14px', overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <table className="enterprise-table w-full text-xs">
              <thead>
                <tr>
                  <th>{getTranslation(lang, 'quantityPricing.colProduct')}</th>
                  <th className="text-center">{getTranslation(lang, 'quantityPricing.colBasePrice')}</th>
                  <th className="text-center">{getTranslation(lang, 'quantityPricing.colQtyRange')}</th>
                  <th className="text-center">{getTranslation(lang, 'quantityPricing.colTierPrice')}</th>
                  <th className="text-center">{getTranslation(lang, 'quantityPricing.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTiers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10">
                      <EmptyState
                        lang={lang}
                        icon={<Layers size={28} />}
                        title={getTranslation(lang, 'quantityPricing.noTiersFound')}
                        subtitle={getTranslation(lang, 'quantityPricing.noTiersHint')}
                        action={
                          <button
                            type="button"
                            className="btn-clean-primary"
                            onClick={() => openTierModal()}
                          >
                            <Plus size={14} />
                            <span>{getTranslation(lang, 'quantityPricing.addQuantityPrice')}</span>
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredTiers.map(({ tier, productName, productSku, basePrice }) => {
                    const savingsPct = basePrice > 0 && tier.unitPrice < basePrice
                      ? Math.round(((basePrice - tier.unitPrice) / basePrice) * 100)
                      : 0;
                    return (
                      <tr key={tier.id} className="hover:bg-muted/30 transition-colors">
                        <td>
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{productName}</span>
                            {productSku && (
                              <span className="text-[11px] font-mono text-muted-foreground" dir="ltr">
                                {productSku}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-center font-mono tabular-nums text-muted-foreground">
                          {formatMoney(basePrice)}
                        </td>
                        <td className="text-center">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold font-mono tabular-nums bg-primary/10 text-primary border border-primary/20"
                            dir="ltr"
                          >
                            {tier.maxQty != null
                              ? `${tier.minQty} - ${tier.maxQty}`
                              : `${tier.minQty} ${getTranslation(lang, 'quantityPricing.andAbove')}`}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="inline-flex items-center gap-2">
                            <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {formatMoney(tier.unitPrice)}
                            </span>
                            {savingsPct > 0 && (
                              <StatusBadge tone="emerald" label={`-${savingsPct}%`} />
                            )}
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openTierModal(tier.productId)}
                              title={getTranslation(lang, 'quantityPricing.editTooltip')}
                              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground cursor-pointer transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTier(tier.id)}
                              title={getTranslation(lang, 'quantityPricing.deleteTooltip')}
                              className="p-1.5 rounded-lg border border-border bg-card hover:bg-destructive/10 text-destructive cursor-pointer transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Product Bundles */}
      {activeTab === 'BUNDLES' && (
        <div className="data-table-container clean-card" style={{ borderRadius: '14px', overflow: 'hidden' }}>
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Package size={14} className="text-violet-500" />
              <span>{getTranslation(lang, 'priceLists.deductNotice')}</span>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="enterprise-table w-full text-xs">
              <thead>
                <tr>
                  <th>{getTranslation(lang, 'priceLists.bundleSku')}</th>
                  <th>{getTranslation(lang, 'priceLists.bundleName')}</th>
                  <th className="text-center">{getTranslation(lang, 'priceLists.bundlePrice')}</th>
                  <th>{getTranslation(lang, 'priceLists.components')}</th>
                  <th className="text-center">{getTranslation(lang, 'quantityPricing.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBundleGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10">
                      <EmptyState
                        lang={lang}
                        icon={<Boxes size={28} />}
                        title={getTranslation(lang, 'priceLists.noBundlesFound')}
                        subtitle={getTranslation(lang, 'priceLists.deductNotice')}
                        action={
                          <button
                            type="button"
                            className="btn-clean-primary"
                            onClick={openBundleModal}
                          >
                            <Plus size={14} />
                            <span>{getTranslation(lang, 'priceLists.newBundle')}</span>
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredBundleGroups.map(group => {
                    const bundleTitle = getProdName(group.parentProduct) || group.components[0]?.parentProductName || group.parentProductId;
                    const bundleSku = group.parentProduct?.sku || '-';
                    const bundlePrice = group.parentProduct?.sellingPrice ?? 0;
                    return (
                      <tr key={group.parentProductId} className="hover:bg-muted/30 transition-colors">
                        <td className="font-mono text-muted-foreground" dir="ltr">
                          {bundleSku}
                        </td>
                        <td className="font-semibold text-foreground">{bundleTitle}</td>
                        <td className="text-center font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatMoney(bundlePrice)}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {group.components.map(c => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted border border-border text-foreground"
                              >
                                <span>{c.childProductName}</span>
                                <span className="font-mono font-bold text-primary">×{c.quantity}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteBundle(group.parentProductId)}
                            title={getTranslation(lang, 'bundles.deleteBundle')}
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-destructive/10 text-destructive cursor-pointer transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Quantity Price */}
      {isTierModalOpen && (
        <ModalBackdropPortal onClose={() => setIsTierModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div
            className="modal-content glass-panel"
            style={{ maxWidth: '620px', width: '94%', borderRadius: '16px', padding: '24px' }}
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Layers size={18} />
                </div>
                <h3 className="m-0 text-base font-bold text-foreground">
                  {tierProductId
                    ? getTranslation(lang, 'quantityPricing.editQuantityPrice')
                    : getTranslation(lang, 'quantityPricing.addQuantityPrice')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTierModalOpen(false)}
                className="p-1.5 rounded-lg bg-transparent border-0 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTiers} className="flex flex-col gap-4">
              {/* Product Selector */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  {getTranslation(lang, 'quantityPricing.selectProduct')} *
                </label>
                <select
                  className="select-clean w-full h-10 px-3 rounded-lg"
                  value={tierProductId}
                  onChange={e => handleSelectModalProduct(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    {getTranslation(lang, 'quantityPricing.selectProductPlaceholder')}
                  </option>
                  {products.filter(p => Boolean(p.id)).map(p => (
                    <option key={p.id} value={p.id}>
                      {getProdName(p)}{p.sku ? ` (${p.sku})` : ''} — {formatMoney(p.sellingPrice)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Base Unit Price Reference */}
              {selectedTierProduct && (
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border">
                  <span className="text-xs font-medium text-muted-foreground">
                    {getTranslation(lang, 'quantityPricing.basePriceRef')}
                  </span>
                  <span className="text-sm font-mono font-bold tabular-nums text-foreground">
                    {formatMoney(selectedTierProduct.sellingPrice)}
                  </span>
                </div>
              )}

              {/* Repeatable Range Rows */}
              <div className="border border-border rounded-xl p-3.5 bg-muted/30 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    {getTranslation(lang, 'quantityPricing.tabTiers')} ({tierRows.length})
                  </span>
                  <button
                    type="button"
                    className="btn-clean-secondary py-1 px-2.5 text-[11px]"
                    onClick={handleAddTierRow}
                  >
                    <Plus size={12} />
                    <span>{getTranslation(lang, 'quantityPricing.addAnotherRange')}</span>
                  </button>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-[1fr_1fr_1.15fr_32px] gap-2 px-0.5 text-[11px] font-semibold text-muted-foreground">
                  <span>{getTranslation(lang, 'quantityPricing.fromQty')} *</span>
                  <span>{getTranslation(lang, 'quantityPricing.toQty')}</span>
                  <span>{getTranslation(lang, 'quantityPricing.unitPrice')} *</span>
                  <span />
                </div>

                <div className="flex flex-col gap-2">
                  {tierRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_1.15fr_32px] gap-2 items-center">
                      <input
                        type="number"
                        min="2"
                        step="1"
                        required
                        value={row.minQty}
                        onChange={e => {
                          const next = [...tierRows];
                          next[idx].minQty = e.target.value;
                          setTierRows(next);
                          setTierModalError('');
                        }}
                        className="input-clean w-full h-10 px-3 text-xs font-mono font-bold tabular-nums rounded-lg"
                      />

                      <input
                        type="number"
                        min={Number(row.minQty) || 2}
                        step="1"
                        placeholder={getTranslation(lang, 'quantityPricing.toQtyOptional')}
                        value={row.maxQty}
                        onChange={e => {
                          const next = [...tierRows];
                          next[idx].maxQty = e.target.value;
                          setTierRows(next);
                          setTierModalError('');
                        }}
                        className="input-clean w-full h-10 px-3 text-xs font-mono tabular-nums rounded-lg"
                      />

                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={row.unitPrice}
                        onChange={e => {
                          const next = [...tierRows];
                          next[idx].unitPrice = e.target.value;
                          setTierRows(next);
                          setTierModalError('');
                        }}
                        className="input-clean w-full h-10 px-3 text-xs font-mono font-bold tabular-nums rounded-lg"
                      />

                      <button
                        type="button"
                        disabled={tierRows.length <= 1}
                        onClick={() => setTierRows(tierRows.filter((_, i) => i !== idx))}
                        className={`w-8 h-9 flex items-center justify-center rounded-lg bg-transparent border-0 text-destructive transition-opacity ${
                          tierRows.length <= 1 ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer hover:bg-destructive/10'
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {tierModalError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{tierModalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 mt-1">
                <button
                  type="button"
                  className="btn-clean-secondary"
                  onClick={() => setIsTierModalOpen(false)}
                >
                  {getTranslation(lang, 'priceLists.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn-clean-primary"
                >
                  {getTranslation(lang, 'quantityPricing.saveTiers')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Modal: Create Product Bundle */}
      {isBundleModalOpen && (
        <ModalBackdropPortal onClose={() => setIsBundleModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div
            className="modal-content glass-panel"
            style={{ maxWidth: '600px', width: '92%', borderRadius: '16px', padding: '24px' }}
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Boxes size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{getTranslation(lang, 'priceLists.newBundle')}</h3>
              </div>
              <button type="button" onClick={() => setIsBundleModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBundle} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  {getTranslation(lang, 'priceLists.parentProduct')} *
                </label>
                <select
                  className="select-clean w-full h-10 px-3 rounded-lg"
                  value={bundleParentId}
                  onChange={e => setBundleParentId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    {getTranslation(lang, 'bundles.select_main_product')}
                  </option>
                  {products.filter(p => Boolean(p.id)).map(p => (
                    <option key={p.id} value={p.id}>
                      {getProdName(p)}{p.sku ? ` (${p.sku})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Components */}
              <div className="border border-border rounded-xl p-3.5 bg-muted/40">
                <div className="flex justify-between items-center mb-2.5 gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {getTranslation(lang, 'priceLists.components')} ({bundleComponents.length})
                  </span>
                  <button
                    type="button"
                    className="btn-clean-secondary py-1 px-2.5 text-[11px]"
                    onClick={() => {
                      setBundleComponents([
                        ...bundleComponents,
                        { childProductId: '', quantity: 1, unitPriceRatio: 1.0 }
                      ]);
                    }}
                  >
                    <Plus size={12} />
                    <span>{getTranslation(lang, 'priceLists.addComponent')}</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {bundleComponents.map((bc, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_84px_32px] gap-2 items-center">
                      <select
                        className="select-clean w-full h-10 px-3 text-xs rounded-lg"
                        value={bc.childProductId}
                        required
                        onChange={e => {
                          const next = [...bundleComponents];
                          next[idx].childProductId = e.target.value;
                          setBundleComponents(next);
                        }}
                      >
                        <option value="" disabled>
                          {getTranslation(lang, 'bundles.select_component_product')}
                        </option>
                        {products
                          .filter(p => Boolean(p.id) && p.id !== bundleParentId)
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {getProdName(p)}{p.sku ? ` (${p.sku})` : ''}
                            </option>
                          ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        required
                        value={bc.quantity}
                        onChange={e => {
                          const next = [...bundleComponents];
                          next[idx].quantity = Math.max(1, Number(e.target.value));
                          setBundleComponents(next);
                        }}
                        className="input-clean w-full h-10 px-2 text-xs font-mono font-bold tabular-nums text-center rounded-lg"
                      />

                      <button
                        type="button"
                        disabled={bundleComponents.length <= 1}
                        onClick={() => setBundleComponents(bundleComponents.filter((_, i) => i !== idx))}
                        className={`w-8 h-9 flex items-center justify-center rounded-lg bg-transparent border-0 text-destructive transition-opacity ${
                          bundleComponents.length <= 1 ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer hover:bg-destructive/10'
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  className="btn-clean-secondary"
                  onClick={() => setIsBundleModalOpen(false)}
                >
                  {getTranslation(lang, 'priceLists.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn-clean-primary"
                >
                  {getTranslation(lang, 'priceLists.saveBundle')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}
    </div>
  );
}
