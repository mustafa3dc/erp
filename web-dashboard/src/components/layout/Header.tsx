import React from 'react';
import { UserNav } from './UserNav';
import { UserProfile } from '../../types/rbac';

export interface HeaderProps {
  currentUser?: UserProfile | null;
  lang?: 'ar' | 'en';
  onNavigate?: (route: string) => void;
  onLogout?: () => void;
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  lang = 'ar',
  onNavigate,
  onLogout,
  title,
  subtitle
}) => {
  const isAr = lang === 'ar';

  return (
    <header className="w-full flex items-center justify-between px-6 py-3 border-b border-border/70 bg-card/60 backdrop-blur-md sticky top-0 z-30">
      {/* Title & Context */}
      <div>
        {title && (
          <h1 className="text-lg font-extrabold text-foreground tracking-tight m-0">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 m-0 font-medium">
            {subtitle}
          </p>
        )}
      </div>

      {/* User Navigation Pill */}
      <div className="flex items-center gap-3">
        <UserNav
          user={currentUser}
          isAr={isAr}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
};

export default Header;

