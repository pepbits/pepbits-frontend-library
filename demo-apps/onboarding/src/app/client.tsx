'use client';
import React, {Suspense, useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {LoadingState} from '@pepbits/components';
import type {NavigationPort} from '@pepbits/platform/navigation';
import {OnboardingProviders} from '../providers';
import {hrefFor, targetFromPath, type OnboardingTarget} from '../navigation';
import {OnboardingPage} from '../renderer';
function RoutedClient() {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const current = useMemo(() => targetFromPath(pathname, search.toString()), [pathname, search]);
  const navigation = useMemo<NavigationPort>(() => ({current, hrefFor, open: target => router.push(hrefFor(target as OnboardingTarget)), openInNewContext: target => {window.open(hrefFor(target as OnboardingTarget), '_blank', 'noopener');}}), [current, router]);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBaseUrl) return <p role="alert">Set NEXT_PUBLIC_API_URL to the demo API base URL before starting the app.</p>;
  return <OnboardingProviders apiBaseUrl={apiBaseUrl} navigation={navigation}><OnboardingPage target={current}/></OnboardingProviders>;
}
export function OnboardingClient() {return <Suspense fallback={<LoadingState/>}><RoutedClient/></Suspense>;}
