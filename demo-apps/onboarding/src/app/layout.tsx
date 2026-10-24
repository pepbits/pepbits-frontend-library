import React from 'react';
import './globals.css';
import {OnboardingClient} from './client';
export const metadata = {title: {default: 'Orvia Health Cloud onboarding demo', template: '%s | Orvia Health Cloud'}, description: 'Fictional Orvia Health Cloud landing, workspace lookup, sign-in and registration built from the Pepbits library.'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><OnboardingClient/>{children}</body></html>;
}
