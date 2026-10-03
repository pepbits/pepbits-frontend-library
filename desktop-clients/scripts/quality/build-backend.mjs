/** Embed the original Quality API services without a second public listener. */
import ts from 'typescript';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'../../..'),source=join(root,'dummy-api/quality-source'),dest=join(root,'dummy-api/quality-runtime/dist');
const walk=d=>readdirSync(d,{withFileTypes:true}).filter(e=>e.name!=='node_modules').flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
let count=0;
for(const file of walk(source).filter(f=>f.endsWith('.ts'))){
 const output=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,esModuleInterop:true}});
 const errors=output.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)??[];if(errors.length)throw new Error('Quality source transpilation failed: '+file);
 const out=join(dest,relative(source,file)).replace(/\.ts$/,'.js');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,output.outputText);count++;
}
console.log(JSON.stringify({status:'TRANSPILED',files:count,typeChecked:false}));
