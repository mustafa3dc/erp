/// Model representation for Blind Discount Engine in Flutter POS.
/// Strictly masks cost_price and internal profit margins.

enum DiscountType {
  percent,
  fixed,
}

class PosCartItem {
  final String id;
  final String sku;
  final String name;
  final double retailPrice; // Strictly Retail Price (Never Cost)
  int quantity;
  DiscountType discountType;
  double discountValue;
  String? managerOverrideToken;
  String? approvedByManagerId;
  String? approvedByManagerName;

  PosCartItem({
    required this.id,
    required this.sku,
    required this.name,
    required this.retailPrice,
    this.quantity = 1,
    this.discountType = DiscountType.percent,
    this.discountValue = 0.0,
    this.managerOverrideToken,
    this.approvedByManagerId,
    this.approvedByManagerName,
  });

  double get discountAmountPerUnit {
    if (discountValue <= 0) return 0.0;
    if (discountType == DiscountType.fixed) {
      return discountValue;
    }
    return (retailPrice * (discountValue / 100.0));
  }

  double get finalUnitPrice {
    final discounted = retailPrice - discountAmountPerUnit;
    return discounted > 0 ? discounted : 0.0;
  }

  double get lineTotal {
    return finalUnitPrice * quantity;
  }

  bool get isOverridden => managerOverrideToken != null;

  Map<String, dynamic> toApiJson() {
    return {
      'productId': id,
      'quantity': quantity,
      'discountType': discountType == DiscountType.percent ? 'PERCENT' : 'FIXED',
      'discountValue': discountValue,
      'managerOverridePin': managerOverrideToken,
      'approvedByManagerId': approvedByManagerId,
    };
  }
}

class ManagerOverrideResult {
  final bool success;
  final String managerId;
  final String managerName;
  final String token;

  ManagerOverrideResult({
    required this.success,
    required this.managerId,
    required this.managerName,
    required this.token,
  });
}
