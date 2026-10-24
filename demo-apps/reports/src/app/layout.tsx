import React from 'react';
import './globals.css';
import {ReportsClient} from './client';
export const metadata = {title: 'Lumen Reports demo', description: 'Fictional reporting workflows built from the Pepbits library.'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><ReportsClient/>{children}</body></html>;
}
