"use client";
import { useMemo } from "react";
import { LocalizedText, LocalizationAliasProvider } from "@pepbits/ops-ui";
import { ReferenceHostProvider, ReferenceLink, referenceScopeKey, type ReferenceModuleProps } from "@pepbits/reference-host";
import tenantAdminCopy from "../tenant-admin-copy.json";
import definitionsCopy from "../definitions-copy.json";
const tenantAliases = {...definitionsCopy,...tenantAdminCopy};
import { ActivityLog } from "./components/activity/ActivityLog";
import { ApprovalsInbox } from "./components/approvals/ApprovalsInbox";
import { Overview } from "./components/overview/Overview";
import { ResourceWorkspace } from "./components/resource/ResourceWorkspace";
import { useApp } from "./components/shell/context";
import { TenantAdminShell } from "./components/shell/TenantAdminShell";
import { Card } from "./components/ui/controls";
import { ToastProvider } from "./components/ui/Toast";
import { TenantAdminDataProvider } from "./lib/api";
import { resolveTenantAdminRoute, tenantAdminPaths, type TenantAdminMatch } from "./routes";

function NotFound() {
  const { meta } = useApp();
  return (
    <div className="flex h-full items-center justify-center">
      <Card shadow="none" tone="transparent" className="panel max-w-md p-8 text-center">
        <h2 className="text-[20px] font-semibold"><LocalizedText message="This page doesn’t exist" /></h2>
        <p className="mt-2 text-muted"><LocalizedText message="Use the navigation or press Ctrl+K to jump to any of the {value0} configuration pages." values={{ value0: meta.resources.length }} /></p>
        <ReferenceLink href={tenantAdminPaths.overview()} className="btn-primary mt-5"><LocalizedText message="Go to overview" /></ReferenceLink>
      </Card>
    </div>
  );
}

function Page({ match }: { match: TenantAdminMatch | null }) {
  if (!match) return <NotFound />;
  switch (match.kind) {
    case "overview": return <Overview />;
    case "approvals": return <ApprovalsInbox />;
    case "activity": return <ActivityLog />;
    case "resource": return <ResourceWorkspace key={match.resource} resourceKey={match.resource} query={match.query} />;
  }
}

/**
 * Tenant Admin workspace. The host supplies the enterprise header and sidebar; this renders only the source page body plus a
 * compact toolbar and status strip. Identity comes from the host session (GET /meta through the host API transport: `currentUser`
 * and `hostManagedIdentity`). Everything cached or in flight lives under the authenticated scope key, so a tenant, branch, user
 * or role change disposes the workspace, aborts its requests and starts empty.
 */
export function ReferenceTenantAdminModule({ path, host }: ReferenceModuleProps) {
  const current = useMemo(() => ({ ...host, path }), [host, path]);
  const match = resolveTenantAdminRoute(path);
  return (
    <ReferenceHostProvider host={current}><LocalizationAliasProvider aliases={tenantAliases}>
      <div className="reference-tenant-admin" data-reference-module="tenant-admin" data-theme={host.preferences.theme} data-density={host.preferences.density}>
        <TenantAdminDataProvider key={referenceScopeKey(host.scope)}>
          <ToastProvider>
            <TenantAdminShell match={match}>
              <Page match={match} />
            </TenantAdminShell>
          </ToastProvider>
        </TenantAdminDataProvider>
      </div>
    </LocalizationAliasProvider></ReferenceHostProvider>
  );
}
