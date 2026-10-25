import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
const root=process.cwd(),directory=resolve(root,'demo-apps/erp/src'),catalog=JSON.parse(readFileSync(resolve(root,'mock-api/config/localization/shared/en.json'),'utf8')).messages;
const byText=new Map();for(const [key,value] of Object.entries(catalog))if(typeof value==='string'&&!byText.has(value))byText.set(value,key);
const labels=new Set();function walk(dir){for(const file of readdirSync(dir,{withFileTypes:true})){if(file.name==='test')continue;const path=resolve(dir,file.name);if(file.isDirectory())walk(path);else if(/\.tsx?$/.test(file.name)&&!file.name.includes('.test.')){const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);const visit=node=>{if(ts.isStringLiteral(node)||ts.isJsxText(node)){const text=node.text.trim();if(byText.has(text))labels.add(text);}ts.forEachChild(node,visit);};visit(source);}}}walk(directory);
const aliases=Object.fromEntries([...labels].sort().map(text=>[text,byText.get(text)]));writeFileSync(resolve(directory,'modules/keystone/aliases.json'),JSON.stringify(aliases,null,2)+'\n');console.log(`Generated ${labels.size} ERP aliases from canonical English messages`);
