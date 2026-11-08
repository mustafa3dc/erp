'use client';

import React, { useState, useEffect } from 'react';
import { getTenantById, Tenant, getStoredTenants } from '../../../../../services/tenantService';
import TenantFeaturePresetEditor from '../../../../../components/views/superadmin/TenantFeaturePresetEditor';
import { Building2, ArrowRight, AlertTriangle } from 'lucide-react';

function getRouteParamId(): string {
  if (typeof window === 'undefined') return '';
  const search = new URLSearchParams(window.location.search);
  const qId = search.get('id') || search.get('tenantId');
  if (qId) return qId;
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

export default function SuperAdminTenantEditPage() {
  const [tenantId] = useState<string>(() => getRouteParamId());
  const router = {
    push: (url: string) => {
      if (typeof window !== 'undefined') {
        window.location.href = url;
      }
    }
  };

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    // 1. Try local storage service
    const localTenant = getTenantById(tenantId);
    if (localTenant) {
      setTenant(localTenant);
      setLoading(false);
      return;
    }

    // 2. Fetch from backend API
    const fetchFromApi = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
        const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setTenant({
              id: json.data.tenantId,
              name: json.data.tenantName,
              slug: json.data.tenantSlug,
              countryCode: 'IQ',
              currency: 'IQD',
              plan: 'Pro',
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              maxBranches: 5,
              maxUsers: 20,
              activeBranchesCount: 1,
              activeUsersCount: 1,
              isActive: true,
              createdAt: json.data.updatedAt,
              adminFullName: 'مسؤول المنشأة',
              adminUsername: `admin@${json.data.tenantSlug}`,
              businessPreset: json.data.businessPreset,
              businessPresetName: json.data.businessPresetName,
              features: json.data.features
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch tenant features from API', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFromApi();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">جاري تحميل بيانات المنشأة ومصفوفة الميزات...</span>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-lg font-bold">المنشأة غير موجودة</h2>
        <p className="text-xs text-muted-foreground">
          لم يتم العثور على أي شركة أو مستأجر مسجل برمز أو معرف: <code className="font-mono font-bold">{tenantId}</code>
        </p>
        <button
          type="button"
          onClick={() => router.push('/super-admin/tenants')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg cursor-pointer"
        >
          <ArrowRight size={14} />
          <span>العودة لقائمة الشركات</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <TenantFeaturePresetEditor
        tenant={tenant}
        lang="ar"
        onBack={() => router.push('/super-admin/tenants')}
        onSaved={(updated) => setTenant(updated)}
      />
    </div>
  );
}

