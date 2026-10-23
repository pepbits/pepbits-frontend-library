/**
 * The identity of an open record.
 *
 * `tenant : documentType : entityId`, and deliberately NOT the subject. One
 * subject legitimately has several documents open at once -- the 360 view, two
 * interactions, a activity log, a orders account -- so keying on the person
 * would collapse them into one and the second click would focus the wrong
 * screen while the duplicate guard reported everything was fine.
 */
export interface DocumentKeyParts {
  tenantId: string;
  documentType: string;
  entityId: string;
}

const SEPARATOR = ":";

/* Tenant isolation is decided here, so the separator cannot appear inside a
   part. Allowing it lets a tenant named "T1:SUBJECT" mint a key that parses as
   tenant "T1" holding a subject called "SUBJECT:<id>" -- one string, two
   readings, and the wrong one grants a document from another tenant. Escaping
   would also work; refusing is smaller and there is no legitimate id with a
   colon in it. */
function part(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Document key: ${name} is empty.`);
  if (trimmed.includes(SEPARATOR)) throw new Error(`Document key: ${name} may not contain the separator "${SEPARATOR}".`);
  return trimmed;
}

/**
 * The document type is upper-cased; the entity id is not.
 *
 * A caller writing "subject" instead of "SUBJECT" would otherwise open a second
 * copy of a record already on screen. Entity ids are left alone because an ERP
 * code is allowed to be case-sensitive, and folding one would merge two records
 * that are genuinely different.
 */
export function documentKey({ tenantId, documentType, entityId }: DocumentKeyParts): string {
  return [
    part(tenantId, "tenantId"),
    part(documentType, "documentType").toUpperCase(),
    part(entityId, "entityId"),
  ].join(SEPARATOR);
}

/** The inverse, or null for anything that is not a key. */
export function parseDocumentKey(key: string): DocumentKeyParts | null {
  const bits = key.split(SEPARATOR);
  if (bits.length !== 3 || bits.some((bit) => !bit.trim())) return null;
  return { tenantId: bits[0]!, documentType: bits[1]!, entityId: bits[2]! };
}

/** True when the key belongs to the tenant given — the check before any reuse. */
export function keyBelongsToTenant(key: string, tenantId: string): boolean {
  return parseDocumentKey(key)?.tenantId === tenantId;
}
