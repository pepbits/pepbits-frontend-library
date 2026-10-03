import type { ReferenceRoute } from "@pepbits/reference-host";

export type MedbandRouteKind = "today" | "patients" | "patient-new" | "patient" | "encounters" | "encounter-new" | "admissions" | "admission-new" | "episodes";

export interface MedbandRoute extends ReferenceRoute { kind: MedbandRouteKind }
export interface MedbandNavItem extends ReferenceRoute { icon: string; description: string }

/** The nine source pages. `/patients/new` is a literal route and wins over the dynamic `/patients/[id]`. */
export const medbandRoutes: readonly MedbandRoute[] = [
  { path: "/", title: "Today", kind: "today" },
  { path: "/patients", title: "Find patient", kind: "patients" },
  { path: "/patients/new", title: "Register patient", kind: "patient-new" },
  { path: "/patients/[id]", title: "Patient record", kind: "patient" },
  { path: "/encounters", title: "Encounters", kind: "encounters" },
  { path: "/encounters/new", title: "New encounter", kind: "encounter-new" },
  { path: "/admissions", title: "Admissions", kind: "admissions" },
  { path: "/admissions/new", title: "New admission request", kind: "admission-new" },
  { path: "/episodes", title: "Episodes and cases", kind: "episodes" },
];

/** The source rail, in the source's order. The host registry renders it (this package adds no menu or grant). */
export const medbandNavigation: readonly MedbandNavItem[] = [
  { path: "/", title: "Today", icon: "LayoutDashboard", description: "Today's desk" },
  { path: "/patients", title: "Find patient", icon: "Users", description: "Search by name, MRN, phone or insurance" },
  { path: "/patients/new", title: "Register patient", icon: "UserPlus", description: "Register a patient" },
  { path: "/encounters/new", title: "New encounter", icon: "CalendarPlus", description: "Open a visit" },
  { path: "/admissions", title: "Admissions", icon: "BedDouble", description: "Admission requests and clearance" },
  { path: "/encounters", title: "Encounters", icon: "ClipboardList", description: "Every visit" },
  { path: "/episodes", title: "Episodes and cases", icon: "FolderHeart", description: "Episodes of care and cases" },
];

export type MedbandMatch = { kind: MedbandRouteKind; params: Record<string, string>; query: URLSearchParams };

/**
 * Resolves a module-relative path (query and hash allowed) onto a source page. `[name]` segments capture a decoded value and
 * literal routes win over dynamic ones. A traversal segment, an encoded separator or a control character rejects the whole
 * path rather than guessing; the query string is returned untouched.
 */
export function resolveMedbandRoute(path: string): MedbandMatch | null {
  const [beforeHash] = path.split("#");
  const [pathname, ...rest] = beforeHash.split("?");
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  let segments: string[];
  try { segments = pathname.split("/").filter(Boolean).map(decodeURIComponent); } catch { return null; }
  if (segments.some((s) => s === "." || s === ".." || s.includes("/") || s.includes("\\") || /[\u0000-\u001f]/.test(s))) return null;
  const ordered = [...medbandRoutes].sort((a, b) => Number(a.path.includes("[")) - Number(b.path.includes("[")));
  for (const route of ordered) {
    const parts = route.path.split("/").filter(Boolean);
    if (parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    const ok = parts.every((part, i) => {
      const dynamic = /^\[(\w+)\]$/.exec(part);
      if (dynamic) { params[dynamic[1]] = segments[i]; return segments[i].length > 0; }
      return part === segments[i];
    });
    if (ok) return { kind: route.kind, params, query: new URLSearchParams(rest.join("?")) };
  }
  return null;
}

const q = (path: string, params?: Record<string, string | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
};

/** Deep links into source pages: the query parameters each page reads. */
export const medbandPaths = {
  today: () => "/",
  patients: () => "/patients",
  patientNew: () => "/patients/new",
  patient: (id: string) => `/patients/${encodeURIComponent(id)}`,
  encounters: () => "/encounters",
  encounterNew: (o?: { patientId?: string; type?: string; episode?: string; case?: string; department?: string; admissionRequest?: string }) => q("/encounters/new", o),
  admissions: () => "/admissions",
  admissionNew: (o?: { patientId?: string; case?: string; fromEncounter?: string }) => q("/admissions/new", o),
  episodes: () => "/episodes",
} as const;
