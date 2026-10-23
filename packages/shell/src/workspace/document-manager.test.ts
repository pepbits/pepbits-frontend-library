import { beforeEach, describe, expect, test, vi } from "vitest";
import { createWorkspace } from "./document-manager.ts";
import type { Workspace } from "./document-manager.ts";

const session = { tenantId: "T1", userId: "user-x", roleId: "operationsian", branchId: "AD01" };

const subject = (entityId: string, title: string) => ({
  module: "OPERATIONS", documentType: "SUBJECT", entityId, title, subjectId: entityId,
});

/* The spread carries `session` already. Writing `{ session, ...overrides }`
   typechecks as an error rather than a subtle one -- the later key silently
   wins, which is how an Authorization header got dropped elsewhere in this
   repo and made an auth test pass while writing nothing. */
function make(overrides: Parameters<typeof createWorkspace>[0] = { session }): Workspace {
  return createWorkspace(overrides);
}

let ws: Workspace;
beforeEach(() => {
  ws = make({ session, policy: { platform: { modes: ["SINGLE", "TAB", "SPLIT", "WINDOW"], allowDetach: true } } });
});

describe("opening", () => {
  test("an opened document is active and listed", () => {
    const result = ws.openDocument(subject("100", "Alex Example"));
    expect(result.ok).toBe(true);
    expect(ws.getOpenDocuments()).toHaveLength(1);
    expect(ws.getActiveDocument()?.title).toBe("Alex Example");
    expect(ws.getActiveDocument()?.state).toBe("ACTIVE");
  });

  /* The duplicate guard. Opening a record already on screen focuses it; a
     second copy would let the same interaction be edited in two places with two
     different unsaved drafts. */
  test("opening the same record again focuses it instead of duplicating", () => {
    const first = ws.openDocument(subject("100", "Alex Example"));
    ws.openDocument(subject("200", "Sam Example"));
    const again = ws.openDocument(subject("100", "Alex Example"));
    expect(ws.getOpenDocuments()).toHaveLength(2);
    expect(again.reused).toBe(true);
    expect(again.document?.documentId).toBe(first.document?.documentId);
    expect(ws.getActiveDocument()?.documentId).toBe(first.document?.documentId);
  });

  /* One subject, several documents — the case that makes subject-id keying wrong. */
  test("different document types for one subject are separate documents", () => {
    ws.openDocument({ module: "OPERATIONS", documentType: "SUBJECT", entityId: "100", title: "Alex Example", subjectId: "100" });
    ws.openDocument({ module: "OPERATIONS", documentType: "INTERACTION", entityId: "5001", title: "Interaction", subjectId: "100" });
    ws.openDocument({ module: "OPERATIONS", documentType: "INTERACTION", entityId: "5002", title: "Interaction", subjectId: "100" });
    expect(ws.getOpenDocuments()).toHaveLength(3);
  });

  test("isAlreadyOpen answers without opening anything", () => {
    expect(ws.isAlreadyOpen({ documentType: "SUBJECT", entityId: "100" })).toBe(false);
    ws.openDocument(subject("100", "Alex Example"));
    expect(ws.isAlreadyOpen({ documentType: "SUBJECT", entityId: "100" })).toBe(true);
    expect(ws.getOpenDocuments()).toHaveLength(1);
  });
});

describe("presentation is chosen by policy", () => {
  test("an explicitly requested mode that policy forbids is refused, with the level named", () => {
    const web = make({ session, policy: { platform: { modes: ["SINGLE", "TAB", "SPLIT", "WINDOW"] }, shell: { modes: ["SINGLE", "TAB", "SPLIT"] } } });
    const result = web.openDocument({ ...subject("100", "Alex Example"), presentation: "WINDOW" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/WINDOW/);
    expect(result.reason).toMatch(/shell/);
    expect(web.getOpenDocuments()).toHaveLength(0);
  });

  test("with no mode requested it uses the first permitted one", () => {
    const web = make({ session, policy: { platform: { modes: ["TAB", "SPLIT"] } } });
    expect(web.openDocument(subject("100", "Alex Example")).document?.presentation).toBe("TAB");
  });

  /* An unconfigured workspace permits nothing, and that has to surface as a
     refusal a human can act on rather than a blank screen. */
  test("a workspace with no permitted mode refuses and says so", () => {
    const result = make({ session }).openDocument(subject("100", "Alex Example"));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no presentation mode/i);
  });
});

describe("limits", () => {
  test("refuses past maxOpenDocuments and names the limit", () => {
    const small = make({ session, policy: { platform: { modes: ["TAB"], limits: { maxOpenDocuments: 2 } } } });
    small.openDocument(subject("1", "A"));
    small.openDocument(subject("2", "B"));
    const third = small.openDocument(subject("3", "C"));
    expect(third.ok).toBe(false);
    expect(third.reason).toMatch(/2/);
    expect(small.getOpenDocuments()).toHaveLength(2);
  });

  /* The limit must not block reaching something already open, or a full
     workspace becomes one you cannot navigate. */
  test("at the limit, reopening something already open still focuses it", () => {
    const small = make({ session, policy: { platform: { modes: ["TAB"], limits: { maxOpenDocuments: 2 } } } });
    const first = small.openDocument(subject("1", "A"));
    small.openDocument(subject("2", "B"));
    const again = small.openDocument(subject("1", "A"));
    expect(again.ok).toBe(true);
    expect(again.document?.documentId).toBe(first.document?.documentId);
  });

  /* Fifteen open documents must not behave as fifteen live applications. In a
     tab workspace exactly one document is visible, so exactly one is ACTIVE and
     the rest keep their state without paying for liveness. maxActiveDocuments
     is the ceiling that starts binding when split panes arrive in Phase 3;
     enforcing it now would be enforcing a limit nothing can reach. */
  test("focusing a document backgrounds the others", () => {
    const w = make({ session, policy: { platform: { modes: ["TAB"] } } });
    w.openDocument(subject("1", "A"));
    w.openDocument(subject("2", "B"));
    w.openDocument(subject("3", "C"));
    const byState = w.getOpenDocuments().map((d) => `${d.entityId}:${d.state}`);
    expect(byState).toEqual(["1:BACKGROUND", "2:BACKGROUND", "3:ACTIVE"]);
  });
});

describe("dirty state", () => {
  test("belongs to the document, not the workspace", () => {
    const a = ws.openDocument(subject("1", "A")).document!;
    const b = ws.openDocument(subject("2", "B")).document!;
    ws.markDirty(a.documentId);
    expect(ws.getDocument(a.documentId)?.dirty).toBe(true);
    expect(ws.getDocument(b.documentId)?.dirty).toBe(false);
  });

  /* Closing a document with unsaved work has to be refused rather than
     confirmed by the caller after the fact -- by then the state is gone. */
  test("closing a dirty document is refused until the caller says discard", () => {
    const a = ws.openDocument(subject("1", "A")).document!;
    ws.markDirty(a.documentId);
    const refused = ws.closeDocument(a.documentId);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toMatch(/unsaved/i);
    expect(ws.getOpenDocuments()).toHaveLength(1);
    expect(ws.closeDocument(a.documentId, { discardChanges: true }).ok).toBe(true);
    expect(ws.getOpenDocuments()).toHaveLength(0);
  });

  test("markClean lets it close normally", () => {
    const a = ws.openDocument(subject("1", "A")).document!;
    ws.markDirty(a.documentId);
    ws.markClean(a.documentId);
    expect(ws.closeDocument(a.documentId).ok).toBe(true);
  });

  test("closeAll reports which documents are dirty rather than closing them", () => {
    const a = ws.openDocument(subject("1", "A")).document!;
    ws.openDocument(subject("2", "B"));
    ws.markDirty(a.documentId);
    const result = ws.closeAll();
    expect(result.ok).toBe(false);
    expect(result.dirtyDocumentIds).toEqual([a.documentId]);
    expect(ws.getOpenDocuments()).toHaveLength(2);
    expect(ws.closeAll({ discardChanges: true }).ok).toBe(true);
    expect(ws.getOpenDocuments()).toHaveLength(0);
  });

  test("closeOthers keeps the one named", () => {
    ws.openDocument(subject("1", "A"));
    const keep = ws.openDocument(subject("2", "B")).document!;
    ws.openDocument(subject("3", "C"));
    expect(ws.closeOthers(keep.documentId).ok).toBe(true);
    expect(ws.getOpenDocuments().map((d) => d.entityId)).toEqual(["2"]);
  });
});

describe("lifecycle", () => {
  test("suspending releases it; resuming requires revalidation", () => {
    const a = ws.openDocument(subject("1", "A")).document!;
    ws.openDocument(subject("2", "B"));
    ws.suspendDocument(a.documentId);
    expect(ws.getDocument(a.documentId)?.state).toBe("SUSPENDED");
    const resumed = ws.resumeDocument(a.documentId);
    expect(resumed.revalidationRequired).toBe(true);
    expect(ws.getDocument(a.documentId)?.state).toBe("ACTIVE");
  });

  /* Permissions change while a record sits open, so coming back from suspended
     is not a UI transition -- it is a point where authorisation is asked again. */
  test("a document that fails revalidation is closed, not shown", () => {
    const a = ws.openDocument(subject("1", "A")).document!;
    ws.suspendDocument(a.documentId);
    const result = ws.resumeDocument(a.documentId, { authorised: false });
    expect(result.ok).toBe(false);
    expect(ws.getOpenDocuments()).toHaveLength(0);
  });
});

describe("security context", () => {
  /* No global "current subject". With two subjects open, one shared mutable
     variable is a wrong-subject action waiting for a race. */
  test("each document carries its own subject", () => {
    const a = ws.openDocument(subject("100", "Alex Example")).document!;
    const b = ws.openDocument(subject("200", "Sam Example")).document!;
    expect(a.security.subjectId).toBe("100");
    expect(b.security.subjectId).toBe("200");
    expect(a.security.documentId).toBe(a.documentId);
    expect(ws.getDocument(a.documentId)?.security.subjectId).toBe("100");
  });

  test("the session's tenant and user are stamped on every document", () => {
    const a = ws.openDocument(subject("100", "Alex Example")).document!;
    expect(a.security.tenantId).toBe("T1");
    expect(a.security.userId).toBe("user-x");
    expect(a.security.branchId).toBe("AD01");
  });

  /* A document from another tenant must never remain visible after a switch. */
  test("switching tenant clears everything", () => {
    ws.openDocument(subject("100", "Alex Example"));
    ws.openDocument(subject("200", "Sam Example"));
    ws.switchTenant("T2");
    expect(ws.getOpenDocuments()).toHaveLength(0);
    expect(ws.getActiveDocument()).toBeNull();
  });

  test("a dirty document does not keep another tenant's data on screen", () => {
    const a = ws.openDocument(subject("100", "Alex Example")).document!;
    ws.markDirty(a.documentId);
    ws.switchTenant("T2");
    expect(ws.getOpenDocuments()).toHaveLength(0);
  });

  test("logout clears the workspace the same way", () => {
    ws.openDocument(subject("100", "Alex Example"));
    ws.logout();
    expect(ws.getOpenDocuments()).toHaveLength(0);
  });
});

describe("restore metadata", () => {
  /* Titles are the subject's name. They must not reach localStorage, a desktop
     file, a window title or an OS thumbnail. Restore carries keys, not people. */
  test("carries no titles or names", () => {
    ws.openDocument(subject("100", "Alex Example"));
    ws.openDocument({ module: "OPERATIONS", documentType: "INTERACTION", entityId: "5001", title: "Alex Example — follow-up", subjectId: "100" });
    const blob = JSON.stringify(ws.restoreMetadata());
    expect(blob).not.toMatch(/Alex/);
    expect(blob).not.toMatch(/Example/);
    expect(blob).not.toMatch(/follow-up/);
    expect(blob).toMatch(/INTERACTION/);
  });

  /* Restoring must rebind to the live session, not trust what was written. */
  test("refuses entries belonging to another tenant or user", () => {
    ws.openDocument(subject("100", "Alex Example"));
    const saved = ws.restoreMetadata();

    const other = createWorkspace({ session: { ...session, tenantId: "T2" }, policy: { platform: { modes: ["TAB"] } } });
    expect(other.restore(saved).restored).toBe(0);
    expect(other.getOpenDocuments()).toHaveLength(0);

    const otherUser = createWorkspace({ session: { ...session, userId: "nurse-y" }, policy: { platform: { modes: ["TAB"] } } });
    expect(otherUser.restore(saved).restored).toBe(0);
  });

  test("restores this user's own documents, and asks for authorisation on each", () => {
    ws.openDocument(subject("100", "Alex Example"));
    ws.openDocument(subject("200", "Sam Example"));
    const saved = ws.restoreMetadata();

    const fresh = createWorkspace({ session, policy: { platform: { modes: ["TAB"] } } });
    const authorise = vi.fn().mockReturnValue(true);
    expect(fresh.restore(saved, { authorise }).restored).toBe(2);
    expect(authorise).toHaveBeenCalledTimes(2);
    expect(fresh.getOpenDocuments()).toHaveLength(2);
  });

  test("a document the user may no longer see is not restored", () => {
    ws.openDocument(subject("100", "Alex Example"));
    ws.openDocument(subject("200", "Sam Example"));
    const saved = ws.restoreMetadata();
    const fresh = createWorkspace({ session, policy: { platform: { modes: ["TAB"] } } });
    const authorise = (entry: { entityId: string }) => entry.entityId !== "200";
    expect(fresh.restore(saved, { authorise }).restored).toBe(1);
    expect(fresh.getOpenDocuments().map((d) => d.entityId)).toEqual(["100"]);
  });

  /* Restored documents come back suspended: they have no data yet, and mounting
     five live screens on login is the performance problem this design avoids. */
  test("restored documents come back suspended", () => {
    ws.openDocument(subject("100", "Alex Example"));
    const fresh = createWorkspace({ session, policy: { platform: { modes: ["TAB"] } } });
    fresh.restore(ws.restoreMetadata());
    expect(fresh.getOpenDocuments()[0]!.state).toBe("SUSPENDED");
  });
});

describe("events", () => {
  test("opening, focusing and closing are reported with their context", () => {
    const seen: string[] = [];
    ws.subscribe((event) => seen.push(`${event.type}:${event.document.entityId}`));
    const a = ws.openDocument(subject("100", "Alex Example")).document!;
    ws.openDocument(subject("200", "Sam Example"));
    ws.focusDocument(a.documentId);
    ws.closeDocument(a.documentId);
    expect(seen).toEqual(["open:100", "open:200", "focus:100", "close:100"]);
  });

  /* "Do not generate useless audit noise for every mouse move or focus switch."
     Focusing what is already focused is not an access event. */
  test("focusing the already-active document reports nothing", () => {
    const a = ws.openDocument(subject("100", "Alex Example")).document!;
    const seen: string[] = [];
    ws.subscribe((event) => seen.push(event.type));
    ws.focusDocument(a.documentId);
    expect(seen).toEqual([]);
  });

  test("an event carries the security context an audit record needs", () => {
    let captured: { tenantId: string; userId: string; subjectId?: string } | undefined;
    ws.subscribe((event) => { captured = event.document.security; });
    ws.openDocument(subject("100", "Alex Example"));
    expect(captured).toMatchObject({ tenantId: "T1", userId: "user-x", subjectId: "100" });
  });

  test("unsubscribing stops the events", () => {
    const seen: string[] = [];
    const stop = ws.subscribe((event) => seen.push(event.type));
    ws.openDocument(subject("1", "A"));
    stop();
    ws.openDocument(subject("2", "B"));
    expect(seen).toEqual(["open"]);
  });
});

/* React reads this store through useSyncExternalStore, which compares snapshots
   by identity. A getter that builds a fresh array every call is an infinite
   render loop, and a document mutated in place is a change React cannot see at
   all -- the tab bar would keep rendering the previous title. Both are
   properties of the store, not of the binding, so they are pinned here. */
describe("snapshots", () => {
  test("the document list keeps its identity while nothing changes", () => {
    ws.openDocument(subject("1", "A"));
    expect(ws.getOpenDocuments()).toBe(ws.getOpenDocuments());
  });

  test("and takes a new one when something does", () => {
    const before = ws.getOpenDocuments();
    ws.openDocument(subject("1", "A"));
    expect(ws.getOpenDocuments()).not.toBe(before);
  });

  test("a changed document is a new object", () => {
    const a = ws.openDocument(subject("1", "A")).document!;
    ws.markDirty(a.documentId);
    expect(ws.getDocument(a.documentId)).not.toBe(a);
    expect(ws.getDocument(a.documentId)?.dirty).toBe(true);
  });

  /* The other half, and the one that matters for a wide tab bar: marking one
     document dirty must not hand every other tab a new object, or all of them
     re-render on every keystroke in one form. */
  test("an untouched document keeps its identity", () => {
    const a = ws.openDocument(subject("1", "A")).document!;
    const b = ws.openDocument(subject("2", "B")).document!;
    const bBefore = ws.getDocument(b.documentId);
    ws.markDirty(a.documentId);
    expect(ws.getDocument(b.documentId)).toBe(bBefore);
  });

  test("a no-op reports no change", () => {
    const a = ws.openDocument(subject("1", "A")).document!;
    const before = ws.getOpenDocuments();
    ws.focusDocument(a.documentId);
    ws.markClean(a.documentId);
    expect(ws.getOpenDocuments()).toBe(before);
  });

  test("subscribers are told when the snapshot moves", () => {
    let changes = 0;
    ws.subscribeToChanges(() => { changes += 1; });
    ws.openDocument(subject("1", "A"));
    expect(changes).toBe(1);
    ws.markDirty(ws.getOpenDocuments()[0]!.documentId);
    expect(changes).toBe(2);
    ws.markClean(ws.getOpenDocuments()[0]!.documentId);
    ws.markClean(ws.getOpenDocuments()[0]!.documentId);
    expect(changes).toBe(3);
  });
});

/* Every shell has a tab that must stay: the module dashboard you return to when
   everything else is closed. Without the concept in the core, each shell filters
   it out of its own close paths and one of them eventually forgets. */
describe("unclosable documents", () => {
  const home = { module: "OPERATIONS", documentType: "DASHBOARD", entityId: "operations", title: "Operations", closable: false };

  test("refuses to close, and says why", () => {
    const doc = ws.openDocument(home).document!;
    const result = ws.closeDocument(doc.documentId);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/cannot be closed/i);
    expect(ws.getOpenDocuments()).toHaveLength(1);
  });

  /* Not a dirty-state question. discardChanges answers "may I lose this work",
     which is a different question from "may this tab go away at all". */
  test("discardChanges does not override it", () => {
    const doc = ws.openDocument(home).document!;
    expect(ws.closeDocument(doc.documentId, { discardChanges: true }).ok).toBe(false);
  });

  test("closeAll and closeOthers leave it alone", () => {
    const doc = ws.openDocument(home).document!;
    ws.openDocument(subject("1", "A"));
    ws.openDocument(subject("2", "B"));
    expect(ws.closeAll().ok).toBe(true);
    expect(ws.getOpenDocuments().map((d) => d.documentId)).toEqual([doc.documentId]);
  });

  test("closeOthers keeps both it and the one named", () => {
    const doc = ws.openDocument(home).document!;
    ws.openDocument(subject("1", "A"));
    const keep = ws.openDocument(subject("2", "B")).document!;
    ws.closeOthers(keep.documentId);
    expect(ws.getOpenDocuments().map((d) => d.documentId).sort()).toEqual([doc.documentId, keep.documentId].sort());
  });

  /* Changing module is not "close all the tabs" -- the module itself is being
     replaced, so its dashboard goes with it. Without this the shell is left
     holding the previous module's fixed tab, stranded in a bar that belongs to
     a module it is no longer part of. */
  test("closeAll can be told to take the fixed tab too", () => {
    ws.openDocument(home);
    ws.openDocument(subject("1", "A"));
    expect(ws.closeAll({ includeUnclosable: true }).ok).toBe(true);
    expect(ws.getOpenDocuments()).toHaveLength(0);
  });

  test("and it still asks about unsaved work first", () => {
    const doc = ws.openDocument(home).document!;
    const a = ws.openDocument(subject("1", "A")).document!;
    ws.markDirty(a.documentId);
    const refused = ws.closeAll({ includeUnclosable: true });
    expect(refused.ok).toBe(false);
    expect(refused.dirtyDocumentIds).toEqual([a.documentId]);
    expect(ws.getOpenDocuments()).toHaveLength(2);
    expect(ws.closeAll({ includeUnclosable: true, discardChanges: true }).ok).toBe(true);
    expect(ws.getDocument(doc.documentId)).toBeNull();
  });

  test("documents are closable unless told otherwise", () => {
    expect(ws.openDocument(subject("1", "A")).document?.closable).toBe(true);
  });
});

/* The shell resolves policy from preferences, and preferences live below the
   point where the workspace is created. Rebuilding the store on every toggle
   would drop every open tab, so the policy is replaceable in place. */
describe("setPolicy", () => {
  test("changes what may be opened next", () => {
    const w = createWorkspace({ session, policy: { platform: { modes: ["TAB"] } } });
    expect(w.openDocument(subject("1", "A")).document?.presentation).toBe("TAB");
    w.setPolicy({ platform: { modes: ["SINGLE"] } });
    expect(w.openDocument(subject("2", "B")).document?.presentation).toBe("SINGLE");
  });

  /* A tab does not change shape under the user because a preference moved. */
  test("leaves what is already open alone", () => {
    const w = createWorkspace({ session, policy: { platform: { modes: ["TAB"] } } });
    const a = w.openDocument(subject("1", "A")).document!;
    w.setPolicy({ platform: { modes: ["SINGLE"] } });
    expect(w.getDocument(a.documentId)?.presentation).toBe("TAB");
  });

  test("a new limit applies from now on", () => {
    const w = createWorkspace({ session, policy: { platform: { modes: ["TAB"] } } });
    w.openDocument(subject("1", "A"));
    w.setPolicy({ platform: { modes: ["TAB"], limits: { maxOpenDocuments: 1 } } });
    expect(w.openDocument(subject("2", "B")).ok).toBe(false);
  });
});
