import {defineConfig} from "vitest/config";

/* Chromium suites only. Needs Playwright's Chromium and its OS libraries
   (`npx playwright install --with-deps chromium`, or LD_LIBRARY_PATH pointing
   at an unpacked copy of them). */
export default defineConfig({test: {include: ["src/**/*.browser.test.ts"], maxWorkers: 1}});
