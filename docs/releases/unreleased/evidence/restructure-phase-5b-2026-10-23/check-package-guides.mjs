import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {checkLinks} from '../../../../tools/check-docs.mjs';
const guides=['packages/README.md','packages/ai/README.md','packages/shell/README.md'];
assert.deepEqual(checkLinks(process.cwd(),guides.map(path=>resolve(path))),[]);
console.log(`PASS ${guides.length} package/index guide links`);
