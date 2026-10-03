import type { ReferenceRoute } from "@pepbits/reference-host";
import { matchRoute } from "../shared/routes";

export type ProviderRouteKind = "today" | "schedule" | "patients" | "notes" | "consult";
export type ProviderRoute = { kind: "today" | "schedule" | "patients" | "notes" } | { kind: "consult"; id: string };

interface ProviderRouteDefinition extends ReferenceRoute { kind: ProviderRouteKind }

/** Typed routes the host registry can enumerate. `[id]` is an appointment id. Query strings (e.g. /notes?appointment=) are ignored for matching. */
export const providerRoutes: readonly ProviderRouteDefinition[] = [
  { path: "/", title: "Today", kind: "today" },
  { path: "/schedule", title: "Schedule", kind: "schedule" },
  { path: "/patients", title: "Patients", kind: "patients" },
  { path: "/notes", title: "Visit notes", kind: "notes" },
  { path: "/consult/[id]", title: "Consultation", kind: "consult" },
];

/** Routes that appear in the host sidebar (the consultation is reached from a visit, not listed). */
export const providerNavigation: readonly ReferenceRoute[] = providerRoutes.filter((r) => r.kind !== "consult");

export function resolveProviderRoute(path: string): ProviderRoute | null {
  const hit = matchRoute(providerRoutes, path);
  if (!hit) return null;
  return hit.route.kind === "consult" ? { kind: "consult", id: hit.params.id } : { kind: hit.route.kind };
}

export const providerPaths = {
  today: () => "/",
  schedule: () => "/schedule",
  patients: () => "/patients",
  notes: (appointmentId?: string) => (appointmentId ? `/notes?appointment=${encodeURIComponent(appointmentId)}` : "/notes"),
  consult: (appointmentId: string) => `/consult/${encodeURIComponent(appointmentId)}`,
} as const;
