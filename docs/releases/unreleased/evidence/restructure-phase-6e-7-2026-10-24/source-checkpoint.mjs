// Usage (from the worktree root): node <this file> <output.json>
// Hashes the same file set as write-manifest.mjs, so a check can be tied to the final source.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const fixed=['package.json','package-lock.json','turbo.json','tsconfig.base.json','docs/README.md','docs/features/README.md','docs/features/desktop-demo.md','docs/testing/README.md','docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md','docs/releases/unreleased/README.md'];
const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(path=>path&&(path.startsWith('packages/')||path.startsWith('tooling/')||path.startsWith('demo-apps/')||fixed.includes(path))))].sort();
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=paths.map(path=>({path,sha256:sha(readFileSync(path))}));
const digest=sha(files.map(file=>`${file.path}\0${file.sha256}\n`).join(''));
writeFileSync(process.argv[2],JSON.stringify({time:new Date().toISOString(),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:files.length,digest},null,2)+'\n');
console.log(files.length+' files '+digest);
