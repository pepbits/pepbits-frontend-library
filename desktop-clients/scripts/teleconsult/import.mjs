/**
 * One-time mechanical import of the Teleconsult reference frontends.
 *
 *   node scripts/teleconsult/import.mjs [--force]
 *
 * Copies the clinician pages/components/lib into packages/reference-teleconsult/src/provider and the
 * patient pages/components/lib into src/patient, plus shared/types.ts into src/shared. Only mechanical
 * rewrites are applied here (path aliases, Next router/link -> reference-host, native controls -> shared
 * Source* primitives). Everything else -- the transport client, session contract, idempotency, live frame
 * polling, formatting hooks -- is hand adapted afterwards, so existing files are never overwritten unless
 * --force is given. Node_modules, .next, layouts and global stylesheets are not copied: the host supplies
 * the shell, and styles come from scripts/teleconsult/styles.mjs.
 */
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const source = process.env.TELECONSULT_REFERENCE_ROOT ?? '/home/pepadmin/pb/saas/reference/frontend/teleconsult-01/teleconsult';
const target = join(root, 'packages/reference-teleconsult/src');
const force = process.argv.includes('--force');
const SKIP = new Set(['layout.tsx', 'globals.css']);
// The host owns the sidebar and top bar, so the source shell is replaced by components/shell/ProviderToolbar.tsx.
const RETIRED = new Set(['components/shell/AppShell.tsx', 'components/shell/Sidebar.tsx']);
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const rel = (from, to) => { const value = relative(dirname(from), to).split('\\').join('/'); return value.startsWith('.') ? value : './' + value; };

const CONTROLS = {button: 'SourceButton', input: 'SourceInput', textarea: 'SourceTextarea', select: 'SourceSelect', table: 'Table', thead: 'TableHeader', tbody: 'TableBody', tr: 'TableRow', th: 'TableHead', td: 'TableCell'};

function rewrite(text, dest, variantRoot) {
  const sharedTypes = join(target, 'shared/types');
  text = text.replace(/from "@shared\/types"/g, () => `from "${rel(dest, sharedTypes)}"`);
  text = text.replace(/from "@\/([^"]+)"/g, (_m, path) => `from "${rel(dest, join(variantRoot, path))}"`);
  text = text.replace(/import Link from "next\/link";/, 'import { ReferenceLink as Link } from "@pepbits/reference-host";');
  text = text.replace(/import \{([^}]+)\} from "next\/navigation";/, (_m, names) => {
    const map = {useRouter: 'useReferenceRouter as useRouter', usePathname: 'useReferencePathname as usePathname', useSearchParams: 'useReferenceSearchParams as useSearchParams'};
    return `import { ${names.split(',').map(name => map[name.trim()] ?? name.trim()).join(', ')} } from "@pepbits/reference-host";`;
  });
  if (/\.tsx$/.test(dest)) {
    const used = [];
    for (const [tag, name] of Object.entries(CONTROLS)) {
      const open = new RegExp(`<(/?)${tag}(?=[\\s>/])`, 'g');
      if (open.test(text)) { text = text.replace(open, `<$1${name}`); used.push(name); }
    }
    if (used.length) {
      const lines = text.split('\n'), at = lines.findIndex(line => /^"use client";?$/.test(line)) + 1;
      lines.splice(at, 0, `import { ${used.join(', ')} } from "${rel(dest, join(target, 'shared/controls'))}";`);
      text = lines.join('\n');
    }
  }
  return text;
}

function emit(dest, text) {
  if (existsSync(dest) && !force) { console.log('keep   ', relative(root, dest)); return; }
  mkdirSync(dirname(dest), {recursive: true});
  writeFileSync(dest, text);
  console.log('write  ', relative(root, dest));
}

for (const [variant, name] of [['clinician', 'provider'], ['patient', 'patient']]) {
  const variantRoot = join(target, name);
  for (const sub of ['app', 'components', 'lib']) {
    const dir = join(source, variant, sub);
    for (const file of walk(dir).filter(f => /\.(tsx?|css)$/.test(f) && !SKIP.has(f.split('/').pop()) && !RETIRED.has(relative(join(source, variant), f)))) {
      const dest = join(variantRoot, relative(join(source, variant), file));
      emit(dest, rewrite(readFileSync(file, 'utf8'), dest, variantRoot));
    }
  }
}
const types = readFileSync(join(source, 'shared/types.ts'), 'utf8');
if (!/updatedAt: string;\n}\n\nexport interface VisitSummary/.test(types)) throw new Error('Encounter anchor not found in shared/types.ts');
emit(join(target, 'shared/types.ts'), types.replace('  updatedAt: string;\n}\n\nexport interface VisitSummary', '  /** Server-issued revision. Sent back as the expected version on save and sign. */\n  version?: number;\n  updatedAt: string;\n}\n\nexport interface VisitSummary'));
