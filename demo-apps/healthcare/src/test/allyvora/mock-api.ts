import {completion, computeAge, sanitizeValues, validateForm, type FormValues, type LayoutSettings, type PatientListItem, type PatientRecord} from '@allyvora/shared';
import {createAllyVoraClient, type AllyVoraTransport} from '../../adapters/allyvora';
import fixtures from './fixtures.json';

/** Fictional fixtures captured once from the unchanged AllyVora API; the mock keeps its HTTP contract (status codes and bodies). */
export const fixture = fixtures as unknown as {
  session: import('@allyvora/shared').SessionInfo; lookups: import('@allyvora/shared').Lookups; settings: LayoutSettings; stats: import('@allyvora/shared').PatientStats;
  list: import('@allyvora/shared').Paged<PatientListItem>; records: Record<string, PatientRecord>; audit: Record<string, import('@allyvora/shared').AuditEntry[]>;
  mrnPreview: Record<string, import('@allyvora/shared').MrnPreview>; pincodes: Record<string, {pincode: string; city: string; district: string; state: string}>; history: import('@allyvora/shared').SettingsHistoryEntry[];
};

export interface MockCall {method: string; path: string; body: unknown}
export function mockAllyVora(options: {settings?: Partial<LayoutSettings>; fail?: (call: MockCall) => Response | undefined} = {}) {
  const records = new Map<number, PatientRecord>(Object.values(structuredClone(fixture.records)).map(record => [record.id, record]));
  let items = structuredClone(fixture.list.items);
  let settings: LayoutSettings = {...fixture.settings, ...options.settings};
  const history = structuredClone(fixture.history);
  const calls: MockCall[] = [];
  const json = (body: unknown, status = 200) => Response.json(body, {status});
  const listItem = (record: PatientRecord): PatientListItem => ({id: record.id, mrn: record.mrn, orgNumber: record.orgNumber, branchCode: 'KCH', status: record.status, displayName: record.displayName,
    localName: (record.data.localName as string) ?? null, sex: (record.data.administrativeSex as string) ?? null, ageLabel: computeAge(record.data).label, mobile: (record.data.mobile as string) ?? null,
    payerType: (record.data.payerType as string) ?? null, allergyStatus: (record.data.allergyStatus as string) ?? null, bloodGroup: (record.data.bloodGroup as string) ?? null, completion: record.completion, createdAt: record.createdAt, updatedAt: record.updatedAt});
  const transport: AllyVoraTransport = async (path, init = {}) => {
    const url = new URL(path, 'http://localhost'), method = (init.method ?? 'GET').toUpperCase(), body = init.body ? JSON.parse(String(init.body)) : null;
    const call = {method, path: url.pathname + url.search, body};
    calls.push(call);
    const failed = options.fail?.(call);
    if (failed) return failed;
    const p = url.pathname;
    if (p === '/session') return json(fixture.session);
    if (p === '/lookups') return json(fixture.lookups);
    if (p === '/settings/layout' && method === 'GET') return json(settings);
    if (p === '/settings/layout' && method === 'PUT') {
      settings = {...body, updatedAt: new Date().toISOString(), updatedBy: fixture.session.user.name};
      history.unshift({id: (history[0]?.id ?? 0) + 1, changedAt: settings.updatedAt!, changedBy: settings.updatedBy!, value: body});
      return json(settings);
    }
    if (p === '/settings/layout/history') return json(history);
    if (p === '/patients/stats') return json(fixture.stats);
    if (p === '/patients/duplicates') {
      const matches = items.filter(item => item.status === 'active' && (body.mobile && item.mobile === body.mobile || body.givenName && item.displayName.toLowerCase().includes(String(body.givenName).toLowerCase())));
      return json(matches.slice(0, 3).map(item => ({id: item.id, mrn: item.mrn, displayName: item.displayName, ageLabel: item.ageLabel, sex: item.sex, mobile: item.mobile, score: 80, reasons: [item.mobile === body.mobile ? 'Same mobile number' : 'Similar name']})));
    }
    let match = p.match(/^\/branches\/(\d+)\/mrn-preview$/);
    if (match) return fixture.mrnPreview[match[1]!] ? json(fixture.mrnPreview[match[1]!]) : json({message: 'Branch not found'}, 404);
    match = p.match(/^\/pincodes\/(\d+)$/);
    if (match) return fixture.pincodes[match[1]!] ? json(fixture.pincodes[match[1]!]) : json({message: 'PIN code not in the directory'}, 404);
    if (p === '/patients' && method === 'GET') {
      const q = url.searchParams.get('q')?.toLowerCase(), status = url.searchParams.get('status') ?? 'active', page = Number(url.searchParams.get('page') ?? 1), size = Number(url.searchParams.get('pageSize') ?? 20);
      let rows = items.filter(item => (status === 'all' || item.status === status) && (!q || [item.displayName, item.mrn, item.mobile ?? '', item.localName ?? ''].join(' ').toLowerCase().includes(q)));
      for (const [key, field] of [['sex', 'sex'], ['payer', 'payerType']] as const) {const value = url.searchParams.get(key); if (value) rows = rows.filter(item => item[field] === value);}
      if (url.searchParams.get('sort') === 'name') rows = [...rows].sort((a, b) => a.displayName.localeCompare(b.displayName));
      return json({items: rows.slice((page - 1) * size, page * size), total: rows.length, page, pageSize: size});
    }
    if (p === '/patients' && method === 'POST') {
      const values = sanitizeValues(body.values), errors = validateForm(values);
      if (Object.keys(errors).length) return json({message: 'Some fields need attention', errors}, 422);
      const id = Math.max(...records.keys()) + 1, now = new Date().toISOString();
      const record: PatientRecord = {id, mrn: `KCH-2026-${String(id).padStart(6, '0')}`, orgNumber: `SPH${String(id).padStart(7, '0')}`, branchId: Number(values.branchId), branchName: 'Spectrum Kochi Hospital', status: 'active', displayName: String(values.displayName), completion: completion(values), version: 1, createdAt: now, updatedAt: now, createdBy: fixture.session.user.name, updatedBy: fixture.session.user.name, data: values as FormValues};
      records.set(id, record); items = [listItem(record), ...items];
      return json(record, 201);
    }
    match = p.match(/^\/patients\/(\d+)(\/audit|\/status)?$/);
    if (match) {
      const id = Number(match[1]), record = records.get(id);
      if (!record) return json({message: 'Patient not found'}, 404);
      if (match[2] === '/audit') return json(fixture.audit[String(id)] ?? []);
      if (match[2] === '/status') {const next = {...record, status: body.status, version: record.version + 1}; records.set(id, next); items = items.map(item => item.id === id ? {...item, status: body.status} : item); return json(next);}
      if (method === 'PUT') {
        if (body.version !== record.version) return json({message: `${record.updatedBy} saved this record at ${record.updatedAt}. Reload to see their changes.`, current: record}, 409);
        const values = sanitizeValues(body.values), errors = validateForm(values);
        if (Object.keys(errors).length) return json({message: 'Some fields need attention', errors}, 422);
        const next = {...record, data: {...values, branchId: record.branchId}, displayName: String(values.displayName), version: record.version + 1, updatedAt: new Date().toISOString()};
        records.set(id, next); return json(next);
      }
      return json(record);
    }
    return json({message: 'No such API endpoint'}, 404);
  };
  return {client: createAllyVoraClient(transport), transport, calls, records, get settings() {return settings;}};
}
