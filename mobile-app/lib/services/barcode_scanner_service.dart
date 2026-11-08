import 'dart:async';
import 'package:flutter/services.dart';

typedef BarcodeCallback = void Function(String barcode);

/// Global Hardware Barcode Scanner Interceptor for Flutter Desktop.
/// Captures rapid keystrokes from USB / Wireless HID scanners without requiring focus inside a text field.
class BarcodeScannerService {
  static final BarcodeScannerService _instance = BarcodeScannerService._internal();
  factory BarcodeScannerService() => _instance;

  final StringBuffer _buffer = StringBuffer();
  DateTime _lastKeystrokeTime = DateTime.now();
  final List<BarcodeCallback> _listeners = [];

  // Scanners type at high speed (< 50ms per keypress)
  static const int _maxKeystrokeIntervalMs = 65;

  BarcodeScannerService._internal() {
    HardwareKeyboard.instance.addHandler(_handleKeyEvent);
  }

  void addListener(BarcodeCallback callback) {
    if (!_listeners.contains(callback)) {
      _listeners.add(callback);
    }
  }

  void removeListener(BarcodeCallback callback) {
    _listeners.remove(callback);
  }

  bool _handleKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final now = DateTime.now();
    final elapsed = now.difference(_lastKeystrokeTime).inMilliseconds;
    _lastKeystrokeTime = now;

    // If typing was paused, reset buffer
    if (elapsed > 400 && _buffer.isNotEmpty) {
      _buffer.clear();
    }

    // Check for Enter key (End of barcode transmission)
    if (event.logicalKey == LogicalKeyboardKey.enter || 
        event.logicalKey == LogicalKeyboardKey.numpadEnter) {
      if (_buffer.length >= 3) {
        final scannedBarcode = _buffer.toString().trim();
        _buffer.clear();
        _notifyListeners(scannedBarcode);
        return true; // Handled
      }
      _buffer.clear();
      return false;
    }

    // Capture standard character input
    final char = event.character;
    if (char != null && char.isNotEmpty && char.codeUnitAt(0) >= 32) {
      _buffer.write(char);
    }

    return false;
  }

  void _notifyListeners(String barcode) {
    SystemSound.play(SystemSoundType.click);
    for (final listener in List.from(_listeners)) {
      listener(barcode);
    }
  }

  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleKeyEvent);
    _listeners.clear();
  }
}

