import { CompanyFeatures } from '../types/rbac';

export interface NavigationSubItem {
  name: string;
  href: string;
  requiredFeature?: keyof CompanyFeatures;
}

export interface NavigationSection {
  title: string;
  icon: string;
  requiredFeature?: keyof CompanyFeatures;
  items: NavigationSubItem[];
}

export const navigationItems: NavigationSection[] = [
  {
    title: 'نقاط البيع',
    icon: 'Zap',
    requiredFeature: 'enablePOS',
    items: [
      { name: 'شاشة البيع', href: '/pos', requiredFeature: 'enablePOS' },
      { name: 'الورديات', href: '/pos/shifts', requiredFeature: 'enablePOS' },
    ],
  },
  {
    title: 'المبيعات',
    icon: 'ShoppingCart',
    items: [
      { name: 'فواتير المبيعات', href: '/sales/invoices' },
      { name: 'عروض الأسعار', href: '/sales/quotations', requiredFeature: 'enableQuotations' },
      { name: 'تسعير الكميات والحزم', href: '/sales/price-lists', requiredFeature: 'enablePriceLists' },
      { name: 'إدارة الأقساط', href: '/sales/installments', requiredFeature: 'enableInstallments' },
      { name: 'المرتجعات', href: '/sales/returns' },
      { name: 'العملاء', href: '/sales/customers' },
    ],
  },
  {
    title: 'المشتريات',
    icon: 'Package',
    items: [
      { name: 'فواتير المشتريات', href: '/purchases/bills' },
      { name: 'مرتجعات المشتريات', href: '/purchases/returns', requiredFeature: 'enablePurchaseReturns' },
      { name: 'أوامر الشراء', href: '/purchases/orders' },
      { name: 'الموردون', href: '/purchases/suppliers' },
    ],
  },
  {
    title: 'المخزون',
    icon: 'Box',
    items: [
      { name: 'المنتجات', href: '/inventory/products' },
      { name: 'الأرقام التسلسلية والضمان', href: '/inventory/serials', requiredFeature: 'enableSerialNumbers' },
      { name: 'المناقلات المخزنية', href: '/inventory/transfers', requiredFeature: 'multiWarehouse' },
      { name: 'الجرد والتسويات', href: '/inventory/adjustments' },
      { name: 'المستودعات والرفوف', href: '/inventory/warehouses', requiredFeature: 'multiWarehouse' },
      { name: 'أوامر التجهيز والصرف', href: '/inventory/dispatch', requiredFeature: 'multiWarehouse' },
    ],
  },
  {
    title: 'الخزينة والمالية',
    icon: 'Wallet',
    items: [
      { name: 'الصناديق والبنوك', href: '/finance/accounts' },
      { name: 'المصروفات التشغيلية', href: '/finance/expenses', requiredFeature: 'enableExpenses' },
      { name: 'سندات القبض والصرف', href: '/finance/vouchers' },
    ],
  },
  {
    title: 'الإدارة والتقارير',
    icon: 'Settings',
    items: [
      { name: 'التقارير', href: '/reports' },
      { name: 'المستخدمون والصلاحيات', href: '/admin/users' },
      { name: 'سجل التدقيق والرقابة', href: '/admin/audit-logs' },
      { name: 'الإعدادات العامة', href: '/admin/settings' },
    ],
  },
];
