import {useLocalization} from '@pepbits/i18n/react';
import type {PageDefinition} from '@pepbits/page-engines/types';
import {AnalyticsPage} from './analytics';
import {MatrixPage} from './matrix';
import {Dashboard} from './dashboard';
import {RecordEditor} from './record';
import type {PageDef} from './types';
export function SpecialPage({def,page}:{def:PageDef;page:PageDefinition}) {
 const {t}=useLocalization();
 if(def.template==='dashboard')return <Dashboard/>;
 if(def.template==='settings')return <section><h1>{t(def.title)}</h1><RecordEditor def={def} target={{pageId:page.id,recordId:'1',mode:'edit'}} onClose={()=>{}} onOpen={()=>{}} onSaved={()=>{}}/></section>;
 return def.template==='matrix'?<MatrixPage key={page.id} def={def}/>:<AnalyticsPage key={page.id} def={def} page={page}/>;
}
