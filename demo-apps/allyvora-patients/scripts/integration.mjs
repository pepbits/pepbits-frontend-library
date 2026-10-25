// Real local HTTP integration: the unchanged shared demo API (sign-in, preferences, catalogs), the unchanged
// AllyVora Express API (patient data) and this app's production Next server, driven by Chromium on loopback.
// Every service runs on a free port with temporary storage and is stopped on success, failure, signal,
// stop file or deadline. Adapted from tooling/scripts/run-demo-integration.mjs (healthcare/ERP), which
// starts only the shared API; this demo also needs its own backend.
import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const app = join(root, 'demo-apps/allyvora-patients'), backend = join(root, 'source/allyvora-patients/backend');
const temp = mkdtempSync(join(tmpdir(), 'allyvora-integration-'));
const identityFile = process.env.ALLYVORA_IDENTITY ?? join(temp, 'identity.json');
const children = [], cleanup = [];
let stopping;
const identity = {sourceBase: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(), runtimeArtifacts: null};
const save = () => writeFileSync(identityFile, JSON.stringify(identity, null, 2) + '\n');
function stopChildren() {return stopping ??= (async () => {for (const child of [...children].reverse()) {
  try {process.kill(-child.pid, 'SIGTERM');} catch {}
  await Promise.race([new Promise(done => child.exitCode !== null || child.signalCode !== null ? done() : child.once('exit', done)), new Promise(done => setTimeout(done, 3000))]);
  try {process.kill(-child.pid, 'SIGKILL');} catch {}
  await new Promise(done => setTimeout(done, 100));
  let groupAlive = false; try {process.kill(-child.pid, 0); groupAlive = true;} catch {}
  cleanup.push({label: child.serviceLabel, pid: child.pid, exitCode: child.exitCode, signal: child.signalCode, groupAlive});
}})();}
let cancelled = false;
function cancel(reason) {if (cancelled) return; cancelled = true; void stopChildren().finally(() => {identity.interrupted = reason; identity.cleanup = cleanup; save(); rmSync(temp, {recursive: true, force: true}); process.exit(1);});}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => cancel(signal));
const stopFile = process.env.ALLYVORA_STOP_FILE;
const deadline = setTimeout(() => cancel('deadline'), Number(process.env.ALLYVORA_TIMEOUT_MS ?? 1800000)); deadline.unref();
const watcher = stopFile ? setInterval(() => {if (existsSync(stopFile)) cancel('stop-file');}, 500) : null; watcher?.unref();
const freePort = () => new Promise(done => {const server = createServer(); server.listen(0, '127.0.0.1', () => {const port = server.address().port; server.close(() => done(port));});});

const hostApiPort = await freePort(), dataApiPort = await freePort(), appPort = await freePort();
Object.assign(identity, {hostApiPort, dataApiPort, appPort});
const hostNode = process.env.ALLYVORA_HOST_API_NODE ?? process.execPath;
if (Number(execFileSync(hostNode, ['-p', 'process.versions.node.split(".")[0]'], {encoding: 'utf8'})) < 24) throw new Error('The unchanged shared demo API requires Node 24. Set ALLYVORA_HOST_API_NODE.');
identity.hostApiNode = execFileSync(hostNode, ['--version'], {encoding: 'utf8'}).trim();
identity.dataApiNode = process.version;

// Generated shared-API runtimes may be absent from a fresh worktree. Reuse them only from a checkout whose
// tracked mock-api sources are byte-identical, and record what was resolved.
const hostArgs = [], artifacts = process.env.ALLYVORA_RUNTIME_ARTIFACTS;
if (artifacts) {
  const built = resolve(artifacts), files = execFileSync('git', ['ls-files', 'mock-api', '-z'], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean);
  const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
  const mismatches = files.filter(path => !existsSync(join(built, path.slice('mock-api/'.length))) || sha(join(root, path)) !== sha(join(built, path.slice('mock-api/'.length))));
  if (mismatches.length) throw new Error(`Runtime artifact source differs in ${mismatches.length} tracked API files`);
  const loader = join(temp, 'runtime-loader.mjs'), artifactLog = join(temp, 'runtime-artifacts.ndjson'), source = join(root, 'mock-api/');
  writeFileSync(loader, `import {existsSync,readFileSync,appendFileSync} from 'node:fs';import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';const source=${JSON.stringify(source)},built=${JSON.stringify(built + '/')};const seen=new Set();function record(result){if(result.url?.startsWith('file:')){const path=fileURLToPath(result.url);if(path.startsWith(built)&&/^[\\w-]+\\/dist\\//.test(path.slice(built.length))&&!seen.has(path)){seen.add(path);appendFileSync(${JSON.stringify(artifactLog)},JSON.stringify({path:path.slice(built.length),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})+'\\n');}}return result;}export async function resolve(specifier,context,next){const entry=new URL(specifier,context.parentURL??'file://'+source).href;if(entry==='file://'+source+'access-runtime/medband-worker.mjs')return next('file://'+built+'access-runtime/medband-worker.mjs',context);try{return record(await next(specifier,context));}catch(error){if(!specifier.startsWith('.')&&!specifier.startsWith('/')&&context.parentURL?.startsWith('file://'+source)){return record(await next(specifier,{...context,parentURL:context.parentURL.replace('file://'+source,'file://'+built)}));}if(['pharmacy-runtime/','access-runtime/','quality-runtime/'].some(dir=>context.parentURL?.startsWith(new URL(dir,'file://'+source).href))){return record(await next(specifier,{...context,parentURL:context.parentURL.replace('file://'+source,'file://'+built)}));}const url=new URL(specifier,context.parentURL);if(url.protocol==='file:'){const path=fileURLToPath(url),rel=path.slice(source.length);if(path.startsWith(source)&&/^[\\w-]+\\/dist\\//.test(rel)&&existsSync(built+rel)){appendFileSync(${JSON.stringify(artifactLog)},JSON.stringify({path:rel,sha256:createHash('sha256').update(readFileSync(built+rel)).digest('hex')})+'\\n');return record(await next(pathToFileURL(built+rel).href,context));}}throw error;}}`);
  const common = join(temp, 'diagnostic-runtime.cjs');
  writeFileSync(common, `const Module=require('node:module');const resolve=Module._resolveFilename;const source=${JSON.stringify(join(root, 'mock-api/diagnostics-runtime/'))},built=${JSON.stringify(join(built, 'diagnostics-runtime/'))};Module._resolveFilename=function(specifier,parent,...rest){try{return resolve.call(this,specifier,parent,...rest);}catch(error){if(parent?.filename?.startsWith(source)){return resolve.call(this,specifier,{...parent,filename:built+parent.filename.slice(source.length),paths:Module._nodeModulePaths(built)},...rest);}throw error;}};`);
  hostArgs.push('--loader', loader, '--require', common);
  identity.runtimeArtifacts = {sourceFilesCompared: files.length, mismatches: 0, artifactLog};
}

function start(command, args, env, cwd, label) {
  const child = spawn(command, args, {cwd, env: {...process.env, ...env}, stdio: ['ignore', 'pipe', 'pipe'], detached: true});
  children.push(child); child.serviceLabel = label;
  (identity.startedServices ??= []).push({label, pid: child.pid}); save();
  const output = []; child.stdout.on('data', data => output.push(String(data))); child.stderr.on('data', data => output.push(String(data)));
  child.on('exit', code => {if (code) console.error(`${label} exited ${code}`);});
  return {child, output};
}
async function ready(url, service) {
  for (let i = 0; i < 120; i++) {
    if (service.child.exitCode !== null) throw new Error('Local service exited before readiness. ' + service.output.join('').split('\n').filter(line => !/(account|password|token|credential)/i.test(line)).slice(-8).join('\n'));
    try {const response = await fetch(url); if (response.status < 500) return;} catch {}
    await new Promise(done => setTimeout(done, 500));
  }
  throw new Error('Local service readiness timed out');
}
try {
  const hostApi = start(hostNode, [...hostArgs, 'mock-api/server.mjs'], {HOST: '127.0.0.1', PORT: String(hostApiPort), NEXORA_DATA_DIR: join(temp, 'host-data'), RECORD_DATA_DIR: join(temp, 'host-records')}, root, 'Host API');
  await ready(`http://127.0.0.1:${hostApiPort}/auth/session`, hostApi);
  // The unchanged AllyVora API, built and started with its documented production scripts and a temporary database.
  execFileSync(process.execPath, ['scripts/build.mjs'], {cwd: backend, stdio: 'ignore'});
  identity.dataApiBuild = {path: 'source/allyvora-patients/backend/dist/server.js', sha256: createHash('sha256').update(readFileSync(join(backend, 'dist/server.js'))).digest('hex')};
  const dataApi = start(process.execPath, ['dist/server.js'], {PORT: String(dataApiPort), DB_PATH: join(temp, 'allyvora.db'), SEED_DEMO: 'true', CORS_ORIGIN: `http://127.0.0.1:${appPort}`, NODE_ENV: 'production'}, backend, 'AllyVora API');
  await ready(`http://127.0.0.1:${dataApiPort}/api/health`, dataApi);
  const next = start(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(appPort)],
    {ALLYVORA_HOST_API_URL: `http://127.0.0.1:${hostApiPort}`, ALLYVORA_API_URL: `http://127.0.0.1:${dataApiPort}`}, app, 'Next');
  await ready(`http://127.0.0.1:${appPort}/patients`, next);
  const browser = start(process.execPath, [join(app, 'scripts/smoke.mjs')], {ALLYVORA_BASE: `http://127.0.0.1:${appPort}`}, root, 'Browser');
  browser.child.stdout.pipe(process.stdout); browser.child.stderr.pipe(process.stderr);
  const code = await new Promise(done => browser.child.on('exit', done));
  process.exitCode = code ?? 1; identity.integrationExit = code;
  if (identity.runtimeArtifacts) {
    const log = identity.runtimeArtifacts.artifactLog;
    identity.runtimeArtifacts.resolved = existsSync(log) ? [...new Map(readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).map(entry => [entry.path, entry])).values()].sort((a, b) => a.path.localeCompare(b.path)) : [];
    delete identity.runtimeArtifacts.artifactLog;
  }
  console.log(JSON.stringify({integrationExit: code, sourceBase: identity.sourceBase, hostApiPort, dataApiPort, appPort}));
} finally {
  clearTimeout(deadline); if (watcher) clearInterval(watcher);
  await stopChildren(); identity.cleanup = cleanup; save();
  rmSync(temp, {recursive: true, force: true});
}
