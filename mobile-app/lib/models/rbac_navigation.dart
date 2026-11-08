/// Role-Based Access Control (RBAC) and Dynamic Navigation Models for Flutter
/// Defines permission keys, roles, and schema-driven navigation with route guarding.

enum AppUserRole {
  cashier,
  storekeeper,
  accountant,
  branchManager,
  superAdmin,
}

class AppPermissions {
  // Dashboard
  static const String dashboardView = 'dashboard.view';

  // Inventory & Catalog
  static const String inventoryView = 'inventory.view';
  static const String inventoryManage = 'inventory.manage';
  static const String inventoryCostPriceView = 'inventory.cost_price.view';

  // Transfers & Logistics
  static const String transfersManage = 'transfers.manage';
  static const String stockCountsManage = 'stock_counts.manage';
  static const String logisticsDispatch = 'logistics.dispatch';
  static const String purchasesManage = 'purchases.manage';

  // POS & Sales
  static const String posTerminalAccess = 'pos.terminal.access';
  static const String shiftsManage = 'shifts.manage';
  static const String invoicesManage = 'invoices.manage';
  static const String returnsManage = 'returns.manage';

  // Finance
  static const String financeLedger = 'finance.ledger';
  static const String customersManage = 'customers.manage';

  // System & Reports
  static const String reportsExecutive = 'reports.executive';
  static const String settingsAudit = 'settings.audit';
}

class FlutterNavItem {
  final String id;
  final String title;
  final String path;
  final String requiredPermission;
  final String? badge;

  const FlutterNavItem({
    required this.id,
    required this.title,
    required this.path,
    required this.requiredPermission,
    this.badge,
  });
}

class FlutterNavGroup {
  final String key;
  final String title;
  final List<FlutterNavItem> items;

  const FlutterNavGroup({
    required this.key,
    required this.title,
    required this.items,
  });
}

class UserProfileMobile {
  final String id;
  final String name;
  final AppUserRole role;
  final String roleNameAr;
  final String branchName;
  final Set<String> permissions;
  final String defaultRoute;
  final bool canViewCostPrice;

  UserProfileMobile({
    required this.id,
    required this.name,
    required this.role,
    required this.roleNameAr,
    required this.branchName,
    required this.permissions,
    required this.defaultRoute,
    required this.canViewCostPrice,
  });

  bool hasPermission(String perm) {
    if (role == AppUserRole.superAdmin) return true;
    return permissions.contains(perm);
  }

  bool canAccessRoute(String routePath) {
    if (role == AppUserRole.superAdmin) return true;
    if (routePath == '/dashboard') return hasPermission(AppPermissions.dashboardView);

    for (final group in MobileNavSchema.groups) {
      for (final item in group.items) {
        if (item.path == routePath) {
          return hasPermission(item.requiredPermission);
        }
      }
    }
    return false;
  }
}

class MobileNavSchema {
  static const FlutterNavItem dashboardItem = FlutterNavItem(
    id: 'dashboard',
    title: 'لوحة القيادة والمؤشرات',
    path: '/dashboard',
    requiredPermission: AppPermissions.dashboardView,
  );

  static const List<FlutterNavGroup> groups = [
    FlutterNavGroup(
      key: 'sales',
      title: 'المبيعات ونقاط البيع',
      items: [
        FlutterNavItem(
          id: 'pos',
          title: 'نقطة البيع السريعة POS',
          path: '/pos',
          requiredPermission: AppPermissions.posTerminalAccess,
          badge: 'POS',
        ),
        FlutterNavItem(
          id: 'shifts',
          title: 'الورديات وإغلاق الصندوق Z',
          path: '/shifts',
          requiredPermission: AppPermissions.shiftsManage,
          badge: 'Z',
        ),
        FlutterNavItem(
          id: 'returns',
          title: 'المرتجعات وإدارة الضمان',
          path: '/returns',
          requiredPermission: AppPermissions.returnsManage,
        ),
        FlutterNavItem(
          id: 'invoices',
          title: 'المبيعات وعروض الأسعار',
          path: '/invoices',
          requiredPermission: AppPermissions.invoicesManage,
        ),
      ],
    ),
    FlutterNavGroup(
      key: 'warehouse',
      title: 'المخازن والمستودعات',
      items: [
        FlutterNavItem(
          id: 'inventory',
          title: 'دليل الأصناف والباركود',
          path: '/inventory',
          requiredPermission: AppPermissions.inventoryView,
        ),
        FlutterNavItem(
          id: 'transfers',
          title: 'التحويلات وتتبع الطريق',
          path: '/transfers',
          requiredPermission: AppPermissions.transfersManage,
          badge: '1',
        ),
        FlutterNavItem(
          id: 'stock_counts',
          title: 'الجرد المخزني والتسويات',
          path: '/stock-counts',
          requiredPermission: AppPermissions.stockCountsManage,
        ),
      ],
    ),
    FlutterNavGroup(
      key: 'logistics',
      title: 'سلاسل الإمداد والشحن',
      items: [
        FlutterNavItem(
          id: 'delivery',
          title: 'أذونات الاستلام والشحن (GRN)',
          path: '/delivery',
          requiredPermission: AppPermissions.logisticsDispatch,
        ),
        FlutterNavItem(
          id: 'purchases',
          title: 'المشتريات وأوامر التوريد',
          path: '/purchases',
          requiredPermission: AppPermissions.purchasesManage,
        ),
      ],
    ),
    FlutterNavGroup(
      key: 'finance',
      title: 'المالية والعملاء',
      items: [
        FlutterNavItem(
          id: 'customers',
          title: 'العملاء وسجل المديونية',
          path: '/customers',
          requiredPermission: AppPermissions.customersManage,
        ),
        FlutterNavItem(
          id: 'finance',
          title: 'الخزائن وقيود اليومية',
          path: '/finance',
          requiredPermission: AppPermissions.financeLedger,
        ),
      ],
    ),
    FlutterNavGroup(
      key: 'reports',
      title: 'التقارير والإدارة',
      items: [
        FlutterNavItem(
          id: 'reports',
          title: 'تقارير الأرباح والخسائر والـ Z',
          path: '/reports',
          requiredPermission: AppPermissions.reportsExecutive,
        ),
        FlutterNavItem(
          id: 'settings',
          title: 'الإعدادات وسجل الرقابة',
          path: '/settings',
          requiredPermission: AppPermissions.settingsAudit,
        ),
      ],
    ),
  ];

  /// Filters navigation groups and removes empty categories
  static List<FlutterNavGroup> filterForUser(UserProfileMobile user) {
    final List<FlutterNavGroup> filtered = [];
    for (final group in groups) {
      final permittedItems = group.items
          .where((item) => user.hasPermission(item.requiredPermission))
          .toList();
      if (permittedItems.isNotEmpty) {
        filtered.add(FlutterNavGroup(
          key: group.key,
          title: group.title,
          items: permittedItems,
        ));
      }
    }
    return filtered;
  }
}
