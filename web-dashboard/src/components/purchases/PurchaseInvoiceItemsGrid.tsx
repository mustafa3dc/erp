import React from 'react';
import { Plus, Trash2, Package, Search } from 'lucide-react';
import { Product } from '../../types/warehouse';
import { PurchaseInvoiceItem } from '../../types/purchases';
import PurchaseItemCombobox from './PurchaseItemCombobox';

export interface PurchaseInvoiceItemsGridProps {
  lineItems: PurchaseInvoiceItem[];
  products: Product[];
  isAr?: boolean;
  onUpdateLineItem: (index: number, updates: Partial<PurchaseInvoiceItem>) => void;
  onAddNewLine: () => void;
  onRemoveLine: (index: number) => void;
  onSelectProduct: (index: number, product: Product) => void;
  onOpenDefineProduct: (index: number, query: string) => void;
  uomOptions?: string[];
  currencySymbol?: string;
}

const DEFAULT_UOM_OPTIONS_AR = ['قطعة', 'درزن', 'كرتونة', 'كجم', 'طرد', 'بكرة', 'متر'];
const DEFAULT_UOM_OPTIONS_EN = ['Piece', 'Dozen', 'Box/Carton', 'Kg', 'Pack', 'Roll', 'Meter'];

export const formatCurrencyAmount = (amount: number | undefined | null, sym: string = '$'): string => {
  const num = Number(amount) || 0;
  return `${Math.round(num).toLocaleString('en-US')} ${sym}`;
};

// Maintain backwards compatibility for existing imports
export const formatIQD = formatCurrencyAmount;

export default function PurchaseInvoiceItemsGrid({
  lineItems,
  products,
  isAr = true,
  onUpdateLineItem,
  onAddNewLine,
  onRemoveLine,
  onSelectProduct,
  onOpenDefineProduct,
  uomOptions,
  currencySymbol
}: PurchaseInvoiceItemsGridProps) {
  const effectiveSymbol = currencySymbol || '$';
  const activeUomOptions = uomOptions || (isAr ? DEFAULT_UOM_OPTIONS_AR : DEFAULT_UOM_OPTIONS_EN);
  const subtotal = lineItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
  const itemsCount = lineItems.length;

  const headerItemsLabel = isAr
    ? (itemsCount === 1 ? 'مادة واحدة' : itemsCount === 2 ? 'مادتان' : itemsCount <= 10 ? `${itemsCount} مواد` : `${itemsCount} مادة`)
    : (itemsCount === 1 ? '1 item' : `${itemsCount} items`);

  const footerEnteredLabel = isAr
    ? (itemsCount === 1 ? 'مادة واحدة مسجلة' : itemsCount === 2 ? 'مادتان مسجلتان' : itemsCount <= 10 ? `${itemsCount} مواد مسجلة` : `${itemsCount} مادة مسجلة`)
    : (itemsCount === 1 ? '1 line item' : `${itemsCount} line items`);

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 w-full shadow-xs space-y-4">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground m-0 leading-tight">
                {isAr ? 'بنود المواد والتوريد الفعلي' : 'Inward Goods Line Items'}
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-muted-foreground border border-border/60">
                {headerItemsLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground m-0 mt-0.5">
              {isAr
                ? 'مسح الباركود، تحديد الصنف من الدليل، وإدخال الكميات وأسعار التوريد والبيع'
                : 'Scan barcodes, pick SKUs from catalog, and enter received quantities with unit costs'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddNewLine}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer h-8.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAr ? 'إضافة مادة' : 'Add Line Item'}</span>
        </button>
      </div>

      {/* 2. Full-Width Grid Table Container */}
      <div className="border border-border/80 rounded-xl bg-card overflow-hidden w-full shadow-2xs">
        <div className="w-full overflow-x-auto">
          <div className="w-full min-w-[900px]">
            {/* Header Row: 8 Aligned Columns */}
            <div className="grid grid-cols-[44px_minmax(240px,2fr)_105px_90px_120px_120px_125px_44px] gap-2 items-center px-3.5 py-2.5 bg-muted/60 border-b border-border/80 text-muted-foreground text-[11px] font-semibold uppercase tracking-wider select-none">
              <div className="text-center font-mono">#</div>
              <div className="text-start">{isAr ? 'الصنف والباركود' : 'Item & Barcode'}</div>
              <div className="text-center">{isAr ? 'الوحدة' : 'UOM'}</div>
              <div className="text-center">{isAr ? 'الكمية' : 'Quantity'}</div>
              <div className="text-end leading-tight">{isAr ? `سعر الشراء (${effectiveSymbol})` : `Cost Price (${effectiveSymbol})`}</div>
              <div className="text-end leading-tight">{isAr ? `سعر البيع (${effectiveSymbol})` : `Selling (${effectiveSymbol})`}</div>
              <div className="text-end leading-tight font-bold">{isAr ? `الإجمالي (${effectiveSymbol})` : `Line Total (${effectiveSymbol})`}</div>
              <div className="text-center" title={isAr ? 'حذف البند' : 'Action'}>
                <Trash2 className="w-3.5 h-3.5 opacity-50 mx-auto" />
              </div>
            </div>

            {/* Item Rows */}
            <div className="divide-y divide-border/60 max-h-[380px] overflow-y-auto">
              {lineItems.map((item, idx) => {
                const cost = Number(item.unitCost) || 0;
                const sell = Number(item.newSellingPrice || item.currentSellingPrice) || 0;
                const marginPct = cost > 0 && sell > 0 ? (((sell - cost) / cost) * 100).toFixed(1) : null;
                const isCostHigher = cost > 0 && sell > 0 && cost > sell;

                return (
                  <div
                    key={item.id || `line-${idx}`}
                    className="grid grid-cols-[44px_minmax(240px,2fr)_105px_90px_120px_120px_125px_44px] gap-2 items-center px-3.5 py-2 hover:bg-muted/30 transition-colors"
                  >
                    {/* 1. Row Index */}
                    <div className="text-center font-mono text-xs text-muted-foreground font-semibold">
                      {idx + 1}
                    </div>

                    {/* 2. Item & Barcode with Clean Combobox */}
                    <div className="min-w-0">
                      <PurchaseItemCombobox
                        value={(isAr ? item.nameAr : (item.nameEn || item.nameAr)) || item.sku || ''}
                        barcode={item.barcode}
                        isNewProduct={item.isNewProduct}
                        products={products}
                        placeholder={isAr ? 'ابحث باسم الصنف أو امسح الباركود...' : 'Scan barcode or enter product name...'}
                        isAr={isAr}
                        onSelectProduct={(p) => onSelectProduct(idx, p)}
                        onOpenDefineProduct={(q) => onOpenDefineProduct(idx, q)}
                        onManualTextChange={(val) => onUpdateLineItem(idx, { nameAr: val, sku: val })}
                      />
                    </div>

                    {/* 3. UOM Column */}
                    <div>
                      <select
                        value={item.uom}
                        onChange={(e) => onUpdateLineItem(idx, { uom: e.target.value })}
                        className="h-9 w-full px-2 rounded-lg border border-border/80 bg-background text-foreground text-xs text-center font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer shadow-2xs"
                      >
                        {activeUomOptions.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Quantity Column */}
                    <div>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => onUpdateLineItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="h-9 w-full px-2 rounded-lg border border-border/80 bg-background text-foreground text-xs font-mono font-bold text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-2xs"
                      />
                    </div>

                    {/* 5. Unit Cost Column */}
                    <div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.unitCost || ''}
                        onChange={(e) => onUpdateLineItem(idx, { unitCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onAddNewLine();
                          }
                        }}
                        placeholder="0"
                        className="h-9 w-full px-2.5 rounded-lg border border-border/80 bg-background text-foreground text-xs font-mono font-bold text-end outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-2xs"
                      />
                    </div>

                    {/* 6. Proposed Selling Price Column */}
                    <div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.newSellingPrice || item.currentSellingPrice || ''}
                        onChange={(e) => onUpdateLineItem(idx, { newSellingPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onAddNewLine();
                          }
                        }}
                        placeholder={item.currentSellingPrice ? `${Math.round(item.currentSellingPrice).toLocaleString('en-US')}` : '0'}
                        className={`h-9 w-full px-2.5 rounded-lg border text-xs font-mono font-bold text-end outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background transition-all shadow-2xs ${
                          isCostHigher ? 'border-destructive text-destructive' : 'border-border/80 text-foreground'
                        }`}
                      />
                      {marginPct && !isCostHigher && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold text-end leading-none mt-1">
                          +{marginPct}%
                        </div>
                      )}
                      {isCostHigher && (
                        <div className="text-[10px] text-destructive font-bold text-end leading-none mt-1">
                          {isAr ? 'تنبيه: تكلفة أعلى!' : 'Cost exceeds price!'}
                        </div>
                      )}
                    </div>

                    {/* 7. Line Total */}
                    <div className="text-end font-mono font-bold text-foreground text-xs select-all whitespace-nowrap pe-1">
                      {formatCurrencyAmount(item.lineTotal, effectiveSymbol)}
                    </div>

                    {/* 8. Delete Action */}
                    <div className="flex justify-center items-center">
                      <button
                        type="button"
                        onClick={() => onRemoveLine(idx)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title={isAr ? 'حذف هذا السطر' : 'Remove row'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Table Footer with Add Line Button & Financial Totals */}
        <div className="px-4 py-3 bg-muted/30 border-t border-border/80 flex flex-wrap items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={onAddNewLine}
            className="h-8.5 px-3.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>{isAr ? 'إضافة سطر مادة جديد' : 'Add Item Row'}</span>
          </button>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="text-muted-foreground text-xs">
              {footerEnteredLabel}
            </span>
            <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg font-mono font-bold text-xs flex items-center gap-2 shadow-2xs">
              <span>{isAr ? 'إجمالي البنود:' : 'Subtotal:'}</span>
              <span className="text-sm font-black">{formatCurrencyAmount(subtotal, effectiveSymbol)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
