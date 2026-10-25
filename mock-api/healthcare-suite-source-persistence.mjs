// Private durable synthetic source snapshots. A single API writer owns this
// directory, so imported invoice/patient identities cannot be recycled on restart.
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,openSync,closeSync,fsyncSync,existsSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
const held=new Set();
export function createHealthcareSuiteSourcePersistence(directory,{beforePersist}={}){
 const dir=resolve(directory),lock=join(dir,'.writer-lock');mkdirSync(dir,{recursive:true,mode:0o700});
 if(held.has(dir))throw Error('Healthcare Suite source already has an active writer.');
 try{mkdirSync(lock,{mode:0o700});}catch(error){
  if(error.code!=='EEXIST')throw error;
  let owner;try{owner=JSON.parse(readFileSync(join(lock,'owner.json'),'utf8'));}catch{throw Error('Healthcare Suite source writer lock needs recovery.');}
  if(!Number.isSafeInteger(owner.pid)||owner.pid<1)throw Error('Healthcare Suite source writer lock is invalid.');
  try{process.kill(owner.pid,0);throw Error('Healthcare Suite source already has an active writer.');}catch(e){if(e.code!=='ESRCH')throw e;}
  rmSync(lock,{recursive:true});mkdirSync(lock,{mode:0o700});
 }
 const token=randomUUID();writeFileSync(join(lock,'owner.json'),JSON.stringify({pid:process.pid,token}),{mode:0o600});held.add(dir);let closed=false;
 function close(){if(closed)return;closed=true;held.delete(dir);process.removeListener('exit',close);try{const owner=JSON.parse(readFileSync(join(lock,'owner.json'),'utf8'));if(owner.token===token)rmSync(lock,{recursive:true});}catch{}}
 process.once('exit',close);
 const file=key=>join(dir,createHash('sha256').update(key).digest('hex')+'.json');
 return {
  load(key){
   if(closed)throw Error('Healthcare Suite source writer is closed.');const path=file(key);if(!existsSync(path))return null;
   if(statSync(path).size>20_000_000)throw Error('Healthcare Suite source snapshot is too large.');
   const state=JSON.parse(readFileSync(path,'utf8'));
   if(state.schemaVersion!==1||state.partitionKey!==key||!Array.isArray(state.tables)||!Array.isArray(state.replays))throw Error('Healthcare Suite source snapshot is invalid.');
   return {tables:new Map(state.tables),replays:new Map(state.replays)};
  },
  save(key,tables,replays){
   if(closed)throw Error('Healthcare Suite source writer is closed.');
   const state={schemaVersion:1,partitionKey:key,tables:[...tables],replays:[...replays]};const path=file(key),temporary=path+'.tmp-'+randomUUID();let descriptor,committed=false;
   try{const bytes=JSON.stringify(state);if(Buffer.byteLength(bytes)>20_000_000)throw Error('Healthcare Suite source exceeds the demo storage limit.');descriptor=openSync(temporary,'wx',0o600);writeFileSync(descriptor,bytes);fsyncSync(descriptor);closeSync(descriptor);descriptor=undefined;if(beforePersist)beforePersist(state);renameSync(temporary,path);committed=true;const parent=openSync(dir,'r');try{fsyncSync(parent);}finally{closeSync(parent);}}
   catch(error){error.sourceCommitted=committed;throw error;}
   finally{if(descriptor!==undefined)closeSync(descriptor);rmSync(temporary,{force:true});}
  },close,
 };
}

const invoiceQueues=new Map();
/** Serialize source settlement and trusted RCM ownership transfer in this writer. */
export async function acquireHealthcareSuiteInvoice(key){
 const before=invoiceQueues.get(key)??Promise.resolve();let release;
 const waiting=new Promise(resolve=>{release=resolve;});const tail=before.catch(()=>{}).then(()=>waiting);
 invoiceQueues.set(key,tail);await before.catch(()=>{});let done=false;
 return ()=>{if(done)return;done=true;release();if(invoiceQueues.get(key)===tail)invoiceQueues.delete(key);};
}
