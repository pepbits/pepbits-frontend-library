import {defineConfig} from "vitest/config";

/* The lifecycle suites render the full configuration page; under a parallel
   workspace run on a loaded machine they can exceed Vitest's 5 s default
   without any functional problem, so they get more headroom. */
export default defineConfig({test: {environment: "jsdom", setupFiles: ["./vitest.setup.ts"], include: ["src/**/*.test.{ts,tsx}"], maxWorkers: 2, testTimeout: 20000}});
