import fixtures from './api.json';
import type {Request} from '../adapters/http';
import type {ListResult, Meta, RecordDto} from '../modules/tenant-admin/lib/types';
/** Real responses of the unchanged demo API, captured by scripts/smoke.mjs (TENANT_ADMIN_CAPTURE) before any workflow wrote data. */
export const captured = fixtures as unknown as Record<string, unknown>;
export const fixtureMeta = captured['/meta'] as Meta;
export const fixtureList = (key: string) => captured['/resources/' + key] as ListResult;
const NS = '/reference-modules/tenant-admin';
/** Host-level request (Response objects) answering module reads from the captured fixtures; writes echo a fixture record. */
export function mockApi(extra: (path: string, init?: RequestInit) => Response | undefined = () => undefined) {
  const calls: {path: string; init?: RequestInit}[] = [];
  const request: Request = async (path, init) => {
    calls.push({path, init});
    const own = extra(path, init); if (own) return own;
    if (!path.startsWith(NS)) throw new Error('Unexpected request ' + path);
    const pathname = path.slice(NS.length).split('?')[0]!;
    if (init?.method && init.method !== 'GET') return Response.json({ok: true});
    if (Object.hasOwn(captured, pathname)) return Response.json(structuredClone(captured[pathname]));
    if (/\/options$/.test(pathname)) return Response.json([]);
    const record = pathname.match(/^\/resources\/([a-z0-9-]+)\/(\d+)$/);
    if (record) {const row = fixtureList(record[1]!)?.rows.find(r => r.id === Number(record[2])) as RecordDto | undefined; if (row) return Response.json({...row, revisions: [{id: row.id, revision: row.revision, status: row.status, effective_from: row.effectiveFrom, decided_at: row.decidedAt}]});}
    return Response.json({error: {code: 'NOT_FOUND', message: 'No such endpoint.'}}, {status: 404});
  };
  return {request, calls};
}
