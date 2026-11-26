"use client";

import React, { useState, useEffect } from 'react';
import {
  getStoredRMA,
  saveStoredRMA,
  executeSalesReturnRestock,
  updateLocalSerialStatus
} from '../../services/storageService';
import NewReturnModal, { ReturnRequestData } from '../modals/NewReturnModal';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';
import { Product, Warehouse, TransactionDetail } from '../../types/warehouse';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Plus,
  Check,
  X,
  Warehouse as WarehouseIcon
} from 'lucide-react';

interface ReturnRequest {
  id: string;
  backendRmaId?: string;
  rmaNumber: string;
  originalInvoiceNo: string;
  customerName: string;
  customerPhone: string;
  productId?: string;
  productName: string;
  sku: string;
  serialNumber: string;
  warehouseId?: string;
  warehouseName?: string;
  returnReason: string;
  warrantyStatus: 'VALID_UNDER_WARRANTY' | 'EXPIRED' | 'VOID_PHYSICAL_DAMAGE';
  decision: 'PENDING_INSPECTION' | 'APPROVED_RESTOCKED' | 'SENT_TO_MAINTENANCE' | 'REJECTED';
  isRestocked?: boolean;
  returnQuantity?: number;
  refundAmount: number;
  currency?: string;
  date: string;
}

interface ReturnsWarrantyViewProps {
  lang: 'en' | 'ar';
  warehouses?: Warehouse[];
  setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
  setTransactions?: React.Dispatch<React.SetStateAction<TransactionDetail[]>>;
  currentUser?: any;
}

export default function ReturnsWarrantyView({
  lang,
  warehouses,
  setProducts,
  setTransactions,
  currentUser
}: ReturnsWarrantyViewProps) {
  const tr = (key: string, fallback?: string) => getTranslation(lang, `ui.rma.${key}`, fallback);
  const { formatMoney, settings } = useSettings();
  const [returnsList, setReturnsList] = useState<ReturnRequest[]>(() => {
    return getStoredRMA();
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDecision, setFilterDecision] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState('');
  const [errorToastMsg, setErrorToastMsg] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [processingRmaId, setProcessingRmaId] = useState<string | null>(null);

  const actorName = currentUser?.fullName || currentUser?.username || currentUser?.name || 'System';

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('zilox_auth_token') || localStorage.getItem('logistock_erp_jwt_token'))
      : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (settings.tenantCountryCode) headers['X-Tenant-Country'] = settings.tenantCountryCode;
    return headers;
  };

  // Sync persisted backend RMAs on mount (gracefully preserves local entries offline)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/invoices/returns', { headers: getAuthHeaders() })
      .then(res => (res.ok ? res.json() : null))
      .then((remoteItems: any[]) => {
        if (cancelled || !Array.isArray(remoteItems) || remoteItems.length === 0) return;
        setReturnsList(prev => {
          const byRma = new Map<string, ReturnRequest>();
          for (const item of prev) byRma.set(item.rmaNumber, item);
          for (const r of remoteItems) {
            const existing = byRma.get(r.rmaNumber);
            byRma.set(r.rmaNumber, {
              id: existing?.id || String(r.rmaId),
              backendRmaId: String(r.rmaId),
              rmaNumber: r.rmaNumber,
              originalInvoiceNo: r.invoiceNumber,
              customerName: r.customerName || existing?.customerName || tr('cashCustomerFallback'),
              customerPhone: r.customerPhone || existing?.customerPhone || '—',
              productId: r.productId || existing?.productId,
              productName: r.productName,
              sku: r.sku,
              serialNumber: r.serialNumber || existing?.serialNumber || '',
              warehouseId: r.warehouseId || existing?.warehouseId,
              warehouseName: r.warehouseName || existing?.warehouseName,
              returnReason: r.returnReason || existing?.returnReason || '',
              warrantyStatus: (r.warrantyStatus as any) || 'VALID_UNDER_WARRANTY',
              decision: (r.decision as any) || 'PENDING_INSPECTION',
              isRestocked: Boolean(r.isRestocked || r.decision === 'APPROVED_RESTOCKED'),
              returnQuantity: Number(r.returnQuantity) || 1,
              refundAmount: Number(r.refundAmount) || 0,
              currency: r.currency || 'IQD',
              date: r.createdAt ? String(r.createdAt).split('T')[0] : (existing?.date || '')
            });
          }
          const merged = Array.from(byRma.values());
          saveStoredRMA(merged);
          return merged;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (msg: string) => {
    setErrorToastMsg('');
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const showErrorToast = (msg: string) => {
    setToastMsg('');
    setErrorToastMsg(msg);
    setTimeout(() => setErrorToastMsg(''), 4500);
  };

  const applyLocalRestock = (rma: ReturnRequestData | ReturnRequest) => {
    const restockResult = executeSalesReturnRestock({
      rmaId: rma.id,
      rmaNumber: rma.rmaNumber,
      invoiceNo: rma.originalInvoiceNo,
      productId: rma.productId,
      sku: rma.sku,
      productName: rma.productName,
      returnQuantity: Number(rma.returnQuantity) || 1,
      warehouseId: rma.warehouseId,
      warehouseName: rma.warehouseName,
      customerName: rma.customerName,
      serialNumber: rma.serialNumber,
      operator: actorName
    });

    if (setProducts) {
      setProducts(restockResult.updatedProducts);
    }
    if (setTransactions && restockResult.createdTransactions.length > 0) {
      setTransactions(prev => [...restockResult.createdTransactions, ...prev]);
    }
    return {
      restockedWarehouseName: restockResult.restockedWarehouseName,
      reversedLoyaltyPoints: restockResult.reversedLoyaltyPoints
    };
  };

  const handleApproveRestock = async (id: string) => {
    const target = returnsList.find(r => r.id === id);
    if (!target || target.decision === 'APPROVED_RESTOCKED' || processingRmaId === id) return;

    setProcessingRmaId(id);
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const remoteId = target.backendRmaId || (uuidRegex.test(target.id) ? target.id : null);

      if (remoteId) {
        try {
          const res = await fetch(`/api/invoices/returns/${encodeURIComponent(remoteId)}/approve`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ warehouseId: uuidRegex.test(target.warehouseId || '') ? target.warehouseId : null })
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => null);
            if (errBody?.errorCode === 'ERR_RETURN_QTY_EXCEEDS_SOLD' || errBody?.errorCode === 'ERR_RETURN_ALREADY_RESTOCKED') {
              showErrorToast(errBody.message || tr('restockApprovedToast'));
              return;
            }
          }
        } catch {
          // Local/offline mode continues cleanly below
        }
      }

      const { restockedWarehouseName: resolvedWhName, reversedLoyaltyPoints } = applyLocalRestock(target);
      const updated = returnsList.map(r =>
        r.id === id
          ? {
              ...r,
              decision: 'APPROVED_RESTOCKED' as const,
              isRestocked: true,
              warehouseName: r.warehouseName || resolvedWhName
            }
          : r
      );
      setReturnsList(updated);
      saveStoredRMA(updated);
      showToast(
        reversedLoyaltyPoints > 0
          ? `${tr('restockApprovedToast')} — ${getTranslation(lang, 'ui.loyalty.reversedOnReturnToast').replace('{points}', reversedLoyaltyPoints.toLocaleString('en-US'))}`
          : tr('restockApprovedToast')
      );
    } finally {
      setProcessingRmaId(null);
    }
  };

  const handleCreateReturn = async (newReturn: ReturnRequestData) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let backendRmaId: string | undefined;

    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(newReturn.originalInvoiceNo)}/returns`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          rmaNumber: newReturn.rmaNumber,
          productId: uuidRegex.test(newReturn.productId || '') ? newReturn.productId : '00000000-0000-0000-0000-000000000000',
          sku: newReturn.sku,
          serialNumber: newReturn.serialNumber,
          customerName: newReturn.customerName,
          customerPhone: newReturn.customerPhone,
          returnQuantity: newReturn.returnQuantity,
          warehouseId: uuidRegex.test(newReturn.warehouseId || '') ? newReturn.warehouseId : null,
          returnReason: newReturn.returnReason,
          warrantyStatus: newReturn.warrantyStatus,
          decision: newReturn.decision,
          currency: newReturn.currency
        })
      });

      if (res.ok) {
        const created = await res.json().catch(() => null);
        if (created?.rmaId) {
          backendRmaId = String(created.rmaId);
        }
      } else if (res.status === 400 || res.status === 409) {
        const errBody = await res.json().catch(() => null);
        if (errBody?.errorCode === 'ERR_SERIAL_NOT_FOUND_FOR_RETURN') {
          showErrorToast(getTranslation(lang, 'errors.ERR_SERIAL_NOT_FOUND_FOR_RETURN'));
          return;
        }
        if (errBody?.errorCode === 'ERR_RETURN_QTY_EXCEEDS_SOLD') {
          showErrorToast(errBody.message);
          return;
        }
      }
    } catch {
      // Offline / local fallback mode remains atomic via executeSalesReturnRestock
    }

    const shouldRestockNow = newReturn.decision === 'APPROVED_RESTOCKED';
    let resolvedWhName = newReturn.warehouseName;
    let reversedLoyaltyPoints = 0;
    if (shouldRestockNow) {
      const resInfo = applyLocalRestock(newReturn);
      resolvedWhName = resInfo.restockedWarehouseName;
      reversedLoyaltyPoints = resInfo.reversedLoyaltyPoints;
    } else if (newReturn.serialNumber && newReturn.serialNumber !== 'N/A') {
      updateLocalSerialStatus(
        newReturn.serialNumber,
        newReturn.decision === 'SENT_TO_MAINTENANCE' ? 'Defective' : 'Returned'
      );
    }

    const savedRecord: ReturnRequest = {
      ...newReturn,
      backendRmaId,
      warehouseName: resolvedWhName,
      isRestocked: shouldRestockNow
    };

    const next = [savedRecord, ...returnsList];
    setReturnsList(next);
    saveStoredRMA(next);
    setIsReturnModalOpen(false);

    const baseToast = (shouldRestockNow ? tr('createdAndRestockedToast') : tr('createdPendingToast')).replace('{rma}', newReturn.rmaNumber);
    showToast(
      reversedLoyaltyPoints > 0
        ? `${baseToast} — ${getTranslation(lang, 'ui.loyalty.reversedOnReturnToast').replace('{points}', reversedLoyaltyPoints.toLocaleString('en-US'))}`
        : baseToast
    );
  };

  const filtered = returnsList.filter(r => {
    const matchesDecision = filterDecision === 'ALL' || r.decision === filterDecision;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      r.rmaNumber.toLowerCase().includes(q) ||
      r.originalInvoiceNo.toLowerCase().includes(q) ||
      r.serialNumber.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      (r.warehouseName || '').toLowerCase().includes(q);
    return matchesDecision && matchesSearch;
  });

  const pendingCount = returnsList.filter(r => r.decision === 'PENDING_INSPECTION').length;
  const approvedCount = returnsList.filter(r => r.decision === 'APPROVED_RESTOCKED').length;
  const rejectedCount = returnsList.filter(r => r.decision === 'REJECTED').length;
  const totalRefunded = returnsList
    .filter(r => r.decision === 'APPROVED_RESTOCKED')
    .reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);

  return (
    <div className="view-content-wrapper fade-in">
      {toastMsg && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9999 }}>
          <CheckCircle2 size={16} className="green-text" />
          <span>{toastMsg}</span>
        </div>
      )}

      {errorToastMsg && (
        <div
          className="toast-banner glass-panel"
          style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9999, borderColor: '#ef4444', color: '#dc2626' }}
        >
          <AlertTriangle size={16} />
          <span>{errorToastMsg}</span>
        </div>
      )}

      {/* Module Context Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <RotateCcw size={15} style={{ color: 'var(--primary)' }} />
            <span>{tr('breadcrumb')}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          <button
            type="button"
            className="btn-clean-primary"
            onClick={() => setIsReturnModalOpen(true)}
          >
            <Plus size={15} />
            <span>{tr('newReturnBtn')}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{tr('kpiPendingLabel')}</span>
            <div className="module-kpi-value">
              {pendingCount} <span className="kpi-sub-unit">{tr('kpiPendingUnit')}</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Clock size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{tr('kpiApprovedLabel')}</span>
            <div className="module-kpi-value">
              {approvedCount} <span className="kpi-sub-unit">{tr('kpiApprovedUnit')}</span>
            </div>
          </div>
          <div className="module-kpi-icon emerald">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{tr('kpiRejectedLabel')}</span>
            <div className="module-kpi-value">
              {rejectedCount} <span className="kpi-sub-unit">{tr('kpiRejectedUnit')}</span>
            </div>
          </div>
          <div className="module-kpi-icon rose">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{tr('kpiRefundedLabel')}</span>
            <div className="module-kpi-value font-mono">
              {formatMoney(totalRefunded)}
            </div>
          </div>
          <div className="module-kpi-icon indigo">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="module-toolbar">
        <div className="module-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder={tr('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="module-filter-pills">
          {[
            { id: 'ALL', label: tr('filterAll') },
            { id: 'PENDING_INSPECTION', label: tr('filterPending') },
            { id: 'APPROVED_RESTOCKED', label: tr('filterApproved') },
            { id: 'REJECTED', label: tr('filterRejected') }
          ].map(f => (
            <button
              key={f.id}
              className={`filter-pill ${filterDecision === f.id ? 'active' : ''}`}
              onClick={() => setFilterDecision(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* RMA Table */}
      <div className="transactions-table-card">
        <div className="table-responsive">
          <table className="custom-data-table">
            <thead>
              <tr>
                <th>{tr('colRmaNo')}</th>
                <th>{tr('colInvoice')}</th>
                <th>{tr('colCustomer')}</th>
                <th>{tr('colItemSerial')}</th>
                <th>{tr('colWarehouse')}</th>
                <th>{tr('colWarranty')}</th>
                <th>{tr('colReason')}</th>
                <th>{tr('colStatusAction')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    {tr('emptyRegistry')}
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{r.rmaNumber}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--foreground)', fontWeight: 600 }}>
                        {r.originalInvoiceNo}
                      </span>
                    </td>
                    <td>
                      <strong style={{ display: 'block', fontSize: '13px', color: 'var(--foreground)', fontWeight: 700 }}>
                        {r.customerName}
                      </strong>
                      <small style={{ color: '#64748b' }}>{r.customerPhone}</small>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '13px' }}>{r.productName}</span>
                        {r.returnQuantity && r.returnQuantity > 0 && (
                          <span style={{ fontSize: '11px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            ×{r.returnQuantity}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }} dir="ltr">
                          {r.serialNumber}
                        </span>
                        {r.refundAmount > 0 && (
                          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                            ({formatMoney(r.refundAmount)})
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border text-[11px] font-semibold text-foreground">
                        <WarehouseIcon size={12} className="text-primary" />
                        <span>{r.warehouseName || tr('unassignedWarehouse')}</span>
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: r.warrantyStatus === 'VALID_UNDER_WARRANTY' ? '#ecfdf5' : '#fef2f2',
                        color: r.warrantyStatus === 'VALID_UNDER_WARRANTY' ? '#047857' : '#dc2626',
                        border: `1px solid ${r.warrantyStatus === 'VALID_UNDER_WARRANTY' ? '#a7f3d0' : '#fecaca'}`
                      }}>
                        {r.warrantyStatus === 'VALID_UNDER_WARRANTY' ? tr('warrantyValid') : tr('warrantyVoid')}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, maxWidth: '200px' }}>
                      {r.returnReason}
                    </td>
                    <td>
                      {r.decision === 'PENDING_INSPECTION' ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock size={12} />
                            <span>{tr('statusPendingBadge')}</span>
                          </span>
                          <button
                            type="button"
                            className="btn-clean-success"
                            disabled={processingRmaId === r.id}
                            onClick={() => handleApproveRestock(r.id)}
                          >
                            <Check size={14} />
                            <span>{processingRmaId === r.id ? tr('processingBtn') : tr('approveRestockBtn')}</span>
                          </button>
                        </div>
                      ) : r.decision === 'APPROVED_RESTOCKED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={14} />
                          <span>{tr('statusRestockedBadge')}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                          <X size={14} />
                          <span>{tr('statusRejectedBadge')}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Return Request Modal */}
      <NewReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        lang={lang}
        warehouses={warehouses}
        onSubmit={handleCreateReturn}
      />
    </div>
  );
}
