"use client";

import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Phone, 
  MapPin, 
  CreditCard, 
  Award, 
  Hash, 
  FileText 
} from 'lucide-react';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useSettings } from '../../context/settings-context';

export interface CustomerData {
  id: string;
  code: string;
  name: string;
  phone: string;
  city: string;
  creditLimit: number;
  currentBalance: number;
  loyaltyTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  loyaltyPoints: number;
}

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
  onSubmit: (customer: CustomerData) => void;
}

export default function NewCustomerModal({
  isOpen,
  onClose,
  lang = 'ar',
  onSubmit
}: NewCustomerModalProps) {
  if (!isOpen) return null;
  const isAr = lang === 'ar';
  const { financialSettings } = useSettings();
  const effectiveCurrencySymbol = financialSettings.baseCurrency.symbol;

  const [customerCode, setCustomerCode] = useState(() => `CUST-${Math.floor(1000 + Math.random() * 9000)}`);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [loyaltyTier, setLoyaltyTier] = useState<'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'>('BRONZE');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError(isAr ? 'يرجى إدخال اسم العميل' : 'Customer name is required');
      return;
    }
    if (!phone.trim()) {
      setFormError(isAr ? 'يرجى إدخال رقم الهاتف' : 'Phone number is required');
      return;
    }

    const newCustomer: CustomerData = {
      id: `CUST-${Date.now()}`,
      code: customerCode.trim() || `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name.trim(),
      phone: phone.trim(),
      city: city.trim(),
      creditLimit: Math.max(0, Number(creditLimit) || 0),
      currentBalance: Math.max(0, Number(currentBalance) || 0),
      loyaltyTier,
      loyaltyPoints: 0
    };

    onSubmit(newCustomer);
  };

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
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground m-0 leading-tight">
                  {isAr ? 'فتح حساب عميل جديد' : 'Register New Customer Account'}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {customerCode}
                </span>
              </div>
              <p className="text-xs text-muted-foreground m-0 mt-0.5 leading-normal">
                {isAr
                  ? 'تسجيل بيانات العميل، سقف الائتمان، وفئة برنامج الولاء التجاري'
                  : 'Enroll customer profile, assign credit ceiling, and set loyalty tier'}
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

        {/* Wide Two-Column Form Body (Zero Vertical Scroll on Desktop) */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 overflow-hidden" data-form-type="other">
          {/* Hidden decoy to absorb browser autofill */}
          <input type="text" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="new-password" />
          <div className="p-5 overflow-y-auto max-h-[calc(92vh-125px)] space-y-3.5">
            {/* Error Banner */}
            {formError && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Column 1: Personal & Contact Information */}
              <div className="space-y-3.5">
                <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>{isAr ? 'البيانات الشخصية وجهات الاتصال' : 'Customer Identity & Contact'}</span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Customer Name */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground/80 block">
                        {isAr ? 'اسم العميل أو المنشأة' : 'Customer / Company Name'} *
                      </span>
                      <div className="relative">
                        <Input
                          name="crm_entity_title_key"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          readOnly
                          onFocus={(e) => e.target.removeAttribute('readonly')}
                          autoComplete="one-time-code"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-form-type="other"
                          placeholder={isAr ? 'مثال: شركة النور للتجارة أو اسم العميل' : 'e.g. Acme Corp or John Doe'}
                          className="h-9 bg-background border-border/80 px-2.5 text-xs"
                        />
                        <User className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground/80 block">
                        {isAr ? 'رقم الهاتف' : 'Phone Number'} *
                      </span>
                      <div className="relative">
                        <Input
                          name="crm_dispatch_contact_seq"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                          readOnly
                          onFocus={(e) => e.target.removeAttribute('readonly')}
                          autoComplete="one-time-code"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-form-type="other"
                          placeholder={isAr ? 'رقم الهاتف مع رمز الدولة...' : '+1 (555) 000-0000'}
                          className="font-mono h-9 bg-background border-border/80 px-2.5 text-xs"
                          dir="ltr"
                        />
                        <Phone className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* City / Location */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground/80 block">
                        {isAr ? 'المدينة / العنوان التجاري' : 'City / Street Address'}
                      </span>
                      <div className="relative">
                        <Input
                          name="crm_geozone_locality"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          readOnly
                          onFocus={(e) => e.target.removeAttribute('readonly')}
                          autoComplete="one-time-code"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-form-type="other"
                          placeholder={isAr ? 'المدينة، اسم الشارع، المبنى...' : 'e.g. London, Oxford St or City, Area...'}
                          className="h-9 bg-background border-border/80 px-2.5 text-xs"
                        />
                        <MapPin className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Notes */}
                <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-1.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-foreground/80 flex items-center gap-1.5 pb-1 border-b border-border/50">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>{isAr ? 'ملاحظات وسجل العميل' : 'Commercial Notes & Preferences'}</span>
                  </span>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    autoComplete="new-password"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder={isAr ? 'شروط خاصة، أوقات التسليم، أو أي ملاحظات ائتمانية...' : 'Special instructions, billing terms, delivery preferences...'}
                    className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none shadow-xs h-[54px]"
                  />
                </div>
              </div>

              {/* Column 2: Financial Terms & Loyalty */}
              <div className="space-y-3.5">
                <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    <span>{isAr ? 'السقف المالي والائتمان' : 'Financial Limits & Balance'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Customer Code */}
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[11px] font-semibold text-foreground/80 flex items-center justify-between">
                        <span>{isAr ? 'كود الحساب' : 'Customer Code'} *</span>
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-normal">
                          {isAr ? 'معرّف فريد' : 'Auto Generated'}
                        </span>
                      </span>
                      <div className="relative">
                        <Input
                          value={customerCode}
                          onChange={(e) => setCustomerCode(e.target.value)}
                          required
                          autoComplete="new-password"
                          className="font-mono font-bold tracking-wider h-9 bg-muted/40 border-border/80 text-foreground px-2.5 text-xs"
                        />
                        <Hash className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* Credit Limit */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground/80 flex items-center justify-between">
                        <span>{isAr ? 'سقف الائتمان' : 'Credit Limit'}</span>
                        <span className="text-[10px] text-primary font-bold">
                          {effectiveCurrencySymbol}
                        </span>
                      </span>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          autoComplete="new-password"
                          value={creditLimit || ''}
                          onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="font-mono font-bold text-xs h-9 bg-background border-border/80 text-foreground px-2.5"
                        />
                        <span className="absolute end-2.5 top-2 text-[11px] font-bold text-muted-foreground pointer-events-none">
                          {effectiveCurrencySymbol}
                        </span>
                      </div>
                    </div>

                    {/* Opening Balance / Debt */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground/80 flex items-center justify-between">
                        <span>{isAr ? 'الرصيد الافتتاحي (الدين)' : 'Opening Debt'}</span>
                        <span className="text-[10px] text-primary font-bold">
                          {effectiveCurrencySymbol}
                        </span>
                      </span>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          autoComplete="new-password"
                          value={currentBalance || ''}
                          onChange={(e) => setCurrentBalance(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="font-mono font-bold text-xs h-9 bg-background border-border/80 text-foreground px-2.5"
                        />
                        <span className="absolute end-2.5 top-2 text-[11px] font-bold text-muted-foreground pointer-events-none">
                          {effectiveCurrencySymbol}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Loyalty Tier Selection */}
                <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-primary" />
                      <span>{isAr ? 'فئة برنامج الولاء' : 'Loyalty Program Tier'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {[
                      { id: 'BRONZE', labelAr: 'برونزي', labelEn: 'Bronze' },
                      { id: 'SILVER', labelAr: 'فضي', labelEn: 'Silver' },
                      { id: 'GOLD', labelAr: 'ذهبي', labelEn: 'Gold' },
                      { id: 'PLATINUM', labelAr: 'بلاتيني', labelEn: 'Platinum' }
                    ].map(tier => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setLoyaltyTier(tier.id as any)}
                        className={`h-9 rounded-lg border-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                          loyaltyTier === tier.id
                            ? 'border-primary bg-primary/10 text-primary shadow-2xs'
                            : 'border-border/80 hover:border-border hover:bg-muted/30 text-muted-foreground'
                        }`}
                      >
                        {isAr ? tier.labelAr : tier.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Action Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-border bg-muted/30 shrink-0">
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
              className="h-9 px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isAr ? 'حفظ وتثبيت العميل' : 'Save Customer'}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  );
}

