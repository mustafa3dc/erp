import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import '../models/pos_models.dart';

/// Pure Native Hardware Service for Windows POS.
/// Direct ESC/POS printing over Raw TCP/IP Socket (Port 9100) and Cash Drawer Kick.
/// ZERO Windows Print Preview Dialogues.
class NativeHardwareService {
  static final NativeHardwareService _instance = NativeHardwareService._internal();
  factory NativeHardwareService() => _instance;
  NativeHardwareService._internal();

  // ESC/POS Command Constants
  static const List<int> escInit = [0x1B, 0x40];
  static const List<int> escAlignCenter = [0x1B, 0x61, 0x01];
  static const List<int> escAlignLeft = [0x1B, 0x61, 0x00];
  static const List<int> escAlignRight = [0x1B, 0x61, 0x02];
  static const List<int> escBoldOn = [0x1B, 0x45, 0x01];
  static const List<int> escBoldOff = [0x1B, 0x45, 0x00];
  static const List<int> escDoubleSize = [0x1D, 0x21, 0x11];
  static const List<int> escNormalSize = [0x1D, 0x21, 0x00];
  static const List<int> escCutPaper = [0x1D, 0x56, 0x00]; // GS V 0 (Full Cut)
  static const List<int> escKickDrawer = [0x1B, 0x70, 0x00, 0x19, 0xFA]; // ESC p 0 25 250
  static const List<int> escFeed3Lines = [0x1B, 0x64, 0x03];

  String printerIp = '127.0.0.1';
  int printerPort = 9100;

  /// Sends the electronic pulse to immediately pop open the cash drawer.
  Future<bool> kickCashDrawer({String? targetIp, int? targetPort}) async {
    final ip = targetIp ?? printerIp;
    final port = targetPort ?? printerPort;

    try {
      final socket = await Socket.connect(ip, port, timeout: const Duration(seconds: 2));
      socket.add(Uint8List.fromList(escKickDrawer));
      await socket.flush();
      await socket.close();
      return true;
    } catch (e) {
      print('[Hardware] Drawer kick over socket failed: $e');
      return false;
    }
  }

  /// Silently prints a receipt to the ESC/POS thermal printer.
  Future<bool> printReceiptSilent({
    required String invoiceNumber,
    required String cashierName,
    required List<CartItemModel> items,
    required double grandTotal,
    required String paymentMethod,
    bool openDrawer = true,
    bool cutPaper = true,
    String storeName = 'ZiloX Store',
    String? storePhone,
    String currency = 'د.ع',
  }) async {
    final bytes = <int>[];

    // 1. Initialize
    bytes.addAll(escInit);

    // 2. Header
    bytes.addAll(escAlignCenter);
    bytes.addAll(escBoldOn);
    bytes.addAll(escDoubleSize);
    bytes.addAll(utf8.encode('$storeName\n'));
    bytes.addAll(escNormalSize);
    bytes.addAll(escBoldOff);

    if (storePhone != null && storePhone.isNotEmpty) {
      bytes.addAll(utf8.encode('هاتف: $storePhone\n'));
    }
    bytes.addAll(utf8.encode('================================\n'));

    // 3. Metadata
    bytes.addAll(escAlignLeft);
    bytes.addAll(utf8.encode('رقم الفاتورة: #$invoiceNumber\n'));
    bytes.addAll(utf8.encode('التاريخ: ${DateTime.now().toString().split('.')[0]}\n'));
    bytes.addAll(utf8.encode('الكاشير: $cashierName\n'));
    bytes.addAll(utf8.encode('الدفع: $paymentMethod\n'));
    bytes.addAll(utf8.encode('--------------------------------\n'));

    // 4. Items Table
    bytes.addAll(escBoldOn);
    bytes.addAll(utf8.encode('الصنف              الكمية   السعر\n'));
    bytes.addAll(escBoldOff);
    bytes.addAll(utf8.encode('--------------------------------\n'));

    for (final it in items) {
      final name = it.product.nameAr.length > 16 
          ? it.product.nameAr.substring(0, 16) 
          : it.product.nameAr;
      final qty = it.quantity.toStringAsFixed(it.product.isWeighted ? 3 : 0);
      final total = it.totalPrice.toStringAsFixed(0);

      bytes.addAll(utf8.encode('$name\n'));
      bytes.addAll(utf8.encode('  $qty × ${it.unitPrice.toStringAsFixed(0)} = $total $currency\n'));
    }

    bytes.addAll(utf8.encode('================================\n'));

    // 5. Total
    bytes.addAll(escAlignRight);
    bytes.addAll(escBoldOn);
    bytes.addAll(escDoubleSize);
    bytes.addAll(utf8.encode('الصافي: ${grandTotal.toStringAsFixed(0)} $currency\n'));
    bytes.addAll(escNormalSize);
    bytes.addAll(escBoldOff);
    bytes.addAll(utf8.encode('--------------------------------\n'));

    // 6. Footer
    bytes.addAll(escAlignCenter);
    bytes.addAll(utf8.encode('شكراً لتسوقكم معنا • ZiloX ERP\n'));
    bytes.addAll(escFeed3Lines);

    // 7. Auto Cut
    if (cutPaper) {
      bytes.addAll(escCutPaper);
    }

    // 8. Send to Printer Socket
    try {
      final socket = await Socket.connect(printerIp, printerPort, timeout: const Duration(seconds: 3));
      socket.add(Uint8List.fromList(bytes));
      await socket.flush();
      await socket.close();

      if (openDrawer && paymentMethod.toUpperCase().contains('CASH')) {
        await kickCashDrawer();
      }
      return true;
    } catch (e) {
      print('[Hardware] Silent ESC/POS printing error: $e');
      return false;
    }
  }
}

