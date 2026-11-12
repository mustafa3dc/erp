import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_client.dart';

class DesktopSettingsScreen extends StatefulWidget {
  const DesktopSettingsScreen({super.key});

  @override
  State<DesktopSettingsScreen> createState() => _DesktopSettingsScreenState();
}

class _DesktopSettingsScreenState extends State<DesktopSettingsScreen> {
  final ApiClient _api = ApiClient();
  int _activeTabIndex = 0;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isDirty = false;

  // Form Controllers & State
  late final TextEditingController _orgNameCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _addressCtrl;
  late final TextEditingController _taxNumberCtrl;
  late final TextEditingController _receiptHeaderCtrl;
  late final TextEditingController _receiptFooterCtrl;
  late final TextEditingController _apiUrlCtrl;
  late final TextEditingController _exchangeRateCtrl;

  String _baseCurrency = 'IQD';
  bool _autoRoundCash = true;
  String _paperWidth = '80mm';
  bool _autoPrintReceipt = true;
  bool _openCashDrawer = true;
  String _defaultWarehouse = 'المستودع الرئيسي - بغداد';

  // Active Modules State
  final Map<String, bool> _activeModules = {
    'pos': true,
    'multiWarehouse': true,
    'installments': true,
    'serials': false,
    'variants': false,
    'multiCurrency': true,
    'creditLimits': true,
    'scales': true,
    'expiryDates': false,
  };

  @override
  void initState() {
    super.initState();
    _orgNameCtrl = TextEditingController();
    _phoneCtrl = TextEditingController();
    _addressCtrl = TextEditingController();
    _taxNumberCtrl = TextEditingController();
    _receiptHeaderCtrl = TextEditingController();
    _receiptFooterCtrl = TextEditingController();
    _apiUrlCtrl = TextEditingController(text: _api.baseUrl);
    _exchangeRateCtrl = TextEditingController(text: '1520');

    _loadSettings();
  }

  @override
  void dispose() {
    _orgNameCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _taxNumberCtrl.dispose();
    _receiptHeaderCtrl.dispose();
    _receiptFooterCtrl.dispose();
    _apiUrlCtrl.dispose();
    _exchangeRateCtrl.dispose();
    super.dispose();
  }

  void _markDirty() {
    if (!_isDirty) {
      setState(() => _isDirty = true);
    }
  }

  Future<void> _loadSettings() async {
    setState(() => _isLoading = true);
    final prefs = await SharedPreferences.getInstance();

    _orgNameCtrl.text = prefs.getString('pos_org_name') ?? 'شركة زيلوكس للتجارة العامة';
    _phoneCtrl.text = prefs.getString('pos_phone') ?? '+964 770 123 4567';
    _addressCtrl.text = prefs.getString('pos_address') ?? 'بغداد - شارع الرشيد';
    _taxNumberCtrl.text = prefs.getString('pos_tax_number') ?? 'TAX-99281-IQ';
    _receiptHeaderCtrl.text = prefs.getString('pos_receipt_header') ?? 'أهلاً وسهلاً بكم - نشكر زيارتكم';
    _receiptFooterCtrl.text = prefs.getString('pos_receipt_footer') ?? 'البضاعة المباعة ترد وتستبدل خلال 3 أيام بموجب الوصل';
    _apiUrlCtrl.text = prefs.getString('api_base_url') ?? _api.baseUrl;
    _exchangeRateCtrl.text = (prefs.getDouble('exchange_rate_usd_to_iqd') ?? 1520).toString();

    _baseCurrency = prefs.getString('pos_base_currency') ?? 'IQD';
    _autoRoundCash = prefs.getBool('pos_auto_round_cash') ?? true;
    _paperWidth = prefs.getString('pos_paper_width') ?? '80mm';
    _autoPrintReceipt = prefs.getBool('pos_auto_print') ?? true;
    _openCashDrawer = prefs.getBool('pos_open_cash_drawer') ?? true;
    _defaultWarehouse = prefs.getString('pos_default_warehouse') ?? 'المستودع الرئيسي - بغداد';

    setState(() {
      _isLoading = false;
      _isDirty = false;
    });
  }

  Future<void> _saveAllSettings() async {
    setState(() => _isSaving = true);
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString('pos_org_name', _orgNameCtrl.text.trim());
    await prefs.setString('pos_phone', _phoneCtrl.text.trim());
    await prefs.setString('pos_address', _addressCtrl.text.trim());
    await prefs.setString('pos_tax_number', _taxNumberCtrl.text.trim());
    await prefs.setString('pos_receipt_header', _receiptHeaderCtrl.text.trim());
    await prefs.setString('pos_receipt_footer', _receiptFooterCtrl.text.trim());

    final newUrl = _apiUrlCtrl.text.trim();
    if (newUrl.isNotEmpty && newUrl != _api.baseUrl) {
      await _api.updateBaseUrl(newUrl);
    }

    final rate = double.tryParse(_exchangeRateCtrl.text) ?? 1520;
    await prefs.setDouble('exchange_rate_usd_to_iqd', rate);

    await prefs.setString('pos_base_currency', _baseCurrency);
    await prefs.setBool('pos_auto_round_cash', _autoRoundCash);
    await prefs.setString('pos_paper_width', _paperWidth);
    await prefs.setBool('pos_auto_print', _autoPrintReceipt);
    await prefs.setBool('pos_open_cash_drawer', _openCashDrawer);
    await prefs.setString('pos_default_warehouse', _defaultWarehouse);

    setState(() {
      _isSaving = false;
      _isDirty = false;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.check_circle, color: Colors.greenAccent, size: 20),
              SizedBox(width: 8),
              Text('تم حفظ الإعدادات ومزامنة حالة النظام بنجاح!'),
            ],
          ),
          backgroundColor: Color(0xFF1E293B),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _discardChanges() {
    _loadSettings();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF38BDF8)),
      );
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(32, 24, 32, 80),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFF38BDF8).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.settings, color: Color(0xFF38BDF8), size: 22),
                    ),
                    const SizedBox(width: 14),
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'الإعدادات العامة والتشغيلية',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'إدارة هوية المنشأة، الإعدادات المالية، أجهزة نقاط البيع، والميزات المفعلة',
                          style: TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // 4 Clean Categorized Segmented Tabs
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildTabItem(0, 'هوية المنشأة والفواتير', Icons.business_outlined),
                      _buildTabItem(1, 'المالية والعملات والتقريب', Icons.monetization_on_outlined),
                      _buildTabItem(2, 'نقاط البيع والأجهزة', Icons.print_outlined),
                      _buildTabItem(3, 'الميزات والوحدات المفعلة', Icons.extension_outlined),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Tab Content Area
                Expanded(
                  child: SingleChildScrollView(
                    child: _buildActiveTabContent(),
                  ),
                ),
              ],
            ),
          ),

          // Unified Sticky Action Bar (isDirty)
          if (_isDirty)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFF0B1120),
                  border: const Border(
                    top: BorderSide(color: Color(0xFF334155), width: 1),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.5),
                      blurRadius: 10,
                      offset: const Offset(0, -2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: Color(0xFFF59E0B), size: 18),
                    const SizedBox(width: 8),
                    const Text(
                      'توجد تعديلات غير محفوظة',
                      style: TextStyle(color: Color(0xFFF59E0B), fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white70,
                        side: const BorderSide(color: Color(0xFF475569)),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _discardChanges,
                      icon: const Icon(Icons.undo, size: 16),
                      label: const Text('تراجع'),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _isSaving ? null : _saveAllSettings,
                      icon: _isSaving
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.check, size: 16),
                      label: Text(_isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTabItem(int index, String title, IconData icon) {
    final isSelected = _activeTabIndex == index;
    return InkWell(
      onTap: () => setState(() => _activeTabIndex = index),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF2563EB) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected ? Colors.white : Colors.white60,
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.white60,
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveTabContent() {
    switch (_activeTabIndex) {
      case 0:
        return _buildCompanyIdentityTab();
      case 1:
        return _buildFinancialTab();
      case 2:
        return _buildPosHardwareTab();
      case 3:
        return _buildActiveModulesTab();
      default:
        return const SizedBox.shrink();
    }
  }

  // 1. هوية المنشأة والفواتير
  Widget _buildCompanyIdentityTab() {
    return Column(
      children: [
        _buildSectionCard(
          title: 'المعلومات الأساسية',
          icon: Icons.business,
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _buildTextField('اسم الشركة أو المحل:', _orgNameCtrl, 'مثال: شركة زيلوكس للتجارة العامة'),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _buildTextField('رقم الهاتف للتواصل:', _phoneCtrl, 'مثال: +964 770 123 4567'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildTextField('العنوان والمدينة:', _addressCtrl, 'مثال: بغداد - الكرادة'),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _buildTextField('الرقم الضريبي أو السجل التجاري:', _taxNumberCtrl, 'مثال: REG-2024-IQ'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _buildSectionCard(
          title: 'الشعار وتصميم الوصل',
          icon: Icons.receipt_long,
          child: Column(
            children: [
              _buildTextField('نص ترويسة الفاتورة (Header):', _receiptHeaderCtrl, 'نص يظهر في أعلى إيصال البيع'),
              const SizedBox(height: 16),
              _buildTextField('نص تذييل الفاتورة (Footer):', _receiptFooterCtrl, 'نص يظهر في أسفل إيصال البيع (شروط الاستبدال والاسترجاع)'),
            ],
          ),
        ),
      ],
    );
  }

  // 2. المالية والعملات والتقريب
  Widget _buildFinancialTab() {
    return Column(
      children: [
        _buildSectionCard(
          title: 'العملة الافتراضية وسعر الصرف',
          icon: Icons.monetization_on,
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('العملة الأساسية للنظام:', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFF334155)),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _baseCurrency,
                              dropdownColor: const Color(0xFF1E293B),
                              style: const TextStyle(color: Colors.white, fontSize: 13),
                              isExpanded: true,
                              items: const [
                                DropdownMenuItem(value: 'IQD', child: Text('دينار عراقي (IQD)')),
                                DropdownMenuItem(value: 'USD', child: Text('دولار أمريكي (USD)')),
                              ],
                              onChanged: (val) {
                                if (val != null) {
                                  setState(() => _baseCurrency = val);
                                  _markDirty();
                                }
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _buildTextField('سعر الصرف المعتمد للتحويل (1 USD = IQD):', _exchangeRateCtrl, '1520'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _buildSwitchRow(
                title: 'قاعدة التقريب التلقائي لأقرب 250 د.ع',
                subtitle: 'يُقرِّب المبلغ الكلي تلقائياً عند الدفع النقدي بالدينار العراقي للتخلص من الكسور غير النقدية',
                value: _autoRoundCash,
                onChanged: (v) {
                  setState(() => _autoRoundCash = v);
                  _markDirty();
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  // 3. نقاط البيع والأجهزة
  Widget _buildPosHardwareTab() {
    return Column(
      children: [
        _buildSectionCard(
          title: 'المستودع الافتراضي وإعدادات الخادم',
          icon: Icons.warehouse,
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _buildTextField('المستودع الافتراضي لنقاط البيع:', TextEditingController(text: _defaultWarehouse), ''),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _buildTextField('عنوان خادم الـ API (.NET Core):', _apiUrlCtrl, 'http://localhost:5055'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _buildSectionCard(
          title: 'إعدادات الطابعة الحرارية ودرج النقدية',
          icon: Icons.print,
          child: Column(
            children: [
              Row(
                children: [
                  const Text('مقاس ورق الفاتورة الحرارية:', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 20),
                  ChoiceChip(
                    label: const Text('80mm (القياسي العريض)'),
                    selected: _paperWidth == '80mm',
                    selectedColor: const Color(0xFF2563EB),
                    labelStyle: TextStyle(color: _paperWidth == '80mm' ? Colors.white : Colors.white70),
                    backgroundColor: const Color(0xFF0F172A),
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _paperWidth = '80mm');
                        _markDirty();
                      }
                    },
                  ),
                  const SizedBox(width: 12),
                  ChoiceChip(
                    label: const Text('58mm (المضغوط الصغير)'),
                    selected: _paperWidth == '58mm',
                    selectedColor: const Color(0xFF2563EB),
                    labelStyle: TextStyle(color: _paperWidth == '58mm' ? Colors.white : Colors.white70),
                    backgroundColor: const Color(0xFF0F172A),
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _paperWidth = '58mm');
                        _markDirty();
                      }
                    },
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _buildSwitchRow(
                title: 'الطباعة التلقائية بعد البيع',
                subtitle: 'إرسال أمر الطباعة إلى الطابعة الحرارية مباشرة بمجرد إتمام معاملة الدفع',
                value: _autoPrintReceipt,
                onChanged: (v) {
                  setState(() => _autoPrintReceipt = v);
                  _markDirty();
                },
              ),
              const SizedBox(height: 12),
              _buildSwitchRow(
                title: 'فتح درج النقدية الإلكتروني تلقائياً',
                subtitle: 'إرسال إشارة فتح الدرج (RJ12) عبر الطابعة الحرارية عند السداد النقدي',
                value: _openCashDrawer,
                onChanged: (v) {
                  setState(() => _openCashDrawer = v);
                  _markDirty();
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  // 4. الميزات والوحدات المفعلة
  Widget _buildActiveModulesTab() {
    final modules = [
      {'key': 'pos', 'title': 'نقطة البيع السريعة (Cloud POS)', 'desc': 'تفعيل شاشة الكاشير السريعة ونقاط البيع السحابية', 'icon': Icons.point_of_sale},
      {'key': 'multiWarehouse', 'title': 'تعدد المستودعات والفروع', 'desc': 'إدارة أكثر من مستودع أو فرع مع التحويلات البينية', 'icon': Icons.warehouse},
      {'key': 'installments', 'title': 'الأقساط والتسهيلات المالية', 'desc': 'جدولة الدفعات وحساب فوائد وغرامات التأخير', 'icon': Icons.calendar_month},
      {'key': 'serials', 'title': 'تتبع الأرقام التسلسلية (Serial Numbers)', 'desc': 'تتبع كل وحدة برقم تسلسلي مخصص وشهادة ضمان', 'icon': Icons.qr_code_scanner},
      {'key': 'variants', 'title': 'متغيرات ومقاسات الأصناف', 'desc': 'دعم الألوان والمقاسات والأوزان داخل الصنف الواحد', 'icon': Icons.layers},
      {'key': 'multiCurrency', 'title': 'تعدد العملات وأسعار الصرف', 'desc': 'إتاحة الدفع بالدينار والدولار في الفاتورة الواحدة', 'icon': Icons.currency_exchange},
      {'key': 'creditLimits', 'title': 'حدود الائتمان والديون للعملاء', 'desc': 'تحديد سقف الدين المسموح للزبائن ومطالبات التحصيل', 'icon': Icons.credit_score},
      {'key': 'scales', 'title': 'الموازين الإلكترونية والباركود الوزني', 'desc': 'قراءة باركود الوزن EAN-13 وحساب الوزن مباشرة', 'icon': Icons.scale},
      {'key': 'expiryDates', 'title': 'تتبع تواريخ الصلاحية والانتهاء', 'desc': 'مراقبة الأصناف الغذائية والدوائية وتنبيهات القرب', 'icon': Icons.timer},
    ];

    return _buildSectionCard(
      title: 'الوحدات المعتمدة في باقة اشتراك المنشأة',
      icon: Icons.extension,
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          mainAxisExtent: 88,
        ),
        itemCount: modules.length,
        itemBuilder: (context, idx) {
          final m = modules[idx];
          final isEnabled = _activeModules[m['key']] ?? false;

          return Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isEnabled ? const Color(0xFF2563EB).withOpacity(0.5) : const Color(0xFF334155),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isEnabled ? const Color(0xFF2563EB).withOpacity(0.15) : const Color(0xFF334155).withOpacity(0.3),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    m['icon'] as IconData,
                    size: 18,
                    color: isEnabled ? const Color(0xFF38BDF8) : Colors.white38,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        m['title'] as String,
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        m['desc'] as String,
                        style: const TextStyle(color: Colors.white38, fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isEnabled ? const Color(0xFF059669).withOpacity(0.2) : const Color(0xFF475569).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isEnabled ? const Color(0xFF10B981) : const Color(0xFF64748B),
                    ),
                  ),
                  child: Text(
                    isEnabled ? 'مفعلة' : 'معطلة',
                    style: TextStyle(
                      color: isEnabled ? const Color(0xFF34D399) : const Color(0xFF94A3B8),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // Helper Card Builder
  Widget _buildSectionCard({required String title, required IconData icon, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: const Color(0xFF38BDF8)),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
            ],
          ),
          const Divider(color: Color(0xFF334155), height: 24),
          child,
        ],
      ),
    );
  }

  // Helper TextField Builder
  Widget _buildTextField(String label, TextEditingController controller, String hint) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          onChanged: (_) => _markDirty(),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.white30, fontSize: 12),
            filled: true,
            fillColor: const Color(0xFF0F172A),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF334155)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF334155)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF38BDF8)),
            ),
          ),
        ),
      ],
    );
  }

  // Helper Switch Row Builder
  Widget _buildSwitchRow({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ],
            ),
          ),
          Switch(
            value: value,
            activeColor: const Color(0xFF38BDF8),
            activeTrackColor: const Color(0xFF2563EB).withOpacity(0.5),
            inactiveThumbColor: Colors.white38,
            inactiveTrackColor: const Color(0xFF334155),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

