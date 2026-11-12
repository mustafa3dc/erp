import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_client.dart';
import 'desktop_pos_screen.dart';

class DesktopShellScreen extends StatefulWidget {
  const DesktopShellScreen({super.key});

  @override
  State<DesktopShellScreen> createState() => _DesktopShellScreenState();
}

class _DesktopShellScreenState extends State<DesktopShellScreen> {
  int _selectedIndex = 0;
  bool _isApiConnected = false;
  Timer? _healthTimer;
  final ApiClient _api = ApiClient();

  @override
  void initState() {
    super.initState();
    _checkHealth();
    _healthTimer = Timer.periodic(const Duration(seconds: 10), (_) => _checkHealth());
  }

  @override
  void dispose() {
    _healthTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkHealth() async {
    final healthy = await _api.checkHealth();
    if (mounted && healthy != _isApiConnected) {
      setState(() => _isApiConnected = healthy);
    }
  }

  Widget _buildCurrentView() {
    switch (_selectedIndex) {
      case 0:
        return const DesktopPosScreen();
      case 1:
        return _buildPlaceholderScreen('دليل الأصناف والمخزون', Icons.inventory_2_outlined);
      case 2:
        return _buildPlaceholderScreen('فواتير المبيعات وحركات الصرف', Icons.receipt_long_outlined);
      case 3:
        return _buildPlaceholderScreen('الخزينة والصناديق النقدية', Icons.account_balance_wallet_outlined);
      case 4:
        return _buildPlaceholderScreen('إدارة الورديات وتقرير Z-Report', Icons.lock_clock_outlined);
      case 5:
        return _buildSettingsScreen();
      default:
        return const DesktopPosScreen();
    }
  }

  Widget _buildPlaceholderScreen(String title, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: const Color(0xFF38BDF8).withOpacity(0.4)),
          const SizedBox(height: 16),
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('متصل بخادم الـ .NET Core Web API', style: TextStyle(color: Colors.white38, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildSettingsScreen() {
    final urlController = TextEditingController(text: _api.baseUrl);
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('إعدادات النظام وعنوان الخادم', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 24),
          SizedBox(
            width: 450,
            child: TextField(
              controller: urlController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'عنوان خادم الـ .NET Core API:',
                labelStyle: const TextStyle(color: Color(0xFF38BDF8)),
                hintText: 'http://localhost:5055',
                hintStyle: const TextStyle(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
            onPressed: () async {
              await _api.updateBaseUrl(urlController.text.trim());
              _checkHealth();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('تم حفظ عنوان الخادم بنجاح!')),
              );
            },
            child: const Text('حفظ واختبار الاتصال', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          children: [
            // 1. Desktop Top Bar
            Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              color: const Color(0xFF0B1120),
              child: Row(
                children: [
                  const Text('ZiloX ERP & Cloud POS', 
                    style: TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.w900, fontSize: 15)),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFF334155)),
                    ),
                    child: const Text('المستودع الرئيسي - بغداد', 
                      style: TextStyle(color: Colors.white70, fontSize: 11)),
                  ),
                  const Spacer(),

                  // API Health Status Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _isApiConnected 
                          ? Colors.green.withOpacity(0.15) 
                          : Colors.red.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: _isApiConnected ? Colors.greenAccent : Colors.redAccent,
                        width: 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 4,
                          backgroundColor: _isApiConnected ? Colors.greenAccent : Colors.redAccent,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _isApiConnected ? 'الخادم متصل (Online)' : 'الخادم غير متصل (Offline)',
                          style: TextStyle(
                            color: _isApiConnected ? Colors.greenAccent : Colors.redAccent,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),

                  // Cashier Profile
                  const Row(
                    children: [
                      CircleAvatar(
                        radius: 13,
                        backgroundColor: Color(0xFF2563EB),
                        child: Icon(Icons.person, size: 16, color: Colors.white),
                      ),
                      SizedBox(width: 8),
                      Text('أحمد علي (كاشير)', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ],
              ),
            ),

            // 2. Main Body with Desktop Navigation Rail
            Expanded(
              child: Row(
                children: [
                  NavigationRail(
                    backgroundColor: const Color(0xFF0F172A),
                    selectedIndex: _selectedIndex,
                    onDestinationSelected: (idx) => setState(() => _selectedIndex = idx),
                    labelType: NavigationRailLabelType.all,
                    selectedIconTheme: const IconThemeData(color: Color(0xFF38BDF8)),
                    unselectedIconTheme: const IconThemeData(color: Colors.white38),
                    selectedLabelTextStyle: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 11),
                    unselectedLabelTextStyle: const TextStyle(color: Colors.white38, fontSize: 11),
                    destinations: const [
                      NavigationRailDestination(
                        icon: Icon(Icons.point_of_sale_outlined),
                        selectedIcon: Icon(Icons.point_of_sale),
                        label: Text('نقطة البيع POS'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.inventory_2_outlined),
                        selectedIcon: Icon(Icons.inventory_2),
                        label: Text('المخزون'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.receipt_long_outlined),
                        selectedIcon: Icon(Icons.receipt_long),
                        label: Text('الفواتير'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.account_balance_wallet_outlined),
                        selectedIcon: Icon(Icons.account_balance_wallet),
                        label: Text('الخزينة'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.lock_clock_outlined),
                        selectedIcon: Icon(Icons.lock_clock),
                        label: Text('الورديات'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.settings_outlined),
                        selectedIcon: Icon(Icons.settings),
                        label: Text('الإعدادات'),
                      ),
                    ],
                  ),

                  const VerticalDivider(width: 1, thickness: 1, color: Color(0xFF1E293B)),

                  // Active Screen View
                  Expanded(
                    child: _buildCurrentView(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

