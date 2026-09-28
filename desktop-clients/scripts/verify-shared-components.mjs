/** Prevent page-specific copies of the shared presentation components. */
import ts from 'typescript';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
const root=new URL('..',import.meta.url).pathname;
const failures=[];let files=0,uses=0;
const names=new Set(['Card','CardGrid','Table','TableContainer','DateInput','TimeInput','DateTimeInput','MonthInput','WeekInput','Calendar','DataValue','DescriptionList']);
function* sources(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())yield* sources(file);else if(file.endsWith('.tsx')&&!file.endsWith('.test.tsx'))yield file;}}
for(const pkg of ['erp-screens','ai-ui','reference-reports','reference-erp1','reference-erp2','reference-school','reference-keystone-core'])for(const file of sources(join(root,'packages',pkg,'src'))){
  files++;const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function report(node,message){failures.push(`${relative(root,file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line+1}: ${message}`);}
  function visit(node){
    if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
      const tag=node.tagName.getText(source);if(names.has(tag))uses++;
      const attr=name=>node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)===name)?.initializer;
      const classValue=attr('className'),classes=classValue&&ts.isStringLiteral(classValue)?classValue.text.split(/\s+/):[];
      if(tag==='table')report(node,'Use Table.');
      if(tag==='Input'&&/\b(date|time|datetime-local|month|week)\b/.test(attr('type')?.getText(source)??''))report(node,'Use the dedicated date/time component.');
      if(['div','section','article'].includes(tag)&&classes.includes('border')&&classes.includes('border-[var(--border)]')&&classes.some(c=>['rounded-[var(--radius)]','rounded-lg','rounded-xl','rounded-2xl'].includes(c))&&(classes.includes('bg-[var(--surface)]')||classes.includes('bg-[var(--surface-2)]')||classes.includes('rounded-[var(--radius)]')))report(node,'Use Card with tone, radius and shadow properties.');
      if(tag==='div'&&ts.isJsxElement(node.parent)){
        if(classes.some(c=>c.startsWith('overflow')||c.includes(':overflow'))&&node.parent.children.some(c=>ts.isJsxElement(c)&&c.openingElement.tagName.getText(source)==='Table'))report(node,'Use TableContainer.');
        if(classes.includes('grid')){
          let containsCard=false;
          function find(child){if((ts.isJsxOpeningElement(child)||ts.isJsxSelfClosingElement(child))&&['Card','StatCard'].includes(child.tagName.getText(source)))containsCard=true;ts.forEachChild(child,find);}
          node.parent.children.forEach(find);if(containsCard)report(node,'Use CardGrid and retain the current breakpoint classes.');
        }
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log(`PASS shared component adoption: ${files} page/AI source files checked, ${uses} shared component uses. Alerts, charts, editor layouts and interactive choice controls retain specialized markup.`);
