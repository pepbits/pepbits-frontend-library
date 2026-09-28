/** Register static reference API errors at the existing language-neutral HTTP boundary. */
import ts from 'typescript';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../../../dummy-api/',import.meta.url));
const registryPath=join(root,'config/api-messages.json'),registry=JSON.parse(readFileSync(registryPath,'utf8')),messages={};
const collect=value=>{if(!Object.hasOwn(registry,value)){const key=/^(school|erp)\.[a-zA-Z][\w.]*$/.test(value)?value:'api.reference.'+createHash('sha256').update(value).digest('hex').slice(0,12);registry[value]=key;messages[key]=value;}};
for(const file of readdirSync(root).filter(name=>name.endsWith('.mjs')&&!name.includes('.test.'))){
 const sf=ts.createSourceFile(file,readFileSync(join(root,file),'utf8'),ts.ScriptTarget.Latest,true);
 function visit(node){
  if(ts.isPropertyAssignment(node)&&node.name.getText(sf)==='error'&&ts.isStringLiteral(node.initializer))collect(node.initializer.text);
  if(file!=='application-config.mjs'&&ts.isCallExpression(node)&&['fail','failure'].includes(node.expression.getText(sf))){const argument=node.arguments.find(ts.isStringLiteral);if(argument)collect(argument.text);}
  if(file.startsWith('reference-')&&ts.isNewExpression(node)&&node.expression.getText(sf)==='HttpError'&&node.arguments?.[1]&&ts.isStringLiteral(node.arguments[1]))collect(node.arguments[1].text);
  ts.forEachChild(node,visit);
 }visit(sf);
}
if(process.argv.includes('--write'))writeFileSync(registryPath,JSON.stringify(registry,null,2)+'\n');
writeFileSync('/tmp/reference-api-copy-new-en.json',JSON.stringify(messages,null,2)+'\n');
console.log(`${Object.keys(messages).length} new static API errors in /tmp/reference-api-copy-new-en.json${process.argv.includes('--write')?'; registry updated':''}.`);
