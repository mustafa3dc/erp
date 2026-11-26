import React, { useState } from 'react';
import { Plus, Trash2, Settings2, Check, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ExpenseCategory } from '../types/businessModules';
import { getTranslation } from '../lib/i18n';
import { useSettings } from '../context/settings-context';
import { apiClient } from '../lib/api-client';
import { saveStoredExpenseCategories } from '../services/storageService';

interface InlineCategorySelectorProps {
  lang: 'en' | 'ar';
  categories: ExpenseCategory[];
  value: string;
  valueMode?: 'id' | 'name';
  label?: string;
  onChange: (value: string) => void;
  onCategoriesChange: (nextCategories: ExpenseCategory[]) => void;
}

export default function InlineCategorySelector({
  lang,
  categories,
  value,
  valueMode = 'id',
  label,
  onChange,
  onCategoriesChange
}: InlineCategorySelectorProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showManageList, setShowManageList] = useState(false);

  const [newName, setNewName] = useState('');
  const [newCapInput, setNewCapInput] = useState('');
  const [quickError, setQuickError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const formatBudgetInputDisplay = (raw: string): string => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    if (!cleaned) return '';
    const parts = cleaned.split('.');
    const intPart = parts[0].replace(/^0+(?=\d)/, '');
    const formattedInt = Number(intPart || '0').toLocaleString('en-US');
    return parts.length > 1 ? `${formattedInt}.${parts[1].slice(0, 4)}` : formattedInt;
  };

  const parseBudgetInputValue = (formatted: string): number => {
    const raw = formatted.replace(/,/g, '').trim();
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const getCategoryLabel = (cat: ExpenseCategory) => (isAr && cat.nameAr ? cat.nameAr : cat.name);
  const getCategoryOptionValue = (cat: ExpenseCategory) => (valueMode === 'name' ? getCategoryLabel(cat) : cat.id);

  const handleQuickCreate = async () => {
    setQuickError('');
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setQuickError(getTranslation(lang, 'errors.EXPENSES.ERR_CATEGORY_NAME_REQUIRED'));
      return;
    }

    const monthlyCap = parseBudgetInputValue(newCapInput);
    if (monthlyCap < 0) {
      setQuickError(getTranslation(lang, 'errors.EXPENSES.ERR_INVALID_CATEGORY_BUDGET'));
      return;
    }

    setIsSaving(true);
    try {
      let maxSeq = 0;
      for (const c of categories) {
        const m = (c.code || '').match(/^CAT-(\d+)$/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
      const nextNum = Math.max(categories.length + 1, maxSeq + 1);
      const fallbackCode = `CAT-${String(nextNum).padStart(3, '0')}`;

      let created: ExpenseCategory = {
        id: `CAT-${Date.now()}`,
        tenantId: 'default',
        code: fallbackCode,
        name: trimmedName,
        nameAr: trimmedName,
        monthlyBudgetCap: monthlyCap,
        budgetLimit: monthlyCap,
        totalSpent: 0,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      try {
        const res = await apiClient.post('/api/expenses/categories', {
          name: trimmedName,
          monthlyBudgetCap: monthlyCap
        });
        if (res && res.success && res.data) {
          created = {
            ...created,
            id: res.data.id || created.id,
            code: res.data.code || created.code,
            name: res.data.name || created.name,
            monthlyBudgetCap: res.data.monthlyBudgetCap ?? monthlyCap,
            budgetLimit: res.data.monthlyBudgetCap ?? monthlyCap
          };
        } else if (res && res.errorCode) {
          setQuickError(getTranslation(lang, `errors.EXPENSES.${res.errorCode}`, res.errorCode));
          return;
        }
      } catch {
        // Offline / localStorage fallback
      }

      const next = [...categories, created];
      saveStoredExpenseCategories(next);
      onCategoriesChange(next);
      onChange(getCategoryOptionValue(created));

      setNewName('');
      setNewCapInput('');
      setShowQuickAdd(false);
      toast.success(getTranslation(lang, 'expenses.categoryCreated'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: ExpenseCategory) => {
    try {
      await apiClient.delete(`/api/expenses/categories/${cat.id}`);
    } catch {
      // Offline fallback
    }
    const next = categories.filter(c => c.id !== cat.id);
    saveStoredExpenseCategories(next);
    onCategoriesChange(next);
    if (value === getCategoryOptionValue(cat)) {
      onChange('');
    }
    toast.success(getTranslation(lang, 'expenses.categoryDeleted'));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-foreground">
          {label || getTranslation(lang, 'expenses.category')}
        </label>
        <div className="flex items-center gap-1.5">
          {categories.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowManageList(prev => !prev);
                setShowQuickAdd(false);
              }}
              className={`p-1 rounded-md border transition-colors ${
                showManageList
                  ? 'bg-muted border-primary/40 text-primary'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
              title={getTranslation(lang, 'expenses.manageCategoriesTooltip')}
            >
              <Settings2 size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setShowQuickAdd(prev => !prev);
              setShowManageList(false);
              setQuickError('');
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-semibold transition-colors"
          >
            <Plus size={11} />
            <span>{getTranslation(lang, 'expenses.inlineNewCategoryBtn')}</span>
          </button>
        </div>
      </div>

      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">{getTranslation(lang, 'expenses.optionalCategoryOption')}</option>
        {categories.map(c => (
          <option key={c.id} value={getCategoryOptionValue(c)}>
            {getCategoryLabel(c)}
          </option>
        ))}
        {value &&
          valueMode === 'name' &&
          !categories.some(c => getCategoryOptionValue(c) === value) && (
            <option value={value}>{value}</option>
          )}
      </select>

      {/* Lightweight Inline Quick-Add Popover Card */}
      {showQuickAdd && (
        <div className="p-3 rounded-xl bg-muted/60 border border-primary/30 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground">
              {getTranslation(lang, 'expenses.newCategory')}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-background border border-border text-[10px] font-mono text-muted-foreground" dir="ltr">
              {getTranslation(lang, 'expenses.autoGeneratedCodeBadge')}
            </span>
          </div>

          {quickError && (
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
              <AlertTriangle size={13} className="shrink-0" />
              <span>{quickError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => {
                setNewName(e.target.value);
                if (quickError) setQuickError('');
              }}
              placeholder={getTranslation(lang, 'expenses.categoryNamePlaceholder')}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={newCapInput}
              onChange={e => setNewCapInput(formatBudgetInputDisplay(e.target.value))}
              placeholder={getTranslation(lang, 'expenses.budgetLimitOptional')}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs font-bold text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setShowQuickAdd(false);
                setQuickError('');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs text-muted-foreground"
            >
              <X size={12} />
              <span>{getTranslation(lang, 'expenses.cancel')}</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleQuickCreate}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold disabled:opacity-60"
            >
              <Check size={12} />
              <span>{getTranslation(lang, 'expenses.saveCategory')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Existing Categories Manage/Delete List */}
      {showManageList && categories.length > 0 && (
        <div className="p-2.5 rounded-xl bg-muted/50 border border-border space-y-1.5 max-h-40 overflow-y-auto animate-in fade-in duration-150">
          {categories.map(cat => {
            const cap = Number(cat.monthlyBudgetCap ?? cat.budgetLimit ?? 0);
            return (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border/60 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] font-bold text-primary shrink-0" dir="ltr">
                    {cat.code}
                  </span>
                  <span className="font-medium text-foreground truncate">{getCategoryLabel(cat)}</span>
                  {cap > 0 && (
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0" dir="ltr">
                      ({formatMoney(cap)})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className="p-1 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors shrink-0"
                  title={getTranslation(lang, 'expenses.deleteCategory')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
