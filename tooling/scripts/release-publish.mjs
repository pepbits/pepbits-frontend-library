import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {packPackages, root} from './release-pack.mjs';

// Manual owner operation. Nothing in install, build, CI or pack invokes this.
if (!process.env.NPM_TOKEN?.trim()) throw new Error('Manual publication requires an owner-provided NPM_TOKEN with GitHub Packages write access. See docs/development/PUBLISHING.md.');
execFileSync('npm', ['run', 'release:build'], {cwd: root, stdio: 'inherit'});
const {destination, receipts} = packPackages();
for (const {filename} of receipts) {
  execFileSync('npm', ['publish', path.join(destination, filename), '--registry=https://npm.pkg.github.com', '--ignore-scripts'], {cwd: root, stdio: 'inherit'});
}
