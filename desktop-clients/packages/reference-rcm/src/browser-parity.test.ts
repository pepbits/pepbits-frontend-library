import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Real-browser parity with the ORIGINAL RCM stylesheet (Tailwind 3 + the original globals/config). Opt-in (needs Chromium from the
 * diagnostics browser install):
 *
 *   RCM_BROWSER_PARITY=1 FONTCONFIG_FILE=... LD_LIBRARY_PATH=... PLAYWRIGHT_BROWSERS_PATH=... npx vitest run packages/reference-rcm/src/browser-parity.test.ts
 *
 * scripts/rcm/parity/run.mjs mounts the real module over the host stylesheet (Tailwind 4 host, tokens, reference-host, ops-ui, the global
 * `.library-preferences` utilities). Every classed element it renders is re-created with the same tag, ancestors, sibling position and
 * class string on a page that carries only the original CSS, and colour, border, radius, padding, type, shadow and fixed sizes are compared
 * (no exception list), on the pages, in open dialogs/drawers/menus/palette/combobox, and on hover and focus. It also proves the managed
 * preferences still win over the original look (theme, font opt-in, radius, scales, table density/wrapping/sticky).
 * It runs in a child process: vitest's jsdom environment cannot host esbuild or Playwright.
 */
const enabled = !!process.env.RCM_BROWSER_PARITY;
let checks: { name: string; failures: string[] }[] = [];

describe.skipIf(!enabled)("RCM controls are the original's in a real browser (original-default presentation)", () => {
  beforeAll(() => {
    const run = spawnSync(process.execPath, ["scripts/rcm/parity/run.mjs", "--json"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 280_000 });
    const out = run.stdout.trim().split("\n").at(-1) ?? "";
    if (!out.startsWith("{")) throw new Error(`parity run produced no result:\n${run.stdout}\n${run.stderr}`);
    checks = JSON.parse(out).checks;
  }, 300_000);

  it("ran page, state, interaction and preference checks", () => {
    expect(checks.length).toBeGreaterThan(20);
  });

  it("every check passes", () => {
    const failed = checks.filter((c) => c.failures.length).map((c) => `${c.name}\n  ${c.failures.join("\n  ")}`);
    expect(failed).toEqual([]);
  });
});
