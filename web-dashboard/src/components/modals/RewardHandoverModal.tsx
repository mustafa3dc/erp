import React, { useState } from 'react';
import { AlertTriangle, Award, CheckCircle2, Gift, Package, User, X } from 'lucide-react';
import { ModalBackdropPortal } from '../ui/dialog';
import { PosVoucherLookupResult } from '../../services/loyaltyRewardsService';
import { getTranslation } from '../../lib/i18n';

interface RewardHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: PosVoucherLookupResult | null;
  hasActiveShift: boolean;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onConfirmHandover: () => Promise<void> | void;
  lang: 'en' | 'ar';
}

export default function RewardHandoverModal({
  isOpen,
  onClose,
  voucher,
  hasActiveShift,
  isSubmitting,
  errorMessage,
  onConfirmHandover,
  lang
}: RewardHandoverModalProps) {
  const isAr = lang === 'ar';
  const [localConfirming, setLocalConfirming] = useState(false);

  if (!isOpen || !voucher) return null;

  const tr = (key: string) => getTranslation(lang, `ui.posLoyaltyScan.${key}`);
  const ptsUnit = getTranslation(lang, 'ui.loyalty.pointsUnit');
  const isPending = voucher.status === 'PendingPickup';
  const canHandover = hasActiveShift && isPending && voucher.inStock && !isSubmitting && !localConfirming;

  const statusBadge =
    voucher.status === 'PendingPickup'
      ? {
          label: tr('statusPending'),
          cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
        }
      : voucher.status === 'Claimed'
        ? {
            label: tr('statusClaimed'),
            cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
          }
        : {
            label: tr('statusCancelled'),
            cls: 'bg-destructive/15 text-destructive border-destructive/30'
          };

  const handleConfirm = async () => {
    if (!canHandover) return;
    setLocalConfirming(true);
    try {
      await onConfirmHandover();
    } finally {
      setLocalConfirming(false);
    }
  };

  return (
    <ModalBackdropPortal onClose={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div
        className="bg-card text-foreground border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Gift size={18} />
            </div>
            <div>
              <h3 className="m-0 text-sm font-bold text-foreground">{tr('handoverModalTitle')}</h3>
              <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">{tr('handoverModalSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer border-0 bg-transparent"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Reward Hero */}
          <div className="p-3.5 rounded-xl bg-muted/50 border border-border flex items-center gap-3.5">
            {voucher.rewardImageUrl ? (
              <img
                src={voucher.rewardImageUrl}
                alt={voucher.rewardTitle}
                className="w-16 h-16 rounded-xl object-cover border border-border shrink-0 bg-white"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Gift size={26} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  dir="ltr"
                  className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-bold"
                >
                  {voucher.voucherCode}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.cls}`}>
                  {statusBadge.label}
                </span>
              </div>
              <div className="text-sm font-bold text-foreground mt-1.5 truncate" dir="auto">
                {voucher.rewardTitle}
              </div>
              {voucher.rewardDescription && (
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5" dir="auto">
                  {voucher.rewardDescription}
                </div>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-muted/40 border border-border">
              <div className="text-[11px] text-muted-foreground mb-1">{tr('customerNameLabel')}</div>
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <User size={13} className="text-muted-foreground shrink-0" />
                <span className="truncate" dir="auto">{voucher.customerName}</span>
              </div>
              {voucher.loyaltyMemberCode && (
                <div dir="ltr" className="text-[10px] font-mono text-primary mt-0.5 text-start">
                  {voucher.loyaltyMemberCode}
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border">
              <div className="text-[11px] text-muted-foreground mb-1">{tr('pointsSpentLabel')}</div>
              <div
                dir="ltr"
                className="text-sm font-extrabold text-amber-600 dark:text-amber-400 tabular-nums flex items-center gap-1 text-start"
              >
                <Award size={14} className="shrink-0" />
                <span>{Number(voucher.pointsSpent || 0).toLocaleString('en-US')}</span>
                <span className="text-[11px] font-semibold">{ptsUnit}</span>
              </div>
            </div>
          </div>

          {/* Stock or Validation Notices */}
          {!hasActiveShift ? (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{tr('shiftRequiredAlert')}</span>
            </div>
          ) : !isPending ? (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{tr('alreadyClaimedAlert')}</span>
            </div>
          ) : !voucher.inStock ? (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{tr('outOfStockAlert')}</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-muted/50 border border-border text-muted-foreground text-xs flex items-start gap-2">
              <Package size={15} className="text-primary shrink-0 mt-0.5" />
              <span>
                {voucher.productId ? tr('stockDeductNotice') : tr('noStockDeductNotice')}
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-muted text-foreground hover:bg-muted/80 text-xs font-semibold cursor-pointer"
            >
              {tr('cancelBtn')}
            </button>
            <button
              type="button"
              disabled={!canHandover}
              onClick={handleConfirm}
              className="px-4 py-2 rounded-xl border-0 bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <CheckCircle2 size={15} />
              <span>
                {isSubmitting || localConfirming ? tr('claimingBtn') : tr('confirmHandoverBtn')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </ModalBackdropPortal>
  );
}
