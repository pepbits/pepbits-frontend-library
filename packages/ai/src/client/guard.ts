import type { AiContext } from "@pepbits/ai/config";
import { mustRedact, type AiClassification } from "./redact.ts";

/**
 * The check on the way out.
 *
 * Redaction runs during assembly, and assembly is the only thing that builds a
 * context today. This is here for the day that stops being true — a second
 * caller, a replayed audit body, a context stitched together by hand. The
 * filter policy is guarded on read AND on write for the same reason: a rule
 * enforced in one place is a rule only until someone adds a second place.
 *
 * It reports rather than repairs. A sensitive field arriving here unmasked
 * means assembly was bypassed, which is a defect; masking it quietly would hide
 * the defect and make the transparency panel a lie, because the panel has
 * already shown the user the unmasked value it was given. Refusing is the only
 * answer that leaves the user's screen and the request agreeing with each other.
 */
export function unredactedFields(context: AiContext, classificationFor: AiClassification): string[] {
  return context.fields.filter((field) => mustRedact(field.key, classificationFor) && !field.redacted).map((field) => field.key);
}
