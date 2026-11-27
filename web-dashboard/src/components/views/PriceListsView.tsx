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
  AlertTriangle,
  Tag,
  RefreshCw,
  TrendingUp,
  Barcode as BarcodeIcon
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
  getStoredProducts,
  generateNextBundleSku,
  generateNextBundleBarcode,
  getBundleAvailableStock,
  getBundleFinancials,
  saveVirtualBundleInStorage,
  deleteVirtualBundleInStorage
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

  // Create / Edit Decoupled Virtual Bundle Modal State
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [bundleName, setBundleName] = useState('');
  const [bundleSku, setBundleSku] = useState('');
  const [bundleBarcode, setBundleBarcode] = useState('');
  const [bundleSellingPrice, setBundleSellingPrice] = useState('');
  const [bundlePriceTouched, setBundlePriceTouched] = useState(false);
  const [bundleModalError, setBundleModalError] = useState('');
  const [bundleComponents, setBundleComponents] = useState<Array<{
    childProductId: string;
    quantity: number;
    unitPriceRatio: number;
  }>>([]);

  // Standalone physical products eligible to be bundle components (never virtual bundles)
  const physicalProducts = useMemo(
    () => products.filter(p => Boolean(p.id) && !p.isBundle),
    [products]
  );

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
            const pSku = b.bundleSku ?? b.BundleSku ?? '';
            const pBarcode = b.barcode ?? b.Barcode ?? '';
            const pName = b.bundleName ?? b.BundleName ?? '';
            const pSellingPrice = Number(b.bundleSellingPrice ?? b.BundleSellingPrice ?? 0);
            const comps = Array.isArray(b.components ?? b.Components) ? (b.components ?? b.Components) : [];
            comps.forEach((c: any, idx: number) => {
              flattened.push({
                id: `${pId}-${c.componentProductId ?? c.ComponentProductId ?? idx}`,
                parentProductId: pId,
                parentProductName: pName,
                parentProductSku: pSku,
                parentBarcode: pBarcode,
                parentSellingPrice: pSellingPrice,
                childProductId: String(c.componentProductId ?? c.ComponentProductId ?? ''),
                childProductName: c.componentName ?? c.ComponentName ?? '',
                childProductSku: c.componentSku ?? c.ComponentSku ?? '',
                quantity: Number(c.quantity ?? c.Quantity ?? 1),
                unitPriceRatio: 1.0,
                componentCostPrice: Number(c.componentCostPrice ?? c.ComponentCostPrice ?? 0),
                componentSellingPrice: Number(c.componentSellingPrice ?? c.ComponentSellingPrice ?? 0),
                availableStock: Number(c.availableStock ?? c.AvailableStock ?? 0)
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

  // Group bundles by parentProductId (supports both API and localStorage decoupled virtual bundles)
  const bundleGroups = useMemo(() => {
    const groups = new Map<string, {
      parentProductId: string;
      parentProduct?: Product;
      bundleName: string;
      bundleSku: string;
      barcode: string;
      sellingPrice: number;
      components: ProductBundleItem[];
    }>();

    bundles.forEach(item => {
      if (!groups.has(item.parentProductId)) {
        const parent = products.find(p => p.id === item.parentProductId);
        groups.set(item.parentProductId, {
          parentProductId: item.parentProductId,
          parentProduct: parent,
          bundleName: getProdName(parent) || item.parentProductName || item.parentProductId,
          bundleSku: parent?.sku || item.parentProductSku || '-',
          barcode: parent?.barcode || item.parentBarcode || '',
          sellingPrice: parent?.sellingPrice ?? item.parentSellingPrice ?? 0,
          components: []
        });
      }
      groups.get(item.parentProductId)!.components.push(item);
    });

    return Array.from(groups.values());
  }, [bundles, products, isAr]);

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
      const pName = bg.bundleName.toLowerCase();
      const pSku = bg.bundleSku.toLowerCase();
      const pBar = bg.barcode.toLowerCase();
      return pName.includes(q) || pSku.includes(q) || pBar.includes(q) || bg.components.some(c =>
        c.childProductName.toLowerCase().includes(q) || c.childProductSku.toLowerCase().includes(q)
      );
    });
  }, [bundleGroups, searchQuery]);

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

  // Bundle Handlers (Decoupled Create & Edit)
  const openBundleModal = (bundleToEdit?: (typeof bundleGroups)[number]) => {
    setBundleModalError('');
    if (bundleToEdit) {
      setEditingBundleId(bundleToEdit.parentProductId);
      setBundleName(bundleToEdit.bundleName);
      setBundleSku(bundleToEdit.bundleSku);
      setBundleBarcode(bundleToEdit.barcode || '');
      setBundleSellingPrice(String(bundleToEdit.sellingPrice));
      setBundlePriceTouched(true);
      setBundleComponents(
        bundleToEdit.components.map(c => ({
          childProductId: c.childProductId,
          quantity: Number(c.quantity) || 1,
          unitPriceRatio: 1.0
        }))
      );
    } else {
      setEditingBundleId(null);
      setBundleName('');
      setBundleSku(generateNextBundleSku(products));
      setBundleBarcode('');
      setBundleSellingPrice('');
      setBundlePriceTouched(false);
      setBundleComponents([{ childProductId: '', quantity: 1, unitPriceRatio: 1.0 }]);
    }
    setIsBundleModalOpen(true);
  };

  // Live Financial Summary inside Bundle Modal
  const bundleFinancials = useMemo(() => {
    const { totalCost, totalRetail } = getBundleFinancials(bundleComponents, products);
    const selling = Number(bundleSellingPrice) || 0;
    const profit = selling - totalCost;
    const marginPct = totalCost > 0
      ? Math.round((profit / totalCost) * 1000) / 10
      : (selling > 0 ? 100 : 0);
    const savings = Math.max(0, totalRetail - selling);
    const savingsPct = totalRetail > 0 && selling < totalRetail
      ? Math.round(((totalRetail - selling) / totalRetail) * 100)
      : 0;
    const isBelowCost = bundleSellingPrice.trim() !== '' && selling < totalCost;

    return {
      totalCost,
      totalRetail,
      selling,
      profit,
      marginPct,
      savings,
      savingsPct,
      isBelowCost
    };
  }, [bundleComponents, bundleSellingPrice, products]);

  // Suggest retail sum as initial selling price while user adds components (unless manually edited)
  useEffect(() => {
    if (isBundleModalOpen && !editingBundleId && !bundlePriceTouched && bundleFinancials.totalRetail > 0) {
      setBundleSellingPrice(String(bundleFinancials.totalRetail));
    }
  }, [isBundleModalOpen, editingBundleId, bundlePriceTouched, bundleFinancials.totalRetail]);

  const handleSaveBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBundleModalError('');

    const cleanName = bundleName.trim();
    const parsedPrice = Number(bundleSellingPrice);
    const validComponents = bundleComponents.filter(bc => bc.childProductId && bc.quantity > 0);

    if (!cleanName || bundleSellingPrice.trim() === '' || !Number.isFinite(parsedPrice) || parsedPrice < 0 || validComponents.length === 0 || validComponents.length !== bundleComponents.length) {
      setBundleModalError(getTranslation(lang, 'bundles.validationError'));
      return;
    }

    // Merge duplicate component rows cleanly
    const mergedMap = new Map<string, number>();
    for (const c of validComponents) {
      mergedMap.set(c.childProductId, (mergedMap.get(c.childProductId) || 0) + Number(c.quantity));
    }
    const normalizedComponents = Array.from(mergedMap.entries()).map(([childProductId, quantity]) => ({
      childProductId,
      quantity
    }));

    const targetSku = bundleSku.trim() || generateNextBundleSku(products);
    const targetBarcode = bundleBarcode.trim();

    try {
      const payload = {
        bundleId: editingBundleId || undefined,
        bundleName: cleanName,
        bundleSku: targetSku,
        barcode: targetBarcode || undefined,
        bundleSellingPrice: parsedPrice,
        components: normalizedComponents.map(bc => ({
          componentProductId: bc.childProductId,
          quantity: bc.quantity
        }))
      };

      const res = editingBundleId
        ? await apiClient.put(`/api/bundles/${editingBundleId}`, payload)
        : await apiClient.post('/api/bundles', payload);

      if (res && res.success === false && res.errorCode) {
        const translatedErr = getTranslation(lang, `errors.${res.errorCode}`);
        setBundleModalError(translatedErr && translatedErr !== `errors.${res.errorCode}` ? translatedErr : res.errorCode);
        return;
      }

      if (res && res.success && res.data) {
        const b = res.data;
        const savedId = String(b.parentProductId ?? b.ParentProductId ?? editingBundleId ?? '');
        const savedSku = b.bundleSku ?? b.BundleSku ?? targetSku;
        const savedBarcode = b.barcode ?? b.Barcode ?? targetBarcode;
        const savedName = b.bundleName ?? b.BundleName ?? cleanName;
        const savedPrice = Number(b.bundleSellingPrice ?? b.BundleSellingPrice ?? parsedPrice);

        const storageResult = saveVirtualBundleInStorage({
          bundleId: savedId,
          bundleName: savedName,
          bundleSku: savedSku,
          barcode: savedBarcode,
          bundleSellingPrice: savedPrice,
          components: normalizedComponents
        });

        setProducts(getStoredProducts());
        setBundles(prev => [
          ...prev.filter(x => x.parentProductId !== storageResult.bundleProduct.id),
          ...storageResult.bundleItems
        ]);
        setIsBundleModalOpen(false);
        showToast(getTranslation(lang, 'priceLists.bundleSaved'));
        return;
      }
    } catch {
      // offline fallback below
    }

    saveVirtualBundleInStorage({
      bundleId: editingBundleId,
      bundleName: cleanName,
      bundleSku: targetSku,
      barcode: targetBarcode,
      bundleSellingPrice: parsedPrice,
      components: normalizedComponents
    });

    setProducts(getStoredProducts());
    setBundles(getStoredProductBundles());
    setIsBundleModalOpen(false);
    showToast(getTranslation(lang, 'priceLists.bundleSaved'));
  };

  const handleDeleteBundle = async (parentProductId: string) => {
    try {
      await apiClient.delete(`/api/bundles/${parentProductId}`);
    } catch {
      // fallback
    }
    deleteVirtualBundleInStorage(parentProductId);
    setProducts(getStoredProducts());
    setBundles(getStoredProductBundles());
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
              onClick={() => openBundleModal()}
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
        <div style={{ display: 'flex', gap: '6px', padding: '4px', background: 'var(--muted)', borderRadius: '12px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('TIERS')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '7px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: activeTab === 'TIERS' ? 600 : 500,
              background: activeTab === 'TIERS' ? 'var(--card)' : 'transparent',
              color: activeTab === 'TIERS' ? 'var(--foreground)' : 'var(--muted-foreground)',
              boxShadow: activeTab === 'TIERS' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.18s'
            }}
          >
            <Layers size={15} />
            <span>{getTranslation(lang, 'quantityPricing.tabTiers')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BUNDLES')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '7px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: activeTab === 'BUNDLES' ? 600 : 500,
              background: activeTab === 'BUNDLES' ? 'var(--card)' : 'transparent',
              color: activeTab === 'BUNDLES' ? 'var(--foreground)' : 'var(--muted-foreground)',
              boxShadow: activeTab === 'BUNDLES' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.18s'
            }}
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
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead
                className="bg-muted/50 border-b border-border"
                style={{ backgroundColor: 'color-mix(in oklch, var(--muted) 50%, transparent)' }}
              >
                <tr>
                  <th className="px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'quantityPricing.colProduct')}
                  </th>
                  <th className="px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'quantityPricing.colBasePrice')}
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'quantityPricing.colQtyRange')}
                  </th>
                  <th className="px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'quantityPricing.colTierPrice')}
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'quantityPricing.colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
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
                      <tr key={tier.id} className="hover:bg-muted/30 hover:bg-muted transition-colors">
                        {/* Product Name + SKU — stacked tightly */}
                        <td className="px-4 py-3.5 align-middle text-start">
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-semibold text-foreground text-[13px] leading-snug">
                              {productName}
                            </span>
                            {productSku && (
                              <span
                                dir="ltr"
                                className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded tracking-wide"
                              >
                                {productSku}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Base Price — start-aligned, tabular-nums */}
                        <td className="px-4 py-3.5 align-middle text-start">
                          <span className="font-mono text-[13px] tabular-nums text-muted-foreground">
                            {formatMoney(basePrice)}
                          </span>
                        </td>

                        {/* Qty Range — centered compact pill badge */}
                        <td className="px-4 py-3.5 align-middle text-center">
                          <span
                            dir="ltr"
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-mono tabular-nums"
                            style={{
                              background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                              color: 'var(--primary)',
                              border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
                            }}
                          >
                            {tier.maxQty != null
                              ? `${tier.minQty} – ${tier.maxQty}`
                              : `${tier.minQty}+`}
                          </span>
                        </td>

                        {/* Tier Price + Savings Badge — start-aligned, inline-flex tight gap */}
                        <td className="px-4 py-3.5 align-middle text-start">
                          <span className="inline-flex items-center gap-2">
                            <span className="font-mono text-sm tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                              {formatMoney(tier.unitPrice)}
                            </span>
                            {savingsPct > 0 && (
                              <span
                                className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums"
                                style={{
                                  background: 'color-mix(in srgb, #10b981 15%, transparent)',
                                  color: '#059669',
                                  border: '1px solid color-mix(in srgb, #10b981 30%, transparent)',
                                }}
                              >
                                -{savingsPct}%
                              </span>
                            )}
                          </span>
                        </td>

                        {/* Actions — centered icon buttons */}
                        <td className="px-4 py-3.5 align-middle text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openTierModal(tier.productId)}
                              title={getTranslation(lang, 'quantityPricing.editTooltip')}
                              className="p-1.5 rounded-lg border border-border bg-card text-foreground cursor-pointer inline-flex items-center justify-center transition-colors hover:bg-muted"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTier(tier.id)}
                              title={getTranslation(lang, 'quantityPricing.deleteTooltip')}
                              className="p-1.5 rounded-lg border border-border bg-card text-destructive cursor-pointer inline-flex items-center justify-center transition-colors hover:bg-red-500/10"
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
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Info banner */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border"
            style={{ backgroundColor: 'color-mix(in oklch, var(--muted) 60%, transparent)' }}
          >
            <Package size={13} style={{ color: '#8b5cf6', flexShrink: 0 }} />
            <span className="text-xs text-muted-foreground">
              {getTranslation(lang, 'priceLists.deductNotice')}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>
              <thead
                className="bg-muted/50 border-b border-border"
                style={{ backgroundColor: 'color-mix(in oklch, var(--muted) 50%, transparent)' }}
              >
                <tr>
                  <th className="px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'priceLists.bundleSku')}
                  </th>
                  <th className="px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'priceLists.bundleName')}
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'bundles.colAvailableQty')}
                  </th>
                  <th className="px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'priceLists.bundlePrice')}
                  </th>
                  <th className="px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'priceLists.components')}
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getTranslation(lang, 'quantityPricing.colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBundleGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10">
                      <EmptyState
                        lang={lang}
                        icon={<Boxes size={28} />}
                        title={getTranslation(lang, 'priceLists.noBundlesFound')}
                        subtitle={getTranslation(lang, 'priceLists.deductNotice')}
                        action={
                          <button
                            type="button"
                            className="btn-clean-primary"
                            onClick={() => openBundleModal()}
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
                    const bundleTitle = group.bundleName;
                    const bundleSku = group.bundleSku;
                    const bundlePrice = group.sellingPrice;
                    const availableQty = getBundleAvailableStock(group.parentProductId, products, bundles);
                    const totalRetail = group.components.reduce((sum, c) => {
                      const compProd = products.find(p => p.id === c.childProductId);
                      const unitRetail = compProd?.sellingPrice ?? c.componentSellingPrice ?? 0;
                      return sum + unitRetail * (Number(c.quantity) || 1);
                    }, 0);
                    const savingsPct = totalRetail > 0 && bundlePrice < totalRetail
                      ? Math.round(((totalRetail - bundlePrice) / totalRetail) * 100)
                      : 0;

                    return (
                      <tr key={group.parentProductId} className="hover:bg-muted/30 hover:bg-muted transition-colors">
                        {/* SKU & Barcode — stacked, start-aligned */}
                        <td className="px-4 py-3.5 align-middle text-start">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              dir="ltr"
                              className="text-xs font-mono font-bold px-2 py-0.5 rounded whitespace-nowrap tracking-wide"
                              style={{
                                color: '#7c3aed',
                                background: 'color-mix(in srgb, #8b5cf6 10%, transparent)',
                                border: '1px solid color-mix(in srgb, #8b5cf6 22%, transparent)',
                              }}
                            >
                              {bundleSku}
                            </span>
                            {group.barcode && (
                              <span dir="ltr" className="text-[11px] font-mono text-muted-foreground">
                                {group.barcode}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Bundle Name + Badge — stacked tightly */}
                        <td className="px-4 py-3.5 align-middle text-start">
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-semibold text-foreground text-[13px] leading-snug">
                              {bundleTitle}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: 'color-mix(in srgb, #8b5cf6 12%, transparent)',
                                color: '#7c3aed',
                                border: '1px solid color-mix(in srgb, #8b5cf6 25%, transparent)'
                              }}
                            >
                              <Boxes size={10} />
                              <span>{getTranslation(lang, 'bundles.bundleBadge')}</span>
                            </span>
                          </div>
                        </td>
                        {/* Dynamically Available Qty */}
                        <td className="px-4 py-3.5 align-middle text-center" title={getTranslation(lang, 'bundles.dynamicStockHint')}>
                          <span
                            dir="ltr"
                            className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold font-mono tabular-nums"
                            style={{
                              background: availableQty > 5
                                ? 'color-mix(in srgb, #10b981 14%, transparent)'
                                : availableQty > 0
                                  ? 'color-mix(in srgb, #f59e0b 14%, transparent)'
                                  : 'color-mix(in srgb, #ef4444 14%, transparent)',
                              color: availableQty > 5 ? '#059669' : availableQty > 0 ? '#d97706' : '#dc2626',
                              border: `1px solid ${availableQty > 5 ? 'color-mix(in srgb, #10b981 28%, transparent)' : availableQty > 0 ? 'color-mix(in srgb, #f59e0b 28%, transparent)' : 'color-mix(in srgb, #ef4444 28%, transparent)'}`
                            }}
                          >
                            {availableQty}
                          </span>
                        </td>
                        {/* Price — start-aligned, inline-flex tight */}
                        <td className="px-4 py-3.5 align-middle text-start">
                          <span className="inline-flex items-center gap-2">
                            <span className="font-mono text-sm tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                              {formatMoney(bundlePrice)}
                            </span>
                            {savingsPct > 0 && (
                              <span
                                className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums"
                                style={{
                                  background: 'color-mix(in srgb, #10b981 14%, transparent)',
                                  color: '#059669',
                                  border: '1px solid color-mix(in srgb, #10b981 25%, transparent)'
                                }}
                              >
                                -{savingsPct}%
                              </span>
                            )}
                          </span>
                        </td>
                        {/* Components */}
                        <td className="px-4 py-3.5 align-middle text-start">
                          <div className="flex flex-wrap gap-1.5">
                            {group.components.map(c => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted border border-border text-foreground"
                              >
                                <span>{c.childProductName}</span>
                                <span className="font-mono font-bold text-primary tabular-nums">×{c.quantity}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        {/* Actions (Edit + Delete) — centered icon buttons */}
                        <td className="px-4 py-3.5 align-middle text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openBundleModal(group)}
                              title={getTranslation(lang, 'bundles.editBundle')}
                              className="p-1.5 rounded-lg border border-border bg-card text-foreground cursor-pointer inline-flex items-center justify-center transition-colors hover:bg-muted"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBundle(group.parentProductId)}
                              title={getTranslation(lang, 'bundles.deleteBundle')}
                              className="p-1.5 rounded-lg border border-border bg-card text-destructive cursor-pointer inline-flex items-center justify-center transition-colors hover:bg-red-500/10"
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

      {/* Modal: Create / Edit Decoupled Product Bundle */}
      {isBundleModalOpen && (
        <ModalBackdropPortal onClose={() => setIsBundleModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div
            className="modal-content glass-panel"
            style={{ maxWidth: '680px', width: '94%', maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px', padding: '24px' }}
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                  <Boxes size={20} />
                </div>
                <div>
                  <h3 className="m-0 text-base font-bold text-foreground">
                    {editingBundleId
                      ? getTranslation(lang, 'bundles.editBundleTitle')
                      : getTranslation(lang, 'bundles.createBundleTitle')}
                  </h3>
                  <p className="m-0 text-[11px] text-muted-foreground">
                    {getTranslation(lang, 'bundles.virtualNotice')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBundleModalOpen(false)}
                className="p-1.5 rounded-lg bg-transparent border-0 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBundle} className="flex flex-col gap-4">
              {/* Bundle Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  {getTranslation(lang, 'bundles.bundleNameLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={bundleName}
                  onChange={e => {
                    setBundleName(e.target.value);
                    setBundleModalError('');
                  }}
                  placeholder={getTranslation(lang, 'bundles.bundleNamePlaceholder')}
                  className="input-clean w-full h-10 px-3 text-sm rounded-lg"
                />
              </div>

              {/* Bundle SKU & Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    {getTranslation(lang, 'bundles.bundleSkuLabel')} *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={bundleSku}
                      onChange={e => {
                        setBundleSku(e.target.value);
                        setBundleModalError('');
                      }}
                      className="input-clean flex-1 h-10 px-3 text-xs font-mono font-bold rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setBundleSku(generateNextBundleSku(products))}
                      title={getTranslation(lang, 'bundles.regenerateSku')}
                      className="h-10 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center transition-colors"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    {getTranslation(lang, 'bundles.bundleBarcodeLabel')}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <BarcodeIcon size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        dir="ltr"
                        value={bundleBarcode}
                        onChange={e => {
                          setBundleBarcode(e.target.value);
                          setBundleModalError('');
                        }}
                        placeholder={getTranslation(lang, 'bundles.bundleBarcodePlaceholder')}
                        className="input-clean w-full h-10 ps-9 pe-3 text-xs font-mono rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setBundleBarcode(generateNextBundleBarcode(products))}
                      className="h-10 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground cursor-pointer transition-colors whitespace-nowrap"
                    >
                      {getTranslation(lang, 'bundles.generateBarcode')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Components Builder (Strictly Non-Bundle Physical Products) */}
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
                          setBundleModalError('');
                        }}
                      >
                        <option value="" disabled>
                          {getTranslation(lang, 'bundles.select_component_product')}
                        </option>
                        {physicalProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            {getProdName(p)}{p.sku ? ` (${p.sku})` : ''} — {formatMoney(p.sellingPrice)} [{getTranslation(lang, 'bundles.componentAvailLabel')}: {p.currentStock}]
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={bc.quantity}
                        onChange={e => {
                          const next = [...bundleComponents];
                          next[idx].quantity = Math.max(1, Number(e.target.value));
                          setBundleComponents(next);
                          setBundleModalError('');
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

              {/* Live Financial Summary Box + Bundle Selling Price */}
              <div className="border border-border rounded-xl p-3.5 bg-card flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className="text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    {getTranslation(lang, 'bundles.financialSummaryTitle')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border/80 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {getTranslation(lang, 'bundles.totalComponentsCost')}
                    </span>
                    <span className="text-xs font-mono font-bold tabular-nums text-foreground">
                      {formatMoney(bundleFinancials.totalCost)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border/80 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {getTranslation(lang, 'bundles.totalIndividualRetail')}
                    </span>
                    <span className="text-xs font-mono font-bold tabular-nums text-foreground">
                      {formatMoney(bundleFinancials.totalRetail)}
                    </span>
                  </div>
                </div>

                {/* Bundle Selling Price Input + Live Margin/Savings Indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      {getTranslation(lang, 'bundles.bundleSellingPriceLabel')} *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={bundleSellingPrice}
                      onChange={e => {
                        setBundleSellingPrice(e.target.value);
                        setBundlePriceTouched(true);
                        setBundleModalError('');
                      }}
                      className="input-clean w-full h-10 px-3 text-sm font-mono font-bold tabular-nums rounded-lg"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div
                      className={`px-3 py-1.5 rounded-lg border text-xs flex items-center justify-between ${
                        bundleFinancials.isBelowCost
                          ? 'bg-destructive/10 border-destructive/30 text-destructive'
                          : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      <span className="text-[11px] font-semibold">
                        {getTranslation(lang, 'bundles.estimatedProfit')}
                      </span>
                      <span className="font-mono font-bold tabular-nums" dir="ltr">
                        {formatMoney(bundleFinancials.profit)} ({bundleFinancials.marginPct >= 0 ? `+${bundleFinancials.marginPct}%` : `${bundleFinancials.marginPct}%`})
                      </span>
                    </div>

                    {bundleFinancials.totalRetail > 0 && (
                      <div className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[11px] flex items-center justify-between">
                        <span className="font-medium">
                          {getTranslation(lang, 'bundles.customerSavings')}
                        </span>
                        <span className="font-mono font-bold tabular-nums" dir="ltr">
                          {formatMoney(bundleFinancials.savings)} ({bundleFinancials.savingsPct}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {bundleFinancials.isBelowCost && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{getTranslation(lang, 'bundles.belowCostWarning')}</span>
                  </div>
                )}
              </div>

              {bundleModalError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{bundleModalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 mt-1">
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
