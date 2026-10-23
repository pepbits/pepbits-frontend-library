"use client";
import React,{useEffect,useRef} from 'react';
import {sentinelReference,reportSentinelFailure,subscribeSentinel,SentinelQueue,type SentinelEvent} from '@pepbits/platform';
import {useSession} from '@pepbits/platform';
import {useShell} from './shell-context';
import {useNavigation} from '@pepbits/platform/navigation';
import {Button} from "@pepbits/ui";
import {LocalizedText} from "@pepbits/i18n/react";


export function SentinelBridge(){
 const {product,monitoring}=useShell(),navigation=useNavigation(),{user,status,expired}=useSession();
 const identity=JSON.stringify([user?.tenantId,user?.id,user?.role,user?.branch,status,expired]);
 const currentIdentity=useRef(identity);currentIdentity.current=identity;
 const context=useRef({pageId:navigation.current.pageId,breadcrumbs:[] as string[]});
 useEffect(()=>{context.current={pageId:navigation.current.pageId,breadcrumbs:[...context.current.breadcrumbs,navigation.current.pageId].slice(-8)};},[navigation.current.pageId]);
 useEffect(()=>{
  if(!monitoring || status!=="authenticated" || expired)return;
  const transport=monitoring.request;
  const controller=new AbortController();
  const queue=new SentinelQueue(async events=>{
   if(controller.signal.aborted||currentIdentity.current!==identity){queue.stop();return;}
   const delivery=new AbortController();const abort=()=>delivery.abort();controller.signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,10000);
   let response:Response;
   try{response=await transport('/monitoring/events',{method:'POST',signal:delivery.signal,headers:{'Content-Type':'application/json','X-Product-Id':product.id},body:JSON.stringify({events})});}finally{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);}
   if(controller.signal.aborted||currentIdentity.current!==identity)return;
   if([400,401,403].includes(response.status)){queue.stop();return;}
   if(!response.ok)throw Error('Monitoring delivery failed');
   if(events.some(e=>e.code==='native-panic'))void monitoring.acknowledgeNativeFailure?.().catch(()=>{});
  });
  const capture=(detail:Partial<SentinelEvent>)=>{try{
   if(controller.signal.aborted||currentIdentity.current!==identity||!product.pages[context.current.pageId])return;
   queue.capture({...detail,id:detail.id??sentinelReference(),pageId:context.current.pageId,breadcrumbs:context.current.breadcrumbs.filter(id=>product.pages[id]),release:monitoring.releaseId,platform:monitoring.platform??'web'});
  }catch{/* Diagnostic capture must never cause a second exception. */}};
  const unsubscribe=subscribeSentinel(capture);
  const error=(event:ErrorEvent)=>capture({kind:'runtime',code:'runtime-error',line:event.lineno,column:event.colno});
  const rejection=()=>capture({kind:'promise',code:'unhandled-rejection'});
  const explicit=(event:Event)=>capture((event as CustomEvent).detail??{});
  const flush=()=>{void queue.flush();};
  window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejection);window.addEventListener('pepbits-sentinel',explicit);window.addEventListener('online',flush);
  const timer=window.setInterval(flush,5000);
  // Native adapters report through the platform monitoring API; no native runtime is imported.
  return()=>{unsubscribe();queue.stop();controller.abort();clearInterval(timer);window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection);window.removeEventListener('pepbits-sentinel',explicit);window.removeEventListener('online',flush);};
 },[product,monitoring,identity,status,expired]);
 return null;
}
export class SentinelBoundary extends React.Component<{children:React.ReactNode;resetKey?:string},{failed:boolean;reference:string}>{
 override state={failed:false,reference:''};
 static getDerivedStateFromError(){return {failed:true};}
 override componentDidCatch(){const id=sentinelReference();this.setState({reference:id});reportSentinelFailure({id,kind:'render',code:'render-error'});}
 override componentDidUpdate(previous:{resetKey?:string}){if(this.state.failed&&previous.resetKey!==this.props.resetKey)this.setState({failed:false,reference:''});}
 override render(){return this.state.failed?<div role="alert" className="m-5 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"><p><LocalizedText message="This page encountered an error. Please retry." /></p><p><LocalizedText message="Reference" />: <bdi>{this.state.reference}</bdi></p><Button onClick={()=>this.setState({failed:false,reference:''})}><LocalizedText message="Retry" /></Button><Button onClick={()=>window.location.reload()}><LocalizedText message="Reload" /></Button></div>:this.props.children;}
}
