import React, { useState, useMemo, useEffect } from 'react';
import { Unlock, X, AlertTriangle, User, Clock, CheckCircle2, Monitor, RotateCcw } from 'lucide-react';
import { UserProfile } from '../../types/rbac';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { useSettings } from '../../context/settings-context';
import { formatShiftDateTime } from '../../utils/dateFormatter';
import { getTranslation } from '../../lib/i18n';
import { getTenantAuthHeaders } from '../../lib/api-client';
import {
  getAvailablePosTerminals,
  getStoredLastPosTerminal,
  saveStoredLastPosTerminal
} from '../../services/storageService';

export interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (shiftData: {
    id?: string;
    cashierName: string;
    terminalId: string;
    openingFloat: number;
    openedAt?: string;
    formattedStartTime?: string;
  }) => void;
  currentUser?: UserProfile | null;
  lang?: 'en' | 'ar';
}

interface ConfirmedShiftSummary {
  id: string;
  cashierName: string;
  terminalId: string;
  openingFloat: number;
  openedAt: string;
  formattedStartTime: string;
}

const CUSTOM_TERMINAL_SENTINEL = '__CUSTOM_TERMINAL__';
const QUICK_ADD_DENOMINATIONS = [25000, 50000, 100000];

function normalizeNumericDigits(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function formatNumberWithCommas(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

function formatRawInputDisplay(clean: string): string {
  if (!clean || clean === '-') return clean;
  const isNegative = clean.startsWith('-');
  const unsigned = isNegative ? clean.slice(1) : clean;
  const [intPart, decPart] = unsigned.split('.');
  const formattedInt = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const signedInt = `${isNegative ? '-' : ''}${formattedInt}`;
  return decPart !== undefined ? `${signedInt}.${decPart}` : signedInt;
}

export default function OpenShiftModal({
  isOpen,
  onClose,
  onConfirm,
  currentUser,
  lang = 'ar'
}: OpenShiftModalProps) {
  const isAr = lang === 'ar';
  const tr = (key: string) => getTranslation(lang, `ui.openShiftModal.${key}`);
  const { financialSettings } = useSettings();
  const baseCurrency = financialSettings.baseCurrency;
  const isIqd = baseCurrency.code === 'IQD' || baseCurrency.symbol === 'د.ع';

  const hasShiftPermission = currentUser
    ? currentUser.role === 'SuperAdmin' ||
      currentUser.role === 'BranchManager' ||
      currentUser.role === 'Cashier' ||
      (currentUser.permissions && currentUser.permissions.includes('shifts.manage')) ||
      (currentUser.permissions && currentUser.permissions.includes('pos.terminal.access'))
    : true;

  // Strictly bind cashier identity in the active language - Zero language mixing
  const effectiveCashierName = useMemo(() => {
    if (isAr) {
      const raw = currentUser?.fullName?.trim() || '';
      const userRaw = currentUser?.username?.trim() || '';

      if (raw && raw !== 'a' && !raw.includes('@') && raw.toLowerCase() !== 'admin') {
        return raw;
      }
      if (userRaw && userRaw !== 'a' && !userRaw.includes('@') && userRaw.toLowerCase() !== 'admin') {
        return userRaw;
      }
      if (currentUser?.roleNameAr && currentUser.roleNameAr.trim()) {
        return currentUser.roleNameAr;
      }
      return getTranslation(lang, 'ui.openShiftModal.defaultCashierName');
    } else {
      if (currentUser?.roleNameEn && currentUser.roleNameEn.trim()) {
        return currentUser.roleNameEn;
      }
      if (currentUser?.role && currentUser.role !== 'SuperAdmin') {
        return currentUser.role;
      }
      const raw = currentUser?.fullName?.trim() || '';
      if (raw && !/[\u0600-\u06FF]/.test(raw) && raw !== 'a' && !raw.includes('@') && raw.toLowerCase() !== 'admin') {
        return raw;
      }
      return getTranslation(lang, 'ui.openShiftModal.defaultCashierName');
    }
  }, [currentUser, isAr, lang]);

  // Strictly bind branch name in the active language - Zero language mixing
  const effectiveBranchName = useMemo(() => {
    if (isAr) {
      return currentUser?.branchName || getTranslation(lang, 'ui.openShiftModal.allBranchesName');
    }
    if (!currentUser?.branchId || currentUser.branchId === 'ALL') {
      return getTranslation(lang, 'ui.openShiftModal.allBranchesName');
    }
    if (currentUser.branchId === 'WH-01') {
      return getTranslation(lang, 'ui.openShiftModal.mainBranchWarehouseName');
    }
    return (currentUser as any)?.branchNameEn || getTranslation(lang, 'ui.openShiftModal.mainBranchName');
  }, [currentUser, isAr, lang]);

  const presetTerminals = useMemo(
    () => [
      getTranslation(lang, 'ui.openShiftModal.defaultTerminal1'),
      getTranslation(lang, 'ui.openShiftModal.defaultTerminal2'),
      getTranslation(lang, 'ui.openShiftModal.defaultTerminal3')
    ],
    [lang]
  );

  const [terminalOptions, setTerminalOptions] = useState<string[]>(() =>
    getAvailablePosTerminals(presetTerminals)
  );
  const [terminalId, setTerminalId] = useState<string>(() =>
    getStoredLastPosTerminal(presetTerminals[0])
  );
  const [isCustomTerminal, setIsCustomTerminal] = useState(false);

  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [openingFloatDisplay, setOpeningFloatDisplay] = useState<string>('');
  const [denominationError, setDenominationError] = useState<string | null>(null);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedShift, setConfirmedShift] = useState<ConfirmedShiftSummary | null>(null);
  const [liveTimestamp, setLiveTimestamp] = useState<string>(() => formatShiftDateTime(new Date(), isAr));

  // Initialize fresh modal state each time modal opens
  useEffect(() => {
    if (!isOpen) return;

    const options = getAvailablePosTerminals(presetTerminals);
    const remembered = getStoredLastPosTerminal(presetTerminals[0]);

    setTerminalOptions(options);
    setTerminalId(remembered);
    setIsCustomTerminal(!options.includes(remembered));
    setOpeningFloat(0);
    setOpeningFloatDisplay('');
    setDenominationError(null);
    setTerminalError(null);
    setIsSubmitting(false);
    setConfirmedShift(null);
    setLiveTimestamp(formatShiftDateTime(new Date(), isAr));
  }, [isOpen, isAr, presetTerminals]);

  // Live clock tick while form is active
  useEffect(() => {
    if (!isOpen || confirmedShift) return;
    const interval = setInterval(() => {
      setLiveTimestamp(formatShiftDateTime(new Date(), isAr));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isAr, confirmedShift]);

  if (!isOpen) return null;

  const validateOpeningAmount = (amount: number): string | null => {
    if (!Number.isFinite(amount) || amount < 0) {
      return tr('errNegativeAmount');
    }
    if (isIqd && Math.round(amount * 100) % 25000 !== 0) {
      return tr('errInvalidDenomination');
    }
    return null;
  };

  const handleCashInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeNumericDigits(e.target.value).replace(/[,\s]/g, '');

    if (normalized === '') {
      setOpeningFloat(0);
      setOpeningFloatDisplay('');
      if (denominationError) setDenominationError(null);
      return;
    }

    const allowDecimals = !isIqd && baseCurrency.decimals > 0;
    const pattern = allowDecimals ? /^-?\d*(\.\d*)?$/ : /^-?\d*$/;
    if (!pattern.test(normalized)) {
      return;
    }

    setOpeningFloatDisplay(formatRawInputDisplay(normalized));

    if (normalized === '-' || normalized === '.' || normalized === '-.') {
      setOpeningFloat(normalized.startsWith('-') ? -1 : 0);
      return;
    }

    const numericVal = Number(normalized);
    if (Number.isFinite(numericVal)) {
      setOpeningFloat(numericVal);
      if (denominationError && validateOpeningAmount(numericVal) === null) {
        setDenominationError(null);
      }
    }
  };

  const handleCashInputBlur = () => {
    if (openingFloatDisplay === '-' || openingFloatDisplay === '.' || openingFloatDisplay === '-.') {
      setOpeningFloat(0);
      setOpeningFloatDisplay('');
      setDenominationError(null);
      return;
    }
    const err = validateOpeningAmount(openingFloat);
    setDenominationError(err);
    if (openingFloat === 0 && openingFloatDisplay === '') {
      return;
    }
    setOpeningFloatDisplay(formatNumberWithCommas(openingFloat, isIqd ? 0 : baseCurrency.decimals));
  };

  const handleQuickAdd = (delta: number) => {
    const base = openingFloat > 0 ? openingFloat : 0;
    const nextAmount = base + delta;
    setOpeningFloat(nextAmount);
    setOpeningFloatDisplay(formatNumberWithCommas(nextAmount, isIqd ? 0 : baseCurrency.decimals));
    setDenominationError(validateOpeningAmount(nextAmount));
  };

  const handleResetZero = () => {
    setOpeningFloat(0);
    setOpeningFloatDisplay('0');
    setDenominationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasShiftPermission || isSubmitting) return;

    const resolvedTerminal = terminalId.trim();
    if (!resolvedTerminal) {
      setTerminalError(tr('errTerminalRequired'));
      return;
    }
    setTerminalError(null);

    const amountError = validateOpeningAmount(openingFloat);
    if (amountError) {
      setDenominationError(amountError);
      return;
    }
    setDenominationError(null);
    setIsSubmitting(true);

    const now = new Date();
    const openedAtIso = now.toISOString();
    const localFormattedTime = formatShiftDateTime(now, isAr);
    let resolvedShiftId = `SH-${Date.now().toString().slice(-4)}`;
    let resolvedStartTime = localFormattedTime;
    let resolvedOpenedAt = openedAtIso;

    try {
      const headers = getTenantAuthHeaders();

      const response = await fetch('/api/pos/shifts/open', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cashierName: effectiveCashierName,
          terminalId: resolvedTerminal,
          openingFloat,
          currencyCode: baseCurrency.code,
          openedAt: openedAtIso
        })
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.id) resolvedShiftId = data.id;
        if (data?.openedAt) resolvedOpenedAt = data.openedAt;
        if (data?.openedAt) {
          resolvedStartTime = formatShiftDateTime(new Date(data.openedAt), isAr);
        }
      } else if (response.status === 400 || response.status === 422) {
        const errBody = await response.json().catch(() => null);
        if (errBody?.errorCode === 'ERR_INVALID_CURRENCY_DENOMINATION') {
          setDenominationError(tr('errInvalidDenomination'));
        } else {
          setDenominationError(errBody?.message || tr('errInvalidDenomination'));
        }
        setIsSubmitting(false);
        return;
      }
      // Other non-validation statuses (e.g. 502/503/401 in local-only mode) fall back gracefully below
    } catch {
      // Offline-first fallback: proceed locally with generated shift ID
    }

    // Persist last used terminal per browser to prevent typos in future shifts
    saveStoredLastPosTerminal(resolvedTerminal);

    const summary: ConfirmedShiftSummary = {
      id: resolvedShiftId,
      cashierName: effectiveCashierName,
      terminalId: resolvedTerminal,
      openingFloat,
      openedAt: resolvedOpenedAt,
      formattedStartTime: resolvedStartTime
    };

    // Immediately update underlying POS / Shifts state without closing or redirecting
    onConfirm(summary);
    setConfirmedShift(summary);
    setIsSubmitting(false);
  };

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent
        dir={isAr ? 'rtl' : 'ltr'}
        className="bg-card text-foreground border border-border rounded-2xl shadow-2xl"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border pb-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${
                confirmedShift
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-muted text-primary border-border'
              }`}
            >
              {confirmedShift ? <CheckCircle2 size={18} /> : <Unlock size={18} />}
            </div>
            <div>
              <h3 className="m-0 text-base font-bold text-foreground">
                {confirmedShift ? tr('successTitle') : tr('title')}
              </h3>
              <p className="mt-0.5 mb-0 text-xs text-muted-foreground">
                {confirmedShift ? tr('successSubtitle') : tr('subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('closeAria')}
            className="bg-transparent border-0 text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-md cursor-pointer flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONFIRMED / SHIFT ACTIVE STATE */}
        {confirmedShift ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Unlock size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{confirmedShift.cashierName}</div>
                  <div className="text-xs text-muted-foreground">{effectiveBranchName}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {tr('statusActiveBadge')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-muted/50 border border-border">
                <div className="text-[11px] font-medium text-muted-foreground mb-1">
                  {tr('shiftNumberLabel')}
                </div>
                <div
                  dir="ltr"
                  className="text-sm font-bold font-mono tabular-nums text-primary text-start"
                >
                  {confirmedShift.id}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/50 border border-border">
                <div className="text-[11px] font-medium text-muted-foreground mb-1">
                  {tr('registerLabel')}
                </div>
                <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Monitor size={14} className="text-muted-foreground shrink-0" />
                  <bdi>{confirmedShift.terminalId}</bdi>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/50 border border-border">
                <div className="text-[11px] font-medium text-muted-foreground mb-1">
                  {tr('startTimestampLabel')}
                </div>
                <div
                  dir="ltr"
                  className="text-xs font-bold font-mono tabular-nums text-foreground text-start"
                >
                  {confirmedShift.formattedStartTime}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/50 border border-border">
                <div className="text-[11px] font-medium text-muted-foreground mb-1">
                  {tr('confirmedFloatLabel')}
                </div>
                <div
                  dir="ltr"
                  className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400 text-start"
                >
                  {formatNumberWithCommas(
                    confirmedShift.openingFloat,
                    isIqd ? 0 : baseCurrency.decimals
                  )}{' '}
                  {baseCurrency.symbol}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-border">
              <button
                type="button"
                id="continue-after-open-shift-btn"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-95 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-opacity shadow-sm"
              >
                <CheckCircle2 size={16} />
                <span>{tr('continueBtn')}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Logged in Employee Status Card */}
            <div className="p-3 rounded-xl bg-muted/50 border border-border flex flex-col gap-2 mb-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {tr('loggedInEmployee')}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {tr('onlineNow')}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  <User size={15} />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{effectiveCashierName}</div>
                  <div className="text-[11px] text-muted-foreground">{effectiveBranchName}</div>
                </div>
              </div>

              {!hasShiftPermission && (
                <div className="mt-0.5 text-[11px] text-destructive font-medium flex items-center gap-1.5">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>{tr('noPermissionAlert')}</span>
                </div>
              )}
            </div>

            {/* Live Date & Time Stamp Card */}
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2 min-w-0">
                <Clock size={16} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-foreground block">
                    {tr('officialTimestampLabel')}
                  </span>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {tr('officialTimestampHint')}
                  </span>
                </div>
              </div>
              <span
                dir="ltr"
                className="text-xs font-bold font-mono tabular-nums text-primary px-2.5 py-1 rounded-md bg-card border border-border whitespace-nowrap shrink-0"
              >
                {liveTimestamp}
              </span>
            </div>

            {/* Shift Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 m-0">
              {/* Field 1: Terminal ID (Persisted Selection + Custom Fallback) */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  {tr('terminalLabel')}
                </label>

                {!isCustomTerminal ? (
                  <select
                    value={terminalId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTerminalError(null);
                      if (val === CUSTOM_TERMINAL_SENTINEL) {
                        setIsCustomTerminal(true);
                        setTerminalId('');
                      } else {
                        setTerminalId(val);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {terminalOptions.map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                    <option value={CUSTOM_TERMINAL_SENTINEL}>
                      {tr('customTerminalOption')}
                    </option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={terminalId}
                      onChange={(e) => {
                        setTerminalId(e.target.value);
                        if (terminalError) setTerminalError(null);
                      }}
                      placeholder={tr('terminalPlaceholder')}
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomTerminal(false);
                        setTerminalId(terminalOptions[0] || presetTerminals[0]);
                        setTerminalError(null);
                      }}
                      className="px-2.5 py-2 rounded-lg border border-border bg-muted text-muted-foreground hover:text-foreground text-xs font-medium whitespace-nowrap cursor-pointer"
                    >
                      {tr('usePresetTerminalBtn')}
                    </button>
                  </div>
                )}

                {terminalError ? (
                  <p className="mt-1.5 mb-0 text-[11px] font-medium text-destructive flex items-center gap-1">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span>{terminalError}</span>
                  </p>
                ) : (
                  <p className="mt-1 mb-0 text-[11px] text-muted-foreground">
                    {tr('terminalSelectHint')}
                  </p>
                )}
              </div>

              {/* Field 2: Opening Cash Float */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  {tr('openingCashLabel')}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    inputMode={isIqd || baseCurrency.decimals === 0 ? 'numeric' : 'decimal'}
                    dir="ltr"
                    placeholder="0"
                    value={openingFloatDisplay}
                    onChange={handleCashInputChange}
                    onBlur={handleCashInputBlur}
                    onFocus={(e) => e.target.select()}
                    aria-invalid={Boolean(denominationError)}
                    className={`w-full py-2.5 rounded-lg border bg-background text-foreground text-base font-bold tabular-nums focus:outline-none focus:ring-2 ${
                      denominationError
                        ? 'border-destructive focus:ring-destructive/40'
                        : 'border-border focus:ring-primary/40'
                    } ${isAr ? 'ps-16 pe-3 text-right' : 'ps-3 pe-16 text-left'}`}
                  />
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border pointer-events-none select-none ${
                      isAr ? 'left-2.5' : 'right-2.5'
                    }`}
                  >
                    {baseCurrency.symbol}
                  </span>
                </div>

                {/* Quick-add denomination chips + 0 reset */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {QUICK_ADD_DENOMINATIONS.map((chipAmount) => (
                    <button
                      key={chipAmount}
                      type="button"
                      onClick={() => handleQuickAdd(chipAmount)}
                      dir="ltr"
                      className="px-2.5 py-1 rounded-md border border-border bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold tabular-nums cursor-pointer transition-colors"
                    >
                      + {formatNumberWithCommas(chipAmount)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleResetZero}
                    className="px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors tabular-nums"
                  >
                    <RotateCcw size={11} />
                    <span>{tr('resetZeroLabel')}</span>
                  </button>
                </div>

                {denominationError ? (
                  <div
                    role="alert"
                    className="mt-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-start gap-2"
                  >
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{denominationError}</span>
                  </div>
                ) : (
                  <span className="block text-[11px] text-muted-foreground mt-1.5">
                    {isIqd ? tr('openingCashHintIqd') : tr('openingCashHintGeneral')}
                  </span>
                )}
              </div>

              {/* Action Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 mt-1 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-border bg-muted text-foreground hover:bg-muted/80 text-sm font-medium cursor-pointer transition-colors"
                >
                  {tr('cancelBtn')}
                </button>
                <button
                  type="submit"
                  id="submit-open-shift-btn"
                  disabled={!hasShiftPermission || isSubmitting}
                  className="px-5 py-2 rounded-lg border-0 bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-opacity shadow-sm"
                >
                  <Unlock size={16} />
                  <span>{isSubmitting ? tr('openingLoadingBtn') : tr('confirmOpenBtn')}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </DialogPortal>
  );
}
