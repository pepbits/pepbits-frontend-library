'use client';
import React, {Suspense, useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {LoadingState} from '@pepbits/components';
import type {NavigationPort} from '@pepbits/platform/navigation';
import {SettleProviders} from '../providers';
import {hrefFor, targetFromPath, type SettleTarget} from '../navigation';
import {SettleAppPage} from '../renderer';
function RoutedClient() {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const current = useMemo(() => targetFromPath(pathname, search.toString()), [pathname, search]);
  const navigation = useMemo<NavigationPort>(() => ({current, hrefFor, open: target => router.push(hrefFor(target as SettleTarget)), openInNewContext: target => {window.open(hrefFor(target as SettleTarget), '_blank', 'noopener');}}), [current, router]);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL, settleApiBaseUrl = process.env.NEXT_PUBLIC_SETTLE_API_URL;
  if (!apiBaseUrl || !settleApiBaseUrl) return <p role="alert">Set NEXT_PUBLIC_API_URL (demo host API) and NEXT_PUBLIC_SETTLE_API_URL (Settle billing API) before starting the app.</p>;
  return <SettleProviders apiBaseUrl={apiBaseUrl} settleApiBaseUrl={settleApiBaseUrl} navigation={navigation}><SettleAppPage target={current}/></SettleProviders>;
}
export function SettleClient() {return <Suspense fallback={<LoadingState/>}><RoutedClient/></Suspense>;}
