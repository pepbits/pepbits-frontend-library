/** Extract human presentation text from reference sources/packages without changing record values. */
import ts from 'typescript';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const sourceRoots=process.argv.slice(2).filter(arg=>!arg.startsWith('--'));
const props=new Set(['label','title','subtitle','description','placeholder','aria-label','alt','message','hint','confirmLabel','cancelLabel','emptyMessage','emptyText','sub','note']);
const messages=new Set();
const human=text=>/[A-Za-z]/.test(text)&&!text.startsWith('/')&&!/[{}<>]/.test(text);
function add(text){text=text.replace(/\s+/g,' ').trim();if(human(text))messages.add(text);}
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){if(['node_modules','.next','data','fixtures','mock','test-support','api'].includes(entry.name))continue;const path=join(dir,entry.name);if(entry.isDirectory())walk(path);else if(/\.tsx?$/.test(path)&&!path.includes('.test.')){
 const content=readFileSync(path,'utf8'),sf=ts.createSourceFile(path,content,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function visit(node){
  if(ts.isPropertyAssignment(node)&&['seed','balances','resources'].includes(node.name.getText(sf)))return;
  if(ts.isJsxText(node))add(node.text);
  if(ts.isJsxAttribute(node)&&props.has(node.name.getText(sf))&&node.initializer&&ts.isStringLiteral(node.initializer))add(node.initializer.text);
  if(ts.isPropertyAssignment(node)&&node.name.getText(sf)==='options'&&ts.isArrayLiteralExpression(node.initializer))node.initializer.elements.forEach(value=>{if(ts.isStringLiteral(value))add(value.text);});
  if(ts.isPropertyAssignment(node)&&props.has(node.name.getText(sf).replace(/^['"]|['"]$/g,''))&&ts.isStringLiteral(node.initializer))add(node.initializer.text);
  if(ts.isCallExpression(node)){
   const name=node.expression.getText(sf);
   if((name==='t'||name==='referenceT'||name.endsWith('.t'))&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))messages.add(node.arguments[0].text);
   if(name==='f'&&node.arguments[1]&&ts.isStringLiteral(node.arguments[1]))add(node.arguments[1].text);
  }
  ts.forEachChild(node,visit);
 }visit(sf);
}}}
sourceRoots.forEach(root=>walk(resolve(root)));
const keys=[...messages].sort();const output=Object.fromEntries(keys.map(key=>[key,key]));
writeFileSync('/tmp/reference-body-copy-en.json',JSON.stringify(output,null,2)+'\n');
console.log(`${keys.length} presentation messages in /tmp/reference-body-copy-en.json`);
