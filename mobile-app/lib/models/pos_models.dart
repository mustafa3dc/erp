import 'package:decimal/decimal.dart';

class ProductItem {
  final String id;
  final String nameAr;
  final String nameEn;
  final String sku;
  final String barcode;
  final double sellingPrice;
  final double costPrice;
  final double stock;
  final String category;
  final String unit;
  final bool isWeighted;

  ProductItem({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.sku,
    required this.barcode,
    required this.sellingPrice,
    required this.costPrice,
    required this.stock,
    required this.category,
    this.unit = 'قطعة',
    this.isWeighted = false,
  });

  factory ProductItem.fromJson(Map<String, dynamic> json) {
    return ProductItem(
      id: json['id']?.toString() ?? '',
      nameAr: json['nameAr']?.toString() ?? json['name']?.toString() ?? '',
      nameEn: json['nameEn']?.toString() ?? json['name']?.toString() ?? '',
      sku: json['sku']?.toString() ?? '',
      barcode: json['barcode']?.toString() ?? '',
      sellingPrice: (json['sellingPrice'] as num?)?.toDouble() ?? (json['price'] as num?)?.toDouble() ?? 0.0,
      costPrice: (json['costPrice'] as num?)?.toDouble() ?? 0.0,
      stock: (json['stock'] as num?)?.toDouble() ?? 0.0,
      category: json['category']?.toString() ?? 'عام',
      unit: json['unit']?.toString() ?? 'قطعة',
      isWeighted: json['isWeighted'] == true || (json['unit']?.toString().contains('كغ') ?? false),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nameAr': nameAr,
      'nameEn': nameEn,
      'sku': sku,
      'barcode': barcode,
      'sellingPrice': sellingPrice,
      'costPrice': costPrice,
      'stock': stock,
      'category': category,
      'unit': unit,
      'isWeighted': isWeighted,
    };
  }
}

class CartItemModel {
  final ProductItem product;
  double quantity;
  double unitPrice;
  double discount;

  CartItemModel({
    required this.product,
    this.quantity = 1.0,
    required this.unitPrice,
    this.discount = 0.0,
  });

  double get totalPrice {
    final sub = quantity * (unitPrice - discount);
    return sub > 0 ? sub : 0;
  }
}

class ParkedInvoice {
  final String id;
  final String label;
  final DateTime parkedAt;
  final List<CartItemModel> items;

  ParkedInvoice({
    required this.id,
    required this.label,
    required this.parkedAt,
    required this.items,
  });
}

