import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Gift,
  Search,
  User,
  X
} from 'lucide-react';
import { ModalBackdropPortal } from '../ui/dialog';
import { getTranslation } from '../../lib/i18n';
import {
  PosVoucherLookupResult,
  claimPosVoucher,
  fetchPendingPosVouchers,
  lookupPosVoucher
} from '../../services/loyaltyRewardsService';

interface ManualVoucherLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialVouchers?: PosVoucherLookupResult[];
  hasActiveShift: boolean;
  shiftId?: string;
  warehouseId?: string;
  actorName?: string;
  onClaimSuccess: (claimed: PosVoucherLookupResult) => void;
  lang: 'en' | 'ar';
}

export default function ManualVoucherLookupModal({
  isOpen,
  onClose,
  initialVouchers,
  hasActiveShift,
  shiftId,
  warehouseId,
  actorName,
  onClaimSuccess,
  lang
}: ManualVoucherLookupModalProps) {
  const isAr = lang === 'ar';
  const tr = (key: string) => getTranslation(lang, `ui.posLoyaltyScan.${key}`);
  const ptsUnit = getTranslation(lang, 'ui.loyalty.pointsUnit');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PosVoucherLookupResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [claimingCode, setClaimingCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setClaimingCode(null);
    if (initialVouchers && initialVouchers.length > 0) {
      setResults(initialVouchers);
      setHasSearched(true);
      setQuery(initialVouchers[0]?.customerPhone || '');
    } else {
      setResults([]);
      setHasSearched(false);
      setQuery('');
    }
  }, [isOpen, initialVouchers]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = query.trim();
    if (!raw || isSearching) return;

    setIsSearching(true);
    setErrorMsg(null);
    setHasSearched(true);
    try {
      if (/^RDM-/i.test(raw)) {
        const single = await lookupPosVoucher(raw);
        setResults([single]);
      } else {
        const list = await fetchPendingPosVouchers({ phone: raw });
        setResults(list);
      }
    } catch (err: any) {
      const code = err?.message || 'ERR_VOUCHER_NOT_FOUND';
      setResults([]);
      if (code !== 'ERR_VOUCHER_NOT_FOUND') {
        setErrorMsg(getTranslation(lang, `errors.ERR.LOYALTY.${code}`, code));
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleClaim = async (voucher: PosVoucherLookupResult) => {
    if (!hasActiveShift || !shiftId) {
      setErrorMsg(tr('shiftRequiredAlert'));
      return;
    }
    if (voucher.status !== 'PendingPickup' || !voucher.inStock || claimingCode) return;

    setClaimingCode(voucher.voucherCode);
    setErrorMsg(null);
    try {
      const claimed = await claimPosVoucher({
        code: voucher.voucherCode,
        shiftId,
        warehouseId,
        actorName
      });
      setResults(prev => prev.filter(v => v.voucherCode !== claimed.voucherCode));
      onClaimSuccess(claimed);
    } catch (err: any) {
      const code = err?.message || 'ERR_VOUCHER_INVALID_OR_CLAIMED';
      setErrorMsg(getTranslation(lang, `errors.ERR.LOYALTY.${code}`, code));
    } finally {
      setClaimingCode(null);
    }
  };

  return (
    <ModalBackdropPortal onClose={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div
        className="bg-card text-foreground border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Gift size={18} />
            </div>
            <div>
              <h3 className="m-0 text-sm font-bold text-foreground">{tr('manualModalTitle')}</h3>
              <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">{tr('manualModalSubtitle')}</p>
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
          {!hasActiveShift && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{tr('shiftRequiredAlert')}</span>
            </div>
          )}

          {/* Lookup Form */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none ${
                  isAr ? 'right-3' : 'left-3'
                }`}
              />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr('lookupPlaceholder')}
                className={`w-full h-10 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                  isAr ? 'pr-9 pl-3' : 'pl-9 pr-3'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={!query.trim() || isSearching}
              className="h-10 px-4 rounded-xl border-0 bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-45 text-xs font-semibold cursor-pointer shrink-0"
            >
              {isSearching ? tr('lookupSearchingBtn') : tr('lookupSearchBtn')}
            </button>
          </form>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Results Area */}
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
            {!hasSearched ? (
              <div className="p-6 rounded-xl bg-muted/40 border border-border text-center text-xs text-muted-foreground">
                {tr('lookupPromptHint')}
              </div>
            ) : results.length === 0 ? (
              <div className="p-6 rounded-xl bg-muted/40 border border-border text-center text-xs text-muted-foreground">
                {tr('lookupNoResults')}
              </div>
            ) : (
              results.map(v => {
                const isPending = v.status === 'PendingPickup';
                const canClaim = hasActiveShift && isPending && v.inStock && !claimingCode;
                return (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {v.rewardImageUrl ? (
                          <img
                            src={v.rewardImageUrl}
                            alt={v.rewardTitle}
                            className="w-12 h-12 rounded-xl object-cover border border-border bg-white shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Gift size={20} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              dir="ltr"
                              className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px] font-bold"
                            >
                              {v.voucherCode}
                            </span>
                            <span
                              dir="ltr"
                              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 tabular-nums inline-flex items-center gap-1"
                            >
                              <Award size={12} />
                              <span>{Number(v.pointsSpent || 0).toLocaleString('en-US')}</span>
                              <span>{ptsUnit}</span>
                            </span>
                          </div>
                          <div className="text-sm font-bold text-foreground truncate mt-1" dir="auto">
                            {v.rewardTitle}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <User size={11} className="shrink-0" />
                            <span className="truncate" dir="auto">{v.customerName}</span>
                            {v.customerPhone && (
                              <span dir="ltr" className="font-mono">({v.customerPhone})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canClaim}
                        onClick={() => handleClaim(v)}
                        className="px-3.5 py-2 rounded-xl border-0 bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        <span>
                          {claimingCode === v.voucherCode
                            ? tr('claimingBtn')
                            : tr('confirmHandoverBtn')}
                        </span>
                      </button>
                    </div>

                    {!isPending && (
                      <div className="text-[11px] font-semibold text-destructive">
                        {tr('alreadyClaimedAlert')}
                      </div>
                    )}
                    {isPending && !v.inStock && (
                      <div className="text-[11px] font-semibold text-destructive">
                        {tr('outOfStockAlert')}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-muted text-foreground hover:bg-muted/80 text-xs font-semibold cursor-pointer"
            >
              {tr('cancelBtn')}
            </button>
          </div>
        </div>
      </div>
    </ModalBackdropPortal>
  );
}
