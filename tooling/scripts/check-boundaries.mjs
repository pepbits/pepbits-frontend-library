#!/usr/bin/env node
// Dependency-boundary check for the restructured library.
//
// Enforces the layer rules in docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md:
//   - packages/<name> is published as @pepbits/<name> and may depend only on the
//     layers listed for it in LAYERS.
//   - demo-apps/<name> is @pepbits-demo/<name>, private, and may use any layer's
//     public exports, never another demo app.
//   - Nothing reaches into another package's src/, out of its own folder with a
//     relative path, or into the backend (mock-api,
//     and package names that are not a layer, such as @pepbits/erp-screens).
//   - mock-api imports nothing from the frontend.
//
// Usage: node tooling/scripts/check-boundaries.mjs [repository-root]

import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const FOUNDATIONS = ['tokens', 'icons', 'i18n', 'preferences'];
const COMPONENT_BASE = [...FOUNDATIONS, 'ui', 'components'];

/** Layer → the layers it may import. A package may always import itself. */
export const LAYERS = {
  tokens: [],
  icons: [],
  i18n: ['tokens'],
  preferences: ['tokens', 'i18n'],
  ui: [...FOUNDATIONS],
  components: [...FOUNDATIONS, 'ui'],
  data: ['i18n', 'preferences'],
  platform: ['i18n', 'preferences', 'data'],
  patterns: [...COMPONENT_BASE, 'data', 'platform'],
  'page-engines': [...COMPONENT_BASE, 'data', 'platform', 'patterns'],
  shell: [...COMPONENT_BASE, 'data', 'platform', 'patterns', 'page-engines'],
  ai: [...COMPONENT_BASE, 'data', 'platform', 'patterns', 'page-engines', 'shell'],
  testing: [...COMPONENT_BASE, 'data', 'platform', 'patterns', 'page-engines', 'shell', 'ai'],
};

/** Importable only from tests and stories, and listed only in devDependencies. */
const DEV_ONLY_LAYERS = new Set(['testing']);

const SCOPE = '@pepbits/';
const DEMO_SCOPE = '@pepbits-demo/';
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?|css)$/;
const TEST_FILE = /(?:\.(?:test|spec|stories)\.[cm]?[jt]sx?$)|(?:(?:^|\/)(?:__tests__|test)\/)/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', 'coverage', 'out']);
const RUNTIME_DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g,
];

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function listWorkspaces(root, folder) {
  const dir = join(root, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'package.json')))
    .map((entry) => ({folder, dirName: entry.name, dir: join(dir, entry.name), pkg: readJson(join(dir, entry.name, 'package.json'))}));
}

function walkSources(dir, out = []) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) walkSources(join(dir, entry.name), out);
    } else if (SOURCE_EXT.test(entry.name) && statSync(join(dir, entry.name)).isFile()) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

export function importSpecifiers(source) {
  const found = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

/** "@pepbits/ui/button" → {scope: "@pepbits/", name: "ui", subpath: "button"} */
function parseScoped(specifier) {
  for (const scope of [SCOPE, DEMO_SCOPE]) {
    if (specifier.startsWith(scope)) {
      const [name, ...rest] = specifier.slice(scope.length).split('/');
      return {scope, name, subpath: rest.join('/')};
    }
  }
  return null;
}

function toPosix(path) {
  return path.split(sep).join('/');
}

export function checkBoundaries(root) {
  const errors = [];
  const report = (where, message) => errors.push(`${toPosix(where)}: ${message}`);

  const packages = listWorkspaces(root, 'packages');
  const demoApps = listWorkspaces(root, 'demo-apps');
  const toolingNames = new Set(listWorkspaces(root, 'tooling').map((ws) => ws.pkg.name));

  for (const ws of packages) {
    if (!(ws.dirName in LAYERS)) report(`packages/${ws.dirName}`, `"${ws.dirName}" is not a layer; add it to LAYERS and the plan before creating it`);
    if (ws.pkg.name !== `${SCOPE}${ws.dirName}`) report(`packages/${ws.dirName}/package.json`, `name must be "${SCOPE}${ws.dirName}", found "${ws.pkg.name}"`);
  }
  for (const ws of demoApps) {
    if (ws.pkg.name !== `${DEMO_SCOPE}${ws.dirName}`) report(`demo-apps/${ws.dirName}/package.json`, `name must be "${DEMO_SCOPE}${ws.dirName}", found "${ws.pkg.name}"`);
    if (ws.pkg.private !== true) report(`demo-apps/${ws.dirName}/package.json`, 'demo apps must be "private": true so they are never published');
  }

  /**
   * Is `ws` allowed to use `target`? Returns an error message, or null.
   * `dev` is true for devDependencies and for imports from test/story files.
   */
  function verdict(ws, target, dev) {
    if (target.scope === DEMO_SCOPE) {
      return ws.folder === 'demo-apps' ? 'demo apps must not use other demo apps' : 'library packages must not use demo apps';
    }
    const full = `${SCOPE}${target.name}`;
    if (toolingNames.has(full)) return dev ? null : `${full} is tooling; list it in devDependencies only`;
    if (!(target.name in LAYERS)) {
      return `${full} is not part of the new library (pre-restructure package?); new code must not depend on existing code`;
    }
    if (DEV_ONLY_LAYERS.has(target.name) && !dev && ws.dirName !== target.name) {
      return `${full} is dev-only; use it from tests or stories and list it in devDependencies`;
    }
    if (ws.folder === 'demo-apps') return null;
    if (target.name === ws.dirName || DEV_ONLY_LAYERS.has(target.name)) return null;
    const allowed = LAYERS[ws.dirName];
    if (allowed && !allowed.includes(target.name)) {
      return `layer "${ws.dirName}" may not depend on "${target.name}" (allowed: ${allowed.length ? allowed.join(', ') : 'none'})`;
    }
    return null;
  }

  for (const ws of [...packages, ...demoApps]) {
    const label = `${ws.folder}/${ws.dirName}`;
    const declared = new Set();

    for (const field of [...RUNTIME_DEP_FIELDS, 'devDependencies']) {
      for (const dep of Object.keys(ws.pkg[field] ?? {})) {
        const target = parseScoped(dep);
        if (!target) continue;
        declared.add(dep);
        const problem = verdict(ws, target, field === 'devDependencies');
        if (problem) report(`${label}/package.json`, `${field} "${dep}": ${problem}`);
      }
    }

    for (const file of walkSources(ws.dir)) {
      const rel = toPosix(relative(root, file));
      const isTest = TEST_FILE.test(toPosix(relative(ws.dir, file)));
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        if (specifier.startsWith('.')) {
          const target = resolve(dirname(file), specifier);
          if (target !== ws.dir && !target.startsWith(ws.dir + sep)) {
            report(rel, `relative import "${specifier}" leaves ${label}; import the other package by name`);
          }
          continue;
        }
        if (specifier.startsWith('/')) {
          report(rel, `absolute import "${specifier}" is not allowed`);
          continue;
        }
        const target = parseScoped(specifier);
        if (!target) continue;
        const problem = verdict(ws, target, isTest);
        if (problem) {
          report(rel, `"${specifier}": ${problem}`);
          continue;
        }
        if (target.subpath === 'src' || target.subpath.startsWith('src/')) {
          report(rel, `"${specifier}" reaches into src/; use the package's public exports`);
        }
        const pkgName = `${target.scope}${target.name}`;
        if (pkgName !== ws.pkg.name && !declared.has(pkgName)) {
          report(rel, `"${specifier}" is imported but ${pkgName} is not listed in ${label}/package.json`);
        }
      }
    }
  }

  const mockApi = join(root, 'mock-api');
  if (existsSync(join(mockApi, 'package.json'))) {
    for (const file of walkSources(mockApi)) {
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        if (specifier.startsWith('.') && !resolve(dirname(file),specifier).startsWith(mockApi+sep)) report(toPosix(relative(root,file)), `"${specifier}": mock-api imports must stay within its backend`);
        if (parseScoped(specifier) || ['react','react-dom','lucide-react'].some(name=>specifier===name||specifier.startsWith(name+'/'))) report(toPosix(relative(root, file)), `"${specifier}": mock-api must not import frontend packages`);
      }
    }
  }

  return {errors, packages: packages.length, demoApps: demoApps.length};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const {errors, packages, demoApps} = checkBoundaries(root);
  if (errors.length) {
    console.error(`FAIL ${errors.length} boundary violation(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`PASS dependency boundaries: ${packages} package(s), ${demoApps} demo app(s)`);
}
