# ZiloX ERP & Cloud POS • 100% Native Windows Desktop (Flutter & C++)

دليل البناء والتشغيل لتطبيق فلاتر المكتبي الأصيل (Pure Native Windows Desktop) بدون أي متصفحات ويب أو WebView نهائياً.

---

## 1. الهيكل العام للتطبيق (Native Desktop Architecture)

```
[ Windows PC (Win 10 / 11) - x64 Native ]
 │
 ├── [ Win32 Window Runner (windows/runner/main.cpp) ]
 │    ├── Single Instance Mutex: Global\ZiloxERPFlutterSingleInstance
 │    ├── window_manager: Maximized Default, Custom Title & app.ico
 │    └── Flutter Native C++ Engine (flutter_windows.dll)
 │
 ├── [ Hardware Keyboard & Scanner Interceptor (barcode_scanner_service.dart) ]
 │    └── Global Keystroke Latency (<50ms) -> Hot-capture Barcode
 │
 ├── [ Desktop POS Dual-Pane View (desktop_pos_screen.dart) ]
 │    ├── Hotkeys:
 │    │    ├── [F1] : البحث السريع عن صنف (Quick Search)
 │    │    ├── [F5] : دفع نقدي فوري وإغلاق الفاتورة وطباعة صامتة
 │    │    ├── [F12]: تعليق الفاتورة (Park / Hold Invoice)
 │    │    └── [Enter]: الانتقال والإضافة السريعة
 │    ├── Iraqi Cash Rounding (أقرب 250 د.ع)
 │    └── Dual Currency Display (IQD & USD)
 │
 ├── [ Native Hardware Service (native_hardware_service.dart) ]
 │    ├── Silent ESC/POS Thermal Printing (Raw Socket Port 9100 / USB)
 │    ├── Cash Drawer Kick: [0x1B, 0x70, 0x00, 0x19, 0xFA]
 │    └── Auto-Cutter: [0x1D, 0x56, 0x00]
 │
 └── [ .NET Core Web API Client (api_client.dart via Dio) ]
      ├── URL: http://localhost:5055/api/v1 (أو سيرفر الشبكة)
      └── Offline-First Local Cache & FIFO Sync Queue
```

---

## 2. متطلبات البناء على جهاز Windows

1. **Flutter SDK** (الإصدار 3.19 أو أحدث).
2. **Visual Studio 2022** مع تفعيل خيار **"Desktop development with C++"**.
3. **Inno Setup 6** لإنتاج ملف `Setup.exe`.

---

## 3. أوامر البناء والتجميع بضغطة زر واحدة

### الطريقة الأوتوماتيكية:
افتح موجه أوامر الويندوز (CMD) داخل مسار المشروع وشغّل:
```cmd
build-flutter-windows.bat
```

### الطريقة اليدوية خطوة بخطوة:
```cmd
cd mobile-app

:: 1. تحميل الحزم
flutter pub get

:: 2. بناء ملف الويندوز التنفيذي الأصيل
flutter build windows --release

:: 3. تجميع ملف التثبيت بواسطة Inno Setup
cd ..
iscc packaging\inno-setup\flutter_installer.iss
```

النتيجة:
يتم إنتاج ملف التثبيت الموحد في:
```
dist-installer\Setup.exe
```

---

## 4. اختصارات لوحة المفاتيح المدمجة في شاشة البيع

| المفتاح | الوظيفة البرمجية |
| :--- | :--- |
| **`F1`** | نقل التركيز الفوري لشريط البحث عن صنف بالاسم أو الـ SKU |
| **`F5`** | اعتماد الدفع النقدي (Cash)، تقريب الصافي لأقرب 250 د.ع، الطباعة الصامتة، وفتح درج الكاشير |
| **`F12`** | تعليق الفاتورة الحالية (Park Invoice) والبدء بزبون آخر، مع إمكانية استرجاعها بنقرة واحدة |
| **`Enter`** | تأكيد البحث، إضافة الصنف المختار للسلة، والتنقل بين الحقول |
| **قارئ الباركود** | قراءة مباشرة وفورية دون الحاجة للنقر بالفأرة داخل حقل الإدخال نهائياً |

