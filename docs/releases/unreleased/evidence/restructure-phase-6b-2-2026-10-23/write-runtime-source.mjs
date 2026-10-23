import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=data=>createHash('sha256').update(data).digest('hex');
const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0'))].filter(p=>p&&(p.startsWith('packages/')||p.startsWith('demo-apps/healthcare/'))&&!/\.test\.|\/test\/|README|\.md$/.test(p)).sort();
const files=paths.map(path=>({path,sha256:sha(readFileSync(path))}));
const receipt={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),buildId:readFileSync('demo-apps/healthcare/'+(process.env.HEALTHCARE_BUILD_DIR??'.next-phase6b2')+'/BUILD_ID','utf8').trim(),scope:'Public packages and healthcare runtime/config/scripts, excluding test files, fixtures and documentation',digest:sha(files.map(f=>f.path+'\0'+f.sha256+'\n').join('')),files};
writeFileSync(process.argv[2],JSON.stringify(receipt,null,2)+'\n');
