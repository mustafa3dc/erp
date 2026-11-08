// Pure Language Localization Helpers - Strict Separation of English and Arabic

export interface ProductLike {
  id?: string;
  sku: string;
  barcode?: string;
  nameAr: string;
  nameEn: string;
  category?: string;
  unit?: string;
  warehouseName?: string;
}

// Category Dictionary (Bidirectional)
const CATEGORY_MAP: Record<string, { ar: string; en: string }> = {
  'إلكترونيات وشاشات': { ar: 'إلكترونيات وشاشات', en: 'Electronics & Displays' },
  'Electronics & Displays': { ar: 'إلكترونيات وشاشات', en: 'Electronics & Displays' },
  'أجهزة حاسوب ومحمول': { ar: 'أجهزة حاسوب ومحمول', en: 'Computers & Laptops' },
  'Computers & Laptops': { ar: 'أجهزة حاسوب ومحمول', en: 'Computers & Laptops' },
  'طابعات وتجهيزات مكتبية': { ar: 'طابعات وتجهيزات مكتبية', en: 'Printers & Office Supplies' },
  'Printers & Office Supplies': { ar: 'طابعات وتجهيزات مكتبية', en: 'Printers & Office Supplies' },
  'شبكات وتمديدات': { ar: 'شبكات وتمديدات', en: 'Networking & Cables' },
  'Networking & Cables': { ar: 'شبكات وتمديدات', en: 'Networking & Cables' },
  'ملحقات وإكسسوارات': { ar: 'ملحقات وإكسسوارات', en: 'Accessories & Peripherals' },
  'Accessories & Peripherals': { ar: 'ملحقات وإكسسوارات', en: 'Accessories & Peripherals' },
  'طاقة وحماية كهربائية': { ar: 'طاقة وحماية كهربائية', en: 'Power & UPS' },
  'Power & UPS': { ar: 'طاقة وحماية كهربائية', en: 'Power & UPS' },
  'خوادم وسيرفرات': { ar: 'خوادم وسيرفرات', en: 'Servers & Storage' },
  'Servers & Storage': { ar: 'خوادم وسيرفرات', en: 'Servers & Storage' },
  'أنظمة مراقبة وأمان': { ar: 'أنظمة مراقبة وأمان', en: 'Security & Surveillance' },
  'Security & Surveillance': { ar: 'أنظمة مراقبة وأمان', en: 'Security & Surveillance' }
};

// Warehouse Names Dictionary (Bidirectional)
const WAREHOUSE_MAP: Record<string, { ar: string; en: string }> = {
  'WH-01': { ar: 'المستودع الرئيسي', en: 'Main Warehouse' },
  'المستودع الرئيسي': { ar: 'المستودع الرئيسي', en: 'Main Warehouse' },
  'Main Warehouse': { ar: 'المستودع الرئيسي', en: 'Main Warehouse' },
  'nadx': { ar: 'مستودع نادكس المركزي', en: 'Nadx Central Warehouse' },
  'NADX': { ar: 'مستودع نادكس المركزي', en: 'Nadx Central Warehouse' },
  
  'WH-02': { ar: 'مستودع التوزيع الإقليمي', en: 'Regional Distribution Hub' },
  'مستودع التوزيع الإقليمي': { ar: 'مستودع التوزيع الإقليمي', en: 'Regional Distribution Hub' },
  'Regional Distribution Hub': { ar: 'مستودع التوزيع الإقليمي', en: 'Regional Distribution Hub' },
  'مستودع الكرادة - التوزيع السريع': { ar: 'مستودع التوزيع الإقليمي', en: 'Regional Distribution Hub' },
  'مستودع الكرادة': { ar: 'مستودع التوزيع الإقليمي', en: 'Regional Distribution Hub' },
  'Karrada Fast Distribution Hub': { ar: 'مستودع التوزيع الإقليمي', en: 'Regional Distribution Hub' },
  'Karrada Distribution Hub': { ar: 'مستودع التوزيع الإقليمي', en: 'Regional Distribution Hub' },
  'Cold Storage Hub (Mansour)': { ar: 'مستودع التبريد المركزي', en: 'Cold Storage Central Hub' },
  
  'WH-03': { ar: 'مستودع البصرة', en: 'Basra Port Regional Hub' },
  'مستودع البصرة - الميناء والجنوب': { ar: 'مستودع البصرة', en: 'Basra Port Regional Hub' },
  'مستودع البصرة': { ar: 'مستودع البصرة', en: 'Basra Port Regional Hub' },
  'Basra Port Regional Warehouse': { ar: 'مستودع البصرة', en: 'Basra Port Regional Hub' },
  'Basra Port Regional Hub': { ar: 'مستودع البصرة', en: 'Basra Port Regional Hub' },
  'Transit Zone & Port (Basra)': { ar: 'منطقة الترانزيت - البصرة', en: 'Transit Zone & Port - Basra' },
  
  'WH-04': { ar: 'مستودع أربيل', en: 'Erbil Northern Gateway' },
  'مستودع أربيل - الإقليم والشمال': { ar: 'مستودع أربيل', en: 'Erbil Northern Gateway' },
  'مستودع أربيل': { ar: 'مستودع أربيل', en: 'Erbil Northern Gateway' },
  'Erbil Northern Gateway Depot': { ar: 'مستودع أربيل', en: 'Erbil Northern Gateway' },
  'Erbil Northern Gateway': { ar: 'مستودع أربيل', en: 'Erbil Northern Gateway' }
};

// Unit Dictionary (Clean, No Mixed Slashes)
const UNIT_MAP: Record<string, { ar: string; en: string }> = {
  'قطعة': { ar: 'قطعة', en: 'Piece' },
  'قطعة (Piece)': { ar: 'قطعة', en: 'Piece' },
  'Piece': { ar: 'قطعة', en: 'Piece' },
  'Pieces': { ar: 'قطعة', en: 'Pieces' },
  'Pcs': { ar: 'قطعة', en: 'Pcs' },
  'جهاز': { ar: 'جهاز', en: 'Unit' },
  'جهاز (Device)': { ar: 'جهاز', en: 'Device' },
  'جهاز (Unit)': { ar: 'جهاز', en: 'Unit' },
  'Unit': { ar: 'جهاز', en: 'Unit' },
  'Units': { ar: 'جهاز', en: 'Units' },
  'Device': { ar: 'جهاز', en: 'Device' },
  'طابعة': { ar: 'طابعة', en: 'Unit' },
  'طابعة (Unit)': { ar: 'طابعة', en: 'Unit' },
  'بكرة': { ar: 'بكرة', en: 'Roll' },
  'بكرة (Roll)': { ar: 'بكرة', en: 'Roll' },
  'Roll': { ar: 'بكرة', en: 'Roll' },
  'صندوق': { ar: 'صندوق', en: 'Box' },
  'صندوق (Box)': { ar: 'صندوق', en: 'Box' },
  'Box': { ar: 'صندوق', en: 'Box' },
  'طرد': { ar: 'طرد', en: 'Package' },
  'طرد (Package)': { ar: 'طرد', en: 'Package' },
  'طرد مبيعات': { ar: 'طرد', en: 'Package' },
  'Order Pkg': { ar: 'طرد', en: 'Package' },
  'Package': { ar: 'طرد', en: 'Package' },
  'متر': { ar: 'متر', en: 'Meter' },
  'Meter': { ar: 'متر', en: 'Meter' },
  'كيلوغرام': { ar: 'كجم', en: 'Kg' },
  'Kg': { ar: 'كجم', en: 'Kg' }
};

// Localize Category
export function localizeCategory(cat: string | undefined, lang: 'ar' | 'en'): string {
  if (!cat) return lang === 'ar' ? 'عام' : 'General';
  const entry = CATEGORY_MAP[cat];
  if (entry) return entry[lang];
  return cat;
}

// Warehouse Name: Strict bilingual localization based on WAREHOUSE_MAP
export function localizeWarehouse(wh: string | undefined, lang: 'ar' | 'en' = 'en'): string {
  if (!wh || !wh.trim()) return lang === 'ar' ? 'المستودع الرئيسي' : 'Main Warehouse';
  const trimmed = wh.trim();
  const entry = WAREHOUSE_MAP[trimmed];
  if (entry) return entry[lang];
  for (const [key, val] of Object.entries(WAREHOUSE_MAP)) {
    if (trimmed.includes(key)) {
      return val[lang];
    }
  }
  return trimmed;
}

// Localize Unit
export function localizeUnit(u: string | undefined, lang: 'ar' | 'en'): string {
  if (!u) return lang === 'ar' ? 'وحدة' : 'Unit';
  const entry = UNIT_MAP[u];
  if (entry) return entry[lang];
  // Strip parenthetical text like " (Piece)" or " (قطعة)"
  if (lang === 'en') {
    const enMatch = u.match(/\b([A-Za-z]+)\b/);
    if (enMatch) return enMatch[1];
    return 'Unit';
  } else {
    const arMatch = u.match(/([\u0600-\u06FF]+)/);
    if (arMatch) return arMatch[1];
    return 'وحدة';
  }
}

// Localize City
export function localizeCity(city: string | undefined, lang: 'ar' | 'en'): string {
  if (!city) return '';
  if (city.includes('بغداد') || city.toLowerCase().includes('baghdad')) {
    return lang === 'ar' ? 'بغداد' : 'Baghdad';
  }
  if (city.includes('بصرة') || city.toLowerCase().includes('basra')) {
    return lang === 'ar' ? 'البصرة' : 'Basra';
  }
  if (city.includes('أربيل') || city.toLowerCase().includes('erbil')) {
    return lang === 'ar' ? 'أربيل' : 'Erbil';
  }
  return city;
}

// Localize Transaction Type (Strict Single Language)
export function localizeTxType(type: string | undefined, lang: 'ar' | 'en'): string {
  const t = (type || '').toLowerCase();
  if (t === 'inbound' || t === 'in' || t === 'receipt') return lang === 'ar' ? 'وارد' : 'Inbound';
  if (t === 'outbound' || t === 'out' || t === 'dispatch') return lang === 'ar' ? 'صادر' : 'Outbound';
  if (t === 'transfer') return lang === 'ar' ? 'تحويل' : 'Transfer';
  if (t === 'adjustment') return lang === 'ar' ? 'تسوية' : 'Adjustment';
  if (t === 'pending') return lang === 'ar' ? 'قيد التدقيق' : 'Pending';
  return type || '';
}

// Localize Transaction Status (Strict Single Language)
export function localizeTxStatus(status: string | undefined, lang: 'ar' | 'en'): string {
  const s = (status || '').toLowerCase();
  if (s === 'received' || s === 'completed') return lang === 'ar' ? 'مكتمل' : 'Received';
  if (s === 'pending') return lang === 'ar' ? 'قيد التدقيق' : 'Pending';
  if (s === 'cancelled') return lang === 'ar' ? 'ملغي' : 'Cancelled';
  if (s === 'in transit') return lang === 'ar' ? 'في الطريق' : 'In Transit';
  return status || '';
}

// Localize Product Inventory Status
export function localizeStockStatus(status: string, currentStock: number, minStockAlert: number, lang: 'ar' | 'en'): {
  label: string;
  className: string;
} {
  const isAr = lang === 'ar';
  if (currentStock <= 0) {
    return { label: isAr ? 'نافد' : 'Out of Stock', className: 'status-danger' };
  }
  if (currentStock <= minStockAlert) {
    return { label: isAr ? 'قرب النفاد' : 'Low Stock', className: 'status-pending' };
  }
  return { label: isAr ? 'متوفر' : 'Available', className: 'status-active' };
}
