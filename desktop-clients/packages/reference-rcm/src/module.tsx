"use client";
import { useMemo } from "react";
import { LocalizedText, LocalizationAliasProvider } from "@pepbits/ops-ui";
import { DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import { ReferenceHostProvider, ReferenceLink, referenceScopeKey, type ReferenceModuleProps } from "@pepbits/reference-host";
import rcmCopy from "../rcm-copy.json";
import { AgingDashboard } from "./components/dashboards/AgingDashboard";
import { ApprovalsInbox } from "./components/dashboards/ApprovalsInbox";
import { HomeDashboard } from "./components/dashboards/HomeDashboard";
import { ReportsDashboard } from "./components/dashboards/ReportsDashboard";
import { useApp } from "./components/shell/context";
import { RcmShell } from "./components/shell/RcmShell";
import { Card } from "./components/ui/controls";
import { ToastProvider } from "./components/ui/Toast";
import { ResourcePage } from "./components/workspace/ResourcePage";
import { RcmDataProvider } from "./lib/api";
import { resolveRcmRoute, rcmPaths, type RcmMatch } from "./routes";

function NotFound() {
  const { meta } = useApp();
  const pages = meta.categories.reduce((n, c) => n + c.pages.length, 0);
  return (
    <div className="flex h-full items-center justify-center">
      <Card shadow="none" tone="transparent" className="panel max-w-md p-8 text-center">
        <h2 className="text-[20px] font-semibold"><LocalizedText message="This page doesn’t exist" /></h2>
        <p className="mt-2 text-muted"><LocalizedText message="Use the navigation or press Ctrl+K to jump to any of the {value0} workspace pages." values={{ value0: pages }} /></p>
        <ReferenceLink href={rcmPaths.home()} className="btn-primary mt-5"><LocalizedText message="Go to billing home" /></ReferenceLink>
      </Card>
    </div>
  );
}

function NoSuchPage({ resource }: { resource: string }) {
  const { meta } = useApp();
  const pages = meta.categories.reduce((n, c) => n + c.pages.length, 0);
  return (
    <Card shadow="none" tone="transparent" className="panel mx-auto mt-16 max-w-md p-8 text-center">
      <h2 className="text-[20px] font-semibold"><LocalizedText message="No such workspace page" /></h2>
      <p className="mt-2 text-muted"><LocalizedText message="“{value0}” is not one of the {value1} pages." values={{ value0: resource, value1: pages }} /></p>
      <ReferenceLink href={rcmPaths.home()} className="btn-primary mt-5"><LocalizedText message="Back to billing home" /></ReferenceLink>
    </Card>
  );
}

function Page({ match }: { match: RcmMatch | null }) {
  const { resource } = useApp();
  if (!match) return <NotFound />;
  switch (match.kind) {
    case "home": return <HomeDashboard />;
    case "aging": return <AgingDashboard />;
    case "reports": return <ReportsDashboard />;
    case "approvals": return <ApprovalsInbox />;
    case "resource": {
      const res = resource(match.resource);
      return res ? <ResourcePage key={res.key} res={res} query={match.query} /> : <NoSuchPage resource={match.resource} />;
    }
  }
}

/**
 * RCM (revenue cycle) workspace. The host supplies the enterprise header and sidebar; this renders only the source page body plus a
 * compact toolbar and status strip. Identity comes from the host session (GET /meta through the host API transport: `currentUser`
 * and `hostManagedIdentity`). Everything cached or in flight lives under the authenticated scope key, so a tenant, branch, user
 * or role change disposes the workspace, aborts its requests and starts empty.
 */
export function ReferenceRcmModule({ path, host }: ReferenceModuleProps) {
  const current = useMemo(() => ({ ...host, path }), [host, path]);
  const match = resolveRcmRoute(path);
  return (
    <ReferenceHostProvider host={current}><LocalizationAliasProvider aliases={rcmCopy}>
      <div className="reference-rcm" data-reference-module="rcm" data-rcm-font={host.preferences.fontFamily === DEFAULT_PREFERENCES.fontFamily ? "reference" : "host"} data-rcm-table={host.preferences.density === DEFAULT_PREFERENCES.density && host.preferences.wrapCellText === DEFAULT_PREFERENCES.wrapCellText ? "reference" : "host"} data-theme={host.preferences.theme} data-density={host.preferences.density}>
        <RcmDataProvider key={referenceScopeKey(host.scope)}>
          <ToastProvider>
            <RcmShell match={match} path={path}>
              <Page match={match} />
            </RcmShell>
          </ToastProvider>
        </RcmDataProvider>
      </div>
    </LocalizationAliasProvider></ReferenceHostProvider>
  );
}
