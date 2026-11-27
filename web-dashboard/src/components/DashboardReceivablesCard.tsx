import React from 'react';
import { CreditCard, Users, CalendarClock, ArrowLeft, ArrowUpRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getTranslation } from '../lib/i18n';
import { useSettings } from '../context/settings-context';

interface DashboardReceivablesCardProps {
  lang: 'en' | 'ar';
  customerCreditTotal: number;
  creditCustomersCount: number;
  overdueInstallmentsCount: number;
  overdueInstallmentsAmount: number;
  totalInstallmentsRemaining: number;
  showInstallments?: boolean;
  onNavigateCustomers: () => void;
  onNavigateInstallments?: () => void;
}

export default function DashboardReceivablesCard({
  lang,
  customerCreditTotal,
  creditCustomersCount,
  overdueInstallmentsCount,
  overdueInstallmentsAmount,
  totalInstallmentsRemaining,
  showInstallments = true,
  onNavigateCustomers,
  onNavigateInstallments
}: DashboardReceivablesCardProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const t = (key: string) => getTranslation(lang, key);

  return (
    <div
      className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between gap-4 h-full"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-border bg-muted"
            style={{ color: 'var(--primary)' }}
          >
            <CreditCard size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground m-0 truncate">
              {t('ui.receivables.title')}
            </h3>
            <p className="text-xs text-muted-foreground m-0 mt-0.5 truncate">
              {t('ui.receivables.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Stack */}
      <div className="space-y-3 flex-1 flex flex-col justify-center">
        {/* Customer Credit Receivables */}
        <button
          type="button"
          onClick={onNavigateCustomers}
          className="w-full text-start p-3.5 rounded-xl border border-border bg-muted/40 hover:bg-muted transition-colors cursor-pointer flex items-center justify-between gap-3"
          style={{ backgroundColor: 'color-mix(in oklch, var(--muted) 45%, transparent)' }}
        >
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users size={13} />
              <span>{t('ui.receivables.customerCreditLabel')}</span>
            </div>
            <div className="text-lg font-extrabold text-foreground tabular-nums">
              {formatMoney(customerCreditTotal)}
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums shrink-0 ${
              creditCustomersCount > 0
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {creditCustomersCount > 0
              ? t('ui.receivables.customersCountBadge').replace('{count}', String(creditCustomersCount))
              : t('ui.receivables.noReceivables')}
          </span>
        </button>

        {/* Overdue Installments & Remaining Balance */}
        {showInstallments && (
          <button
            type="button"
            onClick={onNavigateInstallments}
            className="w-full text-start p-3.5 rounded-xl border border-border bg-muted/40 hover:bg-muted transition-colors cursor-pointer flex items-center justify-between gap-3"
            style={{ backgroundColor: 'color-mix(in oklch, var(--muted) 45%, transparent)' }}
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarClock size={13} />
                <span>{t('ui.receivables.overdueInstallmentsLabel')}</span>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className={`text-lg font-extrabold tabular-nums ${
                    overdueInstallmentsCount > 0
                      ? 'text-destructive'
                      : 'text-foreground'
                  }`}
                >
                  {formatMoney(overdueInstallmentsAmount)}
                </span>
                {totalInstallmentsRemaining > 0 && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    ({t('ui.receivables.remainingInstallmentsLabel')} {formatMoney(totalInstallmentsRemaining)})
                  </span>
                )}
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums shrink-0 ${
                overdueInstallmentsCount > 0
                  ? 'bg-red-500/10 text-destructive border border-red-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {overdueInstallmentsCount > 0 ? (
                <>
                  <AlertTriangle size={12} />
                  <span>{t('ui.receivables.overdueCountBadge').replace('{count}', String(overdueInstallmentsCount))}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} />
                  <span>{t('ui.receivables.noOverdueBadge')}</span>
                </>
              )}
            </span>
          </button>
        )}
      </div>

      {/* Footer Quick Links */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onNavigateCustomers}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
        >
          <span>{t('ui.receivables.manageCustomersBtn')}</span>
          {isAr ? <ArrowLeft size={13} /> : <ArrowUpRight size={13} />}
        </button>

        {showInstallments && onNavigateInstallments && (
          <button
            type="button"
            onClick={onNavigateInstallments}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            <span>{t('ui.receivables.manageInstallmentsBtn')}</span>
            {isAr ? <ArrowLeft size={13} /> : <ArrowUpRight size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
