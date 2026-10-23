import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { createWorkspace, type Workspace } from "./index";
import { useMdiWorkspace } from "./use-mdi-workspace.tsx";

const session = { tenantId: "T1", userId: "user-x" };
const newWorkspace = () => createWorkspace({ session, policy: { platform: { modes: ["TAB"] } } });
const doc = (entityId: string, title: string) => ({ module: "FIN", documentType: "RECORD", entityId, title });

function Probe({ workspace, enabled }: { workspace: Workspace; enabled: boolean }) {
  const mdi = useMdiWorkspace(workspace, enabled);
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => workspace.subscribeToChanges(force), [workspace]);
  return (
    <div>
      <p data-testid="on">{mdi ? "on" : "off"}</p>
      <p data-testid="frames">{mdi ? mdi.frames.map((f) => `${f.documentId}@${f.x},${f.y}${f.minimised ? "-min" : ""}`).join(" ") : "-"}</p>
      <button type="button" onClick={() => mdi?.onMinimise(mdi.frames[0]!.documentId)}>minimise first</button>
      <button type="button" onClick={() => mdi?.onRaise(mdi.frames[0]!.documentId)}>raise first</button>
      <button type="button" onClick={() => mdi?.onMove(mdi.frames[0]!.documentId, 250, 130)}>move first</button>
      <button type="button" onClick={() => mdi?.onSelect(mdi.frames[0]!.documentId)}>select first</button>
    </div>
  );
}

const mount = (enabled: boolean) => {
  const workspace = newWorkspace();
  render(<Probe workspace={workspace} enabled={enabled} />);
  return workspace;
};
const frames = () => screen.getByTestId("frames").textContent ?? "";

describe("useMdiWorkspace — optional", () => {
  /* MDI is opt-in. The framework marks the whole phase optional, and the
     workspace it is layered over has to behave exactly as before for everyone
     who never turns it on. */
  test("returns nothing at all when it is off", async () => {
    const workspace = mount(false);
    await React.act(async () => { workspace.openDocument(doc("1", "INV-1")); });
    expect(screen.getByTestId("on")).toHaveTextContent("off");
    expect(frames()).toBe("-");
  });

  test("and writes no remembered sizes while it is off", async () => {
    const wrote = vi.spyOn(Storage.prototype, "setItem");
    const workspace = mount(false);
    await React.act(async () => { workspace.openDocument(doc("1", "INV-1")); });
    expect(wrote.mock.calls.filter(([key]) => String(key).includes("mdi"))).toHaveLength(0);
    wrote.mockRestore();
  });
});

describe("useMdiWorkspace — on", () => {
  test("gives each open document a frame", async () => {
    const workspace = mount(true);
    await React.act(async () => { workspace.openDocument(doc("1", "INV-1")); });
    await React.act(async () => { workspace.openDocument(doc("2", "INV-2")); });
    expect(frames().split(" ")).toHaveLength(2);
  });

  test("a closed document loses its frame", async () => {
    const workspace = mount(true);
    await React.act(async () => { workspace.openDocument(doc("1", "INV-1")); });
    await React.act(async () => { workspace.openDocument(doc("2", "INV-2")); });
    const first = workspace.getOpenDocuments()[0]!;
    await React.act(async () => { workspace.closeDocument(first.documentId); });
    expect(frames().split(" ")).toHaveLength(1);
  });

  test("moving one keeps it where it was put", async () => {
    const workspace = mount(true);
    await React.act(async () => { workspace.openDocument(doc("1", "INV-1")); });
    await userEvent.click(screen.getByText("move first"));
    expect(frames()).toMatch(/@250,130/);
    await React.act(async () => { workspace.openDocument(doc("2", "INV-2")); });
    expect(frames()).toMatch(/@250,130/);
  });

  test("minimising is remembered", async () => {
    const workspace = mount(true);
    await React.act(async () => { workspace.openDocument(doc("1", "INV-1")); });
    await userEvent.click(screen.getByText("minimise first"));
    expect(frames()).toMatch(/-min/);
  });

  /* Selecting a minimised window from the taskbar has to un-minimise it, not
     merely focus a window that is not there. */
  test("selecting a minimised window restores it", async () => {
    const workspace = mount(true);
    await React.act(async () => { workspace.openDocument(doc("1", "INV-1")); });
    await userEvent.click(screen.getByText("minimise first"));
    expect(frames()).toMatch(/-min/);
    await userEvent.click(screen.getByText("select first"));
    expect(frames()).not.toMatch(/-min/);
  });
});
