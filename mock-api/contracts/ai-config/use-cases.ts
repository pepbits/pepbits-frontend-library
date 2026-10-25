/**
 * The AI use-case catalogue.
 *
 * Use cases are declared HERE and referenced by pages by id. A page says which
 * ones it offers; it never defines one. Otherwise the same "summarise" exists
 * in six variants and none of them can be governed, rate-limited or audited as
 * a single thing.
 *
 * See spec §5. The field that matters most is `reads`: retrieval is the leak,
 * not the prompt. A use case that fetches "related records" has widened its own
 * scope without anyone deciding to, so every field it may read is named.
 */

/** Where a field comes from. Each maps to something the page already has. */
export type AiSource =
  | "page-record"
  | "worklist-selection"
  | "form-values"
  /** Figures a page is DISPLAYING rather than records it holds: dashboard KPIs,
      report rows. An array, like worklist-selection, because the interesting
      thing is the set and how the parts compare. Added rather than folded into
      worklist-selection so the transparency panel can say "Figures on this
      page" instead of "Selected rows", which would be a lie on a dashboard. */
  | "page-metrics"
  /** The inbox items that are still unread. A row predicate in the source name,
      exactly like worklist-selection: `reads` names FIELDS and cannot express
      "only the unread ones", so the page decides which rows it is offering and
      the name says which those are. A source called "inbox-items" carrying only
      some of them would be the lie. */
  | "inbox-unread";

export interface AiRead {
  source: AiSource;
  /** Explicit field keys. Wildcards are rejected — see assertNoWildcards. */
  fields: string[];
  /** A field the page may not have. Absent optional fields are simply omitted. */
  optional?: boolean;
}

export interface AiUseCase {
  id: string;
  label: string;
  /** Shown in the transparency panel, so it must describe what is SENT. */
  description: string;
  reads: AiRead[];
  /**
   * Server-side prompt id. The client never holds prompt text: it cannot be
   * read, replayed or edited from a browser, and changing a prompt is a server
   * deployment rather than a client release.
   */
  promptId: string;
  /**
   * Clinical use cases require a second confirmation naming the record, and are
   * audited under the elevated retention class.
   */
  category: "general" | "clinical";
}

export const USE_CASES: AiUseCase[] = [
  {
    id: "worklist.summarise-selection",
    label: "Summarise selection",
    description: "Summarises the records you have selected, using only the columns currently visible.",
    reads: [{ source: "worklist-selection", fields: ["id", "name", "status", "owner", "outstanding", "lastInvoice"] }],
    promptId: "worklist.summarise.v1",
    category: "general",
  },
  {
    id: "record.explain",
    label: "Explain this record",
    description: "Explains the fields on the open record and what its current status means.",
    reads: [{ source: "page-record", fields: ["id", "name", "type", "segment", "status", "risk", "creditLimit", "outstanding"] }],
    promptId: "record.explain.v1",
    category: "general",
  },
  {
    id: "form.draft-note",
    label: "Draft a note",
    description: "Drafts an internal note from the values you have entered. Nothing is saved — the draft lands in the form for you to edit.",
    reads: [{ source: "form-values", fields: ["customer", "reference", "terms", "jurisdiction"], optional: true }],
    promptId: "form.draft-note.v1",
    category: "general",
  },
  {
    id: "dashboard.explain-metrics",
    label: "Explain these figures",
    description: "Reads the headline figures on this dashboard — their values, movement and footnotes — and explains what they say together.",
    reads: [{ source: "page-metrics", fields: ["label", "value", "delta", "note"] }],
    promptId: "dashboard.explain-metrics.v1",
    category: "general",
  },
  {
    id: "report.summarise",
    label: "Summarise this report",
    description: "Reads the rows currently in the report — actual against previous and budget — and summarises where the movement is.",
    /* `trend` is deliberately absent: it is a presentation flag the chart uses
       to pick an arrow, and sending it invites the model to repeat a judgement
       the page already made rather than read the numbers. */
    reads: [{ source: "page-metrics", fields: ["dimension", "current", "previous", "budget", "variance", "contribution"] }],
    promptId: "report.summarise.v1",
    category: "general",
  },
  {
    id: "inbox.summarise-unread",
    label: "Summarise my unread",
    description: "Reads the unread items in this list — their subject, preview and age — and tells you what is waiting and what looks urgent.",
    /* `detail` is left out. The full text of every unread item would trible the
       payload to improve a summary that the subject and preview already
       support, and a transparency panel nobody can skim is one nobody reads. */
    reads: [{ source: "inbox-unread", fields: ["title", "preview", "time", "kind", "role"], optional: true }],
    promptId: "inbox.summarise-unread.v1",
    category: "general",
  },
  /* ---- clinical ---------------------------------------------------------
     The first members of a category that has existed since Task 6 with nothing
     in it. Declaring one turns on machinery already written and never exercised:
     a warning badge in the panel, a second confirmation naming the record before
     Send unlocks, and a flat refusal to surface the use case as an inline button
     -- a one-click affordance over clinical data is the thing you cannot take
     back.

     THE PATIENT'S NAME IS NOT READ BY ANY OF THEM. A clinician summarising a
     record is already looking at who it belongs to; the name adds nothing to the
     answer and everything to the consequences of a leak. What is left is
     minimised to the clinical facts, and `dob` is masked by the redactor on the
     way out. */
  {
    id: "encounter.summarise",
    label: "Summarise this encounter",
    description: "Summarises the clinical picture of this record — ward, diagnosis, length of stay and status. The patient's name is never sent.",
    reads: [{ source: "page-record", fields: ["dob", "ward", "clinician", "primaryDiagnosis", "admitted", "lengthOfStay", "status", "acuity"], optional: true }],
    promptId: "encounter.summarise.v1",
    category: "clinical",
  },
  {
    id: "documentation.gaps",
    label: "Find documentation gaps",
    description: "Names what a record of this kind would normally carry and is missing here. Suggests only — it never writes to the record.",
    reads: [{ source: "page-record", fields: ["ward", "clinician", "primaryDiagnosis", "admitted", "lengthOfStay", "status", "acuity", "payer"], optional: true }],
    promptId: "documentation.gaps.v1",
    category: "clinical",
  },
  {
    id: "cohort.summarise-selection",
    label: "Summarise selected records",
    description: "Summarises the clinical records you have selected as a group — where the load is, and which look urgent. No names are sent.",
    reads: [{ source: "worklist-selection", fields: ["ward", "primaryDiagnosis", "status", "acuity", "lengthOfStay"] }],
    promptId: "cohort.summarise-selection.v1",
    category: "clinical",
  },
  {
    id: "coding.suggest-icd",
    label: "Suggest diagnosis codes",
    description: "Proposes codes from this service's catalogue for the documented problem. It selects from a supplied list and cannot invent a code; nothing is applied until you accept it.",
    /* Structured fields only. The clinician's narrative is deliberately absent:
       free text is where a name, a relative or an employer ends up, and a coding
       suggestion does not need any of it. */
    reads: [{ source: "page-record", fields: ["problem", "specialty", "complaint", "findings", "candidateCodes"], optional: true }],
    promptId: "coding.suggest-icd.v1",
    category: "clinical",
  },
  {
    id: "orders.suggest",
    label: "Suggest orders",
    description: "Proposes orders from this service's orderable catalogue for the documented problem. Selection only, never invention, and nothing is placed until you accept it.",
    reads: [{ source: "page-record", fields: ["problem", "specialty", "complaint", "findings", "candidateOrders"], optional: true }],
    promptId: "orders.suggest.v1",
    category: "clinical",
  },
];

/**
 * A wildcard in `reads` would silently widen every use case that carried it,
 * which is the one failure in this file that has no visible symptom — the
 * assistant simply starts seeing more than it was granted.
 *
 * Thrown at module load rather than checked at dispatch: a bad entry then fails
 * the build, which is where it is cheap, instead of the request, which is where
 * it has already happened.
 */
function assertNoWildcards(useCases: AiUseCase[]): void {
  for (const useCase of useCases) {
    for (const read of useCase.reads) {
      if (read.fields.length === 0) {
        throw new Error(`AiUseCase "${useCase.id}" declares an empty field list for "${read.source}". Name the fields or drop the read.`);
      }
      for (const field of read.fields) {
        if (field === "*" || field.includes("*")) {
          throw new Error(`AiUseCase "${useCase.id}" uses a wildcard field "${field}". Retrieval scope must be named explicitly — see spec D5.`);
        }
      }
    }
  }
}

assertNoWildcards(USE_CASES);

const BY_ID = new Map(USE_CASES.map((useCase) => [useCase.id, useCase]));

export function getUseCase(id: string): AiUseCase | undefined {
  return BY_ID.get(id);
}

/** Ids a page may legally reference. Used to validate PageDefinition.ai. */
export const USE_CASE_IDS: string[] = USE_CASES.map((useCase) => useCase.id);
