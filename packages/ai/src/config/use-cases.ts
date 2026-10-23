/**
 * Host-supplied AI use-case contracts.
 *
 * Use cases are declared by the host and referenced by pages by id. A page says which
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

export interface AiCatalogue {
  readonly useCases: readonly AiUseCase[];
  readonly ids: readonly string[];
  getUseCase(id: string): AiUseCase | undefined;
}
/** Validate retrieval scope before making a host catalogue available. */
export function createAiCatalogue(useCases: readonly AiUseCase[]): AiCatalogue {
  const entries = structuredClone([...useCases]);
  assertNoWildcards(entries);
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  if (byId.size !== entries.length) throw new Error("Duplicate AI use-case id.");
  return {useCases: entries, ids: entries.map(entry => entry.id), getUseCase: id => byId.get(id)};
}
