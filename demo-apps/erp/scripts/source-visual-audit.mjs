// Read-only source inventory for the visual comparison. Run from the repository root.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const catalogue=readFileSync('demo-apps/erp/src/modules/keystone/catalog.ts','utf8').replace(/^export \{[^\n]+ from '.\/registry';$/m,'');
const compiled=ts.transpileModule(catalogue,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {PAGES}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const folder='docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(dir+'/'+entry.name):[dir+'/'+entry.name]);
const sources=['reference-erp1','reference-erp2','reference-keystone-core'].flatMap(name=>walk('desktop-clients/packages/'+name+'/src')).filter(path=>/\.(tsx?|css)$/.test(path)).concat(['desktop-clients/packages/ops-ui/src/avatar.tsx','desktop-clients/packages/ops-ui/src/overlay.tsx']).map(path=>({path,sha256:sha(readFileSync(path))}));
const core=new Set(['dashboard','settings','matrix','report','ledger']);
const templateNames={voucher:'Document',...Object.fromEntries([...new Set(PAGES.map(page=>page.template))].filter(x=>x!=='voucher').map(x=>[x,x[0].toUpperCase()+x.slice(1)]))};
const recordNames={profile:'ProfileRecord',grid:'ProfileRecord',dependent:'ProfileRecord',rate:'ProfileRecord',document:'DocRecord',voucher:'DocRecord',structure:'DocRecord',request:'RequestRecord',checklist:'RequestRecord',booking:'MoreRecords',case:'MoreRecords',tree:'MoreRecords',process:'SpecialRecords',inbox:'SpecialRecords',print:'SpecialRecords'};
const routes=['erp1','erp2'].flatMap(variant=>PAGES.map(def=>{
 const template=`desktop-clients/packages/reference-${core.has(def.template)?'keystone-core':variant}/src/components/templates/${templateNames[def.template]}Template.tsx`;
 const record=variant==='erp2'&&recordNames[def.template]?`desktop-clients/packages/reference-erp2/src/components/record/${recordNames[def.template]}.tsx`:undefined;
 const source=readFileSync(template,'utf8')+(record?readFileSync(record,'utf8'):'');
 return {path:`/${variant}/${def.section}/${def.slug}`,template:def.template,sourceTemplate:template,...(record?{sourceRecord:record}:{}),sourceGeometryClasses:[...new Set([...source.matchAll(/(?:\b(?:[a-z]+:)?(?:grid-cols|w|min-w|max-w|h|min-h|max-h)-\[[^\]]+\]|\bp[xy]?-[\d.]+\b)/g)].map(match=>match[0]))].slice(0,30),comparison:'Differences remain; see the destination ledger. Source JSX/CSS audit; completed demo computed-style checks are recorded separately in browser receipts. Not an original-desktop screenshot or native test.'};
}));
if(routes.length!==114||new Set(routes.map(route=>route.path)).size!==114)throw Error('Destination inventory changed');
writeFileSync(folder+'/source-visual-audit.json',JSON.stringify({method:'Read-only original JSX/CSS and source-derived geometry targets. Demo browser measurements have separate receipts; no original runtime rendered.',sources,routes,geometryTargets:{booking:{slotHeight:30,timeGutter:56,resourceMinWidth:170,eventInset:4,eventGap:3,upcomingWidth:256,viewDrawerWidth:360,editDrawerWidth:460,erp2Aside:340,summaryIcon:64,summaryTimeFont:26},profile:{erp1Avatar:48,erp2Avatar:48,avatarResolution:'Core Avatar maps source 44/52 props to ops-ui lg size-12 (48px).',erp1List:380,erp2Rail:170,erp2Aside:300},tree:{erp2Aside:380},case:{erp2Aside:340},fields:{labelFont:12,valueFont:13.5,gapInline:16,gapBlock:14}}},null,2)+'\n');
console.log(`${routes.length} destinations; ${sources.length} read-only source hashes`);
