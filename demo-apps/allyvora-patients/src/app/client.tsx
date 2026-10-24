'use client';
import React, {Suspense, useEffect, useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {LoadingState} from '@pepbits/components';
import type {NavigationPort} from '@pepbits/platform/navigation';
import {AllyVoraProviders} from '../providers';
import {hrefFor, targetFromPath} from '../navigation';
import {AllyVoraPage} from '../renderer';
function RoutedClient() {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const current = useMemo(() => targetFromPath(pathname, search.toString()), [pathname, search]);
  const navigation = useMemo<NavigationPort>(() => ({current, hrefFor, open: target => router.push(hrefFor(target)), openInNewContext: target => {window.open(hrefFor(target), '_blank', 'noopener');}}), [current, router]);
  const replace = useMemo(() => (href: string) => router.replace(href, {scroll: false}), [router]);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBaseUrl) return <p role="alert">Set NEXT_PUBLIC_API_URL to the demo API base URL before starting the app.</p>;
  return <AllyVoraProviders apiBaseUrl={apiBaseUrl} navigation={navigation}><LandingRedirect pathname={pathname}/><AllyVoraPage target={current} replace={replace}/></AllyVoraProviders>;
}
/** The source app opens the patient register at `/`. */
function LandingRedirect({pathname}: {pathname: string}) {const router = useRouter(); useEffect(() => {if (pathname === '/' || pathname === '/login') router.replace('/patients');}, [pathname, router]); return null;}
export function AllyVoraClient() {return <Suspense fallback={<LoadingState/>}><RoutedClient/></Suspense>;}
