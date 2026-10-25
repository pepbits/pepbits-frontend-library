import {defineConfig} from "vitest/config";

/* Real-browser suites (*.browser.test.ts) launch Chromium, which needs OS
   libraries that not every machine has; they run separately with
   `npm run test:browser` so `npm test` stays portable. The longer test timeout
   keeps full-frame suites stable when the machine is shared and heavily loaded. */
export default defineConfig({ssr: {resolve: {conditions: ['pepbits-source', 'module', 'node', 'development|production']}}, resolve: {conditions: ['pepbits-source', 'module', 'browser', 'development|production']},test: {environment: "jsdom", setupFiles: ["./vitest.setup.ts"], include: ["src/**/*.test.{ts,tsx}"], exclude: ["src/**/*.browser.test.ts", "**/node_modules/**"], maxWorkers: 2, testTimeout: 20000}});
