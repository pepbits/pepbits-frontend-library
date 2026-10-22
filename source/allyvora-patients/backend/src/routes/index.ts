import { Router, type Request } from 'express';
import type { FormValues, PatientStatus } from '@allyvora/shared';
import { db } from '../db';
import { handle, HttpError, intParam, optionalInt, optionalString } from '../http';
import {
  createPatient,
  findDuplicates,
  getPatient,
  listPatients,
  patientAudit,
  patientStats,
  setPatientStatus,
  updatePatient,
  type ListParams,
} from '../repositories/patients';
import { findPincode, getLookups, getSession, previewMrn } from '../repositories/reference';
import { getLayoutSettings, layoutHistory, saveLayoutSettings } from '../repositories/settings';

export const api = Router();

/** The signed-in user. Authentication is mocked: the first seeded user, or `x-user-email`. */
function actor(req: Request): string {
  return getSession(req.header('x-user-email') ?? undefined).user.name;
}

function formValues(body: unknown): FormValues {
  const values = (body as { values?: unknown })?.values;
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new HttpError(400, 'Send the form as { values: {...} }');
  return values as FormValues;
}

api.get(
  '/health',
  handle((_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', time: new Date().toISOString() });
  }),
);

api.get(
  '/session',
  handle((req, res) => {
    res.json(getSession(req.header('x-user-email') ?? undefined));
  }),
);

api.get(
  '/lookups',
  handle((_req, res) => {
    res.set('Cache-Control', 'private, max-age=60');
    res.json(getLookups());
  }),
);

api.get(
  '/branches/:id/mrn-preview',
  handle((req, res) => {
    const preview = previewMrn(intParam(req.params.id, 'Branch id'));
    if (!preview) throw new HttpError(404, 'Branch not found');
    res.json(preview);
  }),
);

api.get(
  '/pincodes/:pin',
  handle((req, res) => {
    const pin = String(req.params.pin);
    if (!/^[1-9][0-9]{5}$/.test(pin)) throw new HttpError(400, 'PIN code must be 6 digits');
    const found = findPincode(pin);
    if (!found) throw new HttpError(404, 'PIN code not in the directory');
    res.json(found);
  }),
);

/* Patients ---------------------------------------------------------------- */

api.get(
  '/patients',
  handle((req, res) => {
    const q = req.query;
    const params: ListParams = {
      q: optionalString(q.q),
      status: (['active', 'inactive', 'all'] as const).find((s) => s === q.status),
      sex: optionalString(q.sex, 20),
      payer: optionalString(q.payer, 20),
      branchId: optionalInt(q.branchId),
      created: (['today', 'week'] as const).find((s) => s === q.created),
      incomplete: q.incomplete === '1' || q.incomplete === 'true',
      sort: (['updated', 'created', 'name', 'mrn', 'completion'] as const).find((s) => s === q.sort),
      dir: q.dir === 'asc' ? 'asc' : q.dir === 'desc' ? 'desc' : undefined,
      page: optionalInt(q.page),
      pageSize: optionalInt(q.pageSize),
    };
    res.json(listPatients(params));
  }),
);

api.get(
  '/patients/stats',
  handle((_req, res) => {
    res.json(patientStats());
  }),
);

api.post(
  '/patients/duplicates',
  handle((req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    res.json(
      findDuplicates({
        givenName: optionalString(b.givenName),
        familyName: optionalString(b.familyName),
        dateOfBirth: optionalString(b.dateOfBirth, 10),
        mobile: optionalString(b.mobile, 20),
        excludeId: optionalInt(b.excludeId),
      }),
    );
  }),
);

api.get(
  '/patients/:id',
  handle((req, res) => {
    const p = getPatient(intParam(req.params.id));
    if (!p) throw new HttpError(404, 'Patient not found');
    res.json(p);
  }),
);

api.get(
  '/patients/:id/audit',
  handle((req, res) => {
    res.json(patientAudit(intParam(req.params.id)));
  }),
);

api.post(
  '/patients',
  handle((req, res) => {
    const created = createPatient(formValues(req.body), actor(req));
    res.status(201).location(`/api/patients/${created.id}`).json(created);
  }),
);

api.put(
  '/patients/:id',
  handle((req, res) => {
    const version = Number((req.body as { version?: unknown })?.version);
    if (!Number.isInteger(version)) throw new HttpError(400, 'Include the record version you edited');
    res.json(updatePatient(intParam(req.params.id), formValues(req.body), version, actor(req)));
  }),
);

api.patch(
  '/patients/:id/status',
  handle((req, res) => {
    const status = (req.body as { status?: PatientStatus })?.status;
    if (status !== 'active' && status !== 'inactive') throw new HttpError(400, 'status must be active or inactive');
    res.json(setPatientStatus(intParam(req.params.id), status, actor(req)));
  }),
);

/* Settings ---------------------------------------------------------------- */

api.get(
  '/settings/layout',
  handle((_req, res) => {
    res.json(getLayoutSettings());
  }),
);

api.put(
  '/settings/layout',
  handle((req, res) => {
    res.json(saveLayoutSettings(req.body, actor(req)));
  }),
);

api.get(
  '/settings/layout/history',
  handle((_req, res) => {
    res.json(layoutHistory());
  }),
);

api.use((_req, _res, next) => next(new HttpError(404, 'No such API endpoint')));
