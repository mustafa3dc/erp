import {
  KEYS,
  getStoredCustomers,
  saveStoredCustomers,
  getStoredProducts,
  saveStoredProducts,
  getStoredLoyaltySettings,
  getStoredLoyaltyTransactions,
  saveStoredLoyaltyTransactions,
  getStoredTransactions,
  saveStoredTransactions,
  getStoredWarehouses,
  normalizeLoyaltyPhone,
  safeGet,
  safeSet
} from './storageService';
import { getStoredTenants } from './tenantService';

export interface LoyaltyRewardItem {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  pointsCost: number;
  productId?: string | null;
  productName?: string | null;
  liveStockQuantity: number;
  inStock: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface UpsertLoyaltyRewardPayload {
  title: string;
  description?: string;
  imageUrl?: string | null;
  pointsCost: number;
  productId?: string | null;
  isActive: boolean;
  displayOrder: number;
}

export interface StoreCardSummary {
  storeName: string;
  storeLogo?: string | null;
  cardToken: string;
}

export interface PublicLoyaltyTransaction {
  id: string;
  type: string;
  pointsChange: number;
  balanceAfter: number;
  notes?: string | null;
  createdAt: string;
}

export interface PublicLoyaltyVoucher {
  id: string;
  rewardId: string;
  voucherCode: string;
  rewardTitle: string;
  rewardImageUrl?: string | null;
  pointsSpent: number;
  status: 'PendingPickup' | 'Claimed' | 'Cancelled' | string;
  createdAt: string;
}

export interface PublicLoyaltyReward {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  pointsCost: number;
  inStock: boolean;
  displayOrder: number;
}

export interface PublicLoyaltyCardData {
  storeName: string;
  storeLogo?: string | null;
  customerName: string;
  loyaltyMemberCode: string;
  loyaltyCardToken: string;
  loyaltyPointsBalance: number;
  isLoyaltyEnabled: boolean;
  recentTransactions: PublicLoyaltyTransaction[];
  activeVouchers: PublicLoyaltyVoucher[];
  rewards: PublicLoyaltyReward[];
  storeCards: StoreCardSummary[];
}

export interface PosCustomerLookupResult {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  loyaltyMemberCode?: string | null;
  loyaltyCardToken?: string | null;
  loyaltyPointsBalance: number;
  creditLimit: number;
  currentBalance: number;
  isDefaultCashCustomer: boolean;
}

export interface PosVoucherLookupResult {
  id: string;
  voucherCode: string;
  status: string;
  pointsSpent: number;
  createdAt: string;
  claimedAt?: string | null;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  loyaltyMemberCode?: string | null;
  rewardId: string;
  rewardTitle: string;
  rewardDescription?: string | null;
  rewardImageUrl?: string | null;
  productId?: string | null;
  productName?: string | null;
  inStock: boolean;
}

interface LocalStoredReward {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  pointsCost: number;
  productId?: string | null;
  isActive: boolean;
  displayOrder: number;
  isDeleted?: boolean;
  createdAt: string;
}

interface LocalStoredVoucher {
  id: string;
  customerId: string;
  rewardId: string;
  voucherCode: string;
  pointsSpent: number;
  status: 'PendingPickup' | 'Claimed' | 'Cancelled';
  createdAt: string;
  claimedAt?: string;
  claimedByShiftId?: string;
}

import { getStoredJwtToken, getTenantAuthHeaders } from '../lib/api-client';

function getAuthToken(): string | null {
  return getStoredJwtToken();
}

function authHeaders(): Record<string, string> {
  return getTenantAuthHeaders();
}

function isUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));
}

function enrichLocalReward(r: LocalStoredReward, products: any[]): LoyaltyRewardItem {
  const linkedProduct = r.productId ? products.find(p => p.id === r.productId) : null;
  const stockQty = linkedProduct ? Math.max(0, Number(linkedProduct.currentStock) || 0) : 0;
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    imageUrl: r.imageUrl ?? null,
    pointsCost: Number(r.pointsCost) || 0,
    productId: r.productId ?? null,
    productName: linkedProduct ? (linkedProduct.nameAr || linkedProduct.nameEn || linkedProduct.sku) : null,
    liveStockQuantity: stockQty,
    inStock: !r.productId || stockQty >= 1,
    isActive: r.isActive,
    displayOrder: Number(r.displayOrder) || 0,
    createdAt: r.createdAt
  };
}

export async function compressRewardImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ERR_IMAGE_READ_FAILED'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ERR_IMAGE_INVALID'));
      img.onload = () => {
        const maxSide = 640;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// 1. Merchant Rewards Store CRUD
// ============================================================================

export async function fetchLoyaltyRewards(): Promise<LoyaltyRewardItem[]> {
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/loyalty/rewards', { headers: authHeaders() });
      if (res.ok) {
        const payload = await res.json();
        if (payload?.success && Array.isArray(payload.data)) {
          safeSet(KEYS.LOYALTY_REWARDS, payload.data);
          return payload.data;
        }
      }
    } catch {
      // Fall back to local storage
    }
  }

  const localRewards = safeGet<LocalStoredReward[]>(KEYS.LOYALTY_REWARDS, []).filter(r => !r.isDeleted);
  const products = getStoredProducts();
  return localRewards
    .map(r => enrichLocalReward(r, products))
    .sort((a, b) => a.displayOrder - b.displayOrder || b.createdAt.localeCompare(a.createdAt));
}

export async function createLoyaltyReward(payload: UpsertLoyaltyRewardPayload): Promise<LoyaltyRewardItem> {
  if (!payload.title.trim() || payload.pointsCost <= 0) {
    throw new Error('ERR_INVALID_REWARD_CONFIG');
  }

  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/loyalty/rewards', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...payload,
          productId: isUuid(payload.productId) ? payload.productId : null
        })
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
      if (res.status === 400 || res.status === 404) {
        throw new Error(json?.errorCode || 'ERR_INVALID_REWARD_CONFIG');
      }
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const localRewards = safeGet<LocalStoredReward[]>(KEYS.LOYALTY_REWARDS, []);
  const newReward: LocalStoredReward = {
    id: `RWD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    imageUrl: payload.imageUrl || null,
    pointsCost: Math.round(payload.pointsCost * 10000) / 10000,
    productId: payload.productId || null,
    isActive: payload.isActive,
    displayOrder: payload.displayOrder || 0,
    isDeleted: false,
    createdAt: new Date().toISOString()
  };
  safeSet(KEYS.LOYALTY_REWARDS, [newReward, ...localRewards]);
  return enrichLocalReward(newReward, getStoredProducts());
}

export async function updateLoyaltyReward(
  id: string,
  payload: UpsertLoyaltyRewardPayload
): Promise<LoyaltyRewardItem> {
  if (!payload.title.trim() || payload.pointsCost <= 0) {
    throw new Error('ERR_INVALID_REWARD_CONFIG');
  }

  const token = getAuthToken();
  if (token && isUuid(id)) {
    try {
      const res = await fetch(`/api/loyalty/rewards/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          ...payload,
          productId: isUuid(payload.productId) ? payload.productId : null
        })
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
      if (res.status === 400 || res.status === 404) {
        throw new Error(json?.errorCode || 'ERR_INVALID_REWARD_CONFIG');
      }
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const localRewards = safeGet<LocalStoredReward[]>(KEYS.LOYALTY_REWARDS, []);
  const idx = localRewards.findIndex(r => r.id === id);
  if (idx < 0) throw new Error('ERR_REWARD_NOT_FOUND');

  localRewards[idx] = {
    ...localRewards[idx],
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    imageUrl: payload.imageUrl || null,
    pointsCost: Math.round(payload.pointsCost * 10000) / 10000,
    productId: payload.productId || null,
    isActive: payload.isActive,
    displayOrder: payload.displayOrder || 0
  };
  safeSet(KEYS.LOYALTY_REWARDS, localRewards);
  return enrichLocalReward(localRewards[idx], getStoredProducts());
}

export async function toggleLoyaltyReward(id: string): Promise<LoyaltyRewardItem> {
  const token = getAuthToken();
  if (token && isUuid(id)) {
    try {
      const res = await fetch(`/api/loyalty/rewards/${id}/toggle`, {
        method: 'PATCH',
        headers: authHeaders()
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
    } catch {
      // Fallback locally
    }
  }

  const localRewards = safeGet<LocalStoredReward[]>(KEYS.LOYALTY_REWARDS, []);
  const idx = localRewards.findIndex(r => r.id === id);
  if (idx < 0) throw new Error('ERR_REWARD_NOT_FOUND');
  localRewards[idx] = { ...localRewards[idx], isActive: !localRewards[idx].isActive };
  safeSet(KEYS.LOYALTY_REWARDS, localRewards);
  return enrichLocalReward(localRewards[idx], getStoredProducts());
}

export async function deleteLoyaltyReward(id: string): Promise<void> {
  const token = getAuthToken();
  if (token && isUuid(id)) {
    try {
      const res = await fetch(`/api/loyalty/rewards/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) return;
    } catch {
      // Fallback locally
    }
  }

  const localRewards = safeGet<LocalStoredReward[]>(KEYS.LOYALTY_REWARDS, []);
  const next = localRewards.map(r => (r.id === id ? { ...r, isDeleted: true, isActive: false } : r));
  safeSet(KEYS.LOYALTY_REWARDS, next);
}

// ============================================================================
// 2. Public Customer Digital Wallet Helpers (/card/[token])
// ============================================================================

interface LocalTenantMatch {
  slug: string;
  storeName: string;
  storeLogo?: string | null;
  customer: any;
  customersKey: string;
}

function findLocalCustomerByTokenAcrossTenants(token: string): {
  match: LocalTenantMatch | null;
  storeCards: StoreCardSummary[];
} {
  if (typeof window === 'undefined') return { match: null, storeCards: [] };
  // Ensure active tenant customers have backfilled tokens
  getStoredCustomers();

  const tenants = getStoredTenants();
  const matchesBySlug: Array<{
    slug: string;
    storeName: string;
    storeLogo?: string | null;
    customers: any[];
    customersKey: string;
  }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('zilox_tenant_') || !key.endsWith('_customers_list')) continue;
    const slug = key.slice('zilox_tenant_'.length, -'_customers_list'.length);
    const list = safeGet<any[]>(key, []);
    const tInfo = tenants.find(t => t.slug.toLowerCase() === slug.toLowerCase());
    let storeName = tInfo?.name || (slug === 'default' ? 'ZiloX Store' : slug);
    let storeLogo: string | null = null;
    try {
      const prefsRaw = localStorage.getItem('zilox_user_preferences');
      if (prefsRaw) {
        const prefs = JSON.parse(prefsRaw);
        if (!tInfo && prefs?.organizationName) storeName = prefs.organizationName;
        if (prefs?.logoUrl) storeLogo = prefs.logoUrl;
      }
    } catch {}
    matchesBySlug.push({ slug, storeName, storeLogo, customers: list, customersKey: key });
  }

  const trimmedLookup = decodeURIComponent(token || '').trim();
  const lookupUpper = trimmedLookup.toUpperCase();

  let matchedTenant: LocalTenantMatch | null = null;
  for (const entry of matchesBySlug) {
    const found = entry.customers.find(
      c =>
        c &&
        !c.isDefaultCashCustomer &&
        (c.loyaltyCardToken === trimmedLookup ||
          (c.loyaltyMemberCode && String(c.loyaltyMemberCode).toUpperCase() === lookupUpper))
    );
    if (found) {
      matchedTenant = {
        slug: entry.slug,
        storeName: entry.storeName,
        storeLogo: entry.storeLogo,
        customer: found,
        customersKey: entry.customersKey
      };
      break;
    }
  }

  if (!matchedTenant) return { match: null, storeCards: [] };

  const normPhone =
    matchedTenant.customer.normalizedPhone || normalizeLoyaltyPhone(matchedTenant.customer.phone);
  const storeCards: StoreCardSummary[] = [];

  if (normPhone) {
    for (const entry of matchesBySlug) {
      const sibling = entry.customers.find(
        c =>
          c &&
          !c.isDefaultCashCustomer &&
          c.loyaltyCardToken &&
          (c.normalizedPhone || normalizeLoyaltyPhone(c.phone)) === normPhone
      );
      if (sibling) {
        storeCards.push({
          storeName: entry.storeName,
          storeLogo: entry.storeLogo,
          cardToken: sibling.loyaltyCardToken
        });
      }
    }
  }

  if (storeCards.length === 0) {
    storeCards.push({
      storeName: matchedTenant.storeName,
      storeLogo: matchedTenant.storeLogo,
      cardToken: token
    });
  }

  return { match: matchedTenant, storeCards };
}

export async function fetchPublicLoyaltyCard(token: string): Promise<PublicLoyaltyCardData> {
  const cleanToken = decodeURIComponent(token || '').trim();
  if (!cleanToken) {
    throw new Error('ERR_LOYALTY_CARD_NOT_FOUND');
  }

  try {
    // Public endpoints: strictly zero Auth/Tenant headers so unauthenticated mobile sessions succeed cleanly
    const res = await fetch(`/api/public/loyalty-card/${encodeURIComponent(cleanToken)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && json.data) {
      return json.data;
    }

    // Fallback to public lookup endpoint (?token=... / LOY- code)
    const lookupRes = await fetch(
      `/api/public/loyalty-lookup?token=${encodeURIComponent(cleanToken)}`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    );
    const lookupJson = await lookupRes.json().catch(() => null);
    if (lookupRes.ok && lookupJson?.success && lookupJson.data) {
      return lookupJson.data;
    }

    if (res.status === 404 && json?.errorCode === 'ERR_LOYALTY_CARD_NOT_FOUND') {
      const localCheck = findLocalCustomerByTokenAcrossTenants(cleanToken);
      if (!localCheck.match) throw new Error('ERR_LOYALTY_CARD_NOT_FOUND');
    }
  } catch (err: any) {
    if (err?.message === 'ERR_LOYALTY_CARD_NOT_FOUND') throw err;
  }

  const { match, storeCards } = findLocalCustomerByTokenAcrossTenants(cleanToken);
  if (!match) {
    throw new Error('ERR_LOYALTY_CARD_NOT_FOUND');
  }

  const slug = match.slug;
  const products = safeGet<any[]>(`zilox_tenant_${slug}_products`, []);
  const rewards = safeGet<LocalStoredReward[]>(`zilox_tenant_${slug}_loyalty_rewards`, []).filter(
    r => r.isActive && !r.isDeleted
  );
  const vouchers = safeGet<LocalStoredVoucher[]>(`zilox_tenant_${slug}_loyalty_vouchers`, []).filter(
    v => v.customerId === match.customer.id && v.status === 'PendingPickup'
  );
  const txs = safeGet<any[]>(`zilox_tenant_${slug}_loyalty_transactions`, [])
    .filter(tx => tx.customerId === match.customer.id)
    .slice(0, 10);
  const settings = safeGet<any>(`zilox_tenant_${slug}_loyalty_settings`, getStoredLoyaltySettings());

  const rewardMap = new Map(
    safeGet<LocalStoredReward[]>(`zilox_tenant_${slug}_loyalty_rewards`, []).map(r => [r.id, r])
  );

  return {
    storeName: match.storeName,
    storeLogo: match.storeLogo,
    customerName: match.customer.name,
    loyaltyMemberCode: match.customer.loyaltyMemberCode || 'LOY-10001',
    loyaltyCardToken: token,
    loyaltyPointsBalance: Number(match.customer.loyaltyPointsBalance ?? match.customer.loyaltyPoints ?? 0) || 0,
    isLoyaltyEnabled: settings?.isLoyaltyEnabled !== false,
    recentTransactions: txs.map(t => ({
      id: t.id,
      type: t.type,
      pointsChange: Number(t.pointsChange) || 0,
      balanceAfter: Number(t.balanceAfter) || 0,
      notes: t.notes ?? null,
      createdAt: t.createdAt
    })),
    activeVouchers: vouchers
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(v => {
        const rw = rewardMap.get(v.rewardId);
        return {
          id: v.id,
          rewardId: v.rewardId,
          voucherCode: v.voucherCode,
          rewardTitle: rw?.title || 'Reward',
          rewardImageUrl: rw?.imageUrl ?? null,
          pointsSpent: v.pointsSpent,
          status: v.status,
          createdAt: v.createdAt
        };
      }),
    rewards: rewards
      .sort((a, b) => a.displayOrder - b.displayOrder || a.pointsCost - b.pointsCost)
      .map(r => {
        const prod = r.productId ? products.find(p => p.id === r.productId) : null;
        const inStock = !r.productId || (Number(prod?.currentStock) || 0) >= 1;
        return {
          id: r.id,
          title: r.title,
          description: r.description ?? null,
          imageUrl: r.imageUrl ?? null,
          pointsCost: Number(r.pointsCost) || 0,
          inStock,
          displayOrder: r.displayOrder
        };
      }),
    storeCards
  };
}

export async function redeemPublicReward(token: string, rewardId: string): Promise<PublicLoyaltyVoucher> {
  if (isUuid(rewardId)) {
    try {
      const res = await fetch(
        `/api/public/loyalty-card/${encodeURIComponent(token)}/redeem/${encodeURIComponent(rewardId)}`,
        { method: 'POST' }
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
      if (json?.errorCode) {
        throw new Error(json.errorCode);
      }
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const { match } = findLocalCustomerByTokenAcrossTenants(token);
  if (!match) throw new Error('ERR_LOYALTY_CARD_NOT_FOUND');

  const slug = match.slug;
  const rewardsKey = `zilox_tenant_${slug}_loyalty_rewards`;
  const vouchersKey = `zilox_tenant_${slug}_loyalty_vouchers`;
  const txsKey = `zilox_tenant_${slug}_loyalty_transactions`;
  const products = safeGet<any[]>(`zilox_tenant_${slug}_products`, []);
  const rewards = safeGet<LocalStoredReward[]>(rewardsKey, []);
  const reward = rewards.find(r => r.id === rewardId && r.isActive && !r.isDeleted);
  if (!reward) throw new Error('ERR_REWARD_NOT_FOUND');

  if (reward.productId) {
    const prod = products.find(p => p.id === reward.productId);
    if (!prod || (Number(prod.currentStock) || 0) < 1) {
      throw new Error('ERR_REWARD_OUT_OF_STOCK');
    }
  }

  const customers = safeGet<any[]>(match.customersKey, []);
  const cIdx = customers.findIndex(c => c.id === match.customer.id);
  if (cIdx < 0) throw new Error('ERR_LOYALTY_CARD_NOT_FOUND');

  const currentBal = Number(customers[cIdx].loyaltyPointsBalance ?? customers[cIdx].loyaltyPoints ?? 0) || 0;
  if (currentBal < reward.pointsCost) {
    throw new Error('ERR_INSUFFICIENT_LOYALTY_POINTS');
  }

  const nextBal = Math.round((currentBal - reward.pointsCost) * 10000) / 10000;
  customers[cIdx] = {
    ...customers[cIdx],
    loyaltyPoints: nextBal,
    loyaltyPointsBalance: nextBal
  };
  safeSet(match.customersKey, customers);

  const voucherCode = `RDM-${Math.floor(10000 + Math.random() * 90000)}`;
  const nowIso = new Date().toISOString();
  const voucher: LocalStoredVoucher = {
    id: `VCH-${Date.now()}`,
    customerId: match.customer.id,
    rewardId: reward.id,
    voucherCode,
    pointsSpent: reward.pointsCost,
    status: 'PendingPickup',
    createdAt: nowIso
  };
  const vouchers = safeGet<LocalStoredVoucher[]>(vouchersKey, []);
  safeSet(vouchersKey, [voucher, ...vouchers]);

  const txs = safeGet<any[]>(txsKey, []);
  safeSet(txsKey, [
    {
      id: `LOY-${Date.now()}-RDM`,
      customerId: match.customer.id,
      customerName: match.customer.name,
      type: 'Redeemed',
      pointsChange: -reward.pointsCost,
      profitBasis: 0,
      balanceAfter: nextBal,
      notes: `${voucherCode}: ${reward.title}`,
      createdBy: 'CustomerWallet',
      createdAt: nowIso
    },
    ...txs
  ]);

  return {
    id: voucher.id,
    rewardId: reward.id,
    voucherCode,
    rewardTitle: reward.title,
    rewardImageUrl: reward.imageUrl ?? null,
    pointsSpent: reward.pointsCost,
    status: 'PendingPickup',
    createdAt: nowIso
  };
}

export async function cancelPublicVoucher(token: string, voucherId: string): Promise<PublicLoyaltyCardData> {
  if (isUuid(voucherId)) {
    try {
      const res = await fetch(
        `/api/public/loyalty-card/${encodeURIComponent(token)}/vouchers/${encodeURIComponent(voucherId)}/cancel`,
        { method: 'POST' }
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
      if (json?.errorCode) {
        throw new Error(json.errorCode);
      }
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const { match } = findLocalCustomerByTokenAcrossTenants(token);
  if (!match) throw new Error('ERR_LOYALTY_CARD_NOT_FOUND');

  const slug = match.slug;
  const vouchersKey = `zilox_tenant_${slug}_loyalty_vouchers`;
  const rewardsKey = `zilox_tenant_${slug}_loyalty_rewards`;
  const txsKey = `zilox_tenant_${slug}_loyalty_transactions`;

  const vouchers = safeGet<LocalStoredVoucher[]>(vouchersKey, []);
  const vIdx = vouchers.findIndex(v => v.id === voucherId && v.customerId === match.customer.id);
  if (vIdx < 0) throw new Error('ERR_VOUCHER_NOT_FOUND');
  if (vouchers[vIdx].status !== 'PendingPickup') {
    throw new Error('ERR_VOUCHER_INVALID_OR_CLAIMED');
  }

  vouchers[vIdx] = { ...vouchers[vIdx], status: 'Cancelled' };
  safeSet(vouchersKey, vouchers);

  const customers = safeGet<any[]>(match.customersKey, []);
  const cIdx = customers.findIndex(c => c.id === match.customer.id);
  const currentBal = Number(customers[cIdx].loyaltyPointsBalance ?? customers[cIdx].loyaltyPoints ?? 0) || 0;
  const nextBal = Math.round((currentBal + vouchers[vIdx].pointsSpent) * 10000) / 10000;
  customers[cIdx] = {
    ...customers[cIdx],
    loyaltyPoints: nextBal,
    loyaltyPointsBalance: nextBal
  };
  safeSet(match.customersKey, customers);

  const rewards = safeGet<LocalStoredReward[]>(rewardsKey, []);
  const rw = rewards.find(r => r.id === vouchers[vIdx].rewardId);

  const txs = safeGet<any[]>(txsKey, []);
  safeSet(txsKey, [
    {
      id: `LOY-${Date.now()}-RFD`,
      customerId: match.customer.id,
      customerName: match.customer.name,
      type: 'Refunded',
      pointsChange: vouchers[vIdx].pointsSpent,
      profitBasis: 0,
      balanceAfter: nextBal,
      notes: `${vouchers[vIdx].voucherCode}: ${rw?.title || ''}`,
      createdBy: 'CustomerWallet',
      createdAt: new Date().toISOString()
    },
    ...txs
  ]);

  return fetchPublicLoyaltyCard(token);
}

// ============================================================================
// 3. POS Barcode Scan & Reward Handover
// ============================================================================

export async function lookupCustomerByMemberCode(code: string): Promise<PosCustomerLookupResult> {
  const normCode = code.trim().toUpperCase();
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch(`/api/customers/by-member-code/${encodeURIComponent(normCode)}`, {
        headers: authHeaders()
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
    } catch {
      // Fallback locally
    }
  }

  const customers = getStoredCustomers();
  const found = customers.find(
    c => c && !c.isDefaultCashCustomer && String(c.loyaltyMemberCode || '').toUpperCase() === normCode
  );
  if (!found) {
    throw new Error('ERR_CUSTOMER_NOT_FOUND');
  }

  return {
    id: found.id,
    code: found.code,
    name: found.name,
    phone: found.phone,
    loyaltyMemberCode: found.loyaltyMemberCode,
    loyaltyCardToken: found.loyaltyCardToken,
    loyaltyPointsBalance: Number(found.loyaltyPointsBalance ?? found.loyaltyPoints ?? 0) || 0,
    creditLimit: Number(found.creditLimit) || 0,
    currentBalance: Number(found.currentBalance) || 0,
    isDefaultCashCustomer: Boolean(found.isDefaultCashCustomer)
  };
}

export async function fetchPendingPosVouchers(params: {
  customerId?: string;
  phone?: string;
}): Promise<PosVoucherLookupResult[]> {
  const customerId = params.customerId?.trim();
  const phone = params.phone?.trim();
  if (!customerId && !phone) return [];

  const token = getAuthToken();
  if (token && ((!customerId || isUuid(customerId)) || phone)) {
    try {
      const query = new URLSearchParams();
      if (customerId && isUuid(customerId)) query.set('customerId', customerId);
      else if (phone) query.set('phone', phone);

      if (query.toString()) {
        const res = await fetch(`/api/pos/vouchers?${query.toString()}`, {
          headers: authHeaders()
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch {
      // Fallback locally
    }
  }

  const customers = getStoredCustomers();
  let targetCustomerIds = new Set<string>();
  if (customerId) {
    targetCustomerIds.add(customerId);
  } else if (phone) {
    const normPhone = normalizeLoyaltyPhone(phone);
    for (const c of customers) {
      if (!c || c.isDefaultCashCustomer) continue;
      const cNorm = c.normalizedPhone || normalizeLoyaltyPhone(c.phone);
      const cRaw = String(c.phone || '');
      if ((normPhone && cNorm === normPhone) || cRaw.includes(phone)) {
        targetCustomerIds.add(c.id);
      }
    }
  }

  if (targetCustomerIds.size === 0) return [];

  const vouchers = safeGet<LocalStoredVoucher[]>(KEYS.LOYALTY_VOUCHERS, []).filter(
    v => v.status === 'PendingPickup' && targetCustomerIds.has(v.customerId)
  );
  if (vouchers.length === 0) return [];

  const rewards = safeGet<LocalStoredReward[]>(KEYS.LOYALTY_REWARDS, []);
  const products = getStoredProducts();

  return vouchers
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(v => {
      const customer = customers.find(c => c.id === v.customerId);
      const reward = rewards.find(r => r.id === v.rewardId);
      const product = reward?.productId ? products.find(p => p.id === reward.productId) : null;
      const inStock = !reward?.productId || (Number(product?.currentStock) || 0) >= 1;

      return {
        id: v.id,
        voucherCode: v.voucherCode,
        status: v.status,
        pointsSpent: v.pointsSpent,
        createdAt: v.createdAt,
        claimedAt: v.claimedAt ?? null,
        customerId: v.customerId,
        customerName: customer?.name || '',
        customerPhone: customer?.phone ?? null,
        loyaltyMemberCode: customer?.loyaltyMemberCode ?? null,
        rewardId: v.rewardId,
        rewardTitle: reward?.title || '',
        rewardDescription: reward?.description ?? null,
        rewardImageUrl: reward?.imageUrl ?? null,
        productId: reward?.productId ?? null,
        productName: product ? (product.nameAr || product.nameEn || product.sku) : null,
        inStock
      };
    });
}

export async function lookupPosVoucher(code: string): Promise<PosVoucherLookupResult> {
  const normCode = code.trim().toUpperCase();
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch(`/api/pos/vouchers/${encodeURIComponent(normCode)}`, {
        headers: authHeaders()
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
      if (res.status === 404 && json?.errorCode) {
        // Check local before failing
      }
    } catch {
      // Fallback locally
    }
  }

  const vouchers = safeGet<LocalStoredVoucher[]>(KEYS.LOYALTY_VOUCHERS, []);
  const voucher = vouchers.find(v => String(v.voucherCode || '').toUpperCase() === normCode);
  if (!voucher) throw new Error('ERR_VOUCHER_NOT_FOUND');

  const customers = getStoredCustomers();
  const customer = customers.find(c => c.id === voucher.customerId);
  const rewards = safeGet<LocalStoredReward[]>(KEYS.LOYALTY_REWARDS, []);
  const reward = rewards.find(r => r.id === voucher.rewardId);
  const products = getStoredProducts();
  const product = reward?.productId ? products.find(p => p.id === reward.productId) : null;
  const inStock = !reward?.productId || (Number(product?.currentStock) || 0) >= 1;

  return {
    id: voucher.id,
    voucherCode: voucher.voucherCode,
    status: voucher.status,
    pointsSpent: voucher.pointsSpent,
    createdAt: voucher.createdAt,
    claimedAt: voucher.claimedAt ?? null,
    customerId: voucher.customerId,
    customerName: customer?.name || '',
    customerPhone: customer?.phone ?? null,
    loyaltyMemberCode: customer?.loyaltyMemberCode ?? null,
    rewardId: voucher.rewardId,
    rewardTitle: reward?.title || '',
    rewardDescription: reward?.description ?? null,
    rewardImageUrl: reward?.imageUrl ?? null,
    productId: reward?.productId ?? null,
    productName: product ? (product.nameAr || product.nameEn || product.sku) : null,
    inStock
  };
}

export async function claimPosVoucher(params: {
  code: string;
  shiftId: string;
  warehouseId?: string;
  actorName?: string;
}): Promise<PosVoucherLookupResult> {
  if (!params.shiftId || !params.shiftId.trim()) {
    throw new Error('ERR_NO_ACTIVE_SHIFT');
  }

  const normCode = params.code.trim().toUpperCase();
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch(`/api/pos/vouchers/${encodeURIComponent(normCode)}/claim`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          shiftId: params.shiftId,
          warehouseId: isUuid(params.warehouseId) ? params.warehouseId : null,
          actorName: params.actorName
        })
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        return json.data;
      }
      if (json?.errorCode) {
        throw new Error(json.errorCode);
      }
    } catch (err: any) {
      if (err?.message?.startsWith('ERR_')) throw err;
    }
  }

  const vouchers = safeGet<LocalStoredVoucher[]>(KEYS.LOYALTY_VOUCHERS, []);
  const vIdx = vouchers.findIndex(v => String(v.voucherCode || '').toUpperCase() === normCode);
  if (vIdx < 0) throw new Error('ERR_VOUCHER_NOT_FOUND');
  if (vouchers[vIdx].status !== 'PendingPickup') {
    throw new Error('ERR_VOUCHER_INVALID_OR_CLAIMED');
  }

  const rewards = safeGet<LocalStoredReward[]>(KEYS.LOYALTY_REWARDS, []);
  const reward = rewards.find(r => r.id === vouchers[vIdx].rewardId);
  const products = getStoredProducts();

  if (reward?.productId) {
    const pIdx = products.findIndex(p => p.id === reward.productId);
    if (pIdx < 0 || (Number(products[pIdx].currentStock) || 0) < 1) {
      throw new Error('ERR_REWARD_OUT_OF_STOCK');
    }
    products[pIdx] = {
      ...products[pIdx],
      currentStock: Math.max(0, (Number(products[pIdx].currentStock) || 0) - 1)
    };
    saveStoredProducts(products);

    const warehouses = getStoredWarehouses();
    const wh = warehouses.find(w => w.id === products[pIdx].warehouseId) || warehouses[0];
    const txs = getStoredTransactions();
    saveStoredTransactions([
      {
        id: `MOV-${Date.now()}`,
        sku: products[pIdx].sku,
        productName: products[pIdx].nameAr || products[pIdx].nameEn,
        type: 'Outbound',
        qty: 1,
        unit: products[pIdx].unit || 'قطعة',
        location: wh?.nameAr || products[pIdx].warehouseName || 'WH-01',
        fromLocation: wh?.nameAr || products[pIdx].warehouseName || 'WH-01',
        toLocation: vouchers[vIdx].voucherCode,
        status: 'Fulfilled',
        referenceType: 'LoyaltyRewardRedemption',
        referenceNo: vouchers[vIdx].voucherCode,
        timestamp: new Date().toISOString(),
        movementDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        date: new Date().toISOString(),
        operator: params.actorName || 'Cashier'
      },
      ...txs
    ]);
  }

  const nowIso = new Date().toISOString();
  vouchers[vIdx] = {
    ...vouchers[vIdx],
    status: 'Claimed',
    claimedAt: nowIso,
    claimedByShiftId: params.shiftId
  };
  safeSet(KEYS.LOYALTY_VOUCHERS, vouchers);

  return lookupPosVoucher(normCode);
}

/**
 * Ensures locally registered customers (and their LoyaltyCardToken / LoyaltyMemberCode)
 * are persisted in PostgreSQL so QR scans from external mobile phones resolve immediately.
 */
export async function syncCustomersToBackend(customersSubset?: any[]): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  const list = (customersSubset && customersSubset.length > 0 ? customersSubset : getStoredCustomers())
    .filter(c => c && !c.isDefaultCashCustomer && c.name && String(c.code || '').toUpperCase() !== 'WALK-IN-CASH');

  if (list.length === 0) return;

  try {
    const payload = list.map(c => ({
      id: isUuid(c.id) ? c.id : null,
      code: c.code || null,
      name: c.name,
      phone: c.phone && c.phone !== '—' ? c.phone : null,
      creditLimit: Number(c.creditLimit) || 0,
      loyaltyPointsBalance: Number(c.loyaltyPointsBalance ?? c.loyaltyPoints ?? 0) || 0,
      loyaltyMemberCode: c.loyaltyMemberCode || null,
      loyaltyCardToken: c.loyaltyCardToken || null
    }));

    const res = await fetch('/api/customers/sync-loyalty-cards', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !Array.isArray(json.data)) return;

    const currentLocal = getStoredCustomers();
    const syncedByToken = new Map<string, any>();
    const syncedByCode = new Map<string, any>();
    for (const item of json.data) {
      if (item.loyaltyCardToken) syncedByToken.set(item.loyaltyCardToken, item);
      if (item.loyaltyMemberCode) syncedByCode.set(String(item.loyaltyMemberCode).toUpperCase(), item);
    }

    let changed = false;
    const merged = currentLocal.map(loc => {
      if (!loc || loc.isDefaultCashCustomer) return loc;
      const remote =
        (loc.loyaltyCardToken && syncedByToken.get(loc.loyaltyCardToken)) ||
        (loc.loyaltyMemberCode && syncedByCode.get(String(loc.loyaltyMemberCode).toUpperCase()));
      if (!remote) return loc;

      if (
        loc.id !== remote.id ||
        loc.loyaltyCardToken !== remote.loyaltyCardToken ||
        loc.loyaltyMemberCode !== remote.loyaltyMemberCode
      ) {
        changed = true;
        return {
          ...loc,
          id: remote.id,
          loyaltyMemberCode: remote.loyaltyMemberCode || loc.loyaltyMemberCode,
          loyaltyCardToken: remote.loyaltyCardToken || loc.loyaltyCardToken
        };
      }
      return loc;
    });

    if (changed) {
      saveStoredCustomers(merged);
    }
  } catch {
    // Non-blocking sync when offline
  }
}
