import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function generate(){
 const files=readdirSync(resolve(app,'src/examples')).filter(name=>name.endsWith('.tsx')).sort();
 const result={};
 for(const file of files){
  const source=readFileSync(resolve(app,'src/examples',file),'utf8');
  const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  for(const statement of parsed.statements)if(ts.isImportDeclaration(statement)){
   const specifier=statement.moduleSpecifier.text;
   if(specifier!=='react'&&!/^@pepbits\/(?!.*\/src(?:\/|$))/.test(specifier))throw new Error(`${file}: non-public example import ${specifier}`);
  }
  result[file.slice(0,-4)]=source;
 }
 writeFileSync(resolve(app,'src/generated/snippets.json'),JSON.stringify(result,null,2)+'\n');
 console.log(`Generated ${files.length} source-identical examples`);
 return result;
}
generate();
