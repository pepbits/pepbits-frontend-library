import {test,expect} from "vitest";
import {assembleContext,redactField,unredactedFields} from "../test/runtime";
import {USE_CASES,DATA_CLASSIFICATIONS,classificationFor} from "../test/catalog";
/**
 * Nothing that identifies a person reaches a model vendor as typed.
 *
 * The sibling of verify:filter-safety, over the other consumer of the same
 * registry. That one asks "may this appear in a URL"; this one asks "must this
 * be masked before egress", and the realistic failure is the same shape: a use
 * case added next month names a field nobody classified, and an unclassified
 * key is masked — safe, but it silently empties a field the use case needs, and
 * the first person to notice is whoever wonders why the answer is vague.
 *
 * The other half is louder and worse: a GENERAL use case that reads a clinical
 * or identifying key. Those run without the named-record confirmation and under
 * the ordinary retention class, so the gate that is supposed to govern PHI is
 * simply not in the path. That check has nothing to do with redaction and would
 * not be caught by it.
 *
 * Runs the REAL modules through Node's type stripping, so there is no second
 * copy of the rule to drift from the one that ships.
 */

const check=(condition,name)=>test(name,()=>expect(condition).toBe(true));

/**
 * The policy, as data, so the checks are not self-consistent.
 *
 * Reclassify `operatorName` as operational and every assertion below would still
 * be green without this: the code would agree with itself about a treating
 * doctor's name being safe to send. The rule is that the code agrees with the
 * POLICY, and a policy has to be written down separately to be disagreed with.
 */
const POLICY = {
  masked: ["subjectName", "mrn", "dob", "emiratesId", "phone", "email", "memberId", "insuranceId", "operatorName", "admitted", "createdBy"],
  legible: ["primaryDiagnosis", "problem", "complaint", "findings", "ward", "acuity", "diagnosis", "medication", "procedure"],
  untouched: ["status", "id", "owner", "outstanding", "branch"],
};



for (const key of POLICY.masked) {
  const { value, redacted } = redactField(key, "Example Person 784-1984-1234567-1");
  check(redacted && !value.includes("Aisha") && !value.includes("1984"), `${key} is masked`, classificationFor(key));
}
for (const key of [...POLICY.legible, ...POLICY.untouched]) {
  const probe = "Community-acquired pneumonia";
  const { value, redacted } = redactField(key, probe);
  check(!redacted && value === probe, `${key} stays legible`, classificationFor(key));
}



const read = new Map();
for (const useCase of USE_CASES) {
  for (const source of useCase.reads) {
    for (const key of source.fields) {
      if (!read.has(key)) read.set(key, []);
      read.get(key).push(useCase);
    }
  }
}

check(read.size > 0, "the catalogue names some fields", `${read.size} keys across ${USE_CASES.length} use cases`);
for (const key of [...read.keys()].sort()) {
  /* Unclassified is not an error anywhere else -- it is the safe default. It is
     an error HERE, because a key a use case actually reads is one somebody has
     thought about enough to name, and leaving it out of the registry means it
     is masked by accident rather than by decision. */
  check(DATA_CLASSIFICATIONS[key] !== undefined, `${key}`, classificationFor(key));
}



for (const useCase of USE_CASES) {
  if (useCase.category === "clinical") continue;
  const offending = useCase.reads
    .flatMap((source) => source.fields)
    .filter((key) => ["phi", "pii", "clinical"].includes(classificationFor(key)));
  check(offending.length === 0, `${useCase.id}`, offending.join(", "));
}



/* One recognisable value per classification. If any appears in an assembled
   context under a key that should have been masked, the two halves of the rule
   have come apart. */
const PROBES = {
  operational: "OPERATIONAL_PROBE",
  phi: "PHI_PROBE_Example_Reference",
  pii: "PII_PROBE_971507421840",
  clinical: "CLINICAL_PROBE_E11_9",
  credential: "CREDENTIAL_PROBE_sk_live",
  unclassified: "UNCLASSIFIED_PROBE",
};

for (const useCase of USE_CASES) {
  const sources = {};
  for (const source of useCase.reads) {
    const row = Object.fromEntries(source.fields.map((key) => [key, PROBES[classificationFor(key)]]));
    /* page-metrics, worklist-selection and inbox-unread are arrays; the rest are
       objects. Assembly recognises them by shape, so this has to as well. */
    sources[source.source] = ["worklist-selection", "page-metrics", "inbox-unread"].includes(source.source) ? [row] : row;
  }
  const context = assembleContext(useCase, `verify:${useCase.id}`, sources);
  const body = JSON.stringify(context.fields);

  for (const classification of ["phi", "pii", "credential"]) {
    check(!body.includes(PROBES[classification]), `${useCase.id} sends no ${classification} value`);
  }
  check(unredactedFields(context).length === 0, `${useCase.id} passes the dispatch guard`);
}



/* The guard exists for a context that did NOT come from assembly. Proving it
   catches one is the only way to know it is still wired: every check above
   would pass with the guard deleted. */
const handBuilt = {
  useCaseId: "verify",
  pageId: "verify",
  capturedAt: new Date().toISOString(),
  fields: [
    { key: "status", label: "Status", value: "Active", source: "This record" },
    { key: "subjectName", label: "Subject Name", value: PROBES.phi, source: "This record" },
  ],
};
const caught = unredactedFields(handBuilt);
check(caught.includes("subjectName"), "a hand-built context is refused", caught.join(", ") || "NOTHING CAUGHT");
check(!caught.includes("status"), "and an operational field is not");

