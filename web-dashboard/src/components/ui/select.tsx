import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectContextType {
  value: string;
  onValueChange?: (val: string) => void;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  registerItem: (val: string, label: React.ReactNode) => void;
  selectedLabel: React.ReactNode;
  disabled?: boolean;
}

const SelectContext = createContext<SelectContextType | null>(null);

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Select({ value: controlledValue, defaultValue = '', onValueChange, disabled = false, children }: SelectProps) {
  const [internalValue, setInternalValue] = useState<string>(defaultValue);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [itemsMap, setItemsMap] = useState<Record<string, React.ReactNode>>({});
  const selectRef = useRef<HTMLDivElement>(null);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = (val: string) => {
    if (controlledValue === undefined) {
      setInternalValue(val);
    }
    onValueChange?.(val);
    setIsOpen(false);
  };

  const registerItem = (val: string, label: React.ReactNode) => {
    setItemsMap(prev => {
      if (prev[val] === label) return prev;
      return { ...prev, [val]: label };
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        isOpen,
        setIsOpen,
        registerItem,
        selectedLabel: itemsMap[value] || null,
        disabled
      }}
    >
      <div ref={selectRef} className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
}

export function SelectTrigger({ children, className = '', id, ...props }: SelectTriggerProps) {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error('SelectTrigger must be used within Select');

  return (
    <button
      id={id}
      type="button"
      role="combobox"
      aria-expanded={ctx.isOpen}
      disabled={ctx.disabled || props.disabled}
      onClick={() => {
        if (!ctx.disabled && !props.disabled) {
          ctx.setIsOpen(prev => !prev);
        }
      }}
      className={`flex h-10 w-full items-center justify-between rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className}`}
      {...props}
    >
      <span className="truncate text-start flex-1">{children}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ms-2 ${ctx.isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}

export interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export function SelectValue({ placeholder = 'Select...', className = '' }: SelectValueProps) {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error('SelectValue must be used within Select');

  const content = ctx.selectedLabel || ctx.value;

  return (
    <span className={`block truncate ${!content ? 'text-muted-foreground' : 'text-foreground font-medium'} ${className}`}>
      {content || placeholder}
    </span>
  );
}

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export function SelectContent({ className = '', children, ...props }: SelectContentProps) {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error('SelectContent must be used within Select');

  if (!ctx.isOpen) return null;

  return (
    <div
      className={`absolute top-full z-50 mt-1.5 max-h-60 min-w-[8rem] w-full overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground p-1 shadow-xl animate-in fade-in-0 zoom-in-95 ${className}`}
      style={{
        backgroundColor: 'var(--popover, var(--card))',
        color: 'var(--popover-foreground, var(--foreground))',
        borderColor: 'var(--border)'
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function SelectItem({ value, disabled = false, className = '', children, ...props }: SelectItemProps) {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error('SelectItem must be used within Select');

  useEffect(() => {
    ctx.registerItem(value, children);
  }, [value, children]);

  const isSelected = ctx.value === value;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => {
        if (!disabled) {
          ctx.onValueChange?.(value);
        }
      }}
      className={`relative flex w-full cursor-pointer select-none items-center justify-between rounded-md py-2 px-3 text-sm outline-none transition-colors hover:bg-muted hover:text-foreground ${isSelected ? 'bg-muted/80 text-foreground font-semibold' : 'text-foreground/90'} ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`}
      {...props}
    >
      <span className="truncate">{children}</span>
      {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ms-2" />}
    </div>
  );
}
