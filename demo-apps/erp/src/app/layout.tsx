import React from 'react';
import './globals.css';
import {ErpClient} from './client';
export const metadata = {title: 'ERP demo', description: 'Fictional ERP workflows built from the Pepbits library.'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><ErpClient/>{children}</body></html>;
}
