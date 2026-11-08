---
name: inventory-warehouse-engine
description: Append-only stock ledger, multi-warehouse & bin architecture, stock reservation (ATP), FIFO & batch valuation, serial/expiry tracking, and workflow states.
---
# Inventory & Warehouse Engine Specification

## 1. دفتر أستاذ المخزون التراكمي المقيد (Append-Only Stock Ledger)
- **ممنوع منعاً باتاً تعديل حقل `CurrentStock` في جدول المنتجات بشكل يدوي أو مباشر.**
- أي زيادة أو نقصان في المخزون يجب أن تكون ناتجة حصراً عن حركة مسجلة في جدول `StockTransactions` (مثل: `INBOUND_RECEIPT`, `OUTBOUND_DISPATCH`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT_WRITE_OFF`, `SALE_RETURN`).
- رصيد المخزن الفعلي لأي صنف هو حاصل المجموع الجبري للحركات (Ledger Balance):
  $$\text{LedgerStock} = \sum (\text{QuantityIn} - \text{QuantityOut})$$
- تدقيق ومطابقة الرصيد تتم عبر Trigger أو قيد حسابي محاسبي غير قابل للتلاعب (Cryptographic Hash / Audit Log) لضمان استحالة تعديل الرصيد من خارج سجل الحركات.

## 2. معمارية تعدد المستودعات والمواقع (Multi-Warehouse & Bin Architecture)
- الهيكلية التوزيعية الهرمية للمستودع:
  $$\text{WarehouseId} \longrightarrow \text{ZoneId} \longrightarrow \text{RackId} \longrightarrow \text{BinId}$$
- كل صنف (SKU) يرتبط برصيد منفصل على مستوى كل مستودع وكل موقع تخزين فرعي (`BinLocation`).
- الرصيد العام المعروض للشركة والمؤسسة هو مجموع أرصدة كل الفروع والمستودعات النشطة (`Active Warehouses`).
- عزل البضائع: البضائع المحجوزة أو التالفة أو الخاضعة للفحص تُنقل إلى Zones مخصصة (`INSPECTION`, `QUARANTINE`, `DAMAGED`) لمنع خلطها مع المخزون المتاح للبيع.

## 3. حجز الأرصدة ومنع التضارب (Stock Reservation & ATP Engine)
- عند إنشاء طلب بيع، أمر حجز، أو فاتورة معلقة، تُحجز الكمية فوراً عبر حقل `ReservedStock`.
- الكمية القابلة للبيع فعلياً تحسب بمعادلة الوعد بالتسليم الصارمة (Available To Promise):
  $$\text{AvailableToPromise (ATP)} = \text{PhysicalStock} - \text{ReservedStock}$$
- يُمنع إتمام أي أمر صرف أو بيع إذا كانت الكمية المطلوبة تتجاوز قيمة الـ $ATP$.
- فك الحجز التلقائي (Reservation Expiry): في حال إلغاء الفاتورة المعلقة أو انتهاء مهلة حجز الطلب، يُلغى الحجز تلقائياً ويعاد الرصيد إلى $ATP$.

## 4. محرك FIFO واحتساب تكلفة البضاعة المباعة (FIFO & Cost Valuation Engine)
- احتساب تكلفة البضاعة المباعة (COGS) يتبع معيار FIFO (ما يدخل أولاً يخرج أولاً) الصارم عبر جدول `StockBatches`:
  - يتم استهلاك الدفعات الأقدم دخلاً أولاً (`ORDER BY InboundDate ASC`).
  - تسجيل التكلفة الحقيقية لكل قطعة تخرج في سجل الحركة المالية والمخزنية لضمان دقة الأرباح وهامش الربح الفعلي.
- دعم الدفعات الجزئية (Split Batches): إذا كانت الكمية المطلوبة أكبر من الدفعة الأولى، يتم استهلاك الدفعة الأولى بالكامل واستكمال المتبقي من الدفعة التالية بتكلفتها الخاصة.

## 5. تتبع الأرقام التسلسلية ورقم التشغيلة والصلاحية (Serial & Batch Tracking)
- **الأجهزة الكهربائية والإلكترونية والأصول:**
  - إلزامية إدخال رقم تسلسلي فريد (`SerialNumber`) لكل قطعة منفردة عند الاستلام (GRN) وعند الصرف (Dispatch).
  - منع تكرار الرقم التسلسلي عالمياً، وتتبع تاريخ دورة حياة كل سيريال (من أي مورد دخل، وفي أي موقع خُزّن، وإلى أي عميل خرج).
- **المواد الغذائية والاستهلاكية والطبية:**
  - إلزامية تسجيل رقم التشغيلة (`BatchNumber`) وتاريخ الصلاحية والانتهاء (`ExpiryDate`).
  - تطبيق سياسة الصرف حسب الأسبق انتهاءً FEFO (First-Expired, First-Out) تلقائياً لحماية المنشأة من توالف الصلاحية.
  - إيقاف الصرف تلقائياً (Auto-Quarantine) لأي دفعة قبل تاريخ انتهائها بمهلة محددة (`Near Expiry Threshold`).

## 6. حالات سير العمليات القياسية (Workflow States)
- **عمليات التوريد والاستلام (Inbound - GRN):**
  $$\text{Draft} \longrightarrow \text{Pending Inspection} \longrightarrow \text{Received \& Posted}$$
- **عمليات الصرف والتوزيع (Outbound - Dispatch):**
  $$\text{Pending Allocation} \longrightarrow \text{Picking} \longrightarrow \text{Packing} \longrightarrow \text{Shipped}$$
- **التحويلات بين المستودعات (Internal Transfers):**
  $$\text{Requested} \longrightarrow \text{Dispatched (In-Transit)} \longrightarrow \text{Received \& Accepted}$$
- **تسويات الجرد وتالف المخزون (Inventory Adjustments):**
  - تتطلب إرفاق سبب الإتلاف/الفقد (`ReasonCode`).
  - إرفاق صورة إثبات فوتوغرافية أو مستند فحص معتمد.
  - موافقة ثنائية (`Dual Approval`) للمبالغ التي تتجاوز السقف المحدد لصلاحية أمين المخزن، ولا تُرحل الحركة إلى القيود المحاسبية إلا بعد اعتماد المدير المالي ومدير العمليات.
