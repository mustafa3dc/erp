import React from 'react';

export const metadata = {
  title: 'ZiloX Enterprise Suite | الجيل الجديد لإدارة المستودعات ونقاط البيع السحابية',
  description: 'منظومة سحابية متقدمة لإدارة المستودعات ونقاط البيع السريعة والذكاء الاصطناعي للمنشآت التجارية في العراق'
};

export default function MarketingLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full overflow-y-auto bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30" dir="rtl">
      {children}
    </div>
  );
}
