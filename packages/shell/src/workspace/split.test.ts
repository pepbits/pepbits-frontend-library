import { beforeEach, describe, expect, test } from "vitest";
import { createWorkspace } from "./document-manager.ts";
import type { Workspace } from "./document-manager.ts";

const session = { tenantId: "T1", userId: "user-x" };
const doc = (entityId: string, title: string) => ({ module: "OPERATIONS", documentType: "SUBJECT", entityId, title });

let ws: Workspace;
beforeEach(() => {
  ws = createWorkspace({ session, policy: { platform: { modes: ["SINGLE", "TAB", "SPLIT"] } } });
});

const entities = () => ws.getSplit().map((id) => ws.getDocument(id)?.entityId);
const states = () => ws.getOpenDocuments().map((d) => `${d.entityId}:${d.state}`);

describe("openInSplit", () => {
  test("puts the new document beside the current one", () => {
    ws.openDocument(doc("1", "A"));
    ws.openInSplit(doc("2", "B"));
    expect(entities()).toEqual(["1", "2"]);
  });

  test("opening on the left puts it first", () => {
    ws.openDocument(doc("1", "A"));
    ws.openInSplit(doc("2", "B"), "left");
    expect(entities()).toEqual(["2", "1"]);
  });

  /* Both panes are on screen, so both are live. This is where
     maxActiveDocuments finally binds -- in a tab workspace nothing could ever
     reach it. */
  test("both panes are active; anything else is not", () => {
    ws.openDocument(doc("1", "A"));
    ws.openDocument(doc("2", "B"));
    ws.openInSplit(doc("3", "C"));
    expect(states()).toEqual(["1:BACKGROUND", "2:ACTIVE", "3:ACTIVE"]);
  });

  test("a workspace that permits only one active document refuses to split", () => {
    const single = createWorkspace({ session, policy: { platform: { modes: ["TAB", "SPLIT"], limits: { maxActiveDocuments: 1 } } } });
    single.openDocument(doc("1", "A"));
    const result = single.openInSplit(doc("2", "B"));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/one document|maxActive|1/i);
    expect(single.getSplit()).toEqual([]);
  });

  /* SPLIT is a mode like any other, and the web shell removes it. */
  test("refuses when the mode is not permitted, and names the level", () => {
    const web = createWorkspace({ session, policy: { platform: { modes: ["TAB", "SPLIT"] }, shell: { modes: ["TAB"] } } });
    web.openDocument(doc("1", "A"));
    const result = web.openInSplit(doc("2", "B"));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/shell/);
  });

  test("splitting with nothing open just opens it", () => {
    expect(ws.openInSplit(doc("1", "A")).ok).toBe(true);
    expect(ws.getSplit()).toEqual([]);
    expect(ws.getOpenDocuments()).toHaveLength(1);
  });

  test("a third pane is refused while maxSplitPanes is two", () => {
    ws.openDocument(doc("1", "A"));
    ws.openInSplit(doc("2", "B"));
    const third = ws.openInSplit(doc("3", "C"));
    expect(third.ok).toBe(false);
    expect(third.reason).toMatch(/2/);
    expect(entities()).toEqual(["1", "2"]);
  });

  /* Splitting a record already open moves it into the pane rather than opening
     a second copy of it. */
  test("splitting something already open moves it instead of duplicating", () => {
    ws.openDocument(doc("1", "A"));
    ws.openDocument(doc("2", "B"));
    ws.focusDocument(ws.getOpenDocuments()[0]!.documentId);
    ws.openInSplit(doc("2", "B"));
    expect(ws.getOpenDocuments()).toHaveLength(2);
    expect(entities()).toEqual(["1", "2"]);
  });
});

describe("moveToSplit", () => {
  test("brings an already-open document into the split", () => {
    const a = ws.openDocument(doc("1", "A")).document!;
    const b = ws.openDocument(doc("2", "B")).document!;
    ws.focusDocument(a.documentId);
    expect(ws.moveToSplit(b.documentId, "right").ok).toBe(true);
    expect(entities()).toEqual(["1", "2"]);
  });

  test("a document in the split reports its presentation as SPLIT", () => {
    const a = ws.openDocument(doc("1", "A")).document!;
    ws.openInSplit(doc("2", "B"));
    expect(ws.getDocument(a.documentId)?.presentation).toBe("SPLIT");
  });

  test("and gets an ordinary presentation back when it leaves", () => {
    const a = ws.openDocument(doc("1", "A")).document!;
    ws.openInSplit(doc("2", "B"));
    ws.exitSplit();
    expect(ws.getDocument(a.documentId)?.presentation).not.toBe("SPLIT");
  });
});

describe("living in a split", () => {
  beforeEach(() => {
    ws.openDocument(doc("1", "A"));
    ws.openInSplit(doc("2", "B"));
  });

  test("swapping reverses the panes and keeps the focus where it was", () => {
    const focused = ws.getActiveDocument()?.documentId;
    ws.swapSplit();
    expect(entities()).toEqual(["2", "1"]);
    expect(ws.getActiveDocument()?.documentId).toBe(focused);
  });

  test("focusing the other pane keeps the split", () => {
    const left = ws.getSplit()[0]!;
    ws.focusDocument(left);
    expect(ws.getActiveDocument()?.documentId).toBe(left);
    expect(ws.getSplit()).toHaveLength(2);
  });

  test("opening a new document leaves the split", () => {
    const c = ws.openDocument(doc("3", "C")).document!;
    expect(ws.getSplit()).toEqual([]);
    expect(ws.getActiveDocument()?.documentId).toBe(c.documentId);
  });

  /* Clicking a tab shows that tab. Replacing whichever pane happened to be
     focused would mean the same click does different things depending on
     something the user cannot see.

     This goes through focusDocument, not openDocument. The version that used
     openDocument passed with the rule deleted, because opening already clears
     the split for its own reasons -- a test named after a behaviour it never
     exercised. */
  test("focusing a tab outside the split leaves the split", () => {
    const c = ws.openDocument(doc("3", "C")).document!;
    const a = ws.getOpenDocuments().find((d) => d.entityId === "1")!;
    const b = ws.getOpenDocuments().find((d) => d.entityId === "2")!;
    ws.focusDocument(a.documentId);
    ws.moveToSplit(b.documentId, "right");
    expect(ws.getSplit()).toHaveLength(2);

    ws.focusDocument(c.documentId);
    expect(ws.getSplit()).toEqual([]);
    expect(ws.getActiveDocument()?.documentId).toBe(c.documentId);
    expect(ws.getDocument(a.documentId)?.state).toBe("BACKGROUND");
  });

  test("exitSplit keeps the focused pane and leaves the other open", () => {
    ws.exitSplit();
    expect(ws.getSplit()).toEqual([]);
    expect(ws.getOpenDocuments()).toHaveLength(2);
    expect(ws.getActiveDocument()?.entityId).toBe("2");
  });

  test("closing one pane collapses the split onto the other", () => {
    const right = ws.getSplit()[1]!;
    expect(ws.closeDocument(right).ok).toBe(true);
    expect(ws.getSplit()).toEqual([]);
    expect(ws.getOpenDocuments()).toHaveLength(1);
    expect(ws.getActiveDocument()?.entityId).toBe("1");
  });

  test("a dirty pane still asks before closing", () => {
    const right = ws.getSplit()[1]!;
    ws.markDirty(right);
    expect(ws.closeDocument(right).ok).toBe(false);
    expect(ws.getSplit()).toHaveLength(2);
  });

  test("closing everything leaves no split behind", () => {
    ws.closeAll({ includeUnclosable: true });
    expect(ws.getSplit()).toEqual([]);
    expect(ws.getActiveDocument()).toBeNull();
  });

  test("a tenant switch clears the split with the documents", () => {
    ws.switchTenant("T2");
    expect(ws.getSplit()).toEqual([]);
  });

  /* The split is an arrangement React has to see change. */
  test("split changes move the snapshot", () => {
    let changes = 0;
    ws.subscribeToChanges(() => { changes += 1; });
    ws.swapSplit();
    expect(changes).toBe(1);
    ws.exitSplit();
    expect(changes).toBe(2);
  });
});

/* What a shortcut and a menu item both mean by "split": show me this one next
   to what I was just looking at. */
describe("splitWithPrevious", () => {
  test("splits the focused document against the one used before it", () => {
    ws.openDocument(doc("1", "A"));
    ws.openDocument(doc("2", "B"));
    ws.openDocument(doc("3", "C"));
    expect(ws.splitWithPrevious().ok).toBe(true);
    expect(entities()).toEqual(["2", "3"]);
    expect(ws.getActiveDocument()?.entityId).toBe("3");
  });

  /* Three opens land inside one millisecond, so an ISO timestamp cannot order
     them. This failed against a sort by lastActivatedAt and picked the first
     document rather than the second. */
  test("orders by use even when every timestamp is identical", () => {
    ws.openDocument(doc("1", "A"));
    ws.openDocument(doc("2", "B"));
    ws.openDocument(doc("3", "C"));
    const stamps = new Set(ws.getOpenDocuments().map((d) => d.lastActivatedAt));
    expect(stamps.size).toBeLessThanOrEqual(2);
    ws.splitWithPrevious();
    expect(entities()).toEqual(["2", "3"]);
  });

  test("to the left when asked", () => {
    ws.openDocument(doc("1", "A"));
    ws.openDocument(doc("2", "B"));
    ws.splitWithPrevious("left");
    expect(entities()).toEqual(["2", "1"]);
  });

  /* One open document is not a failure, it is a workspace with one thing in it.
     A shortcut pressed there should do nothing, not complain. */
  test("nothing to compare against is quiet, not an error", () => {
    ws.openDocument(doc("1", "A"));
    const result = ws.splitWithPrevious();
    expect(result.ok).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(ws.getSplit()).toEqual([]);
  });

  test("but a policy refusal still explains itself", () => {
    const tabs = createWorkspace({ session, policy: { platform: { modes: ["TAB", "SPLIT"] }, shell: { modes: ["TAB"] } } });
    tabs.openDocument(doc("1", "A"));
    tabs.openDocument(doc("2", "B"));
    expect(tabs.splitWithPrevious().reason).toMatch(/shell/);
  });
});
