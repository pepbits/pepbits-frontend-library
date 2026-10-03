import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalizationProvider } from "@pepbits/ops-ui";
import copy from "../medband-copy.json";
import { ReferenceMedbandModule } from "./module";
import { ENCOUNTER_TYPES } from "./lib/encounter-config";
import { counterStorageKey } from "./lib/store";
import { bootstrap, chain, json, makeHost, sessionHandler, type Handler } from "./test-utils";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const aliases = copy as Record<string, string>;
const MARK = /⟦[^⟦⟧]*⟧/g;
const record = new Set<string>();
(function collect(v: unknown) {
  if (typeof v === "string") { record.add(v); v.split(/[\s,]+/).forEach((w) => w && record.add(w)); }
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === "object") Object.values(v).forEach(collect);
})(bootstrap("A"));
// counters these tests add themselves (record data too)
["Desk All", "Lobby", "ER Desk", "ER", "Desk", "All"].forEach((v) => record.add(v));
const recordLongest = [...record].filter((v) => v.length > 1).sort((a, b) => b.length - a.length);
const NOT_COPY = new Set(["Ctrl", "Esc", "AED", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Enter"]);

function pseudo() {
  const asked = new Set<string>();
  const wrap = (children: React.ReactNode) => (
    <LocalizationProvider value={{
      language: "en", direction: "ltr", dateTime: String,
      t: (message, values) => {
        if (/^ui\./.test(message)) return message;
        asked.add(message);
        return `⟦${message.replace(/\{(\w+)\}/g, (m, k) => (values?.[k] === undefined ? m : String(values[k])))}⟧`;
      },
    }}>{children}</LocalizationProvider>
  );
  return { asked, wrap };
}
function untranslated(root: HTMLElement) {
  const found: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let text = node.nodeValue ?? "";
    for (let prev = ""; prev !== text;) { prev = text; text = text.replace(MARK, " "); }
    for (const value of recordLongest) text = text.split(value).join(" ");
    const words = text.split(/[^A-Za-z]+/).filter((w) => w.length >= 3 && !record.has(w) && !NOT_COPY.has(w));
    if (words.length) found.push(`${words.join(" ")}  ←  ${(node.parentElement?.outerHTML ?? "").slice(0, 140)}`);
  }
  return found;
}
const missingAliases = (asked: Set<string>) => [...asked].filter((m) => {
  if (aliases[m] || m.includes("⟦") || /^[ABO]{1,2}[+-]$/.test(m)) return false;
  let rest = m.replace(/\{value\d+\}/g, " ");
  for (const value of recordLongest) rest = rest.split(value).join(" ");
  return /[A-Za-z]{2}/.test(rest);
});

/** A counter that opens every visit type, so each type's form can be shown. */
const everyType = (): Handler => (r) => {
  if (r.url.pathname !== "/bootstrap") return undefined;
  const b = bootstrap("A");
  b.master.counters = [{ id: "ctr-all", name: "Desk All", location: "Lobby", encounterTypes: ENCOUNTER_TYPES.map((t) => t.code) }, ...b.master.counters.filter((c) => !/-1$/.test(c.id) || true)];
  return json(b);
};

describe("every state of the long forms goes through the localization boundary", () => {
  it("the new-encounter form for each visit type, on each of its steps", async () => {
    const p = pseudo();
    const h = makeHost(everyType(), { path: "/encounters/new?patientId=pat-1" });
    window.localStorage.setItem(counterStorageKey(h.host.scope), "ctr-all");
    const { container } = render(p.wrap(<ReferenceMedbandModule path="/encounters/new?patientId=pat-1" host={h.host} />));
    await screen.findAllByText(/New encounter/);
    const problems: string[] = [];
    for (const type of ENCOUNTER_TYPES) {
      const choose = screen.queryAllByRole("button").find((b) => b.textContent?.includes(`⟦${type.label}⟧`) && b.textContent?.includes(`⟦${type.description}⟧`));
      if (choose) fireEvent.click(choose);
      for (const step of ["Visit", "Details", "Case", "Billing"]) {
        const button = screen.queryAllByRole("button").find((b) => b.textContent?.endsWith(`⟦${step}⟧`) && b.hasAttribute("aria-current") || b.textContent?.endsWith(`⟦${step}⟧`));
        if (button) fireEvent.click(button);
        problems.push(...untranslated(container).map((x) => `${type.code}/${step}: ${x}`));
      }
    }
    expect([...new Set(problems)]).toEqual([]);
    expect(missingAliases(p.asked)).toEqual([]);
  });

  it("the new-patient wizard on each step, with the insurance editor", async () => {
    const p = pseudo();
    const h = makeHost(sessionHandler("A"), { path: "/patients/new" });
    const { container } = render(p.wrap(<ReferenceMedbandModule path="/patients/new" host={h.host} />));
    await screen.findAllByText(/Register patient/);
    const problems: string[] = [];
    for (const step of ["Identity", "Contact", "Insurance", "Review"]) {
      const button = screen.queryAllByRole("button").find((b) => b.textContent?.includes(`⟦${step}⟧`));
      if (button) fireEvent.click(button);
      problems.push(...untranslated(container).map((x) => `${step}: ${x}`));
    }
    expect([...new Set(problems)]).toEqual([]);
    expect(missingAliases(p.asked)).toEqual([]);
  });

  it("the patient record dialogs (episode, insurance), the patients filters and the emergency quick registration", async () => {
    const p = pseudo();
    const h = makeHost(sessionHandler("A"), { path: "/patients/pat-1" });
    const { container, unmount } = render(p.wrap(<ReferenceMedbandModule path="/patients/pat-1" host={h.host} />));
    await screen.findAllByText(/Asha TesterA/);
    for (const name of [/New episode/, /Insurance/, /Timeline/]) {
      const button = screen.queryAllByRole("button").find((b) => name.test(b.textContent ?? ""));
      if (button) fireEvent.click(button);
      expect(untranslated(document.body), String(name)).toEqual([]);
    }
    expect(missingAliases(p.asked)).toEqual([]);
    unmount();
    const q = pseudo();
    const filters = render(q.wrap(<ReferenceMedbandModule path="/patients" host={makeHost(chain((r) => (r.url.pathname === "/patients" ? json({ patients: bootstrap("A").data.patients }) : undefined), sessionHandler("A")), { path: "/patients" }).host} />));
    await screen.findAllByText(/Find patient/);
    for (const section of ["Patient", "Insurance", "Care"]) {
      const button = screen.queryAllByRole("button").find((b) => b.textContent?.includes(`⟦${section}⟧`));
      if (button) fireEvent.click(button);
      expect(untranslated(filters.container), section).toEqual([]);
    }
    expect(missingAliases(q.asked)).toEqual([]);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("the emergency quick registration form", async () => {
    const p = pseudo();
    const h = makeHost(chain((r) => {
      if (r.url.pathname !== "/bootstrap") return undefined;
      const b = bootstrap("A");
      b.master.counters = [{ id: "ctr-er", name: "ER Desk", location: "ER", encounterTypes: ["EMERGENCY"] }];
      return json(b);
    }, sessionHandler("A")), { path: "/encounters/new" });
    render(p.wrap(<ReferenceMedbandModule path="/encounters/new" host={h.host} />));
    fireEvent.click(await screen.findByRole("button", { name: /Quick registration/ }));
    await screen.findByRole("dialog");
    expect(untranslated(document.body)).toEqual([]);
    expect(missingAliases(p.asked)).toEqual([]);
  });
});
