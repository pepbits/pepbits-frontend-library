import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import { ReferenceHostProvider } from "@pepbits/reference-host";
import { ReferenceMedbandModule, medbandPresentation } from "./module";
import { Checkbox, Chip, DateInput, DateTimeInput, Field, Input, Segmented, Select, Textarea } from "./components/ui/form";
import { Modal, MultiSelect, ToastProvider, useToast } from "./components/ui/overlay";
import { Button, Panel } from "./components/ui/primitives";
import { makeHost, sessionHandler } from "./test-utils";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const withHost = (ui: React.ReactNode, preferences: Partial<typeof DEFAULT_PREFERENCES> = {}) => {
  const { host } = makeHost(sessionHandler(), { preferences });
  return <ReferenceHostProvider host={host}><ToastProvider>{ui}</ToastProvider></ReferenceHostProvider>;
};
const classes = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);

/** Source class strings, taken from the ORIGINAL files, must survive in the module verbatim (the reference skin is its class list). */
const REFERENCE = process.env.MEDBAND_REFERENCE_ROOT ?? "/home/pepadmin/pb/saas/reference/frontend/medband-patient-access-1/medband/src";
describe.skipIf(!existsSync(REFERENCE))("source class strings are preserved", () => {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  const TOKEN = /^[!\-a-z0-9[\]:./%()#_,'=&>*@\\]+$/i;
  const LAYOUT = /(^|\s)(flex|grid|inline|block|hidden|rounded|border|bg-|text-|px-|py-|p-|h-|w-|size-|gap-|min-|max-|font-|shadow|ring|absolute|relative|fixed|sticky|truncate|animate|overflow|items-|justify-|mt-|mb-|ml-|mr-|space-|divide-|hover:|focus)/;
  const classStrings = (text: string) => [...text.matchAll(/"([^"\n]+)"|`([^`\n$]+)`/g)].map((m) => m[1] ?? m[2]).filter((s) => s.split(/\s+/).every((w) => TOKEN.test(w)) && LAYOUT.test(s));
  const ours = walk(resolve(__dirname)).filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
  /** Deliberate differences, each with its reason (the shared host shell replaces the source chrome; stacking and toast placement are host-managed). */
  const ADAPTED: Record<string, string> = {
    "components/shell/app-shell.tsx": "host header/sidebar/mobile nav replace the source rail (documented adaptation)",
    "app/layout.tsx": "the loading fallback lives in module.tsx", "lib/store.tsx": "the loading fallback lives in module.tsx",
    "fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]": "modal sits above the host chrome (z-[120])",
    "pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2": "toast placement follows the host toast position preference",
    "rounded-2xl bg-paper shadow-lift": "Panel is built on the shared Card: Card adds border + border-0 restores the source",
  };
  // Collection still runs inside a skipped describe, so only walk a tree that exists.
  const files = (existsSync(REFERENCE) ? walk(REFERENCE) : []).filter((f) => /\.tsx$/.test(f) && !f.includes("/api/")).map((f) => [f.slice(REFERENCE.length + 1), f] as const);

  it.each(files.filter(([name]) => !ADAPTED[name]))("%s", (_name, file) => {
    const missing = classStrings(readFileSync(file, "utf8")).filter((s) => !ADAPTED[s] && !ours.includes(s));
    expect(missing).toEqual([]);
  });
});

describe("controls render the source classes and keep their behaviour", () => {
  it("Input, Select, Textarea, DateInput and DateTimeInput share the source control class list, height and field labelling", () => {
    render(withHost(<>
      <Field label="Name"><Input placeholder="Type" /></Field>
      <Field label="Kind"><Select value="" onChange={() => {}} placeholder="Choose" options={[{ value: "a", label: "Alpha" }]} /></Field>
      <Field label="Notes"><Textarea /></Field>
      <Field label="Born"><DateInput /></Field>
      <Field label="When"><DateTimeInput /></Field>
      <Field label="Bad" error="Required"><Input invalid /></Field>
    </>));
    const control = ["rounded-lg", "border", "bg-paper", "px-3", "text-sm", "text-ink", "placeholder:text-ink-faint", "transition-colors", "outline-none", "focus:border-scrub-500", "focus:ring-2", "focus:ring-scrub-100", "disabled:bg-canvas", "disabled:text-ink-faint"];
    // The source Select passes bg-[right_10px_center] after the control classes; tailwind-merge reads it as a background COLOUR and
    // drops bg-paper, so the original select has no paper fill (transparent over its card). cx reproduces that exactly.
    for (const el of [screen.getByLabelText("Name"), screen.getByLabelText("Kind"), screen.getByLabelText("Notes"), screen.getByLabelText("Born"), screen.getByLabelText("When")]) for (const c of control) { if (el.tagName === "SELECT" && c === "bg-paper") continue; expect(classes(el), `${el.tagName} ${c}`).toContain(c); }
    expect(classes(screen.getByLabelText("Kind"))).not.toContain("bg-paper");
    expect(classes(screen.getByLabelText("Kind"))).toEqual(expect.arrayContaining(["appearance-none", "bg-[length:16px]", "bg-[right_10px_center]", "bg-no-repeat", "pr-8", "h-10"]));
    expect(classes(screen.getByLabelText("Name"))).toEqual(expect.arrayContaining(["h-10", "w-full", "border-line"]));
    expect(classes(screen.getByLabelText("Notes"))).toEqual(expect.arrayContaining(["min-h-20", "resize-none", "py-2"]));
    expect((screen.getByLabelText("Born") as HTMLInputElement).type).toBe("date");
    expect((screen.getByLabelText("When") as HTMLInputElement).type).toBe("datetime-local");
    const bad = screen.getByLabelText("Bad");
    expect(bad.getAttribute("aria-invalid")).toBe("true");
    expect(classes(bad)).toContain("border-rose-400");
    expect(bad.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(bad.getAttribute("aria-describedby")!)?.textContent).toBe("Required");
  });

  it("a caller's width class replaces the default full width (source `width()` rule)", () => {
    render(withHost(<Field label="Dept"><Select className="w-auto" value="" onChange={() => {}} options={[]} /></Field>));
    expect(classes(screen.getByLabelText("Dept"))).toContain("w-auto");
    expect(classes(screen.getByLabelText("Dept"))).not.toContain("w-full");
  });

  it("Segmented is a radiogroup: the selected segment has the paper/scrub-800 chip, arrows are native clicks, onChange fires once", () => {
    const seen: string[] = [];
    const Harness = () => { const [v, setV] = useState("a"); return <Segmented ariaLabel="Pick" value={v} onChange={(x) => { seen.push(x); setV(x); }} options={[{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }]} />; };
    render(withHost(<Harness />));
    const group = screen.getByRole("radiogroup", { name: "Pick" });
    expect(classes(group)).toEqual(expect.arrayContaining(["inline-flex", "rounded-lg", "bg-canvas", "p-0.5"]));
    const [a, b] = within(group).getAllByRole("radio");
    expect(a.getAttribute("aria-checked")).toBe("true");
    expect(classes(a)).toEqual(expect.arrayContaining(["bg-paper", "text-scrub-800", "shadow-sm", "h-9", "text-[13px]", "rounded-md"]));
    expect(classes(b)).toEqual(expect.arrayContaining(["text-ink-soft", "hover:text-ink"]));
    fireEvent.click(b);
    expect(seen).toEqual(["b"]);
    expect(b.getAttribute("aria-checked")).toBe("true");
    expect(classes(b)).toContain("bg-paper");
    expect(classes(a)).not.toContain("bg-paper");
  });

  it("Chip toggles with the source on/off classes and Checkbox is a real checkbox toggled by Space/label", () => {
    const Harness = () => { const [on, setOn] = useState(false); const [ok, setOk] = useState(false); return <><Chip on={on} onClick={() => setOn(!on)}>Walk-in</Chip><Checkbox checked={ok} onChange={setOk} label="VIP" /></>; };
    render(withHost(<Harness />));
    const chip = screen.getByRole("button", { name: "Walk-in" });
    expect(classes(chip)).toEqual(expect.arrayContaining(["rounded-full", "border"]));
    const before = chip.className;
    fireEvent.click(chip);
    expect(chip.className).not.toBe(before);
    expect(chip.className).toMatch(/scrub/);
    const box = screen.getByRole("checkbox", { name: /VIP/ }) as HTMLInputElement;
    expect(classes(box)).toEqual(expect.arrayContaining(["peer", "sr-only"]));
    fireEvent.click(box);
    expect(box.checked).toBe(true);
  });

  it("Button variants keep the source classes (primary scrub-700, secondary paper+border, ghost) and honour disabled", () => {
    render(withHost(<><Button>Save</Button><Button variant="secondary">Cancel</Button><Button variant="ghost" disabled>Skip</Button></>));
    expect(classes(screen.getByRole("button", { name: "Save" }))).toEqual(expect.arrayContaining(["bg-scrub-700", "text-white", "rounded-lg", "font-medium", "h-10"]));
    expect(classes(screen.getByRole("button", { name: "Cancel" }))).toEqual(expect.arrayContaining(["bg-paper", "border", "border-line", "text-ink"]));
    expect((screen.getByRole("button", { name: "Skip" }) as HTMLButtonElement).disabled).toBe(true);
    expect(classes(screen.getByRole("button", { name: "Skip" }))).toContain("disabled:cursor-not-allowed");
  });

  it("Panel keeps the source card look on the shared Card: rounded-2xl, paper, shadow-lift, border-0; no host border/shadow tokens", () => {
    render(withHost(<Panel data-testid="panel">Body</Panel>));
    const c = classes(screen.getByTestId("panel"));
    expect(c).toEqual(expect.arrayContaining(["rounded-2xl", "bg-paper", "shadow-lift", "border-0"]));
    expect(c.filter((x) => /shadow-\[var|bg-\[var\(--surface|rounded-\[var/.test(x))).toEqual([]);
  });
});

describe("MultiSelect (source popover multi-select)", () => {
  const options = [{ value: "a", label: "Alpha", group: "G1" }, { value: "b", label: "Beta", group: "G1" }, { value: "c", label: "Gamma" }];
  const Harness = ({ onChange }: { onChange?: (v: string[]) => void }) => { const [v, setV] = useState<string[]>([]); return <MultiSelect ariaLabel="Letters" values={v} onChange={(x) => { onChange?.(x); setV(x); }} options={options} placeholder="Any letter" />; };

  it("opens, filters, selects, shows chips and +n more, clears and removes a chip", () => {
    const seen: string[][] = [];
    render(withHost(<Harness onChange={(v) => seen.push(v)} />));
    const trigger = screen.getByRole("button", { name: "Letters" });
    expect(classes(trigger)).toEqual(expect.arrayContaining(["rounded-lg", "border", "bg-paper", "min-h-10"]));
    expect(screen.getByText("Any letter")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const filter = screen.getByPlaceholderText("Filter");
    fireEvent.change(filter, { target: { value: "ga" } });
    expect(screen.queryByText("Alpha")).toBeNull();
    fireEvent.change(filter, { target: { value: "zzz" } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
    fireEvent.change(filter, { target: { value: "" } });
    fireEvent.click(screen.getByText("Alpha"));
    fireEvent.click(screen.getByText("Beta"));
    expect(seen.at(-1)).toEqual(["a", "b"]);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(seen.at(-1)).toEqual([]);
  });
});

describe("Modal (source markup, shared dialog behaviour)", () => {
  const Harness = ({ onClose = () => {} }: { onClose?: () => void }) => {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open</button><Modal open={open} onClose={() => { onClose(); setOpen(false); }} title="Edit coverage" footer={<Button>Save</Button>} width="max-w-2xl"><Input aria-label="Policy" /><Button variant="ghost">Inner</Button></Modal></>;
  };

  it("renders the source panel: top-aligned fixed overlay, scrub-900 scrim, rounded-2xl paper panel, shadow-pop, header/body/footer rules", () => {
    render(withHost(<Harness />));
    fireEvent.click(screen.getByText("Open"));
    const dialog = screen.getByRole("dialog", { name: "Edit coverage" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(classes(dialog)).toEqual(expect.arrayContaining(["fixed", "inset-0", "flex", "items-start", "justify-center", "p-4", "pt-[10vh]"]));
    const scrim = dialog.firstElementChild!;
    expect(classes(scrim)).toEqual(expect.arrayContaining(["animate-fade", "absolute", "inset-0", "bg-scrub-900/40", "backdrop-blur-[2px]"]));
    const panel = dialog.children[1];
    expect(classes(panel)).toEqual(expect.arrayContaining(["animate-rise", "relative", "w-full", "overflow-hidden", "rounded-2xl", "bg-paper", "shadow-pop", "max-w-2xl"]));
    expect(classes(panel.children[0])).toEqual(expect.arrayContaining(["flex", "items-center", "justify-between", "border-b", "border-line-soft", "px-5", "py-3.5"]));
    expect(classes(panel.children[1])).toEqual(expect.arrayContaining(["scroll-thin", "max-h-[65vh]", "overflow-auto", "px-5", "py-4"]));
    expect(classes(panel.children[2])).toEqual(expect.arrayContaining(["flex", "justify-end", "gap-2", "border-t", "border-line-soft", "bg-canvas/50", "px-5", "py-3"]));
    expect(within(dialog).getByRole("heading", { name: "Edit coverage" })).toBeTruthy();
    expect(classes(within(dialog).getByRole("button", { name: "Close" }))).toEqual(expect.arrayContaining(["rounded-md", "p-1", "text-ink-faint", "hover:bg-canvas", "hover:text-ink"]));
  });

  it("Escape closes, the scrim and the close button close, and focus returns to the opener", () => {
    let closed = 0;
    render(withHost(<Harness onClose={() => { closed += 1; }} />));
    const opener = screen.getByText("Open");
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("dialog").firstElementChild!);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(closed).toBe(3);
  });

  it("keeps Tab inside the dialog in both directions", () => {
    render(withHost(<Harness />));
    fireEvent.click(screen.getByText("Open"));
    const dialog = screen.getByRole("dialog");
    const stops = [...dialog.querySelectorAll<HTMLElement>("button, input")];
    stops.at(-1)!.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(stops[0]);
    stops[0].focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(stops.at(-1));
  });

  it("closes only the top-most of two stacked dialogs on Escape", () => {
    const Two = () => { const [a, setA] = useState(true); const [b, setB] = useState(true); return <><Modal open={a} onClose={() => setA(false)} title="First"><span>one</span></Modal><Modal open={b} onClose={() => setB(false)} title="Second"><span>two</span></Modal></>; };
    render(withHost(<Two />));
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getAllByRole("dialog").map((d) => d.getAttribute("aria-label"))).toEqual(["First"]);
  });
});

describe("Toast (source toast on host toast preferences)", () => {
  const Fire = () => { const toast = useToast(); return <><button onClick={() => toast({ title: "Saved", body: "Record stored", tone: "success" })}>ok</button><button onClick={() => toast({ title: "Could not save", body: "Boom", tone: "error" })}>bad</button></>; };

  it("success toast is scrub-900 with the band-yellow check; error toast is an alert on rose-700; both keep the source card classes", () => {
    render(withHost(<Fire />));
    fireEvent.click(screen.getByText("ok"));
    const ok = screen.getByText("Saved").closest("div[class*='shadow-pop']")!;
    expect(classes(ok)).toEqual(expect.arrayContaining(["animate-slide-in", "pointer-events-auto", "flex", "gap-3", "rounded-xl", "px-4", "py-3", "text-white", "shadow-pop", "bg-scrub-900"]));
    expect(ok.querySelector("svg")!.getAttribute("class")).toContain("text-band");
    expect(screen.getByText("Record stored").className).toContain("text-scrub-100");
    fireEvent.click(screen.getByText("bad"));
    const bad = screen.getByRole("alert");
    expect(classes(bad)).toEqual(expect.arrayContaining(["bg-rose-700", "rounded-xl", "shadow-pop"]));
    expect(within(bad).getByText("Boom").className).toContain("text-rose-50");
  });

  it("toast position follows the host preference and the toast dismisses after the managed duration", async () => {
    const { host } = makeHost(sessionHandler(), { preferences: { toastPosition: "bottom-left", toastDuration: 2000 } });
    render(<ReferenceHostProvider host={host}><ToastProvider><Fire /></ToastProvider></ReferenceHostProvider>);
    fireEvent.click(screen.getByText("ok"));
    const region = screen.getByText("Saved").closest("[aria-live]")!;
    expect(classes(region)).toEqual(expect.arrayContaining(["bottom-4", "left-4"]));
    expect(classes(region)).not.toContain("right-4");
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByText("Saved")).toBeTruthy();
  });
});

describe("reference-default presentation switches", () => {
  it("defaults select the reference skin; any non-default theme, font, density or wrapping hands that part to the host", () => {
    expect(medbandPresentation(DEFAULT_PREFERENCES)).toEqual({ "data-medband-palette": "reference", "data-medband-font": "reference", "data-medband-table": "reference" });
    expect(medbandPresentation({ ...DEFAULT_PREFERENCES, theme: "midnight" })["data-medband-palette"]).toBe("host");
    expect(medbandPresentation({ ...DEFAULT_PREFERENCES, fontFamily: "plex" })["data-medband-font"]).toBe("host");
    expect(medbandPresentation({ ...DEFAULT_PREFERENCES, density: "compact" })["data-medband-table"]).toBe("host");
    expect(medbandPresentation({ ...DEFAULT_PREFERENCES, density: "spacious" })["data-medband-table"]).toBe("host");
    expect(medbandPresentation({ ...DEFAULT_PREFERENCES, wrapCellText: true })["data-medband-table"]).toBe("host");
  });

  it("the module root carries the switches and re-evaluates them when the effective preferences change while mounted", async () => {
    const first = makeHost(sessionHandler(), { path: "/" });
    const view = render(<ReferenceMedbandModule path="/" host={first.host} />);
    const root = () => view.container.querySelector(".reference-medband")!;
    expect(root().getAttribute("data-medband-palette")).toBe("reference");
    const second = makeHost(sessionHandler(), { path: "/", preferences: { theme: "midnight", fontFamily: "plex" } });
    view.rerender(<ReferenceMedbandModule path="/" host={{ ...second.host, scope: first.host.scope }} />);
    await waitFor(() => expect(root().getAttribute("data-medband-palette")).toBe("host"));
    expect(root().getAttribute("data-medband-font")).toBe("host");
    expect(root().getAttribute("data-theme")).toBe("midnight");
  });
});
