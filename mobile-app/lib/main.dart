import 'dart:io';
import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';
import 'screens/desktop_shell_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Windows Desktop Window Configuration via window_manager
  if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
    await windowManager.ensureInitialized();

    const windowOptions = WindowOptions(
      size: Size(1366, 768),
      minimumSize: Size(1024, 700),
      center: true,
      backgroundColor: Colors.transparent,
      skipTaskbar: false,
      title: "ZiloX ERP & Cloud POS • Desktop Edition",
    );

    await windowManager.waitUntilReadyToShow(windowOptions, () async {
      await windowManager.show();
      await windowManager.maximize();
      await windowManager.focus();
    });
  }

  runApp(const ErpDesktopApp());
}

class ErpDesktopApp extends StatelessWidget {
  const ErpDesktopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ZiloX ERP & Cloud POS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF2563EB),
          secondary: Color(0xFF38BDF8),
          surface: Color(0xFF1E293B),
        ),
        useMaterial3: true,
        fontFamily: 'Cairo',
      ),
      home: const DesktopShellScreen(),
    );
  }
}
