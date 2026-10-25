import {vi} from 'vitest';
import fixtures from './fixtures.json';
import type {SettleFetch} from '../adapters/settle';

/** Frozen fictional responses captured from the unchanged Settle API (scripts/write-fixtures.mjs). */
export const settleFixtures = fixtures as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const clone = <T,>(value: T): T => structuredClone(value);

export interface SettleCallRecord {method: string; path: string; search: URLSearchParams; body: any; user: string} // eslint-disable-line @typescript-eslint/no-explicit-any
/** Mocked Settle transport for unit tests. GETs answer from fixtures; writes are recorded and answer
 * with the same contract shapes. `override(method path)` replaces a response, e.g. to inject a 409. */
export function mockSettle() {
  const calls: SettleCallRecord[] = [];
  const overrides = new Map<string, (call: SettleCallRecord) => Response | unknown>();
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
  const user = (headers: HeadersInit | undefined) => new Headers(headers).get('x-user-id') ?? '';
  const bill = (no: string) => clone(settleFixtures['/bills/' + no] ?? {...settleFixtures['/bills/BL002001'], bill: {...settleFixtures['/bills/BL002001'].bill, bill_no: no}});
  const fetcher = vi.fn<SettleFetch>(async (url, init) => {
    const parsed = new URL(url, 'http://localhost');
    const path = parsed.pathname.replace(/^\/settle-api/, '');
    const method = init.method ?? 'GET';
    const record: SettleCallRecord = {method, path, search: parsed.searchParams, body: init.body ? JSON.parse(String(init.body)) : null, user: user(init.headers)};
    calls.push(record);
    const custom = overrides.get(method + ' ' + path);
    if (custom) {const result = custom(record); return result instanceof Response ? result : json(result);}
    if (method === 'GET') {
      if (path === '/meta') return json(clone(settleFixtures[record.user === '3' ? '/meta#cashier' : record.user === '4' ? '/meta#finance' : '/meta']));
      if (path === '/health') return json({ok: true, time: new Date(0).toISOString()});
      if (path === '/catalogue') return json(clone(settleFixtures['/catalogue']).filter((i: {name: string; code: string; charge_group: string}) => {const q = (record.search.get('q') ?? '').toLowerCase(), g = record.search.get('group'); return (!q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) && (!g || i.charge_group === g);}));
      let m = path.match(/^\/bills\/([^/]+)$/); if (m) return json(bill(decodeURIComponent(m[1]!)));
      m = path.match(/^\/patients\/([^/]+)\/visits$/); if (m) return json(clone(settleFixtures['/patients/MR240107/visits']));
      m = path.match(/^\/patients\/([^/]+)$/); if (m) return json(clone(settleFixtures['/patients/MR240107']));
      m = path.match(/^\/receipts\/([^/]+)$/); if (m) return json({...clone(settleFixtures['/receipts/:no']), no: decodeURIComponent(m[1]!)});
      if (path in settleFixtures) return json(clone(settleFixtures[path]));
      return json({error: {code: 'not_found', message: 'No such endpoint'}}, 404);
    }
    // Writes answer with the contract shape the screens read.
    let m = path.match(/^\/bills\/([^/]+)\/payments$/);
    if (m) return json({...bill(m[1]!), result: {receipts: ['RC-FIXTURE-1'], notes: []}});
    m = path.match(/^\/bills\/([^/]+)\/(finalize|close|reopen|cancel|writeoff|send-claim|charges|discount|deposit-setoff|points|settings)/);
    if (m) return json({...bill(m[1]!), result: {}});
    if (path === '/bills') return json(bill('BL002001'), 201);
    if (path === '/patients') return json({...clone(settleFixtures['/patients/MR240107'].patient), mr_no: 'MR-FIXTURE', name: record.body?.name ?? 'Fictional patient'}, 201);
    m = path.match(/^\/patients\/([^/]+)\/deposits$/); if (m) return json({depositNo: 'DP-FIXTURE-1'}, 201);
    m = path.match(/^\/patients\/([^/]+)\/visits$/); if (m) return json({...clone(settleFixtures['/patients/MR240107/visits'][0]), visit_id: 'OP-FIXTURE'}, 201);
    m = path.match(/^\/approvals\/(\d+)\/decide$/); if (m) return json({note: null});
    m = path.match(/^\/receipts\/([^/]+)\/cancel$/); if (m) return json({reversal: 'RC-REVERSAL'});
    if (path === '/me/counter') return json(clone(settleFixtures['/meta'].me));
    if (path === '/daybook/close') return json({ok: true});
    if (path === '/deposits/realize') return json({ok: true});
    if (path === '/admin/reset-demo') return json({ok: true});
    return json({ok: true});
  });
  return {fetcher, calls, override: (key: string, handler: (call: SettleCallRecord) => Response | unknown) => overrides.set(key, handler), json};
}
