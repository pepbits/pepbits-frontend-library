'use client';
import React, {Suspense, useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {LoadingState} from '@pepbits/components';
import type {NavigationPort} from '@pepbits/platform/navigation';
import {CaregridProviders} from '../providers';
import {hrefFor, targetFromPath} from '../navigation';
import {CaregridPage} from '../renderer';
import {createCaregridClient} from '../adapters/caregrid';
function RoutedClient() {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const current = useMemo(() => targetFromPath(pathname, search.toString()), [pathname, search]);
  const navigation = useMemo<NavigationPort>(() => ({current, hrefFor, open: target => router.push(hrefFor(target)), openInNewContext: target => router.push(hrefFor(target))}), [current, router]);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL, schedulingUrl = process.env.NEXT_PUBLIC_CAREGRID_API_URL;
  const client = useMemo(() => schedulingUrl ? createCaregridClient(schedulingUrl) : null, [schedulingUrl]);
  if (!apiBaseUrl || !client) return <p role="alert">Set NEXT_PUBLIC_API_URL (demo host API) and NEXT_PUBLIC_CAREGRID_API_URL (CareGrid scheduling API) before starting the app.</p>;
  return <CaregridProviders apiBaseUrl={apiBaseUrl} navigation={navigation} client={client}><CaregridPage target={current}/></CaregridProviders>;
}
export function CaregridClient() {return <Suspense fallback={<LoadingState/>}><RoutedClient/></Suspense>;}
