'use client';
import React, {useMemo} from 'react';
import {useSession} from '@pepbits/platform/auth';
import {useNavigation} from '@pepbits/platform/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import type {ReferenceHost} from '@pepbits/shell/reference-host';
import {useRequest} from '../../adapters/http';
import {createTenantAdminTransport, TENANT_ADMIN_MODULE_ID} from '../../adapters/tenant-admin';
import {hrefFor, targetFromPath, type TenantAdminTarget} from '../../navigation';
import {ReferenceTenantAdminModule} from './module';

/**
 * Renderer for every Tenant Admin page. The same component stays mounted across Tenant Admin routes, so the module's
 * scope-keyed data store (registry, counts, option lists) survives navigation and is disposed only on a scope change.
 */
export function TenantAdminPage({target}: PageRenderContext) {
  const request = useRequest(), {user} = useSession(), preference = usePreferences(), navigation = useNavigation();
  const path = (target as TenantAdminTarget).path ?? hrefFor(target as TenantAdminTarget);
  const transport = useMemo(() => createTenantAdminTransport(request, user!.branch), [request, user!.branch]);
  const host = useMemo<ReferenceHost>(() => {
    const route = (destination: string) => {const [pathname, query] = destination.split('?'); return targetFromPath(pathname || '/', query ?? '');};
    return {
      scope: {tenantId: user!.tenantId, applicationId: 'nexora', branchId: user!.branch, moduleId: TENANT_ADMIN_MODULE_ID, userId: user!.id, roles: [user!.role]},
      preferences: preference.preferences,
      preferenceHost: {preferences: preference.preferences, preferencePolicy: preference.preferencePolicy, preferencesAvailable: preference.preferencesAvailable, onPreferenceChange: (key, value) => void preference.update({[key]: value})},
      path, request: transport.request, navigate: destination => navigation.open(route(destination)), hrefFor: destination => hrefFor(route(destination)),
    };
  }, [transport, user, preference, path, navigation]);
  return <ReferenceTenantAdminModule path={path} host={host}/>;
}
