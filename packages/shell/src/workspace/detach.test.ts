import { beforeEach, describe, expect, test } from "vitest";
import { createWorkspace, windowTitleFor } from "./document-manager.ts";
import type { Workspace } from "./document-manager.ts";

const session = { tenantId: "T1", userId: "user-x" };
const doc = (entityId: string, title: string) => ({ module: "OPERATIONS", documentType: "INTERACTION", entityId, title, subjectId: "100" });

const make = (over: Record<string, unknown> = {}) =>
  createWorkspace({ session, policy: { platform: { modes: ["TAB", "SPLIT", "WINDOW"], allowDetach: true, ...over } } });

let ws: Workspace;
beforeEach(() => { ws = make(); });

describe("detaching", () => {
  test("the document stays open, in a window of its own", () => {
    const a = ws.openDocument(doc("1", "Alex Example")).document!;
    expect(ws.detachDocument(a.documentId).ok).toBe(true);
    expect(ws.getOpenDocuments()).toHaveLength(1);
    expect(ws.getDocument(a.documentId)?.presentation).toBe("WINDOW");
    expect(ws.getDetached()).toEqual([a.documentId]);
  });

  /* It is live in another window, so this one must not draw it and must not
     release it either. Suspending a detached document would tear down a screen
     the user is looking at on their other monitor. */
  test("it is neither on screen here nor suspended", () => {
    const a = ws.openDocument(doc("1", "Alex Example")).document!;
    ws.openDocument(doc("2", "Sam Example"));
    ws.detachDocument(a.documentId);
    expect(ws.getDocument(a.documentId)?.state).toBe("BACKGROUND");
    expect(ws.getActiveDocument()?.entityId).toBe("2");
  });

  test("detaching the focused document hands focus to what is left", () => {
    ws.openDocument(doc("1", "Alex Example"));
    const b = ws.openDocument(doc("2", "Sam Example")).document!;
    ws.detachDocument(b.documentId);
    expect(ws.getActiveDocument()?.entityId).toBe("1");
  });

  test("a detached pane leaves the split", () => {
    ws.openDocument(doc("1", "Alex Example"));
    const b = ws.openInSplit(doc("2", "Sam Example")).document!;
    ws.detachDocument(b.documentId);
    expect(ws.getSplit()).toEqual([]);
  });

  /* allowDetach has been resolved by the policy since Phase 1 and read by
     nothing. This is where it starts deciding something. */
  test("refuses when policy does not allow detaching", () => {
    const fixed = make({ allowDetach: false });
    const a = fixed.openDocument(doc("1", "Alex Example")).document!;
    const result = fixed.detachDocument(a.documentId);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/detach/i);
    expect(fixed.getDetached()).toEqual([]);
  });

  test("refuses when WINDOW is not a permitted mode, and names the level", () => {
    const web = createWorkspace({ session, policy: { platform: { modes: ["TAB", "WINDOW"], allowDetach: true }, shell: { modes: ["TAB"] } } });
    const a = web.openDocument(doc("1", "Alex Example")).document!;
    expect(web.detachDocument(a.documentId).reason).toMatch(/shell/);
  });

  test("refuses past maxDetachedWindows", () => {
    const two = createWorkspace({ session, policy: { platform: { modes: ["TAB", "WINDOW"], allowDetach: true, limits: { maxDetachedWindows: 1 } } } });
    const a = two.openDocument(doc("1", "A")).document!;
    const b = two.openDocument(doc("2", "B")).document!;
    expect(two.detachDocument(a.documentId).ok).toBe(true);
    const second = two.detachDocument(b.documentId);
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/1/);
  });

  test("detaching one already detached changes nothing", () => {
    const a = ws.openDocument(doc("1", "A")).document!;
    ws.detachDocument(a.documentId);
    expect(ws.detachDocument(a.documentId).ok).toBe(true);
    expect(ws.getDetached()).toEqual([a.documentId]);
  });
});

describe("coming back", () => {
  test("attaching brings it home and focuses it", () => {
    const a = ws.openDocument(doc("1", "Alex Example")).document!;
    ws.openDocument(doc("2", "Sam Example"));
    ws.detachDocument(a.documentId);
    expect(ws.attachDocument(a.documentId).ok).toBe(true);
    expect(ws.getDetached()).toEqual([]);
    expect(ws.getActiveDocument()?.documentId).toBe(a.documentId);
    expect(ws.getDocument(a.documentId)?.presentation).not.toBe("WINDOW");
  });

  test("closing a detached document removes it from both", () => {
    const a = ws.openDocument(doc("1", "A")).document!;
    ws.openDocument(doc("2", "B"));
    ws.detachDocument(a.documentId);
    expect(ws.closeDocument(a.documentId).ok).toBe(true);
    expect(ws.getDetached()).toEqual([]);
    expect(ws.getOpenDocuments()).toHaveLength(1);
  });

  /* Whatever is on the other monitor belongs to the tenant that was open when
     it was detached. */
  test("a tenant switch clears the detached list too", () => {
    const a = ws.openDocument(doc("1", "A")).document!;
    ws.detachDocument(a.documentId);
    ws.switchTenant("T2");
    expect(ws.getDetached()).toEqual([]);
  });

  test("detaching moves the snapshot so the shell can open the window", () => {
    const a = ws.openDocument(doc("1", "A")).document!;
    let changes = 0;
    ws.subscribeToChanges(() => { changes += 1; });
    ws.detachDocument(a.documentId);
    expect(changes).toBe(1);
    ws.attachDocument(a.documentId);
    expect(changes).toBe(2);
  });
});

/* §17.6: window titles reach the OS taskbar, the window switcher, screen
   recordings and preview thumbnails — none of which anyone thinks of as part
   of the application, and all of which outlive the session. */
describe("windowTitleFor", () => {
  test("never carries the subject's name", () => {
    const document = { documentType: "INTERACTION", entityId: "5001", title: "Alex Example — follow-up" };
    const title = windowTitleFor(document);
    expect(title).not.toMatch(/Alex/);
    expect(title).not.toMatch(/Example/);
    expect(title).not.toMatch(/follow-up/);
  });

  test("says enough to tell two windows apart", () => {
    const a = windowTitleFor({ documentType: "INTERACTION", entityId: "5001", title: "Alex Example" });
    const b = windowTitleFor({ documentType: "INTERACTION", entityId: "5002", title: "Sam Example" });
    expect(a).not.toBe(b);
    expect(a).toMatch(/5001/);
    expect(a).toMatch(/INTERACTION/i);
  });
});
