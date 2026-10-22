import type { Lookups, MrnPreview, SessionInfo } from '@allyvora/shared';
import { config } from '../config';
import { db } from '../db';

interface BranchRow {
  id: number;
  organization_id: number;
  code: string;
  name: string;
  city: string | null;
  mrn_prefix: string;
  mrn_pad: number;
  mrn_reset_yearly: number;
  mrn_year: number | null;
  next_mrn_seq: number;
}

let lookupCache: Lookups | null = null;

export function invalidateLookups(): void {
  lookupCache = null;
}

export function getLookups(): Lookups {
  if (lookupCache) return lookupCache;
  const rows = db
    .prepare('SELECT category, code, label, parent, hint FROM lookups WHERE active = 1 ORDER BY category, sort, label')
    .all() as { category: string; code: string; label: string; parent: string | null; hint: string | null }[];
  const out: Lookups = {};
  for (const r of rows) {
    (out[r.category] ??= []).push({ code: r.code, label: r.label, parent: r.parent, hint: r.hint });
  }
  out.branch = (db.prepare('SELECT id, code, name, city FROM branches ORDER BY id').all() as BranchRow[]).map((b) => ({
    code: String(b.id),
    label: b.name,
    hint: b.code,
  }));
  lookupCache = out;
  return out;
}

export function getBranch(id: number): BranchRow | undefined {
  return db.prepare('SELECT * FROM branches WHERE id = ?').get(id) as BranchRow | undefined;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function getSession(email?: string): SessionInfo {
  const user = (email
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    : db.prepare('SELECT * FROM users ORDER BY id LIMIT 1').get()) as
    | { id: number; email: string; name: string; role: string; organization_id: number; default_branch_id: number }
    | undefined;
  if (!user) throw new Error('No users seeded');
  const org = db.prepare('SELECT id, code, name FROM organizations WHERE id = ?').get(user.organization_id) as SessionInfo['organization'];
  const branches = db
    .prepare('SELECT id, code, name, city FROM branches WHERE organization_id = ? ORDER BY id')
    .all(user.organization_id) as SessionInfo['branches'];
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, initials: initials(user.name) },
    organization: org,
    branches,
    defaultBranchId: user.default_branch_id,
    tenant: config.tenant,
  };
}

function formatMrn(b: BranchRow, seq: number, year: number): string {
  return `${b.mrn_prefix}-${year}-${String(seq).padStart(b.mrn_pad, '0')}`;
}

function nextSeq(b: BranchRow, year: number): number {
  return b.mrn_reset_yearly && b.mrn_year !== year ? 1 : b.next_mrn_seq;
}

export function previewMrn(branchId: number): MrnPreview | null {
  const b = getBranch(branchId);
  if (!b) return null;
  const year = new Date().getFullYear();
  return {
    branchId,
    next: formatMrn(b, nextSeq(b, year), year),
    rule: `${b.mrn_prefix}-YYYY-${'N'.repeat(b.mrn_pad)}${b.mrn_reset_yearly ? ', restarts every January' : ''}`,
  };
}

/** Must run inside a transaction. */
export function allocateMrn(branchId: number, at: Date = new Date()): string {
  const b = getBranch(branchId);
  if (!b) throw new Error(`Unknown branch ${branchId}`);
  const year = at.getFullYear();
  const seq = nextSeq(b, year);
  db.prepare('UPDATE branches SET next_mrn_seq = ?, mrn_year = ? WHERE id = ?').run(seq + 1, year, branchId);
  return formatMrn(b, seq, year);
}

/** Must run inside a transaction. */
export function allocateOrgNumber(organizationId: number): string {
  const org = db.prepare('SELECT patient_prefix, next_patient_seq FROM organizations WHERE id = ?').get(organizationId) as
    | { patient_prefix: string; next_patient_seq: number }
    | undefined;
  if (!org) throw new Error(`Unknown organisation ${organizationId}`);
  db.prepare('UPDATE organizations SET next_patient_seq = next_patient_seq + 1 WHERE id = ?').run(organizationId);
  return `${org.patient_prefix}${String(org.next_patient_seq).padStart(7, '0')}`;
}

export function findPincode(pin: string): { pincode: string; city: string; district: string; state: string } | undefined {
  return db.prepare('SELECT pincode, city, district, state FROM pincodes WHERE pincode = ?').get(pin) as
    | { pincode: string; city: string; district: string; state: string }
    | undefined;
}
