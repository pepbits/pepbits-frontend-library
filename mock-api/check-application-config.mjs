import {readFileSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApplicationConfig} from './application-config.mjs';
import {PAGE_REGISTRY} from '../desktop-clients/packages/erp-config/src/navigation.ts';
const root=process.env.NEXORA_CONFIG_DIR??join(dirname(fileURLToPath(import.meta.url)),'config');
const store=createApplicationConfig(root,new Set(Object.keys(PAGE_REGISTRY)));
const report={};let navigationMissing=0;
for(const file of readdirSync(join(root,'navigation')).filter(name=>name.endsWith('.json'))){
 const productId=JSON.parse(readFileSync(join(root,'navigation',file),'utf8')).productId;
 const nav=store.navigation({role:'enterprise-admin'},productId).body;
 const menuKeys=[...new Set(nav.nodes.flatMap(n=>[n.labelKey,...(n.shortLabelKey?[n.shortLabelKey]:[])]))];
 report[productId]={};
 for(const language of ['ar','hi','ml']){
  const {messages,fallbackMessages}=store.localization({role:'enterprise-admin'},productId,language).body;
  const missing=key=>!Object.hasOwn(messages,key)||messages[key]===fallbackMessages[key]&&/[A-Za-z]/.test(fallbackMessages[key]);
  const menu=menuKeys.filter(missing),titles=nav.pages.map(p=>p.titleKey).filter(missing),all=Object.keys(fallbackMessages).filter(missing);
  report[productId][language]={navigationKeys:menuKeys.length,navigationNeedsReview:menu,pageTitlesNeedReview:titles,catalogKeys:Object.keys(fallbackMessages).length,catalogNeedsReview:all.length};
  navigationMissing+=menu.length;
 }
}
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--strict-navigation')&&navigationMissing)process.exitCode=1;
