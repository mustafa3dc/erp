import React from 'react';

export const metadata = {
  title: 'ZiloX Enterprise Suite | نظام إدارة العمليات والمتاجر',
  description: 'Multi-Tenant Cloud POS & Warehouse Management ERP'
};

export default function TenantErpRootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tenant-erp-boundary min-h-screen bg-zinc-950 text-zinc-100">
      {/* Tenant Isolated Shell: Encapsulates POS, Inventory, Invoices, Transfers */}
      {children}
    </div>
  );
}
