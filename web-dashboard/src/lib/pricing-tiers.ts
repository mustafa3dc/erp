// ============================================================================
// ZiloX Enterprise Suite - Global Commercial Geo-Pricing Architecture
// Enterprise Multi-Region Standard (Shopify/Stripe Pattern)
// Continuous Instant Cloud Backup is standard across ALL tiers.
// ============================================================================

export type PlanTierId = 'Starter' | 'Pro' | 'Enterprise';
export type BillingCycle = 'monthly' | 'yearly';
export type RegionId = 'GLOBAL' | 'IQ' | 'SA' | 'AE';

export interface GeoRegionConfig {
  id: RegionId;
  flag: string;
  countryCode: string;
  nameAr: string;
  nameEn: string;
  currencyCode: 'USD' | 'IQD' | 'SAR' | 'AED';
  currencySymbolAr: string;
  currencySymbolEn: string;
  subtitleAr: string;
  tiers: Record<PlanTierId, {
    monthly: number;
    yearly: number; // 2 months free (pay 10 months)
    secondaryMonthly?: number; // e.g. equivalent in USD or local
    secondaryYearly?: number;
    secondarySymbol?: string;
  }>;
}

export const GEO_REGIONS: Record<RegionId, GeoRegionConfig> = {
  GLOBAL: {
    id: 'GLOBAL',
    flag: '',
    countryCode: 'GLOBAL',
    nameAr: 'دولي / العملات العالمية (USD $)',
    nameEn: 'Global / International (USD $)',
    currencyCode: 'USD',
    currencySymbolAr: '$',
    currencySymbolEn: '$',
    subtitleAr: 'التسعير القياسي العالمي لمنشآت التجارة والأعمال الدولية',
    tiers: {
      Starter: { monthly: 29, yearly: 290 },
      Pro: { monthly: 79, yearly: 790 },
      Enterprise: { monthly: 199, yearly: 1990 }
    }
  },
  IQ: {
    id: 'IQ',
    flag: '🇮🇶',
    countryCode: 'IQ',
    nameAr: 'العراق (IQD / USD)',
    nameEn: 'Iraq (IQD / USD)',
    currencyCode: 'IQD',
    currencySymbolAr: 'د.ع',
    currencySymbolEn: 'IQD',
    subtitleAr: 'تسعير مخصص للسوق العراقي مع دعم زين كاش وكي كارد',
    tiers: {
      Starter: { monthly: 15000, yearly: 150000, secondaryMonthly: 10, secondaryYearly: 100, secondarySymbol: '$' },
      Pro: { monthly: 37000, yearly: 370000, secondaryMonthly: 25, secondaryYearly: 250, secondarySymbol: '$' },
      Enterprise: { monthly: 67000, yearly: 670000, secondaryMonthly: 45, secondaryYearly: 450, secondarySymbol: '$' }
    }
  },
  SA: {
    id: 'SA',
    flag: '🇸🇦',
    countryCode: 'SA',
    nameAr: 'المملكة العربية السعودية (SAR ر.س)',
    nameEn: 'Saudi Arabia (SAR)',
    currencyCode: 'SAR',
    currencySymbolAr: 'ر.س',
    currencySymbolEn: 'SAR',
    subtitleAr: 'تسعير مخصص للمملكة مع دعم الدفع بالمدى والفوترة الإلكترونية',
    tiers: {
      Starter: { monthly: 110, yearly: 1100, secondaryMonthly: 29, secondaryYearly: 290, secondarySymbol: '$' },
      Pro: { monthly: 295, yearly: 2950, secondaryMonthly: 79, secondaryYearly: 790, secondarySymbol: '$' },
      Enterprise: { monthly: 750, yearly: 7500, secondaryMonthly: 199, secondaryYearly: 1990, secondarySymbol: '$' }
    }
  },
  AE: {
    id: 'AE',
    flag: '🇦🇪',
    countryCode: 'AE',
    nameAr: 'الإمارات العربية المتحدة (AED د.إ)',
    nameEn: 'United Arab Emirates (AED)',
    currencyCode: 'AED',
    currencySymbolAr: 'د.إ',
    currencySymbolEn: 'AED',
    subtitleAr: 'تسعير موجه للأعمال والشركات في دولة الإمارات',
    tiers: {
      Starter: { monthly: 110, yearly: 1100, secondaryMonthly: 29, secondaryYearly: 290, secondarySymbol: '$' },
      Pro: { monthly: 290, yearly: 2900, secondaryMonthly: 79, secondaryYearly: 790, secondarySymbol: '$' },
      Enterprise: { monthly: 730, yearly: 7300, secondaryMonthly: 199, secondaryYearly: 1990, secondarySymbol: '$' }
    }
  }
};

export const GEO_REGIONS_LIST = Object.values(GEO_REGIONS);

/**
 * Auto-detect visitor's region using Timezone, Locale, or explicit stored choice.
 */
export function detectUserRegion(): RegionId {
  if (typeof window === 'undefined') return 'GLOBAL';

  // 1. Check saved manual selection
  try {
    const saved = localStorage.getItem('zilox_selected_geo_region') as RegionId;
    if (saved && GEO_REGIONS[saved]) {
      return saved;
    }
  } catch {
    // Ignore storage issues
  }

  // 2. Check Timezone (High reliability client-side heuristic)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Baghdad')) return 'IQ';
    if (tz.includes('Riyadh')) return 'SA';
    if (tz.includes('Dubai') || tz.includes('Abu_Dhabi') || tz.includes('Muscat')) return 'AE';
  } catch {
    // Ignore timezone detection issues
  }

  // 3. Check Browser Languages (e.g. ar-IQ, ar-SA, ar-AE)
  try {
    const langs = window.navigator.languages || [window.navigator.language];
    for (const l of langs) {
      const lower = l.toLowerCase();
      if (lower.includes('-iq')) return 'IQ';
      if (lower.includes('-sa')) return 'SA';
      if (lower.includes('-ae')) return 'AE';
    }
  } catch {
    // Ignore
  }

  // 4. Fallback default for any international visitor
  return 'GLOBAL';
}

export interface PricingPlanTier {
  id: PlanTierId;
  nameAr: string;
  nameEn: string;
  badgeAr: string;
  isPopular?: boolean;
  pricing: {
    monthlyUsd: number;
    yearlyUsd: number;
    monthlyIqd: number;
    yearlyIqd: number;
  };
  quotas: {
    branches: number;
    warehouses: number;
    users: number;
  };
  operationalFeatures: string[];
  aiFeatureTitle: string;
  aiFeatureDescription: string;
  aiBadgeAr: string;
}

export const PRICING_TIERS: Record<PlanTierId, PricingPlanTier> = {
  Starter: {
    id: 'Starter',
    nameAr: 'الباقة الأساسية',
    nameEn: 'Starter',
    badgeAr: 'للمتاجر الفردية ونقاط البيع السريعة',
    isPopular: false,
    pricing: {
      monthlyUsd: 29,
      yearlyUsd: 290,
      monthlyIqd: 15000,
      yearlyIqd: 150000
    },
    quotas: {
      branches: 1,
      warehouses: 1,
      users: 3
    },
    operationalFeatures: [
      'نقطة بيع سريعة (POS) غير محدودة للمبيعات',
      'فواتير الشراء، البيع، المرتجعات، وإدارة الديون',
      'إغلاق الصناديق والورديات اليومية (Z-Report)',
      'دعم الدفع الإلكتروني والتحويلات المحلية',
      'طباعة الباركود وإيصالات الفواتير الحرارية (ESC/POS)',
      'نسخ احتياطي فوري وسحابي متواصل لحماية البيانات'
    ],
    aiFeatureTitle: 'مسح فواتير الشراء بالرؤية الحاسوبية (Smart Receipt OCR)',
    aiFeatureDescription: 'التقاط صور فواتير الموردين الورقية واستخراج الأصناف، الكميات، والأسعار تلقائياً بدون إدخال يدوي.',
    aiBadgeAr: 'ذكاء اصطناعي أساسي: OCR الفواتير'
  },
  Pro: {
    id: 'Pro',
    nameAr: 'الباقة المتوسطة',
    nameEn: 'Pro',
    badgeAr: 'الخيار الأكثر طلباً للشركات وتجار التجزئة',
    isPopular: true,
    pricing: {
      monthlyUsd: 79,
      yearlyUsd: 790,
      monthlyIqd: 37000,
      yearlyIqd: 370000
    },
    quotas: {
      branches: 3,
      warehouses: 3,
      users: 10
    },
    operationalFeatures: [
      'كافة ميزات الباقة الأساسية بالكامل',
      'أوامر المناقلة بين الفروع وتتبع الشحنات في الطريق',
      'الجرد المخزني الفعلي وتسوية الفروقات والتوالف آلياً',
      'التسعير الثلاثي للأصناف وحماية هامش الربح الأدنى',
      'تقارير الأرباح اللحظية وطريقة تقييم المخزون (FIFO)',
      'تنبيهات المخزون الحرج وتواريخ الصلاحية للأصناف',
      'نسخ احتياطي فوري وسحابي متواصل لحماية البيانات'
    ],
    aiFeatureTitle: 'التنبؤ بنفاد المخزون ورادار البضاعة الراكدة',
    aiFeatureDescription: 'خوارزمية ذكية تحلل معدل السحب لآخر 30 يوماً وتحدد تواريخ نفاد البضاعة، مع رادار كشف رأس المال المجمد وتنبيهات ارتفاع تكاليف الموردين.',
    aiBadgeAr: 'ذكاء اصطناعي متقدم: التنبؤ والتحليل'
  },
  Enterprise: {
    id: 'Enterprise',
    nameAr: 'الباقة الفائقة',
    nameEn: 'Enterprise',
    badgeAr: 'للمؤسسات الكبرى وسلاسل الفروع والمستودعات',
    isPopular: false,
    pricing: {
      monthlyUsd: 199,
      yearlyUsd: 1990,
      monthlyIqd: 67000,
      yearlyIqd: 670000
    },
    quotas: {
      branches: 8,
      warehouses: 8,
      users: 25
    },
    operationalFeatures: [
      'كافة ميزات الباقة المتوسطة والأساسية بالكامل',
      'إدارة الرفوف والخانات والمستودعات الذكية (WMS)',
      'لوحة القيادة التنفيذية ومصفوفة مقارنة الفروع الحية للمدير العام',
      'رادار كشف التلاعب وتعديل الفواتير المطبوعة والمحذوفات',
      'الإنشاء السريع للأصناف (Inline SKU) أثناء العمليات',
      'دعم فني مخصص ذو أولوية على مدار الساعة',
      'نسخ احتياطي فوري وسحابي متواصل لحماية البيانات'
    ],
    aiFeatureTitle: 'المستشار الإداري الذكي (Executive AI Copilot)',
    aiFeatureDescription: 'مساعد ذكي للمدير التنفيذي يجيب على الأسئلة المالية والإدارية باللغة الطبيعية، مع خوارزميات التسكين المخزني الذكي ورادار كشف الأنماط الاحتيالية للكاشير.',
    aiBadgeAr: 'ذكاء اصطناعي شامل: Executive Copilot'
  }
};

export const PRICING_TIERS_LIST = Object.values(PRICING_TIERS);

export function getTierById(id: string): PricingPlanTier {
  return PRICING_TIERS[id as PlanTierId] || PRICING_TIERS.Pro;
}

/**
 * Returns formatted pricing for any tier according to selected region & billing cycle.
 */
export function getTierGeoPricing(
  tierId: PlanTierId,
  regionId: RegionId = 'GLOBAL',
  cycle: BillingCycle = 'monthly'
): {
  amount: number;
  formattedAmount: string;
  currencyCode: string;
  currencySymbol: string;
  secondaryAmount?: number;
  secondarySymbol?: string;
  isYearly: boolean;
  savingsText: string;
} {
  const region = GEO_REGIONS[regionId] || GEO_REGIONS.GLOBAL;
  const tierPrice = region.tiers[tierId];
  const isYearly = cycle === 'yearly';
  const amount = isYearly ? tierPrice.yearly : tierPrice.monthly;

  return {
    amount,
    formattedAmount: amount.toLocaleString(),
    currencyCode: region.currencyCode,
    currencySymbol: region.currencySymbolAr,
    secondaryAmount: isYearly ? tierPrice.secondaryYearly : tierPrice.secondaryMonthly,
    secondarySymbol: tierPrice.secondarySymbol,
    isYearly,
    savingsText: isYearly ? 'شهرين مجاناً (دفع سنوي)' : ''
  };
}
