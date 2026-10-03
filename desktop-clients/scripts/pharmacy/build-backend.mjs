/** Reproduce the original TypeScript Phial services inside the single authenticated demo API. */
import ts from 'typescript';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'../../..'),source=join(root,'dummy-api/pharmacy-source/src'),dest=join(root,'dummy-api/pharmacy-runtime/dist');
const walk=d=>readdirSync(d,{withFileTypes:true}).filter(e=>e.name!=='node_modules').flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
let count=0;for(const file of walk(source).filter(f=>f.endsWith('.ts'))){
 const output=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,esModuleInterop:true}});
 if(output.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error))throw Error('Pharmacy transpilation failed: '+file);
 const out=join(dest,relative(source,file)).replace(/\.ts$/,'.js');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,output.outputText);count++;
}
copyFileSync(join(source,'db/schema.sql'),join(dest,'db/schema.sql'));console.log(JSON.stringify({status:'TRANSPILED',files:count,typeChecked:false}));
