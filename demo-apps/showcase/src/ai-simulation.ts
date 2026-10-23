import {createAiCatalogue, type AiConfig, type AiPolicy, type AiUsage} from '@pepbits/ai/config';
import {createAiClientWithRequest, type AiRequest} from '@pepbits/ai/client';
import type {AiHost} from '@pepbits/ai/ui';
export const aiCatalogue=createAiCatalogue([
 {id:'showcase.summarize',label:'Summarize fictional item',description:'Read the displayed item and mask its classified owner.',promptId:'fictional-summary',category:'general',reads:[{source:'page-record',fields:['itemName','classifiedOwner']}]},
 {id:'showcase.blocked',label:'Blocked export action',description:'Disabled by the simulated tenant policy.',promptId:'fictional-export',category:'general',reads:[{source:'page-record',fields:['itemName']}]},
]);
const policy:AiPolicy={tenantId:'fictional-gallery',global:{tenant:{allowed:true}},modules:{},pages:{},useCases:{'showcase.blocked':{allowed:false}}};
const config:AiConfig={tenantId:'fictional-gallery',provider:{id:'echo',label:'Browser echo simulation',endpoint:''},model:{id:'echo',label:'Echo only',contextWindow:1000},limits:{requestsPerMinute:5,tokensPerDay:1000,maxContextFields:2},prompts:[],retention:{class:'standard',days:0},dataSharing:{providerTrainsOnContent:false,region:'Browser memory'},credential:{configured:false,hint:null,fingerprint:null,setBy:null,setAt:null,rotatedAt:null,lastVerifiedAt:null,lastError:null}};
const usage:AiUsage={tenantId:'fictional-gallery',day:'2026-10-23',requestsLastMinute:0,requestsPerMinute:5,tokensUsedToday:0,tokensPerDay:1000,limitsAreDefaults:true};
/** All reads are in memory; writes are refused. This port never calls fetch. */
export function createAiSimulation(onRequest?:(path:string)=>void):AiHost {
 const request:AiRequest=async(path,init)=>{
  onRequest?.(path);
  if(init?.method && init.method!=='GET')return Response.json({error:'Simulation is read only.'},{status:403});
  if(path==='/ai/policy')return Response.json(policy);
  if(path==='/ai/config')return Response.json(config);
  if(path==='/ai/usage')return Response.json(usage);
  return Response.json({error:'No service is configured.'},{status:404});
 };
 return {client:createAiClientWithRequest(request,key=>key==='classifiedOwner'?'pii':'operational','echo'),catalogue:aiCatalogue,pages:{ai:{pageId:'ai',title:'AI simulation',module:'gallery',build:{enabled:true,useCases:[...aiCatalogue.ids]}}},userEnabled:false,canManageAi:false};
}
