// Prints the same implementation digest write-manifest.mjs records, for checkpoints before/after runs.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const fixed=['package.json','package-lock.json','turbo.json','tsconfig.base.json','docs/README.md','docs/features/README.md','docs/features/reports-demo.md','docs/testing/README.md','docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md','docs/releases/unreleased/README.md'];
const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(path=>path&&(path.startsWith('packages/')||path.startsWith('tooling/')||path.startsWith('demo-apps/')||fixed.includes(path))))].sort();
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=paths.map(path=>({path,sha256:sha(readFileSync(path))}));
const out={label:process.argv[3]??'checkpoint',time:new Date().toISOString(),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:files.length,implementationDigest:sha(files.map(f=>`${f.path}\0${f.sha256}\n`).join(''))};
writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
