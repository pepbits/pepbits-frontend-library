import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ReferenceHostProvider } from "@pepbits/reference-host";
import { ResultDrawer } from "./components/ResultDrawer";
import { ToastProvider } from "./components/toast";
import { AuthProvider } from "./lib/auth";
import { chain, json, makeHost, sessionHandler, type Recorded } from "./test-utils";

afterEach(cleanup);

const detail = (version: number) => ({
  result: { id: 5, code: "PS-01", name: "Falls rate", period: "2026-05", facility_name: "Alpine Hospital", facility_code: "ALP", numerator: 4, denominator: 200, value: 2, status: "draft", unit: "per_1000", direction: "lower", target: 3, warning: 4, numerator_def: "Falls", denominator_def: "Patient days", exclusions: null, source: "manual", version, indicator_id: 1, kpi_status: "on_target", min_sample: 10, comment: null },
  reviews: [], issues: [], previous: [],
});

describe("result corrections", () => {
  it("send the loaded version and an Idempotency-Key, and a stale version keeps the typed correction", async () => {
    const puts: Recorded[] = [];
    let version = 3;
    const h = makeHost(chain((r) => {
      if (r.url.pathname === "/results/5" && r.method === "GET") return json(detail(version));
      if (r.url.pathname === "/results/5" && r.method === "PUT") { puts.push(r); return json({ error: "conflict", message: "This result changed since you opened it." }, 409); }
    }, sessionHandler()), { path: "/" });
    render(<ReferenceHostProvider host={h.host}><AuthProvider><ToastProvider><ResultDrawer resultId={5} onClose={() => undefined} /></ToastProvider></AuthProvider></ReferenceHostProvider>);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: /correct|edit/i }));
    fireEvent.change(within(dialog).getByLabelText("Numerator"), { target: { value: "6" } });
    fireEvent.change(within(dialog).getByLabelText(/Reason for change/), { target: { value: "Reconciled with census" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0].body).toEqual({ numerator: "6", denominator: "200", reason: "Reconciled with census", version: 3 });
    expect(puts[0].headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText("This result changed since you opened it.")).toBeTruthy();
    expect((within(dialog).getByLabelText("Numerator") as HTMLInputElement).value).toBe("6");
    expect((within(dialog).getByLabelText(/Reason for change/) as HTMLTextAreaElement).value).toBe("Reconciled with census");
    void version;
  });
});
