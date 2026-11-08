---
name: nextjs-ui
description: Next.js 15 enterprise web dashboard, virtualized tables, RTL/LTR design tokens, and strict i18n key binding.
---
# Next.js Enterprise UI & Harmony Specification

## 1. افتراضية الجداول الكبرى (Data Grid Virtualization)
- في شاشات الجرد والفواتير التي تعرض آلاف السجلات، يُحظر استخدام وسم `<table>` العادي لكل البيانات.
- إلزامي: استخدام Virtualized Lists (مثل `@tanstack/react-virtual`) لحقن العناصر المرئية في الشاشة فقط (60 FPS ثابت).

## 2. التناسق البصري ومنع النصوص النشاز
- **حساب الأبعاد النسبية:** الحاويات تتمدد مع النص دائماً، مع تحديد حد أدنى فقط: `min-w-[120px] w-auto h-auto py-2 px-4`.
- **أمان المحاذاة الثنائية:** استخدام الخصائص المنطقية فقط في Tailwind (`ps-`, `pe-`, `ms-`, `me-`, `text-start`).
- **تنسيق العملات محلياً:**
  `new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)`
  يُمنع لصق رمز العملة يدوياً بجانب الرقم.
