import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { IDEMPOTENCY_HEADER } from "./lib/api";
import { ReferenceQualityModule } from "./module";
import { chain, json, makeHost, sessionHandler, type Handler, type Recorded } from "./test-utils";

afterEach(cleanup);

const authority = { id: 1, code: "DOH", name: "Department of Health", channel: "portal_upload", endpoint: null, contact_email: null, jurisdiction: "Abu Dhabi", programs: [], active: 1, last_submission_at: null };
const mount = (handler: Handler, path = "/authorities") => {
  const h = makeHost(chain(handler, sessionHandler()), { path });
  render(<ReferenceQualityModule path={path} host={h.host} />);
  return h;
};

describe("failures keep the user's work and say what happened", () => {
  it("shows the page error with the server message and a working Try again", async () => {
    let fail = true;
    const h = mount((r) => { if (r.url.pathname === "/authorities") return fail ? json({ error: "boom", message: "The register is offline." }, 500) : json([authority]); });
    expect(await screen.findByText("The register is offline.")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Department of Health")).toBeTruthy();
    expect(h.calls.filter((c) => c.path === "/authorities")).toHaveLength(2);
  });

  it("a rejected save keeps every typed value in the dialog and shows the server reason", async () => {
    const puts: Recorded[] = [];
    mount((r) => {
      if (r.url.pathname === "/authorities" && r.method === "GET") return json([authority]);
      if (r.url.pathname === "/authorities/1" && r.method === "PUT") { puts.push(r); return json({ error: "invalid", message: "Code already in use." }, 422); }
    });
    await screen.findByText("Department of Health");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Dept of Health & Prevention" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Code already in use.")).toBeTruthy();
    expect((within(dialog).getByLabelText("Name") as HTMLInputElement).value).toBe("Dept of Health & Prevention");
    expect(puts[0].headers.get(IDEMPOTENCY_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    // The reopened attempt is a new operation: a new key.
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1].headers.get(IDEMPOTENCY_HEADER)).not.toBe(puts[0].headers.get(IDEMPOTENCY_HEADER));
  });

  it("a mutation response arriving after the scope changed is not applied to the new scope", async () => {
    let release: (v: unknown) => void = () => undefined;
    const slow = new Promise((resolve) => { release = resolve; });
    const first = makeHost(chain((r) => { if (r.url.pathname === "/authorities") return json([authority]); }, sessionHandler()), { path: "/authorities" });
    const slowGet = makeHost(chain(async (r) => { if (r.url.pathname === "/authorities") { await slow; return json([{ ...authority, name: "Stale Scope Authority" }]); } }, sessionHandler()), { path: "/authorities", scope: { tenantId: "tenant-a" } });
    const fresh = makeHost(chain((r) => { if (r.url.pathname === "/authorities") return json([{ ...authority, name: "Fresh Scope Authority" }]); }, sessionHandler()), { path: "/authorities", scope: { tenantId: "tenant-b" } });
    const view = render(<ReferenceQualityModule path="/authorities" host={first.host} />);
    await screen.findByText("Department of Health");
    view.rerender(<ReferenceQualityModule path="/authorities" host={slowGet.host} />);
    await waitFor(() => expect(slowGet.calls.some((c) => c.path === "/authorities")).toBe(true));
    view.rerender(<ReferenceQualityModule path="/authorities" host={fresh.host} />);
    expect(await screen.findByText("Fresh Scope Authority")).toBeTruthy();
    release(null);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText("Stale Scope Authority")).toBeNull();
    expect(screen.getByText("Fresh Scope Authority")).toBeTruthy();
  });

  it("aborts an in-flight read when the page unmounts", async () => {
    let signal: AbortSignal | null | undefined;
    const h = makeHost(chain((r) => { if (r.url.pathname === "/authorities") { signal = r.signal; return new Promise(() => undefined) as never; } }, sessionHandler()), { path: "/authorities" });
    const view = render(<ReferenceQualityModule path="/authorities" host={h.host} />);
    await waitFor(() => expect(signal).toBeTruthy());
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
