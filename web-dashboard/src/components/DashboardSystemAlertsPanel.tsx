import React, { useState } from 'react';
import { BellRing, CheckCircle2, ArrowLeft, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { RecurringExpenseRule } from '../types/businessModules';
import { getTranslation } from '../lib/i18n';
import { formatLatinDate } from '../lib/formatters';
import { useSettings } from '../context/settings-context';
import ConfirmRecurringExpenseModal from './ConfirmRecurringExpenseModal';

interface DashboardSystemAlertsPanelProps {
  lang: 'en' | 'ar';
  dueRecurringExpenses: RecurringExpenseRule[];
  onRefreshDue: () => void;
  onNavigateExpenses: () => void;
}

export default function DashboardSystemAlertsPanel({
  lang,
  dueRecurringExpenses,
  onRefreshDue,
  onNavigateExpenses
}: DashboardSystemAlertsPanelProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const [confirmTarget, setConfirmTarget] = useState<RecurringExpenseRule | null>(null);

  if (!dueRecurringExpenses || dueRecurringExpenses.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-card border border-amber-500/40 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  {getTranslation(lang, 'ui.recurringExpenses.dashboardAlertsTitle')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 tabular-nums">
                  {getTranslation(lang, 'ui.recurringExpenses.dashboardDueCountLabel').replace(
                    '{count}',
                    String(dueRecurringExpenses.length)
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {getTranslation(lang, 'ui.recurringExpenses.dashboardAlertsSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateExpenses}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors"
          >
            <span>{getTranslation(lang, 'ui.recurringExpenses.dashboardManageRecurringBtn')}</span>
            {isAr ? <ArrowLeft size={13} /> : <ArrowUpRight size={13} />}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dueRecurringExpenses.map(rule => (
            <div
              key={rule.id}
              className="p-3 rounded-xl bg-muted/40 border border-border/70 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <BellRing size={15} className="text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">{rule.title}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums" dir="ltr">
                    <span className="font-semibold text-foreground">{formatMoney(rule.amount)}</span>
                    <span>•</span>
                    <span>{formatLatinDate(rule.nextDueDate, isAr ? 'ar' : 'en')}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmTarget(rule)}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition-all"
              >
                <CheckCircle2 size={13} />
                <span>{getTranslation(lang, 'ui.recurringExpenses.confirmPaymentBtn')}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmRecurringExpenseModal
        rule={confirmTarget}
        lang={lang}
        onClose={() => setConfirmTarget(null)}
        onConfirmed={onRefreshDue}
      />
    </>
  );
}
