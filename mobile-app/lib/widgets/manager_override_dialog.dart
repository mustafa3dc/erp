import 'package:flutter/material.dart';
import '../models/blind_discount_model.dart';

class ManagerOverrideDialog extends StatefulWidget {
  final String productName;
  final double retailPrice;
  final DiscountType discountType;
  final double discountValue;
  final double proposedPrice;
  final double maxCashierPercent;

  const ManagerOverrideDialog({
    Key? key,
    required this.productName,
    required this.retailPrice,
    required this.discountType,
    required this.discountValue,
    required this.proposedPrice,
    this.maxCashierPercent = 5.0,
  }) : super(key: key);

  @override
  State<ManagerOverrideDialog> createState() => _ManagerOverrideDialogState();
}

class _ManagerOverrideDialogState extends State<ManagerOverrideDialog> {
  String _pin = '';
  String? _errorMessage;
  bool _isLoading = false;
  bool _isRemoteWaiting = false;

  void _onDigitPress(String digit) {
    if (_pin.length < 6) {
      setState(() {
        _pin += digit;
        _errorMessage = null;
      });
    }
  }

  void _onDeletePress() {
    if (_pin.isNotEmpty) {
      setState(() {
        _pin = _pin.substring(0, _pin.length - 1);
        _errorMessage = null;
      });
    }
  }

  void _onClearPress() {
    setState(() {
      _pin = '';
      _errorMessage = null;
    });
  }

  void _verifyPin(String pinToVerify) {
    if (pinToVerify.isEmpty) {
      setState(() {
        _errorMessage = 'الرجاء إدخال الرمز السري للمشرف';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    Future.delayed(const Duration(milliseconds: 350), () {
      final discountPercent = widget.discountType == DiscountType.percent
          ? widget.discountValue
          : (widget.retailPrice > 0 ? (widget.discountValue / widget.retailPrice) * 100 : 0);

      // PIN 1234 -> Supervisor (Ahmed Al-Shammari) max 15%
      // PIN 8899 -> Admin (Fahad Al-Tamimi) unlimited
      if (pinToVerify == '1234') {
        if (discountPercent > 15.0) {
          setState(() {
            _isLoading = false;
            _errorMessage = 'الخصم المطلوب يتجاوز الصلاحية المسموحة لهذه المادة';
          });
          return;
        }

        Navigator.of(context).pop(ManagerOverrideResult(
          success: true,
          managerId: 'MGR-04',
          managerName: 'أحمد الشمري (مشرف الفرع)',
          token: 'OVR-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
        ));
      } else if (pinToVerify == '8899') {
        Navigator.of(context).pop(ManagerOverrideResult(
          success: true,
          managerId: 'ADM-01',
          managerName: 'فهد التميمي (مدير النظام)',
          token: 'OVR-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
        ));
      } else {
        setState(() {
          _isLoading = false;
          _errorMessage = 'رمز المشرف غير صالح أو غير مصرح له بالاعتماد';
        });
      }
    });
  }

  void _requestRemoteApproval() {
    setState(() {
      _isRemoteWaiting = true;
      _errorMessage = null;
    });

    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        Navigator.of(context).pop(ManagerOverrideResult(
          success: true,
          managerId: 'MGR-REMOTE',
          managerName: 'اعتماد عن بعد (المشرف العام)',
          token: 'OVR-REM-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
        ));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF0D1527),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: Color(0x4DEF4444)),
      ),
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Dialog Header
              Container(
                padding: const EdgeInsets.all(18),
                decoration: const BoxDecoration(
                  color: Color(0x1AEF4444),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                  border: Border(bottom: BorderSide(color: Color(0x33EF4444))),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0x33EF4444),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.shield_outlined, color: Color(0xFFEF4444), size: 26),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'هذا الخصم يتطلب اعتماد المشرف',
                            style: TextStyle(
                              color: Color(0xFFF87171),
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'نظام حماية هامش الربح والرقابة الصامتة',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 20),
                      onPressed: () => Navigator.of(context).pop(null),
                    ),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    // Item context card (Masked: NO Cost Price)
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0x0AFFFFFF),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0x14FFFFFF)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  widget.productName,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0x26EF4444),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0x4DEF4444)),
                                ),
                                child: Text(
                                  widget.discountType == DiscountType.percent
                                      ? '%${widget.discountValue} خصم'
                                      : '\$${widget.discountValue} خصم',
                                  style: const TextStyle(color: Color(0xFFF87171), fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('سعر البيع الرسمي', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                                  Text(
                                    '\$${widget.retailPrice.toStringAsFixed(2)}',
                                    style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  const Text('السعر بعد الخصم', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                                  Text(
                                    '\$${widget.proposedPrice.toStringAsFixed(2)}',
                                    style: const TextStyle(color: Color(0xFF10B981), fontSize: 15, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    if (_isRemoteWaiting)
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: const Color(0x1A6366F1),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0x4D6366F1)),
                        ),
                        child: Column(
                          children: const [
                            CircularProgressIndicator(color: Color(0xFF6366F1)),
                            SizedBox(height: 14),
                            Text(
                              'تم إرسال إشعار اعتماد فوري للمشرف...',
                              style: TextStyle(color: Color(0xFFA5B4FC), fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      )
                    else ...[
                      // PIN Display Field
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(4, (index) {
                          final isFilled = index < _pin.length;
                          return Container(
                            margin: const EdgeInsets.symmetric(horizontal: 8),
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isFilled ? const Color(0xFF6366F1) : const Color(0x33FFFFFF),
                            ),
                          );
                        }),
                      ),

                      if (_errorMessage != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],

                      const SizedBox(height: 16),

                      // Keypad
                      GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: 3,
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                        childAspectRatio: 2.1,
                        children: [
                          ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) {
                            return ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0x14FFFFFF),
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                              onPressed: () => _onDigitPress(digit),
                              child: Text(digit, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                            );
                          }),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0x26EF4444),
                              foregroundColor: const Color(0xFFF87171),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            onPressed: _onClearPress,
                            child: const Text('C', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          ),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0x14FFFFFF),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            onPressed: () => _onDigitPress('0'),
                            child: const Text('0', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                          ),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0x26F59E0B),
                              foregroundColor: const Color(0xFFFBBF24),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            onPressed: _onDeletePress,
                            child: const Icon(Icons.backspace_outlined, size: 18),
                          ),
                        ],
                      ),

                      const SizedBox(height: 12),

                      // Quick Demo Preset PINs
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFFA5B4FC),
                                side: const BorderSide(color: Color(0x4D6366F1)),
                              ),
                              onPressed: () => _verifyPin('1234'),
                              child: const Text('مشرف الفرع (1234)', style: TextStyle(fontSize: 11)),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF6EE7B7),
                                side: const BorderSide(color: Color(0x4D10B981)),
                              ),
                              onPressed: () => _verifyPin('8899'),
                              child: const Text('المدير العام (8899)', style: TextStyle(fontSize: 11)),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 16),

                      // Action Buttons
                      Row(
                        children: [
                          Expanded(
                            child: SizedBox(
                              height: 48,
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF4F46E5),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                onPressed: _pin.isNotEmpty && !_isLoading
                                    ? () => _verifyPin(_pin)
                                    : null,
                                icon: _isLoading
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                      )
                                    : const Icon(Icons.check_circle_outline, size: 18),
                                label: Text(_isLoading ? 'جاري التحقق...' : 'اعتماد الخصم فورياً'),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            height: 48,
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.white,
                                side: const BorderSide(color: Color(0x33FFFFFF)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              onPressed: _requestRemoteApproval,
                              icon: const Icon(Icons.send_outlined, size: 16),
                              label: const Text('عن بعد', style: TextStyle(fontSize: 12)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
