import {mergeDraftValues,type DraftPolicy} from "./draft-policy";
/** Replace this transport when connecting a product's own record service. */
export interface RecordSnapshot<T> {
    values: T;
    version: number;
    savedAt: string;
}
export interface DraftSnapshot<T> {
    schemaVersion?:number;
    excludedFields?:string[];
    disabled?:boolean;
    values: T;
    baseVersion: number;
    version: number;
    savedAt: string;
}
export interface RecordBundle<T> {
    draftPolicy?:DraftPolicy;
    record: RecordSnapshot<T> | null;
    draft: DraftSnapshot<T> | null;
    draftVersion: number;
    recordKey?: string;
}
export interface RecordAdapter {
    list<T>(scope: string): Promise<Array<{
        key: string;
        record: RecordSnapshot<T>;
    }>>;
    load<T>(key: string): Promise<RecordBundle<T>>;
    create<T>(key: string, destinationKey: string, values: T, draftVersion: number, operationId: string): Promise<RecordBundle<T>>;
    save<T>(key: string, values: T, version: number, draftVersion: number, operationId: string): Promise<RecordBundle<T>>;
    draft<T>(key: string, values: T, baseVersion: number, version: number, operationId: string): Promise<DraftSnapshot<T>>;
    discard(key: string, version: number, operationId: string): Promise<void>;
}
/** A definitive rejection (400/413/422), safe to amend and submit as a new operation. */
export class RecordRequestFailure extends Error {
    constructor(public status?: number, public reference?: string) { super("Request failed"); }
}
export class RecordRejected extends Error {
    status = 422;
    constructor(message: string, public fieldErrors: Record<string, string> = {}, public reference?: string) { super(message); }
}
export class RecordConflict extends Error {
    constructor() { super("A newer version exists. Review it before saving again."); }
}
export function createHttpRecordAdapter(fetcher: (path: string, init?: RequestInit) => Promise<Response>): RecordAdapter {
    async function request(key: string, action = "", body?: unknown) {
        const response = await fetcher(`/records/${encodeURIComponent(key)}${action}`, body === undefined ? undefined : {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if ([400, 413, 422].includes(response.status)) {
            const body = await response.json().catch(() => ({}));
            const fields: Record<string, string> = {};
            if (body.fieldErrors && typeof body.fieldErrors === "object")
                for (const [key, value] of Object.entries(body.fieldErrors))
                    if (typeof value === "string")
                        fields[key] = value;
            throw new RecordRejected("The service rejected these values. Correct the record, then save again.", fields, response.headers.get("X-Sentinel-Reference") ?? undefined);
        }
        if (response.status === 409)
            throw new RecordConflict();
        if (!response.ok)
            throw new RecordRequestFailure(response.status, response.headers.get("X-Sentinel-Reference") ?? undefined);
        if (response.status === 204)
            return;
        const result = await response.json();
        if (!result || typeof result !== "object")
            throw new Error("The record service returned an invalid response.");
        const snapshot = (value: any, draft = false) => value && typeof value === "object" &&
            value.values && typeof value.values === "object" && !Array.isArray(value.values) &&
            Number.isSafeInteger(value.version) && (value.version > 0 || value.disabled===true && value.version===0) &&
            typeof value.savedAt === "string" && Number.isFinite(Date.parse(value.savedAt)) &&
            (!draft || (Number.isSafeInteger(value.baseVersion) && value.baseVersion >= 0));
        const valid = action === "/draft" ? snapshot(result, true) :
            (result.record === null || snapshot(result.record)) &&
                (result.draft === null || snapshot(result.draft, true)) &&
                Number.isSafeInteger(result.draftVersion) && result.draftVersion >= 0;
        if (!valid)
            throw new Error("The record service returned an invalid snapshot. Your edits have been retained.");
        return result;
    }
    return {
        list: async (scope) => {
            const response = await fetcher(`/records?scope=${encodeURIComponent(scope)}`);
            if (!response.ok)
                throw new Error("Saved records could not be loaded.");
            const result = await response.json();
            if (!Array.isArray(result.records) || result.records.some((item: any) => {
                try {
                    const key = JSON.parse(item.key);
                    return !Array.isArray(key) || key.length !== 2 || key.some(value => typeof value !== "string") || !item.record?.values || typeof item.record.values !== "object";
                }
                catch {
                    return true;
                }
            }))
                throw new Error("Invalid record list.");
            return result.records;
        },
        load: (key) => request(key),
        create: (key, destinationKey, values, draftVersion, operationId) => request(key, "/create", { destinationKey, values, draftVersion, version: 0, operationId }),
        save: (key, values, version, draftVersion, operationId) => request(key, "", { values, version, draftVersion, operationId }),
        draft: (key, values, baseVersion, version, operationId) => request(key, "/draft", { values, baseVersion, version, operationId }),
        discard: (key, version, operationId) => request(key, "/discard", { version, operationId }),
    };
}
export interface EditorState<T> {
    draftPolicy?:DraftPolicy;
    draftSavedAt?:string;
    incompatibleDraft?:boolean;
    excludedFields?:string[];
    values: T;
    baseline: T;
    version: number;
    draftVersion: number;
    fieldErrors: Record<string, string>;
    ready: boolean;
    loading: boolean;
    busy: boolean;
    error: string | null;
    failure?: {status?:number;reference?:string};
    rejected: boolean;
    conflict: boolean;
    reviewed: boolean;
    recovery: DraftSnapshot<T> | null;
    remoteDraft: DraftSnapshot<T> | null;
    recordKey?: string;
    lastSaved: string | null;
    draftSaved: boolean;
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function assertShape(seed: unknown, value: unknown): void {
    if (Array.isArray(seed)) {
        if (!Array.isArray(value))
            throw new Error("Saved record shape is incompatible with this editor.");
        if (seed.length)
            value.forEach(item => assertShape(seed[0], item));
    }
    else if (seed !== null && typeof seed === "object") {
        if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error("Saved record shape is incompatible with this editor.");
        for (const [key, initial] of Object.entries(seed))
            assertShape(initial, (value as Record<string, unknown>)[key]);
    }
    else if (seed === "" && (typeof value === "string" || (typeof value === "number" && Number.isFinite(value)))) {
        return;
    }
    else if (typeof seed !== typeof value || (typeof value === "number" && !Number.isFinite(value))) {
        throw new Error("Saved record shape is incompatible with this editor.");
    }
}
const operationId = () => crypto.randomUUID();
/** One controller per document; requests serialize and retain their identity on retry.
 * No browser persistence: only acknowledged service drafts survive a crash.
 */
export class RecordEditor<T> {
    private state: EditorState<T>;
    private listeners = new Set<() => void>();
    private timer: ReturnType<typeof setTimeout> | undefined;
    private started = false;
    private pending: (() => Promise<void>) | null = null;
    private active = true;
    private closing = false;
    private inFlight: Promise<void> | null = null;
    constructor(private adapter: RecordAdapter, private key: string, initial: T, private createKey?: () => string) {
        this.state = { values: initial, baseline: initial, version: 0, draftVersion: 0, fieldErrors: {}, ready: false, loading: true, busy: false, error: null, rejected: false, conflict: false, reviewed: false, recovery: null, remoteDraft: null, lastSaved: null, draftSaved: false };
    }
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    snapshot = () => this.state;
    get dirty() { return !equal(this.state.values, this.state.baseline); }
    private patch(next: Partial<EditorState<T>>) { if (!this.active)
        return; this.state = { ...this.state, ...next }; this.listeners.forEach(fn => fn()); }
    start = () => { if (!this.started) {
        this.started = true;
        void this.load();
    } };
    private async load() {
        this.patch({ loading: true, error: null, failure: undefined });
        try {
            const result = await this.adapter.load<T>(this.key);
            if (result.record)
                assertShape(this.state.baseline, result.record.values);
            let incompatibleDraft=false;
            if(result.draft){
                result.draft={...result.draft,values:mergeDraftValues(result.record?.values??this.state.baseline,result.draft.values)};
                try{assertShape(this.state.baseline,result.draft.values);if((result.draft.schemaVersion??1)!==1)incompatibleDraft=true;}catch{incompatibleDraft=true;}
            }
            const baseline = result.record?.values ?? this.state.baseline;
            this.patch({ baseline, values: baseline, version: result.record?.version ?? 0,
                draftPolicy:result.draftPolicy,incompatibleDraft,excludedFields:result.draft?.excludedFields,
                draftVersion: result.draftVersion, recovery: result.draft,
                lastSaved: result.record?.savedAt ?? null, conflict: false, rejected: false, reviewed: false, ready: true, loading: false });
        }
        catch (e) {
            this.patch({ error: String((e as Error).message), failure: e as RecordRequestFailure, loading: false });
        }
    }
    update = (next: T | ((previous: T) => T)) => {
        if (!this.state.ready || this.state.loading || this.state.recovery)
            return;
        if (this.state.rejected)
            this.patch({ rejected: false, error: null, fieldErrors: {} });
        this.patch({ values: typeof next === "function" ? (next as (p: T) => T)(this.state.values) : next, draftSaved: false });
        this.schedule();
    };
    private schedule() {
        clearTimeout(this.timer);
        if (this.state.draftPolicy?.enabled!==false && this.active && !this.closing && this.dirty && !this.state.error && !this.state.busy && !this.state.conflict && !this.state.recovery) {
            this.timer = setTimeout(() => void this.saveDraft(), 800);
        }
    }
    private run(operation: () => Promise<void>): Promise<void> {
        if (!this.active || this.state.busy)
            return Promise.resolve();
        clearTimeout(this.timer);
        this.pending = operation;
        this.patch({ busy: true, error: null, failure: undefined, fieldErrors: {}, rejected: false });
        this.inFlight = (async () => {
            try {
                await operation();
                this.pending = null;
            }
            catch (e) {
                if (e instanceof RecordRejected)
                    this.pending = null;
                this.patch({ failure: e as RecordRequestFailure, error: (e as Error).message, rejected: e instanceof RecordRejected, fieldErrors: e instanceof RecordRejected ? e.fieldErrors : {}, conflict: e instanceof RecordConflict || this.state.conflict, reviewed: false });
            }
            finally {
                this.patch({ busy: false });
                if (!this.state.draftSaved)
                    this.schedule();
            }
        })();
        return this.inFlight;
    }
    saveDraft = async () => {
        if(this.state.draftPolicy?.enabled===false || !this.dirty)return;
        if (!this.state.ready || this.state.loading || this.state.busy || this.state.recovery || this.state.error || this.state.conflict)
            return;
        const { values, version, draftVersion } = this.state;
        const id = operationId();
        await this.run(async () => {
            const draft = await this.adapter.draft(this.key, values, version, draftVersion, id);
            this.patch({ draftVersion: draft.version, draftSaved: !draft.disabled&&equal(values, this.state.values),draftSavedAt:draft.disabled?undefined:draft.savedAt,excludedFields:draft.excludedFields,
                ...(draft.disabled?{draftPolicy:{revision:0,retentionDays:7,excludedFields:[],...this.state.draftPolicy,enabled:false}}:{}) });
        });
    };
    save = async () => {
        if (!this.state.ready || this.state.loading || this.state.busy || this.state.recovery || this.state.error || this.state.conflict)
            return false;
        const { values, version, draftVersion } = this.state;
        const id = operationId();
        const destination = this.createKey?.();
        await this.run(async () => {
            const result = destination
                ? await this.adapter.create(this.key, destination, values, draftVersion, id)
                : await this.adapter.save(this.key, values, version, draftVersion, id);
            if (!result.record)
                throw new Error("The service did not confirm the save.");
            if (destination) {
                this.key = result.recordKey ?? destination;
                this.createKey = undefined;
            }
            this.patch({ recordKey: result.recordKey, baseline: result.record.values, version: result.record.version, draftVersion: result.draftVersion, lastSaved: result.record.savedAt, draftSaved: false });
        });
        return this.active && !this.closing && !this.state.error;
    };
    retry = async () => {
        if (this.state.busy || this.state.conflict || this.state.rejected)
            return;
        if (this.pending)
            await this.run(this.pending);
        else
            await this.load();
    };
    restore = () => {
        const draft = this.state.recovery;
        if (!draft || this.state.incompatibleDraft)
            return;
        this.patch({ values: draft.values, recovery: null, draftSaved: true,
            conflict: draft.baseVersion !== this.state.version,
            error: draft.baseVersion !== this.state.version ? "The saved record changed after this draft. Review the newer version." : null });
    };
    discard = async () => {
        if (this.state.busy || this.state.loading)
            return;
        const version = this.state.draftVersion;
        const id = operationId();
        await this.run(async () => {
            await this.adapter.discard(this.key, version, id);
            this.patch({ values: this.state.baseline, recovery: null, ready: false, draftSaved: false });
            await this.load();
        });
    };
    /** Fetch latest without replacing the local edits; explicit review precedes overwrite. */
    review = async () => {
        if (this.state.busy)
            return;
        await this.run(async () => {
            const latest = await this.adapter.load<T>(this.key);
            if (latest.record)
                assertShape(this.state.baseline, latest.record.values);
            if(latest.draft)latest.draft={...latest.draft,values:mergeDraftValues(latest.record?.values??this.state.baseline,latest.draft.values)};
            this.patch({ baseline: latest.record?.values ?? this.state.baseline, version: latest.record?.version ?? 0,
                draftVersion: latest.draftVersion, lastSaved: latest.record?.savedAt ?? null, conflict: true,
                remoteDraft: latest.draft, reviewed: true, error: "Compare your edits with the saved values, then choose which version to keep." });
        });
    };
    keepEdits = () => { if (!this.state.reviewed)
        return; this.pending = null; this.patch({ conflict: false, reviewed: false, error: null, recovery: null }); this.schedule(); };
    close = async () => {
        this.closing = true;
        clearTimeout(this.timer);
        await this.inFlight;
        try {
            if (this.dirty || this.state.recovery)
                await this.adapter.discard(this.key, this.state.draftVersion, operationId());
        }
        finally {
            this.stop();
        }
    };
    stop = () => { this.active = false; clearTimeout(this.timer); this.listeners.clear(); };
}
