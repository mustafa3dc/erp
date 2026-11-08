"use client";

import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, LogOut, Settings, Users, Sparkles } from "lucide-react";
import { UserProfile } from "@/types/rbac";
import { resolveUserAvatar } from "@/services/avatarService";
import { ProfileAvatarPicker } from "./settings/ProfileAvatarPicker";
import { RoleBadge } from "./ui/RoleBadge";

export interface UserNavProps {
  user?: UserProfile | null;
  isAr?: boolean;
  onNavigate?: (route: string) => void;
  onLogout?: () => void;
}

export function UserNav({ user, isAr = true, onNavigate, onLogout }: UserNavProps) {
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  // Safe display attributes fallback: if fullName is generic, fallback to role or username
  const displayName = user?.fullName && !user.fullName.includes('@') && user.fullName.toLowerCase() !== 'admin'
    ? user.fullName
    : (user?.username || (isAr ? 'المستخدم' : 'User'));

  const roleTitle = isAr ? (user?.roleNameAr || 'المدير العام') : (user?.roleNameEn || 'General Manager');

  // Strip any dummy email or domain extensions
  const cleanUsername = (user?.username || 'admin').replace(/@zilox\.app$/i, '');
  const slug = (user?.tenantSlug || 'a').toLowerCase();
  const userHandle = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@${slug}`;

  // Clean company name: avoid raw single letters like "a"
  const rawCompany = user?.tenantName?.trim();
  const isGenericOrSlug = !rawCompany || rawCompany.length <= 1 || rawCompany.toLowerCase() === 'a' || rawCompany === slug;
  const tenantCompany = isGenericOrSlug
    ? (user?.branchName && user.branchName !== 'ALL' ? user.branchName : (isAr ? 'المقر الرئيسي (كافة الفروع)' : 'Headquarters (All Branches)'))
    : rawCompany;

  // Generate 2 initials for the avatar fallback
  const getInitials = (text: string) => {
    if (!text) return 'MO';
    const parts = text.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(displayName);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const handleNav = (route: string, href: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      window.location.href = href;
    }
  };

  return (
    <>
      <DropdownMenu dir="rtl">
        {/* User profile toggle button */}
        <DropdownMenuTrigger asChild>
          <button 
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-card hover:bg-muted/60 text-foreground border border-border/80 transition-all focus:outline-none cursor-pointer shadow-xs select-none"
          >
            {/* حاوية الأفاتار وحالة الاتصال */}
            <div className="relative inline-flex shrink-0">
              {/* دائرة الصورة مع حماية الحواف */}
              <div className="h-10 w-10 rounded-full ring-2 ring-primary/20 overflow-hidden bg-muted flex items-center justify-center">
                <img 
                  src={resolveUserAvatar(user) || "/avatars/memoji-admin.png"} 
                  alt={displayName} 
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
              <span className="absolute bottom-0 end-0 flex h-3 w-3">
                {/* تأثير النبض الراداري الهادئ */}
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 duration-1000" />
                {/* النقطة الزمردية المركزية مع إطار عازل بلون الخلفية */}
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
              </span>
            </div>

            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-foreground leading-none m-0">
                {displayName}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 m-0 font-medium">
                {roleTitle}
              </p>
            </div>
            <ChevronDown 
              className="w-3.5 h-3.5 text-muted-foreground mr-1 shrink-0"
              size={14}
            />
          </button>
        </DropdownMenuTrigger>

        {/* Dropdown Menu content */}
        <DropdownMenuContent 
          align="end" 
          className="w-72 p-0 bg-card text-card-foreground border border-border shadow-2xl rounded-2xl z-50 overflow-hidden" 
          sideOffset={8}
        >
          {/* Menu Header */}
          <div className="p-3.5 bg-muted/30 border-b border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {/* حاوية الأفاتار وحالة الاتصال */}
                <div className="relative inline-flex shrink-0">
                  <div className="h-10 w-10 rounded-full ring-2 ring-primary/25 overflow-hidden flex items-center justify-center bg-muted shrink-0 shadow-xs">
                    <img
                      src={resolveUserAvatar(user) || "/avatars/memoji-admin.png"}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/avatars/memoji-admin.png';
                      }}
                    />
                  </div>

                  <span className="absolute bottom-0 end-0 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 duration-1000" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span className="truncate max-w-[120px]">{displayName}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[140px] font-mono font-medium" dir="ltr">
                    {userHandle}
                  </span>
                </div>
              </div>
              <RoleBadge role={user?.role} isAr={isAr} />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 text-right">
              <Building2 className="w-3.5 h-3.5 text-primary shrink-0" size={14} />
              <span className="truncate font-medium">
                {tenantCompany}
              </span>
            </div>
          </div>

          {/* Navigation items */}
          <div className="p-1.5 flex flex-col gap-0.5">
            {/* Custom Avatar Picker */}
            <DropdownMenuItem 
              onClick={() => setIsAvatarPickerOpen(true)}
              className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-muted focus:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <span>{isAr ? 'تخصيص الأفاتار والصورة الشخصية' : 'Customize Avatar & Memoji'}</span>
              <Sparkles className="w-4 h-4 text-primary" size={15} />
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => handleNav('Users & Staff', '/users')}
              className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-muted focus:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <span>{isAr ? 'إدارة الموظفين والصلاحيات' : 'Staff & Roles'}</span>
              <Users className="w-4 h-4 text-muted-foreground" size={15} />
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => handleNav('Settings', '/settings')}
              className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-muted focus:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <span>{isAr ? 'إعدادات المنظومة والمظهر' : 'System & Appearance'}</span>
              <Settings className="w-4 h-4 text-muted-foreground" size={15} />
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="my-0 bg-border" />

          {/* Logout action */}
          <div className="p-1.5">
            <DropdownMenuItem 
              className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive text-xs font-bold transition-colors" 
              onClick={handleLogout}
            >
              <span>{isAr ? 'تسجيل الخروج' : 'Log Out'}</span>
              <LogOut className="w-4 h-4" size={15} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Self-service Profile Avatar Picker Modal */}
      {user && (
        <ProfileAvatarPicker
          isOpen={isAvatarPickerOpen}
          onClose={() => setIsAvatarPickerOpen(false)}
          currentUser={user}
          showToast={(msg) => console.log(msg)}
        />
      )}
    </>
  );
}

export default UserNav;
