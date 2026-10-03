import type { ReferenceRoute } from "@pepbits/reference-host";

export type PharmacyRouteKind =
  | "dashboard" | "workbench" | "counter" | "orders" | "sales" | "inventory" | "purchasing"
  | "authorizations" | "claims" | "remittance" | "patients" | "audit" | "settings";

export interface PharmacyRoute extends ReferenceRoute { kind: PharmacyRouteKind }
export interface PharmacyNavItem extends ReferenceRoute { icon: string; description: string; group: string }

/** The thirteen static source routes. Record state (open Rx, claim, order...) lives in the query string, as in the source. */
export const pharmacyRoutes: readonly PharmacyRoute[] = [
  { path: "/", title: "Command center", kind: "dashboard" },
  { path: "/workbench", title: "Rx workbench", kind: "workbench" },
  { path: "/counter", title: "Counter sale", kind: "counter" },
  { path: "/orders", title: "Customer orders", kind: "orders" },
  { path: "/sales", title: "Sales and returns", kind: "sales" },
  { path: "/inventory", title: "Inventory", kind: "inventory" },
  { path: "/purchasing", title: "Purchasing", kind: "purchasing" },
  { path: "/authorizations", title: "Prior authorizations", kind: "authorizations" },
  { path: "/claims", title: "Claims", kind: "claims" },
  { path: "/remittance", title: "Remittance & payments", kind: "remittance" },
  { path: "/patients", title: "Patients", kind: "patients" },
  { path: "/audit", title: "Audit trail", kind: "audit" },
  { path: "/settings", title: "Settings", kind: "settings" },
];

/** The source sidebar, in the source's groups and order. The host registry renders it. Settings is the source sidebar's footer entry; it sits in its own configuration section. */
export const pharmacyNavigation: readonly PharmacyNavItem[] = [
  { path: "/", title: "Command center", icon: "LayoutDashboard", group: "Operate", description: "Today at a glance" },
  { path: "/workbench", title: "Rx workbench", icon: "Pill", group: "Operate", description: "Verify, fill, check, hand over" },
  { path: "/counter", title: "Counter sale", icon: "ScanBarcode", group: "Operate", description: "Sell non-prescription items" },
  { path: "/orders", title: "Customer orders", icon: "ShoppingBag", group: "Operate", description: "Phone, web and WhatsApp orders" },
  { path: "/sales", title: "Sales and returns", icon: "Receipt", group: "Operate", description: "Invoices, receipts, refunds" },
  { path: "/inventory", title: "Inventory", icon: "Boxes", group: "Stock", description: "Batches, expiry, ledger" },
  { path: "/purchasing", title: "Purchasing", icon: "Truck", group: "Stock", description: "Orders and receiving" },
  { path: "/authorizations", title: "Prior authorizations", icon: "ShieldCheck", group: "Revenue", description: "Request and record approvals" },
  { path: "/claims", title: "Claims", icon: "FileCheck2", group: "Revenue", description: "Submit, fix, follow up" },
  { path: "/remittance", title: "Remittance & payments", icon: "Landmark", group: "Revenue", description: "Post payer payments" },
  { path: "/patients", title: "Patients", icon: "Users", group: "Records", description: "Profiles, coverage, history" },
  { path: "/audit", title: "Audit trail", icon: "History", group: "Records", description: "Every status change" },
  { path: "/settings", title: "Settings", icon: "Settings", group: "Configuration", description: "Pharmacy, people, appearance" },
];

export type PharmacyMatch = { kind: PharmacyRouteKind; query: URLSearchParams };

/**
 * Resolves a module-relative path (query and hash allowed) onto a source page. Only the static routes exist; anything
 * with a different segment count, a traversal segment or an encoded separator is rejected rather than guessed.
 */
export function resolvePharmacyRoute(path: string): PharmacyMatch | null {
  const [beforeHash] = path.split("#");
  const [pathname, ...rest] = beforeHash.split("?");
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  let segments: string[];
  try { segments = pathname.split("/").filter(Boolean).map(decodeURIComponent); } catch { return null; }
  if (segments.some((s) => s === "." || s === ".." || s.includes("/") || s.includes("\\") || /[\u0000-\u001f]/.test(s))) return null;
  if (segments.length > 1) return null;
  const route = pharmacyRoutes.find((r) => (segments.length === 0 ? r.path === "/" : r.path === `/${segments[0]}`));
  return route ? { kind: route.kind, query: new URLSearchParams(rest.join("?")) } : null;
}

const q = (path: string, params?: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
};

/** Deep links into source pages: the query parameters each page reads to open a record or apply a filter. */
export const pharmacyPaths = {
  dashboard: () => "/",
  workbench: (o?: { rx?: string; stage?: string }) => q("/workbench", o),
  counter: () => "/counter",
  orders: (o?: { id?: string; new?: boolean }) => q("/orders", { id: o?.id, new: o?.new ? 1 : undefined }),
  sales: (o?: { id?: string; tab?: "invoices" | "returns"; days?: string }) => q("/sales", o),
  inventory: (o?: { product?: string; tab?: "products" | "expiry" | "movements"; filter?: string }) => q("/inventory", o),
  purchasing: (o?: { po?: string; tab?: "orders" | "suggestions" }) => q("/purchasing", o),
  authorizations: (o?: { id?: string; status?: string }) => q("/authorizations", o),
  claims: (o?: { claim?: string; status?: string }) => q("/claims", o),
  remittance: (o?: { ra?: string; tab?: "advice" | "payments" }) => q("/remittance", o),
  patients: (o?: { id?: string }) => q("/patients", o),
  audit: () => "/audit",
  settings: () => "/settings",
} as const;
