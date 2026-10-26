import {execFileSync} from 'node:child_process';
import {readFileSync, existsSync, statSync} from 'node:fs';

// High-signal credential scan. Prints file names only, never matching values.
const paths = [...new Set([
  ...execFileSync('git', ['diff', '--name-only', '-z'], {encoding:'utf8'}).split('\0'),
  ...execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {encoding:'utf8'}).split('\0'),
])].filter(path => path && existsSync(path) && statSync(path).isFile());
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|npm_[A-Za-z0-9]{30,})\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{30,}\b/,
];
const findings = paths.filter(path => {
  const contents = readFileSync(path);
  return !contents.includes(0) && patterns.some(pattern => pattern.test(contents.toString('utf8')));
});
console.log(JSON.stringify({scope:'Existing changed and untracked text files; private keys, GitHub/npm, AWS access IDs and Slack token patterns',files:paths.length,findings},null,2));
if (findings.length) process.exitCode = 1;
