// Usage: node source-checkpoint.mjs <out.json> — the manifest file set and digest at a point in time (same rules as write-manifest.mjs).
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const fixed=['package.json','package-lock.json','turbo.json','tsconfig.base.json','docs/README.md','docs/features/README.md','docs/features/tenant-admin-demo.md','demo-apps/README.md','docs/testing/README.md','docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md','docs/releases/unreleased/README.md'];
const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(path=>path&&(path.startsWith('packages/')||path.startsWith('tooling/')||path.startsWith('demo-apps/')||fixed.includes(path))))].sort();
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=paths.map(path=>({path,sha256:sha(readFileSync(path))}));
const source=files.filter(f=>!f.path.startsWith('docs/')&&!f.path.endsWith('.md'));
const digest=list=>sha(list.map(file=>`${file.path}\0${file.sha256}\n`).join(''));
writeFileSync(process.argv[2],JSON.stringify({time:new Date().toISOString(),base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:files.length,implementationDigest:digest(files),sourceFiles:source.length,sourceDigest:digest(source),note:'sourceDigest excludes Markdown/docs so later documentation edits do not change it.'},null,2)+'\n');
console.log(files.length,digest(files),source.length,digest(source));
