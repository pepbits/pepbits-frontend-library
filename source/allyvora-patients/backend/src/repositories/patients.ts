import {
  completion,
  computeAge,
  diffValues,
  sanitizeValues,
  validateForm,
  type AuditEntry,
  type DuplicateCandidate,
  type FieldChange,
  type FieldErrors,
  type FormValues,
  type Paged,
  type PatientListItem,
  type PatientRecord,
  type PatientStats,
  type PatientStatus,
} from '@allyvora/shared';
import { db, nowISO } from '../db';
import { HttpError } from '../http';
import { allocateMrn, allocateOrgNumber, getBranch, getLookups } from './reference';

interface PatientRow {
  id: number;
  mrn: string;
  org_number: string;
  branch_id: number;
  status: PatientStatus;
  display_name: string;
  given_name: string | null;
  family_name: string | null;
  local_name: string | null;
  sex: string | null;
  date_of_birth: string | null;
  mobile: string | null;
  email: string | null;
  blood_group: string | null;
  allergy_status: string | null;
  payer_type: string | null;
  registration_type: string | null;
  department: string | null;
  completion: number;
  data: string;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Searchable columns derived from the form data. */
function columns(values: FormValues) {
  return {
    display_name: String(values.displayName ?? '').trim(),
    given_name: str(values.givenName),
    family_name: str(values.familyName),
    local_name: str(values.localName),
    sex: str(values.administrativeSex),
    date_of_birth: str(values.dateOfBirth),
    mobile: str(values.mobile),
    email: str(values.email),
    blood_group: str(values.bloodGroup),
    allergy_status: str(values.allergyStatus),
    payer_type: str(values.payerType),
    registration_type: str(values.registrationType),
    department: str(values.department),
    completion: completion(values),
  };
}

function toRecord(r: PatientRow & { branch_name: string }): PatientRecord {
  return {
    id: r.id,
    mrn: r.mrn,
    orgNumber: r.org_number,
    branchId: r.branch_id,
    branchName: r.branch_name,
    status: r.status,
    displayName: r.display_name,
    completion: r.completion,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    data: JSON.parse(r.data) as FormValues,
  };
}

function toListItem(r: PatientRow & { branch_code: string }): PatientListItem {
  const data = JSON.parse(r.data) as FormValues;
  return {
    id: r.id,
    mrn: r.mrn,
    orgNumber: r.org_number,
    branchCode: r.branch_code,
    status: r.status,
    displayName: r.display_name,
    localName: r.local_name,
    sex: r.sex,
    ageLabel: computeAge(data).label,
    mobile: r.mobile,
    payerType: r.payer_type,
    allergyStatus: r.allergy_status,
    bloodGroup: r.blood_group,
    completion: r.completion,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function prepareValues(input: FormValues): { values: FormValues; errors: FieldErrors } {
  const values = sanitizeValues(input);
  const errors = validateForm(values);
  if (values.branchId && !getBranch(Number(values.branchId))) errors.branchId = 'Choose a branch from the list';
  return { values, errors };
}

function addAudit(patientId: number, action: AuditEntry['action'], actor: string, at: string, changes: FieldChange[] = []) {
  db.prepare('INSERT INTO patient_audit (patient_id, action, actor, at, changes) VALUES (?, ?, ?, ?, ?)').run(
    patientId,
    action,
    actor,
    at,
    JSON.stringify(changes),
  );
}

export function getPatient(id: number): PatientRecord | undefined {
  const row = db
    .prepare('SELECT p.*, b.name AS branch_name FROM patients p JOIN branches b ON b.id = p.branch_id WHERE p.id = ?')
    .get(id) as (PatientRow & { branch_name: string }) | undefined;
  return row ? toRecord(row) : undefined;
}

export interface ListParams {
  q?: string;
  status?: 'active' | 'inactive' | 'all';
  sex?: string;
  payer?: string;
  branchId?: number;
  created?: 'today' | 'week';
  incomplete?: boolean;
  sort?: 'updated' | 'created' | 'name' | 'mrn' | 'completion';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const SORTS: Record<NonNullable<ListParams['sort']>, string> = {
  updated: 'p.updated_at',
  created: 'p.created_at',
  name: 'p.display_name COLLATE NOCASE',
  mrn: 'p.mrn',
  completion: 'p.completion',
};

export const INCOMPLETE_THRESHOLD = 80;

export function listPatients(params: ListParams): Paged<PatientListItem> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  const status = params.status ?? 'active';
  if (status !== 'all') {
    where.push('p.status = ?');
    args.push(status);
  }
  if (params.q) {
    const q = params.q.trim();
    const digits = q.replace(/\D/g, '');
    const parts = ['p.display_name LIKE ?', 'p.local_name LIKE ?', 'p.mrn LIKE ?', 'p.org_number LIKE ?'];
    args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    if (digits.length >= 3) {
      parts.push('p.mobile LIKE ?');
      args.push(`%${digits}%`);
    }
    where.push(`(${parts.join(' OR ')})`);
  }
  if (params.sex) {
    where.push('p.sex = ?');
    args.push(params.sex);
  }
  if (params.payer) {
    where.push('p.payer_type = ?');
    args.push(params.payer);
  }
  if (params.branchId) {
    where.push('p.branch_id = ?');
    args.push(params.branchId);
  }
  if (params.created === 'today') where.push("date(p.created_at, 'localtime') = date('now', 'localtime')");
  if (params.created === 'week') where.push("date(p.created_at, 'localtime') >= date('now', 'localtime', '-6 days')");
  if (params.incomplete) {
    where.push('p.completion < ?');
    args.push(INCOMPLETE_THRESHOLD);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sort = SORTS[params.sort ?? 'updated'] ?? SORTS.updated;
  const dir = params.dir === 'asc' ? 'ASC' : 'DESC';
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM patients p ${whereSql}`).get(...args) as { n: number }).n;
  const rows = db
    .prepare(
      `SELECT p.*, b.code AS branch_code FROM patients p JOIN branches b ON b.id = p.branch_id
       ${whereSql} ORDER BY ${sort} ${dir}, p.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, (page - 1) * pageSize) as (PatientRow & { branch_code: string })[];

  return { items: rows.map(toListItem), total, page, pageSize };
}

export function patientStats(): PatientStats {
  const one = (sql: string, ...a: (string | number)[]) => (db.prepare(sql).get(...a) as { n: number }).n;
  return {
    active: one("SELECT COUNT(*) AS n FROM patients WHERE status = 'active'"),
    inactive: one("SELECT COUNT(*) AS n FROM patients WHERE status = 'inactive'"),
    today: one("SELECT COUNT(*) AS n FROM patients WHERE status = 'active' AND date(created_at, 'localtime') = date('now', 'localtime')"),
    week: one("SELECT COUNT(*) AS n FROM patients WHERE status = 'active' AND date(created_at, 'localtime') >= date('now', 'localtime', '-6 days')"),
    incomplete: one("SELECT COUNT(*) AS n FROM patients WHERE status = 'active' AND completion < ?", INCOMPLETE_THRESHOLD),
  };
}

export function createPatient(input: FormValues, actor: string, opts: { at?: Date } = {}): PatientRecord {
  const { values, errors } = prepareValues(input);
  if (Object.keys(errors).length) throw new HttpError(422, 'Some fields need attention', { errors });
  const at = opts.at ?? new Date();
  const ts = at.toISOString();
  const branchId = Number(values.branchId);
  const branch = getBranch(branchId)!;

  const id = db.transaction(() => {
    const mrn = allocateMrn(branchId, at);
    const orgNumber = allocateOrgNumber(branch.organization_id);
    const c = columns(values);
    const result = db
      .prepare(
        `INSERT INTO patients (mrn, org_number, branch_id, status, display_name, given_name, family_name, local_name, sex,
          date_of_birth, mobile, email, blood_group, allergy_status, payer_type, registration_type, department, completion,
          data, version, created_at, updated_at, created_by, updated_by)
         VALUES (@mrn, @org_number, @branch_id, 'active', @display_name, @given_name, @family_name, @local_name, @sex,
          @date_of_birth, @mobile, @email, @blood_group, @allergy_status, @payer_type, @registration_type, @department, @completion,
          @data, 1, @ts, @ts, @actor, @actor)`,
      )
      .run({ ...c, mrn, org_number: orgNumber, branch_id: branchId, data: JSON.stringify(values), ts, actor });
    const newId = Number(result.lastInsertRowid);
    addAudit(newId, 'created', actor, ts);
    return newId;
  })();

  return getPatient(id)!;
}

export function updatePatient(id: number, input: FormValues, version: number, actor: string): PatientRecord {
  const current = getPatient(id);
  if (!current) throw new HttpError(404, 'Patient not found');
  if (current.version !== version) {
    throw new HttpError(409, `${current.updatedBy} saved this record at ${current.updatedAt}. Reload to see their changes.`, {
      current,
    });
  }
  const { values, errors } = prepareValues(input);
  if (Object.keys(errors).length) throw new HttpError(422, 'Some fields need attention', { errors });
  if (Number(values.branchId) !== current.branchId) {
    // The MRN belongs to the registering branch and never changes.
    values.branchId = current.branchId;
  }
  const changes = diffValues(current.data, values, getLookups());
  if (changes.length === 0) return current;

  const ts = nowISO();
  db.transaction(() => {
    const c = columns(values);
    db.prepare(
      `UPDATE patients SET display_name=@display_name, given_name=@given_name, family_name=@family_name, local_name=@local_name,
        sex=@sex, date_of_birth=@date_of_birth, mobile=@mobile, email=@email, blood_group=@blood_group,
        allergy_status=@allergy_status, payer_type=@payer_type, registration_type=@registration_type, department=@department,
        completion=@completion, data=@data, version=version+1, updated_at=@ts, updated_by=@actor
       WHERE id=@id AND version=@version`,
    ).run({ ...c, data: JSON.stringify(values), ts, actor, id, version });
    addAudit(id, 'updated', actor, ts, changes);
  })();
  return getPatient(id)!;
}

export function setPatientStatus(id: number, status: PatientStatus, actor: string): PatientRecord {
  const current = getPatient(id);
  if (!current) throw new HttpError(404, 'Patient not found');
  if (current.status === status) return current;
  const ts = nowISO();
  db.transaction(() => {
    db.prepare('UPDATE patients SET status = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?').run(status, ts, actor, id);
    addAudit(id, status === 'inactive' ? 'deactivated' : 'reactivated', actor, ts);
  })();
  return getPatient(id)!;
}

export function patientAudit(id: number): AuditEntry[] {
  const rows = db
    .prepare('SELECT id, action, actor, at, changes FROM patient_audit WHERE patient_id = ? ORDER BY at DESC, id DESC LIMIT 100')
    .all(id) as { id: number; action: AuditEntry['action']; actor: string; at: string; changes: string }[];
  return rows.map((r) => ({ ...r, changes: JSON.parse(r.changes) as FieldChange[] }));
}

export interface DuplicateQuery {
  givenName?: string;
  familyName?: string;
  dateOfBirth?: string;
  mobile?: string;
  excludeId?: number;
}

export function findDuplicates(q: DuplicateQuery): DuplicateCandidate[] {
  const given = q.givenName?.trim().toLowerCase() || null;
  const family = q.familyName?.trim().toLowerCase() || null;
  const dob = q.dateOfBirth || null;
  const mobile = q.mobile?.replace(/\D/g, '') || null;
  if (!mobile && !(given && (family || dob))) return [];

  const rows = db
    .prepare(
      `SELECT p.*, b.code AS branch_code FROM patients p JOIN branches b ON b.id = p.branch_id
       WHERE p.status = 'active' AND p.id != @exclude AND (
         (@mobile IS NOT NULL AND p.mobile = @mobile)
         OR (@given IS NOT NULL AND lower(p.given_name) = @given AND (
              (@family IS NOT NULL AND lower(p.family_name) = @family) OR (@dob IS NOT NULL AND p.date_of_birth = @dob)))
       ) LIMIT 20`,
    )
    .all({ exclude: q.excludeId ?? -1, mobile, given, family, dob }) as (PatientRow & { branch_code: string })[];

  return rows
    .map((r) => {
      const reasons: string[] = [];
      let score = 0;
      if (mobile && r.mobile === mobile) {
        score += 55;
        reasons.push('Same mobile number');
      }
      if (given && r.given_name?.toLowerCase() === given) {
        score += 20;
        if (family && r.family_name?.toLowerCase() === family) {
          score += 20;
          reasons.push('Same name');
        } else reasons.push('Same first name');
      }
      if (dob && r.date_of_birth === dob) {
        score += 30;
        reasons.push('Same date of birth');
      }
      const item = toListItem(r);
      return {
        id: r.id,
        mrn: r.mrn,
        displayName: r.display_name,
        ageLabel: item.ageLabel,
        sex: r.sex,
        mobile: r.mobile,
        score: Math.min(score, 100),
        reasons,
      };
    })
    .filter((c) => c.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
