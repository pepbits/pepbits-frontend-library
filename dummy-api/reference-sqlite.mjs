import {DatabaseSync} from 'node:sqlite';
/** Small synchronous adapter for embedded reference services. No native addon, shared connection or public listener. */
export default class ReferenceSqlite {
  constructor(file){this.connection=new DatabaseSync(file);this.depth=0;this.sequence=0;}
  exec(sql){return this.connection.exec(sql);}
  prepare(sql){const statement=this.connection.prepare(sql);statement.setAllowBareNamedParameters(true);statement.setAllowUnknownNamedParameters(true);return statement;}
  pragma(sql,options){const rows=this.prepare('PRAGMA '+sql).all();return options?.simple?Object.values(rows[0]??{})[0]:rows;}
  transaction(fn){const run=(...args)=>{const savepoint='reference_'+(++this.sequence),outer=this.depth===0;this.exec(outer?'BEGIN IMMEDIATE':'SAVEPOINT '+savepoint);this.depth++;try{const result=fn(...args);if(result?.then)throw Error('Use hostTransaction for asynchronous work');this.exec(outer?'COMMIT':'RELEASE '+savepoint);return result;}catch(error){this.exec(outer?'ROLLBACK':'ROLLBACK TO '+savepoint);if(!outer)this.exec('RELEASE '+savepoint);throw error;}finally{this.depth--;}};run.immediate=run;return run;}
  async hostTransaction(fn){if(this.depth)throw Error('Concurrent host transaction rejected');this.exec('BEGIN IMMEDIATE');this.depth++;try{const result=await fn();this.exec('COMMIT');return result;}catch(error){this.exec('ROLLBACK');throw error;}finally{this.depth--;}}
  close(){this.connection.close();}
}
