import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {fileURLToPath} from 'node:url';

// TypeScript emits one module per source file, retaining directive prologues.
// Resolve relative specifiers after emission so Node ESM, webpack and Vite agree.
export function rewriteSpecifiers(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const edits = [];
  function rewrite(literal) {
    if (!literal || !ts.isStringLiteral(literal) || !literal.text.startsWith('.')) return;
    const original = literal.text;
    let target = original.replace(/\.tsx?$/, '.js');
    if (!path.extname(target)) {
      const base = path.resolve(path.dirname(file), target);
      if (fs.existsSync(`${base}.js`)) target += '.js';
      else if (fs.existsSync(path.join(base, 'index.js'))) target += '/index.js';
      else throw new Error(`Unresolved emitted import ${original} in ${file}`);
    }
    if (target !== original) edits.push([literal.getStart(source), literal.end, JSON.stringify(target)]);
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) rewrite(node.moduleSpecifier);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) rewrite(node.argument.literal);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) rewrite(node.arguments[0]);
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL'
      && node.arguments?.[1]?.getText(source) === 'import.meta.url') rewrite(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) text = text.slice(0, start) + replacement + text.slice(end);
  return text;
}

function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

export function buildPackage(directory = process.cwd()) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const src = path.join(directory, 'src'), dist = path.join(directory, 'dist');
  const files = walk(src);
  const entries = Object.values(manifest.exports).map(value => value['pepbits-source']).filter(value => /\.tsx?$/.test(value));
  // The opt-in patterns/testing API is intentional; ordinary fixtures/tests are not roots.
  const rootNames = entries.map(file => path.resolve(directory, file)).concat(files.filter(file =>
    file.endsWith('.worker.ts') || (file.endsWith('.d.ts') && !file.includes('/test/'))));
  const config = ts.readConfigFile(path.join(directory, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, directory);
  const options = {...parsed.options, rootDir: src, outDir: dist, noEmit: false,
    declaration: true, declarationMap: false, sourceMap: false, incremental: false,
    jsx: ts.JsxEmit.ReactJSX, customConditions: [], allowImportingTsExtensions: true,
    rewriteRelativeImportExtensions: true, noEmitOnError: true};
  fs.rmSync(dist, {recursive: true, force: true});
  const program = ts.createProgram(rootNames, options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: file => file, getCurrentDirectory: () => directory, getNewLine: () => '\n',
    }));
  }
  const result = program.emit();
  if (result.emitSkipped) throw new Error(`Emission failed: ${manifest.name}`);
  for (const file of files) {
    if (file.includes('/test/') || file.includes('/__tests__/')) continue;
    // Only known assets: never copy environment files, tests or arbitrary source data.
    if (!/\.(css|woff2|LICENSE)$/.test(file) && !file.endsWith('/fonts/provenance.json') && !file.endsWith('.d.ts')) continue;
    const output = path.join(dist, path.relative(src, file));
    fs.mkdirSync(path.dirname(output), {recursive: true});
    fs.copyFileSync(file, output);
  }
  for (const file of walk(dist)) if (/\.(js|ts)$/.test(file)) {
    fs.writeFileSync(file, rewriteSpecifiers(fs.readFileSync(file, 'utf8'), file));
  }
  console.log(`${manifest.name}@${manifest.version}: ${walk(dist).length} dist files (ESM, declarations, assets)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildPackage();
