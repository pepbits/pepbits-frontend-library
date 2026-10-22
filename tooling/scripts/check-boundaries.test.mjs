import {after, test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkBoundaries, importSpecifiers} from './check-boundaries.mjs';

const fixtures = [];
after(() => fixtures.forEach((dir) => rmSync(dir, {recursive: true, force: true})));

/** Builds a throwaway repository from {"relative/path": contents}. Objects become JSON. */
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'pepbits-boundaries-'));
  fixtures.push(root);
  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents));
  }
  return root;
}

const pkg = (name, deps = {}, extra = {}) => ({name, version: '0.0.0', dependencies: deps, ...extra});
const demo = (name, deps = {}) => ({name, private: true, dependencies: deps});

function errorsFor(files) {
  return checkBoundaries(repo(files)).errors;
}

test('an empty layout passes', () => {
  assert.deepEqual(errorsFor({'package.json': {name: 'root'}}), []);
});

test('the real repository passes', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  assert.deepEqual(checkBoundaries(root).errors, []);
});

test('a layer may use the layers below it', () => {
  assert.deepEqual(errorsFor({
    'packages/tokens/package.json': pkg('@pepbits/tokens'),
    'packages/ui/package.json': pkg('@pepbits/ui', {'@pepbits/tokens': '*'}),
    'packages/ui/src/button.tsx': "import {color} from '@pepbits/tokens';\nimport {cn} from './cn';",
  }), []);
});

test('a layer may not use a layer above it', () => {
  const errors = errorsFor({
    'packages/tokens/package.json': pkg('@pepbits/tokens', {'@pepbits/ui': '*'}),
    'packages/tokens/src/index.ts': "export * from '@pepbits/ui';",
    'packages/ui/package.json': pkg('@pepbits/ui'),
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /layer "tokens" may not depend on "ui"/);
});

test('preferences may import tokens and i18n, but i18n may not import preferences', () => {
  const files = {
    'packages/tokens/package.json': pkg('@pepbits/tokens'),
    'packages/i18n/package.json': pkg('@pepbits/i18n'),
    'packages/preferences/package.json': pkg('@pepbits/preferences', {'@pepbits/tokens': '*', '@pepbits/i18n': '*'}),
    'packages/preferences/src/index.ts': "import '@pepbits/tokens';\nimport type {LanguageKey} from '@pepbits/i18n';",
  };
  assert.deepEqual(errorsFor(files), []);
  const errors = errorsFor({...files,
    'packages/i18n/package.json': pkg('@pepbits/i18n', {'@pepbits/preferences': '*'}),
    'packages/i18n/src/index.ts': "import '@pepbits/preferences';",
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /layer "i18n" may not depend on "preferences"/);
});

test('preferences still cannot import other foundations or UI layers', () => {
  for (const layer of ['icons', 'ui', 'components']) {
    const errors = errorsFor({
      'packages/preferences/package.json': pkg('@pepbits/preferences', {[`@pepbits/${layer}`]: '*'}),
      'packages/preferences/src/index.ts': `import '@pepbits/${layer}';`,
    });
    assert.equal(errors.length, 2);
    assert.match(errors[0], /layer "preferences" may not depend on/);
  }
});

test('library packages may not use demo apps', () => {
  const errors = errorsFor({
    'packages/ui/package.json': pkg('@pepbits/ui'),
    'packages/ui/src/index.ts': "import '@pepbits-demo/healthcare';",
    'demo-apps/healthcare/package.json': demo('@pepbits-demo/healthcare'),
  });
  assert.match(errors.join('\n'), /library packages must not use demo apps/);
});

test('demo apps use any layer but not each other', () => {
  const errors = errorsFor({
    'packages/components/package.json': pkg('@pepbits/components'),
    'demo-apps/erp/package.json': demo('@pepbits-demo/erp', {'@pepbits/components': '*'}),
    'demo-apps/erp/src/page.tsx': "import {Table} from '@pepbits/components';\nimport x from '@pepbits-demo/school';",
    'demo-apps/school/package.json': demo('@pepbits-demo/school'),
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /demo apps must not use other demo apps/);
});

test('pre-restructure packages are rejected', () => {
  const errors = errorsFor({
    'demo-apps/healthcare/package.json': demo('@pepbits-demo/healthcare', {'@pepbits/erp-screens': '*'}),
    'demo-apps/healthcare/src/page.tsx': "import {RecordPage} from '@pepbits/erp-screens/record-page';",
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /not part of the new library/);
});

test('relative imports may not leave the package', () => {
  const errors = errorsFor({
    'packages/ui/package.json': pkg('@pepbits/ui'),
    'packages/ui/src/a.ts': "import '../../../desktop-clients/packages/ops-ui/src/button';",
  });
  assert.match(errors.join('\n'), /leaves packages\/ui/);
});

test('deep src imports and undeclared imports are rejected', () => {
  const errors = errorsFor({
    'packages/tokens/package.json': pkg('@pepbits/tokens'),
    'packages/ui/package.json': pkg('@pepbits/ui', {'@pepbits/tokens': '*'}),
    'packages/ui/src/a.ts': "import '@pepbits/tokens/src/color';\nimport '@pepbits/i18n';",
    'packages/i18n/package.json': pkg('@pepbits/i18n'),
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /reaches into src/);
  assert.match(errors[1], /not listed/);
});

test('folder must be a known layer and names must match the folder', () => {
  const errors = errorsFor({
    'packages/widgets/package.json': pkg('@pepbits/widgets'),
    'packages/ui/package.json': pkg('@pepbits/ui-kit'),
    'demo-apps/erp/package.json': {name: '@pepbits-demo/erp'},
  });
  assert.match(errors.join('\n'), /"widgets" is not a layer/);
  assert.match(errors.join('\n'), /name must be "@pepbits\/ui"/);
  assert.match(errors.join('\n'), /"private": true/);
});

test('testing is dev-only', () => {
  const files = {
    'packages/testing/package.json': pkg('@pepbits/testing'),
    'packages/ui/package.json': pkg('@pepbits/ui', {}, {devDependencies: {'@pepbits/testing': '*'}}),
    'packages/ui/src/button.test.tsx': "import {render} from '@pepbits/testing';",
  };
  assert.deepEqual(errorsFor(files), []);
  const errors = errorsFor({...files, 'packages/ui/src/button.tsx': "import {render} from '@pepbits/testing';"});
  assert.equal(errors.length, 1);
  assert.match(errors[0], /dev-only/);
});

test('tooling packages are devDependencies only', () => {
  const errors = errorsFor({
    'tooling/tsconfig/package.json': {name: '@pepbits/tsconfig'},
    'packages/ui/package.json': pkg('@pepbits/ui', {'@pepbits/tsconfig': '*'}),
    'packages/tokens/package.json': pkg('@pepbits/tokens', {}, {devDependencies: {'@pepbits/tsconfig': '*'}}),
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /packages\/ui\/package.json.*tooling/);
});

test('mock-api imports nothing from the frontend', () => {
  const errors = errorsFor({
    'mock-api/package.json': {name: 'mock-api'},
    'mock-api/src/server.ts': "import {Table} from '@pepbits/components';",
  });
  assert.match(errors.join('\n'), /mock-api must not import/);
});

test('import specifiers cover static, dynamic, side-effect, require and CSS forms', () => {
  assert.deepEqual(importSpecifiers([
    "import a, {b} from 'one';",
    "export {c} from 'two';",
    "import type {D} from 'three';",
    "import 'four';",
    "const e = await import('five');",
    "const f = require('six');",
    "@import '@pepbits/tokens/tokens.css';",
  ].join('\n')).sort(), ['@pepbits/tokens/tokens.css', 'five', 'four', 'one', 'six', 'three', 'two']);
});
