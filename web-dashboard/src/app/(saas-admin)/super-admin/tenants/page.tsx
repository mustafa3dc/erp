'use client';

import React from 'react';
import TenantsManagementView from '../../../../components/views/superadmin/TenantsManagementView';

export default function SuperAdminTenantsPage() {
  return (
    <div className="p-6">
      <TenantsManagementView 
        lang="ar" 
        onImpersonate={(tenant) => {
          console.log('Impersonating tenant:', tenant);
        }} 
      />
    </div>
  );
}
