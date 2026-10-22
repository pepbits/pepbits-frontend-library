import { afterEach, expect, test, vi } from "vitest";
import { RecordEditor, RecordConflict, RecordRejected, type RecordAdapter, type RecordBundle } from "./records";
const empty = (): RecordBundle<{ name: string }> => ({ record: null, draft: null, draftVersion: 0 });
function setup() {
  const adapter = {
    list: vi.fn().mockResolvedValue([]), create: vi.fn(), load: vi.fn().mockResolvedValue(empty()),
    save: vi.fn().mockImplementation(async (_key, values) => ({ record: { values, version: 1, savedAt: '2026-09-07T00:00:00Z' }, draft: null, draftVersion: 1 })),
    draft: vi.fn().mockImplementation(async (_key, values, baseVersion, version) => ({ values, baseVersion, version: version + 1, savedAt: '2026-09-07T00:00:00Z' })),
    discard: vi.fn().mockResolvedValue(undefined),
  };
  const editor = new RecordEditor(adapter as RecordAdapter, 'record', { name: 'initial' });
  editor.start();
  return { editor, adapter };
}
afterEach(() => vi.useRealTimers());
test('recovery is explicit and draft acknowledgement never marks the record clean', async () => {
  const { editor, adapter } = setup(); await vi.waitFor(() => expect(editor.snapshot().loading).toBe(false));
  editor.update({ name: 'edited' }); await editor.saveDraft();
  expect(editor.dirty).toBe(true); expect(editor.snapshot().draftSaved).toBe(true);
  adapter.load.mockResolvedValue({ ...empty(), draft: { values: { name: 'recovered' }, baseVersion: 0, version: 1, savedAt: '2026-09-07T00:00:00Z' }, draftVersion: 1 });
  const reopened = new RecordEditor(adapter as RecordAdapter, 'record', { name: 'initial' }); reopened.start();
  await vi.waitFor(() => expect(reopened.snapshot().recovery).not.toBeNull());
  expect(reopened.snapshot().values.name).toBe('initial'); reopened.restore();
  expect(reopened.snapshot().values.name).toBe('recovered'); expect(reopened.dirty).toBe(true);
  editor.stop(); reopened.stop();
});
test('edits typed during save remain dirty after the submitted snapshot is acknowledged', async () => {
  const { editor, adapter } = setup(); await vi.waitFor(() => expect(editor.snapshot().loading).toBe(false));
  let resolve!: (value: unknown) => void;
  adapter.save.mockImplementation(() => new Promise(r => { resolve = r; }));
  editor.update({ name: 'submitted' }); const saving = editor.save();
  editor.update({ name: 'newer' });
  resolve({ record: { values: { name: 'submitted' }, version: 1, savedAt: 'now' }, draftVersion: 1 }); await saving;
  expect(editor.snapshot().values.name).toBe('newer'); expect(editor.snapshot().baseline.name).toBe('submitted'); expect(editor.dirty).toBe(true); editor.stop();
});
test('failed saves retain edits and retry the identical operation id', async () => {
  const { editor, adapter } = setup(); await vi.waitFor(() => expect(editor.snapshot().loading).toBe(false));
  adapter.save.mockRejectedValueOnce(new Error('Connection lost'));
  editor.update({ name: 'draft' }); expect(await editor.save()).toBe(false);
  expect(editor.dirty).toBe(true); await editor.retry();
  expect(adapter.save.mock.calls[1]!).toEqual(adapter.save.mock.calls[0]!); expect(editor.dirty).toBe(false); editor.stop();
});
test('conflicts require fetching and reviewing latest before keeping edits', async () => {
  const { editor, adapter } = setup(); await vi.waitFor(() => expect(editor.snapshot().loading).toBe(false));
  editor.update({ name: 'mine' }); adapter.save.mockRejectedValueOnce(new RecordConflict()); await editor.save();
  editor.keepEdits(); expect(editor.snapshot().conflict).toBe(true);
  adapter.load.mockResolvedValue({ record: { values: { name: 'theirs' }, version: 2, savedAt: 'now' }, draft: null, draftVersion: 3 });
  await editor.review(); expect(editor.snapshot().values.name).toBe('mine'); expect(editor.snapshot().baseline.name).toBe('theirs');
  editor.keepEdits(); await editor.save(); expect(adapter.save.mock.calls[1]![2]).toBe(2); editor.stop();
});
test('failed initial load prevents writes and retry loads safely', async () => {
  const { editor, adapter } = setup(); await vi.waitFor(() => expect(editor.snapshot().loading).toBe(false)); editor.stop();
  adapter.load.mockRejectedValueOnce(new Error('offline'));
  const other = new RecordEditor(adapter as RecordAdapter, 'other', { name: 'initial' }); other.start();
  await vi.waitFor(() => expect(other.snapshot().error).toBe('offline'));
  other.update({ name: 'bad' }); expect(other.snapshot().values.name).toBe('initial'); await other.save(); expect(adapter.save).not.toHaveBeenCalled();
  await other.retry(); expect(other.snapshot().ready).toBe(true); other.stop();
});
test('closing waits for pending draft acknowledgement before discarding its revision', async () => {
  const { editor, adapter } = setup(); await vi.waitFor(() => expect(editor.snapshot().loading).toBe(false));
  let resolve!: (value: unknown) => void;
  adapter.draft.mockImplementation(() => new Promise(r => { resolve = r; }));
  editor.update({ name: 'draft' }); const pending = editor.saveDraft(); const closing = editor.close();
  expect(adapter.discard).not.toHaveBeenCalled();
  resolve({ values: { name: 'draft' }, version: 4, baseVersion: 0, savedAt: 'now' }); await pending; await closing;
  expect(adapter.discard.mock.calls[0]![1]).toBe(4);
});
test('creation retries the same destination and subsequent saves update that record', async () => {
  const { editor: unused, adapter } = setup(); unused.stop();
  adapter.create.mockRejectedValueOnce(new Error('lost response')).mockResolvedValue({ record: { values: { name: 'created' }, version: 1, savedAt: 'now' }, draft: null, draftVersion: 0, recordKey: 'created-key' });
  const generate = vi.fn().mockReturnValue('created-key');
  const editor = new RecordEditor(adapter as RecordAdapter, 'new-slot', { name: 'initial' }, generate);
  editor.start(); await vi.waitFor(() => expect(editor.snapshot().ready).toBe(true));
  editor.update({ name: 'created' }); await editor.save(); await editor.retry();
  expect(generate).toHaveBeenCalledTimes(1); expect(adapter.create.mock.calls[0]!).toEqual(adapter.create.mock.calls[1]!);
  editor.update({ name: 'updated' }); await editor.save(); expect(adapter.save.mock.calls[0]![0]).toBe('created-key'); editor.stop();
});
test('a failed conflict review cannot authorize overwriting the remote draft', async () => {
  const { editor, adapter } = setup(); await vi.waitFor(() => expect(editor.snapshot().ready).toBe(true));
  editor.update({ name: 'mine' }); adapter.save.mockRejectedValue(new RecordConflict()); await editor.save();
  adapter.load.mockRejectedValue(new Error('offline')); await editor.review(); editor.keepEdits();
  expect(editor.snapshot().conflict).toBe(true); expect(editor.snapshot().reviewed).toBe(false); editor.stop();
});

test('definitively rejected values can be corrected without retrying the rejected snapshot', async () => {
  const { editor, adapter } = setup(); await vi.waitFor(() => expect(editor.snapshot().ready).toBe(true));
  editor.update({ name: 'rejected' }); adapter.save.mockRejectedValueOnce(new RecordRejected('Correct the values')); await editor.save();
  await editor.retry(); expect(adapter.save).toHaveBeenCalledTimes(1);
  editor.update({ name: 'corrected' }); expect(await editor.save()).toBe(true);
  expect(adapter.save.mock.calls[1]![1]).toEqual({ name: 'corrected' });
  expect(adapter.save.mock.calls[1]![4]).not.toBe(adapter.save.mock.calls[0]![4]); editor.stop();
});

test('redacted partial drafts restore against current defaults and incompatible drafts can be discarded',async()=>{
 const {adapter,editor}=setup();editor.stop();
 adapter.load.mockResolvedValue({...empty(),draft:{values:{},baseVersion:0,version:1,savedAt:'2026-09-08T00:00:00Z',excludedFields:['name']},draftVersion:1} as any);
 const partial=new RecordEditor(adapter as RecordAdapter,'record',{name:'initial'});partial.start();await vi.waitFor(()=>expect(partial.snapshot().recovery).not.toBeNull());partial.restore();expect(partial.snapshot().values).toEqual({name:'initial'});partial.stop();
 adapter.load.mockResolvedValue({...empty(),draft:{values:{name:'old'},schemaVersion:99,baseVersion:0,version:1,savedAt:'2026-09-08T00:00:00Z'},draftVersion:1} as any);
 const stale=new RecordEditor(adapter as RecordAdapter,'record',{name:'initial'});stale.start();await vi.waitFor(()=>expect(stale.snapshot().incompatibleDraft).toBe(true));stale.restore();expect(stale.snapshot().values.name).toBe('initial');adapter.load.mockResolvedValue(empty());await stale.discard();expect(stale.snapshot().recovery).toBeNull();stale.stop();
});
test('disabled tenant draft storage prevents autosave without blocking business save',async()=>{
 const {adapter,editor}=setup();editor.stop();adapter.load.mockResolvedValue({...empty(),draftPolicy:{revision:1,enabled:false,retentionDays:7,excludedFields:[]}} as any);
 const disabled=new RecordEditor(adapter as RecordAdapter,'record',{name:'initial'});disabled.start();await vi.waitFor(()=>expect(disabled.snapshot().ready).toBe(true));disabled.update({name:'edited'});await disabled.saveDraft();expect(adapter.draft).not.toHaveBeenCalled();expect(await disabled.save()).toBe(true);disabled.stop();
});
