"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Scale, 
  Zap, 
  CheckCircle2, 
  Package, 
  AlertCircle, 
  Cpu, 
  Info 
} from 'lucide-react';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Product } from '../../types/warehouse';
import { useSettings } from '../../context/settings-context';
import { getStoredProducts } from '../../services/storageService';

interface ElectronicScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
  products: Product[];
  initialProduct?: Product | null;
  onAddWeightedItem: (product: Product, weightKg: number) => void;
}

// Comprehensive check for weighted units (كجم, كغم, غرام, جرام, kg, g, etc.)
export function isWeightedProduct(p?: Product | null): boolean {
  if (!p) return false;
  const u = (p.unit || '').trim().toLowerCase();
  const n = (p.nameAr || '').trim().toLowerCase();
  const ne = (p.nameEn || '').trim().toLowerCase();

  // 1. Direct match on unit string
  const isUnitWeight = 
    u === 'كجم' ||
    u === 'كغم' ||
    u === 'كغ' ||
    u === 'كج' ||
    u === 'كيلو' ||
    u === 'كيلوغرام' ||
    u === 'كيلوجرام' ||
    u === 'غرام' ||
    u === 'جرام' ||
    u === 'غم' ||
    u === 'جم' ||
    u === 'kg' ||
    u === 'g' ||
    u === 'gram' ||
    u === 'grams' ||
    u === 'kilogram' ||
    u === 'kgs' ||
    u.includes('كجم') ||
    u.includes('كغم') ||
    u.includes('كيلو') ||
    u.includes('غرام') ||
    u.includes('جرام') ||
    u.includes('kg');

  if (isUnitWeight) return true;

  // 2. Fallback match on name keywords
  const isNameWeight = 
    n.includes('كيلو') ||
    n.includes('كغم') ||
    n.includes('كجم') ||
    n.includes('بالوزن') ||
    n.includes('غرام') ||
    n.includes('جرام') ||
    ne.includes('kg') ||
    ne.includes('weight');

  return isNameWeight;
}

export default function ElectronicScaleModal({
  isOpen,
  onClose,
  lang = 'ar',
  products: propProducts,
  initialProduct = null,
  onAddWeightedItem
}: ElectronicScaleModalProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  // Always load live fresh products from storage so newly added products show up instantly!
  const products = useMemo(() => {
    const stored = getStoredProducts();
    if (stored && stored.length > 0) return stored;
    return propProducts || [];
  }, [propProducts, isOpen]);

  // Strictly weighted products only (كجم / غرام / kg)
  const weightedProducts = useMemo(() => {
    return products.filter(isWeightedProduct);
  }, [products]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [weightKg, setWeightKg] = useState<number>(1.0);
  const [isConnectingSerial, setIsConnectingSerial] = useState(false);
  const [serialStatus, setSerialStatus] = useState<string | null>(null);

  // Sync selected product upon open: Strictly from weighted items
  useEffect(() => {
    if (!isOpen) return;

    if (initialProduct && isWeightedProduct(initialProduct)) {
      const liveInitial = weightedProducts.find(p => p.id === initialProduct.id) || initialProduct;
      setSelectedProduct(liveInitial);
    } else if (weightedProducts.length > 0) {
      setSelectedProduct(weightedProducts[0]);
    } else {
      setSelectedProduct(null);
    }
  }, [initialProduct, weightedProducts, isOpen]);

  if (!isOpen) return null;

  const hasWeightedItems = weightedProducts.length > 0;
  const effectiveProduct = selectedProduct || (hasWeightedItems ? weightedProducts[0] : null);
  const unitPrice = effectiveProduct ? Number(effectiveProduct.sellingPrice) || 0 : 0;
  const totalPrice = Math.round(unitPrice * weightKg);

  // Direct USB / Serial Scale Reader using Web Serial API
  const handleConnectSerialScale = async () => {
    if (typeof window === 'undefined') return;

    if (!('serial' in navigator)) {
      setSerialStatus(
        isAr 
          ? 'المتصفح الحالي لا يدعم Web Serial مباشرة. يرجى استخدام متصفح Google Chrome أو Microsoft Edge لتوصيل كابل الـ USB.' 
          : 'Web Serial is not supported in this browser. Please use Chrome or Edge.'
      );
      return;
    }

    try {
      setIsConnectingSerial(true);
      setSerialStatus(isAr ? 'جاري طلب تصريح منفذ الميزان (COM/USB)...' : 'Requesting Serial Port...');

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
      setSerialStatus(isAr ? 'متصل بالميزان بنجاح. جاري قراءة الوزن...' : 'Connected to Scale. Reading...');

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const match = buffer.match(/([0-9]+\.[0-9]{2,3})/);
          if (match) {
            const parsed = parseFloat(match[1]);
            if (!isNaN(parsed) && parsed > 0) {
              setWeightKg(Math.round(parsed * 1000) / 1000);
              setSerialStatus(isAr ? `تمت قراءة الوزن: ${parsed} كغم ✅` : `Weight Read: ${parsed} kg ✅`);
            }
          }
          if (buffer.length > 100) buffer = buffer.slice(-50);
        }
      }
    } catch (err: any) {
      console.warn('Serial Scale connection cancelled or failed:', err);
      setSerialStatus(
        isAr 
          ? `لم يتم الاتصال: ${err?.message || 'تم إلغاء الاختيار'}`
          : `Connection cancelled: ${err?.message || 'No port selected'}`
      );
    } finally {
      setIsConnectingSerial(false);
    }
  };

  const handleApply = () => {
    if (!effectiveProduct || weightKg <= 0) return;
    onAddWeightedItem(effectiveProduct, Math.round(weightKg * 1000) / 1000);
    onClose();
  };

  const quickPresets = [0.25, 0.50, 0.75, 1.00, 1.50, 2.00, 2.50, 3.00, 5.00];

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent
        className="w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl p-0 text-foreground overflow-hidden flex flex-col my-auto"
        style={{
          maxWidth: '560px',
          width: '95%',
          maxHeight: '90vh',
          padding: 0,
          borderRadius: '1.25rem',
          backgroundColor: 'var(--card)',
          color: 'var(--foreground)'
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/25 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground m-0 leading-tight">
                {isAr ? 'الميزان الإلكتروني الذكي' : 'Smart Electronic Scale'}
              </h3>
              <p className="text-xs text-muted-foreground m-0 mt-0.5">
                {isAr ? 'وزن الأصناف بالربط المباشر أو التعيين السريع' : 'Weigh items via direct USB scale or quick presets'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Modal Body */}
        {!hasWeightedItems ? (
          /* Empty State: If user has no weighted items */
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-foreground m-0">
                {isAr ? 'لا توجد أصناف تباع بالوزن حالياً' : 'No Weighted Items Found'}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed m-0">
                {isAr 
                  ? 'الميزان مخصص فقط للمواد التي تباع بالوزن (كجم / غرام). يرجى إضافة مادة بوحدة كجم في المخزون أو تعديل وحدة الصنف لتظهر هنا.' 
                  : 'The scale is strictly for items sold by weight (kg/g).'}
              </p>
            </div>
            <Button onClick={onClose} className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
              {isAr ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        ) : (
          /* Active Weighing State: Strictly Weighted Items Only */
          <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-130px)]">
            {/* 1. Item Selection Dropdown (Only Weighted Items) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground block">
                  {isAr ? 'اختر الصنف المراد وزنه:' : 'Select Item to Weigh:'}
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  {isAr ? 'أصناف وزنية فقط ⚖️' : 'Weighted Items Only ⚖️'}
                </span>
              </div>

              <select
                value={effectiveProduct?.id || ''}
                onChange={(e) => {
                  const found = weightedProducts.find(p => p.id === e.target.value);
                  if (found) setSelectedProduct(found);
                }}
                className="w-full h-10 rounded-xl border border-border/80 bg-background px-3 text-xs font-bold text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {weightedProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} — ({formatMoney(p.sellingPrice)} / {p.unit || 'كجم'})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Big LED/LCD Digital Scale Display */}
            <div className="rounded-2xl border-2 border-primary/30 bg-slate-950 text-emerald-400 p-5 shadow-inner flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-2.5 start-3 flex items-center gap-1.5 text-[10px] text-emerald-500/80 font-mono font-bold tracking-wider uppercase">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>{isAr ? 'شاشة الميزان الرقمية' : 'Digital LCD Scale'}</span>
              </div>

              <div className="my-2 flex items-baseline gap-2 font-mono">
                <span className="text-5xl font-black tracking-tight text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                  {weightKg.toFixed(3)}
                </span>
                <span className="text-lg font-bold text-emerald-500/70">
                  {isAr ? 'كغم' : 'KG'}
                </span>
              </div>

              {/* Calculated Price Display */}
              <div className="w-full border-t border-slate-800 pt-2.5 mt-1 flex items-center justify-between text-xs font-mono text-slate-300">
                <span>{isAr ? 'سعر الكيلو:' : 'Price/KG:'} <strong className="text-white">{formatMoney(unitPrice)}</strong></span>
                <span>{isAr ? 'الإجمالي المحسوب:' : 'Total:'} <strong className="text-amber-400 text-sm">{formatMoney(totalPrice)}</strong></span>
              </div>
            </div>

            {/* 3. Direct Hardware USB Connection Bar */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleConnectSerialScale}
                disabled={isConnectingSerial}
                className="flex-1 h-9 rounded-xl border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold gap-2"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{isConnectingSerial ? (isAr ? 'جاري الاتصال...' : 'Connecting...') : (isAr ? 'قراءة الوزن من ميزان USB / Serial' : 'Read USB/Serial Scale')}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setWeightKg(0)}
                className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                title={isAr ? 'تصفير (Tare)' : 'Tare / Zero'}
              >
                {isAr ? 'تصفير' : 'Tare'}
              </Button>
            </div>

            {serialStatus && (
              <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border/60 leading-relaxed m-0">
                {serialStatus}
              </p>
            )}

            {/* 4. Quick Weight Preset Chips */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-muted-foreground block">
                {isAr ? 'أوزان شائعة سريعة:' : 'Quick Presets:'}
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {quickPresets.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWeightKg(preset)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all border ${
                      weightKg === preset
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/30 hover:bg-muted/70 text-foreground border-border/80'
                    }`}
                  >
                    {preset.toFixed(2)} {isAr ? 'كغ' : 'kg'}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Manual Weight Precision Input */}
            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-semibold text-foreground/80 block">
                {isAr ? 'تعديل الوزن يدوياً (بالكيلوغرام):' : 'Manual Weight Input (KG):'}
              </label>
              <Input
                type="number"
                step="0.005"
                min="0.001"
                value={weightKg}
                onChange={(e) => setWeightKg(Math.max(0, parseFloat(e.target.value) || 0))}
                dir="ltr"
                className="h-10 text-center font-mono text-base font-bold bg-background border-border"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        {hasWeightedItems && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/30 shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-xs font-semibold"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>

            <Button
              type="button"
              onClick={handleApply}
              disabled={!effectiveProduct || weightKg <= 0}
              className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-2 shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isAr ? `إضافة إلى الفاتورة (${formatMoney(totalPrice)})` : `Add to Cart (${formatMoney(totalPrice)})`}</span>
            </Button>
          </div>
        )}
      </DialogContent>
    </DialogPortal>
  );
}
