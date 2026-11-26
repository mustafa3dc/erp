import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarClock,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  BellRing,
  Zap,
  Power,
  X,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ExpenseCategory,
  RecurringExpenseRule,
  RecurringFrequency,
  RecurringExecutionMode
} from '../types/businessModules';
import { getTranslation, MESSAGES } from '../lib/i18n';
import { useSettings } from '../context/settings-context';
import {
  fetchRecurringExpenses,
  createRecurringExpense,
  updateRecurringExpense,
  toggleRecurringExpense,
  deleteRecurringExpense,
  formatRecurringScheduleLabel,
  formatRecurringErrorMessage,
  computeProjectedMonthlyAmount,
  computeSuggestedSplitAmount
} from '../services/recurringExpensesService';
import { StatusBadge } from './ui/StatusBadge';
import { EmptyState } from './ui/EmptyState';
import { ModalBackdropPortal } from './ui/dialog';
import ConfirmRecurringExpenseModal from './ConfirmRecurringExpenseModal';
import InlineCategorySelector from './InlineCategorySelector';

interface RecurringExpensesTabProps {
  lang: 'en' | 'ar';
  categories: ExpenseCategory[];
  onExpensesUpdated?: () => void;
  onCategoriesChange?: (nextCategories: ExpenseCategory[]) => void;
}

export default function RecurringExpensesTab({
  lang,
  categories,
  onExpensesUpdated,
  onCategoriesChange
}: RecurringExpensesTabProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const [rules, setRules] = useState<RecurringExpenseRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringExpenseRule | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('Monthly');
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [dayOfWeek, setDayOfWeek] = useState<number>(4);
  const [intervalDays, setIntervalDays] = useState<number>(15);
  const [executionMode, setExecutionMode] = useState<RecurringExecutionMode>('RemindAndConfirm');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Confirm Payment Modal state
  const [confirmTarget, setConfirmTarget] = useState<RecurringExpenseRule | null>(null);

  const loadRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await fetchRecurringExpenses();
      setRules(items);
    } catch (err: any) {
      toast.error(formatRecurringErrorMessage(err, lang));
    } finally {
      setIsLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadRules();
    const handler = () => loadRules();
    if (typeof window !== 'undefined') {
      window.addEventListener('erp_recurring_expenses_updated', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('erp_recurring_expenses_updated', handler);
      }
    };
  }, [loadRules]);

  const dueRules = useMemo(() => {
    return rules.filter(r => r.isActive && r.isDue);
  }, [rules]);

  const openAddModal = () => {
    setEditingRule(null);
    setTitle('');
    setCategory('');
    setAmount('');
    setFrequency('Monthly');
    setDayOfMonth(1);
    setDayOfWeek(4);
    setIntervalDays(15);
    setExecutionMode('RemindAndConfirm');
    setIsActive(true);
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (rule: RecurringExpenseRule) => {
    setEditingRule(rule);
    setTitle(rule.title);
    setCategory(rule.category);
    setAmount(String(rule.amount));
    setFrequency((rule.frequency as RecurringFrequency) || 'Monthly');
    setDayOfMonth(rule.dayOfMonth ?? 1);
    setDayOfWeek(rule.dayOfWeek ?? 4);
    setIntervalDays(rule.intervalDays ?? 15);
    setExecutionMode((rule.executionMode as RecurringExecutionMode) || 'RemindAndConfirm');
    setIsActive(rule.isActive);
    setNotes(rule.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const applyPreset = (preset: 'MONTH_START' | 'MID_MONTH' | 'WEEKLY' | 'CUSTOM' | 'YEARLY') => {
    if (preset === 'MONTH_START') {
      setFrequency('Monthly');
      setDayOfMonth(1);
    } else if (preset === 'MID_MONTH') {
      setFrequency('Monthly');
      setDayOfMonth(15);
    } else if (preset === 'WEEKLY') {
      setFrequency('Weekly');
    } else if (preset === 'CUSTOM') {
      setFrequency('CustomDays');
      if (!intervalDays || intervalDays < 1) setIntervalDays(15);
    } else {
      setFrequency('Yearly');
      setDayOfMonth(1);
    }
  };

  const weekdayOptions = useMemo(() => {
    const normLocale = lang === 'ar' ? 'ar' : 'en';
    const arr = MESSAGES[normLocale]?.ui?.recurringExpenses?.weekdays as string[] | undefined;
    return arr || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  }, [lang]);

  const selectedCategoryCap = useMemo(() => {
    if (!category.trim()) return 0;
    const norm = category.trim().toLowerCase();
    const matched = categories.find(
      c =>
        c.name.trim().toLowerCase() === norm ||
        (c.nameAr && c.nameAr.trim().toLowerCase() === norm) ||
        c.code.trim().toLowerCase() === norm
    );
    return Number(matched?.monthlyBudgetCap ?? matched?.budgetLimit ?? 0) || 0;
  }, [category, categories]);

  const liveProjectedMonthly = useMemo(() => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return 0;
    return computeProjectedMonthlyAmount(amt, frequency, intervalDays);
  }, [amount, frequency, intervalDays]);

  const suggestedSplitAmount = useMemo(() => {
    if (selectedCategoryCap <= 0) return 0;
    return computeSuggestedSplitAmount(selectedCategoryCap, frequency, intervalDays);
  }, [selectedCategoryCap, frequency, intervalDays]);

  const isFormOverBudget = selectedCategoryCap > 0 && liveProjectedMonthly > selectedCategoryCap;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsedAmount = Number(amount);
    if (!title.trim()) {
      setFormError(getTranslation(lang, 'errors.ERR.RECURRING.ERR_RECURRING_TITLE_REQUIRED'));
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError(getTranslation(lang, 'errors.ERR.RECURRING.ERR_INVALID_RECURRING_AMOUNT'));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        category: category.trim(),
        amount: parsedAmount,
        frequency,
        dayOfMonth: frequency === 'Monthly' || frequency === 'Yearly' ? dayOfMonth : null,
        dayOfWeek: frequency === 'Weekly' ? dayOfWeek : null,
        intervalDays: frequency === 'CustomDays' ? intervalDays : null,
        executionMode,
        isActive,
        notes: notes.trim() || null
      };

      if (editingRule) {
        await updateRecurringExpense(editingRule.id, payload);
        toast.success(getTranslation(lang, 'ui.recurringExpenses.updatedToast'));
      } else {
        await createRecurringExpense(payload);
        toast.success(getTranslation(lang, 'ui.recurringExpenses.savedToast'));
      }
      setIsModalOpen(false);
      await loadRules();
    } catch (err: any) {
      setFormError(formatRecurringErrorMessage(err, lang));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (rule: RecurringExpenseRule) => {
    try {
      await toggleRecurringExpense(rule.id);
      toast.success(getTranslation(lang, 'ui.recurringExpenses.toggledToast'));
      await loadRules();
    } catch (err: any) {
      toast.error(formatRecurringErrorMessage(err, lang));
    }
  };

  const handleDelete = async (rule: RecurringExpenseRule) => {
    try {
      await deleteRecurringExpense(rule.id);
      toast.success(getTranslation(lang, 'ui.recurringExpenses.deletedToast'));
      await loadRules();
    } catch (err: any) {
      toast.error(formatRecurringErrorMessage(err, lang));
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Due Bills Alert Banner */}
      {dueRules.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <BellRing size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {getTranslation(lang, 'ui.recurringExpenses.dueBannerTitle').replace(
                    '{count}',
                    String(dueRules.length)
                  )}
                </h4>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                  {getTranslation(lang, 'ui.recurringExpenses.dueBannerSubtitle')}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dueRules.map(rule => (
              <div
                key={rule.id}
                className="bg-card border border-border rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{rule.title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 tabular-nums" dir="ltr">
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {formatMoney(rule.amount)}
                    </span>
                    <span>•</span>
                    <span>{new Date(rule.nextDueDate).toLocaleDateString(isAr ? 'ar-IQ' : 'en-US')}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmTarget(rule)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition-all"
                >
                  <CheckCircle2 size={13} />
                  <span>{getTranslation(lang, 'ui.recurringExpenses.confirmPaymentBtn')}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <CalendarClock size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {getTranslation(lang, 'ui.recurringExpenses.title')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {getTranslation(lang, 'ui.recurringExpenses.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRules}
            disabled={isLoading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors"
            title={getTranslation(lang, 'actions.refresh', isAr ? 'تحديث' : 'Refresh')}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm transition-all"
          >
            <Plus size={15} />
            <span>{getTranslation(lang, 'ui.recurringExpenses.addRule')}</span>
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {!isLoading && rules.length === 0 ? (
          <div className="p-8">
            <EmptyState
              lang={lang}
              icon={<CalendarClock size={22} />}
              title={getTranslation(lang, 'ui.recurringExpenses.emptyTitle')}
              subtitle={getTranslation(lang, 'ui.recurringExpenses.emptySubtitle')}
              action={
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm"
                >
                  <Plus size={14} />
                  <span>{getTranslation(lang, 'ui.recurringExpenses.addRule')}</span>
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground">
                  <th className="py-3.5 px-4 text-start font-semibold">
                    {getTranslation(lang, 'ui.recurringExpenses.colTitle')}
                  </th>
                  <th className="py-3.5 px-4 text-end font-semibold">
                    {getTranslation(lang, 'ui.recurringExpenses.colAmount')}
                  </th>
                  <th className="py-3.5 px-4 text-start font-semibold">
                    {getTranslation(lang, 'ui.recurringExpenses.colSchedule')}
                  </th>
                  <th className="py-3.5 px-4 text-center font-semibold">
                    {getTranslation(lang, 'ui.recurringExpenses.colMode')}
                  </th>
                  <th className="py-3.5 px-4 text-start font-semibold">
                    {getTranslation(lang, 'ui.recurringExpenses.colNextDue')}
                  </th>
                  <th className="py-3.5 px-4 text-center font-semibold">
                    {getTranslation(lang, 'ui.recurringExpenses.colStatus')}
                  </th>
                  <th className="py-3.5 px-4 text-end font-semibold">
                    {getTranslation(lang, 'ui.recurringExpenses.colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rules.map(rule => (
                  <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-foreground">{rule.title}</span>
                        {rule.exceedsMonthlyCap && (
                          <StatusBadge
                            tone="rose"
                            label={getTranslation(lang, 'ui.recurringExpenses.exceedsCapBadge')}
                          />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {rule.category || getTranslation(lang, 'expenses.uncategorized')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-end font-bold text-foreground tabular-nums" dir="ltr">
                      {formatMoney(rule.amount)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-muted border border-border text-xs font-medium text-foreground">
                        {formatRecurringScheduleLabel(rule, lang)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {rule.executionMode === 'AutoPost' ? (
                        <StatusBadge
                          tone="indigo"
                          icon={<Zap size={11} />}
                          label={getTranslation(lang, 'ui.recurringExpenses.modeAutoPost')}
                        />
                      ) : (
                        <StatusBadge
                          tone="amber"
                          icon={<BellRing size={11} />}
                          label={getTranslation(lang, 'ui.recurringExpenses.modeRemindAndConfirm')}
                        />
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs tabular-nums" dir="ltr">
                      <span className={rule.isDue ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                        {new Date(rule.nextDueDate).toLocaleDateString(isAr ? 'ar-IQ' : 'en-US')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {!rule.isActive ? (
                        <StatusBadge
                          tone="slate"
                          dot
                          label={getTranslation(lang, 'ui.recurringExpenses.pausedBadge')}
                        />
                      ) : rule.isDue ? (
                        <StatusBadge
                          tone="amber"
                          dot
                          label={getTranslation(lang, 'ui.recurringExpenses.dueBadge')}
                        />
                      ) : (
                        <StatusBadge
                          tone="emerald"
                          dot
                          label={getTranslation(lang, 'ui.recurringExpenses.scheduledBadge')}
                        />
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {rule.isActive && rule.isDue && (
                          <button
                            type="button"
                            onClick={() => setConfirmTarget(rule)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                          >
                            <CheckCircle2 size={13} />
                            <span>{getTranslation(lang, 'ui.recurringExpenses.confirmPaymentBtn')}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggle(rule)}
                          className={`p-1.5 rounded-lg border border-border transition-colors ${
                            rule.isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-card text-muted-foreground hover:bg-muted'
                          }`}
                          title={getTranslation(lang, 'ui.recurringExpenses.fieldIsActive')}
                        >
                          <Power size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title={getTranslation(lang, 'ui.recurringExpenses.editRule')}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rule)}
                          className="p-1.5 rounded-lg border border-border bg-card hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors"
                          title={getTranslation(lang, 'ui.recurringExpenses.deleteBtn')}
                        >
                          <Trash2 size={14} />
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

      {/* Add / Edit Recurring Expense Modal */}
      {isModalOpen && (
        <ModalBackdropPortal onClose={() => setIsModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div
            className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
              <h3 className="text-base font-bold text-foreground">
                {getTranslation(
                  lang,
                  editingRule ? 'ui.recurringExpenses.editRule' : 'ui.recurringExpenses.addRule'
                )}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Quick Schedule Presets */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  {getTranslation(lang, 'ui.recurringExpenses.presetsTitle')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('MONTH_START')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      frequency === 'Monthly' && dayOfMonth === 1
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {getTranslation(lang, 'ui.recurringExpenses.presetMonthStart')}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('MID_MONTH')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      frequency === 'Monthly' && dayOfMonth === 15
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {getTranslation(lang, 'ui.recurringExpenses.presetMidMonth')}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('WEEKLY')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      frequency === 'Weekly'
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {getTranslation(lang, 'ui.recurringExpenses.presetWeekly')}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('CUSTOM')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      frequency === 'CustomDays'
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {getTranslation(lang, 'ui.recurringExpenses.presetCustom')}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('YEARLY')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      frequency === 'Yearly'
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {getTranslation(lang, 'ui.recurringExpenses.presetYearly')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.recurringExpenses.fieldTitle')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={getTranslation(lang, 'ui.recurringExpenses.fieldTitlePlaceholder')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <InlineCategorySelector
                    lang={lang}
                    categories={categories}
                    value={category}
                    valueMode="name"
                    label={getTranslation(lang, 'ui.recurringExpenses.fieldCategory')}
                    onChange={setCategory}
                    onCategoriesChange={nextCats => onCategoriesChange?.(nextCats)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.recurringExpenses.fieldAmount')} *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    dir="ltr"
                    placeholder="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {/* Smart Budget Cap Calculator & Auto-Split Helper */}
                {selectedCategoryCap > 0 && (
                  <div className="sm:col-span-2 p-3.5 rounded-xl bg-muted/50 border border-border space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{getTranslation(lang, 'ui.recurringExpenses.projectedMonthlyLabel')}:</span>
                        <strong
                          className={`tabular-nums ${
                            isFormOverBudget ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                          }`}
                          dir="ltr"
                        >
                          {formatMoney(liveProjectedMonthly)}
                        </strong>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{getTranslation(lang, 'ui.recurringExpenses.categoryCapLabel')}:</span>
                        <strong className="text-primary tabular-nums" dir="ltr">
                          {formatMoney(selectedCategoryCap)}
                        </strong>
                      </div>
                    </div>

                    {(frequency === 'Weekly' || frequency === 'CustomDays') && suggestedSplitAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(suggestedSplitAmount))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-semibold transition-colors tabular-nums"
                      >
                        <Zap size={13} />
                        <span>
                          {getTranslation(lang, 'ui.recurringExpenses.autoSplitBtn').replace(
                            '{amount}',
                            formatMoney(suggestedSplitAmount)
                          )}
                        </span>
                      </button>
                    )}

                    {isFormOverBudget && (
                      <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>
                          {getTranslation(lang, 'ui.recurringExpenses.overBudgetWarning')
                            .replace('{projected}', formatMoney(liveProjectedMonthly))
                            .replace('{cap}', formatMoney(selectedCategoryCap))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Frequency-Specific Schedule Control */}
                {(frequency === 'Monthly' || frequency === 'Yearly') && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {getTranslation(lang, 'ui.recurringExpenses.fieldDayOfMonth')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      dir="ltr"
                      value={dayOfMonth}
                      onChange={e => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                )}

                {frequency === 'Weekly' && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {getTranslation(lang, 'ui.recurringExpenses.fieldDayOfWeek')}
                    </label>
                    <select
                      value={dayOfWeek}
                      onChange={e => setDayOfWeek(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {weekdayOptions.map((wd, idx) => (
                        <option key={idx} value={idx}>
                          {wd}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {frequency === 'CustomDays' && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {getTranslation(lang, 'ui.recurringExpenses.fieldIntervalDays')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      dir="ltr"
                      value={intervalDays}
                      onChange={e => setIntervalDays(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                )}

                {/* Execution Mode Cards */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.recurringExpenses.fieldExecutionMode')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setExecutionMode('RemindAndConfirm')}
                      className={`p-3 rounded-xl border text-start transition-all space-y-1 ${
                        executionMode === 'RemindAndConfirm'
                          ? 'bg-primary/10 border-primary'
                          : 'bg-background border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <BellRing size={14} className="text-amber-500" />
                        <span>{getTranslation(lang, 'ui.recurringExpenses.modeRemindTitle')}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {getTranslation(lang, 'ui.recurringExpenses.modeRemindDesc')}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExecutionMode('AutoPost')}
                      className={`p-3 rounded-xl border text-start transition-all space-y-1 ${
                        executionMode === 'AutoPost'
                          ? 'bg-primary/10 border-primary'
                          : 'bg-background border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Zap size={14} className="text-indigo-500" />
                        <span>{getTranslation(lang, 'ui.recurringExpenses.modeAutoPostTitle')}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {getTranslation(lang, 'ui.recurringExpenses.modeAutoPostDesc')}
                      </p>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'ui.recurringExpenses.fieldNotes')}
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={getTranslation(lang, 'ui.recurringExpenses.fieldNotesPlaceholder')}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2.5 pt-1">
                  <input
                    id="recurring-active-checkbox"
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <label htmlFor="recurring-active-checkbox" className="text-sm text-foreground cursor-pointer">
                    {getTranslation(lang, 'ui.recurringExpenses.fieldIsActive')}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors"
                >
                  {getTranslation(lang, 'ui.recurringExpenses.cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
                >
                  {isSaving
                    ? getTranslation(lang, 'ui.recurringExpenses.savingBtn')
                    : getTranslation(lang, 'ui.recurringExpenses.saveBtn')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Confirm Payment Modal */}
      <ConfirmRecurringExpenseModal
        rule={confirmTarget}
        lang={lang}
        onClose={() => setConfirmTarget(null)}
        onConfirmed={() => {
          loadRules();
          onExpensesUpdated?.();
        }}
      />
    </div>
  );
}
