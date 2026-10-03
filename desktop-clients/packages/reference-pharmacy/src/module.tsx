"use client";
import { useMemo } from "react";
import { LocalizedText, LocalizationAliasProvider } from "@pepbits/ops-ui";
import { ReferenceHostProvider, referenceScopeKey, type ReferenceModuleProps } from "@pepbits/reference-host";
import pharmacyCopy from "../pharmacy-copy.json";
import { AuditView } from "./components/views/Audit";
import { AuthorizationsView } from "./components/views/Authorizations";
import { ClaimsView } from "./components/views/Claims";
import { CounterView } from "./components/views/Counter";
import { DashboardView } from "./components/views/Dashboard";
import { InventoryView } from "./components/views/Inventory";
import { OrdersView } from "./components/views/Orders";
import { PatientsView } from "./components/views/Patients";
import { PurchasingView } from "./components/views/Purchasing";
import { RemittanceView } from "./components/views/Remittance";
import { SalesView } from "./components/views/Sales";
import { SettingsView } from "./components/views/Settings";
import { WorkbenchView } from "./components/views/Workbench";
import { PharmacyShell } from "./components/shell/PharmacyShell";
import { ToastProvider } from "./components/ui/toast";
import { PharmacyDataProvider } from "./lib/api";
import { resolvePharmacyRoute, type PharmacyRouteKind } from "./routes";

const PAGES: Record<PharmacyRouteKind, () => React.JSX.Element> = {
  dashboard: DashboardView, workbench: WorkbenchView, counter: CounterView, orders: OrdersView, sales: SalesView, inventory: InventoryView,
  purchasing: PurchasingView, authorizations: AuthorizationsView, claims: ClaimsView, remittance: RemittanceView, patients: PatientsView, audit: AuditView, settings: SettingsView,
};

/**
 * Pharmacy-1 (Phial) workspace. The host supplies the enterprise header and sidebar; this renders only the source page body
 * plus a small toolbar (command palette, New prescription, demonstration-data notice). Identity comes from the host session
 * (GET /meta through the host API transport). Everything cached or in flight lives under the authenticated scope key, so a
 * tenant, branch, user or role change disposes the workspace, aborts its requests and starts empty.
 */
export function ReferencePharmacyModule({ path, host }: ReferenceModuleProps) {
  const current = useMemo(() => ({ ...host, path }), [host, path]);
  const match = resolvePharmacyRoute(path);
  const Page = match ? PAGES[match.kind] : null;
  return (
    <ReferenceHostProvider host={current}><LocalizationAliasProvider aliases={pharmacyCopy}>
      <div className="reference-pharmacy" data-reference-module="pharmacy" data-theme={host.preferences.theme} data-density={host.preferences.density}>
        <PharmacyDataProvider key={referenceScopeKey(host.scope)}>
          <ToastProvider>
            <PharmacyShell>
              {Page ? <Page key={match!.kind} /> : <p role="status" className="p-6 text-sm"><LocalizedText message="Pharmacy-1 page not found" /></p>}
            </PharmacyShell>
          </ToastProvider>
        </PharmacyDataProvider>
      </div>
    </LocalizationAliasProvider></ReferenceHostProvider>
  );
}
