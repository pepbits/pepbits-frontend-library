import { describe, expect, test } from "vitest";
import type { AiUseCase } from "@pepbits/ai/config";
import { assembleContext, contextSources } from "../test/runtime";

/**
 * Assembly is where the use case's `reads` list stops being a declaration and
 * starts being an allowlist. Everything here is about what does NOT reach the
 * context: a page hands over whatever it has on screen, and this is the only
 * thing between that and the request body.
 */

const useCase = (reads: AiUseCase["reads"]): AiUseCase => ({
  id: "test.case",
  label: "Test",
  description: "",
  reads,
  promptId: "test.v1",
  category: "general",
});

const record = useCase([{ source: "page-record", fields: ["id", "status"] }]);

describe("assembleContext", () => {
  test("reads only the fields the use case names", () => {
    const context = assembleContext(record, "items-a", {
      "page-record": { id: "C-100", status: "Active", creditLimit: "500000", email: "a@b.com" },
    });
    expect(context.fields.map((field) => field.label)).toEqual(["Id", "Status"]);
  });

  /* The page is trusted to publish, not to limit. A page that offers a whole
     record must not thereby widen the request -- otherwise `reads` documents an
     intention rather than enforcing one. */
  test("a source the use case does not name contributes nothing", () => {
    const context = assembleContext(record, "items-a", {
      "page-record": { id: "C-100", status: "Active" },
      "form-values": { email: "leak@example.com" },
      "worklist-selection": [{ id: "C-200" }],
    });
    expect(JSON.stringify(context)).not.toContain("leak@example.com");
    expect(JSON.stringify(context)).not.toContain("C-200");
  });

  test("carries the use case, the page and when it was captured", () => {
    const context = assembleContext(record, "items-a", { "page-record": { id: "C-100" } });
    expect(context.useCaseId).toBe("test.case");
    expect(context.pageId).toBe("items-a");
    expect(Number.isNaN(Date.parse(context.capturedAt))).toBe(false);
  });

  test("an absent field is omitted rather than sent as a placeholder", () => {
    const context = assembleContext(record, "items-a", { "page-record": { id: "C-100" } });
    expect(context.fields).toHaveLength(1);
    /* Not "Status: unknown". A placeholder is a value the model reasons about,
       and the panel would show a field the page never had. */
    expect(JSON.stringify(context)).not.toMatch(/unknown|null|undefined/i);
  });

  test("an empty string counts as absent", () => {
    const context = assembleContext(record, "items-a", { "page-record": { id: "C-100", status: "" } });
    expect(context.fields).toHaveLength(1);
  });

  test("a source the page never published contributes nothing and does not throw", () => {
    expect(() => assembleContext(record, "items-a", {})).not.toThrow();
    expect(assembleContext(record, "items-a", {}).fields).toEqual([]);
  });

  test("redaction happens here, so the panel shows what will be sent", () => {
    const withEmail = useCase([{ source: "page-record", fields: ["email"] }]);
    const [field] = assembleContext(withEmail, "items-a", {
      "page-record": { email: "aisha.rahman@example.invalid" },
    }).fields;
    expect(field!.redacted).toBe(true);
    expect(field!.value).not.toContain("rahman");
  });

  test("a field that needed no redaction does not carry the flag", () => {
    const [field] = assembleContext(record, "items-a", { "page-record": { id: "C-100" } }).fields;
    expect(field!.redacted).toBeUndefined();
  });

  test("labels are humanised so a user can match them to the screen", () => {
    const camel = useCase([{ source: "page-record", fields: ["creditLimit", "last_invoice"] }]);
    const context = assembleContext(camel, "items-a", {
      "page-record": { creditLimit: "500000", last_invoice: "INV-1" },
    });
    expect(context.fields.map((field) => field.label)).toEqual(["Credit Limit", "Last invoice"]);
  });

  test("values are stringified, so a number or a boolean still reaches the panel", () => {
    const numeric = useCase([{ source: "page-record", fields: ["outstanding", "onHold"] }]);
    const context = assembleContext(numeric, "items-a", {
      "page-record": { outstanding: 41250, onHold: false },
    });
    /* `false` is a value the page is displaying, not an absent field. Dropping
       it would show a record with the flag missing rather than off. */
    expect(context.fields.map((field) => field!.value)).toEqual(["41250", "false"]);
  });

  test("what the user typed is carried, and nothing is invented when they typed nothing", () => {
    const sources = { "page-record": { id: "C-100" } };
    expect(assembleContext(record, "p", sources, "why is this overdue?").userInput).toBe("why is this overdue?");
    expect(assembleContext(record, "p", sources).userInput).toBeUndefined();
  });
});

/**
 * Row sources are recognised by SHAPE. This used to test the source NAME, so
 * the day a second array source was added its rows fell through to the object
 * branch and every field was silently dropped -- an empty context with nothing
 * on the panel to point at.
 */
describe("row sources", () => {
  test("every row contributes, numbered so two rows are distinguishable", () => {
    const rows = useCase([{ source: "worklist-selection", fields: ["id"] }]);
    const context = assembleContext(rows, "worklist", {
      "worklist-selection": [{ id: "C-100" }, { id: "C-200" }],
    });
    expect(context.fields.map((field) => field.label)).toEqual(["Id (row 1)", "Id (row 2)"]);
  });

  test("each array source is counted in its own words", () => {
    const metrics = useCase([{ source: "page-metrics", fields: ["label"] }]);
    const inbox = useCase([{ source: "inbox-unread", fields: ["title"] }]);
    expect(assembleContext(metrics, "p", { "page-metrics": [{ label: "Revenue" }] }).fields[0]!.label).toBe("Label (figure 1)");
    expect(assembleContext(inbox, "p", { "inbox-unread": [{ title: "Approval" }] }).fields[0]!.label).toBe("Title (item 1)");
  });

  test("an array source is handled as rows even though it is not the worklist", () => {
    /* The regression this file exists for: page-metrics is an array, and a name
       comparison sent it down the object branch where `record[key]` reads
       undefined off an array and every field is dropped. */
    const metrics = useCase([{ source: "page-metrics", fields: ["value"] }]);
    const context = assembleContext(metrics, "dashboard", { "page-metrics": [{ value: "41,250" }] });
    expect(context.fields).toHaveLength(1);
  });

  test("rows are redacted like anything else", () => {
    const rows = useCase([{ source: "worklist-selection", fields: ["email"] }]);
    const context = assembleContext(rows, "worklist", {
      "worklist-selection": [{ email: "aisha@example.invalid" }, { email: "omar@example.invalid" }],
    });
    expect(context.fields.every((field) => field!.redacted)).toBe(true);
    expect(JSON.stringify(context)).not.toContain("omar@");
  });

  /* The object branch has its own presence guard and its own test. Rows need
     both: without this, a row missing one of the named fields contributed the
     string "undefined" as a value, and the panel showed a field the page did
     not have. */
  test("a row missing one of the named fields contributes only the ones it has", () => {
    const rows = useCase([{ source: "worklist-selection", fields: ["id", "owner"] }]);
    const context = assembleContext(rows, "worklist", {
      "worklist-selection": [{ id: "C-100" }, { id: "C-200", owner: "" }, { id: "C-300", owner: "Aisha" }],
    });
    expect(context.fields.map((field) => field.label)).toEqual(["Id (row 1)", "Id (row 2)", "Id (row 3)", "Owner (row 3)"]);
    expect(JSON.stringify(context)).not.toContain("undefined");
  });

  test("an empty selection produces no fields rather than an empty row", () => {
    const rows = useCase([{ source: "worklist-selection", fields: ["id"] }]);
    expect(assembleContext(rows, "worklist", { "worklist-selection": [] }).fields).toEqual([]);
  });
});

describe("contextSources", () => {
  test("names each source once, however many fields came from it", () => {
    const both = useCase([
      { source: "page-record", fields: ["id", "status"] },
      { source: "form-values", fields: ["terms"] },
    ]);
    const context = assembleContext(both, "p", {
      "page-record": { id: "C-100", status: "Active" },
      "form-values": { terms: "Net 30" },
    });
    expect(contextSources(context)).toEqual(["This record", "Form values"]);
  });

  test("a source that contributed nothing is not listed", () => {
    const both = useCase([
      { source: "page-record", fields: ["id"] },
      { source: "form-values", fields: ["terms"] },
    ]);
    const context = assembleContext(both, "p", { "page-record": { id: "C-100" } });
    expect(contextSources(context)).toEqual(["This record"]);
  });
});
