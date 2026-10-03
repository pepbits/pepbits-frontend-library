import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { LocalizationProvider } from "@pepbits/ops-ui";
import copy from "../tenant-admin-copy.json";
import { ReferenceTenantAdminModule } from "./module";
import { chain, json, makeHost, meta, record, sessionHandler, type Handler } from "./test-utils";

afterEach(cleanup);

const setup = (handler: Handler, path = "/", options: Parameters<typeof makeHost>[1] = {}) => {
  const h = makeHost(handler, { path, ...options });
  const view = render(<ReferenceTenantAdminModule path={path} host={h.host} />);
  return { ...h, view };
};
const overviewHeading = () => screen.findByRole("heading", { name: "Billing is closed for Meridian Test" });

describe("ReferenceTenantAdminModule host contract", () => {
  it("authenticates through the host session only: /meta then the page data via host.request, no actor header, no storage, no /api", async () => {
    const { calls, view } = setup(sessionHandler());
    expect(await overviewHeading()).toBeTruthy();
    const paths = calls.map((c) => c.path);
    expect(paths[0]).toBe("/meta");
    expect(paths).toEqual(expect.arrayContaining(["/pending", "/overview", "/approvals"]));
    expect(paths.every((p) => !p.startsWith("/api") && !p.startsWith("http"))).toBe(true);
    expect(calls.every((c) => !c.headers.has("x-actor-id") && !c.headers.has("Authorization"))).toBe(true);
    expect(window.localStorage.length).toBe(0);
    expect(view.container.querySelector('input[type="password"]')).toBeNull();
  });

  it("renders the page body with a compact toolbar: no source rail, no user menu, no sign-in, and the signed-in user cannot be switched", async () => {
    const { view } = setup(sessionHandler());
    await overviewHeading();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
    expect(screen.queryByText(/demo sign-in|switch people/i)).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("menuitemradio")).toBeNull();
    const root = view.container.querySelector(".reference-tenant-admin");
    expect(root?.getAttribute("data-reference-module")).toBe("tenant-admin");
    expect(screen.getByText("Meridian Test")).toBeTruthy();
    expect(screen.getByText("Test environment, synthetic data")).toBeTruthy();
  });

  it("refuses to render without a host-managed signed-in user", async () => {
    setup(sessionHandler({ meta: { currentUser: undefined } }));
    expect((await screen.findByRole("alert")).textContent).toContain("could not confirm who you are");
    cleanup();
    setup(sessionHandler({ meta: { hostManagedIdentity: false } }));
    expect((await screen.findByRole("alert")).textContent).toContain("could not confirm who you are");
  });

  it("shows a recoverable error, not a login form, when the host session is refused, and retries", async () => {
    let allow = false;
    const gate: Handler = (r) => { if (r.url.pathname === "/meta" && !allow) return json({ error: { code: "FORBIDDEN", message: "Your role cannot use Tenant Admin." } }, 403); };
    const { calls } = setup(chain(gate, sessionHandler()));
    expect((await screen.findByRole("alert")).textContent).toContain("Your role cannot use Tenant Admin.");
    allow = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await overviewHeading()).toBeTruthy();
    expect(calls.filter((c) => c.path === "/meta")).toHaveLength(2);
  });

  it("says so for an unknown path instead of rendering a page", async () => {
    setup(sessionHandler(), "/config/../secret");
    expect(await screen.findByText("This page doesn’t exist")).toBeTruthy();
    expect(screen.getByText(/any of the 3 configuration pages/)).toBeTruthy();
  });

  it("remounts on a scope change: it aborts the old scope's requests, reloads identity and starts with none of the previous scope's data", async () => {
    const first = makeHost(chain((r) => { if (r.url.pathname === "/overview") return new Promise(() => {}); }, sessionHandler()), { path: "/" });
    const view = render(<ReferenceTenantAdminModule path="/" host={first.host} />);
    await waitFor(() => expect(first.calls.some((c) => c.path === "/overview")).toBe(true));
    const inFlight = first.calls.find((c) => c.path === "/overview")!.signal!;
    expect(inFlight.aborted).toBe(false);
    const other = makeHost(() => new Promise(() => {}), { path: "/", scope: { tenantId: "tenant-2" } });
    view.rerender(<ReferenceTenantAdminModule path="/" host={other.host} />);
    await waitFor(() => expect(other.calls.some((c) => c.path === "/meta")).toBe(true));
    expect(inFlight.aborted).toBe(true);
    expect(screen.queryByText("Meridian Test")).toBeNull();
    expect(other.calls.every((c) => c.path === "/meta")).toBe(true);
  });

  it("aborts in-flight reads on unmount and ignores their late answers", async () => {
    let release!: () => void;
    const slow: Handler = (r) => { if (r.url.pathname === "/meta") return new Promise((resolve) => { release = () => resolve(json(meta())); }); };
    const { calls, view } = setup(slow);
    await waitFor(() => expect(calls).toHaveLength(1));
    view.unmount();
    expect(calls[0].signal?.aborted).toBe(true);
    await act(async () => { release(); });
  });
});

describe("configuration pages", () => {
  it("lists records from the registry-driven page with the host's managed page size, and follows a page-size change", async () => {
    const h = makeHost(sessionHandler(), { path: "/config/items", preferences: { pageSize: 50 } });
    const view = render(<ReferenceTenantAdminModule path="/config/items" host={h.host} />);
    expect(await screen.findByText("Consultation")).toBeTruthy();
    const firstList = h.calls.find((c) => c.url.pathname === "/resources/items");
    expect(firstList?.url.searchParams.get("pageSize")).toBe("50");
    expect(firstList?.url.searchParams.get("sort")).toBe("updated");
    const next = makeHost(sessionHandler(), { path: "/config/items", preferences: { pageSize: 20 } });
    next.host.scope = h.host.scope;
    view.rerender(<ReferenceTenantAdminModule path="/config/items" host={{ ...h.host, preferences: next.host.preferences }} />);
    await waitFor(() => expect(h.calls.some((c) => c.url.pathname === "/resources/items" && c.url.searchParams.get("pageSize") === "20")).toBe(true));
  });

  it("formats dates with the host's date format", async () => {
    setup(sessionHandler(), "/config/items", { preferences: { dateFormat: "dmy" } as never });
    expect(await screen.findByText("01/10/2026")).toBeTruthy();
  });

  it("says a page does not exist when the registry does not list the key", async () => {
    setup(sessionHandler(), "/config/nope");
    expect(await screen.findByText("That configuration page doesn’t exist.")).toBeTruthy();
  });

  it("opens the record drawer from ?open=, ?id= and ?new=, and closes it through the host navigator", async () => {
    const handler = chain((r) => { if (r.url.pathname === "/resources/items/7") return json(record()); }, sessionHandler());
    const a = setup(handler, "/config/items?open=7");
    expect(await screen.findByRole("dialog", { name: "Item" })).toBeTruthy();
    expect(await screen.findByDisplayValue("Consultation")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(a.navigate).toHaveBeenCalledWith("/config/items"));
    cleanup();
    const b = setup(handler, "/config/items?id=7");
    expect(await screen.findByDisplayValue("Consultation")).toBeTruthy();
    expect(b.calls.some((c) => c.path === "/resources/items/7")).toBe(true);
    cleanup();
    setup(handler, "/config/items?new=1");
    expect(await screen.findByRole("dialog", { name: "New item" })).toBeTruthy();
    cleanup();
    const bad = setup(handler, "/config/items?open=abc");
    await screen.findByText("Consultation");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(bad.calls.some((c) => /\/resources\/items\/\w+$/.test(c.path))).toBe(false);
  });

  it("saves with Ctrl+S carrying the row version, and only while the form is editable and shortcuts are on", async () => {
    const saved: unknown[] = [];
    const handler = chain((r) => {
      if (r.url.pathname === "/resources/items/7" && r.method === "GET") return json(record());
      if (r.url.pathname === "/resources/items/7" && r.method === "PUT") { saved.push(r.body); return json(record({ name: "Consultation 2", rowVersion: 2 })); }
    }, sessionHandler());
    const on = setup(handler, "/config/items?open=7");
    const name = await screen.findByDisplayValue("Consultation");
    fireEvent.change(name, { target: { value: "Consultation 2" } });
    fireEvent.keyDown(name, { key: "s", ctrlKey: true });
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ name: "Consultation 2", rowVersion: 1, data: { kind: "SERVICE", price: 120 } });
    expect(on.calls.find((c) => c.method === "PUT")?.headers.get("Idempotency-Key")).toBeTruthy();
    cleanup();

    const off = setup(handler, "/config/items?open=7", { preferences: { keyboardShortcuts: false } });
    const field = await screen.findByDisplayValue("Consultation");
    fireEvent.change(field, { target: { value: "Changed" } });
    fireEvent.keyDown(field, { key: "s", ctrlKey: true });
    await new Promise((r) => setTimeout(r, 30));
    expect(off.calls.some((c) => c.method === "PUT")).toBe(false);
    cleanup();

    const locked = chain((r) => { if (r.url.pathname === "/resources/items/7") return json(record({ status: "APPROVED" })); }, sessionHandler());
    const frozen = setup(locked, "/config/items?open=7");
    await screen.findByText(/This version is locked/);
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await new Promise((r) => setTimeout(r, 30));
    expect(frozen.calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("explains a refused self-approval before the server has to: the author cannot approve or return their own submission", async () => {
    const pending = record({ status: "PENDING_APPROVAL", submittedBy: 1, submittedAt: "2026-09-30T09:00:00Z" });
    setup(chain((r) => { if (r.url.pathname === "/resources/items/7") return json(pending); }, sessionHandler()), "/config/items?open=7");
    expect(await screen.findByText(/You submitted this, so someone else must decide it/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Return for changes" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lets another user decide, through the shared reason dialog, posting the row version and a reason", async () => {
    const pending = record({ status: "PENDING_APPROVAL", createdBy: 2, submittedBy: 2, submittedAt: "2026-09-30T09:00:00Z" });
    const decided: unknown[] = [];
    const handler = chain((r) => {
      if (r.url.pathname === "/resources/items/7" && r.method === "GET") return json(pending);
      if (r.url.pathname === "/resources/items/7/reject") { decided.push(r.body); return json(record({ status: "REJECTED", decisionReason: "Fix the price", decidedBy: 1 })); }
    }, sessionHandler());
    setup(handler, "/config/items?open=7");
    fireEvent.click(await screen.findByRole("button", { name: "Return for changes" }));
    const dialog = await screen.findByRole("dialog", { name: "Return for changes" });
    const confirm = within(dialog).getByRole("button", { name: "Return for changes" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Fix the price" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(decided).toEqual([{ rowVersion: 1, reason: "Fix the price" }]));
  });

  it("keeps the typed values and shows the server's field errors when a save is refused", async () => {
    const handler = chain((r) => {
      if (r.url.pathname === "/resources/items/7" && r.method === "GET") return json(record());
      if (r.method === "PUT") return json({ error: { code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors: { name: "Name is required." } } }, 422);
    }, sessionHandler());
    setup(handler, "/config/items?open=7");
    const name = await screen.findByDisplayValue("Consultation");
    fireEvent.change(name, { target: { value: "Edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Name is required.")).toBeTruthy();
    expect((screen.getByDisplayValue("Edited") as HTMLInputElement).value).toBe("Edited");
  });

  it("reloads the record and says so on a stale version", async () => {
    let gets = 0;
    const handler = chain((r) => {
      if (r.url.pathname === "/resources/items/7" && r.method === "GET") { gets++; return json(record({ rowVersion: gets })); }
      if (r.url.pathname === "/resources/items/7/submit") return json({ error: { code: "STALE_VERSION", message: "Someone changed this record." } }, 409);
    }, sessionHandler());
    setup(handler, "/config/items?open=7");
    fireEvent.click(await screen.findByRole("button", { name: "Submit for approval" }));
    const dialog = await screen.findByRole("dialog", { name: "Submit for approval" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for approval" }));
    expect(await screen.findByText("Someone changed this record.")).toBeTruthy();
    await waitFor(() => expect(gets).toBe(2));
  });

  it("gives the drawer and its dialogs the module scope and the host theme (shared overlays render outside the page body)", async () => {
    setup(chain((r) => { if (r.url.pathname === "/resources/items/7") return json(record()); }, sessionHandler()), "/config/items?open=7", { preferences: { theme: "midnight" } });
    await screen.findByDisplayValue("Consultation");
    const scope = document.querySelector('[role="dialog"] .reference-tenant-admin[data-overlay="true"]');
    expect(scope?.getAttribute("data-theme")).toBe("midnight");
  });

  it("opens the route tester with scope-partitioned option lists: another scope never reads the first scope's options", async () => {
    const options: Handler = (r) => { if (/\/options$/.test(r.url.pathname)) return json([{ id: 1, code: "ITM-1", name: r.url.pathname.includes("items") ? "Consultation" : "Contract A", status: "APPROVED", revision: 1 }]); };
    const a = makeHost(chain(options, sessionHandler()), { path: "/config/reimbursement-routes" });
    const view = render(<ReferenceTenantAdminModule path="/config/reimbursement-routes" host={a.host} />);
    fireEvent.click(await screen.findByRole("button", { name: "Test route selection" }));
    await waitFor(() => expect(a.calls.filter((c) => /\/options$/.test(c.path)).map((c) => c.path).sort()).toEqual(["/resources/contracts/options", "/resources/items/options"]));
    const b = makeHost(chain(options, sessionHandler()), { path: "/config/reimbursement-routes", scope: { branchId: "other" } });
    view.rerender(<ReferenceTenantAdminModule path="/config/reimbursement-routes" host={b.host} />);
    await screen.findByRole("button", { name: "Test route selection" });
    fireEvent.click(screen.getByRole("button", { name: "Test route selection" }));
    await waitFor(() => expect(b.calls.filter((c) => /\/options$/.test(c.path))).toHaveLength(2));
  });
});

describe("workspace pages", () => {
  it("decides from the approvals inbox only for submissions by others, through the host transport", async () => {
    const queue = [
      { resource: "items", resourceLabel: "Items and services", category: "catalogue", id: 7, code: "ITM-0007", name: "Consultation", revision: 1, rowVersion: 4, effectiveFrom: null, submittedBy: 2, submittedAt: "2026-09-30T09:00:00Z", createdBy: 2, changeReason: "Annual review" },
      { resource: "tax-rules", resourceLabel: "Tax rules", category: "catalogue", id: 3, code: "TAX-0003", name: "VAT", revision: 1, rowVersion: 2, effectiveFrom: null, submittedBy: 1, submittedAt: "2026-09-30T09:00:00Z", createdBy: 1, changeReason: null },
    ];
    const approved: unknown[] = [];
    const handler = chain((r) => {
      if (r.url.pathname === "/approvals") return json(queue);
      if (r.url.pathname === "/resources/items/7/approve") { approved.push(r.body); return json(record({ status: "APPROVED" })); }
    }, sessionHandler());
    setup(handler, "/approvals");
    expect(await screen.findByText("Consultation")).toBeTruthy();
    expect(screen.queryByText("VAT")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog", { name: "Approve ITM-0007" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approved).toEqual([{ rowVersion: 4 }]));
    fireEvent.click(screen.getByRole("tab", { name: /Your submissions/ }));
    expect(await screen.findByText("Waiting for another approver")).toBeTruthy();
  });

  it("filters the audit trail through the audit endpoint, with the directory only for labels", async () => {
    const event = { id: 1, at: "2026-09-30T09:00:00Z", actorId: 2, resource: "items", recordId: 7, recordCode: "ITM-0007", action: "SUBMITTED", summary: "Submitted for approval", reason: null };
    const { calls } = setup(chain((r) => { if (r.url.pathname === "/audit") return json([event]); }, sessionHandler()), "/activity");
    expect(await screen.findByText("Omar Test")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filter by action"), { target: { value: "SUBMITTED" } });
    await waitFor(() => expect(calls.some((c) => c.url.pathname === "/audit" && c.url.searchParams.get("action") === "SUBMITTED")).toBe(true));
    const link = screen.getByRole("link", { name: "ITM-0007" });
    expect(link.getAttribute("href")).toBe("/config/items?open=7");
  });
});

describe("shortcuts and the palette", () => {
  it("keeps Ctrl+K for the palette while shortcuts are on, unbinds it when the host turns them off, and keeps the toolbar button", async () => {
    const on = setup(sessionHandler());
    await overviewHeading();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByLabelText("Search")).toBeTruthy();
    on.view.unmount();
    cleanup();
    const off = setup(sessionHandler(), "/", { preferences: { keyboardShortcuts: false } });
    await overviewHeading();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByLabelText("Search")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Jump to a page/ }));
    expect(await screen.findByLabelText("Search")).toBeTruthy();
    expect(off.calls.length).toBeGreaterThan(0);
  });

  it("lists registry pages and New entries, and routes through the host navigator", async () => {
    const { navigate } = setup(sessionHandler());
    await overviewHeading();
    fireEvent.click(screen.getByRole("button", { name: /Jump to a page/ }));
    const input = await screen.findByLabelText("Search");
    fireEvent.change(input, { target: { value: "new tax" } });
    fireEvent.click(await screen.findByRole("option", { name: /New tax rule/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/config/tax-rules?new=1"));
  });
});

describe("localization", () => {
  it("resolves source labels through the host catalog, leaving record values untouched", async () => {
    const h = makeHost(sessionHandler(), { path: "/config/items" });
    render(<LocalizationProvider value={{ language: "ar", direction: "rtl", dateTime: String, t: (key) => (key === copy["Changes need an independent approver."] ? "التغييرات تحتاج موافقا مستقلا" : key) }}><ReferenceTenantAdminModule path="/config/items" host={h.host} /></LocalizationProvider>);
    expect(await screen.findByText("التغييرات تحتاج موافقا مستقلا")).toBeTruthy();
    expect(await screen.findByText("Consultation")).toBeTruthy();
  });
});
