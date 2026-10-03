"use client";
import { useMemo } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { ReferenceHostProvider, referenceScopeKey, type ReferenceModuleProps } from "@pepbits/reference-host";
import Welcome from "./app/page";
import Register from "./app/register/page";
import Home from "./app/home/page";
import Book from "./app/book/page";
import Records from "./app/records/page";
import VisitPage from "./app/visit/[id]/page";
import Summary from "./app/visit/[id]/summary/page";
import { PatientSessionProvider } from "./lib/session";
import { resolvePatientRoute, type PatientRoute } from "./routes";

function Page({ route }: { route: PatientRoute }) {
  switch (route.kind) {
    case "welcome": return <Welcome />;
    case "register": return <Register />;
    case "home": return <Home />;
    case "book": return <Book />;
    case "records": return <Records />;
    case "visit": return <VisitPage key={route.id} params={{ id: route.id }} />;
    case "summary": return <Summary key={route.id} params={{ id: route.id }} />;
  }
}

/**
 * CareCall patient app. It keeps the source phone-width column and bottom navigation inside the host
 * content area: the whole module is bounded by the height the host leaves, the phone column fills it and is a
 * transform context (so the source's fixed-position bars and call overlay stay inside it instead of covering the
 * host shell), and a scroller inside it carries the page so those fixed bars do not scroll away.
 * The person acted for comes from the authenticated session; nothing is remembered in the browser.
 */
export function ReferenceTeleconsultPatientModule({ path, host }: ReferenceModuleProps) {
  const current = useMemo(() => ({ ...host, path }), [host, path]);
  const route = resolvePatientRoute(path);
  return (
    <ReferenceHostProvider host={current}>
      <div className="teleconsult-patient flex min-h-0 flex-1 flex-col items-center gap-2 p-3" data-reference-module="teleconsult-patient" data-reference-layout="fill" data-teleconsult="patient" data-density={host.preferences.density}>
        <p className="shrink-0 text-center text-xs" data-demo-notice="true"><LocalizedText message="Demo CareCall with fictional data. The clinician's video, vitals and transcript are simulated." /></p>
        <div className="tc-phone w-full max-w-md bg-mint shadow-[0_0_60px_rgba(19,78,74,0.12)]">
          <div className="tc-phone-scroll">
            <PatientSessionProvider key={referenceScopeKey(host.scope)}>
              {route ? <Page route={route} /> : <p role="status" className="p-6 text-sm"><LocalizedText message="Teleconsult page not found" /></p>}
            </PatientSessionProvider>
          </div>
        </div>
      </div>
    </ReferenceHostProvider>
  );
}
