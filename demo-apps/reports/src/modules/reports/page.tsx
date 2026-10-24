'use client';
import React, {useMemo} from 'react';
import {useSession} from '@pepbits/platform/auth';
import {useNavigation} from '@pepbits/platform/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {useRequest} from '../../adapters/http';
import {createReportsTransport, REPORTS_MODULE_ID} from '../../adapters/reports';
import {API_PRODUCT} from '../../adapters/http';
import {hrefFor, modulePath, targetFromPath, type ReportsTarget} from '../../navigation';
import {ReferenceReportsModule} from './module';
import type {ReferenceHost} from './host';

/** Page-engine renderer for every Lumen Reports route: builds the module host from the shared application host. */
export function ReportsPage({target}: PageRenderContext) {
  const request = useRequest(), {user} = useSession(), preference = usePreferences(), navigation = useNavigation();
  const path = modulePath(target as ReportsTarget);
  const transport = useMemo(() => createReportsTransport(request, user!.branch), [request, user!.branch]);
  const host = useMemo<ReferenceHost>(() => {
    const route = (destination: string) => {const [pathname, query] = destination.split('?');return targetFromPath(pathname!, query);};
    return {
      scope: {tenantId: user!.tenantId, applicationId: API_PRODUCT, branchId: user!.branch, moduleId: REPORTS_MODULE_ID, userId: user!.id, roles: [user!.role]},
      preferences: preference.preferences,
      preferenceHost: {preferences: preference.preferences, preferencePolicy: preference.preferencePolicy, preferencesAvailable: preference.preferencesAvailable, onPreferenceChange: (key, value) => void preference.update({[key]: value})},
      path, request: transport.request, fetch: transport.fetch,
      navigate: destination => navigation.open(route(destination)), hrefFor: destination => hrefFor(route(destination)),
    };
  }, [transport, user, preference, path, navigation]);
  return <ReferenceReportsModule path={path} host={host}/>;
}
