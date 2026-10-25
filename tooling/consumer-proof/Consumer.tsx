'use client';
import React, {useState} from 'react';
import {tokenVar} from '@pepbits/tokens';
import {Icon, Check} from '@pepbits/icons';
import {createTranslator, directionOf, createFormatters} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {formatOptionsFrom, type UserPreferences} from '@pepbits/preferences';
import {PreferenceHost, usePreferences} from '@pepbits/preferences/react';
import {Button, FieldShell, Input} from '@pepbits/ui';
import {Card, CardContent, PresentationProvider} from '@pepbits/components';
import {parseCsv} from '@pepbits/data';
import {LabelPreview} from '@pepbits/patterns/label-printing';
import {readOptionsWorkbook} from '@pepbits/patterns/imports';
import {PageTemplateWorkspace} from '@pepbits/page-engines/templates';
import type {PageTemplateDefinition} from '@pepbits/page-engines/types';
import {HostSessionProvider} from '@pepbits/platform/auth';
import {ShellProvider, defineProduct} from '@pepbits/shell';
import {GATES} from '@pepbits/ai/config';

const definition: PageTemplateDefinition = {id:'pack-proof',group:'proof',engine:'master',title:'Packed template',description:'Fictional packaging fixture',layout:'tabs',view:'table',sections:[{id:'details',title:'Details',fields:[{id:'name',label:'Template name',type:'text'}]}],columns:[],stages:[],tags:[],editable:false};
const navigation = {current:{pageId:'proof'},open:()=>{},openInNewContext:()=>{},hrefFor:()=>'/'};
const product = defineProduct({id:'proof',name:'Proof',tagline:'Local fixture',defaultModule:'proof',enabledModules:['proof'],navigation:{defaultModule:'proof',modules:{proof:{id:'proof',label:'Proof',shortLabel:'P',description:'Local fixture',accent:'var(--primary)',icon:Check,navigation:[]}},pages:{proof:{id:'proof',title:'Proof',subtitle:'',kind:'form',module:'proof'}}}});
export default function Consumer() {
  const [preferences,setPreferences]=useState<Partial<UserPreferences>>({theme:'nexora'});
  return <PreferenceHost preferences={preferences} update={patch=>setPreferences(value=>({...value,...patch}))}><Surface/></PreferenceHost>;
}
function Surface() {
  const {preferences}=usePreferences(),format=createFormatters(formatOptionsFrom(preferences));
  const [clicks,setClicks]=useState(0),[worker,setWorker]=useState('idle');
  const t=createTranslator({language:preferences.language,catalogs:{en:{'Proof action':'Packed action'}}});
  async function checkWorker() {
    try {
      const response=await fetch('/fixture.xlsx');
      const sheets=await readOptionsWorkbook(await response.arrayBuffer(),new AbortController().signal);
      setWorker(sheets[0]?.rows[0]?.[0]==='Example'?'passed':'bad data');
    } catch(error) {setWorker(String(error));}
  }
  return <LocalizationProvider value={{language:preferences.language,direction:directionOf(preferences.language),t,dateTime:format.dateTime}}>
    <PresentationProvider value={preferences}><HostSessionProvider value={{status:'anonymous',user:null,login:async()=>null,logout:async()=>{}}}>
      <ShellProvider product={product} navigation={navigation} branches={[]} roles={[]} brand={{name:'Package proof',tagline:'Local fixture'}}>
        <main data-testid="proof" data-theme={preferences.theme} dir={directionOf(preferences.language)} style={{background:tokenVar('--surface')}}>
          <h1>Packed consumer proof</h1><p data-testid="font" style={{fontFamily:'Public Sans'}}>Public Sans font proof</p>
          <Card><CardContent><Icon icon={Check} label="Packed icon"/><Button variant="primary" onClick={()=>setClicks(value=>value+1)}>Proof action</Button>
            <output data-testid="clicks">{clicks}</output><FieldShell label="Packed field">{id=><input aria-describedby={id} defaultValue="Field content"/>}</FieldShell>
            <Input label="Packed input" defaultValue="Example"/><p>AI gates: {GATES.length}; CSV rows: {parseCsv('name\nExample').rows.length}</p>
          </CardContent></Card>
          <div data-testid="pattern"><LabelPreview label={{recordId:'fixture',title:'Packed label',lines:['Example'],code:'fixture',image:'',widthMm:50,heightMm:25}}/></div>
          <PageTemplateWorkspace definition={definition} scope={{tenantId:'fixture',applicationId:'proof',userId:'fixture',pageId:'proof',recordId:'fixture'}} initialDocument={{id:'fixture',version:1,values:{name:'Example'},lines:[],rows:[]}} readOnly/>
          <Button onClick={checkWorker}>Check packed worker</Button><output data-testid="worker">{worker}</output>
        </main>
      </ShellProvider>
    </HostSessionProvider></PresentationProvider>
  </LocalizationProvider>;
}
