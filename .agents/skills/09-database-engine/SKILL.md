---
name: database-engine
description: PostgreSQL and Redis database engine standards, naming conventions, numeric precision, concurrency locks, indexing, and cache-aside patterns.
---
# Database Engine (PostgreSQL & Redis) Specification

## PostgreSQL Standards

### 1. Naming Conventions (تسمية الجداول والحقول)
- جداول بصيغة الجمع وأحرف صغيرة مع شرطة سفلية: `stock_transactions`, `item_skus`, `warehouses`.
- المفاتيح الأساسية: `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`.
- حقول التتبع الإلزامية في كل جدول:
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `deleted_at TIMESTAMPTZ NULL` (Soft Delete)

### 2. Financial & Quantity Precision (الدقة المالية والكمية)
- **المبالغ المالية والأسعار:** `NUMERIC(18, 4)` لتفادي مشاكل الفواصل العشرية (تُمنع أنواع `float` أو `double` نهائياً).
- **الكميات والأوزان:** `NUMERIC(12, 3)` لدعم الكسور في وحدات القياس (مثل الكيلوجرام واللتر والمتر).

### 3. Concurrency & Race Conditions (التزامن ومنع البيع السالب)
- عند صرف بضاعة أو تحديث رصيد صنف عالي الطلب:
  - استخدام `SELECT ... FOR UPDATE` داخل Transaction صريحة لمنع حدوث Race Condition أو بيع رصيد سالب.
  - أو استخدام أقفال Redis الموزعة (RedLock) لعمليات الـ High-Concurrency.

### 4. Indexes & Query Optimization (الفهارس وتسريع الاستعلامات)
- **فهارس مركبة (Composite Indexes) إلزامية على:**
  - `(warehouse_id, item_sku_id)`
  - `(transaction_type, created_at)`
- **فهارس نصية (GIN Indexes):**
  - فهارس نصية على حقول البحث بالاسم والباركود والسيريال:
    ```sql
    CREATE INDEX idx_products_search_gin 
    ON products 
    USING gin(to_tsvector('simple', barcode || ' ' || name));
    ```

---

## Redis Caching Strategy

### 1. Cache Patterns & Invalidation (أنماط التخزين المؤقت)
- استخدام نمط **Cache-Aside Pattern** لكافة بيانات كتالوج الأصناف وقوائم الأسعار الثابتة.
- **صلاحية الكاش (TTL):** بحد أقصى 15 دقيقة (`TTL: 15m`).
- **الإبطال الفوري (Cache Invalidation):** مسح المفتاح فوراً عند أي عملية تعديل سعر أو تعديل بيانات صنف عبر الـ Backend.

### 2. Rate Limiting & Distributed Locks (تحديد معدل الطلبات والأقفال)
- تطبيق **Rate Limiter** على واجهات الـ APIs لمنع إغراق السيرفر بعمليات المسح المتكرر للباركود.
- أقفال موزعة (RedLock) لمنع تضارب الحركات اللحظية لنفس الصنف في نفس المستودع.
