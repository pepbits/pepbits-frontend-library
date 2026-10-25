import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRecordStore } from './record-store.mjs';
const user = { id: 'one', tenantId: 'tenant' };
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'record-store-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'records.json');
  const store = createRecordStore(file);
  return { file, call: (action, body, actor = user, key = 'product:record') => store.handle(actor, key, action, body) };
}
test('saved records and recovery drafts survive reopening the store', t => {
  const { file, call } = fixture(t);
  assert.equal(call('draft', { version: 0, baseVersion: 0, values: { name: 'draft' }, operationId: 'd1' }).status, 200);
  assert.equal(createRecordStore(file).handle(user, 'product:record', 'load').body.draft.values.name, 'draft');
  assert.equal(call('save', { version: 0, draftVersion: 1, values: { name: 'saved' }, operationId: 's1' }).status, 200);
  const result = createRecordStore(file).handle(user, 'product:record', 'load').body;
  assert.equal(result.record.values.name, 'saved'); assert.equal(result.draft, null); assert.equal(result.draftVersion, 2);
});
test('record versions are shared in a tenant; drafts belong to the account', t => {
  const { call } = fixture(t);
  call('draft', { version: 0, baseVersion: 0, values: { name: 'private' }, operationId: 'd1' });
  assert.equal(call('load', undefined, { ...user, id: 'two' }).body.draft, null);
  call('save', { version: 0, draftVersion: 1, values: { name: 'shared' }, operationId: 's1' });
  assert.equal(call('load', undefined, { ...user, id: 'two' }).body.record.values.name, 'shared');
  assert.equal(call('load', undefined, { ...user, tenantId: 'another' }).body.record, null);
  assert.equal(call('load', undefined, user, 'different-product:record').body.record, null);
});
test('stale saves and drafts cannot overwrite another window', t => {
  const { call } = fixture(t);
  call('save', { version: 0, draftVersion: 0, values: { name: 'first' }, operationId: 's1' });
  assert.equal(call('save', { version: 0, draftVersion: 0, values: { name: 'stale' }, operationId: 's2' }).status, 409);
  assert.equal(call('draft', { version: 1, baseVersion: 0, values: { name: 'stale' }, operationId: 'd1' }).status, 409);
  assert.equal(call('load').body.record.values.name, 'first');
});
test('retrying an acknowledged operation is idempotent', t => {
  const { call } = fixture(t);
  const body = { version: 0, draftVersion: 0, values: { name: 'first' }, operationId: 's1' };
  assert.deepEqual(call('save', body), call('save', body));
  assert.equal(call('save', { ...body, values: { name: 'different' } }).status, 409);
  assert.equal(call('load').body.record.version, 1);
});
test('discard keeps a revision tombstone so late draft writes cannot resurrect it', t => {
  const { call } = fixture(t);
  call('draft', { version: 0, baseVersion: 0, values: { name: 'draft' }, operationId: 'd1' });
  assert.equal(call('discard', { version: 1, operationId: 'x1' }).status, 204);
  assert.equal(call('draft', { version: 1, baseVersion: 0, values: { name: 'late' }, operationId: 'd2' }).status, 409);
  assert.equal(call('load').body.draft, null);
});
test('invalid payloads do not mutate the record', t => {
  const { call } = fixture(t);
  assert.equal(call('save', { values: {}, version: -1 }).status, 400);
  assert.equal(call('draft', { version: 0, operationId: 'x', values: null }).status, 400);
  assert.equal(call('load').body.record, null);
});
test('a failed disk write does not publish a saved record', t => {
  const { file, call } = fixture(t);
  writeFileSync(file + '.tmp', '');
  // Replace temp path with a directory to make atomic persistence fail.
  rmSync(file + '.tmp');
  mkdirSync(file + '.tmp');
  assert.throws(() => call('save', { version: 0, draftVersion: 0, values: { name: 'not saved' }, operationId: 's1' }));
  assert.equal(call('load').body.record, null);
});
test('create allocates an independent record and clears only the source draft', t => {
  const { call } = fixture(t);
  call('draft', { version: 0, baseVersion: 0, values: { name: 'new' }, operationId: 'd1' });
  const body = { version: 0, draftVersion: 1, values: { name: 'new' }, destinationKey: 'product:generated-id', operationId: 'create1' };
  const response = call('create', body);
  assert.equal(response.status, 200); assert.equal(response.body.recordKey, body.destinationKey);
  assert.deepEqual(call('create', body), response);
  assert.equal(call('load').body.record, null); assert.equal(call('load').body.draft, null);
  assert.equal(call('load', undefined, user, body.destinationKey).body.record.values.name, 'new');
});
