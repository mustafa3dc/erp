import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, TrendingUp, Bot, Sparkles, ShieldAlert, 
  Clock, CheckCircle2, Lock, RefreshCw
} from 'lucide-react';
import { getStockForecastAnalytics, StockForecastPayload } from '../../services/aiService';
import { getStoredAuthSession, getStoredProducts } from '../../services/storageService';
import { getStoredTenants } from '../../services/tenantService';
import { useSettings } from '../../context/settings-context';

interface ReportsViewProps {
  lang: 'en' | 'ar';
  onOpenAiAssistant?: () => void;
  tenantPlan?: 'Starter' | 'Pro' | 'Enterprise';
}

const formatMovementAge = (days: number, isAr: boolean, isNeverSold?: boolean) => {
  if (days <= 0) {
    if (isNeverSold) {
      return isAr ? 'أضيف اليوم (أقل من 24 ساعة)' : 'Added today (<24h)';
    }
    return isAr ? 'حركة اليوم (أقل من 24 ساعة)' : 'Active today (<24h)';
  }
  if (days === 1) {
    return isAr ? (isNeverSold ? 'أضيف بالأمس' : 'متوقف منذ يوم واحد') : '1 day inactive';
  }
  if (days === 2) {
    return isAr ? (isNeverSold ? 'أضيف منذ يومين' : 'متوقف منذ يومين') : '2 days inactive';
  }
  if (days >= 3 && days <= 10) {
    return isAr ? `متوقف منذ ${days} أيام` : `${days} days inactive`;
  }
  return isAr ? `متوقف منذ ${days} يوماً` : `${days} days inactive`;
};

const formatDaysRemaining = (days: number, isAr: boolean) => {
  if (days <= 0) return isAr ? 'نفد المخزون بالكامل' : 'Out of stock';
  if (days === 1) return isAr ? 'ينفد خلال يوم واحد' : 'Depletes in 1d';
  if (days === 2) return isAr ? 'ينفد خلال يومين' : 'Depletes in 2d';
  if (days >= 3 && days <= 10) return isAr ? `ينفد خلال ${days} أيام` : `Depletes in ${days}d`;
  return isAr ? `ينفد خلال ${days} يوماً` : `Depletes in ${days}d`;
};

// Clean display text from any lingering emojis or bidirectional scrambled markers
const cleanDisplayText = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\(Bundle\)/gi, 'ضمن حزمة ترويجية')
    .replace(/\s+/g, ' ')
    .trim();
};

export default function ReportsView({ lang, onOpenAiAssistant, tenantPlan }: ReportsViewProps) {
  const isAr = lang === 'ar';
  const { formatMoney, currencySymbol } = useSettings();

  // Determine current effective tenant plan
  const [effectivePlan, setEffectivePlan] = useState<'Starter' | 'Pro' | 'Enterprise'>('Pro');
  const [forecastData, setForecastData] = useState<StockForecastPayload | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);

  useEffect(() => {
    if (tenantPlan) {
      setEffectivePlan(tenantPlan);
    } else {
      const session = getStoredAuthSession();
      const allTenants = getStoredTenants();
      const currentTenant = allTenants.find(t => t.slug.toLowerCase() === session?.tenantSlug?.toLowerCase());
      if (session?.role === 'PlatformSuperAdmin') {
        setEffectivePlan('Enterprise');
      } else if (currentTenant?.plan) {
        setEffectivePlan(currentTenant.plan);
      } else {
        setEffectivePlan('Pro');
      }
    }
  }, [tenantPlan]);

  useEffect(() => {
    if (effectivePlan === 'Pro' || effectivePlan === 'Enterprise') {
      loadForecast();
    }

    const handleStorageUpdate = () => {
      if (effectivePlan === 'Pro' || effectivePlan === 'Enterprise') {
        loadForecast();
      }
    };
    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('erp_purchases_updated', handleStorageUpdate);
    window.addEventListener('erp_inventory_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('erp_purchases_updated', handleStorageUpdate);
      window.removeEventListener('erp_inventory_updated', handleStorageUpdate);
    };
  }, [effectivePlan]);

  const loadForecast = async () => {
    setLoadingForecast(true);
    try {
      const res = await getStockForecastAnalytics(effectivePlan);
      if (res.data) {
        setForecastData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingForecast(false);
    }
  };

  // Real-time dynamic calculation of inventory reports
  const products = getStoredProducts() || [];
  const totalStockCount = products.reduce((acc: number, p: any) => acc + (Number(p.currentStock) || 0), 0);
  const totalValuation = products.reduce((acc: number, p: any) => acc + ((Number(p.currentStock) || 0) * (Number(p.costPrice) || 0)), 0);

  const reports = [
    {
      title: isAr ? 'تقرير التقييم المالي الشامل للمخزون (FIFO)' : 'Comprehensive Inventory Valuation Report (FIFO)',
      desc: isAr 
        ? `تقييم رسمي دقيق لجميع البضائع (${products.length} صنف مسجل، إجمالي القيمة: ${formatMoney(totalValuation)}).`
        : `Formal ledger balance valuation (${products.length} SKUs recorded, Total Value: ${formatMoney(totalValuation)}).`,
      metaInfo: isAr ? `سجل فوري • ${products.length} صنف` : `Live ledger • ${products.length} items`
    },
    {
      title: isAr ? 'تقرير تصنيف البضائع وحركتها السريعة (ABC Velocity)' : 'Fast vs. Slow Moving Inventory (ABC Velocity)',
      desc: isAr 
        ? 'تحليل ذكي لحركة دوران الأصناف وحماية السيولة النقدية من التجميد في المخازن.'
        : 'Smart classification of turnover velocity and cash flow optimization.',
      metaInfo: isAr ? 'تحليل ديناميكي مباشر' : 'Real-time velocity audit'
    },
    {
      title: isAr ? 'سجل المطابقة والتسوية الدورية للمخزون' : 'Periodic Physical Inventory Audit & Discrepancies',
      desc: isAr 
        ? `مطابقة الجرد الفعلي مع الرصيد الدفتري المسجل لكافة الوحدات (${totalStockCount.toLocaleString()} قطعة).`
        : `Physical count reconciliation vs ledger across ${totalStockCount.toLocaleString()} on-hand units.`,
      metaInfo: isAr ? 'سجل تسوية دوري معتمد' : 'Certified reconciliation ledger'
    }
  ];

  const handleDownloadReport = (title: string) => {
    try {
      const prods = getStoredProducts();
      const csvRows = [
        ['SKU', 'Item Name', 'Category', 'Warehouse', 'Current Stock', `Cost Price (${currencySymbol})`, `Selling Price (${currencySymbol})`, `Valuation Total (${currencySymbol})`],
        ...prods.map((p: any) => [
          p.sku || '',
          `"${p.nameAr || p.name || ''}"`,
          `"${p.category || ''}"`,
          `"${p.warehouseName || ''}"`,
          p.currentStock ?? 0,
          p.costPrice ?? 0,
          p.sellingPrice ?? 0,
          (Number(p.currentStock || 0) * Number(p.costPrice || 0)).toFixed(2)
        ])
      ];
      const csvString = '\uFEFF' + csvRows.map(row => row.join(',')).join('\r\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `zilox_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const urgentWarningsCount = forecastData?.stockoutWarnings?.length ?? 0;
  const stagnantCapital = forecastData?.stagnantInventoryRadar?.totalFrozenCapital ?? 0;
  const stagnantItems = forecastData?.stagnantInventoryRadar?.items ?? [];
  const supplierAlerts = forecastData?.supplierPriceSpikeAlerts ?? [];

  return (
    <div className="view-content-wrapper fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      {/* View Header */}
      <div className="view-header-bar flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="view-title text-xl font-extrabold text-foreground tracking-tight m-0">
            {isAr ? 'التقارير التنفيذية ومحرك الذكاء الاصطناعي' : 'Executive Reports & AI Intelligence'}
          </h2>
          <p className="view-subtitle text-xs text-muted-foreground mt-1">
            {isAr ? 'رادار التنبؤ بالطلب، كشف رأس المال المجمد، وتقارير التقييم المالي المتطابقة مع المعايير المحاسبية' : 'Demand forecasting radar, frozen capital detector, and certified ledger valuation exports'}
          </p>
        </div>

        {onOpenAiAssistant && (
          <button 
            type="button" 
            onClick={onOpenAiAssistant}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all shadow-xs cursor-pointer select-none"
          >
            <Bot size={16} />
            <span>{isAr ? 'تشغيل المستشار التنفيذي الذكي' : 'Launch Executive Copilot'}</span>
          </button>
        )}
      </div>

      {/* AI DEMAND FORECASTING & STAGNANT RADAR SECTION */}
      {effectivePlan === 'Starter' ? (
        <div className="bg-card border border-border/80 rounded-2xl p-6 mb-7 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Lock size={22} />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1.5">
            {isAr ? 'رادار التنبؤ بنفاد المخزون وكشف البضاعة الراكدة' : 'AI Stockout Forecasting & Stagnant Radar'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto mb-4 leading-relaxed">
            {isAr 
              ? 'أنت تعمل حالياً على الباقة الأساسية. تتطلب ميزة التنبؤ بالطلب ورادار رأس المال المجمد الترقية إلى الباقة المتقدمة أو الفائقة.' 
              : 'You are currently on the Starter tier. AI demand prediction and stagnant inventory alerts require the Pro or Enterprise tier.'}
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            <Sparkles size={14} />
            <span>{isAr ? 'ترقية الباقة وتفعيل رادار المخزون' : 'Upgrade Plan'}</span>
          </a>
        </div>
      ) : (
        <div className="mb-7">
          {/* Header of AI section */}
          <div className="flex justify-between items-center mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground m-0">
                  {isAr ? 'رادار المخزون والطلب الاستباقي' : 'Proactive Demand & Stagnant Inventory Radar'}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {isAr ? 'تحليل ذكي لحركة المبيعات وتسييل رأس المال المجمد وتفادي نفاد المواد' : 'Rolling velocity analysis, actionable capital recovery, and stockout defense'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={loadForecast}
              disabled={loadingForecast}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw size={13} className={loadingForecast ? 'animate-spin' : ''} />
              <span>{isAr ? 'تحديث التحليل' : 'Refresh'}</span>
            </button>
          </div>

          {/* Radar 3-Card Grid: Perfectly distributed across screen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* CARD 1: URGENT STOCKOUT WARNINGS */}
            <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs hover:border-primary/30 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ShieldAlert size={16} className={urgentWarningsCount > 0 ? "text-amber-500" : "text-emerald-500"} />
                    <span>{isAr ? 'تنبيهات نفاد المخزون القريبة' : 'Stockout Depletion Warnings'}</span>
                  </span>

                  {urgentWarningsCount === 0 ? (
                    <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-medium px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>{isAr ? 'آمن ومستقر' : 'Safe'}</span>
                    </span>
                  ) : (
                    <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {urgentWarningsCount} {isAr ? 'أصناف حرجة' : 'Items'}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 mt-3">
                  {urgentWarningsCount === 0 ? (
                    <div className="py-6 px-3 rounded-xl bg-muted/30 border border-border/40 text-center flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 size={24} className="text-emerald-500" />
                      <span className="text-xs font-semibold text-foreground">
                        {isAr ? 'كافة الأصناف متوازنة وتفوق حد الأمان' : 'All items are above safety stock thresholds'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {isAr ? 'لا توجد أي نواقص متوقعة في الدورة الحالية' : 'Zero replenishment bottlenecks detected'}
                      </span>
                    </div>
                  ) : (
                    (forecastData?.stockoutWarnings ?? []).map((w, idx) => (
                      <div key={idx} className="bg-background border border-border/60 rounded-xl p-3 shadow-2xs">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-foreground">{w.nameAr}</span>
                          <span className="text-[11px] font-bold text-amber-600">
                            {formatDaysRemaining(w.daysRemaining, isAr)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                          <span>{isAr ? `المتوفر: ${w.currentStock} قطعة` : `Stock: ${w.currentStock}`}</span>
                          <span>{isAr ? `معدل البيع: ${w.averageDailySales} يومياً` : `Velocity: ${w.averageDailySales}/d`}</span>
                        </div>
                        <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                          <span>{isAr ? `الطلب المقترح: ${w.recommendedReorderQty} قطعة من المورد (${w.supplierName})` : `Suggested PO: ${w.recommendedReorderQty} units from (${w.supplierName})`}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* CARD 2: STAGNANT INVENTORY & FROZEN CAPITAL */}
            <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs hover:border-primary/30 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Clock size={16} className="text-sky-500" />
                    <span>{isAr ? 'رادار البضاعة الراكدة والسيولة المجمدة' : 'Stagnant Goods & Frozen Capital'}</span>
                  </span>

                  <span className="bg-sky-500/10 text-sky-600 border border-sky-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full font-mono inline-flex items-center">
                    <bdi dir="ltr">{formatMoney(stagnantCapital)}</bdi>
                  </span>
                </div>

                <div className="flex flex-col gap-2.5 mt-3">
                  {stagnantItems.length === 0 ? (
                    <div className="py-6 px-3 rounded-xl bg-muted/30 border border-border/40 text-center flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 size={24} className="text-sky-500" />
                      <span className="text-xs font-semibold text-foreground">
                        {isAr ? 'لا توجد بضاعة راكدة في المخزون' : 'No stagnant inventory detected'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {isAr ? 'دورة دوران رأس المال تعمل بكفاءة منتظمة' : 'Capital velocity is operating at optimal levels'}
                      </span>
                    </div>
                  ) : (
                    stagnantItems.map((s, idx) => (
                      <div key={idx} className="bg-background border border-border/60 rounded-xl p-3 shadow-2xs">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-foreground">{s.nameAr}</span>
                          <span className="text-[11px] font-bold text-sky-600">
                            {formatMovementAge(s.daysWithoutMovement, isAr, s.isNeverSold)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                          <span>{isAr ? `الكمية المجمدة: ${s.currentStock} قطعة` : `Qty: ${s.currentStock}`}</span>
                          <span className="font-bold text-foreground font-mono inline-flex items-center gap-1">
                            <span>{isAr ? 'رأس المال:' : 'Cost:'}</span>
                            <bdi dir="ltr">{formatMoney(s.frozenCost)}</bdi>
                          </span>
                        </div>
                        <div className="mt-2 p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-700 dark:text-sky-400 font-medium leading-relaxed">
                          <bdi dir={isAr ? 'rtl' : 'ltr'}>
                            {cleanDisplayText(isAr ? s.actionRecommendation : (s.actionRecommendationEn || s.actionRecommendation))}
                          </bdi>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* CARD 3: SUPPLIER PRICE SPIKE ALERTS */}
            <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs hover:border-primary/30 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <TrendingUp size={16} className="text-indigo-500" />
                    <span>{isAr ? 'مراقبة ارتفاع تكاليف الموردين' : 'Supplier Price Spike Alerts'}</span>
                  </span>

                  <span className="bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {isAr ? 'حماية هامش الربح' : 'Margin Guard'}
                  </span>
                </div>

                <div className="flex flex-col gap-2.5 mt-3">
                  {supplierAlerts.length === 0 ? (
                    <div className="py-6 px-3 rounded-xl bg-muted/30 border border-border/40 text-center flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 size={24} className="text-indigo-500" />
                      <span className="text-xs font-semibold text-foreground">
                        {isAr ? 'تكاليف الموردين مستقرة وهامش الربح محمي' : 'Supplier pricing is stable & margins are intact'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {isAr ? 'لم يُرصد أي تضخم مفاجئ في فواتير الشراء الأخيرة' : 'No price surges detected across active vendors'}
                      </span>
                    </div>
                  ) : (
                    supplierAlerts.map((sp, idx) => (
                      <div key={idx} className="bg-background border border-border/60 rounded-xl p-3 shadow-2xs">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-foreground">{sp.nameAr}</span>
                          <span className="text-xs font-extrabold text-destructive">
                            +{sp.spikePercent}%
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                          <span className="inline-flex items-center gap-1">
                            <span>{isAr ? 'السابق:' : 'Prev:'}</span>
                            <bdi dir="ltr">{formatMoney(sp.previousCost)}</bdi>
                          </span>
                          <span className="font-bold text-destructive font-mono inline-flex items-center gap-1">
                            <span>{isAr ? 'الفاتورة:' : 'Latest:'}</span>
                            <bdi dir="ltr">{formatMoney(sp.latestBillCost)}</bdi>
                          </span>
                        </div>
                        <div className="mt-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-400 font-medium leading-relaxed">
                          <bdi dir={isAr ? 'rtl' : 'ltr'}>
                            {cleanDisplayText(isAr ? sp.recommendation : (sp.recommendationEn || sp.recommendation))}
                          </bdi>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SECTION 2: FORMAL INVENTORY LEDGERS & EXPORTABLE AUDIT REPORTS */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">
          {isAr ? 'التقارير وسجلات الجرد الرسمية القابلة للتصدير' : 'Certified Inventory Ledgers & Audit Exports'}
        </h3>

        <div className="reports-list-container flex flex-col gap-3">
          {reports.map((r, i) => (
            <div key={i} className="report-card bg-card border border-border/70 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="report-icon-box w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div className="report-info">
                  <h4 className="text-xs font-bold text-foreground m-0">{r.title}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 m-0">{r.desc}</p>
                  <div className="report-meta text-[10px] text-muted-foreground mt-1 font-medium">
                    <span>{r.metaInfo}</span>
                  </div>
                </div>
              </div>

              <button 
                type="button" 
                className="btn-secondary-flat shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer shadow-2xs" 
                onClick={() => handleDownloadReport(r.title)}
                title={isAr ? 'تنزيل ملف التقرير المعتمد' : 'Download CSV Report'}
              >
                <Download size={14} />
                <span>{isAr ? 'تحميل التقرير (CSV)' : 'Download (CSV)'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
