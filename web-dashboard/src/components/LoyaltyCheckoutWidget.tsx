import React, { useState, useEffect } from 'react';
import { Award, Gift, Check, X, Sparkles } from 'lucide-react';
import { getTranslation } from '../lib/i18n';
import {
  LoyaltySettingsConfig,
  calculateLoyaltyCurrencyEquivalent
} from '../services/storageService';

export interface LoyaltyCheckoutWidgetProps {
  lang: 'ar' | 'en';
  customer: any | null;
  isWalkIn: boolean;
  loyaltySettings: LoyaltySettingsConfig;
  maxDiscountCap: number;
  appliedRedeemPoints: number;
  appliedDiscountAmount: number;
  onApplyRedeemPoints: (points: number) => void;
  estimatedEarnedPoints?: number;
  formatMoney: (amount: number) => string;
  compact?: boolean;
}

export default function LoyaltyCheckoutWidget({
  lang,
  customer,
  isWalkIn,
  loyaltySettings,
  maxDiscountCap,
  appliedRedeemPoints,
  appliedDiscountAmount,
  onApplyRedeemPoints,
  estimatedEarnedPoints = 0,
  formatMoney,
  compact = false
}: LoyaltyCheckoutWidgetProps) {
  const tr = (key: string, fallback?: string) => getTranslation(lang, `ui.loyalty.${key}`, fallback);
  const [isRedeemPanelOpen, setIsRedeemPanelOpen] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const availablePoints = Number(customer?.loyaltyPointsBalance ?? customer?.loyaltyPoints ?? 0) || 0;
  const availableCurrencyValue = calculateLoyaltyCurrencyEquivalent(availablePoints, loyaltySettings);
  const minThreshold = Number(loyaltySettings.minRedeemablePoints) || 0;
  const canRedeemByThreshold = availablePoints >= minThreshold && availablePoints > 0 && maxDiscountCap > 0;

  // Reset input/error when customer changes
  useEffect(() => {
    setValidationError(null);
    if (appliedRedeemPoints <= 0) {
      setRedeemInput('');
      setIsRedeemPanelOpen(false);
    }
  }, [customer?.id, isWalkIn, appliedRedeemPoints]);

  if (!loyaltySettings.isLoyaltyEnabled) {
    return null;
  }

  if (isWalkIn || !customer) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-[11px] text-muted-foreground">
        <Award className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
        <span>{tr('walkInExcludedHint')}</span>
      </div>
    );
  }

  const maxPointsForInvoice = loyaltySettings.currencyValuePerUnit > 0 && loyaltySettings.pointsRedemptionUnit > 0
    ? Math.floor(((maxDiscountCap / loyaltySettings.currencyValuePerUnit) * loyaltySettings.pointsRedemptionUnit) * 100) / 100
    : availablePoints;
  const maxRedeemableNow = Math.max(0, Math.min(availablePoints, maxPointsForInvoice));

  const handleApply = () => {
    setValidationError(null);
    const parsed = parseFloat(redeemInput);
    if (isNaN(parsed) || parsed <= 0) {
      onApplyRedeemPoints(0);
      setIsRedeemPanelOpen(false);
      return;
    }
    if (availablePoints < minThreshold) {
      setValidationError(tr('belowMinThresholdError').replace('{min}', minThreshold.toLocaleString('en-US')));
      return;
    }
    if (parsed > availablePoints) {
      setValidationError(tr('insufficientPointsError'));
      return;
    }
    const bounded = Math.min(parsed, maxRedeemableNow);
    onApplyRedeemPoints(bounded);
    setIsRedeemPanelOpen(false);
  };

  const badgeText = tr('availablePointsBadge')
    .replace('{points}', availablePoints.toLocaleString('en-US'))
    .replace('{value}', formatMoney(availableCurrencyValue));

  return (
    <div className={`${compact ? 'mt-2' : 'mt-2.5'} rounded-xl border border-amber-500/25 bg-amber-500/5 ${compact ? 'p-2.5' : 'p-3'} space-y-2`}>
      {/* Top Row: Points Balance Badge + Redeem Trigger */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
          <Award className="w-3.5 h-3.5 shrink-0" />
          <span className="tabular-nums" dir="auto">{badgeText}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {estimatedEarnedPoints > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10.5px] font-bold tabular-nums">
              <Sparkles className="w-3 h-3" />
              <span>{tr('pointsEarnedBadge').replace('{points}', estimatedEarnedPoints.toLocaleString('en-US'))}</span>
            </span>
          )}

          {appliedRedeemPoints > 0 ? (
            <button
              type="button"
              onClick={() => {
                onApplyRedeemPoints(0);
                setRedeemInput('');
                setValidationError(null);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/25 text-[11px] font-bold hover:bg-destructive/15 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>{tr('clearRedeemBtn')}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canRedeemByThreshold}
              onClick={() => {
                setValidationError(null);
                setRedeemInput(maxRedeemableNow > 0 ? String(maxRedeemableNow) : '');
                setIsRedeemPanelOpen(prev => !prev);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Gift className="w-3 h-3" />
              <span>{tr('redeemBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Applied Discount Strip or Threshold Hint */}
      {appliedRedeemPoints > 0 ? (
        <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
          <span className="tabular-nums">
            {tr('redeemDiscountApplied').replace('{points}', appliedRedeemPoints.toLocaleString('en-US'))}
          </span>
          <span className="font-mono font-bold tabular-nums" dir="ltr">
            -{formatMoney(appliedDiscountAmount)}
          </span>
        </div>
      ) : availablePoints > 0 && availablePoints < minThreshold ? (
        <div className="text-[10.5px] text-muted-foreground tabular-nums">
          {tr('minRequiredHint').replace('{min}', minThreshold.toLocaleString('en-US'))}
        </div>
      ) : null}

      {/* Expandable Redemption Input */}
      {isRedeemPanelOpen && appliedRedeemPoints <= 0 && (
        <div className="pt-1.5 border-t border-amber-500/20 space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={availablePoints}
              step="1"
              value={redeemInput}
              onChange={(e) => {
                setRedeemInput(e.target.value);
                setValidationError(null);
              }}
              placeholder={tr('redeemInputLabel')}
              className="flex-1 h-8 px-2.5 rounded-lg border border-amber-500/35 bg-background text-xs font-mono tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={() => setRedeemInput(String(maxRedeemableNow))}
              className="h-8 px-2.5 rounded-lg border border-border bg-card text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer"
            >
              {tr('redeemMaxBtn')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>{tr('applyRedeemBtn')}</span>
            </button>
          </div>
          {validationError && (
            <p className="text-[11px] font-semibold text-destructive m-0">{validationError}</p>
          )}
        </div>
      )}
    </div>
  );
}
