import React from 'react';
import './globals.css';
import {CaregridClient} from './client';
export const metadata = {title: 'CareGrid demo', description: 'Fictional network-wide appointment scheduling and resource planning built from the Pepbits library.'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><CaregridClient/>{children}</body></html>;
}
