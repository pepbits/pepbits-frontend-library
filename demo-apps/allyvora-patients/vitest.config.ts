import {defineConfig} from "vitest/config";
export default defineConfig({ssr: {resolve: {conditions: ['pepbits-source', 'module', 'node', 'development|production']}}, resolve: {conditions: ['pepbits-source', 'module', 'browser', 'development|production']},test:{globals:true,environment:"jsdom",setupFiles:["./src/test-setup.ts"],include:["src/**/*.test.{ts,tsx}"],maxWorkers:1,testTimeout:30000}});
