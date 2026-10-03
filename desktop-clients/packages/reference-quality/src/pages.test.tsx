import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import qualityCopy from "../quality-copy.json";
import { ReferenceQualityModule } from "./module";
import { fixtureStrings, qualityHandler } from "./test-fixtures";
import { makeHost, recordingLocalization, type Handler } from "./test-utils";

/* jsdom has no layout engine and no ResizeObserver, which recharts' ResponsiveContainer needs to mount. */
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

afterEach(cleanup);

type RouteCase = { path: string; heading: string | RegExp; ready: string };

/** Every route of the module: the page's h1 plus a piece of fixture data that only shows once its endpoints answered. */
const ROUTES: RouteCase[] = [
  { path: "/", heading: /^Good (morning|afternoon|evening), Mariam$/, ready: "Performance by domain" },
  { path: "/indicators", heading: "Indicators", ready: "Hand hygiene compliance" },
  { path: "/indicators/7", heading: "STAT lab results within 60 minutes", ready: "Raised the target from 85 to 90" },
  { path: "/tat", heading: "Turnaround times", ready: "TX-LAB-0001" },
  { path: "/events", heading: "Event Pulse", ready: "TX-RAD-0002" },
  { path: "/verification", heading: "Verification", ready: "Bayside Clinic" },
  { path: "/validation", heading: "Validation", ready: "6 transactions have no end event after 48 hours" },
  { path: "/reports", heading: "Reports", ready: "Executive weekly digest" },
  { path: "/reports/designer", heading: "Design a report", ready: "Methodology" },
  { path: "/reports/3", heading: "Quarterly JAWDA scorecard", ready: "Lab timeliness trend" },
  { path: "/schedules", heading: "Schedules", ready: "Monthly board pack" },
  { path: "/submissions", heading: "Submissions", ready: "SUB-2026-0011" },
  { path: "/authorities", heading: "Authorities", ready: "Board of Directors" },
  { path: "/users", heading: "Users and roles", ready: "Omar Nasser" },
  { path: "/audit", heading: "Audit trail", ready: "Raised the target for LAB-07 from 85 to 90" },
];

/** Wraps the handler so a test can see unanswered requests and wait until nothing is in flight. */
function backend() {
  const base = qualityHandler();
  const unanswered: string[] = [];
  const state = { inflight: 0 };
  const handler: Handler = async (r) => {
    state.inflight++;
    try {
      const out = await base(r);
      if (!out || (out.status ?? 200) >= 400) unanswered.push(`${r.method} ${r.path}`);
      return out;
    } finally { state.inflight--; }
  };
  return { handler, unanswered, state };
}

function mount(path: string, Wrapper: React.ComponentType<{ children: React.ReactNode }> = React.Fragment) {
  const b = backend();
  const h = makeHost(b.handler, { path });
  const view = render(<Wrapper><ReferenceQualityModule path={path} host={h.host} /></Wrapper>);
  return { ...b, ...h, view };
}

const TIMEOUT = { timeout: 4000 };
async function ready(c: RouteCase, state: { inflight: number }) {
  expect(await screen.findByRole("heading", { level: 1, name: c.heading }, TIMEOUT)).toBeTruthy();
  expect((await screen.findAllByText(c.ready, undefined, TIMEOUT)).length).toBeGreaterThan(0);
  await waitFor(() => expect(state.inflight).toBe(0), TIMEOUT);
}

let errorSpy: MockInstance;
beforeEach(() => { errorSpy = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => errorSpy.mockRestore());
const loggedErrors = () => errorSpy.mock.calls.map((args) => args.map(String).join(" ").slice(0, 400));

describe("AllyVora Quality pages", () => {
  it.each(ROUTES)("renders $path with its heading, data and no error state", async (c) => {
    const { state, unanswered } = mount(c.path);
    await ready(c, state);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("This view could not load.")).toBeNull();
    expect(screen.queryByText("AllyVora Quality is not available for this account.")).toBeNull();
    expect(unanswered).toEqual([]);
    expect(loggedErrors()).toEqual([]);
  });

  it("covers all fifteen routes", () => {
    expect(ROUTES).toHaveLength(15);
  });

  it("requests the indicator detail endpoint for /indicators/7", async () => {
    const { calls, state } = mount("/indicators/7");
    await ready(ROUTES.find((r) => r.path === "/indicators/7")!, state);
    expect(calls.some((c) => c.method === "GET" && c.path === "/indicators/7")).toBe(true);
  });

  it("requests the template and its render for /reports/3", async () => {
    const { calls, state } = mount("/reports/3");
    await ready(ROUTES.find((r) => r.path === "/reports/3")!, state);
    expect(calls.some((c) => c.method === "GET" && c.path === "/report-templates/3")).toBe(true);
    const render = calls.find((c) => c.method === "GET" && c.url.pathname === "/report-templates/3/render");
    expect(render).toBeTruthy();
    // JAWDA templates default to the latest full quarter in /meta.periods.
    expect(render!.url.searchParams.get("from")).toBe("2026-04");
    expect(render!.url.searchParams.get("to")).toBe("2026-06");
  });

  it("shows the not-found message for an unknown path", async () => {
    mount("/no-such-page");
    expect(await screen.findByText("AllyVora Quality page not found", undefined, TIMEOUT)).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("shows the not-found message for a nested unknown path", async () => {
    mount("/reports/3/extra");
    expect(await screen.findByText("AllyVora Quality page not found", undefined, TIMEOUT)).toBeTruthy();
  });

  it("has every plain English message looked up through t() in quality-copy.json", async () => {
    const copy: Record<string, string> = qualityCopy;
    const { seen, Wrapper } = recordingLocalization();

    for (const c of ROUTES) {
      const { state, view } = mount(c.path, Wrapper);
      await ready(c, state);
      // Second tabs hold copy the default view never renders.
      if (c.path === "/events") { fireEvent.click(screen.getByRole("tab", { name: /Event stream/ })); await screen.findAllByText("LIS-KEY-1", undefined, TIMEOUT); }
      if (c.path === "/validation") { fireEvent.click(screen.getByRole("tab", { name: /Rules/ })); await screen.findAllByText("Configure", undefined, TIMEOUT); }
      await waitFor(() => expect(state.inflight).toBe(0), TIMEOUT);
      view.unmount();
    }

    const data = fixtureStrings();
    // Codes that pages run through humanize() before t(): "pending_approval" reaches t() as "Pending approval".
    const humanized = new Set<string>();
    for (const v of data) if (/^[a-z0-9]+([._][a-z0-9]+)*$/.test(v)) humanized.add(v.replace(/[._]/g, " ").replace(/^./, (ch) => ch.toUpperCase()));
    const isData = (m: string) => data.has(m) || humanized.has(m);
    // Some pages run an already-interpolated string back through Copy/LocalizedText ("3 warnings open"); that is the
    // rendering of a template that is itself a key, so it is not a separate message.
    const templates = Object.keys(copy).filter((k) => /\{value\d+\}/.test(k) && k.replace(/\{value\d+\}/g, "").replace(/[^A-Za-z]/g, "").length >= 4)
      .map((k) => new RegExp(`^${k.split(/\{value\d+\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*?")}$`));
    const isRendered = (m: string) => templates.some((re) => re.test(m));
    const hasWords = (m: string) => /[A-Za-z]/.test(m.replace(/\{\w+\}/g, ""));

    const canonicalKeys = new Set(Object.values(copy));
    const missing = [...seen].filter((m) => hasWords(m) && !isData(m) && !isRendered(m) && !(m in copy) && !canonicalKeys.has(m)).sort();
    expect(missing, `Messages looked up via t() but absent from quality-copy.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join("\n")}`).toEqual([]);
  }, 120000);
});
