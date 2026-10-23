import type {DataClassification} from "@pepbits/page-engines/types";
export type AiClassification = (key: string) => DataClassification;

/**
 * Redaction, applied during assembly rather than at dispatch.
 *
 * The ordering is the point. If redaction ran on the way out, the transparency
 * panel would show one thing and the provider would receive another — in the
 * user's favour, but still a panel that does not describe the request. Running
 * it here means the panel renders the redacted value because that IS the value.
 *
 * Two decisions, taken by two different things:
 *
 *   WHETHER to mask — the classification registry, which is also what decides
 *                     whether a key may appear in a URL. One table, so a field
 *                     cannot be PHI to the filter policy and ordinary to this
 *                     one. It was exactly that, until this file started reading
 *                     it: the registry classified `subjectName` as PHI and
 *                     nothing here matched the name, so it reached the provider
 *                     in full — along with the treating clinician and the
 *                     admission date, both of which a clinical use case reads.
 *
 *   HOW to mask     — the shape rules below, matched on the key. They also
 *                     serve as the fallback for a key the registry has never
 *                     heard of, because no table lists every field on every
 *                     future page and waving an unknown one through is the
 *                     wrong default.
 *
 * Clinical content is deliberately NOT masked. A use case that reads a
 * diagnosis exists to reason about the diagnosis; masking it makes the feature
 * pointless while protecting nobody, given that the person it belongs to is
 * masked. It is governed by the clinical gate and its named-record
 * confirmation, and it still may not be written to a URL.
 *
 * Matching is by NAME, never by content. A matcher that redacted by shape would
 * eventually redact a customer name that looks like an account number, and a
 * user who sees their own data mangled stops trusting the panel.
 */

export interface Redaction {
  value: string;
  redacted: boolean;
}

/** Matched against the FIELD KEY, lowercased. Order is not significant. */
const SENSITIVE = [
  { test: /email/, mask: maskEmail },
  { test: /phone|mobile|tel\b/, mask: maskTail },
  { test: /iban|account(number)?$|card/, mask: maskTail },
  { test: /policy|coverage|claim/, mask: maskTail },
  { test: /passport|emirates ?id|nationalid|ssn/, mask: maskAll },
  /* Clinical identifiers. Added with the healthcare module, having checked what
     this list did NOT cover before enabling anything there: a date of birth
     plus a ward and a diagnosis re-identifies a person in a small population,
     which is why dob is masked entirely rather than truncated. */
  { test: /^dob$|birth ?date|date ?of ?birth/, mask: maskAll },
  { test: /\bmrn\b|medical ?record ?(no|number)|patient ?(id|no)/, mask: maskTail },
];

function maskTail(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "••••";
  return `${"•".repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

function maskAll(): string {
  return "••••••••";
}

function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return maskTail(value);
  const name = value.slice(0, at);
  const head = name.slice(0, 1);
  return `${head}${"•".repeat(Math.max(2, name.length - 1))}${value.slice(at)}`;
}

/** The mask a key's shape asks for, or the strongest one if none matches. */
function maskFor(lower: string): (value: string) => string {
  for (const rule of SENSITIVE) {
    if (rule.test.test(lower)) return rule.mask;
  }
  /* No shape recognised the key, but the registry says it identifies someone.
     Remove it entirely rather than guess how much of it is safe to show: a
     name is not a number with a recognisable tail. */
  return maskAll;
}

/** True for the classifications that must never reach a model vendor as typed. */
export function mustRedact(key: string, classificationFor: AiClassification): boolean {
  const classification = classificationFor(key);
  return classification === "phi" || classification === "pii" || classification === "credential";
}

export function redactField(key: string, value: string, classificationFor: AiClassification): Redaction {
  const lower = key.toLowerCase();
  if (mustRedact(key, classificationFor)) return { value: maskFor(lower)(value), redacted: true };

  /* Classified, and classified as something that may travel: operational, or
     clinical content the use case exists to reason about. The classification is
     a decision; a shape rule that also matched would only be a guess. */
  if (classificationFor(key) !== "unclassified") return { value, redacted: false };

  for (const rule of SENSITIVE) {
    if (rule.test.test(lower)) return { value: rule.mask(value), redacted: true };
  }
  return { value, redacted: false };
}
