import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {dirname,join,resolve,relative} from 'node:path';
import {localizeFile,injectHooks} from '../reference-import-transforms.mjs';
const root=resolve(import.meta.dirname,'../..'),source=process.env.MEDSLOT_REFERENCE_ROOT??'/home/pepadmin/pb/saas/reference/frontend/sheduler/medslot/web/src',target=join(root,'packages/reference-medslot/src');
const controls={button:'SourceButton',input:'SourceInput',textarea:'SourceTextarea',select:'SourceSelect',table:'ManagedTable',thead:'TableHeader',tbody:'TableBody',tr:'TableRow',th:'TableHead',td:'TableCell'};
const formats=['fmtTime','fmtDate','fmtDay','fmtLongDay','fmtDateTime','fmtWeekday','fmtDayNum','fmtMonth'];
function rel(from,to){const p=relative(dirname(from),to).replaceAll('\\','/');return p.startsWith('.')?p:'./'+p;}
function walk(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const s=join(dir,f.name);if(f.isDirectory())walk(s);else if(/\.tsx?$/.test(f.name)){
 const name=relative(source,s).replaceAll('\\','/');if(name.startsWith('app/login/')||name==='app/layout.tsx'||name==='app/(app)/layout.tsx'||['lib/api.ts','lib/hooks.ts','components/shell/auth.tsx','components/shell/AppShell.tsx','components/shell/Sidebar.tsx'].includes(name))continue;
 const d=join(target,name);if(existsSync(d)&&!process.argv.includes('--force'))continue;
 let t=readFileSync(s,'utf8');t=t.replace(/from "@\/([^"]+)"/g,(_,p)=>`from "${rel(d,join(target,p))}"`).replace(/import Link from "next\/link";/g,'import {ReferenceLink as Link} from "@pepbits/reference-host";').replace(/from "next\/navigation"/g,`from "${rel(d,join(target,'navigation'))}"`);
 const hasApi=/import \{[^}]*\bapi\b[^}]*\} from/.test(t);if(hasApi)t=t.replace(/import \{([^}]+)\} from ("[^"\n]+\/api");/g,(_,names,path)=>`import {${names.split(',').map(s=>s.trim()==='api'?'useSourceApi':s).join(',')}} from ${path};`);
 // Shared control chrome, tables and translation mechanics; backend values/identifiers stay intact.
 const used=new Set();t=t.replace(/<(\/?)(button|input|textarea|select|table|thead|tbody|tr|th|td)(?=[\s/>])/g,(_,slash,name)=>{used.add(controls[name]);return '<'+slash+controls[name];});
 let needsFormat=false;
 t=t.replace(/import \{([^}]+)\} from ("[^"\n]+\/format");/g,(m,names,path)=>{const list=names.split(',').map(s=>s.trim());const taken=list.filter(s=>formats.includes(s));if(!taken.length)return m;needsFormat=true;return `import {${[...list.filter(s=>!formats.includes(s)),'useMedslotFormat'].join(',')}} from ${path};`;});
 // Expression components using formatters need a block to install their scoped formatter hook.
 if(name==='components/shell/Header.tsx')t=t.replace('const ApptRow = ({ a }: { a: Appointment }) => (','const ApptRow = ({ a }: { a: Appointment }) => { return (').replace(/(\n\);\s*)$/,'\n); };\n');
 t=t.replace(/const (PatientSummary|ResourceHead) = ([^]*?) => \(([^]*?)\n\);/g,(_,n,args,body)=>`const ${n} = ${args} => { return (${body}\n); };`);
 const localized=localizeFile(t,d);t=localized.text;
 const wants={...(hasApi?{api:['api']}:{}) ,...(needsFormat?{format:formats}:{}),...(localized.flags.tr?{tr:['tr']}:{})};
 const hooked=injectHooks(t,d,wants,{api:'useSourceApi',format:'useMedslotFormat'});t=hooked.text;if(hooked.orphans.length)console.log(name,hooked.orphans);
 const extras=[...used].map(x=>x==='ManagedTable'?'Table as ManagedTable':x);extras.push( ...(localized.flags.lt?['LocalizedText']:[]),...(localized.flags.tr?['useLocalization']:[]));if(extras.length)t='import {'+extras.join(',')+'} from "@pepbits/ops-ui";\n'+t;
 t=t.replace('"use client";','');t='"use client";\n'+t;
 mkdirSync(dirname(d),{recursive:true});writeFileSync(d,t);
 }}}
walk(source);
