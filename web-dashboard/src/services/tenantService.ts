import { UserAccount, DEFAULT_USER_ACCOUNTS, BusinessPreset, CompanyFeatures } from '../types/rbac';
import { getAllStoredUsersMaster, saveStoredUsers, getScopedKey } from './storageService';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  currency: string;
  plan: 'Starter' | 'Pro' | 'Enterprise';
  expiresAt: string;
  maxBranches: number;
  maxUsers: number;
  activeBranchesCount: number;
  activeUsersCount: number;
  isActive: boolean;
  createdAt: string;
  adminFullName: string;
  adminUsername: string;
  contactInfo?: string;
  subscriptionTerm?: 'trial_14' | 'annual_12' | 'monthly_1';
  businessPreset?: BusinessPreset;
  businessPresetName?: string;
  features?: CompanyFeatures;
}

export const BUSINESS_PRESETS_CONFIG: Record<BusinessPreset, { nameAr: string; nameEn: string; descriptionAr: string; features: CompanyFeatures }> = {
  Grocery: {
    nameAr: 'سوبرماركت وبقالة غذائية',
    nameEn: 'Grocery & Supermarket',
    descriptionAr: 'نقاط بيع سريعة مع موازين باركود وتواريخ صلاحية ومستودع رئيسي مباشر',
    features: {
      enablePOS: true,
      multiWarehouse: false,
      maxWarehouses: 1,
      enableInstallments: false,
      enableSerialNumbers: false,
      enableVariants: false,
      enableMultiCurrency: false,
      enableCreditLimits: false,
      enableBarcodeScales: true,
      enableExpiryDates: true,
    }
  },
  Electronics: {
    nameAr: 'إلكترونيات وأجهزة ذكية',
    nameEn: 'Electronics & Mobile',
    descriptionAr: 'تتبع سيريال وIMEI، أقساط، عملات متعددة وتعدد مستودعات وائتمان',
    features: {
      enablePOS: true,
      multiWarehouse: true,
      maxWarehouses: 5,
      enableInstallments: true,
      enableSerialNumbers: true,
      enableVariants: false,
      enableMultiCurrency: true,
      enableCreditLimits: true,
      enableBarcodeScales: true,
      enableExpiryDates: false,
    }
  },
  Fashion: {
    nameAr: 'أزياء وملابس ومقاسات',
    nameEn: 'Fashion & Apparel',
    descriptionAr: 'نقاط بيع، مصفوفة المقاسات والألوان مع واجهة بيع مبسطة',
    features: {
      enablePOS: true,
      multiWarehouse: false,
      maxWarehouses: 1,
      enableInstallments: false,
      enableSerialNumbers: false,
      enableVariants: true,
      enableMultiCurrency: false,
      enableCreditLimits: false,
      enableBarcodeScales: true,
      enableExpiryDates: false,
    }
  },
  Hardware: {
    nameAr: 'مواد بناء وإنشائية',
    nameEn: 'Hardware & Construction',
    descriptionAr: 'تعدد مستودعات، حدود ائتمانية وحسابات ذمم، عملات صرف متقلبة',
    features: {
      enablePOS: false,
      multiWarehouse: true,
      maxWarehouses: 10,
      enableInstallments: false,
      enableSerialNumbers: false,
      enableVariants: false,
      enableMultiCurrency: true,
      enableCreditLimits: true,
      enableBarcodeScales: true,
      enableExpiryDates: false,
    }
  },
  Wholesale: {
    nameAr: 'تجارة جملة وتوزيع',
    nameEn: 'Wholesale & Distribution',
    descriptionAr: 'مستودعات متعددة، ذمم وائتمان، مقاسات وطرود، عملات متعددة',
    features: {
      enablePOS: false,
      multiWarehouse: true,
      maxWarehouses: 10,
      enableInstallments: false,
      enableSerialNumbers: false,
      enableVariants: true,
      enableMultiCurrency: true,
      enableCreditLimits: true,
      enableBarcodeScales: true,
      enableExpiryDates: false,
    }
  },
  Custom: {
    nameAr: 'مخصص (تكوين يدوي كامل)',
    nameEn: 'Custom Configuration',
    descriptionAr: 'تخصيص حر لكافة مفاتيح التشغيل والعزل التشغيلي',
    features: {
      enablePOS: true,
      multiWarehouse: true,
      maxWarehouses: 5,
      enableInstallments: true,
      enableSerialNumbers: false,
      enableVariants: false,
      enableMultiCurrency: true,
      enableCreditLimits: true,
      enableBarcodeScales: true,
      enableExpiryDates: false,
    }
  }
};

export const createDefaultFeaturesForPreset = (preset: BusinessPreset): CompanyFeatures => {
  const conf = BUSINESS_PRESETS_CONFIG[preset] || BUSINESS_PRESETS_CONFIG.Custom;
  return { ...conf.features };
};

const STORAGE_KEY_TENANTS = 'zilox_saas_tenants_registry_v1';

export const INITIAL_DEMO_TENANTS: Tenant[] = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'مؤسسة مصطفى للتجارة والحلول البرمجية',
    slug: 'm',
    countryCode: 'IQ',
    currency: 'IQD',
    plan: 'Enterprise',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    maxBranches: 10,
    maxUsers: 30,
    activeBranchesCount: 1,
    activeUsersCount: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    adminFullName: 'مصطفى قاسم',
    adminUsername: 'admin@m',
    businessPreset: 'Electronics',
    businessPresetName: 'إلكترونيات وأجهزة ذكية',
    features: createDefaultFeaturesForPreset('Electronics')
  }
];

export const formatExpiryDate = (dateString: string, isAr: boolean = true) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat(isAr ? 'ar-IQ' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date); // e.g. 23 شباط 2027
  } catch {
    return dateString;
  }
};

export function getStoredTenants(): Tenant[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_TENANTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TENANTS);
    if (!raw) {
      saveStoredTenants(INITIAL_DEMO_TENANTS);
      return INITIAL_DEMO_TENANTS;
    }
    const parsed = JSON.parse(raw);
    let list: Tenant[] = Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DEMO_TENANTS;
    // Purge fake demo tenants from storage
    const cleaned = list.filter(t => t && t.slug !== 'baghdad' && t.slug !== 'erbil' && t.slug !== 'basra');
    if (cleaned.length !== list.length) {
      saveStoredTenants(cleaned.length > 0 ? cleaned : INITIAL_DEMO_TENANTS);
      list = cleaned.length > 0 ? cleaned : INITIAL_DEMO_TENANTS;
    }
    return list.map(t => {
      const preset: BusinessPreset = t.businessPreset || 'Custom';
      return {
        ...t,
        name: t.name.replace(/\s*\(معلقة\)\s*/g, '').trim(),
        businessPreset: preset,
        businessPresetName: BUSINESS_PRESETS_CONFIG[preset]?.nameAr || 'مخصص',
        features: t.features || createDefaultFeaturesForPreset(preset)
      };
    });
  } catch (err) {
    console.error('Failed to load tenants from storage', err);
    return INITIAL_DEMO_TENANTS;
  }
}

export function saveStoredTenants(tenants: Tenant[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_TENANTS, JSON.stringify(tenants));
  } catch (err) {
    console.error('Failed to save tenants', err);
  }
}

export function toggleTenantStatus(tenantId: string): { success: boolean; tenant?: Tenant; message: string } {
  const tenants = getStoredTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx === -1) {
    return { success: false, message: 'المنشأة غير موجودة' };
  }

  tenants[idx].isActive = !tenants[idx].isActive;
  saveStoredTenants(tenants);

  return {
    success: true,
    tenant: tenants[idx],
    message: tenants[idx].isActive
      ? `تم تفعيل حساب منشأة "${tenants[idx].name}" بنجاح.`
      : `تم تعليق حساب منشأة "${tenants[idx].name}" بنجاح.`
  };
}

export function updateTenantQuotas(
  tenantId: string, 
  maxBranches: number, 
  maxUsers: number
): { success: boolean; tenant?: Tenant; message: string } {
  const tenants = getStoredTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx === -1) {
    return { success: false, message: 'المنشأة غير موجودة' };
  }

  tenants[idx].maxBranches = maxBranches;
  tenants[idx].maxUsers = maxUsers;
  saveStoredTenants(tenants);

  return {
    success: true,
    tenant: tenants[idx],
    message: `تم تحديث الحصص لمنشأة "${tenants[idx].name}" (الفروع: ${maxBranches}، المستخدمين: ${maxUsers}).`
  };
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  countryCode: string;
  currency: string;
  plan: 'Starter' | 'Pro' | 'Enterprise';
  subscriptionTerm?: 'trial_14' | 'annual_12' | 'monthly_1';
  contactInfo?: string;
  maxBranches: number;
  maxUsers: number;
  adminFullName: string;
  adminUsername: string;
  adminPassword: string;
}

export function createNewTenant(input: CreateTenantInput): { success: boolean; tenant?: Tenant; message: string } {
  const tenants = getStoredTenants();
  const cleanSlug = input.slug.trim().toLowerCase();

  if (tenants.some(t => t.slug.toLowerCase() === cleanSlug)) {
    return { success: false, message: `رمز المنشأة (${cleanSlug}) محجوز مسبقاً، يرجى اختيار رمز آخر.` };
  }

  const newTenantId = `tenant-${Date.now().toString(36)}`;
  const fullAdminUsername = `${input.adminUsername.trim().toLowerCase()}@${cleanSlug}`;

  // Calculate expiration based on subscription term
  let termDays = 30; // default 1 month
  if (input.subscriptionTerm === 'trial_14') {
    termDays = 14;
  } else if (input.subscriptionTerm === 'annual_12') {
    termDays = 365;
  } else if (input.subscriptionTerm === 'monthly_1') {
    termDays = 30;
  }

  const expiresAt = new Date(Date.now() + termDays * 24 * 60 * 60 * 1000).toISOString();

  const newTenant: Tenant = {
    id: newTenantId,
    name: input.name.trim(),
    slug: cleanSlug,
    countryCode: input.countryCode || 'US',
    currency: input.currency || 'USD',
    plan: input.plan || 'Pro',
    subscriptionTerm: input.subscriptionTerm || 'annual_12',
    contactInfo: input.contactInfo?.trim() || '',
    expiresAt,
    maxBranches: input.maxBranches || 3,
    maxUsers: input.maxUsers || 10,
    activeBranchesCount: 1,
    activeUsersCount: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    adminFullName: input.adminFullName.trim(),
    adminUsername: fullAdminUsername
  };

  tenants.unshift(newTenant);
  saveStoredTenants(tenants);

  // Initialize strictly isolated storage records for this newly created tenant
  if (typeof window !== 'undefined') {
    localStorage.setItem(getScopedKey('products', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('invoices', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('transactions', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('purchase_invoices', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('stock_counts', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('suppliers', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('warehouses', cleanSlug), JSON.stringify([
      {
        id: 'WH-01',
        code: 'WH-01',
        nameAr: 'المستودع الرئيسي',
        nameEn: 'Main Warehouse',
        country: input.countryCode || 'Global',
        countryCode: input.countryCode || 'US',
        state: 'المركز',
        city: 'المقر الرئيسي',
        cityAr: 'المقر الرئيسي',
        cityEn: 'Headquarters',
        address: 'المقر الإداري والمخازن المركزية',
        postalCode: '10001',
        timezone: input.countryCode === 'IQ' ? 'Asia/Baghdad (UTC+3)' : 'UTC',
        currency: `${input.currency || 'USD'}`,
        storageType: 'rdc_general',
        manager: input.adminFullName.trim(),
        managerEn: input.adminFullName.trim(),
        phone: input.contactInfo?.trim() || '',
        capacity: 10000,
        occupied: 0,
        itemsCount: 0,
        status: 'active'
      }
    ]));
    localStorage.setItem(getScopedKey('treasury_accounts', cleanSlug), JSON.stringify([
      { 
        id: 'ACC-01', 
        name: 'Main Cash Safe', 
        nameAr: 'صندوق الكاش الرئيسي', 
        nameEn: 'Main Cash Safe', 
        type: 'CASH', 
        balanceUsd: 0, 
        balanceIqd: 0, 
        currency: `${input.currency || 'USD'}` 
      }
    ]));
  }

  // Seed the first admin user in users store
  const existingUsers = getAllStoredUsersMaster();
  const contact = input.contactInfo?.trim() || '';
  const isEmail = contact.includes('@');
  const newAdminAccount: UserAccount = {
    id: `USR-ADMIN-${Date.now().toString(36).toUpperCase()}`,
    fullName: input.adminFullName.trim(),
    username: fullAdminUsername,
    password: input.adminPassword || '123',
    email: isEmail ? contact : `${input.adminUsername.trim().toLowerCase()}@${cleanSlug}.zilox.com`,
    phone: !isEmail && contact ? contact : '',
    role: 'SuperAdmin',
    branchId: 'ALL',
    branchName: 'كافة الفروع والمستودعات',
    defaultWarehouseId: 'WH-01',
    assignedBranches: ['WH-01'],
    tenantSlug: cleanSlug,
    tenantName: newTenant.name,
    isActive: true,
    createdAt: new Date().toISOString().split('T')[0],
    notes: 'حساب المدير الأول المنشأ آلياً عند تسجيل الشركة'
  };

  existingUsers.push(newAdminAccount);
  saveStoredUsers(existingUsers);

  return {
    success: true,
    tenant: newTenant,
    message: `تم إنشاء منشأة "${newTenant.name}" وتأسيس حساب المدير (${fullAdminUsername}) بنجاح.`
  };
}

export interface SelfServiceRegisterInput {
  companyName: string;
  slug: string;
  countryCode: string;
  currency: string;
  plan?: 'Starter' | 'Pro' | 'Enterprise';
  maxWarehouses: number;
  maxUsers: number;
  wmsEnabled: boolean;
  posEnabled: boolean;
  billingCycle: 'monthly' | 'yearly';
  adminFullName: string;
  adminUsername: string;
  adminPassword: string;
  contactInfo?: string;
}

export async function checkSlugAvailabilityApi(slug: string): Promise<{ isAvailable: boolean; message: string }> {
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug) {
    return { isAvailable: false, message: 'رمز المنشأة مطلوب' };
  }

  // 1. Check local storage first
  const localTenants = getStoredTenants();
  if (localTenants.some(t => t.slug.toLowerCase() === cleanSlug)) {
    return { 
      isAvailable: false, 
      message: `الرمز (@${cleanSlug}) محجوز مسبقاً، يرجى اختيار رمز آخر.` 
    };
  }

  // 2. Check backend API if available
  try {
    const res = await fetch(`/api/v1/public/tenants/check-slug/${encodeURIComponent(cleanSlug)}`);
    if (res.ok) {
      const data = await res.json();
      return { isAvailable: data.isAvailable, message: data.message };
    }
  } catch {
    // API not reachable in pure static demo mode, local check is authoritative
  }

  return { isAvailable: true, message: `الرمز (@${cleanSlug}) متاح للاستخدام!` };
}

export async function registerSelfServiceTenant(input: SelfServiceRegisterInput): Promise<{
  success: boolean;
  tenant?: Tenant;
  userAccount?: UserAccount;
  userProfile?: import('../types/rbac').UserProfile;
  token?: string;
  message: string;
}> {
  const cleanSlug = input.slug.trim().toLowerCase();
  const cleanAdmin = (input.adminUsername || 'admin').trim().toLowerCase().replace(/@.+$/, '');
  const fullUsername = `${cleanAdmin}@${cleanSlug}`;

  // First check slug availability locally
  const tenants = getStoredTenants();
  if (tenants.some(t => t.slug.toLowerCase() === cleanSlug)) {
    return {
      success: false,
      message: `رمز المنشأة المختصر (@${cleanSlug}) محجوز مسبقاً، يرجى اختيار رمز آخر.`
    };
  }

  // Calculate plan tier based on explicit input or quotas
  let planTier: 'Starter' | 'Pro' | 'Enterprise' = input.plan || 'Pro';
  if (!input.plan) {
    if (input.maxWarehouses > 5 || input.maxUsers > 20) {
      planTier = 'Enterprise';
    } else if (input.maxWarehouses > 1 || input.maxUsers > 5) {
      planTier = 'Pro';
    } else {
      planTier = 'Starter';
    }
  }

  // 14-day trial expiration
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // Attempt backend API call
  let backendToken: string | undefined;
  try {
    const res = await fetch('/api/v1/public/tenants/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: input.companyName.trim(),
        slug: cleanSlug,
        countryCode: input.countryCode || 'US',
        currency: input.currency || 'USD',
        maxWarehouses: input.maxWarehouses || 1,
        maxUsers: input.maxUsers || 3,
        wmsEnabled: input.wmsEnabled,
        posEnabled: input.posEnabled,
        billingCycle: input.billingCycle || 'yearly',
        adminFullName: input.adminFullName.trim(),
        adminUsername: cleanAdmin,
        adminPassword: input.adminPassword,
        contactInfo: input.contactInfo?.trim() || ''
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        backendToken = data.token;
      }
    }
  } catch {
    // If backend isn't reachable during client demo, proceed with local persistence
  }

  // Persist locally for instant seamless authentication in the client SPA
  const newTenant: Tenant = {
    id: `tenant-${Date.now().toString(36)}`,
    name: input.companyName.trim(),
    slug: cleanSlug,
    countryCode: input.countryCode || 'US',
    currency: input.currency || 'USD',
    plan: planTier,
    subscriptionTerm: 'trial_14',
    contactInfo: input.contactInfo?.trim() || '',
    expiresAt: trialEndsAt,
    maxBranches: input.maxWarehouses || 1,
    maxUsers: input.maxUsers || 3,
    activeBranchesCount: 1,
    activeUsersCount: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    adminFullName: input.adminFullName.trim(),
    adminUsername: fullUsername
  };

  tenants.unshift(newTenant);
  saveStoredTenants(tenants);

  // Initialize strictly isolated storage records for this new tenant
  if (typeof window !== 'undefined') {
    localStorage.setItem(getScopedKey('products', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('invoices', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('transactions', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('purchase_invoices', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('stock_counts', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('suppliers', cleanSlug), JSON.stringify([]));
    localStorage.setItem(getScopedKey('warehouses', cleanSlug), JSON.stringify([
      {
        id: 'WH-01',
        code: 'WH-01',
        nameAr: 'المستودع الرئيسي',
        nameEn: 'Main Warehouse',
        country: input.countryCode || 'Global',
        countryCode: input.countryCode || 'US',
        state: 'المركز',
        city: 'المقر الرئيسي',
        cityAr: 'المقر الرئيسي',
        cityEn: 'Headquarters',
        address: 'المقر الإداري والمخازن المركزية',
        postalCode: '10001',
        timezone: input.countryCode === 'IQ' ? 'Asia/Baghdad (UTC+3)' : 'UTC',
        currency: `${input.currency || 'USD'}`,
        storageType: 'rdc_general',
        manager: input.adminFullName.trim(),
        managerEn: input.adminFullName.trim(),
        phone: input.contactInfo?.trim() || '',
        capacity: 10000,
        occupied: 0,
        itemsCount: 0,
        status: 'active'
      }
    ]));
    localStorage.setItem(getScopedKey('treasury_accounts', cleanSlug), JSON.stringify([
      { 
        id: 'ACC-01', 
        name: 'Main Cash Safe', 
        nameAr: 'صندوق الكاش الرئيسي', 
        nameEn: 'Main Cash Safe', 
        type: 'CASH', 
        balanceUsd: 0, 
        balanceIqd: 0, 
        currency: `${input.currency || 'USD'}` 
      }
    ]));
  }

  // Create admin user account
  const existingUsers = getAllStoredUsersMaster();
  const contact = input.contactInfo?.trim() || '';
  const isEmail = contact.includes('@');
  
  const newAdminAccount: UserAccount = {
    id: `USR-ADMIN-${Date.now().toString(36).toUpperCase()}`,
    fullName: input.adminFullName.trim(),
    username: fullUsername,
    password: input.adminPassword || '123',
    email: isEmail ? contact : `${cleanAdmin}@${cleanSlug}.zilox.com`,
    phone: !isEmail && contact ? contact : '',
    role: 'SuperAdmin',
    branchId: 'WH-01',
    branchName: 'المستودع الرئيسي',
    defaultWarehouseId: 'WH-01',
    assignedBranches: ['WH-01'],
    tenantSlug: cleanSlug,
    tenantName: newTenant.name,
    isActive: true,
    createdAt: new Date().toISOString().split('T')[0],
    notes: 'حساب مالك المنشأة الأول المنشأ آلياً عبر بوابة التسجيل الذاتي (تجربة 14 يوماً)'
  };

  existingUsers.push(newAdminAccount);
  saveStoredUsers(existingUsers);

  const { buildUserProfileFromAccount } = await import('../types/rbac');
  const userProfile = buildUserProfileFromAccount(newAdminAccount);
  userProfile.tenantSlug = cleanSlug;
  userProfile.tenantName = newTenant.name;

  return {
    success: true,
    tenant: newTenant,
    userAccount: newAdminAccount,
    userProfile,
    token: backendToken,
    message: `تهانينا! تم إنشاء حساب منشأة "${newTenant.name}" بنجاح، وتفعيل فترة التجربة المجانية لمدة 14 يوماً.`
  };
}

export function getPlatformMetrics() {
  const tenants = getStoredTenants();
  const total = tenants.length;
  const active = tenants.filter(t => t.isActive).length;
  const suspended = total - active;
  
  const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const expiringSoon = tenants.filter(t => {
    const exp = new Date(t.expiresAt).getTime();
    return t.isActive && exp > Date.now() && exp <= sevenDaysFromNow;
  }).length;

  const totalBranches = tenants.reduce((acc, t) => acc + t.activeBranchesCount, 0);
  const totalUsers = tenants.reduce((acc, t) => acc + t.activeUsersCount, 0);

  return {
    totalTenants: total,
    activeTenants: active,
    suspendedTenants: suspended,
    expiringSoonTenants: expiringSoon,
    totalBranches,
    totalUsers
  };
}

export function updateTenantPlan(
  tenantId: string,
  newPlan: 'Starter' | 'Pro' | 'Enterprise'
): { success: boolean; tenant?: Tenant; message: string } {
  const tenants = getStoredTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx === -1) {
    return { success: false, message: 'المنشأة غير موجودة' };
  }

  tenants[idx].plan = newPlan;
  saveStoredTenants(tenants);

  return {
    success: true,
    tenant: tenants[idx],
    message: `تم ترقية وتعديل باقة المنشأة "${tenants[idx].name}" إلى (${newPlan}) بنجاح.`
  };
}

export function deleteTenant(tenantId: string): { success: boolean; message: string } {
  const tenants = getStoredTenants();
  const target = tenants.find(t => t.id === tenantId);
  if (!target) {
    return { success: false, message: 'المنشأة غير موجودة' };
  }

  const updated = tenants.filter(t => t.id !== tenantId);
  saveStoredTenants(updated);

  return {
    success: true,
    message: `تم حذف المنشأة "${target.name}" نهائياً من سجلات المنصة.`
  };
}

export function getTenantById(tenantId: string): Tenant | null {
  const tenants = getStoredTenants();
  return tenants.find(t => t.id === tenantId || t.slug === tenantId) || null;
}

export async function updateTenantPreset(
  tenantId: string, 
  preset: BusinessPreset
): Promise<{ success: boolean; tenant?: Tenant; message: string }> {
  const tenants = getStoredTenants();
  const idx = tenants.findIndex(t => t.id === tenantId || t.slug === tenantId);
  if (idx === -1) {
    return { success: false, message: 'المنشأة غير موجودة' };
  }

  const target = tenants[idx];
  const newFeatures = createDefaultFeaturesForPreset(preset);
  target.businessPreset = preset;
  target.businessPresetName = BUSINESS_PRESETS_CONFIG[preset]?.nameAr || 'مخصص';
  target.features = newFeatures;

  saveStoredTenants(tenants);

  // Attempt backend API call with instantaneous Redis invalidation
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
    await fetch(`/api/super-admin/tenants/${target.id}/preset`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ preset })
    });
  } catch {
    // Continue with local storage persistence
  }

  // Update current session if the active user belongs to this tenant
  if (typeof window !== 'undefined') {
    const sessionRaw = localStorage.getItem('zilox_auth_session');
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        if (session.tenantId === target.id || session.tenantSlug === target.slug) {
          session.businessPreset = preset;
          session.businessPresetName = target.businessPresetName;
          session.features = newFeatures;
          localStorage.setItem('zilox_auth_session', JSON.stringify(session));
          window.dispatchEvent(new CustomEvent('zilox_query_invalidate', { detail: { queryKey: ['currentUser', 'auth'] } }));
        }
      } catch {}
    }
  }

  return {
    success: true,
    tenant: target,
    message: `تم تطبيق باقة (${BUSINESS_PRESETS_CONFIG[preset]?.nameAr || preset}) لمنشأة "${target.name}" بنجاح.`
  };
}

export async function updateTenantFeatures(
  tenantId: string,
  features: Partial<CompanyFeatures>
): Promise<{ success: boolean; tenant?: Tenant; message: string }> {
  const tenants = getStoredTenants();
  const idx = tenants.findIndex(t => t.id === tenantId || t.slug === tenantId);
  if (idx === -1) {
    return { success: false, message: 'المنشأة غير موجودة' };
  }

  const target = tenants[idx];
  const currentFeatures = target.features || createDefaultFeaturesForPreset(target.businessPreset || 'Custom');
  const mergedFeatures: CompanyFeatures = {
    ...currentFeatures,
    ...features
  };

  target.businessPreset = 'Custom';
  target.businessPresetName = BUSINESS_PRESETS_CONFIG.Custom.nameAr;
  target.features = mergedFeatures;

  saveStoredTenants(tenants);

  // Call backend API for Redis sync
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
    await fetch(`/api/super-admin/tenants/${target.id}/features`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(mergedFeatures)
    });
  } catch {
    // Continue
  }

  // Update current session if matching
  if (typeof window !== 'undefined') {
    const sessionKeys = ['logistock_erp_v3_auth_session', 'zilox_auth_session'];
    sessionKeys.forEach(k => {
      const sessionRaw = localStorage.getItem(k);
      if (sessionRaw) {
        try {
          const session = JSON.parse(sessionRaw);
          if (session.tenantId === target.id || session.tenantSlug === target.slug || !session.tenantId) {
            session.businessPreset = 'Custom';
            session.businessPresetName = BUSINESS_PRESETS_CONFIG.Custom.nameAr;
            session.features = mergedFeatures;
            localStorage.setItem(k, JSON.stringify(session));
          }
        } catch {}
      }
    });

    // Also sync multiCurrencyEnabled in user preferences
    try {
      const prefsRaw = localStorage.getItem('zilox_user_preferences');
      if (prefsRaw) {
        const prefs = JSON.parse(prefsRaw);
        if (typeof mergedFeatures.enableMultiCurrency === 'boolean') {
          prefs.multiCurrencyEnabled = mergedFeatures.enableMultiCurrency;
          localStorage.setItem('zilox_user_preferences', JSON.stringify(prefs));
        }
      }
    } catch {}

    window.dispatchEvent(new CustomEvent('zilox_query_invalidate', { detail: { queryKey: ['currentUser', 'auth'] } }));
  }

  return {
    success: true,
    tenant: target,
    message: `تم حفظ مفاتيح التشغيل المخصصة لمنشأة "${target.name}" بنجاح وتحديث الكاش اللحظي.`
  };
}
