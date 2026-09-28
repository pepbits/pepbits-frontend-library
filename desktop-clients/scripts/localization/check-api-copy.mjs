/** Verify literal API errors registered at the HTTP display boundary. Dynamic
 * provider diagnostics deliberately retain a readable, parameterized fallback. */
import ts from 'typescript';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../../../dummy-api/',import.meta.url));
const registry=JSON.parse(readFileSync(join(root,'config/api-messages.json')));
const english=JSON.parse(readFileSync(join(root,'config/localization/shared/en.json'))).messages;
const found=new Set(),missing=[];
for(const file of readdirSync(root).filter(name=>name.endsWith('.mjs')&&!name.includes('.test.'))){
 const sf=ts.createSourceFile(file,readFileSync(join(root,file),'utf8'),ts.ScriptTarget.Latest,true);
 function visit(node){
  if(ts.isPropertyAssignment(node)&&node.name.getText(sf)==='error'&&ts.isStringLiteral(node.initializer))found.add(node.initializer.text);
  // Configuration-loader fail() throws startup diagnostics, not HTTP errors.
  if(file!=='application-config.mjs'&&ts.isCallExpression(node)&&['fail','failure'].includes(node.expression.getText(sf))){const argument=node.arguments.find(ts.isStringLiteral);if(argument)found.add(argument.text);}
  // Reference report validators use typed HTTP errors rather than literal result objects.
  if(file.startsWith('reference-')&&ts.isNewExpression(node)&&node.expression.getText(sf)==='HttpError'&&node.arguments?.[1]&&ts.isStringLiteral(node.arguments[1]))found.add(node.arguments[1].text);
  ts.forEachChild(node,visit);
 }visit(sf);
}
for(const source of found)if(!Object.hasOwn(registry,source)||!Object.hasOwn(english,registry[source]))missing.push(source);
if(missing.length){console.error('Register and translate these API errors:\n'+missing.join('\n'));process.exitCode=1;}else console.log(`PASS ${found.size} static API errors registered with catalog message keys.`);
