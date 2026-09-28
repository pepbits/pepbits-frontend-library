import {describe, expect, it, vi} from 'vitest';
import {createReferenceTransport} from './transport';
const make = (fetch = vi.fn().mockResolvedValue(new Response('{"data":[]}', {headers: {'Content-Type': 'application/json'}}))) => ({fetch, transport: createReferenceTransport({namespace: '/reference-modules/school', applicationId: 'nexora', branchId: 'hq', fetch, failureMessage: () => 'Request failed'})});
describe('reference host transport', () => {
  it('uses the configured authenticated fetch and overrides client scope headers', async () => {
    const {fetch, transport} = make();
    expect(await transport.request('/school/api/students', {headers: {'X-Product-Id': 'wrong', 'X-Reference-Branch': 'other'}, signal: undefined})).toEqual({data: []});
    expect(fetch.mock.calls[0][0]).toBe('/reference-modules/school/api/students');
    const headers = fetch.mock.calls[0][1].headers as Headers;
    expect(headers.get('X-Product-Id')).toBe('nexora'); expect(headers.get('X-Reference-Branch')).toBe('hq');
  });
  it.each(['https://example.com/api', '//example.com/api', '/api/../auth', '/api/%2e%2e/auth', '/api/\\auth', '/api/%xx'])('rejects paths outside the module boundary: %s', async path => {
    const {fetch, transport} = make(); await expect(transport.request(path)).rejects.toThrow('Invalid module API path'); expect(fetch).not.toHaveBeenCalled();
  });
  it('retains API failure status and field details', async () => {
    const {transport} = make(vi.fn().mockResolvedValue(new Response('{"error":"Denied","fieldErrors":{"name":"Required"}}', {status: 422})));
    await expect(transport.request('/api/students')).rejects.toMatchObject({message: 'Denied', status: 422, details: {fieldErrors: {name: 'Required'}}});
  });
  it('rejects malformed responses rather than returning null as data', async () => {
    const {transport} = make(vi.fn().mockResolvedValue(new Response('oops'))); await expect(transport.request('/api/students')).rejects.toMatchObject({code: 'INVALID_JSON', message: 'Request failed'});
  });
  it('preserves binary responses and download headers', async () => {
    const response = new Response('export', {headers: {'Content-Disposition': 'attachment; filename="data.csv"'}});
    const {transport} = make(vi.fn().mockResolvedValue(response)); expect(await transport.fetch('/api/jobs/1/download')).toBe(response);
  });
});
