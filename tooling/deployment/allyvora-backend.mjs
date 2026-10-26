import {cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Build from a disposable copy. The original source tree is always read-only. */
export async function buildAllyVoraBackend(root, destination) {
  if (process.platform !== 'linux' || process.arch !== 'x64' || Number(process.versions.node.split('.')[0]) !== 24)
    throw Error('AllyVora test-site packaging requires Node 24 on linux-x64 glibc');
  const source = join(root, 'source/allyvora-patients');
  const stage = await mkdtemp(join(tmpdir(), 'pepbits-allyvora-build-'));
  const run = (command, args, cwd = stage) => execFileSync(command, args, {cwd, stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000, env: {...process.env, NODE_ENV: 'development', npm_config_cache: process.env.npm_config_cache ?? process.env.NPM_CONFIG_CACHE ?? join(stage, '.npm-cache')}});
  try {
    for (const path of ['package.json', 'package-lock.json', 'backend/package.json', 'backend/tsconfig.json', 'backend/scripts', 'backend/src', 'packages/shared', 'frontend/package.json']) {
      await mkdir(join(stage, path, '..'), {recursive: true});
      await cp(join(source, path), join(stage, path), {recursive: true, filter: p => !relative(source, p).split('/').some(part => ['node_modules', 'dist', '.turbo'].includes(part))});
    }
    // Lockfile-pinned packages; install scripts cannot silently compile a host-specific SQLite binary.
    run('npm', ['ci', '--workspace=backend', '--ignore-scripts', '--no-audit', '--no-fund']);
    const sqlite = join(stage, 'node_modules/better-sqlite3');
    run(process.execPath, [join(stage, 'node_modules/prebuild-install/bin.js'), '--runtime=node', '--target=' + process.versions.node, '--platform=linux', '--arch=x64', '--libc=glibc'], sqlite);
    run(process.execPath, ['scripts/build.mjs'], join(stage, 'backend'));
    run('npm', ['prune', '--workspace=backend', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund']);
    const pkg = JSON.parse(await readFile(join(stage, 'backend/package.json')));
    delete pkg.dependencies['@allyvora/shared']; // Bundled by the original backend build script.
    await mkdir(destination, {recursive: true});
    await cp(join(stage, 'backend/dist'), join(destination, 'dist'), {recursive: true});
    await cp(join(stage, 'node_modules'), join(destination, 'node_modules'), {recursive: true, dereference: true,
      filter: p => !['.bin', '.package-lock.json', '@allyvora', 'backend', 'frontend'].includes(relative(join(stage, 'node_modules'), p).split('/')[0])});
    await writeFile(join(destination, 'package.json'), JSON.stringify({name: 'allyvora-backend-runtime', private: true, type: 'module', dependencies: pkg.dependencies}, null, 2) + '\n');
    const binary = join(destination, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node');
    // Debian bookworm supplies glibc 2.36. Reject a binary built against newer host symbols.
    const symbols = run('objdump', ['-T', binary]).toString();
    const glibc = [...new Set([...symbols.matchAll(/\bGLIBC_(\d+\.\d+(?:\.\d+)?)/g)].map(m => m[1]))].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
    if (!glibc.length || glibc.some(v => v.localeCompare('2.36', undefined, {numeric: true}) > 0)) throw Error('SQLite prebuild requires a newer glibc than bookworm');
    const result = JSON.parse(run(process.execPath, ['--input-type=module', '-e', "import Database from 'better-sqlite3'; const db=new Database(':memory:'); console.log(JSON.stringify({sqlite:db.prepare('select sqlite_version() as version').get().version})); db.close();"], destination));
    const sources = [];
    async function inventory(path) {for (const e of (await readdir(path, {withFileTypes: true})).sort((a,b) => a.name.localeCompare(b.name))) {
      if (['node_modules', 'dist', '.turbo'].includes(e.name)) continue;
      const p = join(path, e.name); if (e.isDirectory()) await inventory(p); else sources.push({path: relative(source, p), sha256: sha(await readFile(p))});
    }}
    for (const path of ['backend/src', 'backend/scripts', 'packages/shared']) await inventory(join(source, path));
    for (const path of ['package.json', 'package-lock.json', 'backend/package.json', 'backend/tsconfig.json']) sources.push({path, sha256: sha(await readFile(join(source, path)))});
    const receipt = {source: 'source/allyvora-patients', sources, node: process.versions.node, abi: process.versions.modules, platform: 'linux-x64-glibc',
      betterSqlite3: JSON.parse(await readFile(join(destination, 'node_modules/better-sqlite3/package.json'))).version,
      native: {method: 'prebuild-install (no compilation fallback)', sha256: sha(await readFile(binary)), glibc, maximumGlibc: glibc.at(-1), ...result},
      bundleSha256: sha(await readFile(join(destination, 'dist/server.js')))};
    await writeFile(join(destination, 'BUILD.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(`  AllyVora backend: bundled source, production dependencies, SQLite prebuild (GLIBC <= ${glibc.at(-1)})`);
    return receipt;
  } finally {await rm(stage, {recursive: true, force: true});}
}
