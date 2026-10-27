import type {PageDefinition} from '@pepbits/page-engines/types';
import {AnalyticsPage} from './analytics';
import {MatrixPage} from './matrix';
import {Dashboard} from './dashboard';
import {SettingsPage} from './settings';
import type {PageDef} from './types';
export function SpecialPage({def,page}:{def:PageDef;page:PageDefinition}) {
 if(def.template==='dashboard')return <Dashboard/>;
 if(def.template==='settings')return <SettingsPage key={page.id} def={def}/>;
 return def.template==='matrix'?<MatrixPage key={page.id} def={def}/>:<AnalyticsPage key={page.id} def={def} page={page}/>;
}
