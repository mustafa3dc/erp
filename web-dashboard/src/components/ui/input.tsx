import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  preventAutofill?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className = '', 
    type = 'text', 
    autoComplete = 'new-password',
    preventAutofill = true,
    name,
    onFocus,
    onMouseDown,
    onTouchStart,
    readOnly,
    ...props 
  }, ref) => {
    // Generate a unique dynamic field name to completely bypass browser autofill heuristics
    const dynamicName = React.useMemo(
      () => name || `erp_f_${Math.random().toString(36).substring(2, 9)}`,
      [name]
    );

    // Initial readOnly prevents Safari & Chrome heuristic engine from attaching contact autofill
    const [isWritable, setIsWritable] = React.useState(!preventAutofill || Boolean(readOnly));

    const unlockField = React.useCallback(() => {
      if (preventAutofill && !readOnly) {
        setIsWritable(true);
      }
    }, [preventAutofill, readOnly]);

    return (
      <input
        type={type}
        ref={ref}
        name={dynamicName}
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
        autoComplete={autoComplete}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-autocomplete="none"
        data-form-type="other"
        data-lpignore="true"
        data-1p-ignore="true"
        className={`flex h-10 w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
