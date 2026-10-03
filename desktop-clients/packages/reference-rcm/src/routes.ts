import type { ReferenceRoute } from "@pepbits/reference-host";
import type { CategoryDef } from "./lib/types";

export type RcmRouteKind = "home" | "aging" | "reports" | "approvals" | "resource";

export interface RcmRoute extends ReferenceRoute { kind: Exclude<RcmRouteKind, "resource"> }
export interface RcmNavItem extends ReferenceRoute { icon: string; description: string; group: string; kind: "dashboard" | "resource" }

/** The four dashboard pages of the source (`/`, `/aging`, `/reports`, `/approvals`). */
export const rcmRoutes: readonly RcmRoute[] = [
  { path: "/", title: "Billing home", kind: "home" },
  { path: "/aging", title: "Aging", kind: "aging" },
  { path: "/reports", title: "Reports", kind: "reports" },
  { path: "/approvals", title: "Approvals inbox", kind: "approvals" },
];

/** The dynamic route: `[resource]` is one of the 36 registry keys that `GET /meta` lists (`invoices`, `claims`, `exchange-messages`, ...). */
export const rcmDynamicRoutes: readonly { pattern: string; title: string; param: "resource" }[] = [
  { pattern: "/w/[resource]", title: "Workspace page", param: "resource" },
];

export type RcmMatch =
  | { kind: "home" | "aging" | "reports" | "approvals"; resource?: undefined; query: URLSearchParams }
  | { kind: "resource"; resource: string; query: URLSearchParams };

/** A registry key as the source uses it: lower-case words joined by hyphens. */
const RESOURCE_KEY = /^[a-z0-9][a-z0-9-]*$/;
const STATIC: Record<string, RcmRoute["kind"]> = { aging: "aging", reports: "reports", approvals: "approvals" };

/**
 * Resolves a module-relative path (query and hash allowed) onto a source page. The query is kept (`?new=1`, `?open=<id>|first`,
 * `?status=A,B`, `?q=`, `?overdue=1`); a traversal segment, an encoded separator, a control character, a malformed escape or the
 * wrong segment count is rejected rather than guessed. Whether a resource key exists is the backend registry's call: the page says
 * "No such workspace page" for an unknown one.
 */
export function resolveRcmRoute(path: string): RcmMatch | null {
  const [beforeHash] = path.split("#");
  const [pathname, ...rest] = beforeHash.split("?");
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  let segments: string[];
  try { segments = pathname.split("/").filter(Boolean).map(decodeURIComponent); } catch { return null; }
  if (segments.some((s) => s === "." || s === ".." || s.includes("/") || s.includes("\\") || /[\u0000-\u001f]/.test(s))) return null;
  const query = new URLSearchParams(rest.join("?"));
  if (segments.length === 0) return { kind: "home", query };
  if (segments.length === 1 && STATIC[segments[0]]) return { kind: STATIC[segments[0]], query };
  if (segments.length === 2 && segments[0] === "w" && RESOURCE_KEY.test(segments[1])) return { kind: "resource", resource: segments[1], query };
  return null;
}

const q = (path: string, params?: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
};

/** Deep links into source pages, with the source's own query parameters. */
export const rcmPaths = {
  home: () => "/",
  aging: () => "/aging",
  reports: () => "/reports",
  approvals: () => "/approvals",
  resource: (key: string, o?: { open?: number | string; new?: boolean; status?: string; q?: string; overdue?: boolean }) =>
    q(`/w/${encodeURIComponent(key)}`, { open: o?.open, new: o?.new ? 1 : undefined, status: o?.status, q: o?.q, overdue: o?.overdue ? 1 : undefined }),
} as const;


/**
 * Host navigation built from the backend registry (`GET /meta`): every category with its pages in registry order, exactly the
 * source sidebar (Front office: Billing home, coverage, ...; Receivables: Aging, ..., Reports; Cross-cutting: Approvals inbox, ...).
 * There is no fixed list of the 40 pages in the frontend; a page the server stops offering disappears.
 */
export function rcmNavigation(meta: { categories: readonly CategoryDef[] }): RcmNavItem[] {
  return meta.categories.flatMap((c) => c.pages.map((p) => ({ path: p.href, title: p.label, icon: p.icon, group: c.label, description: p.summary, kind: p.kind })));
}

/** A link the server supplied (queue tiles): only module routes are followed; anything else falls back to the home page. */
export const safeRcmHref = (href: string) => (resolveRcmRoute(href) ? href : rcmPaths.home());
