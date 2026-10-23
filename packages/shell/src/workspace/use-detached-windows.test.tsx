import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { WindowPortProvider, type DetachedWindowRequest, type WindowPort } from "@pepbits/platform";
import { createWorkspace, type Workspace } from "./index";
import { useDetachedWindows } from "./use-detached-windows.tsx";

const session = { tenantId: "T1", userId: "user-x" };
const newWorkspace = () => createWorkspace({
  session,
  policy: { platform: { modes: ["TAB", "WINDOW"], allowDetach: true } },
});
const doc = (entityId: string, title: string) => ({ module: "UNITAL", documentType: "INTERACTION", entityId, title, subjectId: "100" });

function openDocument(workspace: Workspace, request: ReturnType<typeof doc>) {
  let result!: ReturnType<Workspace["openDocument"]>;
  React.act(() => { result = workspace.openDocument(request); });
  return result;
}

function fakePort() {
  const opened: DetachedWindowRequest[] = [];
  const closed: string[] = [];
  let notify: ((documentId: string) => void) | null = null;
  const port: WindowPort = {
    available: true,
    open: async (request) => { opened.push(request); return true; },
    close: async (documentId) => { closed.push(documentId); },
    focus: async () => undefined,
    onClosed: (listener) => { notify = listener; return () => { notify = null; }; },
  };
  return { port, opened, closed, closeFromOutside: (id: string) => notify?.(id) };
}

function Harness({ workspace, port }: { workspace: Workspace; port: WindowPort }) {
  useDetachedWindows(workspace);
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => workspace.subscribeToChanges(force), [workspace]);
  return (
    <div>
      <p data-testid="detached">{workspace.getDetached().length}</p>
      <p data-testid="open">{workspace.getOpenDocuments().length}</p>
    </div>
  );
}

function mount(port: WindowPort) {
  const workspace = newWorkspace();
  render(<WindowPortProvider value={port}><Harness workspace={workspace} port={port} /></WindowPortProvider>);
  return workspace;
}

const detachedCount = () => Number(screen.getByTestId("detached").textContent);
const openCount = () => Number(screen.getByTestId("open").textContent);

describe("useDetachedWindows", () => {
  /* The store says which documents are in windows; this keeps the real windows
     matching that. One direction of the loop. */
  test("opens a window for a document the store detached", async () => {
    const { port, opened } = fakePort();
    const workspace = mount(port);
    const a = openDocument(workspace, doc("5001", "Maya Thomas")).document!;
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    expect(opened).toHaveLength(1);
    expect(opened[0]!.documentId).toBe(a.documentId);
  });

  /* §17.6. The title reaches the OS taskbar and the window switcher, which are
     not part of the application and outlive the session. */
  test("and titles it without the subject's name", async () => {
    const { port, opened } = fakePort();
    const workspace = mount(port);
    const a = openDocument(workspace, doc("5001", "Maya Thomas — follow-up")).document!;
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    expect(opened[0]!.title).not.toMatch(/Maya|Thomas|follow-up/);
    expect(opened[0]!.title).toMatch(/5001/);
  });

  test("closes the window when the document comes home", async () => {
    const { port, closed } = fakePort();
    const workspace = mount(port);
    const a = openDocument(workspace, doc("5001", "A")).document!;
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    await React.act(async () => { workspace.attachDocument(a.documentId); });
    expect(closed).toEqual([a.documentId]);
  });

  test("and when the document is closed outright", async () => {
    const { port, closed } = fakePort();
    const workspace = mount(port);
    const a = openDocument(workspace, doc("5001", "A")).document!;
    openDocument(workspace, doc("5002", "B"));
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    await React.act(async () => { workspace.closeDocument(a.documentId); });
    expect(closed).toEqual([a.documentId]);
  });

  /* The other direction. A window closed with its own close button has to reach
     the store, or the tab strip goes on claiming the record is on another
     monitor that no longer shows it. */
  test("a window the user closes brings its document home", async () => {
    const { port, closeFromOutside } = fakePort();
    const workspace = mount(port);
    const a = openDocument(workspace, doc("5001", "A")).document!;
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    expect(detachedCount()).toBe(1);
    await React.act(async () => { closeFromOutside(a.documentId); });
    expect(detachedCount()).toBe(0);
    expect(openCount()).toBe(1);
  });

  test("opens nothing twice for one document", async () => {
    const { port, opened } = fakePort();
    const workspace = mount(port);
    const a = openDocument(workspace, doc("5001", "A")).document!;
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    await React.act(async () => { workspace.markDirty(a.documentId); });
    expect(opened).toHaveLength(1);
  });

  /* Logging out must not leave a record on a second monitor. */
  test("closes every window when the workspace is cleared", async () => {
    const { port, closed } = fakePort();
    const workspace = mount(port);
    const a = openDocument(workspace, doc("5001", "A")).document!;
    const b = openDocument(workspace, doc("5002", "B")).document!;
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    await React.act(async () => { workspace.detachDocument(b.documentId); });
    await React.act(async () => { workspace.logout(); });
    expect(closed.sort()).toEqual([a.documentId, b.documentId].sort());
  });

  test("a shell without windows opens none", async () => {
    const { port, opened } = fakePort();
    const workspace = mount({ ...port, available: false });
    const a = openDocument(workspace, doc("5001", "A")).document!;
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    expect(opened).toHaveLength(0);
  });
});

describe("window lifetime", () => {
  test("unmounting the authenticated workspace closes its native windows", async () => {
    const { port, closed } = fakePort();
    const workspace = newWorkspace();
    const { unmount } = render(<WindowPortProvider value={port}><Harness workspace={workspace} port={port} /></WindowPortProvider>);
    const a = openDocument(workspace, doc("5001", "A")).document!;
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    await React.act(async () => { unmount(); });
    expect(closed).toEqual([a.documentId]);
  });
  test("a window that finishes opening after unmount is still closed", async () => {
    const { port, closed } = fakePort();
    let finish!: (ok: boolean) => void;
    port.open = () => new Promise<boolean>(r => { finish = r; });
    const workspace = newWorkspace();
    const { unmount } = render(<WindowPortProvider value={port}><Harness workspace={workspace} port={port} /></WindowPortProvider>);
    const a = openDocument(workspace, doc("5001", "A")).document!;
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    unmount();
    await React.act(async () => { finish(true); });
    expect(closed).toEqual([a.documentId]);
  });
  test("a failed open brings the document back into the main workspace", async () => {
    const { port } = fakePort();
    port.open = async () => false;
    const workspace = mount(port);
    const a = openDocument(workspace, doc("5001", "A")).document!;
    await React.act(async () => { workspace.detachDocument(a.documentId); });
    expect(workspace.getDetached()).toEqual([]);
    expect(workspace.getDocument(a.documentId)).not.toBeNull();
  });
});

  test("Strict Mode cleanup finishes before the replacement window opens", async () => {
    const { port, opened, closed } = fakePort();
    const workspace = newWorkspace();
    const a = workspace.openDocument(doc("5001", "A")).document!;
    workspace.detachDocument(a.documentId);
    let unmount!: () => void;
    await React.act(async () => {
      ({ unmount } = render(<React.StrictMode><WindowPortProvider value={port}><Harness workspace={workspace} port={port} /></WindowPortProvider></React.StrictMode>));
    });
    expect(opened).toHaveLength(2);
    expect(closed).toEqual([a.documentId]);
    await React.act(async () => { unmount(); });
    expect(closed).toEqual([a.documentId, a.documentId]);
  });

test("an open failure cleans up a partially created native window", async () => {
  const { port, closed } = fakePort();
  port.open = async () => { throw new Error("Listener setup failed"); };
  const workspace = mount(port);
  const a = openDocument(workspace, doc("5001", "A")).document!;
  await React.act(async () => { workspace.detachDocument(a.documentId); });
  expect(workspace.getDetached()).toEqual([]);
  expect(closed).toEqual([a.documentId]);
});
