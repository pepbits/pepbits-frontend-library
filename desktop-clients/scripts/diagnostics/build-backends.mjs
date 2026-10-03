/** Compile original service logic; retain decorators/metadata required by Nest/TypeORM. */
import ts from 'typescript';import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';import {join,resolve,relative,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'../../..'),source=join(root,'dummy-api/diagnostics-source'),dest=join(root,'dummy-api/diagnostics-runtime/dist');
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
let count=0;const routes=[];
for(const variant of ['lis1','lis2','ris1'])for(const file of walk(join(source,variant,'src')).filter(f=>f.endsWith('.ts'))){
 let text=readFileSync(file,'utf8');
 text=text.replace(/from ['"]@\/([^'"]+)['"]/g,(_,p)=>"from '"+relative(dirname(file),join(source,variant,'src',p)).replace(/^(?!\.)/,'./')+"'");
 const output=ts.transpileModule(text,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}});
 const errors=output.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)??[];if(errors.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>root,getCanonicalFileName:p=>p,getNewLine:()=> '\n'}));
 const out=join(dest,variant,relative(join(source,variant,'src'),file)).replace(/\.ts$/,'.js');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,output.outputText);count++;
 if(variant==='ris1'&&file.endsWith('/route.ts'))routes.push({path:'/'+relative(join(source,variant,'src/app'),dirname(file)),file:relative(dest,out)});
}
writeFileSync(join(dest,'ris-routes.json'),JSON.stringify(routes,null,2));console.log(JSON.stringify({status:'TRANSPILED',files:count,typeChecked:false}));
