import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Gift,
  Languages,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Store,
  Sun,
  Ticket,
  X
} from 'lucide-react';
import QrCodeSvg from '../QrCodeSvg';
import BarcodeSvg from '../BarcodeSvg';
import { ModalBackdropPortal } from '../ui/dialog';
import { getTranslation } from '../../lib/i18n';
import { useSettings } from '../../context/settings-context';
import {
  PublicLoyaltyCardData,
  PublicLoyaltyReward,
  PublicLoyaltyVoucher,
  cancelPublicVoucher,
  fetchPublicLoyaltyCard,
  redeemPublicReward
} from '../../services/loyaltyRewardsService';

interface PublicLoyaltyCardPageProps {
  token: string;
  onNavigateToken: (nextToken: string) => void;
}

export default function PublicLoyaltyCardPage({
  token,
  onNavigateToken
}: PublicLoyaltyCardPageProps) {
  const { effectiveLanguage, setLocale, effectiveTheme, setTheme } = useSettings();
  const lang: 'ar' | 'en' = effectiveLanguage === 'ar' ? 'ar' : 'en';
  const isAr = lang === 'ar';

  const dwTr = (key: string) => getTranslation(lang, `ui.digitalWallet.${key}`);
  const ptsUnit = getTranslation(lang, 'ui.loyalty.pointsUnit');

  const [card, setCard] = useState<PublicLoyaltyCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [redeemTarget, setRedeemTarget] = useState<PublicLoyaltyReward | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PublicLoyaltyVoucher | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add to Home Screen prompt support
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [showAddToHomeHint, setShowAddToHomeHint] = useState(false);

  const loadCard = async (targetToken: string) => {
    setLoading(true);
    setErrorCode(null);
    try {
      const data = await fetchPublicLoyaltyCard(targetToken);
      setCard(data);
    } catch (err: any) {
      setCard(null);
      setErrorCode(err?.message || 'ERR_LOYALTY_CARD_NOT_FOUND');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCard(token);
  }, [token]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const showSuccessToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 4000);
  };

  const { availableRewards, upcomingRewards } = useMemo(() => {
    if (!card) return { availableRewards: [], upcomingRewards: [] };
    const bal = card.loyaltyPointsBalance;
    const avail: PublicLoyaltyReward[] = [];
    const upcoming: PublicLoyaltyReward[] = [];

    for (const r of card.rewards) {
      if (bal >= r.pointsCost && r.inStock) {
        avail.push(r);
      } else {
        upcoming.push(r);
      }
    }
    return { availableRewards: avail, upcomingRewards: upcoming };
  }, [card]);

  const handleConfirmRedeem = async () => {
    if (!card || !redeemTarget || isProcessing) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      const issued = await redeemPublicReward(card.loyaltyCardToken, redeemTarget.id);
      setRedeemTarget(null);
      await loadCard(card.loyaltyCardToken);
      showSuccessToast(dwTr('redeemSuccessToast').replace('{code}', issued.voucherCode));
    } catch (err: any) {
      const code = err?.message || 'ERR_INSUFFICIENT_LOYALTY_POINTS';
      setActionError(getTranslation(lang, `errors.ERR.LOYALTY.${code}`, code));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmCancelVoucher = async () => {
    if (!card || !cancelTarget || isProcessing) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      const refundedPts = cancelTarget.pointsSpent;
      const updated = await cancelPublicVoucher(card.loyaltyCardToken, cancelTarget.id);
      setCard(updated);
      setCancelTarget(null);
      showSuccessToast(
        dwTr('cancelSuccessToast').replace('{points}', refundedPts.toLocaleString('en-US'))
      );
    } catch (err: any) {
      const code = err?.message || 'ERR_VOUCHER_INVALID_OR_CLAIMED';
      setActionError(getTranslation(lang, `errors.ERR.LOYALTY.${code}`, code));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddToHome = async () => {
    if (installPromptEvent) {
      try {
        installPromptEvent.prompt();
        await installPromptEvent.userChoice;
        setInstallPromptEvent(null);
        return;
      } catch {}
    }
    setShowAddToHomeHint(prev => !prev);
  };

  const effectiveCardToken = card?.loyaltyCardToken || token;
  const cardUrl =
    typeof window !== 'undefined' && effectiveCardToken
      ? `${window.location.origin}/card/${encodeURIComponent(effectiveCardToken)}`
      : `/card/${encodeURIComponent(effectiveCardToken || '')}`;

  const isIos =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '');

  const getTxMeta = (type: string) => {
    switch (type) {
      case 'Earned':
        return { label: dwTr('typeEarned'), color: 'text-emerald-600 dark:text-emerald-400', icon: <ArrowUpRight size={14} /> };
      case 'Redeemed':
        return { label: dwTr('typeRedeemed'), color: 'text-amber-600 dark:text-amber-400', icon: <ArrowDownRight size={14} /> };
      case 'Refunded':
        return { label: dwTr('typeRefunded'), color: 'text-primary', icon: <RotateCcw size={14} /> };
      case 'ReversedOnReturn':
        return { label: dwTr('typeReversedOnReturn'), color: 'text-destructive', icon: <RotateCcw size={14} /> };
      default:
        return { label: dwTr('typeManualAdjustment'), color: 'text-muted-foreground', icon: <SlidersHorizontal size={14} /> };
    }
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Sticky Minimal Top Utility Bar */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {card?.storeLogo ? (
              <img
                src={card.storeLogo}
                alt={card.storeName}
                className="w-7 h-7 rounded-lg object-cover border border-border bg-white shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Store size={15} />
              </div>
            )}
            <span className="text-xs font-bold text-foreground truncate" dir="auto">
              {card?.storeName || dwTr('modalTitle')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="theme"
            >
              {effectiveTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setLocale(isAr ? 'en' : 'ar')}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Languages size={13} />
              <span>{dwTr('switchLanguageBtn')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Mobile Container */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 space-y-5">
        {actionToast && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{actionToast}</span>
          </div>
        )}

        {actionError && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-destructive bg-transparent border-0 cursor-pointer p-0.5"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-12 rounded-2xl bg-card border border-border text-center text-xs text-muted-foreground">
            {dwTr('loadingCard')}
          </div>
        ) : errorCode || !card ? (
          <div className="p-8 rounded-2xl bg-card border border-border text-center space-y-2.5">
            <AlertTriangle size={28} className="text-destructive mx-auto" />
            <h2 className="m-0 text-base font-bold text-foreground">{dwTr('cardNotFoundTitle')}</h2>
            <p className="m-0 text-xs text-muted-foreground">{dwTr('cardNotFoundDesc')}</p>
          </div>
        ) : (
          <>
            {/* 1. Multi-Store Switcher Bar (ONLY shown when customer has cards at >1 store) */}
            {card.storeCards.length > 1 && (
              <section aria-label={dwTr('switcherTitle')} className="space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground px-0.5">
                  {dwTr('switcherTitle')}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {card.storeCards.map((sc) => {
                    const isCurrent = sc.cardToken === card.loyaltyCardToken;
                    return (
                      <button
                        key={sc.cardToken}
                        type="button"
                        onClick={() => !isCurrent && onNavigateToken(sc.cardToken)}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 shrink-0 cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-card text-foreground border-border hover:bg-muted'
                        }`}
                      >
                        {sc.storeLogo ? (
                          <img
                            src={sc.storeLogo}
                            alt={sc.storeName}
                            className="w-5 h-5 rounded object-cover bg-white shrink-0"
                          />
                        ) : (
                          <Store size={14} className="shrink-0" />
                        )}
                        <span className="truncate max-w-[140px]" dir="auto">
                          {sc.storeName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 2. Digital Membership Card */}
            <section className="rounded-2xl bg-card border border-border shadow-lg overflow-hidden">
              <div className="p-5 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-b border-border flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {card.storeLogo ? (
                      <img
                        src={card.storeLogo}
                        alt={card.storeName}
                        className="w-8 h-8 rounded-lg object-cover border border-border bg-white shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <Store size={16} />
                      </div>
                    )}
                    <span className="text-xs font-semibold text-muted-foreground truncate" dir="auto">
                      {card.storeName}
                    </span>
                  </div>
                  <h1 className="m-0 text-lg font-extrabold text-foreground truncate" dir="auto">
                    {card.customerName}
                  </h1>
                  <span
                    dir="ltr"
                    className="inline-block px-2 py-0.5 rounded bg-card border border-border font-mono text-[11px] font-bold text-primary"
                  >
                    {card.loyaltyMemberCode}
                  </span>
                </div>

                <div className="text-end shrink-0">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    {dwTr('pointsBalanceLabel')}
                  </div>
                  <div
                    dir="ltr"
                    className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums leading-tight"
                  >
                    {Number(card.loyaltyPointsBalance).toLocaleString('en-US')}
                  </div>
                  <div className="text-[11px] font-semibold text-muted-foreground">{ptsUnit}</div>
                </div>
              </div>

              {/* Scannable QR & 1D Barcode inside crisp bg-white */}
              <div className="p-4 flex flex-col items-center gap-3">
                <div className="bg-white p-2.5 rounded-lg border border-border inline-flex items-center gap-3 shadow-xs">
                  <QrCodeSvg value={cardUrl} size={108} />
                  <div className="flex flex-col items-center justify-center border-s border-slate-200 ps-3">
                    <BarcodeSvg
                      value={card.loyaltyMemberCode || 'LOY-10001'}
                      width={132}
                      height={46}
                      color="#000000"
                      showText
                    />
                    <span className="text-[10px] font-semibold text-slate-600 mt-1">
                      {dwTr('scanMemberCodeHint')}
                    </span>
                  </div>
                </div>

                {/* Add to Home Screen Subtle Hint */}
                <button
                  type="button"
                  onClick={handleAddToHome}
                  className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 border border-border text-muted-foreground hover:text-foreground text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Smartphone size={12} />
                  <span>{dwTr('addToHomeBtn')}</span>
                </button>
                {showAddToHomeHint && (
                  <p className="m-0 text-[11px] text-center text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg border border-border">
                    {isIos ? dwTr('addToHomeHintIos') : dwTr('addToHomeHintAndroid')}
                  </p>
                )}
              </div>
            </section>

            {!card.isLoyaltyEnabled && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{dwTr('loyaltyDisabledBanner')}</span>
              </div>
            )}

            {/* 3. Active Pickup Vouchers (PendingPickup) */}
            {card.activeVouchers.length > 0 && (
              <section className="space-y-2.5">
                <div>
                  <h2 className="m-0 text-sm font-bold text-foreground flex items-center gap-2">
                    <Ticket size={16} className="text-primary" />
                    <span>{dwTr('activeVouchersTitle')}</span>
                  </h2>
                  <p className="m-0 text-[11px] text-muted-foreground mt-0.5">
                    {dwTr('activeVouchersSubtitle')}
                  </p>
                </div>

                <div className="space-y-3">
                  {card.activeVouchers.map(v => (
                    <div
                      key={v.id}
                      className="p-4 rounded-2xl bg-card border-2 border-primary/35 shadow-sm space-y-3"
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
                            <div className="text-sm font-bold text-foreground truncate" dir="auto">
                              {v.rewardTitle}
                            </div>
                            <div
                              dir="ltr"
                              className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums text-start"
                            >
                              -{Number(v.pointsSpent).toLocaleString('en-US')} {ptsUnit}
                            </div>
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold shrink-0">
                          {dwTr('voucherReadyBadge')}
                        </span>
                      </div>

                      {/* Scannable RDM- Voucher Box */}
                      <div className="bg-white p-2.5 rounded-lg border border-border flex items-center justify-center gap-3">
                        <QrCodeSvg value={v.voucherCode} size={80} />
                        <div className="flex flex-col items-center">
                          <BarcodeSvg
                            value={v.voucherCode}
                            width={145}
                            height={38}
                            color="#000000"
                            showText
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setCancelTarget(v);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/15 text-destructive text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw size={12} />
                          <span>{dwTr('cancelRefundBtn')}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4A. What You Can Buy Now: Available With Your Points */}
            <section className="space-y-2.5">
              <h2 className="m-0 text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-500" />
                <span>{dwTr('availableSectionTitle')}</span>
              </h2>

              {availableRewards.length === 0 ? (
                <div className="p-4 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground text-center">
                  {dwTr('availableSectionEmpty')}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {availableRewards.map(r => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-2xl bg-card border border-emerald-500/35 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {r.imageUrl ? (
                          <img
                            src={r.imageUrl}
                            alt={r.title}
                            className="w-14 h-14 rounded-xl object-cover border border-border bg-white shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <Gift size={22} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-foreground truncate" dir="auto">
                            {r.title}
                          </div>
                          {r.description && (
                            <div className="text-[11px] text-muted-foreground line-clamp-1" dir="auto">
                              {r.description}
                            </div>
                          )}
                          <div
                            dir="ltr"
                            className="text-xs font-extrabold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5 text-start"
                          >
                            {Number(r.pointsCost).toLocaleString('en-US')} {ptsUnit}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!card.isLoyaltyEnabled}
                        onClick={() => {
                          setActionError(null);
                          setRedeemTarget(r);
                        }}
                        className="px-3.5 py-2 rounded-xl border-0 bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-45 text-xs font-semibold shrink-0 cursor-pointer"
                      >
                        {dwTr('redeemNowBtn')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 4B. Almost Within Reach */}
            {upcomingRewards.length > 0 && (
              <section className="space-y-2.5">
                <h2 className="m-0 text-sm font-bold text-foreground flex items-center gap-2">
                  <Award size={16} className="text-amber-500" />
                  <span>{dwTr('almostSectionTitle')}</span>
                </h2>

                <div className="space-y-2.5">
                  {upcomingRewards.map(r => {
                    const remaining = Math.max(0, r.pointsCost - card.loyaltyPointsBalance);
                    const pct =
                      r.pointsCost > 0
                        ? Math.min(100, Math.round((card.loyaltyPointsBalance / r.pointsCost) * 100))
                        : 0;

                    return (
                      <div
                        key={r.id}
                        className="p-3.5 rounded-2xl bg-card border border-border space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {r.imageUrl ? (
                              <img
                                src={r.imageUrl}
                                alt={r.title}
                                className="w-12 h-12 rounded-xl object-cover border border-border bg-white shrink-0 opacity-90"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                                <Gift size={20} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-foreground truncate" dir="auto">
                                {r.title}
                              </div>
                              <div
                                dir="ltr"
                                className="text-xs font-bold text-muted-foreground tabular-nums text-start"
                              >
                                {Number(r.pointsCost).toLocaleString('en-US')} {ptsUnit}
                              </div>
                            </div>
                          </div>

                          {!r.inStock ? (
                            <span className="px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/25 text-[11px] font-semibold shrink-0">
                              {dwTr('outOfStockBtn')}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-muted text-foreground text-[11px] font-semibold tabular-nums shrink-0">
                              {dwTr('remainingPointsText').replace(
                                '{points}',
                                remaining.toLocaleString('en-US')
                              )}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                            <span>
                              {dwTr('progressText')
                                .replace('{current}', card.loyaltyPointsBalance.toLocaleString('en-US'))
                                .replace('{target}', r.pointsCost.toLocaleString('en-US'))}
                            </span>
                            <span>{pct}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 5. Recent Points Activity */}
            <section className="space-y-2.5">
              <h2 className="m-0 text-sm font-bold text-foreground">{dwTr('recentActivityTitle')}</h2>
              <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
                {card.recentTransactions.length === 0 ? (
                  <div className="p-5 text-center text-xs text-muted-foreground">
                    {dwTr('noActivityText')}
                  </div>
                ) : (
                  card.recentTransactions.map(tx => {
                    const meta = getTxMeta(tx.type);
                    const positive = tx.pointsChange >= 0;
                    return (
                      <div key={tx.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-1.5 rounded-lg bg-muted ${meta.color} shrink-0`}>
                            {meta.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">{meta.label}</div>
                            <div className="text-[10px] text-muted-foreground truncate" dir="auto">
                              {tx.notes || new Date(tx.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div
                          dir="ltr"
                          className={`text-xs font-extrabold tabular-nums shrink-0 ${
                            positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {positive ? `+${tx.pointsChange.toLocaleString('en-US')}` : tx.pointsChange.toLocaleString('en-US')}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Subtle Attribution Footer */}
      <footer className="py-5 text-center border-t border-border/60 mt-4">
        <span className="text-[11px] font-medium text-muted-foreground">{dwTr('poweredBy')}</span>
      </footer>

      {/* Redeem Confirmation Dialog */}
      {redeemTarget && (
        <ModalBackdropPortal onClose={() => !isProcessing && setRedeemTarget(null)} dir={isAr ? 'rtl' : 'ltr'}>
          <div
            className="bg-card text-foreground border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 text-sm font-bold text-foreground">{dwTr('redeemConfirmTitle')}</h3>
            <p className="m-0 text-xs text-muted-foreground leading-relaxed">
              {dwTr('redeemConfirmDesc')
                .replace('{points}', redeemTarget.pointsCost.toLocaleString('en-US'))
                .replace('{title}', redeemTarget.title)}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setRedeemTarget(null)}
                className="px-3.5 py-2 rounded-xl border border-border bg-muted text-foreground text-xs font-semibold cursor-pointer"
              >
                {dwTr('keepVoucherBtn')}
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmRedeem}
                className="px-4 py-2 rounded-xl border-0 bg-primary text-primary-foreground text-xs font-semibold cursor-pointer"
              >
                {dwTr('redeemConfirmBtn')}
              </button>
            </div>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Cancel & Refund Confirmation Dialog */}
      {cancelTarget && (
        <ModalBackdropPortal onClose={() => !isProcessing && setCancelTarget(null)} dir={isAr ? 'rtl' : 'ltr'}>
          <div
            className="bg-card text-foreground border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 text-sm font-bold text-foreground">{dwTr('cancelConfirmTitle')}</h3>
            <p className="m-0 text-xs text-muted-foreground leading-relaxed">
              {dwTr('cancelConfirmDesc')
                .replace('{title}', cancelTarget.rewardTitle)
                .replace('{points}', cancelTarget.pointsSpent.toLocaleString('en-US'))}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setCancelTarget(null)}
                className="px-3.5 py-2 rounded-xl border border-border bg-muted text-foreground text-xs font-semibold cursor-pointer"
              >
                {dwTr('keepVoucherBtn')}
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmCancelVoucher}
                className="px-4 py-2 rounded-xl border-0 bg-destructive text-destructive-foreground text-xs font-semibold cursor-pointer"
              >
                {dwTr('cancelConfirmBtn')}
              </button>
            </div>
          </div>
        </ModalBackdropPortal>
      )}
    </div>
  );
}
