"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Truck, 
  MapPin, 
  ArrowLeft, 
  ArrowRight, 
  User, 
  Package, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Send,
  Phone,
  FileText,
  Boxes,
  CheckCircle2
} from 'lucide-react';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Product, Warehouse } from '../../types/warehouse';
import { TransferItem, TransferRecord } from '../views/TransfersView';
import { localizeWarehouse } from '../../lib/localeHelpers';

interface CreateTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
  warehouses: Warehouse[];
  products: Product[];
  onCreateTransfer: (record: TransferRecord) => void;
}

export default function CreateTransferModal({
  isOpen,
  onClose,
  lang = 'ar',
  warehouses = [],
  products = [],
  onCreateTransfer
}: CreateTransferModalProps) {
  const isAr = lang === 'ar';

  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'In-Transit' | 'Pending'>('In-Transit');

  // Cargo builder
  const [selectedProdId, setSelectedProdId] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [cargoItems, setCargoItems] = useState<TransferItem[]>([]);
  const [cargoError, setCargoError] = useState('');

  // Initialize and synchronize warehouses
  useEffect(() => {
    if (isOpen && warehouses.length > 0) {
      const defaultFrom = warehouses[0]?.id || '';
      const otherWh = warehouses.find(w => w.id !== defaultFrom);
      setFromWh(defaultFrom);
      setToWh(otherWh?.id || '');
      setCargoItems([]);
      setCargoError('');
      setSelectedProdId('');
      setItemQty(1);
      setDriverName('');
      setDriverPhone('');
      setTruckPlate('');
      setNotes('');
      setStatus('In-Transit');
    }
  }, [isOpen, warehouses]);

  if (!isOpen) return null;

  // Filter products for the chosen origin warehouse
  const availableSourceProducts = products.filter(
    p => p.warehouseId === fromWh || !p.warehouseId
  );

  const handleAddCargoItem = () => {
    setCargoError('');
    if (!selectedProdId) {
      setCargoError(isAr ? 'يرجى اختيار مادة من القائمة أولاً' : 'Please select an item first');
      return;
    }

    const prod = products.find(p => p.id === selectedProdId);
    if (!prod) return;

    if (itemQty <= 0) {
      setCargoError(isAr ? 'يجب إدخال كمية صحيحة أكبر من الصفر' : 'Quantity must be greater than zero');
      return;
    }

    const alreadyInCargo = cargoItems.filter(i => i.sku === prod.sku).reduce((s, i) => s + i.qty, 0);
    const totalRequested = alreadyInCargo + itemQty;

    if (totalRequested > prod.currentStock) {
      setCargoError(
        isAr 
          ? `الكمية المطلوبة (${totalRequested}) تتجاوز الرصيد المتوفر في المستودع (${prod.currentStock})!`
          : `Requested qty (${totalRequested}) exceeds warehouse stock (${prod.currentStock})!`
      );
      return;
    }

    const existingIndex = cargoItems.findIndex(i => i.sku === prod.sku);
    if (existingIndex >= 0) {
      const updatedCargo = [...cargoItems];
      updatedCargo[existingIndex].qty += itemQty;
      setCargoItems(updatedCargo);
    } else {
      setCargoItems(prev => [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          name: prod.nameAr || prod.nameEn || prod.sku,
          qty: itemQty,
          unit: prod.unit || (isAr ? 'قطعة' : 'pcs')
        }
      ]);
    }

    setSelectedProdId('');
    setItemQty(1);
  };

  const handleRemoveCargoItem = (sku: string) => {
    setCargoItems(prev => prev.filter(i => i.sku !== sku));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCargoError('');

    if (!fromWh || !toWh) {
      setCargoError(isAr ? 'يرجى تحديد مستودع الشحن ومستودع الاستلام' : 'Please select origin and destination hubs');
      return;
    }

    if (fromWh === toWh) {
      setCargoError(isAr ? 'لا يمكن اختيار نفس المستودع كمصدر ووجهة' : 'Origin and destination cannot be the same');
      return;
    }

    if (!driverName.trim()) {
      setCargoError(isAr ? 'يرجى إدخال اسم السائق المسؤول عن الشحنة' : 'Driver name is required');
      return;
    }

    if (cargoItems.length === 0) {
      setCargoError(isAr ? 'يجب إضافة صنف واحد على الأقل إلى حمولة الشاحنة' : 'Add at least one item to cargo manifest');
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const estimatedArrival = new Date(Date.now() + 6 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);
    const transferNum = `TRF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    const newRecord: TransferRecord = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      transferNumber: transferNum,
      fromWarehouse: fromWh,
      toWarehouse: toWh,
      status: status,
      dispatchDate: nowStr,
      estimatedArrival: estimatedArrival,
      driverName: driverName.trim(),
      driverPhone: driverPhone.trim() || undefined,
      truckPlate: truckPlate.trim() || (isAr ? 'شاحنة نقل معتمدة' : 'Standard Freight Truck'),
      items: cargoItems,
      notes: notes.trim() || undefined
    };

    onCreateTransfer(newRecord);
    onClose();
  };

  const rawWh = warehouses.find(w => w.id === fromWh)?.nameAr || warehouses.find(w => w.id === fromWh)?.nameEn || fromWh;
  const fromWhName = localizeWarehouse(rawWh, lang);

  const totalCargoUnits = cargoItems.reduce((s, i) => s + i.qty, 0);

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
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground m-0 leading-tight">
                  {isAr ? 'إصدار أمر مناقلة وشحن رسمي بين المستودعات' : 'Create Official Inter-Warehouse Freight Order'}
                </h3>
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20"
                  dir="ltr"
                >
                  TRF-WAYBILL
                </span>
              </div>
              <p className="text-xs text-muted-foreground m-0 mt-0.5 leading-normal">
                {isAr
                  ? 'توثيق حركة النقل البري، فحص وتحديث الأرصدة، وتوليد بيان شحنة إلكتروني رسمي'
                  : 'Digital freight waybill dispatch, live source deduction, and receiving hub ledger update'}
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 overflow-y-auto max-h-[calc(92vh-125px)] space-y-3.5">
            {/* Cargo Error Banner */}
            {cargoError && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold shadow-2xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cargoError}</span>
              </div>
            )}

            {/* SECTION 1: TRANSIT ROUTE (ORIGIN -> DESTINATION) */}
            <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>{isAr ? '1. مسار الشحنة والربط اللوجستي' : '1. Freight Route & Hub Connection'}</span>
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/60">
                  {isAr ? 'عزل المستودعين والتحقق التلقائي' : 'Hub Isolation Active'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                {/* Origin Hub (Source) */}
                <div className="p-3 rounded-lg border border-border/80 bg-background/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {isAr ? 'مستودع الشحن (المصدر)' : 'Origin Hub (Source)'}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      {isAr ? 'خصم الرصيد' : 'Deduct'}
                    </span>
                  </div>
                  <select 
                    value={fromWh} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setFromWh(val);
                      setCargoItems([]); // Reset cargo items when source changes
                      const remaining = warehouses.filter(w => w.id !== val);
                      if (remaining.length > 0 && (!toWh || toWh === val || !remaining.some(w => w.id === toWh))) {
                        setToWh(remaining[0].id);
                      }
                    }}
                    className="w-full h-9 rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {localizeWarehouse(w.nameAr || w.id, lang)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transit Flow Arrow */}
                <div className="flex sm:flex-col items-center justify-center gap-1 py-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                    {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </div>
                  <span className="text-[9px] font-bold text-primary">
                    {isAr ? 'تسيير' : 'Transit'}
                  </span>
                </div>

                {/* Destination Hub (Target) */}
                <div className="p-3 rounded-lg border border-border/80 bg-background/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {isAr ? 'مستودع الاستلام (الوجهة)' : 'Destination Hub (Target)'}
                    </span>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20">
                      {isAr ? 'إيداع واستلام' : 'Receive'}
                    </span>
                  </div>
                  <select 
                    value={toWh} 
                    onChange={(e) => setToWh(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                  >
                    <option value="" disabled>{isAr ? '-- اختر مستودع الاستلام --' : '-- Choose destination warehouse --'}</option>
                    {warehouses
                      .filter(w => w.id !== fromWh)
                      .map(w => (
                        <option key={w.id} value={w.id}>
                          {localizeWarehouse(w.nameAr || w.id, lang)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 2: DRIVER & TRUCK DETAILS */}
            <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>{isAr ? '2. بيانات السائق والمركبة المعتمدة' : '2. Carrier & Vehicle Dispatch Info'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Driver Name */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-foreground/80 block">
                    {isAr ? 'اسم السائق المعتمد' : 'Driver Full Name'} *
                  </span>
                  <div className="relative">
                    <Input 
                      type="text" 
                      required
                      placeholder={isAr ? 'مثال: حيدر جاسم الكعبي' : 'e.g. Haider Jassim'}
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="h-9 bg-background border-border/80 px-2.5 text-xs font-medium"
                    />
                    <User className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Driver Phone */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-foreground/80 block">
                    {isAr ? 'رقم الهاتف' : 'Driver Phone'}
                  </span>
                  <div className="relative">
                    <Input 
                      type="text" 
                      placeholder={isAr ? '0770 123 4567' : '0770 123 4567'}
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="h-9 bg-background border-border/80 px-2.5 text-xs font-mono"
                      dir="ltr"
                    />
                    <Phone className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Truck Plate */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-foreground/80 block">
                    {isAr ? 'رقم اللوحة ونوع المركبة' : 'Truck Plate & Model'}
                  </span>
                  <div className="relative">
                    <Input 
                      type="text" 
                      placeholder={isAr ? 'مثال: 12345 بغداد / شاحنة نقل' : 'e.g. TRK-8492 / Reefer Truck'}
                      value={truckPlate}
                      onChange={(e) => setTruckPlate(e.target.value)}
                      className="h-9 bg-background border-border/80 px-2.5 text-xs font-medium"
                    />
                    <Truck className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: CARGO MANIFEST BUILDER */}
            <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span>{isAr ? '3. محتويات الشحنة وحمولة المركبة' : '3. Cargo Load & Freight Manifest'}</span>
                </div>
                <span className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full border border-border/60">
                  {isAr ? 'المخزن المصدر: ' : 'Source Hub: '}
                  <strong className="text-foreground">{fromWhName}</strong>
                </span>
              </div>

              {/* Add Item Single Line Form */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_auto] gap-2 items-end">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-foreground/80 block">
                    {isAr ? 'اختر الصنف من المستودع المصدر:' : 'Select Product from Source:'}
                  </span>
                  <select
                    value={selectedProdId}
                    onChange={(e) => setSelectedProdId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                  >
                    <option value="">{isAr ? '-- اختر مادة لتحميلها للشاحنة --' : '-- Choose product to load --'}</option>
                    {availableSourceProducts.map(p => (
                      <option key={p.id} value={p.id} disabled={p.currentStock <= 0}>
                        {p.nameAr || p.nameEn || p.sku} ({p.sku}) — [{isAr ? 'الرصيد المتاح:' : 'Stock:'} {p.currentStock} {p.unit || ''}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-foreground/80 block">
                    {isAr ? 'الكمية:' : 'Qty:'}
                  </span>
                  <Input 
                    type="number" 
                    min="1"
                    value={itemQty}
                    onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-9 bg-background border-border/80 px-2 text-center text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <Button
                    type="button"
                    onClick={handleAddCargoItem}
                    className="h-9 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isAr ? 'إضافة للشحنة' : 'Add to Cargo'}</span>
                  </Button>
                </div>
              </div>

              {/* Cargo Table / List */}
              <div className="rounded-lg border border-border/80 bg-background overflow-hidden shadow-2xs">
                <div className="grid grid-cols-[1.2fr_2fr_1fr_1fr_48px] px-3 py-2 bg-muted/60 text-[11px] font-bold text-muted-foreground border-b border-border/60">
                  <span>{isAr ? 'رمز المادة (SKU)' : 'SKU'}</span>
                  <span>{isAr ? 'اسم الصنف' : 'Product Name'}</span>
                  <span className="text-center">{isAr ? 'الكمية' : 'Qty'}</span>
                  <span className="text-center">{isAr ? 'الوحدة' : 'Unit'}</span>
                  <span className="text-center">{isAr ? 'حذف' : 'Del'}</span>
                </div>

                {cargoItems.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs">
                      {isAr ? 'حمولة الشاحنة فارغة حالياً — اختر الصنف والكمية واضغط "+ إضافة للشحنة"' : 'Cargo is empty — choose item and quantity above, then click Add'}
                    </span>
                  </div>
                ) : (
                  <div className="max-h-[140px] overflow-y-auto divide-y divide-border/60">
                    {cargoItems.map(item => (
                      <div 
                        key={item.sku}
                        className="grid grid-cols-[1.2fr_2fr_1fr_1fr_48px] px-3 py-2 items-center text-xs hover:bg-muted/30 transition-colors"
                      >
                        <span className="font-mono text-primary font-bold" dir="ltr">{item.sku}</span>
                        <span className="font-semibold text-foreground truncate" title={item.name}>{item.name}</span>
                        <span className="text-center text-primary font-mono font-extrabold">{item.qty}</span>
                        <span className="text-center text-muted-foreground font-medium">{item.unit}</span>
                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveCargoItem(item.sku)}
                            title={isAr ? 'حذف من الشحنة' : 'Remove'}
                            className="inline-flex items-center justify-center w-6 h-6 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cargoItems.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-t border-border/60 text-xs font-bold text-foreground">
                    <span>{isAr ? 'إجمالي محتويات الشحنة:' : 'Total Cargo Load:'}</span>
                    <span className="text-primary font-mono font-extrabold">
                      {totalCargoUnits} {isAr ? 'قطعة عبر' : 'units across'} {cargoItems.length} {isAr ? 'أصناف' : 'SKUs'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 4: STATUS & NOTES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-foreground/80 block">
                  {isAr ? 'حالة أمر النقل المبدئية' : 'Initial Dispatch State'}
                </span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-9 rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                >
                  <option value="In-Transit">{isAr ? 'تسيير فوري (في الطريق)' : 'In-Transit (Immediate Dispatch)'}</option>
                  <option value="Pending">{isAr ? 'قيد التجهيز في رصيف التحميل' : 'Pending (Loading Bay)'}</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-foreground/80 block">
                  {isAr ? 'ملاحظات أو سبب المناقلة' : 'Transfer Reason & Notes'}
                </span>
                <Input 
                  type="text" 
                  placeholder={isAr ? 'مثال: مناقلة لتعويض نقص المخزون بناءً على طلب الفرع' : 'e.g. Urgent rebalance for customer order'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 bg-background border-border/80 px-2.5 text-xs font-medium"
                />
              </div>
            </div>
          </div>

          {/* Modal Action Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">
                {isAr ? 'حمولة الشحنة:' : 'Cargo Load:'}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                {totalCargoUnits} {isAr ? 'قطعة' : 'units'} ({cargoItems.length} {isAr ? 'أصناف' : 'SKUs'})
              </span>
            </div>

            <div className="flex items-center gap-2.5">
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
                disabled={cargoItems.length === 0 || !driverName.trim()}
                className="h-9 px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{isAr ? 'إصدار أمر المناقلة والشحن' : 'Issue Transfer Order'}</span>
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  );
}
