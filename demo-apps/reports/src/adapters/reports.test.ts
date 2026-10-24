import {describe, expect, it, vi} from 'vitest';
import {createReportsTransport} from './reports';
const make = (response = () => Response.json({ok: true})) => {const request = vi.fn(async () => response());return {request, transport: createReportsTransport(request, 'dubai')};};
describe('reports HTTP adapter', () => {
  it('namespaces source paths and pins routing headers over caller values', async () => {
    const {request, transport} = make();
    expect(await transport.request('/api/page/reports', {headers: {'X-Reference-Branch': 'other', 'X-Product-Id': 'wrong'}})).toEqual({ok: true});
    const [path, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/reference-modules/reports/api/page/reports');
    const headers = new Headers(init.headers);
    expect(headers.get('X-Product-Id')).toBe('nexora');
    expect(headers.get('X-Reference-Module')).toBe('reference-reports');
    expect(headers.get('X-Reference-Branch')).toBe('dubai');
  });
  it.each(['https://example.com/api', '//example.com/api', '/api/../auth', '/api/%2e%2e/auth', '/api/\\auth', '/api/%xx', '/api#x'])('rejects %s without a request', async path => {
    const {request, transport} = make();
    await expect(transport.request(path)).rejects.toThrow('Invalid Reports API path');
    expect(request).not.toHaveBeenCalled();
  });
  it('keeps the API error code and details for the module client', async () => {
    const {transport} = make(() => Response.json({error: 'Too large', code: 'ASYNC_REQUIRED', details: {days: 400}}, {status: 422}));
    await expect(transport.request('/api/reports/x/run', {method: 'POST'})).rejects.toMatchObject({message: 'Too large', status: 422, details: {code: 'ASYNC_REQUIRED'}});
  });
  it('rejects unreadable bodies and returns raw responses for downloads', async () => {
    await expect(make(() => new Response('oops')).transport.request('/api/session')).rejects.toMatchObject({code: 'INVALID_JSON'});
    const file = new Response('a,b', {headers: {'Content-Disposition': 'attachment; filename="r.csv"'}});
    expect(await make(() => file).transport.fetch('/api/jobs/1/download')).toBe(file);
  });
});
