import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, children }: DialogProps) {
  if (!open) return null;
  return <>{children}</>;
}

export interface DialogPortalProps {
  children: React.ReactNode;
  container?: HTMLElement;
}

export function DialogPortal({ children, container }: DialogPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, container || document.body);
}

export function DialogOverlay({
  className = '',
  style,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`fixed inset-0 z-[99998] bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 ${className}`}
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99998,
        ...style,
      }}
      onClick={onClick}
      {...props}
    />
  );
}

export function DialogContent({
  className = '',
  style,
  children,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="fixed inset-0 z-[99999] p-3 sm:p-5 overflow-y-auto pointer-events-none"
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        display: 'grid',
        placeItems: 'center',
        padding: '1.5rem 1rem',
        overflowY: 'auto',
        pointerEvents: 'none',
      }}
    >
      <div
        className={`w-full max-w-lg bg-card text-foreground border border-border shadow-2xl rounded-2xl pointer-events-auto my-auto animate-in fade-in zoom-in-95 duration-200 ${className}`}
        style={{
          width: '100%',
          maxWidth: '30rem',
          backgroundColor: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)',
          padding: '1.5rem',
          boxSizing: 'border-box',
          maxHeight: 'calc(100vh - 3rem)',
          overflowY: 'auto',
          pointerEvents: 'auto',
          margin: 'auto',
          ...style,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col space-y-1.5 text-center sm:text-right border-b border-border pb-3 mb-3.5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogTitle({
  className = '',
  children,
  style,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-lg font-bold leading-none tracking-tight text-foreground ${className}`}
      style={{
        color: 'var(--foreground)',
        margin: 0,
        ...style
      }}
      {...props}
    >
      {children}
    </h3>
  );
}

export function DialogDescription({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-sm text-muted-foreground ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function DialogFooter({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-border mt-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

