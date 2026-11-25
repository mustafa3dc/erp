import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Search, UserPlus, X, Check, AlertCircle, Wallet } from 'lucide-react';
import { getTranslation } from '../lib/i18n';
import { useSettings } from '../context/settings-context';

export interface SmartCustomerOption {
  id: string;
  code?: string;
  name: string;
  phone?: string;
  city?: string;
  address?: string;
  creditLimit?: number;
  currentBalance?: number;
  isDefaultCashCustomer?: boolean;
}

export interface SmartCustomerSelection {
  customerId?: string;
  customerName: string;
  customer?: SmartCustomerOption;
}

interface SmartCustomerComboboxProps {
  lang: 'ar' | 'en';
  customers: SmartCustomerOption[];
  selectedCustomerId?: string;
  customerName: string;
  onChange: (selection: SmartCustomerSelection) => void;
  isCreditMode?: boolean;
  highlightError?: boolean;
  compact?: boolean;
  disabled?: boolean;
  inputId?: string;
}

export default function SmartCustomerCombobox({
  lang,
  customers,
  selectedCustomerId,
  customerName,
  onChange,
  isCreditMode = false,
  highlightError = false,
  compact = false,
  disabled = false,
  inputId = 'smart-customer-combobox'
}: SmartCustomerComboboxProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const tr = (key: string, fallback?: string) => getTranslation(lang, `ui.customerPicker.${key}`, fallback);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = customerName.trim();
  const isEmptyWalkIn = !trimmedQuery && !selectedCustomerId;

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filteredCustomers = useMemo(() => {
    const activeList = (customers || []).filter(c => c && c.name && !c.isDefaultCashCustomer);
    if (!trimmedQuery) {
      return activeList.slice(0, 12);
    }
    const q = trimmedQuery.toLowerCase();
    return activeList
      .filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.code && c.code.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [customers, trimmedQuery]);

  const hasExactExistingMatch = useMemo(() => {
    if (!trimmedQuery) return false;
    const q = trimmedQuery.toLowerCase();
    return customers.some(c => c && c.name?.trim().toLowerCase() === q);
  }, [customers, trimmedQuery]);

  const showCreateOption = Boolean(trimmedQuery && !selectedCustomerId && !hasExactExistingMatch);
  const totalNavigableCount = filteredCustomers.length + (showCreateOption ? 1 : 0);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery, isOpen]);

  const handleSelectExisting = (cust: SmartCustomerOption) => {
    onChange({
      customerId: cust.id,
      customerName: cust.name,
      customer: cust
    });
    setIsOpen(false);
  };

  const handleSelectCreateNew = () => {
    onChange({
      customerId: undefined,
      customerName: trimmedQuery,
      customer: undefined
    });
    setIsOpen(false);
  };

  const handleClearToWalkIn = () => {
    onChange({
      customerId: undefined,
      customerName: '',
      customer: undefined
    });
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (val: string) => {
    // Check if typed text matches previously selected customer; otherwise switch to new/search mode
    const exact = customers.find(
      c => c && !c.isDefaultCashCustomer && c.name?.trim().toLowerCase() === val.trim().toLowerCase()
    );
    onChange({
      customerId: exact ? exact.id : undefined,
      customerName: val,
      customer: exact
    });
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (!isOpen || totalNavigableCount === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % totalNavigableCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + totalNavigableCount) % totalNavigableCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showCreateOption && activeIndex === 0) {
        handleSelectCreateNew();
      } else {
        const custIdx = showCreateOption ? activeIndex - 1 : activeIndex;
        const picked = filteredCustomers[custIdx];
        if (picked) {
          handleSelectExisting(picked);
        } else if (showCreateOption) {
          handleSelectCreateNew();
        }
      }
    }
  };

  const showCreditWarning = Boolean((isCreditMode || highlightError) && isEmptyWalkIn);

  return (
    <div ref={containerRef} className="relative w-full" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Label + Live Mode Status Pill */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-foreground/85 flex items-center gap-1.5 m-0"
        >
          <User size={13} className="text-primary shrink-0" />
          <span>{tr('label')}</span>
          {isCreditMode && <span className="text-destructive font-bold">*</span>}
        </label>

        {isEmptyWalkIn ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
            <Wallet size={10} />
            <span>{tr('walkInBadge')}</span>
          </span>
        ) : selectedCustomerId ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Check size={10} />
            <span>{tr('selectedCustomerBadge')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <UserPlus size={10} />
            <span>{tr('newCustomerBadge')}</span>
          </span>
        )}
      </div>

      {/* Input Wrapper */}
      <div className="relative flex items-center">
        <Search
          size={14}
          className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          disabled={disabled}
          value={customerName}
          onFocus={() => setIsOpen(true)}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tr('placeholder')}
          className={`w-full rounded-lg border bg-background text-foreground ps-8 pe-8 ${
            compact ? 'h-9 text-xs' : 'h-10 text-xs sm:text-sm'
          } font-medium transition-all focus:outline-none ${
            showCreditWarning
              ? 'border-destructive ring-2 ring-destructive/20'
              : 'border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/15'
          }`}
        />

        {(trimmedQuery || selectedCustomerId) && !disabled && (
          <button
            type="button"
            onClick={handleClearToWalkIn}
            title={tr('clearTooltip')}
            className="absolute end-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Credit Mode Validation Prompt when empty */}
      {showCreditWarning && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
          <AlertCircle size={13} className="shrink-0" />
          <span>{tr('creditRequiresCustomer')}</span>
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 top-full mt-1.5 w-full rounded-xl border border-border bg-card text-foreground shadow-2xl overflow-hidden">
          <div className="max-h-56 overflow-y-auto p-1.5 divide-y divide-border/40">
            {/* Highlighted Creatable Action Row */}
            {showCreateOption && (
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(0)}
                onClick={handleSelectCreateNew}
                className={`w-full text-start p-2.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                  activeIndex === 0
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/10 text-primary hover:bg-primary/15'
                }`}
              >
                <UserPlus size={14} className="shrink-0" />
                <span className="truncate">
                  {tr('createNewAction').replace('{name}', trimmedQuery)}
                </span>
              </button>
            )}

            {/* Existing Matching Customers */}
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((cust, idx) => {
                const rowIndex = showCreateOption ? idx + 1 : idx;
                const isSelected = selectedCustomerId === cust.id;
                const isHighlighted = activeIndex === rowIndex;
                return (
                  <button
                    key={cust.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(rowIndex)}
                    onClick={() => handleSelectExisting(cust)}
                    className={`w-full text-start p-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isHighlighted
                        ? 'bg-muted text-foreground'
                        : isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">{cust.name}</span>
                        {cust.code && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            [{cust.code}]
                          </span>
                        )}
                      </div>
                      {cust.phone && cust.phone !== '—' && (
                        <div className="text-[11px] font-mono text-muted-foreground mt-0.5" dir="ltr">
                          {cust.phone}
                        </div>
                      )}
                    </div>

                    <div className="text-end shrink-0">
                      {Number(cust.currentBalance) > 0 && (
                        <span className="block text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {tr('balanceLabel')}: {formatMoney(Number(cust.currentBalance))}
                        </span>
                      )}
                      {isSelected && <Check size={14} className="text-primary ms-auto" />}
                    </div>
                  </button>
                );
              })
            ) : !showCreateOption ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                {tr('placeholder')}
              </div>
            ) : (
              <div className="p-2.5 text-center text-[11px] text-muted-foreground">
                {tr('noMatchesHint')}
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 bg-muted/40 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
            <span>{tr('keyboardHint')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
