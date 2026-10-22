// Starts the API (port 4000) and the web app (port 3000) together. Ctrl+C stops both.
import { spawn } from 'node:child_process';

const mode = process.argv[2] === 'start' ? 'start' : 'dev';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const procs = [
  ['api', spawn(npm, ['--prefix', 'backend', 'run', mode === 'start' ? 'start' : 'dev'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })],
  ['web', spawn(npm, ['--prefix', 'frontend', 'run', mode], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })],
];
for (const [name, p] of procs) {
  const tag = name === 'api' ? '\x1b[36m[api]\x1b[0m' : '\x1b[33m[web]\x1b[0m';
  const out = (d) => d.toString().split('\n').filter(Boolean).forEach((l) => console.log(`${tag} ${l}`));
  p.stdout.on('data', out);
  p.stderr.on('data', out);
  p.on('exit', (code) => { console.log(`${tag} exited with code ${code}`); shutdown(); });
}
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const [, p] of procs) if (!p.killed) p.kill('SIGINT');
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
