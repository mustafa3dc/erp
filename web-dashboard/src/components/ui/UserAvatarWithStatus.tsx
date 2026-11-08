import React from 'react';
import { resolveUserAvatar } from '@/services/avatarService';

export interface UserAvatarWithStatusProps {
  user?: any;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isOnline?: boolean;
}

export function UserAvatarWithStatus({
  user,
  size = 'md',
  className = '',
  isOnline = true
}: UserAvatarWithStatusProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  }[size];

  const dotClasses = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5'
  }[size];

  const avatarSrc = (user && resolveUserAvatar(user)) || user?.avatarUrl || "/avatars/memoji-admin.png";
  const avatarAlt = user?.fullName || user?.name || "Avatar";

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {/* دائرة الصورة مع حماية الحواف */}
      <div className={`${sizeClasses} rounded-full ring-2 ring-primary/20 overflow-hidden bg-muted flex items-center justify-center`}>
        <img 
          src={avatarSrc} 
          alt={avatarAlt} 
          className="h-full w-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.src.endsWith('/avatars/memoji-admin.png')) {
              target.src = '/avatars/memoji-admin.png';
            }
          }}
        />
      </div>

      {/* شارة الاتصال الخضراء الفخمة (بدون قص + إطار حماية) */}
      {isOnline && (
        <span className={`absolute bottom-0 end-0 flex ${dotClasses}`}>
          {/* تأثير النبض الراداري الهادئ */}
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 duration-1000" />
          {/* النقطة الزمردية المركزية مع إطار عازل بلون الخلفية */}
          <span className={`relative inline-flex ${dotClasses} rounded-full bg-emerald-500 ring-2 ring-background`} />
        </span>
      )}
    </div>
  );
}

export default UserAvatarWithStatus;

