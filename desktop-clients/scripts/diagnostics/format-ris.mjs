import ts from 'typescript';import {readFileSync,writeFileSync,readdirSync} from 'node:fs';import {join,resolve} from 'node:path';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
for(const file of walk(resolve(import.meta.dirname,'../../packages/reference-ris1/src')).filter(f=>f.endsWith('.tsx'))){
 let text=readFileSync(file,'utf8');if(!/import \{[^}]*\bfmt\b[^}]*\} from .*lib\/client/.test(text))continue;
 text=text.replace(/(import \{[^}]*)(\bfmt\b)([^}]*\} from .*lib\/client[^\n]*)/,(a,b,c,d)=>b+'useFmt'+d);
 const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 for(const s of sf.statements)if(ts.isFunctionDeclaration(s)&&s.body&&/\bfmt\./.test(s.body.getText(sf)))edits.push(s.body.getStart(sf)+1);
 for(const pos of edits.reverse())text=text.slice(0,pos)+'\n const fmt=useFmt();\n'+text.slice(pos);
 writeFileSync(file,text);
}
