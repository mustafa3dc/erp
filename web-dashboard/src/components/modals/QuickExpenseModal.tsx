import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Tag, 
  FileText,
  Banknote
} from 'lucide-react';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  getStoredActiveShift, 
  recordShiftExpense, 
  saveStoredQuickExpense, 
  QuickExpenseRecord 
} from '../../services/storageService';
import { useSettings } from '../../context/settings-context';
import { 
  CurrencyConfig, 
  getCurrencyPlaceholder, 
  formatCurrencyAmount 
} from '../../lib/currencyUtils';
import { toast } from 'sonner';

export interface QuickExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'ar' | 'en';
  onExpenseRecorded?: (expense: QuickExpenseRecord) => void;
}

export const EXPENSE_CATEGORIES = [
  { id: 'HOSPITALITY', nameAr: 'نثريات وضيافة', nameEn: 'Hospitality & Incidentals' },
  { id: 'TRANSPORT', nameAr: 'أجور نقل وتوصيل', nameEn: 'Transport & Delivery' },
  { id: 'MAINTENANCE', nameAr: 'صيانة ولوازم تشغيلية', nameEn: 'Maintenance & Operations' },
  { id: 'ADVANCES', nameAr: 'سلف ومسحوبات', nameEn: 'Advances & Withdrawals' },
  { id: 'OTHER', nameAr: 'أخرى (مع بيان السبب)', nameEn: 'Other (Specify in notes)' }
];

export default function QuickExpenseModal({
  isOpen,
  onClose,
  lang = 'ar',
  onExpenseRecorded
}: QuickExpenseModalProps) {
  const isAr = lang === 'ar';
  const amountInputRef = useRef<HTMLInputElement>(null);
  const { financialSettings } = useSettings();

  const [amount, setAmount] = useState<string>('');
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<string>(
    financialSettings.baseCurrency.code
  );
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>('HOSPITALITY');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const activeShift = getStoredActiveShift();

  // Determine active currency dynamically from company settings
  const activeCurrency = useMemo<CurrencyConfig>(() => {
    if (
      financialSettings.isMultiCurrencyEnabled && 
      financialSettings.secondaryCurrency && 
      selectedCurrencyCode === financialSettings.secondaryCurrency.code
    ) {
      return financialSettings.secondaryCurrency;
    }
    return financialSettings.baseCurrency;
  }, [financialSettings, selectedCurrencyCode]);

  // Synchronize currency when settings change or when multi-currency is disabled
  useEffect(() => {
    if (!financialSettings.isMultiCurrencyEnabled || !financialSettings.secondaryCurrency) {
      setSelectedCurrencyCode(financialSettings.baseCurrency.code);
    } else if (
      selectedCurrencyCode !== financialSettings.baseCurrency.code && 
      selectedCurrencyCode !== financialSettings.secondaryCurrency.code
    ) {
      setSelectedCurrencyCode(financialSettings.baseCurrency.code);
    }
  }, [financialSettings, selectedCurrencyCode]);

  // Reset and auto-focus amount input upon open
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setSelectedCurrencyCode(financialSettings.baseCurrency.code);
      setExpenseCategoryId('HOSPITALITY');
      setNotes('');
      setErrorMsg('');
      setIsSubmitting(false);

      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, financialSettings.baseCurrency.code]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg(isAr ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر' : 'Please enter a valid amount greater than zero');
      amountInputRef.current?.focus();
      return;
    }

    if (expenseCategoryId === 'OTHER' && !notes.trim()) {
      setErrorMsg(isAr ? 'يرجى كتابة بيان وتفاصيل المصروف في حقل الملاحظات' : 'Please specify expense details in notes');
      return;
    }

    setIsSubmitting(true);

    const categoryObj = EXPENSE_CATEGORIES.find(c => c.id === expenseCategoryId);
    const categoryName = categoryObj ? (isAr ? categoryObj.nameAr : categoryObj.nameEn) : expenseCategoryId;

    const expenseRecord: QuickExpenseRecord = {
      id: `EXP-${Date.now().toString().slice(-5)}`,
      amount: parsedAmount,
      currency: activeCurrency.code,
      currencyCode: activeCurrency.code,
      expenseCategoryId,
      categoryName,
      shiftId: activeShift?.id,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Dispatch official .NET Core API Endpoint with dynamic currencyCode
      await fetch('/api/finance/expenses/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsedAmount,
          currency: activeCurrency.code,
          currencyCode: activeCurrency.code,
          expenseCategoryId,
          shiftId: activeShift?.id || null,
          notes: notes.trim() || null
        })
      }).catch(err => {
        // Silently allow offline/local fallback
        console.info('[QuickExpense] Handled locally:', err);
      });

      // 2. Immediate Active Shift Deduction (Reduces expected cash in drawer)
      if (activeShift) {
        recordShiftExpense(parsedAmount);
      }

      // 3. Save to local quick expenses audit ledger
      saveStoredQuickExpense(expenseRecord);

      // 4. Notify all views of drawer update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
      }

      toast.success(
        isAr 
          ? `تم تأكيد وقيد المصروف بمبلغ ${formatCurrencyAmount(parsedAmount, activeCurrency)} ${activeCurrency.symbol} وخصمه من الدرج`
          : `Expense of ${formatCurrencyAmount(parsedAmount, activeCurrency)} ${activeCurrency.code} recorded and deducted from drawer`
      );

      onExpenseRecorded?.(expenseRecord);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || (isAr ? 'فشل قيد المصروف' : 'Failed to record expense'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showCurrencyToggle = Boolean(
    financialSettings.isMultiCurrencyEnabled && financialSettings.secondaryCurrency
  );

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent
        className="w-full max-w-lg bg-card border border-border/80 shadow-2xl rounded-2xl p-0 text-foreground overflow-hidden flex flex-col my-auto"
        style={{
          maxWidth: '560px',
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
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-xs shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground m-0 leading-tight">
                  {isAr ? 'تسجيل مصروف سريع' : 'Quick Operational Expense'}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {activeShift ? `${isAr ? 'وردية' : 'Shift'} ${activeShift.id}` : (isAr ? 'الخزينة المباشرة' : 'Direct Drawer')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground m-0 mt-0.5 leading-normal">
                {isAr
                  ? 'قيد المصروفات النثرية والتشغيلية وخصمها من نقدية الدرج الدفترية'
                  : 'Record petty expenses and automatically deduct from active cash drawer'}
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 overflow-hidden" data-form-type="other">
          <div className="p-5 overflow-y-auto space-y-4">
            
            {/* Error Banner */}
            {errorMsg && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Card 1: Amount & Currency Selection */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-primary" />
                  <span>{isAr ? 'مبلغ المصروف والعملة' : 'Expense Amount & Currency'}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {isAr ? 'حقل إجباري' : 'Required'}
                </span>
              </div>

              <div className={`grid grid-cols-1 ${showCurrencyToggle ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-3 items-center`}>
                {/* Auto-focus Amount Input */}
                <div className={`${showCurrencyToggle ? 'sm:col-span-2' : 'w-full'} space-y-1`}>
                  <span className="text-[11px] font-semibold text-foreground/80 block">
                    {isAr ? 'المبلغ المطلوب صرفه' : 'Amount to Disburse'} *
                  </span>
                  <div className="relative">
                    <Input
                      ref={amountInputRef}
                      type="number"
                      step={activeCurrency.decimals === 0 ? '1' : 'any'}
                      min={activeCurrency.decimals === 0 ? '1' : '0.01'}
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={getCurrencyPlaceholder(activeCurrency, isAr)}
                      className="font-mono font-extrabold text-base h-11 bg-background border-border/80 px-3 text-foreground"
                    />
                    <span className="absolute end-3 top-3 text-xs font-bold text-muted-foreground pointer-events-none select-none">
                      {activeCurrency.symbol}
                    </span>
                  </div>
                </div>

                {/* Segmented Currency Toggle (Strictly conditional based on isMultiCurrencyEnabled & secondaryCurrency) */}
                {showCurrencyToggle && financialSettings.secondaryCurrency && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-foreground/80 block">
                      {isAr ? 'عملة الصرف' : 'Currency'}
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 h-11 p-1 bg-muted/50 rounded-lg border border-border/80">
                      {/* Button 1: Base Currency (Right in RTL) */}
                      <button
                        type="button"
                        onClick={() => setSelectedCurrencyCode(financialSettings.baseCurrency.code)}
                        className={`rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center font-mono ${
                          selectedCurrencyCode === financialSettings.baseCurrency.code
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {financialSettings.baseCurrency.code}
                      </button>

                      {/* Button 2: Secondary Currency (Left in RTL) */}
                      <button
                        type="button"
                        onClick={() => setSelectedCurrencyCode(financialSettings.secondaryCurrency!.code)}
                        className={`rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center font-mono ${
                          selectedCurrencyCode === financialSettings.secondaryCurrency.code
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {financialSettings.secondaryCurrency.code}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Category & Source Drawer */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground/90 pb-1 border-b border-border/50">
                <Tag className="w-4 h-4 text-primary" />
                <span>{isAr ? 'تصنيف المصروف والخزينة المصدر' : 'Expense Category & Drawer'}</span>
              </div>

              {/* Category Dropdown */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-foreground/80 block">
                  {isAr ? 'تصنيف المصروف' : 'Expense Classification'} *
                </span>
                <select
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border/80 bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {isAr ? cat.nameAr : cat.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Drawer (Linked by default to active shift) */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-foreground/80 block">
                  {isAr ? 'الخزينة المصدر (الدرج)' : 'Source Cash Drawer'}
                </span>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/80 text-xs">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-foreground block truncate">
                      {activeShift 
                        ? (isAr ? `درج وردية الكاشير (${activeShift.cashierName})` : `Active Shift Drawer (${activeShift.cashierName})`)
                        : (isAr ? 'صندوق النقد المباشر (الخزينة الرئيسية)' : 'Main Cash Box')}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {activeShift 
                        ? (isAr ? `معرّف الوردية: ${activeShift.id} - سيتم خصم المبلغ من الجرد الفعلي` : `Shift: ${activeShift.id} - Will deduct from expected float`)
                        : (isAr ? 'حساب الخزينة الرئيسي - لا توجد وردية نشطة حالياً' : 'General Cash Box - No active shift')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes Field */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-foreground/80 flex items-center justify-between">
                  <span>{isAr ? 'ملاحظات وتفاصيل المصروف' : 'Notes & Voucher Details'}</span>
                  {expenseCategoryId === 'OTHER' && (
                    <span className="text-[10px] text-destructive font-semibold">
                      {isAr ? 'مطلوب لهذا التصنيف' : 'Required'}
                    </span>
                  )}
                </span>
                <div className="relative">
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isAr ? 'شروط خاصة، أسباب الصرف، أو رقم إيصال النثريات...' : 'Reason for expense, receipt number, details...'}
                    className="h-9 bg-background border-border/80 px-2.5 text-xs font-medium"
                    required={expenseCategoryId === 'OTHER'}
                  />
                  <FileText className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-muted-foreground pointer-events-none" />
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
              disabled={isSubmitting}
              className="h-9 px-4 text-xs font-semibold cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || !amount}
              className="h-9 px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? (isAr ? 'جاري القيد...' : 'Recording...') : (isAr ? 'تأكيد وقيد المصروف' : 'Confirm Expense')}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  );
}
