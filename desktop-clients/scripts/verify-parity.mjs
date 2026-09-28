#!/usr/bin/env node
/**
 * Every package's utilities must reach BOTH apps' stylesheets.
 *
 * WHAT THIS USED TO BE, and why it is not that any more:
 *
 * It proved the monorepo migration changed no presentation — each moved file
 * byte-identical to its pre-migration original once imports were stripped. That
 * was a real invariant and it held, but it was a ONE-TIME property of a move.
 * It stopped being true at d4f5228, where 45 wired preferences deliberately
 * changed presentation, and 24 commits have since edited those files on purpose.
 * The check has been failing by design ever since, and a check that is expected
 * to be red teaches people to ignore red.
 *
 * Re-baselining it to HEAD would have been worse: it would assert that files
 * equal themselves, which is vacuous today and becomes a nuisance on the next
 * intentional edit — answered by adding to an ALLOWED list until the list is the
 * whole file set.
 *
 * WHAT IT CHECKS NOW is the half that was always prospective. Tailwind only
 * emits utilities it can SEE. The packages live outside each app's root, so
 * every one of them needs an `@source` line in the app's entry stylesheet; miss
 * one and its classes are silently purged. The build succeeds, the types pass,
 * and the component renders unstyled. This session hit that trap once already.
 *
 *   COVERAGE   every package whose source uses classNames is @source'd by BOTH
 *              apps. Needs no build, so it runs in a second and catches a new
 *              package the moment it is added.
 *
 *   EMITTED    utilities UNIQUE to one package are present in that app's built
 *              CSS. Unique ones are the honest canaries: a class another package
 *              also uses would still be emitted if this one were purged, and
 *              would prove nothing. Skipped when there is no build.
 *
 * Zero dependencies. Run:  npm run verify:parity
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = join(ROOT, "packages");

const APPS = [
  { name: "web", css: join(ROOT, "apps/web/src/app/globals.css"), built: join(ROOT, "apps/web/.next") },
  { name: "desktop", css: join(ROOT, "apps/desktop/src/globals.css"), built: join(ROOT, "apps/desktop/dist") },
];

function filesUnder(dir, ext) {
  let found = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) found = found.concat(filesUnder(path, ext));
      else if (ext.some((e) => entry.name.endsWith(e))) found.push(path);
    }
  } catch { /* absent directory yields nothing, and the caller decides if that matters */ }
  return found;
}

/* Only utilities Tailwind emits as a plain, unescaped selector. Arbitrary values
   (size-[11px]), variants (hover:...), opacity slashes and CSS-variable values
   are all real and all emitted with escaping or rewriting that differs between
   versions — matching them by string is how a checker cries wolf. The simple
   ones are enough: if a package is purged they go with everything else. */
const SIMPLE = /^[a-z][a-z0-9]*(-[a-z0-9.]+)*$/;
// Variant identity markers do not style anything: both public ERP wrappers consume
// the shared .reference-keystone styles. Their real utilities still require @source
// coverage below; the shared core's distinct utilities must survive both builds.
const NOT_EMITTED = new Set(["group", "peer", "dark", "container", "sr", "antialiased", "reference-erp1", "reference-erp2"]);

function utilitiesIn(text) {
  const found = new Set();
  for (const match of text.matchAll(/className\s*=\s*"([^"]+)"/g)) {
    for (const token of match[1].split(/\s+/)) {
      if (SIMPLE.test(token) && !NOT_EMITTED.has(token) && token.length > 2) found.add(token);
    }
  }
  return found;
}

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`  ${(ok ? "ok" : "FAIL").padEnd(6)}${label.padEnd(52)}${detail}`);
};

/* ---- which packages actually need to be seen ---------------------------- */
const styled = readdirSync(PACKAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .map((name) => ({ name, files: filesUnder(join(PACKAGES, name, "src"), [".tsx", ".ts"]) }))
  .map((pkg) => ({ ...pkg, utilities: pkg.files.reduce((all, f) => { for (const u of utilitiesIn(readFileSync(f, "utf8"))) all.add(u); return all; }, new Set()) }))
  .filter((pkg) => pkg.utilities.size > 0);

console.log(`\n  ${styled.length} packages use utility classes\n`);

/* ---- coverage: every one is @source'd by every app ---------------------- */
console.log("  every styled package is @source'd by both apps");
for (const app of APPS) {
  if (!existsSync(app.css)) { check(false, `${app.name}: entry stylesheet`, `${app.css} not found`); continue; }
  const css = readFileSync(app.css, "utf8");
  const sourced = [...css.matchAll(/@source\s+"([^"]+)"/g)].map((m) => m[1]);
  for (const pkg of styled) {
    const covered = sourced.some((line) => line.includes(`packages/${pkg.name}/`) || line.endsWith(`packages/${pkg.name}`));
    check(covered, `${app.name}: ${pkg.name}`, covered ? "" : `no @source line reaches packages/${pkg.name}/src — its classes will be purged`);
  }
}

/* ---- emitted: the canaries survived the build --------------------------- */
const owners = new Map();
for (const pkg of styled) for (const u of pkg.utilities) owners.set(u, (owners.get(u) ?? new Set()).add(pkg.name));
const uniqueTo = (name) => [...owners].filter(([, pkgs]) => pkgs.size === 1 && pkgs.has(name)).map(([u]) => u);

console.log("\n  utilities unique to a package survive into the built CSS");
for (const app of APPS) {
  const sheets = filesUnder(app.built, [".css"]).filter((f) => !f.includes("/dev/"));
  if (!sheets.length) { console.log(`    skip   ${app.name}: no build found — run ./run.sh build`); continue; }
  const emitted = sheets.map((f) => readFileSync(f, "utf8")).join("\n");
  for (const pkg of styled) {
    const canaries = uniqueTo(pkg.name).slice(0, 6);
    if (!canaries.length) { console.log(`    skip   ${app.name}: ${pkg.name} has no utility unique to it`); continue; }
    /* `.pb-1.5` is emitted as `.pb-1\.5` — CSS escapes the dot in a class
       name. Matching the raw form reported it purged when it was right there,
       which is precisely the crying-wolf this check was written to avoid. */
    const selector = (u) => `.${u.replace(/\./g, "\\.")}`;
    const missing = canaries.filter((u) => !emitted.includes(selector(u)));
    check(missing.length === 0, `${app.name}: ${pkg.name}`, missing.length ? `purged: ${missing.join(", ")}` : `${canaries.length} canaries present`);
  }
}

console.log();
if (failures) {
  console.error(`  ${failures} check(s) failed.\n`);
  console.error("  A package Tailwind cannot see builds, typechecks and renders unstyled.");
  console.error("  Add an @source line for it to BOTH apps' entry stylesheets.\n");
  process.exit(1);
}
console.log("  Every styled package is visible to both apps, and its classes survive the build.\n");
