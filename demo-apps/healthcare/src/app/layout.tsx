import React from 'react';
import './globals.css';
export const metadata = {title: 'Healthcare demo', description: 'Fictional healthcare workflows built from the Pepbits library.'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
