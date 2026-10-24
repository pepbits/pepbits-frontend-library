import {defineConfig} from "vitest/config";
export default defineConfig({test:{globals:true,environment:"jsdom",setupFiles:["./src/test-setup.ts"],include:["src/**/*.test.{ts,tsx}"],maxWorkers:1,testTimeout:30000}});
