'use client';
import React, {Suspense, useEffect, useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import {LoadingState} from '@pepbits/components';
import type {NavigationPort} from '@pepbits/platform/navigation';
import {HealthcareProviders} from '../providers';
import {hrefFor, targetFromPath} from '../navigation';
import {HealthcarePage} from '../renderer';
function RoutedClient() {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const current = useMemo(() => targetFromPath(pathname, search.toString()), [pathname, search]);
  const navigation = useMemo<NavigationPort>(() => ({current, hrefFor, open: target => router.push(hrefFor(target)), openInNewContext: target => router.push(hrefFor(target))}), [current, router]);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBaseUrl) return <p role="alert">Set NEXT_PUBLIC_API_URL to the demo API base URL before starting the app.</p>;
  return <HealthcareProviders apiBaseUrl={apiBaseUrl} navigation={navigation}><LandingRedirect pathname={pathname}/><HealthcarePage target={current}/></HealthcareProviders>;
}
function LandingRedirect({pathname}:{pathname:string}) {
 const {preferences}=usePreferences(),router=useRouter();
 useEffect(()=>{if(pathname==='/')router.replace(preferences.defaultModule==='reference-rcm'?'/rcm':preferences.defaultModule==='reference-pharmacy'?'/pharmacy':preferences.defaultModule==='library'?'/patient-query':['reference-lis1','reference-lis2','reference-ris1'].includes(preferences.defaultModule)?'/'+preferences.defaultModule.slice(10):'/suite');},[pathname,preferences.defaultModule,router]);return null;
}
export function HealthcareClient() {return <Suspense fallback={<LoadingState/>}><RoutedClient/></Suspense>;}
