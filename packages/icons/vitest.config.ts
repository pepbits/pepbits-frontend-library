import {defineConfig} from "vitest/config";

export default defineConfig({ssr: {resolve: {conditions: ['pepbits-source', 'module', 'node', 'development|production']}}, resolve: {conditions: ['pepbits-source', 'module', 'browser', 'development|production']},test: {include: ["src/**/*.test.{ts,tsx}"], maxWorkers: 2}});
