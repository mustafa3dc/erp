# ZiloX Business Suite • Windows Desktop Host Architecture & Deployment

تحويل نظام ZiloX ERP & Cloud POS إلى تطبيق مكتبي مستقل لنظام تشغيل Windows مع نظام حماية وترخيص العتاد (Hardware-Lock) والطباعة الحرارية المباشرة.

---

## 1. الهيكل العام للتطبيق (Architecture Overview)

```
[ Windows Client PC (Win 10 / 11) ]
 │
 ├── [ Single Instance Mutex: Global\ZiloxERPDesktopSingleInstance ]
 │
 ├── [ DesktopHost (ERP.exe) - C# WPF .NET 8 Host ]
 │    │
 │    ├── Hardware-Lock Licensing Engine (RSA-2048 Verification)
 │    │    ├── Motherboard Serial Number
 │    │    ├── CPU Processor ID
 │    │    ├── System Disk Serial Number / UUID
 │    │    └── Machine ID: ZLX1-XXXX-XXXX-XXXX
 │    │
 │    ├── POS Hardware Bridge (ComVisible Host Object)
 │    │    ├── Silent ESC/POS Thermal Printing (Win32 Spooler RAW)
 │    │    ├── Cash Drawer Kick (ESC p 0 25 250)
 │    │    └── Paper Auto-Cutter (GS V 0)
 │    │
 │    ├── Microsoft.Web.WebView2 (Chromium Embedded)
 │    │    └── Virtual Host Mapping: http://app.zilox.local/ -> wwwroot
 │    │
 │    └── Background Process Manager (Win32 Job Object)
 │         └── ASP.NET Core API (http://localhost:5055)
 │              └── Health Check Polling: /health
 │
 └── [ Local Database & Storage ]
      └── %AppData%\ZiloxERP (Licenses, Logs, Cache)
```

---

## 2. نظام ترخيص وحماية النسخ (Hardware-Lock Licensing Engine)

### أ. بصمة العتاد (Hardware Fingerprint):
يقوم `HardwareIdService.cs` بقراءة عتاد الحاسوب عبر WMI:
1. الرقم التسلسلي للوحة الأم (`Win32_BaseBoard.SerialNumber`).
2. المعرف الفريد للمعالج (`Win32_Processor.ProcessorId`).
3. المعرف التسلسلي لقرص النظام (`Win32_DiskDrive.SerialNumber`).
4. مع نظام احتياطي للرجوع إلى `MachineGuid` من سجل الويندوز و `MAC Address`.

يتم تشفير هذه البيانات وتوليد كود مميز للجهاز (Machine ID) بالصيغة:
```
ZLX1-A2B3-C4D5-E6F7
```

### ب. التوقيع الرقمي (RSA-2048 Asymmetric Cryptography):
- **المفتاح العام (Public Key):** مدمج داخل كود تطبيق العميل `LicensingService.cs` للتحقق فقط. لا يمكن التلاعب به أو تزويره.
- **المفتاح الخاص (Private Key):** محفوظ حصرياً لدى المطور في أداة `LicenseGenerator`.

### ج. توليد مفاتيح التفعيل للعملاء:
لتوليد مفتاح تفعيل لأي عميل جديد:
```bash
cd desktop-host/tools/LicenseGenerator
dotnet run
```
ثم أدخل:
1. كود الجهاز (Machine ID) الذي ينسخه العميل من شاشة التفعيل.
2. اسم المحل أو العميل (Customer Name).
3. نوع الترخيص: مدى الحياة (LIFETIME) أو سنوي (ANNUAL).
4. نوع النشاط التجاري (Preset: سوبرماركت، اتصالات، جملة).

ينتج البرنامج مفتاحاً مشفراً بصيغة:
```
ZLX-LIC.<Base64Payload>.<Base64Signature>
```
يقوم العميل بلصق هذا المفتاح في نافذة التفعيل، ليتم ربط النسخة بجهازه مدى الحياة.

---

## 3. جسر العتاد والطباعة الحرارية الصامتة (POS Hardware Bridge)

يتم تسجيل كائن الربط `posPrinterBridge` تلقائياً داخل نافذة WebView2:
```csharp
webView.CoreWebView2.AddHostObjectToScript("posPrinterBridge", new PosPrinterBridge());
```

وفي واجهة الـ Frontend (React/TypeScript):
```typescript
import { isDesktopApp, printReceiptNative, kickDrawerNative } from '../services/desktopBridgeService';

// طباعة صامتة فورية عند الحفظ
await printReceiptNative({
  companyName: "أسواق البركة المركزية",
  invoiceNumber: "INV-2026-0042",
  items: [...],
  grandTotal: 15000,
  currency: "د.ع",
  openDrawer: true, // يفتح درج الكاشير آلياً
  cutPaper: true    // يقص الورق آلياً
});
```

### مميزات جسر العتاد:
1. **بدون نوافذ متصفح:** لا تظهر نافذة معاينة الطباعة التابعة للمتصفح نهائياً.
2. **نبضة فتح الدرج الإلكتروني:** ترسل نبضة كهربائية فورية عبر منفذ RJ11 المتصل بالطابعة:
   ```csharp
   byte[] openDrawerCommand = new byte[] { 27, 112, 0, 25, 250 };
   ```
3. **قص الورق الآلي:** ترسل أمر ESC/POS للقص:
   ```csharp
   byte[] cutPaperCommand = new byte[] { 0x1D, 0x56, 0x00 };
   ```

---

## 4. البناء وحزم ملف التثبيت (Inno Setup)

لإنتاج ملف `Setup.exe` واحد وجاهز للتوزيع على فلاشة USB:

على جهاز Windows:
```cmd
build-windows-package.bat
```

النتيجة:
يتم إنشاء ملف تنفيذي احترافي واحد في:
```
dist-installer\Setup.exe
```

يقوم هذا المثبت آلياً بـ:
1. التحقق من وجود `WebView2 Runtime` وتثبيته بصمت إذا كان مفقوداً.
2. تثبيت ملفات الـ Host وملفات الواجهة والـ Backend.
3. إنشاء اختصارات سطح المكتب وقائمة ابدأ.
4. منع تشغيل أكثر من نسخة متزامنة بواسطة Mutex.

