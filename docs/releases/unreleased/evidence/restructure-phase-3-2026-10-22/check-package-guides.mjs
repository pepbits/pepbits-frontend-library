import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {checkLinks} from '../../../../tools/check-docs.mjs';
const root = process.cwd();
const guides = ['packages/README.md', 'packages/data/README.md', 'packages/platform/README.md'];
assert.deepEqual(checkLinks(root, guides.map(path => resolve(root, path))), []);
console.log(`PASS ${guides.length} package/index guide links`);
