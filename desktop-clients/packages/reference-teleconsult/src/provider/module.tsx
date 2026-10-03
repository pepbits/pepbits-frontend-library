"use client";
import { useMemo } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { ReferenceHostProvider, referenceScopeKey, type ReferenceModuleProps } from "@pepbits/reference-host";
import TodayPage from "./app/page";
import SchedulePage from "./app/schedule/page";
import PatientsPage from "./app/patients/page";
import NotesPage from "./app/notes/page";
import ConsultPage from "./app/consult/[id]/page";
import { ProviderToolbar } from "./components/shell/ProviderToolbar";
import { ToastProvider } from "./components/ui";
import { SessionProvider } from "./lib/session";
import { providerRoutes, resolveProviderRoute, type ProviderRoute } from "./routes";

function Page({ route }: { route: ProviderRoute }) {
  switch (route.kind) {
    case "today": return <TodayPage />;
    case "schedule": return <SchedulePage />;
    case "patients": return <PatientsPage />;
    case "notes": return <NotesPage />;
    case "consult": return <ConsultPage key={route.id} params={{ id: route.id }} />;
  }
}

/**
 * Teleconsult Clinic Desk for doctors and nurses. The host supplies the outer sidebar and header; this
 * renders only the workspace, keyed by the authenticated scope so a tenant/branch/user change remounts it
 * and cancels every in-flight request. All clinical data, vitals and transcripts come from the API.
 */
export function ReferenceTeleconsultProviderModule({ path, host }: ReferenceModuleProps) {
  const current = useMemo(() => ({ ...host, path }), [host, path]);
  const route = resolveProviderRoute(path);
  const title = providerRoutes.find((r) => r.kind === route?.kind)?.title ?? "Teleconsult";
  return (
    <ReferenceHostProvider host={current}>
      <div className="teleconsult-provider flex min-h-0 flex-1 flex-col" data-reference-module="teleconsult-provider" data-teleconsult="provider" data-density={host.preferences.density}>
        <SessionProvider key={referenceScopeKey(host.scope)}>
          <ToastProvider>
            <ProviderToolbar title={title} />
            <main className="min-h-0 flex-1 overflow-y-auto">
              {route ? <Page route={route} /> : <p role="status" className="p-6 text-sm"><LocalizedText message="Teleconsult page not found" /></p>}
            </main>
          </ToastProvider>
        </SessionProvider>
      </div>
    </ReferenceHostProvider>
  );
}
