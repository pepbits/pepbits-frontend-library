import {screen} from "@testing-library/react";
import {render} from "../test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { WorkspaceDocument } from "./index";
import { WorkspaceTabs } from "./workspace-tabs.tsx";

const doc = (over: Partial<WorkspaceDocument> & { documentId: string; title: string }): WorkspaceDocument => ({
  documentKey: `T1:PAGE:${over.documentId}`, module: "operations", documentType: "PAGE", entityId: over.documentId,
  presentation: "TAB", state: "BACKGROUND", dirty: false, closable: true,
  security: { tenantId: "T1", userId: "u", documentId: over.documentId, documentKey: `T1:PAGE:${over.documentId}` },
  openedAt: "", lastActivatedAt: "", ...over,
});

const documents = [
  doc({ documentId: "w1", title: "Overview", closable: false }),
  doc({ documentId: "w2", title: "Items", state: "ACTIVE" }),
  doc({ documentId: "w3", title: "Journal Entry", dirty: true }),
];

const noop = () => undefined;
const render_ = (over: Partial<Parameters<typeof WorkspaceTabs>[0]> = {}) =>
  render(<WorkspaceTabs documents={documents} activeDocumentId="w2" onActivate={noop} onClose={noop} onCloseOthers={noop} onOpenCommand={noop} {...over} />);

describe("WorkspaceTabs", () => {
  test("shows a tab per open document", () => {
    render_();
    expect(screen.getByRole("tab", { name: /Overview/ })).toBeVisible();
    expect(screen.getByRole("tab", { name: /Items/ })).toBeVisible();
    expect(screen.getByRole("tab", { name: /Journal Entry/ })).toBeVisible();
  });

  /* A coloured underline is what a sighted user reads. aria-selected is what
     everyone else gets, and without it the strip announces three identical tabs. */
  test("exactly one tab reports as selected", () => {
    render_();
    expect(screen.getByRole("tab", { name: /Items/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tab").filter((t) => t.getAttribute("aria-selected") === "true")).toHaveLength(1);
  });

  test("activating asks for that document", async () => {
    const onActivate = vi.fn();
    render_({ onActivate });
    await userEvent.click(screen.getByRole("tab", { name: /Journal Entry/ }));
    expect(onActivate).toHaveBeenCalledWith("w3");
  });

  /* Unsaved work has to be visible before the close button is pressed, not
     after — a dot on the tab is the only warning a user gets. */
  test("an unsaved document is marked, and says so in words", () => {
    render_();
    expect(screen.getByRole("tab", { name: /Journal Entry/ })).toHaveAccessibleName(/unsaved/i);
    expect(screen.getByRole("tab", { name: /Items/ })).not.toHaveAccessibleName(/unsaved/i);
  });

  test("a fixed tab offers no close button", () => {
    render_();
    expect(screen.queryByRole("button", { name: /Close Overview/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Close Items/ })).toBeVisible();
  });

  test("closing asks for that document and not the tab under it", async () => {
    const onClose = vi.fn();
    const onActivate = vi.fn();
    render_({ onClose, onActivate });
    await userEvent.click(screen.getByTitle("Close Journal Entry"));
    expect(onClose).toHaveBeenCalledWith("w3");
    expect(onActivate).not.toHaveBeenCalled();
  });

  test("close others works on the active tab", async () => {
    const onCloseOthers = vi.fn();
    render_({ onCloseOthers });
    await userEvent.click(screen.getByRole("button", { name: "Tab options" }));
    await userEvent.click(screen.getByText("Close other tabs"));
    expect(onCloseOthers).toHaveBeenCalledWith("w2");
  });

  /* The split lives in the tab strip's menu because that is where "what do I
     do with this tab" already is. Offering it on every tab would mean choosing
     which tab you meant before choosing the action. */
  test("offers to split the current tab", async () => {
    const onSplit = vi.fn();
    render_({ onSplit });
    await userEvent.click(screen.getByRole("button", { name: "Tab options" }));
    await userEvent.click(screen.getByText(/Split/));
    expect(onSplit).toHaveBeenCalledOnce();
  });

  test("offers swap and full screen only while split", async () => {
    render_({ onSwap: noop, onExitSplit: noop, isSplit: false });
    await userEvent.click(screen.getByRole("button", { name: "Tab options" }));
    expect(screen.queryByText(/Swap/)).toBeNull();
  });

  test("and offers them when it is", async () => {
    const onSwap = vi.fn();
    render_({ onSwap, onExitSplit: noop, isSplit: true });
    await userEvent.click(screen.getByRole("button", { name: "Tab options" }));
    await userEvent.click(screen.getByText(/Swap/));
    expect(onSwap).toHaveBeenCalledOnce();
  });

  /* Offered only where a shell can actually open a window. An action that
     silently does nothing is worse than one that is not there. */
  test("offers to open the current tab in a window when the shell can", async () => {
    const onDetach = vi.fn();
    render_({ onDetach });
    await userEvent.click(screen.getByRole("button", { name: "Tab options" }));
    await userEvent.click(screen.getByText(/own window/i));
    expect(onDetach).toHaveBeenCalledWith("w2");
  });

  test("and does not offer it when the shell cannot", async () => {
    render_();
    await userEvent.click(screen.getByRole("button", { name: "Tab options" }));
    expect(screen.queryByText(/own window/i)).toBeNull();
  });

  /* A tab whose record is on another monitor must not look like one you can
     read here — clicking it brings the window forward, it does not draw a
     second copy. */
  test("a detached tab says where its record is", () => {
    render_({ detachedIds: ["w3"] });
    expect(screen.getByRole("tab", { name: /Journal Entry/ })).toHaveAccessibleName(/window/i);
  });

  test("the plus opens the command palette", async () => {
    const onOpenCommand = vi.fn();
    render_({ onOpenCommand });
    await userEvent.click(screen.getByRole("button", { name: "Open page" }));
    expect(onOpenCommand).toHaveBeenCalledOnce();
  });

  /* A page can have tablists of its own — a billing record has six — so the
     one holding the open documents has to be distinguishable from them. */
  test("it is a tablist with a name of its own", () => {
    render_();
    const navigation=screen.getByRole("navigation", { name: "Open documents" });
    expect(navigation).toContainElement(screen.getByRole("tablist", { name: "Open documents" }));
    expect(navigation).toContainElement(screen.getByRole("button", { name: "Open page" }));
  });
});
