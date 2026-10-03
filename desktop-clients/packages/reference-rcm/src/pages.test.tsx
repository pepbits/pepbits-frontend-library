import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ReferenceRcmModule } from "./module";
import { approval, chain, json, makeHost, record, sessionHandler, type Handler, type Recorded } from "./test-utils";

afterEach(cleanup);

const setup = (handler: Handler, path: string, options: Parameters<typeof makeHost>[1] = {}) => {
  const h = makeHost(handler, { path, ...options });
  const view = render(<ReferenceRcmModule path={path} host={h.host} />);
  return { ...h, view };
};
const lists = (calls: Recorded[], resource: string) => calls.filter((c) => c.method === "GET" && c.url.pathname === `/records/${resource}`);
const detail = (r: Recorded, resource = "invoices", id = 7) => r.url.pathname === `/records/${resource}/${id}`;

describe("dashboards", () => {
  it("billing home: cockpit metrics in the scope currency, queue tiles, drawers and only the quick links the registry offers", async () => {
    const { calls } = setup(sessionHandler(), "/");
    expect(await screen.findByText("SAR 2,300.00")).toBeTruthy();
    expect(screen.getByText("SAR 125K")).toBeTruthy();
    expect(screen.getByText("2 receipts")).toBeTruthy();
    expect(screen.getByText("Coverage to verify").closest("a")?.getAttribute("href")).toBe("/w/coverages?status=PENDING_VERIFICATION");
    expect(screen.getByText("All clear")).toBeTruthy();
    expect(screen.getByText("Noor Test")).toBeTruthy();
    expect(screen.getByText("2 exchange messages failing")).toBeTruthy();
    expect(screen.queryByText("Start something")).toBeNull();
    expect(calls.some((c) => c.path === "/dashboard/home")).toBe(true);
  });

  it("billing home never follows a link the server supplies outside the module", async () => {
    setup(sessionHandler(), "/");
    const tile = (await screen.findByText("Evil link")).closest("a")!;
    expect(tile.getAttribute("href")).toBe("/");
  });

  it("navigates the tiles through the host navigator", async () => {
    const h = setup(sessionHandler(), "/");
    fireEvent.click((await screen.findByText("Coverage to verify")).closest("a")!);
    expect(h.navigate).toHaveBeenCalledWith("/w/coverages?status=PENDING_VERIFICATION");
  });

  it("aging: stats, age profile, party matrix and oldest open invoices linking to ?open=<id>", async () => {
    const h = setup(sessionHandler(), "/aging");
    expect(await screen.findByText("Open receivables")).toBeTruthy();
    expect(screen.getByText("SAR 1,000.00")).toBeTruthy();
    expect(screen.getByText("52 days")).toBeTruthy();
    expect(screen.getAllByText("40%").length).toBeGreaterThan(0);
    expect(screen.getByText("Payer One")).toBeTruthy();
    const link = screen.getByText("INV-2026-00007").closest("a")!;
    fireEvent.click(link);
    expect(h.navigate).toHaveBeenCalledWith("/w/invoices?open=7");
    expect(h.calls.find((c) => c.path === "/dashboard/aging")?.headers.get("x-rcm-scope")).toBe("ALL:SAR");
  });

  it("reports: KPI strip with source targets, charts and denial reasons from the API", async () => {
    setup(sessionHandler(), "/reports");
    expect(await screen.findByText("Collection rate")).toBeTruthy();
    expect(screen.getByText("77%")).toBeTruthy();
    expect(screen.getByText("Target 95%")).toBeTruthy();
    expect(screen.getByText("Billed against collected")).toBeTruthy();
    expect(screen.getByText(/Coding error/)).toBeTruthy();
    expect(screen.getByText("Self pay")).toBeTruthy();
  });

  it("shows the server's error on a dashboard instead of an invented zero", async () => {
    setup(chain((r) => { if (r.path === "/dashboard/aging") return json({ error: { code: "INTERNAL", message: "Aging is unavailable." } }, 500); }, sessionHandler()), "/aging");
    expect((await screen.findByRole("alert")).textContent).toBe("Aging is unavailable.");
  });
});

describe("approvals inbox", () => {
  it("splits what the user can decide from what waits for someone else, and shows the server's decision rights", async () => {
    setup(sessionHandler(), "/approvals");
    expect(await screen.findByText("Ready for your decision")).toBeTruthy();
    expect(screen.getByText("For me · 1")).toBeTruthy();
    expect(screen.getByText("Waiting · 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Issue invoice" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Waiting/ }));
    expect(await screen.findByText("Needs someone else")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Issue invoice" })).toBeNull();
  });

  it("decides a row through the action endpoint with the row version, then refreshes the inbox and the badges", async () => {
    const sent: Recorded[] = [];
    const h = setup(chain((r) => { if (r.method === "POST") { sent.push(r); return json(record({ status: "ISSUED" })); } }, sessionHandler()), "/approvals");
    fireEvent.click(await screen.findByRole("button", { name: "Issue invoice" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].path).toBe("/records/invoices/7/actions/issue");
    expect(sent[0].body).toEqual({ rowVersion: 4, input: {}, reason: "" });
    expect(sent[0].headers.get("Idempotency-Key")).toBeTruthy();
    await waitFor(() => expect(h.calls.filter((c) => c.path === "/approvals").length).toBeGreaterThan(1));
    expect(h.calls.filter((c) => c.path === "/pending").length).toBeGreaterThan(1);
  });

  it("asks for the reason and shows the server's refusal inside the dialog", async () => {
    const returnable = approval({ actions: [{ key: "return", label: "Return", tone: "danger", reason: "required", inputs: null }] });
    const handler = chain(
      (r) => { if (r.path === "/approvals") return json([returnable]); },
      (r) => { if (r.method === "POST") return json({ error: { code: "FORBIDDEN", message: "You requested this step." } }, 403); },
      sessionHandler(),
    );
    setup(handler, "/approvals");
    fireEvent.click(await screen.findByRole("button", { name: "Return" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Return" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Wrong payer" } });
    fireEvent.click(confirm);
    expect((await within(dialog).findByRole("alert")).textContent).toBe("You requested this step.");
    expect((within(dialog).getByLabelText(/Reason/) as HTMLTextAreaElement).value).toBe("Wrong payer");
  });
});

describe("registry worklists", () => {
  it("ledger: lists with the host's managed page size, keeps the source defaults (open work, updated desc) and totals the page", async () => {
    const h = setup(sessionHandler(), "/w/invoices", { preferences: { pageSize: 50 } });
    await screen.findByText("INV-2026-00007");
    const first = lists(h.calls, "invoices")[0];
    expect(first.url.searchParams.get("pageSize")).toBe("50");
    expect(first.url.searchParams.get("status")).toBe("ISSUED");
    expect(first.url.searchParams.get("sort")).toBe("updated");
    expect(first.url.searchParams.get("dir")).toBe("desc");
    expect(first.headers.get("x-rcm-scope")).toBe("ALL:SAR");
    expect(screen.getByText("Page total, 1 document")).toBeTruthy();
    expect(screen.getAllByText("SAR 1,150.00").length).toBeGreaterThan(0);
    expect(screen.getByText("1–1 of 1")).toBeTruthy();
    expect(screen.getByText("Layla Test")).toBeTruthy();
  });

  it("applies the managed table presentation to the shared Table", async () => {
    const { view } = setup(sessionHandler(), "/w/invoices", { preferences: { density: "compact", zebraStripes: true, stickyTableHeader: false, wrapCellText: true } as never });
    await screen.findByText("INV-2026-00007");
    const table = view.container.querySelector("table")!;
    expect(table.getAttribute("data-managed-table")).toBe("true");
    expect(table.getAttribute("data-density")).toBe("compact");
    expect(table.getAttribute("data-striped")).toBe("true");
    expect(table.getAttribute("data-sticky")).toBe("false");
    expect(table.getAttribute("data-wrap")).toBe("true");
    expect(table.querySelector("th")?.getAttribute("scope")).toBe("col");
  });

  it("KPI cards, status chips, Overdue and search drive the list query, and a second click on a card clears it", async () => {
    const h = setup(sessionHandler(), "/w/invoices");
    await screen.findByText("INV-2026-00007");
    fireEvent.click(screen.getByRole("button", { name: /Open balance/ }));
    await waitFor(() => expect(lists(h.calls, "invoices").some((c) => c.url.searchParams.get("status") === "ISSUED" && c.url.searchParams.get("overdue") === "1")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /Open balance/ }));
    await waitFor(() => expect(lists(h.calls, "invoices").some((c) => !c.url.searchParams.has("status") && !c.url.searchParams.has("overdue"))).toBe(true));
    fireEvent.click(within(screen.getByRole("group", { name: "Filter by status" })).getByRole("button", { name: /^Paid/ }));
    await waitFor(() => expect(lists(h.calls, "invoices").some((c) => c.url.searchParams.get("status") === "PAID")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /Overdue/ }));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Layla" } });
    await waitFor(() => expect(lists(h.calls, "invoices").some((c) => c.url.searchParams.get("q") === "Layla" && c.url.searchParams.get("overdue") === "1")).toBe(true));
  });

  it("sorts on header click with the source's default directions", async () => {
    const h = setup(sessionHandler(), "/w/invoices");
    await screen.findByText("INV-2026-00007");
    fireEvent.click(screen.getByRole("button", { name: "Reference" }));
    await waitFor(() => expect(lists(h.calls, "invoices").some((c) => c.url.searchParams.get("sort") === "ref" && c.url.searchParams.get("dir") === "asc")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Reference" }));
    await waitFor(() => expect(lists(h.calls, "invoices").some((c) => c.url.searchParams.get("sort") === "ref" && c.url.searchParams.get("dir") === "desc")).toBe(true));
  });

  it("query links: ?status= and ?overdue=1 start filtered; ?q= starts unfiltered by status", async () => {
    const a = setup(sessionHandler(), "/w/claims?status=DENIED");
    await waitFor(() => expect(lists(a.calls, "claims").length).toBeGreaterThan(0));
    cleanup();
    const b = setup(sessionHandler(), "/w/invoices?overdue=1");
    await waitFor(() => expect(lists(b.calls, "invoices")[0]?.url.searchParams.get("overdue")).toBe("1"));
    cleanup();
    const c = setup(sessionHandler(), "/w/invoices?q=INV-2026-00007");
    await waitFor(() => expect(lists(c.calls, "invoices")[0]?.url.searchParams.get("q")).toBe("INV-2026-00007"));
    expect(lists(c.calls, "invoices")[0].url.searchParams.has("status")).toBe(false);
  });

  it("query links: ?open=<id> opens the record without a status filter; ?open=first with ?q= selects the first match", async () => {
    const handler = chain((r) => { if (detail(r)) return json(record()); }, sessionHandler());
    const a = setup(handler, "/w/invoices?open=7");
    await screen.findByRole("heading", { name: "Layla Test" });
    expect(lists(a.calls, "invoices")[0].url.searchParams.has("status")).toBe(false);
    expect(a.calls.some((c) => detail(c))).toBe(true);
    cleanup();
    const b = setup(handler, "/w/invoices?q=INV-2026-00007&open=first");
    await screen.findByRole("heading", { name: "Layla Test" });
    expect(b.calls.some((c) => detail(c))).toBe(true);
  });

  it("re-applies a link to the same page (a reference link or the palette's Open <ref> while on that page)", async () => {
    const handler = chain((r) => { if (detail(r)) return json(record()); }, sessionHandler());
    const h = makeHost(handler, { path: "/w/invoices" });
    const view = render(<ReferenceRcmModule path="/w/invoices" host={h.host} />);
    await screen.findByText("INV-2026-00007");
    view.rerender(<ReferenceRcmModule path="/w/invoices?q=INV-2026-00007&open=first" host={h.host} />);
    await screen.findByRole("heading", { name: "Layla Test" });
  });

  it("shows the lifecycle map until a row is selected, and a click on a stage filters the list", async () => {
    const h = setup(sessionHandler(), "/w/invoices");
    await screen.findByText("INV-2026-00007");
    expect(screen.getByText("Select an invoice to work on it")).toBeTruthy();
    expect(screen.getByText("How an invoice moves")).toBeTruthy();
    expect(screen.getByText("Actions on this page")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Issued\s*3 now/ }));
    await waitFor(() => expect(lists(h.calls, "invoices").some((c) => c.url.searchParams.get("status") === "ISSUED")).toBe(true));
  });
});

describe("record actions", () => {
  const draft = (over = {}) => record(over);
  const invoiceHandler = (rec = draft()): Handler => (r) => { if (detail(r) && r.method === "GET") return json(rec); };

  it("shows the document, status path, figures and activity; the independent action is enabled for a different user", async () => {
    setup(chain(invoiceHandler(), sessionHandler()), "/w/invoices?open=7");
    expect(await screen.findByText("Tax invoice")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Progress" })).toBeTruthy();
    expect(screen.getAllByText("SAR 1,150.00").length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Issue invoice" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("tab", { name: /Activity/ }));
    expect(await screen.findByText("Created as draft.")).toBeTruthy();
  });

  it("blocks an independent action the user is involved in, with the reason, before the server has to", async () => {
    setup(chain(invoiceHandler(draft({ createdBy: 1 })), sessionHandler()), "/w/invoices?open=7");
    const button = (await screen.findByRole("button", { name: "Issue invoice" })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/different person/);
    expect(screen.getByText(/Shielded actions need a second person/)).toBeTruthy();
    expect(screen.queryByText(/switch person/i)).toBeNull();
  });

  it("runs a plain action once: a double click posts one write, with the row version and an idempotency key, and the pane shows the server's record", async () => {
    const posts: Recorded[] = [];
    let release!: () => void;
    const handler = chain((r) => {
      if (r.method === "POST") { posts.push(r); return new Promise((resolve) => { release = () => resolve(json(record({ status: "ISSUED", rowVersion: 5, timeline: [{ id: 2, at: "2026-10-01T08:00:00Z", actorId: 1, action: "issue", from: "DRAFT", to: "ISSUED", summary: "Invoice INV-2026-00007 issued.", reason: null }] }))); }); }
    }, invoiceHandler(), sessionHandler());
    setup(handler, "/w/invoices?open=7");
    const button = await screen.findByRole("button", { name: "Issue invoice" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].path).toBe("/records/invoices/7/actions/issue");
    expect(posts[0].body).toEqual({ rowVersion: 4, input: {}, reason: "" });
    expect(posts[0].headers.get("Idempotency-Key")).toBeTruthy();
    release();
    expect(await screen.findByText("Invoice INV-2026-00007 issued.")).toBeTruthy();
    expect(posts).toHaveLength(1);
  });

  it("collects a required reason through the shared Modal, keeps it and the server's field errors when refused, and sends it on success", async () => {
    const cov = record({ id: 21, ref: "COV-2026-00021", status: "PENDING_VERIFICATION", title: "M-1", createdBy: 2, statusBy: 2, values: { memberId: "M-1" }, labels: {}, patient: { id: 3, name: "Layla Test", mrn: "MRN-0003" } });
    let attempts = 0;
    const handler = chain((r) => {
      if (detail(r, "coverages", 21) && r.method === "GET") return json(cov);
      if (r.method === "POST" && r.path === "/records/coverages/21/actions/reject") {
        if (++attempts === 1) return json({ error: { code: "VALIDATION", message: "Reason is too short.", fieldErrors: { reason: "Say why." } } }, 422);
        return json({ ...cov, status: "REJECTED", rowVersion: 5 });
      }
    }, sessionHandler());
    const h = setup(handler, "/w/coverages?open=21");
    fireEvent.click(await screen.findByRole("button", { name: "Reject coverage" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Reject coverage" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "x" } });
    fireEvent.click(confirm);
    expect(await within(dialog).findByText("Say why.")).toBeTruthy();
    expect(within(dialog).getByText("Reason is too short.")).toBeTruthy();
    expect((within(dialog).getByLabelText(/Reason/) as HTMLTextAreaElement).value).toBe("x");
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Card expired" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject coverage" }));
    await waitFor(() => expect(h.calls.filter((c) => c.method === "POST")).toHaveLength(2));
    expect(h.calls.filter((c) => c.method === "POST")[1].body).toEqual({ rowVersion: 4, input: {}, reason: "Card expired" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes the dialog and reloads the record on STALE_VERSION", async () => {
    const cov = record({ id: 21, ref: "COV-2026-00021", status: "PENDING_VERIFICATION", createdBy: 2, statusBy: 2, values: {}, labels: {} });
    let reads = 0;
    const handler = chain((r) => {
      if (detail(r, "coverages", 21) && r.method === "GET") { reads++; return json(cov); }
      if (r.method === "POST") return json({ error: { code: "STALE_VERSION", message: "Someone else changed this record." } }, 409);
    }, sessionHandler());
    setup(handler, "/w/coverages?open=21");
    fireEvent.click(await screen.findByRole("button", { name: "Reject coverage" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Reason" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject coverage" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(reads).toBeGreaterThan(1));
    expect(await screen.findByText("Record changed")).toBeTruthy();
  });

  it("edits an editable record in place and saves with the row version", async () => {
    const puts: Recorded[] = [];
    const handler = chain((r) => { if (r.method === "PUT") { puts.push(r); return json(draft({ title: "Visit 115", rowVersion: 5 })); } }, invoiceHandler(), sessionHandler());
    setup(handler, "/w/invoices?open=7");
    fireEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Details" }));
    const ref = await screen.findByDisplayValue("Visit 114");
    fireEvent.change(ref, { target: { value: "Visit 115" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0].body).toMatchObject({ rowVersion: 4, values: { reference: "Visit 115" } });
    expect(puts[0].headers.get("Idempotency-Key")).toBeTruthy();
  });
});

describe("create", () => {
  it("opens the New drawer for ?new=1, defaults like the source, posts once and selects the created record", async () => {
    const posts: Recorded[] = [];
    let release!: () => void;
    const handler = chain((r) => {
      if (r.method === "POST" && r.path === "/records/coverages") { posts.push(r); return new Promise((resolve) => { release = () => resolve(json(record({ id: 31, ref: "COV-2026-00031", status: "PENDING_VERIFICATION", createdBy: 1, values: {}, labels: {} }), 201)); }); }
    }, chain((r) => { if (r.path === "/records/coverages/31") return json(record({ id: 31, ref: "COV-2026-00031", status: "PENDING_VERIFICATION", values: {}, labels: {} })); }, sessionHandler()));
    const h = setup(handler, "/w/coverages?new=1");
    const dialog = await screen.findByRole("dialog", { name: "New coverage" });
    expect(within(dialog).getByText(/Reference COV-… is assigned on save/)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Member ID/), { target: { value: "ab-1" } });
    expect((within(dialog).getByLabelText(/Member ID/) as HTMLInputElement).value).toBe("AB-1");
    const create = within(dialog).getByRole("button", { name: "Create coverage" });
    fireEvent.click(create);
    fireEvent.click(create);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body).toMatchObject({ values: { memberId: "AB-1", assignee: 1 } });
    expect(posts[0].headers.get("x-rcm-scope")).toBe("ALL:SAR");
    release();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New coverage" })).toBeNull());
    expect(await screen.findByText("COV-2026-00031 created")).toBeTruthy();
    expect(posts).toHaveLength(1);
    expect(h.calls.some((c) => c.path === "/records/coverages/31")).toBe(true);
  });

  it("keeps the typed values and shows the server's field errors when creation is refused, then replays the same key after a lost answer", async () => {
    const posts: Recorded[] = [];
    let n = 0;
    const handler = chain((r) => {
      if (r.method !== "POST") return undefined;
      posts.push(r);
      n++;
      if (n === 1) return json({ error: { code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors: { memberId: "Member ID is not valid." } } }, 422);
      if (n === 2) return json({ error: { code: "BAD_GATEWAY", message: "Upstream timeout." } }, 503);
      return json(record({ id: 32, status: "PENDING_VERIFICATION", values: {}, labels: {} }), 201);
    }, sessionHandler());
    setup(handler, "/w/coverages?new=1");
    const dialog = await screen.findByRole("dialog", { name: "New coverage" });
    fireEvent.change(within(dialog).getByLabelText(/Member ID/), { target: { value: "x1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create coverage" }));
    expect(await within(dialog).findByText("Member ID is not valid.")).toBeTruthy();
    expect(screen.getAllByText("Check the highlighted fields.").length).toBeGreaterThan(0);
    expect((within(dialog).getByLabelText(/Member ID/) as HTMLInputElement).value).toBe("X1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create coverage" }));
    await waitFor(() => expect(posts).toHaveLength(2));
    await screen.findByText("Upstream timeout.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create coverage" }));
    await waitFor(() => expect(posts).toHaveLength(3));
    expect(posts[2].headers.get("Idempotency-Key")).toBe(posts[1].headers.get("Idempotency-Key"));
    expect(posts[1].headers.get("Idempotency-Key")).not.toBe(posts[0].headers.get("Idempotency-Key"));
  });

  it("shows no New button on a page the registry does not let you create on, and ignores ?new=1 there", async () => {
    const h = setup(sessionHandler(), "/w/claims?new=1");
    await screen.findByRole("region", { name: "Ready" });
    expect(lists(h.calls, "claims").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /New claim/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("searches reference fields on the server through the options endpoint", async () => {
    const h = setup(sessionHandler(), "/w/coverages?new=1");
    const dialog = await screen.findByRole("dialog", { name: "New coverage" });
    fireEvent.click(within(dialog).getByRole("combobox", { name: /Patient/ }));
    await waitFor(() => expect(h.calls.some((c) => c.path === "/options/patients")).toBe(true));
    expect(await within(dialog).findByText(/Sami Test/)).toBeTruthy();
  });
});

describe("layouts", () => {
  it("board: one column per stage with every card, asks for the server's largest page, and opens a card in the side panel", async () => {
    const rows = [record({ id: 41, ref: "CLM-1", status: "READY", amount: 500, balance: 500 }), record({ id: 42, ref: "CLM-2", status: "DENIED", amount: 900, balance: 900 })];
    const handler = chain((r) => { if (r.path === "/records/claims/41") return json(rows[0]); }, sessionHandler({ rows }));
    const h = setup(handler, "/w/claims");
    await screen.findByText("CLM-1");
    expect(screen.getAllByRole("region").map((s) => s.getAttribute("aria-label"))).toEqual(["Ready", "Submitted", "Denied"]);
    expect(lists(h.calls, "claims")[0].url.searchParams.get("pageSize")).toBe("300");
    expect(lists(h.calls, "claims")[0].url.searchParams.has("status")).toBe(false);
    fireEvent.click(screen.getByText("CLM-1"));
    expect(await screen.findByRole("button", { name: "Submit claim" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    await waitFor(() => expect(lists(h.calls, "claims").some((c) => c.url.searchParams.get("pageSize") === "20")).toBe(true));
    expect(document.querySelector("[data-rcm-board]")).toBeNull();
  });

  it("live monitor: refreshes on an interval while live, can be paused, and marks failing messages", async () => {
    const rows = [record({ id: 51, ref: "MSG-51", status: "FAILED", patient: null, title: "ERA 835", values: { lastError: "Timeout" }, amount: 0, balance: 0 })];
    const h = setup(sessionHandler({ rows }), "/w/exchange-messages");
    await screen.findByText("MSG-51");
    expect(screen.getByText("Timeout")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: /^Live/ });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Paused" })).toBeTruthy();
    expect(lists(h.calls, "exchange-messages").length).toBeGreaterThan(0);
  });

  it("keyboard: N opens the New drawer, arrows move the selection, / focuses search; none of it while the host's shortcut preference is off", async () => {
    const rows = [record({ id: 61, ref: "COV-61", status: "PENDING_VERIFICATION", values: {}, labels: {} }), record({ id: 62, ref: "COV-62", status: "PENDING_VERIFICATION", values: {}, labels: {} })];
    const handler = chain((r) => { const m = /^\/records\/coverages\/(\d+)$/.exec(r.path); if (m) return json(rows.find((x) => x.id === Number(m[1]))); }, sessionHandler({ rows }));
    const on = setup(handler, "/w/coverages");
    await screen.findByText("COV-61");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await waitFor(() => expect(on.calls.some((c) => c.path === "/records/coverages/61")).toBe(true));
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await waitFor(() => expect(on.calls.some((c) => c.path === "/records/coverages/62")).toBe(true));
    fireEvent.keyDown(window, { key: "/" });
    expect(document.activeElement).toBe(screen.getByLabelText("Search"));
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(window, { key: "n" });
    expect(await screen.findByRole("dialog", { name: "New coverage" })).toBeTruthy();
    cleanup();

    const off = setup(handler, "/w/coverages", { preferences: { keyboardShortcuts: false } });
    await screen.findByText("COV-61");
    fireEvent.keyDown(window, { key: "n" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(off.calls.some((c) => /\/records\/coverages\/\d+$/.test(c.path))).toBe(false);
    expect(screen.queryByText("/", { selector: ".kbd" })).toBeNull();
  });

  it("does not fire single-key shortcuts while typing in a field", async () => {
    setup(sessionHandler(), "/w/coverages");
    const search = await screen.findByLabelText("Search");
    search.focus();
    fireEvent.keyDown(search, { key: "n" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the server's list error with a retry instead of an empty list", async () => {
    let fail = true;
    const handler = chain((r) => { if (r.method === "GET" && r.path.startsWith("/records/invoices?") && fail) return json({ error: { code: "INTERNAL", message: "The ledger is busy." } }, 500); }, sessionHandler());
    const h = setup(handler, "/w/invoices");
    expect((await screen.findByRole("alert")).textContent).toContain("The ledger is busy.");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("INV-2026-00007");
    expect(lists(h.calls, "invoices").length).toBeGreaterThan(1);
  });

  it("formats dates and amounts with the host's preferences, not the source's fixed en-GB / en-US", async () => {
    setup(chain((r) => { if (detail(r)) return json(record()); }, sessionHandler()), "/w/invoices?open=7", { preferences: { dateFormat: "dmy", numberLocale: "de-DE" } as never });
    expect((await screen.findAllByText("SAR 1.150,00")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("30/10/2026").length).toBeGreaterThan(0);
  });
});
