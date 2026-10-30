import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
// Dependency order; private tooling and demos can never enter this list.
export const publicPackages = ['tokens', 'icons', 'i18n', 'preferences', 'ui', 'components', 'data', 'platform', 'patterns', 'page-engines', 'healthcare', 'shell', 'ai'];
export function packPackages(destination = process.env.RELEASE_PACK_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'pepbits-pack-'))) {
  destination = path.resolve(destination);
  fs.mkdirSync(destination, {recursive: true});
  const receipts = [];
  for (const name of publicPackages) {
    const directory = path.join(root, 'packages', name);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (manifest.private || manifest.name !== `@pepbits/${name}` || manifest.publishConfig?.registry !== 'https://npm.pkg.github.com') throw new Error(`Invalid release manifest: ${name}`);
    for (const target of Object.values(manifest.exports)) {
      for (const condition of ['types', 'import', 'default']) {
        if (target[condition] && !target[condition].includes('*') && !fs.existsSync(path.join(directory, target[condition]))) throw new Error(`Build missing: ${name} ${target[condition]}`);
      }
    }
    const output = execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', destination], {cwd: directory, encoding: 'utf8'});
    const [packed] = JSON.parse(output);
    const tarball = path.join(destination, packed.filename);
    const listing = execFileSync('tar', ['-tzf', tarball], {encoding: 'utf8'}).trim().split('\n');
    for (const file of listing) {
      if (!/^package\/(dist\/|package\.json$|README\.md$|CHANGELOG\.md$)/.test(file)
        || /(^|\/)\.env(?:\.|$)|\.(?:test|spec)\.[^/]+$|(^|\/)(?:node_modules|src)\//.test(file)) throw new Error(`Unexpected archive file: ${file}`);
      if (/\.(?:js|ts|json|md|css)$/.test(file)) {
        const content = execFileSync('tar', ['-xOzf', tarball, file], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
        if (/(?<![\w.])(?:\/home\/|\/Users\/|\/tmp\/|\/workspace\/|\/private\/var\/|[A-Z]:\\Users\\)|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,})/.test(content)) throw new Error(`Local path or credential pattern in ${file}`);
      }
    }
    receipts.push({name: packed.name, version: packed.version, filename: packed.filename, size: packed.size, unpackedSize: packed.unpackedSize, files: listing.length, integrity: packed.integrity});
    console.log(`${packed.name}@${packed.version}: ${packed.filename} (${packed.size} bytes; ${listing.length} files)`);
  }
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(receipts, null, 2) + '\n');
  console.log(`Local tarballs only (no registry writes): ${destination}`);
  return {destination, receipts};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) packPackages();
