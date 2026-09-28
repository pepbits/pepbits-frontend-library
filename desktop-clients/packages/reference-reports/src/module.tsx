"use client";
/*
 * @pepbits/reference-reports module root. Renders inside the host's existing shell: no sidebar, header,
 * sign-in form or nested app frame. Everything below is keyed by the authenticated scope, so a tenant,
 * application, branch, user or role change discards all module state and in-flight results.
 */
import './reports.css';
import React, { useMemo } from 'react';
import { useLocalization } from '@pepbits/ops-ui';
import { ReferenceHostProvider, referenceScopeKey, useReferenceHost, type ReferenceModuleProps } from '@pepbits/reference-host';
import { ReportsClientProvider, usePageData } from './api/client';
import { NotFoundPage, PageError } from './pages/common';
import * as Pages from './pages/pages';
import { loaderPath, matchReportsRoute, type ReportsRouteId } from './routes';
import { ModuleBar, ModuleFootnote, type ReportsSession } from './shell/ModuleBar';
import { ToastProvider } from './ui/Toast';
import {SecureDownload} from './jobs/SecureDownload';

const PAGES: Record<ReportsRouteId, (props: Pages.PageProps) => React.ReactNode> = {
  login: Pages.LoginBoundaryPage,
  overview: Pages.OverviewPage,
  library: Pages.LibraryPage,
  report: Pages.ReportPage,
  builder: Pages.BuilderListPage,
  'builder-edit': Pages.BuilderEditPage,
  dashboards: Pages.DashboardsPage,
  dashboard: Pages.DashboardPage,
  jobs: Pages.JobsPage,
  job: Pages.JobPage,
  schedules: Pages.SchedulesPage,
  'email-in': Pages.EmailInPage,
  'api-keys': Pages.ApiKeysPage,
  'admin-access': Pages.AdminAccessPage,
  'admin-users': Pages.AdminUsersPage,
  'admin-settings': Pages.AdminSettingsPage,
  'admin-sources': Pages.AdminSourcesPage,
  'admin-audit': Pages.AdminAuditPage,
  'admin-outbox': Pages.AdminOutboxPage,
};

function ReportsRoot() {
  const host = useReferenceHost();
  const { direction } = useLocalization();
  const path = host.path ?? '/';
  const match = useMemo(() => matchReportsRoute(path), [path]);
  const session = usePageData<ReportsSession>('/api/session');
  const Page = match ? PAGES[match.route.id] : null;
  const downloadToken=/^\/downloads\/([A-Za-z0-9_.-]+)$/.exec(path)?.[1];
  const p = host.preferences;
  return (
    <div className="lumen-reports" dir={direction} data-reduced-motion={p.reducedMotion ? 'true' : 'false'} data-density={p.density} data-route={match?.route.id ?? 'not-found'}>
      {session.error ? (
        <PageError error={session.error} onRetry={session.reload} />
      ) : (
        <>
          <ModuleBar session={session.data} />
          <main className="lr-main">
            {downloadToken?<SecureDownload key={path} token={downloadToken}/>:match && Page ? <Page key={path} match={match} loader={loaderPath(match)} session={session.data} /> : <NotFoundPage />}
          </main>
          <ModuleFootnote session={session.data} />
        </>
      )}
    </div>
  );
}

/** Public entry: `path` is the module-relative path (for example "/reports/payer-mix"), `host` the authenticated adapter. */
export function ReferenceReportsModule({ path, host }: ReferenceModuleProps) {
  const scopedHost = useMemo(() => ({ ...host, path }), [host, path]);
  return (
    <ReferenceHostProvider host={scopedHost}>
      <ReportsScope key={referenceScopeKey(host.scope)} />
    </ReferenceHostProvider>
  );
}

function ReportsScope() {
  return (
    <ReportsClientProvider>
      <ToastProvider>
        <ReportsRoot />
      </ToastProvider>
    </ReportsClientProvider>
  );
}
