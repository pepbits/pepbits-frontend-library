import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { LocalizationProvider } from "@pepbits/ops-ui";
import copy from "../pharmacy-copy.json";
import { ReferencePharmacyModule } from "./module";
import { chain, json, makeHost, meta, sessionHandler, type Handler } from "./test-utils";

afterEach(cleanup);

const payers: Handler = (r) => { if (r.url.pathname === "/payers") return json([]); };
const setup = (handler: Handler, path = "/", options: Parameters<typeof makeHost>[1] = {}) => {
  const h = makeHost(chain(handler, payers), { path, ...options });
  const view = render(<ReferencePharmacyModule path={path} host={h.host} />);
  return { ...h, view };
};

describe("ReferencePharmacyModule host contract", () => {
  it("authenticates through the host session only: /meta then the page data via host.request, no token, no storage, no /api", async () => {
    const { calls, view } = setup(sessionHandler());
    expect(await screen.findByRole("heading", { name: "Prescriptions in the pharmacy now" })).toBeTruthy();
    const paths = calls.map((c) => c.path);
    expect(paths[0]).toBe("/meta");
    expect(paths).toContain("/dashboard");
    expect(paths.every((p) => !p.startsWith("/api") && !p.startsWith("http"))).toBe(true);
    expect(calls.every((c) => !c.headers.has("Authorization") && !c.headers.has("x-user"))).toBe(true);
    expect(window.localStorage.length).toBe(0);
    expect(view.container.querySelector('input[type="password"]')).toBeNull();
  });

  it("renders the page body only: no source sidebar, skip link, user switcher or sign-in", async () => {
    const { view } = setup(sessionHandler());
    await screen.findByRole("heading", { name: "Prescriptions in the pharmacy now" });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByText("Skip to content")).toBeNull();
    expect(screen.queryByText(/switch user/i)).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
    const root = view.container.querySelector(".reference-pharmacy");
    expect(root?.getAttribute("data-reference-module")).toBe("pharmacy");
    expect(screen.getByText("Demonstration data")).toBeTruthy();
  });

  it("shows a recoverable error, not a login form, when the host session is refused, and retries", async () => {
    let allow = false;
    const gate: Handler = (r) => { if (r.url.pathname === "/meta" && !allow) return json({ error: { code: "forbidden", message: "Your role cannot use Pharmacy-1." } }, 403); };
    const { calls } = setup(chain(gate, sessionHandler()));
    expect((await screen.findByRole("alert")).textContent).toContain("Your role cannot use Pharmacy-1.");
    allow = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Prescriptions in the pharmacy now" })).toBeTruthy();
    expect(calls.filter((c) => c.path === "/meta")).toHaveLength(2);
  });

  it("says so for an unknown path instead of rendering a page", async () => {
    setup(sessionHandler(), "/nope");
    expect(await screen.findByText("Pharmacy-1 page not found")).toBeTruthy();
  });

  it("remounts on a scope change: it reloads identity and starts with none of the previous scope's data", async () => {
    const first = makeHost(chain(sessionHandler(), payers), { path: "/" });
    const view = render(<ReferencePharmacyModule path="/" host={first.host} />);
    await screen.findByRole("heading", { name: "Prescriptions in the pharmacy now" });
    const other = makeHost(() => new Promise(() => {}), { path: "/", scope: { tenantId: "tenant-2" } });
    view.rerender(<ReferencePharmacyModule path="/" host={other.host} />);
    await waitFor(() => expect(other.calls.some((c) => c.path === "/meta")).toBe(true));
    expect(screen.queryByRole("heading", { name: "Prescriptions in the pharmacy now" })).toBeNull();
  });

  it("formats money in the pharmacy's server currency with the host's number format", async () => {
    setup(sessionHandler({ meta: { settings: { ...meta().settings, currency: "EUR" } } }), "/", { preferences: { currencyCode: "AED", numberLocale: "en-US", decimalPlaces: 2 } as never });
    await screen.findByRole("heading", { name: "Prescriptions in the pharmacy now" });
    expect(await screen.findByText(/(€|EUR)\s?1,234\.50/)).toBeTruthy();
  });

  it("keeps the source shortcuts (N opens New prescription, Ctrl+K the palette) and unbinds them when the host turns shortcuts off", async () => {
    const on = setup(sessionHandler());
    await screen.findByRole("heading", { name: "Prescriptions in the pharmacy now" });
    fireEvent.keyDown(window, { key: "n" });
    expect(await screen.findByRole("dialog", { name: "New prescription" })).toBeTruthy();
    on.view.unmount();
    cleanup();
    const off = setup(sessionHandler(), "/", { preferences: { keyboardShortcuts: false } });
    await screen.findByRole("heading", { name: "Prescriptions in the pharmacy now" });
    fireEvent.keyDown(window, { key: "n" });
    expect(screen.queryByRole("dialog", { name: "New prescription" })).toBeNull();
    expect(off.calls.length).toBeGreaterThan(0);
  });

  it("searches the palette through the host transport and routes through the host navigator", async () => {
    const search: Handler = (r) => { if (r.url.pathname === "/search") return json([{ type: "prescription", id: "rx-9", title: "RX-0009", subtitle: "Test Patient" }]); };
    const { calls, navigate } = setup(chain(search, sessionHandler()));
    await screen.findByRole("heading", { name: "Prescriptions in the pharmacy now" });
    fireEvent.click(screen.getByRole("button", { name: /Find a patient/ }));
    fireEvent.change(await screen.findByLabelText("Search or run a command"), { target: { value: "RX-00" } });
    const hit = await screen.findByRole("option", { name: /RX-0009/ });
    fireEvent.click(hit);
    expect(calls.some((c) => c.path === "/search?q=RX-00")).toBe(true);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/workbench?rx=rx-9"));
  });

  it("changes the theme only through the host preference path, and not while the tenant locks it", async () => {
    const open = setup(sessionHandler(), "/settings");
    const appearance = (await screen.findByText("Appearance")).closest("section")!;
    fireEvent.click(within(appearance).getByRole("tab", { name: "Dark" }));
    expect(open.onPreferenceChange).toHaveBeenCalledWith("theme", "midnight");
    cleanup();
    const locked = setup(sessionHandler(), "/settings", { preferenceHost: { preferencePolicy: { revision: 1, rules: { theme: { value: "nexora", locked: true } } } } });
    const lockedBox = (await screen.findByText("Appearance")).closest("section")!;
    const dark = within(lockedBox).getByRole("tab", { name: "Dark" }) as HTMLButtonElement;
    expect(dark.disabled).toBe(true);
    fireEvent.click(dark);
    expect(locked.onPreferenceChange).not.toHaveBeenCalled();
  });

  it("cannot impersonate: the settings page lists people but offers no switching", async () => {
    setup(sessionHandler(), "/settings");
    expect(await screen.findByText("Omar Test")).toBeTruthy();
    expect(screen.getAllByText("Signed in")).toHaveLength(1);
    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });

  it("resolves source labels through the host catalog, leaving record values untouched", async () => {
    const h = makeHost(sessionHandler(), { path: "/" });
    render(<LocalizationProvider value={{ language: "ar", direction: "rtl", dateTime: String, t: (key) => (key === copy["Prescriptions in the pharmacy now"] ? "الوصفات الآن" : key) }}><ReferencePharmacyModule path="/" host={h.host} /></LocalizationProvider>);
    expect(await screen.findByRole("heading", { name: "الوصفات الآن" })).toBeTruthy();
  });
});
