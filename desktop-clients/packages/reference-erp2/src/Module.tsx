'use client';
import { useMemo } from 'react';
import { ReferenceHostProvider, referenceScopeKey, type ReferenceHost } from '@pepbits/reference-host';
import { KeystoneLoginPage, KeystoneNotFound, KeystoneRegistryPage, KeystoneVariantProvider, ReferenceScopeStore, RouteParamsContext, ToastProvider, matchReferencePath, type KeystoneVariantConfig } from '@pepbits/reference-keystone-core';
import { PageTitleProvider } from './components/shell/pageTitle';
import { RecordRoute } from './components/record/RecordRoute';
import { PAGES, SECTIONS } from './lib/registry';
import { TEMPLATES } from './components/templates';

export interface ReferenceErp2ModuleProps { path: string; host: ReferenceHost }

export const REFERENCE_ERP2_MODULE_ID = 'reference-erp2';
const VARIANT: KeystoneVariantConfig = { id: 'erp2', records: true, pages: PAGES, sections: SECTIONS, templates: TEMPLATES };

/**
 * Keystone ERP2 reference frontend hosted inside an existing shell: worklists plus the
 * full-page record screens (new / view / edit). Page-level RecordShell headers are kept;
 * application chrome (AppShell/Header/Sidebar) belongs to the host.
 * The effective scope always carries moduleId 'reference-erp2', so scoped caches,
 * view state and the remount key are isolated per variant as well as per tenant,
 * application, branch, user and roles.
 */
export function ReferenceErp2Module({ path, host }: ReferenceErp2ModuleProps) {
  const scoped = useMemo<ReferenceHost>(() => ({ ...host, path, scope: { ...host.scope, moduleId: REFERENCE_ERP2_MODULE_ID } }), [host, path]);
  const match = useMemo(() => matchReferencePath(path, { records: true, pages: PAGES }), [path]);
  const params = useMemo(() => (match.kind === 'page' || match.kind === 'record' ? { section: match.section, slug: match.slug, id: match.kind === 'record' ? match.id : undefined } : {}), [match]);
  return (
    <ReferenceHostProvider host={scoped}>
      {/* Keyed by scope: a tenant/app/branch/user/role/module switch remounts every page,
          draft, fetched row, route param and toast instead of carrying them across. */}
      <ReferenceScopeStore key={referenceScopeKey(scoped.scope)}>
        <KeystoneVariantProvider config={VARIANT}>
          <ToastProvider>
          <PageTitleProvider>
            <div className="reference-erp2 reference-keystone h-full min-h-0 text-ink" data-reference-route={match.kind}>
              <RouteParamsContext.Provider value={params}>
                {match.kind === 'login' ? <KeystoneLoginPage />
                  : match.kind === 'page' ? <KeystoneRegistryPage />
                  : match.kind === 'record' ? <RecordRoute mode={match.mode} />
                  : <KeystoneNotFound />}
              </RouteParamsContext.Provider>
            </div>
          </PageTitleProvider>
          </ToastProvider>
        </KeystoneVariantProvider>
      </ReferenceScopeStore>
    </ReferenceHostProvider>
  );
}
