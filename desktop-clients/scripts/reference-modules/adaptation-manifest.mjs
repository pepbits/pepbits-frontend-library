/** Source provenance and destination catalogue; never writes reference sources. */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,relative} from 'node:path';
import {REFERENCE_MODULES} from '../../packages/erp-config/src/reference-modules.ts';
const root=resolve(import.meta.dirname,'../../..');
const inventory=JSON.parse(readFileSync(join(root,'docs/reference-import/SOURCE-INVENTORY.json'),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
const modules=inventory.modules.map(source=>{
 const registration=REFERENCE_MODULES.find(m=>m.variant===source.module);
 const packagePath=`desktop-clients/packages/reference-${source.module}`;
 const core=['erp1','erp2'].includes(source.module)?'desktop-clients/packages/reference-keystone-core':null;
 const backend=source.module.startsWith('erp')?'dummy-api/reference-erp-store.mjs':`dummy-api/reference-${source.module}-store.mjs`;
 const files=source.sourceFiles.map(f=>{
  if(sha(readFileSync(join(source.sourceRoot,f.path)))!==f.sha256)throw new Error(`Source changed: ${source.module}/${f.path}`);
  let treatment='domain source consolidated into public module and shared primitives';
  let destinations=[packagePath,...(core?[core]:[])];
  if(/src\/app\/api\/|src\/lib\/(mock|data)\/|src\/lib\/(seed|random|bank|store|auth|session)\./.test(f.path)){treatment='server-only synthetic data, storage or trusted authorization';destinations=[backend,'dummy-api/server.mjs'];}
  else if(/src\/app\/(login\/page|page)\.tsx|\/(shell|sidebar|header|topbar|layout)\./.test(f.path)){treatment='existing host shell/authentication with source domain content in module';destinations=[packagePath,'desktop-clients/packages/reference-host','desktop-clients/packages/erp-shell'];}
  else if(/package(-lock)?\.json|config\.|\.env|README|\.gitignore/.test(f.path)){treatment='source infrastructure provenance; existing workspace build reused';destinations=[`${packagePath}/package.json`];}
  return{source:f.path,sha256:f.sha256,treatment,destinations};
 });
 return{moduleId:registration.id,publicPackage:`@pepbits/reference-${source.module}`,sourceRoot:source.sourceRoot,sourceDigest:source.sourceDigest,sourceFileCount:files.length,staticDestinations:registration.pages.map(p=>({pageId:p.id,path:p.path,package:packagePath,sharedCore:core})),sourcePageRoutes:source.routes.filter(r=>r.kind==='page').map(r=>({...r,treatment:r.path==='/login'?'existing host sign-in':r.path==='/'&&source.module==='school'?'trusted host identity selects source role dashboard':'module route resolver preserves source path and parameters'})),sourceTemplates:source.templates??[],sharedCore:core,backend,files};
});
const packages=['reference-host','reference-reports','reference-erp1','reference-erp2','reference-keystone-core','reference-school'].map(name=>{
 const path=`desktop-clients/packages/${name}`;
 const files=walk(join(root,path,'src')).filter(p=>!p.includes('/test-support/')&&!p.includes('.test.')&&!p.endsWith('.d.ts'));
 return{package:name,publicExports:JSON.parse(readFileSync(join(root,path,'package.json'),'utf8')).exports,runtimeFiles:files.map(p=>({path:relative(root,p),sha256:sha(readFileSync(p))}))};
});
const result={schemaVersion:1,createdAt:new Date().toISOString(),sourceMutation:false,acceptance:'Provenance and route coverage. Visual and workflow acceptance is recorded separately; this manifest does not assert pixel equivalence.',staticDestinationCount:modules.reduce((n,m)=>n+m.staticDestinations.length,0),hostBoundary:'Public exports only; trusted scope, injected API transport, host preferences and navigation. No standalone source application shell or backend imported into client main exports.',modules,packages};
writeFileSync(join(root,'docs/reference-import/ADAPTATION-MANIFEST.json'),JSON.stringify(result,null,2)+'\n');
console.log(`Verified ${modules.reduce((n,m)=>n+m.sourceFileCount,0)} unchanged source files; ${result.staticDestinationCount} static destinations; ${packages.length} public packages.`);
