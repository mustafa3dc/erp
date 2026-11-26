import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Plus,
  RefreshCw,
  PieChart,
  TrendingUp,
  ArrowDownRight,
  Wallet,
  Edit3,
  FileText,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  X,
  Phone,
  DollarSign,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { getTranslation } from '../../lib/i18n';
import { useSettings } from '../../context/settings-context';
import { getStoredActiveShift } from '../../services/storageService';
import {
  PartnerPeriod,
  PartnerTransactionType,
  PartnerItemSummary,
  PartnersSummaryResponse,
  PaginatedPartnerTransactions,
  fetchPartnersSummary,
  createPartner,
  updatePartner,
  recordPartnerTransaction,
  fetchPartnerStatement,
  formatPartnerErrorMessage
} from '../../services/partnersService';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { ModalBackdropPortal } from '../ui/dialog';

interface PartnersViewProps {
  lang: 'en' | 'ar';
}

export default function PartnersView({ lang }: PartnersViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const activeShift = useMemo(() => getStoredActiveShift(), []);

  const [period, setPeriod] = useState<PartnerPeriod>('month');
  const [summary, setSummary] = useState<PartnersSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Add/Edit Partner Modal State
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerItemSummary | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCapital, setFormCapital] = useState('0');
  const [formShare, setFormShare] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSavingPartner, setIsSavingPartner] = useState(false);

  // Record Transaction Modal State
  const [txTargetPartner, setTxTargetPartner] = useState<PartnerItemSummary | null>(null);
  const [txType, setTxType] = useState<PartnerTransactionType>('Withdrawal');
  const [txAmount, setTxAmount] = useState('');
  const [txDeductTreasury, setTxDeductTreasury] = useState(true);
  const [txShiftId, setTxShiftId] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txError, setTxError] = useState('');
  const [isPostingTx, setIsPostingTx] = useState(false);

  // Paginated Statement Modal State
  const [statementPartner, setStatementPartner] = useState<PartnerItemSummary | null>(null);
  const [statementData, setStatementData] = useState<PaginatedPartnerTransactions | null>(null);
  const [statementPage, setStatementPage] = useState(1);
  const [isLoadingStatement, setIsLoadingStatement] = useState(false);

  const loadSummary = useCallback(async (selectedPeriod: PartnerPeriod) => {
    setIsLoading(true);
    try {
      const data = await fetchPartnersSummary(selectedPeriod);
      setSummary(data);
    } catch (err: any) {
      toast.error(formatPartnerErrorMessage(err, lang));
    } finally {
      setIsLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadSummary(period);
  }, [period, loadSummary]);

  const loadStatement = useCallback(async (partner: PartnerItemSummary, page: number) => {
    setIsLoadingStatement(true);
    try {
      const data = await fetchPartnerStatement(partner.id, page, 10);
      setStatementData(data);
      setStatementPage(data.page);
    } catch (err: any) {
      toast.error(formatPartnerErrorMessage(err, lang));
    } finally {
      setIsLoadingStatement(false);
    }
  }, [lang]);

  const maxAvailableShareForForm = useMemo(() => {
    if (!summary) return 100;
    const allocatedOthers = editingPartner && editingPartner.isActive
      ? Math.max(0, summary.allocatedSharePercent - editingPartner.profitSharePercent)
      : summary.allocatedSharePercent;
    return Math.max(0, Math.round((100 - allocatedOthers) * 100) / 100);
  }, [summary, editingPartner]);

  const openAddModal = () => {
    setEditingPartner(null);
    setFormName('');
    setFormPhone('');
    setFormCapital('0');
    setFormShare(summary ? String(Math.min(50, summary.unallocatedSharePercent || 0)) : '50');
    setFormIsActive(true);
    setFormNotes('');
    setFormError('');
    setIsPartnerModalOpen(true);
  };

  const openEditModal = (partner: PartnerItemSummary) => {
    setEditingPartner(partner);
    setFormName(partner.name);
    setFormPhone(partner.phone || '');
    setFormCapital(String(partner.capitalAmount));
    setFormShare(String(partner.profitSharePercent));
    setFormIsActive(partner.isActive);
    setFormNotes(partner.notes || '');
    setFormError('');
    setIsPartnerModalOpen(true);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const share = Number(formShare);
    const capital = Number(formCapital) || 0;

    if (!formName.trim()) {
      setFormError(getTranslation(lang, 'errors.ERR.PARTNERS.ERR_PARTNER_NAME_REQUIRED'));
      return;
    }
    if (!Number.isFinite(share) || share <= 0 || share > 100) {
      setFormError(getTranslation(lang, 'errors.ERR.PARTNERS.ERR_INVALID_PARTNER_SHARE'));
      return;
    }
    if (capital < 0) {
      setFormError(getTranslation(lang, 'errors.ERR.PARTNERS.ERR_INVALID_CAPITAL_AMOUNT'));
      return;
    }
    if (formIsActive && share > maxAvailableShareForForm) {
      setFormError(
        getTranslation(lang, 'errors.ERR.PARTNERS.ERR_PARTNER_SHARE_EXCEEDS_100').replace(
          '{remaining}',
          String(maxAvailableShareForForm)
        )
      );
      return;
    }

    setIsSavingPartner(true);
    try {
      if (editingPartner) {
        await updatePartner(editingPartner.id, {
          name: formName.trim(),
          phone: formPhone.trim() || null,
          capitalAmount: capital,
          profitSharePercent: share,
          isActive: formIsActive,
          notes: formNotes.trim() || null
        });
        toast.success(getTranslation(lang, 'ui.partners.partnerUpdatedToast'));
      } else {
        await createPartner({
          name: formName.trim(),
          phone: formPhone.trim() || null,
          capitalAmount: capital,
          profitSharePercent: share,
          isActive: formIsActive,
          notes: formNotes.trim() || null
        });
        toast.success(getTranslation(lang, 'ui.partners.partnerSavedToast'));
      }
      setIsPartnerModalOpen(false);
      await loadSummary(period);
    } catch (err: any) {
      setFormError(formatPartnerErrorMessage(err, lang));
    } finally {
      setIsSavingPartner(false);
    }
  };

  const openTransactionModal = (partner: PartnerItemSummary) => {
    setTxTargetPartner(partner);
    setTxType('Withdrawal');
    setTxAmount('');
    setTxDeductTreasury(true);
    setTxShiftId('');
    setTxNotes('');
    setTxError('');
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTargetPartner) return;
    setTxError('');

    const amountNum = Number(txAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setTxError(getTranslation(lang, 'errors.ERR.PARTNERS.ERR_INVALID_TRANSACTION_AMOUNT'));
      return;
    }

    setIsPostingTx(true);
    try {
      await recordPartnerTransaction(txTargetPartner.id, {
        transactionType: txType,
        amount: amountNum,
        deductFromTreasury: txDeductTreasury,
        shiftId: txShiftId || null,
        notes: txNotes.trim() || null
      });
      toast.success(getTranslation(lang, 'ui.partners.txSuccessToast'));
      setTxTargetPartner(null);
      await loadSummary(period);
    } catch (err: any) {
      setTxError(formatPartnerErrorMessage(err, lang));
    } finally {
      setIsPostingTx(false);
    }
  };

  const openStatementModal = (partner: PartnerItemSummary) => {
    setStatementPartner(partner);
    setStatementData(null);
    setStatementPage(1);
    loadStatement(partner, 1);
  };

  const totalEarnedAllocated = useMemo(() => {
    if (!summary) return 0;
    return summary.partners.reduce((s, p) => s + p.earnedProfit, 0);
  }, [summary]);

  const totalWithdrawalsAll = useMemo(() => {
    if (!summary) return 0;
    return summary.partners.reduce((s, p) => s + p.totalWithdrawals, 0);
  }, [summary]);

  const totalRemainingDue = useMemo(() => {
    if (!summary) return 0;
    return summary.partners.reduce((s, p) => s + p.netPayableBalance, 0);
  }, [summary]);

  const activePartnersCount = useMemo(() => {
    if (!summary) return 0;
    return summary.partners.filter(p => p.isActive).length;
  }, [summary]);

  const periodOptions: { id: PartnerPeriod; labelKey: string }[] = [
    { id: 'today', labelKey: 'ui.partners.periodToday' },
    { id: 'week', labelKey: 'ui.partners.periodWeek' },
    { id: 'month', labelKey: 'ui.partners.periodMonth' },
    { id: 'all', labelKey: 'ui.partners.periodAll' }
  ];

  const getTxBadgeTone = (type: string): 'emerald' | 'indigo' | 'amber' => {
    if (type === 'CapitalInjection') return 'emerald';
    if (type === 'ProfitPayout') return 'indigo';
    return 'amber';
  };

  const getTxLabel = (type: string) => {
    if (type === 'CapitalInjection') return getTranslation(lang, 'ui.partners.txTypeCapitalInjection');
    if (type === 'ProfitPayout') return getTranslation(lang, 'ui.partners.txTypeProfitPayout');
    return getTranslation(lang, 'ui.partners.txTypeWithdrawal');
  };

  const allocatedPct = Math.min(100, summary?.allocatedSharePercent ?? 0);
  const unallocatedPct = Math.max(0, summary?.unallocatedSharePercent ?? 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <PieChart size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {getTranslation(lang, 'ui.partners.title')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {getTranslation(lang, 'ui.partners.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period Switcher */}
          <div className="inline-flex items-center bg-muted/60 border border-border rounded-xl p-1">
            {periodOptions.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === opt.id
                    ? 'bg-card text-foreground shadow-sm border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {getTranslation(lang, opt.labelKey)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadSummary(period)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-sm font-medium transition-colors"
            title={getTranslation(lang, 'actions.refresh', isAr ? 'تحديث' : 'Refresh')}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>{getTranslation(lang, 'ui.partners.addPartner')}</span>
          </button>
        </div>
      </div>

      {/* Share Allocation Bar Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {getTranslation(lang, 'ui.partners.allocationTitle')}
            </span>
            {unallocatedPct === 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                <CheckCircle2 size={12} />
                {getTranslation(lang, 'ui.partners.fullyAllocatedBadge')}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {getTranslation(lang, 'ui.partners.allocationWarning').replace('{remaining}', String(unallocatedPct))}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs font-medium tabular-nums" dir="ltr">
            <span className="text-foreground">
              {getTranslation(lang, 'ui.partners.allocatedLabel')}:{' '}
              <strong className="text-primary">{allocatedPct}%</strong>
            </span>
            <span className="text-muted-foreground">
              {getTranslation(lang, 'ui.partners.remainingLabel')}:{' '}
              <strong>{unallocatedPct}%</strong>
            </span>
          </div>
        </div>

        <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex border border-border/50">
          <div
            className={`h-full transition-all duration-500 ${
              allocatedPct === 100
                ? 'bg-emerald-500'
                : 'bg-primary'
            }`}
            style={{ width: `${allocatedPct}%` }}
          />
        </div>
      </div>

      {/* Negative Net Profit Notice */}
      {summary && summary.totalNetProfit < 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{getTranslation(lang, 'ui.partners.lossFlooredNote')}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{getTranslation(lang, 'ui.partners.kpiTotalNetProfit')}</span>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${
              (summary?.totalNetProfit ?? 0) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
            }`}
            dir="ltr"
          >
            {formatMoney(summary?.totalNetProfit ?? 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            {getTranslation(lang, 'ui.partners.revenueSubtitle')}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{getTranslation(lang, 'ui.partners.kpiAllocatedShare')}</span>
            <PieChart size={16} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums" dir="ltr">
            {formatMoney(totalEarnedAllocated)}
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {activePartnersCount} {getTranslation(lang, 'ui.partners.kpiActivePartners')}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{getTranslation(lang, 'ui.partners.kpiTotalWithdrawals')}</span>
            <ArrowDownRight size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums" dir="ltr">
            {formatMoney(totalWithdrawalsAll)}
          </div>
          <p className="text-xs text-muted-foreground">
            {getTranslation(lang, 'ui.partners.txModalSubtitle')}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{getTranslation(lang, 'ui.partners.kpiTotalRemainingDue')}</span>
            <Wallet size={16} className="text-primary" />
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${
              totalRemainingDue >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
            dir="ltr"
          >
            {formatMoney(totalRemainingDue)}
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {getTranslation(lang, 'ui.partners.allocatedLabel')}: {allocatedPct}%
          </p>
        </div>
      </div>

      {/* Partners Table / Cards */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {!isLoading && (!summary || summary.partners.length === 0) ? (
          <div className="p-8">
            <EmptyState
              lang={lang}
              icon={<Users size={22} />}
              title={getTranslation(lang, 'ui.partners.emptyTitle')}
              subtitle={getTranslation(lang, 'ui.partners.emptySubtitle')}
              action={
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm"
                >
                  <Plus size={14} />
                  <span>{getTranslation(lang, 'ui.partners.addPartner')}</span>
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground text-xs">
                  <th className="py-3.5 px-4 text-start font-semibold">
                    {getTranslation(lang, 'ui.partners.colPartner')}
                  </th>
                  <th className="py-3.5 px-4 text-center font-semibold">
                    {getTranslation(lang, 'ui.partners.colSharePercent')}
                  </th>
                  <th className="py-3.5 px-4 text-end font-semibold">
                    {getTranslation(lang, 'ui.partners.colCapital')}
                  </th>
                  <th className="py-3.5 px-4 text-end font-semibold">
                    {getTranslation(lang, 'ui.partners.colEarnedProfit')}
                  </th>
                  <th className="py-3.5 px-4 text-end font-semibold">
                    {getTranslation(lang, 'ui.partners.colWithdrawals')}
                  </th>
                  <th className="py-3.5 px-4 text-end font-semibold">
                    {getTranslation(lang, 'ui.partners.colNetPayable')}
                  </th>
                  <th className="py-3.5 px-4 text-center font-semibold">
                    {getTranslation(lang, 'ui.partners.colStatus')}
                  </th>
                  <th className="py-3.5 px-4 text-end font-semibold">
                    {getTranslation(lang, 'ui.partners.colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {(summary?.partners ?? []).map(partner => (
                  <tr key={partner.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground">{partner.name}</div>
                      {partner.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 tabular-nums" dir="ltr">
                          <Phone size={11} />
                          <span>{partner.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary tabular-nums"
                        dir="ltr"
                      >
                        {partner.profitSharePercent}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-end font-medium text-foreground tabular-nums" dir="ltr">
                      {formatMoney(partner.capitalAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-end font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums" dir="ltr">
                      {formatMoney(partner.earnedProfit)}
                    </td>
                    <td className="py-3.5 px-4 text-end font-medium text-amber-600 dark:text-amber-400 tabular-nums" dir="ltr">
                      {formatMoney(partner.totalWithdrawals)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-end font-bold tabular-nums ${
                        partner.netPayableBalance >= 0
                          ? 'text-foreground'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                      dir="ltr"
                    >
                      {formatMoney(partner.netPayableBalance)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge
                        tone={partner.isActive ? 'emerald' : 'slate'}
                        dot
                        label={getTranslation(
                          lang,
                          partner.isActive ? 'ui.partners.statusActive' : 'ui.partners.statusInactive'
                        )}
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openTransactionModal(partner)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                          title={getTranslation(lang, 'ui.partners.recordTransaction')}
                        >
                          <DollarSign size={13} />
                          <span className="hidden xl:inline">
                            {getTranslation(lang, 'ui.partners.recordTransaction')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openStatementModal(partner)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors"
                          title={getTranslation(lang, 'ui.partners.viewStatement')}
                        >
                          <FileText size={13} />
                          <span className="hidden xl:inline">
                            {getTranslation(lang, 'ui.partners.viewStatement')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(partner)}
                          className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title={getTranslation(lang, 'ui.partners.editPartner')}
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Partner Modal */}
      {isPartnerModalOpen && (
        <ModalBackdropPortal
          onClose={() => setIsPartnerModalOpen(false)}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
              <h3 className="text-base font-bold text-foreground">
                {getTranslation(
                  lang,
                  editingPartner ? 'ui.partners.modalEditTitle' : 'ui.partners.modalAddTitle'
                )}
              </h3>
              <button
                type="button"
                onClick={() => setIsPartnerModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.partners.fieldName')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder={getTranslation(lang, 'ui.partners.fieldNamePlaceholder')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.partners.fieldPhone')}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder={getTranslation(lang, 'ui.partners.fieldPhonePlaceholder')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.partners.fieldSharePercent')} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    required
                    dir="ltr"
                    value={formShare}
                    onChange={e => setFormShare(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {getTranslation(lang, 'ui.partners.fieldShareHint').replace(
                      '{remaining}',
                      String(maxAvailableShareForForm)
                    )}
                  </p>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.partners.fieldCapital')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    dir="ltr"
                    value={formCapital}
                    onChange={e => setFormCapital(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.partners.fieldNotes')}
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder={getTranslation(lang, 'ui.partners.fieldNotesPlaceholder')}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2.5 pt-1">
                  <input
                    id="partner-active-checkbox"
                    type="checkbox"
                    checked={formIsActive}
                    onChange={e => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <label htmlFor="partner-active-checkbox" className="text-sm text-foreground cursor-pointer">
                    {getTranslation(lang, 'ui.partners.fieldIsActive')}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsPartnerModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors"
                >
                  {getTranslation(lang, 'ui.partners.cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingPartner}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
                >
                  {isSavingPartner
                    ? getTranslation(lang, 'ui.partners.savingBtn')
                    : getTranslation(lang, 'ui.partners.saveBtn')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Record Financial Transaction Modal */}
      {txTargetPartner && (
        <ModalBackdropPortal
          onClose={() => setTxTargetPartner(null)}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {getTranslation(lang, 'ui.partners.txModalTitle')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {txTargetPartner.name} ({txTargetPartner.profitSharePercent}%)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTxTargetPartner(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitTransaction} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground">
                {getTranslation(lang, 'ui.partners.txModalSubtitle')}
              </div>

              {txError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{txError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'ui.partners.txTypeLabel')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Withdrawal', 'ProfitPayout', 'CapitalInjection'] as PartnerTransactionType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTxType(t)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all text-center ${
                        txType === t
                          ? 'bg-primary/15 border-primary text-primary shadow-sm'
                          : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {getTxLabel(t)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'ui.partners.txAmountLabel')} *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  dir="ltr"
                  value={txAmount}
                  onChange={e => setTxAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {activeShift && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.partners.txLinkShiftLabel')}
                  </label>
                  <select
                    value={txShiftId}
                    onChange={e => setTxShiftId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">{getTranslation(lang, 'ui.partners.txNoShiftOption')}</option>
                    <option value={activeShift.id}>
                      {getTranslation(lang, 'ui.partners.txActiveShiftOption').replace(
                        '{shift}',
                        activeShift.terminalId ? `${activeShift.id} (${activeShift.terminalId})` : activeShift.id
                      )}
                    </option>
                  </select>
                </div>
              )}

              <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-start gap-2.5">
                <input
                  id="tx-treasury-checkbox"
                  type="checkbox"
                  checked={txDeductTreasury}
                  onChange={e => setTxDeductTreasury(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-border accent-primary"
                />
                <label htmlFor="tx-treasury-checkbox" className="cursor-pointer space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.partners.txDeductTreasuryLabel')}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {getTranslation(lang, 'ui.partners.txDeductTreasuryHint')}
                  </div>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'ui.partners.fieldNotes')}
                </label>
                <textarea
                  rows={2}
                  value={txNotes}
                  onChange={e => setTxNotes(e.target.value)}
                  placeholder={getTranslation(lang, 'ui.partners.fieldNotesPlaceholder')}
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setTxTargetPartner(null)}
                  className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors"
                >
                  {getTranslation(lang, 'ui.partners.cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isPostingTx}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
                >
                  <ArrowUpRight size={15} />
                  <span>
                    {isPostingTx
                      ? getTranslation(lang, 'ui.partners.txSubmittingBtn')
                      : getTranslation(lang, 'ui.partners.txSubmitBtn')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Partner Ledger Statement Modal */}
      {statementPartner && (
        <ModalBackdropPortal
          onClose={() => setStatementPartner(null)}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {getTranslation(lang, 'ui.partners.statementTitle')} — {statementPartner.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getTranslation(lang, 'ui.partners.statementSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatementPartner(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {isLoadingStatement ? (
                <div className="py-12 text-center text-sm text-muted-foreground">...</div>
              ) : !statementData || statementData.items.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {getTranslation(lang, 'ui.partners.statementEmpty')}
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground">
                        <th className="py-2.5 px-3 text-start font-semibold">
                          {getTranslation(lang, 'ui.partners.statementDate')}
                        </th>
                        <th className="py-2.5 px-3 text-start font-semibold">
                          {getTranslation(lang, 'ui.partners.statementType')}
                        </th>
                        <th className="py-2.5 px-3 text-end font-semibold">
                          {getTranslation(lang, 'ui.partners.statementAmount')}
                        </th>
                        <th className="py-2.5 px-3 text-start font-semibold">
                          {getTranslation(lang, 'ui.partners.statementNotes')}
                        </th>
                        <th className="py-2.5 px-3 text-start font-semibold">
                          {getTranslation(lang, 'ui.partners.statementUser')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {statementData.items.map(tx => (
                        <tr key={tx.id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 text-xs text-muted-foreground tabular-nums" dir="ltr">
                            {new Date(tx.createdAt).toLocaleString(isAr ? 'ar-IQ' : 'en-US')}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge
                              tone={getTxBadgeTone(tx.transactionType)}
                              label={getTxLabel(tx.transactionType)}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-end font-bold text-foreground tabular-nums" dir="ltr">
                            {formatMoney(tx.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {tx.notes || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-foreground">
                            {tx.createdBy || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground tabular-nums">
                  {statementData
                    ? getTranslation(lang, 'ui.partners.pageIndicator')
                        .replace('{page}', String(statementData.page))
                        .replace('{total}', String(statementData.totalPages))
                    : ''}
                </div>

                <div className="flex items-center gap-2">
                  {statementData && statementData.totalPages > 1 && (
                    <>
                      <button
                        type="button"
                        disabled={statementPage <= 1 || isLoadingStatement}
                        onClick={() => loadStatement(statementPartner, statementPage - 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium disabled:opacity-50"
                      >
                        {isAr ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        <span>{getTranslation(lang, 'ui.partners.prevPage')}</span>
                      </button>
                      <button
                        type="button"
                        disabled={statementPage >= statementData.totalPages || isLoadingStatement}
                        onClick={() => loadStatement(statementPartner, statementPage + 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium disabled:opacity-50"
                      >
                        <span>{getTranslation(lang, 'ui.partners.nextPage')}</span>
                        {isAr ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setStatementPartner(null)}
                    className="px-4 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground"
                  >
                    {getTranslation(lang, 'ui.partners.closeBtn')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalBackdropPortal>
      )}
    </div>
  );
}
