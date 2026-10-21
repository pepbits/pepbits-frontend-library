#!/usr/bin/env node
/**
 * Every form control comes from one place.
 *
 * Text boxes and dropdowns already did — there has never been a raw <select> or
 * <textarea> outside ops-ui. Checkboxes, radios and file inputs did not: five
 * were written by hand across four files, with four different class strings for
 * the same control and not one of them carrying a focus ring, a disabled state
 * or a label association. Nothing noticed, because nothing was looking.
 *
 * This looks. It is a grep with a reason attached, which is all it needs to be:
 * the failure it prevents is somebody reaching for `<input type="checkbox">`
 * because they did not know there was a Checkbox, and the answer is to say so
 * at the moment they run the checks.
 *
 * The rule is about the LIBRARY BOUNDARY, not about the elements. Inside ops-ui
 * these tags are the implementation and must be there; outside it they are a
 * fifth copy of a control that already exists.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

let failed = 0;
const check = (ok, name, detail = "") => {
  console.log(`    ${ok ? "ok  " : "FAIL"}  ${name.padEnd(56)}${detail}`);
  if (!ok) failed += 1;
};

const root = new URL("..", import.meta.url).pathname;

function* sources(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist" || entry === "src-tauri") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) yield path;
  }
}

/**
 * Packages that deliberately keep their own controls, each with the reason. Listed by name and printed on every run,
 * so the exception stays visible; a new package is never exempt by default.
 */
const EXEMPT = {
  "registration-wizard":
    "public, pre-tenant registration page with its own owner-approved design (HC-157); every control is labelled, " +
    "keyboard-reachable and carries focus and aria-invalid states, covered by the package's component tests",
};
for (const [name, reason] of Object.entries(EXEMPT)) console.log(`    note  packages/${name} keeps its own controls: ${reason}`);

/** Everything that is not the component library itself. */
const consumers = [...sources(join(root, "packages")), ...sources(join(root, "apps"))]
  .filter((path) => !path.includes(`${"packages"}/ops-ui/`))
  .filter((path) => !Object.keys(EXEMPT).some((name) => path.includes(`packages/${name}/`)));

/**
 * What must come from ops-ui, and what to reach for instead.
 *
 * The suggestion is the point. A check that says "do not do that" and stops
 * there gets suppressed; one that names the component gets followed.
 */
const RULES = [
  { pattern: /<table[\s>]/, control: "<table>", use: "Table and the shared table building blocks" },
  { pattern: /<input[^>]*type="checkbox"/, control: "<input type=\"checkbox\">", use: "Checkbox" },
  { pattern: /<input[^>]*type="radio"/, control: "<input type=\"radio\">", use: "Radio" },
  { pattern: /<input[^>]*type="file"/, control: "<input type=\"file\">", use: "FilePicker" },
  { pattern: /<select[\s>]/, control: "<select>", use: "Select, or ReferenceField for a server-fed list" },
  { pattern: /<textarea[\s>]/, control: "<textarea>", use: "Textarea" },
  /* The field styling copied rather than imported. `inputClass` is exported
     precisely so a control that needs to look like a field can say so. */
  { pattern: /h-9 w-full rounded-\[10px\] border/, control: "a copy of the field styling", use: "inputClass, or the control that already wraps it" },
];

console.log("\n  every form control comes from ops-ui\n");

check(consumers.length > 50, "there are files to check", `${consumers.length} components`);

for (const rule of RULES) {
  const offenders = consumers
    .filter((path) => rule.pattern.test(readFileSync(path, "utf8")))
    .map((path) => relative(root, path));
  check(offenders.length === 0, `no ${rule.control} outside ops-ui`,
    offenders.length ? `${offenders.join(", ")} — use ${rule.use}` : "");
}

/**
 * And the library still exports them.
 *
 * A rule pointing at a component that has been renamed or dropped is worse than
 * no rule: it refuses the only thing left to do.
 */
const barrel = readFileSync(join(root, "packages/ops-ui/src/index.ts"), "utf8");
const controls = readFileSync(join(root, "packages/ops-ui/src/form-controls.tsx"), "utf8");
check(barrel.includes("./form-controls"), "ops-ui exports its form controls");
for (const name of ["Checkbox", "Radio", "FilePicker", "Select", "Textarea", "Input", "SearchInput"]) {
  check(new RegExp(`export function ${name}\\b`).test(controls), `${name} exists to be used instead`);
}

console.log(failed === 0
  ? "\n  Every form control on every screen comes from the one library.\n"
  : `\n  ${failed} check(s) failed.\n`);
process.exit(failed === 0 ? 0 : 1);
