import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Check } from 'lucide-react';
import { Product } from '../../types/warehouse';
import { useSettings } from '../../context/settings-context';

interface PurchaseItemComboboxProps {
  value: string;
  barcode?: string;
  isNewProduct?: boolean;
  products: Product[];
  placeholder?: string;
  isAr?: boolean;
  onSelectProduct: (product: Product) => void;
  onOpenDefineProduct: (query: string) => void;
  onManualTextChange: (text: string) => void;
}

export default function PurchaseItemCombobox({
  value,
  barcode,
  isNewProduct,
  products,
  placeholder,
  isAr = true,
  onSelectProduct,
  onOpenDefineProduct,
  onManualTextChange
}: PurchaseItemComboboxProps) {
  const { formatMoney } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const effectivePlaceholder = placeholder || (isAr ? 'ابحث باسم الصنف أو امسح الباركود...' : 'Search by item name or scan barcode...');
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openUpwards?: boolean;
  } | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const updateCoords = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 360);
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const spaceBelow = vh - rect.bottom;
    const openUpwards = spaceBelow < 220 && rect.top > 220;

    let left = isAr ? (rect.right - menuWidth) : rect.left;
    if (left < 8) left = 8;
    if (left + menuWidth > vw - 8) {
      left = Math.max(8, vw - menuWidth - 8);
    }

    const top = openUpwards ? (rect.top - 4) : (rect.bottom + 4);

    setCoords({
      top,
      left,
      width: menuWidth,
      openUpwards
    });
  }, [isAr]);

  // Recalculate position on open, window resize, or scroll outside dropdown
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleScrollOrResize = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.closest && target.closest('.combobox-portal-content')) {
        return;
      }
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(target as Element).closest?.('.combobox-portal-content')
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const searchLower = query.toLowerCase().trim();
  const filteredProducts = searchLower
    ? products.filter(p =>
        (p.nameAr && p.nameAr.toLowerCase().includes(searchLower)) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(searchLower)) ||
        (p.sku && p.sku.toLowerCase().includes(searchLower)) ||
        (p.barcode && p.barcode.includes(searchLower))
      ).slice(0, 8)
    : products.slice(0, 6);

  const exactMatch = products.find(p =>
    (p.barcode && p.barcode === searchLower) ||
    (p.sku && p.sku.toLowerCase() === searchLower)
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onManualTextChange(val);
    updateCoords();
    setIsOpen(true);

    // Exact barcode match on instant scan
    const scanMatch = products.find(p => p.barcode === val.trim() || p.sku.toLowerCase() === val.trim().toLowerCase());
    if (scanMatch) {
      onSelectProduct(scanMatch);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts.length > 0) {
        onSelectProduct(filteredProducts[0]);
        setIsOpen(false);
      } else if (query.trim()) {
        onOpenDefineProduct(query.trim());
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full min-w-0" ref={containerRef}>
      {/* Clean Full-Width Input */}
      <div className="relative w-full">
        <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            updateCoords();
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={effectivePlaceholder}
          dir="auto"
          className="h-9 w-full ps-8 pe-3 text-xs rounded-lg border border-border/80 bg-background text-foreground font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all truncate shadow-2xs"
        />
      </div>

      {/* Sub-meta: Barcode and New SKU Badge (Never collides with input text) */}
      {(barcode || isNewProduct) && (
        <div className="flex items-center gap-2 mt-1 px-1 text-[11px] leading-none select-none">
          {isNewProduct && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
              {isAr ? 'صنف جديد' : 'New SKU'}
            </span>
          )}
          {barcode && (
            <span className="text-[10.5px] text-muted-foreground font-mono flex items-center gap-1 truncate">
              <span>{isAr ? 'باركود:' : 'Barcode:'}</span>
              <bdi dir="ltr" className="font-semibold text-foreground/80">{barcode}</bdi>
            </span>
          )}
        </div>
      )}

      {/* Floating Portal Dropdown Menu - Never pushes or scrolls the table */}
      {isOpen && coords && typeof document !== 'undefined' && createPortal(
        <div
          className="combobox-portal-content fixed z-[999999] bg-card border border-border rounded-xl shadow-2xl overflow-hidden text-foreground animate-in fade-in-50 zoom-in-95 duration-100"
          style={{
            top: coords.openUpwards ? undefined : `${coords.top}px`,
            bottom: coords.openUpwards ? `${window.innerHeight - coords.top}px` : undefined,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: '260px',
            direction: isAr ? 'rtl' : 'ltr'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Option to Define New Product */}
          {query.trim() && !exactMatch && (
            <div
              onClick={() => {
                onOpenDefineProduct(query.trim());
                setIsOpen(false);
              }}
              className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border-b border-border cursor-pointer flex items-center gap-2.5 text-emerald-600 font-bold text-xs transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {isAr ? `تعريف "${query.trim()}" كصنف جديد في الدليل` : `Define "${query.trim()}" as New SKU`}
                </div>
                <div className="text-[10px] text-muted-foreground font-normal">
                  {isAr ? 'إضافة التصنيف، الوحدة، وسعر البيع على الطاير' : 'Add category, UOM, and selling price'}
                </div>
              </div>
            </div>
          )}

          {/* Catalog Matches */}
          {filteredProducts.length > 0 ? (
            <div className="max-h-52 overflow-y-auto divide-y divide-border/40">
              <div className="px-3 py-1.5 bg-muted/60 text-[10px] font-bold text-muted-foreground">
                {isAr ? 'الأصناف المسجلة في دليل المنتجات:' : 'Matching Catalog Items:'}
              </div>
              {filteredProducts.map((p) => {
                const displayName = isAr ? p.nameAr : (p.nameEn || p.nameAr);
                const isSelected = displayName === value || p.sku === value;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      onSelectProduct(p);
                      setIsOpen(false);
                    }}
                    className={`px-3 py-2 hover:bg-muted/50 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-foreground truncate" dir="auto">
                        {displayName}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                        <span>SKU: {p.sku}</span>
                        {p.barcode && <span>| {p.barcode}</span>}
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className="text-xs font-mono font-bold text-emerald-600">
                        <bdi dir="ltr">{formatMoney(Number(p.costPrice) || 0)}</bdi>
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        {isAr ? 'سعر التكلفة' : 'Cost'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            !query.trim() ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                {isAr ? 'ابدأ بالكتابة أو امسح الباركود...' : 'Type product name or scan barcode...'}
              </div>
            ) : null
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

