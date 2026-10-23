import {defineConfig} from "vitest/config";

/* Real-browser suites (*.browser.test.ts) launch Chromium, which needs OS
   libraries that not every machine has; they run separately with
   `npm run test:browser` so `npm test` stays portable. */
export default defineConfig({test: {environment: "jsdom", setupFiles: ["./vitest.setup.ts"], include: ["src/**/*.test.{ts,tsx}"], exclude: ["src/**/*.browser.test.ts", "**/node_modules/**"], maxWorkers: 2}});
