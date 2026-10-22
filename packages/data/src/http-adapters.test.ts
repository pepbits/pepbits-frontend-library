import {expect, test, vi} from 'vitest';
import {createHttpRecordAdapter, createHttpDraftAdapter, createHttpDraftCenterAdapter, createHttpApprovalAdapter, createHttpRecordPanelsAdapter, createHttpImportAdapter, draftContext, RecordRejected, RecordConflict, DEFAULT_DRAFT_POLICY} from './index';

const savedAt = '2026-10-01T00:00:00Z';
const bundle = {record: {values: {name: 'saved'}, version: 1, savedAt}, draft: null, draftVersion: 1};
test('record requests retain encoded keys, revisions and operation identity', async () => {
  const request = vi.fn(async (_path: string, _init?: RequestInit) => Response.json(bundle));
  const adapter = createHttpRecordAdapter(request);
  expect(await adapter.create('slot /', 'dest', {name: 'saved'}, 2, 'same-operation')).toEqual(bundle);
  expect(request.mock.calls[0]![0]).toBe('/records/slot%20%2F/create');
  expect(JSON.parse(request.mock.calls[0]![1]!.body as string)).toEqual({destinationKey: 'dest', values: {name: 'saved'}, draftVersion: 2, version: 0, operationId: 'same-operation'});
});
test.each([400, 413, 422])('record HTTP %i is a definitive rejection with filtered fields and a reference', async status => {
  const adapter = createHttpRecordAdapter(async () => Response.json({fieldErrors: {name: 'required', unsafe: {body: 'private'}}}, {status, headers: {'X-Sentinel-Reference': 'ref'}}));
  await expect(adapter.save('key', {}, 0, 0, 'op')).rejects.toMatchObject({status: 422, reference: 'ref', fieldErrors: {name: 'required'}});
  await expect(adapter.load('key')).rejects.toBeInstanceOf(RecordRejected);
});
test('record conflicts, transient failures and malformed snapshots retain their different semantics', async () => {
  await expect(createHttpRecordAdapter(async () => new Response(null, {status: 409})).load('key')).rejects.toBeInstanceOf(RecordConflict);
  await expect(createHttpRecordAdapter(async () => new Response(null, {status: 503, headers: {'X-Sentinel-Reference': 'ref'}})).load('key')).rejects.toMatchObject({status: 503, reference: 'ref'});
  await expect(createHttpRecordAdapter(async () => Response.json({...bundle, record: {...bundle.record, version: -1}})).load('key')).rejects.toThrow(/invalid snapshot/);
});
test('shared draft requests carry host scope and operation identity and reject malformed envelopes', async () => {
  const values = {schemaVersion: 1, context: 'hash', data: {name: 'draft'}};
  const request = vi.fn(async (_path: string, _init?: RequestInit) => Response.json({values, version: 1, savedAt}));
  const adapter = createHttpDraftAdapter(request);
  await adapter.save({productId: 'app', pageId: 'items', recordId: 'one', kind: 'import'}, values, 0, 'same-operation');
  const [path, init] = request.mock.calls[0]!;
  expect(path).toBe('/drafts');
  expect(new Headers(init!.headers).get('X-Product-Id')).toBe('app');
  expect(JSON.parse(init!.body as string)).toEqual({pageId: 'items', recordId: 'one', kind: 'import', action: 'draft', values, version: 0, operationId: 'same-operation'});
  await expect(createHttpDraftAdapter(async () => Response.json({})).load({productId: 'app', pageId: 'items', recordId: 'one', kind: 'approval'})).rejects.toMatchObject({status: 502});
});
test('draft center validates list policy, counts and page bounds', async () => {
  const data = {items: [], total: 0, offset: 0, policy: DEFAULT_DRAFT_POLICY, counts: {all: 0, outdated: 0, unavailable: 0}, serverTime: savedAt};
  expect(await createHttpDraftCenterAdapter(async () => Response.json(data)).list('app', {})).toEqual(data);
  for (const invalid of [{...data, policy: {...data.policy, retentionDays: 31}}, {...data, total: -1}, {...data, items: Array(26).fill({})}]) {
    await expect(createHttpDraftCenterAdapter(async () => Response.json(invalid)).list('app', {})).rejects.toMatchObject({status: 502});
  }
});
test('draft contexts hash content without retaining raw values', async () => {
  const first = await draftContext({name: 'private'});
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(first).toBe(await draftContext({name: 'private'}));
  expect(first).not.toBe(await draftContext({name: 'different'}));
});
test('approval changes forward the operation and preserve server failure metadata', async () => {
  const request = vi.fn(async (_path: string, _init?: RequestInit) => Response.json({error: 'Try again'}, {status: 503, headers: {'X-Sentinel-Reference': 'ref'}}));
  await expect(createHttpApprovalAdapter(request).change(['app', 'items'], {action: 'submit', recordId: 'one', version: 1, comment: ''}, 'same-operation')).rejects.toMatchObject({status: 503, reference: 'ref', message: 'Try again'});
  expect(JSON.parse(request.mock.calls[0]![1]!.body as string).operationId).toBe('same-operation');
  await expect(createHttpApprovalAdapter(async () => Response.json({})).read(['app', 'items'])).rejects.toThrow('Invalid approval service response.');
});
test('record panels forward cancellation, handle download and retain request-limit errors', async () => {
  const request = vi.fn(async (_path: string, _init?: RequestInit) => Response.json({attachments: [], comments: [], related: [], activity: []}));
  const signal = new AbortController().signal;
  await createHttpRecordPanelsAdapter(request).load(['app', 'items', 'one'], signal);
  expect(request.mock.calls[0]![1]!.signal).toBe(signal);
  expect(await createHttpRecordPanelsAdapter(async () => Response.json({name: 'file', content: 'text'})).download(['app', 'items', 'one'], 'file')).toEqual({name: 'file', content: 'text'});
  await expect(createHttpRecordPanelsAdapter(async () => new Response(null, {status: 413})).change(['app', 'items', 'one'], {action: 'comment', text: ''}, 'op')).rejects.toMatchObject({status: 413, message: 'This file exceeds the service request limit. Choose a smaller file.'});
});
test('import retries retain the job id and safe failure reference', async () => {
  const request = vi.fn(async (_path: string, _init?: RequestInit) => Response.json({error: 'Retry'}, {status: 503, headers: {'X-Sentinel-Reference': 'ref'}}));
  await expect(createHttpImportAdapter(request).run('job', true)).rejects.toMatchObject({status: 503, reference: 'ref'});
  expect(JSON.parse(request.mock.calls[0]![1]!.body as string)).toEqual({action: 'run', id: 'job', retry: true});
});
