import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Search, 
  CheckCircle2, 
  Tag, 
  Package, 
  Users, 
  Percent, 
  ArrowRight, 
  Trash2, 
  Edit2, 
  X, 
  ShieldCheck, 
  Boxes,
  Boxes as PackageCheck
} from 'lucide-react';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';
import { apiClient } from '../../lib/api-client';
import { 
  getStoredPriceLists, 
  saveStoredPriceLists,
  getStoredProductBundles,
  saveStoredProductBundles,
  getStoredProducts,
  getStoredCustomers,
  saveStoredCustomers
} from '../../services/storageService';
import { 
  PriceList, 
  PriceListItem, 
  ProductBundleItem 
} from '../../types/businessModules';
import { Product } from '../../types/warehouse';

interface PriceListsViewProps {
  lang: 'en' | 'ar';
}

export default function PriceListsView({ lang }: PriceListsViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const getProdName = (p?: Product) => p ? ((isAr ? p.nameAr : p.nameEn) || p.nameAr || p.nameEn) : '';

  const [activeTab, setActiveTab] = useState<'LISTS' | 'BUNDLES' | 'CUSTOMERS'>('LISTS');
  const [priceLists, setPriceLists] = useState<PriceList[]>(() => getStoredPriceLists());
  const [bundles, setBundles] = useState<ProductBundleItem[]>(() => getStoredProductBundles());
  const [products] = useState<Product[]>(() => getStoredProducts());
  const [customers, setCustomers] = useState(() => getStoredCustomers());

  const [selectedListId, setSelectedListId] = useState<string>(() => priceLists[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Modals state
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Form: Price List
  const [plCode, setPlCode] = useState('');
  const [plName, setPlName] = useState('');
  const [plNameAr, setPlNameAr] = useState('');
  const [plCurrency, setPlCurrency] = useState('USD');
  const [plCustomerTier, setPlCustomerTier] = useState('BRONZE');
  const [plDescription, setPlDescription] = useState('');

  // Form: Bundle
  const [bundleParentId, setBundleParentId] = useState('');
  const [bundleComponents, setBundleComponents] = useState<Array<{
    childProductId: string;
    quantity: number;
    unitPriceRatio: number;
  }>>([]);

  // Form: Tier Rule
  const [tierProductId, setTierProductId] = useState('');
  const [tierMinQty, setTierMinQty] = useState<number>(5);
  const [tierPrice, setTierPrice] = useState<number | ''>('');
  const [tierDiscount, setTierDiscount] = useState<number>(10);

  // Form: Assign Customer
  const [assignCustomerId, setAssignCustomerId] = useState('');
  const [assignListId, setAssignListId] = useState('');

  // Fetch API with fallback
  useEffect(() => {
    const fetchData = async () => {
      try {
        const plRes = await apiClient.get('/api/price-lists');
        if (plRes && plRes.success && Array.isArray(plRes.data)) {
          setPriceLists(plRes.data);
          saveStoredPriceLists(plRes.data);
        }
      } catch {
        // fallback
      }

      try {
        const bRes = await apiClient.get('/api/price-lists/bundles');
        if (bRes && bRes.success && Array.isArray(bRes.data)) {
          setBundles(bRes.data);
          saveStoredProductBundles(bRes.data);
        }
      } catch {
        // fallback
      }
    };
    fetchData();
  }, []);

  const currentPriceList = priceLists.find(pl => pl.id === selectedListId) || priceLists[0];

  // Initialize bundle components when bundle modal opens
  useEffect(() => {
    if (isBundleModalOpen) {
      if (products.length > 0 && !bundleParentId) {
        setBundleParentId(products[0].id);
      }
      if (bundleComponents.length === 0 && products.length > 1) {
        setBundleComponents([{
          childProductId: products[1].id,
          quantity: 1,
          unitPriceRatio: 1.0
        }]);
      }
    }
  }, [isBundleModalOpen, products, bundleParentId, bundleComponents.length]);

  // KPIs
  const totalLists = priceLists.length;
  const totalBundles = new Set(bundles.map(b => b.parentProductId)).size;
  const totalTiers = priceLists.reduce((sum, pl) => sum + (pl.items ? pl.items.length : 0), 0);
  const totalAssignedCustomers = customers.filter(c => (c as any).priceListId).length;

  // Create Price List
  const handleCreatePriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plCode.trim() || !plName.trim()) return;

    const payload = {
      code: plCode.trim().toUpperCase(),
      name: plName.trim(),
      nameAr: plNameAr.trim() || undefined,
      currency: plCurrency,
      customerTier: plCustomerTier,
      isDefault: false,
      description: plDescription.trim() || undefined
    };

    let newPL: PriceList = {
      id: `PL-${Date.now()}`,
      tenantId: 'default',
      code: payload.code,
      name: payload.name,
      nameAr: payload.nameAr,
      currency: payload.currency,
      customerTier: payload.customerTier,
      isDefault: false,
      isActive: true,
      description: payload.description,
      createdAt: new Date().toISOString(),
      items: []
    };

    try {
      const res = await apiClient.post('/api/price-lists', payload);
      if (res && res.success && res.data) {
        newPL = { ...newPL, id: res.data.id || newPL.id };
      }
    } catch {
      // fallback
    }

    const next = [...priceLists, newPL];
    setPriceLists(next);
    saveStoredPriceLists(next);
    setSelectedListId(newPL.id);

    setIsListModalOpen(false);
    setPlCode('');
    setPlName('');
    setPlNameAr('');
    setPlDescription('');
    showToast(getTranslation(lang, 'priceLists.createSuccess'));
  };

  // Add Tier Rule to selected list
  const handleAddTierRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPriceList || !tierProductId) return;

    const p = products.find(x => x.id === tierProductId);
    const newItem: PriceListItem = {
      id: `PLI-${Date.now()}`,
      priceListId: currentPriceList.id,
      productId: tierProductId,
      productName: getProdName(p),
      productSku: p?.sku,
      basePrice: p?.sellingPrice || 0,
      customPrice: tierPrice ? Number(tierPrice) : undefined,
      discountPercent: Number(tierDiscount) || 0,
      minQuantity: Math.max(1, Number(tierMinQty) || 1)
    };

    const nextItems = [...(currentPriceList.items || []), newItem];

    try {
      await apiClient.put(`/api/price-lists/${currentPriceList.id}/items`, {
        items: nextItems.map(it => ({
          productId: it.productId,
          customPrice: it.customPrice,
          discountPercent: it.discountPercent,
          minQuantity: it.minQuantity
        }))
      });
    } catch {
      // fallback
    }

    const nextLists = priceLists.map(pl => {
      if (pl.id === currentPriceList.id) {
        return { ...pl, items: nextItems };
      }
      return pl;
    });

    setPriceLists(nextLists);
    saveStoredPriceLists(nextLists);

    setIsTierModalOpen(false);
    setTierPrice('');
    showToast(getTranslation(lang, 'priceLists.createSuccess'));
  };

  // Create Bundle
  const handleCreateBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundleParentId || bundleComponents.length === 0) return;

    const parent = products.find(x => x.id === bundleParentId);
    const newItems: ProductBundleItem[] = bundleComponents.map((bc, idx) => {
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
      await apiClient.post('/api/price-lists/bundles', {
        parentProductId: bundleParentId,
        components: bundleComponents.map(bc => ({
          childProductId: bc.childProductId,
          quantity: bc.quantity,
          unitPriceRatio: bc.unitPriceRatio
        }))
      });
    } catch {
      // fallback
    }

    const nextBundles = [...bundles.filter(b => b.parentProductId !== bundleParentId), ...newItems];
    setBundles(nextBundles);
    saveStoredProductBundles(nextBundles);

    setIsBundleModalOpen(false);
    showToast(getTranslation(lang, 'priceLists.bundleSaved'));
  };

  // Assign Customer
  const handleAssignCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignCustomerId || !assignListId) return;

    try {
      await apiClient.post('/api/price-lists/customer-assignment', {
        customerId: assignCustomerId,
        priceListId: assignListId
      });
    } catch {
      // fallback
    }

    const nextCustomers = customers.map(c => {
      if (c.id === assignCustomerId) {
        return { ...c, priceListId: assignListId };
      }
      return c;
    });

    setCustomers(nextCustomers);
    saveStoredCustomers(nextCustomers);

    setIsAssignModalOpen(false);
    showToast(getTranslation(lang, 'priceLists.customerAssigned'));
  };

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {toastMsg && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: isAr ? 'auto' : '24px', right: isAr ? '24px' : 'auto', zIndex: 9999 }}>
          <CheckCircle2 size={16} className="green-text" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <Layers size={16} style={{ color: 'var(--primary)' }} />
            <span>{getTranslation(lang, 'priceLists.subtitle')}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          <button 
            type="button" 
            className="btn-clean-secondary"
            onClick={() => setIsBundleModalOpen(true)}
          >
            <PackageCheck size={15} />
            <span>{getTranslation(lang, 'priceLists.newBundle')}</span>
          </button>
          <button 
            type="button" 
            className="btn-clean-primary"
            onClick={() => setIsListModalOpen(true)}
          >
            <Plus size={15} />
            <span>{getTranslation(lang, 'priceLists.newPriceList')}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'priceLists.tabLists')}</span>
            <div className="module-kpi-value">
              {totalLists} <span className="kpi-sub-unit">{getTranslation(lang, 'priceLists.activePriceLists')}</span>
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <Layers size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'priceLists.tabBundles')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#8b5cf6' }}>
              {totalBundles} <span className="kpi-sub-unit">{getTranslation(lang, 'priceLists.bundleSku')}</span>
            </div>
          </div>
          <div className="module-kpi-icon purple">
            <Boxes size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'priceLists.tabTiers')}</span>
            <div className="module-kpi-value">
              {totalTiers} <span className="kpi-sub-unit">{getTranslation(lang, 'priceLists.itemsCount')}</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Percent size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'priceLists.assignCustomer')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#16a34a' }}>
              {totalAssignedCustomers} <span className="kpi-sub-unit">{getTranslation(lang, 'customers.title')}</span>
            </div>
          </div>
          <div className="module-kpi-icon emerald">
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="module-filter-pills" style={{ marginBottom: '16px' }}>
        <button 
          type="button"
          className={`module-filter-pill ${activeTab === 'LISTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('LISTS')}
        >
          <Layers size={14} />
          <span>{getTranslation(lang, 'priceLists.tabLists')}</span>
        </button>
        <button 
          type="button"
          className={`module-filter-pill ${activeTab === 'BUNDLES' ? 'active' : ''}`}
          onClick={() => setActiveTab('BUNDLES')}
        >
          <Boxes size={14} />
          <span>{getTranslation(lang, 'priceLists.tabBundles')}</span>
        </button>
        <button 
          type="button"
          className={`module-filter-pill ${activeTab === 'CUSTOMERS' ? 'active' : ''}`}
          onClick={() => setActiveTab('CUSTOMERS')}
        >
          <Users size={14} />
          <span>{getTranslation(lang, 'priceLists.assignCustomer')}</span>
        </button>
      </div>

      {/* Tab 1: Price Lists & Tiers */}
      {activeTab === 'LISTS' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px' }}>
          {/* Left Master List */}
          <div className="panel-clean" style={{ padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
              {getTranslation(lang, 'priceLists.tabLists')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {priceLists.map(pl => {
                const isSelected = pl.id === currentPriceList?.id;
                return (
                  <div
                    key={pl.id}
                    onClick={() => setSelectedListId(pl.id)}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: `1px solid ${isSelected ? 'var(--primary)' : '#e2e8f0'}`,
                      background: isSelected ? 'rgba(99, 102, 241, 0.05)' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? 'var(--primary)' : '#0f172a' }}>
                        {isAr && pl.nameAr ? pl.nameAr : pl.name}
                      </span>
                      {pl.isDefault && (
                        <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', padding: '2px 6px', borderRadius: '8px' }}>
                          {getTranslation(lang, 'priceLists.defaultBadge')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                      <span>{pl.code} • {pl.currency}</span>
                      <span>{(pl.items || []).length} {getTranslation(lang, 'priceLists.itemsCount')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Details: Tiered Items */}
          <div className="panel-clean" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  {isAr && currentPriceList?.nameAr ? currentPriceList.nameAr : currentPriceList?.name}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{currentPriceList?.description || currentPriceList?.code}</span>
              </div>
              <button 
                type="button"
                className="btn-clean-primary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => {
                  if (products.length > 0 && !tierProductId) setTierProductId(products[0].id);
                  setIsTierModalOpen(true);
                }}
              >
                <Plus size={13} />
                <span>{getTranslation(lang, 'priceLists.tabTiers')}</span>
              </button>
            </div>

            <div className="table-responsive">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>{getTranslation(lang, 'quotations.product')}</th>
                    <th>{getTranslation(lang, 'priceLists.minQty')}</th>
                    <th>{getTranslation(lang, 'priceLists.tierPrice')}</th>
                    <th>{getTranslation(lang, 'priceLists.discountPercent')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(!currentPriceList?.items || currentPriceList.items.length === 0) ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                        {getTranslation(lang, 'priceLists.noTiersConfigured')}
                      </td>
                    </tr>
                  ) : (
                    currentPriceList.items.map(it => (
                      <tr key={it.id}>
                        <td>
                          <span style={{ fontWeight: 600 }}>{it.productName || it.productId}</span>
                          {it.productSku && (
                            <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{it.productSku}</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                          ≥ {it.minQuantity}
                        </td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>
                          {it.customPrice ? formatMoney(it.customPrice) : '—'}
                        </td>
                        <td style={{ color: '#16a34a', fontWeight: 700 }}>
                          {it.discountPercent}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Product Bundles & Kits */}
      {activeTab === 'BUNDLES' && (
        <div className="panel-clean">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'rgba(248, 250, 252, 0.8)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Boxes size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>
              {getTranslation(lang, 'priceLists.deductNotice')}
            </span>
          </div>

          <div className="table-responsive">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>{getTranslation(lang, 'priceLists.bundleName')}</th>
                  <th>{getTranslation(lang, 'priceLists.childProduct')}</th>
                  <th>{getTranslation(lang, 'priceLists.componentQty')}</th>
                  <th>{getTranslation(lang, 'quotations.subtotal')}</th>
                </tr>
              </thead>
              <tbody>
                {bundles.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                      {getTranslation(lang, 'priceLists.noBundlesFound')}
                    </td>
                  </tr>
                ) : (
                  bundles.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {b.parentProductName || b.parentProductId}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{b.childProductName}</span>
                        {b.childProductSku && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{b.childProductSku}</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {b.quantity} pcs
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        Ratio: {b.unitPriceRatio}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Customer Assignments */}
      {activeTab === 'CUSTOMERS' && (
        <div className="panel-clean">
          <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{getTranslation(lang, 'priceLists.assignCustomer')}</h4>
            <button
              type="button"
              className="btn-clean-primary"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => {
                if (customers.length > 0 && !assignCustomerId) setAssignCustomerId(customers[0].id);
                if (priceLists.length > 0 && !assignListId) setAssignListId(priceLists[0].id);
                setIsAssignModalOpen(true);
              }}
            >
              <Plus size={13} />
              <span>{getTranslation(lang, 'priceLists.assign')}</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>{getTranslation(lang, 'customers.customerName')}</th>
                  <th>{getTranslation(lang, 'customers.phone')}</th>
                  <th>{getTranslation(lang, 'customers.loyaltyTier')}</th>
                  <th>{getTranslation(lang, 'priceLists.tabLists')}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => {
                  const assignedPL = priceLists.find(pl => pl.id === (c as any).priceListId);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{c.phone}</td>
                      <td>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: '#f1f5f9' }}>
                          {c.loyaltyTier}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {assignedPL ? (isAr && assignedPL.nameAr ? assignedPL.nameAr : assignedPL.name) : getTranslation(lang, 'priceLists.defaultBadge')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New Price List */}
      {isListModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsListModalOpen(false)}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '520px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{getTranslation(lang, 'priceLists.newPriceList')}</h3>
              </div>
              <button type="button" onClick={() => setIsListModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePriceList} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'priceLists.listCode')} *
                  </label>
                  <input 
                    type="text" 
                    value={plCode} 
                    onChange={e => setPlCode(e.target.value)} 
                    placeholder="E.g. VIP-PLATINUM"
                    required
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'priceLists.currency')}
                  </label>
                  <select 
                    className="select-clean"
                    value={plCurrency}
                    onChange={e => setPlCurrency(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="IQD">IQD (د.ع)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'priceLists.listName')} (EN) *
                </label>
                <input 
                  type="text" 
                  value={plName} 
                  onChange={e => setPlName(e.target.value)} 
                  required
                  className="input-clean"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'priceLists.listName')} (AR)
                </label>
                <input 
                  type="text" 
                  value={plNameAr} 
                  onChange={e => setPlNameAr(e.target.value)} 
                  className="input-clean"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'expenses.notes')}
                </label>
                <textarea 
                  rows={2}
                  value={plDescription}
                  onChange={e => setPlDescription(e.target.value)}
                  className="input-clean"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn-clean-secondary"
                  onClick={() => setIsListModalOpen(false)}
                >
                  {getTranslation(lang, 'priceLists.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="btn-clean-primary"
                >
                  {getTranslation(lang, 'priceLists.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Product Bundle */}
      {isBundleModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsBundleModalOpen(false)}>
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

            <form onSubmit={handleCreateBundle} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'priceLists.parentProduct')} *
                </label>
                <select 
                  className="select-clean"
                  value={bundleParentId}
                  onChange={e => setBundleParentId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{getProdName(p)} ({p.sku})</option>
                  ))}
                </select>
              </div>

              {/* Components */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{getTranslation(lang, 'priceLists.components')}</span>
                  <button 
                    type="button"
                    className="btn-clean-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => {
                      if (products.length > 0) {
                        setBundleComponents([...bundleComponents, { childProductId: products[0].id, quantity: 1, unitPriceRatio: 1.0 }]);
                      }
                    }}
                  >
                    <Plus size={12} />
                    <span>{getTranslation(lang, 'priceLists.addComponent')}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bundleComponents.map((bc, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                      <select 
                        className="select-clean"
                        value={bc.childProductId}
                        onChange={e => {
                          const next = [...bundleComponents];
                          next[idx].childProductId = e.target.value;
                          setBundleComponents(next);
                        }}
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '6px' }}
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{getProdName(p)} ({p.sku})</option>
                        ))}
                      </select>

                      <input 
                        type="number"
                        min="1"
                        value={bc.quantity}
                        onChange={e => {
                          const next = [...bundleComponents];
                          next[idx].quantity = Math.max(1, Number(e.target.value));
                          setBundleComponents(next);
                        }}
                        className="input-clean"
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '6px', textAlign: 'center' }}
                      />

                      <button 
                        type="button"
                        onClick={() => setBundleComponents(bundleComponents.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
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
        </div>
      )}

      {/* Modal: Add Tier Rule */}
      {isTierModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsTierModalOpen(false)}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '480px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Percent size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{getTranslation(lang, 'priceLists.tabTiers')}</h3>
              </div>
              <button type="button" onClick={() => setIsTierModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddTierRule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'quotations.product')} *
                </label>
                <select 
                  className="select-clean"
                  value={tierProductId}
                  onChange={e => setTierProductId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{getProdName(p)} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'priceLists.minQty')} *
                  </label>
                  <input 
                    type="number"
                    min="1"
                    value={tierMinQty}
                    onChange={e => setTierMinQty(Number(e.target.value))}
                    required
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'priceLists.discountPercent')} (%)
                  </label>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={tierDiscount}
                    onChange={e => setTierDiscount(Number(e.target.value))}
                    className="input-clean"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'priceLists.tierPrice')} (Special Fixed Price)
                </label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  value={tierPrice}
                  onChange={e => setTierPrice(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Optional fixed unit price"
                  className="input-clean"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
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
                  {getTranslation(lang, 'priceLists.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Customer */}
      {isAssignModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAssignModalOpen(false)}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '440px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{getTranslation(lang, 'priceLists.assignCustomer')}</h3>
              </div>
              <button type="button" onClick={() => setIsAssignModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'priceLists.selectCustomer')}
                </label>
                <select 
                  className="select-clean"
                  value={assignCustomerId}
                  onChange={e => setAssignCustomerId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'priceLists.selectPriceList')}
                </label>
                <select 
                  className="select-clean"
                  value={assignListId}
                  onChange={e => setAssignListId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                >
                  {priceLists.map(pl => (
                    <option key={pl.id} value={pl.id}>{isAr && pl.nameAr ? pl.nameAr : pl.name} ({pl.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn-clean-secondary"
                  onClick={() => setIsAssignModalOpen(false)}
                >
                  {getTranslation(lang, 'priceLists.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="btn-clean-primary"
                >
                  {getTranslation(lang, 'priceLists.assign')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
