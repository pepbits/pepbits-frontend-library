import {expect, test, vi} from 'vitest';
import {createMemoryRecordAdapter, DEFAULT_DRAFT_POLICY, RecordConflict, RecordEditor} from './index';

test('replays successful commands without reapplying them and refuses changed identity or stale revisions', async () => {
  const adapter = createMemoryRecordAdapter();
  const first = await adapter.save('key', {name: 'one'}, 0, 0, 'save');
  expect(await adapter.save('key', {name: 'one'}, 0, 0, 'save')).toEqual(first);
  await expect(adapter.save('key', {name: 'two'}, 0, 0, 'save')).rejects.toBeInstanceOf(RecordConflict);
  await expect(adapter.save('key', {name: 'two'}, 0, 0, 'new')).rejects.toBeInstanceOf(RecordConflict);
  await expect(adapter.draft('key', {name: 'draft'}, 0, 1, 'draft')).rejects.toBeInstanceOf(RecordConflict);
  const draft = await adapter.draft('key', {name: 'draft'}, 1, 1, 'draft');
  expect(draft.version).toBe(2);
  await expect(adapter.discard('key', 1, 'discard')).rejects.toBeInstanceOf(RecordConflict);
  await adapter.discard('key', 2, 'discard');
  await adapter.discard('key', 2, 'discard');
  expect(await adapter.load('key')).toMatchObject({draft: null, draftVersion: 3, record: {version: 1}});
});

test('creation consumes the source draft once, lists by host scope and isolates instances and returned values', async () => {
  const adapter = createMemoryRecordAdapter(), key = JSON.stringify(['app', 'form:items:one']);
  await adapter.draft('slot', {name: 'draft'}, 0, 0, 'draft');
  const created = await adapter.create('slot', key, {name: 'saved'}, 1, 'create');
  expect(created).toMatchObject({recordKey: key, record: {version: 1}, draftVersion: 0});
  expect(await adapter.create('slot', key, {name: 'saved'}, 1, 'create')).toEqual(created);
  created.record!.values.name = 'mutated';
  expect(await adapter.list(JSON.stringify(['app', 'form:items:']))).toMatchObject([{key, record: {values: {name: 'saved'}}}]);
  expect(await adapter.list(JSON.stringify(['other', 'form:items:']))).toEqual([]);
  expect(await adapter.load('slot')).toMatchObject({draft: null, draftVersion: 2});
  expect((await createMemoryRecordAdapter().load(key)).record).toBeNull();
  await expect(adapter.create('other-slot', key, {}, 0, 'duplicate')).rejects.toBeInstanceOf(RecordConflict);
});

test('draft retention and live policy exclusions also remove replayable draft values', async () => {
  let time = Date.parse('2026-10-01T00:00:00Z');
  let rules = {...DEFAULT_DRAFT_POLICY, retentionDays: 1};
  const adapter = createMemoryRecordAdapter({now: () => time, draftPolicy: () => rules});
  expect(await adapter.draft('key', {name: 'kept', password: 'sensitive', notes: 'private'}, 0, 0, 'first')).toMatchObject({values: {name: 'kept', notes: 'private'}, excludedFields: ['password']});
  rules = {...rules, excludedFields: ['notes']};
  expect(await adapter.load('key')).toMatchObject({draftVersion: 2, draft: {values: {name: 'kept'}, version: 2}});
  await expect(adapter.draft('key', {name: 'kept', password: 'sensitive', notes: 'private'}, 0, 0, 'first')).rejects.toBeInstanceOf(RecordConflict);
  time += 86400000;
  expect(await adapter.load('key')).toMatchObject({draft: null, draftVersion: 3});
  rules = {...rules, enabled: false};
  expect(await adapter.draft('key', {name: 'ignored'}, 0, 3, 'disabled')).toMatchObject({disabled: true, values: {}, version: 3});
  expect(await adapter.save('key', {name: 'business'}, 0, 3, 'save')).toMatchObject({record: {values: {name: 'business'}}});
});

test('concurrent writes cannot both win the same version', async () => {
  const adapter = createMemoryRecordAdapter();
  const outcomes = await Promise.allSettled([adapter.save('key', {name: 'a'}, 0, 0, 'a'), adapter.save('key', {name: 'b'}, 0, 0, 'b')]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
});

test('editors can recover, review conflicts and save through the memory transport', async () => {
  const adapter = createMemoryRecordAdapter();
  await adapter.save('key', {name: 'saved'}, 0, 0, 'seed');
  await adapter.draft('key', {name: 'draft'}, 1, 1, 'draft');
  const editor = new RecordEditor(adapter, 'key', {name: ''});
  try {
    editor.start();
    await vi.waitFor(() => expect(editor.snapshot().recovery).not.toBeNull());
    editor.restore();
    await adapter.save('key', {name: 'remote'}, 1, 2, 'remote');
    expect(await editor.save()).toBe(false);
    expect(editor.snapshot().conflict).toBe(true);
    await editor.review();
    expect(editor.snapshot()).toMatchObject({values: {name: 'draft'}, baseline: {name: 'remote'}});
    editor.keepEdits();
    expect(await editor.save()).toBe(true);
    expect(editor.dirty).toBe(false);
  } finally { editor.stop(); }
});
