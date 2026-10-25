// Real-HTTP integration: the unchanged demo host API (session, preferences, localization), the
// unchanged Settle Express + SQLite API and the built Next app, each on a free loopback port with
// temporary storage, then Chromium drives the main workflows (scripts/smoke.mjs).
// Run under the shared heavy-check lock after `next build` with NEXT_PUBLIC_API_URL=/api and
// NEXT_PUBLIC_SETTLE_API_URL=/settle-api. Every child is stopped on success, failure, signal or deadline.
import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const app = join(root, 'demo-apps/settle'), temp = mkdtempSync(join(tmpdir(), 'settle-integration-'));
const identityFile = process.env.SETTLE_IDENTITY ?? join(tmpdir(), 'settle-integration-identity.json');
const children = [], cleanup = [];
const identity = {sourceBase: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim()};
const save = () => writeFileSync(identityFile, JSON.stringify(identity, null, 2) + '\n');
let stopping;
function stopChildren() {return stopping ??= (async () => {for (const child of [...children].reverse()) {
  try {process.kill(-child.pid, 'SIGTERM');} catch {}
  await Promise.race([new Promise(resolve => child.exitCode !== null || child.signalCode !== null ? resolve() : child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
  try {process.kill(-child.pid, 'SIGKILL');} catch {}
  await new Promise(resolve => setTimeout(resolve, 100));
  let groupAlive = false; try {process.kill(-child.pid, 0); groupAlive = true;} catch {}
  cleanup.push({label: child.serviceLabel, pid: child.pid, exitCode: child.exitCode, signal: child.signalCode, groupAlive});
}})();}
let cancelled = false;
function cancel(reason) {if (cancelled) return; cancelled = true; void stopChildren().finally(() => {identity.interrupted = reason; identity.cleanup = cleanup; save(); rmSync(temp, {recursive: true, force: true}); process.exit(1);});}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => cancel(signal));
const deadline = setTimeout(() => cancel('deadline'), Number(process.env.SETTLE_TIMEOUT_MS ?? 1800000)); deadline.unref();
const stopFile = process.env.SETTLE_STOP_FILE;
const watcher = stopFile ? setInterval(() => {if (existsSync(stopFile)) cancel('stop-file');}, 500) : null; watcher?.unref();
const freePort = () => new Promise(resolve => {const server = createServer(); server.listen(0, '127.0.0.1', () => {const port = server.address().port; server.close(() => resolve(port));});});
const hostPort = await freePort(), settlePort = await freePort(), appPort = await freePort();
const hostNode = process.env.SETTLE_API_NODE ?? process.execPath;
if (Number(execFileSync(hostNode, ['-p', 'process.versions.node.split(".")[0]'], {encoding: 'utf8'})) < 24) throw new Error('The unchanged demo host API requires Node 24. Set SETTLE_API_NODE to a Node 24 executable.');
Object.assign(identity, {hostPort, settlePort, appPort, hostNode: execFileSync(hostNode, ['--version'], {encoding: 'utf8'}).trim(), settleNode: process.version});
// The worktree's host API has no generated runtimes. As in the shared healthcare/ERP launcher,
// SETTLE_RUNTIME_ARTIFACTS may name a source-identical existing API checkout: every tracked API file is
// compared first, then only missing generated runtimes/dependencies resolve there and are hashed.
const apiArgs = [];
const artifactRoot = process.env.SETTLE_RUNTIME_ARTIFACTS;
if (artifactRoot) {
  const built = resolve(artifactRoot), files = execFileSync('git', ['ls-files', 'dummy-api', '-z'], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean);
  const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
  const mismatches = files.filter(p => !existsSync(join(built, p.slice('dummy-api/'.length))) || sha(join(root, p)) !== sha(join(built, p.slice('dummy-api/'.length))));
  if (mismatches.length) throw new Error(`Runtime artifact source differs in ${mismatches.length} tracked API files`);
  const source = join(root, 'dummy-api/'), loader = join(temp, 'runtime-loader.mjs'), log = join(temp, 'runtime-artifacts.ndjson');
  writeFileSync(loader, `import {existsSync,readFileSync,appendFileSync} from 'node:fs';import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';const source=${JSON.stringify(source)},built=${JSON.stringify(built + '/')};const seen=new Set();function record(result){if(result.url?.startsWith('file:')){const path=fileURLToPath(result.url);if(path.startsWith(built)&&/^[\\w-]+\\/dist\\//.test(path.slice(built.length))&&!seen.has(path)){seen.add(path);appendFileSync(${JSON.stringify(log)},JSON.stringify({path:path.slice(built.length),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})+'\\n');}}return result;}export async function resolve(specifier,context,next){const entry=new URL(specifier,context.parentURL??'file://'+source).href;if(entry==='file://'+source+'access-runtime/medband-worker.mjs')return next('file://'+built+'access-runtime/medband-worker.mjs',context);try{return record(await next(specifier,context));}catch(error){if(!specifier.startsWith('.')&&!specifier.startsWith('/')&&context.parentURL?.startsWith('file://'+source)){return record(await next(specifier,{...context,parentURL:context.parentURL.replace('file://'+source,'file://'+built)}));}if(['pharmacy-runtime/','access-runtime/','quality-runtime/'].some(dir=>context.parentURL?.startsWith(new URL(dir,'file://'+source).href))){return record(await next(specifier,{...context,parentURL:context.parentURL.replace('file://'+source,'file://'+built)}));}const url=new URL(specifier,context.parentURL);if(url.protocol==='file:'){const path=fileURLToPath(url),rel=path.slice(source.length);if(path.startsWith(source)&&/^[\\w-]+\\/dist\\//.test(rel)&&existsSync(built+rel))return record(await next(pathToFileURL(built+rel).href,context));}throw error;}}`);
  const common = join(temp, 'diagnostic-runtime.cjs');
  writeFileSync(common, `const Module=require('node:module');const resolve=Module._resolveFilename;const source=${JSON.stringify(join(root, 'dummy-api/diagnostics-runtime/'))},built=${JSON.stringify(join(built, 'diagnostics-runtime/'))};Module._resolveFilename=function(specifier,parent,...rest){try{return resolve.call(this,specifier,parent,...rest);}catch(error){if(parent?.filename?.startsWith(source)){return resolve.call(this,specifier,{...parent,filename:built+parent.filename.slice(source.length),paths:Module._nodeModulePaths(built)},...rest);}throw error;}};`);
  apiArgs.push('--loader', loader, '--require', common);
  identity.runtimeArtifacts = {sourceFilesCompared: files.length, mismatches: 0, log};
}
function start(command, args, env, cwd, label) {
  const child = spawn(command, args, {cwd, env: {...process.env, ...env}, stdio: ['ignore', 'pipe', 'pipe'], detached: true});
  children.push(child); child.serviceLabel = label;
  (identity.startedServices ??= []).push({label, pid: child.pid}); save();
  const output = []; child.stdout.on('data', d => output.push(String(d))); child.stderr.on('data', d => output.push(String(d)));
  child.on('exit', code => {if (code) console.error(`${label} exited ${code}`);});
  return {child, output};
}
async function ready(url, service) {
  for (let i = 0; i < 180; i++) {
    if (service.child.exitCode !== null) throw new Error('Local service exited before readiness. ' + service.output.join('').split('\n').filter(l => !/(account|password|token|credential)/i.test(l)).slice(-8).join('\n'));
    try {const r = await fetch(url); if (r.status < 500) return;} catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Local service readiness timed out');
}
try {
  const host = start(hostNode, [...apiArgs, 'dummy-api/server.mjs'], {HOST: '127.0.0.1', PORT: String(hostPort), NEXORA_DATA_DIR: join(temp, 'host-data'), RECORD_DATA_DIR: join(temp, 'host-records')}, root, 'Host API');
  // The Settle backend runs unchanged from its own folder (README: `cd backend && npm start`).
  const settle = start(process.execPath, ['src/server.js'], {PORT: String(settlePort), SETTLE_DATA_DIR: join(temp, 'settle-data')}, join(root, 'source/settle/backend'), 'Settle API');
  await ready(`http://127.0.0.1:${hostPort}/auth/session`, host);
  await ready(`http://127.0.0.1:${settlePort}/api/health`, settle);
  const next = start(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(appPort)],
    {SETTLE_HOST_API_URL: `http://127.0.0.1:${hostPort}`, SETTLE_API_URL: `http://127.0.0.1:${settlePort}`, ...(process.env.SETTLE_BUILD_DIR ? {SETTLE_BUILD_DIR: process.env.SETTLE_BUILD_DIR} : {})}, app, 'Next');
  await ready(`http://127.0.0.1:${appPort}/`, next);
  const browser = start(process.execPath, [join(app, 'scripts/smoke.mjs')], {SETTLE_BASE: `http://127.0.0.1:${appPort}`, SETTLE_DIRECT_API: `http://127.0.0.1:${settlePort}/api`}, root, 'Browser');
  browser.child.stdout.pipe(process.stdout); browser.child.stderr.pipe(process.stderr);
  const code = await new Promise(r => browser.child.on('exit', r));
  process.exitCode = code ?? 1; identity.integrationExit = code;
  if (identity.runtimeArtifacts) {const log = identity.runtimeArtifacts.log; identity.runtimeArtifacts.resolved = existsSync(log) ? [...new Map(readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).map(e => [e.path, e])).values()].sort((a, b) => a.path.localeCompare(b.path)) : []; delete identity.runtimeArtifacts.log;}
  console.log(JSON.stringify({integrationExit: code, sourceBase: identity.sourceBase, hostPort, settlePort, appPort}));
} catch (error) {
  console.error(error.message); process.exitCode = 1; identity.error = error.message;
} finally {
  clearTimeout(deadline); if (watcher) clearInterval(watcher);
  await stopChildren(); identity.cleanup = cleanup; save();
  rmSync(temp, {recursive: true, force: true});
}
