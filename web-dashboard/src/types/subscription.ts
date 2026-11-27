export type SubscriptionPlan = 'Starter' | 'Pro' | 'Enterprise';
export type BillingCycle = 'Monthly' | 'Annual' | 'Lifetime';

export type PlanFeatureKey =
  | 'Pos'
  | 'Shifts'
  | 'CashAndCreditSales'
  | 'Returns'
  | 'Purchases'
  | 'Suppliers'
  | 'BasicInventoryAndFifo'
  | 'SingleCashbox'
  | 'Expenses'
  | 'Vouchers'
  | 'SecurityAndCostMasking'
  | 'BasicReports'
  | 'CashRounding250'
  | 'Installments'
  | 'VolumePricingAndBundles'
  | 'Quotations'
  | 'PartnersAndProfitShare'
  | 'LoyaltyPoints'
  | 'MultiCurrency'
  | 'MultipleBanksAndCashboxes'
  | 'ShelvesOrganizer'
  | 'SerialTracking'
  | 'AiExecutiveAdvisor'
  | 'WarehouseTransfers'
  | 'MultiBranch'
  | 'PurchaseOrders'
  | 'DispatchOrders'
  | 'OfficialExportReports';

export interface TenantSubscriptionUsage {
  usersCount: number;
  maxUsers: number | null;
  warehousesCount: number;
  maxWarehouses: number | null;
  branchesCount: number;
  maxBranches: number | null;
  aiRequestsThisMonth: number;
  monthlyAiRequests: number;
}

export interface TenantSubscriptionData {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: SubscriptionPlan;
  planType: number;
  billingCycle: BillingCycle;
  billingCycleType: number;
  expiresAt: string | null;
  isExpired: boolean;
  usage: TenantSubscriptionUsage;
  features: Record<PlanFeatureKey, boolean>;
}

export interface PlanPricingSpec {
  id: SubscriptionPlan;
  rank: number;
  monthlyIqd: number;
  annualIqd: number;
  lifetimeIqd: number;
  cloudRenewalYearlyIqd: number;
  maxBranches: number | null;
  maxWarehouses: number | null;
  maxUsers: number | null;
  monthlyAiRequests: number;
  popular?: boolean;
}

export const PLAN_PRICING_MATRIX: Record<SubscriptionPlan, PlanPricingSpec> = {
  Starter: {
    id: 'Starter',
    rank: 1,
    monthlyIqd: 10000,
    annualIqd: 100000,
    lifetimeIqd: 175000,
    cloudRenewalYearlyIqd: 35000,
    maxBranches: 1,
    maxWarehouses: 1,
    maxUsers: 2,
    monthlyAiRequests: 0,
  },
  Pro: {
    id: 'Pro',
    rank: 2,
    monthlyIqd: 25000,
    annualIqd: 250000,
    lifetimeIqd: 350000,
    cloudRenewalYearlyIqd: 50000,
    maxBranches: 1,
    maxWarehouses: 3,
    maxUsers: 6,
    monthlyAiRequests: 150,
    popular: true,
  },
  Enterprise: {
    id: 'Enterprise',
    rank: 3,
    monthlyIqd: 45000,
    annualIqd: 450000,
    lifetimeIqd: 650000,
    cloudRenewalYearlyIqd: 75000,
    maxBranches: null,
    maxWarehouses: null,
    maxUsers: null,
    monthlyAiRequests: 1000,
  },
};

export const PLAN_FEATURE_MIN_TIER: Record<PlanFeatureKey, SubscriptionPlan> = {
  Pos: 'Starter',
  Shifts: 'Starter',
  CashAndCreditSales: 'Starter',
  Returns: 'Starter',
  Purchases: 'Starter',
  Suppliers: 'Starter',
  BasicInventoryAndFifo: 'Starter',
  SingleCashbox: 'Starter',
  Expenses: 'Starter',
  Vouchers: 'Starter',
  SecurityAndCostMasking: 'Starter',
  BasicReports: 'Starter',
  CashRounding250: 'Starter',
  Installments: 'Pro',
  VolumePricingAndBundles: 'Pro',
  Quotations: 'Pro',
  PartnersAndProfitShare: 'Pro',
  LoyaltyPoints: 'Pro',
  MultiCurrency: 'Pro',
  MultipleBanksAndCashboxes: 'Pro',
  ShelvesOrganizer: 'Pro',
  SerialTracking: 'Pro',
  AiExecutiveAdvisor: 'Pro',
  WarehouseTransfers: 'Pro',
  MultiBranch: 'Enterprise',
  PurchaseOrders: 'Enterprise',
  DispatchOrders: 'Enterprise',
  OfficialExportReports: 'Enterprise',
};

export function normalizeSubscriptionPlan(raw?: string | number | null): SubscriptionPlan {
  if (raw === 1 || raw === '1') return 'Starter';
  if (raw === 3 || raw === '3') return 'Enterprise';
  if (raw === 2 || raw === '2') return 'Pro';
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'starter') return 'Starter';
  if (s === 'enterprise') return 'Enterprise';
  return 'Pro';
}

export function normalizeBillingCycle(raw?: string | number | null): BillingCycle {
  if (raw === 2 || raw === '2') return 'Annual';
  if (raw === 3 || raw === '3') return 'Lifetime';
  if (raw === 1 || raw === '1') return 'Monthly';
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'annual' || s === 'yearly' || s === 'annual_12') return 'Annual';
  if (s === 'lifetime') return 'Lifetime';
  return 'Monthly';
}

export function buildPlanFeatureMap(plan: SubscriptionPlan): Record<PlanFeatureKey, boolean> {
  const rank = PLAN_PRICING_MATRIX[plan].rank;
  const result = {} as Record<PlanFeatureKey, boolean>;
  (Object.keys(PLAN_FEATURE_MIN_TIER) as PlanFeatureKey[]).forEach((key) => {
    const reqPlan = PLAN_FEATURE_MIN_TIER[key];
    result[key] = rank >= PLAN_PRICING_MATRIX[reqPlan].rank;
  });
  return result;
}
