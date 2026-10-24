import {defineConfig} from 'vitest/config';
// At most two workers: several demo suites share this machine.
export default defineConfig({test: {globals: true, environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'], maxWorkers: 2, testTimeout: 60000}});
