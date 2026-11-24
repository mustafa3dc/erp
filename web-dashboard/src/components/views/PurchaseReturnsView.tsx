import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowDownLeft, 
  Eye, 
  Trash2, 
  AlertCircle, 
  X, 
  FileText, 
  Building2, 
  Wallet,
  AlertTriangle,
  PackageX
} from 'lucide-react';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';
import { apiClient } from '../../lib/api-client';
import { 
  getStoredPurchaseReturns, 
  saveStoredPurchaseReturns,
  getStoredPurchaseOrders,
  getStoredWarehouses,
  getStoredTreasuryAccounts
} from '../../services/storageService';
import { 
  PurchaseReturn, 
  PurchaseReturnItem, 
  PurchaseReturnStatus, 
  RefundMethod 
} from '../../types/businessModules';
import { Warehouse } from '../../types/warehouse';
import { PurchaseOrder } from '../../types/purchases';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { ModalBackdropPortal } from '../ui/dialog';

interface PurchaseReturnsViewProps {
  lang: 'en' | 'ar';
}

export default function PurchaseReturnsView({ lang }: PurchaseReturnsViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();
  const getWhName = (w?: Warehouse) => w ? ((isAr ? w.nameAr : w.nameEn) || w.nameAr || w.nameEn) : '';

  const [returns, setReturns] = useState<PurchaseReturn[]>(() => getStoredPurchaseReturns());
  const [purchaseOrders] = useState<PurchaseOrder[]>(() => getStoredPurchaseOrders());
  const [warehouses] = useState<Warehouse[]>(() => getStoredWarehouses());
  const [treasuryAccounts] = useState(() => getStoredTreasuryAccounts());

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseReturnStatus>('ALL');

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<PurchaseReturn | null>(null);
  const [returnToApprove, setReturnToApprove] = useState<PurchaseReturn | null>(null);

  // Form State
  const [selectedBillId, setSelectedBillId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('SupplierCredit');
  const [notes, setNotes] = useState('');
  const [returnItems, setReturnItems] = useState<Array<{
    productId: string;
    productName: string;
    productSku: string;
    purchasedQty: number;
    previouslyReturnedQty: number;
    returnQty: number;
    unitCost: number;
    reason: string;
  }>>([]);

  // Fetch API with fallback
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get('/api/purchase-returns');
        if (res && res.success && Array.isArray(res.data)) {
          setReturns(res.data);
          saveStoredPurchaseReturns(res.data);
        }
      } catch {
        // fallback
      }
    };
    fetchData();
  }, []);

  // Update return items when a purchase bill is selected
  const handleBillSelect = (billId: string) => {
    setSelectedBillId(billId);
    const bill = purchaseOrders.find(po => po.id === billId || po.poNumber === billId);
    if (!bill) {
      setReturnItems([]);
      return;
    }

    if (bill.targetWarehouseId) {
      setSelectedWarehouseId(bill.targetWarehouseId);
    }

    // Map items from bill
    const items = (bill.items || []).map(it => {
      const purchased = it.quantity || 0;
      return {
        productId: it.productId || it.sku,
        productName: (isAr ? it.nameAr : it.nameEn) || it.nameAr || it.nameEn || it.sku,
        productSku: it.sku || '',
        purchasedQty: purchased,
        previouslyReturnedQty: 0,
        returnQty: 1,
        unitCost: it.estimatedUnitCost || 0,
        reason: 'Damaged'
      };
    });

    setReturnItems(items);
  };

  useEffect(() => {
    if (isCreateModalOpen) {
      if (purchaseOrders.length > 0 && !selectedBillId) {
        handleBillSelect(purchaseOrders[0].id || purchaseOrders[0].poNumber);
      }
      if (warehouses.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(warehouses[0].id);
      }
      if (treasuryAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(treasuryAccounts[0].id);
      }
    }
  }, [isCreateModalOpen, purchaseOrders, warehouses, treasuryAccounts, selectedBillId, selectedWarehouseId, selectedAccountId]);

  // KPIs
  const totalReturnsCount = returns.length;
  const approvedReturns = returns.filter(r => r.status === 'Approved');
  const totalApprovedAmount = approvedReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const pendingCount = returns.filter(r => r.status === 'Draft').length;
  const supplierCredits = approvedReturns.filter(r => r.refundMethod === 'SupplierCredit').reduce((sum, r) => sum + (r.totalAmount || 0), 0);

  // Filtered
  const filteredReturns = returns.filter(r => {
    const term = searchQuery.toLowerCase().trim();
    const matchesSearch = !term ||
      r.returnNo.toLowerCase().includes(term) ||
      r.supplierName.toLowerCase().includes(term) ||
      r.originalBillNo.toLowerCase().includes(term);

    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
      matchesStatus = r.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const formTotalAmount = returnItems.reduce((sum, it) => sum + (it.returnQty * it.unitCost), 0);

  // Create Return
  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBillId || returnItems.length === 0) return;

    const bill = purchaseOrders.find(po => po.id === selectedBillId || po.poNumber === selectedBillId);
    const validItems = returnItems.filter(it => it.returnQty > 0);
    if (validItems.length === 0) return;

    // Validate returnedQty <= purchasedQty - previouslyReturnedQty
    for (const it of validItems) {
      const maxReturnable = it.purchasedQty - it.previouslyReturnedQty;
      if (it.returnQty > maxReturnable) {
        showToast(getTranslation(lang, 'purchaseReturns.availableToReturn'));
        return;
      }
    }

    const payload = {
      originalBillId: bill?.id || selectedBillId,
      originalBillNo: bill?.poNumber || selectedBillId,
      supplierId: bill?.supplierId || 'SUPP-DEFAULT',
      supplierName: bill?.supplierName || 'Supplier',
      warehouseId: selectedWarehouseId,
      refundMethod,
      treasuryAccountId: refundMethod === 'CashRefund' ? selectedAccountId : undefined,
      notes: notes.trim() || undefined,
      items: validItems.map(it => ({
        productId: it.productId,
        returnedQty: it.returnQty,
        purchasedQty: it.purchasedQty,
        previouslyReturnedQty: it.previouslyReturnedQty,
        unitCost: it.unitCost,
        reason: it.reason
      }))
    };

    let newReturn: PurchaseReturn = {
      id: `PR-${Date.now()}`,
      tenantId: 'default',
      returnNo: `PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      originalBillId: payload.originalBillId,
      originalBillNo: payload.originalBillNo,
      supplierId: payload.supplierId,
      supplierName: payload.supplierName,
      warehouseId: payload.warehouseId,
      warehouseName: getWhName(warehouses.find(w => w.id === payload.warehouseId)) || payload.warehouseId,
      refundMethod: payload.refundMethod,
      treasuryAccountId: payload.treasuryAccountId,
      treasuryAccountName: treasuryAccounts.find(a => a.id === payload.treasuryAccountId)?.name,
      totalAmount: formTotalAmount,
      currency: 'USD',
      exchangeRate: 1,
      notes: payload.notes,
      status: 'Draft',
      createdAt: new Date().toISOString(),
      items: validItems.map((it, idx) => ({
        id: `PRI-${Date.now()}-${idx}`,
        returnId: '',
        productId: it.productId,
        productName: it.productName,
        productSku: it.productSku,
        returnedQty: it.returnQty,
        purchasedQty: it.purchasedQty,
        previouslyReturnedQty: it.previouslyReturnedQty,
        unitCost: it.unitCost,
        totalCost: it.returnQty * it.unitCost,
        reason: it.reason
      }))
    };

    try {
      const res = await apiClient.post('/api/purchase-returns', payload);
      if (res && res.success && res.data) {
        newReturn = {
          ...newReturn,
          id: res.data.id || newReturn.id,
          returnNo: res.data.returnNo || newReturn.returnNo
        };
      }
    } catch {
      // fallback
    }

    const next = [newReturn, ...returns];
    setReturns(next);
    saveStoredPurchaseReturns(next);

    setIsCreateModalOpen(false);
    setNotes('');
    showToast(getTranslation(lang, 'purchaseReturns.createSuccess'));
  };

  // Approve Return
  const handleConfirmApprove = async () => {
    if (!returnToApprove) return;

    try {
      await apiClient.post(`/api/purchase-returns/${returnToApprove.id}/approve`, {});
    } catch {
      // fallback
    }

    const updated = returns.map(r => {
      if (r.id === returnToApprove.id) {
        return {
          ...r,
          status: 'Approved' as PurchaseReturnStatus,
          approvedAt: new Date().toISOString(),
          approvedBy: 'Admin'
        };
      }
      return r;
    });

    setReturns(updated);
    saveStoredPurchaseReturns(updated);
    setReturnToApprove(null);
    showToast(getTranslation(lang, 'purchaseReturns.approveSuccess'));
  };

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {toastMsg && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: isAr ? 'auto' : '24px', right: isAr ? '24px' : 'auto', zIndex: 9999 }}>
          <CheckCircle2 size={16} className="green-text" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="module-header-clean">
        <div className="module-context-box">
          <p className="module-context-subtitle">
            <RotateCcw size={16} style={{ color: 'var(--primary)' }} />
            <span>{getTranslation(lang, 'purchaseReturns.subtitle')}</span>
          </p>
        </div>

        <div className="module-actions-wrap">
          <button 
            type="button" 
            className="btn-clean-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={15} />
            <span>{getTranslation(lang, 'purchaseReturns.newReturn')}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="module-kpi-grid">
        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'purchaseReturns.completed')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#ef4444' }}>
              {formatMoney(totalApprovedAmount)}
            </div>
          </div>
          <div className="module-kpi-icon rose">
            <RotateCcw size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'purchaseReturns.supplierCredit')}</span>
            <div className="module-kpi-value font-mono" style={{ color: '#16a34a' }}>
              {formatMoney(supplierCredits)}
            </div>
          </div>
          <div className="module-kpi-icon emerald">
            <Building2 size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'purchaseReturns.draft')}</span>
            <div className="module-kpi-value">
              {pendingCount} <span className="kpi-sub-unit">{getTranslation(lang, 'purchaseReturns.returnNumber')}</span>
            </div>
          </div>
          <div className="module-kpi-icon amber">
            <Clock size={20} />
          </div>
        </div>

        <div className="module-kpi-card">
          <div className="module-kpi-info">
            <span className="module-kpi-label">{getTranslation(lang, 'purchaseReturns.title')}</span>
            <div className="module-kpi-value">
              {totalReturnsCount} <span className="kpi-sub-unit">{getTranslation(lang, 'purchaseReturns.returnNumber')}</span>
            </div>
          </div>
          <div className="module-kpi-icon purple">
            <FileText size={20} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="module-toolbar">
        <div className="module-search-box">
          <Search size={16} />
          <input 
            type="text" 
            placeholder={getTranslation(lang, 'purchaseReturns.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="module-filter-pills">
          {[
            { id: 'ALL', label: getTranslation(lang, 'purchaseReturns.filterAll') },
            { id: 'Draft', label: getTranslation(lang, 'purchaseReturns.filterDraft') },
            { id: 'Approved', label: getTranslation(lang, 'purchaseReturns.filterApproved') }
          ].map(pill => (
            <button
              key={pill.id}
              type="button"
              className={`module-filter-pill ${statusFilter === pill.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(pill.id as any)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="panel-clean">
        <div className="table-responsive">
          <table className="table-clean">
            <thead>
              <tr>
                <th>{getTranslation(lang, 'purchaseReturns.returnNumber')}</th>
                <th>{getTranslation(lang, 'purchaseReturns.originalBill')}</th>
                <th>{getTranslation(lang, 'purchaseReturns.supplier')}</th>
                <th>{getTranslation(lang, 'purchaseReturns.warehouse')}</th>
                <th>{getTranslation(lang, 'purchaseReturns.totalAmount')}</th>
                <th>{getTranslation(lang, 'purchaseReturns.refundMethod')}</th>
                <th>{getTranslation(lang, 'purchaseReturns.status')}</th>
                <th style={{ textAlign: 'center' }}>{getTranslation(lang, 'expenses.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      lang={lang}
                      icon={<RotateCcw size={22} />}
                      title={getTranslation(lang, 'purchaseReturns.noReturnsFound')}
                    />
                  </td>
                </tr>
              ) : (
                filteredReturns.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono font-bold text-primary" dir="ltr">
                      {r.returnNo}
                    </td>
                    <td className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {r.originalBillNo}
                    </td>
                    <td>
                      <span className="font-semibold text-foreground" dir="auto">{r.supplierName}</span>
                    </td>
                    <td className="text-xs text-muted-foreground" dir="auto">
                      {r.warehouseName || r.warehouseId}
                    </td>
                    <td className="font-bold text-destructive font-mono tabular-nums" dir="ltr">
                      {formatMoney(r.totalAmount)}
                    </td>
                    <td>
                      <StatusBadge
                        tone={r.refundMethod === 'SupplierCredit' ? 'emerald' : 'indigo'}
                        label={
                          r.refundMethod === 'SupplierCredit'
                            ? getTranslation(lang, 'purchaseReturns.supplierCredit')
                            : getTranslation(lang, 'purchaseReturns.cashRefund')
                        }
                      />
                    </td>
                    <td>
                      <StatusBadge
                        tone={r.status === 'Approved' ? 'emerald' : 'amber'}
                        dot
                        label={r.status === 'Approved' ? getTranslation(lang, 'purchaseReturns.completed') : getTranslation(lang, 'purchaseReturns.draft')}
                      />
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          className="btn-clean-secondary py-1 px-2 text-xs"
                          onClick={() => setSelectedReturn(r)}
                        >
                          <Eye size={13} />
                        </button>
                        {r.status === 'Draft' && (
                          <button
                            type="button"
                            className="btn-clean-success py-1 px-2.5 text-[11px]"
                            onClick={() => setReturnToApprove(r)}
                          >
                            <CheckCircle2 size={12} />
                            <span>{getTranslation(lang, 'purchaseReturns.approve')}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Purchase Return */}
      {isCreateModalOpen && (
        <ModalBackdropPortal onClose={() => setIsCreateModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '820px', width: '95%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{getTranslation(lang, 'purchaseReturns.newReturn')}</h3>
              </div>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateReturn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'purchaseReturns.originalBill')} *
                  </label>
                  <select 
                    className="select-clean"
                    value={selectedBillId}
                    onChange={e => handleBillSelect(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    {purchaseOrders.length === 0 ? (
                      <option value="">{getTranslation(lang, 'purchaseReturns.selectBill')}</option>
                    ) : (
                      purchaseOrders.map(po => (
                        <option key={po.id} value={po.id}>
                          {po.poNumber} — {po.supplierName}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'purchaseReturns.warehouse')} *
                  </label>
                  <select 
                    className="select-clean"
                    value={selectedWarehouseId}
                    onChange={e => setSelectedWarehouseId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{getWhName(w)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'purchaseReturns.refundMethod')}
                  </label>
                  <select 
                    className="select-clean"
                    value={refundMethod}
                    onChange={e => setRefundMethod(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    <option value="SupplierCredit">{getTranslation(lang, 'purchaseReturns.supplierCredit')}</option>
                    <option value="CashRefund">{getTranslation(lang, 'purchaseReturns.cashRefund')}</option>
                  </select>
                </div>
              </div>

              {refundMethod === 'CashRefund' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {getTranslation(lang, 'expenses.cashBox')}
                  </label>
                  <select 
                    className="select-clean"
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  >
                    {treasuryAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Items Section */}
              <div className="border border-border rounded-xl p-3.5 bg-muted/40">
                <span className="block text-xs font-bold text-foreground mb-2.5">
                  {getTranslation(lang, 'purchaseReturns.title')} ({returnItems.length})
                </span>

                <div className="table-responsive">
                  <table className="table-clean" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>{getTranslation(lang, 'purchaseReturns.product')}</th>
                        <th>{getTranslation(lang, 'purchaseReturns.purchasedQty')}</th>
                        <th>{getTranslation(lang, 'purchaseReturns.returnQty')}</th>
                        <th>{getTranslation(lang, 'quotations.unitPrice')}</th>
                        <th>{getTranslation(lang, 'purchaseReturns.reason')}</th>
                        <th>{getTranslation(lang, 'quotations.lineTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((it, idx) => (
                        <tr key={idx}>
                          <td>
                            <span style={{ fontWeight: 600 }}>{it.productName}</span>
                            {it.productSku && (
                              <span className="block text-[11px] font-mono text-muted-foreground" dir="ltr">{it.productSku}</span>
                            )}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {it.purchasedQty}
                          </td>
                          <td>
                            <input 
                              type="number"
                              min="0"
                              max={it.purchasedQty - it.previouslyReturnedQty}
                              value={it.returnQty}
                              onChange={e => {
                                const next = [...returnItems];
                                next[idx].returnQty = Math.max(0, Number(e.target.value));
                                setReturnItems(next);
                              }}
                              className="input-clean"
                              style={{ width: '70px', padding: '4px 6px', textAlign: 'center', borderRadius: '6px' }}
                            />
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>
                            {formatMoney(it.unitCost)}
                          </td>
                          <td>
                            <select 
                              className="select-clean"
                              value={it.reason}
                              onChange={e => {
                                const next = [...returnItems];
                                next[idx].reason = e.target.value;
                                setReturnItems(next);
                              }}
                              style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}
                            >
                              <option value="Damaged">{getTranslation(lang, 'purchaseReturns.reasonDamaged')}</option>
                              <option value="Expired">{getTranslation(lang, 'purchaseReturns.reasonExpired')}</option>
                              <option value="Defective">{getTranslation(lang, 'purchaseReturns.reasonDefective')}</option>
                              <option value="Excess">{getTranslation(lang, 'purchaseReturns.reasonExcess')}</option>
                              <option value="Other">{getTranslation(lang, 'purchaseReturns.reasonOther')}</option>
                            </select>
                          </td>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#ef4444' }}>
                            {formatMoney(it.returnQty * it.unitCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#ef4444' }}>
                    {getTranslation(lang, 'purchaseReturns.totalAmount')}: {formatMoney(formTotalAmount)}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {getTranslation(lang, 'expenses.notes')}
                </label>
                <textarea 
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="input-clean"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn-clean-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  {getTranslation(lang, 'purchaseReturns.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="btn-clean-primary"
                >
                  {getTranslation(lang, 'purchaseReturns.save')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Modal: View Details */}
      {selectedReturn && (
        <ModalBackdropPortal onClose={() => setSelectedReturn(null)} dir={isAr ? 'rtl' : 'ltr'}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '640px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{selectedReturn.returnNo}</h3>
                  <span className="text-xs text-muted-foreground" dir="auto">{selectedReturn.supplierName}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedReturn(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 bg-muted/50 border border-border/70 p-3 rounded-xl mb-4">
              <div>
                <span className="block text-[11px] text-muted-foreground">{getTranslation(lang, 'purchaseReturns.originalBill')}</span>
                <span className="text-xs font-semibold font-mono text-foreground" dir="ltr">{selectedReturn.originalBillNo}</span>
              </div>
              <div>
                <span className="block text-[11px] text-muted-foreground">{getTranslation(lang, 'purchaseReturns.refundMethod')}</span>
                <span className="text-xs font-semibold text-foreground">
                  {selectedReturn.refundMethod === 'SupplierCredit'
                    ? getTranslation(lang, 'purchaseReturns.supplierCredit')
                    : getTranslation(lang, 'purchaseReturns.cashRefund')}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="max-h-52 overflow-y-auto mb-4 border border-border rounded-xl">
              <table className="table-clean text-xs">
                <thead>
                  <tr>
                    <th>{getTranslation(lang, 'purchaseReturns.product')}</th>
                    <th>{getTranslation(lang, 'purchaseReturns.returnQty')}</th>
                    <th>{getTranslation(lang, 'quotations.unitPrice')}</th>
                    <th>{getTranslation(lang, 'quotations.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedReturn.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td dir="auto">{it.productName} ({it.productSku})</td>
                      <td className="font-bold font-mono tabular-nums" dir="ltr">{it.returnedQty}</td>
                      <td className="font-mono tabular-nums" dir="ltr">{formatMoney(it.unitCost)}</td>
                      <td className="font-bold font-mono tabular-nums text-destructive" dir="ltr">{formatMoney(it.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-border pt-3">
              <div className="text-base font-extrabold text-destructive tabular-nums" dir="ltr">
                {getTranslation(lang, 'purchaseReturns.totalAmount')}: {formatMoney(selectedReturn.totalAmount)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button 
                type="button" 
                className="btn-clean-secondary"
                onClick={() => setSelectedReturn(null)}
              >
                {getTranslation(lang, 'purchaseReturns.close')}
              </button>
            </div>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Confirmation Dialog: Approve & Post Return */}
      {returnToApprove && (
        <ModalBackdropPortal onClose={() => setReturnToApprove(null)} dir={isAr ? 'rtl' : 'ltr'}>
          <div 
            className="modal-content glass-panel" 
            style={{ maxWidth: '440px', width: '92%', borderRadius: '16px', padding: '24px' }} 
            onClick={e => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="m-0 text-base font-bold text-foreground">{getTranslation(lang, 'purchaseReturns.confirmApprove')}</h3>
                <span className="text-xs font-mono text-muted-foreground" dir="ltr">{returnToApprove.returnNo}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed m-0 mb-4">
              {getTranslation(lang, 'purchaseReturns.approveNotice')}
            </p>

            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{getTranslation(lang, 'purchaseReturns.supplier')}:</span>
                <span className="font-bold text-foreground" dir="auto">{returnToApprove.supplierName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{getTranslation(lang, 'purchaseReturns.totalAmount')}:</span>
                <span className="text-sm font-bold text-destructive font-mono tabular-nums" dir="ltr">
                  {formatMoney(returnToApprove.totalAmount)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="btn-clean-secondary"
                onClick={() => setReturnToApprove(null)}
              >
                {getTranslation(lang, 'purchaseReturns.cancel')}
              </button>
              <button 
                type="button" 
                className="btn-clean-primary"
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                onClick={handleConfirmApprove}
              >
                {getTranslation(lang, 'purchaseReturns.approve')}
              </button>
            </div>
          </div>
        </ModalBackdropPortal>
      )}
    </div>
  );
}
