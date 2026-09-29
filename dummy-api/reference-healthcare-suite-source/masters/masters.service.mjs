// Adapted from healthcare-suite/backend/src/masters/masters.service.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import { NotFoundException } from '../runtime.mjs';
import { CsvStore } from '../common/csv-store.service.mjs';
import { ValidationFailed } from '../common/errors.mjs';
import { paginate } from '../common/query.mjs';
import { ENTITIES } from './entities.mjs';
export class MastersService {
    store;
    constructor(store){
        this.store = store;
    }
    def(entity) {
        const d = ENTITIES[entity];
        if (!d) throw new NotFoundException(`Unknown master "${entity}"`);
        return d;
    }
    expand(def, row) {
        const out = {
            ...row
        };
        for (const ref of def.refs ?? []){
            const target = row[ref.field] ? this.store.find(ref.table, row[ref.field]) : undefined;
            out[ref.as] = target ? target[ref.labelField ?? 'name'] : '';
        }
        return out;
    }
    list(entity, q) {
        const def = this.def(entity);
        const rows = this.store.all(def.table).map((r)=>this.expand(def, r));
        return paginate(rows, {
            sort: 'code',
            ...q
        }, [
            ...def.search,
            ...(def.refs ?? []).map((r)=>r.as)
        ]);
    }
    get(entity, id) {
        const def = this.def(entity);
        return this.expand(def, this.store.get(def.table, id, def.label));
    }
    lookups(entity, q) {
        const def = this.def(entity);
        const includeInactive = q.includeInactive === 'true';
        const filters = {
            ...q
        };
        delete filters.includeInactive;
        const rows = this.store.all(def.table).map((r)=>this.expand(def, r)).filter((r)=>includeInactive || !r.status || r.status === 'Active');
        const { data } = paginate(rows, {
            ...filters,
            pageSize: 1000,
            sort: filters.sort ?? (rows[0]?.name !== undefined ? 'name' : 'id')
        }, def.search);
        return data.map((r)=>({
                value: r.id,
                label: def.lookupLabel ? def.lookupLabel(r) : r[def.labelField ?? 'name'],
                code: r.code ?? '',
                meta: r
            }));
    }
    create(entity, body) {
        const def = this.def(entity);
        const row = this.clean(def, body);
        this.validate(def, row);
        row.id = this.store.nextKey(def.table, 'id', def.idPrefix, 3);
        if (!row.status) row.status = 'Active';
        return this.expand(def, this.store.insert(def.table, row));
    }
    update(entity, id, body) {
        const def = this.def(entity);
        const existing = this.store.get(def.table, id, def.label);
        const row = {
            ...existing,
            ...this.clean(def, body),
            id
        };
        this.validate(def, row, id);
        return this.expand(def, this.store.update(def.table, id, row));
    }
    setStatus(entity, id, status) {
        const def = this.def(entity);
        this.store.get(def.table, id, def.label);
        return this.expand(def, this.store.update(def.table, id, {
            status
        }));
    }
    clean(def, body) {
        const cols = new Set(this.store.columns(def.table));
        const out = {};
        for (const [k, v] of Object.entries(body ?? {}))if (cols.has(k) && k !== 'id') out[k] = typeof v === 'string' ? v.trim() : v;
        return out;
    }
    validate(def, row, selfId) {
        const errors = {};
        for (const f of def.required)if (row[f] === undefined || row[f] === null || String(row[f]).trim() === '') errors[f] = 'This field is required';
        for (const f of def.unique ?? []){
            if (!row[f]) continue;
            const clash = this.store.all(def.table).find((r)=>r.id !== selfId && String(r[f]).toLowerCase() === String(row[f]).toLowerCase());
            if (clash) errors[f] = `Already used by ${clash.name ?? clash.id}`;
        }
        for (const ref of def.refs ?? []){
            if (row[ref.field] && !this.store.find(ref.table, row[ref.field])) errors[ref.field] = 'Selected record no longer exists';
        }
        for (const [k, v] of Object.entries(def.validate?.(this.expand(def, row)) ?? {}))if (v) errors[k] = v;
        if (Object.keys(errors).length) throw new ValidationFailed(errors);
    }
}
