import {test,expect} from "vitest";
import {assembleContext,redactField,unredactedFields} from "../test/runtime";
import {USE_CASES,DATA_CLASSIFICATIONS,classificationFor} from "../test/catalog";
/**
 * Context assembly reads ONLY what a use case names, and the transparency panel
 * renders the object that is sent.
 *
 * The second half is structural — the panel takes `context.fields` and has no
 * other source — so what is checkable here is the first: that a field absent
 * from `reads` never reaches the context however much the page hands over, and
 * that removing one from the use case removes it from the payload.
 *
 * Zero dependencies. Node 24 strips types, so these are the real modules.
 */

const pad = (value, width) => String(value).padEnd(width);
const check=(name,condition)=>test(name,()=>expect(condition).toBe(true));

/* A page that hands over far more than the use case asks for. */
const RECORD = {
  id: "CUS-1042", name: "Example Workshop", type: "Corporate", segment: "Retail",
  status: "Active", risk: "Low", creditLimit: 480000, outstanding: 184200,
  contact: "Maya Thomas", email: "maya.thomas@northgate.example", phone: "+971 50 555 0134",
  iban: "AE070331234567890123456", notes: "Internal: renegotiating terms",
};

const useCase = {
  id: "record.explain", label: "Explain this record", description: "...",
  reads: [{ source: "page-record", fields: ["id", "name", "status", "email", "iban", "missingField"] }],
  promptId: "record.explain.v1", category: "general",
};

const context = assembleContext(useCase, "items-a", { "page-record": RECORD });
const labels = context.fields.map((f) => f.label);
const values = JSON.stringify(context);


check("only named fields appear", context.fields.length === 5, `${context.fields.length} fields`);
check("a field the page has but reads omits is absent", !values.includes("Example") ? false : !labels.includes("Segment") && !labels.includes("Notes"));
check("the internal note never reaches the payload", !values.includes("renegotiating"));
check("credit limit was not read", !labels.includes("Credit Limit"));
check("an absent named field is omitted, not sent empty", !labels.includes("Missing Field"));


const email = context.fields.find((f) => f.label === "Email");
const iban = context.fields.find((f) => f.label === "Iban");
check("email is masked in the payload", email?.value !== RECORD.email, email?.value);
check("email is flagged redacted", email?.redacted === true);
check("the raw email is nowhere in the context", !values.includes(RECORD.email));
check("iban is masked", iban?.value !== RECORD.iban, iban?.value);
check("the raw iban is nowhere in the context", !values.includes(RECORD.iban));
check("a non-sensitive field is untouched", context.fields.find((f) => f.label === "Name")?.value === "Example Workshop");
check("redactField leaves ordinary keys alone", redactField("name", "Example").redacted === false);


const narrowed = { ...useCase, reads: [{ source: "page-record", fields: ["id", "name"] }] };
const after = assembleContext(narrowed, "items-a", { "page-record": RECORD });
check("field count drops", after.fields.length === 2, `${context.fields.length} -> ${after.fields.length}`);
check("the removed field is gone", !after.fields.some((f) => f.label === "Email"));
check("its value is gone from the payload too", !JSON.stringify(after).includes(RECORD.email));


const rows = [{ id: "A", name: "One", secretish: "x" }, { id: "B", name: "Two", secretish: "y" }];
const listCase = { ...useCase, reads: [{ source: "worklist-selection", fields: ["id", "name"] }] };
const listContext = assembleContext(listCase, "items-a", { "worklist-selection": rows });
check("one entry per row per named field", listContext.fields.length === 4, `${listContext.fields.length} fields`);
check("rows are labelled so a user can match them", listContext.fields[0].label.includes("row 1"));
check("unnamed row keys never appear", !JSON.stringify(listContext).includes("secretish"));

