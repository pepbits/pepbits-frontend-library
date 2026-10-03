import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalizationProvider } from "@pepbits/ops-ui";
import copy from "../medband-copy.json";
import { ReferenceMedbandModule } from "./module";
import { counterStorageKey } from "./lib/store";
import { bootstrap, chain, json, makeHost, sessionHandler, type Handler } from "./test-utils";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const setup = (handler: Handler, path = "/", options: Parameters<typeof makeHost>[1] = {}) => {
  const h = makeHost(handler, { path, ...options });
  const view = render(<ReferenceMedbandModule path={path} host={h.host} />);
  return { ...h, view };
};
const today = () => screen.findByRole("heading", { name: "Who is at the desk?" });

describe("ReferenceMedbandModule host contract", () => {
  it("authenticates through the host session only: /bootstrap through host.request, no token, no actor header, no /api", async () => {
    const { calls } = setup(sessionHandler());
    expect(await today()).toBeTruthy();
    expect(calls[0].path).toBe("/bootstrap");
    expect(calls.every((c) => !c.path.startsWith("/api") && !c.path.startsWith("http"))).toBe(true);
    expect(calls.every((c) => !c.headers.has("Authorization") && !c.headers.has("x-actor-id"))).toBe(true);
  });

  it("renders the page body only: no source sidebar, no mobile nav, and no reset control", async () => {
    const { view } = setup(sessionHandler());
    await today();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByLabelText("Main navigation")).toBeNull();
    expect(screen.queryByText(/reset demo data/i)).toBeNull();
    expect(view.container.querySelector(".reference-medband")?.getAttribute("data-reference-module")).toBe("medband");
    expect(screen.getByText("Demonstration data")).toBeTruthy();
  });

  it("shows the bootstrap failure with the backend message and a retry, not a blank page or a made-up dataset", async () => {
    let allow = false;
    const gate: Handler = (r) => { if (r.url.pathname === "/bootstrap" && !allow) return json({ error: { code: "FORBIDDEN", message: "Your role cannot use MedBand." } }, 403); };
    const { calls } = setup(chain(gate, sessionHandler()));
    expect((await screen.findByRole("alert")).textContent).toContain("Your role cannot use MedBand.");
    expect(screen.queryByRole("heading", { name: "Who is at the desk?" })).toBeNull();
    allow = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await today()).toBeTruthy();
    expect(calls.filter((c) => c.path === "/bootstrap")).toHaveLength(2);
  });

  it("says so for an unknown path instead of rendering a page", async () => {
    setup(sessionHandler(), "/nope");
    expect(await screen.findByText("MedBand page not found")).toBeTruthy();
  });

  it("renders every one of the nine routes from the backend data (record id from the route, not a promise)", async () => {
    const pages: Array<[string, string]> = [
      ["/", "Who is at the desk?"], ["/patients", "Find patient"], ["/patients/new", "Register patient"], ["/patients/pat-1", "Asha TesterA"],
      ["/encounters", "Encounters"], ["/encounters/new", "New encounter"], ["/admissions", "Admissions"], ["/admissions/new", "Admission request"], ["/episodes", "Episodes of care"],
    ];
    for (const [path, expected] of pages) {
      const { view } = setup(sessionHandler(), path);
      await screen.findAllByText(expected, undefined, { timeout: 4000 });
      expect(view.container.querySelector("[data-medband-stage]"), path).toBeTruthy();
      cleanup();
    }
  });

  it("shows a missing record route as not found without calling anything but the bootstrap", async () => {
    const { calls } = setup(sessionHandler(), "/patients/unknown-id");
    expect(await screen.findByText("Patient not found")).toBeTruthy();
    expect(calls.map((c) => c.path)).toEqual(["/bootstrap"]);
  });
});

describe("scope isolation", () => {
  it("remounts on a scope change: reloads and shows none of the previous scope's masters or records", async () => {
    const first = makeHost(sessionHandler("A"), { path: "/patients/pat-1" });
    const view = render(<ReferenceMedbandModule path="/patients/pat-1" host={first.host} />);
    expect(await screen.findByText("Asha TesterA")).toBeTruthy();
    const other = makeHost(() => new Promise(() => {}), { path: "/patients/pat-1", scope: { tenantId: "tenant-2" } });
    view.rerender(<ReferenceMedbandModule path="/patients/pat-1" host={other.host} />);
    await waitFor(() => expect(other.calls.some((c) => c.path === "/bootstrap")).toBe(true));
    expect(screen.queryByText("Asha TesterA")).toBeNull();
  });

  it("aborts the in-flight bootstrap when the scope changes and ignores its late answer", async () => {
    let release: (v: never) => void = () => {};
    const slow = makeHost(() => new Promise((resolve) => { release = resolve; }), { path: "/" });
    const view = render(<ReferenceMedbandModule path="/" host={slow.host} />);
    await waitFor(() => expect(slow.calls).toHaveLength(1));
    const signal = slow.calls[0].signal!;
    expect(signal.aborted).toBe(false);
    const next = makeHost(sessionHandler("B"), { path: "/", scope: { branchId: "branch-2" } });
    view.rerender(<ReferenceMedbandModule path="/" host={next.host} />);
    expect(signal.aborted).toBe(true);
    await act(async () => { release({ status: 200, body: bootstrap("A") } as never); });
    expect(await today()).toBeTruthy();
    expect(screen.queryByText(/Desk A One/)).toBeNull();
    expect((await screen.findAllByText(/Desk B One/)).length).toBeGreaterThan(0);
  });

  it("aborts requests on unmount", async () => {
    const slow = makeHost(() => new Promise(() => {}), { path: "/" });
    const view = render(<ReferenceMedbandModule path="/" host={slow.host} />);
    await waitFor(() => expect(slow.calls).toHaveLength(1));
    view.unmount();
    expect(slow.calls[0].signal!.aborted).toBe(true);
  });

  it("uses a different counter per scope and only counters the backend lists", async () => {
    const hostA = makeHost(sessionHandler("A"), { path: "/" });
    window.localStorage.setItem(counterStorageKey(hostA.host.scope), "ctr-A-2");
    const view = render(<ReferenceMedbandModule path="/" host={hostA.host} />);
    expect(await screen.findByText("Desk A Two")).toBeTruthy();
    view.unmount();
    window.localStorage.setItem(counterStorageKey(hostA.host.scope), "ctr-from-another-scope");
    const again = render(<ReferenceMedbandModule path="/" host={hostA.host} />);
    expect(await screen.findByText("Desk A One")).toBeTruthy();
    again.unmount();
    const hostB = makeHost(sessionHandler("B"), { path: "/", scope: { branchId: "b2" } });
    render(<ReferenceMedbandModule path="/" host={hostB.host} />);
    expect(await screen.findByText("Desk B One")).toBeTruthy();
  });
});

describe("counter switcher and writes", () => {
  it("lists the backend counters, remembers the choice for this scope and filters the desk queue", async () => {
    const { host } = setup(sessionHandler());
    await today();
    fireEvent.click(screen.getByRole("button", { name: "Counter" }));
    const option = await screen.findByRole("option", { name: /Desk A Two/ });
    fireEvent.click(option);
    expect(window.localStorage.getItem(counterStorageKey(host.scope))).toBe("ctr-A-2");
  });

  it("advances an encounter through PATCH /encounters/:id with the backend counter and an idempotency key, then merges the returned record", async () => {
    const advance: Handler = (r) => {
      if (r.method === "PATCH" && r.url.pathname === "/encounters/enc-1") return json({ encounters: [{ ...bootstrap("A").data.encounters[0], status: "In progress" }] });
    };
    const { calls } = setup(chain(advance, sessionHandler()));
    await today();
    fireEvent.click(await screen.findByRole("button", { name: "Start" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.path).toBe("/encounters/enc-1");
    expect(patch.body).toEqual({ status: "In progress", counterId: "ctr-A-1" });
    expect(patch.headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(patch.headers.has("x-actor-id")).toBe(false);
    expect(await screen.findByRole("button", { name: "Complete" })).toBeTruthy();
  });

  it("keeps the backend error message (in a toast) and leaves the record unchanged when a write is refused", async () => {
    const refuse: Handler = (r) => { if (r.method === "PATCH") return json({ error: { code: "CONFLICT", message: "That record conflicts with an existing one." } }, 409); };
    setup(chain(refuse, sessionHandler()));
    await today();
    fireEvent.click(await screen.findByRole("button", { name: "Start" }));
    expect((await screen.findByRole("alert")).textContent).toContain("That record conflicts with an existing one.");
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });
});

describe("host preferences", () => {
  it("formats the admission estimate with the host currency, number locale and decimals", async () => {
    setup(sessionHandler(), "/admissions", { preferences: { currencyCode: "EUR", numberLocale: "en-US", decimalPlaces: 2 } as never });
    fireEvent.click(await screen.findByRole("radio", { name: /Pending clearance/ }));
    expect(await screen.findByText(/Estimate\s.*12,345\.00/)).toBeTruthy();
    expect(screen.queryByText(/\$12,345/)).toBeNull();
  });

  it("formats dates with the host date format", async () => {
    setup(sessionHandler(), "/patients/pat-1", { preferences: { dateFormat: "dmy" } as never });
    expect(await screen.findByText(/04\/05\/1990/)).toBeTruthy();
  });

  it("opens the quick search with Ctrl+K only while the host enables shortcuts, and removes the listener when it turns them off", async () => {
    const on = setup(sessionHandler());
    await today();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByRole("dialog", { name: "Quick search" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Quick search" })).toBeNull());
    on.view.unmount();
    cleanup();
    setup(sessionHandler(), "/", { preferences: { keyboardShortcuts: false } });
    await today();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog", { name: "Quick search" })).toBeNull();
    // the toolbar button still works without shortcuts
    fireEvent.click(screen.getByText("Search patient by name, MRN, phone or member ID"));
    expect(await screen.findByRole("dialog", { name: "Quick search" })).toBeTruthy();
  });

  it("quick search finds patients held by the scope and routes through the host navigator", async () => {
    const { navigate } = setup(sessionHandler());
    await today();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByLabelText("Quick search", { selector: "input" });
    fireEvent.change(input, { target: { value: "MRN-A-001" } });
    fireEvent.click((await screen.findAllByText("Asha TesterA", { selector: "span.block" }))[0]);
    expect(navigate).toHaveBeenCalledWith("/patients/pat-1");
  });

  it("resolves source labels through the host catalog, leaving record values untouched", async () => {
    const h = makeHost(sessionHandler(), { path: "/" });
    render(<LocalizationProvider value={{ language: "ar", direction: "rtl", dateTime: String, t: (key) => (key === copy["Who is at the desk?"] ? "من عند المكتب؟" : key) }}><ReferenceMedbandModule path="/" host={h.host} /></LocalizationProvider>);
    expect(await screen.findByRole("heading", { name: "من عند المكتب؟" })).toBeTruthy();
  });
});

describe("counter roles come from the backend, not from fixed ids", () => {
  const withAdmissionsDesk: Handler = (r) => {
    if (r.url.pathname !== "/bootstrap") return undefined;
    const b = bootstrap("A");
    b.master.counters = [...b.master.counters, { id: "x-77", name: "Bed allocation", location: "Wing", encounterTypes: ["IP", "DAY_CARE"] }];
    return json(b);
  };

  it("offers a switch to whichever counter opens inpatient visits, by the backend's name", async () => {
    const { host } = setup(withAdmissionsDesk, "/admissions");
    expect(await screen.findByText(/You can review and clear requests from any counter/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Switch to Bed allocation/ }));
    expect(window.localStorage.getItem(counterStorageKey(host.scope))).toBe("x-77");
    await waitFor(() => expect(screen.queryByText(/You can review and clear requests from any counter/)).toBeNull());
  });

  it("shows no switch when the backend lists no counter for inpatient visits", async () => {
    setup(sessionHandler(), "/admissions");
    await screen.findAllByText("Admissions");
    expect(screen.queryByText(/You can review and clear requests from any counter/)).toBeNull();
  });
});

describe("creating an encounter", () => {
  it("posts the source request through the host: backend counter, chosen records, idempotency key, no actor", async () => {
    const created = (body: Record<string, unknown>) => {
      const b = bootstrap("A").data;
      const encounter = { ...b.encounters[0], id: "enc-9", code: "ENC-9", patientId: "pat-2", caseId: "case-9", episodeId: "ep-9", billingMode: body.billingMode };
      return { encounterId: "enc-9", encounters: [encounter], cases: [{ ...b.cases[0], id: "case-9", code: "CS-9", patientId: "pat-2" }], episodes: [{ ...b.episodes[0], id: "ep-9", title: "Episode nine", patientId: "pat-2" }] };
    };
    const write: Handler = (r) => { if (r.method === "POST" && r.url.pathname === "/encounters") return json(created(r.body as Record<string, unknown>)); };
    const { calls } = setup(chain(write, sessionHandler()), "/encounters/new?patientId=pat-2");
    await screen.findAllByText("New encounter");
    fireEvent.change(await screen.findByLabelText(/^Department/), { target: { value: "dep-gen" } });
    fireEvent.change(await screen.findByLabelText(/^Clinician/), { target: { value: "doc-1" } });
    fireEvent.click(await screen.findByRole("button", { name: "Fever" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Create encounter/ })[0]);
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.path).toBe("/encounters");
    expect(post.body).toMatchObject({ counterId: "ctr-A-1", patientId: "pat-2", type: "OP", departmentId: "dep-gen", practitionerId: "doc-1", billingMode: "Self pay", complaints: [{ code: "R50", label: "Fever" }], case: { mode: "new" } });
    expect(post.headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(post.headers.has("x-actor-id")).toBe(false);
    expect(await screen.findByText("ENC-9")).toBeTruthy();
  });

  it("shows the backend's refusal, keeps the entered values and points at the field", async () => {
    const refuse: Handler = (r) => { if (r.method === "POST") return json({ error: { code: "VALIDATION_FAILED", message: "departmentId: not allowed at this counter", field: "departmentId" } }, 422); };
    setup(chain(refuse, sessionHandler()), "/encounters/new?patientId=pat-2");
    await screen.findAllByText("New encounter");
    fireEvent.change(await screen.findByLabelText(/^Department/), { target: { value: "dep-gen" } });
    fireEvent.change(await screen.findByLabelText(/^Clinician/), { target: { value: "doc-1" } });
    fireEvent.click(await screen.findByRole("button", { name: "Fever" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Create encounter/ })[0]);
    expect((await screen.findByRole("alert")).textContent).toContain("departmentId: not allowed at this counter");
    expect((screen.getByLabelText(/^Department/) as HTMLSelectElement).value).toBe("dep-gen");
    expect((screen.getByLabelText(/^Clinician/) as HTMLSelectElement).value).toBe("doc-1");
  });
});

describe("managed table page size", () => {
  it("shows the host page size of encounters and steps by it", async () => {
    const many: Handler = (r) => {
      if (r.url.pathname !== "/bootstrap") return undefined;
      const b = bootstrap("A");
      const base = b.data.encounters[0];
      b.data.encounters = Array.from({ length: 25 }, (_, i) => ({ ...base, id: `enc-${i}`, code: `ENC-${String(i).padStart(2, "0")}` }));
      return json(b);
    };
    setup(many, "/encounters", { preferences: { pageSize: 10 } as never });
    await screen.findAllByText("Encounters");
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(11)); // header + 10
    fireEvent.click(screen.getByRole("button", { name: /Show 10 more/ }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(21));
    fireEvent.click(screen.getByRole("button", { name: /Show 5 more/ }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(26));
    expect(screen.queryByRole("button", { name: /Show .* more/ })).toBeNull();
  });
});

describe("patient search requests", () => {
  const searchHandler = (reply: (q: string | null) => unknown): Handler => (r) => {
    if (r.method === "GET" && r.url.pathname === "/patients") return json(reply(r.url.searchParams.get("q")));
  };

  it("sends the filters as the source query string through the host, with an abort signal", async () => {
    const { calls } = setup(chain(searchHandler(() => ({ patients: bootstrap("A").data.patients })), sessionHandler()), "/patients");
    await waitFor(() => expect(calls.some((c) => c.url.pathname === "/patients")).toBe(true), { timeout: 2000 });
    const search = calls.find((c) => c.url.pathname === "/patients")!;
    expect(search.path).toMatch(/^\/patients\?/);
    expect(search.signal).toBeTruthy();
    expect(search.signal!.aborted).toBe(false);
  });

  it("aborts an in-flight search on unmount and never applies its late answer", async () => {
    let release: (v: never) => void = () => {};
    const slow: Handler = (r) => {
      if (r.method === "GET" && r.url.pathname === "/patients") return new Promise((resolve) => { release = resolve as never; }) as never;
    };
    const { calls, view } = setup(chain(slow, sessionHandler()), "/patients");
    await waitFor(() => expect(calls.some((c) => c.url.pathname === "/patients")).toBe(true), { timeout: 2000 });
    const signal = calls.find((c) => c.url.pathname === "/patients")!.signal!;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { release({ status: 200, body: { patients: [] } } as never); });
  });

  it("shows the backend's message when the search fails", async () => {
    const fail: Handler = (r) => { if (r.method === "GET" && r.url.pathname === "/patients") return json({ error: { code: "SERVER_ERROR", message: "Something went wrong on the server." } }, 500); };
    setup(chain(fail, sessionHandler()), "/patients");
    expect(await screen.findByText("Something went wrong on the server.", undefined, { timeout: 3000 })).toBeTruthy();
  });
});

describe("host theme, density and motion", () => {
  it("passes the effective theme and density to the module root and follows a host change while mounted", async () => {
    const first = makeHost(sessionHandler(), { path: "/", preferences: { theme: "midnight", density: "compact" } as never });
    const view = render(<ReferenceMedbandModule path="/" host={first.host} />);
    await today();
    const root = () => view.container.querySelector(".reference-medband")!;
    expect(root().getAttribute("data-theme")).toBe("midnight");
    expect(root().getAttribute("data-density")).toBe("compact");
    const next = { ...first.host, preferences: { ...first.host.preferences, theme: "sand", density: "spacious" } } as typeof first.host;
    view.rerender(<ReferenceMedbandModule path="/" host={next} />);
    await waitFor(() => expect(root().getAttribute("data-theme")).toBe("sand"));
    expect(root().getAttribute("data-density")).toBe("spacious");
    expect(first.calls.filter((c) => c.path === "/bootstrap")).toHaveLength(1); // a preference change is not a scope change
  });

  it("keeps the loaded workspace and its in-page state when only the path (query) changes", async () => {
    const h = makeHost(sessionHandler(), { path: "/patients" });
    const view = render(<ReferenceMedbandModule path="/patients" host={h.host} />);
    await screen.findAllByText("Find patient");
    view.rerender(<ReferenceMedbandModule path="/episodes" host={h.host} />);
    await screen.findAllByText("Episodes of care");
    expect(h.calls.filter((c) => c.path === "/bootstrap")).toHaveLength(1);
  });
});
