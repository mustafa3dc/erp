import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  Layers,
  Box,
  Barcode,
  Printer,
  Plus,
  RefreshCw,
  Edit3,
  ArrowRightLeft,
  Check
} from 'lucide-react';
import { Product, Warehouse as WarehouseType } from '../../types/warehouse';
import { getTenantAuthHeaders } from '../../lib/api-client';
import { getTranslation } from '../../lib/i18n';
import PrintBarcodeLabelsModal from '../modals/PrintBarcodeLabelsModal';

export interface RackBayItem {
  id: string;
  bayCode: string;
  shelfCode: string;
  label: string;
  name: string;
  code?: string | null;
  notes?: string | null;
  totalCapacity: number;
  usedCapacity: number;
  occupancy: number;
  isOverCapacity: boolean;
  items: Product[];
  isHighlighted?: boolean;
}

export interface WarehouseLiveLayoutProps {
  warehouse: WarehouseType;
  products?: Product[];
  lang?: 'ar' | 'en';
  onConfigureRacks?: () => void;
  onOpenRestock?: (bayCode?: string) => void;
  onNavigateToInventory?: (warehouseId: string) => void;
  onRacksLoaded?: (warehouseId: string, racks: RackBayItem[]) => void;
}

export const WarehouseLiveLayout: React.FC<WarehouseLiveLayoutProps> = ({
  warehouse,
  products = [],
  lang = 'ar',
  onRacksLoaded
}) => {
  const isAr = lang === 'ar';
  const tr = useCallback((k: string) => getTranslation(lang, `ui.warehouseRacks.${k}`), [lang]);
  const resolveShelfError = useCallback(
    (code: string) => {
      const invKey = `errors.ERR.INVENTORY.${code}`;
      const invMsg = getTranslation(lang, invKey);
      if (invMsg && invMsg !== invKey) return invMsg;
      const trKey = `errors.ERR.TREASURY.${code}`;
      const trMsg = getTranslation(lang, trKey);
      if (trMsg && trMsg !== trKey) return trMsg;
      const directKey = `errors.${code}`;
      const directMsg = getTranslation(lang, directKey);
      if (directMsg && directMsg !== directKey) return directMsg;
      return getTranslation(lang, 'errors.ERR.TREASURY.ERR_SHELF_SAVE_FAILED');
    },
    [lang]
  );

  const [shelves, setShelves] = useState<RackBayItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedShelf, setSelectedShelf] = useState<RackBayItem | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Add / Edit Shelf Modal State
  const [isShelfModalOpen, setIsShelfModalOpen] = useState<boolean>(false);
  const [editingShelf, setEditingShelf] = useState<RackBayItem | null>(null);
  const [shelfNameInput, setShelfNameInput] = useState<string>('');
  const [shelfCodeInput, setShelfCodeInput] = useState<string>('');
  const [shelfNotesInput, setShelfNotesInput] = useState<string>('');
  const [shelfFormError, setShelfFormError] = useState<{ message: string; meta?: string } | null>(null);
  const [isSavingShelf, setIsSavingShelf] = useState<boolean>(false);

  // Assign items inside drawer
  const [assignSearch, setAssignSearch] = useState<string>('');
  const [selectedAssignIds, setSelectedAssignIds] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [drawerError, setDrawerError] = useState<string>('');

  const productsRef = useRef<Product[]>(products);
  productsRef.current = products;

  const onRacksLoadedRef = useRef(onRacksLoaded);
  onRacksLoadedRef.current = onRacksLoaded;

  const productsSignature = useMemo(
    () =>
      products
        .map(p => `${p.id}:${p.shelf ?? ''}:${p.currentStock ?? 0}`)
        .join('|'),
    [products]
  );

  const fetchShelves = useCallback(async (isManualRefresh = false) => {
    if (!warehouse?.id) {
      setShelves([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const headers = getTenantAuthHeaders();
      const res = await fetch(`/api/warehouses/${encodeURIComponent(warehouse.id)}/shelves`, {
        method: 'GET',
        headers
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: RackBayItem[] = data.map((s: any) => {
            const itemsList: Product[] = Array.isArray(s.items)
              ? s.items.map((it: any) => ({
                  id: String(it.productId || it.id),
                  sku: String(it.sku || ''),
                  nameAr: String(it.name || ''),
                  nameEn: String(it.name || ''),
                  barcode: String(it.barcode || ''),
                  currentStock: Number(it.quantity) || 0,
                  sellingPrice: Number(it.sellingPrice) || 0,
                  costPrice: 0,
                  minStockAlert: 0,
                  unit: tr('defaultUnit'),
                  category: tr('defaultCategory'),
                  warehouseId: warehouse.id,
                  shelf: s.code || s.name
                }))
              : [];

            const totalQty =
              typeof s.totalQuantity === 'number'
                ? Number(s.totalQuantity)
                : itemsList.reduce((sum, it) => sum + Math.max(0, Number(it.currentStock) || 0), 0);

            return {
              id: String(s.id),
              bayCode: String(s.code || s.name || s.id),
              shelfCode: String(s.code || ''),
              label: String(s.name || ''),
              name: String(s.name || ''),
              code: s.code ?? null,
              notes: s.notes ?? null,
              totalCapacity: 0,
              usedCapacity: Math.max(0, totalQty),
              occupancy: 0,
              isOverCapacity: false,
              items: itemsList
            };
          });

          setShelves(mapped);
          onRacksLoadedRef.current?.(warehouse.id, mapped);
          setSelectedShelf(prev => (prev ? mapped.find(m => m.id === prev.id) || null : null));
          return;
        }
      }
    } catch {
      // Fallback to local product shelf grouping if offline
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }

    const whProducts = (productsRef.current || []).filter(
      p => !p.isBundle && (p.warehouseId === warehouse.id || p.warehouseId === warehouse.code)
    );
    const shelfGroups: Record<string, Product[]> = {};
    whProducts.forEach(prod => {
      if (prod.shelf && prod.shelf.trim().length > 0) {
        const key = prod.shelf.trim();
        if (!shelfGroups[key]) shelfGroups[key] = [];
        shelfGroups[key].push(prod);
      }
    });

    const derived: RackBayItem[] = Object.keys(shelfGroups)
      .sort()
      .map(key => {
        const items = shelfGroups[key];
        const totalQty = items.reduce((acc, it) => acc + Math.max(0, Number(it.currentStock) || 0), 0);
        return {
          id: `shelf-${key.toLowerCase()}`,
          bayCode: key,
          shelfCode: key,
          label: key,
          name: key,
          code: key,
          notes: null,
          totalCapacity: 0,
          usedCapacity: totalQty,
          occupancy: 0,
          isOverCapacity: false,
          items
        };
      });
    setShelves(derived);
    onRacksLoadedRef.current?.(warehouse.id, derived);
  }, [warehouse?.id, warehouse?.code, productsSignature, tr]);

  useEffect(() => {
    void fetchShelves(false);
  }, [fetchShelves]);

  const displayedShelves = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return shelves;

    return shelves.map(shelf => {
      const isMatch =
        shelf.name.toLowerCase().includes(term) ||
        (shelf.code && shelf.code.toLowerCase().includes(term)) ||
        shelf.items.some(
          it =>
            (it.nameAr && it.nameAr.toLowerCase().includes(term)) ||
            (it.nameEn && it.nameEn.toLowerCase().includes(term)) ||
            (it.sku && it.sku.toLowerCase().includes(term)) ||
            (it.barcode && it.barcode.toLowerCase().includes(term))
        );
      return {
        ...shelf,
        isHighlighted: isMatch
      };
    });
  }, [shelves, searchTerm]);

  const openAddShelfModal = () => {
    setEditingShelf(null);
    setShelfNameInput('');
    setShelfCodeInput('');
    setShelfNotesInput('');
    setShelfFormError(null);
    setIsShelfModalOpen(true);
  };

  const openEditShelfModal = (shelf: RackBayItem) => {
    setEditingShelf(shelf);
    setShelfNameInput(shelf.name);
    setShelfCodeInput(shelf.code || '');
    setShelfNotesInput(shelf.notes || '');
    setShelfFormError(null);
    setIsShelfModalOpen(true);
  };

  const handleSaveShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = shelfNameInput.trim();
    if (!trimmedName) {
      setShelfFormError({
        message: resolveShelfError('ERR_SHELF_NAME_REQUIRED'),
        meta: 'ERR_SHELF_NAME_REQUIRED'
      });
      return;
    }

    setIsSavingShelf(true);
    setShelfFormError(null);
    try {
      const headers = {
        ...getTenantAuthHeaders(),
        'Content-Type': 'application/json'
      };
      const isEdit = Boolean(editingShelf && !editingShelf.id.startsWith('shelf-'));
      const warehouseRef = warehouse.id || warehouse.code;
      const url = isEdit
        ? `/api/warehouses/${encodeURIComponent(warehouseRef)}/shelves/${encodeURIComponent(editingShelf!.id)}`
        : `/api/warehouses/${encodeURIComponent(warehouseRef)}/shelves`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          name: trimmedName,
          code: shelfCodeInput.trim() || null,
          notes: shelfNotesInput.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('[ShelfSaveError]', res.status, err);
        const code =
          err?.errorCode ||
          (res.status === 404
            ? 'ERR_WAREHOUSE_NOT_FOUND'
            : 'ERR_SHELF_SAVE_FAILED');
        const sqlState = err?.details?.sqlState || err?.details?.pgCode;
        const columnName = err?.details?.columnName;
        const constraintName = err?.details?.constraintName || err?.details?.constraint;
        const metaParts = [code, `HTTP ${res.status}`];
        if (sqlState) metaParts.push(String(sqlState));
        if (columnName) metaParts.push(String(columnName));
        else if (constraintName) metaParts.push(String(constraintName));
        setShelfFormError({
          message: resolveShelfError(code),
          meta: metaParts.join(' • ')
        });
        return;
      }

      setIsShelfModalOpen(false);
      await fetchShelves(true);
    } catch {
      setShelfFormError({
        message: resolveShelfError('ERR_SHELF_SAVE_FAILED'),
        meta: 'ERR_SHELF_SAVE_FAILED (NETWORK)'
      });
    } finally {
      setIsSavingShelf(false);
    }
  };

  const handleAssignItems = async (targetShelfId: string, productIds: string[]) => {
    if (productIds.length === 0) return;
    setIsAssigning(true);
    setDrawerError('');
    try {
      const res = await fetch(
        `/api/warehouses/${encodeURIComponent(warehouse.id)}/shelves/${encodeURIComponent(targetShelfId)}/assign-items`,
        {
          method: 'POST',
          headers: {
            ...getTenantAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ productIds })
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const code = err?.errorCode || 'ERR_SHELF_ASSIGN_FAILED';
        setDrawerError(resolveShelfError(code));
        return;
      }

      setSelectedAssignIds([]);
      await fetchShelves(true);
    } catch {
      setDrawerError(resolveShelfError('ERR_SHELF_ASSIGN_FAILED'));
    } finally {
      setIsAssigning(false);
    }
  };

  const availableWarehouseItems = useMemo(() => {
    if (!selectedShelf) return [];
    const onShelfIds = new Set(selectedShelf.items.map(it => it.id));
    const q = assignSearch.trim().toLowerCase();
    return products.filter(p => {
      if (p.isBundle) return false;
      if (p.warehouseId !== warehouse.id && p.warehouseId !== warehouse.code) return false;
      if (onShelfIds.has(p.id)) return false;
      if (!q) return true;
      return (
        (p.nameAr && p.nameAr.toLowerCase().includes(q)) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
  }, [selectedShelf, products, warehouse.id, warehouse.code, assignSearch]);

  return (
    <div className="bg-card border border-border rounded-xl p-6 mt-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h4 className="text-lg font-extrabold text-foreground m-0">
            {tr('title')}{' '}
            <bdi dir="auto">{isAr ? warehouse.nameAr : (warehouse.nameEn || warehouse.nameAr)}</bdi>
          </h4>
          <p className="text-xs text-muted-foreground mt-1 m-0">{tr('subtitle')}</p>
        </div>

        {/* Search + Refresh + Add Shelf */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-60">
            <Search
              size={14}
              className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none ${
                isAr ? 'right-3' : 'left-3'
              }`}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={tr('searchPlaceholder')}
              className={`w-full h-9 rounded-lg border border-border bg-muted text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                isAr ? 'pr-8 pl-7' : 'pl-8 pr-7'
              }`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${
                  isAr ? 'left-2' : 'right-2'
                }`}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => void fetchShelves(true)}
            disabled={isRefreshing}
            title={tr('refreshTitle')}
            className="h-9 px-3 rounded-lg border border-border bg-card text-foreground text-xs font-semibold flex items-center gap-1.5 hover:bg-muted transition-colors disabled:opacity-60"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{tr('refreshBtn')}</span>
          </button>

          <button
            type="button"
            onClick={openAddShelfModal}
            className="btn-add-primary h-9 px-3.5 text-xs font-bold flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>{tr('addShelfBtn').replace(/^\+\s*/, '')}</span>
          </button>
        </div>
      </div>

      {/* Shelves Grid or Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(idx => (
            <div key={idx} className="h-36 rounded-xl bg-muted border border-border animate-pulse" />
          ))}
        </div>
      ) : displayedShelves.length === 0 ? (
        <div className="text-center py-12 px-6 rounded-xl bg-muted border border-dashed border-border">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-card border border-border flex items-center justify-center text-primary">
            <Layers size={26} />
          </div>
          <h5 className="text-sm font-extrabold text-foreground mb-1">{tr('emptyTitle')}</h5>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">{tr('emptySubtitle')}</p>
          <button
            type="button"
            onClick={openAddShelfModal}
            className="btn-add-primary inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2"
          >
            <Plus size={15} />
            <span>{tr('addShelfBtn').replace(/^\+\s*/, '')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedShelves.map(shelf => {
            const isDimmed = Boolean(searchTerm.trim() && !shelf.isHighlighted);
            const isMatched = Boolean(searchTerm.trim() && shelf.isHighlighted);
            const previewItems = shelf.items.slice(0, 3);
            const extraCount = Math.max(0, shelf.items.length - 3);

            return (
              <div
                key={shelf.id}
                onClick={() => {
                  setDrawerError('');
                  setSelectedAssignIds([]);
                  setAssignSearch('');
                  setSelectedShelf(shelf);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedShelf(shelf);
                  }
                }}
                className={`rounded-xl border p-4 bg-card transition-all cursor-pointer hover:shadow-md ${
                  isMatched
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                } ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-primary shrink-0">
                      <Layers size={16} />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-sm font-extrabold text-foreground truncate m-0">
                        <bdi dir="auto">{shelf.name}</bdi>
                      </h5>
                    </div>
                  </div>
                  {shelf.code && (
                    <span
                      dir="ltr"
                      className="px-2 py-0.5 rounded-md bg-muted border border-border text-xs font-mono font-bold text-foreground shrink-0"
                    >
                      {shelf.code}
                    </span>
                  )}
                </div>

                {/* Counts */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg bg-muted border border-border px-2.5 py-2">
                    <div className="text-[11px] font-semibold text-muted-foreground">{tr('itemsCountLabel')}</div>
                    <div className="text-sm font-extrabold text-foreground tabular-nums mt-0.5">
                      <span dir="ltr">{shelf.items.length.toLocaleString()}</span>{' '}
                      <span className="text-[11px] font-medium text-muted-foreground">{tr('itemsUnit')}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted border border-border px-2.5 py-2">
                    <div className="text-[11px] font-semibold text-muted-foreground">{tr('piecesCountLabel')}</div>
                    <div className="text-sm font-extrabold text-primary tabular-nums mt-0.5">
                      <span dir="ltr">{shelf.usedCapacity.toLocaleString()}</span>{' '}
                      <span className="text-[11px] font-medium text-muted-foreground">{tr('piecesUnit')}</span>
                    </div>
                  </div>
                </div>

                {/* Compact preview of up to 3 items */}
                {previewItems.length > 0 ? (
                  <div className="space-y-1 border-t border-border pt-2.5">
                    {previewItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-foreground truncate">
                          <bdi dir="auto">{isAr ? item.nameAr : (item.nameEn || item.nameAr)}</bdi>
                        </span>
                        <span dir="ltr" className="text-muted-foreground font-mono tabular-nums shrink-0">
                          ×{item.currentStock}
                        </span>
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <div className="text-[11px] font-semibold text-primary pt-0.5">
                        {tr('previewMore').replace('{count}', String(extraCount))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground border-t border-border pt-2.5">
                    {tr('noItemsOnShelf')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Shelf Modal */}
      {isShelfModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            dir={isAr ? 'rtl' : 'ltr'}
            onClick={() => {
              setShelfFormError(null);
              setIsShelfModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl p-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-foreground m-0">
                  {editingShelf ? tr('shelfModalEditTitle') : tr('shelfModalAddTitle')}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShelfFormError(null);
                    setIsShelfModalOpen(false);
                  }}
                  className="p-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveShelf} className="space-y-3.5">
                {shelfFormError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-600 dark:text-red-400 flex flex-wrap items-center justify-between gap-2">
                    <span>{shelfFormError.message}</span>
                    {shelfFormError.meta && (
                      <span dir="ltr" className="font-mono text-[10px] opacity-80 bg-red-500/10 px-1.5 py-0.5 rounded">
                        {shelfFormError.meta}
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">{tr('shelfNameLabel')}</label>
                  <input
                    type="text"
                    required
                    value={shelfNameInput}
                    onChange={e => {
                      setShelfNameInput(e.target.value);
                      if (shelfFormError) setShelfFormError(null);
                    }}
                    placeholder={tr('shelfNamePlaceholder')}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-muted text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">{tr('shelfCodeLabel')}</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={shelfCodeInput}
                    onChange={e => {
                      setShelfCodeInput(e.target.value);
                      if (shelfFormError) setShelfFormError(null);
                    }}
                    placeholder={tr('shelfCodePlaceholder')}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-muted text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">{tr('shelfNotesLabel')}</label>
                  <textarea
                    rows={2}
                    value={shelfNotesInput}
                    onChange={e => {
                      setShelfNotesInput(e.target.value);
                      if (shelfFormError) setShelfFormError(null);
                    }}
                    placeholder={tr('shelfNotesPlaceholder')}
                    className="w-full p-3 rounded-lg border border-border bg-muted text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShelfFormError(null);
                      setIsShelfModalOpen(false);
                    }}
                    className="px-4 h-9 rounded-lg border border-border bg-muted text-foreground text-xs font-bold"
                  >
                    {tr('cancelBtn')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingShelf}
                    className="btn-add-primary px-4 h-9 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isSavingShelf && <RefreshCw size={13} className="animate-spin" />}
                    <span>{isSavingShelf ? tr('savingBtn') : tr('saveShelfBtn')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Shelf Contents & Item Assignment Drawer/Modal */}
      {selectedShelf &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            dir={isAr ? 'rtl' : 'ltr'}
            onClick={() => setSelectedShelf(null)}
          >
            <div
              className="w-full max-w-2xl max-h-[88vh] rounded-xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-border bg-muted flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center text-primary shrink-0">
                    <Layers size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-foreground m-0 truncate">
                        {tr('shelfDrawerTitle')} <bdi dir="auto">{selectedShelf.name}</bdi>
                      </h3>
                      {selectedShelf.code && (
                        <span
                          dir="ltr"
                          className="px-2 py-0.5 rounded bg-card border border-border text-xs font-mono font-bold text-foreground"
                        >
                          {selectedShelf.code}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground m-0 mt-0.5">
                      {tr('warehousePrefix').replace(
                        '{name}',
                        isAr ? warehouse.nameAr : (warehouse.nameEn || warehouse.nameAr)
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!selectedShelf.id.startsWith('shelf-') && (
                    <button
                      type="button"
                      onClick={() => openEditShelfModal(selectedShelf)}
                      className="h-8 px-2.5 rounded-lg bg-card border border-border text-xs font-bold text-foreground flex items-center gap-1 hover:bg-muted"
                    >
                      <Edit3 size={13} />
                      <span>{tr('editShelfBtn')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(true)}
                    className="h-8 px-2.5 rounded-lg bg-card border border-border text-xs font-bold text-foreground flex items-center gap-1 hover:bg-muted"
                  >
                    <Printer size={13} />
                    <span>{tr('printLabelBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedShelf(null)}
                    className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="p-4 overflow-y-auto space-y-5 flex-1">
                {drawerError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-600 dark:text-red-400">
                    {drawerError}
                  </div>
                )}

                {/* Current Items on Shelf */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-sm font-extrabold text-foreground flex items-center gap-1.5 m-0">
                      <Box size={15} className="text-primary" />
                      <span>{tr('storedItemsTitle')}</span>
                    </h4>
                    <span className="text-xs font-bold text-muted-foreground tabular-nums">
                      {selectedShelf.items.length} {tr('itemsUnit')} • {selectedShelf.usedCapacity} {tr('piecesUnit')}
                    </span>
                  </div>

                  {selectedShelf.items.length === 0 ? (
                    <div className="p-6 rounded-xl bg-muted border border-dashed border-border text-center text-xs text-muted-foreground">
                      {tr('noItemsOnShelf')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedShelf.items.map(item => {
                        const otherShelves = shelves.filter(
                          s => s.id !== selectedShelf.id && !s.id.startsWith('shelf-')
                        );
                        return (
                          <div
                            key={item.id}
                            className="p-3 rounded-lg bg-muted border border-border flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-foreground truncate">
                                <bdi dir="auto">{isAr ? item.nameAr : (item.nameEn || item.nameAr)}</bdi>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                {item.sku && <span dir="ltr" className="font-mono">{item.sku}</span>}
                                {item.barcode && (
                                  <span dir="ltr" className="inline-flex items-center gap-1 font-mono">
                                    <Barcode size={11} />
                                    {item.barcode}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <span
                                dir="ltr"
                                className="px-2.5 py-1 rounded-md bg-card border border-border text-xs font-extrabold text-primary tabular-nums"
                              >
                                {item.currentStock} {tr('piecesUnit')}
                              </span>

                              {otherShelves.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <ArrowRightLeft size={13} className="text-muted-foreground" />
                                  <select
                                    defaultValue=""
                                    disabled={isAssigning}
                                    onChange={e => {
                                      const targetId = e.target.value;
                                      if (targetId) {
                                        void handleAssignItems(targetId, [item.id]);
                                      }
                                    }}
                                    className="h-8 px-2 rounded-md border border-border bg-card text-foreground text-xs font-semibold"
                                  >
                                    <option value="">{tr('selectTargetShelf')}</option>
                                    {otherShelves.map(os => (
                                      <option key={os.id} value={os.id}>
                                        {os.name}
                                        {os.code ? ` (${os.code})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Assign Existing Warehouse Items to This Shelf */}
                {!selectedShelf.id.startsWith('shelf-') && (
                  <div className="border-t border-border pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <h4 className="text-sm font-extrabold text-foreground m-0">{tr('assignItemsTitle')}</h4>
                      {selectedAssignIds.length > 0 && (
                        <button
                          type="button"
                          disabled={isAssigning}
                          onClick={() => void handleAssignItems(selectedShelf.id, selectedAssignIds)}
                          className="btn-add-primary h-8 px-3 text-xs font-bold flex items-center gap-1.5"
                        >
                          <Check size={13} />
                          <span>{tr('assignSelectedBtn').replace('{count}', String(selectedAssignIds.length))}</span>
                        </button>
                      )}
                    </div>

                    <div className="relative mb-2.5">
                      <Search
                        size={13}
                        className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none ${
                          isAr ? 'right-3' : 'left-3'
                        }`}
                      />
                      <input
                        type="text"
                        value={assignSearch}
                        onChange={e => setAssignSearch(e.target.value)}
                        placeholder={tr('assignItemsPlaceholder')}
                        className={`w-full h-9 rounded-lg border border-border bg-muted text-foreground text-xs focus:outline-none ${
                          isAr ? 'pr-8 pl-3' : 'pl-8 pr-3'
                        }`}
                      />
                    </div>

                    {availableWarehouseItems.length === 0 ? (
                      <div className="p-4 rounded-lg bg-muted border border-border text-center text-xs text-muted-foreground">
                        {tr('noUnassignedItems')}
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5">
                        {availableWarehouseItems.slice(0, 30).map(prod => {
                          const checked = selectedAssignIds.includes(prod.id);
                          return (
                            <div
                              key={prod.id}
                              className="px-3 py-2 rounded-lg bg-muted border border-border flex items-center justify-between gap-2"
                            >
                              <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedAssignIds(prev =>
                                      prev.includes(prod.id)
                                        ? prev.filter(id => id !== prod.id)
                                        : [...prev, prod.id]
                                    )
                                  }
                                  className="rounded border-border"
                                />
                                <span className="text-xs font-bold text-foreground truncate">
                                  <bdi dir="auto">{isAr ? prod.nameAr : (prod.nameEn || prod.nameAr)}</bdi>
                                </span>
                                <span dir="ltr" className="text-[11px] font-mono text-muted-foreground shrink-0">
                                  ({prod.currentStock})
                                </span>
                              </label>
                              <button
                                type="button"
                                disabled={isAssigning}
                                onClick={() => void handleAssignItems(selectedShelf.id, [prod.id])}
                                className="h-7 px-2.5 rounded-md bg-card border border-border text-[11px] font-bold text-primary hover:bg-primary/10 shrink-0"
                              >
                                {tr('assignOneBtn')}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Print Label Modal */}
      {isPrintModalOpen && selectedShelf && (
        <PrintBarcodeLabelsModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          lang={lang}
          billNumber={selectedShelf.code || selectedShelf.name}
          warehouseName={isAr ? warehouse.nameAr : (warehouse.nameEn || warehouse.nameAr)}
          items={
            selectedShelf.items.length > 0
              ? selectedShelf.items.map(it => ({
                  id: it.id,
                  sku: it.sku || it.id,
                  nameAr: it.nameAr,
                  nameEn: it.nameEn || it.nameAr,
                  quantity: Math.max(1, it.currentStock || 1),
                  barcode: it.barcode || it.sku || it.id,
                  unitCost: it.costPrice || 0,
                  currentSellingPrice: it.sellingPrice || 0,
                  sellingPrice: it.sellingPrice || 0,
                  lineTotal: 0,
                  uom: tr('defaultUnit'),
                  category: it.category || tr('defaultCategory')
                }))
              : [
                  {
                    id: selectedShelf.id,
                    sku: selectedShelf.code || selectedShelf.name,
                    nameAr: selectedShelf.name,
                    nameEn: selectedShelf.name,
                    quantity: 1,
                    barcode: selectedShelf.code || selectedShelf.name,
                    unitCost: 0,
                    currentSellingPrice: 0,
                    sellingPrice: 0,
                    lineTotal: 0,
                    uom: tr('defaultUnit'),
                    category: tr('racksCategory')
                  }
                ]
          }
        />
      )}
    </div>
  );
};

export default WarehouseLiveLayout;
