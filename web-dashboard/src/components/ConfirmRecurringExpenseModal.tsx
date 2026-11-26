import React, { useState, useEffect } from 'react';
import { CheckCircle2, CalendarClock, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { RecurringExpenseRule } from '../types/businessModules';
import { getTranslation } from '../lib/i18n';
import { useSettings } from '../context/settings-context';
import {
  confirmRecurringExpense,
  formatRecurringErrorMessage,
  formatRecurringScheduleLabel
} from '../services/recurringExpensesService';
import { ModalBackdropPortal } from './ui/dialog';

interface ConfirmRecurringExpenseModalProps {
  rule: RecurringExpenseRule | null;
  lang: 'en' | 'ar';
  onClose: () => void;
  onConfirmed: () => void;
}

export default function ConfirmRecurringExpenseModal({
  rule,
  lang,
  onClose,
  onConfirmed
}: ConfirmRecurringExpenseModalProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const [actualAmount, setActualAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (rule) {
      setActualAmount(String(rule.amount));
      setNotes('');
      setErrorMsg('');
    }
  }, [rule]);

  if (!rule) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmount = Number(actualAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg(getTranslation(lang, 'errors.ERR.RECURRING.ERR_INVALID_RECURRING_AMOUNT'));
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmRecurringExpense(rule.id, {
        actualAmount: parsedAmount,
        notes: notes.trim() || null
      });
      const msg = getTranslation(lang, 'ui.recurringExpenses.confirmedToast')
        .replace('{title}', rule.title)
        .replace('{amount}', formatMoney(parsedAmount));
      toast.success(msg);
      onConfirmed();
      onClose();
    } catch (err: any) {
      setErrorMsg(formatRecurringErrorMessage(err, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBackdropPortal onClose={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <CalendarClock size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {getTranslation(lang, 'ui.recurringExpenses.confirmModalTitle')}
              </h3>
              <p className="text-xs text-muted-foreground">{rule.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-muted/50 border border-border space-y-1 text-xs">
            <div className="flex items-center justify-between text-foreground font-semibold">
              <span>{rule.category}</span>
              <span className="text-muted-foreground">{formatRecurringScheduleLabel(rule, lang)}</span>
            </div>
            <p className="text-muted-foreground">
              {getTranslation(lang, 'ui.recurringExpenses.confirmModalSubtitle')}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {getTranslation(lang, 'ui.recurringExpenses.confirmActualAmount')} *
            </label>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              dir="ltr"
              value={actualAmount}
              onChange={e => setActualAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-base font-bold text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {getTranslation(lang, 'ui.recurringExpenses.fieldNotes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={getTranslation(lang, 'ui.recurringExpenses.fieldNotesPlaceholder')}
              className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{getTranslation(lang, 'ui.recurringExpenses.confirmTreasuryNote')}</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors"
            >
              {getTranslation(lang, 'ui.recurringExpenses.cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
            >
              <CheckCircle2 size={15} />
              <span>
                {isSubmitting
                  ? getTranslation(lang, 'ui.recurringExpenses.confirmingBtn')
                  : getTranslation(lang, 'ui.recurringExpenses.confirmSubmitBtn')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </ModalBackdropPortal>
  );
}
