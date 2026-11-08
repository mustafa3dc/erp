import React, { useState, useEffect, useMemo, Fragment } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  DollarSign,
  FileText,
  User,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Printer,
  X,
  CreditCard,
  Banknote,
  Receipt,
  Eye,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useSettings } from '../../context/settings-context';
import { 
  InstallmentContract, 
  InstallmentScheduleItem, 
  InstallmentStatus 
} from '../../types/warehouse';
import { 
  getStoredInstallmentContracts, 
  payInstallmentScheduleItem, 
  getInstallmentStats, 
  getStoredActiveShift 
} from '../../services/storageService';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface InstallmentsViewProps {
  lang: 'ar' | 'en';
}

export default function InstallmentsView({ lang }: InstallmentsViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney } = useSettings();

  const [contracts, setContracts] = useState<InstallmentContract[]>(() => getStoredInstallmentContracts());
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  
  // Modals state
  const [selectedContract, setSelectedContract] = useState<InstallmentContract | null>(null);
  const [payingScheduleItem, setPayingScheduleItem] = useState<{ contract: InstallmentContract; item: InstallmentScheduleItem } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'ELECTRONIC'>('CASH');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string>('');
  const [issuedReceiptVoucher, setIssuedReceiptVoucher] = useState<{
    receiptNumber: string;
    contractNumber: string;
    customerName: string;
    guarantorName: string;
    installmentNumber: number;
    amount: number;
    date: string;
    paymentMethod: string;
  } | null>(null);

  const refreshData = () => {
    const list = getStoredInstallmentContracts();
    setContracts(list);
    if (selectedContract) {
      const updated = list.find(c => c.id === selectedContract.id);
      if (updated) setSelectedContract(updated);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const stats = useMemo(() => {
    return getInstallmentStats();
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      // Status Filter
      if (activeFilter === 'ACTIVE' && c.status !== 'ACTIVE') return false;
      if (activeFilter === 'COMPLETED' && c.status !== 'COMPLETED') return false;
      if (activeFilter === 'OVERDUE' && !c.schedules.some(s => s.status === 'OVERDUE')) return false;

      // Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        c.contractNumber.toLowerCase().includes(q) ||
        c.invoiceNumber.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q) ||
        c.guarantorName.toLowerCase().includes(q) ||
        c.guarantorPhone.includes(q)
      );
    });
  }, [contracts, activeFilter, searchQuery]);

  // Open Pay Modal
  const handleOpenPay = (contract: InstallmentContract, item: InstallmentScheduleItem) => {
    const remainingOnItem = item.amount - item.paidAmount;
    setPayingScheduleItem({ contract, item });
    setPaymentAmount(remainingOnItem);
    setPaymentMethod('CASH');
    setPaymentNotes('');
    setPaymentError('');
  };

  // Submit Payment
  const handleConfirmPayment = () => {
    if (!payingScheduleItem) return;
    setPaymentError('');

    const { contract, item } = payingScheduleItem;
    const remainingOnItem = item.amount - item.paidAmount;

    if (paymentAmount <= 0) {
      setPaymentError(isAr ? 'يجب إدخال مبلغ سداد أكبر من الصفر' : 'Payment amount must be greater than zero');
      return;
    }

    if (paymentAmount > remainingOnItem) {
      setPaymentError(isAr ? `المبلغ لا يمكن أن يتجاوز المتبقي على هذا القسط (${formatMoney(remainingOnItem)})` : 'Amount exceeds item remaining balance');
      return;
    }

    try {
      const activeShift = getStoredActiveShift();
      const result = payInstallmentScheduleItem(
        item.id,
        paymentAmount,
        activeShift?.id,
        paymentMethod,
        paymentNotes
      );

      // Record Issued Receipt
      setIssuedReceiptVoucher({
        receiptNumber: result.receiptNumber,
        contractNumber: contract.contractNumber,
        customerName: contract.customerName,
        guarantorName: contract.guarantorName,
        installmentNumber: item.installmentNumber,
        amount: paymentAmount,
        date: new Date().toISOString(),
        paymentMethod
      });

      setPayingScheduleItem(null);
      refreshData();
    } catch (err: any) {
      setPaymentError(err.message || 'فشلت معالجة السداد');
    }
  };

  const printReceipt = () => {
    window.print();
  };

  // Helper: Pay Installment Dialog
  const renderPayModal = () => {
    if (!payingScheduleItem) return null;
    return (
      <div className="modal-backdrop fade-in" onClick={() => setPayingScheduleItem(null)}>
        <div 
          className="border border-border rounded-xl shadow-2xl max-w-md w-full mx-auto my-auto p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
          onClick={(e) => e.stopPropagation()}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Banknote size={18} className="text-primary" />
              <h3 className="text-sm font-bold text-foreground m-0">
                {isAr ? `سداد القسط رقم (${payingScheduleItem.item.installmentNumber})` : `Pay Installment (#${payingScheduleItem.item.installmentNumber})`}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setPayingScheduleItem(null)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {paymentError && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
              {paymentError}
            </div>
          )}

          {/* Quick Summary */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isAr ? 'العميل:' : 'Customer:'}</span>
              <strong className="text-foreground">{payingScheduleItem.contract.customerName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isAr ? 'قيمة القسط الكاملة:' : 'Total Amount:'}</span>
              <span className="font-mono font-bold text-foreground">{formatMoney(payingScheduleItem.item.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isAr ? 'المدفوع مسبقاً:' : 'Previously Paid:'}</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{formatMoney(payingScheduleItem.item.paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-1">
              <span className="text-muted-foreground font-bold">{isAr ? 'المتبقي على هذا القسط:' : 'Remaining:'}</span>
              <strong className="font-mono text-primary font-bold">
                {formatMoney(payingScheduleItem.item.amount - payingScheduleItem.item.paidAmount)}
              </strong>
            </div>
          </div>

          {/* Payment Inputs */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                {isAr ? 'المبلغ المراد سداده' : 'Payment Amount'}
              </label>
              <Input
                type="number"
                min={1}
                max={payingScheduleItem.item.amount - payingScheduleItem.item.paidAmount}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="h-9 rounded-lg border-border/80 bg-background font-mono font-bold text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                {isAr ? 'طريقة السداد' : 'Payment Method'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background text-muted-foreground border-border/80 hover:text-foreground'
                  }`}
                >
                  {isAr ? 'نقدي' : 'Cash'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    paymentMethod === 'CARD'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background text-muted-foreground border-border/80 hover:text-foreground'
                  }`}
                >
                  {isAr ? 'بطاقة' : 'Card'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('ELECTRONIC')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    paymentMethod === 'ELECTRONIC'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background text-muted-foreground border-border/80 hover:text-foreground'
                  }`}
                >
                  {isAr ? 'إلكتروني' : 'E-Wallet'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                {isAr ? 'ملاحظات السند' : 'Voucher Notes'}
              </label>
              <Input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder={isAr ? 'ملاحظات اختيارية عن السداد...' : 'Optional notes...'}
                className="h-8 rounded-lg border-border/80 bg-background text-xs"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPayingScheduleItem(null)}
              className="w-1/2 h-9 text-xs font-semibold rounded-lg"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmPayment}
              className="w-1/2 h-9 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-xs hover:bg-primary/90 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>{isAr ? 'تأكيد السداد والقبض' : 'Confirm Payment'}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Helper: Printable Receipt Voucher Dialog
  const renderReceiptModal = () => {
    if (!issuedReceiptVoucher) return null;
    return (
      <div className="modal-backdrop fade-in" onClick={() => setIssuedReceiptVoucher(null)}>
        <div 
          className="border border-border rounded-xl shadow-2xl max-w-md w-full mx-auto my-auto p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
          onClick={(e) => e.stopPropagation()}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={18} />
              <h3 className="text-sm font-bold m-0">
                {isAr ? 'تم استلام وسداد القسط بنجاح' : 'Payment Received Successfully'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIssuedReceiptVoucher(null)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Printable Receipt Voucher Card */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-3 text-xs">
            <div className="text-center border-b border-border/60 pb-2">
              <strong className="text-sm block text-foreground">{isAr ? 'سند قبض قسط مالي رسمي' : 'Official Installment Receipt'}</strong>
              <span className="text-[11px] text-primary font-mono font-bold block">{issuedReceiptVoucher.receiptNumber}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{new Date(issuedReceiptVoucher.date).toLocaleString()}</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isAr ? 'رقم العقد:' : 'Contract No:'}</span>
                <strong className="font-mono text-foreground">{issuedReceiptVoucher.contractNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isAr ? 'المستلم منه (العميل):' : 'Received From:'}</span>
                <strong className="text-foreground">{issuedReceiptVoucher.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isAr ? 'الكفيل الضامن:' : 'Guarantor:'}</span>
                <span className="text-foreground">{issuedReceiptVoucher.guarantorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isAr ? 'القسط المسدد:' : 'Installment #:'}</span>
                <span className="font-bold text-foreground">{isAr ? `القسط رقم ${issuedReceiptVoucher.installmentNumber}` : `Installment #${issuedReceiptVoucher.installmentNumber}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isAr ? 'طريقة السداد:' : 'Payment Method:'}</span>
                <span className="font-bold text-foreground">{issuedReceiptVoucher.paymentMethod}</span>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-2 text-sm">
                <strong className="text-foreground">{isAr ? 'المبلغ المقبوض:' : 'Amount Paid:'}</strong>
                <strong className="text-primary font-mono text-base">{formatMoney(issuedReceiptVoucher.amount)}</strong>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={printReceipt}
              className="w-1/2 h-9 text-xs font-semibold rounded-lg gap-1 border-border/80"
            >
              <Printer size={14} />
              <span>{isAr ? 'طباعة السند' : 'Print Voucher'}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setIssuedReceiptVoucher(null)}
              className="w-1/2 h-9 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-xs hover:bg-primary/90 cursor-pointer"
            >
              <span>{isAr ? 'تم' : 'Done'}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // IF A CONTRACT IS SELECTED: SHOW DEDICATED FULL SCREEN (Zero blurry background, 100% full view)
  if (selectedContract) {
    const paidCount = selectedContract.schedules.filter(s => s.status === 'PAID').length;
    const hasOverdue = selectedContract.schedules.some(s => s.status === 'OVERDUE');
    const percentPaid = selectedContract.totalInstallmentPrice > 0
      ? Math.round(((selectedContract.totalInstallmentPrice - selectedContract.remainingAmount) / selectedContract.totalInstallmentPrice) * 100)
      : 0;

    return (
      <div className="view-content-wrapper fade-in space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
        {/* Full View Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedContract(null)}
              className="h-9 px-3 gap-1.5 text-xs font-bold rounded-lg border-border/80 cursor-pointer hover:bg-muted"
            >
              {isAr ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
              <span>{isAr ? 'الرجوع إلى قائمة عقود التقسيط' : 'Back to Contracts'}</span>
            </Button>

            <div className="h-6 w-px bg-border/60 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground m-0 tracking-tight leading-tight">
                  {isAr ? `كشف حساب عقد التقسيط (${selectedContract.contractNumber})` : `Contract Statement (${selectedContract.contractNumber})`}
                </h1>
                {selectedContract.status === 'COMPLETED' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span>{isAr ? 'مكتمل ومسدد' : 'Completed'}</span>
                  </span>
                ) : hasOverdue ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <span>{isAr ? 'يوجد قسط متأخر' : 'Overdue'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <span>{isAr ? 'عقد سارٍ' : 'Active'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground m-0 mt-0.5 font-mono">
                {isAr ? `الفاتورة المرتبطة: ${selectedContract.invoiceNumber} | تاريخ البدء: ${selectedContract.startDate}` : `Invoice: ${selectedContract.invoiceNumber} | Start: ${selectedContract.startDate}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={printReceipt}
              className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-lg border-border/80 shadow-2xs cursor-pointer"
            >
              <Printer size={14} />
              <span>{isAr ? 'طباعة كشف الحساب' : 'Print Statement'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshData}
              className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-lg border-border/80 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>{isAr ? 'تحديث' : 'Refresh'}</span>
            </Button>
          </div>
        </div>

        {/* 4 Financial Metric Cards for this Contract */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>{isAr ? 'بيانات العميل' : 'Customer Details'}</span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <User size={15} />
              </div>
            </div>
            <div className="text-base font-bold text-foreground truncate">
              {selectedContract.customerName}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {selectedContract.customerPhone}
            </div>
          </div>

          <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>{isAr ? 'الكفيل الضامن' : 'Guarantor'}</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShieldCheck size={15} />
              </div>
            </div>
            <div className="text-base font-bold text-foreground truncate">
              {selectedContract.guarantorName}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {selectedContract.guarantorPhone}
            </div>
          </div>

          <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>{isAr ? 'إجمالي العقد / المقدمة' : 'Total / Down Payment'}</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <DollarSign size={15} />
              </div>
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-foreground">
              {formatMoney(selectedContract.totalInstallmentPrice)}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center justify-between">
              <span>{isAr ? 'الدفعة المقدمة:' : 'Down Payment:'}</span>
              <span className="font-bold">{formatMoney(selectedContract.downPayment)}</span>
            </div>
          </div>

          <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>{isAr ? 'المتبقي / القسط الشهري' : 'Remaining / Monthly'}</span>
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Clock size={15} />
              </div>
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-primary">
              {formatMoney(selectedContract.remainingAmount)}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-between">
              <span>{isAr ? `القسط (${paidCount}/${selectedContract.installmentCount}):` : `Monthly (${paidCount}/${selectedContract.installmentCount}):`}</span>
              <span className="font-bold text-foreground">{formatMoney(selectedContract.monthlyAmount)}</span>
            </div>
          </div>
        </div>

        {/* Schedules Table */}
        <div className="bg-card border border-border/80 rounded-xl shadow-xs space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
            <div>
              <h3 className="text-sm font-bold text-foreground m-0 flex items-center gap-2">
                <Receipt size={16} className="text-primary" />
                <span>{isAr ? 'جدول استحقاقات الأقساط وسندات السداد' : 'Installment Schedules & Receipts'}</span>
              </h3>
              <p className="text-xs text-muted-foreground m-0 mt-0.5">
                {isAr ? 'مواعيد الاستحقاق الشهرية وحركات القبض المالي المسجلة في الوردية والصندوق' : 'Monthly due dates and financial receipt vouchers'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-mono">
                {isAr ? 'نسبة السداد:' : 'Progress:'} <strong className="text-foreground">{percentPaid}%</strong>
              </span>
              <div className="w-28 bg-muted rounded-full h-2 overflow-hidden border border-border/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    selectedContract.status === 'COMPLETED' ? 'bg-emerald-500' : hasOverdue ? 'bg-rose-500' : 'bg-primary'
                  }`}
                  style={{ width: `${percentPaid}%` }}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-border/80 rounded-lg bg-background">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-muted/60 border-b border-border/80 text-muted-foreground font-semibold text-[11px]">
                  <th className="py-2.5 px-3 text-center w-12">#</th>
                  <th className="py-2.5 px-3 text-start">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                  <th className="py-2.5 px-3 text-center">{isAr ? 'المبلغ المطلوب' : 'Due Amount'}</th>
                  <th className="py-2.5 px-3 text-center">{isAr ? 'المبلغ المسدد' : 'Paid Amount'}</th>
                  <th className="py-2.5 px-3 text-start">{isAr ? 'تاريخ وسند السداد' : 'Receipt & Date'}</th>
                  <th className="py-2.5 px-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-2.5 px-3 text-center w-28">{isAr ? 'إجراء السداد' : 'Pay Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {selectedContract.schedules.map(item => {
                  const isPaid = item.status === 'PAID';
                  const isOverdue = item.status === 'OVERDUE';

                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-muted-foreground">
                        {item.installmentNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                        {item.dueDate}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-foreground">
                        {formatMoney(item.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatMoney(item.paidAmount)}
                      </td>
                      <td className="py-2.5 px-3">
                        {item.receiptVoucherNumber ? (
                          <div>
                            <span className="font-mono text-xs font-bold text-primary block">
                              {item.receiptVoucherNumber}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {item.paidDate ? new Date(item.paidDate).toLocaleDateString() : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span>{isAr ? 'مسدد بالكامل' : 'Paid'}</span>
                          </span>
                        ) : item.status === 'PARTIALLY_PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <span>{isAr ? 'مسدد جزئياً' : 'Partial'}</span>
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <span>{isAr ? 'متأخر' : 'Overdue'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border/60">
                            <span>{isAr ? 'بانتظار السداد' : 'Pending'}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {!isPaid ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleOpenPay(selectedContract, item)}
                            className="h-7 px-3 text-xs font-bold bg-primary text-primary-foreground rounded-md shadow-2xs hover:bg-primary/90 cursor-pointer"
                          >
                            {isAr ? 'سداد' : 'Pay'}
                          </Button>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                            {isAr ? 'تم القبض' : 'Cleared'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Small Dialogs for Pay and Receipt */}
        {renderPayModal()}
        {renderReceiptModal()}
      </div>
    );
  }

  return (
    <div className="view-content-wrapper fade-in space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground m-0 tracking-tight leading-tight">
                {isAr ? 'إدارة عقود وأقساط المبيعات' : 'Sales Installment Management'}
              </h1>
              <p className="text-xs text-muted-foreground m-0 mt-0.5">
                {isAr ? 'متابعة عقود البيع بالتقسيط، جداول الاستحقاقات الشهرية، وسندات القبض المالي' : 'Track installment contracts, monthly schedule due dates, and payment receipt vouchers'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshData}
            className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-lg border-border/80"
          >
            <RefreshCw size={14} />
            <span>{isAr ? 'تحديث البيانات' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {/* KPI Statistic Cards (Top Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Due This Month */}
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isAr ? 'مستحق السداد هذا الشهر' : 'Due This Month'}</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock size={15} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-foreground">
            {formatMoney(stats.dueThisMonthAmount)}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>{isAr ? 'عدد الأقساط المستحقة:' : 'Installments Count:'}</span>
            <span className="font-bold text-foreground font-mono">{stats.dueThisMonthCount}</span>
          </div>
        </div>

        {/* Metric 2: Overdue Amount */}
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isAr ? 'إجمالي الأقساط المتأخرة' : 'Total Overdue Amount'}</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle size={15} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
            {formatMoney(stats.overdueAmount)}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>{isAr ? 'أقساط متأخرة الدفع:' : 'Overdue Installments:'}</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">{stats.overdueCount}</span>
          </div>
        </div>

        {/* Metric 3: Active Contracts */}
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isAr ? 'عقود التقسيط النشطة' : 'Active Contracts'}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText size={15} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-foreground">
            {stats.activeContractsCount}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>{isAr ? 'إجمالي المتبقي قيد التحصيل:' : 'Remaining Balance:'}</span>
            <span className="font-bold text-foreground font-mono">{formatMoney(stats.totalRemainingAmount)}</span>
          </div>
        </div>

        {/* Metric 4: Total Collected Amount */}
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isAr ? 'إجمالي المبالغ المحصلة' : 'Total Collected'}</span>
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-primary">
            {formatMoney(stats.totalCollectedAmount)}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>{isAr ? 'يشمل المقدمات والأقساط' : 'Includes Down Payments'}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{isAr ? 'مقبوض وموثق' : 'Verified'}</span>
          </div>
        </div>
      </div>

      {/* Contracts Table & Search Toolbar */}
      <div className="bg-card border border-border/80 rounded-xl shadow-xs space-y-4 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="inline-flex p-1 bg-muted rounded-lg border border-border/60 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{isAr ? 'كافة العقود' : 'All Contracts'}</span>
              <span className="ms-1.5 text-[11px] opacity-70 font-mono">({contracts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('ACTIVE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeFilter === 'ACTIVE'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{isAr ? 'النشطة' : 'Active'}</span>
              <span className="ms-1.5 text-[11px] opacity-70 font-mono">
                ({contracts.filter(c => c.status === 'ACTIVE').length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('OVERDUE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeFilter === 'OVERDUE'
                  ? 'bg-background text-rose-600 dark:text-rose-400 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{isAr ? 'متأخرة' : 'Overdue'}</span>
              <span className="ms-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                ({contracts.filter(c => c.schedules.some(s => s.status === 'OVERDUE')).length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('COMPLETED')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeFilter === 'COMPLETED'
                  ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{isAr ? 'المكتملة' : 'Completed'}</span>
              <span className="ms-1.5 text-[11px] opacity-70 font-mono">
                ({contracts.filter(c => c.status === 'COMPLETED').length})
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground w-4 h-4 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'ابحث برقم العقد، العميل، أو الكفيل...' : 'Search contract, customer, guarantor...'}
              className="h-9 ps-9 text-xs rounded-lg border-border/80 bg-background"
            />
          </div>
        </div>

        {/* Contracts Table */}
        <div className="overflow-x-auto border border-border/80 rounded-lg bg-background">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="bg-muted/60 border-b border-border/80 text-muted-foreground font-semibold text-[11px]">
                <th className="py-2.5 px-3 text-start">{isAr ? 'رقم العقد والفاتورة' : 'Contract & Invoice'}</th>
                <th className="py-2.5 px-3 text-start">{isAr ? 'العميل' : 'Customer'}</th>
                <th className="py-2.5 px-3 text-start">{isAr ? 'الكفيل الضامن' : 'Guarantor'}</th>
                <th className="py-2.5 px-3 text-center">{isAr ? 'إجمالي التقسيط' : 'Total Price'}</th>
                <th className="py-2.5 px-3 text-center">{isAr ? 'المقدمة' : 'Down Payment'}</th>
                <th className="py-2.5 px-3 text-center">{isAr ? 'المتبقي' : 'Remaining'}</th>
                <th className="py-2.5 px-3 text-center">{isAr ? 'الأقساط' : 'Installments'}</th>
                <th className="py-2.5 px-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="py-2.5 px-3 text-center w-28">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    <FileText className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-semibold text-foreground m-0">
                      {isAr ? 'لا توجد عقود تقسيط مطابقة للبحث' : 'No matching installment contracts'}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {isAr ? 'يمكنك إنشاء عقد جديد من خلال إتمام فاتورة بيع بنوع دفع "تقسيط"' : 'New contracts are issued during sales invoice or POS checkout with installment payment'}
                    </span>
                  </td>
                </tr>
              ) : (
                filteredContracts.map(contract => {
                  const paidCount = contract.schedules.filter(s => s.status === 'PAID').length;
                  const hasOverdue = contract.schedules.some(s => s.status === 'OVERDUE');
                  const percentPaid = contract.totalInstallmentPrice > 0
                    ? Math.round(((contract.totalInstallmentPrice - contract.remainingAmount) / contract.totalInstallmentPrice) * 100)
                    : 0;
                  const isExpanded = expandedContractId === contract.id;

                  return (
                    <Fragment key={contract.id}>
                      <tr className={`hover:bg-muted/20 transition-colors ${isExpanded ? 'bg-muted/20' : ''}`}>
                        {/* Contract # */}
                        <td className="py-2.5 px-3">
                          <strong className="block text-foreground font-mono font-bold text-xs">
                            {contract.contractNumber}
                          </strong>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {contract.invoiceNumber}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-foreground block text-xs">
                            {contract.customerName}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {contract.customerPhone}
                          </span>
                        </td>

                        {/* Guarantor */}
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-foreground block text-xs">
                            {contract.guarantorName}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {contract.guarantorPhone}
                          </span>
                        </td>

                        {/* Total Price */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-foreground">
                          {formatMoney(contract.totalInstallmentPrice)}
                        </td>

                        {/* Down Payment */}
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">
                          {formatMoney(contract.downPayment)}
                        </td>

                        {/* Remaining */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-foreground">
                          {formatMoney(contract.remainingAmount)}
                        </td>

                        {/* Installments Progress */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono text-xs font-bold text-foreground block">
                            {paidCount} / {contract.installmentCount}
                          </span>
                          <div className="w-20 bg-muted rounded-full h-1.5 mx-auto mt-1 overflow-hidden border border-border/50">
                            <div
                              className={`h-full rounded-full ${
                                contract.status === 'COMPLETED' ? 'bg-emerald-500' : hasOverdue ? 'bg-rose-500' : 'bg-primary'
                              }`}
                              style={{ width: `${percentPaid}%` }}
                            />
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">
                          {contract.status === 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <span>{isAr ? 'مكتمل ومسدد' : 'Completed'}</span>
                            </span>
                          ) : hasOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <span>{isAr ? 'قسط متأخر' : 'Overdue'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <span>{isAr ? 'عقد سارٍ' : 'Active'}</span>
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              type="button"
                              variant={isExpanded ? "default" : "outline"}
                              size="sm"
                              onClick={() => setExpandedContractId(prev => prev === contract.id ? null : contract.id)}
                              className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1 border-border/80 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp size={13} /> : <Eye size={13} />}
                              <span>{isExpanded ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'كشف الأقساط' : 'Schedule')}</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title={isAr ? 'فتح كشف حساب رسمي للطباعة' : 'Open official statement modal'}
                              onClick={() => setSelectedContract(contract)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
                            >
                              <ExternalLink size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline Expanded Schedules Row */}
                      {isExpanded && (
                        <tr className="bg-muted/10 border-b border-border/80">
                          <td colSpan={9} className="p-3 sm:p-4">
                            <div className="border border-border/80 rounded-xl p-4 shadow-xs space-y-4" style={{ backgroundColor: 'var(--card)' }}>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                    <Receipt size={15} />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-foreground m-0">
                                      {isAr ? `جدول استحقاقات عقد التقسيط (${contract.contractNumber})` : `Schedule for (${contract.contractNumber})`}
                                    </h4>
                                    <span className="text-[11px] text-muted-foreground">
                                      {isAr ? `الفاتورة: ${contract.invoiceNumber} | العميل: ${contract.customerName} (${contract.customerPhone}) | الكفيل: ${contract.guarantorName} (${contract.guarantorPhone})` : `Invoice: ${contract.invoiceNumber} | Customer: ${contract.customerName}`}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedContract(contract)}
                                    className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1 border-border/80"
                                  >
                                    <Printer size={13} />
                                    <span>{isAr ? 'طباعة كشف الحساب' : 'Print Statement'}</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setExpandedContractId(null)}
                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    <X size={14} className="me-1" />
                                    <span>{isAr ? 'إغلاق' : 'Close'}</span>
                                  </Button>
                                </div>
                              </div>

                              <div className="overflow-x-auto border border-border/80 rounded-lg" style={{ backgroundColor: 'var(--card)' }}>
                                <table className="w-full text-xs text-start">
                                  <thead>
                                    <tr className="bg-muted/60 border-b border-border/80 text-muted-foreground font-semibold text-[11px]">
                                      <th className="py-2 px-3 text-center w-12">#</th>
                                      <th className="py-2 px-3 text-start">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                                      <th className="py-2 px-3 text-center">{isAr ? 'المبلغ المطلوب' : 'Due Amount'}</th>
                                      <th className="py-2 px-3 text-center">{isAr ? 'المبلغ المسدد' : 'Paid Amount'}</th>
                                      <th className="py-2 px-3 text-start">{isAr ? 'تاريخ وسند السداد' : 'Receipt & Date'}</th>
                                      <th className="py-2 px-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                                      <th className="py-2 px-3 text-center w-24">{isAr ? 'إجراء السداد' : 'Pay Action'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/50">
                                    {contract.schedules.map(item => {
                                      const isPaid = item.status === 'PAID';
                                      const isOverdue = item.status === 'OVERDUE';

                                      return (
                                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                                          <td className="py-2 px-3 text-center font-bold font-mono text-muted-foreground">
                                            {item.installmentNumber}
                                          </td>
                                          <td className="py-2 px-3 font-mono font-medium text-foreground">
                                            {item.dueDate}
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono font-bold text-foreground">
                                            {formatMoney(item.amount)}
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                            {formatMoney(item.paidAmount)}
                                          </td>
                                          <td className="py-2 px-3">
                                            {item.receiptVoucherNumber ? (
                                              <div>
                                                <span className="font-mono text-xs font-bold text-primary block">
                                                  {item.receiptVoucherNumber}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                  {item.paidDate ? new Date(item.paidDate).toLocaleDateString() : ''}
                                                </span>
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground text-[11px]">—</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {isPaid ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                <span>{isAr ? 'مسدد بالكامل' : 'Paid'}</span>
                                              </span>
                                            ) : item.status === 'PARTIALLY_PAID' ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                <span>{isAr ? 'مسدد جزئياً' : 'Partial'}</span>
                                              </span>
                                            ) : isOverdue ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                <span>{isAr ? 'متأخر' : 'Overdue'}</span>
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border/60">
                                                <span>{isAr ? 'بانتظار السداد' : 'Pending'}</span>
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {!isPaid ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => handleOpenPay(contract, item)}
                                                className="h-7 px-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-md shadow-2xs hover:bg-primary/90 cursor-pointer"
                                              >
                                                {isAr ? 'سداد' : 'Pay'}
                                              </Button>
                                            ) : (
                                              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                                                {isAr ? 'تم القبض' : 'Cleared'}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Small Dialogs for Pay and Receipt */}
      {renderPayModal()}
      {renderReceiptModal()}
    </div>
  );
}

