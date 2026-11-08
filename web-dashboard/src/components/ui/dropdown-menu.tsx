import React, { createContext, useContext, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dir: 'rtl' | 'ltr';
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownContext = createContext<DropdownContextType | null>(null);

export interface DropdownMenuProps {
  children: React.ReactNode;
  dir?: 'rtl' | 'ltr';
}

export function DropdownMenu({ children, dir = 'rtl' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const target = event.target as Element;
        if (!target.closest('.dropdown-menu-content')) {
          setIsOpen(false);
        }
      }
    };

    const handleScrollOrResize = (e: Event) => {
      // If scroll occurs outside the open dropdown menu, close it
      const target = e.target as Element;
      if (isOpen && (!target || !target.closest || !target.closest('.dropdown-menu-content'))) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, dir, containerRef }}>
      <div 
        ref={containerRef} 
        className="relative inline-block"
        style={{ position: 'relative', display: 'inline-block' }}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DropdownMenuTrigger({ children, asChild }: DropdownMenuTriggerProps) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownMenuTrigger must be inside DropdownMenu');

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ctx.setIsOpen(prev => !prev);
  };

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: React.MouseEventHandler; 'aria-expanded'?: boolean }>;
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        child.props.onClick?.(e);
        handleClick(e);
      },
      'aria-expanded': ctx.isOpen
    });
  }

  return (
    <button 
      type="button" 
      onClick={handleClick} 
      aria-expanded={ctx.isOpen}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      {children}
    </button>
  );
}

export interface DropdownMenuContentProps {
  children: React.ReactNode;
  align?: 'start' | 'end' | 'center';
  sideOffset?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function DropdownMenuContent({
  children,
  align = 'end',
  sideOffset = 6,
  className = '',
  style = {}
}: DropdownMenuContentProps) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownMenuContent must be inside DropdownMenu');

  const contentRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  useLayoutEffect(() => {
    if (!ctx.isOpen || !ctx.containerRef.current) return;

    const triggerRect = ctx.containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Use measured dimensions or reasonable defaults
    const menuWidth = contentRef.current ? contentRef.current.offsetWidth : 210;
    const menuHeight = contentRef.current ? contentRef.current.offsetHeight : 230;

    const spaceBelow = vh - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    // Smart vertical decision: open upwards if space below is tight or if bottom row in table
    const shouldOpenTop = (spaceBelow < 260 && spaceAbove > spaceBelow) || spaceBelow < 190;

    let computedTop: number | undefined;
    let computedBottom: number | undefined;

    if (shouldOpenTop) {
      computedBottom = Math.max(8, vh - triggerRect.top + sideOffset);
    } else {
      computedTop = Math.min(vh - Math.min(menuHeight, 260) - 8, triggerRect.bottom + sideOffset);
    }

    // Horizontal placement:
    let computedLeft: number | undefined;
    let computedRight: number | undefined;

    // If trigger is on the left half of the viewport (Actions column in RTL):
    if (triggerRect.left < vw / 2) {
      computedLeft = Math.max(8, triggerRect.left);
      if (computedLeft + menuWidth > vw - 8) {
        computedLeft = Math.max(8, vw - menuWidth - 8);
      }
    } else {
      // Trigger is on the right half of the viewport
      computedRight = Math.max(8, vw - triggerRect.right);
      if (computedRight + menuWidth > vw - 8) {
        computedRight = Math.max(8, vw - menuWidth - 8);
      }
    }

    setCoords({
      top: computedTop,
      bottom: computedBottom,
      left: computedLeft,
      right: computedRight,
      placement: shouldOpenTop ? 'top' : 'bottom'
    });
  }, [ctx.isOpen, align, sideOffset, ctx.dir]);

  if (!ctx.isOpen) return null;

  const positionStyles: React.CSSProperties = {
    position: 'fixed',
    top: coords?.top !== undefined ? `${coords.top}px` : undefined,
    bottom: coords?.bottom !== undefined ? `${coords.bottom}px` : undefined,
    left: coords?.left !== undefined ? `${coords.left}px` : undefined,
    right: coords?.right !== undefined ? `${coords.right}px` : undefined,
    zIndex: 999999,
    maxWidth: 'calc(100vw - 1rem)',
    maxHeight: 'calc(100vh - 2rem)',
    overflowY: 'auto',
    backgroundColor: 'var(--card, #ffffff)',
    color: 'var(--card-foreground, #0f172a)',
    border: '1px solid var(--border, rgba(0,0,0,0.1))',
    borderRadius: '0.75rem',
    boxShadow: '0 20px 40px -8px rgba(0,0,0,0.25), 0 0 0 1px var(--border, rgba(0,0,0,0.06))',
    direction: ctx.dir,
    visibility: coords ? 'visible' : 'hidden',
    ...style
  };

  const menuElement = (
    <div
      ref={contentRef}
      className={`dropdown-menu-content z-[999999] rounded-xl border shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100 ${className}`}
      style={positionStyles}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(menuElement, document.body) : null;
}

export interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  title?: string;
}

export function DropdownMenuItem({
  children,
  onClick,
  className = '',
  style = {},
  disabled,
  title
}: DropdownMenuItemProps) {
  const ctx = useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (onClick) onClick();
    if (ctx) ctx.setIsOpen(false);
  };

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      title={title}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      className={`dropdown-menu-item select-none outline-none cursor-pointer transition-colors ${className}`}
      style={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        ...style
      }}
    >
      {children}
    </div>
  );
}

export interface DropdownMenuSeparatorProps {
  className?: string;
  style?: React.CSSProperties;
}

export function DropdownMenuSeparator({
  className = '',
  style = {}
}: DropdownMenuSeparatorProps) {
  return (
    <div
      role="separator"
      className={`dropdown-menu-separator h-[1px] my-1 bg-border/60 ${className}`}
      style={{
        height: '1px',
        margin: '4px 0',
        backgroundColor: 'var(--border, rgba(0,0,0,0.1))',
        ...style
      }}
    />
  );
}

export default DropdownMenu;
