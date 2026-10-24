import React from 'react';
import './globals.css';
import {SchoolClient} from './client';
export const metadata = {title: 'SCHOOL demo', description: 'Fictional SCHOOL workflows built from the Pepbits library.'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><SchoolClient/>{children}</body></html>;
}
