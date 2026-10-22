import {DEFAULT_DRAFT_POLICY, filterDraftValues, parseDraftPolicy, type DraftPolicy} from './draft-policy';
import {draftContext} from './drafts';
import {RecordConflict, RecordRejected, type DraftSnapshot, type RecordAdapter, type RecordBundle} from './records';

export interface MemoryRecordOptions {
  /** Effective host policy, read on every operation. No personal policy override. */
  draftPolicy?: () => DraftPolicy;
  now?: () => number;
}
type Values = Record<string, unknown>;
type Result = RecordBundle<Values> | DraftSnapshot<Values> | undefined;
interface Entry extends RecordBundle<Values> {
  operations: Map<string, {fingerprint: string; result: Result; draft: boolean}>;
}

/** Volatile, isolated single-user transport. Create a separate instance for each
 * authenticated scope. It supplies no authorization, persistence or product data.
 * Version checks and successful operation replay follow the record HTTP contract.
 */
export function createMemoryRecordAdapter({draftPolicy = () => DEFAULT_DRAFT_POLICY, now = () => Date.now()}: MemoryRecordOptions = {}): RecordAdapter {
  const entries = new Map<string, Entry>();
  const policy = () => parseDraftPolicy(draftPolicy());
  const entryFor = (key: string, rules: DraftPolicy) => {
    const entry = entries.get(key) ?? {record: null, draft: null, draftVersion: 0, operations: new Map()};
    if (entry.draft) {
      const snapshot = entry.draft;
      const filtered = filterDraftValues(snapshot.values, rules);
      if (!rules.enabled || Date.parse(snapshot.savedAt) + rules.retentionDays * 86400000 <= now()) {
        entry.draft = null;
        entry.draftVersion++;
      } else if (JSON.stringify(filtered.values) !== JSON.stringify(snapshot.values)) {
        entry.draft = {...snapshot, values: filtered.values, excludedFields: [...new Set([...(snapshot.excludedFields ?? []), ...filtered.excludedFields])], version: ++entry.draftVersion};
      }
    }
    for (const [id, operation] of entry.operations) {
      if (!operation.draft) continue;
      const snapshot = operation.result as DraftSnapshot<Values>;
      if (!rules.enabled || Date.parse(snapshot.savedAt) + rules.retentionDays * 86400000 <= now() ||
        JSON.stringify(filterDraftValues(snapshot.values, rules).values) !== JSON.stringify(snapshot.values)) entry.operations.delete(id);
    }
    return entry;
  };
  const bundle = (entry: Entry, rules?: DraftPolicy): RecordBundle<Values> => structuredClone({record: entry.record, draft: entry.draft, draftVersion: entry.draftVersion, ...(rules ? {draftPolicy: rules} : {})});
  const clearDraftReplays = (entry: Entry) => {
    for (const [id, operation] of entry.operations) if (operation.draft) entry.operations.delete(id);
  };
  async function change(key: string, action: 'save' | 'create' | 'draft' | 'discard', body: {
    values?: unknown; version: number; draftVersion?: number; baseVersion?: number; destinationKey?: string; operationId: string;
  }): Promise<Result> {
    // Snapshot before hashing so callers cannot mutate an in-flight command.
    body = structuredClone(body);
    if (!Number.isSafeInteger(body.version) || body.version < 0 || !/^[a-zA-Z0-9-]{1,80}$/.test(body.operationId)) throw new RecordRejected('A version and operation id are required.');
    if (action !== 'discard' && (!body.values || typeof body.values !== 'object' || Array.isArray(body.values))) throw new RecordRejected('Expected record values.');
    const fingerprint = await draftContext([action, body]);
    // No await from this point: comparison, mutation and replay registration are atomic.
    const rules = policy(), entry = entryFor(key, rules);
    const savedAt = new Date(now()).toISOString();
    if (action === 'draft' && !rules.enabled) return {values: {}, version: entry.draftVersion, baseVersion: body.baseVersion!, savedAt, disabled: true};
    const previous = entry.operations.get(body.operationId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new RecordConflict();
      return structuredClone(previous.result);
    }
    if (action === 'save' && (body.version !== (entry.record?.version ?? 0) || body.draftVersion !== entry.draftVersion) ||
      action === 'draft' && (body.version !== entry.draftVersion || body.baseVersion !== (entry.record?.version ?? 0)) ||
      action === 'discard' && body.version !== entry.draftVersion) throw new RecordConflict();
    if (action === 'create') {
      if (typeof body.destinationKey !== 'string' || body.destinationKey.length > 300 || body.destinationKey === key) throw new RecordRejected('Invalid destination key.');
      if (body.draftVersion !== entry.draftVersion || entries.has(body.destinationKey)) throw new RecordConflict();
    }
    const version = ++entry.draftVersion;
    let result: Result;
    if (action === 'draft') {
      entry.draft = {...filterDraftValues(body.values as Values, rules), schemaVersion: 1, baseVersion: body.baseVersion!, version, savedAt};
      result = entry.draft;
    } else {
      entry.draft = null;
      clearDraftReplays(entry);
      if (action === 'save') {
        entry.record = {values: body.values as Values, version: body.version + 1, savedAt};
        result = bundle(entry);
      } else if (action === 'create') {
        const destination: Entry = {record: {values: body.values as Values, version: 1, savedAt}, draft: null, draftVersion: 0, operations: new Map()};
        entries.set(body.destinationKey!, destination);
        result = {...bundle(destination), recordKey: body.destinationKey};
      }
    }
    entry.operations.set(body.operationId, {fingerprint, result: structuredClone(result), draft: action === 'draft'});
    for (const id of [...entry.operations.keys()].slice(0, Math.max(0, entry.operations.size - 200))) entry.operations.delete(id);
    entries.set(key, entry);
    return structuredClone(result);
  }
  return {
    async list<T>(scope: string) {
      const parts: unknown = JSON.parse(scope);
      if (!Array.isArray(parts) || parts.length !== 2 || parts.some(part => typeof part !== 'string') || !parts[1]) throw new Error('Invalid scope');
      return [...entries].flatMap(([key, entry]) => {
        if (!entry.record) return [];
        let target: unknown;
        try { target = JSON.parse(key); } catch { return []; }
        return Array.isArray(target) && target[0] === parts[0] && typeof target[1] === 'string' && target[1].startsWith(parts[1]) ? [{key, record: structuredClone(entry.record) as import('./records').RecordSnapshot<T>}] : [];
      });
    },
    async load<T>(key: string) { const rules = policy(); return bundle(entryFor(key, rules), rules) as RecordBundle<T>; },
    async create<T>(key: string, destinationKey: string, values: T, draftVersion: number, operationId: string) { return await change(key, 'create', {destinationKey, values, version: 0, draftVersion, operationId}) as RecordBundle<T>; },
    async save<T>(key: string, values: T, version: number, draftVersion: number, operationId: string) { return await change(key, 'save', {values, version, draftVersion, operationId}) as RecordBundle<T>; },
    async draft<T>(key: string, values: T, baseVersion: number, version: number, operationId: string) { return await change(key, 'draft', {values, baseVersion, version, operationId}) as DraftSnapshot<T>; },
    async discard(key, version, operationId) { await change(key, 'discard', {version, operationId}); },
  };
}
