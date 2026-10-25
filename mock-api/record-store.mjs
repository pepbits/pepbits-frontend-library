import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import {filterDraftValues} from '../desktop-clients/packages/erp-config/src/draft-policy.ts';

/** Demo JSON store. A production adapter must use transactions and authorization. */
export function createRecordStore(file, {draftPolicy, now=()=>Date.now()}={}) {
  let data = {};
  try { data = JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = (entry, userId) => ({ record: entry.record ?? null,
    draft: entry.drafts?.[userId]?.snapshot ?? null, draftVersion: entry.drafts?.[userId]?.version ?? 0 });
  const persist=updated=>{
    mkdirSync(dirname(file),{recursive:true,mode:0o700});
    writeFileSync(`${file}.tmp`,JSON.stringify(updated),{mode:0o600});renameSync(`${file}.tmp`,file);data=updated;
  };
  const filter=(values,policy,key)=>{
    let logical;try{logical=JSON.parse(key)[1];}catch{}
    if(typeof logical==='string'&&logical.startsWith('$draft:')){const clean=filterDraftValues(values.data,policy);return {...clean,values:{...values,data:clean.values}};}
    return filterDraftValues(values,policy);
  };
  function scrub(user,product,policy) {
    const updated=structuredClone(data);let changed=false;
    for(const [id,entry] of Object.entries(updated)) {
      const [tenant,key]=JSON.parse(id);let app;try{app=JSON.parse(key)[0];}catch{continue;}
      if(tenant!==user.tenantId||app!==product)continue;
      for(const draft of Object.values(entry.drafts??{}))if(draft.snapshot){
        const snapshot=draft.snapshot;
        if(!policy.enabled||Date.parse(snapshot.savedAt)+policy.retentionDays*86400000<=now()){
          draft.snapshot=null;draft.version++;changed=true;
        }else{
          const filtered=filter(snapshot.values,policy,key);
          if(JSON.stringify(filtered.values)!==JSON.stringify(snapshot.values)){
            snapshot.values=filtered.values;snapshot.excludedFields=[...new Set([...(snapshot.excludedFields??[]),...filtered.excludedFields])];
            draft.version++;snapshot.version=draft.version;changed=true;
          }
        }
      }
      // Draft replay responses must not retain values excluded or expired by policy.
      for(const [op,previous] of Object.entries(entry.operations??{})) {
        const response=previous.response?.body;
        if(response){const snap=Object.hasOwn(response,'baseVersion')?response:response.draft;if(snap&&(!policy.enabled||Date.parse(snap.savedAt)+policy.retentionDays*86400000<=now()||JSON.stringify(filter(snap.values,policy,key).values)!==JSON.stringify(snap.values))){delete entry.operations[op];changed=true;}}
      }
    }
    if(changed)persist(updated);
  }
  return {
    scrub,
    prune(){if(!draftPolicy)return;const seen=new Set();for(const id of Object.keys(data)){
      const [tenantId,key]=JSON.parse(id);let product;try{product=JSON.parse(key)[0];}catch{continue;}
      const scope=JSON.stringify([tenantId,product]);if(seen.has(scope))continue;seen.add(scope);const user={tenantId};scrub(user,product,draftPolicy(user,product));
    }},
    draftKey(user,product,reference){
      for(const [id,entry] of Object.entries(data)){
        const [tenant,key]=JSON.parse(id);let app;try{app=JSON.parse(key)[0];}catch{continue;}
        if(tenant===user.tenantId&&app===product&&entry.drafts?.[user.id]&&createHash('sha256').update(JSON.stringify([tenant,user.id,key])).digest('hex')===reference)return key;
      }
      return null;
    },
    draftIndex(user,product) {
      if(draftPolicy)scrub(user,product,draftPolicy(user,product));
      return Object.entries(data).flatMap(([id,entry])=>{
        const [tenant,key]=JSON.parse(id);let parts;try{parts=JSON.parse(key);}catch{return [];}
        const snapshot=entry.drafts?.[user.id]?.snapshot;
        if(tenant!==user.tenantId||parts[0]!==product||!snapshot)return [];
        return [{key,id:createHash('sha256').update(JSON.stringify([tenant,user.id,key])).digest('hex'),version:snapshot.version,savedAt:snapshot.savedAt,baseVersion:snapshot.baseVersion,recordVersion:entry.record?.version??0,schemaVersion:snapshot.schemaVersion??1,context:snapshot.values?.context,payloadVersion:snapshot.values?.schemaVersion}];
      });
    },
    list(user, scope) {
      const [product, prefix] = JSON.parse(scope);
      if (typeof product !== 'string' || typeof prefix !== 'string' || !prefix) throw new Error('Invalid scope');
      const records = [];
      for (const [id, entry] of Object.entries(data)) {
        const [tenant, key] = JSON.parse(id);
        if (tenant !== user.tenantId || !entry.record) continue;
        let parts;
        try { parts = JSON.parse(key); } catch { continue; }
        if (parts[0] === product && typeof parts[1] === 'string' && parts[1].startsWith(prefix)) records.push({ key, record: entry.record });
      }
      return records;
    },
    handle(user, key, action, body) {
      let product;try{product=JSON.parse(key)[0];}catch{/* Legacy custom adapter key. */}
      const policy=draftPolicy?.(user,product);
      // Reads also enforce retention, including after a long process shutdown.
      if(policy)scrub(user,product,policy);
      const id = JSON.stringify([user.tenantId, key]);
      const entry = data[id] ?? { record: null, drafts: {}, operations: {} };
      if (action === 'load') return { status: 200, body: {...result(entry,user.id),...(policy?{draftPolicy:policy}:{})} };
      if (!body || !Number.isSafeInteger(body.version) || body.version < 0 ||
          typeof body.operationId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(body.operationId)) {
        return { status: 400, body: { error: 'A version and operation id are required.' } };
      }
      if (action !== 'discard' && (!body.values || typeof body.values !== 'object' || Array.isArray(body.values))) {
        return { status: 400, body: { error: 'Expected record values.' } };
      }
      if(action==='draft'&&policy&&!policy.enabled)return {status:200,body:{values:{},version:entry.drafts?.[user.id]?.version??0,baseVersion:body.baseVersion,savedAt:new Date(now()).toISOString(),disabled:true}};
      const opKey = `${user.id}:${body.operationId}`;
      const fingerprint = createHash('sha256').update(JSON.stringify([action, body])).digest('hex');
      const previous = entry.operations[opKey];
      if (previous) return previous.fingerprint === fingerprint ? previous.response : { status: 409, body: { error: 'Operation id already used.' } };
      const current = result(entry, user.id);
      const conflict = { status: 409, body: { error: 'Version conflict.' } };
      if (action === 'save' && (body.version !== (current.record?.version ?? 0) || body.draftVersion !== current.draftVersion)) return conflict;
      if (action === 'draft' && (body.version !== current.draftVersion || body.baseVersion !== (current.record?.version ?? 0))) return conflict;
      if (action === 'discard' && body.version !== current.draftVersion) return conflict;
      if (action === 'create' && (typeof body.destinationKey !== 'string' || body.destinationKey.length > 300 || body.destinationKey === key)) return { status: 400, body: { error: 'Invalid destination key.' } };
      const destinationId = action === 'create' ? JSON.stringify([user.tenantId, body.destinationKey]) : null;
      if (action === 'create' && (body.draftVersion !== current.draftVersion || data[destinationId])) return conflict;
      const next = structuredClone(entry);
      const savedAt = new Date(now()).toISOString();
      const version = current.draftVersion + 1;
      let response;
      let destinationEntry;
      if (action === 'create') {
        destinationEntry = { record: { values: body.values, version: 1, savedAt }, drafts: {}, operations: {} };
        next.drafts[user.id] = { version, snapshot: null };
        response = { status: 200, body: { ...result(destinationEntry, user.id), recordKey: body.destinationKey } };
      } else if (action === 'save') {
        next.record = { values: body.values, version: body.version + 1, savedAt };
        next.drafts[user.id] = { version, snapshot: null };
        response = { status: 200, body: result(next, user.id) };
      } else if (action === 'draft') {
        const filtered=policy?filter(body.values,policy,key):{values:body.values,excludedFields:[]};
        const snapshot = { ...filtered, schemaVersion:1, baseVersion: body.baseVersion, version, savedAt };
        next.drafts[user.id] = { version, snapshot };
        response = { status: 200, body: snapshot };
      } else {
        next.drafts[user.id] = { version, snapshot: null };
        response = { status: 204 };
      }
      if(['save','create','discard'].includes(action))for(const [op,previous] of Object.entries(next.operations)){
        if(previous.response?.body&&(Object.hasOwn(previous.response.body,'baseVersion')||previous.response.body.draft))delete next.operations[op];
      }
      next.operations[opKey] = { fingerprint, response };
      const keys = Object.keys(next.operations);
      for (const old of keys.slice(0, Math.max(0, keys.length - 200))) delete next.operations[old];
      const updated = { ...data, [id]: next, ...(destinationId ? { [destinationId]: destinationEntry } : {}) };
      // Publish in memory only after the atomic file replacement succeeds.
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
      writeFileSync(`${file}.tmp`, JSON.stringify(updated), { mode: 0o600 });
      renameSync(`${file}.tmp`, file);
      data = updated;
      return response;
    },
  };
}
