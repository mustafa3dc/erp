export type ExpensePaymentMethod = 'Cash' | 'BankTransfer' | 'Check';
export type ExpenseStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected';

export interface ExpenseCategory {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  budgetLimit?: number;
  totalSpent?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ExpenseVoucher {
  id: string;
  tenantId: string;
  voucherNo: string;
  categoryId: string;
  categoryName?: string;
  treasuryAccountId: string;
  treasuryAccountName?: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  recipient: string;
  paymentMethod: ExpensePaymentMethod;
  notes?: string;
  attachmentUrl?: string;
  status: ExpenseStatus;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  createdBy?: string;
}

export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Expired' | 'Converted';

export interface SalesQuotationItem {
  id: string;
  quotationId: string;
  productId: string;
  productName: string;
  productSku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

export interface SalesQuotation {
  id: string;
  tenantId: string;
  quotationNo: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  warehouseId: string;
  warehouseName?: string;
  date: string;
  validUntil: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  exchangeRate: number;
  notes?: string;
  terms?: string;
  status: QuotationStatus;
  convertedInvoiceId?: string;
  convertedInvoiceNo?: string;
  convertedAt?: string;
  createdAt: string;
  createdBy?: string;
  items: SalesQuotationItem[];
}

export interface PriceListItem {
  id: string;
  priceListId: string;
  productId: string;
  productName?: string;
  productSku?: string;
  basePrice: number;
  customPrice?: number;
  discountPercent: number;
  minQuantity: number;
  maxQuantity?: number;
}

export interface PriceList {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  nameAr?: string;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
  customerTier?: string;
  description?: string;
  createdAt: string;
  items: PriceListItem[];
}

export interface ProductQuantityTier {
  id: string;
  productId: string;
  productSku?: string;
  productName?: string;
  baseSellingPrice?: number;
  minQty: number;
  maxQty?: number | null;
  unitPrice: number;
  updatedAt?: string;
}

export interface ProductBundleItem {
  id: string;
  parentProductId: string;
  parentProductName?: string;
  childProductId: string;
  childProductName: string;
  childProductSku: string;
  quantity: number;
  unitPriceRatio: number;
}

export type PurchaseReturnStatus = 'Draft' | 'Approved' | 'Rejected';
export type RefundMethod = 'SupplierCredit' | 'CashRefund';

export interface PurchaseReturnItem {
  id: string;
  returnId: string;
  productId: string;
  productName: string;
  productSku: string;
  returnedQty: number;
  purchasedQty: number;
  previouslyReturnedQty: number;
  unitCost: number;
  totalCost: number;
  reason?: string;
  batchNumber?: string;
}

export interface PurchaseReturn {
  id: string;
  tenantId: string;
  returnNo: string;
  originalBillId: string;
  originalBillNo: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName?: string;
  treasuryAccountId?: string;
  treasuryAccountName?: string;
  totalAmount: number;
  currency: string;
  exchangeRate: number;
  refundMethod: RefundMethod;
  notes?: string;
  status: PurchaseReturnStatus;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  createdBy?: string;
  items: PurchaseReturnItem[];
}

export type ProductSerialStatus = 'InStock' | 'Sold' | 'Returned' | 'Defective';

export interface ProductSerial {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  productSku: string;
  serialNumber: string;
  warehouseId?: string;
  warehouseName?: string;
  supplierId?: string;
  supplierName?: string;
  purchaseBillId?: string;
  purchaseBillNo?: string;
  purchaseDate?: string;
  customerId?: string;
  customerName?: string;
  salesInvoiceId?: string;
  salesInvoiceNo?: string;
  saleDate?: string;
  warrantyMonths: number;
  warrantyEndDate?: string;
  status: ProductSerialStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SerialLookupResult {
  serialNumber: string;
  productId: string;
  productName: string;
  productSku: string;
  status: ProductSerialStatus;
  warehouseName?: string;
  supplierName?: string;
  purchaseBillNo?: string;
  purchaseDate?: string;
  customerName?: string;
  salesInvoiceNo?: string;
  saleDate?: string;
  warrantyMonths: number;
  warrantyEndDate?: string;
  isWarrantyActive: boolean;
  warrantyDaysRemaining: number;
}
