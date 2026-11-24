import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  LayoutGrid,
  FileText,
  Package,
  Scan,
  Plus,
  Wallet,
  Zap,
  ArrowRight,
  ArrowLeft,
  CornerDownLeft,
  Receipt
} from 'lucide-react';
import { DialogPortal, DialogOverlay } from '../ui/dialog';
import { Product, SalesInvoice } from '../../types/warehouse';
import { UserProfile } from '../../types/rbac';
import { getPermittedNavigation } from '../../config/navigationSchema';
import { getStoredProductSerials, getStoredSalesQuotations } from '../../services/storageService';
import { getTranslation } from '../../lib/i18n';
import { useSettings } from '../../context/settings-context';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
  currentUser: UserProfile;
  products: Product[];
  invoices: SalesInvoice[];
  onNavigate: (navId: string) => void;
  onSelectProduct: (product: Product) => void;
  onSelectInvoice: (invoice: SalesInvoice) => void;
  onLookupSerial: (serial: string) => void;
  onNewSale: () => void;
  onNewExpense: () => void;
  onNewProduct: () => void;
}

interface CommandItem {
  id: string;
  group: 'actions' | 'pages' | 'serials' | 'invoices' | 'products' | 'quotations';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  products,
  invoices,
  onNavigate,
  onSelectProduct,
  onSelectInvoice,
  onLookupSerial,
  onNewSale,
  onNewExpense,
  onNewProduct
}) => {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const permittedNav = useMemo(() => getPermittedNavigation(currentUser), [currentUser]);
  const storedSerials = useMemo(() => (isOpen ? getStoredProductSerials() : []), [isOpen]);
  const storedQuotations = useMemo(() => (isOpen ? getStoredSalesQuotations() : []), [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const results = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();
    const list: CommandItem[] = [];

    // 1. Direct Serial / IMEI lookup shortcut if typing looks like a code/IMEI
    if (q.length >= 3) {
      const matchedSerials = storedSerials
        .filter(
          s =>
            s.serialNumber.toLowerCase().includes(q) ||
            s.productName.toLowerCase().includes(q)
        )
        .slice(0, 4);

      for (const s of matchedSerials) {
        list.push({
          id: `serial-${s.id}`,
          group: 'serials',
          title: s.serialNumber,
          subtitle: `${s.productName}${s.customerName ? ` • ${s.customerName}` : ''}`,
          badge: s.status,
          icon: <Scan size={15} className="text-primary" />,
          onSelect: () => {
            onLookupSerial(s.serialNumber);
            onClose();
          }
        });
      }

      if (!matchedSerials.some(s => s.serialNumber.toLowerCase() === q)) {
        list.push({
          id: `serial-direct-${q}`,
          group: 'serials',
          title: `${getTranslation(lang, 'ui.commandPalette.scanSerialAction')}: "${query.trim()}"`,
          subtitle: `${getTranslation(lang, 'ui.commandPalette.lookupSerialPrompt')} ${query.trim()}`,
          icon: <Scan size={15} className="text-primary" />,
          onSelect: () => {
            onLookupSerial(query.trim());
            onClose();
          }
        });
      }
    }

    // 2. Quick Actions
    const quickActions: CommandItem[] = [
      {
        id: 'act-new-sale',
        group: 'actions',
        title: getTranslation(lang, 'ui.commandPalette.actionNewSale'),
        subtitle: getTranslation(lang, 'ui.quickOps.title'),
        icon: <Plus size={15} className="text-primary" />,
        onSelect: () => {
          onNewSale();
          onClose();
        }
      },
      {
        id: 'act-new-expense',
        group: 'actions',
        title: getTranslation(lang, 'ui.commandPalette.actionNewExpense'),
        subtitle: getTranslation(lang, 'expenses.title'),
        icon: <Wallet size={15} className="text-amber-500" />,
        onSelect: () => {
          onNewExpense();
          onClose();
        }
      },
      {
        id: 'act-serial-lookup',
        group: 'actions',
        title: getTranslation(lang, 'ui.commandPalette.actionSerialLookup'),
        subtitle: getTranslation(lang, 'serialTracking.title'),
        icon: <Scan size={15} className="text-indigo-500" />,
        onSelect: () => {
          onNavigate('Serial & Warranty Tracking');
          onClose();
        }
      },
      {
        id: 'act-new-item',
        group: 'actions',
        title: getTranslation(lang, 'ui.commandPalette.actionNewItem'),
        subtitle: getTranslation(lang, 'inventory'),
        icon: <Package size={15} className="text-emerald-500" />,
        onSelect: () => {
          onNewProduct();
          onClose();
        }
      },
      {
        id: 'act-pos',
        group: 'actions',
        title: getTranslation(lang, 'ui.commandPalette.actionPos'),
        subtitle: getTranslation(lang, 'pos'),
        icon: <Zap size={15} className="text-primary" />,
        onSelect: () => {
          onNavigate('Cloud POS');
          onClose();
        }
      }
    ];

    for (const act of quickActions) {
      if (!q || act.title.toLowerCase().includes(q) || (act.subtitle && act.subtitle.toLowerCase().includes(q))) {
        list.push(act);
      }
    }

    // 3. Permitted Modules & Pages
    if (permittedNav.isDashboardAllowed) {
      const dashTitle = getTranslation(lang, 'ui.sidebar.mainDashboard');
      if (!q || dashTitle.toLowerCase().includes(q) || 'dashboard'.includes(q)) {
        list.push({
          id: 'page-dashboard',
          group: 'pages',
          title: dashTitle,
          icon: <LayoutGrid size={15} />,
          onSelect: () => {
            onNavigate('Dashboard');
            onClose();
          }
        });
      }
    }

    for (const grp of permittedNav.groups) {
      const grpTitle = isAr ? grp.titleAr : grp.titleEn;
      for (const item of grp.items) {
        const itemTitle = isAr ? item.titleAr : item.titleEn;
        if (
          !q ||
          itemTitle.toLowerCase().includes(q) ||
          item.titleEn.toLowerCase().includes(q) ||
          item.titleAr.toLowerCase().includes(q) ||
          grpTitle.toLowerCase().includes(q)
        ) {
          list.push({
            id: `page-${item.id}`,
            group: 'pages',
            title: itemTitle,
            subtitle: grpTitle,
            icon: isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />,
            onSelect: () => {
              onNavigate(item.id);
              onClose();
            }
          });
        }
      }
    }

    // 4. Matching Invoices (when typing)
    if (q.length >= 2) {
      const matchingInvoices = invoices
        .filter(
          inv =>
            inv.invoiceNo.toLowerCase().includes(q) ||
            inv.customerName.toLowerCase().includes(q) ||
            (inv.customerPhone && inv.customerPhone.includes(q))
        )
        .slice(0, 5);

      for (const inv of matchingInvoices) {
        list.push({
          id: `inv-${inv.id}`,
          group: 'invoices',
          title: inv.invoiceNo,
          subtitle: inv.customerName,
          badge: formatMoney(inv.total),
          icon: <Receipt size={15} className="text-emerald-500" />,
          onSelect: () => {
            onSelectInvoice(inv);
            onClose();
          }
        });
      }

      // 5. Matching Quotations
      const matchingQuotes = storedQuotations
        .filter(
          qt =>
            qt.quotationNo.toLowerCase().includes(q) ||
            qt.customerName.toLowerCase().includes(q)
        )
        .slice(0, 4);

      for (const qt of matchingQuotes) {
        list.push({
          id: `qt-${qt.id}`,
          group: 'quotations',
          title: qt.quotationNo,
          subtitle: qt.customerName,
          badge: formatMoney(qt.total),
          icon: <FileText size={15} className="text-indigo-500" />,
          onSelect: () => {
            onNavigate('Sales Quotations');
            onClose();
          }
        });
      }

      // 6. Matching Inventory Products
      const matchingProducts = products
        .filter(
          p =>
            p.nameAr.toLowerCase().includes(q) ||
            p.nameEn.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.toLowerCase().includes(q))
        )
        .slice(0, 6);

      for (const prod of matchingProducts) {
        list.push({
          id: `prod-${prod.id}`,
          group: 'products',
          title: (isAr ? prod.nameAr : prod.nameEn) || prod.nameAr || prod.nameEn,
          subtitle: `${prod.sku} • ${prod.warehouseName}`,
          badge: `${prod.currentStock} ${prod.unit}`,
          icon: <Package size={15} className="text-primary" />,
          onSelect: () => {
            onSelectProduct(prod);
            onClose();
          }
        });
      }
    }

    return list.slice(0, 18);
  }, [
    query,
    permittedNav,
    storedSerials,
    storedQuotations,
    invoices,
    products,
    isAr,
    lang,
    formatMoney,
    onLookupSerial,
    onClose,
    onNewSale,
    onNewExpense,
    onNewProduct,
    onNavigate,
    onSelectInvoice,
    onSelectProduct
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) {
        target.onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const getGroupLabel = (group: CommandItem['group']) => {
    switch (group) {
      case 'serials':
        return getTranslation(lang, 'ui.commandPalette.groupSerials');
      case 'actions':
        return getTranslation(lang, 'ui.commandPalette.groupQuickActions');
      case 'pages':
        return getTranslation(lang, 'ui.commandPalette.groupPages');
      case 'invoices':
        return getTranslation(lang, 'ui.commandPalette.groupInvoices');
      case 'quotations':
        return getTranslation(lang, 'ui.commandPalette.groupQuotations');
      case 'products':
        return getTranslation(lang, 'ui.commandPalette.groupProducts');
    }
  };

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} style={{ backgroundColor: 'rgba(9, 11, 16, 0.72)' }} />
      <div
        className="fixed inset-0 z-[99999] flex items-start justify-center pt-[10vh] px-4 pointer-events-none"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div
          className="w-full max-w-2xl bg-popover text-popover-foreground border border-border rounded-2xl overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
          style={{ boxShadow: 'var(--shadow-elevated)' }}
          onClick={e => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Search Input Row */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-card/60">
            <Search size={18} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={getTranslation(lang, 'ui.commandPalette.placeholder')}
              className="w-full bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground text-[11px] font-mono font-semibold hover:text-foreground cursor-pointer"
            >
              ESC
            </button>
          </div>

          {/* Results Scrollable Container */}
          <div className="max-h-[58vh] overflow-y-auto p-2 flex flex-col gap-1">
            {results.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {getTranslation(lang, 'ui.commandPalette.noResults')}
              </div>
            ) : (
              results.map((item, idx) => {
                const showGroupHeader = idx === 0 || results[idx - 1].group !== item.group;
                const isActive = idx === activeIndex;

                return (
                  <React.Fragment key={item.id}>
                    {showGroupHeader && (
                      <div className="px-3 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {getGroupLabel(item.group)}
                      </div>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={item.onSelect}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-start transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-foreground hover:bg-muted/70 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            isActive
                              ? 'bg-primary/15 border-primary/30 text-primary'
                              : 'bg-muted/80 border-border text-muted-foreground'
                          }`}
                        >
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.badge && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold tabular-nums bg-muted text-foreground border border-border"
                            dir="ltr"
                          >
                            {item.badge}
                          </span>
                        )}
                        {isActive && <CornerDownLeft size={14} className="text-primary opacity-80" />}
                      </div>
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>

          {/* Footer Hints */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/40 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">↑↓</kbd>
                <span>{getTranslation(lang, 'ui.commandPalette.navigateHint')}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">↵</kbd>
                <span>{getTranslation(lang, 'ui.commandPalette.selectHint')}</span>
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">ESC</kbd>
              <span>{getTranslation(lang, 'ui.commandPalette.closeHint')}</span>
            </span>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
};

export default CommandPaletteModal;
