import React, { useEffect, useState } from 'react';
import { PieChart, ArrowUpRight, ArrowLeft, Users } from 'lucide-react';
import { UserProfile } from '../types/rbac';
import { checkUserHasPermission } from '../config/navigationSchema';
import { getTranslation } from '../lib/i18n';
import { useSettings } from '../context/settings-context';
import {
  PartnersSummaryResponse,
  fetchDashboardPartnersSummary
} from '../services/partnersService';

interface DashboardPartnersWidgetProps {
  lang: 'en' | 'ar';
  currentUser: UserProfile | null;
  selectedDateRangeId: string;
  selectedWarehouseId?: string;
  onNavigatePartners: () => void;
}

export default function DashboardPartnersWidget({
  lang,
  currentUser,
  selectedDateRangeId,
  selectedWarehouseId,
  onNavigatePartners
}: DashboardPartnersWidgetProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const hasPartnerPermission = checkUserHasPermission(currentUser?.permissions ?? [], 'finance.partners.manage');
  const [summary, setSummary] = useState<PartnersSummaryResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!hasPartnerPermission) {
      setSummary(null);
      setLoaded(true);
      return;
    }

    fetchDashboardPartnersSummary(selectedDateRangeId, selectedWarehouseId)
      .then(data => {
        if (active) {
          setSummary(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setSummary(null);
          setLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [hasPartnerPermission, selectedDateRangeId, selectedWarehouseId]);

  if (!hasPartnerPermission || (loaded && summary === null)) {
    return null;
  }

  if (!summary) {
    return null;
  }

  const activePartners = summary.partners.filter(p => p.isActive);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <PieChart size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {getTranslation(lang, 'ui.partners.widgetTitle')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {getTranslation(lang, 'ui.partners.widgetSubtitle')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigatePartners}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
        >
          <span>{getTranslation(lang, 'ui.partners.widgetManageBtn')}</span>
          {isAr ? <ArrowLeft size={13} /> : <ArrowUpRight size={13} />}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
          <div className="text-xs text-muted-foreground">
            {getTranslation(lang, 'ui.partners.widgetNetProfit')}
          </div>
          <div
            className={`text-lg font-bold tabular-nums ${
              summary.totalNetProfit < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
            dir="ltr"
          >
            {formatMoney(summary.totalNetProfit)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users size={13} />
            <span>{getTranslation(lang, 'ui.partners.widgetPartnersCount')}</span>
          </div>
          <div className="text-lg font-bold text-foreground tabular-nums">
            {activePartners.length}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
          <div className="text-xs text-muted-foreground">
            {getTranslation(lang, 'ui.partners.allocationTitle')}
          </div>
          <div className="text-sm font-bold text-primary tabular-nums">
            {getTranslation(lang, 'ui.partners.widgetAllocatedOf').replace(
              '{allocated}',
              String(summary.allocatedSharePercent)
            )}
          </div>
        </div>
      </div>

      {activePartners.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          {getTranslation(lang, 'ui.partners.widgetNoPartners')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {activePartners.slice(0, 4).map(p => (
            <div
              key={p.id}
              className="p-3 rounded-xl bg-background border border-border/70 flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground truncate">{p.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary tabular-nums" dir="ltr">
                  {p.profitSharePercent}%
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{getTranslation(lang, 'ui.partners.colEarnedProfit')}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums" dir="ltr">
                    {formatMoney(p.earnedProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{getTranslation(lang, 'ui.partners.colNetPayable')}</span>
                  <span className="font-bold text-foreground tabular-nums" dir="ltr">
                    {formatMoney(p.netPayableBalance)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
