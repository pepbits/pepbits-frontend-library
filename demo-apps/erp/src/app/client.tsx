'use client';
import React, {Suspense, useEffect, useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import {LoadingState} from '@pepbits/components';
import type {NavigationPort} from '@pepbits/platform/navigation';
import {ErpProviders} from '../providers';
import {hrefFor, targetFromPath} from '../navigation';
import {ErpPage} from '../renderer';
function RoutedClient() {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const current = useMemo(() => targetFromPath(pathname, search.toString()), [pathname, search]);
  const navigation = useMemo<NavigationPort>(() => ({current, hrefFor, open: target => router.push(hrefFor(target)), openInNewContext: target => router.push(hrefFor(target))}), [current, router]);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBaseUrl) return <p role="alert">Set NEXT_PUBLIC_API_URL to the demo API base URL before starting the app.</p>;
  return <ErpProviders apiBaseUrl={apiBaseUrl} navigation={navigation}><LandingRedirect pathname={pathname}/><ErpPage target={current}/></ErpProviders>;
}
export function ErpClient() {return <Suspense fallback={<LoadingState/>}><RoutedClient/></Suspense>;}

function LandingRedirect({pathname}:{pathname:string}){const {preferences}=usePreferences(),router=useRouter();useEffect(()=>{if(pathname==='/')router.replace(preferences.defaultModule==='erp2'?'/erp2':'/erp1');},[pathname,preferences.defaultModule,router]);return null;}
