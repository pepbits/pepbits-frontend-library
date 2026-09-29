/** Source metadata and copy inventory for the host's canonical four-language catalogs. */
import ts from 'typescript';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../src',import.meta.url));
const messages=new Set(['Healthcare Suite','Healthcare Suite facility','Healthcare Suite page not found','Loading Healthcare Suite','View or filter','Healthcare Suite is read-only for your role.']);
const props=new Set(['label','title','subtitle','sub','description','placeholder','aria-label','alt','message','hint','confirmLabel','cancelLabel','submitLabel','emptyMessage','body','header']);
const add=value=>{if(/[A-Za-z]/.test(value)&&!/^hc-/.test(value))messages.add(value.trim());};
function literal(node){if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))add(node.text);if(ts.isConditionalExpression(node)){literal(node.whenTrue);literal(node.whenFalse);}}
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const file=join(dir,e.name);if(e.isDirectory())walk(file);else if(/\.tsx?$/.test(file)&&!file.includes('.test.')){
 const s=readFileSync(file,'utf8'),sf=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function visit(n){
  if(ts.isJsxAttribute(n)&&props.has(n.name.getText(sf))&&n.initializer){if(ts.isJsxExpression(n.initializer)&&n.initializer.expression)literal(n.initializer.expression);else literal(n.initializer);}
  if(ts.isPropertyAssignment(n)&&props.has(n.name.getText(sf)))literal(n.initializer);
  if(ts.isCallExpression(n)&&n.expression.getText(sf)==='inp'&&n.arguments[1])literal(n.arguments[1]);
  if(ts.isCallExpression(n)&&['t','healthcareT','translate','usePageHeader'].includes(n.expression.getText(sf)))n.arguments.forEach(literal);
  if(ts.isPropertyAssignment(n)&&['options','values'].includes(n.name.getText(sf))&&ts.isArrayLiteralExpression(n.initializer))n.initializer.elements.forEach(literal);
  if(ts.isVariableDeclaration(n)&&['PROVIDER_TYPES','LICENSED','STATUSES','TYPES','PAYMENTS','GENDERS','FREQUENCIES','ROUTES','NATIONALITIES','DAYS'].includes(n.name.getText(sf))&&n.initializer&&ts.isArrayLiteralExpression(n.initializer))n.initializer.elements.forEach(literal);
  if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='STATUS_TONE'&&n.initializer&&ts.isObjectLiteralExpression(n.initializer))n.initializer.properties.forEach(p=>{if(p.name){if(ts.isIdentifier(p.name))add(p.name.text);else literal(p.name);}});
  ts.forEachChild(n,visit);
 }visit(sf);
}}}
walk(root);
writeFileSync(fileURLToPath(new URL('../localization-inventory.en.json',import.meta.url)),JSON.stringify([...messages].sort(),null,2)+'\n');
console.log(`Healthcare Suite: ${messages.size} English copy/metadata templates inventoried.`);
