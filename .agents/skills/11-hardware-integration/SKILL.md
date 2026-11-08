---
name: hardware-integration
description: Direct hardware integration for Zebra ZPL label printers, ESC/POS thermal receipt printers, cash drawers, and high-speed HID barcode scanners.
---
# Hardware Integration (Printers & Scanners) Specification

## 1. Barcode & Label Printers (ZPL Protocol)

### Zebra / Industrial Printers:
- **توليد أكواد ZPL نقية:** طباعة ملصقات الرفوف وباركود المنتجات عبر منافذ الشبكة (TCP/IP Port 9100) أو البلوتوث والـ USB المباشر.
- **مواصفات الليبل الإلزامية:**
  - اسم الصنف (عربي / إنكليزي).
  - كود الصنف (SKU) بخط واضح مقروء بشرياً.
  - باركود عالي الدقة بنظام Code-128.
  - موقع التخزين والرف الهرمي: `Bin Location (Warehouse -> Zone -> Rack -> Bin)`.
- **نموذج أمر ZPL النموذجي:**
  ```text
  ^XA
  ^FO50,50^A0N,30,30^FDItem: Premium Gaming Laptop^FS
  ^FO50,90^A@N,25,25,E:ARABIC.FNT^FDلابتوب قيمنق احترافي^FS
  ^FO50,130^BY2^BCN,70,Y,N,N^FDSKU-99201-X^FS
  ^FO50,230^A0N,25,25^FDBin: WH1-Z2-R04-B12^FS
  ^XZ
  ```

---

## 2. POS Thermal Receipt Printers (ESC/POS Protocol)

### 80mm / 58mm Thermal Printers:
- **دعم معيار ESC/POS القياسي:** التوافق الكامل مع طابعات Epson، Star، Bixolon، والطابعات الحرارية الصينية.
- **التقطيع الآلي للورق (Auto-Cutter):**
  - إرسال الأمر: `GS V 0` أو `[0x1D, 0x56, 0x00]` لقص الورق فور انتهاء الإيصال.
- **نبضة فتح درج الكاشير الإلكتروني (Cash Drawer Kick):**
  - إرسال الأمر: `ESC p 0 25 250` أو `[0x1B, 0x70, 0x00, 0x19, 0xFA]` لفتح الدرج آلياً مع طباعة الفاتورة النقدية.
- **معالجة النصوص واللغة العربية:**
  - تحويل النصوص العربية إلى صور أحادية اللون (Monochrome Bitmaps) أو استخدام معالجة Raster Graphics المباشرة قبل الإرسال، لمنع ظهور الأحرف العربية مقطعة أو معكوسة.
- **الباركود الضريبي:** طباعة QR Code وBarcode للفاتورة الضريبية وفق متطلبات الفوترة المعتمدة.

---

## 3. Handheld Barcode Scanners (HID Keyboard Mode)

### معالجة إدخال الماسح الضوئي:
- **التمييز بين الماسح والإدخال اليدوي:**
  - التقاط تتابع الضغطات بقياس الفاصل الزمني: `Keypress Interval < 30ms` (الكتابة السريعة للماسح تفوق سرعة الطباعة اليدوية للإنسان).
- **التوجيه التلقائي (Global Hot-Capture):**
  - توجيه قراءة الباركود فوراً إلى سلة المبيعات أو شريط البحث دون اشتراط وقوف مؤشر الفأرة (Focus) داخل حقل الإدخال.
- **الرمز الختامي (Scanner Suffix):**
  - التقاط الرمز الختامي الصادر من الماسح (`Enter` أو `Tab`) لتنفيذ عملية إضافة الصنف للفاتورة تلقائياً بدون حاجة لضغط أزرار إضافية.
