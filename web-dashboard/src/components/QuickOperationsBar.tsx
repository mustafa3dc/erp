import React from 'react';
import { Plus, Store, ArrowDownToLine, Wallet, ArrowLeftRight, Zap, Scan } from 'lucide-react';
import { Button } from './ui/button';
import { getTranslation } from '../lib/i18n';

export interface QuickOperationsBarProps {
  onNewProduct?: () => void;
  onPos?: () => void;
  onInboundReceipt?: () => void;
  onQuickExpense?: () => void;
  onSerialLookup?: () => void;
  onTransfer?: () => void;
  isAr?: boolean;
  lang?: 'ar' | 'en';
}

export const QuickOperationsBar: React.FC<QuickOperationsBarProps> = ({
  onNewProduct,
  onPos,
  onInboundReceipt,
  onQuickExpense,
  onSerialLookup,
  onTransfer,
  isAr = true,
  lang
}) => {
  const effectiveLang = lang || (isAr ? 'ar' : 'en');

  return (
    <div
      className="w-full bg-card border border-border rounded-2xl p-3.5 dashboard-quick-actions-bar fade-in"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap dqa-main-wrap">
        {/* Title and Icon */}
        <div className="flex items-center gap-2.5 dqa-title-flex">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: 'var(--primary-light)',
              borderColor: 'var(--primary-border)',
              color: 'var(--primary)'
            }}
          >
            <Zap size={17} strokeWidth={2} />
          </div>
          <div className="flex flex-col dqa-title-text">
            <span className="text-sm font-bold text-foreground leading-tight">
              {getTranslation(effectiveLang, 'ui.quickOps.title')}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium leading-tight mt-0.5">
              {getTranslation(effectiveLang, 'ui.quickOps.subtitle')}
            </span>
          </div>
        </div>

        {/* Deduplicated Executive Quick-Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap dqa-buttons-flex">
          {onPos && (
            <Button
              type="button"
              onClick={onPos}
              className="h-9 px-3.5 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs transition-all text-xs cursor-pointer"
            >
              <Store size={15} />
              <span>{getTranslation(effectiveLang, 'ui.quickOps.posTerminal')}</span>
            </Button>
          )}

          {onInboundReceipt && (
            <Button
              type="button"
              variant="outline"
              onClick={onInboundReceipt}
              className="h-9 px-3 gap-1.5 bg-card border-border hover:bg-muted text-foreground font-medium shadow-none transition-colors text-xs cursor-pointer"
            >
              <ArrowDownToLine size={15} className="text-emerald-500" />
              <span>{getTranslation(effectiveLang, 'ui.quickOps.inboundGoods')}</span>
            </Button>
          )}

          {onNewProduct && (
            <Button
              type="button"
              variant="outline"
              onClick={onNewProduct}
              className="h-9 px-3 gap-1.5 bg-card border-border hover:bg-muted text-foreground font-medium shadow-none transition-colors text-xs cursor-pointer"
            >
              <Plus size={15} className="text-emerald-500" />
              <span>{getTranslation(effectiveLang, 'ui.quickOps.newItem')}</span>
            </Button>
          )}

          {onQuickExpense && (
            <Button
              type="button"
              variant="outline"
              onClick={onQuickExpense}
              className="h-9 px-3 gap-1.5 bg-card border-border hover:bg-muted text-foreground font-medium shadow-none transition-colors text-xs cursor-pointer"
            >
              <Wallet size={15} className="text-amber-500" />
              <span>{getTranslation(effectiveLang, 'ui.quickOps.newExpense')}</span>
            </Button>
          )}

          {onTransfer && (
            <Button
              type="button"
              variant="outline"
              onClick={onTransfer}
              className="h-9 px-3 gap-1.5 bg-card border-border hover:bg-muted text-foreground font-medium shadow-none transition-colors text-xs cursor-pointer"
            >
              <ArrowLeftRight size={15} className="text-muted-foreground" />
              <span>{getTranslation(effectiveLang, 'ui.quickOps.interTransfer')}</span>
            </Button>
          )}

          {onSerialLookup && (
            <Button
              type="button"
              variant="outline"
              onClick={onSerialLookup}
              className="h-9 px-3 gap-1.5 bg-card border-border hover:bg-muted text-foreground font-medium shadow-none transition-colors text-xs cursor-pointer"
            >
              <Scan size={15} className="text-indigo-500" />
              <span>{getTranslation(effectiveLang, 'ui.quickOps.serialLookup')}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickOperationsBar;
