import React from 'react';
import SaasAdminLayout from '../../layouts/SaasAdminLayout';
import { SYSTEM_ROLES_CONFIG } from '../../types/rbac';

export const metadata = {
  title: 'ZiloX SaaS Control Plane | مالك المنصة',
  description: 'Isolated Control Plane for SaaS Super Admin and Multi-Tenant Orchestration'
};

export default function SaasAdminRootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="saas-platform-boundary min-h-screen bg-zinc-950 text-zinc-100">
      {/* Zero Retail ERP Leakage: Strictly isolated from Store/POS/Inventory components */}
      {children}
    </div>
  );
}
