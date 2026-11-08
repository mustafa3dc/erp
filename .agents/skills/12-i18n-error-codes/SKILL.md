---
name: i18n-error-codes
description: Zero hardcoded strings policy, Bi-Directional (Bidi) text formatting, and centralized enterprise API error response contracts.
---
# Internationalization (i18n) & Centralized Error Codes Specification

## 1. Zero Hardcoded Strings Policy (حظر النصوص الصلبة)

1. **القاعدة الإلزامية:**
   يُمنع منعاً باتاً كتابة أي نص واجهة، تسمية زر، عنوان جدول، أو رسالة تنبيه بشكل صلب داخل كود الـ Backend (.NET)، أو الموبايل (Flutter)، أو الويب (Next.js / React).
2. **مصادر الترجمة الموحدة:**
   - **Next.js / React:** `public/locales/{ar,en}/common.json` أو ملفات قواميس الترجمة الموحدة.
   - **Flutter:** `assets/i18n/{ar,en}.json` أو استخدام `AppLocalizations`.
   - **Backend (.NET):** إرجاع مفتاح الخطأ (`ErrorCode`) بدلاً من النص الصلب، أو قراءة رسائل الأخطاء من ملفات الموارد المترجمة (`Resources`).

---

## 2. Bi-Directional (Bidi) Text Engine (محرك النصوص ثنائية الاتجاه)

1. **حقول الأسماء والوصف المختلطة:**
   - استخدام وسم `<bdi>` أو تطبيق `dir="auto"` في كافة عناصر الجداول والكروت لضمان عدم تشوه أو انعكاس النصوص التي تجمع بين اللغة العربية والأحرف والرموز اللاتينية (مثل: "شاشة 65 بوصة QLED").
2. **الأكواد والأرقام الفنية:**
   - تثبيت اتجاه الأكواد والسيريال والباركود والمعرفات على `dir="ltr"` واستخدام خطوط أحادية المسافة `font-mono`.
3. **أرقام الهواتف والمبالغ:**
   - عرض أرقام الهواتف والعملات باتجاه `ltr` لمنع انقلاب الأقواس وعلامات الموجب والسالب.

---

## 3. Centralized API Error Response Contract (عقد أخطاء الـ API الموحد)

كافة استجابات الأخطاء والفشل الصادرة من الـ Backend تعود بصيغة وهيكلية موحدة دون أي استثناء:

```json
{
  "success": false,
  "errorCode": "ERR_INSUFFICIENT_STOCK",
  "message": "الرصيد المتاح في المستودع غير كافٍ لإتمام العملية",
  "params": {
    "sku": "SAMS-TV-65",
    "requestedQty": 50,
    "availableQty": 30
  },
  "timestamp": "2026-10-17T03:10:00Z"
}
```

### معايير الـ Error Codes:
- جميع رموز الأخطاء بصيغة `UPPER_SNAKE_CASE` مسبوقة بـ `ERR_`.
- أمثلة معتمدة:
  - `ERR_INSUFFICIENT_STOCK`: رصيد المخزن غير كافٍ.
  - `ERR_CREDIT_LIMIT_EXCEEDED`: تجاوز الحد الائتماني للعميل.
  - `ERR_WAREHOUSE_INACTIVE`: المستودع المستهدف معطل أو غير نشط.
  - `ERR_COST_ACCESS_DENIED`: محاولة الوصول لبيانات التكلفة بدون صلاحية.
  - `ERR_IDEMPOTENCY_CONFLICT`: تكرار العملية بنفس المفتاح الفريد.
