import React, { useState } from 'react';
import {
  DialogPortal,
  DialogOverlay,
  DialogContent
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Sparkles, Check, RotateCcw, X, Smile } from 'lucide-react';
import { UserProfile } from '../../types/rbac';
import { CURATED_MEMOJIS, getRoleDefaultAvatar, resolveUserAvatar, CuratedMemoji } from '../../services/avatarService';
import { queryClient } from '../../hooks/useUsersQuery';
import { safeSet, KEYS, updateUserAccount, getStoredUsers } from '../../services/storageService';

export interface ProfileAvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  showToast: (msg: string) => void;
  onAvatarSaved?: (newAvatarUrl: string) => void;
}

export const ProfileAvatarPicker: React.FC<ProfileAvatarPickerProps> = ({
  isOpen,
  onClose,
  currentUser,
  showToast,
  onAvatarSaved
}) => {
  const [selectedUrl, setSelectedUrl] = useState<string>(() => resolveUserAvatar(currentUser));
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const currentRoleDefault = getRoleDefaultAvatar(currentUser.role);

  const categories = [
    { key: 'all', label: 'كافة المعرض (16)' },
    { key: 'executive', label: 'إداري وتنفيذي' },
    { key: 'finance', label: 'مالية وحسابات' },
    { key: 'sales', label: 'مبيعات وكاشير' },
    { key: 'logistics', label: 'مستودعات وشحن' },
    { key: 'tech', label: 'رقابة وتقنية' }
  ];

  const filteredMemojis = CURATED_MEMOJIS.filter(m => {
    if (activeCategory === 'all') return true;
    return m.category === activeCategory;
  });

  const handleResetToDefault = () => {
    setSelectedUrl(currentRoleDefault);
    showToast('تمت استعادة الأفاتار الافتراضي للرتبة');
  };

  const handleSaveAvatar = async () => {
    setIsSaving(true);
    try {
      // 1. Update session in storage
      const updatedUser: UserProfile = {
        ...currentUser,
        avatarUrl: selectedUrl
      };
      safeSet(KEYS.AUTH_SESSION, updatedUser);

      // Also sync user account in users master list
      const all = getStoredUsers();
      const existing = all.find(u => u.id === currentUser.id);
      if (existing) {
        updateUserAccount({
          ...existing,
          avatarUrl: selectedUrl
        });
      }

      // 2. Call backend API
      const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
      try {
        await fetch(`/api/v1/users/${currentUser.id}/avatar`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ avatarUrl: selectedUrl })
        });
      } catch {
        // Fallback gracefully
      }

      // 3. Invalidate caches for instant reactive update
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      await queryClient.invalidateQueries({ queryKey: ['users'] });

      showToast('تم تحديث الأفاتار الشخصي وتطبيقه فوراً');
      if (onAvatarSaved) {
        onAvatarSaved(selectedUrl);
      }
      onClose();
    } catch {
      showToast('حدث خطأ أثناء حفظ الأفاتار');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent 
        className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-3xl p-0 text-foreground overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ maxWidth: '680px' }}
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <Smile size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground m-0 leading-tight">
                معرض صور الميموجي ثلاثية الأبعاد (Curated 3D Memojis)
              </h3>
              <p className="text-xs text-muted-foreground mt-1 m-0">
                اختر شكل الميموجي المفضل لحسابك الشخصي بنقرة واحدة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected Preview Banner & Quick Reset */}
        <div className="p-4 px-6 bg-background border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative h-14 w-14 rounded-full ring-2 ring-primary/30 overflow-hidden flex items-center justify-center bg-muted shrink-0 shadow-sm">
              <img
                src={selectedUrl}
                alt="Selected Preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/avatars/memoji-admin.png';
                }}
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium block">الأفاتار المحدد حالياً</span>
              <strong className="text-sm font-bold text-foreground block mt-0.5">
                {CURATED_MEMOJIS.find(m => m.url === selectedUrl)?.nameAr || 'الميموجي الافتراضي للرتبة'}
              </strong>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
            className="h-8 text-xs gap-1.5 border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <RotateCcw size={13} />
            <span>استعادة افتراضي الرتبة</span>
          </Button>
        </div>

        {/* Categories Bar */}
        <div className="px-6 py-2.5 border-b border-border bg-muted/20 flex items-center gap-1.5 overflow-x-auto text-xs select-none">
          {categories.map(cat => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeCategory === cat.key
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="p-6 max-h-[50vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {filteredMemojis.map(memoji => {
              const isSelected = selectedUrl === memoji.url;
              return (
                <div
                  key={memoji.id}
                  onClick={() => setSelectedUrl(memoji.url)}
                  className={`group relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center gap-2 select-none ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2 dark:ring-offset-background shadow-md'
                      : 'border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40 shadow-xs'
                  }`}
                >
                  <div className="relative h-16 w-16 rounded-full overflow-hidden flex items-center justify-center bg-muted/60 shadow-xs transition-transform group-hover:scale-105">
                    <img
                      src={memoji.url}
                      alt={memoji.nameAr}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/avatars/memoji-admin.png';
                      }}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] font-bold text-foreground text-center line-clamp-1 leading-tight mt-1">
                    {memoji.nameAr}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-border bg-muted/30 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 px-4 text-xs font-medium"
          >
            إلغاء
          </Button>

          <Button
            type="button"
            onClick={handleSaveAvatar}
            disabled={isSaving}
            className="h-10 px-5 text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ وتطبيق الأفاتار'}</span>
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  );
};

export default ProfileAvatarPicker;

