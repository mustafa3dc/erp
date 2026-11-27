import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Filter,
  Clock,
  User,
  ArrowRight,
  ArrowLeft,
  Lock,
  Sparkles,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getTranslation } from '../../lib/i18n';
import { getTenantAuthHeaders } from '../../lib/api-client';
import { getAuthToken } from '../../services/purchasesService';
import { useTenantPlan } from '../../hooks/useTenantPlan';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface AuditLogEntry {
  id: string;
  tenantId?: string | null;
  userId: string;
  userName: string;
  actionType: string;
  entityName: string;
  entityId: string;
  oldValuesJson?: string | null;
  newValuesJson?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

interface AuditLogPageResponse {
  items: AuditLogEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  availableUsers: string[];
  availableActionTypes: string[];
}

interface AuditLogViewProps {
  lang: 'ar' | 'en';
}

function safeParseJsonObject(raw?: string | null): Record<string, unknown> | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return null;
  }
}

function formatDiffVal(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return val.toLocaleString();
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export default function AuditLogView({ lang }: AuditLogViewProps) {
  const isAr = lang === 'ar';
  const t = (key: string) => getTranslation(lang, `auditLog.${key}`);
  const { canAccess, openUpgradeModal } = useTenantPlan();
  const isAuditAllowed = canAccess('AuditLog');

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [availableActionTypes, setAvailableActionTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const pageSize = 20;

  const loadAuditLogs = useCallback(async () => {
    if (!isAuditAllowed) return;
    const token = getAuthToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('pageSize', String(pageSize));
      if (userFilter) qs.set('userId', userFilter);
      if (actionFilter && actionFilter !== 'ALL') qs.set('actionType', actionFilter);
      if (searchTerm.trim()) qs.set('search', searchTerm.trim());
      if (dateFrom) qs.set('dateFrom', new Date(`${dateFrom}T00:00:00Z`).toISOString());
      if (dateTo) qs.set('dateTo', new Date(`${dateTo}T23:59:59Z`).toISOString());

      const res = await fetch(`/api/audit-logs?${qs.toString()}`, {
        headers: getTenantAuthHeaders(),
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      const data: AuditLogPageResponse | undefined = json?.data;
      if (data) {
        setEntries(Array.isArray(data.items) ? data.items : []);
        setTotalCount(Number(data.totalCount) || 0);
        setTotalPages(Math.max(1, Number(data.totalPages) || 1));
        setAvailableUsers(Array.isArray(data.availableUsers) ? data.availableUsers : []);
        setAvailableActionTypes(Array.isArray(data.availableActionTypes) ? data.availableActionTypes : []);
      }
    } catch {
      // handled silently
    } finally {
      setIsLoading(false);
    }
  }, [isAuditAllowed, page, userFilter, actionFilter, searchTerm, dateFrom, dateTo]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const getActionLabel = (action: string) => {
    const translated = getTranslation(lang, `auditLog.actions.${action}`, '');
    return translated || action;
  };

  const getActionBadgeClass = (action: string) => {
    const upper = action.toUpperCase();
    if (upper.includes('VOID') || upper.includes('DELETE')) {
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30';
    }
    if (upper.includes('OVERRIDE') || upper.includes('DISCOUNT') || upper.includes('PRICE')) {
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30';
    }
    if (upper.includes('STOCK') || upper.includes('IMPORT')) {
      return 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30';
    }
    if (upper.includes('BACKUP') || upper.includes('SHIFT')) {
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30';
    }
    return 'bg-muted text-foreground border border-border';
  };

  const renderDiffCells = (entry: AuditLogEntry) => {
    const oldObj = safeParseJsonObject(entry.oldValuesJson);
    const newObj = safeParseJsonObject(entry.newValuesJson);

    if (!oldObj && !newObj) {
      return <span className="text-[11px] text-muted-foreground">{t('noChanges')}</span>;
    }

    const keys = Array.from(new Set([
      ...(oldObj ? Object.keys(oldObj) : []),
      ...(newObj ? Object.keys(newObj) : [])
    ]));

    return (
      <div className="space-y-1 max-w-md">
        {keys.slice(0, 6).map(k => {
          const hasOld = oldObj && k in oldObj;
          const hasNew = newObj && k in newObj;
          const oldStr = hasOld ? formatDiffVal(oldObj![k]) : null;
          const newStr = hasNew ? formatDiffVal(newObj![k]) : null;

          return (
            <div key={k} className="flex flex-wrap items-center gap-1.5 text-[11px] leading-tight">
              <span className="font-mono font-semibold text-muted-foreground">{k}:</span>
              {hasOld && (
                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 font-mono tabular-nums" dir="ltr">
                  {oldStr}
                </span>
              )}
              {hasOld && hasNew && (
                isAr ? <ArrowLeft className="w-3 h-3 text-muted-foreground shrink-0" /> : <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              )}
              {hasNew && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono tabular-nums font-bold" dir="ltr">
                  {newStr}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const resetFilters = () => {
    setUserFilter('');
    setActionFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
    setPage(1);
  };

  if (!isAuditAllowed) {
    return (
      <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-lg mx-auto my-12 space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-foreground m-0">{t('proLockedTitle')}</h2>
          <p className="text-xs text-muted-foreground m-0">{t('pageSubtitle')}</p>
          <Button
            type="button"
            onClick={() => openUpgradeModal('Pro', 'AuditLog')}
            className="h-9 px-4 text-xs font-bold gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{getTranslation(lang, 'installmentsDue.upgradeBtn')}</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-content-wrapper fade-in space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground m-0 leading-tight">{t('pageTitle')}</h1>
            <p className="text-xs text-muted-foreground m-0 mt-0.5">{t('pageSubtitle')}</p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadAuditLogs}
          disabled={isLoading}
          className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-lg border-border/80 self-start sm:self-center"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>{t('refreshBtn')}</span>
        </Button>
      </div>

      {/* Filter Panel */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder={t('searchPlaceholder')}
              className="h-9 ps-9 text-xs bg-background border-border"
            />
          </div>

          {/* Employee Filter */}
          <select
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t('filterUserLabel')}
            className="h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">{t('filterAllUsers')}</option>
            {availableUsers.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          {/* ActionType Filter */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t('filterActionLabel')}
            className="h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:border-primary"
          >
            <option value="ALL">{t('filterAllActions')}</option>
            {availableActionTypes.map(act => (
              <option key={act} value={act}>{getActionLabel(act)}</option>
            ))}
          </select>

          {/* Date From */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            title={t('filterDateFrom')}
            className="h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:border-primary"
          />

          {/* Date To + Reset */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              title={t('filterDateTo')}
              className="h-9 flex-1 px-3 rounded-lg border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
            {(userFilter || actionFilter !== 'ALL' || dateFrom || dateTo || searchTerm) && (
              <button
                type="button"
                onClick={resetFilters}
                title={t('clearFiltersBtn')}
                className="h-9 w-9 shrink-0 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="bg-muted/80 border-b border-border text-muted-foreground font-bold text-[11px]">
                <th className="py-3 px-3.5 text-start">{t('colTimestamp')}</th>
                <th className="py-3 px-3.5 text-start">{t('colEmployee')}</th>
                <th className="py-3 px-3.5 text-start">{t('colAction')}</th>
                <th className="py-3 px-3.5 text-start">{t('colEntity')}</th>
                <th className="py-3 px-3.5 text-start">{t('colChanges')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading && entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Filter className="w-7 h-7 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-semibold text-foreground m-0">{t('emptyTitle')}</p>
                    <span className="text-[11px] text-muted-foreground block mt-1">{t('emptySubtitle')}</span>
                  </td>
                </tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-muted/40 transition-colors align-top">
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-foreground tabular-nums" dir="ltr">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{new Date(entry.createdAt).toLocaleString(isAr ? 'ar-IQ' : 'en-US')}</span>
                      </div>
                      {entry.ipAddress && (
                        <span className="text-[10px] text-muted-foreground font-mono block mt-0.5 tabular-nums" dir="ltr">
                          {entry.ipAddress}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <User className="w-3.5 h-3.5 text-primary shrink-0" />
                        <bdi dir="auto">{entry.userName || entry.userId}</bdi>
                      </div>
                      {entry.userName && entry.userId !== entry.userName && (
                        <span className="text-[10px] text-muted-foreground font-mono block mt-0.5" dir="ltr">
                          {entry.userId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${getActionBadgeClass(entry.actionType)}`}>
                        {getActionLabel(entry.actionType)}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <span className="font-mono font-semibold text-foreground block" dir="ltr">
                        {entry.entityName}
                      </span>
                      <span className="font-mono text-[11px] text-primary block mt-0.5 tabular-nums" dir="ltr">
                        {entry.entityId}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      {renderDiffCells(entry)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground font-mono tabular-nums">
            {t('pageInfo')
              .replace('{page}', String(page))
              .replace('{totalPages}', String(totalPages))
              .replace('{totalCount}', String(totalCount))}
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="h-8 px-3 text-xs font-semibold gap-1"
            >
              {isAr ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
              <span>{t('prevBtn')}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="h-8 px-3 text-xs font-semibold gap-1"
            >
              <span>{t('nextBtn')}</span>
              {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
