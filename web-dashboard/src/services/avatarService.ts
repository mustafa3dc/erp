export interface CuratedMemoji {
  id: string;
  nameAr: string;
  nameEn: string;
  url: string;
  category: 'executive' | 'finance' | 'sales' | 'logistics' | 'tech';
}

export const CURATED_MEMOJIS: CuratedMemoji[] = [
  { id: 'memoji-01', nameAr: 'المدير التنفيذي الكلاسيكي', nameEn: 'Executive Navy', url: '/avatars/memoji-01.png', category: 'executive' },
  { id: 'memoji-02', nameAr: 'المشرف الإداري الأرجواني', nameEn: 'Operations Violet', url: '/avatars/memoji-02.png', category: 'executive' },
  { id: 'memoji-03', nameAr: 'المحاسب المالي بنظارات', nameEn: 'Financial Auditor', url: '/avatars/memoji-03.png', category: 'finance' },
  { id: 'memoji-04', nameAr: 'كاشير المبيعات بالسماعة', nameEn: 'POS Cashier Specialist', url: '/avatars/memoji-04.png', category: 'sales' },
  { id: 'memoji-05', nameAr: 'أمين المستودع بالخوذة', nameEn: 'Warehouse Custodian', url: '/avatars/memoji-05.png', category: 'logistics' },
  { id: 'memoji-06', nameAr: 'مدير المبيعات الزمردي', nameEn: 'Sales Lead Emerald', url: '/avatars/memoji-06.png', category: 'sales' },
  { id: 'memoji-07', nameAr: 'المشرف النيلي الفخم', nameEn: 'Supervisor Indigo', url: '/avatars/memoji-07.png', category: 'executive' },
  { id: 'memoji-08', nameAr: 'خدمة العملاء الياقوتي', nameEn: 'Customer Success Ruby', url: '/avatars/memoji-08.png', category: 'sales' },
  { id: 'memoji-09', nameAr: 'مسؤول التدقيق والجرد', nameEn: 'Inventory Auditor Amber', url: '/avatars/memoji-09.png', category: 'logistics' },
  { id: 'memoji-10', nameAr: 'مسؤول الحماية والأمان', nameEn: 'Security & Audit Slate', url: '/avatars/memoji-10.png', category: 'tech' },
  { id: 'memoji-11', nameAr: 'مدير العمليات الوردي', nameEn: 'Operations Rose', url: '/avatars/memoji-11.png', category: 'executive' },
  { id: 'memoji-12', nameAr: 'موظف صالة العرض السماوي', nameEn: 'Showroom Clerk Cyan', url: '/avatars/memoji-12.png', category: 'sales' },
  { id: 'memoji-13', nameAr: 'المدير العام الملكي', nameEn: 'General Manager Sapphire', url: '/avatars/memoji-13.png', category: 'executive' },
  { id: 'memoji-14', nameAr: 'محلل البيانات الأخضر', nameEn: 'Data Analyst Emerald', url: '/avatars/memoji-14.png', category: 'finance' },
  { id: 'memoji-15', nameAr: 'مسؤول الإرسال اللوجستي', nameEn: 'Dispatch Coordinator', url: '/avatars/memoji-15.png', category: 'logistics' },
  { id: 'memoji-16', nameAr: 'المهندس البرمجي البنفسجي', nameEn: 'System Architect Purple', url: '/avatars/memoji-16.png', category: 'tech' }
];

/**
 * Returns the smart role-based default avatar URL when a new account is created or reset
 */
export function getRoleDefaultAvatar(role?: string): string {
  const r = (role || '').toLowerCase();
  if (r.includes('superadmin') || r.includes('platform') || r.includes('admin') || r.includes('manager') || r.includes('owner')) {
    return '/avatars/memoji-01.png';
  }
  if (r.includes('cashier')) {
    return '/avatars/memoji-04.png';
  }
  if (r.includes('store') || r.includes('warehouse') || r.includes('stock')) {
    return '/avatars/memoji-05.png';
  }
  if (r.includes('accountant') || r.includes('finance')) {
    return '/avatars/memoji-03.png';
  }
  return '/avatars/memoji-01.png';
}

/**
 * Resolves the avatar URL for a user with smart role-based default and safe fallback
 */
export function resolveUserAvatar(user?: { avatarUrl?: string; avatarId?: string; role?: string } | null): string {
  if (user?.avatarUrl && user.avatarUrl.trim() !== '') {
    return user.avatarUrl;
  }
  if (user?.avatarId && user.avatarId.trim() !== '') {
    return `/avatars/${user.avatarId}.png`;
  }
  return getRoleDefaultAvatar(user?.role);
}
