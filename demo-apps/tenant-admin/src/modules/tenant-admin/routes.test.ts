import { describe, expect, it } from "vitest";
import { meta } from "./test-utils";
import { resolveTenantAdminRoute, tenantAdminDynamicRoutes, tenantAdminNavigation, tenantAdminPaths, tenantAdminRoutes } from "./routes";

describe("Tenant Admin routes", () => {
  it("exposes the three static source routes and the one dynamic configuration route", () => {
    expect(tenantAdminRoutes.map((r) => r.path)).toEqual(["/", "/approvals", "/activity"]);
    expect(tenantAdminDynamicRoutes.map((r) => r.pattern)).toEqual(["/config/[resource]"]);
  });

  it("resolves the static pages and the dynamic resource page, keeping the query", () => {
    expect(resolveTenantAdminRoute("/")).toMatchObject({ kind: "overview" });
    expect(resolveTenantAdminRoute("/approvals")).toMatchObject({ kind: "approvals" });
    expect(resolveTenantAdminRoute("/activity?x=1")).toMatchObject({ kind: "activity" });
    const open = resolveTenantAdminRoute("/config/price-books?open=12&id=9#top");
    expect(open).toMatchObject({ kind: "resource", resource: "price-books" });
    expect(open?.query.get("open")).toBe("12");
    expect(open?.query.get("id")).toBe("9");
    expect(resolveTenantAdminRoute("/config/items?new=1")?.query.get("new")).toBe("1");
    expect(resolveTenantAdminRoute("/config/e-m-tables")).toMatchObject({ resource: "e-m-tables" });
  });

  it("keeps a question mark inside the query and decodes a percent-encoded key", () => {
    expect(resolveTenantAdminRoute("/config/items?next=/config/tax?x=1")?.query.get("next")).toBe("/config/tax?x=1");
    expect(resolveTenantAdminRoute("/config/gl%2Daccounts")).toMatchObject({ resource: "gl-accounts" });
  });

  it("rejects traversal, encoded separators, control characters, odd segment counts and unknown pages", () => {
    for (const path of ["/config/..", "/config/%2e%2e", "/config/a%2Fb", "/config/a%5Cb", "/config/%00", "/config/%zz", "/config", "/config/items/7", "//evil.example", "config/items", "/nope", "/approvals/extra", "/config/Items", "/config/-items", "/config/items%0A"]) {
      expect(resolveTenantAdminRoute(path), path).toBeNull();
    }
  });

  it("builds deep links with the source's query parameters, encoding the key", () => {
    expect(tenantAdminPaths.resource("items")).toBe("/config/items");
    expect(tenantAdminPaths.resource("items", { open: 12 })).toBe("/config/items?open=12");
    expect(tenantAdminPaths.resource("items", { new: true })).toBe("/config/items?new=1");
    expect(tenantAdminPaths.resource("a/b")).toBe("/config/a%2Fb");
    expect(resolveTenantAdminRoute(tenantAdminPaths.resource("a/b"))).toBeNull();
  });

  it("derives navigation from the backend registry: workspace entries, then each category's pages in registry order", () => {
    const nav = tenantAdminNavigation(meta());
    expect(nav.slice(0, 3).map((n) => n.path)).toEqual(["/", "/approvals", "/activity"]);
    expect(nav.slice(3).map((n) => [n.group, n.path])).toEqual([
      ["Catalogue and pricing", "/config/items"], ["Catalogue and pricing", "/config/tax-rules"], ["Billing policy and models", "/config/reimbursement-routes"],
    ]);
    expect(tenantAdminNavigation({ categories: [], resources: [] })).toHaveLength(3);
  });
});
