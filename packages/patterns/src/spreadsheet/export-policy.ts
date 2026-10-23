export type DataClassification = 'operational'|'pii'|'phi'|'clinical'|'credential'|'unclassified';
export interface DataColumn {key:string;label:string;type?:string;classification?:DataClassification}
/**
 * What a worklist may write to a file.
 *
 * The third policy reading the one registry, and its answer differs from the
 * other two because the destination does:
 *
 *   URL     nothing but `operational`, because a query string is copied into
 *           every log between the browser and the application and kept for
 *           months by things that are not the application.
 *   Egress  identifiers masked, clinical content left legible, because a model
 *           vendor needs the diagnosis to answer and never needs the name.
 *   File    almost everything, because a ward list with the names removed is
 *           not a ward list — and the person exporting is already authorised to
 *           read what is on the screen in front of them.
 *
 * So this policy is not mostly about refusing. A file is the one destination
 * the application cannot take back: no retention rule reaches it, no revocation
 * does, and nobody is asked again when it is forwarded. What that warrants is
 * that the user is TOLD what the file will contain and that the export is
 * recorded — the same shape as the transparency panel, for the same reason.
 *
 * Two classes are refused outright:
 *
 *   credential    a token in a spreadsheet is never legitimate.
 *   unclassified  the safe default, as everywhere else. A column nobody
 *                 classified is the one most likely to be new and least likely
 *                 to have been thought about, and a file is a poor place to
 *                 discover it. verify:export-safety fails on one, so the drop
 *                 is a decision rather than a surprise.
 */

/**
 * Never leaves as a document, whoever is asking — file or paper.
 *
 * Exported so the print stylesheet and its verify check read the same list: the
 * CSS rule that keeps these off a printed page is the ONLY control a
 * browser-initiated print respects, because `beforeprint` cannot cancel one.
 */
export const NEVER_IN_A_DOCUMENT: DataClassification[] = ["credential", "unclassified"];
const REFUSED = NEVER_IN_A_DOCUMENT;

/** Written, but said out loud first and recorded afterwards. */
const DECLARED: DataClassification[] = ["phi", "pii", "clinical"];

export interface ExportColumnNote {
  key: string;
  label: string;
  classification: DataClassification;
}

export interface ExportReview {
  /** The columns the file will contain, in the order the table showed them. */
  carried: DataColumn[];
  /** Carried, and worth saying out loud before the file is written. */
  declared: ExportColumnNote[];
  /** Dropped, with the reason, so a missing column can be explained. */
  withheld: ExportColumnNote[];
  /** True when nothing needs saying and the export can just happen. */
  silent: boolean;
}

export function reviewExport(columns: DataColumn[]): ExportReview {
  const carried: DataColumn[] = [];
  const declared: ExportColumnNote[] = [];
  const withheld: ExportColumnNote[] = [];

  for (const column of columns) {
    const classification = column.classification ?? "unclassified";
    const note = { key: column.key, label: column.label, classification };
    if (REFUSED.includes(classification)) { withheld.push(note); continue; }
    carried.push(column);
    if (DECLARED.includes(classification)) declared.push(note);
  }

  /* A withheld column with nothing declared still breaks the silence: the user
     is about to save a file missing a column that is on their screen, and
     finding that out afterwards is worse than being told now. */
  return { carried, declared, withheld, silent: declared.length === 0 && withheld.length === 0 };
}

/** How the data left. Both are documents; only one of them can be recalled. */
export type EgressVia = "file" | "print";

export interface ExportAudit {
  pageId: string;
  via: EgressVia;
  rows: number;
  columns: string[];
  declared: Array<{ key: string; classification: DataClassification }>;
  withheld: string[];
}

/**
 * The audit line, by KEY.
 *
 * Same rule as the search log: "someone exported the prescription queue with
 * the MRN column, 96 rows" is what a review needs, and the MRNs themselves are
 * what it must not keep. Built from the COLUMNS, so there is nowhere in the
 * shape for a value even by accident.
 */
export function exportAudit(pageId: string, review: ExportReview, rows: number, via: EgressVia = "file"): ExportAudit {
  return {
    pageId,
    via,
    rows,
    columns: review.carried.map((column) => column.key),
    declared: review.declared.map(({ key, classification }) => ({ key, classification })),
    withheld: review.withheld.map((note) => note.key),
  };
}
