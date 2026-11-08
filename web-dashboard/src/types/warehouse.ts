export interface Product {
  id: string;
  sku: string;
  barcode: string;
  nameAr: string;
  nameEn: string;
  category: string;
  categoryEn?: string;
  categoryId?: string;
  costPrice: number;
  sellingPrice: number;
  minSellingPrice?: number; // Floor Price (أقل سعر مسموح للبيع)
  unit: string;
  unitEn?: string;
  currentStock: number;
  minStockAlert: number;
  warehouseId: string;
  warehouseName: string;
  warehouseNameEn?: string;
  status: 'available' | 'low' | 'out_of_stock';
  shelf: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type?: 'STORE' | 'WAREHOUSE'; // STORE for direct POS sale, WAREHOUSE for dispatch order
  country?: string;
  countryCode?: string;
  state?: string;
  city: string;
  cityAr?: string;
  cityEn?: string;
  address?: string;
  postalCode?: string;
  timezone?: string;
  currency?: string;
  storageType?: string;
  storageTypeLabelAr?: string;
  storageTypeLabelEn?: string;
  manager: string;
  managerEn?: string;
  phone: string;
  capacity: number;
  occupied: number;
  itemsCount: number;
  status: 'active' | 'maintenance';
}

export interface StockMovement {
  id: string;
  movementNumber: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | string;
  productName: string;
  sku: string;
  fromWarehouse?: string;
  toWarehouse?: string;
  quantity: number;
  unitCost: number;
  // Date fields matching backend server contracts
  movementDate?: string | Date; // Backend StockMovement entity (MovementDate)
  createdAt?: string | Date;    // Backend Domain entity & InventoryTransaction (CreatedAt)
  date?: string | Date;         // Legacy and fallback display date
  operator: string;
  notes?: string;
}

export interface InvoiceLineItem {
  id: string;
  productId: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  total: number;
}

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTaxNo?: string;
  warehouseName: string;
  items?: InvoiceLineItem[];
  itemsCount: number;
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  paymentMethod?: 'cash' | 'card' | 'credit' | 'bank_transfer' | 'installment';
  installmentContractId?: string;
  dispenseMode?: 'IN_STORE' | 'WAREHOUSE_DISPATCH';
  fulfillmentStatus?: 'FULFILLED' | 'PENDING_DISPATCH';
  dispatchOrderId?: string;
  receiptDispenseNotice?: string;
  status: 'paid' | 'pending' | 'credit' | 'refunded';
  date: string;
  dueDate?: string;
  operator?: string;
  notes?: string;
}

export interface PosProduct {
  id: string;
  sku: string;
  barcode: string;
  nameAr: string;
  nameEn: string;
  category: string;
  sellingPrice: number; // Masked: Only retail price
  unit: string;
  currentStock: number;
  maxCashierDiscountPercent: number; // e.g. 5%
}

export interface ManagerOverrideApproval {
  managerId: string;
  managerName: string;
  token: string;
  approvedAt: string;
}

export interface DiscountAuditLog {
  id: string;
  invoiceNumber: string;
  productId: string;
  productSku: string;
  productName: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmountMoney: number;
  originalRetailPrice: number;
  finalSellingPrice: number;
  cashierId: string;
  cashierName?: string;
  wasManagerOverride: boolean;
  approvedByManagerId?: string;
  approvedByManagerName?: string;
  overrideReason?: string;
  createdAt: string;
}

export interface TransactionDetail {
  id: string;
  sku: string;
  productName: string;
  type: 'Inbound' | 'Outbound' | 'Transfer' | 'Adjustment' | string;
  qty: number;
  unit?: string;
  location: string;
  fromLocation?: string;
  toLocation?: string;
  status: 'Received' | 'Pending' | 'Cancelled' | string;
  timestamp?: string;
  // Date fields matching backend server contracts
  movementDate?: string | Date; // Backend StockMovement entity (MovementDate)
  createdAt?: string | Date;    // Backend InventoryTransaction / adjustments (CreatedAt)
  date?: string | Date;         // Standard ISO date
  operator?: string;
  referenceNo?: string;
  unitCost?: number;
}

export type DispenseMode = 'IN_STORE' | 'WAREHOUSE_DISPATCH';
export type FulfillmentStatus = 'FULFILLED' | 'PENDING_DISPATCH';

export interface PosSaleItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  originalPrice?: number;
  discountType?: 'NONE' | 'PERCENT' | 'FIXED';
  discountValue?: number;
  overrideReason?: string;
}

export interface PosSaleTransactionRequest {
  warehouseId: string;
  dispenseMode: DispenseMode;
  targetWarehouseId?: string;
  targetWarehouseName?: string;
  customerName?: string;
  cashierId: string;
  cashierName: string;
  paymentMethod: string;
  items: PosSaleItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
}

export interface WarehouseDispatchOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  shelfLocation?: string;
}

export interface WarehouseDispatchOrder {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  warehouseId: string;
  warehouseName: string;
  customerName: string;
  cashierName: string;
  items: WarehouseDispatchOrderItem[];
  totalQuantity: number;
  status: 'PENDING' | 'FULFILLED' | 'CANCELLED';
  notes?: string;
  createdAt: string;
  fulfilledAt?: string;
  fulfilledBy?: string;
}

export type InstallmentStatus = 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED';
export type InstallmentScheduleStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface InstallmentScheduleItem {
  id: string;
  contractId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  paidDate?: string;
  status: InstallmentScheduleStatus;
  cashierShiftId?: string;
  paymentMethod?: string;
  receiptVoucherNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface InstallmentContract {
  id: string;
  contractNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  guarantorName: string;
  guarantorPhone: string;
  guarantorNationalId?: string;
  totalCashPrice: number;
  totalInstallmentPrice: number;
  downPayment: number;
  remainingAmount: number;
  installmentCount: number;
  monthlyAmount: number;
  startDate: string;
  status: InstallmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  schedules: InstallmentScheduleItem[];
}

export interface InstallmentStats {
  activeContractsCount: number;
  dueThisMonthAmount: number;
  dueThisMonthCount: number;
  overdueAmount: number;
  overdueCount: number;
  totalCollectedAmount: number;
  totalRemainingAmount: number;
}



