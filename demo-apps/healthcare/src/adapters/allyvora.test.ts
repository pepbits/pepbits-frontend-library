import {afterEach, expect, test, vi} from 'vitest';
import {AllyVoraFailure, NETWORK_MESSAGE, configuredAllyVoraBase, createAllyVoraClient, createAllyVoraTransport, queryString} from './allyvora';

afterEach(() => {vi.unstubAllEnvs();});

test('the configured base is joined without double slashes and JSON headers follow the body', async () => {
  const fetcher = vi.fn(async () => Response.json({status: 'ok'}));
  const transport = createAllyVoraTransport('http://127.0.0.1:4555/api/', fetcher as unknown as typeof fetch);
  await createAllyVoraClient(transport).patients.create({givenName: 'Fictional'});
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('http://127.0.0.1:4555/api/patients');
  expect(init).toMatchObject({method: 'POST', cache: 'no-store', body: JSON.stringify({values: {givenName: 'Fictional'}})});
  const headers = new Headers(init.headers);
  expect(headers.get('Content-Type')).toBe('application/json');
  expect(headers.get('Accept')).toBe('application/json');
});

test.each(['https://elsewhere.example/api', '//elsewhere.example', 'patients'])('rejects a non-relative path before sending: %s', path => {
  const fetcher = vi.fn();
  expect(() => createAllyVoraTransport('/allyvora-api', fetcher as unknown as typeof fetch)(path)).toThrow('Invalid AllyVora API path');
  expect(fetcher).not.toHaveBeenCalled();
});

test('the backend error contract is kept: 422 field errors, 409 conflicts, 5xx defaults, text bodies and network failures', async () => {
  const respond = (response: Response | {throws: unknown}) => createAllyVoraClient(async () => {if (!(response instanceof Response)) throw response.throws; return response;});
  await expect(respond(Response.json({message: 'Some fields need attention', errors: {mobile: 'Enter mobile number'}}, {status: 422})).patients.create({}))
    .rejects.toMatchObject({status: 422, message: 'Some fields need attention', body: {errors: {mobile: 'Enter mobile number'}}});
  await expect(respond(Response.json({message: 'Saved by someone else'}, {status: 409})).patients.update(1, {}, 1)).rejects.toMatchObject({status: 409, message: 'Saved by someone else'});
  await expect(respond(new Response('', {status: 503})).session()).rejects.toMatchObject({status: 503, message: 'The server ran into a problem. Try again in a moment.'});
  await expect(respond(new Response('Not JSON', {status: 400})).lookups()).rejects.toMatchObject({status: 400, message: 'Not JSON'});
  await expect(respond(new Response('', {status: 404})).patients.get(9)).rejects.toMatchObject({status: 404, message: 'Request failed (404)'});
  const offline = respond({throws: new TypeError('fetch failed')}).health();
  await expect(offline).rejects.toBeInstanceOf(AllyVoraFailure);
  await expect(offline).rejects.toMatchObject({status: 0, message: NETWORK_MESSAGE});
  const abort = new DOMException('stopped', 'AbortError');
  await expect(respond({throws: abort}).patients.list({})).rejects.toBe(abort);
});

test('list queries omit empty values and encode flags like the source client', async () => {
  expect(queryString({q: 'meera', status: 'active', incomplete: true, sex: '', created: undefined, page: 2, payer: false})).toBe('?q=meera&status=active&incomplete=1&page=2');
  expect(queryString({})).toBe('');
  const transport = vi.fn(async (_path: string, _init?: RequestInit) => Response.json({items: [], total: 0, page: 1, pageSize: 20}));
  const client = createAllyVoraClient(transport);
  await client.patients.list({q: 'Ann Mary', sort: 'name', dir: 'asc'});
  await client.mrnPreview(2); await client.pincode('682020'); await client.patients.setStatus(4, 'inactive'); await client.settings.history();
  expect(transport.mock.calls.map(call => [call[0], (call[1] as RequestInit | undefined)?.method ?? 'GET'])).toEqual([
    ['/patients?q=Ann+Mary&sort=name&dir=asc', 'GET'], ['/branches/2/mrn-preview', 'GET'], ['/pincodes/682020', 'GET'], ['/patients/4/status', 'PATCH'], ['/settings/layout/history', 'GET'],
  ]);
});

test('the base URL is configuration with a same-origin proxy default', () => {
  vi.stubEnv('NEXT_PUBLIC_ALLYVORA_API_URL', '');
  expect(configuredAllyVoraBase()).toBe('/allyvora-api');
  vi.stubEnv('NEXT_PUBLIC_ALLYVORA_API_URL', 'http://127.0.0.1:4555/api');
  expect(configuredAllyVoraBase()).toBe('http://127.0.0.1:4555/api');
});
