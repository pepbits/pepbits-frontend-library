'use client';
import { useMemo } from 'react';
import { ReferenceHostProvider, referenceScopeKey, type ReferenceHost } from '@pepbits/reference-host';
import { KeystoneLoginPage, KeystoneNotFound, KeystoneRegistryPage, KeystoneVariantProvider, ReferenceScopeStore, RouteParamsContext, ToastProvider, matchReferencePath, type KeystoneVariantConfig } from '@pepbits/reference-keystone-core';
import { PAGES, SECTIONS } from './lib/registry';
import { TEMPLATES } from './components/templates';

export interface ReferenceErp1ModuleProps { path: string; host: ReferenceHost }

export const REFERENCE_ERP1_MODULE_ID = 'reference-erp1';
const VARIANT: KeystoneVariantConfig = { id: 'erp1', records: false, pages: PAGES, sections: SECTIONS, templates: TEMPLATES };

/**
 * Keystone ERP1 reference frontend hosted inside an existing shell. Renders page content
 * only (no AppShell/Header/Sidebar); the host owns navigation chrome, identity and theme.
 * The effective scope always carries moduleId 'reference-erp1', so scoped caches,
 * view state and the remount key are isolated per variant as well as per tenant,
 * application, branch, user and roles.
 */
export function ReferenceErp1Module({ path, host }: ReferenceErp1ModuleProps) {
  const scoped = useMemo<ReferenceHost>(() => ({ ...host, path, scope: { ...host.scope, moduleId: REFERENCE_ERP1_MODULE_ID } }), [host, path]);
  const match = useMemo(() => matchReferencePath(path, { records: false, pages: PAGES }), [path]);
  const params = useMemo(() => (match.kind === 'page' ? { section: match.section, slug: match.slug } : {}), [match]);
  return (
    <ReferenceHostProvider host={scoped}>
      {/* Keyed by scope: a tenant/app/branch/user/role/module switch remounts every page,
          draft, fetched row, route param and toast instead of carrying them across. */}
      <ReferenceScopeStore key={referenceScopeKey(scoped.scope)}>
        <KeystoneVariantProvider config={VARIANT}>
          <ToastProvider>
            <div className="reference-erp1 reference-keystone h-full min-h-0 text-ink" data-reference-route={match.kind}>
              <RouteParamsContext.Provider value={params}>
                {match.kind === 'login' ? <KeystoneLoginPage /> : match.kind === 'page' ? <KeystoneRegistryPage /> : <KeystoneNotFound />}
              </RouteParamsContext.Provider>
            </div>
          </ToastProvider>
        </KeystoneVariantProvider>
      </ReferenceScopeStore>
    </ReferenceHostProvider>
  );
}
