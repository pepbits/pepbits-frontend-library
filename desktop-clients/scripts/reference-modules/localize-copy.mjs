/** One-time source adaptation. Translates presentation nodes, never service payloads. */
import ts from 'typescript';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const apply=process.argv.includes('--write');
const roots=process.argv.slice(2).filter(arg=>!arg.startsWith('--'));
const attrs=new Set(['label','title','subtitle','description','placeholder','aria-label','alt','message','hint','confirmLabel','cancelLabel','emptyMessage','sub']);
let changed=0,sites=0;const unresolved=[];
const human=value=>/[A-Za-z]/.test(value)&&!value.startsWith('/');
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){if(['fixtures','mock','data','test-support','node_modules'].includes(item.name))continue;const file=join(dir,item.name);if(item.isDirectory())walk(file);else if(file.endsWith('.tsx')&&!file.includes('.test.'))adapt(file);}}
function adapt(file){
 const source=readFileSync(file,'utf8'),sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[],hooks=new Set();let textImport=false,hookImport=false;
 const replace=(node,text)=>{edits.push({start:node.getStart(sf),end:node.end,text});sites++;};
 function component(node){for(let parent=node.parent;parent;parent=parent.parent){if(ts.isFunctionDeclaration(parent)&&parent.name&&/^[A-Z]/.test(parent.name.text)&&parent.body)return parent.body;
  if((ts.isArrowFunction(parent)||ts.isFunctionExpression(parent))&&ts.isBlock(parent.body)&&ts.isVariableDeclaration(parent.parent)&&/^[A-Z]/.test(parent.parent.name.getText(sf)))return parent.body;}return null;}
 function translator(node){const body=component(node);if(!body){unresolved.push(`${file}:${sf.getLineAndCharacterOfPosition(node.pos).line+1}: presentation attribute outside a component`);return null;}hooks.add(body);hookImport=true;return 'referenceT';}
 function template(expression,node){let message=expression.head.text,values=[];expression.templateSpans.forEach((span,index)=>{message+=`{value${index}}${span.literal.text}`;let value=span.expression.getText(sf);if(ts.isPropertyAccessExpression(span.expression)&&span.expression.name.text==='label')value=`referenceT(${value})`;values.push(`value${index}: ${value}`);});if(!human(message))return null;const t=translator(node);return t?`${t}(${JSON.stringify(message)}, {${values.join(', ')}})`:null;}
 function visit(node){
  if(ts.isJsxText(node)){const raw=source.slice(node.pos,node.end),text=raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).join(' ');if(human(text)){const left=!raw.includes('\n')&&/^\s/.test(raw)?' ':'';const right=!raw.includes('\n')&&/\s$/.test(raw)?' ':'';edits.push({start:node.pos,end:node.end,text:`${left}<ReferenceText message=${JSON.stringify(text)} />${right}`});textImport=true;sites++;}return;}
  if(ts.isJsxAttribute(node)&&attrs.has(node.name.getText(sf))&&node.initializer){
   const tag=node.parent.parent.tagName?.getText(sf);
   if(node.name.getText(sf)==='message'&&['ReferenceText','LocalizedText'].includes(tag))return;
   if(ts.isStringLiteral(node.initializer)&&human(node.initializer.text)){const t=translator(node);if(t)replace(node.initializer,`{${t}(${JSON.stringify(node.initializer.text)})}`);return;}
   if(ts.isJsxExpression(node.initializer)&&node.initializer.expression&&ts.isTemplateExpression(node.initializer.expression)){const value=template(node.initializer.expression,node);if(value)replace(node.initializer,`{${value}}`);return;}
  }
  if(ts.isJsxExpression(node)&&node.expression&&(ts.isJsxElement(node.parent)||ts.isJsxFragment(node.parent))){const expr=node.expression;
   if(ts.isStringLiteral(expr)&&human(expr.text)){replace(node,`<ReferenceText message=${JSON.stringify(expr.text)} />`);textImport=true;return;}
   if(ts.isTemplateExpression(expr)){const value=template(expr,node);if(value){replace(expr,value);return;}}
   if(ts.isPropertyAccessExpression(expr)&&expr.name.text==='label'){replace(node,`<ReferenceText message={${expr.getText(sf)}} />`);textImport=true;return;}
  }
  ts.forEachChild(node,visit);
 }visit(sf);
 if(!edits.length)return;
 for(const body of hooks){const existing=body.statements.some(statement=>ts.isVariableStatement(statement)&&statement.declarationList.declarations.some(declaration=>declaration.name.getText(sf)==='referenceT'));if(!existing)edits.push({start:body.getStart(sf)+1,end:body.getStart(sf)+1,text:'\n const referenceT = useReferenceLocalization().t;\n'});}
 const imports=[];if(textImport&&!source.includes('LocalizedText as ReferenceText'))imports.push('LocalizedText as ReferenceText');if(hookImport&&!source.includes('useLocalization as useReferenceLocalization'))imports.push('useLocalization as useReferenceLocalization');
 if(imports.length){const statements=sf.statements.filter(statement=>ts.isImportDeclaration(statement));const at=statements.length?statements.at(-1).end:sf.statements[0]?.end??0;edits.push({start:at,end:at,text:`\nimport { ${imports.join(', ')} } from '@pepbits/ops-ui';\n`});}
 edits.sort((a,b)=>b.start-a.start||b.end-a.end);let result=source,last=source.length;for(const edit of edits){if(edit.end>last)throw Error(`Overlapping localization edit in ${file}`);result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);last=edit.start;}
 changed++;if(apply)writeFileSync(file,result);
}
roots.forEach(root=>walk(resolve(root)));
console.log(`${apply?'Adapted':'Would adapt'} ${sites} presentation nodes in ${changed} files.`);
if(unresolved.length)console.log([...new Set(unresolved)].join('\n'));
