"use client";

import React from 'react';
import { X, Printer, Truck, CheckCircle2, ShieldCheck, MapPin, Calendar, User, Phone, Package, FileText } from 'lucide-react';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { TransferRecord } from '../views/TransfersView';
import BarcodeSvg from '../BarcodeSvg';
import { localizeWarehouse } from '../../lib/localeHelpers';

interface TransferManifestModalProps {
  transfer: TransferRecord | null;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
}

export default function TransferManifestModal({
  transfer,
  isOpen,
  onClose,
  lang = 'ar'
}: TransferManifestModalProps) {
  if (!isOpen || !transfer) return null;
  const isAr = lang === 'ar';

  const totalQuantity = transfer.items.reduce((sum, item) => sum + item.qty, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent
        className="w-full max-w-4xl bg-card border border-border/80 shadow-2xl rounded-2xl p-0 text-foreground overflow-hidden flex flex-col my-auto"
        style={{
          maxWidth: '820px',
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
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground m-0 leading-tight">
                  {isAr ? 'بيان الشحنة ومذكرة التحويل بين الفروع' : 'Inter-Warehouse Freight Manifest'}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {transfer.transferNumber}
                </span>
              </div>
              <p className="text-xs text-muted-foreground m-0 mt-0.5 leading-normal">
                {isAr ? 'سند شحن ونقل رسمي معتمد لمطابقة حركة المخزون' : 'Official transport waybill for stock tracking'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrint}
              size="sm"
              className="h-8 px-3 gap-1.5 bg-primary text-primary-foreground font-semibold text-xs shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isAr ? 'طباعة البيان' : 'Print'}</span>
            </Button>

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
        </div>

        {/* Printable Sheet Body */}
        <div className="printable-manifest p-6 overflow-y-auto flex-1 flex flex-col gap-5 bg-card">
          {/* Top Info Strip */}
          <div className="flex justify-between items-center p-3 rounded-xl border border-border/80 bg-muted/30">
            <div>
              <span className="text-[10px] text-muted-foreground block font-semibold">
                {isAr ? 'رقم بيان الشحنة (Waybill No):' : 'Waybill Manifest Number:'}
              </span>
              <span className="font-mono text-base font-extrabold text-primary">
                {transfer.transferNumber}
              </span>
            </div>

            <div className="text-center">
              <BarcodeSvg value={transfer.transferNumber} width={1.4} height={32} />
            </div>

            <div className="text-left">
              <span className="text-[10px] text-muted-foreground block font-semibold">
                {isAr ? 'تاريخ ووقت التسيير:' : 'Dispatch Timestamp:'}
              </span>
              <span className="font-mono text-xs font-bold text-foreground">
                {transfer.dispatchDate}
              </span>
            </div>
          </div>

          {/* Route Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Origin */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-background/50 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>{isAr ? 'مستودع المصدر (الشحن والخصم):' : 'Origin Dispatch Hub:'}</span>
              </div>
              <div className="text-sm font-extrabold text-foreground">
                {localizeWarehouse(transfer.fromWarehouse, lang)}
              </div>
              <span className="text-[10px] text-muted-foreground block">
                {isAr ? 'تم خصم الأرصدة نظامياً لعهدة الشحنة' : 'Ledger stock deducted'}
              </span>
            </div>

            {/* Destination */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-background/50 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <MapPin className="w-3.5 h-3.5" />
                <span>{isAr ? 'مستودع الوجهة (الاستلام والإيداع):' : 'Destination Receiving Hub:'}</span>
              </div>
              <div className="text-sm font-extrabold text-foreground">
                {localizeWarehouse(transfer.toWarehouse, lang)}
              </div>
              <span className="text-[10px] text-muted-foreground block">
                {isAr ? 'تودع الأرصدة عند تأكيد الوصول والاستلام' : 'Pending physical arrival check'}
              </span>
            </div>
          </div>

          {/* Driver & Vehicle */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-background/50">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2">
              <User className="w-3.5 h-3.5 text-amber-500" />
              <span>{isAr ? 'بيانات السائق والناقل المسؤول:' : 'Carrier & Vehicle Data:'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">{isAr ? 'اسم السائق:' : 'Driver:'}</span>
                <strong className="text-foreground">{transfer.driverName}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">{isAr ? 'هاتف التواصل:' : 'Phone:'}</span>
                <strong className="font-mono text-foreground" dir="ltr">{transfer.driverPhone || '—'}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">{isAr ? 'رقم الشاحنة / اللوحة:' : 'Vehicle Plate:'}</span>
                <strong className="text-foreground">{transfer.truckPlate}</strong>
              </div>
            </div>
          </div>

          {/* Cargo Manifest Table */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-primary" />
                <span>{isAr ? 'قائمة المواد والكميات المنقولة:' : 'Itemized Cargo Waybill:'}</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-semibold">
                {transfer.items.length} {isAr ? 'أصناف مختلفة' : 'Distinct SKUs'}
              </span>
            </div>

            <div className="rounded-xl border border-border/80 bg-background overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-right" dir={isAr ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="bg-muted/60 border-b border-border/60 text-[11px] font-bold text-muted-foreground">
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">{isAr ? 'رمز المادة (SKU)' : 'SKU'}</th>
                    <th className="p-2.5">{isAr ? 'اسم المادة / الصنف' : 'Item Description'}</th>
                    <th className="p-2.5 text-center">{isAr ? 'الكمية المشحونة' : 'Quantity'}</th>
                    <th className="p-2.5 text-center">{isAr ? 'الوحدة' : 'Unit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {transfer.items.map((item, idx) => (
                    <tr key={item.sku} className="hover:bg-muted/30">
                      <td className="p-2.5 font-mono text-muted-foreground">{idx + 1}</td>
                      <td className="p-2.5 font-mono font-bold text-primary" dir="ltr">{item.sku}</td>
                      <td className="p-2.5 font-semibold text-foreground">{item.name}</td>
                      <td className="p-2.5 text-center font-mono font-extrabold text-foreground">{item.qty}</td>
                      <td className="p-2.5 text-center text-muted-foreground">{item.unit || (isAr ? 'قطعة' : 'pcs')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-bold border-t border-border/60">
                    <td colSpan={3} className="p-2.5 text-foreground">
                      {isAr ? 'إجمالي عدد القطع المشحونة:' : 'Total Loaded Items:'}
                    </td>
                    <td className="p-2.5 text-center font-mono font-extrabold text-primary text-sm">
                      {totalQuantity}
                    </td>
                    <td className="p-2.5 text-center text-muted-foreground">
                      {isAr ? 'قطعة' : 'Units'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="border border-dashed border-border rounded-xl p-3 text-center min-h-[80px]">
              <span className="text-[11px] text-muted-foreground font-bold block">
                {isAr ? 'توقيع وسند استلام السائق' : 'Driver Acknowledgment'}
              </span>
              <div className="mt-6 border-t border-border pt-1 text-[11px] font-semibold text-foreground">
                {transfer.driverName}
              </div>
            </div>

            <div className="border border-dashed border-border rounded-xl p-3 text-center min-h-[80px]">
              <span className="text-[11px] text-muted-foreground font-bold block">
                {isAr ? 'توقيع وختم مستودع الاستلام' : 'Receiving Officer Stamp'}
              </span>
              <div className="mt-6 border-t border-border pt-1 text-[11px] text-muted-foreground">
                {transfer.status === 'Received' ? (isAr ? 'تم التدقيق والمطابقة' : 'Verified') : (isAr ? 'عند وصول الشاحنة' : 'Upon Delivery')}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  );
}
