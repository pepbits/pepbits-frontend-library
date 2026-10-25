import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {rewriteSpecifiers} from './build-package.mjs';

test('ESM output resolves files, barrels, declarations and workers without touching copy or directives', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pepbits-esm-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'parts'));
    for (const name of ['value.js', 'worker.js', 'parts/index.js']) fs.writeFileSync(path.join(dir, name), '');
    const source = `'use client';\nimport {value} from './value';\nexport * from './parts';\nimport './style.module.css';\nconst copy = './value';\nconst lazy = import('./value.ts');\nnew Worker(new URL('./worker.ts', import.meta.url), {type: 'module'});\ntype Value = import('./parts').Value;`;
    const output = rewriteSpecifiers(source, path.join(dir, 'index.js'));
    assert.match(output, /^'use client';/);
    assert.match(output, /from "\.\/value\.js"/);
    assert.match(output, /from "\.\/parts\/index\.js"/);
    assert.match(output, /import\("\.\/value\.js"\)/);
    assert.match(output, /new URL\("\.\/worker\.js", import.meta.url\)/);
    assert.match(output, /import\("\.\/parts\/index\.js"\)\.Value/);
    assert.match(output, /import '\.\/style.module.css'/);
    assert.match(output, /const copy = '\.\/value'/);
    assert.throws(() => rewriteSpecifiers(`export * from './missing';`, path.join(dir, 'index.js')), /Unresolved emitted import/);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
