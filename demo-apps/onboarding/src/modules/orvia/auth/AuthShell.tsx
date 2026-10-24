'use client';
import React, {type ReactNode} from 'react';
import {Globe, LockKeyhole, ShieldCheck} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {Logo} from '../ui/Logo';

/** Split layout for workspace and sign-in screens: brand rail on large screens, form area everywhere. Fills the shell content area. */
export function AuthShell({aside, children}: {aside?: ReactNode; children: ReactNode}) {
  const {t} = useLocalization();
  return <div className="flex min-h-full w-full flex-1 flex-col lg:min-h-0 lg:flex-row">
    <aside data-orvia-rail className="relative hidden w-[38%] max-w-[600px] shrink-0 overflow-hidden rounded-2xl bg-rail text-white lg:flex">
      <div className="bg-chart-grid absolute inset-0" aria-hidden="true"/>
      <div className="relative flex h-full w-full flex-col p-10 xl:p-12">
        <Logo tone="light"/>
        <div className="my-auto py-10">{aside}</div>
        <ul className="space-y-2.5 text-sm text-rail-100">
          <li className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 text-mint" aria-hidden="true"/>{t('HIPAA and GDPR controls, audited every year')}</li>
          <li className="flex items-center gap-2.5"><LockKeyhole className="h-4 w-4 text-mint" aria-hidden="true"/>{t("Each organization's data isolated in its own tenant")}</li>
          <li className="flex items-center gap-2.5"><Globe className="h-4 w-4 text-mint" aria-hidden="true"/>{t('Hosted in 8 regions with local data residency')}</li>
        </ul>
      </div>
    </aside>
    <div className="flex min-h-full flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6 lg:hidden"><Logo/></header>
      <div className="flex w-full flex-1 flex-col px-4 sm:px-6 lg:px-12 xl:px-16">{children}</div>
    </div>
  </div>;
}
