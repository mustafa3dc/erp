---
name: ledger-engine
description: Financial transaction rules, immutable audit ledger, inventory adjustments, sales returns, and credit limits.
---
# Financial & Stock Ledger Specification

## 1. دورة حياة المرتجعات (Returns Processing)
- **مرتجع المبيعات (Sales Return):**
  - لا يُقبل أي مرتجع إلا برقم فاتورة بيع أصلية (`OriginalInvoiceId`).
  - التحقق التلقائي من أن الكمية المرتجعة لا تتجاوز (`SoldQuantity - PreviouslyReturnedQuantity`).
  - إنشاء حركة مخزنية من نوع `SALE_RETURN` تعيد البضاعة لنفس المخزن، وإصدار سند صرف أو قيد تخفيض لذمة العميل.

## 2. الجرد الفعلي والتسويات المخزنية (Inventory Reconciliation)
- التسوية المخزنية نوعان حصراً:
  - `ADJUSTMENT_SURPLUS`: زيادة مخزنية ناتجة عن جرد (يولد قيد وارد بتكلفة الشراء الأخيرة).
  - `ADJUSTMENT_DEFICIT`: عجز مخزني ناتج عن تلف أو فقدان (يخصم المخزون ويسجل كخسارة تشغيلية).
- يُمنع إغلاق جلسة الجرد إذا كان الفارق المالي يتجاوز صلاحية المستخدم، وتُعلق لحين اعتماد المدير المالي.

## 3. مراقبة الحد الائتماني (Strict Credit Limit)
- عند البيع بالآجل (Credit Sale):
  `NewBalance = CurrentBalance + InvoiceTotal;`
  `if (NewBalance > CreditLimit) throw new BusinessException("ERR.FINANCE.CREDIT_LIMIT_EXCEEDED");`
- الحسابات تشمل الفواتير المعتمدة غير المدفوعة والشيكات تحت التحصيل.
