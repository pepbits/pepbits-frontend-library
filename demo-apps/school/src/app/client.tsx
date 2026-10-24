'use client';
import React, {Suspense, useEffect, useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import {LoadingState} from '@pepbits/components';
import type {NavigationPort} from '@pepbits/platform/navigation';
import {useSession} from '@pepbits/platform/auth';
import {grantedRoles} from '../navigation';
import {schoolRoleView} from '../modules/school/role-views';
import {SchoolProviders} from '../providers';
import {hrefFor, targetFromPath} from '../navigation';
import {SchoolPage} from '../renderer';
function RoutedClient() {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const current = useMemo(() => targetFromPath(pathname, search.toString()), [pathname, search]);
  const navigation = useMemo<NavigationPort>(() => ({current, hrefFor, open: target => router.push(hrefFor(target)), openInNewContext: target => router.push(hrefFor(target))}), [current, router]);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBaseUrl) return <p role="alert">Set NEXT_PUBLIC_API_URL to the demo API base URL before starting the app.</p>;
  return <SchoolProviders apiBaseUrl={apiBaseUrl} navigation={navigation}><LandingRedirect pathname={pathname}/><SchoolPage target={current}/></SchoolProviders>;
}
export function SchoolClient() {return <Suspense fallback={<LoadingState/>}><RoutedClient/></Suspense>;}

function LandingRedirect({pathname}:{pathname:string}){const {preferences}=usePreferences(),router=useRouter();const {user}=useSession();useEffect(()=>{if(pathname==='/'||pathname==='/login'){const roles=grantedRoles(user!),remembered=schoolRoleView(preferences.defaultModule);const role=remembered&&roles.includes(remembered.role)?remembered.role:roles[0];if(role)router.replace('/dashboard?role='+role);}},[pathname,preferences.defaultModule,router,user]);return null;}
