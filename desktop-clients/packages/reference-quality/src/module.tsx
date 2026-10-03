"use client";
import { useMemo } from "react";
import { LocalizedText, LocalizationAliasProvider } from "@pepbits/ops-ui";
import { ReferenceHostProvider, referenceScopeKey, type ReferenceModuleProps } from "@pepbits/reference-host";
import DashboardPage from "./app/(app)/page";
import IndicatorsPage from "./app/(app)/indicators/page";
import IndicatorDetailPage from "./app/(app)/indicators/[id]/page";
import TatPage from "./app/(app)/tat/page";
import EventsPage from "./app/(app)/events/page";
import VerificationPage from "./app/(app)/verification/page";
import ValidationPage from "./app/(app)/validation/page";
import ReportsPage from "./app/(app)/reports/page";
import DesignerPage from "./app/(app)/reports/designer/page";
import ReportViewerPage from "./app/(app)/reports/[id]/page";
import SchedulesPage from "./app/(app)/schedules/page";
import SubmissionsPage from "./app/(app)/submissions/page";
import AuthoritiesPage from "./app/(app)/authorities/page";
import UsersPage from "./app/(app)/users/page";
import AuditPage from "./app/(app)/audit/page";
import qualityCopy from "../quality-copy.json";
import { QualityToolbar } from "./components/QualityToolbar";
import { ToastProvider } from "./components/toast";
import { AuthProvider } from "./lib/auth";
import { resolveQualityRoute, type QualityMatch } from "./routes";

function Page({ match }: { match: QualityMatch }) {
  const params = { id: match.id ?? "" };
  switch (match.kind) {
    case "dashboard": return <DashboardPage />;
    case "indicators": return <IndicatorsPage />;
    case "indicator": return <IndicatorDetailPage params={params} />;
    case "tat": return <TatPage />;
    case "events": return <EventsPage />;
    case "verification": return <VerificationPage />;
    case "validation": return <ValidationPage />;
    case "reports": return <ReportsPage />;
    case "designer": return <DesignerPage />;
    case "report": return <ReportViewerPage params={params} />;
    case "schedules": return <SchedulesPage />;
    case "submissions": return <SubmissionsPage />;
    case "authorities": return <AuthoritiesPage />;
    case "users": return <UsersPage />;
    case "audit": return <AuditPage />;
  }
}

/**
 * AllyVora Quality workspace. The host supplies the enterprise header and sidebar; this renders only the source
 * page body. Identity and permissions come from the host session (GET /auth/me, GET /meta through the host API
 * transport), keyed by the authenticated scope so a tenant/branch/user change remounts it and cancels requests.
 */
export function ReferenceQualityModule({ path, host }: ReferenceModuleProps) {
  const current = useMemo(() => ({ ...host, path }), [host, path]);
  const match = resolveQualityRoute(path);
  const [pathname, search = ""] = path.split("?");
  // Source pages read the query only to seed their state, so a changed query remounts them, except the submissions
  // list, which owns its query (the open drawer) and must keep its filter tab.
  const pageKey = match?.kind === "submissions" ? pathname : `${pathname}?${search}`;
  return (
    <ReferenceHostProvider host={current}><LocalizationAliasProvider aliases={qualityCopy}>
      <div className="reference-quality" data-reference-module="quality" data-theme={host.preferences.theme} data-density={host.preferences.density}>
        <AuthProvider key={referenceScopeKey(host.scope)}>
          <ToastProvider>
            <QualityToolbar />
            <main className="print-full mx-auto max-w-[1440px]">
              {match ? <Page key={pageKey} match={match} /> : <p role="status" className="p-6 text-sm"><LocalizedText message="AllyVora Quality page not found" /></p>}
            </main>
          </ToastProvider>
        </AuthProvider>
      </div>
    </LocalizationAliasProvider></ReferenceHostProvider>
  );
}
