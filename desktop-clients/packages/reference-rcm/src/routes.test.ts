import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { meta } from "./test-utils";
import { resolveRcmRoute, rcmDynamicRoutes, rcmNavigation, rcmPaths, rcmRoutes, safeRcmHref } from "./routes";

const SOURCE_REGISTRY = "/home/pepadmin/pb/saas/reference/frontend/rcm-app/workspace-app/server/src/registry.ts";

describe("RCM routes", () => {
  it("exposes the four source dashboard routes and the one dynamic worklist route", () => {
    expect(rcmRoutes.map((r) => r.path)).toEqual(["/", "/aging", "/reports", "/approvals"]);
    expect(rcmDynamicRoutes.map((r) => r.pattern)).toEqual(["/w/[resource]"]);
  });

  it("resolves the dashboards and the dynamic resource page, keeping the source query parameters", () => {
    expect(resolveRcmRoute("/")).toMatchObject({ kind: "home" });
    expect(resolveRcmRoute("/aging")).toMatchObject({ kind: "aging" });
    expect(resolveRcmRoute("/reports?x=1")).toMatchObject({ kind: "reports" });
    expect(resolveRcmRoute("/approvals")).toMatchObject({ kind: "approvals" });
    const open = resolveRcmRoute("/w/exchange-messages?status=FAILED,DEAD_LETTER&open=12&q=MSG-1&overdue=1#top");
    expect(open).toMatchObject({ kind: "resource", resource: "exchange-messages" });
    expect(open?.query.get("status")).toBe("FAILED,DEAD_LETTER");
    expect(open?.query.get("open")).toBe("12");
    expect(open?.query.get("q")).toBe("MSG-1");
    expect(open?.query.get("overdue")).toBe("1");
    expect(resolveRcmRoute("/w/invoices?new=1")?.query.get("new")).toBe("1");
    expect(resolveRcmRoute("/w/invoices?q=INV-2026-00012&open=first")?.query.get("open")).toBe("first");
  });

  it("keeps a question mark inside the query and decodes a percent-encoded key", () => {
    expect(resolveRcmRoute("/w/invoices?next=/w/claims?x=1")?.query.get("next")).toBe("/w/claims?x=1");
    expect(resolveRcmRoute("/w/credit%2Dnotes")).toMatchObject({ resource: "credit-notes" });
  });

  it("rejects traversal, encoded separators, control characters, odd segment counts and unknown pages", () => {
    for (const path of ["/w/..", "/w/%2e%2e", "/w/a%2Fb", "/w/a%5Cb", "/w/%00", "/w/%zz", "/w", "/w/invoices/7", "//evil.example", "w/invoices", "/nope", "/aging/extra", "/w/Invoices", "/w/-invoices", "/w/invoices%0A", "/approvals/x"]) {
      expect(resolveRcmRoute(path), path).toBeNull();
    }
  });

  it("builds deep links with the source's query parameters, encoding the key", () => {
    expect(rcmPaths.resource("invoices")).toBe("/w/invoices");
    expect(rcmPaths.resource("invoices", { open: 12 })).toBe("/w/invoices?open=12");
    expect(rcmPaths.resource("invoices", { new: true })).toBe("/w/invoices?new=1");
    expect(rcmPaths.resource("claims", { status: "DENIED" })).toBe("/w/claims?status=DENIED");
    expect(rcmPaths.resource("invoices", { q: "INV-1", open: "first" })).toBe("/w/invoices?open=first&q=INV-1");
    expect(rcmPaths.resource("a/b")).toBe("/w/a%2Fb");
    expect(resolveRcmRoute(rcmPaths.resource("a/b"))).toBeNull();
  });

  it("follows only module routes for links the server supplies", () => {
    expect(safeRcmHref("/w/coverages?status=PENDING_VERIFICATION")).toBe("/w/coverages?status=PENDING_VERIFICATION");
    expect(safeRcmHref("//evil.example/x")).toBe("/");
    expect(safeRcmHref("https://evil.example")).toBe("/");
  });

  it("derives the host navigation from the backend registry: every category's pages, in registry order, with the source hrefs", () => {
    const nav = rcmNavigation(meta());
    expect(nav.map((n) => [n.group, n.path])).toEqual([
      ["Front office", "/"], ["Front office", "/w/coverages"], ["Charges and documents", "/w/invoices"], ["Insurance", "/w/claims"], ["Insurance", "/w/exchange-messages"],
      ["Receivables", "/aging"], ["Receivables", "/reports"], ["Cross-cutting", "/approvals"],
    ]);
    expect(nav.filter((n) => n.kind === "dashboard")).toHaveLength(4);
    expect(rcmNavigation({ categories: [] })).toEqual([]);
  });

  it.skipIf(!existsSync(SOURCE_REGISTRY))("covers the source registry: 4 dashboards + 36 resources, every one routable", () => {
    const text = readFileSync(SOURCE_REGISTRY, "utf8");
    const resources = [...text.matchAll(/^ {4}key: '([a-z-]+)', label: '[^']+', singular:/gm)].map((m) => m[1]);
    expect(resources).toHaveLength(36);
    expect(new Set(resources).size).toBe(36);
    const dashboards = [...text.matchAll(/dash\('(\w+)', '[^']+', '(?:\w+', )?'(\/[a-z]*)'/g)].map((m) => m[2]);
    expect(dashboards.sort()).toEqual(["/", "/aging", "/approvals", "/reports"].sort());
    for (const key of resources) expect(resolveRcmRoute(rcmPaths.resource(key)), key).toMatchObject({ kind: "resource", resource: key });
    for (const path of dashboards) expect(resolveRcmRoute(path), path).not.toBeNull();
  });
});
