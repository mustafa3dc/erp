import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../models/pos_models.dart';
import '../services/api_client.dart';
import '../services/barcode_scanner_service.dart';
import '../services/native_hardware_service.dart';

class DesktopPosScreen extends StatefulWidget {
  const DesktopPosScreen({super.key});

  @override
  State<DesktopPosScreen> createState() => _DesktopPosScreenState();
}

class _DesktopPosScreenState extends State<DesktopPosScreen> {
  final ApiClient _api = ApiClient();
  final NativeHardwareService _hardware = NativeHardwareService();
  final BarcodeScannerService _scanner = BarcodeScannerService();

  List<ProductItem> _allProducts = [];
  List<ProductItem> _filteredProducts = [];
  final List<CartItemModel> _cart = [];
  final List<ParkedInvoice> _parkedInvoices = [];

  String _selectedCategory = 'الكل';
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  bool _isLoading = true;
  String _cashierName = 'أحمد علي (كاشير 1)';
  double _usdRate = 1520.0;

  @override
  void initState() {
    super.initState();
    _loadProducts();
    _scanner.addListener(_onBarcodeScanned);
  }

  @override
  void dispose() {
    _scanner.removeListener(_onBarcodeScanned);
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    setState(() => _isLoading = true);
    final products = await _api.getProducts();
    setState(() {
      _allProducts = products;
      _filteredProducts = products;
      _isLoading = false;
    });
  }

  void _onBarcodeScanned(String barcode) {
    final matches = _allProducts.where((p) => p.barcode == barcode).toList();
    if (matches.isNotEmpty) {
      _addToCart(matches.first);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('تمت إضافة: ${matches.first.nameAr}'),
          duration: const Duration(seconds: 1),
          backgroundColor: Colors.green.shade800,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('الباركود غير معرف: $barcode'),
          backgroundColor: Colors.red.shade800,
        ),
      );
    }
  }

  void _filterProducts(String query) {
    setState(() {
      _filteredProducts = _allProducts.where((p) {
        final matchesQuery = query.isEmpty ||
            p.nameAr.contains(query) ||
            p.nameEn.toLowerCase().contains(query.toLowerCase()) ||
            p.sku.toLowerCase().contains(query.toLowerCase()) ||
            p.barcode.contains(query);
        final matchesCategory = _selectedCategory == 'الكل' || p.category == _selectedCategory;
        return matchesQuery && matchesCategory;
      }).toList();
    });
  }

  void _selectCategory(String cat) {
    setState(() {
      _selectedCategory = cat;
      _filterProducts(_searchController.text);
    });
  }

  void _addToCart(ProductItem p) {
    setState(() {
      final existingIndex = _cart.indexWhere((it) => it.product.id == p.id);
      if (existingIndex >= 0) {
        _cart[existingIndex].quantity += 1.0;
      } else {
        _cart.add(CartItemModel(product: p, unitPrice: p.sellingPrice));
      }
    });
  }

  void _updateQuantity(int index, double delta) {
    setState(() {
      final newQty = _cart[index].quantity + delta;
      if (newQty <= 0) {
        _cart.removeAt(index);
      } else {
        _cart[index].quantity = newQty;
      }
    });
  }

  // Iraqi Cash Rounding: Cash grand totals must strictly round to nearest 250 IQD
  double get _subtotal => _cart.fold(0.0, (sum, it) => sum + it.totalPrice);
  double get _rawGrandTotal => _subtotal;
  double get _roundedIqdTotal => (_rawGrandTotal / 250).round() * 250.0;
  double get _parallelUsdTotal => _roundedIqdTotal > 0 ? (_roundedIqdTotal / _usdRate) : 0.0;

  // Desktop Keyboard Shortcuts Handlers
  void _handleF1QuickSearch() {
    _searchFocusNode.requestFocus();
    _searchController.selection = TextSelection(
      baseOffset: 0,
      extentOffset: _searchController.text.length,
    );
  }

  void _handleF5QuickCashCheckout() {
    if (_cart.isEmpty) {
      _showWarning('السلة فارغة! يرجى إضافة أصناف أولاً.');
      return;
    }
    _processCheckout('CASH');
  }

  void _handleF12ParkInvoice() {
    if (_cart.isEmpty) return;
    setState(() {
      final orderNum = 'PARK-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
      _parkedInvoices.add(ParkedInvoice(
        id: orderNum,
        label: 'فاتورة معلقة #$orderNum (${_cart.length} أصناف)',
        parkedAt: DateTime.now(),
        items: List.from(_cart),
      ));
      _cart.clear();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('تم تعليق الفاتورة بنجاح. يمكنك استرجاعها من الشريط العلوي.'),
        backgroundColor: Colors.amber,
      ),
    );
  }

  void _restoreParkedInvoice(ParkedInvoice parked) {
    setState(() {
      _cart.addAll(parked.items);
      _parkedInvoices.remove(parked);
    });
  }

  Future<void> _processCheckout(String method) async {
    final invoiceNumber = 'INV-${DateTime.now().millisecondsSinceEpoch.toString().substring(6)}';
    final currentItems = List<CartItemModel>.from(_cart);
    final total = _roundedIqdTotal;

    final salePayload = {
      'invoiceNumber': invoiceNumber,
      'cashierName': _cashierName,
      'paymentMethod': method,
      'total': total,
      'subtotal': _subtotal,
      'currency': 'د.ع',
      'items': currentItems.map((it) => {
        'productId': it.product.id,
        'name': it.product.nameAr,
        'quantity': it.quantity,
        'unitPrice': it.unitPrice,
        'totalPrice': it.totalPrice,
      }).toList(),
      'timestamp': DateTime.now().toIso8601String(),
    };

    // 1. Send to Backend
    final res = await _api.checkoutSale(salePayload);

    // 2. Silent Hardware Printing & Drawer Kick
    await _hardware.printReceiptSilent(
      invoiceNumber: invoiceNumber,
      cashierName: _cashierName,
      items: currentItems,
      grandTotal: total,
      paymentMethod: method,
      openDrawer: method == 'CASH',
      cutPaper: true,
      currency: 'د.ع',
    );

    // 3. Reset Cart
    setState(() {
      _cart.clear();
    });

    _showSuccessDialog(invoiceNumber, total, method);
  }

  void _showSuccessDialog(String invoiceNum, double total, String method) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.greenAccent, size: 28),
            SizedBox(width: 8),
            Text('تم إتمام البيع بنجاح!', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('رقم الفاتورة: #$invoiceNum', style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 6),
            Text('المبلغ الصافي: ${NumberFormat("#,##0", "ar").format(total)} د.ع', 
              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Text('طريقة الدفع: $method • تمت الطباعة الصامتة وفتح الدرج', style: const TextStyle(color: Colors.white60, fontSize: 12)),
          ],
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('موافق (Enter)', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showWarning(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.orange.shade800),
    );
  }

  @override
  Widget build(BuildContext context) {
    final categories = ['الكل', 'مواد غذائية', 'مشروبات', 'معلبات', 'ألبان'];

    // Desktop Hotkeys Wrapper (Shortcuts & Actions)
    return Shortcuts(
      shortcuts: <LogicalKeySet, Intent>{
        LogicalKeySet(LogicalKeyboardKey.f1): const _QuickSearchIntent(),
        LogicalKeySet(LogicalKeyboardKey.f5): const _QuickCashIntent(),
        LogicalKeySet(LogicalKeyboardKey.f12): const _ParkInvoiceIntent(),
      },
      child: Actions(
        actions: <Type, Action<Intent>>{
          _QuickSearchIntent: CallbackAction<_QuickSearchIntent>(onInvoke: (i) => _handleF1QuickSearch()),
          _QuickCashIntent: CallbackAction<_QuickCashIntent>(onInvoke: (i) => _handleF5QuickCashCheckout()),
          _ParkInvoiceIntent: CallbackAction<_ParkInvoiceIntent>(onInvoke: (i) => _handleF12ParkInvoice()),
        },
        child: Focus(
          autofocus: true,
          child: Scaffold(
            backgroundColor: const Color(0xFF0F172A),
            body: Directionality(
              textDirection: TextDirection.rtl,
              child: Row(
                children: [
                  // 1. Right Pane: Products Catalog & Categories Grid (62% Width)
                  Expanded(
                    flex: 62,
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Search Bar + Shortcut Hint
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _searchController,
                                  focusNode: _searchFocusNode,
                                  onChanged: _filterProducts,
                                  style: const TextStyle(color: Colors.white),
                                  decoration: InputDecoration(
                                    hintText: 'البحث عن صنف بالاسم أو مسح الباركود مباشرة [F1]...',
                                    hintStyle: const TextStyle(color: Colors.white38),
                                    prefixIcon: const Icon(Icons.search, color: Color(0xFF38BDF8)),
                                    suffixIcon: _searchController.text.isNotEmpty
                                        ? IconButton(
                                            icon: const Icon(Icons.clear, color: Colors.white38),
                                            onPressed: () {
                                              _searchController.clear();
                                              _filterProducts('');
                                            },
                                          )
                                        : const Padding(
                                            padding: EdgeInsets.all(10),
                                            child: Text('[F1]', style: TextStyle(color: Colors.white38, fontSize: 11)),
                                          ),
                                    filled: true,
                                    fillColor: const Color(0xFF1E293B),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(color: Color(0xFF334155)),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              // Hardware Scanner Status Icon
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1E293B),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF334155)),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(Icons.qr_code_scanner, color: Color(0xFF38BDF8), size: 20),
                                    SizedBox(width: 6),
                                    Text('الماسح نشط', style: TextStyle(color: Colors.white70, fontSize: 12)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),

                          // Category Filter Pills
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: categories.map((cat) {
                                final isSelected = _selectedCategory == cat;
                                return Padding(
                                  padding: const EdgeInsets.only(left: 8),
                                  child: ChoiceChip(
                                    label: Text(cat),
                                    selected: isSelected,
                                    onSelected: (_) => _selectCategory(cat),
                                    selectedColor: const Color(0xFF2563EB),
                                    backgroundColor: const Color(0xFF1E293B),
                                    labelStyle: TextStyle(
                                      color: isSelected ? Colors.white : Colors.white70,
                                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Products Grid
                          Expanded(
                            child: _isLoading
                                ? const Center(child: CircularProgressIndicator())
                                : _filteredProducts.isEmpty
                                    ? const Center(child: Text('لا توجد أصناف مطابقة للبحث', style: TextStyle(color: Colors.white38)))
                                    : GridView.builder(
                                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                          crossAxisCount: 3,
                                          childAspectRatio: 1.25,
                                          crossAxisSpacing: 12,
                                          mainAxisSpacing: 12,
                                        ),
                                        itemCount: _filteredProducts.length,
                                        itemBuilder: (context, index) {
                                          final p = _filteredProducts[index];
                                          return _buildProductCard(p);
                                        },
                                      ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Divider
                  Container(width: 1, color: const Color(0xFF334155)),

                  // 2. Left Pane: Active Cart & Tender Summary (38% Width)
                  Expanded(
                    flex: 38,
                    child: Container(
                      color: const Color(0xFF111827),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Cart Header + Parked Invoices Badge
                          Row(
                            mainAxisAlignment: MainAxisAlignment.between,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.shopping_cart_outlined, color: Color(0xFF38BDF8), size: 22),
                                  SizedBox(width: 8),
                                  Text('سلة البيع المباشرة', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                                ],
                              ),
                              if (_parkedInvoices.isNotEmpty)
                                ActionChip(
                                  avatar: const Icon(Icons.pause_circle_outline, color: Colors.amber, size: 16),
                                  label: Text('معلقة (${_parkedInvoices.length})', style: const TextStyle(color: Colors.amber, fontSize: 11)),
                                  backgroundColor: Colors.amber.withOpacity(0.15),
                                  onPressed: () => _restoreParkedInvoice(_parkedInvoices.last),
                                ),
                            ],
                          ),
                          const SizedBox(height: 12),

                          // Cart Items List
                          Expanded(
                            child: _cart.isEmpty
                                ? Center(
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.remove_shopping_cart, size: 48, color: Colors.white.withOpacity(0.2)),
                                        const SizedBox(height: 12),
                                        const Text('السلة فارغة', style: TextStyle(color: Colors.white38)),
                                        const SizedBox(height: 4),
                                        const Text('امسح الباركود أو اختر صنفاً للإضافة', style: TextStyle(color: Colors.white24, fontSize: 11)),
                                      ],
                                    ),
                                  )
                                : ListView.separated(
                                    itemCount: _cart.length,
                                    separatorBuilder: (_, __) => const Divider(color: Color(0xFF1F2937), height: 1),
                                    itemBuilder: (context, index) {
                                      final item = _cart[index];
                                      return ListTile(
                                        contentPadding: EdgeInsets.zero,
                                        title: Text(item.product.nameAr, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                                        subtitle: Text(
                                          '${NumberFormat("#,##0", "ar").format(item.unitPrice)} د.ع × ${item.quantity.toStringAsFixed(item.product.isWeighted ? 3 : 0)}',
                                          style: const TextStyle(color: Colors.white54, fontSize: 11),
                                        ),
                                        trailing: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            IconButton(
                                              icon: const Icon(Icons.remove_circle_outline, color: Colors.redAccent, size: 18),
                                              onPressed: () => _updateQuantity(index, -1.0),
                                            ),
                                            Text(
                                              item.quantity.toStringAsFixed(item.product.isWeighted ? 3 : 0),
                                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.add_circle_outline, color: Colors.greenAccent, size: 18),
                                              onPressed: () => _updateQuantity(index, 1.0),
                                            ),
                                            const SizedBox(width: 8),
                                            Text(
                                              '${NumberFormat("#,##0", "ar").format(item.totalPrice)} د.ع',
                                              style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 12),
                                            ),
                                          ],
                                        ),
                                      );
                                    },
                                  ),
                          ),

                          // Summary Card
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E293B),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFF334155)),
                            ),
                            child: Column(
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.between,
                                  children: [
                                    const Text('المجموع الفرعي:', style: TextStyle(color: Colors.white70, fontSize: 12)),
                                    Text('${NumberFormat("#,##0", "ar").format(_subtotal)} د.ع', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                const Divider(color: Color(0xFF334155), height: 1),
                                const SizedBox(height: 6),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.between,
                                  children: [
                                    const Text('الصافي بالدينار (أقرب 250):', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                                    Text(
                                      '${NumberFormat("#,##0", "ar").format(_roundedIqdTotal)} د.ع',
                                      style: const TextStyle(color: Color(0xFF34D399), fontWeight: FontWeight.w900, fontSize: 20),
                                    ),
                                  ],
                                ),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    Text(
                                      '≈ \$${_parallelUsdTotal.toStringAsFixed(2)}',
                                      style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Tender Action Buttons
                          Row(
                            children: [
                              // Quick Cash Button [F5]
                              Expanded(
                                flex: 2,
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF059669),
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  onPressed: _cart.isEmpty ? null : _handleF5QuickCashCheckout,
                                  icon: const Icon(Icons.payments_outlined, color: Colors.white, size: 20),
                                  label: const Text('دفع نقدي [F5]', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                                ),
                              ),
                              const SizedBox(width: 8),
                              // Park Button [F12]
                              Expanded(
                                flex: 1,
                                child: OutlinedButton(
                                  style: OutlinedButton.styleFrom(
                                    side: const BorderSide(color: Color(0xFFEAB308)),
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  onPressed: _cart.isEmpty ? null : _handleF12ParkInvoice,
                                  child: const Text('تعليق [F12]', style: TextStyle(color: Color(0xFFEAB308), fontSize: 12, fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProductCard(ProductItem p) {
    return InkWell(
      onTap: () => _addToCart(p),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF334155)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(p.unit, style: const TextStyle(color: Colors.white60, fontSize: 9)),
                    ),
                    Text(
                      'المخزون: ${p.stock.toStringAsFixed(0)}',
                      style: TextStyle(
                        color: p.stock > 10 ? Colors.greenAccent : Colors.orangeAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  p.nameAr,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${NumberFormat("#,##0", "ar").format(p.sellingPrice)} د.ع',
                  style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.w900, fontSize: 13),
                ),
                const Icon(Icons.add_shopping_cart, color: Colors.white38, size: 16),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// Intent classes for keyboard shortcuts
class _QuickSearchIntent extends Intent {
  const _QuickSearchIntent();
}

class _QuickCashIntent extends Intent {
  const _QuickCashIntent();
}

class _ParkInvoiceIntent extends Intent {
  const _ParkInvoiceIntent();
}

