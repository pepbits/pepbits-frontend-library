import {screen} from "@testing-library/react";
import {render} from "../test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { WorkspaceDocument } from "./index";
import { MdiTaskbar } from "./mdi-taskbar.tsx";
import type { MdiFrame } from "./mdi-frames.ts";

const doc = (id: string, title: string, over: Partial<WorkspaceDocument> = {}): WorkspaceDocument => ({
  documentId: id, documentKey: `T1:PAGE:${id}`, module: "operations", documentType: "PAGE", entityId: id,
  title, presentation: "TAB", state: "BACKGROUND", dirty: false, closable: true,
  security: { tenantId: "T1", userId: "u", documentId: id, documentKey: `T1:PAGE:${id}` },
  openedAt: "", lastActivatedAt: "", ...over,
});
const frame = (documentId: string, over: Partial<MdiFrame> = {}): MdiFrame =>
  ({ documentId, documentType: "PAGE", x: 0, y: 0, width: 600, height: 400, minimised: false, z: 1, ...over });

const documents = [doc("w1", "Record INV-2201"), doc("w2", "Purchase Order PO-88", { dirty: true }), doc("w3", "Budget 2026")];
const frames = [frame("w1"), frame("w2"), frame("w3", { minimised: true })];
const noop = () => undefined;

const render_ = (over: Partial<Parameters<typeof MdiTaskbar>[0]> = {}) =>
  render(<MdiTaskbar documents={documents} frames={frames} activeDocumentId="w1" onSelect={noop} {...over} />);

describe("MdiTaskbar", () => {
  test("one chip per open window", () => {
    render_();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  /* The only way back to a minimised window. Without it, minimising is a way of
     losing a record. */
  test("a minimised window is still listed, and says it is minimised", () => {
    render_();
    expect(screen.getByRole("button", { name: /Budget 2026/ })).toHaveAccessibleName(/minimised/i);
  });

  test("clicking one asks for it", async () => {
    const onSelect = vi.fn();
    render_({ onSelect });
    await userEvent.click(screen.getByRole("button", { name: /Budget 2026/ }));
    expect(onSelect).toHaveBeenCalledWith("w3");
  });

  test("the focused window is marked, and only that one", () => {
    render_();
    expect(screen.getByRole("button", { name: /Record/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getAllByRole("button").filter((b) => b.getAttribute("aria-current") === "true")).toHaveLength(1);
  });

  test("unsaved work is named, not just dotted", () => {
    render_();
    expect(screen.getByRole("button", { name: /Purchase Order/ })).toHaveAccessibleName(/unsaved/i);
  });

  /* A page can have toolbars of its own. Which row lists the open windows
     should not be a question answered by counting. */
  test("it is a named toolbar", () => {
    render_();
    expect(screen.getByRole("navigation", { name: "Open windows" })).toContainElement(screen.getByRole("toolbar", { name: "Open windows" }));
  });

  test("nothing open, nothing drawn", () => {
    const { container } = render_({ documents: [], frames: [] });
    expect(container).toBeEmptyDOMElement();
  });
});
