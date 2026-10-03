import type { ReferenceRoute } from "@pepbits/reference-host";
import { matchRoute } from "../shared/routes";

export type PatientRouteKind = "welcome" | "register" | "home" | "book" | "records" | "visit" | "summary";
export type PatientRoute = { kind: "welcome" | "register" | "home" | "book" | "records" } | { kind: "visit" | "summary"; id: string };

interface PatientRouteDefinition extends ReferenceRoute { kind: PatientRouteKind }

/** Typed routes the host registry can enumerate. `[id]` is an appointment id. */
export const patientRoutes: readonly PatientRouteDefinition[] = [
  { path: "/", title: "Welcome", kind: "welcome" },
  { path: "/register", title: "Register", kind: "register" },
  { path: "/home", title: "Home", kind: "home" },
  { path: "/book", title: "Book a visit", kind: "book" },
  { path: "/records", title: "My health", kind: "records" },
  { path: "/visit/[id]", title: "Visit", kind: "visit" },
  { path: "/visit/[id]/summary", title: "Visit summary", kind: "summary" },
];

/** Routes that appear in the host sidebar; the in-app bottom navigation covers the rest. */
export const patientNavigation: readonly ReferenceRoute[] = patientRoutes.filter((r) => r.kind === "welcome" || r.kind === "home" || r.kind === "book" || r.kind === "records");

export function resolvePatientRoute(path: string): PatientRoute | null {
  const hit = matchRoute(patientRoutes, path);
  if (!hit) return null;
  return hit.route.kind === "visit" || hit.route.kind === "summary" ? { kind: hit.route.kind, id: hit.params.id } : { kind: hit.route.kind as Exclude<PatientRouteKind, "visit" | "summary"> };
}

export const patientPaths = {
  welcome: () => "/",
  register: () => "/register",
  home: () => "/home",
  book: () => "/book",
  records: () => "/records",
  visit: (appointmentId: string) => `/visit/${encodeURIComponent(appointmentId)}`,
  summary: (appointmentId: string) => `/visit/${encodeURIComponent(appointmentId)}/summary`,
} as const;
