'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {ApplicationProviders} from '@pepbits/shell/application-providers';
import {productForRole} from '@pepbits/shell';
import {useSession} from '@pepbits/platform/auth';
import {useLocalization} from '@pepbits/i18n/react';
import {API_PRODUCT, useRequest} from './adapters/http';
import {createTenantAdminTransport} from './adapters/tenant-admin';
import {buildProduct, type NavigationRegistry} from './navigation';
import type {Meta} from './modules/tenant-admin/lib/types';
export {useSettingsServices} from '@pepbits/shell/application-providers';

const brand = {name: 'Tenant Admin', tagline: 'Fictional tenant configuration'};
const Publisher = createContext<(registry: NavigationRegistry | null) => void>(() => {});

/**
 * The shared host chain (session, API preferences and tenant policy, runtime catalog, shell) with Tenant Admin navigation.
 * Configuration pages are not listed in the frontend: the sidebar follows the API registry (`GET /meta`) of the signed-in scope.
 */
export function TenantAdminProviders({children, ...props}: Omit<React.ComponentProps<typeof ApplicationProviders>, 'productId' | 'brand' | 'productForRole'>) {
  const [registry, setRegistry] = useState<NavigationRegistry | null>(null);
  const product = useMemo(() => buildProduct(registry), [registry]);
  const forRole = useCallback((role: string) => productForRole(product, role), [product]);
  return <Publisher.Provider value={setRegistry}>
    <ApplicationProviders {...props} productId={API_PRODUCT} brand={brand} productForRole={forRole} className="tenant-admin-page" notice="Fictional demonstration only">
      <RegistrySync/>{children}
    </ApplicationProviders>
  </Publisher.Provider>;
}

/**
 * Reads the registry of the authenticated scope and publishes it, naming canonical catalog keys only where they exist.
 * It lives inside the identity-keyed host, so signing out or another user unmounts it and clears the navigation.
 */
function RegistrySync() {
  const publish = useContext(Publisher), request = useRequest(), {user} = useSession(), {t} = useLocalization();
  const [meta, setMeta] = useState<Pick<Meta, 'categories' | 'resources'> | null>(null);
  const branch = user!.branch;
  useEffect(() => {
    const controller = new AbortController();
    createTenantAdminTransport(request, branch).request<Meta>('/meta', {signal: controller.signal})
      .then(value => { if (!controller.signal.aborted) setMeta(value); }, () => {});
    return () => { controller.abort(); setMeta(null); };
  }, [request, branch]);
  useEffect(() => {
    if (!meta) return;
    const known = (key: string) => t(key) !== key ? key : undefined;
    publish({
      categories: meta.categories.map(category => ({key: category.key, label: category.label, labelKey: known('section.reference-tenant-admin.' + category.key + '.label')})),
      resources: meta.resources.map(resource => ({key: resource.key, label: resource.label, category: resource.category, summary: resource.summary, icon: resource.icon,
        labelKey: known('menu.reference-tenant-admin.reference-tenant-admin-' + resource.key + '.label'), titleKey: known('page.reference-tenant-admin-' + resource.key + '.title')})),
    });
  }, [meta, t, publish]);
  useEffect(() => () => publish(null), [publish]);
  return null;
}
