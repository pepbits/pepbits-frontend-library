"use client";
import React,{useEffect,useState} from 'react';
import { Button } from "@pepbits/ui";
import { Drawer } from "@pepbits/components";
import { LocalizedText } from "@pepbits/i18n/react";
import {useNavigation} from '@pepbits/platform';


import {useERP} from '../shell-context';
import {DocumentationArticle} from '../documentation';
export function DocumentationDrawer(){
 const navigation=useNavigation();const {product,documentation,documentationOpen,setDocumentationOpen,setHelpOpen,preferences}=useERP();
 const [target,setTarget]=useState({pageId:'',sectionId:'',releaseId:documentation?.releaseId??""});
 useEffect(()=>{const select=(event:Event)=>setTarget((event as CustomEvent).detail);window.addEventListener('pepbits-documentation-section',select);return()=>window.removeEventListener('pepbits-documentation-section',select);},[]);
 useEffect(()=>{if(!documentationOpen)setTarget({pageId:'',sectionId:'',releaseId:documentation?.releaseId??""});},[documentationOpen,documentation?.releaseId]);
 if(!preferences.documentationEnabled)return null;
 const pageId=target.pageId||navigation.current.pageId;
 return <Drawer open={documentationOpen} onClose={()=>setDocumentationOpen(false)} title="Product documentation" subtitle={product.pages[pageId]?.title} side={preferences.docsPosition} width="lg" footer={documentation?.centerPageId?<Button onClick={()=>{navigation.open({pageId:documentation!.centerPageId!});setDocumentationOpen(false);}}><LocalizedText message="Documentation Center" /></Button>:undefined}>
  {documentationOpen?<div className="p-5"><DocumentationArticle pageId={pageId} sectionId={target.sectionId} releaseId={target.releaseId} onTour={()=>{setDocumentationOpen(false);setHelpOpen(true);}} /></div>:null}
 </Drawer>;
}
