import {createRequire} from 'node:module';
import {readdirSync,readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
const require=createRequire(new URL('../../desktop-clients/package.json',import.meta.url)),ts=require('typescript');
const base=resolve(import.meta.dirname,'..');
for(const name of ['tenant-admin','medband','rcm','surgisuite','medslot']){
 const root=join(base,name+'-source/src'),target=join(import.meta.dirname,'dist',name);
 function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const file=join(dir,item.name);if(item.isDirectory())walk(file);else if(file.endsWith('.ts')){
  const destination=join(target,relative(root,file).replace(/\.ts$/,'.js'));mkdirSync(dirname(destination),{recursive:true});
  let source=readFileSync(file,'utf8').replace(/^import ['"]server-only['"];?\s*$/gm,'');
  source=source.replace(/(from\s*|import\s*)['"](@\/[^'"]+)['"]/g,(_,prefix,path)=>prefix+JSON.stringify('./'+relative(dirname(file),join(root,path.slice(2))).replaceAll('\\','/')));
  source=source.replace(/(['"])(\.\.?\/[^'"]+)\1/g,(match,quote,path)=>{
   if(path.endsWith('reference-sqlite.mjs'))return JSON.stringify(relative(dirname(destination),join(base,'reference-sqlite.mjs')).replaceAll('\\','/'));
   if(/\.[a-z0-9]+$/i.test(path))return match;
   const candidate=resolve(dirname(file),path),resolved=statSync(candidate,{throwIfNoEntry:false})?.isDirectory()?path+'/index.js':path+'.js';
   return quote+resolved+quote;
  });
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  if(process.argv.includes('--check')){if(readFileSync(destination,'utf8')!==output)throw Error('Stale access API build: '+destination);}else writeFileSync(destination,output);
 }}}
 walk(root);console.log('Built original '+name+' API services.');
}
