import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ReferencePharmacyModule } from "./module";
import { pharmacyRoutes } from "./routes";
import { IDEMPOTENCY_HEADER } from "./lib/api";
import { chain, dashboard, json, makeHost, sessionHandler, type Handler } from "./test-utils";

afterEach(cleanup);

/** jsdom has no matchMedia; the workbench reads the desktop breakpoint through it. */
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
});

/** Every list endpoint answers empty and every summary with zeros: fictional, enough for each page to mount and settle. */
const empty: Handler = (r) => {
  const p = r.url.pathname;
  if (["/prescriptions", "/orders", "/authorizations"].includes(p)) return json({ rows: [], counts: {} });
  if (p === "/products") return json({ rows: [], categories: [] });
  if (p === "/audit") return json({ rows: [], total: 0 });
  if (p === "/sales/summary") return json({ invoices: 0, gross: 0, refunded: 0, net: 0, otc: 0, rx: 0, methods: [], top: [] });
  if (p === "/claims/summary") return json({ byStatus: [], underpaid: { n: 0, amount: null }, aging: [], denials: [] });
  if (["/sales", "/sales/recent", "/sales/returns", "/purchase-orders", "/reorder-suggestions", "/patients", "/batches", "/movements", "/claims", "/remittances", "/payments", "/payers"].includes(p)) return json([]);
};

const chainNodes = ["prescription", "authorization", "dispensing", "bill", "claim", "remittance", "payment"].map((key, i) => ({ key, label: key, ref: i ? null : "RX-0001", status: i ? "none" : "received", detail: "", count: i ? 0 : 1 }));
const rx = (stage: string, status: string) => ({
  id: "rx1", rx_no: "RX-0001", status, priority: "routine", source: "paper", received_at: new Date(Date.now() - 3 * 60000).toISOString(), diagnosis: null, stage,
  patient_id: "pt1", patient_name: "Test Patient", mrn: "MRN-1", dob: "1980-01-01", doctor_name: "Dr Test", item_count: 1, item_names: "Testamol 500 mg", cold: 0, controlled: 0, auth_status: null, payer_code: null, collection: null, updated_at: new Date().toISOString(),
  doctor_id: "d1", diagnosis_code: null, notes: null, written_at: "2026-09-30",
  patient: { id: "pt1", name: "Test Patient", mrn: "MRN-1", dob: "1980-01-01", gender: "F", phone: "000", weight_kg: 60, allergies: [], conditions: [] },
  doctor: { name: "Dr Test", specialty: "GP", facility: "Demo Clinic", license_no: "L-1" },
  coverages: [], authorizations: [], dispensings: [], claims: [], history: [], alerts: [], chain: chainNodes,
  items: [{ id: "i1", product_id: "pr1", name: "Testamol 500 mg", generic: "testamol", strength: "500 mg", form: "Tablet", dispense_unit: "tablet", schedule: "pom", cold_chain: 0, requires_auth: 0, qty_prescribed: 30, qty_dispensed: 0, qty_pending: 0, qty_remaining: 30, qty_authorized: null, available: 100, sig: "1 tablet daily", location: "A1", price_per_unit: 1, batches: [] }],
});

describe("every original route mounts through the host", () => {
  for (const route of pharmacyRoutes) {
    it(`${route.path} loads its data with host GETs only and shows no failure`, async () => {
      const h = makeHost(chain(empty, sessionHandler()), { path: route.path });
      const view = render(<ReferencePharmacyModule path={route.path} host={h.host} />);
      await waitFor(() => expect(view.container.querySelector("#main")?.children.length).toBeGreaterThan(0));
      await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
      expect(screen.queryByRole("alert")).toBeNull();
      expect(h.calls.length).toBeGreaterThan(1);
      expect(h.calls.every((c) => c.method === "GET")).toBe(true);
      expect(h.calls.every((c) => !c.path.startsWith("/api"))).toBe(true);
    });
  }
});

describe("workbench through the host", () => {
  it("opens the prescription named in the query and a workflow action posts once with an idempotency key, then follows the Rx to its new stage", async () => {
    let stage = "intake";
    const flow: Handler = (r) => {
      if (r.url.pathname === "/prescriptions" && r.method === "GET") return json({ rows: [rx(stage, "received")], counts: { intake: 1 } });
      if (r.url.pathname === "/prescriptions/rx1" && r.method === "GET") return json(rx(stage, "received"));
      if (r.url.pathname === "/prescriptions/rx1/review" && r.method === "POST") { stage = "review"; return json(rx("review", "in_review")); }
    };
    const h = makeHost(chain(flow, empty, sessionHandler()), { path: "/workbench?stage=intake&rx=rx1" });
    render(<ReferencePharmacyModule path="/workbench?stage=intake&rx=rx1" host={h.host} />);
    fireEvent.click(await screen.findByRole("button", { name: /Start review/ }));
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/workbench?stage=review&rx=rx1"));
    const posts = h.calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe("/prescriptions/rx1/review");
    expect(posts[0].headers.get(IDEMPOTENCY_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("shows the server's message, in place, when an action is refused", async () => {
    const flow: Handler = (r) => {
      if (r.url.pathname === "/prescriptions" && r.method === "GET") return json({ rows: [rx("intake", "received")], counts: { intake: 1 } });
      if (r.url.pathname === "/prescriptions/rx1" && r.method === "GET") return json(rx("intake", "received"));
      if (r.url.pathname === "/prescriptions/rx1/review" && r.method === "POST") return json({ error: { code: "conflict", message: "Another pharmacist already opened this prescription." } }, 409);
    };
    const h = makeHost(chain(flow, empty, sessionHandler()), { path: "/workbench?stage=intake&rx=rx1" });
    render(<ReferencePharmacyModule path="/workbench?stage=intake&rx=rx1" host={h.host} />);
    fireEvent.click(await screen.findByRole("button", { name: /Start review/ }));
    expect(await screen.findByText("Another pharmacist already opened this prescription.")).toBeTruthy();
    expect(h.navigate).not.toHaveBeenCalled();
  });
});

describe("links that target a tab, and server figures shown as reported", () => {
  it("selects the claims tab a link names while the page is already open, and asks the server for that status", async () => {
    const h = makeHost(chain(empty, sessionHandler()), { path: "/claims?status=draft" });
    const view = render(<ReferencePharmacyModule path="/claims?status=draft" host={h.host} />);
    await waitFor(() => expect(h.calls.some((c) => c.path.startsWith("/claims?status=draft"))).toBe(true));
    view.rerender(<ReferencePharmacyModule path="/claims?status=rejected" host={h.host} />);
    await waitFor(() => expect(h.calls.some((c) => c.path.startsWith("/claims?status=rejected"))).toBe(true));
  });

  it("keeps the decimals of a rate the server reports (denial rate 12.5%) and lets the host decide the currency decimals", async () => {
    const withRate: Handler = (r) => {
      if (r.url.pathname === "/dashboard") { const d = dashboard(); d.rcm.denial_rate = 12.5; return json(d); }
    };
    const h = makeHost(chain(withRate, empty, sessionHandler()), { path: "/" });
    render(<ReferencePharmacyModule path="/" host={h.host} />);
    expect(await screen.findByText(/12\.5\s?%/)).toBeTruthy();
  });
});
