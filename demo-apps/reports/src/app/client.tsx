'use client';
import React, {Suspense, useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';

import {LoadingState} from '@pepbits/components';
import type {NavigationPort} from '@pepbits/platform/navigation';
import {ReportsProviders} from '../providers';
import {hrefFor, targetFromPath} from '../navigation';
import {ReportsApplicationPage} from '../renderer';
function RoutedClient() {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const current = useMemo(() => targetFromPath(pathname, search.toString()), [pathname, search]);
  const navigation = useMemo<NavigationPort>(() => ({current, hrefFor, open: target => router.push(hrefFor(target)), openInNewContext: target => router.push(hrefFor(target))}), [current, router]);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBaseUrl) return <p role="alert">Set NEXT_PUBLIC_API_URL to the demo API base URL before starting the app.</p>;
  return <ReportsProviders apiBaseUrl={apiBaseUrl} navigation={navigation}><ReportsApplicationPage target={current}/></ReportsProviders>;
}
export function ReportsClient() {return <Suspense fallback={<LoadingState/>}><RoutedClient/></Suspense>;}

