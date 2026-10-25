import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validLayout(layout) {
  return object(layout) && object(layout.filters) && Object.keys(layout.filters).length <= 50
    && Object.entries(layout.filters).every(([key,value]) => key.length <= 100 && typeof value === 'string' && value.length <= 2000)
    && Array.isArray(layout.columns) && layout.columns.length > 0 && layout.columns.length <= 100
    && layout.columns.every(key => typeof key === 'string' && key.length > 0 && key.length <= 100)
    && new Set(layout.columns).size === layout.columns.length
    && [10,20,50,100].includes(layout.pageSize)
    && (layout.sort === null || object(layout.sort) && typeof layout.sort.key === 'string' && layout.sort.key.length > 0 && layout.sort.key.length <= 100 && ['asc','desc'].includes(layout.sort.direction));
}
export function createWorkspaceStore(file) {
  let state = { views: {}, archived: {} };
  try { state = JSON.parse(readFileSync(file, 'utf8')); } catch(e) { if(e.code !== 'ENOENT') throw e; }
  const scope = (user, product, page) => JSON.stringify([user.tenantId, product, page]);
  const commit = next => {
    mkdirSync(dirname(file), {recursive:true,mode:0o700});
    writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600}); renameSync(file+'.tmp',file); state=next;
  };
  return {
    isArchived: (user, product, page, id) => !!state.archived[scope(user,product,page)]?.includes(id),
    archive(user, product, page, ids, rows, primaryKey) {
      const key=scope(user,product,page), next=structuredClone(state), results=[];
      next.archived[key] ??= [];
      for(const id of ids) {
        const row=rows.find(row=>String(row[primaryKey])===id);
        const allowed=['enterprise-admin','finance-manager','operations-analyst'].includes(user.role);
        if(!allowed || row?.status==='Locked') results.push({id,ok:false,error:'You cannot archive this record.'});
        else if(next.archived[key].includes(id)) results.push({id,ok:true});
        else if(!row) results.push({id,ok:false,error:'Record no longer exists.'});
        else { next.archived[key].push(id); results.push({id,ok:true}); }
      }
      commit(next); return results;
    },
    views(user, body) {
      const { productId, pageId, action }=body;
      if(typeof productId!=='string'||!productId||typeof pageId!=='string'||!pageId) return {status:400,body:{error:'A product and page are required.'}};
      const own = view => view.tenantId===user.tenantId && view.userId===user.id && view.productId===productId && view.pageId===pageId;
      if(action==='list') return {status:200,body:{views:Object.values(state.views).filter(own)}};
      const next=structuredClone(state);
      if(action==='create') {
        if(typeof body.label!=='string'||!body.label.trim()||body.label.length>80 || !validLayout(body.layout)) return {status:400,body:{error:'Enter a name and a valid view layout.'}};
        if(Object.values(state.views).filter(own).length>=50) return {status:400,body:{error:'Keep at most 50 personal views per page.'}};
        const id=randomUUID();
        next.views[id]={id,tenantId:user.tenantId,userId:user.id,productId,pageId,label:body.label.trim(),layout:body.layout,version:1,isDefault:false};
      } else {
        const view=next.views[body.id];
        if(!view||!own(view))return {status:404,body:{error:'View not available.'}};
        if(body.version!==view.version)return {status:409,body:{error:'This view changed in another window. Reload the list before trying again.'}};
        if(action==='delete')delete next.views[body.id];
        else if(action==='rename') {
          if(typeof body.label!=='string'||!body.label.trim()||body.label.length>80)return {status:400,body:{error:'Enter a name of 1–80 characters.'}};
          view.label=body.label.trim();view.version++;
        } else if(action==='default') {
          for(const other of Object.values(next.views).filter(own)) if(other.isDefault) {other.isDefault=false;other.version++;}
          view.isDefault=body.isDefault===true;view.version++;
        } else return {status:400,body:{error:'Unknown view operation.'}};
      }
      commit(next);return {status:200,body:{views:Object.values(state.views).filter(own)}};
    },
  };
}
