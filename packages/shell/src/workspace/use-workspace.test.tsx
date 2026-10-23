import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { createWorkspace } from "./document-manager.ts";
import { DocumentProvider, WorkspaceProvider, useActiveDocument, useDocumentState, useOptionalWorkspace, useReportDirty, useWorkspace, useWorkspaceDocuments } from "./use-workspace.tsx";

const session = { tenantId: "T1", userId: "user-x" };
const policy = { platform: { modes: ["TAB"] as const } };

function newWorkspace() {
  return createWorkspace({ session, policy: { platform: { modes: ["TAB"] } } });
}

function Tabs({ onRender }: { onRender?: () => void }) {
  const documents = useWorkspaceDocuments();
  const active = useActiveDocument();
  onRender?.();
  return (
    <ul>
      {documents.map((doc) => (
        <li key={doc.documentId}>
          <button type="button" aria-current={doc.documentId === active?.documentId ? "true" : undefined}>
            {doc.title}{doc.dirty ? " •" : ""}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Harness({ workspace, onRender }: { workspace: ReturnType<typeof createWorkspace>; onRender?: () => void }) {
  return <WorkspaceProvider workspace={workspace}><Tabs onRender={onRender} /></WorkspaceProvider>;
}

describe("useWorkspaceDocuments", () => {
  test("renders what is open", () => {
    const workspace = newWorkspace();
    workspace.openDocument({ module: "OPERATIONS", documentType: "SUBJECT", entityId: "1", title: "Alex Example" });
    render(<Harness workspace={workspace} />);
    expect(screen.getByRole("button", { name: "Alex Example" })).toBeVisible();
  });

  /* The whole point of the external store: a change made outside React — from a
     keyboard shortcut, a websocket, another window — has to reach the screen. */
  test("re-renders when a document is opened after mount", async () => {
    const workspace = newWorkspace();
    render(<Harness workspace={workspace} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    await userEvent.click(document.body);
    React.act(() => { workspace.openDocument({ module: "OPERATIONS", documentType: "SUBJECT", entityId: "1", title: "Alex Example" }); });
    expect(screen.getByRole("button", { name: "Alex Example" })).toBeVisible();
  });

  test("shows which document is active, and follows a focus change", () => {
    const workspace = newWorkspace();
    const a = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" }).document!;
    workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "2", title: "B" });
    render(<Harness workspace={workspace} />);
    expect(screen.getByRole("button", { name: "B" })).toHaveAttribute("aria-current", "true");
    React.act(() => { workspace.focusDocument(a.documentId); });
    expect(screen.getByRole("button", { name: "A" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "B" })).not.toHaveAttribute("aria-current");
  });

  test("a closed document leaves the screen", () => {
    const workspace = newWorkspace();
    const a = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" }).document!;
    workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "2", title: "B" });
    render(<Harness workspace={workspace} />);
    React.act(() => { workspace.closeDocument(a.documentId); });
    expect(screen.queryByRole("button", { name: "A" })).toBeNull();
    expect(screen.getByRole("button", { name: "B" })).toBeVisible();
  });

  test("dirty state reaches the tab", () => {
    const workspace = newWorkspace();
    const a = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" }).document!;
    render(<Harness workspace={workspace} />);
    React.act(() => { workspace.markDirty(a.documentId); });
    expect(screen.getByRole("button", { name: "A •" })).toBeVisible();
  });

  /* A snapshot rebuilt on every call is an infinite render loop rather than a
     slow one — React re-reads until the value settles and it never does. */
  test("a stable store does not re-render forever", () => {
    const workspace = newWorkspace();
    workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" });
    const onRender = vi.fn();
    render(<Harness workspace={workspace} onRender={onRender} />);
    expect(onRender.mock.calls.length).toBeLessThan(5);
  });

  test("no-op changes do not re-render", () => {
    const workspace = newWorkspace();
    const a = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" }).document!;
    const onRender = vi.fn();
    render(<Harness workspace={workspace} onRender={onRender} />);
    const before = onRender.mock.calls.length;
    React.act(() => { workspace.focusDocument(a.documentId); workspace.markClean(a.documentId); });
    expect(onRender.mock.calls.length).toBe(before);
  });

  test("unmounting stops listening", () => {
    const workspace = newWorkspace();
    const { unmount } = render(<Harness workspace={workspace} />);
    unmount();
    expect(() => workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" })).not.toThrow();
  });
});

describe("useWorkspace", () => {
  /* A silent no-provider fallback produces a shell that looks correct and opens
     nothing — the same reason useNavigation throws. */
  test("throws outside a provider rather than returning an empty workspace", () => {
    const Bare = () => { useWorkspace(); return null; };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Bare />)).toThrow(/WorkspaceProvider/);
    quiet.mockRestore();
  });

  test("hands back the same workspace it was given", () => {
    const workspace = newWorkspace();
    let seen: unknown;
    const Probe = () => { seen = useWorkspace(); return null; };
    render(<WorkspaceProvider workspace={workspace}><Probe /></WorkspaceProvider>);
    expect(seen).toBe(workspace);
  });
});

describe("useReportDirty", () => {
  function Form({ dirty }: { dirty: boolean }) {
    useReportDirty(dirty);
    return <p>form</p>;
  }

  test("marks the document the user is looking at", () => {
    const workspace = newWorkspace();
    const a = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" }).document!;
    const { rerender } = render(<WorkspaceProvider workspace={workspace}><Form dirty={false} /></WorkspaceProvider>);
    expect(workspace.getDocument(a.documentId)?.dirty).toBe(false);
    rerender(<WorkspaceProvider workspace={workspace}><Form dirty /></WorkspaceProvider>);
    expect(workspace.getDocument(a.documentId)?.dirty).toBe(true);
  });

  test("a background save clears only its owning document", () => {
    const workspace = newWorkspace();
    const a = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" }).document!;
    const b = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "2", title: "B" }).document!;
    const forms = (dirtyA: boolean) => <WorkspaceProvider workspace={workspace}>
      <DocumentProvider documentId={a.documentId}><Form dirty={dirtyA} /></DocumentProvider>
      <DocumentProvider documentId={b.documentId}><Form dirty /></DocumentProvider>
    </WorkspaceProvider>;
    const { rerender } = render(forms(true));
    expect(workspace.getDocument(a.documentId)?.dirty).toBe(true);
    expect(workspace.getDocument(b.documentId)?.dirty).toBe(true);
    rerender(forms(false));
    expect(workspace.getDocument(a.documentId)?.dirty).toBe(false);
    expect(workspace.getDocument(b.documentId)?.dirty).toBe(true);
  });

  test("saving clears it again", () => {
    const workspace = newWorkspace();
    const a = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" }).document!;
    const { rerender } = render(<WorkspaceProvider workspace={workspace}><Form dirty /></WorkspaceProvider>);
    rerender(<WorkspaceProvider workspace={workspace}><Form dirty={false} /></WorkspaceProvider>);
    expect(workspace.getDocument(a.documentId)?.dirty).toBe(false);
  });

  /* The web shell has no workspace yet, and the same form renders in both. A
     hook that threw there would take out every form on the web shell. */
  test("does nothing at all when there is no workspace", () => {
    expect(() => render(<Form dirty />)).not.toThrow();
  });

  test("useOptionalWorkspace returns null rather than throwing", () => {
    let seen: unknown = "unset";
    const Probe = () => { seen = useOptionalWorkspace(); return null; };
    render(<Probe />);
    expect(seen).toBeNull();
  });
});

describe("useDocumentState", () => {
  const Probe = () => <p>state: {useDocumentState()}</p>;

  test("tells a screen whether it is the one on screen", () => {
    const workspace = newWorkspace();
    const a = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" }).document!;
    const b = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "2", title: "B" }).document!;
    render(
      <WorkspaceProvider workspace={workspace}>
        <DocumentProvider documentId={a.documentId}><Probe /></DocumentProvider>
        <DocumentProvider documentId={b.documentId}><Probe /></DocumentProvider>
      </WorkspaceProvider>,
    );
    expect(screen.getByText("state: BACKGROUND")).toBeVisible();
    expect(screen.getByText("state: ACTIVE")).toBeVisible();
  });

  test("and follows the workspace when focus moves", () => {
    const workspace = newWorkspace();
    const a = workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "1", title: "A" }).document!;
    workspace.openDocument({ module: "M", documentType: "SUBJECT", entityId: "2", title: "B" });
    render(<WorkspaceProvider workspace={workspace}><DocumentProvider documentId={a.documentId}><Probe /></DocumentProvider></WorkspaceProvider>);
    expect(screen.getByText("state: BACKGROUND")).toBeVisible();
    React.act(() => { workspace.focusDocument(a.documentId); });
    expect(screen.getByText("state: ACTIVE")).toBeVisible();
  });

  /* The same screens render in the web shell, which has no workspace. A screen
     that decided it was BACKGROUND there would switch itself off on every page. */
  test("says ACTIVE where there is no workspace at all", () => {
    render(<Probe />);
    expect(screen.getByText("state: ACTIVE")).toBeVisible();
  });

  test("and where a document has not been declared", () => {
    const workspace = newWorkspace();
    render(<WorkspaceProvider workspace={workspace}><Probe /></WorkspaceProvider>);
    expect(screen.getByText("state: ACTIVE")).toBeVisible();
  });
});
