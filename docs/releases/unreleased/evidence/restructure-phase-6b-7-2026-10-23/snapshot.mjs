import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const files=[...new Set(paths.filter(p=>p.startsWith('packages/')||p.startsWith('tooling/')||p.startsWith('demo-apps/')||['package.json','package-lock.json','turbo.json','tsconfig.base.json'].includes(p)))].sort().map(path=>({path,sha256:sha(readFileSync(path))}));
const snapshot={base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files,digest:sha(files.map(f=>`${f.path}\0${f.sha256}\n`).join(''))};
try{snapshot.buildId=readFileSync('demo-apps/healthcare/.next/BUILD_ID','utf8').trim();}catch{}
writeFileSync(process.argv[2],JSON.stringify(snapshot,null,2)+'\n');console.log(files.length+' input files; '+snapshot.digest);
