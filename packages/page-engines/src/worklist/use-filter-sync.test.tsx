import {render} from "../test/render";
import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type {FilterDefinition} from "../types";
import { useFilterSync } from "./use-filter-sync.tsx";

const definitions: FilterDefinition[] = [
  { key: "status", label: "Status", type: "select", classification: "operational" },
  { key: "branch", label: "Branch", type: "select", classification: "operational" },
  { key: "recordName", label: "Record name", type: "text", classification: "phi" },
  { key: "privateRef", label: "Private reference", type: "text", classification: "phi" },
];

function Probe({ onUrl, onStore }: { onUrl: (q: string) => void; onStore: (v: string) => void }) {
  const sync = useFilterSync({ definitions, pageId: "worklist", writeUrl: onUrl, writeStore: (v) => onStore(JSON.stringify(v)) });
  return (
    <div>
      <p data-testid="values">{JSON.stringify(sync.values)}</p>
      <p data-testid="sensitive">{sync.sensitiveKeys.join(",") || "none"}</p>
      <button type="button" onClick={() => sync.set("status", "waiting")}>set status</button>
      <button type="button" onClick={() => sync.set("recordName", "Maya Thomas")}>set person</button>
      <button type="button" onClick={() => sync.set("privateRef", "PRIVATE-001")}>set privateRef</button>
      <button type="button" onClick={() => sync.reset()}>reset</button>
    </div>
  );
}

function mount() {
  const urls: string[] = [];
  const stores: string[] = [];
  render(<Probe onUrl={(q) => urls.push(q)} onStore={(v) => stores.push(v)} />);
  return { urls, stores };
}
const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const values = () => JSON.parse(screen.getByTestId("values").textContent ?? "{}");

describe("useFilterSync", () => {
  test("an operational filter reaches the URL", async () => {
    const { urls } = mount();
    await click("set status");
    expect(values().status).toBe("waiting");
    expect(urls.at(-1)).toContain("status=waiting");
  });

  /* The property the whole feature exists for, asserted on what LEAVES the
     component rather than on what it holds. */
  test("a PHI filter is held, and never written anywhere", async () => {
    const { urls, stores } = mount();
    await click("set person");
    await click("set privateRef");
    expect(values().recordName).toBe("Maya Thomas");
    for (const written of [...urls, ...stores]) {
      for (const leak of ["Maya", "Thomas", "PRIVATE-001", "recordName", "privateRef"]) {
        expect(written).not.toContain(leak);
      }
    }
  });

  test("it says which filters are being held back", async () => {
    mount();
    await click("set person");
    await click("set privateRef");
    expect(screen.getByTestId("sensitive").textContent).toBe("privateRef,recordName");
  });

  test("mixing the two writes only the safe half", async () => {
    const { urls } = mount();
    await click("set status");
    await click("set person");
    expect(urls.at(-1)).toBe("status=waiting");
  });

  /* Resetting has to clear both halves. A reset that leaves an invisible PHI
     filter applied is worse than no reset — the list is filtered and nothing
     on screen says why. */
  test("reset clears the sensitive half too", async () => {
    mount();
    await click("set status");
    await click("set person");
    await click("reset");
    expect(values()).toEqual({});
    expect(screen.getByTestId("sensitive").textContent).toBe("none");
  });

  test("only operational filters are remembered on the device", async () => {
    const { stores } = mount();
    await click("set status");
    await click("set person");
    expect(JSON.parse(stores.at(-1) ?? "{}")).toEqual({ status: "waiting" });
  });
});

describe("useFilterSync — reading back", () => {
  function Restored({ query, stored }: { query: string; stored: Record<string, string> }) {
    const sync = useFilterSync({
      definitions, pageId: "worklist",
      initialQuery: new URLSearchParams(query),
      initialStored: stored,
      writeUrl: () => undefined, writeStore: () => undefined,
    });
    return <p data-testid="values">{JSON.stringify(sync.values)}</p>;
  }

  test("restores the operational filters from a URL", () => {
    render(<Restored query="status=waiting&branch=AD01" stored={{}} />);
    expect(values()).toEqual({ status: "waiting", branch: "AD01" });
  });

  /* A URL is user input. Someone can type ?privateRef= by hand, or an old link can
     carry one from before the policy existed. */
  test("refuses a sensitive parameter someone put in the URL", () => {
    render(<Restored query="status=waiting&privateRef=PRIVATE-001" stored={{}} />);
    expect(values()).toEqual({ status: "waiting" });
  });

  /* And storage is user input too: it is a file on the user's disk, and it may
     hold values written by a build from before this rule existed. */
  test("refuses a sensitive value already sitting in storage", () => {
    render(<Restored query="" stored={{ status: "waiting", recordName: "Maya Thomas" }} />);
    expect(values()).toEqual({ status: "waiting" });
  });
});
