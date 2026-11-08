import React from 'react';
import { Plus, Store, ArrowDownToLine, Wallet, ArrowLeftRight, Zap } from 'lucide-react';
import { Button } from './ui/button';

export interface QuickOperationsBarProps {
  onNewProduct?: () => void;
  onPos?: () => void;
  onInboundReceipt?: () => void;
  onQuickExpense?: () => void;
  onTransfer?: () => void;
  isAr?: boolean;
}

export const QuickOperationsBar: React.FC<QuickOperationsBarProps> = ({
  onNewProduct,
  onPos,
  onInboundReceipt,
  onQuickExpense,
  onTransfer,
  isAr = true,
}) => {
  return (
    <div className="w-full bg-card border border-border/80 rounded-xl p-3.5 shadow-xs dashboard-quick-actions-bar fade-in">
      <div className="flex items-center gap-3 dqa-main-wrap">
        
        {/* Title and Icon */}
        <div className="flex items-center gap-2.5 dqa-title-flex">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 dqa-icon-wrap" style={{ background: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)' }}>
            <Zap className="w-5 h-5" size={20} />
          </div>
          <div className="flex flex-col dqa-title-text">
            <span className="text-sm font-bold text-foreground leading-tight">
              {isAr ? 'العمليات السريعة' : 'Quick Operations'}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium leading-tight">
              {isAr ? 'إجراءات المخازن والمبيعات المباشرة' : 'Direct warehouse & sales actions'}
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="hidden sm:block border-l border-border h-8 mx-1 shrink-0" />

        {/* Buttons Group (Strict Lucide Icons - Zero Emojis) */}
        <div className="flex items-center gap-2.5 flex-wrap dqa-buttons-flex">
          {/* 1. New Item */}
          <Button 
            type="button"
            onClick={onNewProduct}
            className="h-9 px-4 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs transition-colors text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" size={16} />
            <span>{isAr ? 'صنف جديد' : 'New Item'}</span>
          </Button>

          {/* 2. Point of Sale (POS) */}
          <Button 
            type="button"
            variant="outline"
            onClick={onPos}
            className="h-9 px-3.5 gap-2 bg-card border-border hover:bg-muted text-foreground font-medium shadow-none transition-colors text-xs cursor-pointer"
          >
            <Store className="w-4 h-4 text-primary" size={16} />
            <span>{isAr ? 'نقطة البيع (POS)' : 'POS Terminal'}</span>
          </Button>

          {/* 3. Inbound Goods Receipt */}
          <Button 
            type="button"
            variant="outline"
            onClick={onInboundReceipt}
            className="h-9 px-3.5 gap-2 bg-card border-border hover:bg-muted text-foreground font-medium shadow-none transition-colors text-xs cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4 text-emerald-500" size={16} />
            <span>{isAr ? 'استلام بضاعة واردة' : 'Inbound Goods'}</span>
          </Button>

          {/* 4. Quick Expense */}
          <Button 
            type="button"
            variant="outline"
            onClick={onQuickExpense}
            className="h-9 px-3.5 gap-2 bg-card border-border hover:bg-muted text-foreground font-medium shadow-none transition-colors text-xs cursor-pointer"
          >
            <Wallet className="w-4 h-4 text-amber-500" size={16} />
            <span>{isAr ? 'تسجيل مصروف' : 'Record Expense'}</span>
          </Button>

          {/* 5. Inter-Warehouse Transfer */}
          <Button 
            type="button"
            variant="outline"
            onClick={onTransfer}
            className="h-9 px-3.5 gap-2 bg-card border-border hover:bg-muted text-foreground font-medium shadow-none transition-colors text-xs cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" size={16} />
            <span>{isAr ? 'تحويل بين المخازن' : 'Inter-Warehouse Transfer'}</span>
          </Button>
        </div>

      </div>
    </div>
  );
};

export default QuickOperationsBar;
