import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  BillingCycle,
  buildPlanFeatureMap,
  normalizeBillingCycle,
  normalizeSubscriptionPlan,
  PLAN_FEATURE_MIN_TIER,
  PLAN_PRICING_MATRIX,
  PlanFeatureKey,
  SubscriptionPlan,
  TenantSubscriptionData,
  TenantSubscriptionUsage,
} from '../types/subscription';
import {
  getStoredAuthSession,
  getStoredUsers,
  getStoredWarehouses,
} from '../services/storageService';
import { getStoredTenants } from '../services/tenantService';

interface TenantPlanContextValue {
  subscription: TenantSubscriptionData | null;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  expiresAt: string | null;
  isExpired: boolean;
  usage: TenantSubscriptionUsage;
  features: Record<PlanFeatureKey, boolean>;
  isLoading: boolean;
  canAccess: (featureKey: PlanFeatureKey) => boolean;
  getRequiredPlan: (featureKey: PlanFeatureKey) => SubscriptionPlan;
  refreshSubscription: () => Promise<void>;
  upgradeModalOpen: boolean;
  upgradeModalRequiredPlan: SubscriptionPlan | null;
  upgradeModalReasonKey: string | null;
  upgradeModalQuotaMeta: { current?: number; max?: number } | null;
  openUpgradeModal: (
    requiredPlan?: SubscriptionPlan,
    reasonKey?: string,
    quotaMeta?: { current?: number; max?: number }
  ) => void;
  closeUpgradeModal: () => void;
}

const TenantPlanContext = createContext<TenantPlanContextValue | null>(null);

function buildFallbackSubscription(): TenantSubscriptionData {
  const session = getStoredAuthSession();
  const tenants = getStoredTenants();
  const matchedTenant = tenants.find(
    (t) =>
      (session?.tenantId && t.id === session.tenantId) ||
      (session?.tenantSlug && t.slug?.toLowerCase() === session.tenantSlug.toLowerCase())
  );

  const plan = normalizeSubscriptionPlan(matchedTenant?.plan || session?.plan || 'Pro');
  const billingCycle = normalizeBillingCycle(matchedTenant?.billingCycle || matchedTenant?.subscriptionTerm || 'Monthly');
  const spec = PLAN_PRICING_MATRIX[plan];
  const usersCount = Math.max(1, getStoredUsers().filter((u) => u.isActive !== false).length);
  const warehouses = getStoredWarehouses();
  const warehousesCount = Math.max(1, warehouses.length);
  const branchesCount = Math.max(1, warehouses.filter((w) => w.type === 'STORE').length || 1);

  return {
    tenantId: session?.tenantId || matchedTenant?.id || '',
    tenantName: session?.tenantName || matchedTenant?.name || '',
    tenantSlug: session?.tenantSlug || matchedTenant?.slug || '',
    plan,
    planType: spec.rank,
    billingCycle,
    billingCycleType: billingCycle === 'Annual' ? 2 : billingCycle === 'Lifetime' ? 3 : 1,
    expiresAt: billingCycle === 'Lifetime' ? null : (matchedTenant?.expiresAt || null),
    isExpired: false,
    usage: {
      usersCount,
      maxUsers: spec.maxUsers,
      warehousesCount,
      maxWarehouses: spec.maxWarehouses,
      branchesCount,
      maxBranches: spec.maxBranches,
      aiRequestsThisMonth: 0,
      monthlyAiRequests: spec.monthlyAiRequests,
    },
    features: buildPlanFeatureMap(plan),
  };
}

export const TenantPlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscription, setSubscription] = useState<TenantSubscriptionData | null>(() => buildFallbackSubscription());
  const [isLoading, setIsLoading] = useState(false);

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalRequiredPlan, setUpgradeModalRequiredPlan] = useState<SubscriptionPlan | null>(null);
  const [upgradeModalReasonKey, setUpgradeModalReasonKey] = useState<string | null>(null);
  const [upgradeModalQuotaMeta, setUpgradeModalQuotaMeta] = useState<{ current?: number; max?: number } | null>(null);

  const refreshSubscription = useCallback(async () => {
    const session = getStoredAuthSession();
    const fallback = buildFallbackSubscription();

    if (!session) {
      setSubscription(fallback);
      return;
    }

    const token =
      typeof window !== 'undefined'
        ? (localStorage.getItem('token') ||
            localStorage.getItem('zilox_token') ||
            localStorage.getItem('zilox_auth_token') ||
            localStorage.getItem('logistock_erp_jwt_token'))
        : null;

    if (!token) {
      setSubscription(fallback);
      return;
    }

    setIsLoading(true);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (session.tenantId) headers['X-Tenant-Id'] = session.tenantId;
      if (session.tenantSlug) headers['X-Tenant-Slug'] = session.tenantSlug;

      const res = await fetch('/api/tenant/subscription', { headers });
      if (!res.ok) {
        setSubscription(fallback);
        return;
      }
      const json = await res.json();
      const raw = json?.data ?? json;
      if (!raw || !raw.plan) {
        setSubscription(fallback);
        return;
      }

      const plan = normalizeSubscriptionPlan(raw.planType ?? raw.plan);
      const billingCycle = normalizeBillingCycle(raw.billingCycleType ?? raw.billingCycle);
      const spec = PLAN_PRICING_MATRIX[plan];
      const serverFeatures = (raw.features && typeof raw.features === 'object') ? raw.features : {};

      setSubscription({
        tenantId: String(raw.tenantId || fallback.tenantId),
        tenantName: String(raw.tenantName || fallback.tenantName),
        tenantSlug: String(raw.tenantSlug || fallback.tenantSlug),
        plan,
        planType: Number(raw.planType || spec.rank),
        billingCycle,
        billingCycleType: Number(raw.billingCycleType || 1),
        expiresAt: raw.expiresAt ?? null,
        isExpired: Boolean(raw.isExpired),
        usage: {
          usersCount: Number(raw.usage?.usersCount ?? fallback.usage.usersCount),
          maxUsers: raw.usage?.maxUsers !== undefined ? raw.usage.maxUsers : spec.maxUsers,
          warehousesCount: Number(raw.usage?.warehousesCount ?? fallback.usage.warehousesCount),
          maxWarehouses: raw.usage?.maxWarehouses !== undefined ? raw.usage.maxWarehouses : spec.maxWarehouses,
          branchesCount: Number(raw.usage?.branchesCount ?? fallback.usage.branchesCount),
          maxBranches: raw.usage?.maxBranches !== undefined ? raw.usage.maxBranches : spec.maxBranches,
          aiRequestsThisMonth: Number(raw.usage?.aiRequestsThisMonth ?? 0),
          monthlyAiRequests: Number(raw.usage?.monthlyAiRequests ?? spec.monthlyAiRequests),
        },
        features: {
          ...buildPlanFeatureMap(plan),
          ...serverFeatures,
        },
      });
    } catch {
      setSubscription(fallback);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSubscription();

    const handleSync = () => {
      refreshSubscription();
    };

    window.addEventListener('zilox_subscription_updated', handleSync);
    window.addEventListener('zilox_query_invalidate', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('zilox_subscription_updated', handleSync);
      window.removeEventListener('zilox_query_invalidate', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [refreshSubscription]);

  const activeSession = getStoredAuthSession();
  const plan: SubscriptionPlan = subscription?.plan || normalizeSubscriptionPlan(activeSession?.plan);
  const billingCycle: BillingCycle = subscription?.billingCycle || 'Monthly';
  const features = useMemo<Record<PlanFeatureKey, boolean>>(
    () => subscription?.features || buildPlanFeatureMap(plan),
    [subscription?.features, plan]
  );

  const canAccess = useCallback(
    (featureKey: PlanFeatureKey): boolean => {
      const session = getStoredAuthSession();
      if (session?.role === 'PlatformSuperAdmin') return true;
      if (features && typeof features[featureKey] === 'boolean') {
        return features[featureKey];
      }
      const req = PLAN_FEATURE_MIN_TIER[featureKey] || 'Starter';
      return PLAN_PRICING_MATRIX[plan].rank >= PLAN_PRICING_MATRIX[req].rank;
    },
    [features, plan]
  );

  const getRequiredPlan = useCallback((featureKey: PlanFeatureKey): SubscriptionPlan => {
    return PLAN_FEATURE_MIN_TIER[featureKey] || 'Pro';
  }, []);

  const openUpgradeModal = useCallback(
    (
      requiredPlan?: SubscriptionPlan,
      reasonKey?: string,
      quotaMeta?: { current?: number; max?: number }
    ) => {
      setUpgradeModalRequiredPlan(requiredPlan || null);
      setUpgradeModalReasonKey(reasonKey || null);
      setUpgradeModalQuotaMeta(quotaMeta || null);
      setUpgradeModalOpen(true);
    },
    []
  );

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalOpen(false);
  }, []);

  const value: TenantPlanContextValue = {
    subscription,
    plan,
    billingCycle,
    expiresAt: subscription?.expiresAt ?? null,
    isExpired: Boolean(subscription?.isExpired),
    usage: subscription?.usage || buildFallbackSubscription().usage,
    features,
    isLoading,
    canAccess,
    getRequiredPlan,
    refreshSubscription,
    upgradeModalOpen,
    upgradeModalRequiredPlan,
    upgradeModalReasonKey,
    upgradeModalQuotaMeta,
    openUpgradeModal,
    closeUpgradeModal,
  };

  return (
    <TenantPlanContext.Provider value={value}>
      {children}
    </TenantPlanContext.Provider>
  );
};

export function useTenantPlanContext(): TenantPlanContextValue {
  const ctx = useContext(TenantPlanContext);
  if (!ctx) {
    const fallback = buildFallbackSubscription();
    return {
      subscription: fallback,
      plan: fallback.plan,
      billingCycle: fallback.billingCycle,
      expiresAt: fallback.expiresAt,
      isExpired: false,
      usage: fallback.usage,
      features: fallback.features,
      isLoading: false,
      canAccess: (key) => Boolean(fallback.features[key]),
      getRequiredPlan: (key) => PLAN_FEATURE_MIN_TIER[key] || 'Pro',
      refreshSubscription: async () => {},
      upgradeModalOpen: false,
      upgradeModalRequiredPlan: null,
      upgradeModalReasonKey: null,
      upgradeModalQuotaMeta: null,
      openUpgradeModal: () => {},
      closeUpgradeModal: () => {},
    };
  }
  return ctx;
}
