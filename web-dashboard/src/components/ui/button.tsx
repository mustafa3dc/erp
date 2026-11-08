import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', children, ...props }, ref) => {
    const variantStyles: Record<string, string> = {
      default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
      destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
      outline: 'border border-border/80 bg-background text-foreground hover:bg-muted shadow-xs',
      secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
      ghost: 'hover:bg-muted text-foreground',
      link: 'text-primary underline-offset-4 hover:underline'
    };

    const sizeStyles: Record<string, string> = {
      default: 'h-10 px-4 py-2 text-sm',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-11 rounded-md px-8 text-base',
      icon: 'h-10 w-10'
    };

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${variantStyles[variant] || variantStyles.default} ${sizeStyles[size] || sizeStyles.default} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
