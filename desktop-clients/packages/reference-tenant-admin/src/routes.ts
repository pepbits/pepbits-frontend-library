import type { ReferenceRoute } from "@pepbits/reference-host";
import type { CategoryDef, ResourceDef } from "./lib/types";

export type TenantAdminRouteKind = "overview" | "approvals" | "activity" | "resource";

export interface TenantAdminRoute extends ReferenceRoute { kind: Exclude<TenantAdminRouteKind, "resource"> }
export interface TenantAdminNavItem extends ReferenceRoute { icon: string; description: string; group: string }

/** The three static source routes. The configuration pages are one dynamic route, `/config/[resource]`, driven by the backend registry. */
export const tenantAdminRoutes: readonly TenantAdminRoute[] = [
  { path: "/", title: "Overview", kind: "overview" },
  { path: "/approvals", title: "Approvals", kind: "approvals" },
  { path: "/activity", title: "Activity", kind: "activity" },
];

/** The dynamic route: `[resource]` is a registry key (`items`, `price-books`, ...) the backend `GET /meta` lists. */
export const tenantAdminDynamicRoutes: readonly { pattern: string; title: string; param: "resource" }[] = [
  { pattern: "/config/[resource]", title: "Configuration page", param: "resource" },
];

export type TenantAdminMatch =
  | { kind: "overview" | "approvals" | "activity"; resource?: undefined; query: URLSearchParams }
  | { kind: "resource"; resource: string; query: URLSearchParams };

/** A registry key as the source uses it: lower-case words joined by hyphens. */
const RESOURCE_KEY = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Resolves a module-relative path (query and hash allowed) onto a source page. The query is kept (`?new=1`, `?open=<id>`, `?id=<id>`);
 * a traversal segment, an encoded separator, a control character, a malformed escape or the wrong segment count is rejected rather than guessed.
 * Whether a resource key exists is the backend registry's call: the page says "doesn't exist" for an unknown one.
 */
export function resolveTenantAdminRoute(path: string): TenantAdminMatch | null {
  const [beforeHash] = path.split("#");
  const [pathname, ...rest] = beforeHash.split("?");
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  let segments: string[];
  try { segments = pathname.split("/").filter(Boolean).map(decodeURIComponent); } catch { return null; }
  if (segments.some((s) => s === "." || s === ".." || s.includes("/") || s.includes("\\") || /[\u0000-\u001f]/.test(s))) return null;
  const query = new URLSearchParams(rest.join("?"));
  if (segments.length === 0) return { kind: "overview", query };
  if (segments.length === 1 && (segments[0] === "approvals" || segments[0] === "activity")) return { kind: segments[0], query };
  if (segments.length === 2 && segments[0] === "config" && RESOURCE_KEY.test(segments[1])) return { kind: "resource", resource: segments[1], query };
  return null;
}

const q = (path: string, params?: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
};

/** Deep links into source pages. `open` is the source's own parameter; the page also reads `id`. */
export const tenantAdminPaths = {
  overview: () => "/",
  approvals: () => "/approvals",
  activity: () => "/activity",
  resource: (key: string, o?: { open?: number | string; new?: boolean }) => q(`/config/${encodeURIComponent(key)}`, { open: o?.open, new: o?.new ? 1 : undefined }),
} as const;

/**
 * Host navigation built from the backend registry (`GET /meta`): the Workspace entries, then every category with its pages in
 * registry order. There is no fixed list of the thirty pages in the frontend; a page the server stops offering disappears.
 */
export function tenantAdminNavigation(meta: { categories: readonly CategoryDef[]; resources: readonly Pick<ResourceDef, "key" | "label" | "category" | "summary" | "icon">[] }): TenantAdminNavItem[] {
  const workspace: TenantAdminNavItem[] = [
    { path: "/", title: "Overview", icon: "LayoutDashboard", group: "Workspace", description: "Activation readiness" },
    { path: "/approvals", title: "Approvals", icon: "Inbox", group: "Workspace", description: "Changes waiting for a decision" },
    { path: "/activity", title: "Activity", icon: "History", group: "Workspace", description: "Audit trail" },
  ];
  const pages = meta.categories.flatMap((c) =>
    meta.resources.filter((r) => r.category === c.key).map((r) => ({ path: tenantAdminPaths.resource(r.key), title: r.label, icon: r.icon, group: c.label, description: r.summary })),
  );
  return [...workspace, ...pages];
}
