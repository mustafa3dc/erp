---
name: security-rbac-audit
description: Role-Based Access Control (RBAC), cost masking rules for storekeepers, and immutable audit logging for all mutations.
---
# Security, RBAC & Audit Engine Specification

## 1. Role-Based Access Control (RBAC)

### الأدوار المعتمدة (Predefined Roles):
- **`SuperAdmin`:** تحكم كامل بالمنظومة، صلاحيات النظام، وإعدادات السيرفر.
- **`BranchManager`:** إدارة المستودع المحلي، اعتماد التحويلات، وموافقات التسويات الجردية.
- **`Accountant`:** الاطلاع على التكاليف، هوامش الأرباح، والتقارير المالية والضريبية.
- **`Storekeeper`:** إدخال واستلام وصرف البضاعة، جرد المخزن (محجوب عنه التكاليف والأرباح تماماً).
- **`Cashier`:** عمليات البيع اليومية، إصدار الفواتير المباشرة، وقراءة الباركود وإغلاق ورديات الصندوق.

---

## 2. حظر تسريب التكاليف (Cost Masking Rule)

- **القاعدة الصارمة:**
  حقول `cost_price`، `profit_margin`، و`total_inventory_value` لا تُعاد برمجياً من الـ API لأي مستخدم لا يحمل الصلاحية الصريحة:
  `permission:inventory.cost.view`
- **التطبيق في الـ DTOs:**
  عند تسلسل كائنات المنتجات (Products) لمستخدم برتبة `Storekeeper` أو `Cashier`، يتم حجب أسعار التكلفة برمجياً وتعيينها إلى `null` أو إزالتها كلياً من الـ Response لضمان سرية أسرار التجارة.

---

## 3. سجل الرقابة والتتبع غير القابل للحذف (Audit Trail)

جدول `audit_logs` يسجل كل حركة إدخال، تعديل، أو حذف، بالهيكلية الصارمة التالية:

| الحقل (Field) | النوع (Type) | الوصف |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | المعرف الفريد لسجل المراقبة |
| `user_id` | `UUID / VARCHAR` | هوية الموظف المنفذ للعملية |
| `action` | `VARCHAR(20)` | طبيعة العملية (`INSERT`, `UPDATE`, `DELETE`, `OVERRIDE`) |
| `entity_name` | `VARCHAR(100)` | اسم الجدول المتأثر (مثل `item_skus`, `warehouses`) |
| `entity_id` | `VARCHAR(100)` | رقم أو معرف السجل المتأثر |
| `old_values` | `JSONB NULL` | نسخة JSON بالقيم السابقة قبل التعديل (في حالات UPDATE و DELETE) |
| `new_values` | `JSONB NULL` | نسخة JSON بالقيم الجديدة بعد التعديل (في حالات INSERT و UPDATE) |
| `ip_address` | `VARCHAR(45)` | عنوان الـ IP ونوع المتصفح أو الجهاز المستخدم |
| `timestamp` | `TIMESTAMPTZ` | توقيت العملية بالمللي ثانية |

> **قيد الأمان:** جدول `audit_logs` محمي بمنع عمليات الـ `UPDATE` والـ `DELETE` كلياً بواسطة Database Triggers لمنع مسح أثر أي عملية.
