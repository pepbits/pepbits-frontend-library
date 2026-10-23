import {render} from "../test/render";
import React from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {ColumnLayoutScope} from "@pepbits/preferences";
import type {DataColumn} from "../types";

const authedFetch = vi.hoisted(() => vi.fn());
const useSession = vi.hoisted(() => vi.fn());

const { useColumnLayout } = await import("./use-column-layout.ts");

/**
 * Which columns a worklist shows, and in which order.
 *
 * Two stores, deliberately not synchronised: switching scope changes where the
 * page looks and each keeps what it already had, because copying one into the
 * other would silently overwrite a layout the user built on their other
 * machine. And one module-level cache, which is the part worth guarding — an
 * untagged cache outlives sign-out and shows the previous account's columns to
 * the next person on this browser.
 */

const columns: DataColumn[] = [
  { key: "id", label: "Id" },
  { key: "name", label: "Name" },
  { key: "owner", label: "Owner" },
  { key: "outstanding", label: "Outstanding" },
];
const DEFAULTS = ["id", "name"];

/* A fresh id per test. The account cache is module-level and keyed by user, so
   a new user is also the only honest way to empty it — and doing it this way
   exercises the tagging rather than reaching around it. */
let seq = 0;
const nextUser = () => `u${(seq += 1)}`;

let latest: ReturnType<typeof useColumnLayout>;

function Probe({ pageId = "item-master", scope = "account", defaults = DEFAULTS }: { pageId?: string; scope?: ColumnLayoutScope; defaults?: string[] }) {
  latest = useColumnLayout(pageId, scope, columns, defaults, {identity:useSession().user?.id??"anonymous",request:authedFetch});
  return (
    <div>
      <output data-testid="visible">{latest.visibleKeys.join(",")}</output>
      <output data-testid="sort">{latest.sort ? `${latest.sort.key}:${latest.sort.direction}` : "none"}</output>
    </div>
  );
}

/**
 * The hook STARTS on `defaults`, so "the value is the defaults" is true before
 * the load has even been attempted — and three of the tests below were green
 * against a version whose apply() never ran at all. Everything that expects a
 * fallback waits for the request to have been made and its promise chain to
 * have run first.
 */
const settled = async () => {
  await waitFor(() => expect(authedFetch).toHaveBeenCalledWith("/layouts"));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};

const visible = () => screen.getByTestId("visible").textContent;
const sort = () => screen.getByTestId("sort").textContent;
const layouts = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  authedFetch.mockReset();
  authedFetch.mockResolvedValue(layouts({ layouts: {} }));
  useSession.mockReturnValue({ user: { id: nextUser() } });
  window.localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("what it starts with", () => {
  test("the defaults, when nothing has been saved", async () => {
    render(<Probe />);
    await settled();
    expect(visible()).toBe("id,name");
    expect(sort()).toBe("none");
  });

  test("the saved layout, when there is one", async () => {
    authedFetch.mockResolvedValue(layouts({ layouts: { "item-master": { columns: ["owner", "id"], sort: { key: "owner", direction: "desc" } } } }));
    render(<Probe />);
    await waitFor(() => expect(visible()).toBe("owner,id"));
    expect(sort()).toBe("owner:desc");
  });

  /* A saved key that no longer exists in the schema is dropped rather than
     rendering an empty column, which is what a renamed field would produce. */
  test("drops a saved column the schema no longer has", async () => {
    /* The surviving columns are deliberately NOT the defaults: an expectation
       of "id,name" here would be satisfied by a hook that never loaded. */
    authedFetch.mockResolvedValue(layouts({ layouts: { "item-master": { columns: ["owner", "creditLimit", "outstanding"], sort: null } } }));
    render(<Probe />);
    await waitFor(() => expect(visible()).toBe("owner,outstanding"));
  });

  test("and falls back to the defaults when none of them survives", async () => {
    authedFetch.mockResolvedValue(layouts({ layouts: { "item-master": { columns: ["gone", "alsoGone"], sort: null } } }));
    render(<Probe />);
    await settled();
    expect(visible()).toBe("id,name");
  });

  test("an unreachable API behaves as nothing saved rather than blocking the table", async () => {
    /* A failed thenable rather than a rejected promise; see auth's tests. It
       carries `catch` as well as `then`, because the save path attaches one and
       the load path awaits — both reach this same mock. */
    authedFetch.mockImplementation(() => ({
      then: (_ok: unknown, fail: (error: unknown) => void) => fail(new TypeError("Failed to fetch")),
      catch: (recover: (error: unknown) => unknown) => Promise.resolve(recover(new TypeError("Failed to fetch"))),
    }));
    render(<Probe />);
    await settled();
    expect(visible()).toBe("id,name");
    /* And it hydrated rather than merely never starting: a hook that threw on
       the way in would sit on the defaults too, and never save again. */
    act(() => { latest.setVisibleKeys(["owner"]); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(authedFetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
  });

  test("a refused request behaves the same way", async () => {
    authedFetch.mockResolvedValue(new Response("{}", { status: 403 }));
    render(<Probe />);
    await settled();
    expect(visible()).toBe("id,name");
    act(() => { latest.setVisibleKeys(["owner"]); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(authedFetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
  });

  test("each page keeps its own layout", async () => {
    authedFetch.mockResolvedValue(layouts({
      layouts: {
        "item-master": { columns: ["owner"], sort: null },
        "supplier-master": { columns: ["name"], sort: null },
      },
    }));
    render(<Probe pageId="supplier-master" />);
    await waitFor(() => expect(visible()).toBe("name"));
  });
});

describe("the account cache", () => {
  test("is read once for the whole session, not once per worklist", async () => {
    render(<Probe pageId="item-master" />);
    await waitFor(() => expect(authedFetch).toHaveBeenCalled());
    const reads = authedFetch.mock.calls.filter(([path]) => path === "/layouts").length;
    render(<Probe pageId="supplier-master" />);
    await waitFor(() => expect(screen.getAllByTestId("visible")).toHaveLength(2));
    expect(authedFetch.mock.calls.filter(([path]) => path === "/layouts").length).toBe(reads);
  });

  /* A module-level cache outlives sign-out. Untagged, it would show the
     previous account's columns to the next person who signs in here. */
  test("is dropped when a different account signs in", async () => {
    authedFetch.mockResolvedValue(layouts({ layouts: { "item-master": { columns: ["owner"], sort: null } } }));
    render(<Probe />);
    await waitFor(() => expect(visible()).toBe("owner"));

    useSession.mockReturnValue({ user: { id: nextUser() } });
    authedFetch.mockResolvedValue(layouts({ layouts: { "item-master": { columns: ["outstanding"], sort: null } } }));
    render(<Probe />);
    await waitFor(() => expect(screen.getAllByTestId("visible")[1]!.textContent).toBe("outstanding"));
  });
});

describe("saving", () => {
  /* Without the hydration guard, mounting writes back exactly what it just
     read — a PUT per page view. */
  test("mounting saves nothing", async () => {
    render(<Probe />);
    await waitFor(() => expect(visible()).toBe("id,name"));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(authedFetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });

  test("a change is saved, once, after a pause", async () => {
    render(<Probe />);
    await waitFor(() => expect(visible()).toBe("id,name"));
    act(() => { latest.setVisibleKeys(["id", "owner"]); });
    /* Debounced for the same reason preferences are: dragging through a column
       list would otherwise fire a request per checkbox. */
    act(() => { vi.advanceTimersByTime(200); });
    expect(authedFetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(300); });
    const puts = authedFetch.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0]![1].body)).toEqual({ pageId: "item-master", layout: { columns: ["id", "owner"], sort: null } });
  });

  test("a burst of changes saves the last one, once", async () => {
    render(<Probe />);
    await waitFor(() => expect(visible()).toBe("id,name"));
    for (const keys of [["id"], ["id", "owner"], ["id", "owner", "outstanding"]]) {
      act(() => { latest.setVisibleKeys(keys); });
      act(() => { vi.advanceTimersByTime(100); });
    }
    act(() => { vi.advanceTimersByTime(500); });
    const puts = authedFetch.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0]![1].body).layout.columns).toEqual(["id", "owner", "outstanding"]);
  });

  test("the sort is saved with the columns", async () => {
    render(<Probe />);
    await waitFor(() => expect(visible()).toBe("id,name"));
    act(() => { latest.setSort({ key: "name", direction: "asc" }); });
    act(() => { vi.advanceTimersByTime(500); });
    const put = authedFetch.mock.calls.filter(([, init]) => init?.method === "PUT").at(-1);
    expect(JSON.parse(put![1].body).layout.sort).toEqual({ key: "name", direction: "asc" });
  });
});

describe("the browser store", () => {
  test("reads what this device remembered", async () => {
    window.localStorage.setItem("pepbits-columns:item-master", JSON.stringify(["owner", "name"]));
    window.localStorage.setItem("pepbits-sort:item-master", JSON.stringify({ key: "owner", direction: "asc" }));
    render(<Probe scope="browser" />);
    await waitFor(() => expect(visible()).toBe("owner,name"));
    expect(sort()).toBe("owner:asc");
  });

  test("writes there instead of to the account", async () => {
    render(<Probe scope="browser" />);
    await waitFor(() => expect(visible()).toBe("id,name"));
    act(() => { latest.setVisibleKeys(["id", "outstanding"]); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(JSON.parse(window.localStorage.getItem("pepbits-columns:item-master")!)).toEqual(["id", "outstanding"]);
    expect(authedFetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });

  test("clearing the sort removes it rather than storing null", async () => {
    window.localStorage.setItem("pepbits-sort:item-master", JSON.stringify({ key: "owner", direction: "asc" }));
    render(<Probe scope="browser" />);
    await waitFor(() => expect(sort()).toBe("owner:asc"));
    act(() => { latest.setSort(null); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(window.localStorage.getItem("pepbits-sort:item-master")).toBeNull();
  });

  test("does not ask the API at all", async () => {
    render(<Probe scope="browser" />);
    await waitFor(() => expect(visible()).toBe("id,name"));
    expect(authedFetch).not.toHaveBeenCalled();
  });

  /* The two stores are NOT synchronised on purpose: copying one into the other
     would silently overwrite a layout built on the user's other machine. */
  test("does not adopt the account layout, or hand its own over", async () => {
    authedFetch.mockResolvedValue(layouts({ layouts: { "item-master": { columns: ["outstanding"], sort: null } } }));
    window.localStorage.setItem("pepbits-columns:item-master", JSON.stringify(["owner"]));
    render(<Probe scope="browser" />);
    await waitFor(() => expect(visible()).toBe("owner"));
    expect(authedFetch).not.toHaveBeenCalled();
  });

  test("survives storage that refuses to be read", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    render(<Probe scope="browser" />);
    await waitFor(() => expect(visible()).toBe("id,name"));
  });

  test("survives storage that refuses to be written", async () => {
    render(<Probe scope="browser" />);
    await waitFor(() => expect(visible()).toBe("id,name"));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    act(() => { latest.setVisibleKeys(["id"]); });
    expect(() => act(() => { vi.advanceTimersByTime(500); })).not.toThrow();
    expect(visible()).toBe("id");
  });

  test("survives a stored value that is not JSON", async () => {
    window.localStorage.setItem("pepbits-columns:item-master", "{not json");
    render(<Probe scope="browser" />);
    await waitFor(() => expect(visible()).toBe("id,name"));
  });
});

describe("reset", () => {
  test("puts the defaults back and clears the sort", async () => {
    render(<Probe />);
    await waitFor(() => expect(visible()).toBe("id,name"));
    act(() => { latest.setVisibleKeys(["outstanding"]); latest.setSort({ key: "owner", direction: "desc" }); });
    await waitFor(() => expect(visible()).toBe("outstanding"));
    act(() => { latest.reset(); });
    expect(visible()).toBe("id,name");
    expect(sort()).toBe("none");
  });
});

test('a late response from a previous identity cannot overwrite the current account cache',async()=>{
 let finish!:(response:Response)=>void;
 useSession.mockReturnValue({user:{id:'old-scope'}});
 authedFetch.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;}));
 const old=render(<Probe/>);await waitFor(()=>expect(authedFetch).toHaveBeenCalledWith('/layouts'));old.unmount();
 useSession.mockReturnValue({user:{id:'current-scope'}});
 authedFetch.mockResolvedValue(layouts({layouts:{'item-master':{columns:['owner'],sort:null}}}));
 const current=render(<Probe/>);await waitFor(()=>expect(visible()).toBe('owner'));
 await act(async()=>{finish(layouts({layouts:{'item-master':{columns:['name'],sort:null}}}));await Promise.resolve();});
 current.unmount();render(<Probe/>);await waitFor(()=>expect(visible()).toBe('owner'));
});
