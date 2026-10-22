import {describe,it,expect} from 'vitest';
import {SentinelQueue,sanitizeSentinelEvent} from './sentinel';
const event=(line=1)=>({id:crypto.randomUUID(),kind:'runtime',code:'runtime-error',pageId:'preferences',release:'2026-09-08-documentation',platform:'web',line,breadcrumbs:['preferences']});
describe('Sentinel',()=>{
 it('never copies exception messages, request bodies, tokens or arbitrary codes',()=>{
  const safe=sanitizeSentinelEvent({...event(),message:'patient name',token:'secret',stack:'patient data',body:{password:'secret'}})!;expect(JSON.stringify(safe)).not.toMatch(/patient|secret|password/);expect(sanitizeSentinelEvent({...event(),code:'patient-name'})).toBeNull();
 });
 it('bounds the queue, suppresses repeated pending failures and backs off without losing a failed batch',async()=>{
  let now=0,calls=0;const queue=new SentinelQueue(async()=>{calls++;if(calls===1)throw Error('offline');},()=>now);
  const e=event();queue.capture(e);queue.capture({...e,id:crypto.randomUUID()});expect(queue.size).toBe(1);
  await queue.flush();await queue.flush();expect(calls).toBe(1);expect(queue.size).toBe(1);now=2000;await queue.flush();expect(queue.size).toBe(0);
  for(let i=0;i<60;i++)queue.capture(event(i));expect(queue.size).toBe(50);queue.stop();queue.capture(event());expect(queue.size).toBe(0);
 });
 it('serializes delivery and preserves newly queued failures',async()=>{
  let finish!:()=>void;const queue=new SentinelQueue(()=>new Promise<void>(resolve=>{finish=resolve;}));queue.capture(event());const pending=queue.flush();await queue.flush();queue.capture(event(2));finish();await pending;expect(queue.size).toBe(1);
 });
});
it('malformed diagnostic objects cannot throw into application code',()=>{const queue=new SentinelQueue(async()=>{});expect(()=>queue.capture(new Proxy({},{get(){throw Error('broken object');}}))).not.toThrow();expect(queue.size).toBe(0);});
it('keeps distinct user-visible request references for incident lookup',()=>{
 const queue=new SentinelQueue(async()=>{});queue.capture({...event(),kind:'request',code:'request-failed'});queue.capture({...event(),kind:'request',code:'request-failed'});expect(queue.size).toBe(2);
});
