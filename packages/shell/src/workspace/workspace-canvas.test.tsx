import React from "react";
import {screen} from "@testing-library/react";
import {render} from "../test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { WorkspaceDocument } from "./index";
import { WorkspaceCanvas } from "./workspace-canvas.tsx";
import type { MdiFrame } from "./mdi-frames.ts";

const doc = (id: string, title: string, over: Partial<WorkspaceDocument> = {}): WorkspaceDocument => ({
  documentId: id, documentKey: `T1:PAGE:${id}`, module: "operations", documentType: "PAGE", entityId: id,
  title, presentation: "TAB", state: "BACKGROUND", dirty: false, closable: true,
  security: { tenantId: "T1", userId: "u", documentId: id, documentKey: `T1:PAGE:${id}` },
  openedAt: "", lastActivatedAt: "", ...over,
});

const a = doc("w1", "Record INV-2201", { state: "ACTIVE" });
const b = doc("w2", "Purchase Order PO-88");
const cold = doc("w3", "Budget 2026", { state: "SUSPENDED" });
const noop = () => undefined;

const render_ = (over: Partial<Parameters<typeof WorkspaceCanvas>[0]> = {}) =>
  render(<WorkspaceCanvas
    documents={[a, b, cold]} splitIds={[]} activeDocumentId="w1"
    onFocusPane={noop} onClosePane={noop} onSwap={noop} onExitSplit={noop}
    renderDocument={(d) => <p>body of {d.title}</p>}
    {...over}
  />);

/* getByText finds display:none content, which is exactly what has to be
   distinguished here — mounted and hidden is the whole point. */
const mounted = (title: string) => screen.queryByText(`body of ${title}`);

describe("WorkspaceCanvas", () => {
  test("shows the active document", () => {
    render_();
    expect(mounted("Record INV-2201")).toBeVisible();
  });

  /* The reason this component exists. A warm document stays mounted so its
     scroll position, its filters and its half-typed form survive a trip to
     another tab; hidden, so it is not on screen and not in the tab order. */
  test("keeps a warm document mounted but out of sight", () => {
    render_();
    const warm = mounted("Purchase Order PO-88");
    expect(warm).not.toBeNull();
    expect(warm).not.toBeVisible();
  });

  test("does not mount a suspended one at all", () => {
    render_();
    expect(mounted("Budget 2026")).toBeNull();
  });

  /* What all of it is for. Switching tabs must not throw the screen away and
     build a new one, or every filter and every unsaved field resets. */
  test("switching away and back keeps what was typed", async () => {
    function Editor({ id }: { id: string }) {
      const [value, setValue] = React.useState("");
      return <input aria-label={`draft ${id}`} value={value} onChange={(e) => setValue(e.target.value)} />;
    }
    const { rerender } = render(<WorkspaceCanvas
      documents={[a, b]} splitIds={[]} activeDocumentId="w1"
      onFocusPane={noop} onClosePane={noop} onSwap={noop} onExitSplit={noop}
      renderDocument={(d) => <Editor id={d.documentId} />} />);

    await userEvent.type(screen.getByLabelText("draft w1"), "half a sentence");
    rerender(<WorkspaceCanvas
      documents={[a, b]} splitIds={[]} activeDocumentId="w2"
      onFocusPane={noop} onClosePane={noop} onSwap={noop} onExitSplit={noop}
      renderDocument={(d) => <Editor id={d.documentId} />} />);
    rerender(<WorkspaceCanvas
      documents={[a, b]} splitIds={[]} activeDocumentId="w1"
      onFocusPane={noop} onClosePane={noop} onSwap={noop} onExitSplit={noop}
      renderDocument={(d) => <Editor id={d.documentId} />} />);

    expect(screen.getByLabelText("draft w1")).toHaveValue("half a sentence");
  });

  test("a hidden document is not reachable by keyboard", () => {
    render_();
    const hidden = mounted("Purchase Order PO-88")?.closest("[inert]");
    expect(hidden).not.toBeNull();
  });
});

describe("WorkspaceCanvas — split", () => {
  const split = (over: Partial<Parameters<typeof WorkspaceCanvas>[0]> = {}) =>
    render_({ splitIds: ["w1", "w2"], activeDocumentId: "w2", ...over });

  test("draws both panes", () => {
    split();
    expect(mounted("Record INV-2201")).toBeVisible();
    expect(mounted("Purchase Order PO-88")).toBeVisible();
  });

  test("each pane is a named region and one is marked focused", () => {
    split();
    expect(screen.getByRole("region", { name: /Record INV-2201/ })).toBeVisible();
    const focused = screen.getAllByRole("region").filter((r) => r.getAttribute("aria-current") === "true");
    expect(focused).toHaveLength(1);
    expect(focused[0]).toHaveAccessibleName(/Purchase Order/);
  });

  /* `split` is a property of the arrangement, so every mounted document carries
     the role while a split is on — including the warm ones behind it. What
     keeps that honest is aria-hidden and inert, which take those elements out
     of the accessibility tree: three region ELEMENTS exist, two are announced.
     Both halves are asserted, because a raw DOM count of three looks like a bug
     and is not one. */
  test("a warm document behind the split is mounted but not announced", () => {
    render_({
      documents: [a, b, doc("w4", "Payroll Run")],
      splitIds: ["w1", "w2"],
      activeDocumentId: "w2",
    });
    expect(screen.getAllByRole("region")).toHaveLength(2);
    expect(screen.getAllByRole("region", { hidden: true })).toHaveLength(3);
    expect(mounted("Payroll Run")).not.toBeVisible();
  });

  test("an unsaved pane says so in its name", () => {
    render_({ splitIds: ["w1", "w2"], activeDocumentId: "w2", documents: [{ ...a, dirty: true }, b, cold] });
    expect(screen.getByRole("region", { name: /Record INV-2201/ })).toHaveAccessibleName(/unsaved/i);
  });

  test("clicking a pane focuses it", async () => {
    const onFocusPane = vi.fn();
    split({ onFocusPane });
    await userEvent.click(screen.getByText("body of Record INV-2201"));
    expect(onFocusPane).toHaveBeenCalledWith("w1");
  });

  test("each pane closes itself", async () => {
    const onClosePane = vi.fn();
    split({ onClosePane });
    await userEvent.click(screen.getByRole("button", { name: /Close Record INV-2201/ }));
    expect(onClosePane).toHaveBeenCalledWith("w1");
  });

  test("swap and full screen are offered once for the arrangement", async () => {
    const onSwap = vi.fn();
    const onExitSplit = vi.fn();
    split({ onSwap, onExitSplit });
    await userEvent.click(screen.getByRole("button", { name: /Swap/ }));
    expect(onSwap).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: /full screen/i }));
    expect(onExitSplit).toHaveBeenCalledOnce();
  });

  test("the divider is a separator that reports where it is", () => {
    split();
    const divider = screen.getByRole("separator");
    expect(divider).toHaveAttribute("aria-orientation", "vertical");
    expect(divider).toHaveAttribute("aria-valuenow", "50");
  });

  test("arrow keys move it and it stays inside its limits", async () => {
    split();
    const divider = screen.getByRole("separator");
    divider.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(divider).toHaveAttribute("aria-valuenow", "52");
    for (let i = 0; i < 40; i += 1) await userEvent.keyboard("{ArrowLeft}");
    expect(Number(divider.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(20);
  });

  test("Home puts it back in the middle", async () => {
    split();
    const divider = screen.getByRole("separator");
    divider.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{Home}");
    expect(divider).toHaveAttribute("aria-valuenow", "50");
  });

  test("no divider and no pane chrome when not split", () => {
    render_();
    expect(screen.queryByRole("separator")).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });

  /* Entering a split must not rebuild the documents either — the whole point is
     that these two screens are the ones you were already looking at. */
  test("entering a split keeps what was typed", async () => {
    function Editor({ id }: { id: string }) {
      const [value, setValue] = React.useState("");
      return <input aria-label={`draft ${id}`} value={value} onChange={(e) => setValue(e.target.value)} />;
    }
    const props = { documents: [a, b], onFocusPane: noop, onClosePane: noop, onSwap: noop, onExitSplit: noop, renderDocument: (d: WorkspaceDocument) => <Editor id={d.documentId} /> };
    const { rerender } = render(<WorkspaceCanvas {...props} splitIds={[]} activeDocumentId="w1" />);
    await userEvent.type(screen.getByLabelText("draft w1"), "kept");
    rerender(<WorkspaceCanvas {...props} splitIds={["w1", "w2"]} activeDocumentId="w2" />);
    expect(screen.getByLabelText("draft w1")).toHaveValue("kept");
  });
});

/* Phase 6. Floating frames inside the shell, over the same mounted children —
   the store still owns which documents exist; a frame is a rectangle with an id. */
describe("WorkspaceCanvas — MDI", () => {
  const frame = (documentId: string, over: Partial<MdiFrame> = {}): MdiFrame =>
    ({ documentId, documentType: "PAGE", x: 20, y: 20, width: 600, height: 400, minimised: false, z: 1, ...over });

  const mdi = (over: Partial<Parameters<typeof WorkspaceCanvas>[0]["mdi"]> = {}, canvas: Partial<Parameters<typeof WorkspaceCanvas>[0]> = {}) =>
    render_({
      mdi: {
        frames: [frame("w1"), frame("w2", { x: 60, y: 60, z: 2 })],
        onMove: noop, onResize: noop, onRaise: noop, onMinimise: noop, setBounds: noop,
        ...over,
      },
      ...canvas,
    });

  test("every open document gets a frame of its own", () => {
    mdi();
    expect(mounted("Record INV-2201")).toBeVisible();
    expect(mounted("Purchase Order PO-88")).toBeVisible();
    expect(screen.getAllByRole("region")).toHaveLength(2);
  });

  /* A frame is positioned by style, so this is what the user actually sees. */
  test("a frame sits where its geometry says", () => {
    mdi();
    const panel = screen.getByRole("region", { name: /Purchase Order/ }).closest("div[style]") as HTMLElement;
    expect(panel.style.left).toBe("60px");
    expect(panel.style.top).toBe("60px");
  });

  test("the frames stack in z order", () => {
    mdi();
    const first = screen.getByRole("region", { name: /Record/ }).closest("div[style]") as HTMLElement;
    const second = screen.getByRole("region", { name: /Purchase Order/ }).closest("div[style]") as HTMLElement;
    expect(Number(second.style.zIndex)).toBeGreaterThan(Number(first.style.zIndex));
  });

  test("pressing on a frame raises it", async () => {
    const onRaise = vi.fn();
    mdi({ onRaise });
    await userEvent.click(screen.getByText("body of Record INV-2201"));
    expect(onRaise).toHaveBeenCalledWith("w1");
  });

  test("each frame minimises itself", async () => {
    const onMinimise = vi.fn();
    mdi({ onMinimise });
    await userEvent.click(screen.getByRole("button", { name: /Minimise Record INV-2201/i }));
    expect(onMinimise).toHaveBeenCalledWith("w1");
  });

  /* Minimised means out of sight, not unmounted — the whole Phase 4 point.
     Rebuilding the screen on restore would lose the filters it was minimised
     with. */
  test("a minimised frame stays mounted, hidden", () => {
    mdi({ frames: [frame("w1", { minimised: true }), frame("w2")] });
    const hidden = mounted("Record INV-2201");
    expect(hidden).not.toBeNull();
    expect(hidden).not.toBeVisible();
    expect(mounted("Purchase Order PO-88")).toBeVisible();
  });

  test("each frame closes itself", async () => {
    const onClosePane = vi.fn();
    mdi({}, { onClosePane });
    await userEvent.click(screen.getByRole("button", { name: /Close Record INV-2201/ }));
    expect(onClosePane).toHaveBeenCalledWith("w1");
  });

  test("an unsaved frame says so in its name", () => {
    mdi({}, { documents: [{ ...a, dirty: true }, b, cold] });
    expect(screen.getByRole("region", { name: /Record INV-2201/ })).toHaveAccessibleName(/unsaved/i);
  });

  test("a suspended document has no frame at all", () => {
    mdi();
    expect(mounted("Budget 2026")).toBeNull();
  });

  test("there is no split divider in MDI", () => {
    mdi();
    expect(screen.queryByRole("separator")).toBeNull();
  });

  /* The layout is CSS over the same children, so moving between arrangements
     must not rebuild the screens — the same rule the split had to obey. */
  /* setBounds existed and nothing called it, so frames were laid out against a
     guessed size — a window cascaded for a taller shell hung below the taskbar
     with its own title bar unreachable underneath it. */
  test("it tells the arrangement how much room there is", () => {
    const setBounds = vi.fn();
    mdi({ setBounds });
    expect(setBounds).toHaveBeenCalled();
    expect(setBounds.mock.calls[0]![0]).toHaveProperty("width");
    expect(setBounds.mock.calls[0]![0]).toHaveProperty("height");
  });

  test("switching from tabs to MDI keeps what was typed", async () => {
    function Editor({ id }: { id: string }) {
      const [value, setValue] = React.useState("");
      return <input aria-label={`draft ${id}`} value={value} onChange={(e) => setValue(e.target.value)} />;
    }
    const base = { documents: [a, b], splitIds: [], onFocusPane: noop, onClosePane: noop, onSwap: noop, onExitSplit: noop,
      renderDocument: (d: WorkspaceDocument) => <Editor id={d.documentId} /> };
    const { rerender } = render(<WorkspaceCanvas {...base} activeDocumentId="w1" />);
    await userEvent.type(screen.getByLabelText("draft w1"), "kept");
    rerender(<WorkspaceCanvas {...base} activeDocumentId="w1" mdi={{ frames: [frame("w1"), frame("w2")], onMove: noop, onResize: noop, onRaise: noop, onMinimise: noop, setBounds: noop }} />);
    expect(screen.getByLabelText("draft w1")).toHaveValue("kept");
  });
});
