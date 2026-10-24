import React from 'react';
import './globals.css';
import {AllyVoraClient} from './client';
export const metadata = {title: 'AllyVora patient registration demo', description: 'Fictional AllyVora patient registration built from the Pepbits library.'};
// The persistent root layout owns the host, so moving between register and record keeps session-scoped module state.
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><AllyVoraClient/>{children}</body></html>;
}
