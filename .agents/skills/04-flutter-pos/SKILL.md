---
name: flutter-pos
description: Comprehensive Flutter Windows Desktop and Mobile POS, cashier UI layouts, state & cart management, hardware printer/scanner integration, and offline-first sync engine.
---
# Flutter POS: Complete Architecture, UI, Hardware & Sync Specification

## 1. هيكلية واجهات نقطة البيع وتجربة المستخدم (Cashier UI & Layouts)
- **شاشات العرض المزدوجة (Dual-Pane Desktop / Tablet Grid):**
  - الجانب الأيمن/الأيسر (بحسب اتجاه اللغة): شبكة كتالوج الأصناف مع شريط بحث ذكي وتصنيفات سريعة باللمس.
  - الجانب المقابل: سلة البيع اللحظية (Active Cart) مع تفاصيل الكميات والخصومات وموجز الفاتورة.
- **مناعة الشاشات من الكسر البصري (Anti-Overflow Rules):**
  - جميع شاشات الإدخال تحتوي على:
    `resizeToAvoidBottomInset: true` مع `SingleChildScrollView`.
  - يُمنع تماماً استخدام `SizedBox(width: 100)` لعرض أسعار العملات؛ يجب استخدام `FittedBox` أو `Flexible` لاستيعاب الأرقام الكبيرة (مثل مئات الملايين والدينار العراقي) دون حدوث RenderFlex Overflow.
- **تفاعل لوحة المفاتيح واختصارات الكاشير (Desktop Hotkeys):**
  - دعم الاختصارات السريعة بدون ماوس: `F1` للبحث، `F2` دفع نقدي، `F3` دفع بالبطاقة، `F4` تعليق الفاتورة، `F12` طباعة وإغلاق.

## 2. إدارة السلة والمنطق المالي (Cart Logic & Pricing Engine)
- **دقة الحسابات المالية:**
  - استخدام مكتبات الحساب الدقيق (`decimal`) لمنع أخطاء التقريب في الأعداد العشرية الناتجة عن الـ `double`.
  - احتساب الضرائب والخصومات على مستوى كل بند (Item-Level Discount) وعلى مستوى إجمالي الفاتورة (Total Invoice Discount).
- **الفواتير المعلقة (Parked / Held Invoices):**
  - إمكانية تعليق الفاتورة الحالية والبدء بفاتورة لعميل آخر واسترجاع المعلقة بنقرة زر دون فقدان الأصناف.
- **تعدد العملات وسعر الصرف اللحظي:**
  - عرض المجموع بعملتين متوازيتين (IQD / USD) مع تثبيت سعر الصرف اللحظي وقت إنشاء الفاتورة وحساب الباقي للعميل (Change Due).

## 3. وضع عدم الاتصال والمزامنة الذكية (Offline-First Architecture & Sync Queue)
- **قاعدة البيانات المحلية (Local Storage Mirror):**
  - يعمل التطبيق بمحرك بيانات محلي سريع (Isar أو SQLite) كمرآة للأسعار، الباركودات، والأرصدة الأولية والعملاء.
- **طابور المزامنة (Offline Sync Queue):**
  - الفواتير المنشأة أوفلاين تُخزن محلياً فوراً بحالة `is_synced: false`.
  - عند عودة اتصال الشبكة، يعمل Background Worker لمعالجة الطابور بترتيب زمني صارم (FIFO).
  - استخدام مفتاح عدم التكرار (`X-Idempotency-Key: UUID`) مع كل فاتورة لضمان عدم تكرار الترحيل عند انقطاع الشبكة أثناء الإرسال.
- **حل تعارضات الأرصدة (Stock Conflict Resolution):**
  - في حال نفاد رصيد صنف تم بيعه أوفلاين، تُقبل الفاتورة محاسبياً ويرسل النظام تنبيهاً للإدارة بوجود عجز مخزني يستوجب التسوية الجردية.

## 4. تكامل عتاد الكاشير والديسكتوب (Desktop Hardware Integration)
- **قارئ الباركود السلكي واللاسلكي (Hardware Barcode Scanner):**
  - التقاط مدخلات قارئ الباركود عبر `RawKeyboardListener` أو `HardwareKeyboard` لمنع ضياع التركيز (Focus) عند مسح المواد بسرعة.
  - تمييز إدخال الماسح عن الكتابة اليدوية بقياس الفاصل الزمني بين النبضات (`keystroke latency < 50ms`).
- **الطابعات الحرارية وإيصالات الدفع (ESC/POS Thermal Printing):**
  - دعم الطباعة المباشرة عبر منافذ USB السلكية ومنافذ الشبكة المباشرة (Network Socket Port 9100).
  - إرسال أوامر الفتح لدرج الكاشير الإلكتروني (Cash Drawer Kick): `[0x1B, 0x70, 0x00, 0x19, 0xFA]`.
  - قص الورق التلقائي عند انتهاء الإيصال (Auto Paper Cut): `[0x1D, 0x56, 0x41, 0x10]`.
  - طباعة باركود وQR Code للفاتورة الضريبية وفق المعايير المعتمدة.
