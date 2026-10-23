import { describe, expect, test } from "vitest";
import { targetKey } from "@pepbits/platform";
import { documentFromTarget as fromTarget, targetFromDocument } from "./target-document.ts";

import {catalog} from "../test/host";
const documentFromTarget = (target: Parameters<typeof fromTarget>[0]) => fromTarget(target,catalog.pages);

const view = { pageId: "items", mode: "view" as const, recordId: "C-100" };

describe("documentFromTarget", () => {
  /* Both shells already identify a destination by targetKey. The workspace has
     to agree with that exactly, or the same click produces one tab under the
     old rule and a second under the new one. */
  test("two targets that share a targetKey share a document", () => {
    const a = documentFromTarget({ pageId: "items", mode: "view", recordId: "C-100" });
    const b = documentFromTarget({ pageId: "items", mode: "view", recordId: "C-100", title: "Ignore me" });
    expect(a.documentType).toBe(b.documentType);
    expect(a.entityId).toBe(b.entityId);
  });

  test("and two that do not, do not", () => {
    const list = documentFromTarget({ pageId: "items" });
    const record = documentFromTarget(view);
    const edit = documentFromTarget({ ...view, mode: "edit" });
    expect(new Set([list.entityId, record.entityId, edit.entityId]).size).toBe(3);
  });

  test("carries the module from the page registry", () => {
    expect(documentFromTarget({ pageId: "items" }).module).toBe("operations");
  });

  test("titles the tab from the registry when the caller gives none", () => {
    expect(documentFromTarget({ pageId: "items" }).title).toMatch(/item/i);
    expect(documentFromTarget({ pageId: "items", title: "Acme Ltd" }).title).toBe("Acme Ltd");
  });

  test("a record and a mode show in the title", () => {
    expect(documentFromTarget({ pageId: "items", mode: "new" }).title).toMatch(/New/);
    expect(documentFromTarget(view).title).toMatch(/C-100/);
  });

  /* Document keys refuse a colon, and targetKey is built with them. Passing one
     through unescaped would throw on the first record opened. */
  test("survives a target whose parts contain the key separator", () => {
    const doc = documentFromTarget({ pageId: "items", mode: "view", recordId: "C:100" });
    expect(doc.entityId).not.toContain(":");
    expect(() => documentFromTarget({ pageId: "items", recordId: "a:b:c" })).not.toThrow();
  });

  test("round-trips back to the target it came from", () => {
    for (const target of [
      { pageId: "items" },
      { pageId: "items", mode: "view" as const, recordId: "C-100" },
      { pageId: "items", mode: "edit" as const, recordId: "C-100" },
      { pageId: "items", mode: "new" as const },
    ]) {
      expect(targetKey(targetFromDocument(documentFromTarget(target)))).toBe(targetKey(target));
    }
  });

  test("a record id containing the separator round-trips too", () => {
    const target = { pageId: "items", mode: "view" as const, recordId: "C:100" };
    expect(targetFromDocument(documentFromTarget(target)).recordId).toBe("C:100");
  });

  /* encodeURIComponent leaves ~ alone, and ~ is what separates the mode from
     the record. An id containing one would be split in the wrong place and come
     back as a different record. */
  test("a record id containing a tilde round-trips too", () => {
    const target = { pageId: "items", mode: "view" as const, recordId: "C~100" };
    expect(targetFromDocument(documentFromTarget(target)).recordId).toBe("C~100");
  });
});

test('Host views keep separate MDI identities and survive restored documents',()=>{
 const reviewer={pageId:'items',moduleId:'operations-review',recordId:'/quizzes/qz-1?copy=a~module~b'};
 const editor={...reviewer,moduleId:'operations-edit'};
 const reviewerDoc=documentFromTarget(reviewer),editorDoc=documentFromTarget(editor);
 expect(reviewerDoc.entityId).not.toBe(editorDoc.entityId);
 expect(reviewerDoc.module).toBe(reviewer.moduleId);
 expect(targetFromDocument(reviewerDoc)).toEqual(reviewer);
 expect(targetKey(reviewer)).not.toBe(targetKey(editor));
 expect(targetFromDocument(documentFromTarget({pageId:'items',recordId:'a~module~b'}))).toEqual({pageId:'items',recordId:'a~module~b'});
});
