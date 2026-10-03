import ts from 'typescript';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
for(const variant of ['lis1','lis2','ris1'])for(const file of walk(join(root,'packages/reference-'+variant+'/src')).filter(f=>/\.tsx?$/.test(f))){
 if(/\/lib\/(api|client|format)\.ts$/.test(file))continue;
 let text=readFileSync(file,'utf8'),sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),edits=[],names=new Set(),formats=new Set();
 for(const s of sf.statements){
  if(ts.isImportDeclaration(s)&&s.importClause?.namedBindings&&ts.isNamedImports(s.importClause.namedBindings)){
   const mod=s.moduleSpecifier.text,n=s.importClause.namedBindings.elements;
   const remove=n.filter(e=>(/\/lib\/api$|^\.\/api$/.test(mod)&&['api','get','post','put','del','token'].includes(e.name.text))||(/\/lib\/format$|^\.\/format$/.test(mod)&&['fmtDateTime','fmtDate','fmtTime','money'].includes(e.name.text))||(/\/lib\/client$|^\.\/client$/.test(mod)&&e.name.text==='api'));
   for(const e of remove){if(['fmtDateTime','fmtDate','fmtTime','money'].includes(e.name.text))formats.add(e.name.text);else if(e.name.text!=='token')names.add(e.name.text);}
   if(remove.length){const keep=n.filter(e=>!remove.includes(e)).map(e=>e.getText(sf));edits.push([s.getStart(sf),s.end,keep.length?`import {${keep.join(',')}} from '${mod}';`:'']);}
  }
 }
 if(variant==='ris1'||variant==='lis2')if(/\bfetch\(/.test(text))names.add('fetch');
 if(/window\.open\(/.test(text))names.add('open');
 for(const s of sf.statements){
  if(ts.isFunctionDeclaration(s)&&s.body){
   const body=s.body.getText(sf),needed=[...names].filter(n=>n==='open'?body.includes('window.open('):new RegExp('\\b'+n+'\\b').test(body)),fmt=[...formats].filter(n=>new RegExp('\\b'+n+'\\b').test(body));
   if(needed.length||fmt.length){
    if(!/^[A-Z]|^use/.test(s.name?.text??'')){console.log('REVIEW outside hook',file,s.name?.text);continue;}
    edits.push([s.body.getStart(sf)+1,s.body.getStart(sf)+1,'\n'+(needed.length?` const {${needed.join(',')}}=useDiagnosticClient();\n`:'')+(fmt.length?` const {${fmt.join(',')}}=useDiagnosticFormat();\n`:'')]);
   }
  }
 }
 for(const [a,b,value] of edits.sort((a,b)=>b[0]-a[0]))text=text.slice(0,a)+value+text.slice(b);
 if(names.size||formats.size)text="import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';\n"+text;
 text=text.replace(/window\.open\(([^\n]+?),\s*['_"]_blank['_"]\)/g,'open($1)');
 text=text.replace(/    if \(!token.get\(\)\) \{[^\n]+\n/g,'');
 if(file.endsWith('.tsx')){
  const elements={button:'DiagnosticButton',input:'DiagnosticInput',textarea:'DiagnosticTextarea',select:'DiagnosticSelect',table:'DiagnosticTable',thead:'TableHeader',tbody:'TableBody',tr:'TableRow',th:'TableHead',td:'TableCell'};const used=[];
  for(const [tag,name] of Object.entries(elements)){const re=new RegExp('<(/?)'+tag+'(?=[\\s>])','g');if(re.test(text)){text=text.replace(re,`<$1${name}`);used.push(name);}}
  if(used.length)text=`import {${used.join(',')}} from '@pepbits/reference-diagnostics';\n`+text;
 }
 // Directives must precede imports.
 text=text.replace(/^'use client';\n/gm,'');text="'use client';\n"+text;
 writeFileSync(file,text);
}
