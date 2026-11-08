import React from 'react';

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked: controlledChecked,
      defaultChecked = false,
      onCheckedChange,
      disabled = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const isControlled = controlledChecked !== undefined;
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
    const isChecked = isControlled ? controlledChecked : internalChecked;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      e.preventDefault();
      const nextChecked = !isChecked;
      if (!isControlled) {
        setInternalChecked(nextChecked);
      }
      onCheckedChange?.(nextChecked);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const nextChecked = !isChecked;
        if (!isControlled) {
          setInternalChecked(nextChecked);
        }
        onCheckedChange?.(nextChecked);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        id={id}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`
          peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border 
          transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 
          focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background 
          disabled:cursor-not-allowed disabled:opacity-50
          ${isChecked ? 'bg-primary border-primary' : 'bg-muted border-border'}
          ${className}
        `}
        style={{
          backgroundColor: isChecked ? 'var(--primary, #0284c7)' : 'var(--muted, #e2e8f0)',
          borderColor: isChecked ? 'var(--primary, #0284c7)' : 'var(--border, #cbd5e1)',
          ...props.style
        }}
        {...props}
      >
        <span
          className={`
            pointer-events-none block h-3.5 w-3.5 rounded-full shadow-sm ring-0 
            transition-transform duration-200 ease-in-out
            ${isChecked ? 'bg-white' : 'bg-foreground/80'}
          `}
          style={{
            backgroundColor: isChecked ? '#ffffff' : '#64748b',
            transform: isChecked
              ? (typeof document !== 'undefined' && (document.dir === 'rtl' || document.documentElement.dir === 'rtl') ? 'translateX(-16px)' : 'translateX(16px)')
              : 'translateX(0)',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';

export default Switch;
