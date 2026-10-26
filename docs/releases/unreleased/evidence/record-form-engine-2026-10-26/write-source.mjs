import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8',maxBuffer:16*1024*1024}).split('\0').filter(path=>path&&existsSync(path)&&(/^(packages|demo-apps|tooling|mock-api)\//.test(path)||['package.json','package-lock.json','Jenkinsfile','turbo.json','tsconfig.base.json'].includes(path))))].sort();
const files=paths.map(path=>({path,sha256:sha(readFileSync(path))}));
const result={base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),digest:sha(files.map(file=>`${file.path}\0${file.sha256}\n`).join('')),scope:'Root build configuration and all tracked/nonignored packages, demos, tooling and mock-api. Excludes release evidence/docs to avoid self-reference; no Git writes.',files};
writeFileSync(process.argv[2]??'/tmp/record-source.json',JSON.stringify(result,null,2)+'\n');console.log(`${files.length} files; ${result.digest}`);
