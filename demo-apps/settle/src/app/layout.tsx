import React from 'react';
import './globals.css';
import {SettleClient} from './client';
export const metadata = {title: 'Settle demo', description: 'Fictional patient billing desk built from the Pepbits library.'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><SettleClient/>{children}</body></html>;
}
