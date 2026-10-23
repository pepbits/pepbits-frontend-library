import { beforeEach, describe, expect, test } from "vitest";
import { createWorkspace } from "./document-manager.ts";
import type { Workspace } from "./document-manager.ts";

const session = { tenantId: "T1", userId: "user-x" };
const doc = (entityId: string) => ({ module: "OPERATIONS", documentType: "SUBJECT", entityId, title: `P${entityId}` });

const make = (maxWarmDocuments?: number) =>
  createWorkspace({ session, policy: { platform: { modes: ["TAB", "SPLIT"], limits: maxWarmDocuments === undefined ? {} : { maxWarmDocuments } } } });

let ws: Workspace;
beforeEach(() => { ws = make(2); });

const states = () => ws.getOpenDocuments().map((d) => `${d.entityId}:${d.state}`);

describe("warm and cold", () => {
  /* Twelve open documents must not behave as twelve live applications. The
     ones nearby stay warm so switching back is instant; the rest are let go. */
  test("keeps the most recent few warm and suspends the rest", () => {
    for (const id of ["1", "2", "3", "4", "5"]) ws.openDocument(doc(id));
    expect(states()).toEqual(["1:SUSPENDED", "2:SUSPENDED", "3:BACKGROUND", "4:BACKGROUND", "5:ACTIVE"]);
  });

  test("coming back to one warms it and cools the oldest", () => {
    for (const id of ["1", "2", "3", "4"]) ws.openDocument(doc(id));
    const first = ws.getOpenDocuments()[0]!;
    ws.focusDocument(first.documentId);
    expect(states()).toEqual(["1:ACTIVE", "2:SUSPENDED", "3:BACKGROUND", "4:BACKGROUND"]);
  });

  /* Suspending drops what the screen was holding, and what a screen holds is
     the half-typed form nobody saved. A document with unsaved work stays warm
     however long ago it was touched. */
  test("never suspends a document with unsaved changes", () => {
    const a = ws.openDocument(doc("1")).document!;
    ws.markDirty(a.documentId);
    for (const id of ["2", "3", "4", "5"]) ws.openDocument(doc(id));
    expect(ws.getDocument(a.documentId)?.state).toBe("BACKGROUND");
  });

  test("and lets it cool once it is saved", () => {
    const a = ws.openDocument(doc("1")).document!;
    ws.markDirty(a.documentId);
    for (const id of ["2", "3", "4", "5"]) ws.openDocument(doc(id));
    ws.markClean(a.documentId);
    expect(ws.getDocument(a.documentId)?.state).toBe("SUSPENDED");
  });

  test("both panes of a split stay on screen whatever the limit", () => {
    const cold = make(0);
    cold.openDocument(doc("1"));
    cold.openInSplit(doc("2"));
    expect(cold.getOpenDocuments().map((d) => d.state)).toEqual(["ACTIVE", "ACTIVE"]);
  });

  test("a warm limit of zero suspends everything off screen", () => {
    const cold = make(0);
    cold.openDocument(doc("1"));
    cold.openDocument(doc("2"));
    expect(cold.getOpenDocuments().map((d) => `${d.entityId}:${d.state}`)).toEqual(["1:SUSPENDED", "2:ACTIVE"]);
  });

  /* An unset limit must not suspend anything, or every workspace built before
     this existed silently starts dropping screens. */
  test("an unconfigured workspace keeps everything warm", () => {
    const open = make();
    for (const id of ["1", "2", "3", "4", "5", "6"]) open.openDocument(doc(id));
    expect(open.getOpenDocuments().filter((d) => d.state === "SUSPENDED")).toHaveLength(0);
  });
});

describe("coming back", () => {
  test("a suspended document resumes and asks to be revalidated", () => {
    for (const id of ["1", "2", "3", "4"]) ws.openDocument(doc(id));
    const cold = ws.getOpenDocuments()[0]!;
    expect(cold.state).toBe("SUSPENDED");
    const result = ws.resumeDocument(cold.documentId);
    expect(result.revalidationRequired).toBe(true);
    expect(ws.getDocument(cold.documentId)?.state).toBe("ACTIVE");
  });

  /* Permissions change while a record sits open, and a suspended one has been
     sitting longest. */
  test("one the user may no longer see is closed rather than shown", () => {
    for (const id of ["1", "2", "3", "4"]) ws.openDocument(doc(id));
    const cold = ws.getOpenDocuments()[0]!;
    expect(ws.resumeDocument(cold.documentId, { authorised: false }).ok).toBe(false);
    expect(ws.getOpenDocuments()).toHaveLength(3);
  });

  /* Focusing a suspended tab is how a user actually resumes one, and it has to
     go through the same door rather than quietly showing stale content.

     Asserted on the EVENT, not the state. Either path ends with the document
     ACTIVE — it is on screen — so a state check passes with the resume removed
     and proves nothing. What differs is whether the workspace announced a
     resume, which is what an audit trail records and what tells a screen its
     data is older than its authorisation. */
  test("focusing a suspended tab resumes it rather than merely focusing it", () => {
    for (const id of ["1", "2", "3", "4"]) ws.openDocument(doc(id));
    const cold = ws.getOpenDocuments()[0]!;
    expect(cold.state).toBe("SUSPENDED");

    const seen: string[] = [];
    ws.subscribe((event) => seen.push(event.type));
    ws.focusDocument(cold.documentId);
    expect(seen).toEqual(["resume"]);
    expect(ws.getDocument(cold.documentId)?.state).toBe("ACTIVE");
  });

  test("focusing a warm tab is an ordinary focus", () => {
    for (const id of ["1", "2", "3"]) ws.openDocument(doc(id));
    const warm = ws.getOpenDocuments()[1]!;
    expect(warm.state).toBe("BACKGROUND");
    const seen: string[] = [];
    ws.subscribe((event) => seen.push(event.type));
    ws.focusDocument(warm.documentId);
    expect(seen).toEqual(["focus"]);
  });
});
