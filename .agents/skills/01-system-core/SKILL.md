---
name: system-core
description: Enterprise core architecture, multi-branch data isolation, multi-currency exchange handling, and idempotency guarantees.
---
# Enterprise Core & Security Specification

## 1. عزل بيانات الفروع (Multi-Branch Isolation)
- كل عملية جرد أو بيع أو استعلام يجب أن ترتبط بـ `BranchId` و `WarehouseId`.
- تطبيق فلتر استعلام تلقائي في EF Core:
  `builder.Entity<T>().HasQueryFilter(x => x.BranchId == _currentUser.BranchId);`
- يُمنع صرف بضاعة من مخزن فرع آخر إلا عبر وثيقة تحويل مخزني رسمية (`StockTransferOrder`) بحالة `APPROVED`.

## 2. نظام العملات وسعر الصرف المتقلب (Multi-Currency Protocol)
- النظام يدعم العملة الأساسية (مثل IQD) والعملة الثانوية (مثل USD) بالتوازي.
- كل حركة مالية أو فاتورة يجب أن تسجل:
  1. `AmountInCurrency`: المبلغ بالعملة التي دفع بها العميل.
  2. `ExchangeRate`: سعر الصرف اللحظي وقت إصدار الفاتورة.
  3. `BaseCurrencyAmount`: المبلغ المكافئ بالعملة الأساسية (لتقارير الأرباح والتدقيق).
- يُمنع احتساب أرباح المواد على سعر الصرف الحالي؛ الأرباح تعتمد دائماً على سعر الصرف التاريخي وقت إتمام الحركة.

## 3. مفتاح عدم التكرار (Idempotency Key)
- كل طلب إنشاء فاتورة أو سند قبض من الواجهات يجب أن يرسل Header إلزامي:
  `X-Idempotency-Key: <UUID-v4>`
- إذا تكرر الطلب بنفس المفتاح خلال 60 دقيقة نتيجة انقطاع الشبكة أو ضغط الزر مرتين:
  يرد السيرفر بنسخة من الرد السابق مع حالة `200 OK` دون تكرار الخصم المخزني أو المالي.
