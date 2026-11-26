import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Phone, Mail, MapPin, Plus, Star, 
  X, Check, Building2, AlertCircle, Wallet, FileText, Banknote
} from 'lucide-react';
import { DialogPortal, DialogOverlay, DialogContent, ModalBackdropPortal } from '../ui/dialog';
import {
  fetchSuppliers,
  createSupplierRemote,
  fetchTreasuryAccounts,
  fetchSupplierLedger,
  settleSupplierDebt,
  formatPurchaseErrorMessage,
  SupplierDirectoryRecord,
  SupplierLedgerEntryRecord,
  TreasuryCashBoxOption
} from '../../services/purchasesService';
import { useSettings } from '../../context/settings-context';
import { getTranslation } from '../../lib/i18n';

interface SuppliersViewProps {
  lang: 'en' | 'ar';
}

export default function SuppliersView({ lang }: SuppliersViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const [suppliers, setSuppliers] = useState<SupplierDirectoryRecord[]>([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryCashBoxOption[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Debt Settlement Modal State
  const [payTarget, setPayTarget] = useState<SupplierDirectoryRecord | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payCashAccountId, setPayCashAccountId] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [payError, setPayError] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);

  // Ledger Statement Modal State
  const [ledgerTarget, setLedgerTarget] = useState<SupplierDirectoryRecord | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<SupplierLedgerEntryRecord[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Form State
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState(getTranslation(lang, 'suppliersModule.defaultCategory'));
  const [rating, setRating] = useState('4.8');
  const [formError, setFormError] = useState('');

  const loadSuppliersAndTreasury = useCallback(async () => {
    const [supList, cashList] = await Promise.all([fetchSuppliers(), fetchTreasuryAccounts()]);
    setSuppliers(supList);
    setTreasuryAccounts(cashList);
    setPayCashAccountId(prev => {
      if (prev && cashList.some(a => a.id === prev)) return prev;
      return (cashList.find(a => a.isPrimary) || cashList[0])?.id || '';
    });
  }, []);

  useEffect(() => {
    loadSuppliersAndTreasury();
    const handler = () => loadSuppliersAndTreasury();
    window.addEventListener('erp_purchases_updated', handler);
    window.addEventListener('erp_treasury_updated', handler);
    return () => {
      window.removeEventListener('erp_purchases_updated', handler);
      window.removeEventListener('erp_treasury_updated', handler);
    };
  }, [loadSuppliersAndTreasury]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleOpenModal = () => {
    setCompany('');
    setContact('');
    setPhone('');
    setEmail('');
    setCountry('');
    setCategory(getTranslation(lang, 'suppliersModule.defaultCategory'));
    setRating('4.8');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) {
      setFormError(getTranslation(lang, 'suppliersModule.errCompanyRequired'));
      return;
    }
    if (!contact.trim()) {
      setFormError(getTranslation(lang, 'suppliersModule.errContactRequired'));
      return;
    }
    if (!phone.trim()) {
      setFormError(getTranslation(lang, 'suppliersModule.errPhoneRequired'));
      return;
    }

    try {
      const newSupplier = await createSupplierRemote({
        companyName: company.trim(),
        contactPerson: contact.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        country: country.trim() || undefined,
        category: category.trim() || undefined,
        rating: Number(rating) || 4.8
      });

      setSuppliers(prev => [newSupplier, ...prev]);
      setIsAddModalOpen(false);
      showToast(
        getTranslation(lang, 'suppliersModule.addedSuccessToast').replace('{name}', newSupplier.companyName)
      );
    } catch (err: any) {
      setFormError(formatPurchaseErrorMessage(err, lang));
    }
  };

  const handleOpenPayModal = (sup: SupplierDirectoryRecord) => {
    setPayTarget(sup);
    setPayAmount(sup.currentBalance > 0 ? sup.currentBalance : 0);
    setPayNotes('');
    setPayError('');
    if (!payCashAccountId && treasuryAccounts.length > 0) {
      setPayCashAccountId((treasuryAccounts.find(a => a.isPrimary) || treasuryAccounts[0]).id);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget || isPaying) return;
    setPayError('');

    if (payAmount <= 0) {
      setPayError(formatPurchaseErrorMessage({ errorCode: 'ERR_INVALID_PAYMENT_AMOUNT' }, lang));
      return;
    }
    if (!payCashAccountId) {
      setPayError(formatPurchaseErrorMessage({ errorCode: 'ERR_TREASURY_ACCOUNT_REQUIRED' }, lang));
      return;
    }
    const chosenBox = treasuryAccounts.find(a => a.id === payCashAccountId);
    if (chosenBox && chosenBox.currentBalance < payAmount) {
      setPayError(formatPurchaseErrorMessage({ errorCode: 'ERR_INSUFFICIENT_TREASURY_BALANCE' }, lang));
      return;
    }
    if (payAmount > payTarget.currentBalance) {
      setPayError(formatPurchaseErrorMessage({ errorCode: 'ERR_PAYMENT_EXCEEDS_SUPPLIER_BALANCE' }, lang));
      return;
    }

    setIsPaying(true);
    try {
      const res = await settleSupplierDebt(payTarget.id, {
        amount: payAmount,
        cashAccountId: payCashAccountId,
        notes: payNotes
      });
      await loadSuppliersAndTreasury();
      setPayTarget(null);
      showToast(
        getTranslation(lang, 'suppliersModule.paymentSuccessToast')
          .replace('{voucher}', res.voucherNumber)
          .replace('{amount}', formatMoney(payAmount))
      );
    } catch (err: any) {
      setPayError(formatPurchaseErrorMessage(err, lang));
    } finally {
      setIsPaying(false);
    }
  };

  const handleOpenLedgerModal = async (sup: SupplierDirectoryRecord) => {
    setLedgerTarget(sup);
    setIsLoadingLedger(true);
    try {
      const rows = await fetchSupplierLedger(sup.id);
      setLedgerEntries(rows);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  return (
    <div className="view-content-wrapper fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9999 }}>
          <Check size={16} className="green-text" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">{isAr ? 'دليل الموردين والتوريدات' : 'Authorized Suppliers Directory'}</h2>
          <p className="view-subtitle">{isAr ? 'قائمة الموردين المعتمدين، اتفاقيات التوريد، والاتصال المباشر' : 'Approved vendors, SLA agreements, and active purchase contracts'}</p>
        </div>

        <button type="button" className="btn-add-primary" onClick={handleOpenModal}>
          <Plus size={16} />
          <span>{isAr ? 'إضافة مورد جديد' : 'New Supplier'}</span>
        </button>
      </div>

      {/* Suppliers Grid Cards */}
      <div className="suppliers-grid">
        {suppliers.map(s => (
          <div key={s.id} className="wh-card glass-panel fade-in">
            <div className="wh-card-header">
              <div className="wh-avatar-box">
                <Building2 size={22} className="text-cyan" />
              </div>
              <div>
                <span className="code-badge font-mono">{s.code || s.id}</span>
                <h3 className="wh-card-title"><span dir="auto">{s.companyName}</span></h3>
                {s.category && <small className="category-tag">{s.category}</small>}
              </div>
            </div>

            <div className="wh-meta-list">
              <div className="wh-meta-row">
                <Users size={15} />
                <span dir="auto">{s.contactPerson}</span>
              </div>
              {s.phone && (
                <div className="wh-meta-row">
                  <Phone size={15} />
                  <span><bdi>{s.phone}</bdi></span>
                </div>
              )}
              {s.email && (
                <div className="wh-meta-row">
                  <Mail size={15} />
                  <span>{s.email}</span>
                </div>
              )}
              {s.country && (
                <div className="wh-meta-row">
                  <MapPin size={15} />
                  <span dir="auto">{s.country}</span>
                </div>
              )}
            </div>

            <div className="wh-occupancy-section">
              <div className="occ-labels">
                <span>{getTranslation(lang, 'suppliersModule.payableBalanceLabel')}</span>
                <strong
                  className={`font-mono tabular-nums ${
                    s.currentBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {formatMoney(s.currentBalance)}
                </strong>
              </div>
              {s.rating !== undefined && (
                <div className="occ-labels">
                  <span>{isAr ? 'تقييم المورد:' : 'Supplier Rating:'}</span>
                  <strong className="green-text">{s.rating} / 5.0</strong>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-3 mt-2 border-t border-border/70">
              <button
                type="button"
                onClick={() => handleOpenPayModal(s)}
                disabled={s.currentBalance <= 0}
                className="flex-1 h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer transition-colors"
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>{getTranslation(lang, 'suppliersModule.settleDebtBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenLedgerModal(s)}
                className="h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{getTranslation(lang, 'suppliersModule.statementBtn')}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Supplier Modal - Robust Modern Design */}
      {isAddModalOpen && (
        <DialogPortal>
          <DialogOverlay onClick={() => setIsAddModalOpen(false)} />
          <DialogContent
            className="w-full max-w-xl bg-card border border-border shadow-2xl rounded-2xl p-0 text-foreground overflow-hidden flex flex-col my-auto"
            style={{
              maxWidth: '560px',
              width: '95%',
              maxHeight: '90vh',
              padding: 0,
              borderRadius: '1rem',
              backgroundColor: 'var(--card)',
              color: 'var(--foreground)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)'
            }}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {/* Modal Header (Pinned) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground leading-tight m-0">
                    {isAr ? 'إضافة مورد تجاري جديد' : 'Register New Vendor / Supplier'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-normal m-0">
                    {isAr ? 'إدراج بيانات الشركة، المسؤول، ووسائل التواصل' : 'Enter vendor credentials, primary contact & catalog info'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="p-1.5 rounded-lg border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                onClick={() => setIsAddModalOpen(false)}
                title={isAr ? 'إلغاء' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSupplier} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable Form Body */}
              <div className="p-5 overflow-y-auto max-h-[calc(85vh-130px)] space-y-3.5">
                {/* Error Banner */}
                {formError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'اسم شركة التوريد' : 'Company / Vendor Name'} <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder={isAr ? 'مثال: شركة النور للتجارة العامة' : 'e.g. Al-Noor Global Trading'}
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                        autoFocus
                      />
                      <Building2 className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'الشخص المسؤول / جهة الاتصال' : 'Contact Person'} <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder={isAr ? 'مثال: م. مصطفى العبيدي' : 'e.g. Mustafa Al-Obeidi'}
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                      <Users className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'رقم الهاتف والتواصل' : 'Phone Number'} <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder={isAr ? 'مثال: 0770 123 4567' : '+964 770 123 4567'}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        dir="ltr"
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                      <Phone className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="orders@supplier.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        dir="ltr"
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                      <Mail className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'الدولة والمدينة والفرع' : 'Country & Location'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={isAr ? 'مثال: الدولة - المدينة / العنوان' : 'e.g. Country - City / Region'}
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                      <MapPin className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'مجال التوريد والتخصص' : 'Supply Category'}
                    </label>
                    <input
                      type="text"
                      placeholder={isAr ? 'إلكترونيات وشاشات وأجهزة ذكية' : 'Electronics, Monitors & Hardware'}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'التقييم الأولي (من 5.0)' : 'Initial Rating'}
                    </label>
                    <div className="relative">
                      <select 
                        value={rating} 
                        onChange={(e) => setRating(e.target.value)}
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-bold outline-none focus:border-primary cursor-pointer transition-all"
                      >
                        <option value="5.0">{isAr ? '5.0 - مميز جداً' : '5.0 - Excellent'}</option>
                        <option value="4.9">{isAr ? '4.9 - معتمد وممتاز' : '4.9 - Approved'}</option>
                        <option value="4.8">{isAr ? '4.8 - جيد جداً' : '4.8 - Very Good'}</option>
                        <option value="4.5">{isAr ? '4.5 - موثوق' : '4.5 - Reliable'}</option>
                      </select>
                      <Star className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Pinned) */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-border bg-muted/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isAr ? 'حفظ وإضافة المورد' : 'Save & Register'}</span>
                </button>
              </div>
            </form>
          </DialogContent>
        </DialogPortal>
      )}

      {/* Supplier Debt Settlement Modal */}
      {payTarget && (
        <ModalBackdropPortal onClose={() => !isPaying && setPayTarget(null)} dir={isAr ? 'rtl' : 'ltr'}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 text-foreground" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-primary" />
                  <span>{getTranslation(lang, 'suppliersModule.settleDebtTitle')}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{payTarget.companyName}</p>
              </div>
              <button type="button" onClick={() => !isPaying && setPayTarget(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3">
              {payError && (
                <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">{getTranslation(lang, 'suppliersModule.payableBalanceLabel')}</span>
                <span className="font-mono tabular-nums font-extrabold text-rose-600 dark:text-rose-400">
                  {formatMoney(payTarget.currentBalance)}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    {getTranslation(lang, 'suppliersModule.paymentAmountLabel')} <span className="text-destructive">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPayAmount(payTarget.currentBalance)}
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    {getTranslation(lang, 'suppliersModule.payFullDebtBtn')}
                  </button>
                </div>
                <input
                  type="number"
                  min="0.01"
                  max={payTarget.currentBalance}
                  step="0.01"
                  required
                  value={payAmount || ''}
                  onChange={e => setPayAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground font-mono tabular-nums font-bold text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground inline-flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  <span>{getTranslation(lang, 'purchasesModule.treasuryAccountLabel')}</span>
                  <span className="text-destructive">*</span>
                </label>
                <select
                  value={payCashAccountId}
                  onChange={e => setPayCashAccountId(e.target.value)}
                  required
                  className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold outline-none focus:border-primary cursor-pointer"
                >
                  {treasuryAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({getTranslation(lang, 'purchasesModule.availableBalanceShort')}: {formatMoney(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {getTranslation(lang, 'suppliersModule.paymentNotesLabel')}
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder={getTranslation(lang, 'suppliersModule.paymentNotesPlaceholder')}
                  className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isPaying}
                  onClick={() => setPayTarget(null)}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold"
                >
                  {getTranslation(lang, 'actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold disabled:opacity-50"
                >
                  {getTranslation(lang, 'suppliersModule.confirmPaymentBtn')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}

      {/* Supplier Ledger Statement Modal */}
      {ledgerTarget && (
        <ModalBackdropPortal onClose={() => setLedgerTarget(null)} dir={isAr ? 'rtl' : 'ltr'}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-foreground" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>{getTranslation(lang, 'suppliersModule.statementTitle')} — {ledgerTarget.companyName}</span>
                </h3>
              </div>
              <button type="button" onClick={() => setLedgerTarget(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-border rounded-xl">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground font-bold border-b border-border">
                    <th className="py-2.5 px-3 text-start">{getTranslation(lang, 'suppliersModule.colReference')}</th>
                    <th className="py-2.5 px-3 text-start">{getTranslation(lang, 'suppliersModule.colType')}</th>
                    <th className="py-2.5 px-3 text-end">{getTranslation(lang, 'suppliersModule.colDebit')}</th>
                    <th className="py-2.5 px-3 text-end">{getTranslation(lang, 'suppliersModule.colCredit')}</th>
                    <th className="py-2.5 px-3 text-end">{getTranslation(lang, 'suppliersModule.colRunningBalance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isLoadingLedger ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">{getTranslation(lang, 'common.loading')}</td>
                    </tr>
                  ) : ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">{getTranslation(lang, 'suppliersModule.emptyLedger')}</td>
                    </tr>
                  ) : (
                    ledgerEntries.map(entry => (
                      <tr key={entry.id}>
                        <td className="py-2 px-3 font-mono font-bold text-primary">{entry.referenceNumber}</td>
                        <td className="py-2 px-3 text-muted-foreground">{entry.transactionType}</td>
                        <td className="py-2 px-3 text-end font-mono tabular-nums text-emerald-600">
                          {entry.debit > 0 ? formatMoney(entry.debit) : '—'}
                        </td>
                        <td className="py-2 px-3 text-end font-mono tabular-nums text-rose-600">
                          {entry.credit > 0 ? formatMoney(entry.credit) : '—'}
                        </td>
                        <td className="py-2 px-3 text-end font-mono tabular-nums font-bold">
                          {formatMoney(entry.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ModalBackdropPortal>
      )}
    </div>
  );
}
