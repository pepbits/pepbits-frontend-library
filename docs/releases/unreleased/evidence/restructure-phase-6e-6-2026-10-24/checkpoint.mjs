import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
const paths = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding: 'utf8'}).split('\0').filter(path => /^(packages|demo-apps|tooling)\//.test(path) || ['package.json', 'package-lock.json', 'turbo.json', 'tsconfig.base.json'].includes(path)))].sort();
const files = paths.map(path => ({path, sha256: sha(readFileSync(path))}));
const checkpoint = {time: new Date().toISOString(), base: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), files: files.length, digest: sha(files.map(file => `${file.path}\0${file.sha256}\n`).join('')), scope: 'All tracked/nonignored packages/, demo-apps/, tooling/ files and root package.json, package-lock.json, turbo.json, tsconfig.base.json'};
writeFileSync(process.argv[2], JSON.stringify(checkpoint, null, 2) + '\n');
console.log(JSON.stringify(checkpoint));
