import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { LocalizationProvider } from "@pepbits/ops-ui";
import copy from "../quality-copy.json";
import { ReferenceQualityModule } from "./module";
import { chain, json, makeHost, PERMISSIONS, sessionHandler, type Handler } from "./test-utils";

afterEach(cleanup);

const authorities: Handler = (r) => { if (r.url.pathname === "/authorities") return json([{ id: 1, code: "DOH", name: "Department of Health", channel: "portal_upload", endpoint: null, contact_email: "q@example.test", jurisdiction: "Abu Dhabi", programs: ["JAWDA"], active: 1, last_submission_at: null }]); };
const setup = (handler: Handler, path = "/authorities", options: Parameters<typeof makeHost>[1] = {}) => {
  const h = makeHost(chain(handler, authorities), { path, ...options });
  const view = render(<ReferenceQualityModule path={path} host={h.host} />);
  return { ...h, view };
};

describe("ReferenceQualityModule host contract", () => {
  it("authenticates through the host session only: GET /auth/me then /meta via host.request, no login, no token", async () => {
    const { calls, view } = setup(sessionHandler());
    expect(await screen.findByRole("heading", { name: "Authorities" })).toBeTruthy();
    const paths = calls.map((c) => c.path);
    expect(paths.slice(0, 2)).toEqual(["/auth/me", "/meta"]);
    expect(paths.some((p) => p.startsWith("/api") || p.includes("/auth/login"))).toBe(false);
    expect(calls.every((c) => !c.headers.has("Authorization"))).toBe(true);
    expect(view.container.querySelector('input[type="password"]')).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("renders no standalone source shell: no sidebar, header, sign-out or role switch", async () => {
    const { view } = setup(sessionHandler());
    await screen.findByRole("heading", { name: "Authorities" });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(view.container.querySelector("header")).toBeNull();
    expect(screen.queryByText(/sign out/i)).toBeNull();
    expect(screen.queryByRole("combobox", { name: /role/i })).toBeNull();
    expect(view.container.querySelector(".reference-quality")?.getAttribute("data-reference-module")).toBe("quality");
  });

  it("shows server permissions only: can() mirrors /auth/me, so a viewer gets no Add authority", async () => {
    const first = setup(sessionHandler({ permissions: PERMISSIONS }));
    expect(await screen.findByRole("button", { name: "Add authority" })).toBeTruthy();
    first.view.unmount();
    setup(sessionHandler({ permissions: ["audit.view"], user: { role: "viewer" } }));
    await screen.findByRole("heading", { name: "Authorities" });
    expect(screen.queryByRole("button", { name: "Add authority" })).toBeNull();
  });

  it("shows a recoverable error, not a login form, when the host session is refused, and retries", async () => {
    let allow = false;
    const gate: Handler = (r) => { if (r.url.pathname === "/auth/me" && !allow) return json({ error: "forbidden", message: "Your role cannot use AllyVora Quality." }, 403); };
    const { calls } = setup(chain(gate, sessionHandler()));
    expect((await screen.findByRole("alert")).textContent).toContain("Your role cannot use AllyVora Quality.");
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    allow = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Authorities" })).toBeTruthy();
    expect(calls.filter((c) => c.path === "/auth/me")).toHaveLength(2);
  });

  it("says so for an unknown path instead of rendering a page", async () => {
    setup(sessionHandler(), "/nope");
    expect(await screen.findByText("AllyVora Quality page not found")).toBeTruthy();
  });

  it("remounts on a scope change: it reloads identity and discards the previous scope's data", async () => {
    const h = makeHost(chain(sessionHandler(), authorities), { path: "/authorities" });
    const view = render(<ReferenceQualityModule path="/authorities" host={h.host} />);
    await screen.findByText("Department of Health");
    const before = h.calls.filter((c) => c.path === "/auth/me").length;
    const other = makeHost(chain(sessionHandler({ user: { name: "Other Person" } }), () => json([])), { path: "/authorities", scope: { tenantId: "tenant-2" } });
    view.rerender(<ReferenceQualityModule path="/authorities" host={other.host} />);
    await waitFor(() => expect(other.calls.some((c) => c.path === "/auth/me")).toBe(true));
    await waitFor(() => expect(screen.queryByText("Department of Health")).toBeNull());
    expect(before).toBe(1);
  });

  it("matches dynamic pages by id and reseeds query-driven pages when the query changes", async () => {
    const seen: string[] = [];
    const record: Handler = (r) => { seen.push(r.path); if (r.url.pathname === "/audit") return json({ total: 0, rows: [], entities: [], actions: [] }); };
    const h = makeHost(chain(record, sessionHandler()), { path: "/audit?user=3" });
    const view = render(<ReferenceQualityModule path="/audit?user=3" host={h.host} />);
    await waitFor(() => expect(seen.some((p) => p.startsWith("/audit?") && p.includes("user=3"))).toBe(true));
    view.rerender(<ReferenceQualityModule path="/audit?user=5" host={h.host} />);
    await waitFor(() => expect(seen.some((p) => p.includes("user=5"))).toBe(true));
  });
  it('resolves source labels through the canonical host catalog, preserving source business values',async()=>{
    const h=makeHost(chain(sessionHandler(),authorities),{path:'/authorities'});
    render(<LocalizationProvider value={{language:'ar',direction:'rtl',dateTime:String,t:key=>key===copy['Add authority']?'إضافة جهة':key}}><ReferenceQualityModule path="/authorities" host={h.host}/></LocalizationProvider>);
    expect(await screen.findByRole('button',{name:'إضافة جهة'})).toBeVisible();expect(await screen.findByText('Department of Health')).toBeVisible();
  });

});
