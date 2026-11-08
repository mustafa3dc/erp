---
name: anti-laziness-qa
description: Enforces full code generation without placeholders, validates zero hardcoded strings, and mandates complete production code.
---
# Strict Quality & Anti-Laziness Guardrail

## 1. الحظر المطلق للاختصارات (Zero-Omission Policy)
- يُمنع منعاً باتاً إنتاج أي كود يحتوي على:
  - `// TODO` أو `// Later`
  - `// Add remaining properties`
  - `/* Repeat for other entities */`
  - `...rest of code`
- يجب كتابة الكود كاملاً متضمناً كافة الـ Imports، والـ Validations، والـ Mapping، ومعالجة كافة حالات الاستثناء.

## 2. بوابة القبول الذاتي (Mandatory Pre-Flight Checks)
قبل تقديم أي كود للطلب، يفحص الوكيل هذه الشروط:
1. هل هناك أي نص غير مسحوب من مفاتيح الترجمة؟ (إذا نعم، ارفض المخرج وأعد كتابته).
2. هل تم استخدام `decimal` بدقة 4 خانات عشرية لكافة الحسابات؟
3. هل كود المخزن محمي بـ Redis Lock وقيد قاعدة البيانات؟
4. هل استجابة الـ API تتبع عقد `ApiResponse` الموحد؟
