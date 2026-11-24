import React from 'react';

export type StatusTone = 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple' | 'slate';

export interface StatusBadgeProps {
  tone?: StatusTone;
  label: React.ReactNode;
  icon?: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone = 'slate',
  label,
  icon,
  dot = false,
  className = ''
}) => {
  const dotColors: Record<StatusTone, string> = {
    emerald: '#10b981',
    amber: '#f59e0b',
    rose: '#ef4444',
    indigo: '#6366f1',
    purple: '#a855f7',
    slate: '#94a3b8'
  };

  return (
    <span className={`status-pill ${tone} ${className}`}>
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '9999px',
            backgroundColor: dotColors[tone],
            flexShrink: 0
          }}
        />
      )}
      {icon}
      <span>{label}</span>
    </span>
  );
};

export default StatusBadge;
