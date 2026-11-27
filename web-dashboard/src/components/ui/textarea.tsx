import * as React from 'react';
import { toLatinDigits } from '../../lib/formatters';
import { normalizeElementDigitsInPlace } from '../../utils/arabicNumeralConverter';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', onInput, onChange, onPaste, ...props }, ref) => {
    const handleNormalizedInput = (e: React.InputEvent<HTMLTextAreaElement>) => {
      normalizeElementDigitsInPlace(e.currentTarget);
      onInput?.(e);
    };

    const handleNormalizedChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      normalizeElementDigitsInPlace(e.target);
      if (/[\u0660-\u0669\u06F0-\u06F9\u066B]/.test(e.target.value)) {
        e.target.value = toLatinDigits(e.target.value);
      }
      onChange?.(e);
    };

    const handleNormalizedPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const rawPaste = e.clipboardData?.getData('text');
      if (rawPaste && /[\u0660-\u0669\u06F0-\u06F9\u066B]/.test(rawPaste)) {
        e.preventDefault();
        const el = e.currentTarget;
        const converted = toLatinDigits(rawPaste);
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const before = el.value.slice(0, start);
        const after = el.value.slice(end);
        el.value = toLatinDigits(before + converted + after);
        const pos = toLatinDigits(before + converted).length;
        try {
          el.setSelectionRange(pos, pos);
        } catch {
          // Ignore if selection range cannot be updated
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      onPaste?.(e);
    };

    return (
      <textarea
        ref={ref}
        onInput={handleNormalizedInput}
        onChange={handleNormalizedChange}
        onPaste={handleNormalizedPaste}
        className={`flex min-h-[80px] w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
