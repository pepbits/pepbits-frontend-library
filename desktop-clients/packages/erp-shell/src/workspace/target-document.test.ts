import { describe, expect, test } from "vitest";
import { targetKey } from "@pepbits/platform-ports";
import { documentFromTarget, targetFromDocument } from "./target-document.ts";

const view = { pageId: "customer-master", mode: "view" as const, recordId: "C-100" };

describe("documentFromTarget", () => {
  /* Both shells already identify a destination by targetKey. The workspace has
     to agree with that exactly, or the same click produces one tab under the
     old rule and a second under the new one. */
  test("two targets that share a targetKey share a document", () => {
    const a = documentFromTarget({ pageId: "customer-master", mode: "view", recordId: "C-100" });
    const b = documentFromTarget({ pageId: "customer-master", mode: "view", recordId: "C-100", title: "Ignore me" });
    expect(a.documentType).toBe(b.documentType);
    expect(a.entityId).toBe(b.entityId);
  });

  test("and two that do not, do not", () => {
    const list = documentFromTarget({ pageId: "customer-master" });
    const record = documentFromTarget(view);
    const edit = documentFromTarget({ ...view, mode: "edit" });
    expect(new Set([list.entityId, record.entityId, edit.entityId]).size).toBe(3);
  });

  test("carries the module from the page registry", () => {
    expect(documentFromTarget({ pageId: "customer-master" }).module).toBe("finance");
  });

  test("titles the tab from the registry when the caller gives none", () => {
    expect(documentFromTarget({ pageId: "customer-master" }).title).toMatch(/customer/i);
    expect(documentFromTarget({ pageId: "customer-master", title: "Acme Ltd" }).title).toBe("Acme Ltd");
  });

  test("a record and a mode show in the title", () => {
    expect(documentFromTarget({ pageId: "customer-master", mode: "new" }).title).toMatch(/New/);
    expect(documentFromTarget(view).title).toMatch(/C-100/);
  });

  /* Document keys refuse a colon, and targetKey is built with them. Passing one
     through unescaped would throw on the first record opened. */
  test("survives a target whose parts contain the key separator", () => {
    const doc = documentFromTarget({ pageId: "customer-master", mode: "view", recordId: "C:100" });
    expect(doc.entityId).not.toContain(":");
    expect(() => documentFromTarget({ pageId: "customer-master", recordId: "a:b:c" })).not.toThrow();
  });

  test("round-trips back to the target it came from", () => {
    for (const target of [
      { pageId: "customer-master" },
      { pageId: "customer-master", mode: "view" as const, recordId: "C-100" },
      { pageId: "customer-master", mode: "edit" as const, recordId: "C-100" },
      { pageId: "customer-master", mode: "new" as const },
    ]) {
      expect(targetKey(targetFromDocument(documentFromTarget(target)))).toBe(targetKey(target));
    }
  });

  test("a record id containing the separator round-trips too", () => {
    const target = { pageId: "customer-master", mode: "view" as const, recordId: "C:100" };
    expect(targetFromDocument(documentFromTarget(target)).recordId).toBe("C:100");
  });

  /* encodeURIComponent leaves ~ alone, and ~ is what separates the mode from
     the record. An id containing one would be split in the wrong place and come
     back as a different record. */
  test("a record id containing a tilde round-trips too", () => {
    const target = { pageId: "customer-master", mode: "view" as const, recordId: "C~100" };
    expect(targetFromDocument(documentFromTarget(target)).recordId).toBe("C~100");
  });
});

test('School views keep separate MDI identities and survive restored documents',()=>{
 const student={pageId:'reference-school-quizzes',moduleId:'reference-school-student',recordId:'/quizzes/qz-1?copy=a~module~b'};
 const teacher={...student,moduleId:'reference-school-teacher'};
 const studentDoc=documentFromTarget(student),teacherDoc=documentFromTarget(teacher);
 expect(studentDoc.entityId).not.toBe(teacherDoc.entityId);
 expect(studentDoc.module).toBe(student.moduleId);
 expect(targetFromDocument(studentDoc)).toEqual(student);
 expect(targetKey(student)).not.toBe(targetKey(teacher));
 expect(targetFromDocument(documentFromTarget({pageId:'customer-master',recordId:'a~module~b'}))).toEqual({pageId:'customer-master',recordId:'a~module~b'});
});
