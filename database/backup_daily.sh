#!/bin/bash
# ==============================================================================
# Automated Daily Database Backup Script for ERP Warehouse Pro (PostgreSQL 16)
# ==============================================================================

set -eo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/daily}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
CONTAINER_NAME="${CONTAINER_NAME:-erp_postgres}"
DB_USER="${DB_USER:-erp_admin}"
DB_NAME="${DB_NAME:-erp_warehouse_db}"

# إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجوداً
mkdir -p "$BACKUP_DIR"

echo "[$(date)] بدء عملية النسخ الاحتياطي لقاعدة البيانات: $DB_NAME..."

# تنفيذ النسخ وضغطه مباشرة
docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/erp_backup_$TIMESTAMP.sql.gz"

echo "[$(date)] تم حفظ النسخة بنجاح: $BACKUP_DIR/erp_backup_$TIMESTAMP.sql.gz"

# تنظيف النسخ القديمة: الاحتفاظ بآخر 14 يوماً فقط وحذف ما قبلها تلقائياً
echo "[$(date)] تنظيف النسخ الاحتياطية الأقدم من 14 يوماً..."
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -exec rm -f {} \;

echo "[$(date)] اكتملت العملية بنجاح."
