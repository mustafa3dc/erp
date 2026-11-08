export interface JournalEntryLine {
  accountCode: string;
  accountNameAr: string;
  accountNameEn: string;
  debit: number;
  credit: number;
  notes?: string;
}

export interface PurchaseJournalEntry {
  id: string;
  billId: string;
  billNumber: string;
  entryDate: string;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface PurchaseInvoiceItem {
  id: string;
  productId?: string;
  sku: string;
  barcode: string;
  nameAr: string;
  nameEn: string;
  uom: string; // وحدة القياس (قطعة، درزن، كرتونة، كجم، طرد)
  quantity: number;
  unitCost: number; // سعر الشراء المفرد في هذه القائمة
  currentSellingPrice: number; // سعر البيع الحالي
  newSellingPrice?: number; // سعر البيع المقترح / المحدث
  lineTotal: number; // الكمية × سعر الشراء
  isNewProduct?: boolean;
}

export type PurchasePaymentTerm = 'cash' | 'credit' | 'partial';

export interface PurchaseInvoice {
  id: string;
  billNumber: string; // كود الفاتورة في النظام مثلاً BILL-2026-0105
  supplierId: string;
  supplierName: string;
  supplierRefNo: string; // رقم قائمة التاجر الورقية (Supplier Ref / Invoice No)
  invoiceDate: string; // تاريخ القائمة YYYY-MM-DD
  warehouseId: string; // كود المستودع المستلم
  warehouseName: string; // اسم المستودع المستلم
  paymentTerms: PurchasePaymentTerm;
  items: PurchaseInvoiceItem[];
  itemsCount: number;
  subtotal: number; // إجمالي قيمة البضاعة
  discount: number; // الخصم الممنوح من التاجر
  shippingCost: number; // مصاريف إضافية / أجور نقل وشحن (Landed Cost)
  netTotal: number; // الصافي النهائي المطلوب
  amountPaid: number; // المبلغ المدفوع كاش حالياً
  balanceDue: number; // المتبقي بذمة المحل (دين مستحق للمورد)
  paidFromAccount?: string; // الخزينة / الصندوق الذي تم الدفع منه
  status: 'POSTED' | 'DRAFT';
  createdAt: string;
  notes?: string;
  journalEntry?: PurchaseJournalEntry;
}

export interface PurchaseOrderItem {
  id: string;
  productId?: string;
  sku: string;
  barcode?: string;
  nameAr: string;
  nameEn?: string;
  uom: string;
  quantity: number;
  estimatedUnitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId?: string;
  supplierName: string;
  targetWarehouseId: string;
  targetWarehouseName: string;
  orderDate: string;
  expectedDate: string;
  items: PurchaseOrderItem[];
  itemsCount: number;
  totalAmount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'RECEIVED_POSTED';
  notes?: string;
  createdAt: string;
}


