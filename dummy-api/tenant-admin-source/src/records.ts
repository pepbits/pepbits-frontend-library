import { audit, db, nowIso, todayUtc } from './db';
import { RESOURCE_MAP, ResourceDef, humanize, tableName } from './registry';
import { HttpError, clean, normalizeCode } from './validation';

export type Status =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'RETIRED' | 'SUPERSEDED' | 'ACTIVE' | 'INACTIVE';

export interface RowRecord {
  id: number; code: string; name: string; status: Status; row_version: number; revision: number;
  parent_id: number | null; effective_from: string | null; effective_until: string | null; data: string;
  change_reason: string | null; decision_reason: string | null;
  created_by: number; created_at: string; updated_by: number; updated_at: string;
  submitted_by: number | null; submitted_at: string | null; decided_by: number | null; decided_at: string | null;
}

const EDITABLE: Status[] = ['DRAFT', 'REJECTED'];

export function toDto(r: RowRecord) {
  return {
    id: r.id, code: r.code, name: r.name, status: r.status, rowVersion: r.row_version, revision: r.revision,
    parentId: r.parent_id, effectiveFrom: r.effective_from, effectiveUntil: r.effective_until,
    data: JSON.parse(r.data), changeReason: r.change_reason, decisionReason: r.decision_reason,
    createdBy: r.created_by, createdAt: r.created_at, updatedBy: r.updated_by, updatedAt: r.updated_at,
    submittedBy: r.submitted_by, submittedAt: r.submitted_at, decidedBy: r.decided_by, decidedAt: r.decided_at,
  };
}

function load(res: ResourceDef, id: number): RowRecord {
  const row = db.prepare(`SELECT * FROM ${tableName(res.key)} WHERE id = ?`).get(id) as RowRecord | undefined;
  if (!row) throw new HttpError(404, 'NOT_FOUND', `That ${res.singular} was not found. It may have been discarded.`);
  return row;
}

function assertVersion(row: RowRecord, expected: unknown) {
  if (expected === undefined || expected === null) throw new HttpError(428, 'VERSION_REQUIRED', 'Reload the record and try again — the expected version was missing.');
  if (Number(expected) !== row.row_version)
    throw new HttpError(409, 'STALE_VERSION', 'Someone changed this record after you opened it. Reload to see the latest version before trying again.');
}

function nextCode(res: ResourceDef): string {
  const rows = db.prepare(`SELECT code FROM ${tableName(res.key)} WHERE code LIKE ?`).all(`${res.codePrefix}-%`) as { code: string }[];
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.split('-').pop()) || 0), 0);
  return `${res.codePrefix}-${String(max + 1).padStart(4, '0')}`;
}

function failIfErrors(errors: Record<string, string>) {
  if (Object.keys(errors).length) throw new HttpError(422, 'VALIDATION', 'Check the highlighted fields.', errors);
}

function validateHeader(res: ResourceDef, body: any, strict: boolean) {
  const errors: Record<string, string> = {};
  const name = String(body.name ?? '').trim();
  if (!name) errors.name = 'Give the record a name people will recognise.';
  else if (name.length > 120) errors.name = 'Keep the name under 120 characters.';
  const ef = body.effectiveFrom || null;
  const eu = body.effectiveUntil || null;
  if (ef && !/^\d{4}-\d{2}-\d{2}$/.test(ef)) errors.effectiveFrom = 'Use the YYYY-MM-DD format.';
  if (eu && !/^\d{4}-\d{2}-\d{2}$/.test(eu)) errors.effectiveUntil = 'Use the YYYY-MM-DD format.';
  if (ef && eu && eu <= ef) errors.effectiveUntil = 'The end date must be after the start date.';
  if (strict && res.effectiveDated && !ef) errors.effectiveFrom = 'Choose when this version takes effect.';
  return { name, ef, eu, errors };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

const SORTS: Record<string, string> = {
  code: 'code', name: 'name', status: 'status', updated: 'updated_at', effective: 'effective_from',
};

export function list(res: ResourceDef, q: { search?: string; status?: string; page?: number; pageSize?: number; sort?: string; dir?: string }) {
  const t = tableName(res.key);
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (q.search) {
    where.push('(code LIKE @s OR name LIKE @s OR data LIKE @s)');
    params.s = `%${q.search}%`;
  }
  const base = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const counts = Object.fromEntries(
    (db.prepare(`SELECT status, COUNT(*) n FROM ${t} ${base} GROUP BY status`).all(params) as { status: string; n: number }[]).map((r) => [r.status, r.n]),
  );
  if (q.status && q.status !== 'ALL') {
    where.push('status = @status');
    params.status = q.status;
  }
  const filtered = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) n FROM ${t} ${filtered}`).get(params) as { n: number }).n;
  const pageSize = Math.min(Math.max(Number(q.pageSize) || 25, 5), 100);
  const page = Math.max(Number(q.page) || 1, 1);
  const sortCol = SORTS[q.sort ?? ''] ?? 'updated_at';
  const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  const rows = db
    .prepare(`SELECT * FROM ${t} ${filtered} ORDER BY ${sortCol} ${dir}, id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize }) as RowRecord[];
  const dtos = rows.map(toDto);
  return { rows: withRefLabels(res, dtos), total, page, pageSize, counts };
}

/** Resolves ref/refs fields shown in tables to readable labels. */
function withRefLabels(res: ResourceDef, rows: ReturnType<typeof toDto>[]) {
  const refFields = res.fields.filter((f) => (f.type === 'ref' || f.type === 'refs') && f.list);
  if (!refFields.length) return rows.map((r) => ({ ...r, refLabels: {} as Record<string, string> }));
  return rows.map((r) => {
    const labels: Record<string, string> = {};
    for (const f of refFields) {
      const v = r.data[f.key];
      const ids: number[] = Array.isArray(v) ? v : v ? [v] : [];
      if (!ids.length) continue;
      const names = ids.map((id) => {
        const hit = db.prepare(`SELECT name FROM ${tableName(f.ref!)} WHERE id = ?`).get(id) as { name: string } | undefined;
        return hit?.name ?? `#${id}`;
      });
      labels[f.key] = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
    }
    return { ...r, refLabels: labels };
  });
}

export function options(res: ResourceDef) {
  const rows = db
    .prepare(`SELECT id, code, name, status, revision FROM ${tableName(res.key)} WHERE status NOT IN ('SUPERSEDED') ORDER BY name`)
    .all() as { id: number; code: string; name: string; status: string; revision: number }[];
  return rows;
}

export function get(res: ResourceDef, id: number) {
  const row = load(res, id);
  const revisions = db
    .prepare(`SELECT id, revision, status, effective_from, decided_at FROM ${tableName(res.key)} WHERE code = ? ORDER BY revision DESC`)
    .all(row.code);
  return { ...toDto(row), revisions };
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

export function create(res: ResourceDef, body: any, actorId: number) {
  const strict = res.governance === 'simple';
  const head = validateHeader(res, body, strict);
  const { data, errors } = clean(res, body.data ?? {}, strict);
  failIfErrors({ ...head.errors, ...errors });
  const code = normalizeCode(body.code) ?? nextCode(res);
  const t = tableName(res.key);
  if (db.prepare(`SELECT 1 FROM ${t} WHERE code = ?`).get(code))
    throw new HttpError(409, 'DUPLICATE_CODE', `The code ${code} is already used. Choose another or open the existing record.`, { code: 'Already in use.' });

  const now = nowIso();
  const status: Status = res.governance === 'simple' ? 'ACTIVE' : 'DRAFT';
  const info = db
    .prepare(
      `INSERT INTO ${t} (code, name, status, effective_from, effective_until, data, change_reason, created_by, created_at, updated_by, updated_at)
       VALUES (@code, @name, @status, @ef, @eu, @data, @reason, @actor, @now, @actor, @now)`,
    )
    .run({ code, name: head.name, status, ef: head.ef, eu: head.eu, data: JSON.stringify(data), reason: body.reason ?? null, actor: actorId, now });
  const id = Number(info.lastInsertRowid);
  audit({ actorId, resource: res.key, recordId: id, recordCode: code, action: 'CREATED', summary: `Created ${res.singular} “${head.name}”${status === 'DRAFT' ? ' as a draft' : ''}.`, reason: body.reason });
  return get(res, id);
}

export function update(res: ResourceDef, id: number, body: any, actorId: number) {
  const row = load(res, id);
  assertVersion(row, body.rowVersion);
  if (res.governance === 'versioned' && !EDITABLE.includes(row.status))
    throw new HttpError(409, 'IMMUTABLE', 'Approved and submitted versions cannot be edited. Create a new version instead.');
  const strict = res.governance === 'simple';
  const head = validateHeader(res, body, strict);
  const { data, errors } = clean(res, body.data ?? {}, strict);
  failIfErrors({ ...head.errors, ...errors });
  db.prepare(
    `UPDATE ${tableName(res.key)}
       SET name=@name, effective_from=@ef, effective_until=@eu, data=@data, change_reason=@reason,
           status = CASE WHEN status='REJECTED' THEN 'DRAFT' ELSE status END,
           row_version=row_version+1, updated_by=@actor, updated_at=@now
     WHERE id=@id`,
  ).run({ id, name: head.name, ef: head.ef, eu: head.eu, data: JSON.stringify(data), reason: body.reason ?? row.change_reason, actor: actorId, now: nowIso() });
  audit({ actorId, resource: res.key, recordId: id, recordCode: row.code, action: 'UPDATED', summary: `Saved changes to “${head.name}”.`, reason: body.reason });
  return get(res, id);
}

export function discard(res: ResourceDef, id: number, body: any, actorId: number) {
  const row = load(res, id);
  assertVersion(row, body.rowVersion);
  if (res.governance !== 'versioned' || !EDITABLE.includes(row.status))
    throw new HttpError(409, 'NOT_DISCARDABLE', 'Only drafts can be discarded. Retire approved versions instead.');
  const referenced = findReferences(res.key, id);
  if (referenced) throw new HttpError(409, 'IN_USE', `This draft is referenced by ${referenced}. Remove that reference first.`);
  db.prepare(`DELETE FROM ${tableName(res.key)} WHERE id = ?`).run(id);
  audit({ actorId, resource: res.key, recordId: id, recordCode: row.code, action: 'DISCARDED', summary: `Discarded draft “${row.name}” (revision ${row.revision}).` });
  return { ok: true };
}

function findReferences(resourceKey: string, id: number): string | null {
  for (const r of RESOURCE_MAP.values()) {
    for (const f of r.fields) {
      if (f.ref !== resourceKey) continue;
      const rows = db.prepare(`SELECT code, data FROM ${tableName(r.key)} WHERE status NOT IN ('RETIRED','SUPERSEDED')`).all() as { code: string; data: string }[];
      for (const x of rows) {
        const v = JSON.parse(x.data)[f.key];
        if (v === id || (Array.isArray(v) && v.includes(id))) return `${r.singular} ${x.code}`;
      }
    }
  }
  return null;
}

/** Cross-record governance: branch policy overrides may only carry keys the tenant default permits. */
function governanceChecks(res: ResourceDef, data: Record<string, any>): Record<string, string> {
  if (res.key !== 'billing-policies' || data.scope !== 'BRANCH') return {};
  const tenant = db
    .prepare(`SELECT data FROM ${tableName(res.key)} WHERE status='APPROVED' AND json_extract(data,'$.scope')='TENANT' ORDER BY effective_from DESC LIMIT 1`)
    .get() as { data: string } | undefined;
  if (!tenant) return { scope: 'Approve a tenant default before adding branch overrides. An override never supplies a missing default.' };
  const t = JSON.parse(tenant.data);
  const allowed = new Set<string>(t.overridableKeys ?? []);
  const locked = new Set<string>(t.lockedKeys ?? []);
  const errors: Record<string, string> = {};
  for (const key of Object.keys(data)) {
    if (key === 'scope' || key === 'branch') continue;
    const label = res.fields.find((f) => f.key === key)?.label ?? key;
    if (locked.has(key)) errors[key] = `${label} is locked by the tenant default.`;
    else if (!allowed.has(key)) errors[key] = `${label} is not branch-overridable. Ask a tenant administrator to permit it first.`;
  }
  return errors;
}

export function act(res: ResourceDef, id: number, action: string, body: any, actorId: number) {
  const row = load(res, id);
  assertVersion(row, body.rowVersion);
  const t = tableName(res.key);
  const reason: string | null = (body.reason ?? '').trim() || null;
  const now = nowIso();
  const bump = (set: string, params: Record<string, unknown> = {}) =>
    db.prepare(`UPDATE ${t} SET ${set}, row_version=row_version+1, updated_by=@actor, updated_at=@now WHERE id=@id`).run({ id, actor: actorId, now, ...params });

  const requireReason = (what: string) => {
    if (!reason) throw new HttpError(422, 'REASON_REQUIRED', `Give a reason to ${what}.`, { reason: 'A reason is required.' });
  };

  if (res.governance === 'simple') {
    if (action === 'deactivate' && row.status === 'ACTIVE') {
      bump(`status='INACTIVE'`);
      audit({ actorId, resource: res.key, recordId: id, recordCode: row.code, action: 'DEACTIVATED', summary: `Deactivated “${row.name}”.`, reason });
    } else if (action === 'activate' && row.status === 'INACTIVE') {
      bump(`status='ACTIVE'`);
      audit({ actorId, resource: res.key, recordId: id, recordCode: row.code, action: 'ACTIVATED', summary: `Activated “${row.name}”.`, reason });
    } else throw new HttpError(409, 'INVALID_TRANSITION', `You can't ${action} a record that is ${humanize(row.status).toLowerCase()}.`);
    return get(res, id);
  }

  switch (action) {
    case 'submit': {
      if (!EDITABLE.includes(row.status)) throw new HttpError(409, 'INVALID_TRANSITION', 'Only drafts can be submitted for approval.');
      const full = { name: row.name, effectiveFrom: row.effective_from, effectiveUntil: row.effective_until };
      const head = validateHeader(res, full, true);
      const { errors } = clean(res, JSON.parse(row.data), true);
      if (res.effectiveDated && row.effective_from && row.effective_from < todayUtc())
        head.errors.effectiveFrom = 'Versions cannot be back-dated. Choose today or a later date (UTC).';
      Object.assign(errors, governanceChecks(res, JSON.parse(row.data)));
      failIfErrors({ ...head.errors, ...errors });
      bump(`status='PENDING_APPROVAL', submitted_by=@actor, submitted_at=@now, decision_reason=NULL`);
      audit({ actorId, resource: res.key, recordId: id, recordCode: row.code, action: 'SUBMITTED', summary: `Submitted revision ${row.revision} of “${row.name}” for approval.`, reason });
      break;
    }
    case 'approve':
    case 'reject': {
      if (row.status !== 'PENDING_APPROVAL') throw new HttpError(409, 'INVALID_TRANSITION', 'Only records waiting for approval can be decided.');
      if (actorId === row.submitted_by || actorId === row.created_by)
        throw new HttpError(403, 'INDEPENDENCE_REQUIRED', 'A different administrator must decide this. People cannot approve changes they created or submitted.');
      if (action === 'reject') {
        requireReason('reject this version');
        bump(`status='REJECTED', decided_by=@actor, decided_at=@now, decision_reason=@reason`, { reason });
        audit({ actorId, resource: res.key, recordId: id, recordCode: row.code, action: 'REJECTED', summary: `Rejected revision ${row.revision} of “${row.name}”.`, reason });
        break;
      }
      if (row.effective_from) {
        const clash = db.prepare(`SELECT id FROM ${t} WHERE code=? AND status='APPROVED' AND effective_from=? AND id<>?`).get(row.code, row.effective_from, id);
        if (clash) throw new HttpError(409, 'EFFECTIVE_DATE_CONFLICT', 'Another approved version of this record already starts on that date.');
      }
      const tx = db.transaction(() => {
        if (row.parent_id) {
          db.prepare(`UPDATE ${t} SET status='SUPERSEDED', effective_until=COALESCE(effective_until, @until), row_version=row_version+1, updated_by=@actor, updated_at=@now WHERE code=@code AND status='APPROVED' AND id<>@id`)
            .run({ code: row.code, id, until: row.effective_from, actor: actorId, now });
        }
        bump(`status='APPROVED', decided_by=@actor, decided_at=@now, decision_reason=@reason`, { reason });
      });
      tx();
      audit({ actorId, resource: res.key, recordId: id, recordCode: row.code, action: 'APPROVED', summary: `Approved revision ${row.revision} of “${row.name}”${row.effective_from ? `, effective ${row.effective_from}` : ''}.`, reason });
      break;
    }
    case 'withdraw': {
      if (row.status !== 'PENDING_APPROVAL') throw new HttpError(409, 'INVALID_TRANSITION', 'Only pending submissions can be withdrawn.');
      bump(`status='DRAFT', submitted_by=NULL, submitted_at=NULL`);
      audit({ actorId, resource: res.key, recordId: id, recordCode: row.code, action: 'WITHDRAWN', summary: `Withdrew “${row.name}” from approval.`, reason });
      break;
    }
    case 'retire': {
      if (row.status !== 'APPROVED') throw new HttpError(409, 'INVALID_TRANSITION', 'Only approved versions can be retired.');
      requireReason('retire this version');
      bump(`status='RETIRED', effective_until=COALESCE(effective_until, @today), decision_reason=@reason`, { reason, today: todayUtc() });
      audit({ actorId, resource: res.key, recordId: id, recordCode: row.code, action: 'RETIRED', summary: `Retired “${row.name}”.`, reason });
      break;
    }
    case 'new-version': {
      if (!['APPROVED', 'RETIRED', 'SUPERSEDED'].includes(row.status)) throw new HttpError(409, 'INVALID_TRANSITION', 'New versions start from an approved version.');
      const open = db.prepare(`SELECT id FROM ${t} WHERE code=? AND status IN ('DRAFT','PENDING_APPROVAL','REJECTED')`).get(row.code) as { id: number } | undefined;
      if (open) throw new HttpError(409, 'OPEN_REVISION', 'A newer draft of this record already exists. Open it instead.', undefined);
      const max = (db.prepare(`SELECT MAX(revision) m FROM ${t} WHERE code=?`).get(row.code) as { m: number }).m;
      const info = db
        .prepare(
          `INSERT INTO ${t} (code, name, status, revision, parent_id, effective_from, data, change_reason, created_by, created_at, updated_by, updated_at)
           VALUES (@code, @name, 'DRAFT', @rev, @parent, NULL, @data, @reason, @actor, @now, @actor, @now)`,
        )
        .run({ code: row.code, name: row.name, rev: max + 1, parent: row.id, data: row.data, reason, actor: actorId, now });
      const newId = Number(info.lastInsertRowid);
      audit({ actorId, resource: res.key, recordId: newId, recordCode: row.code, action: 'NEW_VERSION', summary: `Started revision ${max + 1} of “${row.name}” from revision ${row.revision}.`, reason });
      return get(res, newId);
    }
    default:
      throw new HttpError(400, 'UNKNOWN_ACTION', `“${action}” is not a supported action.`);
  }
  return get(res, id);
}
