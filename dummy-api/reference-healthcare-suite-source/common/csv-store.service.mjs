// CSV schema/coercion and table operations ported from the source CsvStore.
// The host owns partition identity. This demo never writes to source fixtures or users.csv.
import {readFileSync,readdirSync} from 'node:fs';
import {parseCsv} from './csv.mjs';
import {NotFoundException} from '../runtime.mjs';
export class CsvStore {
  constructor(dir){this.tables=new Map();this.actor=null;for(const file of readdirSync(dir).filter(file=>file.endsWith('.csv'))){const records=parseCsv(readFileSync(new URL(file,dir),'utf8'));const columns=(records.shift()??[]).map(header=>{const [name,type='string']=header.trim().split(':');return{name,type};});this.tables.set(file.replace(/\.csv$/,''),{columns,rows:records.map(record=>Object.fromEntries(columns.map((col,i)=>[col.name,this.coerce(col.type,record[i]??'')])))});}}
  table(name){const table=this.tables.get(name);if(!table)throw new NotFoundException(`Data table "${name}" is missing`);return table;}
  all(name){return this.table(name).rows;}
  find(name,id){return this.all(name).find(row=>row.id===id);}
  get(name,id,label='Record'){const row=this.find(name,id);if(!row)throw new NotFoundException(`${label} ${id} was not found`);return row;}
  columns(name){return this.table(name).columns.map(col=>col.name);}
  insert(name,data){const table=this.table(name);const row=Object.fromEntries(table.columns.map(col=>[col.name,this.coerce(col.type,col.name==='createdBy'&&this.actor?this.actor.id:data[col.name])]));table.rows.push(row);return row;}
  update(name,id,patch){const row=this.get(name,id);for(const col of this.table(name).columns)if(col.name!=='id'&&col.name in patch)row[col.name]=this.coerce(col.type,patch[col.name]);return row;}
  remove(name,id){this.table(name).rows=this.all(name).filter(row=>row.id!==id);}
  nextKey(name,field,prefix,width=5){let max=0;for(const row of this.all(name)){const value=String(row[field]??'');if(value.startsWith(prefix)){const n=parseInt(value.slice(prefix.length),10);if(Number.isFinite(n))max=Math.max(max,n);}}return prefix+String(max+1).padStart(width,'0');}
  coerce(type,value){switch(type){case'number':{if(value===''||value==null)return 0;const n=Number(value);return Number.isFinite(n)?n:0;}case'boolean':return value===true||value==='true'||value==='1'||value===1;case'json':if(typeof value!=='string')return value??null;if(value==='')return null;try{return JSON.parse(value);}catch{return null;}default:return value==null?'':String(value);}}
  snapshot(){return structuredClone(this.tables);}
  restore(snapshot){this.tables=snapshot;}
}
