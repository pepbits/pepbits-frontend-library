import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import rcmCopy from "../rcm-copy.json";
import { ReferenceRcmModule } from "./module";
import { chain, json, makeHost, meta, sessionHandler, type Handler } from "./test-utils";

afterEach(cleanup);

const setup = (handler: Handler, path = "/", options: Parameters<typeof makeHost>[1] = {}) => {
  const h = makeHost(handler, { path, ...options });
  const view = render(<ReferenceRcmModule path={path} host={h.host} />);
  return { ...h, view };
};
const homeHeading = () => screen.findByRole("heading", { name: /Good (morning|afternoon|evening), Amira/ });

describe("ReferenceRcmModule host contract", () => {
  it("authenticates through the host session only: /meta then scoped page data via host.request, no actor header, no storage, no /api", async () => {
    const { calls, view } = setup(sessionHandler());
    expect(await homeHeading()).toBeTruthy();
    const paths = calls.map((c) => c.path);
    expect(paths[0]).toBe("/meta");
    expect(paths).toEqual(expect.arrayContaining(["/pending", "/dashboard/home"]));
    expect(paths.every((p) => !p.startsWith("/api") && !p.startsWith("http"))).toBe(true);
    expect(calls.every((c) => !c.headers.has("x-actor-id") && !c.headers.has("Authorization"))).toBe(true);
    expect(calls[0].headers.has("x-rcm-scope")).toBe(false);
    expect(calls.filter((c) => c.path !== "/meta").every((c) => c.headers.get("x-rcm-scope") === "ALL:SAR")).toBe(true);
    expect(window.localStorage.length).toBe(0);
    expect(view.container.querySelector('input[type="password"]')).toBeNull();
  });

  it("renders the page body with a compact toolbar: no source rail, no user menu, no sign-in, and the signed-in user cannot be switched", async () => {
    const { view } = setup(sessionHandler());
    await homeHeading();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
    expect(screen.queryByText(/demo sign-in|switch people|switch person/i)).toBeNull();
    expect(screen.queryByRole("menuitemradio", { name: /Amira|Omar/ })).toBeNull();
    const root = view.container.querySelector(".reference-rcm");
    expect(root?.getAttribute("data-reference-module")).toBe("rcm");
    const toolbar = view.container.querySelector("[data-rcm-toolbar]")!;
    expect(within(toolbar as HTMLElement).getByText("Amira Test")).toBeTruthy();
    expect(within(toolbar as HTMLElement).getByText("Biller")).toBeTruthy();
    expect(screen.getByText("Test environment, synthetic data")).toBeTruthy();
    expect(screen.queryByText(/SQLite/)).toBeNull();
    expect(screen.getByText("API connected")).toBeTruthy();
  });

  it("uses the shared source controls with the original class structure", async () => {
    const { view } = setup(sessionHandler(), "/w/invoices");
    await screen.findByRole("button", { name: /New invoice/ });
    expect(view.container.querySelector("button.btn-primary")).toBeTruthy();
    const search = screen.getByLabelText("Search");
    expect(search.tagName).toBe("INPUT");
    expect(search.className).toContain("input");
    expect(view.container.querySelector("table")).toBeTruthy();
    expect(view.container.querySelector(".panel")).toBeTruthy();
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
    const gate: Handler = (r) => { if (r.url.pathname === "/meta" && !allow) return json({ error: { code: "FORBIDDEN", message: "Your role cannot use RCM." } }, 403); };
    const { calls } = setup(chain(gate, sessionHandler()));
    expect((await screen.findByRole("alert")).textContent).toContain("Your role cannot use RCM.");
    allow = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await homeHeading()).toBeTruthy();
    expect(calls.filter((c) => c.path === "/meta")).toHaveLength(2);
  });

  it("says so for an unknown path or an unlisted resource instead of rendering a page", async () => {
    setup(sessionHandler(), "/w/../secret");
    expect(await screen.findByText("This page doesn’t exist")).toBeTruthy();
    expect(screen.getByText(/any of the 8 workspace pages/)).toBeTruthy();
    cleanup();
    setup(sessionHandler(), "/w/nope");
    expect(await screen.findByText("No such workspace page")).toBeTruthy();
    expect(screen.getByText(/“nope” is not one of the 8 pages/)).toBeTruthy();
  });

  it("remounts on a host scope change: it aborts the old scope's requests, reloads identity and shows none of the previous scope's data", async () => {
    const first = makeHost(chain((r) => { if (r.url.pathname === "/dashboard/home") return new Promise(() => {}); }, sessionHandler()), { path: "/" });
    const view = render(<ReferenceRcmModule path="/" host={first.host} />);
    await waitFor(() => expect(first.calls.some((c) => c.path === "/dashboard/home")).toBe(true));
    const inFlight = first.calls.find((c) => c.path === "/dashboard/home")!.signal!;
    expect(inFlight.aborted).toBe(false);
    const other = makeHost(() => new Promise(() => {}), { path: "/", scope: { tenantId: "tenant-2" } });
    view.rerender(<ReferenceRcmModule path="/" host={other.host} />);
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

describe("scope filter", () => {
  it("lists the source's SAR/AED scopes, refetches with the chosen filter and never changes the host scope or branch header", async () => {
    const h = setup(sessionHandler());
    await homeHeading();
    const trigger = screen.getByRole("button", { name: /Scope: All SAR branches/ });
    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitemradio").map((b) => b.textContent)).toEqual([
      expect.stringContaining("All SAR branches"), expect.stringContaining("Riyadh Test Hospital"), expect.stringContaining("Jeddah Test Clinic"),
      expect.stringContaining("All AED branches"), expect.stringContaining("Dubai Test Clinic"),
    ]);
    expect(within(menu).getByText("Riyadh Test, Jeddah Test")).toBeTruthy();
    const before = h.calls.length;
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: /All AED branches/ }));
    await waitFor(() => expect(h.calls.slice(before).some((c) => c.path === "/dashboard/home" && c.headers.get("x-rcm-scope") === "ALL:AED")).toBe(true));
    expect(h.calls.slice(before).some((c) => c.path === "/meta")).toBe(false);
    expect(h.host.scope.branchId).toBe("hq");
    expect(await screen.findByRole("button", { name: /Scope: All AED branches/ })).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
    // a single branch is a filter too
    fireEvent.click(screen.getByRole("button", { name: /Scope: All AED branches/ }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /Dubai Test Clinic/ }));
    await waitFor(() => expect(h.calls.some((c) => c.headers.get("x-rcm-scope") === "DXB-TEST")).toBe(true));
  });

  it("does not show another scope's numbers while the new scope loads", async () => {
    let held = false;
    const handler: Handler = (r) => {
      if (r.path === "/dashboard/home" && r.headers.get("x-rcm-scope") === "ALL:AED") { held = true; return new Promise(() => {}); }
    };
    setup(chain(handler, sessionHandler()));
    await homeHeading();
    expect(screen.getByText("SAR 2,300.00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Scope: All SAR branches/ }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /All AED branches/ }));
    await waitFor(() => expect(held).toBe(true));
    expect(screen.queryByText("SAR 2,300.00")).toBeNull();
  });
});

describe("command palette", () => {
  it("opens with Ctrl+K only while the host keeps shortcuts on, lists every page and a New entry per creatable page, and jumps through the host navigator", async () => {
    const on = setup(sessionHandler());
    await homeHeading();
    const hostShortcut=vi.fn();window.addEventListener("keydown",hostShortcut);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(hostShortcut).not.toHaveBeenCalled();window.removeEventListener("keydown",hostShortcut);
    const dialog = await screen.findByRole("dialog", { name: "Jump to a page", hidden: true });
    expect(within(dialog).getAllByRole("option", { hidden: true }).length).toBe(8);
    const input = within(dialog).getByLabelText("Search");
    fireEvent.change(input, { target: { value: "new" } });
    expect(within(dialog).getByRole("option", { name: /New invoice/, hidden: true })).toBeTruthy();
    expect(within(dialog).queryByRole("option", { name: /New claim/, hidden: true })).toBeNull();
    fireEvent.click(within(dialog).getByRole("option", { name: /New invoice/, hidden: true }));
    expect(on.navigate).toHaveBeenCalledWith("/w/invoices?new=1");
    cleanup();

    const off = setup(sessionHandler(), "/", { preferences: { keyboardShortcuts: false } });
    await homeHeading();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(off.view.container.querySelector("dialog[open]")).toBeNull();
    expect(screen.queryByText("Ctrl")).toBeNull();
  });

  it("turns a pasted reference into the page's ?q=<ref>&open=first link", async () => {
    const h = setup(sessionHandler());
    await homeHeading();
    fireEvent.click(screen.getByRole("button", { name: /Jump anywhere/ }));
    const dialog = await screen.findByRole("dialog", { name: "Jump to a page", hidden: true });
    fireEvent.change(within(dialog).getByLabelText("Search"), { target: { value: "inv-2026-00012" } });
    const option = await within(dialog).findByRole("option", { name: /Open INV-2026-00012/, hidden: true });
    fireEvent.click(option);
    expect(h.navigate).toHaveBeenCalledWith("/w/invoices?open=first&q=INV-2026-00012");
  });
});

describe("preferences and locks", () => {
  it("passes the host theme and density to the scope root, and localizes copy through the generated alias map", async () => {
    const { view } = setup(sessionHandler(), "/", { preferences: { theme: "midnight", density: "compact" } as never });
    await homeHeading();
    const root = view.container.querySelector(".reference-rcm")!;
    expect(root.getAttribute("data-theme")).toBe("midnight");
    expect(root.getAttribute("data-density")).toBe("compact");
    expect(Object.keys(rcmCopy)).toContain("Jump anywhere");
  });

  it("keeps the original fonts and table geometry by default, and hands both to the host only for explicit non-default preferences", async () => {
    const a = setup(sessionHandler(), "/");
    await homeHeading();
    const rootA = a.view.container.querySelector(".reference-rcm")!;
    expect(rootA.getAttribute("data-rcm-font")).toBe("reference");
    expect(rootA.getAttribute("data-rcm-table")).toBe("reference");
    cleanup();
    const b = setup(sessionHandler(), "/", { preferences: { fontFamily: "plex", density: "compact" } as never });
    await homeHeading();
    const rootB = b.view.container.querySelector(".reference-rcm")!;
    expect(rootB.getAttribute("data-rcm-font")).toBe("host");
    expect(rootB.getAttribute("data-rcm-table")).toBe("host");
  });
});
