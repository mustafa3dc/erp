import React from 'react';
import { Inbox } from 'lucide-react';
import { getTranslation } from '../../lib/i18n';

export interface EmptyStateProps {
  lang?: 'ar' | 'en';
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  lang = 'ar',
  icon,
  title,
  subtitle,
  action
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted/80 border border-border flex items-center justify-center text-muted-foreground mb-3 shadow-xs">
        {icon || <Inbox size={22} strokeWidth={1.6} />}
      </div>
      <h4 className="text-sm font-bold text-foreground m-0">
        {title || getTranslation(lang, 'ui.common.noDataTitle')}
      </h4>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm m-0 leading-relaxed">
        {subtitle || getTranslation(lang, 'ui.common.noDataSubtitle')}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
