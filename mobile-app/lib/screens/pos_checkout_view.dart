import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/blind_discount_model.dart';
import '../widgets/manager_override_dialog.dart';

class PosCheckoutController extends StateNotifier<AsyncValue<void>> {
  PosCheckoutController() : super(const AsyncValue.data(null));

  Future<bool> submitInvoice({
    required BuildContext context,
    required String cashierId,
    required List<PosCartItem> items,
    required double totalAmount,
    required String paymentMethod,
  }) async {
    state = const AsyncValue.loading();
    try {
      // Simulate API call to backend /api/pos/invoices
      await Future.delayed(const Duration(milliseconds: 600));
      
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final posCheckoutProvider = StateNotifierProvider<PosCheckoutController, AsyncValue<void>>((ref) {
  return PosCheckoutController();
});

class PosCheckoutView extends ConsumerStatefulWidget {
  const PosCheckoutView({Key? key}) : super(key: key);

  @override
  ConsumerState<PosCheckoutView> createState() => _PosCheckoutViewState();
}

class _PosCheckoutViewState extends ConsumerState<PosCheckoutView> {
  final List<PosCartItem> _cartItems = [
    PosCartItem(
      id: 'PROD-01',
      sku: 'LAP-PRO-16',
      name: 'MacBook Pro 16 M3 Max',
      retailPrice: 3499.00,
      quantity: 1,
    ),
    PosCartItem(
      id: 'PROD-02',
      sku: 'PHN-ULTRA-24',
      name: 'Samsung Galaxy S24 Ultra',
      retailPrice: 1299.00,
      quantity: 1,
    ),
    PosCartItem(
      id: 'PROD-03',
      sku: 'AUD-SONY-XM5',
      name: 'Sony WH-1000XM5 Headphones',
      retailPrice: 399.00,
      quantity: 2,
    ),
  ];

  double get _subtotal => _cartItems.fold(0.0, (sum, item) => sum + (item.retailPrice * item.quantity));
  double get _totalDiscount => _cartItems.fold(0.0, (sum, item) => sum + (item.discountAmountPerUnit * item.quantity));
  double get _tax => (_subtotal - _totalDiscount) * 0.05;
  double get _grandTotal => (_subtotal - _totalDiscount) + _tax;

  Future<void> _handleDiscountRequest(PosCartItem item, double requestedPercent) async {
    const double cashierCeiling = 5.0; // Cashier max allowed discount

    if (requestedPercent <= 0) {
      setState(() {
        item.discountType = DiscountType.percent;
        item.discountValue = 0.0;
        item.managerOverrideToken = null;
        item.approvedByManagerId = null;
        item.approvedByManagerName = null;
      });
      return;
    }

    if (requestedPercent > cashierCeiling) {
      // Exceeds cashier authority -> Pop Manager Override Dialog
      final double discountAmount = (item.retailPrice * (requestedPercent / 100.0));
      final double proposedPrice = item.retailPrice - discountAmount;

      final result = await showDialog<ManagerOverrideResult>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => ManagerOverrideDialog(
          productName: item.name,
          retailPrice: item.retailPrice,
          discountType: DiscountType.percent,
          discountValue: requestedPercent,
          proposedPrice: proposedPrice,
          maxCashierPercent: cashierCeiling,
        ),
      );

      if (result != null && result.success) {
        setState(() {
          item.discountType = DiscountType.percent;
          item.discountValue = requestedPercent;
          item.managerOverrideToken = result.token;
          item.approvedByManagerId = result.managerId;
          item.approvedByManagerName = result.managerName;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('تم اعتماد الخصم بواسطة: ${result.managerName}'),
            backgroundColor: const Color(0xFF4F46E5),
          ),
        );
      }
    } else {
      // Within cashier allowable ceiling (<= 5%)
      setState(() {
        item.discountType = DiscountType.percent;
        item.discountValue = requestedPercent;
        item.managerOverrideToken = null;
        item.approvedByManagerId = null;
        item.approvedByManagerName = null;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('تم تطبيق خصم الكاشير (%${requestedPercent.toStringAsFixed(0)}) بنجاح'),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
    }
  }

  void _showCheckoutSuccessDialog(String orderNo) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0x33FFFFFF)),
        ),
        title: Column(
          children: const [
            Icon(Icons.check_circle, color: Color(0xFF10B981), size: 48),
            SizedBox(height: 10),
            Text('تم إصدار الفاتورة واعتمادها', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('رقم الفاتورة: $orderNo', style: const TextStyle(color: Color(0xFFA5B4FC), fontFamily: 'monospace')),
            const SizedBox(height: 8),
            Text('المجموع النهائي: \$${_grandTotal.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            if (_totalDiscount > 0) ...[
              const SizedBox(height: 4),
              Text('إجمالي التخفيض: -\$${_totalDiscount.toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFFF87171))),
            ],
            const SizedBox(height: 8),
            const Text('تم توثيق كافة الخصومات في سجل الرقابة (Audit Trail)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
          ],
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF4F46E5)),
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('إغلاق وطباعة ESC/POS', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(posCheckoutProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1D),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1527),
        title: const Text('نقطة البيع السريعة (POS)'),
        centerTitle: true,
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0x1A10B981),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0x4D10B981)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(Icons.lock_outline, color: Color(0xFF10B981), size: 14),
                SizedBox(width: 4),
                Text('Cost Masked', style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      ),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          children: [
            // Items List
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _cartItems.length,
                itemBuilder: (context, index) {
                  final item = _cartItems[index];
                  final hasDiscount = item.discountValue > 0;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: item.isOverridden ? const Color(0x146366F1) : const Color(0x0AFFFFFF),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: item.isOverridden ? const Color(0x4D6366F1) : const Color(0x14FFFFFF),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                item.name,
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                            ),
                            Text(
                              '\$${item.lineTotal.toStringAsFixed(2)}',
                              style: const TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Text(
                                  '\$${item.retailPrice.toStringAsFixed(2)} × ${item.quantity}',
                                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                                ),
                                if (hasDiscount) ...[
                                  const SizedBox(width: 8),
                                  Text(
                                    '-> \$${item.finalUnitPrice.toStringAsFixed(2)}',
                                    style: const TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 12),
                                  ),
                                ],
                              ],
                            ),
                            // Discount Tag / Override status
                            if (item.isOverridden)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0x336366F1),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0x666366F1)),
                                ),
                                child: Text(
                                  'معتمد: ${item.approvedByManagerName?.split(' ')[0]} (%${item.discountValue.toStringAsFixed(0)})',
                                  style: const TextStyle(color: Color(0xFFA5B4FC), fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              )
                            else if (hasDiscount)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0x2610B981),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0x4D10B981)),
                                ),
                                child: Text(
                                  'خصم كاشير (%${item.discountValue.toStringAsFixed(0)})',
                                  style: const TextStyle(color: Color(0xFF34D399), fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        // Discount Action Presets
                        Row(
                          children: [
                            const Text('تطبيق خصم:', style: TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                            const SizedBox(width: 8),
                            _buildDiscountPill(item, '0%', 0),
                            const SizedBox(width: 6),
                            _buildDiscountPill(item, '3%', 3),
                            const SizedBox(width: 6),
                            _buildDiscountPill(item, '5%', 5),
                            const SizedBox(width: 6),
                            _buildDiscountPill(item, '10% (مدير)', 10, isOverride: true),
                            const SizedBox(width: 6),
                            _buildDiscountPill(item, '15% (مدير)', 15, isOverride: true),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Summary Bottom Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: Color(0xFF0D1527),
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                border: Border(top: BorderSide(color: Color(0x1FFFFFFF))),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('المجموع الفرعي:', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                      Text('\$${_subtotal.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 13)),
                    ],
                  ),
                  if (_totalDiscount > 0) ...[
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('إجمالي الخصم المعتمد:', style: TextStyle(color: Color(0xFFF87171), fontSize: 13, fontWeight: FontWeight.bold)),
                        Text('-\$${_totalDiscount.toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFFF87171), fontSize: 13, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('الضريبة (5%):', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                      Text('\$${_tax.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 13)),
                    ],
                  ),
                  const Divider(color: Color(0x1FFFFFFF), height: 18),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('المجموع النهائي:', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                      Text(
                        '\$${_grandTotal.toStringAsFixed(2)}',
                        style: const TextStyle(color: Color(0xFF10B981), fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4F46E5),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: state.isLoading
                          ? null
                          : () async {
                              final invoiceNo = 'INV-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
                              final success = await ref.read(posCheckoutProvider.notifier).submitInvoice(
                                context: context,
                                cashierId: 'CSH-01',
                                items: _cartItems,
                                totalAmount: _grandTotal,
                                paymentMethod: 'CASH',
                              );
                              if (success && mounted) {
                                _showCheckoutSuccessDialog(invoiceNo);
                              }
                            },
                      child: state.isLoading
                          ? const CircularProgressIndicator.adaptive(backgroundColor: Colors.white)
                          : const Text(
                              'إتمام عملية البيع وطباعة الإيصال',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDiscountPill(PosCartItem item, String label, double percent, {bool isOverride = false}) {
    final isSelected = item.discountValue == percent;
    return InkWell(
      onTap: () => _handleDiscountRequest(item, percent),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: isSelected
              ? (isOverride ? const Color(0x4DEF4444) : const Color(0x3310B981))
              : (isOverride ? const Color(0x1AEF4444) : const Color(0x0FFFFFFF)),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected
                ? (isOverride ? const Color(0xFFEF4444) : const Color(0xFF10B981))
                : (isOverride ? const Color(0x33EF4444) : const Color(0x1AFFFFFF)),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isOverride ? const Color(0xFFF87171) : (isSelected ? const Color(0xFF10B981) : const Color(0xFF94A3B8)),
            fontSize: 10,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
