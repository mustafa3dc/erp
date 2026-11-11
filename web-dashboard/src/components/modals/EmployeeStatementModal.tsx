"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Printer, 
  Calendar, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  FileText, 
  Plus, 
  Receipt, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Clock, 
  Eye, 
  User, 
  CreditCard,
  Building2,
  TrendingUp,
  TrendingDown,
  Filter
} from 'lucide-react';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useSettings } from '../../context/settings-context';
import { 
  EmployeeStatementDto, 
  StatementLineItemDto, 
  calculateEmployeeStatement,
  saveStoredEmployeeTransaction 
} from '../../services/storageService';

interface EmployeeStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  employeeRole?: string;
  lang?: 'ar' | 'en';
}

export default function EmployeeStatementModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  employeeRole = 'موظف',
  lang = 'ar'
}: EmployeeStatementModalProps) {
  const isAr = lang === 'ar';
  const { financialSettings } = useSettings();
  const effectiveCurrency = financialSettings.baseCurrency.symbol;

  // Filter State: 'daily' | 'monthly' | 'custom'
  const [filterType, setFilterType] = useState<'daily' | 'monthly' | 'custom'>('monthly');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Statement Data State
  const [statement, setStatement] = useState<EmployeeStatementDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // New Transaction Form Modal
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [newTxType, setNewTxType] = useState<string>('سلفة نقدية');
  const [newTxAmount, setNewTxAmount] = useState<string>('');
  const [newTxDescription, setNewTxDescription] = useState<string>('');
  const [newTxDirection, setNewTxDirection] = useState<'debit' | 'credit'>('debit');

  // Voucher Inspector Modal State
  const [inspectingItem, setInspectingItem] = useState<StatementLineItemDto | null>(null);

  // Search filter inside table
  const [tableSearch, setTableSearch] = useState('');

  // Fetch or Compute Statement
  const fetchStatement = async () => {
    if (!employeeId) return;
    setIsLoading(true);

    try {
      // 1. Attempt Backend API Query
      const params = new URLSearchParams({
        filterType,
        ...(filterType === 'daily' && { date: selectedDate }),
        ...(filterType === 'monthly' && { 
          year: new Date().getFullYear().toString(), 
          month: (new Date().getMonth() + 1).toString() 
        }),
        ...(filterType === 'custom' && { fromDate: customFrom, toDate: customTo })
      });

      const response = await fetch(`/api/v1/employees/${employeeId}/statement?${params.toString()}`);
      if (response.ok) {
        const data: EmployeeStatementDto = await response.json();
        setStatement(data);
        setIsLoading(false);
        return;
      }
    } catch {
      // API Offline - Seamless fallback to client calculation
    }

    // 2. Client-side offline-first engine
    const now = new Date();
    const data = calculateEmployeeStatement(
      employeeId,
      employeeName,
      filterType,
      selectedDate,
      now.getFullYear(),
      now.getMonth() + 1,
      customFrom,
      customTo
    );
    setStatement(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatement();
    }
  }, [isOpen, employeeId, filterType, selectedDate, customFrom, customTo]);

  if (!isOpen) return null;

  // Filtered rows
  const filteredItems = useMemo(() => {
    if (!statement) return [];
    if (!tableSearch.trim()) return statement.items;
    const q = tableSearch.toLowerCase();
    return statement.items.filter(i => 
      i.referenceNumber.toLowerCase().includes(q) ||
      i.transactionType.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q)
    );
  }, [statement, tableSearch]);

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newTxAmount);
    if (isNaN(amt) || amt <= 0) return;

    const refNum = `${newTxType === 'سلفة نقدية' ? 'ADV' : newTxType === 'راتب شهري' ? 'SAL' : newTxType === 'عمولة مبيعات' ? 'COM' : newTxType === 'عجز وردية' ? 'SFT' : 'VCH'}-${Date.now().toString().slice(-4)}`;

    saveStoredEmployeeTransaction(employeeId, {
      transactionId: `TX-${Date.now().toString().slice(-6)}`,
      transactionDate: new Date().toISOString(),
      referenceNumber: refNum,
      transactionType: newTxType,
      description: newTxDescription.trim() || `${newTxType} للموظف ${employeeName}`,
      debit: newTxDirection === 'debit' ? amt : 0,
      credit: newTxDirection === 'credit' ? amt : 0
    });

    setIsNewTxModalOpen(false);
    setNewTxAmount('');
    setNewTxDescription('');
    fetchStatement();
  };

  const handlePrint = () => {
    window.print();
  };

  const isClosingCredit = (statement?.closingBalance ?? 0) >= 0;

  return (
    <DialogPortal>
      <DialogOverlay onClick={onClose} />
      <DialogContent
        className="statement-printable-container w-full max-w-6xl xl:max-w-7xl mx-auto bg-card border border-border/80 shadow-2xl rounded-2xl p-0 text-foreground overflow-hidden flex flex-col my-auto"
        style={{
          maxWidth: '1440px',
          width: '96vw',
          maxHeight: '92vh',
          padding: 0,
          borderRadius: '1rem',
          backgroundColor: 'var(--card)',
          color: 'var(--foreground)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)'
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body * {
              visibility: hidden !important;
            }
            .statement-printable-container, .statement-printable-container * {
              visibility: visible !important;
            }
            .statement-printable-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              max-height: none !important;
              height: auto !important;
              overflow: visible !important;
              background: #ffffff !important;
              color: #000000 !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            th, td {
              border: 1px solid #94a3b8 !important;
            }
          }
        `}</style>

        {/* PRINT ONLY: OFFICIAL COMPANY STATEMENT HEADER */}
        <div className="hidden print-only p-4 mb-3 border-b-2 border-slate-900 text-slate-900">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-xl font-black m-0 text-slate-900">
                {isAr ? 'كشف حساب مالي تفصيلي للموظف' : 'Employee Financial Statement'}
              </h2>
              <p className="text-xs text-slate-600 m-0 mt-0.5">
                {isAr ? 'بيان حركة الرواتب والعمولات والسلف النقدية والرصيد التراكمي' : 'Official ledger summary of earnings, advances, and running balance'}
              </p>
            </div>
            <div className="text-left font-mono text-xs">
              <div><strong>{isAr ? 'تاريخ الطباعة:' : 'Printed:'}</strong> {new Date().toLocaleDateString('en-US')}</div>
              <div><strong>{isAr ? 'العملة:' : 'Currency:'}</strong> {effectiveCurrency}</div>
            </div>
          </div>
          <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-100 border border-slate-300">
            <div><strong>{isAr ? 'اسم الموظف:' : 'Staff Name:'}</strong> {employeeName}</div>
            <div><strong>{isAr ? 'المعرف:' : 'ID:'}</strong> {employeeId}</div>
            <div><strong>{isAr ? 'الصفة الوظيفية:' : 'Role:'}</strong> {employeeRole}</div>
            <div><strong>{isAr ? 'فترة الكشف:' : 'Period:'}</strong> {statement?.fromDate?.slice(0, 10)} - {statement?.toDate?.slice(0, 10)}</div>
          </div>
        </div>

        {/* MODAL HEADER */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground m-0 leading-tight">
                  {isAr ? 'كشف الحساب المالي للموظف' : 'Employee Statement of Account'}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  {employeeName}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  ({employeeRole})
                </span>
              </div>
              <p className="text-xs text-muted-foreground m-0 mt-0.5 leading-normal">
                {isAr 
                  ? 'سجل الحسابات التراكمي، الرواتب والعمولات، السلف النقدية والمقبوضات'
                  : 'Ledger tracking, compensation, advances, deductions, and rolling net balance'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setIsNewTxModalOpen(true)}
              size="sm"
              className="h-8 px-3 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'تسجيل قيد مالي' : 'New Entry'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 px-3 gap-1.5 font-semibold text-xs border-border"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isAr ? 'طباعة الكشف' : 'Print'}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(94vh-125px)] space-y-4">
          {/* 1. FILTER CONTROLS BAR */}
          <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-muted/30">
            {/* Quick Segmented Tabs */}
            <div className="flex items-center bg-background rounded-lg p-1 border border-border/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setFilterType('daily')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  filterType === 'daily'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isAr ? 'كشف اليوم' : 'Daily'}
              </button>

              <button
                type="button"
                onClick={() => setFilterType('monthly')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  filterType === 'monthly'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isAr ? 'كشف الشهر الحالي' : 'Current Month'}
              </button>

              <button
                type="button"
                onClick={() => setFilterType('custom')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  filterType === 'custom'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isAr ? 'فترة مخصصة' : 'Custom Period'}
              </button>
            </div>

            {/* Date Pickers based on active filter */}
            <div className="flex items-center gap-2">
              {filterType === 'daily' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-semibold">{isAr ? 'التاريخ:' : 'Date:'}</span>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-8 text-xs font-mono w-36"
                  />
                </div>
              )}

              {filterType === 'custom' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{isAr ? 'من:' : 'From:'}</span>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="h-8 text-xs font-mono w-32"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{isAr ? 'إلى:' : 'To:'}</span>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="h-8 text-xs font-mono w-32"
                    />
                  </div>
                </div>
              )}

              {/* Table Quick Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder={isAr ? 'بحث بالمرجع، البيان...' : 'Search ref, desc...'}
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="h-8 ps-8 text-xs w-44 bg-background"
                />
              </div>
            </div>
          </div>

          {/* 2. SUMMARY KPI CARDS ROW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            {/* Card 1: Opening Balance */}
            <div className="p-3 rounded-xl border border-border/80 bg-card space-y-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground truncate">
                  {isAr ? 'الرصيد الافتتاحي (ما قبل الفترة)' : 'Opening Balance'}
                </span>
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-mono font-bold text-foreground">
                  {(statement?.openingBalance ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">{effectiveCurrency}</span>
              </div>
              <span className="text-[10px] text-muted-foreground block truncate">
                {isAr ? 'الرصيد السابق المدور' : 'Carried-over balance'}
              </span>
            </div>

            {/* Card 2: Total Credit (له) */}
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 truncate">
                  {isAr ? 'إجمالي المستحقات (دائن - له)' : 'Total Credit (Due to Staff)'}
                </span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  +{(statement?.totalCredit ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">{effectiveCurrency}</span>
              </div>
              <span className="text-[10px] text-emerald-600/80 block truncate">
                {isAr ? 'الرواتب والعمولات المكتسبة' : 'Salaries & Earned Bonuses'}
              </span>
            </div>

            {/* Card 3: Total Debit (عليه) */}
            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 truncate">
                  {isAr ? 'إجمالي المسحوبات (مدين - عليه)' : 'Total Debit (Deductions/Loans)'}
                </span>
                <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-mono font-bold text-rose-600 dark:text-rose-400">
                  -{(statement?.totalDebit ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-rose-700 dark:text-rose-400 font-semibold">{effectiveCurrency}</span>
              </div>
              <span className="text-[10px] text-rose-600/80 block truncate">
                {isAr ? 'السلف، الخصومات وعجز الوردية' : 'Advances & Shortage Deductions'}
              </span>
            </div>

            {/* Card 4: Closing Balance (صافي الرصيد المستحق) */}
            <div className={`p-3 rounded-xl border space-y-1 shadow-2xs ${
              isClosingCredit 
                ? 'border-emerald-500/30 bg-emerald-500/10' 
                : 'border-rose-500/30 bg-rose-500/10'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold truncate ${isClosingCredit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {isAr ? 'صافي الرصيد الحالي' : 'Net Closing Balance'}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                  isClosingCredit 
                    ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' 
                    : 'bg-rose-500/20 text-rose-800 dark:text-rose-300'
                }`}>
                  {isClosingCredit ? (isAr ? 'مستحق للموظف (له)' : 'Payable to Staff') : (isAr ? 'مستحق للمحل (عليه)' : 'Due to Store')}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-base font-mono font-bold ${isClosingCredit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                  {Math.abs(statement?.closingBalance ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold">{effectiveCurrency}</span>
              </div>
              <span className={`text-[10px] block font-medium truncate ${isClosingCredit ? 'text-emerald-700/80 dark:text-emerald-400/80' : 'text-rose-700/80 dark:text-rose-400/80'}`}>
                {isClosingCredit ? (isAr ? 'يتم صرفه للموظف' : 'Balance owed to employee') : (isAr ? 'يطالب به الموظف لصالح المحل' : 'Owed by employee to company')}
              </span>
            </div>
          </div>

          {/* 3. STATEMENT DATA TABLE */}
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-right table-fixed" dir={isAr ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="bg-muted/60 border-b border-border/60 text-[11px] font-bold text-muted-foreground">
                    <th className="px-2 py-2.5 text-start w-[15%]">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                    <th className="px-2 py-2.5 text-start w-[13%]">{isAr ? 'رقم الحركة / المرجع' : 'Ref Number'}</th>
                    <th className="px-2 py-2.5 text-start w-[11%]">{isAr ? 'نوع الحركة' : 'Transaction Type'}</th>
                    <th className="px-2 py-2.5 text-start w-[25%]">{isAr ? 'البيان / الشرح التفصيلي' : 'Description'}</th>
                    <th className="px-2 py-2.5 text-center w-[9%]">{isAr ? 'مدين (عليه)' : 'Debit (Out)'}</th>
                    <th className="px-2 py-2.5 text-center w-[9%]">{isAr ? 'دائن (له)' : 'Credit (In)'}</th>
                    <th className="px-2 py-2.5 text-center w-[11%]">{isAr ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                    <th className="no-print px-2 py-2.5 text-center w-[7%]">{isAr ? 'فحص' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 px-4 text-center text-muted-foreground">
                        <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center mx-auto mb-3 text-muted-foreground/60 shadow-2xs">
                          <Receipt className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-foreground mb-1">
                          {isAr ? 'لا توجد حركات مالية مسجلة' : 'No Financial Transactions Recorded'}
                        </h4>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4 leading-relaxed">
                          {isAr 
                            ? 'لم يتم تسجيل أي سلف، رواتب، عمولات، أو خصومات لهذا الموظف خلال الفترة المحددة.'
                            : 'No advances, salaries, commissions, or deductions have been logged for this staff member in this timeframe.'}
                        </p>
                        <Button
                          type="button"
                          onClick={() => setIsNewTxModalOpen(true)}
                          size="sm"
                          className="h-8 px-4 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isAr ? 'تسجيل أول قيد مالي الآن' : 'Record First Entry Now'}</span>
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isLineCredit = item.runningBalance >= 0;
                      return (
                        <tr key={item.transactionId} className="hover:bg-muted/30 transition-colors">
                          {/* 1. Date & Time */}
                          <td className="px-2 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap" dir="ltr">
                            {new Date(item.transactionDate).toLocaleString('en-US', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </td>

                          {/* 2. Reference Number */}
                          <td className="px-2 py-2.5 font-mono font-bold text-primary whitespace-nowrap text-xs" dir="ltr">
                            {item.referenceNumber}
                          </td>

                          {/* 3. Transaction Type */}
                          <td className="px-2 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold ${
                              item.transactionType.includes('راتب')
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                                : item.transactionType.includes('عمولة')
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                : item.transactionType.includes('سلفة')
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                : item.transactionType.includes('عجز')
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-muted text-foreground border border-border/80'
                            }`}>
                              {item.transactionType}
                            </span>
                          </td>

                          {/* 4. Description */}
                          <td className="px-2 py-2.5 font-medium text-foreground text-xs truncate max-w-0" title={item.description}>
                            {item.description}
                          </td>

                          {/* 5. Debit (عليه) */}
                          <td className="px-2 py-2.5 text-center font-mono font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap text-xs">
                            {item.debit > 0 ? `${item.debit.toLocaleString()} ${effectiveCurrency}` : '—'}
                          </td>

                          {/* 6. Credit (له) */}
                          <td className="px-2 py-2.5 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-xs">
                            {item.credit > 0 ? `+${item.credit.toLocaleString()} ${effectiveCurrency}` : '—'}
                          </td>

                          {/* 7. Running Balance */}
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border font-mono font-bold text-xs shadow-2xs">
                              <span className={isLineCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {Math.abs(item.runningBalance).toLocaleString()} {effectiveCurrency}
                              </span>
                              <span className={`text-[8.5px] px-1 rounded ${isLineCredit ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/20 text-rose-700 dark:text-rose-400'}`}>
                                {isLineCredit ? (isAr ? 'له' : 'CR') : (isAr ? 'عليه' : 'DR')}
                              </span>
                            </div>
                          </td>

                          {/* 8. Inspect Voucher */}
                          <td className="no-print px-2 py-2.5 text-center whitespace-nowrap">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectingItem(item)}
                              className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10 rounded-md mx-auto"
                              title={isAr ? 'فحص تفاصيل السند' : 'Inspect Voucher'}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isAr ? 'فحص' : 'View'}</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PRINT ONLY: OFFICIAL SIGNATURES & STAMPS */}
          <div className="hidden print-only grid grid-cols-3 gap-6 pt-6 mt-4 border-t-2 border-slate-300 text-slate-800 text-xs">
            <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center min-h-[90px]">
              <strong>{isAr ? 'توقيع الموظف بالمطابقة' : 'Employee Signature'}</strong>
              <div className="mt-8 border-t border-slate-300 pt-1 text-[11px] text-slate-600">{employeeName}</div>
            </div>
            <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center min-h-[90px]">
              <strong>{isAr ? 'تدقيق الحسابات والمالية' : 'Accounting Audit'}</strong>
              <div className="mt-8 border-t border-slate-300 pt-1 text-[11px] text-slate-600">{isAr ? 'قسم الحسابات العامة' : 'Finance Dept'}</div>
            </div>
            <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center min-h-[90px]">
              <strong>{isAr ? 'اعتماد الإدارة والختم' : 'Management Approval'}</strong>
              <div className="mt-8 border-t border-slate-300 pt-1 text-[11px] text-slate-600">{isAr ? 'معتمد رسمي' : 'Authorized'}</div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="no-print flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              {isAr ? 'فترة كشف الحساب:' : 'Statement Range:'}
            </span>
            <span className="text-xs font-mono font-bold text-foreground">
              {statement?.fromDate?.slice(0, 10)} {isAr ? 'إلى' : 'to'} {statement?.toDate?.slice(0, 10)}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-5 text-xs font-bold"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </Button>
        </div>
      </DialogContent>

      {/* SUB-MODAL 1: NEW FINANCIAL ENTRY (سلفة، راتب، عمولة، خصم) */}
      {isNewTxModalOpen && (
        <DialogPortal>
          <DialogOverlay onClick={() => setIsNewTxModalOpen(false)} />
          <DialogContent className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl p-0 overflow-hidden my-auto" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground m-0">{isAr ? 'تسجيل قيد مالي جديد للموظف' : 'Record Financial Transaction'}</h4>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setIsNewTxModalOpen(false)} className="w-7 h-7">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            <form onSubmit={handleCreateTransaction} className="p-5 space-y-3.5">
              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground">{isAr ? 'نوع القيد المالي' : 'Transaction Type'}</span>
                <select
                  value={newTxType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewTxType(val);
                    if (val === 'سلفة نقدية' || val === 'خصم' || val === 'عجز وردية') {
                      setNewTxDirection('debit');
                    } else {
                      setNewTxDirection('credit');
                    }
                  }}
                  className="w-full h-9 rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium cursor-pointer"
                >
                  <option value="سلفة نقدية">{isAr ? 'سلفة نقدية (مدين - عليه)' : 'Cash Advance (Debit)'}</option>
                  <option value="راتب شهري">{isAr ? 'راتب شهري (دائن - له)' : 'Monthly Salary (Credit)'}</option>
                  <option value="عمولة مبيعات">{isAr ? 'عمولة وحافز مبيعات (دائن - له)' : 'Sales Commission (Credit)'}</option>
                  <option value="خصم">{isAr ? 'خصم إداري (مدين - عليه)' : 'Deduction (Debit)'}</option>
                  <option value="عجز وردية">{isAr ? 'عجز وردية كاشير (مدين - عليه)' : 'Shift Shortage (Debit)'}</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground">{isAr ? `المبلغ (${effectiveCurrency})` : `Amount (${effectiveCurrency})`} *</span>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="0"
                  value={newTxAmount}
                  onChange={(e) => setNewTxAmount(e.target.value)}
                  className="h-9 font-mono font-bold text-xs"
                />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground">{isAr ? 'البيان والشرح' : 'Description'}</span>
                <Input
                  type="text"
                  placeholder={isAr ? 'سبب القيد، رقم الإذن أو الفاتورة...' : 'Reason, voucher details...'}
                  value={newTxDescription}
                  onChange={(e) => setNewTxDescription(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsNewTxModalOpen(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold">
                  {isAr ? 'تأكيد وقيد الحركة' : 'Confirm Entry'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </DialogPortal>
      )}

      {/* SUB-MODAL 2: VOUCHER INSPECTION (فحص السند الإلكتروني) */}
      {inspectingItem && (
        <DialogPortal>
          <DialogOverlay onClick={() => setInspectingItem(null)} />
          <DialogContent className="w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl p-0 overflow-hidden my-auto" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground m-0">{isAr ? 'تفاصيل السند المالي' : 'Voucher Details'}</h4>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setInspectingItem(null)} className="w-7 h-7">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">{isAr ? 'رقم السند المرجعي:' : 'Reference:'}</span>
                <span className="font-mono font-bold text-primary" dir="ltr">{inspectingItem.referenceNumber}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">{isAr ? 'اسم الموظف:' : 'Employee:'}</span>
                <span className="font-bold text-foreground">{employeeName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">{isAr ? 'نوع الحركة:' : 'Type:'}</span>
                <span className="font-bold">{inspectingItem.transactionType}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">{isAr ? 'تاريخ التوثيق:' : 'Date:'}</span>
                <span className="font-mono" dir="ltr">{new Date(inspectingItem.transactionDate).toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">{isAr ? 'المبلغ:' : 'Amount:'}</span>
                <span className="font-mono font-black text-sm text-foreground">
                  {inspectingItem.credit > 0 ? `+${inspectingItem.credit.toLocaleString()}` : `-${inspectingItem.debit.toLocaleString()}`} {effectiveCurrency}
                </span>
              </div>
              <div className="py-1">
                <span className="text-muted-foreground block mb-1">{isAr ? 'البيان والملاحظات:' : 'Notes:'}</span>
                <p className="p-2.5 rounded-lg bg-muted/40 text-foreground text-xs leading-relaxed border border-border/60 m-0">
                  {inspectingItem.description || (isAr ? 'لا توجد ملاحظات إضافية' : 'No extra notes')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end px-5 py-3 border-t border-border bg-muted/20">
              <Button type="button" size="sm" onClick={() => setInspectingItem(null)}>
                {isAr ? 'تم' : 'Done'}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      )}
    </DialogPortal>
  );
}
