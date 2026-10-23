import {bootstrap as medbandBootstrap} from "../modules/medband/test-utils";
import surgisuiteFixtures from '../modules/surgisuite/__fixtures__/api.json';
import {qualityHandler} from '../modules/quality/test-fixtures';
import {providerHandler,patientHandler,patient,encounter,appointmentView,staff} from '../modules/teleconsult/test-utils';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {PreferencePolicy,UserPreferences} from '@pepbits/preferences';
import type {Request} from '../adapters/http';
const fixtures=JSON.parse(readFileSync(resolve(process.cwd(),'src','test','fixtures','http.json'),'utf8')) as Record<string,{status:number;body:unknown}>;
const diagnostics=JSON.parse(readFileSync(resolve(process.cwd(),'src','test','fixtures','diagnostics.json'),'utf8')) as typeof fixtures;
const pharmacy=JSON.parse(readFileSync(resolve(process.cwd(),'src','test','fixtures','pharmacy.json'),'utf8')) as typeof fixtures;
const rcm=JSON.parse(readFileSync(resolve(process.cwd(),'src','test','fixtures','rcm.json'),'utf8')) as typeof fixtures;
const entries=Object.entries({...fixtures,...diagnostics,...pharmacy,...rcm}).filter(([,value])=>value.status===200).map(([key,value])=>({key:JSON.parse(key) as [string,string,unknown],value}));
function sorted(value:unknown):unknown {if(Array.isArray(value))return value.map(sorted);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,sorted(value)]));return value;}
function normalized(path:string,body:unknown){const url=new URL(path,'http://localhost');url.searchParams.delete('date');if(url.pathname==='/reference-modules/ris1/api/orders'&&url.searchParams.get('view')==='schedule'){url.searchParams.delete('from');url.searchParams.delete('to');}url.searchParams.sort();return JSON.stringify([url.pathname+url.search,sorted(body??null)]);}
export function mockHttp(preferences:Partial<UserPreferences>={},policy:PreferencePolicy={revision:1,rules:{}}){const unexpected:string[]=[],calls:string[]=[];const request:Request=async(path,init)=>{calls.push(path);if(path==='/preferences')return Response.json({overrides:preferences,preferences,policy,userRevision:1,canManage:false});if(path.startsWith('/localization')){const language=new URL(path,'http://localhost').searchParams.get('language')??'en';const read=(code:string)=>JSON.parse(readFileSync(process.cwd()+`/../../dummy-api/config/localization/shared/${code}.json`,'utf8')).messages;return Response.json({messages:read(language),fallbackMessages:read('en')});}
 if(path==='/reference-modules/medband/api/bootstrap')return Response.json(medbandBootstrap());
 if(path.startsWith('/reference-modules/medband/api/patients?'))return Response.json({patients:medbandBootstrap().data.patients});
 if(path==='/personal-views'&&JSON.parse(String(init?.body)).action==='list')return Response.json({views:[]});
 // Reuse one synthetic API image across the seeded series; browser coverage loads the actual instances.
 if(/^\/reference-modules\/ris1\/api\/dicom\/instances\/\d+$/.test(path)&&(!init?.method||init.method==='GET'))return new Response(new Uint8Array(readFileSync(resolve(process.cwd(),'src','test','fixtures','diagnostic-instance.dcm'))),{headers:{'content-type':'application/dicom'}});
 if(path.startsWith('/reference-modules/quality/api/')){const local=path.slice('/reference-modules/quality/api'.length),url=new URL(local,'http://localhost');const result=await qualityHandler()({method:init?.method??'GET',path:local,url,headers:new Headers(init?.headers),body:init?.body?JSON.parse(String(init.body)):undefined,signal:init?.signal});if(result)return Response.json(result.body??null,{status:result.status??200});}
 const tc=path.match(/^\/reference-modules\/teleconsult-(provider|patient)(\/api.*)$/);
 if(tc){const local=tc[2]!,url=new URL(local,'http://localhost'),record={method:init?.method??'GET',path:local,url,headers:new Headers(init?.headers),body:init?.body?JSON.parse(String(init.body)):undefined,signal:init?.signal};
  const handler=tc[1]==='provider'?providerHandler({roles:['doctor','nurse']}):patientHandler({patients:[patient()],bound:'p8',canRegister:true});
  const result=await handler(record)??(url.pathname==='/api/encounters'?{body:[]} :url.pathname==='/api/appointments/a1/summary'?{body:{appointment:appointmentView(),patient:patient(),clinician:staff(),encounter:encounter({status:'signed',signedBy:'d1'})}}:undefined);
  if(result)return Response.json(result.body??null,{status:result.status??200});
 }
 if(path.startsWith('/reference-modules/surgisuite/api/')){const key=path.slice('/reference-modules/surgisuite/api'.length).split('?')[0]!;const value=(surgisuiteFixtures as Record<string,unknown>)[key];if(value!==undefined)return Response.json(value);}
 const body=init?.body?JSON.parse(String(init.body)):null,method=init?.method??'GET';const match=entries.find(entry=>entry.key[0]===method&&normalized(entry.key[1],entry.key[2])===normalized(path,body));if(!match){unexpected.push(JSON.stringify([method,path,body]));throw new Error('Unmocked synthetic read '+path);}return Response.json(match.value.body,{status:match.value.status});};return {request,unexpected,calls};}
