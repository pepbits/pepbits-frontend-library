import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalizationProvider } from "@pepbits/ops-ui";
import copy from "../medband-copy.json";
import { ReferenceMedbandModule } from "./module";
import { bootstrap, makeHost, sessionHandler } from "./test-utils";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const aliases = copy as Record<string, string>;
const MARK = /⟦[^⟦⟧]*⟧/g;

/** Every string value in the fictional backend payload: record data, which the module shows as written and never translates. */
const recordValues = (() => {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") { out.add(v); v.split(/[\s,]+/).forEach((w) => w && out.add(w)); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(bootstrap("A"));
  return out;
})();

const recordLongest = [...recordValues].filter((v) => v.length > 1).sort((a, b) => b.length - a.length);
/** Weekday names and the currency code come from the host formatter, and key caps name physical keys: none of them is catalog copy. */
const WEEKDAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "AED", "Ctrl", "Esc"]);
const unknownMessage = (m: string) => {
  if (aliases[m] || m.includes("⟦") || /^[ABO]{1,2}[+-]$/.test(m)) return false; // blood groups are values, not copy
  let rest = m.replace(/\{value\d+\}/g, " ");
  for (const value of recordLongest) rest = rest.split(value).join(" ");
  return /[A-Za-z]{2}/.test(rest);
};

/**
 * A pseudo-language: it marks every message the module asks the localization boundary for and resolves placeholders, so a
 * page can be checked for English that bypassed it. Catalog keys (the alias targets) come back unresolved, like a catalog miss.
 */
function pseudo() {
  const asked = new Set<string>();
  return {
    asked,
    provider: (children: React.ReactNode) => (
      <LocalizationProvider value={{
        language: "en", direction: "ltr", dateTime: String,
        t: (message, values) => {
          if (/^ui\./.test(message)) return message;
          asked.add(message);
          return `⟦${message.replace(/\{(\w+)\}/g, (m, k) => (values?.[k] === undefined ? m : String(values[k])))}⟧`;
        },
      }}>{children}</LocalizationProvider>
    ),
  };
}

function untranslated(container: HTMLElement) {
  const found: string[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let text = node.nodeValue ?? "";
    for (let prev = ""; prev !== text;) { prev = text; text = text.replace(MARK, " "); }
    for (const value of recordLongest) text = text.split(value).join(" ");
    const words = text.split(/[^A-Za-z]+/).filter((w) => w.length >= 3 && !recordValues.has(w) && !WEEKDAYS.has(w));
    if (words.length) found.push(`${words.join(" ")}  ←  ${(node.parentElement?.outerHTML ?? "").slice(0, 140)}`);
  }
  return found;
}

const ROUTES: Array<[string, string]> = [
  ["/", "Who is at the desk?"],
  ["/patients", "Find patient"],
  ["/patients/new", "Register patient"],
  ["/patients/pat-1", "Asha TesterA"],
  ["/encounters", "Encounters"],
  ["/encounters/new?patientId=pat-1", "New encounter"],
  ["/encounters/new?type=IP&patientId=pat-1&admissionRequest=adm-1", "New encounter"],
  ["/admissions", "Admissions"],
  ["/admissions/new?patientId=pat-1", "Admission request"],
  ["/episodes", "Episodes of care"],
];

describe("English copy goes through the localization boundary", () => {
  for (const [path, marker] of ROUTES) {
    it(`${path}: every reader-facing string is asked of the catalog and has an alias`, async () => {
      const p = pseudo();
      const h = makeHost(sessionHandler("A"), { path });
      const { container } = render(p.provider(<ReferenceMedbandModule path={path} host={h.host} />));
      await screen.findAllByText(new RegExp(marker.replace(/[?]/g, "\\?")), undefined, { timeout: 4000 });
      await waitFor(() => expect(container.querySelector("[data-medband-stage]")).toBeTruthy());
      expect(untranslated(container)).toEqual([]);
      const missing = [...p.asked].filter(unknownMessage);
      expect(missing).toEqual([]);
    });
  }

  it("covers the overlays: counter menu, quick search, admissions dialogs", async () => {
    const p = pseudo();
    const h = makeHost(sessionHandler("A"), { path: "/admissions" });
    const { container } = render(p.provider(<ReferenceMedbandModule path="/admissions" host={h.host} />));
    await screen.findAllByText(/Admissions/);
    fireEvent.click(screen.getByRole("button", { name: /Counter/ }));
    await screen.findByRole("listbox");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await screen.findByRole("dialog");
    expect(untranslated(container)).toEqual([]);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(await screen.findByRole("radio", { name: /Pending/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Collect deposit/ }));
    expect(untranslated(document.body)).toEqual([]);
    const missing = [...p.asked].filter(unknownMessage);
    expect(missing).toEqual([]);
    expect(within(document.body).queryAllByRole("dialog").length).toBeGreaterThan(0);
  });
});
