import React from 'react';
import './globals.css';
import {TenantAdminClient} from './client';
export const metadata = {title: 'Tenant Admin demo', description: 'Fictional tenant configuration workflows built from the Pepbits library.'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><TenantAdminClient/>{children}</body></html>;
}
