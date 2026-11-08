import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Power,
  Sliders,
  LogIn,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Warehouse,
  ShieldAlert,
  Calendar,
  X,
  CreditCard,
  ExternalLink,
  ChevronRight,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Layers,
  Check,
  Sparkles
} from 'lucide-react';
import TenantFeaturePresetEditor from './TenantFeaturePresetEditor';
import { 
  Tenant, 
  getStoredTenants, 
  toggleTenantStatus, 
  updateTenantQuotas, 
  createNewTenant, 
  getPlatformMetrics,
  formatExpiryDate,
  updateTenantPlan,
  deleteTenant 
} from '../../../services/tenantService';
import { UserProfile, UserAccount } from '../../../types/rbac';
import { getStoredUsers } from '../../../services/storageService';
import CreateTenantModal from '../../modals/CreateTenantModal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../../ui/dropdown-menu';

interface TenantsManagementViewProps {
  lang: 'ar' | 'en';
  onImpersonate: (tenant: Tenant) => void;
}

export default function TenantsManagementView({ lang, onImpersonate }: TenantsManagementViewProps) {
  const isAr = lang === 'ar';

  const [tenants, setTenants] = useState<Tenant[]>(() => getStoredTenants());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [quotaModalTenant, setQuotaModalTenant] = useState<Tenant | null>(null);
  const [quotaBranches, setQuotaBranches] = useState(5);
  const [quotaUsers, setQuotaUsers] = useState(20);

  // Action Modals state
  const [editingFeaturesTenant, setEditingFeaturesTenant] = useState<Tenant | null>(null);
  const [planModalTenant, setPlanModalTenant] = useState<Tenant | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'Starter' | 'Pro' | 'Enterprise'>('Pro');
  const [deleteConfirmTenant, setDeleteConfirmTenant] = useState<Tenant | null>(null);

  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);

  const refreshTenants = () => {
    setTenants(getStoredTenants());
  };

  const metrics = useMemo(() => getPlatformMetrics(), [tenants]);

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      const matchSearch = 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.adminUsername.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'active' && t.isActive) ||
        (statusFilter === 'suspended' && !t.isActive);

      const matchPlan = planFilter === 'all' || t.plan === planFilter;

      return matchSearch && matchStatus && matchPlan;
    });
  }, [tenants, searchTerm, statusFilter, planFilter]);

  const handleToggleStatus = (tenant: Tenant) => {
    const res = toggleTenantStatus(tenant.id);
    refreshTenants();
    setActionNotice({
      message: res.message,
      type: tenant.isActive ? 'danger' : 'success'
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSaveQuotas = () => {
    if (!quotaModalTenant) return;
    const res = updateTenantQuotas(quotaModalTenant.id, quotaBranches, quotaUsers);
    refreshTenants();
    setQuotaModalTenant(null);
    setActionNotice({
      message: res.message,
      type: 'success'
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSavePlan = () => {
    if (!planModalTenant) return;
    const res = updateTenantPlan(planModalTenant.id, selectedPlan);
    refreshTenants();
    setPlanModalTenant(null);
    setActionNotice({
      message: res.message,
      type: 'success'
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleDeleteTenant = (tenant: Tenant) => {
    const res = deleteTenant(tenant.id);
    refreshTenants();
    setDeleteConfirmTenant(null);
    setActionNotice({
      message: res.message,
      type: 'success'
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const renderPlanBadge = (plan: 'Starter' | 'Pro' | 'Enterprise') => {
    let label = '';
    if (plan === 'Enterprise') {
      label = isAr ? 'مؤسسات (Enterprise)' : 'Enterprise';
    } else if (plan === 'Pro') {
      label = isAr ? 'احترافية (Pro)' : 'Pro';
    } else if (plan === 'Starter') {
      label = isAr ? 'أساسية (Starter)' : 'Starter';
    }

    return (
      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
        {label}
      </span>
    );
  };


  if (editingFeaturesTenant) {
    return (
      <TenantFeaturePresetEditor
        tenant={editingFeaturesTenant}
        lang={lang}
        onBack={() => setEditingFeaturesTenant(null)}
        onSaved={(updated) => {
          refreshTenants();
          setEditingFeaturesTenant(updated);
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Action Notification Banner */}
      {actionNotice && (
        <div 
          style={{
            padding: '0.9rem 1.25rem',
            borderRadius: '10px',
            backgroundColor: actionNotice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${actionNotice.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            color: actionNotice.type === 'success' ? '#34d399' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.9rem',
            fontWeight: 600
          }}
        >
          {actionNotice.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* Top Statistical Metrics Bar */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem'
        }}
      >
        {/* Metric 1: Total Tenants */}
        <div 
          style={{
            backgroundColor: '#121215',
            border: '1px solid rgba(63, 63, 70, 0.5)',
            borderRadius: '14px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>
              {isAr ? 'إجمالي الشركات المشتركة' : 'Total Tenants'}
            </span>
            <Building2 size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f4f4f5' }}>
            {metrics.totalTenants}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#71717a' }}>
            {isAr ? `${metrics.totalBranches} فرع مسجل بالمنظومة` : `${metrics.totalBranches} branches registered`}
          </div>
        </div>

        {/* Metric 2: Active vs Suspended */}
        <div 
          style={{
            backgroundColor: '#121215',
            border: '1px solid rgba(63, 63, 70, 0.5)',
            borderRadius: '14px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>
              {isAr ? 'النشطة مقابل المعلقة' : 'Active vs Suspended'}
            </span>
            <Power size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#34d399' }}>
              {metrics.activeTenants}
            </span>
            <span style={{ fontSize: '0.9rem', color: '#71717a' }}>/</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>
              {metrics.suspendedTenants} {isAr ? 'معلقة' : 'suspended'}
            </span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#71717a' }}>
            {isAr ? 'منشأة تتطلب المتابعة' : 'Requires follow-up'}
          </div>
        </div>

        {/* Metric 3: Expiring Soon */}
        <div 
          style={{
            backgroundColor: '#121215',
            border: '1px solid rgba(63, 63, 70, 0.5)',
            borderRadius: '14px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>
              {isAr ? 'توشك على الانتهاء (خلال 7 أيام)' : 'Expiring in 7 Days'}
            </span>
            <Clock size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: metrics.expiringSoonTenants > 0 ? '#fbbf24' : '#f4f4f5' }}>
            {metrics.expiringSoonTenants}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#71717a' }}>
            {isAr ? 'تتطلب إشعار أو تجديد اشتراك' : 'Requires renewal notice'}
          </div>
        </div>

        {/* Metric 4: Platform Users */}
        <div 
          style={{
            backgroundColor: '#121215',
            border: '1px solid rgba(63, 63, 70, 0.5)',
            borderRadius: '14px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>
              {isAr ? 'إجمالي موظفي الشركات' : 'Total Tenant Staff'}
            </span>
            <Users size={18} style={{ color: '#a855f7' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f4f4f5' }}>
            {metrics.totalUsers}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#71717a' }}>
            {isAr ? 'عبر كافة المنشآت النشطة' : 'Across all active tenants'}
          </div>
        </div>
      </div>

      {/* Action Header & Filters */}
      <div 
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          backgroundColor: '#121215',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          borderRadius: '14px',
          padding: '1rem 1.25rem'
        }}
      >
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isAr ? 'right' : 'left']: '12px', color: '#71717a' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'بحث باسم المنشأة، الـ Slug، أو المدير...' : 'Search by tenant name, slug, or admin...'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: 'rgba(9, 9, 11, 0.8)',
                border: '1px solid rgba(63, 63, 70, 0.6)',
                borderRadius: '8px',
                padding: isAr ? '0.6rem 2.4rem 0.6rem 0.9rem' : '0.6rem 0.9rem 0.6rem 2.4rem',
                color: '#f4f4f5',
                fontSize: '0.86rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{
              backgroundColor: 'rgba(9, 9, 11, 0.8)',
              border: '1px solid rgba(63, 63, 70, 0.6)',
              borderRadius: '8px',
              padding: '0.6rem 0.9rem',
              color: '#d4d4d8',
              fontSize: '0.84rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">{isAr ? 'كافة الحالات' : 'All Statuses'}</option>
            <option value="active">{isAr ? 'النشطة فقط' : 'Active Only'}</option>
            <option value="suspended">{isAr ? 'المعلقة فقط' : 'Suspended Only'}</option>
          </select>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            style={{
              backgroundColor: 'rgba(9, 9, 11, 0.8)',
              border: '1px solid rgba(63, 63, 70, 0.6)',
              borderRadius: '8px',
              padding: '0.6rem 0.9rem',
              color: '#d4d4d8',
              fontSize: '0.84rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">{isAr ? 'كافة الباقات' : 'All Plans'}</option>
            <option value="Enterprise">Enterprise</option>
            <option value="Pro">Pro</option>
            <option value="Starter">Starter</option>
          </select>
        </div>

        {/* Add Tenant Button */}
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-emerald-950/40"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.15rem',
            borderRadius: '9px',
            border: 'none',
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Plus size={16} />
          <span>{isAr ? 'إضافة شركة / منشأة جديدة' : 'Add New Tenant'}</span>
        </button>
      </div>

      {/* Tenants Table */}
      <div 
        style={{
          backgroundColor: '#121215',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          borderRadius: '14px',
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#18181b', borderBottom: '1px solid rgba(63, 63, 70, 0.6)' }}>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, color: '#a1a1aa' }}>
                  {isAr ? 'المنشأة والمعرّف' : 'Organization & Identifier'}
                </th>
                <th style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#a1a1aa' }}>
                  {isAr ? 'الدولة والعملة' : 'Country & Currency'}
                </th>
                <th style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#a1a1aa' }}>
                  {isAr ? 'الباقة والانتهاء' : 'Plan & Expiry'}
                </th>
                <th style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#a1a1aa' }}>
                  {isAr ? 'الحصص (الفروع / المستخدمين)' : 'Quotas (Branches / Users)'}
                </th>
                <th style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#a1a1aa' }}>
                  {isAr ? 'حالة المنشأة' : 'Status'}
                </th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, color: '#a1a1aa', textAlign: 'center' }}>
                  {isAr ? 'الإجراءات والتحكم' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.9rem' }}>
                    {isAr ? 'لم يتم العثور على منشآت تطابق البحث' : 'No matching tenants found'}
                  </td>
                </tr>
              ) : (
                filteredTenants.map(t => {
                  const isExpiringSoon = t.isActive && new Date(t.expiresAt).getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000;
                  const isExpired = new Date(t.expiresAt).getTime() < Date.now();

                  return (
                    <tr 
                      key={t.id} 
                      style={{ 
                        borderBottom: '1px solid rgba(63, 63, 70, 0.3)',
                        backgroundColor: t.isActive ? 'transparent' : 'rgba(239, 68, 68, 0.03)'
                      }}
                    >
                      {/* Org Name & Slug */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div 
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              backgroundColor: t.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              border: `1px solid ${t.isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: t.isActive ? '#10b981' : '#ef4444',
                              fontWeight: 700
                            }}
                          >
                            <Building2 size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f4f4f5' }}>
                              {t.name.replace(/\s*\(معلقة\)\s*/g, '').trim()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '3px' }}>
                              <span 
                                dir="ltr"
                                style={{
                                  fontSize: '0.74rem',
                                  fontFamily: 'monospace',
                                  padding: '1.5px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(39, 39, 42, 0.9)',
                                  color: '#34d399',
                                  border: '1px solid rgba(63, 63, 70, 0.5)',
                                  direction: 'ltr',
                                  unicodeBidi: 'isolate',
                                  display: 'inline-block'
                                }}
                              >
                                @{t.slug}
                              </span>
                              <span style={{ fontSize: '0.74rem', color: '#71717a' }}>
                                {t.adminUsername}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Country & Currency */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontSize: '0.86rem', color: '#f4f4f5', fontWeight: 600 }}>
                          {t.countryCode} • {t.currency}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '2px' }}>
                          {isAr ? 'العملة الأساسية' : 'Base Currency'}
                        </div>
                      </td>

                      {/* Plan & Expiry */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {renderPlanBadge(t.plan)}
                          {t.businessPresetName && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Sparkles size={10} />
                              <span>{t.businessPresetName}</span>
                            </span>
                          )}
                        </div>
                        <div 
                          style={{ 
                            fontSize: '0.74rem', 
                            marginTop: '5px', 
                            color: isExpired ? '#ef4444' : isExpiringSoon ? '#fbbf24' : '#a1a1aa',
                            fontWeight: isExpiringSoon || isExpired ? 700 : 400
                          }}
                        >
                          {isExpired 
                            ? (isAr ? 'منتهي الصلاحية' : 'Expired') 
                            : (isAr ? `ينتهي: ${formatExpiryDate(t.expiresAt, true)}` : `Exp: ${formatExpiryDate(t.expiresAt, false)}`)
                          }
                        </div>
                      </td>

                      {/* Quotas */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontSize: '0.84rem', color: '#e4e4e7' }}>
                          <span style={{ fontWeight: 700 }}>{t.activeBranchesCount}</span> / {t.maxBranches} {isAr ? 'فروع' : 'branches'}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#a1a1aa', marginTop: '2px' }}>
                          <span style={{ fontWeight: 700 }}>{t.activeUsersCount}</span> / {t.maxUsers} {isAr ? 'موظفين' : 'users'}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '1rem 1rem' }}>
                        {t.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            <span>{isAr ? 'نشط' : 'Active'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <span className="inline-flex rounded-full h-2 w-2 bg-rose-500" />
                            <span>{isAr ? 'معلق' : 'Suspended'}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions Column UX */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', position: 'relative' }}>
                          {/* Primary Action Button: Impersonation */}
                          <button
                            type="button"
                            onClick={() => onImpersonate(t)}
                            disabled={!t.isActive}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '8px',
                              backgroundColor: 'transparent',
                              border: `1px solid ${t.isActive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(63, 63, 70, 0.35)'}`,
                              color: t.isActive ? '#34d399' : '#71717a',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: t.isActive ? 'pointer' : 'not-allowed',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              if (t.isActive) {
                                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                                e.currentTarget.style.borderColor = '#10b981';
                              }
                            }}
                            onMouseLeave={e => {
                              if (t.isActive) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                              }
                            }}
                            title={t.isActive ? (isAr ? 'الدخول كعميل لتقديم الدعم الفني' : 'Impersonate as tenant admin') : (isAr ? 'المنشأة معلقة حالياً' : 'Tenant suspended')}
                          >
                            <span>{isAr ? 'دخول كعميل' : 'Impersonate'}</span>
                            <ArrowLeft size={14} style={{ transform: isAr ? 'none' : 'rotate(180deg)' }} />
                          </button>

                          {/* Standard Portalled Secondary Actions Dropdown */}
                          <DropdownMenu dir={isAr ? 'rtl' : 'ltr'}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  backgroundColor: 'transparent',
                                  border: '1px solid rgba(63, 63, 70, 0.5)',
                                  color: '#d4d4d8',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(63, 63, 70, 0.5)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                title={isAr ? 'خيارات إضافية' : 'More options'}
                              >
                                <MoreHorizontal size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 p-1.5 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-2xl z-[99999]"
                            >
                              {/* Option 1: Edit Quotas */}
                              <DropdownMenuItem
                                onClick={() => {
                                  setQuotaModalTenant(t);
                                  setQuotaBranches(t.maxBranches);
                                  setQuotaUsers(t.maxUsers);
                                }}
                                className="flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer hover:bg-zinc-800 font-medium text-zinc-100 transition-colors"
                              >
                                <Sliders size={14} className="text-sky-400" />
                                <span>{isAr ? 'تعديل الحصص' : 'Edit Quotas'}</span>
                              </DropdownMenuItem>

                              {/* Option 2: Change Plan */}
                              <DropdownMenuItem
                                onClick={() => {
                                  setPlanModalTenant(t);
                                  setSelectedPlan(t.plan);
                                }}
                                className="flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer hover:bg-zinc-800 font-medium text-zinc-100 transition-colors"
                              >
                                <Layers size={14} className="text-purple-400" />
                                <span>{isAr ? 'تعديل الباقة' : 'Change Plan'}</span>
                              </DropdownMenuItem>

                              {/* Option 3: Edit Presets & Feature Flags */}
                              <DropdownMenuItem
                                onClick={() => setEditingFeaturesTenant(t)}
                                className="flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer hover:bg-zinc-800 font-medium text-amber-400 transition-colors"
                              >
                                <Sparkles size={14} className="text-amber-400" />
                                <span>{isAr ? 'الباقة والميزات التشغيلية' : 'Feature Flags & Presets'}</span>
                              </DropdownMenuItem>

                              {/* Option 4: Suspend / Activate Tenant */}
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(t)}
                                className="flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer hover:bg-zinc-800 font-medium transition-colors"
                                style={{ color: t.isActive ? '#f87171' : '#34d399' }}
                              >
                                <Power size={14} />
                                <span>{t.isActive ? (isAr ? 'تعليق المنشأة' : 'Suspend Tenant') : (isAr ? 'تفعيل المنشأة' : 'Activate Tenant')}</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="my-1 bg-zinc-700/60" />

                              {/* Option 4: Delete Tenant */}
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirmTenant(t)}
                                className="flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer hover:bg-rose-500/15 text-rose-400 font-medium transition-colors"
                              >
                                <Trash2 size={14} />
                                <span>{isAr ? 'حذف المنشأة' : 'Delete Tenant'}</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Add New Tenant */}
      <CreateTenantModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(_newTenant, message) => {
          refreshTenants();
          setActionNotice({
            message,
            type: 'success'
          });
          setTimeout(() => setActionNotice(null), 5000);
        }}
        lang={lang}
      />

      {/* MODAL 2: Edit Quotas */}
      {quotaModalTenant && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            direction: isAr ? 'rtl' : 'ltr'
          }}
          onClick={() => setQuotaModalTenant(null)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#18181b',
              border: '1px solid rgba(63, 63, 70, 0.8)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95)',
              color: '#f4f4f5'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Sliders size={20} style={{ color: '#38bdf8' }} />
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                  {isAr ? 'تعديل حصص المنشأة' : 'Edit Tenant Quotas'}
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setQuotaModalTenant(null)}
                style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem', fontSize: '0.86rem', color: '#a1a1aa' }}>
              {isAr ? `تعديل الحصص المخصصة لشركة "${quotaModalTenant.name}":` : `Adjust quotas for "${quotaModalTenant.name}":`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '4px' }}>
                  {isAr ? 'الحد الأقصى للفروع المصرح بها' : 'Maximum Allowed Branches'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={quotaBranches}
                  onChange={e => setQuotaBranches(parseInt(e.target.value) || 1)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#09090b',
                    border: '1px solid rgba(63, 63, 70, 0.6)',
                    borderRadius: '8px',
                    color: '#f4f4f5',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '4px' }}>
                  {isAr ? 'الحد الأقصى لعدد المستخدمين والموظفين' : 'Maximum Allowed User Accounts'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={quotaUsers}
                  onChange={e => setQuotaUsers(parseInt(e.target.value) || 1)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#09090b',
                    border: '1px solid rgba(63, 63, 70, 0.6)',
                    borderRadius: '8px',
                    color: '#f4f4f5',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setQuotaModalTenant(null)}
                style={{
                  padding: '0.65rem 1.15rem',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(63, 63, 70, 0.6)',
                  color: '#d4d4d8',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleSaveQuotas}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-emerald-950/40"
                style={{
                  padding: '0.65rem 1.35rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.88rem'
                }}
              >
                {isAr ? 'حفظ التعديلات' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Change Tenant Plan */}
      {planModalTenant && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            direction: isAr ? 'rtl' : 'ltr'
          }}
          onClick={() => setPlanModalTenant(null)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#18181b',
              border: '1px solid rgba(63, 63, 70, 0.8)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95)',
              color: '#f4f4f5'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Layers size={20} style={{ color: '#c084fc' }} />
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                  {isAr ? 'تعديل باقة اشتراك المنشأة' : 'Change Tenant Plan'}
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setPlanModalTenant(null)}
                style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem', fontSize: '0.86rem', color: '#a1a1aa' }}>
              {isAr ? `اختيار باقة الاشتراك لمنشأة "${planModalTenant.name}":` : `Select new subscription tier for "${planModalTenant.name}":`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {/* Starter */}
              <div
                onClick={() => setSelectedPlan('Starter')}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${selectedPlan === 'Starter' ? '#10b981' : 'rgba(63, 63, 70, 0.6)'}`,
                  backgroundColor: selectedPlan === 'Starter' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(24, 24, 27, 0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f4f4f5' }}>
                    {isAr ? 'أساسية (Starter)' : 'Starter Tier'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px' }}>
                    {isAr ? 'فرع واحد • حتى 5 مستخدمين' : '1 Branch • Up to 5 Users'}
                  </div>
                </div>
                {selectedPlan === 'Starter' && <Check size={18} style={{ color: '#10b981' }} />}
              </div>

              {/* Pro */}
              <div
                onClick={() => setSelectedPlan('Pro')}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${selectedPlan === 'Pro' ? '#10b981' : 'rgba(63, 63, 70, 0.6)'}`,
                  backgroundColor: selectedPlan === 'Pro' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(24, 24, 27, 0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f4f4f5' }}>
                    {isAr ? 'احترافية (Pro)' : 'Pro Tier'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px' }}>
                    {isAr ? 'حتى 5 فروع • حتى 20 مستخدماً' : 'Up to 5 Branches • Up to 20 Users'}
                  </div>
                </div>
                {selectedPlan === 'Pro' && <Check size={18} style={{ color: '#10b981' }} />}
              </div>

              {/* Enterprise */}
              <div
                onClick={() => setSelectedPlan('Enterprise')}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${selectedPlan === 'Enterprise' ? '#c084fc' : 'rgba(63, 63, 70, 0.6)'}`,
                  backgroundColor: selectedPlan === 'Enterprise' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(24, 24, 27, 0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f4f4f5' }}>
                    {isAr ? 'مؤسسات (Enterprise)' : 'Enterprise Tier'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px' }}>
                    {isAr ? 'فروع ومستخدمين غير محدودين • دعم مخصص' : 'Unlimited Scale • Dedicated Support'}
                  </div>
                </div>
                {selectedPlan === 'Enterprise' && <Check size={18} style={{ color: '#c084fc' }} />}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setPlanModalTenant(null)}
                style={{
                  padding: '0.65rem 1.15rem',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(63, 63, 70, 0.6)',
                  color: '#d4d4d8',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleSavePlan}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-emerald-950/40"
                style={{
                  padding: '0.65rem 1.35rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.88rem'
                }}
              >
                {isAr ? 'حفظ وتحديث الباقة' : 'Update Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Tenant Confirmation */}
      {deleteConfirmTenant && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            direction: isAr ? 'rtl' : 'ltr'
          }}
          onClick={() => setDeleteConfirmTenant(null)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#18181b',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95)',
              color: '#f4f4f5'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem', color: '#ef4444' }}>
              <AlertTriangle size={24} />
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                {isAr ? 'تأكيد حذف المنشأة نهائياً' : 'Confirm Permanent Deletion'}
              </span>
            </div>

            <div style={{ marginBottom: '1.5rem', fontSize: '0.88rem', color: '#d4d4d8', lineHeight: 1.6 }}>
              {isAr 
                ? `هل أنت متأكد من رغبتك بحذف منشأة "${deleteConfirmTenant.name}"؟ هذا الإجراء سيوقف كافة حسابات الموظفين المرتبطة بها نهائياً.`
                : `Are you sure you want to permanently delete "${deleteConfirmTenant.name}"? This action is irreversible.`}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmTenant(null)}
                style={{
                  padding: '0.65rem 1.15rem',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(63, 63, 70, 0.6)',
                  color: '#d4d4d8',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {isAr ? 'تراجع' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => handleDeleteTenant(deleteConfirmTenant)}
                style={{
                  padding: '0.65rem 1.35rem',
                  borderRadius: '8px',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.88rem'
                }}
              >
                {isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
