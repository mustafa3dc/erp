import React, { useState, useEffect } from 'react';
import {
  Building2,
  Zap,
  Warehouse,
  Layers,
  Calendar,
  Tag,
  Sliders,
  Banknote,
  ShieldAlert,
  Scale,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Save,
  Check,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  Tenant, 
  BUSINESS_PRESETS_CONFIG, 
  createDefaultFeaturesForPreset, 
  updateTenantPreset, 
  updateTenantFeatures 
} from '../../../services/tenantService';
import { BusinessPreset, CompanyFeatures } from '../../../types/rbac';
import { Switch } from '../../ui/switch';

interface TenantFeaturePresetEditorProps {
  tenant: Tenant;
  lang?: 'ar' | 'en';
  onBack: () => void;
  onSaved?: (updatedTenant: Tenant) => void;
}

export const TenantFeaturePresetEditor: React.FC<TenantFeaturePresetEditorProps> = ({
  tenant,
  lang = 'ar',
  onBack,
  onSaved
}) => {
  const isAr = lang === 'ar';

  const [selectedPreset, setSelectedPreset] = useState<BusinessPreset>(() => {
    return tenant.businessPreset || 'Custom';
  });

  const [features, setFeatures] = useState<CompanyFeatures>(() => {
    return tenant.features ? { ...tenant.features } : createDefaultFeaturesForPreset(tenant.businessPreset || 'Custom');
  });

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Handle preset dropdown selection
  const handlePresetChange = (newPreset: BusinessPreset) => {
    setSelectedPreset(newPreset);
    if (newPreset !== 'Custom') {
      const blueprint = createDefaultFeaturesForPreset(newPreset);
      setFeatures(blueprint);
    }
  };

  // Handle individual toggle switches
  const handleFeatureToggle = (key: keyof CompanyFeatures, value: boolean | number) => {
    setFeatures(prev => ({
      ...prev,
      [key]: value
    }));
    // Any manual modification marks the preset as customized
    if (selectedPreset !== 'Custom') {
      setSelectedPreset('Custom');
    }
  };

  // Reset to current preset defaults
  const handleResetToPreset = () => {
    const blueprint = createDefaultFeaturesForPreset(selectedPreset);
    setFeatures(blueprint);
  };

  // Save changes via API & local state
  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      let result;
      if (selectedPreset !== 'Custom') {
        result = await updateTenantPreset(tenant.id, selectedPreset);
      } else {
        result = await updateTenantFeatures(tenant.id, features);
      }

      if (result.success && result.tenant) {
        setSuccessMessage(isAr ? 'تم تحديث باقة الميزات التشغيلية وانعكاسها اللحظي على Redis بنجاح!' : 'Feature flags updated and Redis cache flushed successfully!');
        onSaved?.(result.tenant);
        setTimeout(() => {
          setSuccessMessage('');
        }, 3500);
      } else {
        setErrorMessage(result.message || (isAr ? 'حدث خطأ أثناء حفظ الإعدادات' : 'Error saving feature settings'));
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'فشل الاتصال بخادم النظام' : 'Failed to connect to backend server'));
    } finally {
      setIsSaving(false);
    }
  };

  const presetEntries = Object.entries(BUSINESS_PRESETS_CONFIG) as [BusinessPreset, typeof BUSINESS_PRESETS_CONFIG[BusinessPreset]][];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200 text-foreground" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted cursor-pointer"
            >
              {isAr ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
              <span>{isAr ? 'العودة لقائمة الشركات والمستأجرين' : 'Back to Tenants List'}</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-xs font-semibold text-primary">
              {isAr ? 'إدارة الباقة وفلاتر التشغيل' : 'Presets & Feature Flags'}
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              <Building2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  {tenant.name}
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-mono font-bold">
                  @{tenant.slug}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  tenant.isActive 
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}>
                  {tenant.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معلق (Kill Switch)' : 'Suspended')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr 
                  ? 'تحكم بالوحدات المتاحة لهذا العميل لضبط النوافذ والمعاملات التي يحتاجها فقط عند البيع والإدارة'
                  : 'Control active modules and operational flags for this tenant to tailor accessible screens and workflows'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={handleResetToPreset}
            className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>{isAr ? 'استعادة إعدادات الباقة' : 'Reset to Preset'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving ? (
              <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Save size={13} />
            )}
            <span>{isSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وانعكاس الكاش اللحظي' : 'Save & Flush Cache')}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-semibold flex items-center gap-2.5">
          <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Business Preset Selection Card */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              <h2 className="text-sm font-bold">
                {isAr ? 'اختيار باقة النشاط الجاهزة (Industry Business Preset)' : 'Select Industry Business Preset'}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAr 
                ? 'اختيار الباقة يطبق تلقائياً أفضل إعدادات موصى بها لنوع المتجر (سوبرماركت، إلكترونيات، جملة، وغيرها)'
                : 'Selecting a preset applies recommended feature configuration for this store type automatically'}
            </p>
          </div>

          <div className="w-full sm:w-72">
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value as BusinessPreset)}
              className="w-full h-10 px-3 bg-background border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-xs"
            >
              {presetEntries.map(([key, config]) => (
                <option key={key} value={key}>
                  {isAr ? config.nameAr : config.nameEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Preset Info Banner */}
        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/15 flex items-start gap-3">
          <Info size={16} className="text-primary mt-0.5 shrink-0" />
          <div className="space-y-0.5 text-xs">
            <span className="font-bold text-primary">
              {isAr ? BUSINESS_PRESETS_CONFIG[selectedPreset].nameAr : BUSINESS_PRESETS_CONFIG[selectedPreset].nameEn}:
            </span>{' '}
            <span className="text-muted-foreground">
              {BUSINESS_PRESETS_CONFIG[selectedPreset].descriptionAr}
            </span>
          </div>
        </div>
      </div>

      {/* 10 Feature Flags Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {isAr ? 'مصفوفة مفاتيح التشغيل العشرة (10 Operational Feature Flags)' : '10 Operational Feature Flags Matrix'}
          </h3>
          <span className="text-xs text-muted-foreground">
            {isAr ? 'يمكنك التعديل اليدوي على أي مفتاح بشكل فردي' : 'You can customize individual switches freely'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. EnablePOS */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs hover:border-border/80 transition-all flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">
                  {isAr ? 'نقاط البيع والورديات (Enable POS)' : 'Point of Sale (Enable POS)'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr 
                    ? 'تفعيل شاشة الكاشير السريعة، جلسات الصندوق، والدرج النقدي' 
                    : 'Activate cashier checkout terminal, drawer management, and cash shifts'}
                </p>
              </div>
            </div>
            <Switch
              checked={features.enablePOS}
              onCheckedChange={(val) => handleFeatureToggle('enablePOS', val)}
            />
          </div>

          {/* 2. MultiWarehouse */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs hover:border-border/80 transition-all flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <Warehouse size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">
                  {isAr ? 'تعدد المخازن والمستودعات (Multi-Warehouse)' : 'Multi-Warehouse Architecture'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr 
                    ? 'دعم أكثر من مستودع، إدارة الرفوف، والمناقلات بين المخازن' 
                    : 'Support multiple storage hubs, bin locations, and inter-warehouse transfers'}
                </p>
              </div>
            </div>
            <Switch
              checked={features.multiWarehouse}
              onCheckedChange={(val) => handleFeatureToggle('multiWarehouse', val)}
            />
          </div>

          {/* 3. MaxWarehouses */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs hover:border-border/80 transition-all flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Layers size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">
                  {isAr ? 'الحد الأقصى للمستودعات (Max Warehouses)' : 'Max Warehouses Limit'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr 
                    ? 'سقف المستودعات المسموح بإنشائها وتشغيلها بالتوازي' 
                    : 'Quota of parallel storage warehouses allowed for this company'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min="1"
                max="50"
                value={features.maxWarehouses}
                onChange={(e) => handleFeatureToggle('maxWarehouses', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-8 text-center text-xs font-bold bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
              <span className="text-xs text-muted-foreground font-semibold">{isAr ? 'مستودع' : 'WH'}</span>
            </div>
          </div>

          {/* 4. EnableInstallments */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs hover:border-border/80 transition-all flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <Calendar size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">
                  {isAr ? 'نظام الأقساط والجدولة المالية (Installments)' : 'Installments System'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr 
                    ? 'إدارة عقود البيع بالتقسيط، خطط السداد الشهرية، ومتابعة المتأخرات' 
                    : 'Installment contracts, monthly schedules, down-payments and arrears'}
                </p>
              </div>
            </div>
            <Switch
              checked={features.enableInstallments}
              onCheckedChange={(val) => handleFeatureToggle('enableInstallments', val)}
            />
          </div>

          {/* 5. EnableSerialNumbers */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs hover:border-border/80 transition-all flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                <Tag size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">
                  {isAr ? 'تتبع السيريال والـ IMEI (Serial & IMEI Tracking)' : 'Serial & IMEI Tracking'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr 
                    ? 'إلزام تتبع الأرقام التسلسلية الفريدة لكل قطعة إلكترونية عند الشراء والبيع' 
                    : 'Mandate unique serial/IMEI capture on purchase receipt and sale dispatch'}
                </p>
              </div>
            </div>
            <Switch
              checked={features.enableSerialNumbers}
              onCheckedChange={(val) => handleFeatureToggle('enableSerialNumbers', val)}
            />
          </div>

          {/* 6. EnableVariants */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs hover:border-border/80 transition-all flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0 mt-0.5">
                <Sliders size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">
                  {isAr ? 'المقاسات والألوان (Product Variants)' : 'Product Variants (Sizes/Colors)'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr 
                    ? 'مصفوفة الأحجام والألوان ومتغيرات الملابس والأزياء في شاشة المنتجات' 
                    : 'Support multi-dimensional variants matrix (sizes, colors, fits) per product'}
                </p>
              </div>
            </div>
            <Switch
              checked={features.enableVariants}
              onCheckedChange={(val) => handleFeatureToggle('enableVariants', val)}
            />
          </div>

          {/* 7. EnableMultiCurrency */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs hover:border-border/80 transition-all flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Banknote size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">
                  {isAr ? 'العملات المتعددة وسعر الصرف (Multi-Currency & FX)' : 'Multi-Currency & Exchange Rates'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr 
                    ? 'البيع والشراء بالدينار والدولار بالتوازي مع تثبيت سعر الصرف التاريخي' 
                    : 'Dual-currency trading (IQD, USD) with historical spot rate ledger preservation'}
                </p>
              </div>
            </div>
            <Switch
              checked={features.enableMultiCurrency}
              onCheckedChange={(val) => handleFeatureToggle('enableMultiCurrency', val)}
            />
          </div>

          {/* 8. EnableCreditLimits */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs hover:border-border/80 transition-all flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">
                  {isAr ? 'الحد الائتماني والذمم (Credit Limits & Arrears)' : 'Credit Limits & Receivables'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr 
                    ? 'تقييد سقف مديونية العملاء ومنع إصدار فواتير آجلة عند تجاوز الرصيد المسموح' 
                    : 'Enforce customer credit ceiling and block credit sales exceeding threshold'}
                </p>
              </div>
            </div>
            <Switch
              checked={features.enableCreditLimits}
              onCheckedChange={(val) => handleFeatureToggle('enableCreditLimits', val)}
            />
          </div>

          {/* 9. EnableBarcodeScales */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs hover:border-border/80 transition-all flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                <Scale size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">
                  {isAr ? 'موازين الباركود الإلكترونية (Barcode Scales)' : 'Barcode Weighing Scales'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr 
                    ? 'قراءة باركود الأوزان والأسعار الموزونة تلقائياً في السوبرماركت ومحلات اللحوم' 
                    : 'Automatic weight & weighted price embedded barcode parsing in cashier POS'}
                </p>
              </div>
            </div>
            <Switch
              checked={features.enableBarcodeScales}
              onCheckedChange={(val) => handleFeatureToggle('enableBarcodeScales', val)}
            />
          </div>

          {/* 10. EnableExpiryDates */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs hover:border-border/80 transition-all flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <Clock size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">
                  {isAr ? 'تواريخ انتهاء الصلاحية والتنبيهات (Expiry Dates)' : 'Expiry Dates & Shelf Life'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr 
                    ? 'إدارة دفعات السلع الغذائية وتواريخ الصلاحية والتنبيه المبكر قبل الانتهاء' 
                    : 'Batch expiry date tracking, shelf life management, and FEFO alerts'}
                </p>
              </div>
            </div>
            <Switch
              checked={features.enableExpiryDates}
              onCheckedChange={(val) => handleFeatureToggle('enableExpiryDates', val)}
            />
          </div>
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {isAr ? 'الباقة المحددة حالياً:' : 'Current Selected Preset:'}{' '}
          <span className="font-bold text-foreground">
            {isAr ? BUSINESS_PRESETS_CONFIG[selectedPreset].nameAr : BUSINESS_PRESETS_CONFIG[selectedPreset].nameEn}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving ? (
              <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Check size={14} />
            )}
            <span>{isSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TenantFeaturePresetEditor;

