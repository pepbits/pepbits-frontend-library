import {describe, expect, it, vi} from 'vitest';
import {createSettleTransport, SettleApiError, type SettleFetch} from './settle';

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
describe('Settle transport', () => {
  it('sends the configured base URL, JSON body and the selected desk user', async () => {
    const fetcher = vi.fn<SettleFetch>(async () => ok({receipt: 'RC1'}, 201));
    let user = 3;
    const transport = createSettleTransport('/settle-api/', () => user, fetcher);
    await expect(transport('/bills/BL1/payments', {method: 'POST', body: {rows: []}})).resolves.toEqual({data: {receipt: 'RC1'}, status: 201});
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/settle-api/bills/BL1/payments');
    expect(new Headers(init.headers).get('x-user-id')).toBe('3');
    expect(init.body).toBe('{"rows":[]}');
    user = 4; await transport('/meta');
    expect(new Headers(fetcher.mock.calls[1]![1].headers).get('x-user-id')).toBe('4');
  });
  it('maps the API error envelope, including blocked reasons', async () => {
    const transport = createSettleTransport('/settle-api', () => 1, async () => ok({error: {code: 'blocked', message: 'Cannot finalize', details: {reasons: ['Result pending', 'Discount awaiting approval']}}}, 409));
    const error = await transport('/bills/BL1/finalize', {method: 'POST', body: {}}).catch(e => e);
    expect(error).toBeInstanceOf(SettleApiError);
    expect(error).toMatchObject({status: 409, code: 'blocked', message: 'Cannot finalize', details: {reasons: ['Result pending', 'Discount awaiting approval']}});
  });
  it('reports an unreachable server without losing abort semantics', async () => {
    const offline = createSettleTransport('/settle-api', () => 1, async () => {throw new TypeError('fetch failed');});
    await expect(offline('/meta')).rejects.toMatchObject({status: 0, code: 'offline'});
    const aborted = createSettleTransport('/settle-api', () => 1, async () => {throw new DOMException('stop', 'AbortError');});
    await expect(aborted('/meta')).rejects.toMatchObject({name: 'AbortError'});
  });
  it('refuses traversal and malformed paths before any request', async () => {
    const fetcher = vi.fn<SettleFetch>(async () => ok({}));
    const transport = createSettleTransport('/settle-api', () => 1, fetcher);
    for (const path of ['bills', '//evil.test/x', '/bills/../admin', '/bills/%2E%2E', '/bills/a%2Fb', '/bills/%E0%A4%A', '/a\\b']) await expect(transport(path)).rejects.toMatchObject({code: 'invalid_path'});
    expect(fetcher).not.toHaveBeenCalled();
  });
});
