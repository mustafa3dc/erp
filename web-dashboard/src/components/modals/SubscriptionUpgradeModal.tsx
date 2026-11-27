import React, { useState } from 'react';
import {
  Check,
  Crown,
  Lock,
  MessageCircle,
  Sparkles,
  Users,
  Warehouse,
  Building2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTenantPlan } from '../../hooks/useTenantPlan';
import { useSettings } from '../../context/settings-context';
import { getTranslation, MESSAGES } from '../../lib/i18n';
import {
  BillingCycle,
  PLAN_PRICING_MATRIX,
  SubscriptionPlan,
} from '../../types/subscription';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';

const PLAN_ORDER: SubscriptionPlan[] = ['Starter', 'Pro', 'Enterprise'];

export const SubscriptionUpgradeModal: React.FC = () => {
  const { effectiveLanguage, isAr } = useSettings();
  const lang: 'ar' | 'en' = effectiveLanguage === 'en' ? 'en' : 'ar';
  const tr = (key: string) => getTranslation(lang, `ui.plans.${key}`);

  const {
    upgradeModalOpen,
    closeUpgradeModal,
    plan: currentPlan,
    usage,
    upgradeModalRequiredPlan,
    upgradeModalReasonKey,
    upgradeModalQuotaMeta,
  } = useTenantPlan();

  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('Annual');

  if (!upgradeModalOpen) return null;

  const formatNum = (val: number) => val.toLocaleString(isAr ? 'en-US' : 'en-US');

  const getPlanLabel = (p: SubscriptionPlan) => {
    if (p === 'Starter') return tr('starter.name');
    if (p === 'Pro') return tr('pro.name');
    return tr('enterprise.name');
  };

  const getPlanHighlights = (p: SubscriptionPlan): string[] => {
    const k = p.toLowerCase();
    const list = MESSAGES[lang]?.ui?.plans?.[k]?.features;
    return Array.isArray(list) ? list : [];
  };

  const renderNoticeText = () => {
    if (!upgradeModalReasonKey) return null;
    if (upgradeModalReasonKey === 'ERR_PLAN_USER_LIMIT_REACHED') {
      return tr('quotaUsersBanner')
        .replace('{current}', String(upgradeModalQuotaMeta?.current ?? usage.usersCount))
        .replace('{max}', String(upgradeModalQuotaMeta?.max ?? usage.maxUsers ?? ''));
    }
    if (upgradeModalReasonKey === 'ERR_PLAN_WAREHOUSE_LIMIT_REACHED') {
      return tr('quotaWarehousesBanner')
        .replace('{current}', String(upgradeModalQuotaMeta?.current ?? usage.warehousesCount))
        .replace('{max}', String(upgradeModalQuotaMeta?.max ?? usage.maxWarehouses ?? ''));
    }
    if (upgradeModalReasonKey === 'ERR_PLAN_BRANCH_LIMIT_REACHED') {
      return tr('quotaBranchesBanner')
        .replace('{current}', String(upgradeModalQuotaMeta?.current ?? usage.branchesCount))
        .replace('{max}', String(upgradeModalQuotaMeta?.max ?? usage.maxBranches ?? ''));
    }
    const targetPlanLabel = getPlanLabel(upgradeModalRequiredPlan || 'Pro');
    return tr('lockedFeatureBanner').replace('{plan}', targetPlanLabel);
  };

  const noticeText = renderNoticeText();

  const handleRequestUpgrade = (targetPlan: SubscriptionPlan) => {
    toast.success(`${getPlanLabel(targetPlan)} — ${tr('upgradeSuccessToast')}`);
    closeUpgradeModal();
  };

  return (
    <DialogPortal>
      <DialogOverlay onClick={closeUpgradeModal} />
      <DialogContent
        dir={isAr ? 'rtl' : 'ltr'}
        className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card text-foreground p-6 shadow-2xl"
        style={{ maxWidth: '1040px' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-foreground m-0">
                {tr('modalTitle')}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 m-0">
                {tr('modalSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeUpgradeModal}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label={tr('closeBtn')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Context Lock / Quota Banner */}
        {noticeText && (
          <div className="mt-4 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <Lock className="w-4 h-4 shrink-0" />
            <span>{noticeText}</span>
          </div>
        )}

        {/* Current Usage Summary Strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-muted/60 border border-border text-xs">
          <span className="font-bold text-foreground">{tr('usageTitle')}:</span>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span>
                {tr('usageUsers')}:{' '}
                <strong className="text-foreground">
                  {usage.usersCount} / {usage.maxUsers ?? tr('unlimited')}
                </strong>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-primary" />
              <span>
                {tr('usageWarehouses')}:{' '}
                <strong className="text-foreground">
                  {usage.warehousesCount} / {usage.maxWarehouses ?? tr('unlimited')}
                </strong>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>
                {tr('usageBranches')}:{' '}
                <strong className="text-foreground">
                  {usage.branchesCount} / {usage.maxBranches ?? tr('unlimited')}
                </strong>
              </span>
            </span>
          </div>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="mt-5 flex justify-center">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted border border-border">
            {(
              [
                { id: 'Monthly', label: tr('billingMonthly') },
                { id: 'Annual', label: tr('billingAnnual') },
                { id: 'Lifetime', label: tr('billingLifetime') },
              ] as const
            ).map((opt) => {
              const active = selectedCycle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedCycle(opt.id)}
                  className={`px-4 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    active
                      ? 'bg-card text-foreground font-bold shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground font-semibold'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Pricing Cards */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLAN_ORDER.map((planId) => {
            const spec = PLAN_PRICING_MATRIX[planId];
            const k = planId.toLowerCase();
            const isCurrent = currentPlan === planId;
            const isRequired = upgradeModalRequiredPlan === planId;
            const isPopular = Boolean(spec.popular);
            const highlights = getPlanHighlights(planId);

            const priceValue =
              selectedCycle === 'Monthly'
                ? spec.monthlyIqd
                : selectedCycle === 'Annual'
                ? spec.annualIqd
                : spec.lifetimeIqd;

            const priceSuffix =
              selectedCycle === 'Monthly'
                ? tr('perMonthSuffix')
                : selectedCycle === 'Annual'
                ? tr('perYearSuffix')
                : tr('lifetimeSuffix');

            return (
              <div
                key={planId}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all bg-card ${
                  isPopular
                    ? 'border-primary ring-2 ring-primary/20 shadow-md'
                    : isRequired
                    ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                    : 'border-border'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3 min-h-[24px]">
                    <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      {tr(`${k}.tag`)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isPopular && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary text-primary-foreground">
                          <Sparkles className="w-3 h-3" />
                          <span>{tr('popularBadge')}</span>
                        </span>
                      )}
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          {tr('currentPlanBadge')}
                        </span>
                      )}
                      {isRequired && !isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          {tr('requiredPlanBadge')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="text-base font-extrabold text-foreground m-0">
                    {tr(`${k}.name`)}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed min-h-[34px]">
                    {tr(`${k}.desc`)}
                  </p>

                  {/* Price Block */}
                  <div className="mt-4 pb-4 border-b border-border">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-foreground tabular-nums">
                        {formatNum(priceValue)}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {priceSuffix}
                      </span>
                    </div>
                    {selectedCycle === 'Lifetime' ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1 m-0">
                        ({tr(`${k}.cloudRenewal`)})
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-1 m-0">
                        {tr(`${k}.quotasSummary`)}
                      </p>
                    )}
                  </div>

                  {/* Feature List */}
                  <ul className="mt-4 space-y-2.5 text-xs text-foreground list-none p-0 m-0">
                    {highlights.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span className="leading-snug">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="mt-6 pt-3 border-t border-border/60">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full h-10 rounded-xl bg-muted text-muted-foreground border border-border text-xs font-bold cursor-not-allowed"
                    >
                      {tr('activePlanBtn')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRequestUpgrade(planId)}
                      className={`w-full h-10 rounded-xl inline-flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        isPopular || isRequired
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                          : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                      }`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{tr('requestUpgradeBtn')}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </DialogPortal>
  );
};

export default SubscriptionUpgradeModal;
