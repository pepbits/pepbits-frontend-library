import type { ReferenceRoute } from "@pepbits/reference-host";

export type QualityRouteKind =
  | "dashboard" | "indicators" | "indicator" | "tat" | "events" | "verification" | "validation"
  | "reports" | "report" | "designer" | "schedules" | "submissions" | "authorities" | "users" | "audit";

export interface QualityRoute extends ReferenceRoute { kind: QualityRouteKind }
export interface QualityNavItem extends ReferenceRoute { icon: string; description: string; group: string; permission?: string }

/** Every source page: twelve list/overview pages plus the report designer, and the two dynamic detail pages. */
export const qualityRoutes: readonly QualityRoute[] = [
  { path: "/", title: "Dashboard", kind: "dashboard" },
  { path: "/indicators", title: "Indicators", kind: "indicators" },
  { path: "/indicators/[id]", title: "Indicator", kind: "indicator" },
  { path: "/tat", title: "Turnaround times", kind: "tat" },
  { path: "/events", title: "Event Pulse", kind: "events" },
  { path: "/verification", title: "Verification", kind: "verification" },
  { path: "/validation", title: "Validation", kind: "validation" },
  { path: "/reports", title: "Reports", kind: "reports" },
  { path: "/reports/designer", title: "Report designer", kind: "designer" },
  { path: "/reports/[id]", title: "Report", kind: "report" },
  { path: "/schedules", title: "Schedules", kind: "schedules" },
  { path: "/submissions", title: "Submissions", kind: "submissions" },
  { path: "/authorities", title: "Authorities", kind: "authorities" },
  { path: "/users", title: "Users and roles", kind: "users" },
  { path: "/audit", title: "Audit trail", kind: "audit" },
];

/** The source sidebar, in the source's groups and order. The host registry renders it; `permission` is a convenience hint, the server authorizes. */
export const qualityNavigation: readonly QualityNavItem[] = [
  { path: "/", title: "Dashboard", icon: "LayoutDashboard", group: "Overview", description: "Performance against target this period" },
  { path: "/indicators", title: "Indicators", icon: "Gauge", group: "Performance", description: "Indicator catalogue, definitions and results" },
  { path: "/tat", title: "Turnaround times", icon: "Timer", group: "Performance", description: "TAT analysis from clinical event history" },
  { path: "/events", title: "Event Pulse", icon: "Activity", group: "Performance", description: "Clinical event stream and transaction state" },
  { path: "/verification", title: "Verification", icon: "BadgeCheck", group: "Assurance", description: "Submit, verify and approve results" },
  { path: "/validation", title: "Validation", icon: "ShieldCheck", group: "Assurance", description: "Data quality rules and issues" },
  { path: "/reports", title: "Reports", icon: "FileStack", group: "Reporting", description: "Regulatory and internal reports" },
  { path: "/schedules", title: "Schedules", icon: "CalendarClock", group: "Reporting", description: "Automated report delivery" },
  { path: "/submissions", title: "Submissions", icon: "Send", group: "Reporting", description: "Submissions to authorities" },
  { path: "/authorities", title: "Authorities", icon: "Building2", group: "Administration", description: "Regulators and recipients" },
  { path: "/users", title: "Users and roles", icon: "Users", group: "Administration", description: "Accounts and access", permission: "users.manage" },
  { path: "/audit", title: "Audit trail", icon: "History", group: "Administration", description: "Every change, who made it and when", permission: "audit.view" },
];

export type QualityMatch = { kind: QualityRouteKind; id?: string };

/** Path segments written `[name]` capture a decoded value; everything else matches literally. Literal routes win over dynamic ones. */
export function matchRoute<T extends ReferenceRoute>(routes: readonly T[], path: string): { route: T; params: Record<string, string> } | null {
  const pathname = path.split(/[?#]/)[0];
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  let segments: string[];
  try { segments = pathname.split("/").filter(Boolean).map(decodeURIComponent); } catch { return null; }
  if (segments.some((s) => s === "." || s === ".." || s.includes("/") || s.includes("\\") || /[\u0000-\u001f]/.test(s))) return null;
  const ordered = [...routes].sort((a, b) => Number(a.path.includes("[")) - Number(b.path.includes("[")) || b.path.length - a.path.length);
  for (const route of ordered) {
    const parts = route.path.split("/").filter(Boolean);
    if (parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let matches = true;
    parts.forEach((part, i) => {
      if (part.startsWith("[")) { if (!segments[i]) matches = false; else params[part.slice(1, -1)] = segments[i]; }
      else if (part !== segments[i]) matches = false;
    });
    if (matches) return { route, params };
  }
  return null;
}

export function resolveQualityRoute(path: string): QualityMatch | null {
  const hit = matchRoute(qualityRoutes, path);
  if (!hit) return null;
  return hit.params.id !== undefined ? { kind: hit.route.kind, id: hit.params.id } : { kind: hit.route.kind };
}

export const qualityPaths = {
  dashboard: () => "/",
  indicators: (query?: { domain?: string }) => (query?.domain ? `/indicators?domain=${encodeURIComponent(query.domain)}` : "/indicators"),
  indicator: (id: number | string) => `/indicators/${encodeURIComponent(String(id))}`,
  tat: () => "/tat",
  events: () => "/events",
  verification: (queue?: string) => (queue ? `/verification?queue=${encodeURIComponent(queue)}` : "/verification"),
  validation: () => "/validation",
  reports: () => "/reports",
  designer: (id?: number | string) => (id !== undefined ? `/reports/designer?id=${encodeURIComponent(String(id))}` : "/reports/designer"),
  report: (id: number | string) => `/reports/${encodeURIComponent(String(id))}`,
  schedules: () => "/schedules",
  submissions: (open?: number | string) => (open !== undefined ? `/submissions?open=${encodeURIComponent(String(open))}` : "/submissions"),
  authorities: () => "/authorities",
  users: () => "/users",
  audit: (user?: number | string) => (user !== undefined ? `/audit?user=${encodeURIComponent(String(user))}` : "/audit"),
} as const;
