import React, { useState, useEffect } from 'react';
import {
  DialogPortal,
  DialogOverlay,
  DialogContent
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Smile, Check, RotateCcw, X, Shield } from 'lucide-react';
import { UserAccount } from '../../types/rbac';
import { CURATED_MEMOJIS, getRoleDefaultAvatar, resolveUserAvatar } from '../../services/avatarService';
import { queryClient } from '../../hooks/useUsersQuery';
import { updateUserAccount, getAllStoredUsersMaster } from '../../services/storageService';
import RoleBadge from '../ui/RoleBadge';

export interface EditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserAccount | null;
  showToast: (msg: string) => void;
  onSaved?: () => void;
}

export const EditStaffModal: React.FC<EditStaffModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  showToast,
  onSaved
}) => {
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (targetUser) {
      setSelectedUrl(resolveUserAvatar(targetUser));
    }
  }, [targetUser]);

  if (!isOpen || !targetUser) return null;

  const currentRoleDefault = getRoleDefaultAvatar(targetUser.role);

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

  const handleSave = async () => {
    if (!targetUser) return;
    setIsSaving(true);
    try {
      // 1. Update in local storage
      const masterUsers = getAllStoredUsersMaster();
      const existing = masterUsers.find(u => u.id === targetUser.id);
      if (existing) {
        updateUserAccount({
          ...existing,
          avatarUrl: selectedUrl
        });
      }

      // 2. Call backend PATCH API
      const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
      try {
        await fetch(`/api/v1/users/${targetUser.id}/avatar`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ avatarUrl: selectedUrl })
        });
      } catch {
        // Safe offline fallback
      }

      // 3. Invalidate React Query cache
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] });

      showToast(`تم تحديث الصورة الشخصية للموظف (${targetUser.fullName})`);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء حفظ التعديل');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent
        className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl p-6 text-foreground"
        style={{ maxWidth: '640px' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Smile className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground m-0">
                تخصيص المظهر والأفاتار للموظف
              </h3>
              <p className="text-xs text-muted-foreground m-0 mt-0.5">
                تحديد شخصية الميموجي ثلاثية الأبعاد للموظف: <strong className="text-foreground">{targetUser.fullName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Preview Card */}
        <div className="my-4 p-4 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-full ring-2 ring-primary/40 overflow-hidden bg-background shadow-md flex items-center justify-center shrink-0">
              <img
                src={selectedUrl || currentRoleDefault}
                alt="Selected Memoji Preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/avatars/memoji-01.png';
                }}
              />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground m-0 leading-tight">
                {targetUser.fullName}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <RoleBadge role={targetUser.role} isAr={true} />
                <span className="text-xs font-mono text-muted-foreground">
                  {targetUser.username}
                </span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
            className="text-xs font-medium gap-1.5 h-8 border-border hover:bg-background"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            <span>افتراضي الرتبة</span>
          </Button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat.key
                  ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 16 Memojis Gallery Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3 my-4 max-h-[260px] overflow-y-auto p-1 scrollbar-thin">
          {filteredMemojis.map(memoji => {
            const isSelected = selectedUrl === memoji.url;
            return (
              <button
                key={memoji.id}
                type="button"
                onClick={() => setSelectedUrl(memoji.url)}
                className={`relative group flex flex-col items-center p-2 rounded-xl transition-all cursor-pointer border ${
                  isSelected
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/40 shadow-xs scale-105'
                    : 'border-border/60 bg-card hover:bg-muted/40 hover:border-primary/50'
                }`}
                title={`${memoji.nameAr} (${memoji.nameEn})`}
              >
                <div className="relative h-12 w-12 rounded-full overflow-hidden bg-background border border-border/50">
                  <img
                    src={memoji.url}
                    alt={memoji.nameAr}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-200"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/avatars/memoji-01.png';
                    }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 truncate max-w-full font-medium">
                  {memoji.id.replace('memoji-', '#')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs h-9 px-4 font-medium"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs h-9 px-5 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            {isSaving ? 'جارٍ الحفظ...' : 'حفظ المظهر الجديد'}
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  );
};

export default EditStaffModal;

