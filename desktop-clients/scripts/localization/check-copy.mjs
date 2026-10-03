/** Deliberately inspect source nodes, not rendered record values. */
import ts from 'typescript';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const read=file=>JSON.parse(readFileSync(join(root,file),'utf8'));
const exceptions=read('desktop-clients/scripts/localization/copy-exceptions.json');
const failures=[],languages=['en','ar','hi','ml'],known=new Set();let catalogKeys=0,sites=0;
const placeholders=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');
function catalogs(dir){for(const item of readdirSync(dir,{withFileTypes:true})){if(item.isDirectory())catalogs(join(dir,item.name));else if(item.name==='en.json'){
 const en=JSON.parse(readFileSync(join(dir,'en.json'),'utf8')).messages;
 for(const[k,v] of Object.entries(en)){known.add(k);known.add(v);catalogKeys++;}
 for(const lang of languages.slice(1)){const target=JSON.parse(readFileSync(join(dir,lang+'.json'),'utf8')).messages;for(const [key,value] of Object.entries(en)){
  if(!Object.hasOwn(target,key))failures.push(`${relative(root,dir)}/${lang}: missing ${key}`);
  else if(placeholders(value)!==placeholders(target[key]))failures.push(`${lang}: placeholders differ for ${key}`);
  else if(value===target[key]&&/[A-Za-z]/.test(value.replace(/\{\w+\}/g,''))&&!exceptions[value.trim()])failures.push(`${lang}: untranslated ${key}`);
 }}
}}}
catalogs(join(root,'dummy-api/config/localization'));
const props=new Set(['label','title','subtitle','description','placeholder','aria-label','alt','message','hint','confirmLabel','cancelLabel','emptyMessage','sub','note']);
function check(value,file,node,sf,raw=false){value=value.trim();if(!/[A-Za-z]/.test(value)||exceptions[value])return;sites++;if(!known.has(value))failures.push(`${relative(root,file)}:${sf.getLineAndCharacterOfPosition(node.pos).line+1}: missing copy ${JSON.stringify(value)}`);else if(raw)failures.push(`${relative(root,file)}:${sf.getLineAndCharacterOfPosition(node.pos).line+1}: raw JSX copy ${JSON.stringify(value)}`);}
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.tsx')&&!file.includes('.test.')){
 const source=readFileSync(file,'utf8'),sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node){
  if(ts.isJsxText(node))check(source.slice(node.pos,node.end).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).join(' '),file,node,sf,true);
  if(ts.isJsxAttribute(node)&&props.has(node.name.getText(sf))&&node.initializer&&ts.isStringLiteral(node.initializer))check(node.initializer.text,file,node,sf);
  if(ts.isJsxAttribute(node)&&props.has(node.name.getText(sf))&&node.initializer&&ts.isJsxExpression(node.initializer)){
   const expression=node.initializer.expression;
   if(expression&&ts.isTemplateExpression(expression)){
    const text=[expression.head.text,...expression.templateSpans.map(span=>span.literal.text)].join('');
    if(/[A-Za-z]/.test(text))failures.push(`${relative(root,file)}:${sf.getLineAndCharacterOfPosition(node.pos).line+1}: translate the whole presentation template ${JSON.stringify(text)}`);
   }
  }
  ts.forEachChild(node,visit);
 }visit(sf);
}}}
for(const pkg of ['erp-screens','ai-ui','erp-shell','ops-ui','reference-host','reference-reports','reference-erp1','reference-erp2','reference-school','reference-healthcare-suite','reference-keystone-core','reference-diagnostics','reference-lis1','reference-lis2','reference-ris1','reference-teleconsult','reference-quality','reference-pharmacy','reference-tenant-admin','reference-medband','reference-rcm','reference-surgisuite','reference-medslot'])walk(join(root,`desktop-clients/packages/${pkg}/src`));
if(failures.length){console.error([...new Set(failures)].join('\n'));process.exitCode=1;}else console.log(`PASS ${catalogKeys} catalog keys in four languages; ${sites} static presentation references; explicit data/code exceptions.`);
