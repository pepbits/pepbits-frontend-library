import { describe, expect, test } from "vitest";
import type { AiContext, AiContextField } from "@pepbits/ai/config";
import { unredactedFields } from "../test/runtime";

/**
 * The last check before the request leaves.
 *
 * Redaction happens during assembly, and assembly is the only path that builds
 * a context today. This exists for the day that stops being true: a second
 * caller, a replayed audit body, a context stitched together by hand. Guarding
 * on the way out as well as on the way in is the same shape as the filter
 * policy, which is guarded on read AND on write for the same reason -- a rule
 * enforced in one place is a rule until someone adds a second place.
 *
 * It does not mask. Arriving here unredacted means assembly was bypassed, which
 * is a defect; masking it quietly would hide the defect AND make the panel a
 * lie, since the panel already showed the user the unmasked value.
 */

const field = (over: Partial<AiContextField>): AiContextField => ({
  key: "id",
  label: "Id",
  value: "C-100",
  source: "This record",
  ...over,
});

const context = (fields: AiContextField[]): AiContext => ({
  useCaseId: "record.explain",
  pageId: "items-a",
  capturedAt: "2026-09-06T00:00:00.000Z",
  fields,
});

describe("unredactedFields", () => {
  test("passes a context whose sensitive fields were masked", () => {
    expect(
      unredactedFields(context([
        field({}),
        field({ key: "email", label: "Email", value: "a••••@example.invalid", redacted: true }),
        field({ key: "subjectName", label: "Subject Name", value: "••••••••", redacted: true }),
      ])),
    ).toEqual([]);
  });

  test("passes a context with nothing sensitive in it at all", () => {
    expect(unredactedFields(context([field({}), field({ key: "status", label: "Status", value: "Active" })]))).toEqual([]);
  });

  test("catches a sensitive field that was never masked", () => {
    const found = unredactedFields(context([field({ key: "subjectName", label: "Subject Name", value: "Aisha Rahman" })]));
    expect(found).toEqual(["subjectName"]);
  });

  test("catches every one of them, not just the first", () => {
    expect(
      unredactedFields(context([
        field({ key: "mrn", value: "AV204581" }),
        field({ key: "status", value: "Active" }),
        field({ key: "dob", value: "1984-03-11" }),
      ])),
    ).toEqual(["mrn", "dob"]);
  });

  /* The label is a rendering decision and can say anything. The key is what the
     registry classifies, which is why the field carries one. */
  test("reads the key, not the label", () => {
    expect(unredactedFields(context([field({ key: "mrn", label: "Reference", value: "AV204581" })]))).toEqual(["mrn"]);
    expect(unredactedFields(context([field({ key: "status", label: "Subject Name", value: "Active" })]))).toEqual([]);
  });

  /* Clinical content is meant to be legible: the use case exists to reason
     about it, and masking it protects nobody once the person is masked. */
  test("clinical content is not an offence", () => {
    expect(
      unredactedFields(context([
        field({ key: "primaryDiagnosis", label: "Primary Diagnosis", value: "Community-acquired pneumonia" }),
        field({ key: "ward", label: "Ward", value: "4 West" }),
      ])),
    ).toEqual([]);
  });

  /* A key the registry does not know is not sensitive by default HERE, because
     redaction has already had its say: an unclassified key that matched a shape
     rule arrives flagged, and one that matched nothing was never sensitive.
     Failing closed on every unknown key would refuse every ordinary page. */
  test("an unclassified key is not treated as an offence on its own", () => {
    expect(unredactedFields(context([field({ key: "somethingNew", value: "whatever" })]))).toEqual([]);
  });

  test("a flag on a field that did not need one is not an offence either", () => {
    expect(unredactedFields(context([field({ key: "status", value: "••••", redacted: true })]))).toEqual([]);
  });

  test("an empty context has nothing to refuse", () => {
    expect(unredactedFields(context([]))).toEqual([]);
  });
});
