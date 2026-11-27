import * as React from 'react';
import { toLatinDigits } from '../../lib/formatters';
import { normalizeElementDigitsInPlace } from '../../utils/arabicNumeralConverter';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  preventAutofill?: boolean;
}

function inferDefaultInputMode(
  type: React.HTMLInputTypeAttribute | undefined,
  step: string | number | undefined,
  name: string | undefined,
  id: string | undefined,
  explicitInputMode: React.HTMLAttributes<HTMLInputElement>['inputMode']
): React.HTMLAttributes<HTMLInputElement>['inputMode'] {
  if (explicitInputMode) return explicitInputMode;
  if (type === 'tel') return 'numeric';
  if (type === 'number') {
    const stepStr = step !== undefined ? String(step) : '';
    const descriptor = `${name || ''} ${id || ''}`;
    if (stepStr === '1' || /qty|quantity|count|otp|pin|months|days/i.test(descriptor)) {
      return stepStr.includes('.') ? 'decimal' : 'numeric';
    }
    return 'decimal';
  }
  const descriptor = `${name || ''} ${id || ''}`;
  if (/otp|pin|phone|mobile/i.test(descriptor)) return 'numeric';
  if (/price|amount|cost|salary|balance|discount|rate/i.test(descriptor)) return 'decimal';
  return undefined;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className = '', 
    type = 'text', 
    autoComplete = 'new-password',
    preventAutofill = true,
    name,
    id,
    step,
    inputMode,
    onFocus,
    onMouseDown,
    onTouchStart,
    onInput,
    onChange,
    onPaste,
    readOnly,
    ...props 
  }, ref) => {
    // Auto-unlock trick: browsers skip autofill on readOnly fields and unlock on interaction
    const [isWritable, setIsWritable] = React.useState(!preventAutofill || Boolean(readOnly));

    const dynamicName = React.useMemo(() => {
      if (!preventAutofill) return name;
      const base = name || 'field';
      return `${base}_nofill_${Math.random().toString(36).slice(2, 7)}`;
    }, [name, preventAutofill]);

    const unlockField = () => {
      if (!isWritable && !readOnly) {
        setIsWritable(true);
      }
    };

    const resolvedInputMode = inferDefaultInputMode(type, step, name, id, inputMode);

    const handleNormalizedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (type !== 'password') {
        normalizeElementDigitsInPlace(e.target);
        if (/[\u0660-\u0669\u06F0-\u06F9\u066B]/.test(e.target.value)) {
          e.target.value = toLatinDigits(e.target.value);
        }
      }
      onChange?.(e);
    };

    const handleNormalizedInput = (e: React.InputEvent<HTMLInputElement>) => {
      if (type !== 'password') {
        normalizeElementDigitsInPlace(e.currentTarget);
      }
      onInput?.(e);
    };

    const handleNormalizedPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (type !== 'password') {
        const rawPaste = e.clipboardData?.getData('text');
        if (rawPaste && /[\u0660-\u0669\u06F0-\u06F9\u066B]/.test(rawPaste)) {
          e.preventDefault();
          const el = e.currentTarget;
          const converted = toLatinDigits(rawPaste);
          let start = el.value.length;
          let end = el.value.length;
          try {
            start = el.selectionStart ?? el.value.length;
            end = el.selectionEnd ?? el.value.length;
          } catch {
            // Fallback for input types without selection API
          }
          const before = el.value.slice(0, start);
          const after = el.value.slice(end);
          el.value = toLatinDigits(before + converted + after);
          const pos = toLatinDigits(before + converted).length;
          try {
            el.setSelectionRange(pos, pos);
          } catch {
            // Ignore when unsupported
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      onPaste?.(e);
    };

    return (
      <input
        type={type}
        ref={ref}
        id={id}
        name={dynamicName}
        step={step}
        inputMode={resolvedInputMode}
        readOnly={!isWritable && preventAutofill}
        onFocus={(e) => {
          unlockField();
          onFocus?.(e);
        }}
        onMouseDown={(e) => {
          unlockField();
          onMouseDown?.(e);
        }}
        onTouchStart={(e) => {
          unlockField();
          onTouchStart?.(e);
        }}
        onInput={handleNormalizedInput}
        onChange={handleNormalizedChange}
        onPaste={handleNormalizedPaste}
        autoComplete={preventAutofill ? 'off' : autoComplete}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-form-type="other"
        className={`flex h-10 w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
