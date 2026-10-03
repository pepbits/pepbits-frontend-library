import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Real-browser parity with the ORIGINAL MedBand stylesheet. Opt-in (needs Chromium from the diagnostics browser install):
 *
 *   MEDBAND_BROWSER_PARITY=1 FONTCONFIG_FILE=... LD_LIBRARY_PATH=... npx vitest run packages/reference-medband/src/browser-parity.test.ts
 *
 * scripts/medband/parity/run.mjs mounts the real module over the shared host stylesheet (tokens, reference-host theme, ops-ui
 * utilities, Tailwind) with the test transport. Every classed element it renders is re-created with the same tag, ancestors and
 * class string on a page that carries only the original MedBand CSS, and colour, border, radius, padding, type, shadow and the
 * fixed sizes are compared, at rest, in open popovers/dialogs/toasts/validation, and on hover and focus. It also proves the
 * managed preferences still win over the reference skin (theme, font, radius, scales, table density/wrapping).
 * It runs in a child process: vitest's jsdom environment cannot host esbuild or Playwright.
 */
const enabled = !!process.env.MEDBAND_BROWSER_PARITY;
let checks: { name: string; failures: string[] }[] = [];

describe.skipIf(!enabled)("MedBand controls are the original's in a real browser (reference-default presentation)", () => {
  beforeAll(() => {
    const run = spawnSync(process.execPath, ["scripts/medband/parity/run.mjs", "--json"], { cwd: resolve(__dirname, "../../.."), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 280_000 });
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
