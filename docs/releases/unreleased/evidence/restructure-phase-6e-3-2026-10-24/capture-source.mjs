import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

// Runtime, test, build and dependency inputs; prose/evidence are finalized after verification.
const fixed = ['package.json', 'package-lock.json', 'turbo.json', 'tsconfig.base.json'];
const paths = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding: 'utf8'}).split('\0')
  .filter(path => path && (fixed.includes(path) || /^(packages|tooling|demo-apps)\//.test(path)) && !path.endsWith('.md')))].sort();
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = sha(paths.map(path => `${path}\0${sha(readFileSync(path))}\n`).join(''));
console.log(JSON.stringify({time: new Date().toISOString(), baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  scope: 'All tracked/nonignored non-Markdown packages, tooling, demo-apps and four root configuration files', files: paths.length, sha256: digest}, null, 2));
